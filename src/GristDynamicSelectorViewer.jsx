// src/GristDynamicSelectorViewer.jsx
import React, { useState, useCallback, useEffect, useRef } from 'react';

const GRIST_API_BASE_URL = 'https://tiss-grist.fcuai.tw';
const TARGET_ORG_DOMAIN = 'fcuai.tw';
const API_KEY_RETRY_INTERVAL = 3000; // 每3秒重試一次
const AUTO_OPEN_POPUP_DELAY = API_KEY_RETRY_INTERVAL * 1.5; // 自動打開彈窗的延遲時間

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

const GristApiKeyManager = React.forwardRef(({ apiKey: apiKeyProp, onApiKeyUpdate, onStatusUpdate, shouldAttemptFetch }, ref) => {
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
      if (!isRetry) { // 只在首次嘗試失敗時更新主狀態訊息
        onStatusUpdate(`自動獲取 API Key 失敗: ${error.message}.`);
      }
      onApiKeyUpdate('', false); // false for autoFetchedSuccess (important for parent to know)
      return false;
    } finally {
      setIsFetching(false);
    }
  }, [onApiKeyUpdate, onStatusUpdate]);

  const handleManualSubmit = useCallback(() => {
    clearTimeout(retryTimerRef.current);
    const trimmedKey = localApiKey.trim();
    if (trimmedKey) {
      onApiKeyUpdate(trimmedKey, false); // false for autoFetchedSuccess
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

    if (shouldAttemptFetch && !apiKeyProp) {
        console.log("GristApiKeyManager: shouldAttemptFetch is true and no apiKey, starting fetch/retry logic.");
        fetchKeyFromProfile(false).then(success => {
            if (!success) {
                if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
                retryTimerRef.current = setTimeout(function zichzelf() {
                    console.log("GristApiKeyManager: Retrying to fetch API key...");
                    fetchKeyFromProfile(true).then(retrySuccess => {
                        if (!retrySuccess && localStorage.getItem('gristLoginPopupOpen') === 'true') {
                            retryTimerRef.current = setTimeout(zichzelf, API_KEY_RETRY_INTERVAL);
                        } else if (retrySuccess) {
                            localStorage.removeItem('gristLoginPopupOpen'); // 清除標記，因為已成功
                        } else if (!localStorage.getItem('gristLoginPopupOpen')) {
                            console.log("GristApiKeyManager: Popup not open and retry failed, stopping retries.");
                            clearTimeout(retryTimerRef.current);
                        }
                    });
                }, API_KEY_RETRY_INTERVAL);
            }
        });
    } else if (!shouldAttemptFetch) {
        console.log("GristApiKeyManager: shouldAttemptFetch is false, clearing potential retries.");
        clearTimeout(retryTimerRef.current);
    }
    
    return () => { // Cleanup on unmount or when dependencies change
      clearTimeout(retryTimerRef.current);
    };
  }, [apiKeyProp, fetchKeyFromProfile, shouldAttemptFetch]);

  React.useImperativeHandle(ref, () => ({
    triggerFetchKeyFromProfile: () => {
        console.log("GristApiKeyManager: Manually triggered fetchKeyFromProfile.");
        clearTimeout(retryTimerRef.current); // 清除自動重試，響應手動觸發
        return fetchKeyFromProfile(false); // false for isRetry
    },
    stopRetrying: () => {
        console.log("GristApiKeyManager: Stopping retries via imperative handle.");
        clearTimeout(retryTimerRef.current);
    }
  }));

  return (
    <div style={{ marginBottom: '20px', padding: '15px', border: `1px dashed ${theme.borderColor}`, borderRadius: theme.borderRadius, backgroundColor: theme.surfaceColor }}>
      <h4 style={{ marginTop: '0', marginBottom: '10px', color: theme.textColor }}>API Key 管理</h4>
      <p style={{ fontSize: theme.fontSizeSmall, color: theme.textColorSubtle, marginBottom: '15px' }}>
        您可以手動輸入 API Key，或允許系統在您登入 Grist (<code>{GRIST_API_BASE_URL}</code>) 後自動獲取。
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

  const apiKeyManagerRef = useRef(null);
  const gristLoginPopupRef = useRef(null);
  const [shouldAttemptApiKeyFetch, setShouldAttemptApiKeyFetch] = useState(false);
  const [popupOpenedByAutoLogic, setPopupOpenedByAutoLogic] = useState(false);
  const autoOpenPopupTimerRef = useRef(null); // Ref for the auto-open popup timer


  const handleApiKeyUpdate = useCallback((key, autoFetchedSuccess = false) => {
    console.log(`GristDynamicSelectorViewer: handleApiKeyUpdate - key: ${key ? '******' : '""'}, autoFetchedSuccess: ${autoFetchedSuccess}`);
    const previousApiKey = apiKeyRef.current; // Use ref to get previous apiKey
    apiKeyRef.current = key; // Update ref for next comparison
    setApiKey(key);

    if (key) {
      localStorage.setItem('gristApiKey', key);
      setShouldAttemptApiKeyFetch(false); // Key is obtained, stop manager's attempts

      if (autoFetchedSuccess && gristLoginPopupRef.current && !gristLoginPopupRef.current.closed && popupOpenedByAutoLogic) {
        try {
            gristLoginPopupRef.current.close();
            localStorage.removeItem('gristLoginPopupOpen');
            console.log("GristDynamicSelectorViewer: Attempted to close Grist login popup.");
            setPopupOpenedByAutoLogic(false);
        } catch (e) {
            console.warn("GristDynamicSelectorViewer: Could not automatically close Grist login popup:", e);
            setStatusMessage("Grist 登入成功！您可以手動關閉登入視窗。");
        }
        gristLoginPopupRef.current = null;
      }
       if (autoFetchedSuccess) {
           setStatusMessage('API Key 自動獲取成功！正在準備加載數據...');
       } else if (previousApiKey !== key) { // Only update if key actually changed by manual input
           setStatusMessage('API Key 已設定。正在準備加載數據...');
       }

    } else { // key is empty
      localStorage.removeItem('gristApiKey');
      // If key becomes empty (e.g. manual clear, or API key becomes invalid during API call)
      // We should signal GristApiKeyManager to start attempting again.
      setShouldAttemptApiKeyFetch(true);

      // Set appropriate status message if the API key was cleared or failed non-automatically
      if (!autoFetchedSuccess && previousApiKey) {
          setStatusMessage('API Key 已清除或失效，請重新登入 Grist 或手動設定。');
      } else if (!autoFetchedSuccess) { // Initial load and first GristApiKeyManager attempt failed
          setStatusMessage('未能自動獲取 API Key。');
      }
    }

    if (previousApiKey !== key) { // Only clear data if apiKey actually changed
        setCurrentOrgId(null);
        setDocuments([]);
        setSelectedDocId('');
        setTables([]);
        setSelectedTableId('');
        setTableData(null);
        setFilterQuery('');
        setSortQuery('');
        setDataError('');
    }
  }, [popupOpenedByAutoLogic]); // apiKeyRef is used for previousApiKey, so it's not a direct dep

  // Ref to store apiKey for comparison in handleApiKeyUpdate without causing re-creation of handleApiKeyUpdate
  const apiKeyRef = useRef(apiKey);
  useEffect(() => {
    apiKeyRef.current = apiKey;
  }, [apiKey]);


  const makeGristApiRequest = useCallback(async (endpoint, method = 'GET', params = null) => {
    const currentApiKey = apiKeyRef.current; // Use the ref for current apiKey
    if (!currentApiKey) {
      console.warn("makeGristApiRequest: API Key is not set. Aborting request to", endpoint);
      throw new Error('API Key 未設定，無法發送請求。');
    }
    // ... (rest of makeGristApiRequest - no changes from your last provided full code)
    let url = `${GRIST_API_BASE_URL}${endpoint}`;
    const queryParams = new URLSearchParams();
    if (params) { for (const key_param in params) { if (params[key_param] !== undefined && params[key_param] !== null && params[key_param] !== '') { queryParams.append(key_param, params[key_param]); } } }
    if (queryParams.toString()){ url += `?${queryParams.toString()}`; }
    const response = await fetch(url, { method, headers: { 'Authorization': `Bearer ${currentApiKey}`, 'Accept': 'application/json', 'Content-Type': method !== 'GET' ? 'application/json' : undefined, }, });
    const responseData = await response.json().catch(async () => { const text = await response.text(); throw new Error(`HTTP error ${response.status}: ${text || response.statusText} (Non-JSON response)`); });
    if (!response.ok) { const errorMsg = responseData?.error?.message || responseData?.error || responseData?.message || `HTTP error ${response.status}`; if (response.status === 401 || response.status === 403) { handleApiKeyUpdate(''); } throw new Error(errorMsg); }
    return responseData;
  }, [handleApiKeyUpdate]); // apiKeyRef is implicitly used, handleApiKeyUpdate is stable


  useEffect(() => {
    const currentApiKey = apiKeyRef.current;
    if (!currentApiKey) {
      setCurrentOrgId(null); setDocuments([]); return;
    }
    const getOrgId = async () => { /* ... (getOrgId logic - no changes, uses makeGristApiRequest) ... */ setIsLoadingDocs(true); setStatusMessage('API Key 有效，正在獲取組織資訊...'); try { const orgsData = await makeGristApiRequest('/api/orgs'); let determinedOrgId = null; if (orgsData && Array.isArray(orgsData) && orgsData.length > 0) { if (TARGET_ORG_DOMAIN) { const targetOrg = orgsData.find(org => org.domain === TARGET_ORG_DOMAIN); if (targetOrg) determinedOrgId = targetOrg.id; else determinedOrgId = orgsData[0].id; } else { determinedOrgId = orgsData[0].id; } } else if (orgsData && orgsData.id) { determinedOrgId = orgsData.id; } if (determinedOrgId) { setCurrentOrgId(determinedOrgId); } else { throw new Error('未能獲取到有效的組織 ID。'); } } catch (error) { setStatusMessage(`獲取組織 ID 失敗: ${error.message}`); setCurrentOrgId(null); setDocuments([]); setIsLoadingDocs(false); } };
    getOrgId();
  }, [apiKey, makeGristApiRequest]); // apiKey is a direct dependency here for re-fetching orgs if key changes


  useEffect(() => {
    const currentApiKey = apiKeyRef.current;
    if (!currentOrgId || !currentApiKey) {
      setDocuments([]); return;
    }
    const fetchDocsFromWorkspaces = async () => { /* ... (fetchDocsFromWorkspaces logic - no changes) ... */ setIsLoadingDocs(true); setStatusMessage(`正在從組織 ID ${currentOrgId} 獲取文檔列表...`); try { const workspacesData = await makeGristApiRequest(`/api/orgs/${currentOrgId}/workspaces`); const allDocs = []; let docNameCounts = {}; workspacesData.forEach(workspace => { if (workspace.docs && Array.isArray(workspace.docs)) { workspace.docs.forEach(doc => { docNameCounts[doc.name] = (docNameCounts[doc.name] || 0) + 1; allDocs.push({ id: doc.id, name: doc.name, workspaceName: workspace.name, workspaceId: workspace.id }); }); } }); const processedDocs = allDocs.map(doc => ({ ...doc, displayName: docNameCounts[doc.name] > 1 ? `${doc.name} (${doc.workspaceName})` : doc.name })); if (processedDocs.length > 0) { setDocuments(processedDocs); setStatusMessage('文檔列表獲取成功。請選擇一個文檔。'); } else { setDocuments([]); setStatusMessage(`在組織 ID ${currentOrgId} 下未找到任何文檔。`); } } catch (error) { setStatusMessage(`獲取文檔列表失敗: ${error.message}`); setDocuments([]); } finally { setIsLoadingDocs(false); } };
    fetchDocsFromWorkspaces();
  }, [currentOrgId, apiKey, makeGristApiRequest]); // apiKey is a direct dependency


  useEffect(() => {
    const currentApiKey = apiKeyRef.current;
    if (!selectedDocId || !currentApiKey) {
      setTables([]); setSelectedTableId(''); return;
    }
    const fetchTables = async () => { /* ... (fetchTables logic - no changes) ... */ setIsLoadingTables(true); setStatusMessage(`正在獲取文檔 "${selectedDocId}" 的表格列表...`); setDataError(''); try { const data = await makeGristApiRequest(`/api/docs/${selectedDocId}/tables`); const tableList = data.tables || (Array.isArray(data) ? data : []); if (Array.isArray(tableList)) { setTables(tableList.map(table => ({ id: table.id, name: table.id }))); setStatusMessage(tableList.length > 0 ? '表格列表獲取成功。' : '該文檔中未找到表格。'); } else { throw new Error('表格列表格式不正確。'); } } catch (error) { setStatusMessage(`獲取表格列表失敗: ${error.message}`); setTables([]); } finally { setIsLoadingTables(false); } };
    fetchTables();
  }, [selectedDocId, apiKey, makeGristApiRequest]); // apiKey is a direct dependency


  const handleFetchTableData = useCallback(async () => { /* ... (handleFetchTableData logic - no changes, uses makeGristApiRequest) ... */ if (!apiKeyRef.current || !selectedDocId || !selectedTableId) { setDataError('請先設定 API Key 並選擇文檔和表格。'); return; } setIsLoadingData(true); setDataError(''); setTableData(null); setColumns([]); setStatusMessage(`正在獲取 ${selectedTableId} 的數據...`); const params = { limit: '50' }; if (filterQuery) { try { JSON.parse(filterQuery); params.filter = filterQuery; } catch (e) { setDataError('過濾條件不是有效的 JSON 格式.'); setStatusMessage('過濾條件格式錯誤.'); setIsLoadingData(false); return; }} if (sortQuery.trim()) { params.sort = sortQuery.trim(); } try { const data = await makeGristApiRequest(`/api/docs/${selectedDocId}/tables/${selectedTableId}/records`, 'GET', params); if (data && data.records) { setTableData(data.records); if (data.records.length > 0) { const allCols = new Set(); data.records.forEach(rec => { if (rec.fields) Object.keys(rec.fields).forEach(key => allCols.add(key)); }); setColumns(Array.from(allCols)); setStatusMessage(`成功獲取 ${data.records.length} 條數據。`); } else { setColumns([]); setStatusMessage('數據獲取成功，但結果為空。'); } } else { throw new Error('數據格式不正確，缺少 "records" 屬性。'); } } catch (error) { setDataError(`獲取數據失敗: ${error.message}`); setStatusMessage(`獲取數據失敗: ${error.message}`); setTableData([]); } finally { setIsLoadingData(false); } }, [selectedDocId, selectedTableId, makeGristApiRequest, filterQuery, sortQuery]);


  const openGristLoginPopupAndRetry = useCallback(() => {
    if (gristLoginPopupRef.current && !gristLoginPopupRef.current.closed) {
      gristLoginPopupRef.current.focus();
      return;
    }
    console.log("GristDynamicSelectorViewer: Opening Grist login popup.");
    const loginUrl = `${GRIST_API_BASE_URL}/login`;
    gristLoginPopupRef.current = window.open(loginUrl, 'GristLoginPopup', 'width=600,height=700,scrollbars=yes,resizable=yes,noopener,noreferrer');
    localStorage.setItem('gristLoginPopupOpen', 'true');
    setPopupOpenedByAutoLogic(true);
    setStatusMessage('請在新視窗中完成 Grist 登入。本頁面將嘗試自動檢測登入狀態。');
    setShouldAttemptApiKeyFetch(true); // Crucial: Signal GristApiKeyManager to start/continue retrying

    const checkPopupClosedInterval = setInterval(() => {
        if (gristLoginPopupRef.current && gristLoginPopupRef.current.closed) {
            clearInterval(checkPopupClosedInterval);
            localStorage.removeItem('gristLoginPopupOpen');
            setPopupOpenedByAutoLogic(false);
            gristLoginPopupRef.current = null;
            if (!apiKeyRef.current) { // Check current apiKey via ref
                setStatusMessage('Grist 登入視窗已關閉。如果尚未登入，請點擊下方按鈕或等待自動重試。');
                // If popup is closed and still no key, we might want to stop aggressive retries from GristApiKeyManager
                // by setting shouldAttemptApiKeyFetch to false, or let it continue based on its own logic.
                // For now, GristApiKeyManager will stop if popup flag is removed and retries fail.
            }
        }
    }, 1000);
  }, []); // No dependencies needed as it uses refs and setters


  useEffect(() => {
    console.log("GristDynamicSelectorViewer: Initial mount effect. apiKey from state:", apiKeyRef.current ? "******" : "null");
    const storedApiKey = localStorage.getItem('gristApiKey');
    
    if (!apiKeyRef.current && !storedApiKey) {
      console.log("GristDynamicSelectorViewer: No API key found, setting shouldAttemptApiKeyFetch to true for GristApiKeyManager.");
      setShouldAttemptApiKeyFetch(true); // Start GristApiKeyManager's attempt

      // Clear previous timer if any (e.g., from HMR)
      if (autoOpenPopupTimerRef.current) clearTimeout(autoOpenPopupTimerRef.current);

      autoOpenPopupTimerRef.current = setTimeout(() => {
        // Re-check apiKey using the ref to get the most current state value
        // and also check if GristApiKeyManager has a localApiKey (manual input case)
        let managerHasProvisionalKey = false;
        if (apiKeyManagerRef.current && typeof apiKeyManagerRef.current.getLocalApiKey === 'function') { // Assuming getLocalApiKey is exposed
            managerHasProvisionalKey = !!apiKeyManagerRef.current.getLocalApiKey();
        }

        if (!apiKeyRef.current && !localStorage.getItem('gristApiKey') && !managerHasProvisionalKey &&
            !(gristLoginPopupRef.current && !gristLoginPopupRef.current.closed)
        ) {
          console.log("GristDynamicSelectorViewer: Still no API key after delay, auto-opening login popup.");
          setStatusMessage('未能自動獲取 API Key，正在嘗試打開 Grist 登入視窗...');
          openGristLoginPopupAndRetry();
        } else {
            console.log("GristDynamicSelectorViewer: API key obtained or popup already open during delay, not auto-opening new popup.");
        }
      }, AUTO_OPEN_POPUP_DELAY);

      return () => clearTimeout(autoOpenPopupTimerRef.current);
    } else if (apiKeyRef.current || storedApiKey) {
        // If key exists (from state or localStorage), no need for initial auto-attempt or auto-popup logic
        console.log("GristDynamicSelectorViewer: API key already present, shouldAttemptApiKeyFetch set to false.");
        setShouldAttemptApiKeyFetch(false);
    }
  }, []); // Empty dependency array for one-time execution on mount


  return (
    <div style={{ padding: '25px', fontFamily: theme.fontFamily, fontSize: theme.fontSizeBase, lineHeight: theme.lineHeightBase, color: theme.textColor, backgroundColor: theme.backgroundColor, maxWidth: '1000px', margin: '20px auto', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', borderRadius: '8px', }}>
      <h1 style={{ color: theme.textColor, textAlign: 'center', marginBottom: '15px', fontSize: '28px', }}>
        Grist 數據動態選擇查看器
      </h1>
      <p style={{ textAlign: 'center', color: theme.textColorSubtle, fontSize: theme.fontSizeSmall, marginBottom: '25px' }}>
        API 目標: <code>{GRIST_API_BASE_URL}</code> (目標組織域名: <code>{TARGET_ORG_DOMAIN || '未指定'}</code>)
      </p>

      {statusMessage && ( <p style={{ padding: '12px 15px', backgroundColor: statusMessage.includes('失敗') || statusMessage.includes('錯誤') || statusMessage.includes('尚未登入') || statusMessage.includes('未能自動獲取') ? theme.errorColorBg : theme.successColorBg, border: `1px solid ${statusMessage.includes('失敗') || statusMessage.includes('錯誤') || statusMessage.includes('尚未登入')|| statusMessage.includes('未能自動獲取') ? theme.errorColor : theme.successColor}`, color: statusMessage.includes('失敗') || statusMessage.includes('錯誤') || statusMessage.includes('尚未登入')|| statusMessage.includes('未能自動獲取') ? theme.errorColor : theme.successColor, marginTop: '10px', marginBottom: '20px', borderRadius: theme.borderRadius, fontSize: theme.fontSizeSmall, textAlign: 'center', }}> {statusMessage} </p> )}

      <GristApiKeyManager
        ref={apiKeyManagerRef}
        apiKey={apiKey}
        onApiKeyUpdate={handleApiKeyUpdate}
        onStatusUpdate={setStatusMessage}
        shouldAttemptFetch={shouldAttemptApiKeyFetch}
      />

      {!apiKey && (localStorage.getItem('gristLoginPopupOpen') !== 'true') && (
        <div style={{ padding: '20px', margin: '20px 0', border: `1px solid ${theme.errorColor}`, borderRadius: theme.borderRadius, textAlign: 'center', backgroundColor: theme.errorColorBg }}>
          <p style={{ color: theme.errorColor, margin: '0 0 15px 0', fontWeight: '500' }}>
            需要 Grist 登入才能使用完整功能。
          </p>
          <button onClick={openGristLoginPopupAndRetry} style={{ padding: '10px 15px', marginRight: '10px', fontSize: theme.fontSizeBase, backgroundColor: theme.primaryColor, color: theme.primaryColorText, border: 'none', borderRadius: theme.borderRadius, cursor: 'pointer' }}>
            開啟 Grist 登入視窗
          </button>
          <button 
            onClick={() => {
                if (apiKeyManagerRef.current) {
                    setStatusMessage('正在手動嘗試獲取 API Key...');
                    apiKeyManagerRef.current.triggerFetchKeyFromProfile();
                }
            }}
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
            <select id="docSelect" value={selectedDocId} onChange={(e) => { setSelectedDocId(e.target.value); setSelectedTableId(''); setTableData(null); setFilterQuery(''); setSortQuery(''); setDataError(''); }} disabled={isLoadingDocs || documents.length === 0} style={{ width: '100%', padding: '10px', fontSize: theme.fontSizeBase, border: `1px solid ${theme.borderColor}`, borderRadius: theme.borderRadius, boxSizing: 'border-box', backgroundColor: '#fff', color: theme.textColor, }}>
              <option value="">{isLoadingDocs ? '正在加載文檔...' : (documents.length === 0 && apiKey && currentOrgId ? '當前組織下未找到文檔' : (apiKey ? '-- 請選擇文檔 --' : '請先設定 API Key'))}</option>
              {documents.map((doc) => ( <option key={doc.id} value={doc.id}> {doc.displayName} </option> ))}
            </select>
            {selectedDocId && documents.find(d => d.id === selectedDocId) && <small style={{display: 'block', marginTop: '5px', color: theme.textColorSubtle, fontSize: '13px' }}> ID: {selectedDocId}, 所屬工作區: {documents.find(d => d.id === selectedDocId)?.workspaceName || 'N/A'} </small>}
          </div>
          {selectedDocId && ( <div style={{ marginBottom: '15px' }}> <label htmlFor="tableSelect" style={{ display: 'block', marginBottom: '8px', color: theme.textColorLight, fontSize: theme.fontSizeSmall, fontWeight: '500' }}>選擇表格:</label> <select id="tableSelect" value={selectedTableId} onChange={(e) => { setSelectedTableId(e.target.value); setTableData(null); setFilterQuery(''); setSortQuery(''); setDataError(''); }} disabled={isLoadingTables || tables.length === 0} style={{ width: '100%', padding: '10px', fontSize: theme.fontSizeBase, border: `1px solid ${theme.borderColor}`, borderRadius: theme.borderRadius, boxSizing: 'border-box', backgroundColor: '#fff', color: theme.textColor, }}> <option value="">{isLoadingTables ? '正在加載表格...' : (tables.length === 0 && selectedDocId ? '未找到表格或無權限' : '-- 請選擇表格 --')}</option> {tables.map((table) => ( <option key={table.id} value={table.id}> {table.name} </option> ))} </select> </div> )}
          {selectedDocId && selectedTableId && ( <div style={{ border: `1px solid ${theme.borderColor}`, padding: '20px', marginTop: '20px', borderRadius: theme.borderRadius, backgroundColor: '#fff', }}> <h4 style={{ marginTop: '0', marginBottom: '15px', color: theme.textColor, fontSize: '18px' }}>數據獲取選項</h4> <div style={{ marginBottom: '15px' }}><label htmlFor="filterInput" style={{ display: 'block', marginBottom: '5px', color: theme.textColorLight, fontSize: theme.fontSizeSmall }}>過濾條件 (JSON):</label><input id="filterInput" type="text" value={filterQuery} onChange={(e) => setFilterQuery(e.target.value)} placeholder='{"ColumnID": "Value"}' style={{ width: '100%', padding: '10px', fontSize: theme.fontSizeBase, border: `1px solid ${theme.borderColor}`, borderRadius: theme.borderRadius, boxSizing: 'border-box', color: theme.textColor }}/><small style={{ display: 'block', marginTop: '5px', color: theme.textColorSubtle, fontSize: '13px' }}>參考 Grist API "Filtering records"。欄位 ID 區分大小寫。</small></div> <div style={{ marginBottom: '20px' }}><label htmlFor="sortInput" style={{ display: 'block', marginBottom: '5px', color: theme.textColorLight, fontSize: theme.fontSizeSmall }}>排序條件:</label><input id="sortInput" type="text" value={sortQuery} onChange={(e) => setSortQuery(e.target.value)} placeholder='ColumnID, -AnotherColumnID' style={{ width: '100%', padding: '10px', fontSize: theme.fontSizeBase, border: `1px solid ${theme.borderColor}`, borderRadius: theme.borderRadius, boxSizing: 'border-box', color: theme.textColor }}/><small style={{ display: 'block', marginTop: '5px', color: theme.textColorSubtle, fontSize: '13px' }}>參考 "Sorting records"。前綴 "-" 表示降序。</small></div> <button onClick={handleFetchTableData} disabled={isLoadingData} style={{ padding: '12px 20px', marginTop: '10px', width: '100%', boxSizing: 'border-box', backgroundColor: isLoadingData ? '#6c757d' : theme.primaryColor, color: theme.primaryColorText, border: 'none', borderRadius: theme.borderRadius, cursor: isLoadingData ? 'default' : 'pointer', fontSize: '16px', fontWeight: '500', opacity: isLoadingData ? 0.7 : 1, }}>{isLoadingData ? '正在加載數據...' : `獲取 "${selectedTableId}" 的數據`}</button> </div> )}
          {dataError && <p style={{ color: theme.errorColor, marginTop: '15px', whiteSpace: 'pre-wrap', padding: '12px 15px', backgroundColor: theme.errorColorBg, border: `1px solid ${theme.errorColor}`, borderRadius: theme.borderRadius, fontSize: theme.fontSizeSmall, }}>錯誤：{dataError}</p>}
        </div>
      )}
      {tableData && tableData.length > 0 && columns.length > 0 && ( <div style={{ marginTop: '30px', overflowX: 'auto' }}> <h3 style={{ marginBottom: '15px', color: theme.textColor }}>數據結果: (前 {Math.min(tableData.length, 50)} 條)</h3> <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px', fontSize: theme.fontSizeSmall, boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderRadius: theme.borderRadius, overflow: 'hidden', }}><thead><tr><th style={{backgroundColor: '#e9ecef', padding: '12px 10px', textAlign: 'left', color: theme.textColor, fontWeight: '600', borderBottom: `2px solid ${theme.borderColor}`, position: 'sticky', left: 0, zIndex: 1}}>id</th>{columns.map((col) => (<th key={col} style={{backgroundColor: '#e9ecef', padding: '12px 10px', textAlign: 'left', color: theme.textColor, fontWeight: '600', borderBottom: `2px solid ${theme.borderColor}`}}>{col}</th>))}</tr></thead><tbody>{tableData.map((record, rowIndex) => (<tr key={record.id} style={{ backgroundColor: rowIndex % 2 === 0 ? '#fff' : theme.surfaceColor , borderBottom: `1px solid ${theme.borderColor}` }}><td style={{ padding: '10px', whiteSpace: 'nowrap', color: theme.textColorLight, position: 'sticky', left: 0, backgroundColor: rowIndex % 2 === 0 ? '#fff' : theme.surfaceColor, zIndex: 1, borderRight: `1px solid ${theme.borderColor}` }}>{record.id}</td>{columns.map((col) => (<td key={`${record.id}-${col}`} style={{ padding: '10px', whiteSpace: 'nowrap', color: theme.textColorLight }}>{record.fields && record.fields[col] !== undefined && record.fields[col] !== null ? (typeof record.fields[col] === 'object' ? JSON.stringify(record.fields[col]) : String(record.fields[col])) : ''}</td>))}</tr>))}</tbody></table></div>)}
      {apiKey && selectedDocId && selectedTableId && tableData && tableData.length === 0 && !isLoadingData && !dataError && ( <p style={{ marginTop: '15px', padding: '12px 15px', backgroundColor: '#fff3cd', border: '1px solid #ffeeba', color: '#856404', borderRadius: theme.borderRadius, fontSize: theme.fontSizeSmall, textAlign: 'center', }}> {filterQuery || sortQuery ? '沒有符合目前過濾/排序條件的數據，或表格本身為空。' : '該表格目前沒有數據。'} </p> )}
    </div>
  );
}

export default GristDynamicSelectorViewer;