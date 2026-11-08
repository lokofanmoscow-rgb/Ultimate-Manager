import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Emit a classic (non-module) script so the game loads reliably inside Android WebView
const classicScript = (): Plugin => ({
  name: 'classic-script',
  enforce: 'post',
  transformIndexHtml(html) {
    return html
      .replace(/<script type="module" crossorigin src="([^"]+)"><\/script>/g, '')
      .replace(/<link rel="stylesheet" crossorigin href="([^"]+)">/g, '<link rel="stylesheet" href="$1">')
      .replace('</body>', '');
  },
  generateBundle(_, bundle) {
    const html = bundle['index.html'] as any;
    const js = Object.keys(bundle).find((k) => k.endsWith('.js'));
    if (html && js) html.source = String(html.source).replace('</html>', '').trimEnd() + `\n  <script defer src="./${js}"></script>\n</body>\n</html>\n`;
  },
});

export default defineConfig({
  base: './',
  plugins: [react(), classicScript()],
  build: {
    outDir: '../android/app/src/main/assets/www',
    emptyOutDir: true,
    target: 'es2019',
    modulePreload: false,
    chunkSizeWarningLimit: 4000,
    assetsInlineLimit: 0,
    rollupOptions: { output: { format: 'iife', inlineDynamicImports: true } },
  },
  server: { host: true, port: 5173 },
});
