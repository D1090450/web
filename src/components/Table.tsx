import React from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  PaginationState,
} from '@tanstack/react-table';
import {
  BiChevronsLeft,
  BiChevronLeft,
  BiChevronRight,
  BiChevronsRight
} from 'react-icons/bi';

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
    padding: '6px', border: '1px solid #dee2e6', backgroundColor: '#ffffff',
    borderRadius: '4px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#333740', 
  },
  paginationButtonDisabled: { cursor: 'not-allowed', opacity: 0.5, color: '#adb5bd' },
  paginationInput: {
    width: '50px', padding: '6px', border: '1px solid #dee2e6',
    borderRadius: '4px', textAlign: 'center',
  },
  paginationSelect: { padding: '6px', border: '1px solid #dee2e6', borderRadius: '4px' }
};

// 【主要變更點 1】: 重新定義 Props，以接收所有分頁和排序的狀態與控制器
interface TableProps<TData> {
  data: TData[];
  columns: ColumnDef<TData, any>[];
  pageCount: number;
  pagination: PaginationState;
  setPagination: React.Dispatch<React.SetStateAction<PaginationState>>;
  sorting: SortingState;
  setSorting: React.Dispatch<React.SetStateAction<SortingState>>;
}

/**
 * 支援伺服器端分頁和排序的可重用表格元件
 * @param {TableProps<TData>} props
 */
export const Table = <TData extends object>({
  data,
  columns,
  pageCount,
  pagination,
  setPagination,
  sorting,
  setSorting,
}: TableProps<TData>) => {
  
  // 移除元件內部的 state，因為現在由父元件 (透過 useGristData Hook) 控制

  const table = useReactTable({
    data,
    columns,
    pageCount: pageCount, // 傳入計算好的總頁數
    state: {
      sorting,
      pagination,
    },
    // 【主要變更點 2】: 重新啟用手動模式
    manualPagination: true,
    manualSorting: true,
    // 將狀態變更事件回傳給父元件
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    // 只需要核心模型，因為分頁和排序都在伺服器端處理
    getCoreRowModel: getCoreRowModel(), 
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
                    {flexRender(header.column.columnDef.header, header.getContext())}
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
        {/* 【主要變更點 3】: 恢復功能齊全的分頁 UI */}
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
                                <BiChevronsLeft size={18} />
                            </button>
                            <button
                                style={{ ...styles.paginationButton, ...( !table.getCanPreviousPage() && styles.paginationButtonDisabled) }}
                                onClick={() => table.previousPage()}
                                disabled={!table.getCanPreviousPage()}
                            >
                                <BiChevronLeft size={18} />
                            </button>
                            <button
                                style={{ ...styles.paginationButton, ...( !table.getCanNextPage() && styles.paginationButtonDisabled) }}
                                onClick={() => table.nextPage()}
                                disabled={!table.getCanNextPage()}
                            >
                                <BiChevronRight size={18} />
                            </button>
                            <button
                                style={{ ...styles.paginationButton, ...( !table.getCanNextPage() && styles.paginationButtonDisabled) }}
                                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                                disabled={!table.getCanNextPage()}
                            >
                                <BiChevronsRight size={18} />
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