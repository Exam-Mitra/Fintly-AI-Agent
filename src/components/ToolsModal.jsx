import { useState } from 'react';
import {
  generateImage,
  generateDocument,
  fetchWebPage,
  searchImages,
  runCode,
  downloadBase64File,
} from '../lib/tools.js';

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1] || '');
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}

const TEMPLATES = [
  { label: '✈️ Travel itinerary', prompt: 'Create a detailed day-by-day travel itinerary for a 5-day trip. Ask me for destination, budget, and interests if needed, otherwise assume a moderate budget and suggest a popular destination.' },
  { label: '💰 Monthly budget', prompt: 'Make a practical monthly personal budget plan with categories (rent, food, transport, savings, fun) and suggested percentages of income.' },
  { label: '📚 Study plan', prompt: 'Build a 2-week exam revision study timetable for a typical subject, with daily slots and breaks.' },
  { label: '🍽 Meal plan', prompt: 'Create a 7-day healthy meal plan with breakfast, lunch, and dinner, keeping it simple and budget-friendly.' },
  { label: '💪 Workout routine', prompt: 'Design a 4-day weekly beginner-friendly workout routine with exercises, sets, and reps.' },
  { label: '📅 Content calendar', prompt: 'Make a 4-week social-media content calendar with post ideas and themes for a small business.' },
];

const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16,
};
const panel = {
  width: '100%', maxWidth: 480, maxHeight: '92vh', overflowY: 'auto',
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 18, color: 'var(--ink)',
};
const tabBtn = (active) => ({
  flex: 1, fontSize: 11.5, fontWeight: 700, padding: '8px 4px', borderRadius: 10,
  border: '1px solid var(--border)', background: active ? 'var(--accent-gradient)' : 'var(--surface-2)',
  color: active ? '#0F1115' : 'var(--ink-soft)',
});
const field = {
  width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12,
  padding: '10px 12px', color: 'var(--ink)', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
};
const primaryBtn = {
  width: '100%', fontSize: 14, fontWeight: 700, color: '#0F1115', padding: '11px',
  borderRadius: 12, background: 'var(--accent-gradient)', border: 'none', cursor: 'pointer',
};

