// src/GristDynamicSelectorViewer.jsx
import React, { useState, useCallback, useEffect, useRef } from 'react';

// Constants
const GRIST_API_BASE_URL = 'https://tiss-grist.fcuai.tw';
const AUTHENTIK_BASE_URL = 'https://tiss-auth.fcuai.tw'; // Your Authentik URL
const AUTHENTIK_CLIENT_ID = 'UsuTQscAoU0Pgju33QOHj3XFLjbcdGg5cs2htpfE'; // Client ID from your Grist component code. Ensure this matches your Authentik Provider's Client ID for the 'gristdataviewer' app.
// const AUTHENTIK_APP_SLUG = 'gristdataviewer'; // Your Authentik application slug, for reference or if used as client_id.

const TARGET_ORG_DOMAIN = 'fcuai.tw';
const API_KEY_RETRY_INTERVAL = 3000;

// Helper function to generate a random string for the state parameter
function generateRandomString(length) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let result = '';
  const charactersLength = characters.length;
  // Fallback for environments where crypto is not available (less secure)
  if (!window.crypto || !window.crypto.getRandomValues) {
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  }
  const randomValues = new Uint8Array(length);
  window.crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    result += characters.charAt(randomValues[i] % charactersLength);
  }
  return result;
}

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
        credentials: 'include', // Important for Grist's own session-based API key fetching
        headers: { 'Accept': 'text/plain' },
      });
      const responseText = await response.text();
      console.log('GristApiKeyManager: response from /api/profile/apiKey: ', responseText);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${responseText || '無法獲取 API Key'}`);
      }
      const fetchedKey = responseText.trim();
      if (!fetchedKey || fetchedKey.includes('<') || fetchedKey.length < 32) { // Basic validation
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
        onStatusUpdate(`自動獲取 API Key 失敗: ${error.message}. 請確保您已登入 Grist (如適用) 或 API Key 端點可訪問。`);
      }
      onApiKeyUpdate('', false); // Clear API key on failure
      return false;
    } finally {
      setIsFetching(false);
    }
  }, [onApiKeyUpdate, onStatusUpdate, isFetching]); // Added isFetching to deps

  const handleManualSubmit = useCallback(() => {
    clearTimeout(retryTimerRef.current);
    const trimmedKey = localApiKey.trim();
    if (trimmedKey) {
      onApiKeyUpdate(trimmedKey, false); // false for not autoFetched
      onStatusUpdate('手動輸入的 API Key 已設定。');
    } else {
      onStatusUpdate('請輸入有效的 API Key。');
    }
  }, [localApiKey, onApiKeyUpdate, onStatusUpdate]);
  
  useEffect(() => {
    setLocalApiKey(apiKeyProp || '');
  }, [apiKeyProp]);

  useEffect(() => {
    if (apiKeyProp) { // If an API key is already provided (e.g., from login or manual input)
        clearTimeout(retryTimerRef.current);
        return;
    }

    // This logic now primarily relies on initialAttemptFailed being true AND no apiKeyProp
    if (initialAttemptFailed && !apiKeyProp) {
        console.log("GristApiKeyManager: Initial attempt failed, starting fetch/retry logic for Grist API key endpoint.");
        fetchKeyFromProfile(false).then(success => {
            if (!success) {
                if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
                retryTimerRef.current = setTimeout(function retry() {
                    console.log("GristApiKeyManager: Retrying to fetch API key from Grist endpoint...");
                    fetchKeyFromProfile(true).then(retrySuccess => {
                        if (!retrySuccess) {
                            retryTimerRef.current = setTimeout(retry, API_KEY_RETRY_INTERVAL);
                        }
                    });
                }, API_KEY_RETRY_INTERVAL);
            }
        });
    } else {
        clearTimeout(retryTimerRef.current); // Clear any pending retries if not needed
    }
    
    return () => {
      clearTimeout(retryTimerRef.current);
    };
  }, [apiKeyProp, fetchKeyFromProfile, initialAttemptFailed]);

  React.useImperativeHandle(ref, () => ({
    triggerFetchKeyFromProfile: () => {
        console.log("GristApiKeyManager: Manually triggered fetchKeyFromProfile.");
        clearTimeout(retryTimerRef.current); // Stop any existing retry loops
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
        此工具會嘗試透過 Authentik 登入獲取權杖。若失敗或您想使用不同的 Grist 實例，
        您也可以嘗試從 Grist 個人資料頁面 (<code>{GRIST_API_BASE_URL}</code>) 自動獲取或手動複製 API Key。
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
  const [initialApiKeyAttemptFailed, setInitialApiKeyAttemptFailed] = useState(false); // Managed by login flow and API key updates
  const [isRedirectingToLogin, setIsRedirectingToLogin] = useState(false);

  const handleApiKeyUpdate = useCallback((key, autoFetchedOrLoginSuccess = false) => {
    console.log(`GristDynamicSelectorViewer: handleApiKeyUpdate called with key: ${key ? '******' : '""'}, autoFetchedOrLoginSuccess: ${autoFetchedOrLoginSuccess}`);
    setApiKey(key); // Update state

    if (key) {
      localStorage.setItem('gristApiKey', key);
      setShowLoginPrompt(false); // Hide login prompt if we get a key
      setInitialApiKeyAttemptFailed(false); // If a key is successfully set, the "initial attempt" is no longer considered failed

      if (autoFetchedOrLoginSuccess) { // Can be true for Grist profile fetch OR Authentik login
        setStatusMessage('權杖/API Key 獲取成功！正在準備加載數據...');
      } else { // Manual key entry
        setStatusMessage('API Key 已設定。正在準備加載數據...');
      }
    } else { // Key is empty (cleared or failed to fetch)
      localStorage.removeItem('gristApiKey');
      // Only show login prompt if it wasn't an explicit "autoFetchedOrLoginSuccess = true" scenario that failed
      // (e.g. Authentik login itself failed, checkReturnFromLogin would set a specific error message)
      // if (!autoFetchedOrLoginSuccess) {
      //   setShowLoginPrompt(true);
      // }
      setInitialApiKeyAttemptFailed(true); // If key is cleared or fetch fails, consider it a failed attempt state for GristApiKeyManager
      // Status message for key removal or clear failure is often set by the caller (e.g., checkReturnFromLogin or API request failure)
      if (!statusMessage.includes('失敗') && !statusMessage.includes('錯誤')) { // Avoid overriding specific error messages
          setStatusMessage('API Key 已清除或獲取失敗。請登入或手動設定。');
      }
    }
    // Reset downstream data when API key changes
    setCurrentOrgId(null);
    setDocuments([]);
    setSelectedDocId('');
    setTables([]);
    setSelectedTableId('');
    setTableData(null);
    setFilterQuery('');
    setSortQuery('');
    setDataError('');
  }, [setApiKey, setStatusMessage, setShowLoginPrompt, setInitialApiKeyAttemptFailed, setCurrentOrgId, setDocuments, setSelectedDocId, setTables, setSelectedTableId, setTableData, setFilterQuery, setSortQuery, setDataError, statusMessage]);


  const makeGristApiRequest = useCallback(async (endpoint, method = 'GET', params = null) => {
    if (!apiKey) {
      console.warn("makeGristApiRequest: API Key is not set. Aborting request to", endpoint);
      // Do not set showLoginPrompt here, let UI decide based on apiKey presence overall
      throw new Error('API Key 未設定，無法發送請求。請先登入或設定 API Key。');
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
        'Authorization': `Bearer ${apiKey}`, // Standard Bearer token usage
        'Accept': 'application/json',
        'Content-Type': method !== 'GET' ? 'application/json' : undefined,
      },
    });

    // Try to parse as JSON, but provide text if it fails
    let responseData;
    const responseText = await response.text();
    try {
        responseData = JSON.parse(responseText);
    } catch (e) {
        // If not JSON, use the text content, especially for errors
        if (!response.ok) {
            const errorMsg = `HTTP error ${response.status}: ${responseText || response.statusText} (Non-JSON response)`;
            console.error(`Grist API Error for ${method} ${url}:`, errorMsg);
             if (response.status === 401 || response.status === 403) { // Unauthorized or Forbidden
                setStatusMessage(`權限不足或權杖無效 (HTTP ${response.status})。請重新登入或檢查 API Key。`);
                handleApiKeyUpdate(''); // Clear the potentially invalid API key
                setShowLoginPrompt(true);
            }
            throw new Error(errorMsg);
        }
        // If it was a 2xx response but not JSON, this might be unexpected for some endpoints
        console.warn(`Grist API: Non-JSON success response for ${method} ${url}:`, responseText);
        return responseText; // Or handle as appropriate
    }
    
    if (!response.ok) {
      const errorMsg = responseData?.error?.message || responseData?.error || responseData?.message || `HTTP error ${response.status}: ${JSON.stringify(responseData)}`;
      console.error(`Grist API Error for ${method} ${url}:`, errorMsg, responseData);
      if (response.status === 401 || response.status === 403) {
        setStatusMessage(`權限不足或權杖無效 (HTTP ${response.status})。請重新登入或檢查 API Key。`);
        handleApiKeyUpdate(''); 
        setShowLoginPrompt(true);
      }
      throw new Error(errorMsg);
    }
    return responseData;
  }, [apiKey, handleApiKeyUpdate, setStatusMessage, setShowLoginPrompt]); // Added setStatusMessage, setShowLoginPrompt

  const redirectToAuthentikLogin = useCallback(() => {
    setIsRedirectingToLogin(true);
    const state = generateRandomString(40); // Generate a random state string
    sessionStorage.setItem('grist_oauth_state', state); // Store it in session storage

    const authParams = new URLSearchParams({
      response_type: 'token', // Using Implicit Flow as per original code
      client_id: AUTHENTIK_CLIENT_ID, // Ensure this matches your Authentik provider's client_id
      redirect_uri: window.location.origin + window.location.pathname, // Must be registered in Authentik
      scope: 'openid profile email', // Standard scopes
      state: state, // For CSRF protection and request correlation
    });
  
    const loginUrl = `${AUTHENTIK_BASE_URL}/application/o/authorize/?${authParams.toString()}`;
    console.log('Redirecting to Authentik:', loginUrl);
    
    // Clear any existing hash *before* redirecting to prevent interference
    if (window.location.hash) {
        history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    window.location.href = loginUrl;
  }, [setIsRedirectingToLogin]);

  const checkReturnFromLogin = useCallback(async () => {
    // Only proceed if there's a hash and it likely contains OAuth parameters
    if (!window.location.hash || (!window.location.hash.includes('access_token') && !window.location.hash.includes('error'))) {
      return; // Not an OAuth redirect or already processed
    }

    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const error = params.get('error');
    const errorDescription = params.get('error_description');
    const returnedState = params.get('state');

    // Important: Clear the hash from the URL immediately after parsing
    // to prevent reprocessing and keep the URL clean.
    history.replaceState(null, '', window.location.pathname + window.location.search);

    const storedState = sessionStorage.getItem('grist_oauth_state');
    sessionStorage.removeItem('grist_oauth_state'); // Clean up state from session storage

    if (!returnedState || returnedState !== storedState) {
      console.error('OAuth state mismatch. Stored:', storedState, 'Returned:', returnedState);
      setStatusMessage('登入驗證失敗: state 不匹配。這可能是安全風險，請重試登入。');
      setInitialApiKeyAttemptFailed(true); // Allow GristApiKeyManager to try its methods or show prompt
      setShowLoginPrompt(true);
      return;
    }
  
    if (error) {
      console.error('Authentik login error:', error, errorDescription);
      setStatusMessage(`Authentik 登入失敗: ${error} ${errorDescription ? '('+errorDescription+')' : ''}. 請重試。`);
      setInitialApiKeyAttemptFailed(true);
      setShowLoginPrompt(true);
      return;
    }
  
    if (accessToken) {
      console.log('Authentik login successful, received access token.');
      // The access token from Authentik is now used as the Grist API Key.
      // The `true` flag indicates it was an "auto-fetch" like success (came from login).
      handleApiKeyUpdate(accessToken, true);
      // Status message is set within handleApiKeyUpdate
    } else if (!error) {
        // This case should ideally not be reached if state is valid and no error, but hash was present.
        console.warn('OAuth callback processed, but no access token or error found in hash params:', params.toString());
        setStatusMessage('登入流程異常，未收到權杖。');
        setInitialApiKeyAttemptFailed(true);
        setShowLoginPrompt(true);
    }
  }, [handleApiKeyUpdate, setStatusMessage, setInitialApiKeyAttemptFailed, setShowLoginPrompt]);
  
  // Initial effect on component mount
  useEffect(() => {
    console.log("GristDynamicSelectorViewer: Initial component mount.");
    
    // Check if returning from Authentik login
    checkReturnFromLogin(); // This is synchronous in its core logic of checking hash

    // After checkReturnFromLogin has potentially updated apiKey (via handleApiKeyUpdate),
    // determine if we need to flag an initial API key attempt failure.
    // This timeout allows state updates from checkReturnFromLogin to settle.
    const timerId = setTimeout(() => {
        const currentKey = apiKey || localStorage.getItem('gristApiKey');
        if (!currentKey) {
            // Check if we are in the middle of an OAuth redirect (hash might still be there if error occurred before clearing)
            const hashParams = new URLSearchParams(window.location.hash.substring(1));
            if (!hashParams.has('access_token') && !hashParams.has('error')) {
                 console.log("GristDynamicSelectorViewer: No API key after initial checks and not an OAuth redirect. Setting initialAttemptFailed.");
                 setInitialApiKeyAttemptFailed(true);
                 // setShowLoginPrompt(true); // GristApiKeyManager or other logic might show prompt based on initialAttemptFailed
            }
        } else {
            setInitialApiKeyAttemptFailed(false); // We have a key
            setShowLoginPrompt(false);
        }
    }, 100); // Small delay for state propagation

    return () => clearTimeout(timerId);
  // eslint-disable-next-line react-hooks/exhaustive-deps 
  }, [checkReturnFromLogin]); // apiKey removed to make this primarily a mount effect; checkReturnFromLogin is stable. handleApiKeyUpdate will manage apiKey dependent state.


  // Fetch Org ID when API key is available
  useEffect(() => {
    if (!apiKey) {
      setCurrentOrgId(null); 
      setDocuments([]); 
      return;
    }
    const getOrgId = async () => {
      setIsLoadingDocs(true); 
      setStatusMessage('API Key/權杖有效，正在獲取組織資訊...');
      try {
        const orgsData = await makeGristApiRequest('/api/orgs');
        let determinedOrgId = null;
        if (orgsData && Array.isArray(orgsData) && orgsData.length > 0) {
          if (TARGET_ORG_DOMAIN) {
            const targetOrg = orgsData.find(org => org.domain === TARGET_ORG_DOMAIN);
            if (targetOrg) determinedOrgId = targetOrg.id;
            else determinedOrgId = orgsData[0].id; // Fallback to first org if target domain not found
          } else {
            determinedOrgId = orgsData[0].id; // Default to first org if no target domain specified
          }
        } else if (orgsData && orgsData.id) { // Handle case where /api/orgs returns a single org object (user's personal org)
          determinedOrgId = orgsData.id;
        }

        if (determinedOrgId) {
          setCurrentOrgId(determinedOrgId);
          // Status message will be updated by fetchDocs effect
        } else {
          throw new Error('未能獲取到有效的組織 ID。檢查 API Key 權限或 Grist 設定。');
        }
      } catch (error) {
        setStatusMessage(`獲取組織 ID 失敗: ${error.message}`);
        setCurrentOrgId(null); 
        setDocuments([]);
      } finally {
        // setIsLoadingDocs(false); //isLoadingDocs is more for document list itself
      }
    };
    getOrgId();
  }, [apiKey, makeGristApiRequest, setStatusMessage]); // Added setStatusMessage


  // Fetch Documents when Org ID is available
  useEffect(() => {
    if (!currentOrgId || !apiKey) { 
      setDocuments([]); 
      return;
    }
    const fetchDocsFromWorkspaces = async () => {
      setIsLoadingDocs(true); 
      setStatusMessage(`正在從組織 ID ${currentOrgId} 獲取文檔列表...`);
      try {
        const workspacesData = await makeGristApiRequest(`/api/orgs/${currentOrgId}/workspaces`);
        const allDocs = [];
        let docNameCounts = {}; // To handle duplicate document names across workspaces
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
          displayName: docNameCounts[doc.name] > 1 ? `${doc.name} (工作區: ${doc.workspaceName})` : doc.name
        }));

        setDocuments(processedDocs);
        if (processedDocs.length > 0) {
          setStatusMessage('文檔列表獲取成功。請選擇一個文檔。');
        } else {
          setStatusMessage(`在組織 ID ${currentOrgId} 下未找到任何文檔。`);
        }
      } catch (error) {
        setStatusMessage(`獲取文檔列表失敗: ${error.message}`);
        setDocuments([]);
      } finally {
        setIsLoadingDocs(false);
      }
    };
    fetchDocsFromWorkspaces();
  }, [currentOrgId, apiKey, makeGristApiRequest, setStatusMessage]); // Added setStatusMessage

  // Fetch Tables when Document ID is selected
  useEffect(() => {
    if (!selectedDocId || !apiKey) { 
      setTables([]);
      setSelectedTableId(''); 
      return;
    }
    const fetchTables = async () => {
      setIsLoadingTables(true);
      setStatusMessage(`正在獲取文檔 "${documents.find(d => d.id === selectedDocId)?.name || selectedDocId}" 的表格列表...`);
      setDataError(''); // Clear previous data errors
      try {
        // Grist API for tables within a doc can be just /api/docs/{docId} and look at _grist_Tables_column
        // Or more directly: /api/docs/{docId}/tables
        const data = await makeGristApiRequest(`/api/docs/${selectedDocId}/tables`);
        const tableList = data.tables || (Array.isArray(data) ? data : []); // Adapt to potential API response structures
        
        if (Array.isArray(tableList)) {
          setTables(tableList.map(table => ({ 
            id: table.id, // Usually the tableId (e.g., "Table1")
            name: table.fields?.find(f => f.id === 'tableId')?.label || table.id // Try to find a display name or use id
          })));
          setStatusMessage(tableList.length > 0 ? '表格列表獲取成功。請選擇一個表格。' : '該文檔中未找到表格或無權限查看。');
        } else { 
          throw new Error('表格列表格式不正確。'); 
        }
      } catch (error) {
        setStatusMessage(`獲取表格列表失敗: ${error.message}`);
        setTables([]);
      } finally { 
        setIsLoadingTables(false); 
      }
    };
    fetchTables();
  }, [selectedDocId, apiKey, makeGristApiRequest, documents, setStatusMessage]); // Added documents, setStatusMessage

  // Fetch Table Data
  const handleFetchTableData = useCallback(async () => {
    if (!apiKey || !selectedDocId || !selectedTableId) {
      setDataError('請先設定 API Key/權杖並選擇文檔和表格。');
      return;
    }
    setIsLoadingData(true);
    setDataError('');
    setTableData(null); // Clear previous data
    setColumns([]);   // Clear previous columns
    setStatusMessage(`正在從表格 "${selectedTableId}" 獲取數據...`);
    
    const params = { limit: '50' }; // Grist default limit is 500, but 50 for UI display is fine
    if (filterQuery) { 
      try { 
        JSON.parse(filterQuery); // Validate JSON
        params.filter = filterQuery; 
      } catch (e) { 
        setDataError('過濾條件不是有效的 JSON 格式 (例如: {"ColumnID": ["Value1", "Value2"]})。'); 
        setStatusMessage('過濾條件格式錯誤。'); 
        setIsLoadingData(false); 
        return; 
      }
    }
    if (sortQuery.trim()) { 
      params.sort = sortQuery.trim(); 
    }

    try {
      const data = await makeGristApiRequest(`/api/docs/${selectedDocId}/tables/${selectedTableId}/records`, 'GET', params);
      if (data && data.records && Array.isArray(data.records)) {
        setTableData(data.records);
        if (data.records.length > 0) {
          const allCols = new Set();
          // Iterate through all records to find all possible field keys, as Grist records can be sparse
          data.records.forEach(rec => { 
            if (rec.fields) Object.keys(rec.fields).forEach(key => allCols.add(key)); 
          });
          setColumns(Array.from(allCols));
          setStatusMessage(`成功獲取 ${data.records.length} 條數據。`);
        } else { 
          setColumns([]); // No records, so no columns to display
          setStatusMessage('數據獲取成功，但結果為空。'); 
        }
      } else { 
        throw new Error('返回的數據格式不正確，缺少 "records" 陣列。'); 
      }
    } catch (error) { 
      setDataError(`獲取數據失敗: ${error.message}`);
      setStatusMessage(`獲取數據失敗: ${error.message}`);
      setTableData([]); // Ensure tableData is an empty array on error to clear table
    } finally { 
      setIsLoadingData(false); 
    }
  }, [apiKey, selectedDocId, selectedTableId, makeGristApiRequest, filterQuery, sortQuery, setStatusMessage]); // Added setStatusMessage


  return (
    <div style={{ padding: '25px', fontFamily: theme.fontFamily, fontSize: theme.fontSizeBase, lineHeight: theme.lineHeightBase, color: theme.textColor, backgroundColor: theme.backgroundColor, maxWidth: '1000px', margin: '20px auto', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', borderRadius: '8px', }}>
      <h1 style={{ color: theme.textColor, textAlign: 'center', marginBottom: '15px', fontSize: '28px', }}>
        Grist 數據動態選擇查看器
      </h1>
      <p style={{ textAlign: 'center', color: theme.textColorSubtle, fontSize: theme.fontSizeSmall, marginBottom: '25px' }}>
        Grist API 目標: <code>{GRIST_API_BASE_URL}</code> (目標組織域名: <code>{TARGET_ORG_DOMAIN || '未指定'}</code>)<br/>
        Authentik 登入目標: <code>{AUTHENTIK_BASE_URL}</code>
      </p>

      {statusMessage && ( 
        <p style={{ 
          padding: '12px 15px', 
          backgroundColor: statusMessage.includes('失敗') || statusMessage.includes('錯誤') || statusMessage.includes('不匹配') ? theme.errorColorBg : theme.successColorBg, 
          border: `1px solid ${statusMessage.includes('失敗') || statusMessage.includes('錯誤') || statusMessage.includes('不匹配') ? theme.errorColor : theme.successColor}`, 
          color: statusMessage.includes('失敗') || statusMessage.includes('錯誤') || statusMessage.includes('不匹配') ? theme.errorColor : theme.successColor, 
          marginTop: '10px', 
          marginBottom: '20px', 
          borderRadius: theme.borderRadius, 
          fontSize: theme.fontSizeSmall, 
          textAlign: 'center', 
          whiteSpace: 'pre-wrap', // To show multi-line errors nicely
        }}> 
          {statusMessage} 
        </p> 
      )}

      <GristApiKeyManager
        ref={apiKeyManagerRef}
        apiKey={apiKey}
        onApiKeyUpdate={handleApiKeyUpdate}
        onStatusUpdate={setStatusMessage}
        initialAttemptFailed={initialApiKeyAttemptFailed} // This flag is now managed by login flow and API key updates
      />

      {/* Login prompt appears if no API key AND initial attempts (including login) have been made or indicated as failed */}
      {showLoginPrompt && !apiKey && (
        <div style={{ padding: '20px', margin: '20px 0', border: `1px solid ${theme.errorColor}`, borderRadius: theme.borderRadius, textAlign: 'center', backgroundColor: theme.errorColorBg, }}>
          <p style={{ color: theme.errorColor, margin: '0 0 15px 0', fontWeight: '500' }}>
            需要 API Key/權杖才能訪問 Grist 數據。
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
            {isRedirectingToLogin ? '正在重定向至 Authentik...' : `透過 Authentik (${AUTHENTIK_APP_SLUG || 'FCUAI'}) 登入`}
          </button>
          <button 
            onClick={() => apiKeyManagerRef.current && apiKeyManagerRef.current.triggerFetchKeyFromProfile()}
            title={`嘗試從 ${GRIST_API_BASE_URL}/api/profile/apiKey 自動獲取 (需已登入該 Grist 實例)`}
            style={{ 
              padding: '10px 15px', 
              backgroundColor: '#6c757d', 
              color: theme.primaryColorText, 
              border: 'none', 
              borderRadius: theme.borderRadius, 
              cursor: 'pointer'
            }}
          >
            嘗試 Grist 自動獲取
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
              <option value="">{isLoadingDocs ? '正在加載文檔...' : (documents.length === 0 && apiKey && currentOrgId ? '當前組織下未找到文檔' : (apiKey ? '-- 請選擇文檔 --' : '請先設定 API Key/權杖'))}</option>
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
                <input id="filterInput" type="text" value={filterQuery} onChange={(e) => setFilterQuery(e.target.value)} placeholder='例如: {"ColumnID": ["Value"]}' style={{ width: '100%', padding: '10px', fontSize: theme.fontSizeBase, border: `1px solid ${theme.borderColor}`, borderRadius: theme.borderRadius, boxSizing: 'border-box', color: theme.textColor }}/>
                <small style={{ display: 'block', marginTop: '5px', color: theme.textColorSubtle, fontSize: '13px' }}>參考 Grist API "Filtering records"。欄位 ID 區分大小寫。值可以是單個值或陣列。</small>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label htmlFor="sortInput" style={{ display: 'block', marginBottom: '5px', color: theme.textColorLight, fontSize: theme.fontSizeSmall }}>排序條件:</label>
                <input id="sortInput" type="text" value={sortQuery} onChange={(e) => setSortQuery(e.target.value)} placeholder='例如: ColumnID, -AnotherColumnID' style={{ width: '100%', padding: '10px', fontSize: theme.fontSizeBase, border: `1px solid ${theme.borderColor}`, borderRadius: theme.borderRadius, boxSizing: 'border-box', color: theme.textColor }}/>
                <small style={{ display: 'block', marginTop: '5px', color: theme.textColorSubtle, fontSize: '13px' }}>參考 Grist API "Sorting records"。欄位 ID 區分大小寫。前綴 "-" 表示降序。</small>
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
                <th style={{backgroundColor: '#e9ecef', padding: '12px 10px', textAlign: 'left', color: theme.textColor, fontWeight: '600', borderBottom: `2px solid ${theme.borderColor}`, position: 'sticky', top:0, left: 0, zIndex: 2}}>id (Record)</th>
                {columns.map((col) => (<th key={col} style={{backgroundColor: '#e9ecef', padding: '12px 10px', textAlign: 'left', color: theme.textColor, fontWeight: '600', borderBottom: `2px solid ${theme.borderColor}`, position: 'sticky', top:0, zIndex:1}}>{col}</th>))}
              </tr>
            </thead>
            <tbody>
              {tableData.map((record, rowIndex) => (
                <tr key={record.id} style={{ backgroundColor: rowIndex % 2 === 0 ? '#fff' : theme.surfaceColor , borderBottom: `1px solid ${theme.borderColor}` }}>
                  <td style={{ padding: '10px', whiteSpace: 'nowrap', color: theme.textColorLight, position: 'sticky', left: 0, backgroundColor: rowIndex % 2 === 0 ? '#fff' : theme.surfaceColor, zIndex: 1, borderRight: `1px solid ${theme.borderColor}` }}>{record.id}</td>
                  {columns.map((col) => (
                    <td key={`${record.id}-${col}`} style={{ padding: '10px', whiteSpace: 'nowrap', color: theme.textColorLight, maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {record.fields && typeof record.fields === 'object' && record.fields[col] !== undefined && record.fields[col] !== null
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