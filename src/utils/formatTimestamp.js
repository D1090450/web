/**
 * 將 Unix timestamp 格式化為 'YYYY-MM-DD HH:mm:ss' 格式的字串。
 * @param {any} timestamp - 期望是以秒為單位的 Unix timestamp。
 * @returns {string | {error: true, value: any}} 
 *          - 成功時返回格式化後的日期字串。
 *          - 失敗時返回一個包含錯誤標記和原始值的物件。
 */
export const formatTimestamp = (timestamp) => {
    if (timestamp == null || typeof timestamp !== 'number') {
        return { error: true, value: timestamp };
    }

    const date = new Date(timestamp * 1000);

    if (isNaN(date.getTime())) {
        return { error: true, value: timestamp };
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