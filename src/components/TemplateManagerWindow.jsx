import { useEffect, useState } from 'react';
import { BOOK_SIZES, findBookSize } from '../bookSizes';
import { findFont } from '../fontCatalog';
import { fontStack, normalizeColumnCount } from '../bookStyles';
import ColorPicker from './ColorPicker';
import Combobox from './Combobox';
import { FontPickerControl } from './FontPickerControl';

const BLANK = {
  font: '', googleFont: '', titleSize: 34, subtitleSize: 20, size: 18, margin: 52,
  paper: '#fbf9f4', ink: '#1a1917', accent: '#7c3aed',
  pageSizeId: 'a4', pageWidthMm: 210, pageHeightMm: 297, chapterBreaks: false,
  columnCount: 1, dropCaps: false, dropCapLines: 3,
};
const familyOf = stack => String(stack || '').split(',')[0].replace(/["']/g, '').trim();

// Runs in its own BrowserWindow (see main.js's openTemplateManagerWindow and
// renderer.jsx's ?window=templates check) — same bundle as the main app
// window, different root component. Manages only custom, DB-backed
// templates; the four built-in kits are fixed and not editable here, though
// they still show up alongside these in the main window's Template picker.
export function TemplateManagerWindow() {
  const [theme, setTheme] = useState(() => new URLSearchParams(window.location.search).get('theme') === 'light' ? 'light' : 'dark');
  const [templates, setTemplates] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [name, setName] = useState('');
  const [data, setData] = useState(BLANK);
  const [fontQuery, setFontQuery] = useState('');
  const [status, setStatus] = useState('');

  const refresh = () => window.manuscript?.listTemplates().then(list => setTemplates(list || [])).catch(() => {});
  useEffect(() => {
    const applyTheme = nextTheme => {
      const resolvedTheme = nextTheme === 'light' ? 'light' : 'dark';
      setTheme(resolvedTheme);
      document.documentElement.classList.toggle('theme-light', resolvedTheme === 'light');
      document.body.classList.toggle('theme-light', resolvedTheme === 'light');
      document.documentElement.dataset.fpTheme = resolvedTheme;
      document.body.dataset.fpTheme = resolvedTheme;
    };
    applyTheme(theme);
    const unsubscribe = window.manuscript?.onThemeChange(applyTheme);
    refresh();
    return unsubscribe;
  }, []);

  const selectTemplate = template => {
    setSelectedId(template.id);
    setName(template.name);
    setData({ ...BLANK, ...template.data });
    setFontQuery(template.data.googleFont || familyOf(template.data.font));
    setStatus('');
  };

  const startNew = () => {
    setSelectedId(null);
    setName('');
    setData(BLANK);
    setFontQuery('');
    setStatus('');
  };

  // Keep curated fallback stacks for familiar faces and a safe stack for other
  // picker families, since templates are reused across project installations.
  const handleFontInput = value => {
    setFontQuery(value);
    if (value === '') { setData(current => ({ ...current, font: '', googleFont: '' })); return; }
    const font = findFont(value);
    setData(current => ({
      ...current,
      font: font?.stack || fontStack(value),
      googleFont: font?.google || (font ? '' : value),
    }));
  };

  const save = async () => {
    if (!name.trim()) { setStatus('Name this template before saving.'); return; }
    const saved = await window.manuscript?.saveTemplate({ id: selectedId, name: name.trim(), data });
    if (!saved) { setStatus('Could not save — try again.'); return; }
    setSelectedId(saved.id);
    setStatus('Saved');
    refresh();
  };

  const remove = async () => {
    if (!selectedId) return;
    await window.manuscript?.deleteTemplate(selectedId);
    startNew();
    refresh();
  };

  return <div className={`template-manager theme-${theme}`}>
    <header className="template-manager-header">
      <h1>Templates</h1>
      <p className="muted">Reusable style presets — typography, columns, drop caps, colors, and page setup — applied from the Template field in any manuscript's Style tab.</p>
    </header>
    <div className="template-manager-body">
      <aside className="template-list">
        <button className="wide-button" onClick={startNew}>+ New template</button>
        {templates.length === 0 && <p className="muted small">No custom templates yet. Built-in templates (House Serif, Editorial, Workbook, Studio Dark) aren't listed here — they're fixed, but still selectable from any manuscript.</p>}
        {templates.map(template => <button key={template.id} className={`template-list-item ${selectedId === template.id ? 'active' : ''}`} onClick={() => selectTemplate(template)}>
          <b>{template.name}</b>
          <small>{new Date(template.updatedAt).toLocaleDateString()}</small>
        </button>)}
      </aside>
      <section className="template-form">
        <label>Template name</label>
        <input className="field" value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Client proposal" />

        <label htmlFor="tm-font">Font</label>
        <FontPickerControl label="Template font" value={fontQuery} onSelect={handleFontInput} />
        <small className="muted">Sets every text role. Templates saved before the per-role pickers in the Style tab still apply as one font for all text.</small>

        <label>Title size <span>{data.titleSize} pt</span></label>
        <input type="range" min="24" max="52" value={data.titleSize} onChange={event => setData({ ...data, titleSize: Number(event.target.value) })} />
        <label>Subtitle size <span>{data.subtitleSize} pt</span></label>
        <input type="range" min="14" max="32" value={data.subtitleSize} onChange={event => setData({ ...data, subtitleSize: Number(event.target.value) })} />
        <label>Body size <span>{data.size} pt</span></label>
        <input type="range" min="14" max="22" value={data.size} onChange={event => setData({ ...data, size: Number(event.target.value) })} />
        <label>Margins <span>{data.margin} pt</span></label>
        <input type="range" min="32" max="76" value={data.margin} onChange={event => setData({ ...data, margin: Number(event.target.value) })} />

        <label>Page size</label>
        <select className="field" value={data.pageSizeId} onChange={event => { const size = findBookSize(event.target.value); setData({ ...data, pageSizeId: size.id, pageWidthMm: size.widthMm, pageHeightMm: size.heightMm }); }}>
          {BOOK_SIZES.map(size => <option value={size.id} key={size.id}>{size.label} — {size.use}</option>)}
        </select>

        <label>Page background</label>
        <ColorPicker value={data.paper} onChange={paper => setData({ ...data, paper })} />

        <label>Text columns</label>
        <select className="field" value={normalizeColumnCount(data.columnCount)} onChange={event => setData({ ...data, columnCount: Number(event.target.value) })}>
          <option value={1}>One column</option>
          <option value={2}>Two columns</option>
          <option value={3}>Three columns</option>
        </select>
        <label className="checkbox-row"><input type="checkbox" checked={!!data.dropCaps} onChange={event => setData({ ...data, dropCaps: event.target.checked })} /> Enlarge opening letters (drop caps)</label>
        <label>Drop-cap height</label>
        <select className="field" value={data.dropCapLines === 2 ? 2 : 3} disabled={!data.dropCaps} onChange={event => setData({ ...data, dropCapLines: Number(event.target.value) })}>
          <option value={2}>2 lines</option>
          <option value={3}>3 lines</option>
        </select>
        <label>Drop-cap colour</label>
        <ColorPicker label="Drop-cap colour" compact value={data.dropCapColor || data.accent} onChange={dropCapColor => setData({ ...data, dropCapColor })} onReset={() => setData({ ...data, dropCapColor: undefined })} />
        <label className="checkbox-row"><input type="checkbox" checked={!!data.chapterBreaks} onChange={event => setData({ ...data, chapterBreaks: event.target.checked })} /> Start every chapter (H1) on a new page</label>

        <div className="template-form-actions">
          <button className="primary" onClick={save}>Save template</button>
          {selectedId && <button onClick={remove}>Delete</button>}
        </div>
        {status && <small className="muted">{status}</small>}
      </section>
    </div>
  </div>;
}
