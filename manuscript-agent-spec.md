# Foliform — repo structure & roadmap

**Tagline:** Foliform — Write. Design. Publish.

**One-line description:** A professional studio for turning Markdown and HTML into beautifully typeset books for print, ebook, and web.

## App details

|                  |                                                                                                                                                                            |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Name             | Foliform                                                                                                                                                                  |
| Platform         | Desktop app (Electron) — macOS, Windows, Linux                                                                                                                             |
| Summary          | A modern book writing, typesetting, and publishing studio that transforms Markdown and HTML content into beautifully designed, print-ready books and digital publications. |
| UI framework     | React + Tailwind + shadcn/ui (Radix primitives)                                                                                                                            |
| Editor           | CodeMirror 6                                                                                                                                                               |
| Rendering        | paged.js in a hidden Electron `BrowserWindow`, same engine for preview and export                                                                                          |
| Local data       | SQLite (project metadata, brand kits) + local filesystem (project bundles, assets)                                                                                         |
| State management | Zustand/Jotai                                                                                                                                                              |
| Spelling         | nspell + bundled dictionary                                                                                                                                                |
| Grammar          | retext (retext-english, retext-equality, retext-repeated-words, retext-readability, retext-passive)                                                                        |

**Core features**

- Markdown & HTML editor
- Live paginated book preview
- PDF, EPUB & HTML export
- Typography with Google and system fonts
- Book themes / Brand Kits
- Page sizes, margins, headers & footers
- Cover and artwork support
- Image and asset management
- DOCX, EPUB, Markdown & HTML import
- Book metadata and publishing settings
- Book, Web, and EPUB preview modes

## Tech stack decisions (desktop)

