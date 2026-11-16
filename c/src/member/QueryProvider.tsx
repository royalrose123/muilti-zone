import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { isApiError } from './api';

/** member 元件共用的 QueryClient 設定：4xx 不重試（401／404／400 重試也沒用），其他錯誤重試 1 次。 */
export function createMemberQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, err) => !(isApiError(err) && err.status < 500) && failureCount < 1,
        refetchOnWindowFocus: false,
        staleTime: 10_000,
      },
      mutations: { retry: false },
    },
  });
}

/** 可以傳入既有的 client（widget 共用一個）；沒傳就每個 Provider 自己建一個。 */
export function QueryProvider({ client, children }: { client?: QueryClient; children: ReactNode }) {
  const [own] = useState(() => client ?? createMemberQueryClient());
  return <QueryClientProvider client={client ?? own}>{children}</QueryClientProvider>;
}
