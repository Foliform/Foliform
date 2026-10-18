import { app, BrowserWindow, ipcMain, dialog, Menu, protocol } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import started from 'electron-squirrel-startup';
import Database from 'better-sqlite3';
import { createBookStyles, dropCapCss, kitFontRoles } from './bookStyles';
import { findBookSize, pageSizeInches } from './bookSizes';

if (started) app.quit();
app.setName('Foliform');

// Registered before app ready, as Electron requires for custom schemes.
// This is what lets the live preview (running inside the renderer's own
// window, not rooted at the project folder) load a project's images/fonts
// by relative path — see the protocol.handle() registration below for why
// PDF export and EPUB/HTML export each resolve the same relative paths a
// different way instead of needing this scheme themselves.
protocol.registerSchemesAsPrivileged([
  { scheme: 'manuscript-asset', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

const safeName = (v = 'Untitled') => v.replace(/[<>:"/\\|?*]/g, '').trim() || 'Untitled';
const esc = (v = '') => String(v).replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
const renderHtml = (p, { fullBleed = true } = {}) => `<!doctype html><html><head><meta charset="utf-8"><title>${esc(p.title)}</title><style>${createBookStyles(p.kit, {
  title: p.title,
  headerFooter: { pageNumbers: p.metadata?.pageNumbers || 'off', runningHead: p.metadata?.runningHead || 'off' },
  // Both exported formats are printed by a browser, so both want the paper
  // colour to reach the sheet's edge (see the bleed note in bookStyles.js).
  // The live preview deliberately does not: its pages already carry the colour.
  fullBleed,
  html: p.html,
})}</style></head><body>${p.html}</body></html>`;

const crc32 = b => { let c = -1; for (const x of b) { c ^= x; for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return (c ^ -1) >>> 0; };
const u16 = n => Buffer.from([n & 255, n >>> 8 & 255]);
const u32 = n => Buffer.from([n & 255, n >>> 8 & 255, n >>> 16 & 255, n >>> 24 & 255]);
// Minimal uncompressed ZIP archive for standards-compliant EPUB3 output.
const zip = entries => {
  const local = [], central = []; let off = 0;
  for (const [name, value] of entries) {
    const data = Buffer.isBuffer(value) ? value : Buffer.from(value), n = Buffer.from(name), crc = crc32(data);
    const head = Buffer.concat([u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(n.length), u16(0), n, data]);
    local.push(head);
    central.push(Buffer.concat([u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(n.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(off), n]));
    off += head.length;
  }
  const dir = Buffer.concat(central);
  return Buffer.concat([...local, dir, u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length), u32(dir.length), u32(off), u16(0)]);
};

// Finds every "assets/..." reference in a chunk of HTML or CSS, so EPUB
// export can embed the real files instead of shipping a book with broken
// image/font links — the previous implementation never copied assets into
// the EPUB package at all.
function scanAssetReferences(text = '') {
  const found = new Set();
  const patterns = [/src=["'](assets\/[^"']+)["']/g, /url\(["']?(assets\/[^"')]+)["']?\)/g];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text))) found.add(match[1]);
  }
  return [...found];
}
const mediaTypeFor = file => ({
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
  woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', otf: 'font/otf',
}[path.extname(file).slice(1).toLowerCase()] || 'application/octet-stream');

const makeEpub = async p => {
  const title = esc(p.title);
  const author = esc(p.metadata?.author || 'Unknown author');
  const roles = kitFontRoles(p.kit);
  const columnCount = p.kit.columnCount === 2 ? 2 : 1;
  const size = p.kit.size || 18;
  const dropCaps = dropCapCss(p.kit, { size, firstLetter: '.drop-cap::first-letter', paragraph: '.drop-cap' });
  const bookCss = `body{font:${size}px/${p.kit.lineHeight || 1.62} ${roles.body};color:${p.kit.ink || '#1a1917'};background:${p.kit.paper || '#fbf9f4'};column-count:${columnCount};column-gap:2em}body h1,body h2{${columnCount === 2 ? 'column-span:all;' : ''}}${dropCaps}\n${p.kit.fontFaceCss || ''}`;
  const references = new Set([...scanAssetReferences(p.html), ...scanAssetReferences(bookCss)]);
  const assetEntries = [];
  const manifestExtras = [];
  let assetIndex = 0;
  for (const relative of references) {
    try {
      const bytes = await fs.readFile(path.join(p.path, relative));
      assetEntries.push([`OEBPS/${relative}`, bytes]);
      manifestExtras.push(`<item id="asset${assetIndex}" href="${relative}" media-type="${mediaTypeFor(relative)}"/>`);
      assetIndex += 1;
    } catch {
      // Referenced asset missing on disk — skip it rather than fail the whole export.
    }
  }
  return zip([
    ['mimetype', 'application/epub+zip'],
    ['META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'],
    ['OEBPS/chapter.xhtml', `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${title}</title><link rel="stylesheet" href="book.css"/></head><body>${p.html}</body></html>`],
    ['OEBPS/book.css', bookCss],
    ['OEBPS/nav.xhtml', `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><body><nav epub:type="toc" xmlns:epub="http://www.idpf.org/2007/ops"><ol><li><a href="chapter.xhtml">${title}</a></li></ol></nav></body></html>`],
    ['OEBPS/content.opf', `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="bookid">urn:uuid:${crypto.randomUUID()}</dc:identifier><dc:title>${title}</dc:title><dc:creator>${author}</dc:creator><dc:language>${esc(p.metadata?.language || 'en')}</dc:language></metadata><manifest><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="css" href="book.css" media-type="text/css"/>${manifestExtras.join('')}</manifest><spine><itemref idref="chapter"/></spine></package>`],
    ...assetEntries,
  ]);
};

async function copyAssetsNextTo(root, filePath) {
  try {
    await fs.cp(path.join(root, 'assets'), path.join(path.dirname(filePath), 'assets'), { recursive: true });
  } catch {
    // No assets directory yet — nothing to copy.
  }
}

let mainWindow = null;
let templateManagerWindow = null;
let activeTheme = 'dark';
const appIconPath = app.isPackaged
  ? path.join(process.resourcesPath, 'assets', 'app-icon.png')
  : path.join(__dirname, '../../assets/app-icon.png');

const createWindow = () => {
  const win = new BrowserWindow({ width: 1440, height: 920, minWidth: 980, minHeight: 680, backgroundColor: '#0e0f12', icon: appIconPath, webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false } });
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) { win.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL); win.webContents.once('did-finish-load', () => win.webContents.openDevTools({ mode: 'detach' })); }
  else win.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  mainWindow = win;
  win.on('closed', () => { if (mainWindow === win) mainWindow = null; });
  return win;
};

