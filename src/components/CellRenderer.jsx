import React from 'react';
import { validateAndFormatCell } from '../utils/validation'; // 確保路徑正確

/**
 * 一個通用的儲存格渲染器，能驗證數據格式並應用條件化樣式。
 * @param {object} props - 由 TanStack Table 的 info 物件傳遞而來。
 */
export const CellRenderer = ({ info }) => {
    // 從 TanStack Table 的 cell context 中獲取值和元數據
    const value = info.getValue();
    
    // 我們將在下一步的 useGristData Hook 中，將欄位類型儲存在 meta.columnType 中
    const columnType = info.column.columnDef.meta?.columnType || 'Any';

    // 調用我們的驗證和格式化工具函數
    const { content, isValid } = validateAndFormatCell(value, columnType);

    // 如果數據格式無效，則應用紅色字體樣式
    const style = isValid ? {} : { color: '#dc3545', fontWeight: '500' };

    return <span style={style}>{content}</span>;
};

export default CellRenderer;