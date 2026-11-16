declare module '*.css?inline' {
  const css: string;
  export default css;
}

/** build 時間（ISO），由 vite.config.ts 的 define 注入。 */
declare const __WIDGET_VERSION__: string;
