import createDOMPurify from 'dompurify';
import { marked } from 'marked';

const DOMPurify = typeof window !== 'undefined' && typeof window.document !== 'undefined'
  ? createDOMPurify(window)
  : {
      sanitize: (value = '', config = {}) => {
        const html = String(value);
        const allowedTags = new Set((config.ALLOWED_TAGS || []).map(tag => String(tag).toLowerCase()));
        const allowedAttrs = new Set((config.ALLOWED_ATTR || []).map(attr => String(attr).toLowerCase()));

        const stripScripts = html.replace(/<\s*(script|style)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '');
        return stripScripts.replace(/<\s*(\/)?\s*([a-z0-9:-]+)\b([^>]*)>/gi, (match, closing, tagName, attrs) => {
          const tag = String(tagName || '').toLowerCase();
          if (!tag) return match;
          if (!allowedTags.has(tag)) return '';
          if (closing) return `</${tag}>`;
          const cleanedAttrs = String(attrs || '').replace(/\s+([^\s=<>`]+)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?/g, (attrMatch, attrName) => {
            const name = String(attrName).toLowerCase();
            return allowedAttrs.has(name) ? attrMatch : '';
          });
          return `<${tag}${cleanedAttrs}>`;
        });
      },
    };

const BREAK_MARKER = '<div data-manuscript-page-break="true"></div>';
const DIVIDER_MARKER = '<hr data-manuscript-divider="true">';

// Special quote, font, and plain alignment blocks share one fence syntax: a
// marker opened and closed on its own line, so the body can hold real Markdown
// instead of being squeezed onto a single line. Nesting one fence inside
// another isn't supported — supporting it would mean a real block parser
// instead of this line-based pass.
const FENCE_OPEN = /^:::\s*(pullquote|epigraph|left|center|right|justify)\s*$/i;
const FONT_FENCE_OPEN = /^:::\s*font\s+"([^"\r\n]+)"\s*$/i;
const FENCE_CLOSE = /^:::\s*$/;

// Plain alignment blocks: `::: center` / `::: left` / `::: right` /
// `::: justify` wrap their body in a <div class="align-*">, for the cases a
// kit's own default alignment (usually justified body text) isn't what one
// specific paragraph or image caption should use — a centered dedication
// line, a right-aligned signature block, and so on. No attribution line is
// stripped from these the way it is for pullquote/epigraph, since an
// alignment block isn't necessarily a quote at all.
const ALIGN_TYPES = new Set(['left', 'center', 'right', 'justify']);

// A line that names the source of a quote — "— Toni Morrison" or
// "-- Toni Morrison" as its own trailing line. Recognized inside a fenced
// block *and* inside an ordinary blockquote, so an author never hand-writes
// <cite> markup for either.
const ATTRIBUTION_LINE = /^\s*(?:—|--)\s*(.+?)\s*$/;

// Optional image size syntax: `![alt|300](img.png)` sets the width, and a
// second number `![alt|300x200](img.png)` also sets the height. The image is
// rewritten to a literal <img> tag before marked runs (marked passes inline
// HTML through untouched, and normalizeHtml's DOMPurify pass re-checks every
// attribute, so nothing smuggled inside alt/src survives). A pixel value is
// CSS px — the unit every other page dimension is authored in — and the book
// stylesheet's max-width/max-height still clamp any size that would overflow
// the text area. Width-only keeps the aspect ratio; an explicit height is
// honored as given (matching what `|300x200` reads as). Must run per-line:
// it sits inside markdownToHtml's line map, so fenced special blocks get the
// same treatment through renderSpecialBlock's recursion.
function applyImageSizes(source) {
  // The destination tolerates parentheses ("image-(2).png") because this
  // rewrite runs BEFORE marked and hands marked a finished <img> tag. The
  // match must end the line, and ends at its LAST `)`, so a nested or
  // doubled paren in the filename can't truncate the URL — the cost is that
  // the size form only works when the image is the line's last construct
  // (as the importer always writes it). A URL with a space still can't be
  // authored here; the importer sanitizes stored filenames so that never
  // arises.
  return source.replace(/!\[([^\]]*?)\|\s*(\d+)\s*(?:x\s*(\d+))?\s*\]\((.+)\)(\s*)$/g, (match, alt, width, height, src) =>
    `<img src="${src.trim()}" alt="${alt.replace(/"/g, '&quot;')}" width="${width}"${height ? ` height="${height}"` : ''}>`);
}

/**
 * A dash-only line (`---` or `----`) is only a page-break/divider marker when
 * it sits alone with a blank line — or the start/end of the document — on
 * both sides. Anywhere else, leave the line untouched so CommonMark's own
 * rules (setext heading, literal text, etc.) still apply.
 *
 * This is the one place that check is implemented. EditorPanel.jsx's live
 * highlighting and renderer.jsx's inline warning both call into this same
 * function via a small line-accessor adapter, instead of each hand-rolling
 * their own copy — three independent copies previously disagreed on whether
 * a marker on the very first/last line of a document counted as isolated.
 */
export function isIsolatedDashLine({ lineCount, lineNumber, getLineText }) {
  const prevBlank = lineNumber <= 1 || getLineText(lineNumber - 1).trim() === '';
  const nextBlank = lineNumber >= lineCount || getLineText(lineNumber + 1).trim() === '';
  return prevBlank && nextBlank;
}

const escapeHtmlText = (v = '') => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Straight ' and " -> typographic curly quotes. Runs per-line, on plain
 * prose only: inline code spans and raw HTML tags on the line are stashed
 * behind placeholders first and restored untouched afterward, so an
 * attribute like `<a href="...">` or a code span like `` `it's` `` never
 * gets its quotes curled. This is a heuristic (a light SmartyPants), not a
 * full port — a handful of leading elisions ("'tis", "rock 'n' roll") will
 * curl as an opening quote rather than an apostrophe, which is the one
 * ambiguous case no regex-based approach resolves cleanly.
 */
function smartenQuotes(line) {
  const stashed = [];
  const stash = value => {
    stashed.push(value);
    return `\u0000P${stashed.length - 1}\u0000`;
  };
  const protectedLine = line
    .replace(/<[^>]+>/g, stash)
    .replace(/`[^`]*`/g, stash);
  const curled = protectedLine
    // Opening double quote: start of line, or after whitespace / ( [ { — a
    // dash, or another opening quote.
    .replace(/(^|[\s([{\-—“‘])"/g, '$1\u201c')
    // Anything left is a closing double quote.
    .replace(/"/g, '\u201d')
    // A straight ' right after a letter/digit is a contraction or
    // possessive -> a closing curl, not an opening one.
    .replace(/([A-Za-z0-9])'/g, '$1\u2019')
    // Otherwise, at the start of a word, it's an opening single quote.
    .replace(/(^|[\s([{\-—“‘])'/g, '$1\u2018')
    // Whatever's left (rare: a lone ' between punctuation) defaults to a
    // closing curl, which is right more often than not.
    .replace(/'/g, '\u2019');
  return curled.replace(/\u0000P(\d+)\u0000/g, (_, i) => stashed[Number(i)]);
}

/**
 * Pulls out top-level special fences before marked ever sees them, replacing
 * each whole block with a placeholder line that the caller swaps for the
 * rendered block once its inner Markdown is rendered.
 * Code fences are tracked so a ::: appearing inside a code block is left as
 * literal text.
 */
function extractSpecialBlocks(lines) {
  const output = [];
  const blocks = new Map();
  let inFence = false;
  let index = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*```/.test(line)) { inFence = !inFence; output.push(line); continue; }
    if (!inFence) {
      const fontOpen = line.match(FONT_FENCE_OPEN);
      const open = line.match(FENCE_OPEN) || (fontOpen ? [fontOpen[0], 'font', fontOpen[1].trim()] : null);
      if (open) {
        const inner = [];
        let j = i + 1;
        for (; j < lines.length && !FENCE_CLOSE.test(lines[j]); j++) inner.push(lines[j]);
        const token = `\u0000MSBLOCK${index}\u0000`;
        blocks.set(token, { type: open[1].toLowerCase(), family: open[2], lines: inner });
        index += 1;
        output.push(token);
        i = j; // skip the consumed inner lines and the closing ::: line
        continue;
      }
    }
    output.push(line);
  }
  return { lines: output, blocks };
}

// Splits a trailing "— Author" line off a block's body, if present, so
// callers can render it as a real <cite> rather than leaving it as a plain
// last line of prose. Blank trailing lines are ignored first.
function splitAttribution(lines) {
  const body = [...lines];
  let attribution = null;
  for (let i = body.length - 1; i >= 0; i--) {
    if (body[i].trim() === '') continue;
    const match = body[i].match(ATTRIBUTION_LINE);
    if (match) { attribution = smartenQuotes(match[1]); body.splice(i, 1); }
    break;
  }
  return { body, attribution };
}

function renderSpecialBlock({ type, family, lines }) {
  if (type === 'font') {
    const escapedFamily = escapeHtmlText(family).replace(/"/g, '&quot;');
    return `<div class="paragraph-font" data-font-family="${escapedFamily}">${markdownToHtml(lines.join('\n')).trim()}</div>`;
  }
  if (ALIGN_TYPES.has(type)) {
    // Not necessarily a quote, so no attribution line is stripped here —
    // every line of the body is rendered as authored.
    const bodyHtml = markdownToHtml(lines.join('\n')).trim();
    return `<div class="align-${type}">${bodyHtml}</div>`;
  }
  const { body, attribution } = splitAttribution(lines);
  // Recurses so the block's own body gets full Markdown treatment (multiple
  // paragraphs, emphasis, a nested list) instead of being pasted in as raw
  // text.
  const bodyHtml = markdownToHtml(body.join('\n')).trim();
  if (type === 'pullquote') {
    const footer = attribution ? `<footer><cite>${escapeHtmlText(attribution)}</cite></footer>` : '';
    return `<aside class="pullquote">${bodyHtml}${footer}</aside>`;
  }
  // epigraph
  const caption = attribution ? `<figcaption>${escapeHtmlText(attribution)}</figcaption>` : '';
  return `<figure class="epigraph">${bodyHtml}${caption}</figure>`;
}

/**
 * Convert authored Markdown into the app's one canonical HTML shape.
 * A non-isolated `---`/`----` line is left exactly as written — that's what
 * lets `Heading\n---` still become a setext `<h2>` via marked's own parser,
 * rather than becoming neither a heading nor a page break (which is what
 * happened when the old code escaped it to literal dashes instead).
 */
function markdownToHtml(source) {
  const { lines, blocks } = extractSpecialBlocks(source.split('\n'));
  const isIsolated = index => isIsolatedDashLine({
    lineCount: lines.length,
    lineNumber: index + 1,
    getLineText: n => lines[n - 1],
  });
  let inFence = false;
  const normalized = lines.map((line, index) => {
    const fenceLine = /^\s*```/.test(line);
    const wasInFence = inFence;
    if (fenceLine) inFence = !inFence;
    if (wasInFence || fenceLine) return line;
    if (/^\s*----\s*$/.test(line)) return isIsolated(index) ? DIVIDER_MARKER : line;
    if (/^\s*---\s*$/.test(line)) return isIsolated(index) ? BREAK_MARKER : line;
    const headed = line.replace(/^(\s{0,3}#{1,6})([^\s#])/, '$1 $2');
    // `![alt|300](src)` carries its size through to a real <img> tag before
    // marked sees the line (marked would otherwise swallow the size into the
    // alt text). Running applyImageSizes here means fenced special blocks
    // (epigraph bodies, ::: center figures, …) get the same treatment,
    // because renderSpecialBlock recurses into this function.
    return applyImageSizes(smartenQuotes(headed));
  }).join('\n');
  let html = marked.parse(normalized, { gfm: true, breaks: false });
  for (const [token, block] of blocks) {
    html = html.split(`<p>${token}</p>`).join(renderSpecialBlock(block));
  }
  return html;
}

// The first paragraph of the book, and the first paragraph of every chapter
// (every H1), gets `class="drop-cap"` — a structural fact about the document,
// independent of whether the current Brand Kit actually renders one.
// bookStyles.js's `dropCaps` kit toggle decides whether that class does
// anything visually, the same way `chapterBreaks` decides whether an H1
// actually forces a page break; canonical.js only marks where a chapter
// *could* start one, so switching the toggle needs no re-authoring.
function markDropCaps(document) {
  let expectDropCap = true;
  for (const node of Array.from(document.body.children)) {
    if (node.tagName === 'H1') { expectDropCap = true; continue; }
    if (!expectDropCap) continue;
    if (!node.textContent.trim()) continue;
    if (node.tagName === 'P') node.classList.add('drop-cap');
    // Some other content (a list, an image, a pull quote) opened the
    // chapter instead of a paragraph — nothing sensible to drop-cap, so this
    // chapter is left alone rather than tagging the wrong element.
    expectDropCap = false;
  }
}

// `> Text\n> — Author` becomes a semantic <footer><cite>Author</cite></footer>
// inside the blockquote, and the attribution line is removed from the quoted
// prose — the same authoring convenience the epigraph/pull-quote fences
// offer, for an ordinary inline blockquote that never opened one.
function markBlockquoteAttributions(document) {
  document.querySelectorAll('blockquote').forEach(quote => {
    const paragraphs = quote.querySelectorAll(':scope > p');
    const last = paragraphs[paragraphs.length - 1];
    if (!last) return;
    // `> line one\n> — Author` (no blank line between) is one <p> in marked's
    // output, its text joined by a newline — so the attribution is checked
    // against the paragraph's last line, not the whole paragraph.
    const textLines = last.textContent.split('\n');
    const match = textLines[textLines.length - 1].match(ATTRIBUTION_LINE);
    if (!match) return;
    const footer = document.createElement('footer');
    const cite = document.createElement('cite');
    cite.textContent = match[1];
    footer.appendChild(cite);
    if (textLines.length > 1) {
      // Keep the quoted prose's own paragraph, just drop its trailing
      // attribution line.
      last.textContent = textLines.slice(0, -1).join('\n');
      last.after(footer);
    } else {
      last.replaceWith(footer);
    }
  });
}

/**
 * Normalize untrusted HTML to the representation read by every output path.
 * Comments are translated before DOMPurify because the HTML input's page-break
 * syntax is a comment and comments are intentionally removed during sanitizing.
 */
function normalizeHtml(source) {
  const withBreaks = source.replace(/<!--\s*page-break\s*-->/gi, BREAK_MARKER);
  const clean = DOMPurify.sanitize(withBreaks, {
    ALLOWED_TAGS: ['p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'em', 'strong', 'a', 'img', 'ul', 'ol', 'li', 'hr', 'div', 'span', 'figure', 'figcaption', 'aside', 'cite', 'footer', 'code', 'pre', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th'],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'colspan', 'rowspan', 'width', 'height', 'data-manuscript-page-break', 'data-manuscript-divider', 'data-font-family'],
  });
  if (typeof DOMParser === 'undefined') {
    return clean
      .replace(/<div\s+data-manuscript-page-break="true"\s*><\/div>/gi, '<div class="page-break" data-manuscript-page-break="true"></div>')
      .replace(/<hr\b([^>]*)>/gi, (_, attrs = '') => `<hr${attrs} data-manuscript-divider="true">`);
  }

  const document = new DOMParser().parseFromString(clean, 'text/html');
  document.querySelectorAll('div[data-manuscript-page-break]').forEach((node) => {
    node.replaceWith(document.createRange().createContextualFragment('<div class="page-break" data-manuscript-page-break="true"></div>'));
  });
  document.querySelectorAll('hr').forEach((node) => node.setAttribute('data-manuscript-divider', 'true'));
  markDropCaps(document);
  markBlockquoteAttributions(document);
  return document.body.innerHTML;
}

export function toCanonicalHtml(source) {
  return normalizeHtml(markdownToHtml(source));
}

export const canonicalContract = {
  pageBreak: '<div class="page-break" data-manuscript-page-break="true"></div>',
  divider: '<hr data-manuscript-divider="true">',
  // Structural markers introduced above. bookStyles.js reads these class/tag
  // names when it decides how (or whether) to render each feature.
  dropCapClass: 'drop-cap',
  pullquoteClass: 'pullquote',
  epigraphClass: 'epigraph',
  // '::: left' / '::: center' / '::: right' / '::: justify' -> align-<name>
  alignClassPrefix: 'align-',
};
