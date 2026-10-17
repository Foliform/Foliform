import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config
export default defineConfig({
	plugins: [react()],
	// dictionary-en loads its .aff/.dic files with a top-level `await` (see
	// node_modules/dictionary-en/index.js). Electron's actual Chromium
	// runtime supports that fine, but Vite's dependency pre-bundler (esbuild)
	// defaults to an older target that rejects the syntax before the app ever
	// runs. Raising esbuild's target here — for dependency pre-bundling only,
	// not the final production build — fixes it without touching the
	// dependency itself.
	optimizeDeps: {
		esbuildOptions: {
			target: 'esnext',
		},
	},
	build: {
		target: 'esnext',
	},
});
