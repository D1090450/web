// src/GristDynamicSelectorViewer.jsx
import React, { useState, useCallback, useEffect, useRef } from 'react';

const GRIST_API_BASE_URL = 'https://tiss-grist.fcuai.tw';
const GRIST_LOGIN_URL = `${GRIST_API_BASE_URL}/login`; // Grist 登入頁面
const TARGET_ORG_DOMAIN = 'fcuai.tw';
const API_KEY_RETRY_INTERVAL = 3000;

// Authentik 配置
const AUTHENTIK_BASE_URL = 'https://tiss-auth.fcuai.tw/';
const AUTHENTIK_CLIENT_ID = 'UsuTQscAoU0Pgju33QOHj3XFLjbcdGg5cs2htpfE';

// 特殊 Hash 標記
const GRIST_SSO_COMPLETE_HASH = '#grist_sso_complete';

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

function generateRandomString(length) {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

const GristApiKeyManager = React.forwardRef(({ apiKey: apiKeyProp, onApiKeyUpdate, onStatusUpdate, initialAttemptFailed }, ref) => {
  const [localApiKey, setLocalApiKey] = useState(apiKeyProp || '');
  const [isFetching, setIsFetching] = useState(false);
  const retryTimerRef = useRef(null);

  const fetchKeyFromProfile = useCallback(async (isRetry = false) => {
    if (isFetching && !isRetry && !apiKeyProp) return false;

    setIsFetching(true);
    if (!isRetry) {
        onStatusUpdate('正在從 Grist 個人資料獲取 API Key (Grist 會話應已建立)...');
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
        throw new Error(`HTTP ${response.status}: ${responseText || '無法獲取 Grist API Key。請確認 Grist 已透過 Authentik 成功登入。'}`);
      }
      const fetchedKey = responseText.trim();
      if (!fetchedKey || fetchedKey.includes('<') || fetchedKey.length < 32) {
        throw new Error('從 Grist 獲取到的 API Key 似乎無效。');
      }
      setLocalApiKey(fetchedKey);
      onApiKeyUpdate(fetchedKey, true);
      onStatusUpdate('Grist API Key 自動獲取成功！');
      clearTimeout(retryTimerRef.current);
      return true;
    } catch (error) {
      console.error("GristApiKeyManager: Error fetching Grist API key:", error.message);
      if (!isRetry) {
        onStatusUpdate(`自動獲取 Grist API Key 失敗: ${error.message}.`);
      }
      return false;
    } finally {
      setIsFetching(false);
    }
  }, [onApiKeyUpdate, onStatusUpdate, apiKeyProp]);

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
        console.log("GristApiKeyManager: `initialAttemptFailed` is true and no `apiKeyProp`, attempting to fetch Grist key.");
        fetchKeyFromProfile(false).then(success => {
            if (!success && !apiKeyProp) {
                if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
                retryTimerRef.current = setTimeout(function retry() {
                    console.log("GristApiKeyManager: Retrying to fetch Grist API key...");
                    if (!apiKeyProp) {
                        fetchKeyFromProfile(true).then(retrySuccess => {
                            if (!retrySuccess && !apiKeyProp) {
                                retryTimerRef.current = setTimeout(retry, API_KEY_RETRY_INTERVAL);
                            }
                        });
                    }
                }, API_KEY_RETRY_INTERVAL);
            }
        });
    } else {
        clearTimeout(retryTimerRef.current);
    }
    return () => {
      clearTimeout(retryTimerRef.current);
    };
  }, [apiKeyProp, initialAttemptFailed, fetchKeyFromProfile]);

  React.useImperativeHandle(ref, () => ({
    triggerFetchKeyFromProfile: () => {
        console.log("GristApiKeyManager: Manually triggered fetchKeyFromProfile via ref.");
        clearTimeout(retryTimerRef.current);
        return fetchKeyFromProfile(false);
    },
    stopRetrying: () => {
        console.log("GristApiKeyManager: Stopping retries via ref.");
        clearTimeout(retryTimerRef.current);
    }
  }));

  return (
    <div style={{ marginBottom: '20px', padding: '15px', border: `1px dashed ${theme.borderColor}`, borderRadius: theme.borderRadius, backgroundColor: theme.surfaceColor }}>
      <h4 style={{ marginTop: '0', marginBottom: '10px', color: theme.textColor }}>API Key 管理 (備用)</h4>
      <p style={{ fontSize: theme.fontSizeSmall, color: theme.textColorSubtle, marginBottom: '15px' }}>
        正常情況下，API Key 會在您通過 Authentik 和 Grist 登入後自動獲取。如果自動獲取失敗，您才需要在此手動輸入。
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
  const [apiKey, setApiKey] = useState('');
  const [statusMessage, setStatusMessage] = useState('正在初始化應用程式...');
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
  
  const [showManualKeyInput, setShowManualKeyInput] = useState(false);
  const apiKeyManagerRef = useRef(null);
  const [isRedirecting, setIsRedirecting] = useState(false); // 通用重定向標誌
  const [triggerManagerInitialFetch, setTriggerManagerInitialFetch] = useState(false);
  const [initialAuthCheckComplete, setInitialAuthCheckComplete] = useState(false);


  const handleApiKeyUpdate = useCallback((key, autoFetchedSuccess = false) => {
    console.log(`GristDynamicSelectorViewer: handleApiKeyUpdate called with key: ${key ? '******' : '""'}, autoFetchedSuccess: ${autoFetchedSuccess}`);
    setApiKey(key);
    if (key) {
      localStorage.setItem('gristApiKey', key);
      setShowManualKeyInput(false); 
      setTriggerManagerInitialFetch(false); 

      if (autoFetchedSuccess) {
        setStatusMessage('Grist API Key 自動獲取成功！正在準備加載數據...');
      } else {
        setStatusMessage('Grist API Key 已設定。正在準備加載數據...');
      }
    } else {
      localStorage.removeItem('gristApiKey');
      setShowManualKeyInput(true); // API Key 獲取失敗或清除，顯示手動輸入
      setStatusMessage('Grist API Key 獲取失敗或已清除。請嘗試重新整理頁面以重新登入，或手動提供 API Key。');
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
      throw new Error('API Key 未設定，無法發送請求。');
    }
    console.log(`makeGristApiRequest: Fetching ${endpoint} with apiKey.`);
    let url = `${GRIST_API_BASE_URL}${endpoint}`;
    const queryParams = new URLSearchParams();
    if (params) for (const key in params) if (params[key] !== undefined && params[key] !== null && params[key] !== '') queryParams.append(key, params[key]);
    if (queryParams.toString()) url += `?${queryParams.toString()}`;

    const response = await fetch(url, {
      method,
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json', 'Content-Type': method !== 'GET' ? 'application/json' : undefined, },
    });

    if (!response.ok) {
      let responseData;
      try { responseData = await response.json(); } catch (e) { const text = await response.text(); throw new Error(`HTTP error ${response.status}: ${text || response.statusText} (Non-JSON response)`); }
      const errorMsg = responseData?.error?.message || responseData?.error || responseData?.message || `HTTP error ${response.status}`;
      console.error(`Grist API Error for ${method} ${url}:`, responseData);
      if (response.status === 401 || response.status === 403) {
        setStatusMessage(`API Key 已失效或無權限 (${response.status})。請重新整理頁面以重新登入。`);
        handleApiKeyUpdate('');
      }
      throw new Error(errorMsg);
    }
    if (response.headers.get("content-type")?.includes("application/json")) return response.json();
    return response.text();
  }, [apiKey, handleApiKeyUpdate]);

  const redirectToAuthentik = useCallback(() => {
    if (isRedirecting) return;
    setIsRedirecting(true);
    setStatusMessage('正在重定向到 Authentik 登入頁面...');
    const authParams = new URLSearchParams({
      response_type: 'token', client_id: AUTHENTIK_CLIENT_ID,
      redirect_uri: window.location.origin + window.location.pathname, // Authentik 成功後返回到當前應用頁面
      scope: 'openid profile email', state: generateRandomString(32)
    });
    const cleanAuthentikBaseUrl = AUTHENTIK_BASE_URL.endsWith('/') ? AUTHENTIK_BASE_URL : AUTHENTIK_BASE_URL + '/';
    const loginUrl = `${cleanAuthentikBaseUrl}application/o/authorize/?${authParams.toString()}`;
    console.log("Redirecting to Authentik:", loginUrl);
    window.location.href = loginUrl;
  }, [isRedirecting]);

  const redirectToGristLoginForSSO = useCallback(() => {
    if (isRedirecting) return;
    setIsRedirecting(true);
    setStatusMessage('Authentik 成功，正在重定向到 Grist 以完成 SSO 登入...');
    // Grist 登入成功後，需要跳轉回我們的應用，並帶上一個特殊標記
    const nextUrlForGrist = window.location.origin + window.location.pathname + GRIST_SSO_COMPLETE_HASH;
    const gristLoginRedirectUrl = `${GRIST_LOGIN_URL}?next=${encodeURIComponent(nextUrlForGrist)}`;
    console.log("Redirecting to Grist login for SSO:", gristLoginRedirectUrl);
    window.location.href = gristLoginRedirectUrl;
  }, [isRedirecting]);

  // 初始認證流程
  useEffect(() => {
    if (initialAuthCheckComplete || isRedirecting) return;

    console.log("GristDynamicSelectorViewer: Performing initial authentication check.");
    const currentHash = window.location.hash;
    const paramsInHash = new URLSearchParams(currentHash.substring(1));
    const accessTokenFromUrl = paramsInHash.get('access_token');
    const errorFromUrl = paramsInHash.get('error');

    if (currentHash === GRIST_SSO_COMPLETE_HASH) { // 步驟 3: 從 Grist SSO 返回
      console.log("Returned from Grist SSO. Attempting to fetch Grist API Key.");
      window.location.hash = ''; // 清理 hash
      setStatusMessage('Grist SSO 完成。正在嘗試獲取 Grist API Key...');
      setTriggerManagerInitialFetch(true); // 觸發 GristApiKeyManager 獲取 Key
      setShowManualKeyInput(false);
      setInitialAuthCheckComplete(true);
    } else if (accessTokenFromUrl) { // 步驟 2: 從 Authentik 成功返回
      console.log("Returned from Authentik with access token. Redirecting to Grist for SSO.");
       window.location.hash = ''; // 清理 hash (或者只移除 access_token 等參數)
      // 不需要儲存 accessTokenFromUrl，因為 Grist 的 SSO 會依賴 Authentik 的 session
      redirectToGristLoginForSSO();
      // 此處不設定 initialAuthCheckComplete，因為流程尚未結束
    } else if (errorFromUrl) { // 從 Authentik 返回時出錯
      console.error("Authentik login error:", errorFromUrl, paramsInHash.get('error_description'));
      window.location.hash = ''; // 清理 hash
      setStatusMessage(`Authentik 登入失敗: ${paramsInHash.get('error_description') || errorFromUrl}. 您可以嘗試手動輸入 API Key 或重新整理以重試。`);
      setShowManualKeyInput(true);
      setTriggerManagerInitialFetch(false);
      setInitialAuthCheckComplete(true); // 認證流程（雖然失敗）已告一段落
    } else { // 步驟 1: 初始加載，或 localStorage 有 key
      const storedApiKey = localStorage.getItem('gristApiKey');
      if (storedApiKey) {
        console.log("Found API key in localStorage. Using it.");
        handleApiKeyUpdate(storedApiKey, false);
        setTriggerManagerInitialFetch(false);
        setShowManualKeyInput(false);
        setInitialAuthCheckComplete(true);
      } else {
        console.log("No API key in localStorage, not returning from Authentik or Grist. Redirecting to Authentik.");
        redirectToAuthentik();
        // 此處不設定 initialAuthCheckComplete，因為流程尚未結束
      }
    }
  }, [initialAuthCheckComplete, isRedirecting, redirectToAuthentik, redirectToGristLoginForSSO, handleApiKeyUpdate]);

  // --- 後續的 useEffects (獲取組織、文檔、表格等) 保持不變，但它們的執行會依賴 apiKey 和 initialAuthCheckComplete ---
  useEffect(() => {
    if (!apiKey || !initialAuthCheckComplete) {
      setCurrentOrgId(null); setDocuments([]); return;
    }
    // ... (獲取組織 ID 的邏輯)
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
  }, [apiKey, makeGristApiRequest, initialAuthCheckComplete]); 

  useEffect(() => {
    if (!currentOrgId || !apiKey || !initialAuthCheckComplete) { 
      setDocuments([]); return;
    }
    // ... (獲取文檔列表的邏輯)
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
        }
        
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
  }, [currentOrgId, apiKey, makeGristApiRequest, initialAuthCheckComplete]);

  useEffect(() => {
    if (!selectedDocId || !apiKey || !initialAuthCheckComplete) { 
      setTables([]); setSelectedTableId(''); return;
    }
    // ... (獲取表格列表的邏輯)
        console.log("useEffect (fetchTables): selectedDocId present, attempting to fetch tables for doc:", selectedDocId);
    const fetchTables = async () => {
      setIsLoadingTables(true);
      const docName = documents.find(d=>d.id === selectedDocId)?.displayName || selectedDocId;
      setStatusMessage(`正在獲取文檔 "${docName}" 的表格列表...`);
      setDataError('');
      try {
        const data = await makeGristApiRequest(`/api/docs/${selectedDocId}/tables`);
        console.log("useEffect (fetchTables): Tables data fetched:", data);
        const tableList = data.tables || (Array.isArray(data) ? data : []);
        if (Array.isArray(tableList)) {
          setTables(tableList.map(table => ({ id: table.id, name: table.tableId || table.id })));
          setStatusMessage(tableList.length > 0 ? '表格列表獲取成功。' : '該文檔中未找到表格。');
        } else { throw new Error('表格列表格式不正確。'); }
      } catch (error) {
        console.error('useEffect (fetchTables): Error fetching tables:', error);
        setStatusMessage(`獲取表格列表失敗: ${error.message}`);
        setTables([]);
      } finally { setIsLoadingTables(false); }
    };
    fetchTables();
  }, [selectedDocId, apiKey, makeGristApiRequest, initialAuthCheckComplete, documents]);

  const handleFetchTableData = useCallback(async () => {
    // ... (獲取表格數據的邏輯，無需大改)
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

  return (
    <div style={{ padding: '25px', fontFamily: theme.fontFamily, fontSize: theme.fontSizeBase, lineHeight: theme.lineHeightBase, color: theme.textColor, backgroundColor: theme.backgroundColor, maxWidth: '1000px', margin: '20px auto', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', borderRadius: '8px', }}>
      <h1 style={{ color: theme.textColor, textAlign: 'center', marginBottom: '15px', fontSize: '28px', }}>
        Grist 數據動態選擇查看器
      </h1>
      <p style={{ textAlign: 'center', color: theme.textColorSubtle, fontSize: theme.fontSizeSmall, marginBottom: '25px' }}>
        API 目標: <code>{GRIST_API_BASE_URL}</code> (目標組織域名: <code>{TARGET_ORG_DOMAIN || '未指定'}</code>)
      </p>

      {statusMessage && ( 
        <p style={{ 
          padding: '12px 15px', 
          backgroundColor: statusMessage.includes('失敗') || statusMessage.includes('錯誤') || statusMessage.includes('尚未登入') || statusMessage.includes('無效') ? theme.errorColorBg : theme.successColorBg, 
          border: `1px solid ${statusMessage.includes('失敗') || statusMessage.includes('錯誤') || statusMessage.includes('尚未登入') || statusMessage.includes('無效') ? theme.errorColor : theme.successColor}`, 
          color: statusMessage.includes('失敗') || statusMessage.includes('錯誤') || statusMessage.includes('尚未登入') || statusMessage.includes('無效') ? theme.errorColor : theme.successColor, 
          marginTop: '10px', 
          marginBottom: '20px', 
          borderRadius: theme.borderRadius, 
          fontSize: theme.fontSizeSmall, 
          textAlign: 'center', 
        }}> 
          {statusMessage} 
        </p> 
      )}
      
      {/* GristApiKeyManager 僅在 showManualKeyInput 為 true 時，或在 triggerManagerInitialFetch 為 true 且沒有 apiKey 時被指示嘗試獲取 */}
      {(showManualKeyInput || (triggerManagerInitialFetch && !apiKey)) && (
        <GristApiKeyManager
            ref={apiKeyManagerRef}
            apiKey={apiKey}
            onApiKeyUpdate={handleApiKeyUpdate}
            onStatusUpdate={setStatusMessage}
            initialAttemptFailed={triggerManagerInitialFetch && !apiKey}
        />
      )}
      
      {/* Authentik 登入按鈕不再直接顯示，因為流程是自動的。除非認證徹底失敗，才考慮顯示一個重試按鈕。 */}
      {/* 現在，如果沒有 API Key 且認證流程卡住或失敗，會顯示手動輸入區域。重新整理頁面會重啟認證流程。 */}

      {apiKey && initialAuthCheckComplete && (
        <div style={{ marginTop: '25px', padding: '20px', border: `1px solid ${theme.borderColor}`, borderRadius: theme.borderRadius, backgroundColor: theme.surfaceColor, }}>
          {/* ... (選擇文檔、表格、數據獲取選項的 UI 保持不變) ... */}
          <h3 style={{ marginTop: '0', marginBottom: '20px', color: theme.textColor, borderBottom: `1px solid ${theme.borderColor}`, paddingBottom: '10px' }}>選擇數據源</h3>
          <div style={{ marginBottom: '15px' }}>
            <label htmlFor="docSelect" style={{ display: 'block', marginBottom: '8px', color: theme.textColorLight, fontSize: theme.fontSizeSmall, fontWeight: '500' }}>選擇文檔:</label>
            <select id="docSelect" value={selectedDocId} 
              onChange={(e) => { setSelectedDocId(e.target.value); setSelectedTableId(''); setTableData(null); setFilterQuery(''); setSortQuery(''); setDataError(''); }} 
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
                onChange={(e) => { setSelectedTableId(e.target.value); setTableData(null); setFilterQuery(''); setSortQuery(''); setDataError(''); }} 
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

      {apiKey && initialAuthCheckComplete && tableData && tableData.length > 0 && columns.length > 0 && (
        <div style={{ marginTop: '30px', overflowX: 'auto' }}>
          {/* ... (數據結果表格的 UI 保持不變) ... */}
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
      {apiKey && initialAuthCheckComplete && selectedDocId && selectedTableId && tableData && tableData.length === 0 && !isLoadingData && !dataError && (
        <p style={{ marginTop: '15px', padding: '12px 15px', backgroundColor: '#fff3cd', border: '1px solid #ffeeba', color: '#856404', borderRadius: theme.borderRadius, fontSize: theme.fontSizeSmall, textAlign: 'center', }}>
            {filterQuery || sortQuery ? '沒有符合目前過濾/排序條件的數據，或表格本身為空。' : '該表格目前沒有數據。'}
        </p>
      )}
    </div>
  );
}

export default GristDynamicSelectorViewer;