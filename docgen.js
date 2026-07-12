// Vercel serverless function — free tier.
// Generates downloadable documents (DOCX / XLSX / PPTX / CSV) from simple,
// structured or markdown-ish text. Provider-agnostic — uses pure-JS libraries
// (docx, exceljs, pptxgenjs) so no API key is needed.
//
// Body: { type: 'docx'|'xlsx'|'pptx'|'csv', title?: string, content: string }
//   - docx: lines; "# " -> Heading 1, "## " -> Heading 2, "- " -> bullet, else paragraph
//   - pptx: slides separated by a line "---"; first line = slide title, rest = bullets
//   - xlsx: tab/comma separated rows, or a markdown table; first row = header
//   - csv:  returned as-is (or parsed from a markdown table)
// Returns: { ok, fileBase64, mimeType, filename } or { ok:false, error }

import { Document, Packer, Paragraph, HeadingLevel, TextRun } from 'docx';
import ExcelJS from 'exceljs';
import PptxGenJS from 'pptxgenjs';

const MAX_CONTENT_CHARS = 20000;

function parseMarkdownTableRows(text) {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('|') && l.endsWith('|'));
  const rows = lines.map((l) =>
    l
      .slice(1, -1)
      .split('|')
      .map((c) => c.trim())
  );
  // Drop a separator row like | --- | --- |
  const filtered = rows.filter((r) => !r.every((c) => /^:?-{2,}:?$/.test(c)));
  return filtered;
}

export function buildCsv(content) {
  const tableRows = parseMarkdownTableRows(content);
  if (tableRows.length) {
    return tableRows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
  }
  return content;
}

export async function buildDocx(title, content) {
  const lines = content.split('\n');
  const children = [];
  if (title) {
    children.push(new Paragraph({ text: title, heading: HeadingLevel.HEADING_1 }));
  }
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('## ')) {
      children.push(new Paragraph({ text: line.slice(3), heading: HeadingLevel.HEADING_2 }));
    } else if (line.startsWith('# ')) {
      children.push(new Paragraph({ text: line.slice(2), heading: HeadingLevel.HEADING_1 }));
    } else if (line.startsWith('- ')) {
      children.push(new Paragraph({ text: line.slice(2), bullet: { level: 0 } }));
    } else {
      children.push(new Paragraph({ children: [new TextRun(line)] }));
    }
  }
  const doc = new Document({ sections: [{ children }] });
  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer).toString('base64');
}

export async function buildXlsx(content) {
  const tableRows = parseMarkdownTableRows(content);
  let rows;
  if (tableRows.length) {
    rows = tableRows;
  } else {
    rows = content
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => l.split(/\t|,/).map((c) => c.trim()));
  }
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet1');
  ws.addRows(rows);
  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer).toString('base64');
}

export async function buildPptx(title, content) {
  const pptx = new PptxGenJS();
  const slideBlocks = content
    .split(/\n-{3,}\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const blocks = slideBlocks.length ? slideBlocks : [content];
  for (const block of blocks) {
    const [first, ...rest] = block.split('\n');
    const slide = pptx.addSlide();
    slide.addText(first || title || 'Slide', { x: 0.5, y: 0.4, fontSize: 28, bold: true });
    const bullets = rest
      .map((l) => l.replace(/^[-*]\s*/, '').trim())
      .filter(Boolean);
    if (bullets.length) {
      slide.addText(
        bullets.map((b) => ({ text: b, options: { bullet: true } })),
        { x: 0.6, y: 1.4, fontSize: 18 }
      );
    }
  }
  const buffer = await pptx.write({ outputType: 'nodebuffer' });
  return Buffer.from(buffer).toString('base64');
}

const MIME = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  csv: 'text/csv',
};

const EXT = { docx: 'docx', xlsx: 'xlsx', pptx: 'pptx', csv: 'csv' };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { type, title, content } = req.body || {};
  if (!['docx', 'xlsx', 'pptx', 'csv'].includes(type)) {
    res.status(400).json({ error: 'type must be docx|xlsx|pptx|csv' });
    return;
  }
  if (!content || typeof content !== 'string') {
    res.status(400).json({ error: 'content required' });
    return;
  }
  const safeContent = content.slice(0, MAX_CONTENT_CHARS);
  const safeTitle = (title || 'Fintly Document').slice(0, 120);

  try {
    let fileBase64;
    if (type === 'csv') fileBase64 = buildCsv(safeContent);
    else if (type === 'docx') fileBase64 = await buildDocx(safeTitle, safeContent);
    else if (type === 'xlsx') fileBase64 = await buildXlsx(safeContent);
    else fileBase64 = await buildPptx(safeTitle, safeContent);

    res.status(200).json({
      ok: true,
      fileBase64,
      mimeType: MIME[type],
      filename: `${safeTitle.replace(/[^\w.-]+/g, '_')}.${EXT[type]}`,
    });
  } catch (e) {
    res.status(200).json({ ok: false, error: e.message || 'docgen_failed' });
  }
}
