export interface Product { id: string; name: string; price: number; description: string }

export const PRODUCTS: readonly Product[] = [
  { id: '1', name: '機械鍵盤', price: 3200, description: '由 Zone B（Next 16）render 的商品頁。' },
  { id: '2', name: '人體工學滑鼠', price: 1800, description: '在同一個 zone 內切換商品是 client-side navigation。' },
  { id: '3', name: '4K 螢幕', price: 12900, description: '靜態資源都在 /shop-static 底下。' },
];
