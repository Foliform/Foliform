export function Subbar({ mode, setMode, page, pageCount, setPage, zoom, setZoom }) {
  const book = mode === 'Book';
  const left = page % 2 === 0 ? page : page - 1;
  const start = Math.max(1, left);
  const end = Math.min(pageCount, page % 2 === 0 ? page + 1 : page);
  const atEnd = book ? (page % 2 === 0 ? page + 1 > pageCount : page >= pageCount) : page >= pageCount;
  const goPrev = () => setPage(Math.max(1, book ? (page % 2 === 0 ? page - 2 : page - 1) : page - 1));
  const goNext = () => setPage(Math.min(pageCount, book ? (page % 2 === 0 ? page + 2 : page + 1) : page + 1));

  return <section className="subbar">
    <div className="segmented">{['Book', 'Page', 'Web', 'EPUB'].map(item => <button className={mode === item ? 'selected' : ''} onClick={() => setMode(item)} key={item}>{item === 'Page' ? 'PDF View' : item}</button>)}</div>
    <div className="pager">
      <button disabled={page <= 1} onClick={goPrev}>‹</button>
      <span>{book && start !== end ? <>Pages <strong>{start}–{end}</strong> of {pageCount}</> : <>Page <strong>{Math.max(page, 1)}</strong> of {pageCount}</>}</span>
      <button disabled={atEnd} onClick={goNext}>›</button>
    </div>
    <div className="view-tools">
      <button onClick={() => setZoom(Math.max(55, zoom - 5))}>−</button>
      <span>{zoom}%</span>
      <button onClick={() => setZoom(Math.min(115, zoom + 5))}>+</button>
    </div>
  </section>;
}
