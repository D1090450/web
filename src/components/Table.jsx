import React from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from '@tanstack/react-table';

// --- 樣式定義 (保持不變) ---
const styles = {
  tableContainer: { marginTop: '30px', overflowX: 'auto', border: '1px solid #dee2e6', borderRadius: '6px' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '14px' },
  th: {
    backgroundColor: '#e9ecef', padding: '14px 12px', textAlign: 'left',
    color: '#333740', fontWeight: '600', borderBottom: '2px solid #dee2e6',
    cursor: 'pointer', userSelect: 'none',
    display: 'flex', alignItems: 'center', gap: '4px',
  },
  td: { padding: '12px', whiteSpace: 'nowrap', color: '#555e6d', borderBottom: '1px solid #dee2e6' },
  sortIcon: { fontSize: '12px', opacity: 0.8 },
  paginationContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px',
    flexWrap: 'wrap',
    gap: '16px',
  },
  paginationControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  paginationButton: {
    padding: '6px 10px',
    border: '1px solid #dee2e6',
    backgroundColor: '#ffffff',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  paginationButtonDisabled: {
    cursor: 'not-allowed',
    opacity: 0.5,
  },
  paginationSelect: {
    padding: '6px',
    border: '1px solid #dee2e6',
    borderRadius: '4px',
  }
};

/**
 * 支援伺服器端游標分頁和排序的可重用表格組件
 * @param {{
 *   data: any[],
 *   columns: any[],
 *   hasNextPage: boolean, // 【主要變更點 1】: 新的 prop
 *   pagination: { pageIndex: number, pageSize: number },
 *   setPagination: (updater: any) => void,
 *   sorting: any[],
 *   setSorting: (updater: any) => void
 * }} props
 */
export const Table = ({
  data,
  columns,
  hasNextPage,
  pagination,
  setPagination,
  sorting,
  setSorting,
}) => {

  const table = useReactTable({
    data,
    columns,
    // 移除 pageCount，因為我們不知道總頁數
    state: {
      pagination,
      sorting,
    },
    manualPagination: true,
    manualSorting: true,
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
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
                      {{ asc: '▲', desc: '▼' }[header.column.getIsSorted()] ?? null}
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
        {/* --- 【主要變更點 2】: 簡化分頁控制 UI --- */}
        <tfoot>
            <tr>
                <td colSpan={columns.length} style={{ padding: 0 }}>
                    <div style={styles.paginationContainer}>
                        <div style={styles.paginationControls}>
                            {/* 移除了跳至第一頁和最後一頁的按鈕 */}
                            <button
                                style={{ ...styles.paginationButton, ...( !table.getCanPreviousPage() && styles.paginationButtonDisabled) }}
                                onClick={() => table.previousPage()}
                                disabled={!table.getCanPreviousPage()}
                            >
                                {'< 上一頁'}
                            </button>
                            <button
                                style={{ ...styles.paginationButton, ...( !hasNextPage && styles.paginationButtonDisabled) }}
                                onClick={() => table.nextPage()}
                                disabled={!hasNextPage} // 使用 hasNextPage 控制
                            >
                                {'下一頁 >'}
                            </button>
                        </div>
                        <div style={styles.paginationControls}>
                            <span>
                                第{' '}
                                <strong>
                                    {table.getState().pagination.pageIndex + 1}
                                </strong>
                                {' '}頁
                            </span>
                        </div>
                        <div style={styles.paginationControls}>
                             <select
                                style={styles.paginationSelect}
                                value={table.getState().pagination.pageSize}
                                onChange={e => {
                                    // 當 page size 改變時，回到第一頁
                                    table.setPageIndex(0);
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