# Foliform documentation site

This folder contains the Docusaurus site for Foliform, the desktop app for
writing, designing, and publishing books. The public landing page introduces
the app; the **Documentation** link opens the task-based user guides.

## Run locally

From this folder, install dependencies and start the development server:

```bash
npm install
npm run start
```

## Build

```bash
npm run build
```

The static site is written to `build/`. To serve the production build locally,
run `npm run serve`.

## Site structure

- `docs/index.md` is the documentation home and reading guide.
- `docs/` contains the getting started guide, book creation guides, and
  Markdown and publishing references.
- `sidebars.ts` defines the guide navigation and its task groups.
- `src/pages/index.tsx` and `src/pages/index.module.css` define the public
  landing page.
- `docusaurus.config.ts` configures the site. Set `url` and `baseUrl` for the
  intended deployment before publishing.

See the [Docusaurus documentation](https://docusaurus.io/docs) for hosting and
deployment options.

## GitHub Pages deployment

The `Deploy documentation` GitHub Actions workflow builds this site and
publishes it to GitHub Pages after changes to `doc/` are merged into `main`.
The repository must have GitHub Pages configured to use **GitHub Actions** as
its build and deployment source. You can also start the workflow manually from
the Actions tab.

## Desktop releases

Push a version tag to build installers for Windows, macOS, and Linux and create
a GitHub release:

- Beta/pre-release: `v1.0.0-beta.1` (tags containing a hyphen are published as
  pre-releases).
- Stable/live release: `v1.0.0` (tags without a hyphen are published as
  regular releases).

The release workflow requires no publishing secret; its GitHub token publishes
the release assets.
