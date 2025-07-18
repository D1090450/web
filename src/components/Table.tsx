import React, { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  // 導入類型定義
  ColumnDef,
  SortingState,
  PaginationState,
} from '@tanstack/react-table';

// --- 樣式定義 (保持不變) ---
const styles: { [key: string]: React.CSSProperties } = {
  tableContainer: { marginTop: '30px', overflowX: 'auto', border: '1px solid #dee2e6', borderRadius: '6px' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '14px' },
  th: {
    backgroundColor: '#e9ecef', padding: '14px 12px', textAlign: 'left',
    color: '#333740', fontWeight: 600, borderBottom: '2px solid #dee2e6',
    cursor: 'pointer', userSelect: 'none',
    display: 'flex', alignItems: 'center', gap: '4px',
  },
  td: { padding: '12px', whiteSpace: 'nowrap', color: '#555e6d', borderBottom: '1px solid #dee2e6' },
  sortIcon: { fontSize: '12px', opacity: 0.8 },
  paginationContainer: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px', flexWrap: 'wrap', gap: '16px',
  },
  paginationControls: { display: 'flex', alignItems: 'center', gap: '8px' },
  paginationButton: {
    padding: '6px 10px', border: '1px solid #dee2e6', backgroundColor: '#ffffff',
    borderRadius: '4px', cursor: 'pointer',
  },
  paginationButtonDisabled: { cursor: 'not-allowed', opacity: 0.5 },
  paginationInput: {
    width: '50px', padding: '6px', border: '1px solid #dee2e6',
    borderRadius: '4px', textAlign: 'center',
  },
  paginationSelect: { padding: '6px', border: '1px solid #dee2e6', borderRadius: '4px' }
};

// 【主要變更點 1】: 定義元件的 Props 類型
// 我們使用泛型 TData 來讓這個表格元件可以接受任何類型的資料陣列
interface TableProps<TData> {
  data: TData[];
  columns: ColumnDef<TData, any>[];
}

/**
 * 支援客戶端分頁和排序的可重用表格元件
 * @param {TableProps<TData>} props
 */
export const Table = <TData extends object>({ data, columns }: TableProps<TData>) => {
  // 【主要變更點 2】: 為內部狀態提供明確的類型
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 50,
  });

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      pagination,
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div style={styles.tableContainer}>
      <table style={styles.table}>
        <thead>
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <th
                  key={header.id}
                  style={{
                    ...(header.id === 'id' && { position: 'sticky', left: 0, zIndex: 2, backgroundColor: '#e9ecef' }),
                    ...(header.column.getCanSort() === false && { display: 'table-cell' })
                  }}
                  onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
                >
                  <div style={styles.th}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                    <span style={styles.sortIcon}>
                      {{
                        asc: '▲',
                        desc: '▼',
                      }[header.column.getIsSorted() as string] ?? null}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row, index) => (
            <tr key={row.id} style={{ backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8f9fa' }}>
              {row.getVisibleCells().map(cell => (
                <td
                  key={cell.id}
                  style={{
                    ...styles.td,
                    ...(cell.column.id === 'id' && {
                        position: 'sticky', left: 0, zIndex: 1,
                        backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8f9fa',
                        borderRight: '1px solid #dee2e6'
                    })
                  }}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
            <tr>
                <td colSpan={columns.length} style={{ padding: 0 }}>
                    <div style={styles.paginationContainer}>
                        <div style={styles.paginationControls}>
                            <button
                                style={{ ...styles.paginationButton, ...( !table.getCanPreviousPage() && styles.paginationButtonDisabled) }}
                                onClick={() => table.setPageIndex(0)}
                                disabled={!table.getCanPreviousPage()}
                            >
                                {'<<'}
                            </button>
                            <button
                                style={{ ...styles.paginationButton, ...( !table.getCanPreviousPage() && styles.paginationButtonDisabled) }}
                                onClick={() => table.previousPage()}
                                disabled={!table.getCanPreviousPage()}
                            >
                                {'<'}
                            </button>
                            <button
                                style={{ ...styles.paginationButton, ...( !table.getCanNextPage() && styles.paginationButtonDisabled) }}
                                onClick={() => table.nextPage()}
                                disabled={!table.getCanNextPage()}
                            >
                                {'>'}
                            </button>
                            <button
                                style={{ ...styles.paginationButton, ...( !table.getCanNextPage() && styles.paginationButtonDisabled) }}
                                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                                disabled={!table.getCanNextPage()}
                            >
                                {'>>'}
                            </button>
                        </div>
                        <div style={styles.paginationControls}>
                            <span>
                                第{' '}
                                <strong>
                                    {table.getState().pagination.pageIndex + 1} / {table.getPageCount()} 頁
                                </strong>
                            </span>
                            <span>
                                | 跳至:
                                <input
                                    type="number"
                                    defaultValue={table.getState().pagination.pageIndex + 1}
                                    onChange={e => {
                                        const page = e.target.value ? Number(e.target.value) - 1 : 0;
                                        if (page >= 0 && page < table.getPageCount()) {
                                          table.setPageIndex(page);
                                        }
                                    }}
                                    style={styles.paginationInput}
                                />
                            </span>
                        </div>
                        <div style={styles.paginationControls}>
                             <select
                                style={styles.paginationSelect}
                                value={table.getState().pagination.pageSize}
                                onChange={e => {
                                    table.setPageSize(Number(e.target.value));
                                }}
                            >
                                {[10, 20, 50, 100].map(pageSize => (
                                    <option key={pageSize} value={pageSize}>
                                        每頁顯示 {pageSize} 筆
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </td>
            </tr>
        </tfoot>
      </table>
    </div>
  );
};

export default Table;