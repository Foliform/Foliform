import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      // Native modules (anything shipping a compiled .node binary) must stay
      // real runtime require() calls, not get bundled into main.js by
      // Rollup — a native binary can't be inlined as JS. Add any other
      // native dependency here if one gets pulled in later.
      external: ['better-sqlite3', 'electron'],
    },
  },
});
