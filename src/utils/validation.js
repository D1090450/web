import { formatTimestamp } from './formatTimestamp'; // 確保路徑正確

/**
 * 檢查一個值是否符合 Grist 中定義的類型。
 * @param {any} value - 要驗證的值。
 * @param {string} type - Grist 的欄位類型字串，例如 "Int", "Numeric", "DateTime:Asia/Taipei", "Text"。
 * @returns {boolean} - 如果值符合類型則返回 true，否則返回 false。
 */
export const isTypeValid = (value, type) => {
    // 如果值是 null 或 undefined，我們視為有效（代表空值）
    if (value == null) {
        return true;
    }

    // 根據類型進行驗證
    switch (type) {
        case 'Int':
            // 必須是整數
            return Number.isInteger(value);
        case 'Numeric':
            // 必須是數字 (可以是浮點數)
            return typeof value === 'number' && !isNaN(value);
        case 'Any': // 'Any' 類型永遠有效
        case 'Text':
            // 'Text' 類型幾乎總是有效的，除非它是一個複雜的物件
            return typeof value !== 'object' || value === null;
        default:
            // 處理帶有參數的類型，例如 DateTime, Date, Choice 等
            if (type.startsWith('DateTime') || type.startsWith('Date')) {
                // 對於日期類型，它必須是一個數字 (timestamp)
                return typeof value === 'number' && !isNaN(value);
            }
            if (type.startsWith('Ref:')) {
                // 引用類型通常是數字 (row ID)
                return typeof value === 'number';
            }
            // 對於其他未知或複雜類型，暫時先視為有效
            return true;
    }
};

/**
 * 驗證並格式化一個儲存格的值，返回用於渲染的內容和樣式。
 * @param {any} value - 儲存格的原始值。
 * @param {string} columnType - Grist 欄位的類型。
 * @returns {{ content: string, isValid: boolean }} - 返回一個包含內容和有效性標誌的物件。
 */
export const validateAndFormatCell = (value, columnType) => {
    const isValid = isTypeValid(value, columnType);
    let content = '';

    if (value == null) {
        return { content: '', isValid: true };
    }
    
    // 如果格式有效，則進行特殊格式化
    if (isValid) {
        if (columnType.startsWith('DateTime') || columnType.startsWith('Date')) {
            content = formatTimestamp(value);
        } else if (typeof value === 'object') {
            content = JSON.stringify(value);
        } else {
            content = String(value);
        }
    } else {
        // 如果格式無效，無論原始值是什麼，都強制轉為字串顯示
        content = String(value);
    }

    return {
        content,
        isValid,
    };
};