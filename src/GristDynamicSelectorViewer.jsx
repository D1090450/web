// src/GristDynamicSelectorViewer.jsx
import React, { useState, useCallback, useEffect, useRef } from 'react';

// ... (GRIST_API_BASE_URL, TARGET_ORG_DOMAIN, theme object remain the same) ...
const GRIST_API_BASE_URL = 'https://tiss-grist.fcuai.tw';
const TARGET_ORG_DOMAIN = 'fcuai.tw';
const theme = { /* ... */ };


const GristApiKeyManager = React.forwardRef(({ apiKey, onApiKeyUpdate, onStatusUpdate, initialAttempt = false }, ref) => {
  const [localApiKey, setLocalApiKey] = useState(apiKey || '');
  const [isFetching, setIsFetching] = useState(false);

  const fetchKeyFromProfile = useCallback(async (isRetry = false) => {
    if (isFetching && !isRetry && !initialAttempt) return; // 避免在非初始/非重試時重複觸發
    setIsFetching(true);
    // 根據是否重試更新狀態消息
    const statusMsg = isRetry ? '正在自動重試獲取 API Key...' : '正在從個人資料獲取 API Key...';
    onStatusUpdate(statusMsg);

    try {
      const response = await fetch(`${GRIST_API_BASE_URL}/api/profile/apiKey`, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Accept': 'text/plain' },
      });
      const responseText = await response.text();
      console.log('API Key fetch response: ', responseText.substring(0, 100) + '...');
      if (!response.ok) {
        // 重要: 將認證失敗的特定信號傳遞給父組件
        onApiKeyUpdate('', response.status === 401 || response.status === 403);
        throw new Error(`HTTP ${response.status}: ${responseText || '無法獲取 API Key'}`);
      }
      const fetchedKey = responseText.trim();
      if (!fetchedKey || fetchedKey.includes('<') || fetchedKey.length < 32) {
        onApiKeyUpdate(''); // Key 無效也算獲取失敗
        throw new Error('獲取到的 API Key 似乎無效。');
      }
      setLocalApiKey(fetchedKey);
      onApiKeyUpdate(fetchedKey); // 成功
      onStatusUpdate('API Key 自動獲取成功！');
    } catch (error) {
      console.error("Error fetching API key from profile:", error);
      onStatusUpdate(`獲取 API Key 失敗: ${error.message}.`);
      // 確保在 catch 中也調用 onApiKeyUpdate('')，如果之前未調用
      // 這裡的 onApiKeyUpdate 已經在 !response.ok 中處理了，除非 fetch 本身拋錯
      if (!(error.message.includes('HTTP 401') || error.message.includes('HTTP 403'))) {
         // 如果不是已知的認證錯誤，也標記為一般失敗
         if (apiKey) onApiKeyUpdate(''); // 如果之前有key，清空
      }
    } finally {
      setIsFetching(false);
    }
  }, [apiKey, onApiKeyUpdate, onStatusUpdate, initialAttempt]); // apiKey 移出，因為其變化由父組件控制

  const handleManualSubmit = () => { /* ... (remains the same) ... */ };
  useEffect(() => { setLocalApiKey(apiKey || ''); }, [apiKey]);

  useEffect(() => {
    if (initialAttempt && !apiKey && !localStorage.getItem('gristApiKey')) {
      console.log('GristApiKeyManager: Initial attempt to fetch API key via prop.');
      fetchKeyFromProfile(false); // false 表示不是重試
    }
  }, [initialAttempt, apiKey, fetchKeyFromProfile]);

  React.useImperativeHandle(ref, () => ({
    triggerFetchKeyFromProfile: (isRetry = false) => fetchKeyFromProfile(isRetry)
  }));

  return ( <div style={{ /* ... GristApiKeyManager JSX ... */ }}> {/* ... */} </div> );
});