// Opens the Template Manager as a genuine second OS window, not a modal
// inside the main one. Rather than configuring a second Vite/Forge renderer
// target (real, but version-sensitive plugin configuration), this reuses
// the exact same renderer bundle in a new BrowserWindow, with ?window=
// templates appended — renderer.jsx checks that query param at startup and
// renders the Template Manager UI instead of the normal app shell. Same
// window-management robustness, none of the extra build-tooling risk.
const openTemplateManagerWindow = theme => {
  activeTheme = theme === 'light' ? 'light' : 'dark';
  if (templateManagerWindow && !templateManagerWindow.isDestroyed()) {
    templateManagerWindow.webContents.send('theme:changed', activeTheme);
    templateManagerWindow.focus();
    return;
  }
  const backgroundColor = activeTheme === 'light' ? '#eef0f4' : '#0e0f12';
  const win = new BrowserWindow({ width: 960, height: 720, minWidth: 720, minHeight: 560, backgroundColor, icon: appIconPath, parent: mainWindow || undefined, webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false } });
  const search = `?window=templates&theme=${activeTheme}`;
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) win.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}${search}`);
  else win.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`), { search });
  templateManagerWindow = win;
  win.on('closed', () => { if (templateManagerWindow === win) templateManagerWindow = null; });
};

ipcMain.handle('window:openTemplateManager', (_, theme) => openTemplateManagerWindow(theme || activeTheme));
ipcMain.on('theme:changed', (event, theme) => {
  if (event.sender !== mainWindow?.webContents || !['dark', 'light'].includes(theme)) return;
  activeTheme = theme;
  if (templateManagerWindow && !templateManagerWindow.isDestroyed()) {
    templateManagerWindow.webContents.send('theme:changed', activeTheme);
  }
});

