import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// WebXR only works in a secure context, so the dev server runs over HTTPS
// with a self-signed cert and listens on your LAN so the Quest can reach it.
export default defineConfig({
  // Relative base so the built site works at https://<user>.github.io/<repo>/
  base: './',
  plugins: [basicSsl()],
  server: {
    host: true,
    port: 5173,
  },
  build: {
    // A-Frame (with three.js) is ~1.3 MB on its own; don't warn about it.
    chunkSizeWarningLimit: 2000,
  },
  preview: {
    host: true,
    port: 4173,
  },
});
