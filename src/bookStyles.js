import { FONT_CATALOG, systemFontStack } from './fontCatalog';

// Builds the CSS @page size value from a kit's stored mm dimensions, falling
// back to A4 if a kit predates this feature. `scale` shrinks the physical mm
// value itself (not a later CSS override) — see createBookStyles for why
// that distinction is the actual fix for the preview/export mismatch bug.
export function pageSizeCss(kit = {}, scale = 1) {
  const width = (kit.pageWidthMm || 210) * scale;
  const height = (kit.pageHeightMm || 297) * scale;
  return `${width}mm ${height}mm`;
}

// A font value is either a plain family name ("Inter" — what the Style tab's
// pickers store) or a whole CSS stack ("Georgia, serif" — what built-in kits
// and older templates store). Both have to work in any role, so
// anything without a comma is treated as a family name: it resolves through
// the curated catalog to that font's own stack, which is what keeps a system
// face like Helvetica from landing on Georgia when it isn't the one installed.
// Names outside the catalog keep the old serif fallback.
export function fontStack(value, fallback = 'Georgia, serif') {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;
  if (raw.includes(',')) return raw;
  const catalogStack = FONT_CATALOG.find(font => font.name.toLowerCase() === raw.toLowerCase())?.stack;
  return catalogStack || `"${raw}", Georgia, serif`;
}

// Resolves the three text roles. Kits predating per-role fonts carry one
// `font` (or a `googleFont` family name) that styled the whole book, so every
// role inherits it; once a kit has the `fonts` map, an unset role follows the
// body font rather than that old value, which is what makes "change the body
// font, leave the headings alone" behave the way the panel implies.
export function kitFontRoles(kit = {}) {
  const legacy = kit.googleFont || kit.font || 'Georgia, serif';
  if (!kit.fonts) {
    return { title: fontStack(legacy), subtitle: fontStack(legacy), body: fontStack(legacy) };
  }
  const body = kit.fonts.body || legacy;
  return {
    title: fontStack(kit.fonts.title || body),
    subtitle: fontStack(kit.fonts.subtitle || body),
    body: fontStack(body),
  };
}

export function dropCapMetrics(kit = {}, size = kit.size || 18) {
  const lines = kit.dropCapLines === 2 ? 2 : 3;
  const twoLines = lines === 2;
  return {
    lines,
    fontSize: Math.round(size * (twoLines ? 2.4 : 3.2)),
    lineHeight: Math.round(size * (twoLines ? 1.95 : 2.6)),
  };
}

export function dropCapCss(kit = {}, {
  size = kit.size || 18,
  firstLetter = 'p.drop-cap::first-letter',
  paragraph = 'p.drop-cap',
} = {}) {
  if (!kit.dropCaps) return '';
  const { lines, fontSize, lineHeight } = dropCapMetrics(kit, size);
  const roles = kitFontRoles(kit);
  const color = kit.dropCapColor || kit.accent || '#7c3aed';
  return `${firstLetter} { float: left; font-family: ${roles.title}; color: ${color}; padding-right: 6px; padding-top: 2px; }
    @supports (initial-letter: 2) { ${firstLetter} { initial-letter: ${lines}; } }
    @supports not (initial-letter: 2) { ${firstLetter} { font-size: ${fontSize}px; line-height: ${lineHeight}px; } }
    ${paragraph} { text-indent: 0; }`;
}

// Escapes text for use inside a CSS generated-content string, e.g.
// content: "..."  — needed for the header-title margin box below, since the
// book title is arbitrary user text that could itself contain quotes.
const escapeCssString = (v = '') => String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"');

function paragraphFontRules(html = '', scoped) {
  const fontStyles = new Set();
  for (const match of String(html).matchAll(/<div\b[^>]*data-font-family="([^"]+)"[^>]*>/g)) {
    const family = match[1]
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
    const size = (match[0].match(/\bdata-font-size="(\d+(?:\.\d+)?(?:px|pt|em|rem|%)?)"/) || [])[1];
    if (family.trim()) fontStyles.add(JSON.stringify({ family, size }));
  }
  return [...fontStyles]
    .map(value => {
      const { family, size } = JSON.parse(value);
      const catalogStack = FONT_CATALOG.find(font => font.name.toLowerCase() === family.toLowerCase())?.stack;
      const stack = catalogStack || systemFontStack(family) || `"${escapeCssString(family)}", Georgia, serif`;
      const selector = scoped(`[data-font-family="${escapeCssString(family)}"]${size ? `[data-font-size="${size}"]` : ''}`);
      return `${selector} { font-family: ${stack};${size ? ` font-size: ${size};` : ''} }`;
    })
    .join('\n');
}

