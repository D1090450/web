import React from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from '@tanstack/react-table';

// --- 樣式定義 (新增了分頁控制項的樣式) ---
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
  paginationInput: {
    width: '50px',
    padding: '6px',
    border: '1px solid #dee2e6',
    borderRadius: '4px',
    textAlign: 'center',
  },
  paginationSelect: {
    padding: '6px',
    border: '1px solid #dee2e6',
    borderRadius: '4px',
  }
};

/**
 * 支援伺服器端分頁和排序的可重用表格組件
 * @param {{
 *   data: any[],
 *   columns: any[],
 *   pageCount: number,
 *   pagination: { pageIndex: number, pageSize: number },
 *   setPagination: (updater: any) => void,
 *   sorting: any[],
 *   setSorting: (updater: any) => void
 * }} props
 */
export const Table = ({
  data,
  columns,
  pageCount,
  pagination,
  setPagination,
  sorting,
  setSorting,
}) => {

  const table = useReactTable({
    data,
    columns,
    pageCount: pageCount, // 總頁數
    state: {
      pagination,
      sorting,
    },
    // --- 【主要變更點 1】: 啟用手動模式 ---
    manualPagination: true,
    manualSorting: true,
    // 當狀態改變時，調用從 Hook 傳來的 setter 函數
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
        {/* --- 【主要變更點 2】: 新增分頁控制 UI --- */}
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
                                        table.setPageIndex(page);
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