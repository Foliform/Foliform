import { useEffect, useMemo, useState } from 'react';
import { BOOK_SIZES, findBookSize } from '../bookSizes';
import { kits } from '../builtinKits';
import { kitFontRoles, normalizeColumnCount } from '../bookStyles';
import { templatesEnabled } from '../featureFlags';
import { findFontNote } from '../fontCatalog';
import ColorPicker from './ColorPicker';
import Combobox from './Combobox';
import { FontPickerControl } from './FontPickerControl';

// "Playfair Display, Georgia, serif" → "Playfair Display". The pickers work in
// family names; kits store whatever was picked and bookStyles.js resolves it
// into a stack, so the panel needs the name back to show it in the field.
const familyOf = stack => String(stack || '').split(',')[0].replace(/["']/g, '').trim();

const FONT_ROLES = [
  { role: 'title', label: 'Title font' },
  { role: 'subtitle', label: 'Subtitle font' },
  { role: 'body', label: 'Body font' },
];

// Glyph + label header, matching the mock-up's Aa / H / ◌ section strips.
function SectionHead({ glyph, title, action }) {
  return <div className="inspector-section"><span className="section-glyph" aria-hidden="true">{glyph}</span><h3>{title}</h3>{action}</div>;
}

export function Inspector({ tab, setTab, kit, setKit, onApplyTemplate, setPageSize, metadata, setMetadata, title, setTitle, onImport, recentImage, selectedImage, onImageResize, onFontLoad, onFontAll, onRemix, collapsed, onToggle, localColumnsOnly = false }) {
  const [templates, setTemplates] = useState([]);
  const [templateQuery, setTemplateQuery] = useState('');
  // Built-in kits and saved templates (from the Template Manager window,
  // stored in SQLite) show up in the same search box — from here they're
  // just "a preset I can apply", regardless of which one is editable.
  const templateEntries = [
    ...Object.entries(kits).map(([key, preset]) => ({ key, name: preset.name, data: preset })),
    ...templates.map(t => ({ key: t.id, name: t.name, data: t.data })),
  ];
  // Memoized so the combobox sees a stable options array — it filters these on
  // every keystroke, and a fresh array each render would redo that work.
  const templateNames = useMemo(() => templateEntries.map(entry => entry.name), [templates]);

  const roles = kitFontRoles(kit);
  const fontNames = { title: familyOf(roles.title), subtitle: familyOf(roles.subtitle), body: familyOf(roles.body) };
  const titleSize = kit.titleSize || Math.round((kit.size || 18) * 1.9);
  const subtitleSize = kit.subtitleSize || Math.round((kit.size || 18) * 1.2);
  const lineHeight = kit.lineHeight || 1.62;
  const imageForEdit = selectedImage || recentImage;

  const refreshTemplates = () => {
    if (!templatesEnabled) return;
    window.manuscript?.listTemplates().then(list => { if (list) setTemplates(list); }).catch(() => {});
  };
  useEffect(() => {
    refreshTemplates();
    // The Template Manager is a separate OS window — picking this window
    // back up (e.g. after saving a template there) is the moment to notice
    // changes, since the two windows don't share React state directly.
    window.addEventListener('focus', refreshTemplates);
    return () => window.removeEventListener('focus', refreshTemplates);
  }, []);

  // Font choices commit only after the user picks a family. Clearing the
  // picker resets that role to the body font.
  const handleFontSelect = (role, family) => onFontLoad(role, family);

  // Applying a template is likewise a commit, not a keystroke, so a partial
  // name mid-search can't reset fonts/colors/margins out from under the user.
  const handleTemplateInput = value => {
    setTemplateQuery(value);
    const match = templateEntries.find(entry => entry.name === value);
    if (match) onApplyTemplate(match.data);
  };

  return <aside className={`inspector ${collapsed ? 'panel-collapsed' : ''}`}>
    <div className="inspector-tabs"><button className="panel-toggle" aria-label={collapsed ? 'Open inspector' : 'Collapse inspector'} onClick={onToggle}>{collapsed ? '‹' : '›'}</button>{!collapsed && ['Style', 'Metadata', 'Assets'].map(item => <button className={tab === item ? 'active-tab' : ''} onClick={() => setTab(item)} key={item}>{item}</button>)}</div>
    {!collapsed && <>
      {tab === 'Style' && <div className="inspector-body"><h2>Document style</h2>
        {templatesEnabled && <>
          <label htmlFor="template-field">Template</label>
          <Combobox id="template-field" label="Template" value={templateQuery} options={templateNames} placeholder="Search templates…" onSelect={handleTemplateInput} />
          <small className="muted">Applying a template replaces the fonts, colors, and margins below. Manage templates from the Templates button in the header.</small>
        </>}

        <SectionHead glyph="Aa" title="Font families" action={<button className="section-action" onClick={onRemix} title="Pick a new title/body pairing"><span aria-hidden="true">⟳</span> Remix fonts</button>} />
        {FONT_ROLES.map(({ role, label }) => <div className="font-row" key={role}>
          <label htmlFor={`font-${role}`}>{label}</label>
          <div className="font-row-control">
            <FontPickerControl label={label} value={fontNames[role]} onSelect={family => handleFontSelect(role, family)} />
            <button className="row-action" title={`Use ${fontNames[role]} for all text`} aria-label={`Use ${fontNames[role]} for all text`} onClick={() => onFontAll(role)}>↦</button>
          </div>
        </div>)}
        <small className="font-status">{findFontNote(fontNames.body) || 'Choose from Google Fonts or available system fonts.'}</small>

        <SectionHead glyph="H" title="Type scale" />
        <label>Title size <span>{titleSize} pt</span></label>
        <input type="range" min="16" max="64" value={titleSize} onChange={event => setKit({ ...kit, titleSize: Number(event.target.value) })} />
        <label>Subtitle size <span>{subtitleSize} pt</span></label>
        <input type="range" min="12" max="40" value={subtitleSize} onChange={event => setKit({ ...kit, subtitleSize: Number(event.target.value) })} />
        <label>Body size <span>{kit.size} pt</span></label>
        <input type="range" min="14" max="22" value={kit.size} onChange={event => setKit({ ...kit, size: Number(event.target.value) })} />
        <label>Line height <span>{lineHeight.toFixed(2)}</span></label>
        <input type="range" min="1.2" max="2.2" step="0.02" value={lineHeight} onChange={event => setKit({ ...kit, lineHeight: Number(event.target.value) })} />

        <SectionHead glyph="◌" title="Colors" />
        <label>Page background</label>
        <ColorPicker label="Page background" value={kit.paper} onChange={paper => setKit({ ...kit, paper })} />
        <label>Title</label>
        <ColorPicker label="Title colour" compact value={kit.titleInk || kit.ink} onChange={titleInk => setKit({ ...kit, titleInk })} onReset={() => setKit({ ...kit, titleInk: undefined })} />
        <label>Subtitle</label>
        <ColorPicker label="Subtitle colour" compact value={kit.subtitleInk || kit.ink} onChange={subtitleInk => setKit({ ...kit, subtitleInk })} onReset={() => setKit({ ...kit, subtitleInk: undefined })} />
        <label>Body</label>
        <ColorPicker label="Body colour" compact value={kit.ink} onChange={ink => setKit({ ...kit, ink })} />

        <SectionHead glyph="▤" title="Page" />
        <label>Page size</label>
        <select className="field" value={kit.pageSizeId || 'a4'} onChange={event => setPageSize(findBookSize(event.target.value))}>{BOOK_SIZES.map(size => <option value={size.id} key={size.id}>{size.label} — {size.use}</option>)}</select>
        <small className="muted">{(() => { const s = findBookSize(kit.pageSizeId || 'a4'); return `${s.widthMm} × ${s.heightMm} mm`; })()}</small>
        <label>Page margins <span>{kit.margin} pt</span></label>
        <input type="range" min="32" max="76" value={kit.margin} onChange={event => setKit({ ...kit, margin: Number(event.target.value) })} />
        <label>Text columns</label>
        <select className="field" value={normalizeColumnCount(kit.columnCount)} disabled={localColumnsOnly} onChange={event => setKit({ ...kit, columnCount: Number(event.target.value) })}>
          <option value={1}>One column</option>
          <option value={2}>Two columns</option>
          <option value={3}>Three columns</option>
        </select>
        {localColumnsOnly && <small className="muted">Local columns are in use; surrounding text stays in one column. Use More → Whole-book columns to apply columns to the whole manuscript.</small>}
        <label className="checkbox-row"><input type="checkbox" checked={!!kit.dropCaps} onChange={event => setKit({ ...kit, dropCaps: event.target.checked })} /> Enlarge opening letters (drop caps)</label>
        <label>Drop-cap height</label>
        <select className="field" value={kit.dropCapLines === 2 ? 2 : 3} disabled={!kit.dropCaps} onChange={event => setKit({ ...kit, dropCapLines: Number(event.target.value) })}>
          <option value={2}>2 lines</option>
          <option value={3}>3 lines</option>
        </select>
        <label>Drop-cap colour</label>
        <ColorPicker label="Drop-cap colour" compact value={kit.dropCapColor || kit.accent} onChange={dropCapColor => setKit({ ...kit, dropCapColor })} onReset={() => setKit({ ...kit, dropCapColor: undefined })} />
        <label className="checkbox-row"><input type="checkbox" checked={!!kit.chapterBreaks} onChange={event => setKit({ ...kit, chapterBreaks: event.target.checked })} /> Start every chapter (H1) on a new page</label>
      </div>}
      {tab === 'Metadata' && <div className="inspector-body"><h2>Publishing details</h2><label>Book title</label><input className="field" value={title} onChange={event => setTitle(event.target.value)} /><label>Author</label><input className="field" value={metadata.author || ''} onChange={event => setMetadata({ ...metadata, author: event.target.value })} /><label>Language</label><input className="field" value={metadata.language || ''} onChange={event => setMetadata({ ...metadata, language: event.target.value })} /><label>Page numbering</label><select className="field" value={metadata.pageNumbers || 'off'} onChange={event => setMetadata({ ...metadata, pageNumbers: event.target.value })}><option value="off">None</option><option value="plain">Page number</option><option value="total">Page number of total (3 / 24)</option></select><label>Running header</label><select className="field" value={metadata.runningHead || 'off'} onChange={event => setMetadata({ ...metadata, runningHead: event.target.value })}><option value="off">None</option><option value="title">Book title</option><option value="chapter">Current chapter title</option></select><small className="muted">Applies to every page, including the first. Same for the live preview and every export.</small></div>}
      {tab === 'Assets' && <div className="inspector-body"><h2>Assets</h2><div className="empty-assets">⌁<p>Import images into this project</p><button className="wide-button" onClick={onImport}>Choose image</button><small>Images are copied into the project assets folder.</small></div>{imageForEdit && <div className="image-size-controls"><strong>{selectedImage ? 'Selected image' : 'Latest imported image'}</strong><label>Alt text<input className="field" value={imageForEdit.alt || ''} onChange={event => onImageResize('alt', event.target.value)} /></label><small className="muted">Set dimensions in pixels. Leave height blank to keep the image proportional.</small><div className="image-size-fields"><label>Width<input className="field" type="number" min="1" step="1" value={imageForEdit.width || ''} onChange={event => onImageResize('width', event.target.value)} /></label><label>Height<input className="field" type="number" min="1" step="1" placeholder="Auto" value={imageForEdit.height || ''} onChange={event => onImageResize('height', event.target.value)} /></label></div></div>}<small className="muted">Click an image in the preview to select it. Changes are saved with the manuscript.</small></div>}
    </>}
  </aside>;
}
