/**
 * 將 Unix timestamp 格式化為 'YYYY-MM-DD HH:mm:ss' 格式的字串。
 * @param {number | null | undefined} timestamp - 以秒為單位的 Unix timestamp。
 * @returns {string} 格式化後的日期字串，如果輸入無效則返回空字串或'無效日期'。
 */
export const formatTimestamp = (timestamp) => {
    // 檢查輸入是否為有效的數字
    if (timestamp == null || typeof timestamp !== 'number') {
        return '';
    }

    // 將 Unix timestamp (假設是秒) 轉換為 JavaScript 需要的毫秒
    // 如果您的 timestamp 本身就是毫秒，請移除 "* 1000"
    const date = new Date(timestamp * 1000);

    // 檢查轉換後的日期是否有效
    if (isNaN(date.getTime())) {
        return '無效日期';
    }

    // 輔助函數，確保數字是兩位數 (例如 1 -> "01")
    const pad = (num) => String(num).padStart(2, '0');

    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1); // 月份是從 0 開始的
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};