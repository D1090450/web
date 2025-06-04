// src/GristDynamicSelectorViewer.jsx
import React, { useState, useCallback, useEffect, useRef } from 'react';

const GRIST_API_BASE_URL = 'https://tiss-grist.fcuai.tw';
const TARGET_ORG_DOMAIN = 'fcuai.tw';
const API_KEY_RETRY_INTERVAL = 3000; // 每3秒重試一次

const theme = { /* ... (theme object remains the same) ... */ };

// API Key 管理組件
const GristApiKeyManager = React.forwardRef(({ apiKey, onApiKeyUpdate, onStatusUpdate, initialAttemptFailed }, ref) => {
  const [localApiKey, setLocalApiKey] = useState(apiKey || '');
  const [isFetching, setIsFetching] = useState(false);
  const retryTimerRef = useRef(null); // 用於存儲定時器的引用

  const fetchKeyFromProfile = useCallback(async (isRetry = false) => {
    // 如果正在獲取，則不重複觸發
    if (isFetching && !isRetry) return; // 如果是手動重試，即使 isFetching 也執行

    setIsFetching(true);
    if (!isRetry) { // 只有在非自動重試時才立即更新狀態
        onStatusUpdate('正在從個人資料獲取 API Key...');
    }

    try {
      const response = await fetch(`${GRIST_API_BASE_URL}/api/profile/apiKey`, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Accept': 'text/plain' },
      });
      const responseText = await response.text();
      console.log('response from /api/profile/apiKey: ', responseText);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${responseText || '無法獲取 API Key'}`);
      }
      const fetchedKey = responseText.trim();
      if (!fetchedKey || fetchedKey.includes('<') || fetchedKey.length < 32) {
        throw new Error('獲取到的 API Key 似乎無效。');
      }
      setLocalApiKey(fetchedKey);
      onApiKeyUpdate(fetchedKey, true); // 第二個參數表示是自動獲取的成功
      onStatusUpdate('API Key 自動獲取成功！');
      clearTimeout(retryTimerRef.current); // 成功獲取後清除定時器
      return true; // 表示成功
    } catch (error) {
      console.error("Error fetching API key from profile (attempt):", error.message);
      if (!isRetry) { // 只有在非自動重試的失敗時才更新狀態，避免頻繁刷新狀態文本
        onStatusUpdate(`自動獲取 API Key 失敗: ${error.message}. 請確保您已登入 Grist。`);
      }
      onApiKeyUpdate('', false); // 第二個參數表示自動獲取失敗
      return false; // 表示失敗
    } finally {
      setIsFetching(false);
    }
  }, [onApiKeyUpdate, onStatusUpdate, isFetching]); // isFetching 加入依賴避免閉包問題

  const handleManualSubmit = () => {
    clearTimeout(retryTimerRef.current); // 手動設定時也清除定時器
    const trimmedKey = localApiKey.trim();
    if (trimmedKey) {
      onApiKeyUpdate(trimmedKey, false); // 手動設定的成功
      onStatusUpdate('手動輸入的 API Key 已設定。');
    } else {
      onStatusUpdate('請輸入有效的 API Key。');
    }
  };
  
  useEffect(() => {
    setLocalApiKey(apiKey || '');
  }, [apiKey]);

  // 組件掛載時以及 initialAttemptFailed 狀態改變時嘗試獲取 API Key
  useEffect(() => {
    // 如果已有 apiKey (可能來自 localStorage 且有效)，則不自動執行
    if (apiKey) {
        clearTimeout(retryTimerRef.current);
        return;
    }

    // 初始嘗試獲取
    fetchKeyFromProfile().then(success => {
        if (!success && initialAttemptFailed) { // 如果首次嘗試失敗，並且父組件允許開始重試
            // 啟動定時重試
            if (retryTimerRef.current) clearTimeout(retryTimerRef.current); // 清除舊的
            retryTimerRef.current = setTimeout(function zichzelf() {
                console.log("Retrying to fetch API key...");
                fetchKeyFromProfile(true).then(retrySuccess => { // 標記為重試
                    if (!retrySuccess && localStorage.getItem('gristLoginPopupOpen') === 'true') { // 只有在彈窗仍然打開時才繼續重試
                        retryTimerRef.current = setTimeout(zichzelf, API_KEY_RETRY_INTERVAL);
                    } else if (retrySuccess) {
                        localStorage.removeItem('gristLoginPopupOpen');
                    }
                });
            }, API_KEY_RETRY_INTERVAL);
        }
    });
    
    // 組件卸載時清除定時器
    return () => {
      clearTimeout(retryTimerRef.current);
    };
  }, [apiKey, fetchKeyFromProfile, initialAttemptFailed]); // 依賴 apiKey 和 fetchKeyFromProfile 和 initialAttemptFailed

  React.useImperativeHandle(ref, () => ({
    triggerFetchKeyFromProfile: () => {
        clearTimeout(retryTimerRef.current); // 手動觸發時，清除自動重試
        return fetchKeyFromProfile();
    },
    stopRetrying: () => { // 新增一個方法來停止重試
        clearTimeout(retryTimerRef.current);
    }
  }));

  return (
    <div style={{ /* ... (styles remain the same) ... */ }}>
      <h4 style={{ /* ... */ }}>API Key 管理</h4>
      <p style={{ /* ... */ }}>
        若要啟用 "自動獲取"，請先登入您的 Grist 實例 (<code>{GRIST_API_BASE_URL}</code>)。
        或從 Grist 個人資料頁面手動複製 API Key。
      </p>
      <input
        type="password"
        value={localApiKey}
        onChange={(e) => setLocalApiKey(e.target.value)}
        placeholder="在此輸入或貼上 Grist API Key"
        style={{ /* ... */ }}
      />
      <button onClick={handleManualSubmit} style={{ /* ... */ }}>
        設定手動 Key
      </button>
      {/* 我們不再需要這個按鈕，因為會自動嘗試 */}
      {/* <button onClick={fetchKeyFromProfile} disabled={isFetching} style={{ ... }}>
        {isFetching ? '正在獲取...' : '自動獲取 API Key'}
      </button> */}
    </div>
  );
});


function GristDynamicSelectorViewer() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gristApiKey') || '');
  // ... (other states) ...
  const [statusMessage, setStatusMessage] = useState('');
  const [currentOrgId, setCurrentOrgId] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState('');
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [tables, setTables] = useState([]);
  const [selectedTableId, setSelectedTableId] = useState('');
  const [isLoadingTables, setIsLoadingTables] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const [sortQuery, setSortQuery] = useState('');
  const [tableData, setTableData] = useState(null);
  const [columns, setColumns] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [dataError, setDataError] = useState('');


  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const apiKeyManagerRef = useRef(null);
  const gristLoginPopupRef = useRef(null); // 存儲彈出視窗的引用
  const [initialApiKeyAttemptFailed, setInitialApiKeyAttemptFailed] = useState(false); // 新狀態


  const handleApiKeyUpdate = useCallback((key, autoFetchedSuccess = false) => {
    setApiKey(key);
    if (key) {
      localStorage.setItem('gristApiKey', key);
      setShowLoginPrompt(false); // 獲取成功，隱藏提示
      setInitialApiKeyAttemptFailed(false); // 重置失敗標記

      // 如果是自動獲取成功並且彈出視窗存在，嘗試關閉它
      if (autoFetchedSuccess && gristLoginPopupRef.current && !gristLoginPopupRef.current.closed) {
        // 這裡的自動關閉可能並不可靠，因為 Grist 登入後可能跳轉了域名
        // 瀏覽器通常不允許一個視窗關閉不是由它自己打開的、且域名不同的視窗
        // 但如果 Grist 登入後跳回同源（例如 /app/login-success），則可能成功
        try {
            gristLoginPopupRef.current.close();
            localStorage.removeItem('gristLoginPopupOpen');
            console.log("Attempted to close Grist login popup.");
        } catch (e) {
            console.warn("Could not automatically close Grist login popup:", e);
            setStatusMessage("Grist 登入成功！您可以手動關閉登入視窗。");
        }
        gristLoginPopupRef.current = null; // 清除引用
      }
       if (autoFetchedSuccess) {
           setStatusMessage('API Key 自動獲取成功！'); // 這個訊息可能會覆蓋 GristApiKeyManager 的
       }

    } else if (!autoFetchedSuccess) { // 只有在非自動獲取成功的情況 (例如手動清除或初始失敗) 才顯示 prompt
      localStorage.removeItem('gristApiKey');
      setShowLoginPrompt(true);
      // 如果不是因為自動獲取循環導致的 key 為空，我們才標記初次嘗試失敗
      if (!localStorage.getItem('gristLoginPopupOpen')) { // 避免在彈窗打開時，因定時重試失敗而錯誤標記
          setInitialApiKeyAttemptFailed(true);
      }
    }
    // 清理相關狀態 (保持不變)
    setCurrentOrgId(null);
    setDocuments([]);
    setSelectedDocId('');
    // ... (rest of cleanup)
  }, []);

  // ... (makeGristApiRequest and data fetching useEffects remain the same) ...

  const openGristLoginPopup = () => {
    if (gristLoginPopupRef.current && !gristLoginPopupRef.current.closed) {
      gristLoginPopupRef.current.focus();
      return;
    }
    const loginUrl = `${GRIST_API_BASE_URL}/login`;
    gristLoginPopupRef.current = window.open(loginUrl, 'GristLoginPopup', 'width=600,height=700,scrollbars=yes,resizable=yes,noopener,noreferrer');
    localStorage.setItem('gristLoginPopupOpen', 'true'); // 標記彈窗已打開
    setStatusMessage('請在新視窗中完成 Grist 登入。本頁面將嘗試自動檢測登入狀態。');
    
    // 彈窗打開後，確保 GristApiKeyManager 中的重試邏輯被觸發 (如果之前沒有失敗過)
    // 或者，如果它已經在重試，則讓它繼續
    setInitialApiKeyAttemptFailed(true); // 觸發 GristApiKeyManager 的重試邏輯 (如果它監聽這個)
    if (apiKeyManagerRef.current) { // 如果需要，可以強制觸發一次
        // apiKeyManagerRef.current.triggerFetchKeyFromProfile();
    }

    // 監測彈窗是否被用戶手動關閉
    const checkPopupClosedInterval = setInterval(() => {
        if (gristLoginPopupRef.current && gristLoginPopupRef.current.closed) {
            clearInterval(checkPopupClosedInterval);
            localStorage.removeItem('gristLoginPopupOpen');
            gristLoginPopupRef.current = null;
            // 如果 API Key 仍未獲取，用戶可能放棄了登入
            if (!apiKey) {
                setStatusMessage('Grist 登入視窗已關閉。如果尚未登入，請重試。');
                // 可以在這裡選擇停止 GristApiKeyManager 的重試
                if (apiKeyManagerRef.current) {
                    apiKeyManagerRef.current.stopRetrying();
                }
                setInitialApiKeyAttemptFailed(false); // 重置，下次點擊按鈕時重新開始流程
            }
        }
    }, 1000);
  };

  // 初始加載時，如果 localStorage 中沒有 key，則標記初始嘗試可能失敗，以觸發 GristApiKeyManager 的邏輯
  useEffect(() => {
    if (!localStorage.getItem('gristApiKey') && !apiKey) {
      setInitialApiKeyAttemptFailed(true);
    }
  }, []); // 空依賴，僅執行一次


  return (
    <div style={{ /* ... (styles) ... */ }}>
      <h1 style={{ /* ... */ }}>Grist 數據動態選擇查看器</h1>
      <p style={{ /* ... */ }}>
        API 目標: <code>{GRIST_API_BASE_URL}</code> (目標組織域名: <code>{TARGET_ORG_DOMAIN || '未指定'}</code>)
      </p>

      {statusMessage && ( <p style={{ /* ... (status message styles) ... */ }}> {statusMessage} </p> )}

      <GristApiKeyManager
        ref={apiKeyManagerRef}
        apiKey={apiKey}
        onApiKeyUpdate={handleApiKeyUpdate}
        onStatusUpdate={setStatusMessage}
        initialAttemptFailed={initialApiKeyAttemptFailed} // 將此狀態傳遞給子組件
      />

      {showLoginPrompt && !apiKey && (
        <div style={{ /* ... (login prompt styles) ... */ }}>
          <p style={{ /* ... */ }}>
            您似乎尚未登入 Grist，或者 API Key 無法自動獲取。
          </p>
          <button onClick={openGristLoginPopup} style={{ /* ... */ }} >
            開啟 Grist 登入視窗
          </button>
          {/* “刷新/重試”按鈕可以移除，因為 GristApiKeyManager 會自動重試 */}
          {/* 如果確實需要一個手動觸發，可以保留，並調用 apiKeyManagerRef.current.triggerFetchKeyFromProfile() */}
        </div>
      )}

      {apiKey && ( <div style={{ /* ... (data source selection styles) ... */ }}> {/* ... (rest of the UI) ... */} </div> )}
      {/* ... (Table display and no-data message) ... */}
    </div>
  );
}

export default GristDynamicSelectorViewer;