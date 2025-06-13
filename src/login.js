import { useCallback, useRef, useEffect } from 'react';

// 從原檔案中引入常量，或者在這裡重新定義
const GRIST_API_BASE_URL = 'https://tiss-grist.fcuai.tw';

/**
 * 用於處理 Grist 登入彈出視窗和 API Key 輪詢的自定義 Hook。
 * 
 * @param {object} options - 選項物件
 * @param {() => Promise<boolean>} options.onFetchKeyAttempt - 一個函數，當被調用時會嘗試獲取 API Key。它應該返回一個表示是否成功的 Promise<boolean>。
 * @param {(message: string) => void} options.onStatusUpdate - 一個回調函數，用於更新外部組件的狀態消息。
 * @param {boolean} options.hasApiKey - 當前是否已存在 API Key。
 * @returns {{ openLoginPopup: () => void }} - 返回一個包含 openLoginPopup 函數的物件，用於觸發登入流程。
 */
export const login = ({ onFetchKeyAttempt, onStatusUpdate, hasApiKey }) => {
    const pollingTimerRef = useRef(null);
    const popupRef = useRef(null);

    // 清理函數：當 Hook 被卸載時，確保關閉彈出視窗並清除計時器
    useEffect(() => {
        return () => {
            clearTimeout(pollingTimerRef.current);
            if (popupRef.current && !popupRef.current.closed) {
                popupRef.current.close();
            }
        };
    }, []);

    const openLoginPopup = useCallback(() => {
        // 如果已有彈出視窗，先聚焦
        if (popupRef.current && !popupRef.current.closed) {
            popupRef.current.focus();
            return;
        }

        // 清除任何可能存在的舊計時器
        clearTimeout(pollingTimerRef.current);

        const popup = window.open(`${GRIST_API_BASE_URL}/login`, 'GristLoginPopup', 'width=600,height=700');
        popupRef.current = popup;

        if (!popup) {
            onStatusUpdate("彈出視窗被阻擋，請允許彈出視窗後重試。");
            return;
        }

        onStatusUpdate('請在新視窗中登入...');

        // 定義輪詢函數
        const pollForApiKey = async () => {
            // 如果彈出視窗被使用者手動關閉
            if (popup.closed) {
                // 只有在尚未獲取到 key 的情況下才更新狀態
                if (!hasApiKey) {
                    onStatusUpdate('登入視窗已關閉。');
                }
                popupRef.current = null;
                return; // 停止輪詢
            }

            // 嘗試獲取 API Key
            const success = await onFetchKeyAttempt();

            if (success) {
                // 成功後，關閉彈出視窗並停止輪詢
                popup.close();
                popupRef.current = null;
            } else {
                // 如果失敗，則在 2.5 秒後再次嘗試
                pollingTimerRef.current = setTimeout(pollForApiKey, 2500);
            }
        };

        // 在 1 秒後開始第一次輪詢
        pollingTimerRef.current = setTimeout(pollForApiKey, 1000);

    }, [onFetchKeyAttempt, onStatusUpdate, hasApiKey]);

    return { openLoginPopup };
};