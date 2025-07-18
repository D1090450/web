import { formatTimestamp } from './formatTimestamp'; // 确保路径正确

// 定义一个基础类型，代表 Grist 栏位的类型字符串
export type GristType =
    | 'Int'
    | 'Numeric'
    | 'Text'
    | 'Any'
    | string; // 使用 string 来涵盖 "DateTime:Asia/Taipei", "Ref:Table" 等情况

/**
 * 检查一个值是否符合 Grist 中定义的类型。
 * @param {any} value - 要验证的值。
 * @param {GristType} type - Grist 的字段类型字符串。
 * @returns {boolean} - 如果值符合类型则返回 true，否则返回 false。
 */
export const isTypeValid = (value: any, type: GristType): boolean => {
    // 如果值是 null 或 undefined，我们视为有效（代表空值）
    if (value == null) {
        return true;
    }

    // 根据类型进行验证
    switch (type) {
        case 'Int':
            return Number.isInteger(value);
        case 'Numeric':
            return typeof value === 'number' && !isNaN(value);
        case 'Any': 
        case 'Text':
            return typeof value !== 'object' || value === null;
        default:
            if (type.startsWith('DateTime') || type.startsWith('Date')) {
                return typeof value === 'number' && !isNaN(value);
            }
            if (type.startsWith('Ref:')) {
                // 引用类型通常是数字 (row ID)
                return typeof value === 'number';
            }
            // 对于其他未知或复杂类型，暂时先视为有效
            return true;
    }
};

/**
 * 验证并格式化一个单元格的值，返回用于渲染的内容和样式。
 * @param {any} value - 单元格的原始值。
 * @param {GristType} columnType - Grist 字段的类型。
 * @returns {{ content: string, isValid: boolean }} - 返回一个包含内容和有效性标志的对象。
 */
export const validateAndFormatCell = (
    value: any,
    columnType: GristType
): { content: string; isValid: boolean } => {
    const isValid = isTypeValid(value, columnType);
    let content = '';

    if (value == null) {
        return { content: '', isValid: true };
    }
    
    // 如果格式有效，则进行特殊格式化
    if (isValid) {
        if (columnType.startsWith('DateTime') || columnType.startsWith('Date')) {
            content = formatTimestamp(value as number); // 明确告知 TypeScript 这是一个数字
        } else if (typeof value === 'object') {
            content = JSON.stringify(value);
        } else {
            content = String(value);
        }
    } else {
        // 如果格式无效，无论原始值是什么，都强制转为字符串显示
        content = String(value);
    }

    return {
        content,
        isValid,
    };
};