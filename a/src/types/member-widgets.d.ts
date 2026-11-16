import type { DetailedHTMLProps, HTMLAttributes } from 'react';
type El<P = {}> = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & P;
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'member-orders': El;
      'member-profile': El;
      'member-order-detail': El<{ 'order-id': string }>;
    }
  }
}

declare global {
  interface Window {
    /** C 的 widget 寫入的 debug 資訊（PLAN §13.3）。A 只讀取，不 import C 的程式碼。 */
    __memberWidgets?: { mounted: number; version: string };
  }
}
