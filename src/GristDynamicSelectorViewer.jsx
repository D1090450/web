// src/GristDynamicSelectorViewer.jsx
import React, { useState, useCallback, useEffect, useRef } from 'react';

const GRIST_API_BASE_URL = 'https://tiss-grist.fcuai.tw';
const TARGET_ORG_DOMAIN = 'fcuai.tw';
const API_KEY_RETRY_INTERVAL = 3000; // GristApiKeyManager 內部重試間隔

// Authentik 配置
const AUTHENTIK_BASE_URL = 'https://tiss-auth.fcuai.tw/';
const AUTHENTIK_CLIENT_ID = 'UsuTQscAoU0Pgju33QOHj3XFLjbcdGg5cs2htpfE';

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
    if (isFetching && !isRetry && !apiKeyProp) return false; // 如果正在獲取且不是重試，且父組件也沒有傳入key，則避免重複

    setIsFetching(true);
    if (!isRetry) {
        onStatusUpdate('正在從 Grist 個人資料獲取 API Key...');
    }

    try {
      const response = await fetch(`${GRIST_API_BASE_URL}/api/profile/apiKey`, {
        method: 'GET',
        credentials: 'include', // 關鍵：允許 Grist 利用現有 (Authentik) session 進行 SSO
        headers: { 'Accept': 'text/plain' },
      });
      const responseText = await response.text();
      console.log('GristApiKeyManager: response from /api/profile/apiKey: ', responseText);
      if (!response.ok) {
        // 如果 Grist 返回 401/403，可能意味著 Grist session 未建立或已過期
        // Grist 應該已經嘗試過 SSO 重定向 (如果配置正確)
        throw new Error(`HTTP ${response.status}: ${responseText || '無法獲取 Grist API Key'}`);
      }
      const fetchedKey = responseText.trim();
      if (!fetchedKey || fetchedKey.includes('<') || fetchedKey.length < 32) {
        throw new Error('從 Grist 獲取到的 API Key 似乎無效。');
      }
      setLocalApiKey(fetchedKey);
      onApiKeyUpdate(fetchedKey, true); // true for autoFetchedSuccess (from Grist profile)
      onStatusUpdate('Grist API Key 自動獲取成功！');
      clearTimeout(retryTimerRef.current);
      return true;
    } catch (error) {
      console.error("GristApiKeyManager: Error fetching Grist API key:", error.message);
      if (!isRetry) {
        onStatusUpdate(`自動獲取 Grist API Key 失敗: ${error.message}. 請確保您已在 Grist 登入，或稍後重試。`);
      }
      // 不在這裡清除父組件的 key，讓父組件決定
      // onApiKeyUpdate('', false); // 不要自動清除，除非父組件指示
      return false;
    } finally {
      setIsFetching(false);
    }
  }, [onApiKeyUpdate, onStatusUpdate, apiKeyProp]); // apiKeyProp 加入依賴

  const handleManualSubmit = useCallback(() => {
    clearTimeout(retryTimerRef.current);
    const trimmedKey = localApiKey.trim();
    if (trimmedKey) {
      onApiKeyUpdate(trimmedKey, false); // false for manual input
      onStatusUpdate('手動輸入的 API Key 已設定。');
    } else {
      onStatusUpdate('請輸入有效的 API Key。');
    }
  }, [localApiKey, onApiKeyUpdate, onStatusUpdate]);
  
  useEffect(() => {
    setLocalApiKey(apiKeyProp || '');
  }, [apiKeyProp]);

  useEffect(() => {
    if (apiKeyProp) { // 如果父組件傳入了 API Key，則我們不需要做任何事
        clearTimeout(retryTimerRef.current);
        return;
    }

    // 如果父組件沒有傳入 API Key，且指示我們進行初始嘗試
    if (initialAttemptFailed && !apiKeyProp) {
        console.log("GristApiKeyManager: `initialAttemptFailed` is true and no `apiKeyProp`, attempting to fetch Grist key.");
        fetchKeyFromProfile(false).then(success => {
            if (!success && !apiKeyProp) { // 再次檢查 apiKeyProp，以防在異步操作期間父組件更新了它
                if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
                retryTimerRef.current = setTimeout(function retry() {
                    console.log("GristApiKeyManager: Retrying to fetch Grist API key...");
                    if (!apiKeyProp) { // 重試前再次檢查
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
        // 如果父組件沒有指示初始嘗試，或者已經有了 apiKeyProp，則清除任何可能的重試計時器
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
      <h4 style={{ marginTop: '0', marginBottom: '10px', color: theme.textColor }}>API Key 管理</h4>
      <p style={{ fontSize: theme.fontSizeSmall, color: theme.textColorSubtle, marginBottom: '15px' }}>
        應用程式會嘗試自動從您的 Grist 個人資料獲取 API Key。如果失敗，您可以從 Grist 個人資料頁面手動複製並貼上 API Key。
        請確保您已登入 Grist (<code>{GRIST_API_BASE_URL}</code>)。
      </p>
      <input
        type="password" // 保持 password 類型以隱藏 Key
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
  const [apiKey, setApiKey] = useState(''); // 初始為空，由 useEffect 決定
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
  
  const [showLoginPromptAndManualKey, setShowLoginPromptAndManualKey] = useState(false); // 控制是否顯示 Authentik 登入按鈕和手動 Key 輸入區域
  const apiKeyManagerRef = useRef(null);
  const [isRedirectingToLogin, setIsRedirectingToLogin] = useState(false);
  
  // 此狀態用於告知 GristApiKeyManager 是否應進行其初始的 API Key 獲取嘗試
  const [triggerManagerInitialFetch, setTriggerManagerInitialFetch] = useState(false);
  const [initialAuthCheckComplete, setInitialAuthCheckComplete] = useState(false);


  const handleApiKeyUpdate = useCallback((key, autoFetchedSuccess = false) => {
    console.log(`GristDynamicSelectorViewer: handleApiKeyUpdate called with key: ${key ? '******' : '""'}, autoFetchedSuccess: ${autoFetchedSuccess}`);
    setApiKey(key);
    if (key) {
      localStorage.setItem('gristApiKey', key);
      setShowLoginPromptAndManualKey(false); // 有 key 了，隱藏登入/手動輸入提示
      setTriggerManagerInitialFetch(false); // Key 已獲取，GristApiKeyManager 不需要再進行初始嘗試

      if (autoFetchedSuccess) {
        setStatusMessage('Grist API Key 自動獲取成功！正在準備加載數據...');
      } else {
        setStatusMessage('Grist API Key 已設定。正在準備加載數據...');
      }
    } else {
      localStorage.removeItem('gristApiKey');
      // 如果 API Key 被清除 (例如獲取失敗或手動清除)，則顯示登入提示和手動輸入
      setShowLoginPromptAndManualKey(true);
      setStatusMessage('Grist API Key 獲取失敗或已清除。請登入或手動提供 API Key。');
      // 允許 GristApiKeyManager 在下次被觸發時重試
      // setTriggerManagerInitialFetch(true); // 如果希望清除後能自動重試，則設為 true；若只希望手動，則保持 false 或由其他邏輯控制
    }
    // 重置依賴 API Key 的數據
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
      // 不自動清除 API Key 或重定向，讓更上層的邏輯（如初始檢查）處理
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

    if (!response.ok) {
      let responseData;
      try {
        responseData = await response.json();
      } catch (e) {
        const text = await response.text();
        throw new Error(`HTTP error ${response.status}: ${text || response.statusText} (Non-JSON response)`);
      }
      const errorMsg = responseData?.error?.message || responseData?.error || responseData?.message || `HTTP error ${response.status}`;
      console.error(`Grist API Error for ${method} ${url}:`, responseData);
      if (response.status === 401 || response.status === 403) {
        // API Key 失效或無權限。清除現有 key 並觸發重新獲取/登入流程。
        setStatusMessage(`API Key 已失效或無權限 (${response.status})。請重新登入或檢查 Key。`);
        handleApiKeyUpdate(''); // 清除 key，這會觸發 setShowLoginPromptAndManualKey(true)
        setTriggerManagerInitialFetch(true); // 允許 GristApiKeyManager 嘗試重新獲取
      }
      throw new Error(errorMsg);
    }
    // 處理 response.ok 但可能是空回應的情況 for GET /api/profile/apiKey (text/plain)
    if (response.headers.get("content-type")?.includes("application/json")) {
        return response.json();
    }
    return response.text(); // 例如 Grist API Key 請求
  }, [apiKey, handleApiKeyUpdate]);

  const redirectToAuthentikLogin = useCallback(() => {
    if (isRedirectingToLogin) return;
    setIsRedirectingToLogin(true);
    setStatusMessage('正在重定向到 Authentik 登入頁面...');
    const authParams = new URLSearchParams({
      response_type: 'token',
      client_id: AUTHENTIK_CLIENT_ID,
      redirect_uri: window.location.origin + window.location.pathname,
      scope: 'openid profile email',
      state: generateRandomString(32)
    });
    
    const cleanAuthentikBaseUrl = AUTHENTIK_BASE_URL.endsWith('/') ? AUTHENTIK_BASE_URL : AUTHENTIK_BASE_URL + '/';
    const loginUrl = `${cleanAuthentikBaseUrl}application/o/authorize/?${authParams.toString()}`;
    
    console.log("Redirecting to Authentik:", loginUrl);
    window.location.href = loginUrl;
  }, [isRedirectingToLogin]);

  // 初始認證檢查 (只在組件掛載時執行一次)
  useEffect(() => {
    if (initialAuthCheckComplete || isRedirectingToLogin) {
      return;
    }
    console.log("GristDynamicSelectorViewer: Performing initial authentication check.");

    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessTokenFromUrl = params.get('access_token');
    const errorFromUrl = params.get('error');
    let needsRedirectToAuthentik = false;

    if (accessTokenFromUrl || errorFromUrl) { // 情況1: 從 Authentik 重定向回來
      window.location.hash = ''; // 清理 hash
      if (errorFromUrl) {
        console.error("Authentik login error:", errorFromUrl, params.get('error_description'));
        setStatusMessage(`Authentik 登入失敗: ${params.get('error_description') || errorFromUrl}. 您可以嘗試手動輸入 API Key 或重新登入。`);
        setShowLoginPromptAndManualKey(true); // 顯示手動輸入和登入按鈕
        setTriggerManagerInitialFetch(false); // Authentik 失敗，不觸發自動獲取 Grist key
      } else if (accessTokenFromUrl) {
        // 成功從 Authentik 獲取 token。現在，我們需要 Grist 自己的 API Key。
        // 我們不會直接使用 accessTokenFromUrl 作為 apiKey。
        console.log("GristDynamicSelectorViewer: Successfully returned from Authentik with a token. Will attempt to fetch Grist API Key.");
        setStatusMessage('Authentik 登入成功。正在嘗試從 Grist 個人資料獲取 API Key...');
        // 指示 GristApiKeyManager 進行其初始的獲取嘗試
        setTriggerManagerInitialFetch(true);
        setShowLoginPromptAndManualKey(false); // 暫時隱藏，如果 Grist key 獲取失敗會再顯示
      }
    } else { // 情況2: 非從 Authentik 重定向回來 (例如直接訪問或刷新頁面)
      const storedApiKey = localStorage.getItem('gristApiKey');
      if (storedApiKey) {
        console.log("GristDynamicSelectorViewer: Found API key in localStorage.");
        handleApiKeyUpdate(storedApiKey, false); // 使用 localStorage 中的 key
        setTriggerManagerInitialFetch(false); // 已有 key，不需要初始獲取
        setShowLoginPromptAndManualKey(false);
      } else {
        // 沒有 Authentik token，也沒有 localStorage key -> 需要重定向到 Authentik
        console.log("GristDynamicSelectorViewer: No API key in localStorage and not returning from Authentik. Redirecting to Authentik login.");
        needsRedirectToAuthentik = true;
      }
    }

    if (needsRedirectToAuthentik) {
      redirectToAuthentikLogin();
    } else {
      setInitialAuthCheckComplete(true); // 標記初始檢查已完成 (除非發生重定向)
    }

  }, [initialAuthCheckComplete, isRedirectingToLogin, redirectToAuthentikLogin, handleApiKeyUpdate ]);


  // 獲取組織 ID
  useEffect(() => {
    if (!apiKey || !initialAuthCheckComplete) {
      if (initialAuthCheckComplete && !apiKey && !showLoginPromptAndManualKey && !isRedirectingToLogin) {
        // 如果初始檢查完成，但沒有 API key，且沒有顯示登入提示 (可能意味著正在等待 GristApiKeyManager)
        // 不執行任何操作，等待 API key
      } else if (!initialAuthCheckComplete && !isRedirectingToLogin) {
        // 初始檢查未完成，不執行
      } else {
        setCurrentOrgId(null); 
        setDocuments([]); 
      }
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
            else determinedOrgId = orgsData[0].id; // Fallback to first org if target domain not found
          } else {
            determinedOrgId = orgsData[0].id; // Default to first org if no target domain specified
          }
        } else if (orgsData && orgsData.id) { // Handle case where /api/orgs might return a single org object directly
          determinedOrgId = orgsData.id;
        }

        if (determinedOrgId) {
          console.log("useEffect (getOrgId): Determined Org ID:", determinedOrgId);
          setCurrentOrgId(determinedOrgId);
        } else {
          throw new Error('未能獲取到有效的組織 ID。檢查返回的數據或目標組織域名設定。');
        }
      } catch (error) {
        console.error('useEffect (getOrgId): Error fetching org ID:', error);
        setStatusMessage(`獲取組織 ID 失敗: ${error.message}`);
        // 不清除 API Key，但後續流程會中斷
        setCurrentOrgId(null); 
        setDocuments([]); 
        setIsLoadingDocs(false); 
      }
    };
    getOrgId();
  }, [apiKey, makeGristApiRequest, initialAuthCheckComplete, showLoginPromptAndManualKey, isRedirectingToLogin]); 

  // 獲取文檔列表
  useEffect(() => {
    if (!currentOrgId || !apiKey || !initialAuthCheckComplete) { 
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
            console.warn("useEffect (fetchDocs): workspacesData is not an array, was:", workspacesData);
            // Potentially handle if workspacesData might be a single workspace object (though API usually returns array)
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

  // 獲取表格列表
  useEffect(() => {
    if (!selectedDocId || !apiKey || !initialAuthCheckComplete) { 
      setTables([]);
      setSelectedTableId(''); 
      return;
    }
    console.log("useEffect (fetchTables): selectedDocId present, attempting to fetch tables for doc:", selectedDocId);
    const fetchTables = async () => {
      setIsLoadingTables(true);
      setStatusMessage(`正在獲取文檔 "${documents.find(d=>d.id === selectedDocId)?.name || selectedDocId}" 的表格列表...`);
      setDataError('');
      try {
        const data = await makeGristApiRequest(`/api/docs/${selectedDocId}/tables`);
        console.log("useEffect (fetchTables): Tables data fetched:", data);
        const tableList = data.tables || (Array.isArray(data) ? data : []); // Grist API might return {tables: [...]} or just [...]
        if (Array.isArray(tableList)) {
          setTables(tableList.map(table => ({ id: table.id, name: table.tableId || table.id }))); // Use table.tableId if present, else table.id
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
      
      {/* GristApiKeyManager 現在主要用於手動輸入，和在特定條件下由父組件觸發的自動獲取 */}
      {/* 它會在 showLoginPromptAndManualKey 為 true 時，或在 triggerManagerInitialFetch 為 true 且沒有 apiKey 時被指示嘗試獲取 */}
      {(showLoginPromptAndManualKey || (triggerManagerInitialFetch && !apiKey)) && (
        <GristApiKeyManager
            ref={apiKeyManagerRef}
            apiKey={apiKey} // 傳遞當前 apiKey，以便其內部可以判斷是否已有 key
            onApiKeyUpdate={handleApiKeyUpdate}
            onStatusUpdate={setStatusMessage}
            // initialAttemptFailed 屬性告訴 GristApiKeyManager 是否應該主動進行一次獲取嘗試
            // 只有當父組件明確指示 (triggerManagerInitialFetch) 且當前還沒有 API Key 時才觸發
            initialAttemptFailed={triggerManagerInitialFetch && !apiKey}
        />
      )}
      
      {/* 登入 Authentik 的按鈕，僅在需要時 (showLoginPromptAndManualKey 為 true 且沒有 apiKey) 顯示 */}
      {showLoginPromptAndManualKey && !apiKey && (
        <div style={{ padding: '20px', margin: '20px 0', border: `1px solid ${theme.errorColor}`, borderRadius: theme.borderRadius, textAlign: 'center', backgroundColor: theme.errorColorBg, }}>
          <p style={{ color: theme.errorColor, margin: '0 0 15px 0', fontWeight: '500' }}>
            請登入 Authentik 以自動獲取 Grist API Key，或手動輸入您的 Grist API Key。
          </p>
          <button 
            onClick={redirectToAuthentikLogin} 
            disabled={isRedirectingToLogin} 
            style={{ 
              padding: '10px 15px', 
              marginRight: '10px', 
              fontSize: theme.fontSizeBase, 
              backgroundColor: isRedirectingToLogin ? '#ccc' : theme.primaryColor,
              color: theme.primaryColorText, 
              border: 'none', 
              borderRadius: theme.borderRadius, 
              cursor: isRedirectingToLogin ? 'not-allowed' : 'pointer', 
            }}
          >
            {isRedirectingToLogin ? '正在重定向...' : '前往 Authentik 登入'}
          </button>
          {/* 如果 GristApiKeyManager 可見（通常與 showLoginPromptAndManualKey 一致），可以提供一個按鈕手動觸發其獲取邏輯 */}
          {apiKeyManagerRef.current && (
            <button 
                onClick={() => apiKeyManagerRef.current?.triggerFetchKeyFromProfile()}
                style={{ 
                  padding: '10px 15px', 
                  backgroundColor: '#6c757d', 
                  color: theme.primaryColorText, 
                  border: 'none', 
                  borderRadius: theme.borderRadius, 
                  cursor: 'pointer'
                }}
            >
                (手動)嘗試從 Grist 個人資料獲取 Key
            </button>
          )}
        </div>
      )}

      {/* 只有在 API Key 存在且初始認證流程已完成後才顯示數據選擇器 */}
      {apiKey && initialAuthCheckComplete && (
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

      {apiKey && initialAuthCheckComplete && tableData && tableData.length > 0 && columns.length > 0 && (
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
      {apiKey && initialAuthCheckComplete && selectedDocId && selectedTableId && tableData && tableData.length === 0 && !isLoadingData && !dataError && (
        <p style={{ marginTop: '15px', padding: '12px 15px', backgroundColor: '#fff3cd', border: '1px solid #ffeeba', color: '#856404', borderRadius: theme.borderRadius, fontSize: theme.fontSizeSmall, textAlign: 'center', }}>
            {filterQuery || sortQuery ? '沒有符合目前過濾/排序條件的數據，或表格本身為空。' : '該表格目前沒有數據。'}
        </p>
      )}
    </div>
  );
}

export default GristDynamicSelectorViewer;