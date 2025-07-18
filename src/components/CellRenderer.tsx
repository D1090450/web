import React from 'react';
// 从 @tanstack/react-table 导入 CellContext 类型
import { CellContext } from '@tanstack/react-table';
import { validateAndFormatCell } from '../utils/validation'; // 确保路径正确

// 定义我们将在 meta 中传递的数据的类型
// 这有助于确保我们在 useGristData Hook 中设置的 meta 与这里读取的一致
interface CellMeta {
    columnType: string;
}

// 定义组件的 Props 类型
// CellContext 是一个泛型，第一个参数是表格数据行的类型，第二个是单元格值的类型
// 使用 any, any 可以让它足够通用
interface CellRendererProps {
    info: CellContext<any, any>;
}

/**
 * 一个通用的单元格渲染器，能验证数据格式并应用条件化样式。
 * @param {CellRendererProps} props - 由 TanStack Table 的 info 对象传递而来。
 */
export const CellRenderer: React.FC<CellRendererProps> = ({ info }) => {
    // 从 TanStack Table 的 cell context 中获取值和元数据
    const value = info.getValue();
    
    // 从 meta 中安全地读取 columnType，如果不存在则默认为 'Any'
    const columnType = (info.column.columnDef.meta as CellMeta)?.columnType || 'Any';

    // 调用我们的验证和格式化工具函数
    const { content, isValid } = validateAndFormatCell(value, columnType);

    // 如果数据格式无效，则应用红色字体样式
    const style: React.CSSProperties = isValid 
        ? {} 
        : { color: '#dc3545', fontWeight: 500 }; // fontWeight 在 CSSProperties 中是数字或字符串

    return <span style={style}>{content}</span>;
};

export default CellRenderer;