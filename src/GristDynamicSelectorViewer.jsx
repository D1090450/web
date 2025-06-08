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
  const internalFetchTimerRef = useRef(null);

  const fetchKeyFromProfile = useCallback(async (isParentCall = false) => {
    if (isFetching) {
      // console.log('GristApiKeyManager: Fetch already in progress. Ignoring new request.');
      return false; 
    }
    setIsFetching(true);
    if (isParentCall || !apiKeyProp) { 
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
      onApiKeyUpdate(fetchedKey, true);
      clearTimeout(internalFetchTimerRef.current);
      return true;
    } catch (error) {
      console.error("GristApiKeyManager: Error fetching API key:", error.message);
      if (isParentCall || !apiKeyProp) {
        onStatusUpdate(`自動獲取 API Key 失敗: ${error.message}. 請確保您已登入 Grist。`);
      }
      onApiKeyUpdate('', false);
      return false;
    } finally {
      setIsFetching(false);
    }
  }, [onApiKeyUpdate, onStatusUpdate, apiKeyProp]);

  const handleManualSubmit = useCallback(() => {
    clearTimeout(internalFetchTimerRef.current);
    const trimmedKey = localApiKey.trim();
    if (trimmedKey) {
      onApiKeyUpdate(trimmedKey, false);
    } else {
      onStatusUpdate('請輸入有效的 API Key。');
    }
  }, [localApiKey, onApiKeyUpdate, onStatusUpdate]);
  
  useEffect(() => {
    setLocalApiKey(apiKeyProp || '');
  }, [apiKeyProp]);

  useEffect(() => {
    if (apiKeyProp) {
        clearTimeout(internalFetchTimerRef.current);
        return;
    }
    if (initialAttemptFailed && !apiKeyProp) {
        console.log("GristApiKeyManager: initialAttemptFailed is true and no apiKeyProp. Attempting fetchKeyFromProfile ONCE (not as parent call).");
        clearTimeout(internalFetchTimerRef.current);
        internalFetchTimerRef.current = setTimeout(() => {
            fetchKeyFromProfile(false).then(success => {
                if (success) {
                    console.log("GristApiKeyManager: Single initial fetch attempt successful.");
                } else {
                    console.log("GristApiKeyManager: Single initial fetch attempt failed.");
                }
            });
        }, 100);
    } else {
        clearTimeout(internalFetchTimerRef.current);
    }
    
    return () => {
      clearTimeout(internalFetchTimerRef.current);
    };
  }, [apiKeyProp, fetchKeyFromProfile, initialAttemptFailed]);

  React.useImperativeHandle(ref, () => ({
    triggerFetchKeyFromProfile: () => {
        console.log("GristApiKeyManager: Parent triggered fetchKeyFromProfile.");
        clearTimeout(internalFetchTimerRef.current);
        return fetchKeyFromProfile(true);
    },
    stopRetrying: () => {
        console.log("GristApiKeyManager: Stopping any pending initial fetch.");
        clearTimeout(internalFetchTimerRef.current);
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
  const apiKeyRef = useRef(apiKey); 
  useEffect(() => {
    apiKeyRef.current = apiKey;
  }, [apiKey]);

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
  const pollingIntervalRef = useRef(null);
  const [initialApiKeyAttemptFailed, setInitialApiKeyAttemptFailed] = useState(false);

  const clearPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
        console.log("GristDynamicSelectorViewer: Polling interval cleared.");
    }
    localStorage.removeItem('gristLoginPopupOpen');
  }, []);

  const openGristLoginPopup = useCallback(() => {
    if (gristLoginPopupRef.current && !gristLoginPopupRef.current.closed) {
      gristLoginPopupRef.current.focus();
      return;
    }

    clearPolling(); 

    const loginUrl = `${GRIST_API_BASE_URL}/login`;
    const popup = window.open(loginUrl, 'GristLoginPopup', 'width=600,height=700,scrollbars=yes,resizable=yes,noopener,noreferrer');
    
    let popupFailed = false;
    let failureMessage = '';

    if (!popup) {
        popupFailed = true;
        failureMessage = '無法開啟 Grist 登入視窗，瀏覽器可能已將其完全阻擋。請檢查您的彈窗設定。';
    } else {
        try {
            // This access can fail due to cross-origin issues after a redirect,
            // or if the popup object isn't a true window object.
            if (popup.closed) {
                popupFailed = true;
                failureMessage = 'Grist 登入視窗開啟後立即關閉。請檢查是否有其他問題或設定導致此現象。';
                console.warn("GristDynamicSelectorViewer: Popup window was opened but found to be immediately closed.");
            }
            // If it's not null and not closed, try to focus it. If this fails, it might also indicate an issue.
            // else { popup.focus(); } // Focusing can also throw cross-origin errors if redirected.
        } catch (e) {
            popupFailed = true;
            failureMessage = '存取 Grist 登入視窗屬性時發生錯誤。這可能是由於跨網域重新導向或彈窗被部分阻擋。';
            console.error("GristDynamicSelectorViewer: Error accessing popup.closed or popup.focus. Popup may have redirected cross-origin or is not a valid window.", e);
        }
    }

    if (popupFailed) {
        setStatusMessage(failureMessage);
        setShowLoginPrompt(true); 
        localStorage.removeItem('gristLoginPopupOpen'); // Clean up
        if (popup && typeof popup.close === 'function') { // If popup object exists but we deemed it failed, try to close it.
            try { popup.close(); } catch (e) { /* ignore */ }
        }
        return;
    }

    // If we reach here, the popup is considered successfully initiated for polling.
    gristLoginPopupRef.current = popup;
    localStorage.setItem('gristLoginPopupOpen', 'true'); 
    setStatusMessage('請在新視窗中完成 Grist 登入。本頁面將嘗試自動檢測登入狀態。');
    setInitialApiKeyAttemptFailed(true); // Signal manager to be ready if needed
    setShowLoginPrompt(false);

    pollingIntervalRef.current = setInterval(async () => {
        const popupIsOpen = gristLoginPopupRef.current && !gristLoginPopupRef.current.closed;
        if (popupIsOpen) {
            if (apiKeyManagerRef.current) {
                console.log("GristDynamicSelectorViewer (Polling): Popup is open. Attempting to fetch API key.");
                await apiKeyManagerRef.current.triggerFetchKeyFromProfile();
            }
        } else {
            console.log("GristDynamicSelectorViewer (Polling): Popup is closed or not available. Clearing poll.");
            clearPolling();
        }
    }, API_KEY_RETRY_INTERVAL);

    const checkPopupClosedInterval = setInterval(() => {
        if (gristLoginPopupRef.current && gristLoginPopupRef.current.closed) {
            clearInterval(checkPopupClosedInterval);
            console.log("GristDynamicSelectorViewer: Login popup detected as closed by user (or auto-closed).");
            clearPolling(); 

            if (!apiKeyRef.current) { 
                setStatusMessage('Grist 登入視窗已關閉。API Key 可能未成功獲取。');
                setShowLoginPrompt(true);
            }
            gristLoginPopupRef.current = null;
        }
    }, 1000);
  }, [setStatusMessage, setInitialApiKeyAttemptFailed, setShowLoginPrompt, clearPolling]); 

  const handleApiKeyUpdate = useCallback((key, autoFetchedSuccess = false) => {
    console.log(`GristDynamicSelectorViewer: handleApiKeyUpdate with key: ${key ? '******' : '""'}, autoFetchedSuccess: ${autoFetchedSuccess}`);
    
    if (key) {
        setApiKey(key);
        localStorage.setItem('gristApiKey', key);
        setShowLoginPrompt(false);
        setInitialApiKeyAttemptFailed(false);
        clearPolling(); 

        if (autoFetchedSuccess && gristLoginPopupRef.current && !gristLoginPopupRef.current.closed) {
            try {
                gristLoginPopupRef.current.close();
                console.log("GristDynamicSelectorViewer: Attempted to close Grist login popup after auto fetch success.");
            } catch (e) {
                console.warn("GristDynamicSelectorViewer: Could not automatically close Grist login popup:", e);
            }
            gristLoginPopupRef.current = null;
        }
       
       if (autoFetchedSuccess) {
           setStatusMessage('API Key 自動獲取成功！正在準備加載數據...');
       } else {
           setStatusMessage('手動輸入的 API Key 已設定。正在準備加載數據...');
       }

    } else { 
        localStorage.removeItem('gristApiKey');
        setApiKey(''); 

        if (autoFetchedSuccess !== false) { 
             setStatusMessage('API Key 已清除或無法使用。');
        }
        
        if (!localStorage.getItem('gristLoginPopupOpen')) {
            setShowLoginPrompt(true);
        }
        setInitialApiKeyAttemptFailed(true);
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
  }, [clearPolling, setStatusMessage, setShowLoginPrompt, setInitialApiKeyAttemptFailed]); 

  useEffect(() => {
    const currentStoredApiKey = localStorage.getItem('gristApiKey');
    if (!currentStoredApiKey) {
      console.log("GristDynamicSelectorViewer: Initial mount - No API key. Setting initialAttemptFailed and showing prompt.");
      setInitialApiKeyAttemptFailed(true);
      setShowLoginPrompt(true); 
      
      if (localStorage.getItem('gristLoginPopupOpen') === 'true') {
        setStatusMessage("偵測到先前可能未完成的登入流程。請點擊按鈕重新嘗試登入。");
        localStorage.removeItem('gristLoginPopupOpen');
      }
    } else {
      console.log("GristDynamicSelectorViewer: Initial mount - API key found in localStorage. Setting initialAttemptFailed to false.");
      setApiKey(currentStoredApiKey);
      setInitialApiKeyAttemptFailed(false);
      setShowLoginPrompt(false);
    }
    
    return () => {
        clearPolling();
        if (gristLoginPopupRef.current && !gristLoginPopupRef.current.closed) {
            try { gristLoginPopupRef.current.close(); } catch (e) { /* ignore */ }
        }
    };
  }, [clearPolling]); // Added clearPolling to dependency array for completeness, though it's stable.

  const makeGristApiRequest = useCallback(async (endpoint, method = 'GET', params = null) => {
    if (!apiKey) { 
      console.warn("makeGristApiRequest: API Key is not set in state. Aborting request to", endpoint);
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
        setStatusMessage('API Key 已失效或無權限，請重新登入或設定新的 API Key。');
        handleApiKeyUpdate('', false); 
      }
      throw new Error(errorMsg);
    }
    return responseData;
  }, [apiKey, handleApiKeyUpdate, setStatusMessage]); 

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
          setDocuments([]); 
          throw new Error('未能獲取到有效的組織 ID。');
        }
      } catch (error) {
        console.error('useEffect (getOrgId): Error fetching org ID:', error);
        if (!String(error.message).includes('API Key 已失效')) {
            setStatusMessage(`獲取組織 ID 失敗: ${error.message}`);
        }
        setCurrentOrgId(null);
        setDocuments([]);
      } finally {
        setIsLoadingDocs(false);
      }
    };
    getOrgId();
  }, [apiKey, makeGristApiRequest, setStatusMessage]);

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
        if (Array.isArray(workspacesData)) { 
            workspacesData.forEach(workspace => {
              if (workspace.docs && Array.isArray(workspace.docs)) {
                workspace.docs.forEach(doc => {
                  docNameCounts[doc.name] = (docNameCounts[doc.name] || 0) + 1;
                  allDocs.push({ id: doc.id, name: doc.name, workspaceName: workspace.name, workspaceId: workspace.id });
                });
              }
            });
        } else {
            console.warn("useEffect (fetchDocs): workspacesData is not an array:", workspacesData);
        }

        const processedDocs = allDocs.map(doc => ({
            ...doc,
            displayName: docNameCounts[doc.name] > 1 ? `${doc.name} (${doc.workspaceName})` : doc.name
        }));
        
        processedDocs.sort((a, b) => a.displayName.localeCompare(b.displayName));


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
  }, [currentOrgId, apiKey, makeGristApiRequest, setStatusMessage]);

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
      const docName = documents.find(d => d.id === selectedDocId)?.displayName || selectedDocId;
      setStatusMessage(`正在獲取文檔 "${docName}" 的表格列表...`);
      setDataError('');
      try {
        const data = await makeGristApiRequest(`/api/docs/${selectedDocId}/tables`);
        console.log("useEffect (fetchTables): Tables data fetched:", data);
        const tableList = data.tables || (Array.isArray(data) ? data : []); 
        if (Array.isArray(tableList)) {
          const formattedTables = tableList.map(table => ({ id: table.id, name: table.id }));
          formattedTables.sort((a,b) => a.name.localeCompare(b.name));
          setTables(formattedTables);
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
  }, [selectedDocId, apiKey, makeGristApiRequest, setStatusMessage, documents]);

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
          data.records.forEach(rec => { 
            if (rec.fields) Object.keys(rec.fields).forEach(key => allCols.add(key)); 
          });
          let sortedCols = Array.from(allCols);
          sortedCols.sort((a,b) => a.localeCompare(b));
          setColumns(sortedCols);

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
  }, [apiKey, selectedDocId, selectedTableId, makeGristApiRequest, filterQuery, sortQuery, setStatusMessage]);


  return (
    <div style={{ padding: '25px', fontFamily: theme.fontFamily, fontSize: theme.fontSizeBase, lineHeight: theme.lineHeightBase, color: theme.textColor, backgroundColor: theme.backgroundColor, maxWidth: '1000px', margin: '20px auto', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', borderRadius: '8px', }}>
      <h1 style={{ color: theme.textColor, textAlign: 'center', marginBottom: '15px', fontSize: '28px', }}>
        Grist 數據動態選擇查看器
      </h1>
      <p style={{ textAlign: 'center', color: theme.textColorSubtle, fontSize: theme.fontSizeSmall, marginBottom: '25px' }}>
        API 目標: <code>{GRIST_API_BASE_URL}</code> (目標組織域名: <code>{TARGET_ORG_DOMAIN || '未指定'}</code>)
      </p>

      {statusMessage && ( <p style={{ padding: '12px 15px', backgroundColor: statusMessage.includes('失敗') || statusMessage.includes('錯誤') || statusMessage.includes('尚未登入') || statusMessage.includes('已失效') || statusMessage.includes('無法使用') || statusMessage.includes('阻擋') || statusMessage.includes('關閉') ? theme.errorColorBg : theme.successColorBg, border: `1px solid ${statusMessage.includes('失敗') || statusMessage.includes('錯誤') || statusMessage.includes('尚未登入') || statusMessage.includes('已失效') || statusMessage.includes('無法使用') || statusMessage.includes('阻擋') || statusMessage.includes('關閉') ? theme.errorColor : theme.successColor}`, color: statusMessage.includes('失敗') || statusMessage.includes('錯誤') || statusMessage.includes('尚未登入') || statusMessage.includes('已失效') || statusMessage.includes('無法使用') || statusMessage.includes('阻擋') || statusMessage.includes('關閉') ? theme.errorColor : theme.successColor, marginTop: '10px', marginBottom: '20px', borderRadius: theme.borderRadius, fontSize: theme.fontSizeSmall, textAlign: 'center', }}> {statusMessage} </p> )}

      <GristApiKeyManager
        ref={apiKeyManagerRef}
        apiKey={apiKey}
        onApiKeyUpdate={handleApiKeyUpdate}
        onStatusUpdate={setStatusMessage}
        initialAttemptFailed={initialAttemptFailed}
      />

      {showLoginPrompt && !apiKey && (
        <div style={{ padding: '20px', margin: '20px 0', border: `1px solid ${theme.errorColor}`, borderRadius: theme.borderRadius, textAlign: 'center', backgroundColor: theme.errorColorBg, }}>
          <p style={{ color: theme.errorColor, margin: '0 0 15px 0', fontWeight: '500' }}>
            您似乎尚未登入 Grist，或者 API Key 無法自動獲取。請點擊下方按鈕登入或重試。
          </p>
          <button onClick={openGristLoginPopup} style={{ padding: '10px 15px', marginRight: '10px', fontSize: theme.fontSizeBase, backgroundColor: theme.primaryColor, color: theme.primaryColorText, border: 'none', borderRadius: theme.borderRadius, cursor: 'pointer', }} >
            開啟 Grist 登入視窗
          </button>
          <button 
            onClick={() => apiKeyManagerRef.current && apiKeyManagerRef.current.triggerFetchKeyFromProfile()}
            disabled={!apiKeyManagerRef.current} 
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
                setColumns([]);
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
                    setColumns([]);
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
                <th style={{backgroundColor: '#e9ecef', padding: '12px 10px', textAlign: 'left', color: theme.textColor, fontWeight: '600', borderBottom: `2px solid ${theme.borderColor}`, position: 'sticky', top: 0, left: 0, zIndex: 2}}>id</th>
                {columns.map((col) => (<th key={col} style={{backgroundColor: '#e9ecef', padding: '12px 10px', textAlign: 'left', color: theme.textColor, fontWeight: '600', borderBottom: `2px solid ${theme.borderColor}`, position: 'sticky', top: 0, zIndex: 1}}>{col}</th>))}
              </tr>
            </thead>
            <tbody>
              {tableData.map((record, rowIndex) => (
                <tr key={record.id} style={{ backgroundColor: rowIndex % 2 === 0 ? '#fff' : theme.surfaceColor , borderBottom: `1px solid ${theme.borderColor}` }}>
                  <td style={{ padding: '10px', whiteSpace: 'nowrap', color: theme.textColorLight, position: 'sticky', left: 0, backgroundColor: rowIndex % 2 === 0 ? '#fff' : theme.surfaceColor, zIndex: 1, borderRight: `1px solid ${theme.borderColor}` }}>{record.id}</td>
                  {columns.map((col) => (
                    <td key={`${record.id}-${col}`} style={{ padding: '10px', whiteSpace: 'nowrap', color: theme.textColorLight }}>
                      {record.fields && typeof record.fields[col] !== 'undefined' && record.fields[col] !== null
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