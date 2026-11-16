// C 的 member 元件打包成 Web Component（PLAN §13.5）。輸出給 A 用 <script type="module"> 載入。
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const cRoot = fileURLToPath(new URL('..', import.meta.url));

/**
 * 每次打包都重算 __WIDGET_VERSION__（PLAN §13.5）。寫在 define 裡的話，watch 模式下 config 只載入一次，
 * 版本號會停在第一次打包的時間。renderChunk 每次產出都會執行，所以在這裡換成當下的 ISO 時間。
 */
function widgetVersion(): Plugin {
  return {
    name: 'member-widgets:version',
    renderChunk(code) {
      if (!code.includes('__WIDGET_VERSION__')) return null;
      const version = new Date().toISOString();
      this.info(`__WIDGET_VERSION__ = ${version}`);
      return { code: code.replaceAll('__WIDGET_VERSION__', JSON.stringify(version)), map: null };
    },
  };
}

export default defineConfig({
  root: cRoot,
  publicDir: false, // 輸出就在 public/ 底下，不要把 public/ 再複製一次
  plugins: [react(), tailwindcss(), widgetVersion()],
  resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  build: {
    lib: {
      entry: fileURLToPath(new URL('./index.tsx', import.meta.url)),
      formats: ['es'],
      fileName: () => 'member-widgets.js',
    },
    outDir: fileURLToPath(new URL('../public/blog-static/widget', import.meta.url)),
    emptyOutDir: true,
    minify: true, // PLAN §13.5
    // Vite 8 在 lib + es 格式時把 oxc minify 設成 { compress, mangle, codegen: false }（保留空白），
    // build.minify: true 改不到這一層；要連空白一起壓縮，得在 rolldown 的 output 指定。
    rolldownOptions: { output: { minify: true } },
  },
});
