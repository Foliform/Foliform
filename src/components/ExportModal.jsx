import { useState } from 'react';
import { BOOK_SIZES, findBookSize } from '../bookSizes';

export function ExportModal({ title, kit = {}, onClose, onExport }) {
  const [pageSizeId, setPageSizeId] = useState(kit.pageSizeId || 'a4');
  const [marginMm, setMarginMm] = useState(String(Math.round((Number.isFinite(kit.margin) ? kit.margin : 52) * 25.4 / 72)));
  const [bleedMm, setBleedMm] = useState('3');
  const [paperBleed, setPaperBleed] = useState(true);
  const size = findBookSize(pageSizeId);

  return <div className="modal-backdrop" onMouseDown={onClose}><section className="export-modal" onMouseDown={event => event.stopPropagation()}><button className="close" onClick={onClose}>×</button><span className="eyebrow">Publish</span><h2>Export {title}</h2><p>Choose the output format. PDF settings apply to this export only.</p>
    <div className="pdf-export-settings">
      <strong>PDF print setup</strong>
      <label>Trim size<select className="field" value={pageSizeId} onChange={event => setPageSizeId(event.target.value)}>{BOOK_SIZES.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
      <label>Margins <span>mm</span><input className="field" type="number" min="0" max="50" step="1" value={marginMm} onChange={event => setMarginMm(event.target.value)} /></label>
      <small className="muted">{size.widthMm} × {size.heightMm} mm page size.</small>
      <label>Bleed per edge <span>mm</span><input className="field" type="number" min="0" max="10" step="0.5" value={bleedMm} onChange={event => setBleedMm(event.target.value)} /></label>
      <label className="checkbox-row"><input type="checkbox" checked={paperBleed} onChange={event => setPaperBleed(event.target.checked)} /> Extend paper color through the bleed area</label>
    </div>
    <div className="exports">{[['pdf', 'PDF', 'Print-ready pages'], ['epub', 'EPUB', 'Reflowable ebook'], ['html', 'HTML', 'Standalone web edition']].map(([id, name, description]) => <button onClick={() => onExport(id, id === 'pdf' ? { pageSizeId, marginMm: Number(marginMm), bleedMm: Number(bleedMm), paperBleed } : undefined)} key={id}><strong>{name}</strong><small>{description}</small><span>→</span></button>)}</div>
    <small className="export-note">PDF uses Electron’s print engine; EPUB3 and HTML are portable files.</small></section></div>;
}
