// Catalog metadata for familiar font aliases and fallback stacks. The
// FontPicker itself supplies the searchable Google and system font families.
//
// This is a curated catalog rather than a live Google Fonts query. The panel
// used to pull ~1000 families from fonts.google.com every time the Inspector
// mounted — a network round-trip just to draw a dropdown, filled mostly with
// faces that make no sense on a book page.
//
// System or licensed faces carry no `google` name, so picking one skips the
// download entirely and renders through its local stack — the export then uses
// the installed family, exactly as the preview does.
//
// Three more are Google families under a different name than the one people
// ask for — Garamond is EB Garamond, Bodoni is Bodoni Moda, Source Sans Pro is
// Source Sans 3 — which is why `google` is a separate field from `name`. The
// catalog's name always comes first in `stack` so the picker can round-trip
// what it stored, with the embedded family right behind it: install the real
// thing and it wins, otherwise the download takes over.
//
// Every stack ends in a generic family, so a face that is missing locally
// still lands on something sane rather than the browser's Times default.
export const FONT_CATALOG = [
  { name: 'Helvetica', google: null, serif: false, stack: 'Helvetica, "Helvetica Neue", Arial, sans-serif', note: 'The gold standard for logo and corporate work — clean and neutral.' },
  { name: 'Roboto', google: 'Roboto', serif: false, stack: '"Roboto", Helvetica, Arial, sans-serif', note: "Google's flagship sans, built for Android and the web." },
  { name: 'Open Sans', google: 'Open Sans', serif: false, stack: '"Open Sans", Helvetica, Arial, sans-serif', note: 'Highly legible humanist sans, tuned for print and screen alike.' },
  { name: 'Arial', google: null, serif: false, stack: 'Arial, Helvetica, sans-serif', note: 'The ubiquitous default sans of every operating system.' },
  { name: 'Times New Roman', google: null, serif: true, stack: '"Times New Roman", Times, serif', note: 'The classic serif of academic, legal and formal publishing.' },
  { name: 'Lato', google: 'Lato', serif: false, stack: '"Lato", Helvetica, Arial, sans-serif', note: 'Warm but structured — corporate with an accessible feel.' },
  { name: 'Montserrat', google: 'Montserrat', serif: false, stack: '"Montserrat", Helvetica, Arial, sans-serif', note: 'Geometric sans inspired by Buenos Aires signage.' },
  { name: 'Poppins', google: 'Poppins', serif: false, stack: '"Poppins", "Century Gothic", "Trebuchet MS", sans-serif', note: 'Rounded geometric sans, a modern-interface favourite.' },
  { name: 'Inter', google: 'Inter', serif: false, stack: '"Inter", Helvetica, Arial, sans-serif', note: 'Drawn for screens — the default face of modern UI design.' },
  { name: 'Futura', google: null, serif: false, stack: 'Futura, "Century Gothic", "Trebuchet MS", sans-serif', note: 'Avant-garde geometric sans built from simple shapes.' },
  { name: 'Georgia', google: null, serif: true, stack: 'Georgia, "Times New Roman", serif', note: 'A serif cut specifically for clarity on screen.' },
  { name: 'Garamond', google: 'EB Garamond', serif: true, stack: '"Garamond", "EB Garamond", Georgia, serif', note: 'Timeless old-style serif for books and long-form editorial.' },
  { name: 'Proxima Nova', google: null, serif: false, stack: '"Proxima Nova", "Montserrat", Helvetica, sans-serif', note: 'Hybrid of geometric strokes and humanist proportions.' },
  { name: 'Playfair Display', google: 'Playfair Display', serif: true, stack: '"Playfair Display", Georgia, serif', note: 'High-contrast display serif for elegant headings.' },
  { name: 'Raleway', google: 'Raleway', serif: false, stack: '"Raleway", Helvetica, Arial, sans-serif', note: 'Elegant sans with a distinctive baseline and fine thin weights.' },
  { name: 'Ubuntu', google: 'Ubuntu', serif: false, stack: '"Ubuntu", "Segoe UI", "Trebuchet MS", sans-serif', note: 'Friendly humanist sans made for the Linux desktop.' },
  { name: 'Source Sans Pro', google: 'Source Sans 3', serif: false, stack: '"Source Sans Pro", "Source Sans 3", "Segoe UI", sans-serif', note: "Adobe's first open-source sans, designed for interfaces." },
  { name: 'Oswald', google: 'Oswald', serif: false, stack: '"Oswald", "Arial Narrow", "Segoe UI", sans-serif', note: 'Condensed gothic revival, built for digital headlines.' },
  { name: 'Bodoni', google: 'Bodoni Moda', serif: true, stack: '"Bodoni", "Bodoni Moda", "Didot", Georgia, serif', note: 'Dramatic high-contrast serif of high fashion and luxury.' },
  { name: 'Century Gothic', google: null, serif: false, stack: '"Century Gothic", Questrial, "URW Gothic", sans-serif', note: 'Geometric sans modelled on 20th-century advertising lettering.' },
];

const byName = new Map(FONT_CATALOG.map(font => [font.name.toLowerCase(), font]));
const systemFontStacks = new Map([
  ['comic sans ms', '"Comic Sans MS", cursive'],
  ['courier new', '"Courier New", monospace'],
  ['impact', 'Impact, sans-serif'],
  ['tahoma', 'Tahoma, sans-serif'],
  ['trebuchet ms', '"Trebuchet MS", sans-serif'],
  ['verdana', 'Verdana, sans-serif'],
]);

// Case-insensitive lookup for legacy kit aliases and their fallback stacks.
export function findFont(name) {
  return byName.get(String(name ?? '').trim().toLowerCase()) || null;
}

// Catalog aliases map to their Google family. Other families offered by
// JSFontPicker are Google fonts unless they are one of its system fonts.
export function googleFamilyFor(name) {
  const raw = String(name ?? '').trim();
  const font = findFont(raw);
  if (font) return font.google;
  if (systemFontStacks.has(raw.toLowerCase())) return null;
  return raw || null;
}

export function systemFontStack(name) {
  return systemFontStacks.get(String(name ?? '').trim().toLowerCase()) || '';
}

export function findFontNote(name) {
  return findFont(name)?.note || '';
}

// Curated pairings for the Remix button: a display face over a text face, both
// drawn from the catalog and offered by JSFontPicker. Pairing them deliberately
// (rather than two independent random draws)
// means the result is always a readable combination instead of a clash.
export const FONT_PAIRINGS = [
  { title: 'Playfair Display', body: 'Inter' },
  { title: 'Playfair Display', body: 'Open Sans' },
  { title: 'Playfair Display', body: 'Poppins' },
  { title: 'Georgia', body: 'Helvetica' },
  { title: 'Garamond', body: 'Lato' },
  { title: 'Bodoni', body: 'Montserrat' },
  { title: 'Times New Roman', body: 'Roboto' },
  { title: 'Oswald', body: 'Source Sans Pro' },
  { title: 'Raleway', body: 'Roboto' },
  { title: 'Proxima Nova', body: 'Inter' },
  { title: 'Century Gothic', body: 'Lato' },
  { title: 'Ubuntu', body: 'Open Sans' },
];
