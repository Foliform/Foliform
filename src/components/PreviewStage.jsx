import { dropCapMetrics, kitFontRoles, normalizeColumnCount } from '../bookStyles';
import { PdfViewer } from './PdfViewer';

export function PreviewStage({
  mode,
  kit,
  zoom,
  previewRef,
  previewBusy,
  onImageSelect,
  pdfData,
  pdfError,
  page,
  setPage,
  setPageCount,
  controls,
}) {
  // Same resolution the stylesheet does, so the Web/EPUB canvases
  // (which are styled by index.css rather than the injected @page stylesheet)
  // show the same three fonts, line height, and heading colours the panel sets.
  const roles = kitFontRoles(kit);
  const dropCap = dropCapMetrics(kit, kit.size);

  // Book zoom is applied to the completed page stack after paged.js finishes,
  // so pagination uses the same physical dimensions as PDF export.
  // Web/EPUB are plain flowing documents with nothing self-measuring, so they
  // keep CSS `zoom` (not transform: scale) here — zoom changes the layout size,
  // so the canvas scrollbar covers exactly the scaled content, whereas a
  // transform leaves the layout unscaled and the scroll range keeps the
  // full-size paper's height.
  const paged = mode === 'Book';
  const paperStyle = {
    '--paper': kit.paper,
    '--ink': kit.ink,
    '--accent': kit.accent,
    '--bookfont': roles.body,
    '--book-title-font': roles.title,
    '--book-subtitle-font': roles.subtitle,
    '--book-title-ink': kit.titleInk || kit.ink,
    '--book-subtitle-ink': kit.subtitleInk || kit.ink,
    '--book-line': kit.lineHeight || 1.62,
    '--type-size': `${kit.size}px`,
    '--book-margin': `${kit.margin}px`,
    '--book-dropcap-font': roles.title,
    '--book-dropcap-color': kit.dropCapColor || kit.accent || '#7c3aed',
    '--book-dropcap-lines': dropCap.lines,
    '--book-dropcap-size': `${dropCap.fontSize}px`,
    '--book-dropcap-line-height': `${dropCap.lineHeight}px`,
    ...(paged ? null : { zoom: zoom / 100 }),
  };
  const contentStyle = paged ? undefined : {
    columnCount: normalizeColumnCount(kit.columnCount),
    columnGap: '2em',
  };
  const handlePreviewClick = event => {
    const image = event.target.closest('img');
    if (!image || !event.currentTarget.contains(image)) return;
    event.currentTarget.querySelectorAll('.selected-preview-image').forEach(item => item.classList.remove('selected-preview-image'));
    image.classList.add('selected-preview-image');
    const rawSrc = image.getAttribute('src') || '';
    const src = rawSrc.match(/assets\/.*$/)?.[0] || rawSrc;
    onImageSelect?.({ src, alt: image.getAttribute('alt') || '', width: image.getAttribute('width') || '', height: image.getAttribute('height') || '' });
  };
  return (
    <section className={`preview-stage ${mode.toLowerCase()}`}>
      <div className="preview-label">
        {mode === 'Page' ? 'PDF-style page view' : 'Live galley'} <span>same engine as export</span>
      </div>

      <div className="preview-canvas">
        {mode === 'Page' ? (
          <>
            <div className="page-pagination-source" aria-hidden="true">
              <div className="paper" style={paperStyle}>
                <div key="page-source" ref={previewRef} className={`book-preview ${kit.dropCaps ? 'drop-caps' : ''}`} style={contentStyle} />
              </div>
            </div>
            <PdfViewer
              data={pdfData}
              errorMessage={pdfError}
              page={page}
              onPageChange={setPage}
              onPageCountChange={setPageCount}
              zoom={zoom}
            />
          </>
        ) : (
          <div className="paper" style={paperStyle}>
            <div
              key={mode}
              ref={previewRef}
              className={`book-preview ${kit.dropCaps ? 'drop-caps' : ''}`}
              style={contentStyle}
              onClick={handlePreviewClick}
            />
          </div>
        )}
      </div>

      {previewBusy && <div className="preview-loading" role="status" aria-live="polite"><span className="preview-spinner" aria-hidden="true" />Updating preview…</div>}

      {controls}
    </section>
  );
}
