import { jsPDF } from 'jspdf';

// Exports any Fintly Pro answer text as a simple, clean PDF, entirely on the
// user's device (no server round-trip, no API cost). Strips the heaviest
// Markdown syntax (##, **, `) to plain readable text since jsPDF has no
// built-in Markdown renderer — good enough for saving/sharing an answer,
// not meant to be a pixel-perfect replica of the in-app formatting.
function stripMarkdown(text) {
  return text
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```\w*\n?/g, '').replace(/```/g, ''))
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '• ');
}

export function exportAnswerAsPdf(text, filenameHint = 'fintly-answer') {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const marginX = 48;
  const marginTop = 56;
  const marginBottom = 56;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const usableWidth = pageWidth - marginX * 2;
  const lineHeight = 16;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Fintly Pro', marginX, marginTop - 24);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);

  const cleaned = stripMarkdown(text);
  const paragraphs = cleaned.split(/\n{2,}/);
  let y = marginTop;

  for (const para of paragraphs) {
    const lines = doc.splitTextToSize(para.trim(), usableWidth);
    for (const line of lines) {
      if (y > pageHeight - marginBottom) {
        doc.addPage();
        y = marginTop;
      }
      doc.text(line, marginX, y);
      y += lineHeight;
    }
    y += lineHeight * 0.6; // paragraph spacing
  }

  const safeName = filenameHint.replace(/[^\w\- ]/g, '').trim().slice(0, 40) || 'fintly-answer';
  doc.save(`${safeName}.pdf`);
}