| Concern              | Choice                                                                                         | Why                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shell                | **Electron**                                                                                   | Ships its own Chromium — the live preview (renderer process) and the PDF export both run on the _same_ engine version, so pagination can never drift between the two. Also keeps the whole Node ecosystem (mammoth.js and paged.js) usable without a second toolchain. Tauri's per-OS native webview was the alternative, but three rendering engines across platforms is a real risk for a pixel-exact typesetting tool. |
| Monorepo             | pnpm workspaces + Turborepo                                                                    | Shared packages between main process, renderer, and export logic                                                                                                                                                                                                                                                                                                                                                                |
| Frontend (renderer)  | React + Tailwind, rendered inside Electron's `BrowserWindow`                                   | Editor, dashboard, brand kit UI                                                                                                                                                                                                                                                                                                                                                                                                 |
| Editor               | CodeMirror 6                                                                                   | Lighter than Monaco, easy custom syntax highlighting for MD/HTML page-break markers                                                                                                                                                                                                                                                                                                                                             |
| Pagination + render  | paged.js running in a hidden `BrowserWindow`/`webContents.printToPDF`                          | No separate render service or Playwright process — Electron's own Chromium instance does both preview and export                                                                                                                                                                                                                                                                                                                |
| EPUB packaging       | Custom writer (zip + XHTML) on top of the same canonical HTML                                  | Reflowable EPUB from the same document model as the PDF                                                                                                                                                                                                                                                                                                                                                                         |
| DOCX import          | mammoth.js (runs in Electron's main process, Node APIs available directly)                     | DOCX → clean HTML, then through the normal import pipeline                                                                                                                                                                                                                                                                                                                                                                      |
| Markdown parsing     | unified/remark + custom plugin                                                                 | Handles `---` page break, `----` divider, custom directives                                                                                                                                                                                                                                                                                                                                                                     |
| HTML input           | DOMPurify sanitization → canonical HTML                                                        | Same pipeline as Markdown after normalization                                                                                                                                                                                                                                                                                                                                                                                   |
| Local data           | SQLite (via better-sqlite3 or Prisma + SQLite driver)                                          | Projects, brand kits, book metadata — no server, no network round-trip                                                                                                                                                                                                                                                                                                                                                          |
| File & asset storage | Local filesystem (app data dir), each project as a folder bundle                               | Fonts, covers, backgrounds, images live next to the manuscript — easy to back up, sync via Dropbox/iCloud, or version with git                                                                                                                                                                                                                                                                                                  |
| Auth                 | None                                                                                           | Single-user desktop app — nothing to authenticate against                                                                                                                                                                                                                                                                                                                                                                       |
| Fonts                | JSFontPicker (Google and system fonts) + Google Fonts API (cached locally) | Search and embed Google fonts in PDF/EPUB; system fonts use installed fallbacks |
| Packaging & updates  | electron-builder + electron-updater                                                            | Cross-platform installers (dmg, exe/msi, AppImage/deb) and auto-update                                                                                                                                                                                                                                                                                                                                                          |

## Editor

**Core**: One CodeMirror 6 instance, `@codemirror/lang-markdown` (highlights embedded raw HTML natively, no separate HTML mode). Custom CodeMirror extension layered on top for page-break/divider/directive highlighting.

## Markdown + HTML → canonical HTML conversion

This is the pipeline that turns whatever's typed into the editor into the one canonical HTML the preview and every exporter consume.

```
Editor content (Markdown + embedded HTML, freely mixed)
        │
        ▼
remark-parse                    parses Markdown into an MDAST
        │
        ▼
remark-rehype                   MDAST → HAST (HTML AST)
  { allowDangerousHtml: true }  — without this flag, embedded HTML is dropped, not preserved
        │
        ▼
rehype-raw                      merges the raw HTML strings sitting in the HAST into real HTML nodes
        │                       — without this step, embedded HTML renders as escaped literal text
        ▼
DOMPurify.sanitize()            runs on the merged HTML, NOT on the raw input string
        │                       — sanitizing before rehype-raw sanitizes nothing, since the HTML
        │                         is still plain text inside the Markdown at that point
        ▼
rehype-stringify                HAST → final HTML string
        │
        ▼
Canonical HTML                  → live preview (paged.js) + PDF/EPUB/HTML exporters
```

Run this on the same debounce as autosave and the spelling/grammar checks (~800ms after last keystroke) — not per keystroke, since re-parsing the full document and re-sanitizing on every character is wasted work that also fights the pagination recompute for the same CPU budget.

**The one ordering bug to guard against explicitly**: DOMPurify has to run after `rehype-raw`, never before. It's easy to wire these in the "obvious" order (sanitize the input, then parse it) because that's how sanitization usually works for plain HTML forms — but here the dangerous content doesn't exist as real HTML until `rehype-raw` merges it in, so sanitizing earlier is a silent no-op that looks like it's working until someone pastes a `<script>` tag.

**Custom tags/directives** hook in between `remark-parse` and `remark-rehype` (as a `remark-directive` plugin) or get added to DOMPurify's `ADD_TAGS` allowlist if they're real HTML elements rather than directive syntax — either way, they need to survive to the canonical HTML stage before the pagination/breaking rules (from the earlier spec) can apply to them like any other element.

## Repo structure

```
manuscript/
├── apps/
│   └── desktop/
│       ├── src/main/          # Electron main process — file system, SQLite, export orchestration
│       ├── src/preload/       # Context bridge — safe IPC surface between main and renderer
│       └── src/renderer/      # React app — dashboard, editor, brand kits, export UI
│
├── packages/
│   ├── document-model/        # Canonical document AST shared by MD, HTML, DOCX importers
│   ├── md-parser/             # Markdown → canonical HTML (remark + custom page-break plugin)
│   ├── html-parser/           # HTML sanitize + normalize → canonical HTML
│   ├── importers/             # docx, epub, md, html → canonical document
│   ├── pdf-export/            # canonical HTML → paginated PDF (paged.js in a hidden BrowserWindow)
│   ├── epub-export/           # canonical HTML → reflowable EPUB
│   ├── html-export/           # canonical HTML → standalone web publish bundle
│   ├── themes/                # Bundled Brand Kits (House Serif, Studio Dark, Workbook, Editorial)
│   ├── ui/                    # Shared design system components
│   └── config/                # eslint, tsconfig, tailwind config shared across packages
│
├── docs/                      # Architecture docs, contribution guide, theme authoring guide
└── examples/                  # Sample manuscripts (the "Quiet Hour" style demo book)
```

No `api/` or `render-service/` app — Electron's main process replaces both. It has direct filesystem and SQLite access (no API layer needed) and can drive its own hidden `BrowserWindow` for PDF rendering (no separate render worker needed).

**Why a shared `document-model` package still matters most:** every input format (Markdown, HTML, DOCX, EPUB) and every output format (PDF, EPUB, HTML) should convert to and from one canonical representation. That's what keeps "preview matches export" true even as you add formats — you're never maintaining N×M converters, just N importers and M exporters against one model. This doesn't change with the desktop shift; if anything it matters more, since there's no server to patch independently of a shipped app version.

**Project bundle format:** each book is a folder (e.g. `my-book.manuscript/`) containing `manuscript.json` (metadata + document), `assets/` (images, covers, and embedded Google fonts), and `brand-kit.json`. That makes projects portable, git-friendly, and syncable through any file-sync tool without needing your own sync service.

## Roadmap

### Phase 0 — Foundations

- Monorepo scaffolding, shared design system, canonical document model schema
- Define the page-break/divider syntax for both Markdown (`---` / `----`) and HTML (`<!-- page-break -->`)
- CI: lint, typecheck, visual regression tests on the render service

### Phase 1 — MVP: write, design, publish

- Markdown & HTML editor with live paginated preview (paged.js inside Electron's renderer)
- PDF export via a hidden `BrowserWindow` using the same CSS as the preview
- EPUB export (reflowable, covers, embedded fonts) and HTML export (standalone web-publish bundle)
- Brand Kits: fonts, colors, margins, page backgrounds; searchable Google/system font picker with Google Fonts embedded for export
- Front/back cover upload, page backgrounds
- Projects saved as local folder bundles
- Basic installer for macOS + Windows (electron-builder, unsigned is fine for early builds)

### Phase 2 — Import & asset management

- DOCX import (mammoth.js pipeline)
- EPUB import (round-trip editing)
- Asset library: images, fonts, covers scoped per project or account

### Phase 3 — Metadata & multi-mode preview

- Book metadata (title, author, ISBN, description) for publishing settings
- Three preview modes: Book (paginated), Web, EPUB (reflowable)
- Table of contents generation, headers/footers, page numbering rules

### Phase 4 — Distribution & community

- Signed, notarized installers for macOS/Windows + Linux packages (AppImage, deb)
- Auto-update via electron-updater against GitHub Releases
- Theme/Brand Kit authoring guide + community theme gallery
- Plugin points for custom exporters or importers

Note: combining formerly-separate phases 1–3 means the MVP is now heavier — HTML input, Brand Kits, and all three export formats ship together instead of landing incrementally. Worth revisiting scope here if you want a faster first release; a leaner MVP would be Markdown-only + PDF export + one default theme, with everything else in the list above pushed to Phase 2.

## Open decisions to make before Phase 0

- **Per-book format lock or mixed?** Recommend locking Markdown vs HTML per book at creation, matching the canonical-model approach above.
- **License** — MIT/Apache-2.0 keep it maximally reusable; AGPL if you want to prevent closed-source SaaS forks (less relevant now with no server component to protect, but still governs desktop forks).
- **Code signing costs** — Apple notarization (~$99/yr developer account) and a Windows code-signing cert are the two real recurring costs of a "real" desktop distribution; unsigned builds work for early adopters but trigger OS warnings.
- **Sync/collaboration later?** Local-first with folder bundles leaves the door open to add optional cloud sync (e.g. an opt-in server) without redesigning the core app — worth keeping in mind but not a Phase 0–6 concern.
