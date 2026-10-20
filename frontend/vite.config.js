import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://localhost:5000',
                changeOrigin: true,
            },
        },
        watch: {
            // Windows can hold an exclusive lock on image assets under `public/`. Chokidar turns that
            // into an `EBUSY` FSWatcher error, which is an unhandled 'error' event and takes the whole
            // dev server down with it. `public/` is served statically and never participates in the
            // module graph, so there is nothing there worth watching; editing one of those images now
            // needs a manual refresh instead of an automatic reload.
            ignored: ['**/public/**'],
        },
    },
    test: {
        environment: 'jsdom',
        setupFiles: './src/tests/setup.ts',
        globals: true,
        css: false,
    },
});