export default function ToolsModal({ open, onClose, onAddImage, onAddText, onTemplate }) {
  const [tab, setTab] = useState('image');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // image
  const [imgMode, setImgMode] = useState('generate'); // generate | search
  const [prompt, setPrompt] = useState('');
  const [aspect, setAspect] = useState('1:1');
  const [editMode, setEditMode] = useState(false);
  const [editFile, setEditFile] = useState(null);
  const [imageResult, setImageResult] = useState(null);

  // image search
  const [imgQuery, setImgQuery] = useState('');
  const [imgResults, setImgResults] = useState(null);

  // doc
  const [docType, setDocType] = useState('docx');
  const [docTitle, setDocTitle] = useState('');
  const [docContent, setDocContent] = useState('');

  // web
  const [url, setUrl] = useState('');
  const [webResult, setWebResult] = useState(null);

  // code
  const [codeText, setCodeText] = useState('');
  const [codeResult, setCodeResult] = useState(null);

  if (!open) return null;
  const close = () => { setError(''); onClose(); };

  const runImage = async () => {
    if (!prompt.trim() || loading) return;
    setLoading(true); setError(''); setImageResult(null);
    try {
      let editBase64, editMime;
      if (editMode && editFile) { editBase64 = await readFileAsBase64(editFile); editMime = editFile.type || 'image/png'; }
      const data = await generateImage({ prompt, aspectRatio: aspect, editBase64, editMime });
      setImageResult(data);
    } catch (e) { setError(e.message || 'Image generation failed.'); }
    finally { setLoading(false); }
  };
  const addImageToChat = () => {
    if (!imageResult) return;
    onAddImage({
      kind: 'image', name: 'fintly-generated.png', mimeType: imageResult.mimeType,
      dataBase64: imageResult.imageBase64,
      previewUrl: `data:${imageResult.mimeType};base64,${imageResult.imageBase64}`,
    });
    setImageResult(null); setPrompt(''); close();
  };

  const runImageSearch = async () => {
    if (!imgQuery.trim() || loading) return;
    setLoading(true); setError(''); setImgResults(null);
    try { const data = await searchImages({ query: imgQuery }); setImgResults(data); }
    catch (e) { setError(e.message || 'Image search failed.'); }
    finally { setLoading(false); }
  };
  const addImgResultsToChat = () => {
    if (!imgResults?.images?.length) return;
    const top = imgResults.images.slice(0, 6).map((i) => `- ${i.description || 'image'}: ${i.url}`).join('\n');
    onAddText({ name: `image search ${imgResults.query}`, content: `Image search results for "${imgResults.query}":\n${top}` });
    setImgResults(null); setImgQuery(''); close();
  };

  const runDoc = async () => {
    if (!docContent.trim() || loading) return;
    setLoading(true); setError('');
    try {
      const data = await generateDocument({ type: docType, title: docTitle, content: docContent });
      downloadBase64File(data.fileBase64, data.mimeType, data.filename);
      close();
    } catch (e) { setError(e.message || 'Document generation failed.'); }
    finally { setLoading(false); }
  };

  const runWeb = async () => {
    if (!url.trim() || loading) return;
    setLoading(true); setError(''); setWebResult(null);
    try { const data = await fetchWebPage({ url }); setWebResult(data); }
    catch (e) { setError(e.message || 'Could not fetch that page.'); }
    finally { setLoading(false); }
  };
  const addWebToChat = () => {
    if (!webResult) return;
    onAddText({ name: webResult.title ? `${webResult.title} (web)` : 'web-page.txt', content: `Source: ${webResult.url}\nTitle: ${webResult.title}\n\n${webResult.text}` });
    setWebResult(null); setUrl(''); close();
  };

  const runCodeExec = async () => {
    if (!codeText.trim() || loading) return;
    setLoading(true); setError(''); setCodeResult(null);
    try { const data = await runCode({ code: codeText, language: 'js' }); setCodeResult(data); }
    catch (e) { setError(e.message + (e.note ? ` — ${e.note}` : '')); }
    finally { setLoading(false); }
  };
  const addCodeToChat = () => {
    if (!codeResult) return;
    const out = `Code output:\n${codeResult.logs || ''}${codeResult.result ? '\nResult: ' + codeResult.result : ''}${codeResult.error ? '\nError: ' + codeResult.error : ''}`;
    onAddText({ name: 'code-output.txt', content: out });
    setCodeResult(null); setCodeText(''); close();
  };

  const pickTemplate = (p) => { if (onTemplate) onTemplate(p); close(); };

  return (
    <div style={overlay} onClick={close}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <strong style={{ fontSize: 15 }}>Fintly Tools</strong>
          <button onClick={close} style={{ background: 'transparent', border: 'none', color: 'var(--ink-soft)', fontSize: 18, cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          {[['image', '🖼 Image'], ['doc', '📄 Doc'], ['web', '🌐 Web'], ['templates', '🗂 Templates'], ['code', '💻 Code']].map(([t, l]) => (
            <button key={t} style={tabBtn(tab === t)} onClick={() => { setTab(t); setError(''); }}>{l}</button>
          ))}
        </div>

        {error && <div style={{ color: 'var(--danger)', fontSize: 12.5, marginBottom: 10 }}>{error}</div>}

        {tab === 'image' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {[['generate', 'Generate'], ['search', 'Search']].map(([m, l]) => (
                <button key={m} style={{ ...tabBtn(imgMode === m), flex: 1 }} onClick={() => setImgMode(m)}>{l}</button>
              ))}
            </div>

            {imgMode === 'generate' ? (
              <>
                <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3}
                  placeholder="Describe the image you want… (or how to restyle an uploaded image)" style={field} />
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <label style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>Aspect</label>
                  <select value={aspect} onChange={(e) => setAspect(e.target.value)} style={{ ...field, flex: 1 }}>
                    {['1:1', '3:4', '4:3', '16:9', '9:16'].map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <label style={{ fontSize: 12.5, color: 'var(--ink-soft)', display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="checkbox" checked={editMode} onChange={(e) => setEditMode(e.target.checked)} /> Restyle / edit an uploaded image
                </label>
                {editMode && <input type="file" accept="image/*" onChange={(e) => setEditFile(e.target.files?.[0] || null)} />}
                <button style={primaryBtn} onClick={runImage} disabled={loading || !prompt.trim()}>
                  {loading ? 'Generating…' : editMode ? 'Restyle image' : 'Generate image'}
                </button>
                {imageResult && (
                  <div style={{ marginTop: 6 }}>
                    <img src={`data:${imageResult.mimeType};base64,${imageResult.imageBase64}`} alt="generated"
                      style={{ width: '100%', borderRadius: 12, border: '1px solid var(--border)' }} />
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button style={{ ...primaryBtn, flex: 1 }} onClick={() => downloadBase64File(imageResult.imageBase64, imageResult.mimeType, 'fintly-image.png')}>Download</button>
                      <button style={{ ...primaryBtn, flex: 1, background: 'var(--surface-2)', color: 'var(--ink)' }} onClick={addImageToChat}>Add to chat</button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <input value={imgQuery} onChange={(e) => setImgQuery(e.target.value)} placeholder="Search images for…" style={field} />
                <button style={primaryBtn} onClick={runImageSearch} disabled={loading || !imgQuery.trim()}>
                  {loading ? 'Searching…' : 'Search images'}
                </button>
                {imgResults && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {imgResults.images.slice(0, 8).map((img, i) => (
                        <a key={i} href={img.url} target="_blank" rel="noreferrer"
                          style={{ display: 'block', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
                          <img src={img.url} alt={img.description} style={{ width: '100%', height: 110, objectFit: 'cover', display: 'block' }} />
                        </a>
                      ))}
                    </div>
                    <button style={{ ...primaryBtn, background: 'var(--surface-2)', color: 'var(--ink)' }} onClick={addImgResultsToChat}>
                      Add results to chat
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {tab === 'doc' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <select value={docType} onChange={(e) => setDocType(e.target.value)} style={field}>
              <option value="docx">Word (.docx)</option>
              <option value="xlsx">Excel (.xlsx)</option>
              <option value="pptx">PowerPoint (.pptx)</option>
              <option value="csv">CSV (.csv)</option>
            </select>
            <input value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder="Title (optional)" style={field} />
            <textarea value={docContent} onChange={(e) => setDocContent(e.target.value)} rows={8}
              placeholder={docType === 'pptx'
                ? 'Slide title on first line, bullets below. Separate slides with a line of ---'
                : docType === 'xlsx' || docType === 'csv'
                ? 'Rows of comma/tab-separated values, or a markdown table'
                : '# Heading\n## Subheading\n- bullet\nNormal paragraph'} style={field} />
            <button style={primaryBtn} onClick={runDoc} disabled={loading || !docContent.trim()}>
              {loading ? 'Building…' : 'Generate & download'}
            </button>
          </div>
        )}

        {tab === 'web' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/article" style={field} />
            <button style={primaryBtn} onClick={runWeb} disabled={loading || !url.trim()}>
              {loading ? 'Fetching…' : 'Read this page'}
            </button>
            {webResult && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{webResult.title}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)', maxHeight: 160, overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
                  {webResult.text.slice(0, 1200)}{webResult.text.length > 1200 ? '…' : ''}
                </div>
                <button style={{ ...primaryBtn, background: 'var(--surface-2)', color: 'var(--ink)' }} onClick={addWebToChat}>
                  Add page text to chat
                </button>
              </div>
            )}
          </div>
        )}

        {tab === 'templates' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', margin: 0 }}>
              Pick a template — Fintly will start a ready-made plan you can refine in chat.
            </p>
            {TEMPLATES.map((t) => (
              <button key={t.label} onClick={() => pickTemplate(t.prompt)}
                style={{ textAlign: 'left', fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '11px 13px', cursor: 'pointer' }}>
                {t.label}
              </button>
            ))}
          </div>
        )}

        {tab === 'code' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ fontSize: 12, color: 'var(--ink-soft)', margin: 0 }}>
              Runs JavaScript in a safe sandbox (no file/network access). Output is captured below.
            </p>
            <textarea value={codeText} onChange={(e) => setCodeText(e.target.value)} rows={7}
              placeholder={'const nums = [3,1,4,1,5,9,2,6];\nconsole.log("sum:", nums.reduce((a,b)=>a+b,0));\nnums.sort((a,b)=>a-b);'} style={{ ...field, fontFamily: 'monospace', fontSize: 13 }} />
            <button style={primaryBtn} onClick={runCodeExec} disabled={loading || !codeText.trim()}>
              {loading ? 'Running…' : 'Run code'}
            </button>
            {codeResult && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 2 }}>
                <pre style={{ margin: 0, fontSize: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: 10, maxHeight: 200, overflow: 'auto', whiteSpace: 'pre-wrap', color: 'var(--ink)' }}>
{codeResult.error ? 'Error: ' + codeResult.error : (codeResult.logs || '') + (codeResult.result ? '\n→ ' + codeResult.result : '')}
                </pre>
                <button style={{ ...primaryBtn, background: 'var(--surface-2)', color: 'var(--ink)' }} onClick={addCodeToChat}>
                  Add output to chat
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
