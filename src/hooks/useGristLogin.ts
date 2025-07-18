import { useCallback, useRef, useEffect } from 'react';

const GRIST_API_BASE_URL = 'https://tiss-grist.fcuai.tw';
const POLLING_INTERVAL = 2500; // 輪詢間隔，單位：毫秒

interface UseGristLoginProps {
  onSuccess: (apiKey: string) => void;
  onStatusUpdate: (message: string) => void;
}

interface UseGristLoginReturn {
  openLoginPopup: () => void;
  fetchKey: () => Promise<boolean>;
}

/**
 * 一個完全封裝了 Grist 登入和 API Key 獲取流程的自定義 Hook。
 * @param {UseGristLoginProps} props - Hook 的設定選項。
 * @returns {UseGristLoginReturn} - 返回觸發登入和手動獲取 Key 的函數。
 */
export const useGristLogin = ({ onSuccess, onStatusUpdate }: UseGristLoginProps): UseGristLoginReturn => {
    const popupRef = useRef<Window | null>(null);
    
    // 【主要修正點】: 將 NodeJS.Timeout 改為 number
    const pollingTimerRef = useRef<number | null>(null);

    const fetchKey = useCallback(async (isPolling: boolean = false): Promise<boolean> => {
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
                const errorMessage = error instanceof Error ? error.message : '未知錯誤';
                onStatusUpdate(`自動獲取失敗: ${errorMessage}`);
            }
            return false;
        }
    }, [onSuccess, onStatusUpdate]);

    const openLoginPopup = useCallback(() => {
        if (popupRef.current && !popupRef.current.closed) {
            popupRef.current.focus();
            return;
        }
        if (pollingTimerRef.current) {
            clearTimeout(pollingTimerRef.current);
        }
        const popup = window.open(`${GRIST_API_BASE_URL}/login`, 'GristLoginPopup', 'width=600,height=700');
        popupRef.current = popup;
        if (!popup) {
            onStatusUpdate("彈出視窗被阻擋，請允許彈出視窗後重試。");
            return;
        }
        onStatusUpdate('請在新視窗中登入...');
        const pollForApiKey = async () => {
            if (!popupRef.current || popupRef.current.closed) {
                onStatusUpdate('登入視窗已關閉。');
                popupRef.current = null;
                return;
            }
            const success = await fetchKey(true);
            if (success) {
                popupRef.current.close();
                popupRef.current = null;
            } else {
                // setTimeout 在瀏覽器中返回 number
                pollingTimerRef.current = window.setTimeout(pollForApiKey, POLLING_INTERVAL);
            }
        };
        pollingTimerRef.current = window.setTimeout(pollForApiKey, 1000);
    }, [fetchKey, onStatusUpdate]);

    useEffect(() => {
        return () => {
            if (pollingTimerRef.current) {
                clearTimeout(pollingTimerRef.current);
            }
            if (popupRef.current && !popupRef.current.closed) {
                popupRef.current.close();
            }
        };
    }, []);

    return { openLoginPopup, fetchKey };
};