const recoveryInterval = 60_000;
const lastRecoverySnapshot = new Map();
const saveRecoverySnapshot = async (root, nextProject) => {
  const manuscriptPath = path.join(root, 'manuscript.json');
  try {
    const previous = JSON.parse(await fs.readFile(manuscriptPath, 'utf8'));
    const previousKit = JSON.parse(await fs.readFile(path.join(root, 'brand-kit.json'), 'utf8').catch(() => '{}'));
    const changed = previous.content !== nextProject.content || previous.title !== nextProject.title
      || JSON.stringify(previous.metadata || {}) !== JSON.stringify(nextProject.metadata || {})
      || JSON.stringify(previousKit) !== JSON.stringify(nextProject.kit || {});
    if (!changed || !previous.content?.trim()) return;
    const now = Date.now();
    if (now - (lastRecoverySnapshot.get(root) || 0) < recoveryInterval) return;
    const directory = path.join(root, '.recovery');
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, `${now}-${crypto.randomUUID()}.json`), JSON.stringify({
      title: previous.title,
      content: previous.content,
      metadata: previous.metadata || {},
      kit: previousKit,
      createdAt: now,
    }, null, 2));
    lastRecoverySnapshot.set(root, now);
    const snapshots = (await fs.readdir(directory)).filter(name => name.endsWith('.json')).sort().reverse();
    await Promise.all(snapshots.slice(12).map(name => fs.rm(path.join(directory, name), { force: true })));
  } catch {
    // Recovery is best-effort; a history write must never block a normal save.
  }
};

const saveBundle = async (root, p) => {
  await saveRecoverySnapshot(root, p);
  await fs.mkdir(path.join(root, 'assets'), { recursive: true });
  await fs.writeFile(path.join(root, 'manuscript.json'), JSON.stringify({ title: p.title, format: p.format, content: p.content, metadata: p.metadata || {} }, null, 2));
  await fs.writeFile(path.join(root, 'brand-kit.json'), JSON.stringify(p.kit, null, 2));
  return root;
};

// --- Recent-projects index (SQLite is an index only, never the source of
// truth for a project's own content — that's always the folder bundle). ---
const db = new Database(path.join(app.getPath('userData'), 'manuscript.db'));
db.exec('CREATE TABLE IF NOT EXISTS recent_projects (path TEXT PRIMARY KEY, title TEXT, format TEXT, last_opened INTEGER)');
const upsertRecent = (root, title, format) => db.prepare(
  `INSERT INTO recent_projects (path, title, format, last_opened) VALUES (?, ?, ?, ?)
   ON CONFLICT(path) DO UPDATE SET title = excluded.title, format = excluded.format, last_opened = excluded.last_opened`,
).run(root, title, format, Date.now());

// --- Templates: reusable style presets (page size, fonts, colors, margins),
// distinct from a project's own brand-kit.json — a template is something you
// pick from and apply; a project's kit is what's actually in effect right
// now. Managed from the separate Template Manager window. ---
db.exec('CREATE TABLE IF NOT EXISTS templates (id TEXT PRIMARY KEY, name TEXT, data TEXT, updated_at INTEGER)');

ipcMain.handle('template:list', () => db.prepare('SELECT id, name, data, updated_at as updatedAt FROM templates ORDER BY name COLLATE NOCASE')
  .all().map(row => ({ ...row, data: JSON.parse(row.data) })));

ipcMain.handle('template:save', (_, template) => {
  const id = template.id || crypto.randomUUID();
  const updatedAt = Date.now();
  db.prepare(`INSERT INTO templates (id, name, data, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, data = excluded.data, updated_at = excluded.updated_at`)
    .run(id, template.name, JSON.stringify(template.data || {}), updatedAt);
  return { id, name: template.name, data: template.data || {}, updatedAt };
});

ipcMain.handle('template:delete', (_, id) => { db.prepare('DELETE FROM templates WHERE id = ?').run(id); return true; });

// Tracks the folder of whichever project is currently open, so the
// manuscript-asset:// protocol handler below knows what to resolve relative
// paths against. A single-window desktop app only ever has one active
// project at a time, so a module-level variable is enough here.
let currentProjectRoot = null;

