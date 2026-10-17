// The four starter kits the app ships with. These are NOT stored in the
// templates database — they're always-available defaults, shown alongside
// user-created templates in the Template picker (Inspector.jsx) but never
// editable or deletable from the Template Manager window.
export const kits = {
  literary: { name: 'House Serif', paper: '#fbf9f4', ink: '#1a1917', accent: '#7c3aed', font: 'Georgia, serif', size: 18, margin: 52, pageSizeId: 'a4', pageWidthMm: 210, pageHeightMm: 297 },
  editorial: { name: 'Editorial', paper: '#f5f0e8', ink: '#24211d', accent: '#8d5b35', font: 'Georgia, serif', size: 19, margin: 58, pageSizeId: 'a4', pageWidthMm: 210, pageHeightMm: 297 },
  workbook: { name: 'Workbook', paper: '#fffef9', ink: '#253544', accent: '#287e8e', font: 'Arial, sans-serif', size: 16, margin: 48, pageSizeId: 'a4', pageWidthMm: 210, pageHeightMm: 297 },
  midnight: { name: 'Studio Dark', paper: '#25242a', ink: '#f5efe5', accent: '#c4a7ff', font: 'Georgia, serif', size: 18, margin: 52, pageSizeId: 'a4', pageWidthMm: 210, pageHeightMm: 297 },
};

export const DEFAULT_KIT = kits.literary;
