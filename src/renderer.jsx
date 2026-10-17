import { createRoot } from 'react-dom/client';
import { Previewer } from 'pagedjs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createBookStyles, kitFontRoles } from './bookStyles';
import { toCanonicalHtml, isIsolatedDashLine } from './canonical';
import { PREVIEW_SCALE } from './bookSizes';
import { kits } from './builtinKits';
import { FONT_PAIRINGS, googleFamilyFor } from './fontCatalog';
import { useSpellcheck } from './useSpellcheck';
import { Binder } from './components/Binder';
import { Dashboard } from './components/Dashboard';
import { EditorPanel } from './components/EditorPanel';
import { ExportModal } from './components/ExportModal';
import { PreflightModal } from './components/PreflightModal';
import { RecoveryModal } from './components/RecoveryModal';
import { Inspector } from './components/Inspector';
import { PreviewStage } from './components/PreviewStage';
import { Subbar } from './components/Subbar';
import { Topbar } from './components/Topbar';
import { TemplateManagerWindow } from './components/TemplateManagerWindow';
import './index.css';

// The live preview renders inside the app's own window, not rooted at the
// project folder — so a manuscript's "assets/..." references need rewriting
// to the manuscript-asset:// scheme (registered in main.js) before paged.js
// or a plain innerHTML render can load them. PDF export instead resolves the
// same relative paths via baseURLForDataURL against the real project folder,
// and EPUB/HTML export copy the real files in — three different resolutions
// for the same canonical "assets/..." path, matched to what each output is.
// "Playfair Display, Georgia, serif" → "Playfair Display": kits keep the family
// name the user picked, but roles that were never set resolve to a whole stack.
const familyOf = stack => String(stack || '').split(',')[0].replace(/["']/g, '').trim();

// Every role materialized as an explicit name, so switching one role can never
// quietly pull another role's font along with it (or leave it behind).
const fontNamesOf = value => {
  const roles = kitFontRoles(value);
  return { title: familyOf(roles.title), subtitle: familyOf(roles.subtitle), body: familyOf(roles.body) };
};

// Families are embedded once and shared: the same face can be the body font in
// one role and the title font in another, so an import appends its @font-face
// rules to the kit's existing CSS instead of replacing it (which is what the
// single-font picker used to do — the second pick silently dropped the first
// face). Re-picking a family replaces just that family's rules.
function mergeFontFaceCss(existing = '', family = '', incoming = '') {
  const escaped = family.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const marker = new RegExp(`font-family:\\s*"${escaped}"`);
  const kept = String(existing).split(/(?=@font-face)/).filter(block => block.trim() && !marker.test(block));
  return [...kept, incoming].filter(Boolean).join('\n').trim();
}

// Rewrites the manuscript's relative "assets/..." references to the
// manuscript-asset scheme the main process serves (registered in main.js).
// The scheme is registered as "standard", so the URL is parsed with host
// semantics: the obvious three-slash form ("///assets/x.jpg") gets its first
// path segment promoted to the URL host when Chromium re-serializes it, and
// the file resolves to the wrong place (see the handler). The dot-host form
// "manuscript-asset://./assets/x.jpg" keeps the whole path in the pathname —
// and the handler additionally tolerates the host form, so both work.
function withPreviewAssetUrls(text = '') {
  return text
    .replace(/(src=["'])assets\//g, '$1manuscript-asset://./assets/')
    .replace(/url\((['"]?)assets\//g, 'url($1manuscript-asset://./assets/');
}

// paged.js measures page breaks the moment it runs, but <img> elements load
// asynchronously — an image that hadn't arrived yet contributed zero height,
// so pagination ran as if the image (and everything after it) were shorter
// and the picture then overflowed whatever page it had been assigned to.
// Preloading every image in the chunk first guarantees the browser knows the
// intrinsic dimensions before layout is measured. Failures (a file that no
// longer exists) resolve instead of rejecting, so a broken reference can
// never wedge the preview.
async function waitForImages(text = '') {
  const sources = [...text.matchAll(/src=["']([^"']+)["']/g)]
    .map(match => match[1])
    .filter(src => /\.(png|jpe?g|gif|webp|svg)([?#].*)?$/i.test(src));
  await Promise.all(sources.map(src => new Promise(resolve => {
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = src;
  })));
}

function updateImageMarkdown(source, targetSrc, image) {
  const normalize = value => {
    try { return decodeURIComponent(value); } catch { return value; }
  };
  let changed = false;
  const updated = source.split('\n').map(line => line.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, label, src) => {
    if (changed || normalize(src.trim()) !== normalize(targetSrc)) return match;
    const sizeMatch = label.match(/^(.*?)(?:\|\s*(\d+)\s*(?:x\s*(\d+))?\s*)?$/);
    const alt = image.alt ?? sizeMatch?.[1] ?? label;
    const width = image.width ?? sizeMatch?.[2] ?? '';
    const height = image.height ?? sizeMatch?.[3] ?? '';
    const size = width ? `|${width}${height ? `x${height}` : ''}` : '';
    changed = true;
    return `![${String(alt).replace(/\]/g, '\\]')}${size}](${src.trim()})`;
  }));
  return changed ? updated.join('\n') : source;
}

function App() {
  const [source, setSource] = useState('');
  const [activeView, setActiveView] = useState('Editor');
  const [theme, setTheme] = useState('dark');
  const [binderCollapsed, setBinderCollapsed] = useState(false);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [editorWidth, setEditorWidth] = useState(360);
  const [mode, setMode] = useState('Book');
  const [kit, setKit] = useState(kits.literary);
  const [page, setPage] = useState(1);
  const [bookPageCount, setBookPageCount] = useState(1);
  const [pdfPageCount, setPdfPageCount] = useState(0);
  const [pdfData, setPdfData] = useState(null);
  const [pdfError, setPdfError] = useState('');
  const [sections, setSections] = useState([]);
  const [activeSection, setActiveSection] = useState(null);
  const [zoom, setZoom] = useState(70);
  const [tab, setTab] = useState('Style');
  const [exportOpen, setExportOpen] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [preflightOpen, setPreflightOpen] = useState(false);
  const [preflightFindings, setPreflightFindings] = useState([]);
  const [notice, setNotice] = useState('Unsaved changes');
  const [projectPath, setProjectPath] = useState(null);
  const [title, setTitle] = useState('');
  const [metadata, setMetadata] = useState({ author: '', language: 'en' });
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState('Untitled manuscript');
  const [recentProjects, setRecentProjects] = useState([]);
  const [recentImage, setRecentImage] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [pdfPreviewBusy, setPdfPreviewBusy] = useState(false);
  const [viewportMode, setViewportMode] = useState(() => (
    window.innerWidth <= 760 ? 'mobile' : window.innerWidth <= 1100 ? 'compact' : 'wide'
  ));
  const previewRef = useRef(null);
  const renderId = useRef(0);
  const pdfRequestId = useRef(0);
  const pageCount = mode === 'Page' ? pdfPageCount || bookPageCount : bookPageCount;
  const checkText = useSpellcheck();
  const html = useMemo(() => toCanonicalHtml(source), [source]);
  const headingSections = useMemo(() => {
    if (!html) return [];
    const document = new DOMParser().parseFromString(html, 'text/html');
    return [...document.body.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((heading, index) => ({
      id: `heading-${index}`,
      text: heading.textContent.trim() || 'Untitled heading',
      level: Number(heading.tagName.slice(1)),
      page: 1,
    }));
  }, [html]);
  const words = source.trim().split(/\s+/).filter(Boolean).length;
  // Single source of truth for "is this --- actually isolated" — see
  // canonical.js. Previously this warning had its own third copy of the
  // check, out of sync with both the editor's live highlighting and the
  // actual conversion logic.
  const pageWarning = source.split('\n').some((line, index, lines) => line.trim() === '---'
    && !isIsolatedDashLine({ lineCount: lines.length, lineNumber: index + 1, getLineText: n => lines[n - 1] }));
  const project = { path: projectPath, title, format: 'mixed', content: source, html, kit, metadata };

  const refreshRecentProjects = async () => {
    const list = await window.manuscript?.listProjects();
    if (list) setRecentProjects(list);
  };

  const save = async (quiet = false) => {
    const file = await window.manuscript?.saveProject(project);
    if (file) { setProjectPath(file); setNotice('Saved'); refreshRecentProjects(); }
    else if (!quiet) setNotice('Save cancelled');
  };

  useEffect(() => { refreshRecentProjects(); }, []);

  useEffect(() => {
    const updateViewportMode = () => {
      const next = window.innerWidth <= 760 ? 'mobile' : window.innerWidth <= 1100 ? 'compact' : 'wide';
      setViewportMode(current => current === next ? current : next);
    };
    window.addEventListener('resize', updateViewportMode);
    return () => window.removeEventListener('resize', updateViewportMode);
  }, []);

  // Mirror the theme class onto <html> as well as the app shell. The shell's
  // `theme-light` reaches every panel, but the Combobox popup (the font and
  // template pickers) is portalled to <body> — outside the shell — so its
  // own light-theme rules never matched and it stayed dark on a light panel.
  useEffect(() => {
    document.documentElement.classList.toggle('theme-light', theme === 'light');
    document.documentElement.dataset.fpTheme = theme;
    document.body.dataset.fpTheme = theme;
  }, [theme]);

  useEffect(() => {
    setSections(headingSections);
    setActiveSection(current => current && headingSections.some(section => section.id === current) ? current : headingSections[0]?.id || null);
  }, [headingSections]);

  useEffect(() => {
    if (!projectPath) return undefined;
    setNotice('Saving...');
    const timer = setTimeout(() => save(true), 800);
    return () => clearTimeout(timer);
  }, [source, kit, metadata, title]);

  // Inputs that actually change pagination, compared across effect runs so a
  // zoom-only changes skip the reader-position reset and typing debounce.
  // Pagination stays at print size; only the finished page stack changes size.
  const layoutRef = useRef({ html, kit, title, mode, zoom, pageNumbers: metadata.pageNumbers, runningHead: metadata.runningHead });
  useEffect(() => {
    const previous = layoutRef.current;
    const layoutChanged = previous.html !== html || previous.kit !== kit || previous.title !== title;
    const nonContentChanged = previous.kit !== kit || previous.title !== title || previous.mode !== mode
      || previous.zoom !== zoom || previous.pageNumbers !== metadata.pageNumbers || previous.runningHead !== metadata.runningHead;
    layoutRef.current = { html, kit, title, mode, zoom, pageNumbers: metadata.pageNumbers, runningHead: metadata.runningHead };
    // Keep the current spread/page while the replacement preview is prepared.
    // Resetting it or clearing the preview here made every edit jump to a blank
    // first page before pagination had finished.
    setSections(headingSections);
    const currentRender = ++renderId.current;
    const previewHidden = viewportMode !== 'wide' && activeView !== 'Preview';
    setPreviewBusy(!previewHidden && nonContentChanged);
    if (!previewRef.current || previewHidden) return undefined;
    const delay = layoutChanged && (mode === 'Book' || mode === 'Page') ? 300 : 0;
    const timer = setTimeout(() => {
      const content = withPreviewAssetUrls(html || '<p></p>');
      const render = async () => {
        const container = previewRef.current;
        if (!container || currentRender !== renderId.current) return;
        // Book/Page paginate from real element heights, so the images must
        // have their intrinsic size before paged.js measures the flow (see
        // waitForImages). Web/EPUB just flow, so nothing to wait for.
        if (mode === 'Book' || mode === 'Page') await waitForImages(content);
        if (currentRender !== renderId.current) return;
        if (mode !== 'Book' && mode !== 'Page') {
          container.innerHTML = content;
          setBookPageCount(1);
          setPage(1);
          setPreviewBusy(false);
          return;
        }
        // Paginate off-screen while the current pages remain visible. Swapping
        // completed sheets at once avoids a blank flash and layout collapse.
        const staging = document.createElement('div');
        staging.className = 'book-preview';
        const previewScale = PREVIEW_SCALE * (zoom / 100);
        const fullPageWidth = (kit.pageWidthMm || 210) * (96 / 25.4);
        staging.style.cssText = `position:fixed;left:-20000px;top:0;width:${Math.max(container.clientWidth / previewScale, fullPageWidth)}px;visibility:hidden;pointer-events:none;`;
        container.appendChild(staging);
        const previewStyles = withPreviewAssetUrls(createBookStyles(kit, {
          scope: '.book-preview, .pagedjs_page_content',
          // Paginate at the physical size used by PDF export; apply visual zoom after pagination.
          scale: 1,
          title,
          html,
          headerFooter: { pageNumbers: metadata.pageNumbers || 'off', runningHead: metadata.runningHead || 'off' },
        }));
        const stylesheet = { [`${window.location.href}#manuscript-preview`]: previewStyles };
        let flow;
        try {
          flow = await new Previewer().preview(content, [stylesheet], staging);
        } catch (error) {
          staging.remove();
          throw error;
        }
        if (currentRender !== renderId.current) { staging.remove(); return; }
        const pagesRoot = staging.querySelector('.pagedjs_pages');
        if (pagesRoot) pagesRoot.style.zoom = String(previewScale);
        const total = flow?.total || staging.querySelectorAll('.pagedjs_page').length || 1;
        const pages = [...staging.querySelectorAll('.pagedjs_page')];
        const displayPage = Math.min(Math.max(page, 1), total);
        // Folio parity fix. paged.js numbers pages with a real CSS counter
        // (`counter-increment: page` per page, `counter(page)`/`counter(pages)`
        // in the @page margin boxes), which the exported PDF gets for free from
        // Chromium. In the preview, though, the spread view hides every page
        // except the two on screen with `display: none` — and per the CSS
        // counter rules an element that isn't rendered doesn't increment its
        // counters. So the first visible spread always restarted at "1" and the
        // numbers drifted by one for every page turn (pages 2-3 read "1 / 5"
        // and "2 / 5"). Anchoring each page's own counter to its true index
        // (`counter-reset` runs before that same element's increment, so page n
        // resets to n-1 and then counts to n) makes the preview show the same
        // folios the export does, whatever is currently visible.
        pages.forEach((pageElement, index) => pageElement.style.setProperty('counter-reset', `page ${index}`));
        if (mode === 'Book') {
          const left = displayPage % 2 === 0 ? displayPage : displayPage - 1;
          const right = displayPage % 2 === 0 ? displayPage + 1 : displayPage;
          pages.forEach((pageElement, index) => {
            const number = index + 1;
            pageElement.hidden = number !== left && number !== right;
          });
        }
        container.replaceChildren(...Array.from(staging.childNodes));
        staging.remove();
        setBookPageCount(total);
        setPreviewBusy(false);
        const pagedSections = headingSections.map((section, index) => {
          const heading = [...container.querySelectorAll(`h${section.level}`)].find(item => item.textContent.trim() === section.text);
          const pageIndex = heading ? pages.findIndex(pageElement => pageElement.contains(heading)) + 1 : 1;
          return { ...section, id: `heading-${index}`, page: pageIndex || 1 };
        });
        setSections(pagedSections);
        if (mode === 'Book') setPage(displayPage);
      };
      render().catch(error => {
        if (currentRender === renderId.current) {
          console.error('Preview pagination failed', error);
          setPreviewBusy(false);
        }
      });
    }, delay);
    return () => clearTimeout(timer);
  }, [activeView, html, headingSections, kit, mode, title, metadata.pageNumbers, metadata.runningHead, viewportMode, zoom]);

  useEffect(() => {
    const requestId = ++pdfRequestId.current;
    const previewHidden = viewportMode !== 'wide' && activeView !== 'Preview';
    if (mode !== 'Page' || previewHidden || !projectPath) {
      setPdfPreviewBusy(false);
      return undefined;
    }

    let cancelled = false;
    setPdfPreviewBusy(true);
    setPdfError('');
    setPdfData(null);
    setPdfPageCount(0);
    const timer = setTimeout(async () => {
      try {
        const bytes = await window.manuscript?.renderPdf(project);
        if (!bytes) throw new Error('The PDF preview returned no document.');
        if (!cancelled && requestId === pdfRequestId.current) {
          setPdfData(new Uint8Array(bytes));
          setPdfPageCount(0);
        }
      } catch (error) {
        if (!cancelled && requestId === pdfRequestId.current) {
          console.error('PDF preview generation failed', error);
          setPdfError('Could not generate the PDF preview.');
        }
      } finally {
        if (!cancelled && requestId === pdfRequestId.current) setPdfPreviewBusy(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeView, html, kit, metadata, mode, projectPath, title, viewportMode]);

  const updatePdfPageCount = useCallback(total => {
    setPdfPageCount(total);
    setPage(current => Math.min(current, total));
  }, []);

  useEffect(() => {
    const root = previewRef.current;
    if (!root) return;
    root.querySelectorAll('.spread-blank').forEach(item => item.remove());
    const pages = [...root.querySelectorAll('.pagedjs_page')];
    if (mode !== 'Book' && mode !== 'Page' || !pages.length) {
      pages.forEach(item => { item.hidden = false; });
      return;
    }
    // Book shows a two-page spread and hides every other sheet. Page is a
    // Keep every source page present for TOC mapping and preflight checks.
    if (mode === 'Page') {
      pages.forEach(item => { item.hidden = false; });
      const sectionOnPage = sections.find(section => section.page === page);
      if (sectionOnPage) setActiveSection(sectionOnPage.id);
      return;
    }
    const left = page % 2 === 0 ? page : page - 1;
    const right = page % 2 === 0 ? page + 1 : page;
    pages.forEach((item, index) => {
      const number = index + 1;
      item.hidden = number !== left && number !== right;
    });
    const sheet = root.querySelector('.pagedjs_pages') || root;
    // A blank spread placeholder measures an actual rendered page's own box
    // (offsetWidth/Height stay in layout pixels under the post-pagination zoom)
    // instead of assuming a constant size.
    const referencePage = pages.find(item => !item.classList.contains('spread-blank'));
    const sizeBlank = blank => {
      if (!referencePage) return;
      blank.style.width = `${referencePage.offsetWidth}px`;
      blank.style.height = `${referencePage.offsetHeight}px`;
    };
    if (left < 1) {
      const blank = document.createElement('div');
      blank.className = 'spread-blank pagedjs_page pagedjs_left_page';
      sizeBlank(blank);
      sheet.insertBefore(blank, sheet.firstChild);
    }
    if (right > pageCount) {
      const blank = document.createElement('div');
      blank.className = 'spread-blank pagedjs_page pagedjs_right_page';
      sizeBlank(blank);
      sheet.appendChild(blank);
    }
    const sectionOnPage = sections.find(section => section.page === page || section.page === left || section.page === right);
    if (sectionOnPage) setActiveSection(sectionOnPage.id);
  }, [page, pageCount, mode, sections]);

  const openProject = async () => {
    const opened = await window.manuscript?.openProject();
    if (!opened) return;
    setProjectPath(opened.path);
    setRecentImage(null);
    setSelectedImage(null);
    setTitle(opened.title || 'Untitled');
    setSource(opened.content || '');
    setMetadata(opened.metadata || {});
    const savedKit = opened.kit || {};
    setKit({ ...kits.literary, ...savedKit });
    setNotice('Project opened');
    refreshRecentProjects();
  };

  const openRecent = async recentPath => {
    const opened = await window.manuscript?.openProjectPath(recentPath);
    if (!opened) { setNotice('Could not open that project — it may have moved'); refreshRecentProjects(); return; }
    setProjectPath(opened.path);
    setRecentImage(null);
    setSelectedImage(null);
    setTitle(opened.title || 'Untitled');
    setSource(opened.content || '');
    setMetadata(opened.metadata || {});
    const savedKit = opened.kit || {};
    setKit({ ...kits.literary, ...savedKit });
    setNotice('Project opened');
  };

  const newProject = async () => {
    if (!newTitle.trim()) return;
    const created = await window.manuscript?.createProject({ title: newTitle.trim(), format: 'mixed' });
    if (!created) return;
    setProjectPath(created.path);
    setRecentImage(null);
    setSelectedImage(null);
    setTitle(created.title);
    setSource('');
    setMetadata({ author: '', language: 'en' });
    setKit(kits.literary);
    setNotice('Saved');
    setShowNew(false);
    refreshRecentProjects();
  };

  const importAsset = async () => {
    const asset = await window.manuscript?.importAsset(projectPath);
    if (asset) {
      // Blank lines around the image make it its own block: run together with
      // the previous paragraph, Markdown joins the lines into one <p> and the
      // image renders inline inside the text instead of standing alone. The
      // placeholder-free name (and spaces → dashes) also keeps the reference
      // valid Markdown — spaces in the URL would truncate the path at the
      // first word, and nothing would display. The inserted |width sizing
      // (see canonical.js's applyImageSizes) gives a sensible default the
      // author can edit instead of a full-bleed dump.
      // Belt-and-braces with main.js's own sanitization: whatever reaches
      // this string has to be a one-token Markdown URL (no whitespace, no
      // unescaped parens), or the reference truncates and nothing displays.
      const safeAsset = asset.replace(/\s+/g, '-').replace(/\(/g, '%28').replace(/\)/g, '%29');
      const image = `\n\n![Image|400](${safeAsset})\n\n`;
      setSource(value => `${value}${image}`);
      setRecentImage({ asset: safeAsset, width: '400', height: '' });
      setSelectedImage(null);
      setTab('Assets');
      setNotice('Image added — click it in the preview to edit');
    } else if (!projectPath) setNotice('Save the project before importing an image');
  };

  const resizeRecentImage = (dimension, value) => {
    const activeImage = selectedImage || recentImage;
    if (!activeImage) return;
    const next = { ...activeImage, [dimension]: value };
    if (selectedImage) setSelectedImage(next);
    else setRecentImage(next);
    const width = next.width === '' ? null : Number(next.width);
    const height = next.height === '' ? null : Number(next.height);
    if (dimension !== 'alt' && ((width !== null && (!Number.isInteger(width) || width < 1)) || (height !== null && (!Number.isInteger(height) || height < 1)))) return;
    const valueForSource = {
      alt: next.alt,
      width: width === null ? '' : width,
      height: next.height === '' ? '' : height,
    };
    setSource(current => updateImageMarkdown(current, activeImage.src || activeImage.asset, valueForSource));
    setNotice('Unsaved changes');
  };

  const selectPreviewImage = image => {
    setSelectedImage(image);
    setTab('Assets');
  };

  const exportBook = async (formatName, settings) => {
    const file = await window.manuscript?.exportBook(formatName, project, settings);
    if (file) { setNotice(`${formatName.toUpperCase()} export saved`); setExportOpen(false); }
  };

  const runPreflight = async () => {
    const findings = [];
    if (!source.trim()) findings.push({ level: 'warning', message: 'The manuscript is empty.' });
    if (!title.trim()) findings.push({ level: 'warning', message: 'The book title is empty.' });
    const document = new DOMParser().parseFromString(html, 'text/html');
    const images = [...document.querySelectorAll('img')];
    images.forEach((image, index) => {
      if (!image.hasAttribute('alt')) findings.push({ level: 'warning', message: `Image ${index + 1} has no alt text.` });
    });
    const pages = [...(previewRef.current?.querySelectorAll('.pagedjs_page') || [])];
    const hiddenStates = pages.map(pageElement => pageElement.hidden);
    pages.forEach(pageElement => { pageElement.hidden = false; });
    const pageContents = [...(previewRef.current?.querySelectorAll('.pagedjs_page_content') || [])];
    const overflowingPages = pageContents.reduce((pages, content, index) => content.scrollHeight > content.clientHeight + 3 ? [...pages, index + 1] : pages, []);
    pages.forEach((pageElement, index) => { pageElement.hidden = hiddenStates[index]; });
    if (overflowingPages.length) findings.push({ level: 'warning', message: `Content may overflow page${overflowingPages.length > 1 ? 's' : ''} ${overflowingPages.join(', ')}.` });
    const missingAssets = await window.manuscript?.checkProjectAssets(project).catch(() => []) || [];
    missingAssets.forEach(asset => findings.push({ level: 'warning', message: `Missing image or font asset: ${asset}` }));
    if (images.length === 0) findings.push({ level: 'info', message: 'No images in this manuscript.' });
    setPreflightFindings(findings);
    setPreflightOpen(true);
  };

  const continueAfterPreflight = () => {
    setPreflightOpen(false);
    setExportOpen(true);
  };

  const restoreRecovery = async id => {
    const snapshot = await window.manuscript?.getRecovery(projectPath, id);
    if (!snapshot) return;
    setTitle(snapshot.title || 'Untitled');
    setSource(snapshot.content || '');
    setMetadata(snapshot.metadata || {});
    setKit({ ...kits.literary, ...(snapshot.kit || {}) });
    setNotice('Draft restored');
    setTab('Editor');
    setRecoveryOpen(false);
  };

  // Applies a Template (a built-in kit or a saved one from the Template
  // Manager window) to the current project.
  // Downloads any family this project doesn't already carry and hands back the
  // project's full @font-face CSS, or null when the download failed (the notice
  // is set here, since every caller would otherwise repeat it).
  const embedFamilies = async (families, baseCss = '') => {
    let css = String(baseCss || '');
    let downloaded = 0;
    for (const family of families) {
      // The system and licensed faces in the catalog (Helvetica, Arial, Times
      // New Roman, Georgia, Futura, Garamond, Proxima Nova, Century Gothic)
      // have no webfont to fetch — their stack in fontCatalog.js already points
      // at the locally installed family, so there is nothing to download and
      // nothing that can fail. Three others are Google families under a
      // different name (Garamond is EB Garamond, Bodoni is Bodoni Moda, Source
      // Sans Pro is Source Sans 3), so the import has to ask for the Google
      // name while the panel keeps showing the name the user picked.
      const google = googleFamilyFor(family);
      if (!google) continue;
      if (css.includes(`"${google}"`)) continue;
      const result = await window.manuscript?.importGoogleFont(projectPath, google);
      if (!result) { setNotice(`Could not load ${family}`); return null; }
      css = mergeFontFaceCss(css, google, result.fontFaceCss);
      downloaded += 1;
    }
    return { css, downloaded };
  };

  const prepareParagraphFont = async family => {
    if (googleFamilyFor(family) && !projectPath) {
      setNotice('Save the project before adding a font');
      return false;
    }
    const embedded = await embedFamilies([family], kit.fontFaceCss);
    if (!embedded) return false;
    setKit(current => ({ ...current, fontFaceCss: embedded.css }));
    return true;
  };

  // One entry point for the Style tab's font work: `assignments` are
  // { role, family } pairs, and a blank family clears that role (it then follows
  // the body font — or, for the body role itself, the built-in default).
  const applyFontRoles = async assignments => {
    const wanted = [...new Set(assignments.map(item => item.family).filter(Boolean))];
    // Only a family that actually has a webfont needs the project on disk to
    // download into; a system face like Helvetica applies fine in an unsaved
    // document, so it no longer asks the user to save first.
    if (wanted.some(family => googleFamilyFor(family)) && !projectPath) { setNotice('Save the project before adding a font'); return; }
    const embedded = wanted.length ? await embedFamilies(wanted, kit.fontFaceCss) : { css: kit.fontFaceCss || '', downloaded: 0 };
    if (!embedded) return;
    setKit(current => {
      const fonts = { ...fontNamesOf(current) };
      assignments.forEach(({ role, family }) => {
        fonts[role] = family || (role === 'body' ? kits.literary.font : null);
      });
      // googleFont was the single-font picker's field; the roles replace it, so
      // leaving it behind would let a stale family win when a role is cleared.
      return { ...current, fonts, googleFont: undefined, fontFaceCss: embedded.css };
    });
    setNotice(embedded.downloaded ? `${wanted.join(' + ')} embedded` : wanted.length ? `${wanted.join(' + ')} applied` : 'Font reset');
  };

  // A template stores font-family *names*, not this project's downloaded files
  // (a template isn't tied to any one project's assets folder), so applying one
  // re-downloads the families it names into THIS project and drops the previous
  // faces, since none of them belong to the template.
  const applyTemplate = async templateData => {
    const { googleFont, fonts: templateFonts, fontFaceCss: _faces, ...rest } = templateData || {};
    const families = [...new Set([...(templateFonts ? [templateFonts.title, templateFonts.subtitle, templateFonts.body] : [googleFont]).filter(Boolean)])];
    setKit(current => ({
      ...current,
      ...rest,
      titleSize: templateData?.titleSize,
      subtitleSize: templateData?.subtitleSize,
      lineHeight: templateData?.lineHeight,
      titleInk: templateData?.titleInk,
      subtitleInk: templateData?.subtitleInk,
      chapterBreaks: !!templateData?.chapterBreaks,
      dropCaps: !!templateData?.dropCaps,
      fonts: templateFonts,
      googleFont: undefined,
      fontFaceCss: '',
    }));
    if (!families.length) return;
    if (families.some(family => googleFamilyFor(family)) && !projectPath) { setNotice('Save the project before adding a font'); return; }
    const embedded = await embedFamilies(families, '');
    if (!embedded) return;
    setKit(current => ({ ...current, fontFaceCss: embedded.css }));
  };
  const setPageSize = size => setKit(current => ({ ...current, pageSizeId: size.id, pageWidthMm: size.widthMm, pageHeightMm: size.heightMm }));
  // Downloads the real font file through the main process and embeds it via
  // @font-face pointing at a local project asset, instead of the previous
  // version's <link> tag into fonts.googleapis.com — that made the live
  // preview show the right font while every export silently fell back to a
  // system font, since neither the PDF window nor the EPUB/HTML output had
  // any way to see a <link> injected into the renderer's own <head>.
  const loadGoogleFont = (role, family) => applyFontRoles([{ role, family }]);

  // The ↦ button beside a font row: that row's family becomes every role.
  const useFontEverywhere = role => {
    const family = fontNamesOf(kit)[role];
    return applyFontRoles([
      { role: 'title', family },
      { role: 'subtitle', family },
      { role: 'body', family },
    ]);
  };

  // Remix fonts: one curated heading/body pairing, applied as a single step so
  // the two never end up drawn from unrelated picks.
  const remixFonts = () => {
    const pairing = FONT_PAIRINGS[Math.floor(Math.random() * FONT_PAIRINGS.length)];
    return applyFontRoles([
      { role: 'title', family: pairing.title },
      { role: 'subtitle', family: pairing.title },
      { role: 'body', family: pairing.body },
    ]);
  };

  const rename = () => { const value = window.prompt('Rename manuscript', title); if (value) setTitle(value); };
  const selectSection = section => { setActiveSection(section.id); setPage(section.page); };
  const startResize = event => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = editorWidth;
    const move = moveEvent => setEditorWidth(Math.min(620, Math.max(260, startWidth + moveEvent.clientX - startX)));
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  };

  if (!projectPath) return <Dashboard showNew={showNew} setShowNew={setShowNew} newTitle={newTitle} setNewTitle={setNewTitle} onOpen={openProject} onCreate={newProject} recentProjects={recentProjects} onOpenRecent={openRecent} theme={theme} onThemeChange={() => setTheme(current => current === 'dark' ? 'light' : 'dark')} />;

  return <main className={`app-shell ${activeView.toLowerCase()}-view theme-${theme}`}>
    <Topbar title={title} notice={notice} words={words} pageCount={pageCount} activeView={activeView} theme={theme} onThemeChange={() => setTheme(current => current === 'dark' ? 'light' : 'dark')} onViewChange={setActiveView} onRename={rename} onNew={newProject} onOpen={openProject} onSave={() => save(false)} onExport={runPreflight} onOpenTemplates={() => window.manuscript?.openTemplateManager()} onRecover={() => setRecoveryOpen(true)} />
    <div className="workspace" style={{ '--binder-width': binderCollapsed ? '44px' : '220px', '--editor-width': `${editorWidth}px`, '--inspector-width': inspectorCollapsed ? '44px' : '270px' }}>
      <Binder words={words} sections={sections} activeSection={activeSection} collapsed={binderCollapsed} onToggle={() => setBinderCollapsed(value => !value)} onSelect={selectSection} />
      <EditorPanel source={source} setSource={value => { setSource(value); setNotice('Unsaved changes'); }} pageWarning={pageWarning} checkText={checkText} onFontApply={prepareParagraphFont} />
      <div className="resize-handle" role="separator" aria-label="Resize editor and preview" onPointerDown={startResize} />
      <PreviewStage mode={mode} kit={kit} zoom={zoom} previewRef={previewRef} previewBusy={mode === 'Page' ? pdfPreviewBusy : previewBusy} onImageSelect={selectPreviewImage} pdfData={pdfData} pdfError={pdfError} page={page} setPage={setPage} setPageCount={updatePdfPageCount} controls={<Subbar mode={mode} setMode={setMode} page={page} pageCount={pageCount} setPage={setPage} zoom={zoom} setZoom={setZoom} />} />
      <Inspector tab={tab} setTab={setTab} kit={kit} setKit={setKit} onApplyTemplate={applyTemplate} setPageSize={setPageSize} metadata={metadata} setMetadata={setMetadata} title={title} setTitle={setTitle} onImport={importAsset} recentImage={recentImage} selectedImage={selectedImage} onImageResize={resizeRecentImage} onFontLoad={loadGoogleFont} onFontAll={useFontEverywhere} onRemix={remixFonts} collapsed={inspectorCollapsed} onToggle={() => setInspectorCollapsed(value => !value)} />
    </div>
    {exportOpen && <ExportModal title={title} kit={kit} onClose={() => setExportOpen(false)} onExport={exportBook} />}
    {preflightOpen && <PreflightModal findings={preflightFindings} onCancel={() => setPreflightOpen(false)} onContinue={continueAfterPreflight} />}
    {recoveryOpen && <RecoveryModal projectPath={projectPath} onClose={() => setRecoveryOpen(false)} onRestore={restoreRecovery} />}
  </main>;
}

// Same renderer bundle, two windows: the main app, and (via ?window=
// templates, opened by main.js's second BrowserWindow) the Template
// Manager. Checking the query param here — rather than configuring a
// second Vite/Forge renderer target — keeps both windows on identical
// tooling with no extra build-config surface.
function Root() {
  const isTemplateWindow = new URLSearchParams(window.location.search).get('window') === 'templates';
  return isTemplateWindow ? <TemplateManagerWindow /> : <App />;
}

createRoot(document.getElementById('app')).render(<Root />);
