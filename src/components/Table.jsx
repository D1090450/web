import React from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
} from '@tanstack/react-table';

const styles = {
  tableContainer: { marginTop: '30px', overflowX: 'auto', border: '1px solid #dee2e6', borderRadius: '6px' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '14px' },
  th: {
    backgroundColor: '#e9ecef', padding: '14px 12px', textAlign: 'left',
    color: '#333740', fontWeight: '600', borderBottom: '2px solid #dee2e6',
    cursor: 'pointer', userSelect: 'none',
  },
  thContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  td: { padding: '12px', whiteSpace: 'nowrap', color: '#555e6d', borderBottom: '1px solid #dee2e6' },
  sortIcon: {
    fontSize: '12px',
    opacity: 0.8,
  },
  errorCell: {
    color: 'red',
    fontStyle: 'italic',
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
                    ...styles.th,
                    ...(header.id === 'id' && { position: 'sticky', left: 0, zIndex: 2, backgroundColor: '#e9ecef' }),
                  }}
                  onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
                >
                  <div style={styles.thContent}>
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
                  {/* --- 【修正點】: 徹底修正渲染邏輯 --- */}
                  {(() => {
                    const cellValue = flexRender(cell.column.columnDef.cell, cell.getContext());

                    // 1. 檢查是否是我們自訂的錯誤物件
                    if (cellValue && typeof cellValue === 'object' && cellValue.error === true) {
                      return <span style={styles.errorCell}>{String(cellValue.value ?? '')}</span>;
                    }

                    // 2. 檢查是否是有效的 React 元素 (JSX)
                    // 這個檢查現在放到了錯誤物件檢查之後
                    if (React.isValidElement(cellValue)) {
                      return cellValue;
                    }
                    
                    // 3. 檢查是否是其他普通物件類型
                    if (cellValue && typeof cellValue === 'object') {
                      return JSON.stringify(cellValue);
                    }
                    
                    // 4. 對於所有其他情況 (字串、數字、null、undefined)，轉為字串後渲染
                    return String(cellValue ?? '');
                  })()}
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