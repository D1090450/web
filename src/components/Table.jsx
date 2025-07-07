import React from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
} from '@tanstack/react-table';

// --- 【主要變更點 1】: 修改表頭樣式 ---
const styles = {
  tableContainer: { marginTop: '30px', overflowX: 'auto', border: '1px solid #dee2e6', borderRadius: '6px' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '14px' },
  th: {
    backgroundColor: '#e9ecef', padding: '14px 12px', textAlign: 'left',
    color: '#333740', fontWeight: '600', borderBottom: '2px solid #dee2e6',
    cursor: 'pointer', userSelect: 'none',
    // 讓表頭成為 Flex 容器
    display: 'flex',
    alignItems: 'center',
    gap: '4px', // 在標題和箭頭之間增加一點間距
  },
  td: { padding: '12px', whiteSpace: 'nowrap', color: '#555e6d', borderBottom: '1px solid #dee2e6' },
  // 為箭頭定義一個樣式
  sortIcon: {
    fontSize: '12px',
    opacity: 0.8,
  }
};

export const Table = ({ data, columns }) => {
  const [sorting, setSorting] = React.useState([]);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
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
                    // 覆蓋 flex 樣式，因為 id 欄位不需要點擊排序
                    ...(header.column.getCanSort() === false && { display: 'table-cell' })
                  }}
                  // 只有在可以排序時才添加 onClick
                  onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
                >
                  {/* --- 【主要變更點 2】: 調整渲染結構 --- */}
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
                      }[header.column.getIsSorted()] ?? null}
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
                        position: 'sticky',
                        left: 0,
                        zIndex: 1,
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
      </table>
    </div>
  );
};

export default Table;