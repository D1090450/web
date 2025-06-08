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
      onStatusUpdate('API Key 自動獲取成功！');
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
  }, [onApiKeyUpdate, onStatusUpdate]); 

  const handleManualSubmit = useCallback(() => {
    clearTimeout(retryTimerRef.current);
    const trimmedKey = localApiKey.trim();
    if (trimmedKey) {
      onApiKeyUpdate(trimmedKey, false);
      onStatusUpdate('手動輸入的 API Key 已設定。');
    } else {
      onStatusUpdate('請輸入有效的 API Key。');
    }
  }, [localApiKey, onApiKeyUpdate, onStatusUpdate]);
  
  useEffect(() => {
    setLocalApiKey(apiKeyProp || '');
  }, [apiKeyProp]);

  useEffect(() => {
    if (apiKeyProp) { 
        clearTimeout(retryTimerRef.current);
        return;
    }

    if (initialAttemptFailed && !apiKeyProp) { 
        console.log("GristApiKeyManager: Initial attempt failed, starting fetch/retry logic.");
        fetchKeyFromProfile(false).then(success => { 
            if (!success) { 
                if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
                retryTimerRef.current = setTimeout(function zichzelf() {
                    console.log("GristApiKeyManager: Retrying to fetch API key...");
                    fetchKeyFromProfile(true).then(retrySuccess => { 
                        if (!retrySuccess && localStorage.getItem('gristLoginPopupOpen') === 'true') {
                            retryTimerRef.current = setTimeout(zichzelf, API_KEY_RETRY_INTERVAL);
                        } else if (retrySuccess) {
                            localStorage.removeItem('gristLoginPopupOpen');
                        } else if (!localStorage.getItem('gristLoginPopupOpen')) {
                            console.log("GristApiKeyManager: Popup not open and retry failed, stopping retries.");
                            clearTimeout(retryTimerRef.current);
                        }
                    });
                }, API_KEY_RETRY_INTERVAL);
            }
        });
    } else {
        clearTimeout(retryTimerRef.current);
    }
    
    return () => {
      clearTimeout(retryTimerRef.current);
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
  const popupCheckIntervalRef = useRef(null); // Ref to store interval ID
  const [initialApiKeyAttemptFailed, setInitialApiKeyAttemptFailed] = useState(false);

  const handleApiKeyUpdate = useCallback((key, autoFetchedSuccess = false) => {
    console.log(`GristDynamicSelectorViewer: handleApiKeyUpdate called with key: ${key ? '******' : '""'}, autoFetchedSuccess: ${autoFetchedSuccess}`);
    setApiKey(key); 
    if (key) {
      localStorage.setItem('gristApiKey', key);
      setShowLoginPrompt(false); 
      setInitialApiKeyAttemptFailed(false); 

      if (autoFetchedSuccess && gristLoginPopupRef.current && !gristLoginPopupRef.current.closed) {
        console.log("GristDynamicSelectorViewer: Auto API key fetch success, attempting to close Grist login popup.");
        try {
            gristLoginPopupRef.current.close();
            localStorage.removeItem('gristLoginPopupOpen'); // Ensure this is removed if popup is closed
            console.log("GristDynamicSelectorViewer: Attempted to close Grist login popup via code.");
        } catch (e) {
            console.warn("GristDynamicSelectorViewer: Could not automatically close Grist login popup:", e);
            setStatusMessage("Grist 登入成功！您可以手動關閉登入視窗。"); 
        }
        gristLoginPopupRef.current = null; // Set ref to null after trying to close
      }
       if (autoFetchedSuccess) {
           setStatusMessage(prev => prev.includes('API Key 自動獲取成功！') ? prev : 'API Key 自動獲取成功！正在準備加載數據...');
       } else {
           setStatusMessage(prev => prev.includes('手動輸入的 API Key 已設定') ? prev : 'API Key 已設定。正在準備加載數據...');
       }

    } else {
      localStorage.removeItem('gristApiKey');
      if (!autoFetchedSuccess) { // Only show login prompt if it wasn't an auto-fetch failure during retries
        setShowLoginPrompt(true);
      }
      if (!localStorage.getItem('gristLoginPopupOpen') && !autoFetchedSuccess) {
          setInitialApiKeyAttemptFailed(true);
      } else if (localStorage.getItem('gristLoginPopupOpen')) {
          setInitialApiKeyAttemptFailed(true);
      }
      setStatusMessage(prev => prev.includes('API Key 獲取失敗或已清除') ? prev : 'API Key 獲取失敗或已清除。');
    }
    setCurrentOrgId(null);
    setDocuments([]);
    setSelectedDocId('');
    setTables([]);
    setSelectedTableId('');
    setTableData(null);
    setFilterQuery('');
    setSortQuery('');
    setDataError('');
  }, []); 

  const makeGristApiRequest = useCallback(async (endpoint, method = 'GET', params = null) => {
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
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
        'Content-Type': method !== 'GET' ? 'application/json' : undefined,
      },
    });

    const responseData = await response.json().catch(async () => { 
      const text = await response.text();
      throw new Error(`HTTP error ${response.status}: ${text || response.statusText} (Non-JSON response)`);
    });

    if (!response.ok) {
      const errorMsg = responseData?.error?.message || responseData?.error || responseData?.message || `HTTP error ${response.status}`;
      console.error(`Grist API Error for ${method} ${url}:`, responseData);
      if (response.status === 401 || response.status === 403) {
        handleApiKeyUpdate(''); 
      }
      throw new Error(errorMsg);
    }
    return responseData;
  }, [apiKey, handleApiKeyUpdate]); 

  useEffect(() => {
    if (!apiKey) {
      console.log("useEffect (getOrgId): No API Key, skipping.");
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
        setStatusMessage(`獲取組織 ID 失敗: ${error.message}`);
        setCurrentOrgId(null); 
        setDocuments([]); 
        setIsLoadingDocs(false); 
      }
    };
    getOrgId();
  }, [apiKey, makeGristApiRequest]); 

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
        setStatusMessage(`獲取文檔列表失敗: ${error.message}`);
        setDocuments([]);
      } finally {
        setIsLoadingDocs(false);
      }
    };
    fetchDocsFromWorkspaces();
  }, [currentOrgId, apiKey, makeGristApiRequest]); 

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
        setStatusMessage(`獲取表格列表失敗: ${error.message}`);
        setTables([]);
      } finally { setIsLoadingTables(false); }
    };
    fetchTables();
  }, [selectedDocId, apiKey, makeGristApiRequest]); 

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
    if (filterQuery) { try { JSON.parse(filterQuery); params.filter = filterQuery; } catch (e) { setDataError('過濾條件不是有效的 JSON 格式.'); setStatusMessage('過濾條件格式錯誤.'); setIsLoadingData(false); return; }}
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
        } else { setColumns([]); setStatusMessage('數據獲取成功，但結果為空。'); }
      } else { throw new Error('數據格式不正確，缺少 "records" 屬性。'); }
    } catch (error) { 
        console.error('handleFetchTableData: Error fetching table data:', error);
        setDataError(`獲取數據失敗: ${error.message}`);
        setStatusMessage(`獲取數據失敗: ${error.message}`);
        setTableData([]); 
    } finally { setIsLoadingData(false); }
  }, [apiKey, selectedDocId, selectedTableId, makeGristApiRequest, filterQuery, sortQuery]); 

  const openGristLoginPopup = useCallback(() => {
    console.log("openGristLoginPopup: Function called.");

    if (gristLoginPopupRef.current && !gristLoginPopupRef.current.closed) {
      console.log("openGristLoginPopup: Popup already open and not closed, focusing.");
      gristLoginPopupRef.current.focus();
      return;
    }
    console.log("openGristLoginPopup: No existing open popup, or previous was closed. Proceeding to open a new one.");

    if (popupCheckIntervalRef.current) {
        console.log("openGristLoginPopup: Clearing previous popup check interval.");
        clearInterval(popupCheckIntervalRef.current);
        popupCheckIntervalRef.current = null;
    }

    const loginUrl = `${GRIST_API_BASE_URL}/login`;
    console.log(`openGristLoginPopup: Attempting to open popup with URL: ${loginUrl}`);
    let newPopup = null; // 初始化為 null
    try {
        newPopup = window.open(loginUrl, 'GristLoginPopup', 'width=600,height=700,scrollbars=yes,resizable=yes,noopener,noreferrer');
    } catch (error) {
        console.error("openGristLoginPopup: Error during window.open call:", error);
        setStatusMessage(`開啟 Grist 登入視窗時發生錯誤: ${error.message}`);
        gristLoginPopupRef.current = null;
        localStorage.removeItem('gristLoginPopupOpen');
        return;
    }
    
    // ---- START EXTENDED DEBUGGING for window.open ----
    console.log("openGristLoginPopup: window.open executed.");
    console.log("   Direct return value (newPopup):", newPopup);
    console.log("   typeof newPopup:", typeof newPopup);

    if (newPopup) {
        console.log("   newPopup is truthy. Attempting to access properties (may fail due to cross-origin restrictions if loginUrl is different domain & no opener):");
        try {
            // 在 noopener 的情況下，這些訪問可能會受限或返回預設值
            console.log("     newPopup.closed (initial):", newPopup.closed); 
            console.log("     newPopup.opener (should be null due to noopener):", newPopup.opener);
            console.log("     newPopup.length (number of frames, usually 0 for simple pages):", newPopup.length);
        } catch (e) {
            console.warn("     Error accessing newPopup properties immediately after open. This is common with 'noopener' or cross-origin popups:", e.message);
        }
    } else {
        console.warn("   newPopup is falsy (e.g., null or undefined). This usually means the popup was blocked or failed to open.");
        // 如果這裡執行了，並且你確定彈窗真的視覺上打開了，這是最需要關注的矛盾點。
    }
    // ---- END EXTENDED DEBUGGING for window.open ----

    // 重新評估 newPopup 的有效性
    // 有時，即使 newPopup 不是 null，它也可能是一個無效的窗口句柄
    // 一個更可靠的檢查可能是看它是否真的有 .closed 屬性 (即使可能訪問受限)
    let isPopupConsideredValid = false;
    if (newPopup && typeof newPopup === 'object') { // 基本檢查它是一個對象
        try {
            // 嘗試一個無害的操作，比如檢查 'closed' 屬性是否存在。
            // 即使是跨域的 noopener 彈窗，.closed 屬性應該是存在的（儘管值可能不可靠）。
            // 如果 newPopup 是 null， `newPopup.closed` 會直接拋 TypeError。
            // 如果 newPopup 是一個真正無效的句柄，這裡也可能出錯。
             // eslint-disable-next-line @typescript-eslint/no-unused-expressions
            typeof newPopup.closed; // 只是為了觸發可能的錯誤
            isPopupConsideredValid = true;
            console.log("   Popup considered potentially valid based on object type and property access attempt.");
        } catch (e) {
            console.warn("   Popup considered invalid because accessing its properties (like .closed) failed:", e.message);
            isPopupConsideredValid = false;
        }
    }


    if (!isPopupConsideredValid) { 
        console.error("openGristLoginPopup: Final check - newPopup is NOT considered a valid window object. The message 'window.open failed' will be shown.");
        setStatusMessage('無法開啟 Grist 登入視窗，可能已被瀏覽器攔截或開啟失敗。請檢查您的彈窗設定。');
        gristLoginPopupRef.current = null; 
        localStorage.removeItem('gristLoginPopupOpen');
        // 如果彈窗確實打開了，但這裡執行了，可以嘗試在視覺上確認彈窗後手動模擬一個句柄，但這很 hacky
        // 例如： if (confirm("彈窗是否已手動開啟？")) { /* ... hacky logic ... */ }
        return;
    }

    console.log("openGristLoginPopup: newPopup appears valid. Assigning to ref and setting up interval.");
    gristLoginPopupRef.current = newPopup;
    localStorage.setItem('gristLoginPopupOpen', 'true'); 
    setStatusMessage('請在新視窗中完成 Grist 登入。本頁面將嘗試自動檢測登入狀態。');
    setInitialApiKeyAttemptFailed(true); 

    let popupOpenLogCounter = 0; 
    
    popupCheckIntervalRef.current = setInterval(() => {
        if (gristLoginPopupRef.current) {
            let isClosed = false;
            try {
                isClosed = gristLoginPopupRef.current.closed;
            } catch (e) {
                console.warn(`Interval Check: Error accessing gristLoginPopupRef.current.closed (popup window might have been navigated to a different origin or closed unexpectedly): ${e.message}. Assuming closed.`);
                isClosed = true; // 如果無法訪問 .closed，通常意味著無法再與之交互，視為已關閉
            }

            if (!isClosed) {
                popupOpenLogCounter++;
                if (popupOpenLogCounter > 0 && popupOpenLogCounter % 2 === 0) { 
                    console.log(`Grist 登入彈窗目前是開啟狀態 (檢測到於 ${new Date().toLocaleTimeString()})`);
                }
            } else {
                console.log(`Interval Check: Popup (ref exists) detected as CLOSED at ${new Date().toLocaleTimeString()} (isClosed=${isClosed}). Clearing interval.`);
                clearInterval(popupCheckIntervalRef.current);
                popupCheckIntervalRef.current = null;
                localStorage.removeItem('gristLoginPopupOpen'); 
                // gristLoginPopupRef.current 已在上面設為 null
                
                if (!apiKey) { 
                    setStatusMessage('Grist 登入視窗已關閉。如果尚未登入，請點擊下方按鈕重試。');
                    if (apiKeyManagerRef.current) {
                        apiKeyManagerRef.current.stopRetrying();
                    }
                }
            }
        } else {
            console.log(`Interval Check: Popup ref is NULL at ${new Date().toLocaleTimeString()}. Clearing interval if it exists.`);
            if (popupCheckIntervalRef.current) { // 確保 interval ID 存在才清除
                clearInterval(popupCheckIntervalRef.current);
                popupCheckIntervalRef.current = null;
            }
            localStorage.removeItem('gristLoginPopupOpen');
        }
    }, 1000); 
  }, [apiKey, setStatusMessage, setInitialApiKeyAttemptFailed, GRIST_API_BASE_URL]); // GRIST_API_BASE_URL 加入依賴 (雖然是 const，但好習慣)

  useEffect(() => {
    console.log("GristDynamicSelectorViewer: Initial mount/apiKey check.");
    if (!localStorage.getItem('gristApiKey') && !apiKey) {
      console.log("GristDynamicSelectorViewer: No API key found locally or in state, setting initialAttemptFailed to true.");
      setInitialApiKeyAttemptFailed(true);
    } else if (apiKey) { 
      console.log("GristDynamicSelectorViewer: API key already present, setting initialAttemptFailed to false.");
      setInitialApiKeyAttemptFailed(false); 
    }
  }, []); 

  // Cleanup interval on component unmount
  useEffect(() => {
    return () => {
        if (popupCheckIntervalRef.current) {
            console.log("GristDynamicSelectorViewer: Component unmounting, clearing popup check interval.");
            clearInterval(popupCheckIntervalRef.current);
        }
    };
  }, []);


  return (
    <div style={{ padding: '25px', fontFamily: theme.fontFamily, fontSize: theme.fontSizeBase, lineHeight: theme.lineHeightBase, color: theme.textColor, backgroundColor: theme.backgroundColor, maxWidth: '1000px', margin: '20px auto', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', borderRadius: '8px', }}>
      <h1 style={{ color: theme.textColor, textAlign: 'center', marginBottom: '15px', fontSize: '28px', }}>
        Grist 數據動態選擇查看器
      </h1>
      <p style={{ textAlign: 'center', color: theme.textColorSubtle, fontSize: theme.fontSizeSmall, marginBottom: '25px' }}>
        API 目標: <code>{GRIST_API_BASE_URL}</code> (目標組織域名: <code>{TARGET_ORG_DOMAIN || '未指定'}</code>)
      </p>

      {statusMessage && ( <p style={{ padding: '12px 15px', backgroundColor: statusMessage.includes('失敗') || statusMessage.includes('錯誤') || statusMessage.includes('尚未登入') ? theme.errorColorBg : theme.successColorBg, border: `1px solid ${statusMessage.includes('失敗') || statusMessage.includes('錯誤') || statusMessage.includes('尚未登入') ? theme.errorColor : theme.successColor}`, color: statusMessage.includes('失敗') || statusMessage.includes('錯誤') || statusMessage.includes('尚未登入') ? theme.errorColor : theme.successColor, marginTop: '10px', marginBottom: '20px', borderRadius: theme.borderRadius, fontSize: theme.fontSizeSmall, textAlign: 'center', }}> {statusMessage} </p> )}

      <GristApiKeyManager
        ref={apiKeyManagerRef}
        apiKey={apiKey} 
        onApiKeyUpdate={handleApiKeyUpdate}
        onStatusUpdate={setStatusMessage}
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