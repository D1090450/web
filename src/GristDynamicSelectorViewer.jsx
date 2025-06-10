// src/GristDynamicSelectorViewer.jsx
import React, { useState, useCallback, useEffect, useRef } from 'react';

const GRIST_API_BASE_URL = 'https://tiss-grist.fcuai.tw';
const TARGET_ORG_DOMAIN = 'fcuai.tw';
const API_KEY_RETRY_INTERVAL = 200;

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
    if (isFetching && !isRetry) return false; // 返回 Promise<boolean>

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
      onApiKeyUpdate('', false); // false for autoFetchedSuccess
      return false;
    } finally {
      setIsFetching(false);
    }
  }, [onApiKeyUpdate, onStatusUpdate]); // isFetching 移除，因為它在函數內部管理

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
    if (apiKeyProp) { // 如果父組件已經有 apiKey，則清除定時器
        clearTimeout(retryTimerRef.current);
        return;
    }

    if (initialAttemptFailed && !apiKeyProp) { // 只有在父組件指示初次嘗試失敗且當前沒有key時才啟動
        console.log("GristApiKeyManager: Initial attempt failed, starting fetch/retry logic.");
        // 立即嘗試一次
        fetchKeyFromProfile(false).then(success => { // isRetry = false for the first call in this effect
            if (!success) { // 如果這次嘗試仍然失敗，則啟動定時器
                if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
                retryTimerRef.current = setTimeout(function zichzelf() {
                    console.log("GristApiKeyManager: Retrying to fetch API key...");
                    fetchKeyFromProfile(true).then(retrySuccess => { // isRetry = true for subsequent calls
                        if (!retrySuccess && localStorage.getItem('gristLoginPopupOpen') === 'true') {
                            retryTimerRef.current = setTimeout(zichzelf, API_KEY_RETRY_INTERVAL);
                        } else if (retrySuccess) {
                            localStorage.removeItem('gristLoginPopupOpen');
                        } else if (!localStorage.getItem('gristLoginPopupOpen')) {
                            // 如果彈窗沒開，且重試失敗，則不再繼續重試，避免無限循環
                            console.log("GristApiKeyManager: Popup not open and retry failed, stopping retries.");
                            clearTimeout(retryTimerRef.current);
                        }
                    });
                }, API_KEY_RETRY_INTERVAL);
            }
        });
    } else {
        // 如果不滿足重試條件 (例如 initialAttemptFailed 為 false)，確保清除任何可能的舊定時器
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
        return fetchKeyFromProfile(false); // isRetry = false when manually triggered
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

  // handleApiKeyUpdate 的 useCallback 依賴項應為空，或者只包含 setter 函數
  const handleApiKeyUpdate = useCallback((key, autoFetchedSuccess = false) => {
    console.log(`GristDynamicSelectorViewer: handleApiKeyUpdate called with key: ${key ? '******' : '""'}, autoFetchedSuccess: ${autoFetchedSuccess}`);
    setApiKey(key); // setApiKey 是穩定的
    if (key) {
      localStorage.setItem('gristApiKey', key);
      setShowLoginPrompt(false); // setShowLoginPrompt 是穩定的
      setInitialApiKeyAttemptFailed(false); // setInitialApiKeyAttemptFailed 是穩定的

      if (autoFetchedSuccess && gristLoginPopupRef.current && !gristLoginPopupRef.current.closed) {
        try {
            gristLoginPopupRef.current.close();
            localStorage.removeItem('gristLoginPopupOpen');
            console.log("GristDynamicSelectorViewer: Attempted to close Grist login popup.");
        } catch (e) {
            console.warn("GristDynamicSelectorViewer: Could not automatically close Grist login popup:", e);
            setStatusMessage("Grist 登入成功！您可以手動關閉登入視窗。"); // setStatusMessage 是穩定的
        }
        gristLoginPopupRef.current = null;
      }
       // 只有在訊息確實需要更新時才更新，避免不必要的 statusMessage 變化觸發 makeGristApiRequest (如果它錯誤地依賴了 statusMessage)
       if (autoFetchedSuccess) {
           setStatusMessage(prev => prev.includes('API Key 自動獲取成功！') ? prev : 'API Key 自動獲取成功！正在準備加載數據...');
       } else {
           setStatusMessage(prev => prev.includes('手動輸入的 API Key 已設定') ? prev : 'API Key 已設定。正在準備加載數據...');
       }

    } else {
      localStorage.removeItem('gristApiKey');
      if (!autoFetchedSuccess) {
        setShowLoginPrompt(true);
      }
      // 只有在非自動重試失敗（例如初始失敗或手動清除）時才立即設置為true
      // 如果是自動重試循環中的失敗，則 GristApiKeyManager 內部會處理重試，這裡不需要再次強制
      // 關鍵是 GristApiKeyManager 的 initialAttemptFailed prop
      // 當用戶打開彈窗時，我們會明確設置 initialAttemptFailed = true
      if (!localStorage.getItem('gristLoginPopupOpen') && !autoFetchedSuccess) {
          setInitialApiKeyAttemptFailed(true);
      } else if (localStorage.getItem('gristLoginPopupOpen')) {
          // 如果彈窗開著，保持 initialApiKeyAttemptFailed 為 true 以便 GristApiKeyManager 繼續嘗試
          setInitialApiKeyAttemptFailed(true);
      }
      setStatusMessage(prev => prev.includes('API Key 獲取失敗或已清除') ? prev : 'API Key 獲取失敗或已清除。');
    }
    // 清理後續數據狀態
    setCurrentOrgId(null);
    setDocuments([]);
    setSelectedDocId('');
    setTables([]);
    setSelectedTableId('');
    setTableData(null);
    setFilterQuery('');
    setSortQuery('');
    setDataError('');
  }, []); // 依賴項為空，因為所有內部調用的都是 state setters，它們是穩定的

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

    const responseData = await response.json().catch(async () => { // 修改這裡以處理非 JSON 響應
      const text = await response.text();
      throw new Error(`HTTP error ${response.status}: ${text || response.statusText} (Non-JSON response)`);
    });

    if (!response.ok) {
      const errorMsg = responseData?.error?.message || responseData?.error || responseData?.message || `HTTP error ${response.status}`;
      console.error(`Grist API Error for ${method} ${url}:`, responseData);
      if (response.status === 401 || response.status === 403) {
        // API Key 失效，觸發重新登入/API Key 清除流程
        handleApiKeyUpdate(''); // 清除 API Key
      }
      throw new Error(errorMsg);
    }
    return responseData;
  }, [apiKey, handleApiKeyUpdate]); // 關鍵：makeGristApiRequest 只應依賴 apiKey 和穩定的 handleApiKeyUpdate

  // 獲取組織 ID
  useEffect(() => {
    if (!apiKey) {
      console.log("useEffect (getOrgId): No API Key, skipping.");
      setCurrentOrgId(null); // 確保 apiKey 為空時，orgId 也清空
      setDocuments([]); // 同時清空文檔
      return;
    }
    console.log("useEffect (getOrgId): API Key present, attempting to fetch org ID.");
    const getOrgId = async () => {
      setIsLoadingDocs(true); // 開始加載的總指示器
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
        } else if (orgsData && orgsData.id) { // 如果 /api/orgs 直接返回單個組織對象
            determinedOrgId = orgsData.id;
        }

        if (determinedOrgId) {
          console.log("useEffect (getOrgId): Determined Org ID:", determinedOrgId);
          setCurrentOrgId(determinedOrgId);
          // 不要在這裡設置 isLoadingDocs(false)，讓下一個 effect 控制
        } else {
          throw new Error('未能獲取到有效的組織 ID。');
        }
      } catch (error) {
        console.error('useEffect (getOrgId): Error fetching org ID:', error);
        setStatusMessage(`獲取組織 ID 失敗: ${error.message}`);
        setCurrentOrgId(null); // 清空 orgId
        setDocuments([]); // 清空文檔
        setIsLoadingDocs(false); // 出錯時結束加載
      }
    };
    getOrgId();
  }, [apiKey, makeGristApiRequest]); // 只依賴 apiKey 和穩定的 makeGristApiRequest

  // 獲取文檔列表
  useEffect(() => {
    if (!currentOrgId || !apiKey) { // 增加 !apiKey 判斷
      console.log("useEffect (fetchDocs): No currentOrgId or no API Key, skipping.");
      setDocuments([]); // 確保 currentOrgId 或 apiKey 為空時，文檔列表也清空
      return;
    }
    console.log("useEffect (fetchDocs): currentOrgId present, attempting to fetch documents for org:", currentOrgId);
    const fetchDocsFromWorkspaces = async () => {
      setIsLoadingDocs(true); // 確保在請求前設置
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
  }, [currentOrgId, apiKey, makeGristApiRequest]); // 只依賴 currentOrgId, apiKey 和穩定的 makeGristApiRequest

  // 獲取表格列表
  useEffect(() => {
    if (!selectedDocId || !apiKey) { // 增加 !apiKey 判斷
      console.log("useEffect (fetchTables): No selectedDocId or no API Key, skipping.");
      setTables([]);
      setSelectedTableId(''); // 清空選定的表格ID
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
  }, [selectedDocId, apiKey, makeGristApiRequest]); // 只依賴 selectedDocId, apiKey 和穩定的 makeGristApiRequest

  // 獲取表格數據 (按鈕觸發)
  const handleFetchTableData = useCallback(async () => {
    if (!apiKey || !selectedDocId || !selectedTableId) {
      setDataError('請先設定 API Key 並選擇文檔和表格。');
      return;
    }
    setIsLoadingData(true);
    // ... (rest of the logic is fine as it's user-triggered)
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
  }, [apiKey, selectedDocId, selectedTableId, makeGristApiRequest, filterQuery, sortQuery]); // makeGristApiRequest 應是穩定的

  const openGristLoginPopup = useCallback(() => {
    if (gristLoginPopupRef.current && !gristLoginPopupRef.current.closed) {
      gristLoginPopupRef.current.focus();
      return;
    }
    const loginUrl = `${GRIST_API_BASE_URL}/login`;
    gristLoginPopupRef.current = window.open(loginUrl, 'GristLoginPopup', 'width=600,height=700,scrollbars=yes,resizable=yes,noreferrer');
    console.log('創視窗:', gristLoginPopupRef.current);
    localStorage.setItem('gristLoginPopupOpen', 'true'); 
    setStatusMessage('請在新視窗中完成 Grist 登入。本頁面將嘗試自動檢測登入狀態。');
    setInitialApiKeyAttemptFailed(true); 

    let popupOpenLogCounter = 0; // <--- 新增一個計數器

    const checkPopupClosedInterval = setInterval(() => {
        if (gristLoginPopupRef.current) {
            // 彈窗仍然開啟
            popupOpenLogCounter++;
            if (popupOpenLogCounter % 2 === 0) { // 定時器每秒觸發，所以計數器逢2的倍數時即為每2秒
              console.log('計時器內: ',gristLoginPopupRef.current)
                if (apiKeyManagerRef.current) {
                    apiKeyManagerRef.current.stopRetrying();
                    console.log('Grist 登入彈窗目前是開啟狀態 (每2秒檢測一次)');
                }
            }
        } else {
            // 彈窗已關閉或不存在
            clearInterval(checkPopupClosedInterval);
            localStorage.removeItem('gristLoginPopupOpen');
            gristLoginPopupRef.current = null;
            if (!apiKey) { // 檢查 apiKey state，而不是直接讀 localStorage
                setStatusMessage('Grist 登入視窗已關閉。如果尚未登入，請點擊下方按鈕重試。');
                if (apiKeyManagerRef.current) {
                    apiKeyManagerRef.current.stopRetrying();
                }
            }
            // popupOpenLogCounter 會隨著 openGristLoginPopup 函數作用域結束而自然消失，
            // 或者在下次 openGristLoginPopup 被調用時重置。
        }
    }, 1000); // 定時器每 1000ms (1秒) 執行一次
  }, [apiKey, setStatusMessage, setInitialApiKeyAttemptFailed]);

  // 初始加載時，如果 localStorage 和 state 中都沒有 key，則設置 initialApiKeyAttemptFailed
  useEffect(() => {
    console.log("GristDynamicSelectorViewer: Initial mount/apiKey check.");
    if (!localStorage.getItem('gristApiKey') && !apiKey) {
      console.log("GristDynamicSelectorViewer: No API key found locally or in state, setting initialAttemptFailed to true.");
      setInitialApiKeyAttemptFailed(true);
    } else if (apiKey) { // 如果已有 apiKey (例如從 localStorage 成功加載)
      console.log("GristDynamicSelectorViewer: API key already present, setting initialAttemptFailed to false.");
      setInitialApiKeyAttemptFailed(false); // 確保不會觸發不必要的初次獲取
    }
  }, []); // 空依賴，僅在組件首次掛載時執行


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
        apiKey={apiKey} // Pass the current apiKey state
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