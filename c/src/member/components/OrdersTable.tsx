// 訂單列表（PLAN §13.5）：篩選列 + TanStack Table v9（manualSorting、manualPagination）+ 分頁。
// 查詢條件只存在元件內，不寫進網址（元件不碰 router）。
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createColumnHelper,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type PaginationState,
  type SortingState,
  type Updater,
} from '@tanstack/react-table';
import { useMemo, useState, type KeyboardEvent } from 'react';
import { useForm } from 'react-hook-form';
import { isApiError, useOrders } from '../api';
import { LoginRequired } from '../LoginRequired';
import { DEFAULT_ORDER_FILTER, orderFilterSchema, type OrderFilter, type OrderQuery, type OrderSort } from '../schemas';
import { ORDER_STATUSES, STATUS_LABELS, type OrderSummary } from '../types';
import {
  Field,
  formatDateTime,
  formatMoney,
  inputClass,
  LoadError,
  Loading,
  primaryButton,
  secondaryButton,
  StatusBadge,
} from '../ui';

const PAGE_SIZE = 10;
const features = tableFeatures({ rowSortingFeature, rowPaginationFeature });
const helper = createColumnHelper<typeof features, OrderSummary>();
const columns = helper.columns([
  helper.accessor('id', {
    header: '訂單編號',
    enableSorting: false,
    cell: (info) => <span className="font-mono text-xs">{info.getValue()}</span>,
  }),
  helper.accessor('createdAt', { header: '日期', cell: (info) => formatDateTime(info.getValue()) }),
  helper.accessor('status', { header: '狀態', cell: (info) => <StatusBadge status={info.getValue()} /> }),
  helper.accessor('firstItemName', {
    header: '品項',
    enableSorting: false,
    cell: (info) => {
      const { firstItemName, itemCount } = info.row.original;
      return itemCount > 1 ? `${firstItemName} 等 ${itemCount} 件` : firstItemName;
    },
  }),
  helper.accessor('total', {
    header: '金額',
    cell: (info) => formatMoney(info.getValue()),
  }),
]);
const emptyRows: OrderSummary[] = [];
const RIGHT_ALIGNED = new Set(['total']); // 金額靠右
const DEFAULT_SORTING: SortingState = [{ id: 'createdAt', desc: true }];

const apply = <T,>(updater: Updater<T>, prev: T): T =>
  typeof updater === 'function' ? (updater as (old: T) => T)(prev) : updater;

export function OrdersTable({ onSelect }: { onSelect(id: string): void }) {
  const [filter, setFilter] = useState<OrderFilter>(DEFAULT_ORDER_FILTER);
  const [sorting, setSorting] = useState<SortingState>(DEFAULT_SORTING);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: PAGE_SIZE });

  const query: OrderQuery = useMemo(() => {
    const s = sorting[0] ?? DEFAULT_SORTING[0];
    return {
      ...filter,
      sort: s.id as OrderSort,
      order: s.desc ? 'desc' : 'asc',
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
    };
  }, [filter, sorting, pagination]);

  const result = useOrders(query);

  const table = useTable({
    features,
    columns,
    data: result.data?.items ?? emptyRows,
    rowCount: result.data?.total ?? 0,
    getRowId: (row) => row.id,
    manualSorting: true,
    manualPagination: true,
    enableSortingRemoval: false, // 再點一次只換方向，不會取消排序
    state: { sorting, pagination },
    onSortingChange: (updater) => {
      setSorting((prev) => apply(updater, prev));
      setPagination((p) => ({ ...p, pageIndex: 0 })); // 換排序回到第 1 頁
    },
    onPaginationChange: (updater) => setPagination((prev) => apply(updater, prev)),
  });

  const form = useForm<OrderFilter>({ resolver: zodResolver(orderFilterSchema), defaultValues: DEFAULT_ORDER_FILTER });
  const { errors } = form.formState;

  const applyFilter = (next: OrderFilter) => {
    setFilter({ ...next, q: next.q.trim() });
    setPagination((p) => ({ ...p, pageIndex: 0 })); // 換篩選回到第 1 頁
  };
  const clearFilter = () => {
    form.reset(DEFAULT_ORDER_FILTER);
    applyFilter(DEFAULT_ORDER_FILTER);
    void result.refetch();
  };

  if (isApiError(result.error, 401)) return <LoginRequired />;

  const total = result.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pagination.pageSize));
  const onRowKey = (e: KeyboardEvent, id: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSelect(id);
    }
  };

  return (
    <div className="space-y-4 text-sm text-slate-900">
      <form
        noValidate
        onSubmit={form.handleSubmit(applyFilter)}
        className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-5"
      >
        <Field label="狀態" error={errors.status?.message}>
          <select {...form.register('status')} className={inputClass}>
            <option value="">全部</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="開始日期" error={errors.from?.message}>
          <input type="date" {...form.register('from')} className={inputClass} />
        </Field>
        <Field label="結束日期" error={errors.to?.message}>
          <input type="date" {...form.register('to')} className={inputClass} />
        </Field>
        <Field label="關鍵字" error={errors.q?.message}>
          <input type="search" placeholder="訂單編號或品名" {...form.register('q')} className={inputClass} />
        </Field>
        <div className="col-span-2 flex items-end gap-2 md:col-span-1">
          <button type="submit" className={primaryButton}>
            查詢
          </button>
          <button type="button" onClick={clearFilter} className={secondaryButton}>
            清除
          </button>
        </div>
      </form>

      {result.isPending ? (
        <Loading rows={5} />
      ) : result.isError && !result.data ? (
        <LoadError onRetry={() => void result.refetch()} />
      ) : (
        <div className={result.isFetching ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="w-full border-collapse">
              <thead className="bg-slate-50 text-left text-xs text-slate-600">
                {table.getHeaderGroups().map((group) => (
                  <tr key={group.id}>
                    {group.headers.map((header) => {
                      const right = RIGHT_ALIGNED.has(header.column.id);
                      const sorted = header.column.getIsSorted();
                      const label = <table.FlexRender header={header} />;
                      return (
                        <th
                          key={header.id}
                          scope="col"
                          aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined}
                          className={`border-b border-slate-200 px-3 py-2 font-semibold ${right ? 'text-right' : ''}`}
                        >
                          {header.column.getCanSort() ? (
                            <button
                              type="button"
                              onClick={header.column.getToggleSortingHandler()}
                              className="inline-flex items-center gap-1 hover:text-zone"
                            >
                              {label}
                              <span aria-hidden className="text-[10px]">
                                {sorted === 'asc' ? '▲' : sorted === 'desc' ? '▼' : '↕'}
                              </span>
                            </button>
                          ) : (
                            label
                          )}
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="px-3 py-8 text-center text-slate-500">
                      沒有符合條件的訂單
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => onSelect(row.original.id)}
                      onKeyDown={(e) => onRowKey(e, row.original.id)}
                      className="cursor-pointer border-b border-slate-100 last:border-b-0 hover:bg-zone/5 focus:bg-zone/10 focus:outline-none"
                    >
                      {row.getAllCells().map((cell) => (
                        <td
                          key={cell.id}
                          className={`px-3 py-2 ${RIGHT_ALIGNED.has(cell.column.id) ? 'text-right tabular-nums' : ''}`}
                        >
                          <table.FlexRender cell={cell} />
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className={secondaryButton}
            >
              上一頁
            </button>
            <span className="text-slate-600">
              第 {pagination.pageIndex + 1}／{pageCount} 頁，共 {total} 筆
            </span>
            <button type="button" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className={secondaryButton}>
              下一頁
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