export function createBookStyles(kit = {}, options = {}) {
  // scale < 1 (only ever passed for the live preview, never for real
  // export) shrinks page size, margin, and font size together by the same
  // factor, so paged.js lays out a genuinely smaller page rather than a
  // true-size page whose content gets forced into an undersized box after
  // the fact — that mismatch was what caused content to visibly overflow
  // its page in the preview. Scaling the whole recipe together means the
  // page's own size and its content agree, at any book trim size.
  const scale = options.scale ?? 1;
  const roles = kitFontRoles(kit);
  const font = roles.body;
  const size = (kit.size || 18) * scale;
  // Line height used to be hardcoded to 1.62 in the font shorthand; it is a
  // type-scale control now, and every role (headings included) inherits it.
  const lineHeight = kit.lineHeight || 1.62;
  // Title/subtitle default to a proportion of body size (h1 ~1.9x, h2
  // ~1.2x) when a kit or template predates these fields, rather than
  // falling back to the browser's own generic heading scale.
  const titleSize = (kit.titleSize || Math.round((kit.size || 18) * 1.9)) * scale;
  const subtitleSize = (kit.subtitleSize || Math.round((kit.size || 18) * 1.2)) * scale;
  const margin = (Number.isFinite(kit.margin) ? kit.margin : 52) * scale;
  const ink = kit.ink || '#1a1917';
  // Title and subtitle default to the body colour, so a kit that only sets
  // `ink` looks exactly as it did before these roles existed.
  const titleInk = kit.titleInk || ink;
  const subtitleInk = kit.subtitleInk || ink;
  const paper = kit.paper || '#fbf9f4';
  const accent = kit.accent || '#7c3aed';
  const columnCount = kit.columnCount === 2 ? 2 : 1;
  const contentSelector = options.scope || 'body';
  // `scope` may be a comma-separated list — the live preview passes
  // '.book-preview, .pagedjs_page_content' so one stylesheet covers both the
  // render target and paged.js's own copied-out page content. Appending a
  // descendant to that list naively ("<scope> h1") attaches the descendant to
  // the LAST entry only, leaving the first entry behind as a selector in its own
  // right — which made the preview's root element the subject of every scoped
  // rule. It inherited the pull-quote footer's `text-transform: uppercase` and
  // letter-spacing, the blockquote's italic and rule, the H1's title face and
  // size, and so on, so the whole galley rendered in capitals. Expanding the
  // cross-product here is what keeps each rule on the element it was written
  // for, in every scope — preview and export alike.
  const scoped = (...selectors) => selectors
    .flatMap(selector => String(selector).split(',').map(part => part.trim()))
    .flatMap(selector => String(contentSelector).split(',').map(part => `${part.trim()} ${selector}`))
    .join(', ');
  // kit.chapterBreaks: whether every H1 forces a new page (chapter-per-page).
  // Left as a Brand Kit toggle rather than hardcoded — a workbook or lead
  // magnet may not want chapter-structured pagination the way a novel does.
  const chapterBreakRule = kit.chapterBreaks ? `${scoped('h1')} { break-before: page; }` : '';
  // Drop caps: an oversized initial letter spanning roughly the opening
  // paragraph's first two lines, done with ::first-letter rather than a
  // wrapper element — canonical.js already marks the right <p> with
  // `.drop-cap`, unconditionally, so this toggle is the only thing deciding
  // whether that class renders as anything. Off by default, same as
  // chapterBreaks: a workbook or lead magnet doesn't want the literary-novel
  // look any more than it wants forced chapter pages.
  const dropCapRule = dropCapCss(kit, {
    size,
    firstLetter: scoped('p.drop-cap::first-letter'),
    paragraph: scoped('p.drop-cap'),
  });
  // Running-head data source: h1 feeds `chapter-title` on every chapter,
  // regardless of the active header mode (string() resolves at page time,
  // so the value must exist even if the mode changes between preview and
  // export). Pages before the first h1 simply resolve it to the empty
  // string; a blank fill would be needed for modes that style empties.
  const chapterHeadRule = `${scoped('h1')} { string-set: chapter-title content(text); }`;
  const paragraphFontCss = paragraphFontRules(options.html, scoped);

  // Header/footer: real CSS Paged Media margin boxes, which paged.js
  // natively implements — same engine, same mechanism as everything else,
  // not a separate rendering path for print vs. preview. These are driven
  // by project metadata (see Inspector.jsx's Metadata tab), not by the
  // template/kit, since whether to show them is a per-book publishing
  // decision, not a reusable style preset. Scope note: a per-chapter
  // running head is implemented below via CSS `string-set` + string()
  // (mode: 'chapter'), and the title-only header is mode: 'title'.
  const headerFooter = options.headerFooter || {};
  const marginBoxSize = Math.max(7, Math.round(9 * scale));
  const marginBoxCss = `font-family: ${font}; font-size: ${marginBoxSize}pt; color: ${ink};`;
  // Sheet-wide paper colour (export only, see options.fullBleed). The body rule
  // below paints the paper across the content box, but the @page margin — the
  // frame around the text — belongs to no element's box, and Chromium clips
  // element backgrounds to the content area, so the exported sheet came out
  // with a white border around every page while the preview (whose pages are
  // DOM elements carrying the colour edge to edge) showed none. Margin boxes
  // are the only boxes that live out there, so the sixteen of them get the
  // paper colour as their own background; the ones carrying the folio or the
  // running head paint their text on top of it. Measured in the exported PDF:
  // the whole sheet becomes paper, and both margin boxes stay legible.
  const bleedCss = options.fullBleed ? `background: ${paper};` : '';
  // Page numbering: off, plain number, or "3 / 24" (counter(pages) is the
  // paged.js-known document total).
  const pageContent = headerFooter.pageNumbers === 'total'
    ? `counter(page) " / " counter(pages)`
    : headerFooter.pageNumbers === 'plain' ? `counter(page)` : '';
  const footerRule = pageContent ? `@bottom-center { content: ${pageContent}; ${marginBoxCss} ${bleedCss} }` : '';
  // Running head: the book title statically, or the current chapter's H1
  // text via string() — see chapterHeadRule above for the data source.
  // With chapterBreaks enabled each chapter starts on a fresh page; without
  // it a chapter starting mid-page still owns every page it flows onto
  // (string-set's default 'first' policy). `:blank` pages in a spread stay
  // empty, since paged.js names those explicitly.
  const headerRule = headerFooter.runningHead === 'chapter'
    ? `@top-center { content: string(chapter-title); ${marginBoxCss} letter-spacing: 0.04em; text-transform: uppercase; ${bleedCss} }`
    : headerFooter.runningHead === 'title' && options.title
      ? `@top-center { content: "${escapeCssString(options.title)}"; ${marginBoxCss} letter-spacing: 0.04em; text-transform: uppercase; ${bleedCss} }`
      : '';
  // The remaining margin boxes carry no text at all; they exist purely so the
  // margin area is painted. A box needs to be generated before Chromium will
  // paint it, hence the empty content. top-center/bottom-center are listed only
  // when no folio/running-head rule claimed them — a second rule for the same
  // box would win the cascade and blank the text it is supposed to show.
  const bleedBoxes = options.fullBleed
    ? ['top-left-corner', 'top-left', 'top-right', 'top-right-corner',
      'right-top', 'right-middle', 'right-bottom',
      'bottom-right-corner', 'bottom-right', 'bottom-left', 'bottom-left-corner',
      'left-bottom', 'left-middle', 'left-top',
      ...(headerRule ? [] : ['top-center']),
      ...(footerRule ? [] : ['bottom-center'])].map(name => `@${name} { content: ""; background: ${paper}; }`).join('\n    ')
    : '';
  // No `@page :first` suppression here. This used to blank the first page's
  // margin boxes (the title-page convention), which meant a document whose
  // first page is ordinary content — the usual case in this app, where page 1
  // is just the opening page — silently lost its folio, and the live preview
  // opens on exactly that page. Numbering now starts on page 1, in the
  // preview and every export alike.

  return `
    ${kit.fontFaceCss || ''}
    @page { size: ${pageSizeCss(kit, scale)}; margin: ${margin}pt; ${footerRule} ${headerRule} ${bleedBoxes} }
    :root { --book-ink: ${ink}; --book-paper: ${paper}; --book-accent: ${accent}; --book-font: ${font}; --book-size: ${size}px; --book-line: ${lineHeight}; --book-title-font: ${roles.title}; --book-subtitle-font: ${roles.subtitle}; --book-title-ink: ${titleInk}; --book-subtitle-ink: ${subtitleInk}; }
    ${contentSelector} { margin: 0; color: var(--book-ink); background: var(--book-paper); font: var(--book-size)/var(--book-line) var(--book-font); column-count: ${columnCount}; column-gap: 2em; }
    ${scoped('h1')} { font-family: var(--book-title-font); color: var(--book-title-ink); font-size: ${titleSize}px; break-after: avoid; ${columnCount === 2 ? 'column-span: all;' : ''} }
    ${scoped('h2')} { font-family: var(--book-subtitle-font); color: var(--book-subtitle-ink); font-size: ${subtitleSize}px; break-after: avoid; ${columnCount === 2 ? 'column-span: all;' : ''} }
    ${scoped('h3, h4, h5, h6')} { break-after: avoid; }
    ${chapterBreakRule}
    ${chapterHeadRule}
    ${dropCapRule}
    ${paragraphFontCss}
    ${scoped('p')} { orphans: 2; widows: 2; }
    ${scoped('blockquote, pre, figure, img')} { break-inside: avoid; }
    ${scoped('li, tr')} { break-inside: avoid; }
    ${scoped('thead')} { display: table-header-group; }
    ${scoped('figure')} { margin: 1em 0; }
    /* Print pages have no viewport: the paged.js preview lays pages out as
       screen elements, so a vh-based max-height reads the *app window's*
       height — a landscape image taller than that window silently overflowed
       its page box and got clipped. calc(100% - 2*margin) resolves against
       each page's own content box instead, which is exactly the "image no
       taller than the text area" rule the old value was reaching for. Author
       width/height attributes (from the ![alt|300x200] size syntax) still
       win as long as they fit; the clamp only catches oversized ones. */
    ${scoped('img')} { max-width: 100%; max-height: calc(100% - 2 * ${margin}pt); object-fit: contain; }
    ${scoped('.page-break')} { break-after: page; height: 0; margin: 0; }
    ${scoped('hr')} { break-after: avoid; border: 0; border-top: 1px solid ${ink}; }
    ${scoped('a')} { color: ${accent}; }
    ${scoped('code, pre')} { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
    ${scoped('pre')} { white-space: pre-wrap; }
    /* Ordinary blockquotes, with or without a canonical.js-generated
       attribution footer. */
    ${scoped('blockquote')} { margin: 1em 0 1em 1.2em; padding-left: 1em; border-left: 3px solid ${accent}; font-style: italic; }
    ${scoped('blockquote footer')} { margin-top: 0.4em; font-style: normal; font-size: 0.85em; }
    ${scoped('cite')} { font-style: normal; }
    /* ::: pullquote — centered, set in the title face, and never split
       across a page break mid-quote. */
    ${scoped('aside.pullquote')} { margin: 1.4em 0; padding: 0.2em 0; font-family: ${roles.title}; font-size: ${Math.round(size * 1.4)}px; line-height: 1.35; color: ${accent}; text-align: center; break-inside: avoid; }
    ${scoped('aside.pullquote footer')} { font-family: ${font}; font-size: ${Math.round(size * 0.6)}px; color: ${ink}; margin-top: 0.5em; text-transform: uppercase; letter-spacing: 0.05em; }
    /* ::: epigraph — the small indented, italic, chapter-opening quote
       convention, with its attribution set flush right underneath. */
    ${scoped('figure.epigraph')} { margin: 2.5em 0 2.5em 15%; break-inside: avoid; }
    ${scoped('figure.epigraph p')} { font-style: italic; font-size: ${Math.round(size * 0.95)}px; }
    ${scoped('figure.epigraph figcaption')} { margin-top: 0.5em; font-style: normal; text-align: right; font-size: ${Math.round(size * 0.8)}px; }
    /* ::: left / ::: center / ::: right / ::: justify — an explicit
       per-block override of whatever alignment the kit defaults to. */
    ${scoped('.align-left')} { text-align: left; }
    ${scoped('.align-center')} { text-align: center; }
    ${scoped('.align-right')} { text-align: right; }
    ${scoped('.align-justify')} { text-align: justify; }
  `;
}