ipcMain.handle('project:create', async (_, { title, format }) => {
  const { filePath } = await dialog.showSaveDialog({ title: 'Create manuscript', defaultPath: `${safeName(title)}.manuscript`, properties: ['createDirectory'] });
  if (!filePath) return null;
  await saveBundle(filePath, { title, format, content: '', kit: {} });
  currentProjectRoot = filePath;
  upsertRecent(filePath, title, format);
  return { path: filePath, title, format, content: '', kit: {}, metadata: {} };
});

ipcMain.handle('project:open', async () => {
  const { filePaths } = await dialog.showOpenDialog({ title: 'Open manuscript', properties: ['openDirectory'] });
  if (!filePaths[0]) return null;
  const root = filePaths[0];
  const manuscript = JSON.parse(await fs.readFile(path.join(root, 'manuscript.json'), 'utf8'));
  let kit = {};
  try { kit = JSON.parse(await fs.readFile(path.join(root, 'brand-kit.json'), 'utf8')); } catch {}
  currentProjectRoot = root;
  upsertRecent(root, manuscript.title, manuscript.format);
  return { path: root, ...manuscript, kit };
});

ipcMain.handle('project:openPath', async (_, root) => {
  if (!root) return null;
  try {
    const manuscript = JSON.parse(await fs.readFile(path.join(root, 'manuscript.json'), 'utf8'));
    let kit = {};
    try { kit = JSON.parse(await fs.readFile(path.join(root, 'brand-kit.json'), 'utf8')); } catch {}
    currentProjectRoot = root;
    upsertRecent(root, manuscript.title, manuscript.format);
    return { path: root, ...manuscript, kit };
  } catch {
    return null;
  }
});

ipcMain.handle('project:list', () => db.prepare('SELECT path, title, format, last_opened as lastOpened FROM recent_projects ORDER BY last_opened DESC LIMIT 20').all());

ipcMain.handle('project:recovery:list', async (_, root) => {
  if (!root) return [];
  try {
    const directory = path.join(root, '.recovery');
    const files = (await fs.readdir(directory)).filter(name => /^\d+-[\w-]+\.json$/.test(name)).sort().reverse();
    return await Promise.all(files.map(async id => {
      const entry = JSON.parse(await fs.readFile(path.join(directory, id), 'utf8'));
      return { id, title: entry.title || 'Untitled', createdAt: entry.createdAt || Number(id.split('-')[0]), words: (entry.content || '').trim().split(/\s+/).filter(Boolean).length };
    }));
  } catch { return []; }
});

ipcMain.handle('project:recovery:get', async (_, root, id) => {
  if (!root || typeof id !== 'string' || !/^\d+-[\w-]+\.json$/.test(id)) return null;
  try { return JSON.parse(await fs.readFile(path.join(root, '.recovery', id), 'utf8')); } catch { return null; }
});

ipcMain.handle('project:preflight-assets', async (_, p) => {
  if (!p?.path) return [];
  const root = path.resolve(p.path);
  const missing = [];
  const references = new Set([
    ...scanAssetReferences(p.html || ''),
    ...scanAssetReferences(p.kit?.fontFaceCss || ''),
  ]);
  for (const relative of references) {
    let decoded = relative.split(/[?#]/, 1)[0];
    try { decoded = decodeURIComponent(decoded); } catch {}
    const candidate = path.resolve(root, decoded);
    if (!candidate.startsWith(`${root}${path.sep}`)) continue;
    try { await fs.access(candidate); } catch { missing.push(relative); }
  }
  return missing;
});

ipcMain.handle('project:save', async (_, p) => {
  let root = p.path;
  if (!root) {
    const { filePath } = await dialog.showSaveDialog({ title: 'Save manuscript', defaultPath: `${safeName(p.title)}.manuscript`, properties: ['createDirectory'] });
    root = filePath;
  }
  if (!root) return null;
  await saveBundle(root, p);
  currentProjectRoot = root;
  upsertRecent(root, p.title, p.format);
  return root;
});

ipcMain.handle('asset:import', async (_, root) => {
  if (!root) return null;
  const { filePaths } = await dialog.showOpenDialog({ title: 'Import image', filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] }], properties: ['openFile'] });
  if (!filePaths[0]) return null;
  // The stored name becomes a Markdown image URL in the manuscript, so it
  // must survive that syntax: CommonMark ends an image destination at the
  // first unescaped whitespace or `)`. "my photo (2).png" broke both ways —
  // the reference truncated at the space, and the file never displayed. The
  // timestamp prefix keeps sanitized names from colliding.
  const safeName = path.basename(filePaths[0]).replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'image';
  const filename = `${Date.now()}-${safeName}`, relative = `assets/${filename}`;
  await fs.copyFile(filePaths[0], path.join(root, relative));
  return relative;
});

