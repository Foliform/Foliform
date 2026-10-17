// Standard print trim sizes, in millimetres — the unit CSS's own
// @page { size: ... } rule understands directly. Named CSS page-size
// keywords (like "A4") only cover a handful of these, so every size here is
// stored as explicit width/height rather than a keyword, and both the print
// CSS (bookStyles.js) and the on-screen preview page (PreviewStage.jsx)
// derive from the same two numbers — that's what keeps the live preview's
// page shape actually matching what PDF export will produce, instead of the
// preview staying a fixed A4-shaped box no matter which size is selected.
export const BOOK_SIZES = [
  { id: 'pocket', label: 'Pocket / Mass-market (4.25 × 6.87 in)', use: 'Pocket novels', widthMm: 108, heightMm: 175 },
  { id: '5x8', label: '5 × 8 in', use: 'Novels, poetry', widthMm: 127, heightMm: 203 },
  { id: '5.5x8.5', label: '5.5 × 8.5 in', use: 'Fiction, memoirs, general books', widthMm: 140, heightMm: 216 },
  { id: 'a5', label: 'A5', use: 'General books, notebooks', widthMm: 148, heightMm: 210 },
  { id: '6x9', label: '6 × 9 in', use: 'Non-fiction, novels, self-help', widthMm: 152, heightMm: 229 },
  { id: 'royal', label: 'Royal', use: 'Larger fiction/non-fiction', widthMm: 156, heightMm: 234 },
  { id: '7x10', label: '7 × 10 in', use: 'Textbooks, workbooks', widthMm: 178, heightMm: 254 },
  { id: 'a4', label: 'A4', use: 'Manuals, academic/workbooks', widthMm: 210, heightMm: 297 },
  { id: '8x10', label: '8 × 10 in', use: 'Photo/illustrated books', widthMm: 203, heightMm: 254 },
  { id: '8.5x11', label: '8.5 × 11 in', use: 'Textbooks, workbooks, manuals', widthMm: 216, heightMm: 279 },
];

export const DEFAULT_PAGE_SIZE = BOOK_SIZES.find(size => size.id === 'a4');

// Preview sheets are paginated at their full print size to match PDF line wrapping. This scale is applied only to the finished page stack for comfortable on-screen viewing.
export const PREVIEW_SCALE = 0.542;

export function findBookSize(id) {
  return BOOK_SIZES.find(size => size.id === id) || DEFAULT_PAGE_SIZE;
}

export function pageSizeInches(kit = {}) {
  return {
    width: (kit.pageWidthMm || DEFAULT_PAGE_SIZE.widthMm) / 25.4,
    height: (kit.pageHeightMm || DEFAULT_PAGE_SIZE.heightMm) / 25.4,
  };
}
