// src/GristDynamicSelectorViewer.jsx
import React, { useState, useCallback, useEffect, useRef } from 'react';

const GRIST_API_BASE_URL = 'https://tiss-grist.fcuai.tw';
const TARGET_ORG_DOMAIN = 'fcuai.tw';
const API_KEY_RETRY_INTERVAL = 3000;

const theme = {
  textColor: '#333740',
  textColorLight: '#555e6d',
  textColorSubtle: '#777f8d',
  backgroundColor: '#ffffff',
  surfaceColor: '#f8f9fa',
  borderColor: '#dee2e6',
  primaryColor: '#007bff',
  primaryColorText: '#ffffff',
  successColor: '#28a745',
  successColorBg: '#e9f7ef',
  errorColor: '#dc3545',
  errorColorBg: '#fdecea',
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif',
  fontSizeBase: '16px',
  fontSizeSmall: '14px',
  lineHeightBase: '1.6',
  borderRadius: '4px',
};

const GristApiKeyManager = React.forwardRef(({ apiKey: apiKeyProp, onApiKeyUpdate, onStatusUpdate, initialAttemptFailed }, ref) => {
  const [localApiKey, setLocalApiKey] = useState(apiKeyProp || '');
  const [isFetching, setIsFetching] = useState(false);
  const retryTimerRef = useRef(null);

  const fetchKeyFromProfile = useCallback(async (isRetry = false) => {
    if (isFetching && !isRetry) return false;

    setIsFetching(true);
    if (!isRetry) {
        onStatusUpdate('正在從個人資料獲取 API Key...');
    }

    try {
      const response = await fetch(`${GRIST_API_BASE_URL}/api/profile/apiKey`, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Accept': 'text/plain' },
      });
      const responseText = await response.text();
      console.log('GristApiKeyManager: response from /api/profile/apiKey: ', responseText);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${responseText || '無法獲取 API Key'}`);
      }
      const fetchedKey = responseText.trim();
      if (!fetchedKey || fetchedKey.includes('<') || fetchedKey.length < 32) {
        throw new Error('獲取到的 API Key 似乎無效。');
      }
      setLocalApiKey(fetchedKey);
      onApiKeyUpdate(fetchedKey, true); // true for autoFetchedSuccess
      // onStatusUpdate('API Key 自動獲取成功！'); // Let parent handle this specific message
      clearTimeout(retryTimerRef.current);
      return true;
    } catch (error) {
      console.error("GristApiKeyManager: Error fetching API key (attempt):", error.message);
      if (!isRetry) {
        onStatusUpdate(`自動獲取 API Key 失敗: ${error.message}. 請確保您已登入 Grist。`);
      }
      onApiKeyUpdate('', false);
      return false;
    } finally {
      setIsFetching(false);
    }
  }, [onApiKeyUpdate, onStatusUpdate]); // isFetching is managed internally

  const handleManualSubmit = useCallback(() => {
    clearTimeout(retryTimerRef.current);
    const trimmedKey = localApiKey.trim();
    if (trimmedKey) {
      onApiKeyUpdate(trimmedKey, false);
      // onStatusUpdate('手動輸入的 API Key 已設定。'); // Let parent handle
    } else {
      onStatusUpdate('請輸入有效的 API Key。');
    }
  }, [localApiKey, onApiKeyUpdate, onStatusUpdate]);
  
  useEffect(() => {
    setLocalApiKey(apiKeyProp || '');
  }, [apiKeyProp]);

  useEffect(() => {
    if (apiKeyProp) { // 如果父組件已經傳入有效的 API Key
        clearTimeout(retryTimerRef.current);
        // 如果是因為成功獲取 apiKeyProp，父組件的 handleApiKeyUpdate 應該已處理彈窗和 localStorage
        return;
    }

    // initialAttemptFailed: 由父組件控制，當父組件認為需要開始嘗試獲取時設為 true
    // (例如，彈窗被開啟時，或組件初次加載且無 key 時)
    if (initialAttemptFailed && !apiKeyProp) {
        console.log("GristApiKeyManager: Initial attempt signal received, starting fetch/retry logic.");
        
        // 定義一個遞歸的嘗試函數
        const attemptFetchAndRetryLoop = (isFirstAttemptInCurrentLoop) => {
            // isRetry 參數給 fetchKeyFromProfile 用於決定是否顯示 "正在獲取..." 的初次訊息
            fetchKeyFromProfile(isFirstAttemptInCurrentLoop ? false : true).then(success => {
                if (success) {
                    // 成功獲取 API Key
                    // GristApiKeyManager 的任務完成，清除自己的定時器。
                    // 父組件的 onApiKeyUpdate (即 handleApiKeyUpdate) 會負責關閉彈窗和清除 localStorage 標記。
                    console.log("GristApiKeyManager: API Key fetched successfully by manager.");
                    clearTimeout(retryTimerRef.current);
                    // localStorage.removeItem('gristLoginPopupOpen'); // 應由父組件的成功回調處理
                } else {
                    // API Key 獲取失敗
                    if (retryTimerRef.current) clearTimeout(retryTimerRef.current); // 清除任何可能存在的舊定時器

                    // 關鍵：檢查 localStorage 中的彈窗標記，如果彈窗仍然被認為是開啟的，則繼續安排下一次重試
                    if (localStorage.getItem('gristLoginPopupOpen') === 'true') {
                        console.log("GristApiKeyManager: Fetch failed, but 'gristLoginPopupOpen' is true. Scheduling retry.");
                        retryTimerRef.current = setTimeout(() => {
                            // 下一次在循環中調用時，isFirstAttemptInCurrentLoop 應為 false
                            attemptFetchAndRetryLoop(false);
                        }, API_KEY_RETRY_INTERVAL);
                    } else {
                        // 如果彈窗標記不存在 (例如用戶已關閉彈窗，或父組件清除了標記) 且獲取失敗，則停止重試
                        console.log("GristApiKeyManager: Fetch failed and 'gristLoginPopupOpen' is not true. Stopping retries.");
                        clearTimeout(retryTimerRef.current);
                        if (!isFirstAttemptInCurrentLoop) { // 避免在初次嘗試失敗就立即顯示這個
                           // onStatusUpdate("API Key 自動獲取已停止，因登入視窗未開啟或已關閉。");
                        }
                    }
                }
            });
        };

        attemptFetchAndRetryLoop(true); // 啟動獲取/重試循環，標記這是循環中的首次嘗試

    } else {
        // 如果不滿足重試條件 (例如 initialAttemptFailed 為 false，或已有 apiKeyProp)
        console.log("GristApiKeyManager: Conditions for fetch/retry not met or API key already present. Ensuring no active timer.");
        clearTimeout(retryTimerRef.current);
    }
    
    return () => {
      clearTimeout(retryTimerRef.current); // 組件卸載時清除定時器
    };
  }, [apiKeyProp, fetchKeyFromProfile, initialAttemptFailed]);

  React.useImperativeHandle(ref, () => ({
    triggerFetchKeyFromProfile: () => {
        console.log("GristApiKeyManager: Manually triggered fetchKeyFromProfile.");
        clearTimeout(retryTimerRef.current);
        return fetchKeyFromProfile(false);
    },
    stopRetrying: () => {
        console.log("GristApiKeyManager: Stopping retries.");
        clearTimeout(retryTimerRef.current);
    }
  }));

  return (
    <div style={{ marginBottom: '20px', padding: '15px', border: `1px dashed ${theme.borderColor}`, borderRadius: theme.borderRadius, backgroundColor: theme.surfaceColor }}>
      <h4 style={{ marginTop: '0', marginBottom: '10px', color: theme.textColor }}>API Key 管理</h4>
      <p style={{ fontSize: theme.fontSizeSmall, color: theme.textColorSubtle, marginBottom: '15px' }}>
        若要啟用 "自動獲取"，請先登入您的 Grist 實例 (<code>{GRIST_API_BASE_URL}</code>)。
        或從 Grist 個人資料頁面手動複製 API Key。
      </p>
      <input
        type="password"
        value={localApiKey}
        onChange={(e) => setLocalApiKey(e.target.value)}
        placeholder="在此輸入或貼上 Grist API Key"
        style={{ width: 'calc(100% - 160px)', marginRight: '10px', padding: '10px', fontSize: theme.fontSizeBase, border: `1px solid ${theme.borderColor}`, borderRadius: theme.borderRadius, boxSizing: 'border-box', color: theme.textColor, }}
      />
      <button onClick={handleManualSubmit} style={{ padding: '10px 15px', fontSize: theme.fontSizeBase, backgroundColor: '#e9ecef', color: theme.textColor, border: `1px solid ${theme.borderColor}`, borderRadius: theme.borderRadius, cursor: 'pointer', }}>
        設定手動 Key
      </button>
    </div>
  );
});


function GristDynamicSelectorViewer() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gristApiKey') || '');
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
  const gristLoginPopupRef = useRef(null);
  const [initialApiKeyAttemptFailed, setInitialApiKeyAttemptFailed] = useState(false);

  const openGristLoginPopup = useCallback(() => {
    if (gristLoginPopupRef.current && !gristLoginPopupRef.current.closed) {
      try {
        gristLoginPopupRef.current.focus();
        setStatusMessage('Grist 登入視窗已開啟，請完成登入。');
      } catch (e) {
        // 如果 focus 失敗 (例如跨域彈窗)，這不是致命錯誤，彈窗可能仍然可見
        console.warn("Could not focus popup, it might be cross-origin or already closed.", e);
        setStatusMessage('Grist 登入視窗已開啟 (或曾開啟)，請檢查並完成登入。');
      }
      return;
    }

    const loginUrl = `${GRIST_API_BASE_URL}/login`;
    const popup = window.open(loginUrl, 'GristLoginPopup', 'width=600,height=700,scrollbars=yes,resizable=yes,noopener,noreferrer');
    
    // 主要檢查 popup 是否為 null。如果彈窗被瀏覽器完全阻擋，popup 通常為 null。
    // 即使彈窗出現，popup.closed 的初始狀態也可能不可靠。
    if (!popup) {
        setStatusMessage('無法開啟 Grist 登入視窗，可能已被您的瀏覽器阻擋。請檢查瀏覽器的彈窗設定，然後手動點擊按鈕重試。');
        localStorage.removeItem('gristLoginPopupOpen'); // 確保標記被清除
        setShowLoginPrompt(true); // 顯示手動提示按鈕
        // 如果確定無法開啟，可以考慮停止 GristApiKeyManager 的任何現有重試
        if (apiKeyManagerRef.current) {
             apiKeyManagerRef.current.stopRetrying();
        }
        return;
    }

    // 如果 popup 存在，我們就認為它開啟了 (或至少瀏覽器嘗試了)
    gristLoginPopupRef.current = popup;
    localStorage.setItem('gristLoginPopupOpen', 'true'); 
    setStatusMessage('請在新視窗中完成 Grist 登入。本頁面將嘗試自動檢測登入狀態。');
    setInitialApiKeyAttemptFailed(true); // 關鍵：觸發 GristApiKeyManager 的 API Key 獲取/重試邏輯
    setShowLoginPrompt(false); // 如果彈窗成功開啟 (或嘗試開啟)，隱藏手動提示

    // 定時檢查彈窗是否被用戶手動關閉
    const checkPopupClosedInterval = setInterval(() => {
        // 只有在 gristLoginPopupRef.current 仍然指向我們開啟的彈窗實例時才檢查
        if (gristLoginPopupRef.current && gristLoginPopupRef.current.closed) {
            clearInterval(checkPopupClosedInterval);
            localStorage.removeItem('gristLoginPopupOpen');
            const currentApiKeyFromState = apiKey; // 從 state 讀取最新的 apiKey (最可靠)
            
            if (!currentApiKeyFromState) { // 如果彈窗關閉了，但我們仍然沒有 API Key
                setStatusMessage('Grist 登入視窗已關閉。如果尚未成功登入，API Key 可能仍未獲取。請嘗試手動重試。');
                setShowLoginPrompt(true); // 再次顯示手動提示
                 // 讓 GristApiKeyManager 停止重試，因為用戶已明確關閉彈窗且未成功
                if (apiKeyManagerRef.current) {
                    apiKeyManagerRef.current.stopRetrying();
                }
            }
            // 不需要將 gristLoginPopupRef.current 設為 null，因為下次 openGristLoginPopup 會覆蓋
            // 或者，如果 API Key 已獲取，handleApiKeyUpdate 會將其設為 null
        } else if (!gristLoginPopupRef.current || localStorage.getItem('gristLoginPopupOpen') !== 'true') {
            // 如果 ref 變為 null (例如在 handleApiKeyUpdate 中成功獲取 key 後被清除)
            // 或者 localStorage 標記被移除 (也通常在成功後)
            // 則也停止這個 interval
            clearInterval(checkPopupClosedInterval);
        }
    }, 1000);
  }, [setStatusMessage, setInitialApiKeyAttemptFailed, setShowLoginPrompt, apiKey]);

  const handleApiKeyUpdate = useCallback((key, autoFetchedSuccess = false) => {
    console.log(`GristDynamicSelectorViewer: handleApiKeyUpdate called with key: ${key ? '******' : '""'}, autoFetchedSuccess: ${autoFetchedSuccess}`);
    
    if (key) {
        setApiKey(key);
        localStorage.setItem('gristApiKey', key);
        setShowLoginPrompt(false);
        setInitialApiKeyAttemptFailed(false); // 成功獲取 key，重置此標記

        // 如果是自動獲取成功 (autoFetchedSuccess 為 true)，並且登入彈窗的引用存在且彈窗未關閉
        if (autoFetchedSuccess && gristLoginPopupRef.current && !gristLoginPopupRef.current.closed) {
            try {
                gristLoginPopupRef.current.close();
                console.log("GristDynamicSelectorViewer: Attempted to close Grist login popup after auto fetch success.");
            } catch (e) {
                console.warn("GristDynamicSelectorViewer: Could not automatically close Grist login popup:", e);
                setStatusMessage("Grist 登入成功！您可以手動關閉登入視窗。");
            }
            // 無論 close() 是否拋出異常 (例如跨域限制)，既然 API Key 已拿到，
            // 我們都應該清除彈窗的相關標記和引用。
            localStorage.removeItem('gristLoginPopupOpen');
            gristLoginPopupRef.current = null; 
        } else if (autoFetchedSuccess && localStorage.getItem('gristLoginPopupOpen') === 'true') {
            // 備用邏輯：如果 ref 因某些原因丟失但 localStorage 標記仍在，也清除它
            localStorage.removeItem('gristLoginPopupOpen');
            console.log("GristDynamicSelectorViewer: Cleared 'gristLoginPopupOpen' from localStorage after auto fetch success (ref was null or closed).");
        }
       
       if (autoFetchedSuccess) {
           setStatusMessage('API Key 自動獲取成功！正在準備加載數據...');
       } else {
           // 此情況對應手動在 GristApiKeyManager 組件中輸入並設定 Key
           setStatusMessage('手動輸入的 API Key 已設定。正在準備加載數據...');
       }

    } else { // key 為空，表示 API key 獲取失敗或被清除
        setApiKey('');
        localStorage.removeItem('gristApiKey');
        
        // setInitialApiKeyAttemptFailed(true) 會讓 GristApiKeyManager 在下次條件滿足時重試
        // (例如，如果彈窗仍然是 'gristLoginPopupOpen' === 'true')
        setInitialApiKeyAttemptFailed(true); 

        // 如果不是由於自動獲取流程失敗 (autoFetchedSuccess !== false)，
        // 且彈窗標記不存在，則提示用戶手動操作。
        // 如果是自動獲取失敗，GristApiKeyManager 應該已經通過 onStatusUpdate 設置了更具體的錯誤訊息。
        if (autoFetchedSuccess !== false && localStorage.getItem('gristLoginPopupOpen') !== 'true') {
            setShowLoginPrompt(true);
            setStatusMessage(prev => {
                if (prev && (prev.includes('自動獲取 API Key 失敗') || prev.includes('API Key 已失效'))) return prev;
                return 'API Key 獲取失敗或已清除。請嘗試重新登入或手動設定。';
            });
        } else if (autoFetchedSuccess === false) {
            // 如果是 GristApiKeyManager 的自動獲取失敗，它會設置 statusMessage。
            // 我們這裡確保 showLoginPrompt 仍然為 true，以便用戶可以手動操作。
            setShowLoginPrompt(true);
        }
    }

    // 清理後續數據狀態，無論成功或失敗
    setCurrentOrgId(null);
    setDocuments([]);
    setSelectedDocId('');
    setTables([]);
    setSelectedTableId('');
    setTableData(null);
    setFilterQuery('');
    setSortQuery('');
    setDataError('');
  }, [setApiKey, setShowLoginPrompt, setInitialApiKeyAttemptFailed, setCurrentOrgId, setDocuments, setSelectedDocId, setTables, setSelectedTableId, setTableData, setFilterQuery, setSortQuery, setDataError, setStatusMessage]);
  
  useEffect(() => {
    const initialLocalApiKey = localStorage.getItem('gristApiKey');
    // 優先使用 state 中的 apiKey (可能已經從 localStorage 初始化)，其次是直接從 localStorage 讀取
    const effectiveApiKey = apiKey || initialLocalApiKey;

    if (!effectiveApiKey) {
      console.log("GristDynamicSelectorViewer: Initial mount - No API key found. Setting initialAttemptFailed to true.");
      setInitialApiKeyAttemptFailed(true); // 觸發 GristApiKeyManager 開始嘗試獲取

      // 檢查是否已經有一個 "開啟的" 彈窗的標記，避免重複或衝突的自動開啟嘗試
      if (localStorage.getItem('gristLoginPopupOpen') !== 'true') {
        console.log("GristDynamicSelectorViewer: Attempting to auto-open Grist login popup.");
        // openGristLoginPopup(); // 如果要嘗試自動開啟，取消此行註釋
        // 考慮到瀏覽器阻擋的普遍性，更好的做法可能是：
        setStatusMessage("歡迎！請登入 Grist 以繼續，或手動設定 API Key。");
        setShowLoginPrompt(true); // 直接顯示手動登入/設定的選項
        console.log("GristDynamicSelectorViewer: Auto-open disabled by default due to browser restrictions. Showing login prompt.");
      } else {
        // 如果 localStorage 標記存在，說明彈窗可能已開啟 (或上次未正確清除標記)
        console.log("GristDynamicSelectorViewer: 'gristLoginPopupOpen' is true on initial load. Manager will attempt fetch. Prompting user.");
        setStatusMessage("檢測到 Grist 登入視窗可能已開啟。如果登入完成，本頁面將自動更新。");
        setShowLoginPrompt(true); // 仍然提供手動選項
      }
    } else {
      console.log("GristDynamicSelectorViewer: Initial mount - API key found. Setting initialAttemptFailed to false.");
      setApiKey(effectiveApiKey); // 確保 state 與 localStorage 同步
      setInitialApiKeyAttemptFailed(false); // 有 key，不需要 GristApiKeyManager 立即自動嘗試
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const makeGristApiRequest = useCallback(async (endpoint, method = 'GET', params = null) => {
    // apiKey is a direct dependency from useState, used in the check below.
    if (!apiKey) {
      console.warn("makeGristApiRequest: API Key is not set. Aborting request to", endpoint);
      throw new Error('API Key 未設定，無法發送請求。');
    }
    console.log(`makeGristApiRequest: Fetching ${endpoint} with apiKey.`);
    let url = `${GRIST_API_BASE_URL}${endpoint}`;
    const queryParams = new URLSearchParams();
    if (params) {
      for (const key in params) {
        if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
          queryParams.append(key, params[key]);
        }
      }
    }
    if (queryParams.toString()){
        url += `?${queryParams.toString()}`;
    }

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${apiKey}`, // apiKey dependency
        'Accept': 'application/json',
        'Content-Type': method !== 'GET' ? 'application/json' : undefined,
      },
    });

    let responseData;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
        responseData = await response.json();
    } else {
        const text = await response.text();
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}: ${text || response.statusText} (Non-JSON response)`);
        }
        responseData = text;
    }

    if (!response.ok) {
      const errorMsg = responseData?.error?.message || responseData?.error || (typeof responseData === 'string' ? responseData : null) || responseData?.message || `HTTP error ${response.status}`;
      console.error(`Grist API Error for ${method} ${url}:`, responseData);
      if (response.status === 401 || response.status === 403) {
        setStatusMessage('API Key 已失效或無權限，請重新登入或設定新的 API Key。'); // Stable setter
        handleApiKeyUpdate('', false); // Stable callback
      }
      throw new Error(errorMsg);
    }
    return responseData;
  }, [apiKey, handleApiKeyUpdate, setStatusMessage]); // handleApiKeyUpdate & setStatusMessage are stable

  // 獲取組織 ID
  useEffect(() => {
    if (!apiKey) {
      setCurrentOrgId(null);
      setDocuments([]);
      return;
    }
    console.log("useEffect (getOrgId): API Key present, attempting to fetch org ID.");
    const getOrgId = async () => {
      setIsLoadingDocs(true);
      setStatusMessage('API Key 有效，正在獲取組織資訊...');
      try {
        const orgsData = await makeGristApiRequest('/api/orgs');
        console.log("useEffect (getOrgId): Orgs data fetched:", orgsData);
        let determinedOrgId = null;
        if (orgsData && Array.isArray(orgsData) && orgsData.length > 0) {
          if (TARGET_ORG_DOMAIN) {
            const targetOrg = orgsData.find(org => org.domain === TARGET_ORG_DOMAIN);
            if (targetOrg) determinedOrgId = targetOrg.id;
            else determinedOrgId = orgsData[0].id;
          } else {
            determinedOrgId = orgsData[0].id;
          }
        } else if (orgsData && orgsData.id) {
            determinedOrgId = orgsData.id;
        }

        if (determinedOrgId) {
          console.log("useEffect (getOrgId): Determined Org ID:", determinedOrgId);
          setCurrentOrgId(determinedOrgId);
        } else {
          throw new Error('未能獲取到有效的組織 ID。');
        }
      } catch (error) {
        console.error('useEffect (getOrgId): Error fetching org ID:', error);
        if (!String(error.message).includes('API Key 已失效')) { // Avoid double message if makeGristApiRequest handled it
            setStatusMessage(`獲取組織 ID 失敗: ${error.message}`);
        }
        setCurrentOrgId(null);
        setDocuments([]);
        setIsLoadingDocs(false);
      }
    };
    getOrgId();
  }, [apiKey, makeGristApiRequest, setStatusMessage]); // makeGristApiRequest & setStatusMessage are stable

  // 獲取文檔列表
  useEffect(() => {
    if (!currentOrgId || !apiKey) {
      console.log("useEffect (fetchDocs): No currentOrgId or no API Key, skipping.");
      setDocuments([]);
      return;
    }
    console.log("useEffect (fetchDocs): currentOrgId present, attempting to fetch documents for org:", currentOrgId);
    const fetchDocsFromWorkspaces = async () => {
      setIsLoadingDocs(true);
      setStatusMessage(`正在從組織 ID ${currentOrgId} 獲取文檔列表...`);
      try {
        const workspacesData = await makeGristApiRequest(`/api/orgs/${currentOrgId}/workspaces`);
        console.log("useEffect (fetchDocs): Workspaces data fetched:", workspacesData);
        const allDocs = [];
        let docNameCounts = {};
        workspacesData.forEach(workspace => {
          if (workspace.docs && Array.isArray(workspace.docs)) {
            workspace.docs.forEach(doc => {
              docNameCounts[doc.name] = (docNameCounts[doc.name] || 0) + 1;
              allDocs.push({ id: doc.id, name: doc.name, workspaceName: workspace.name, workspaceId: workspace.id });
            });
          }
        });
        const processedDocs = allDocs.map(doc => ({
            ...doc,
            displayName: docNameCounts[doc.name] > 1 ? `${doc.name} (${doc.workspaceName})` : doc.name
        }));

        if (processedDocs.length > 0) {
          setDocuments(processedDocs);
          setStatusMessage('文檔列表獲取成功。請選擇一個文檔。');
        } else {
          setDocuments([]);
          setStatusMessage(`在組織 ID ${currentOrgId} 下未找到任何文檔。`);
        }
      } catch (error) {
        console.error(`useEffect (fetchDocs): Error fetching documents for org ${currentOrgId}:`, error);
        if (!String(error.message).includes('API Key 已失效')) {
            setStatusMessage(`獲取文檔列表失敗: ${error.message}`);
        }
        setDocuments([]);
      } finally {
        setIsLoadingDocs(false);
      }
    };
    fetchDocsFromWorkspaces();
  }, [currentOrgId, apiKey, makeGristApiRequest, setStatusMessage]); // Dependencies are ID, apiKey, and stable callbacks

  // 獲取表格列表
  useEffect(() => {
    if (!selectedDocId || !apiKey) {
      console.log("useEffect (fetchTables): No selectedDocId or no API Key, skipping.");
      setTables([]);
      setSelectedTableId('');
      return;
    }
    console.log("useEffect (fetchTables): selectedDocId present, attempting to fetch tables for doc:", selectedDocId);
    const fetchTables = async () => {
      setIsLoadingTables(true);
      setStatusMessage(`正在獲取文檔 "${selectedDocId}" 的表格列表...`);
      setDataError('');
      try {
        const data = await makeGristApiRequest(`/api/docs/${selectedDocId}/tables`);
        console.log("useEffect (fetchTables): Tables data fetched:", data);
        const tableList = data.tables || (Array.isArray(data) ? data : []);
        if (Array.isArray(tableList)) {
          setTables(tableList.map(table => ({ id: table.id, name: table.id })));
          setStatusMessage(tableList.length > 0 ? '表格列表獲取成功。' : '該文檔中未找到表格。');
        } else { throw new Error('表格列表格式不正確。'); }
      } catch (error) {
        console.error('useEffect (fetchTables): Error fetching tables:', error);
         if (!String(error.message).includes('API Key 已失效')) {
            setStatusMessage(`獲取表格列表失敗: ${error.message}`);
        }
        setTables([]);
      } finally { setIsLoadingTables(false); }
    };
    fetchTables();
  }, [selectedDocId, apiKey, makeGristApiRequest, setStatusMessage]); // Dependencies are ID, apiKey, and stable callbacks

  const handleFetchTableData = useCallback(async () => {
    if (!apiKey || !selectedDocId || !selectedTableId) {
      setDataError('請先設定 API Key 並選擇文檔和表格。');
      return;
    }
    setIsLoadingData(true);
    setDataError('');
    setTableData(null);
    setColumns([]);
    setStatusMessage(`正在獲取 ${selectedTableId} 的數據...`);
    const params = { limit: '50' };
    if (filterQuery) { 
        try { 
            JSON.parse(filterQuery);
            params.filter = filterQuery; 
        } catch (e) { 
            setDataError('過濾條件不是有效的 JSON 格式.'); 
            setStatusMessage('過濾條件格式錯誤.'); 
            setIsLoadingData(false); return; 
        }
    }
    if (sortQuery.trim()) { params.sort = sortQuery.trim(); }
    try {
      const data = await makeGristApiRequest(`/api/docs/${selectedDocId}/tables/${selectedTableId}/records`, 'GET', params);
      if (data && data.records) {
        setTableData(data.records);
        if (data.records.length > 0) {
          const allCols = new Set();
          data.records.forEach(rec => { if (rec.fields) Object.keys(rec.fields).forEach(key => allCols.add(key)); });
          setColumns(Array.from(allCols));
          setStatusMessage(`成功獲取 ${data.records.length} 條數據。`);
        } else { 
          setColumns([]); 
          setStatusMessage('數據獲取成功，但結果為空。'); 
        }
      } else { throw new Error('數據格式不正確，缺少 "records" 屬性。'); }
    } catch (error) { 
        console.error('handleFetchTableData: Error fetching table data:', error);
        if (!String(error.message).includes('API Key 已失效')) {
            setDataError(`獲取數據失敗: ${error.message}`);
            setStatusMessage(`獲取數據失敗: ${error.message}`);
        }
        setTableData([]); 
    } finally { setIsLoadingData(false); }
  }, [apiKey, selectedDocId, selectedTableId, makeGristApiRequest, filterQuery, sortQuery, setStatusMessage]); // makeGristApiRequest and setStatusMessage are stable


  return (
    <div style={{ padding: '25px', fontFamily: theme.fontFamily, fontSize: theme.fontSizeBase, lineHeight: theme.lineHeightBase, color: theme.textColor, backgroundColor: theme.backgroundColor, maxWidth: '1000px', margin: '20px auto', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', borderRadius: '8px', }}>
      <h1 style={{ color: theme.textColor, textAlign: 'center', marginBottom: '15px', fontSize: '28px', }}>
        Grist 數據動態選擇查看器
      </h1>
      <p style={{ textAlign: 'center', color: theme.textColorSubtle, fontSize: theme.fontSizeSmall, marginBottom: '25px' }}>
        API 目標: <code>{GRIST_API_BASE_URL}</code> (目標組織域名: <code>{TARGET_ORG_DOMAIN || '未指定'}</code>)
      </p>

      {statusMessage && ( <p style={{ padding: '12px 15px', backgroundColor: statusMessage.includes('失敗') || statusMessage.includes('錯誤') || statusMessage.includes('尚未登入') || statusMessage.includes('已失效') || statusMessage.includes('無法使用') ? theme.errorColorBg : theme.successColorBg, border: `1px solid ${statusMessage.includes('失敗') || statusMessage.includes('錯誤') || statusMessage.includes('尚未登入') || statusMessage.includes('已失效') || statusMessage.includes('無法使用') ? theme.errorColor : theme.successColor}`, color: statusMessage.includes('失敗') || statusMessage.includes('錯誤') || statusMessage.includes('尚未登入') || statusMessage.includes('已失效') || statusMessage.includes('無法使用') ? theme.errorColor : theme.successColor, marginTop: '10px', marginBottom: '20px', borderRadius: theme.borderRadius, fontSize: theme.fontSizeSmall, textAlign: 'center', }}> {statusMessage} </p> )}

      <GristApiKeyManager
        ref={apiKeyManagerRef}
        apiKey={apiKey}
        onApiKeyUpdate={handleApiKeyUpdate} // Stable
        onStatusUpdate={setStatusMessage} // Stable setter
        initialAttemptFailed={initialApiKeyAttemptFailed}
      />

      {showLoginPrompt && !apiKey && (
        <div style={{ padding: '20px', margin: '20px 0', border: `1px solid ${theme.errorColor}`, borderRadius: theme.borderRadius, textAlign: 'center', backgroundColor: theme.errorColorBg, }}>
          <p style={{ color: theme.errorColor, margin: '0 0 15px 0', fontWeight: '500' }}>
            您似乎尚未登入 Grist，或者 API Key 無法自動獲取。
          </p>
          <button onClick={openGristLoginPopup} style={{ padding: '10px 15px', marginRight: '10px', fontSize: theme.fontSizeBase, backgroundColor: theme.primaryColor, color: theme.primaryColorText, border: 'none', borderRadius: theme.borderRadius, cursor: 'pointer', }} >
            開啟 Grist 登入視窗
          </button>
          <button 
            onClick={() => apiKeyManagerRef.current && apiKeyManagerRef.current.triggerFetchKeyFromProfile()}
            style={{ padding: '10px 15px', backgroundColor: '#6c757d', color: theme.primaryColorText, border: 'none', borderRadius: theme.borderRadius, cursor: 'pointer'}}
          >
            手動重試獲取 API Key
          </button>
        </div>
      )}

      {apiKey && (
        <div style={{ marginTop: '25px', padding: '20px', border: `1px solid ${theme.borderColor}`, borderRadius: theme.borderRadius, backgroundColor: theme.surfaceColor, }}>
          <h3 style={{ marginTop: '0', marginBottom: '20px', color: theme.textColor, borderBottom: `1px solid ${theme.borderColor}`, paddingBottom: '10px' }}>選擇數據源</h3>
          <div style={{ marginBottom: '15px' }}>
            <label htmlFor="docSelect" style={{ display: 'block', marginBottom: '8px', color: theme.textColorLight, fontSize: theme.fontSizeSmall, fontWeight: '500' }}>選擇文檔:</label>
            <select id="docSelect" value={selectedDocId} 
              onChange={(e) => { 
                setSelectedDocId(e.target.value); 
                setSelectedTableId(''); 
                setTableData(null); 
                setFilterQuery(''); 
                setSortQuery(''); 
                setDataError(''); 
              }} 
              disabled={isLoadingDocs || documents.length === 0} 
              style={{ width: '100%', padding: '10px', fontSize: theme.fontSizeBase, border: `1px solid ${theme.borderColor}`, borderRadius: theme.borderRadius, boxSizing: 'border-box', backgroundColor: '#fff', color: theme.textColor, }}
            >
              <option value="">{isLoadingDocs ? '正在加載文檔...' : (documents.length === 0 && apiKey && currentOrgId ? '當前組織下未找到文檔' : (apiKey ? '-- 請選擇文檔 --' : '請先設定 API Key'))}</option>
              {documents.map((doc) => ( <option key={doc.id} value={doc.id}> {doc.displayName} </option> ))}
            </select>
            {selectedDocId && documents.find(d => d.id === selectedDocId) && <small style={{display: 'block', marginTop: '5px', color: theme.textColorSubtle, fontSize: '13px' }}> ID: {selectedDocId}, 所屬工作區: {documents.find(d => d.id === selectedDocId)?.workspaceName || 'N/A'} </small>}
          </div>

          {selectedDocId && (
            <div style={{ marginBottom: '15px' }}>
              <label htmlFor="tableSelect" style={{ display: 'block', marginBottom: '8px', color: theme.textColorLight, fontSize: theme.fontSizeSmall, fontWeight: '500' }}>選擇表格:</label>
              <select id="tableSelect" value={selectedTableId} 
                onChange={(e) => { 
                    setSelectedTableId(e.target.value); 
                    setTableData(null); 
                    setFilterQuery(''); 
                    setSortQuery(''); 
                    setDataError(''); 
                }} 
                disabled={isLoadingTables || tables.length === 0} 
                style={{ width: '100%', padding: '10px', fontSize: theme.fontSizeBase, border: `1px solid ${theme.borderColor}`, borderRadius: theme.borderRadius, boxSizing: 'border-box', backgroundColor: '#fff', color: theme.textColor, }}
              >
                <option value="">{isLoadingTables ? '正在加載表格...' : (tables.length === 0 && selectedDocId ? '未找到表格或無權限' : '-- 請選擇表格 --')}</option>
                {tables.map((table) => ( <option key={table.id} value={table.id}> {table.name} </option> ))}
              </select>
            </div>
          )}

          {selectedDocId && selectedTableId && (
            <div style={{ border: `1px solid ${theme.borderColor}`, padding: '20px', marginTop: '20px', borderRadius: theme.borderRadius, backgroundColor: '#fff', }}>
              <h4 style={{ marginTop: '0', marginBottom: '15px', color: theme.textColor, fontSize: '18px' }}>數據獲取選項</h4>
              <div style={{ marginBottom: '15px' }}>
                <label htmlFor="filterInput" style={{ display: 'block', marginBottom: '5px', color: theme.textColorLight, fontSize: theme.fontSizeSmall }}>過濾條件 (JSON):</label>
                <input id="filterInput" type="text" value={filterQuery} onChange={(e) => setFilterQuery(e.target.value)} placeholder='{"ColumnID": "Value"}' style={{ width: '100%', padding: '10px', fontSize: theme.fontSizeBase, border: `1px solid ${theme.borderColor}`, borderRadius: theme.borderRadius, boxSizing: 'border-box', color: theme.textColor }}/>
                <small style={{ display: 'block', marginTop: '5px', color: theme.textColorSubtle, fontSize: '13px' }}>參考 Grist API "Filtering records"。欄位 ID 區分大小寫。</small>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label htmlFor="sortInput" style={{ display: 'block', marginBottom: '5px', color: theme.textColorLight, fontSize: theme.fontSizeSmall }}>排序條件:</label>
                <input id="sortInput" type="text" value={sortQuery} onChange={(e) => setSortQuery(e.target.value)} placeholder='ColumnID, -AnotherColumnID' style={{ width: '100%', padding: '10px', fontSize: theme.fontSizeBase, border: `1px solid ${theme.borderColor}`, borderRadius: theme.borderRadius, boxSizing: 'border-box', color: theme.textColor }}/>
                <small style={{ display: 'block', marginTop: '5px', color: theme.textColorSubtle, fontSize: '13px' }}>參考 "Sorting records"。前綴 "-" 表示降序。</small>
              </div>
              <button onClick={handleFetchTableData} disabled={isLoadingData} style={{ padding: '12px 20px', marginTop: '10px', width: '100%', boxSizing: 'border-box', backgroundColor: isLoadingData ? '#6c757d' : theme.primaryColor, color: theme.primaryColorText, border: 'none', borderRadius: theme.borderRadius, cursor: isLoadingData ? 'default' : 'pointer', fontSize: '16px', fontWeight: '500', opacity: isLoadingData ? 0.7 : 1, }}>
                {isLoadingData ? '正在加載數據...' : `獲取 "${selectedTableId}" 的數據`}
              </button>
            </div>
          )}
          {dataError && <p style={{ color: theme.errorColor, marginTop: '15px', whiteSpace: 'pre-wrap', padding: '12px 15px', backgroundColor: theme.errorColorBg, border: `1px solid ${theme.errorColor}`, borderRadius: theme.borderRadius, fontSize: theme.fontSizeSmall, }}>錯誤：{dataError}</p>}
        </div>
      )}

      {tableData && tableData.length > 0 && columns.length > 0 && (
        <div style={{ marginTop: '30px', overflowX: 'auto' }}>
          <h3 style={{ marginBottom: '15px', color: theme.textColor }}>數據結果: (前 {Math.min(tableData.length, 50)} 條)</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px', fontSize: theme.fontSizeSmall, boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderRadius: theme.borderRadius, overflow: 'hidden', }}>
            <thead>
              <tr>
                <th style={{backgroundColor: '#e9ecef', padding: '12px 10px', textAlign: 'left', color: theme.textColor, fontWeight: '600', borderBottom: `2px solid ${theme.borderColor}`, position: 'sticky', left: 0, zIndex: 1}}>id</th>
                {columns.map((col) => (<th key={col} style={{backgroundColor: '#e9ecef', padding: '12px 10px', textAlign: 'left', color: theme.textColor, fontWeight: '600', borderBottom: `2px solid ${theme.borderColor}`}}>{col}</th>))}
              </tr>
            </thead>
            <tbody>
              {tableData.map((record, rowIndex) => (
                <tr key={record.id} style={{ backgroundColor: rowIndex % 2 === 0 ? '#fff' : theme.surfaceColor , borderBottom: `1px solid ${theme.borderColor}` }}>
                  <td style={{ padding: '10px', whiteSpace: 'nowrap', color: theme.textColorLight, position: 'sticky', left: 0, backgroundColor: rowIndex % 2 === 0 ? '#fff' : theme.surfaceColor, zIndex: 1, borderRight: `1px solid ${theme.borderColor}` }}>{record.id}</td>
                  {columns.map((col) => (
                    <td key={`${record.id}-${col}`} style={{ padding: '10px', whiteSpace: 'nowrap', color: theme.textColorLight }}>
                      {record.fields && record.fields[col] !== undefined && record.fields[col] !== null
                        ? (typeof record.fields[col] === 'object' ? JSON.stringify(record.fields[col]) : String(record.fields[col]))
                        : ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {apiKey && selectedDocId && selectedTableId && tableData && tableData.length === 0 && !isLoadingData && !dataError && (
        <p style={{ marginTop: '15px', padding: '12px 15px', backgroundColor: '#fff3cd', border: '1px solid #ffeeba', color: '#856404', borderRadius: theme.borderRadius, fontSize: theme.fontSizeSmall, textAlign: 'center', }}>
            {filterQuery || sortQuery ? '沒有符合目前過濾/排序條件的數據，或表格本身為空。' : '該表格目前沒有數據。'}
        </p>
      )}
    </div>
  );
}

export default GristDynamicSelectorViewer;