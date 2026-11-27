import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// "~" = this app, "@" = shared logic from the main web app (../src),
// e.g. the roadmap generator used by the "roadmap" canvas.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./src', import.meta.url)),
      '@': fileURLToPath(new URL('../src', import.meta.url)),
    },
  },
  server: { host: true, port: 5174, fs: { allow: ['..'] } },
});
