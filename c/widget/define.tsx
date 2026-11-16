// 共用的 Custom Element 外殼（PLAN §13.5 widget 第 1～5 點）。
import type { ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemberQueryClient, QueryProvider } from '@/member/QueryProvider';
import css from './widget.css?inline';

declare global {
  interface Window {
    __memberWidgets?: { mounted: number; version: string };
  }
}

/** 同一個頁面上的所有 widget 共用一個 QueryClient（快取共用，例如列表與詳細）。 */
const queryClient = createMemberQueryClient();

export function widgetDebug(): { mounted: number; version: string } {
  return (window.__memberWidgets ??= { mounted: 0, version: '' });
}

/**
 * `@property` 在 Shadow DOM 內不會生效，Tailwind 的 shadow-*、ring-* 等 utility 因此失效。
 * 第一次定義 widget 時把所有 @property 規則抽出來，插到 document.head 一次。
 */
function injectPropertyRules(): void {
  if (document.head.querySelector('style[data-member-widgets-properties]')) return;
  const rules = css.match(/@property\s*[^{]+\{[^}]*\}/g);
  if (!rules?.length) return;
  const style = document.createElement('style');
  style.setAttribute('data-member-widgets-properties', '');
  style.textContent = rules.join('\n');
  document.head.appendChild(style);
}

export function defineWidget(
  tag: string,
  render: (el: HTMLElement) => ReactNode,
  observedAttributes: readonly string[] = [],
): void {
  if (customElements.get(tag)) return; // 重複載入 script 時不重複定義
  injectPropertyRules();

  class MemberWidget extends HTMLElement {
    static get observedAttributes() {
      return [...observedAttributes];
    }

    #root: Root | null = null;
    #pendingUnmount = false;

    connectedCallback() {
      // 只是被搬動（disconnect 後馬上 connect）：取消卸載，沿用原本的 root
      if (this.#root) {
        this.#pendingUnmount = false;
        return;
      }
      const shadow = this.shadowRoot ?? this.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = css;
      const mountPoint = document.createElement('div');
      shadow.replaceChildren(style, mountPoint);
      this.#root = createRoot(mountPoint);
      this.#render();
      widgetDebug().mounted += 1;
    }

    attributeChangedCallback() {
      this.#render();
    }

    disconnectedCallback() {
      if (!this.#root) return;
      // 延到 microtask：A 的 React 正在 commit 時同步 unmount 另一個 root 會出警告；
      // 而且元件只是被搬動時，connectedCallback 會把它取消。
      this.#pendingUnmount = true;
      queueMicrotask(() => {
        if (!this.#pendingUnmount || !this.#root) return;
        this.#pendingUnmount = false;
        this.#root.unmount();
        this.#root = null;
        widgetDebug().mounted -= 1;
      });
    }

    #render() {
      this.#root?.render(<QueryProvider client={queryClient}>{render(this)}</QueryProvider>);
    }
  }

  customElements.define(tag, MemberWidget);
}