// --- Fonts: download + embed, entirely from the main process. The renderer
// has no network access of its own — see manuscript-agent-spec.md's IPC
// guardrail — and doing the download here is also what lets the actual font
// file get cached into the project so PDF/EPUB export can embed it, instead
// of the export silently falling back to a system font while the preview
// (which previously injected a <link> tag straight into its own <head>)
// showed the real one. ---
// JSFontPicker supplies the searchable Google and system font families, so
// there is no family-search IPC channel: this handler only downloads a font
// selected in the renderer, directly into the project for export embedding.

// Google's css2 endpoint answers with one @font-face block per unicode subset,
// and the first block is almost never the Latin one (for ADLaM Display it is
// the adlam-script subset, for Abhaya Libre the Sinhala one). Taking the first
// url in the response therefore embedded a file with no Latin glyphs in it, so
// every letter of the manuscript fell through to the next family in the stack —
// the Google font picked in the Inspector never actually reached the text, in
// the preview or in any export. Blocks are read individually, keeping each
// one's own unicode-range, and the Latin subsets win because that is what book
// text is written in. Families with no Latin subset at all (a Devanagari-only
// face, say) still fall back to whatever was returned.
async function fetchFontSubsets(family, weight) {
  const response = await fetch(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@${weight}&display=swap`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36' },
  });
  const css = await response.text();
  const blocks = [...css.matchAll(/(?:\/\*\s*([a-z0-9-]+)\s*\*\/\s*)?@font-face\s*\{([^}]*)\}/gi)]
    .map(match => ({
      subset: (match[1] || 'font').toLowerCase(),
      url: (match[2].match(/url\((https:[^)]+\.woff2)\)/) || [])[1],
      unicodeRange: ((match[2].match(/unicode-range:\s*([^;]+)/) || [])[1] || '').trim(),
    }))
    .filter(block => block.url);
  const latin = blocks.filter(block => block.subset === 'latin' || block.subset === 'latin-ext');
  return latin.length ? latin : blocks.slice(0, 1);
}

ipcMain.handle('font:import', async (_, { root, family }) => {
  if (!root || !family) return null;
  const slug = family.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const weights = [['400', 'normal'], ['700', 'bold']];
  const faces = [];
  await fs.mkdir(path.join(root, 'assets', 'fonts'), { recursive: true });
  for (const [weight, cssWeight] of weights) {
    const subsets = await fetchFontSubsets(family, weight).catch(() => []);
    for (const subset of subsets) {
      const fileResponse = await fetch(subset.url).catch(() => null);
      if (!fileResponse || !fileResponse.ok) continue;
      const bytes = Buffer.from(await fileResponse.arrayBuffer());
      const relative = `assets/fonts/${slug}-${weight}-${subset.subset}.woff2`;
      await fs.writeFile(path.join(root, relative), bytes);
      const range = subset.unicodeRange ? ` unicode-range: ${subset.unicodeRange};` : '';
      faces.push(`@font-face { font-family: "${esc(family)}"; font-weight: ${cssWeight}; font-style: normal; src: url("${relative}") format("woff2");${range} }`);
    }
  }
  if (!faces.length) return null;
  return { family, fontFaceCss: faces.join('\n') };
});

// --- Export. Each format resolves the manuscript's own "assets/..." relative
// paths a different way, matched to what that output actually is: ---
function createPdfProject(p, settings = {}) {
  const size = findBookSize(settings.pageSizeId || p.kit.pageSizeId || 'a4');
  const marginMm = Number.isFinite(settings.marginMm)
    ? Math.min(50, Math.max(0, settings.marginMm))
    : (Number.isFinite(p.kit.margin) ? p.kit.margin : 52) * 25.4 / 72;
  const bleedMm = Number.isFinite(settings.bleedMm) ? Math.min(10, Math.max(0, settings.bleedMm)) : 0;
  return {
    ...p,
    kit: {
      ...p.kit,
      pageSizeId: size.id,
      pageWidthMm: size.widthMm + bleedMm * 2,
      pageHeightMm: size.heightMm + bleedMm * 2,
      margin: (marginMm + bleedMm) * 72 / 25.4,
    },
  };
}

async function renderPdfBuffer(p, settings = {}) {
  if (!p?.path) throw new Error('A saved manuscript project is required to render its PDF.');
  const pdfProject = createPdfProject(p, settings);
  const win = new BrowserWindow({ show: false });
  try {
    const baseURLForDataURL = `file://${p.path.replace(/\\/g, '/')}/`;
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(renderHtml(pdfProject, { fullBleed: settings.paperBleed !== false }))}`, { baseURLForDataURL });
    await win.webContents.executeJavaScript(`Promise.all([
      document.fonts.ready,
      ...[...document.images].map(image => image.decode().catch(() => {})),
    ]).then(() => true)`);
    return await win.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
      pageSize: pageSizeInches(pdfProject.kit),
    });
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
}

ipcMain.handle('preview:pdf', async (_, project) => renderPdfBuffer(project));

ipcMain.handle('export:book', async (_, { format, project: p, settings = {} }) => {
  const setting = { pdf: ['PDF', 'pdf'], epub: ['EPUB', 'epub'], html: ['HTML', 'html'] }[format];
  const { filePath } = await dialog.showSaveDialog({ title: `Export ${setting[0]}`, defaultPath: `${safeName(p.title)}.${setting[1]}`, filters: [{ name: setting[0], extensions: [setting[1]] }] });
  if (!filePath) return null;

  if (format === 'pdf') {
    await fs.writeFile(filePath, await renderPdfBuffer(p, settings));
  } else if (format === 'epub') {
    await fs.writeFile(filePath, await makeEpub(p));
  } else {
    // HTML export: the exported page keeps its "assets/..." references as-is
    // (correct for a self-contained bundle) and the assets folder is copied
    // to sit right beside it, so those relative paths resolve exactly like
    // they do inside the project itself.
    await fs.writeFile(filePath, renderHtml(p));
    await copyAssetsNextTo(p.path, filePath);
  }
  return filePath;
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);

  // Serves a project's own files to the live preview under
  // manuscript-asset:///<relative path>. The preview runs inside the app's
  // own window (not rooted at the project folder the way file:// export
  // rendering is), so without this, relative "assets/..." references in the
  // manuscript would resolve against the app's UI bundle instead of the
  // actual project — this is the piece that makes the live preview show the
  // same images/fonts the export will contain.
  protocol.handle('manuscript-asset', async request => {
    if (!currentProjectRoot) return new Response('Not found', { status: 404 });
    const url = new URL(request.url);
    // The scheme is registered as "standard", so Chromium re-serializes the
    // URLs the renderer asks for — "manuscript-asset:///assets/x.jpg" comes
    // back here as "manuscript-asset://assets/x.jpg": the first path segment
    // has been promoted to the URL *host* and the pathname lost it. Reading
    // the pathname alone therefore served "x.jpg" from the project root and
    // 404'd everything under assets/. Rebuild the relative path from host +
    // pathname, and fall back to the raw string when the URL is non-standard
    // (e.g. devtools fetching it with only one slash after the scheme).
    const decoded = s => { try { return decodeURIComponent(s); } catch { return s; } };
    const joined = [url.host, url.pathname].filter(Boolean).map(decoded).join('/');
    // `.` host ("manuscript-asset://./assets/x.jpg") reads ".//assets/x.jpg"
    // here; the host-form ("//assets/x.jpg") double-slashes too. Both clean
    // up with the same squeeze, and the 403 check below still runs on the
    // final, resolved path.
    const relative = joined.replace(/^\/+/, '').replace(/(^|\/)\.?(\/\/)+/g, '$1').replace(/\/\{2,}/g, '/');
    const filePath = path.join(currentProjectRoot, relative);
    const rel = path.relative(currentProjectRoot, filePath);
    if (rel.startsWith('..') || path.isAbsolute(rel)) return new Response('Forbidden', { status: 403 });
    try {
      return new Response(await fs.readFile(filePath));
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });

  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
