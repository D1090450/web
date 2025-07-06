/**
 * 將 Unix timestamp 格式化為 'YYYY-MM-DD HH:mm:ss' 格式的字串。
 * 如果輸入無效，則會拋出一個錯誤。
 * @param {any} timestamp - 期望是以秒為單位的 Unix timestamp。
 * @returns {string} 格式化後的日期字串。
 * @throws {Error} 當 timestamp 不是有效的數字或無法轉換為有效日期時拋出。
 */
export const formatTimestamp = (timestamp) => {
    // 【主要變更點 1】: 嚴格檢查輸入類型
    if (timestamp == null || typeof timestamp !== 'number') {
        throw new Error("Invalid input: timestamp must be a number.");
    }

    // 將 Unix timestamp (假設是秒) 轉換為 JavaScript 需要的毫秒
    const date = new Date(timestamp * 1000);

    // 【主要變更點 2】: 檢查轉換後的日期是否有效
    if (isNaN(date.getTime())) {
        throw new Error("Invalid timestamp value: cannot be converted to a valid date.");
    }

    const pad = (num) => String(num).padStart(2, '0');

    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};