function GristDynamicSelectorViewer() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gristApiKey') || '');
  const [statusMessage, setStatusMessage] = useState('正在初始化...');
  // ... (other states remain the same) ...
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


  const apiKeyManagerRef = useRef(null);
  const loginPopupRef = useRef(null);
  const retryTimerRef = useRef(null);
  const [isAttemptingLoginFlow, setIsAttemptingLoginFlow] = useState(false); // 新狀態：是否正在登入流程中

  const handleApiKeyUpdate = useCallback((key, fetchFailedDueToAuth = false) => {
    setApiKey(key);

    if (key) {
      localStorage.setItem('gristApiKey', key);
      setStatusMessage('API Key 已獲取成功！準備載入數據。');
      setIsAttemptingLoginFlow(false); // 成功獲取，結束登入流程標記
      clearTimeout(retryTimerRef.current); // 清除定時器
      retryTimerRef.current = null;

      if (loginPopupRef.current && !loginPopupRef.current.closed) {
        console.log('API Key 獲取成功，嘗試關閉登入彈窗...');
        try {
            loginPopupRef.current.close(); // 嘗試關閉
        } catch (e) {
            console.warn("無法自動關閉登入彈窗 (可能因跨域限制): ", e);
            setStatusMessage('API Key 獲取成功！請手動關閉 Grist 登入視窗。');
        }
        loginPopupRef.current = null;
      }
    } else {
      localStorage.removeItem('gristApiKey');
      if (fetchFailedDueToAuth && !isAttemptingLoginFlow) { // 只有在因為認證失敗且尚未啟動登入流程時
        setIsAttemptingLoginFlow(true); // 開始登入流程
        setStatusMessage('Grist 尚未登入或會話過期。將嘗試打開登入視窗並定時重試...');
        // 立即嘗試打開一次，並啟動定時器
        openGristLoginPopup(); // 嘗試打開彈窗
        if (!retryTimerRef.current) scheduleApiKeyRetry(); // 啟動定時重試
      } else if (!fetchFailedDueToAuth) {
        setStatusMessage('API Key 無法獲取。請檢查網路或手動輸入。');
        // 對於非認證錯誤，停止定時器 (如果正在運行)
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
        setIsAttemptingLoginFlow(false);
      }
      // 如果 isAttemptingLoginFlow 已經是 true，表示定時器已經在運行，這裡不需要重複啟動
    }
    // 清理相關狀態
    setCurrentOrgId(null);
    setDocuments([]);
    // ...
  }, [isAttemptingLoginFlow]); // 添加 isAttemptingLoginFlow

  const openGristLoginPopup = useCallback(() => {
    if (loginPopupRef.current && !loginPopupRef.current.closed) {
      try { loginPopupRef.current.focus(); } catch(e) { /* ignore focus error */ }
      console.log("登入彈窗已開啟。");
      return;
    }
    const loginUrl = `${GRIST_API_BASE_URL}/login`;
    console.log("嘗試打開 Grist 登入彈窗:", loginUrl);
    loginPopupRef.current = window.open(loginUrl, 'GristLoginPopup', 'width=600,height=700,scrollbars=yes,resizable=yes,noopener,noreferrer');
    if (!loginPopupRef.current) {
        setStatusMessage('無法打開 Grist 登入視窗，可能已被瀏覽器阻止。請檢查瀏覽器設定並嘗試手動登入 Grist。');
        setIsAttemptingLoginFlow(false); // 如果彈窗失敗，停止登入流程標記
        clearTimeout(retryTimerRef.current); // 並停止重試
        retryTimerRef.current = null;
    } else {
        setStatusMessage('已打開 Grist 登入視窗。系統將每 3 秒自動檢查登入狀態。');
    }
  }, []);

  const scheduleApiKeyRetry = useCallback(() => {
    clearTimeout(retryTimerRef.current); // 清除舊的
    
    retryTimerRef.current = setTimeout(() => {
      if (apiKey) { // 如果在這 3 秒內通過其他方式獲取到了 key
        setIsAttemptingLoginFlow(false);
        return;
      }
      
      console.log('定時器觸發: 嘗試獲取 API Key...');
      if (apiKeyManagerRef.current) {
        apiKeyManagerRef.current.triggerFetchKeyFromProfile(true); // true 表示是重試
      }
      // 定時器會持續，直到 apiKey 獲取成功 (handleApiKeyUpdate 中清除)
      // 或者直到用戶手動輸入 API Key
      // 這裡不需要遞歸調用 scheduleApiKeyRetry，因為 handleApiKeyUpdate 會在失敗時重新評估是否繼續
      // 但如果 triggerFetchKeyFromProfile 失敗且不是因為認證，我們可能需要停止
      // 這個邏輯現在主要放在 handleApiKeyUpdate 中
      if (isAttemptingLoginFlow && !apiKey) { // 只有在登入流程中且還沒拿到 key 才繼續安排下一次
        scheduleApiKeyRetry();
      }

    }, 3000); // 每 3 秒
  }, [apiKey, isAttemptingLoginFlow]); // 依賴 apiKey 和 isAttemptingLoginFlow

  // 初始觸發
  useEffect(() => {
    // 讓 GristApiKeyManager 組件的 initialAttempt prop 來處理首次嘗試
    // GristDynamicSelectorViewer 主要響應 GristApiKeyManager 的結果
    // 如果初始 localStorage 就有 key，GristApiKeyManager 不會觸發 initialAttempt 的 fetch
    // 但我們仍然希望驗證這個 key，或者如果它是空的，則啟動獲取流程
    if (!localStorage.getItem('gristApiKey') && !apiKey) {
        if (apiKeyManagerRef.current && !isAttemptingLoginFlow) { // 避免在已啟動流程時重複觸發
            // 這裡模擬一個初始的獲取失敗（因認證），以啟動登入流程
            // 實際上 GristApiKeyManager 的 initialAttempt 應該先執行
            // 如果 GristApiKeyManager 的 initialAttempt 失敗且是因認證，handleApiKeyUpdate 會啟動流程
            // setIsAttemptingLoginFlow(true);
            // openGristLoginPopup();
            // scheduleApiKeyRetry();
            // 更好的方式是依賴 GristApiKeyManager 首次嘗試的結果
            setStatusMessage("正在等待首次 API Key 獲取嘗試...");
        }
    } else if (localStorage.getItem('gristApiKey') && !apiKey) {
        // 有 localStorage key 但 state 中沒有，可能是頁面剛加載
        // GristApiKeyManager 的 apiKey prop 會是空的，它應該會嘗試用 localStorage 的 key
        // 或者它的 initialAttempt=true 會觸發 fetch (如果 localStorage 是空的)
    }

  }, []); // 空依賴，僅在掛載時執行一次初始判斷（如果需要）

  // 組件卸載時清除定時器
  useEffect(() => {
    return () => {
      clearTimeout(retryTimerRef.current);
      if (loginPopupRef.current && !loginPopupRef.current.closed) {
        try { loginPopupRef.current.close(); } catch(e) {/* ignore */}
      }
    };
  }, []);


  // ... (makeGristApiRequest and other data fetching useEffects remain the same) ...

  return (
    <div style={{ /* ... */ }}>
      {/* ... (h1 and p for title and API target remain the same) ... */}
      <h1 style={{ /* ... */ }}> Grist 數據動態選擇查看器 </h1>
      <p style={{ /* ... */ }}> API 目標: <code>{GRIST_API_BASE_URL}</code> (目標組織域名: <code>{TARGET_ORG_DOMAIN || '未指定'}</code>) </p>

      {statusMessage && ( <p style={{ /* ... status message styles ... */ }}> {statusMessage} </p> )}

      <GristApiKeyManager
        ref={apiKeyManagerRef}
        apiKey={apiKey}
        onApiKeyUpdate={handleApiKeyUpdate}
        onStatusUpdate={setStatusMessage}
        initialAttempt={!apiKey && !localStorage.getItem('gristApiKey')} // 只有在完全無key時才觸發首次嘗試
      />

      {/* 移除之前的登入提示區塊，因為流程是自動的 */}
      {/* 如果需要一個手動觸發的按鈕，以防自動流程卡住，可以考慮保留一個 */}
      {isAttemptingLoginFlow && !apiKey && (
          <div style={{padding: '10px', textAlign: 'center', border: '1px solid orange', margin: '10px 0'}}>
              <p>正在嘗試自動連接 Grist。如果 Grist 登入視窗未自動彈出或長時間無反應，請檢查瀏覽器彈窗設定，或嘗試手動在另一分頁登入 Grist ({GRIST_API_BASE_URL}) 後刷新此頁面。</p>
              <button onClick={openGristLoginPopup} style={{marginRight: '10px'}}>手動打開 Grist 登入視窗</button>
              <button onClick={() => { // 手動觸發一次檢查
                  if(apiKeyManagerRef.current) apiKeyManagerRef.current.triggerFetchKeyFromProfile(false);
              }}>
                  手動檢查登入狀態
              </button>
          </div>
      )}


      {apiKey ? (
        <div style={{ /* ... (styles for data source selection remain the same) ... */ }}>
          {/* ... (All the selectors and data display JSX) ... */}
        </div>
      ) : (
        // 當 apiKey 為空時，且不在登入流程中，可以顯示一個更通用的等待訊息
        !isAttemptingLoginFlow && <p style={{textAlign: 'center', color: theme.textColorSubtle, marginTop: '20px'}}>請設定或自動獲取 API Key 以繼續。</p>
      )}
      {/* ... (The rest of the JSX for displaying data, tables, etc.) ... */}
    </div>
  );
}

export default GristDynamicSelectorViewer;