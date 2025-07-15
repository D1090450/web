import { useCallback, useRef, useEffect } from 'react';

const GRIST_API_BASE_URL = 'https://tiss-grist.fcuai.tw';
const POLLING_INTERVAL = 500; // 輪詢間隔，單位：毫秒

/**
 * 一個完全封裝了 Grist 登入和 API Key 獲取流程的自定義 Hook。
 * @param {{
 *   onSuccess: (apiKey: string) => void,
 *   onStatusUpdate: (message: string) => void
 * }} props - Hook 的設定選項。
 * @property {(apiKey: string) => void} onSuccess - 當成功獲取到 API Key 時調用的回調函數，會傳入新的 Key。
 * @property {(message: string) => void} onStatusUpdate - 用於更新外部狀態消息的回調函數。
 * @returns {{ openLoginPopup: () => void, fetchKey: () => void }} - 返回觸發登入和手動獲取 Key 的函數。
 */
export const useGristLogin = ({ onSuccess, onStatusUpdate }) => {
    const popupRef = useRef(null);
    const pollingTimerRef = useRef(null);

    const fetchKey = useCallback(async (isPolling = false) => {
        if (!isPolling) {
            onStatusUpdate('正在嘗試獲取 API Key...');
        }

        try {
            const response = await fetch(`${GRIST_API_BASE_URL}/api/profile/apiKey`, {
                credentials: 'include',
                headers: { 'Accept': 'text/plain' }
            });

            const fetchedKey = await response.text();

            if (!response.ok || !fetchedKey || fetchedKey.includes('<') || fetchedKey.length < 32) {
                if (!isPolling) {
                    onStatusUpdate('自動獲取失敗，請確保您已在 Grist 頁面登入。');
                }
                return false; 
            }
            
            onSuccess(fetchedKey.trim());
            return true; 

        } catch (error) {
            if (!isPolling) {
                onStatusUpdate(`自動獲取失敗: ${error.message}`);
            }
            return false; 
        }
    }, [onSuccess, onStatusUpdate]);


    const openLoginPopup = useCallback(() => {
        if (popupRef.current && !popupRef.current.closed) {
            popupRef.current.focus();
            return;
        }

        clearTimeout(pollingTimerRef.current);

        const popup = window.open(`${GRIST_API_BASE_URL}/login`, 'GristLoginPopup', 'width=600,height=700');
        popupRef.current = popup;

        if (!popup) {
            onStatusUpdate("彈出視窗被阻擋，請允許彈出視窗後重試。");
            return;
        }
        
        onStatusUpdate('請在新視窗中登入...');

        const pollForApiKey = async () => {
            if (popup.closed) {
                onStatusUpdate('登入視窗已關閉。');
                popupRef.current = null;
                return;
            }

            const success = await fetchKey(true);

            if (success) {
                popup.close();
                popupRef.current = null;
            } else {
                pollingTimerRef.current = setTimeout(pollForApiKey, POLLING_INTERVAL);
            }
        };

        pollingTimerRef.current = setTimeout(pollForApiKey, 1000);

    }, [fetchKey, onStatusUpdate]);

    useEffect(() => {
        return () => {
            clearTimeout(pollingTimerRef.current);
            if (popupRef.current && !popupRef.current.closed) {
                popupRef.current.close();
            }
        };
    }, []);

    // 返回兩個函數：一個用於彈出視窗登入，一個用於手動觸發獲取
    return { openLoginPopup, fetchKey };
};