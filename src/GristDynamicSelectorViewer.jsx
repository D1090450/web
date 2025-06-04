// src/GristDynamicSelectorViewerApp.jsx (新的頂層文件名，或保持原名並重構內部)

import React, { useState, useCallback, useEffect, useRef } from 'react';

// --- 常量和主題 ---
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

// --- 組件 1: GristLoginOrApiKeyProvider ---
const GristLoginOrApiKeyProvider = ({ children, onApiKeyReady, onStatusUpdate }) => {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gristApiKey') || '');
  const [localManualApiKey, setLocalManualApiKey] = useState(''); // 用於手動輸入框
  const [isFetchingApiKey, setIsFetchingApiKey] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [initialAttemptFailed, setInitialAttemptFailed] = useState(false);
  const retryTimerRef = useRef(null);
  const gristLoginPopupRef = useRef(null);

  const updateApiKeyAndNotify = useCallback((key, autoFetchedSuccess = false) => {
    console.log(`GristLoginOrApiKeyProvider: updateApiKeyAndNotify with key: ${key ? '******' : '""'}, autoFetchedSuccess: ${autoFetchedSuccess}`);
    setApiKey(key);
    onApiKeyReady(key); // 通知父組件 API Key 已準備好 (或變為空)

    if (key) {
      localStorage.setItem('gristApiKey', key);
      setShowLoginPrompt(false);
      setInitialAttemptFailed(false);
      if (autoFetchedSuccess) {
        onStatusUpdate('API Key 自動獲取成功！');
        if (gristLoginPopupRef.current && !gristLoginPopupRef.current.closed) {
          try { gristLoginPopupRef.current.close(); localStorage.removeItem('gristLoginPopupOpen'); }
          catch (e) { console.warn("Could not auto-close popup", e); onStatusUpdate("登入成功！請手動關閉登入視窗。");}
          gristLoginPopupRef.current = null;
        }
      } else {
        onStatusUpdate('API Key 已設定。');
      }
    } else { // key 為空
      localStorage.removeItem('gristApiKey');
      if (!autoFetchedSuccess) { // 避免自動重試循環中不斷觸發
          setShowLoginPrompt(true);
      }
      setInitialAttemptFailed(true); // 總是設置為 true 以便重試邏輯可以判斷
      onStatusUpdate('API Key 獲取失敗或已清除。');
    }
  }, [onApiKeyReady, onStatusUpdate]);

  const fetchKeyFromProfile = useCallback(async (isRetry = false) => {
    if (isFetchingApiKey && !isRetry) return false;
    setIsFetchingApiKey(true);
    if (!isRetry) onStatusUpdate('正在從個人資料獲取 API Key...');

    try {
      const response = await fetch(`${GRIST_API_BASE_URL}/api/profile/apiKey`, { method: 'GET', credentials: 'include', headers: { 'Accept': 'text/plain' } });
      const responseText = await response.text();
      console.log('GristLoginOrApiKeyProvider: response from /api/profile/apiKey: ', responseText);
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${responseText || '無法獲取 API Key'}`);
      const fetchedKey = responseText.trim();
      if (!fetchedKey || fetchedKey.includes('<') || fetchedKey.length < 32) throw new Error('獲取到的 API Key 似乎無效。');
      
      updateApiKeyAndNotify(fetchedKey, true); // true for autoFetchedSuccess
      clearTimeout(retryTimerRef.current);
      return true;
    } catch (error) {
      console.error("GristLoginOrApiKeyProvider: Error fetching API key:", error.message);
      if (!isRetry) onStatusUpdate(`自動獲取 API Key 失敗: ${error.message}`);
      updateApiKeyAndNotify('', false); // false for autoFetchedSuccess
      return false;
    } finally {
      setIsFetchingApiKey(false);
    }
  }, [updateApiKeyAndNotify, onStatusUpdate]); // isFetchingApiKey 移除

  const handleManualSubmit = useCallback(() => {
    clearTimeout(retryTimerRef.current);
    const trimmedKey = localManualApiKey.trim();
    if (trimmedKey) {
      updateApiKeyAndNotify(trimmedKey, false);
    } else {
      onStatusUpdate('請輸入有效的 API Key。');
    }
  }, [localManualApiKey, updateApiKeyAndNotify, onStatusUpdate]);

  useEffect(() => {
    if (apiKey) { // 如果已經有 API Key (來自 localStorage 或已獲取)
      clearTimeout(retryTimerRef.current);
      setInitialAttemptFailed(false); // 確保不會觸發不必要的重試
      onApiKeyReady(apiKey); // 確保父組件知道
      return;
    }

    if (initialAttemptFailed && !apiKey) {
      console.log("GristLoginOrApiKeyProvider: Initial attempt flag is true, API key missing. Starting fetch/retry.");
      fetchKeyFromProfile(false).then(success => {
        if (!success) {
          if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
          retryTimerRef.current = setTimeout(function zichzelf() {
            console.log("GristLoginOrApiKeyProvider: Retrying to fetch API key...");
            fetchKeyFromProfile(true).then(retrySuccess => {
              if (!retrySuccess && localStorage.getItem('gristLoginPopupOpen') === 'true') {
                retryTimerRef.current = setTimeout(zichzelf, API_KEY_RETRY_INTERVAL);
              } else if (retrySuccess) {
                localStorage.removeItem('gristLoginPopupOpen');
              } else if (!localStorage.getItem('gristLoginPopupOpen')) {
                console.log("GristLoginOrApiKeyProvider: Popup not open and retry failed, stopping retries.");
                clearTimeout(retryTimerRef.current);
              }
            });
          }, API_KEY_RETRY_INTERVAL);
        }
      });
    }
    return () => clearTimeout(retryTimerRef.current);
  }, [apiKey, fetchKeyFromProfile, initialAttemptFailed, onApiKeyReady]);


  const openGristLoginPopup = useCallback(() => {
    if (gristLoginPopupRef.current && !gristLoginPopupRef.current.closed) {
      gristLoginPopupRef.current.focus(); return;
    }
    gristLoginPopupRef.current = window.open(`${GRIST_API_BASE_URL}/login`, 'GristLoginPopup', 'width=600,height=700,...');
    localStorage.setItem('gristLoginPopupOpen', 'true');
    onStatusUpdate('請在新視窗中完成 Grist 登入...');
    setInitialAttemptFailed(true); // 確保重試開始/繼續

    const checkPopupClosedInterval = setInterval(() => {
      if (gristLoginPopupRef.current && gristLoginPopupRef.current.closed) {
        clearInterval(checkPopupClosedInterval);
        localStorage.removeItem('gristLoginPopupOpen');
        gristLoginPopupRef.current = null;
        if (!apiKey) { // 檢查的是 state 中的 apiKey
          onStatusUpdate('Grist 登入視窗已關閉。');
          clearTimeout(retryTimerRef.current); // 用戶關閉彈窗，停止自動重試
          // 這裡可以考慮是否再次將 initialAttemptFailed 設為 false，
          // 使得只有再次點擊“開啟登入視窗”才會觸發重試。
          // 或者保持為 true，如果用戶只是意外關閉，頁面仍在嘗試。
          // 目前的邏輯是，只要 initialAttemptFailed 為 true 且 apiKey 為空，就會嘗試。
          // 所以用戶關閉彈窗後，如果還沒登入，它還是會按3秒間隔嘗試一次（如果 fetchKeyFromProfile 返回 false）
        }
      }
    }, 1000);
  }, [apiKey, onStatusUpdate]);

  // 初始加載時決定是否設置 initialAttemptFailed
  useEffect(() => {
    if (!localStorage.getItem('gristApiKey') && !apiKey) {
      setInitialAttemptFailed(true);
    }
  }, []); // 空依賴，僅執行一次

  return (
    <div>
      <div style={{ marginBottom: '20px', padding: '15px', border: `1px dashed ${theme.borderColor}`, borderRadius: theme.borderRadius, backgroundColor: theme.surfaceColor }}>
        <h4 style={{ marginTop: '0', marginBottom: '10px', color: theme.textColor }}>API Key 管理</h4>
        <p style={{ fontSize: theme.fontSizeSmall, color: theme.textColorSubtle, marginBottom: '15px' }}>
          若要啟用 "自動獲取"，請先登入您的 Grist 實例 (<code>{GRIST_API_BASE_URL}</code>)。
          或從 Grist 個人資料頁面手動複製 API Key。
        </p>
        <input
          type="password"
          value={localManualApiKey}
          onChange={(e) => setLocalManualApiKey(e.target.value)}
          placeholder="在此輸入或貼上 Grist API Key"
          style={{ width: 'calc(100% - 160px)', marginRight: '10px', padding: '10px', fontSize: theme.fontSizeBase, border: `1px solid ${theme.borderColor}`, borderRadius: theme.borderRadius, boxSizing: 'border-box', color: theme.textColor }}
        />
        <button onClick={handleManualSubmit} style={{ padding: '10px 15px', fontSize: theme.fontSizeBase, backgroundColor: '#e9ecef', color: theme.textColor, border: `1px solid ${theme.borderColor}`, borderRadius: theme.borderRadius, cursor: 'pointer' }}>
          設定手動 Key
        </button>
      </div>

      {showLoginPrompt && !apiKey && (
        <div style={{ padding: '20px', margin: '20px 0', border: `1px solid ${theme.errorColor}`, borderRadius: theme.borderRadius, textAlign: 'center', backgroundColor: theme.errorColorBg }}>
          <p style={{ color: theme.errorColor, margin: '0 0 15px 0', fontWeight: '500' }}>
            您似乎尚未登入 Grist，或者 API Key 無法自動獲取。
          </p>
          <button onClick={openGristLoginPopup} style={{ padding: '10px 15px', marginRight: '10px', fontSize: theme.fontSizeBase, backgroundColor: theme.primaryColor, color: theme.primaryColorText, border: 'none', borderRadius: theme.borderRadius, cursor: 'pointer' }} >
            開啟 Grist 登入視窗
          </button>
          <button onClick={() => fetchKeyFromProfile(false)} style={{ padding: '10px 15px', backgroundColor: '#6c757d', color: theme.primaryColorText, border: 'none', borderRadius: theme.borderRadius, cursor: 'pointer'}}>
            手動重試獲取 API Key
          </button>
        </div>
      )}
      {/* children 是實際需要 apiKey 的應用部分 */}
      {apiKey ? children : null}
    </div>
  );
};


// --- 工具函數: makeGristApiRequest (現在依賴傳入的 apiKey) ---
const makeGristApiRequest = async (apiKey, endpoint, method = 'GET', params = null, onApiKeyInvalidated = () => {}) => {
  if (!apiKey) {
    console.warn("makeGristApiRequest (util): API Key is not set. Aborting request to", endpoint);
    throw new Error('API Key 未設定，無法發送請求。');
  }
  console.log(`makeGristApiRequest (util): Fetching ${endpoint} with apiKey.`);
  let url = `${GRIST_API_BASE_URL}${endpoint}`;
  // ... (URL構建邏輯不變) ...
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
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json', 'Content-Type': method !== 'GET' ? 'application/json' : undefined },
  });
  const responseData = await response.json().catch(async () => { const text = await response.text(); throw new Error(`HTTP error ${response.status}: ${text || response.statusText} (Non-JSON response)`); });
  if (!response.ok) {
    const errorMsg = responseData?.error?.message || responseData?.error || responseData?.message || `HTTP error ${response.status}`;
    console.error(`Grist API Error for ${method} ${url}:`, responseData);
    if (response.status === 401 || response.status === 403) {
      onApiKeyInvalidated(); // 調用回呼函數來處理 API Key 失效
    }
    throw new Error(errorMsg);
  }
  return responseData;
};


// --- 組件 2: GristDocumentSelector ---
const GristDocumentSelector = ({ apiKey, onDocumentsFetched, onDocSelected, currentSelectedDocId, onStatusUpdate, onApiKeyInvalidated }) => {
  const [currentOrgId, setCurrentOrgId] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // 獲取組織 ID
  useEffect(() => {
    if (!apiKey) { setCurrentOrgId(null); setDocuments([]); return; }
    console.log("GristDocumentSelector: API Key present, fetching org ID.");
    setIsLoading(true);
    onStatusUpdate('正在獲取組織資訊 (文檔選擇器)...');
    makeGristApiRequest(apiKey, '/api/orgs', 'GET', null, onApiKeyInvalidated)
      .then(orgsData => {
        console.log("GristDocumentSelector: Orgs data:", orgsData);
        let determinedOrgId = null;
        if (orgsData && Array.isArray(orgsData) && orgsData.length > 0) {
          const targetOrg = TARGET_ORG_DOMAIN ? orgsData.find(org => org.domain === TARGET_ORG_DOMAIN) : null;
          determinedOrgId = targetOrg ? targetOrg.id : orgsData[0].id;
        } else if (orgsData && orgsData.id) { determinedOrgId = orgsData.id; }
        
        if (determinedOrgId) { setCurrentOrgId(determinedOrgId); }
        else { throw new Error('未能獲取到有效的組織 ID (文檔選擇器)。'); }
      })
      .catch(error => {
        console.error('GristDocumentSelector: Error fetching org ID:', error);
        onStatusUpdate(`獲取組織 ID 失敗: ${error.message}`);
        setCurrentOrgId(null); setDocuments([]); setIsLoading(false);
      });
      // setIsLoading(false) 會在獲取文檔後處理
  }, [apiKey, onStatusUpdate, onApiKeyInvalidated]);

  // 獲取文檔列表
  useEffect(() => {
    if (!currentOrgId || !apiKey) { setDocuments([]); return; }
    console.log("GristDocumentSelector: Org ID present, fetching documents for org:", currentOrgId);
    setIsLoading(true);
    onStatusUpdate(`正在從組織 ID ${currentOrgId} 獲取文檔列表...`);
    makeGristApiRequest(apiKey, `/api/orgs/${currentOrgId}/workspaces`, 'GET', null, onApiKeyInvalidated)
      .then(workspacesData => {
        console.log("GristDocumentSelector: Workspaces data:", workspacesData);
        const allDocs = []; let docNameCounts = {};
        workspacesData.forEach(ws => ws.docs?.forEach(doc => {
          docNameCounts[doc.name] = (docNameCounts[doc.name] || 0) + 1;
          allDocs.push({ ...doc, displayName: docNameCounts[doc.name] > 1 ? `${doc.name} (${ws.name})` : doc.name, workspaceName: ws.name });
        }));
        setDocuments(allDocs);
        onDocumentsFetched(allDocs); // 通知父組件
        onStatusUpdate(allDocs.length > 0 ? '文檔列表獲取成功。' : `組織 ${currentOrgId} 下無文檔。`);
      })
      .catch(error => {
        console.error('GristDocumentSelector: Error fetching documents:', error);
        onStatusUpdate(`獲取文檔列表失敗: ${error.message}`);
        setDocuments([]); onDocumentsFetched([]);
      })
      .finally(() => setIsLoading(false));
  }, [currentOrgId, apiKey, onDocumentsFetched, onStatusUpdate, onApiKeyInvalidated]);

  return (
    <div style={{ marginBottom: '15px' }}>
      <label htmlFor="docSelect" style={{ display: 'block', marginBottom: '8px', color: theme.textColorLight, fontSize: theme.fontSizeSmall, fontWeight: '500' }}>選擇文檔:</label>
      <select
        id="docSelect"
        value={currentSelectedDocId}
        onChange={(e) => onDocSelected(e.target.value, currentOrgId)} // 回傳 currentOrgId
        disabled={isLoading || documents.length === 0}
        style={{ width: '100%', padding: '10px', fontSize: theme.fontSizeBase, border: `1px solid ${theme.borderColor}`, borderRadius: theme.borderRadius, boxSizing: 'border-box', backgroundColor: '#fff', color: theme.textColor }}
      >
        <option value="">{isLoading ? '正在加載文檔...' : (documents.length === 0 && apiKey && currentOrgId ? '當前組織下未找到文檔' : (apiKey ? '-- 請選擇文檔 --' : '等待 API Key...'))}</option>
        {documents.map((doc) => ( <option key={doc.id} value={doc.id}> {doc.displayName} </option> ))}
      </select>
      {currentSelectedDocId && documents.find(d => d.id === currentSelectedDocId) && <small style={{display: 'block', marginTop: '5px', color: theme.textColorSubtle, fontSize: '13px' }}> ID: {currentSelectedDocId}, 所屬工作區: {documents.find(d => d.id === currentSelectedDocId)?.workspaceName || 'N/A'} </small>}
    </div>
  );
};


// --- 組件 3: GristTableSelector ---
const GristTableSelector = ({ apiKey, selectedDocId, onTableSelected, currentSelectedTableId, onStatusUpdate, onApiKeyInvalidated }) => {
  const [tables, setTables] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!selectedDocId || !apiKey) { setTables([]); return; }
    console.log("GristTableSelector: Doc ID present, fetching tables for doc:", selectedDocId);
    setIsLoading(true);
    onStatusUpdate(`正在獲取文檔 "${selectedDocId}" 的表格列表...`);
    makeGristApiRequest(apiKey, `/api/docs/${selectedDocId}/tables`, 'GET', null, onApiKeyInvalidated)
      .then(data => {
        console.log("GristTableSelector: Tables data:", data);
        const tableList = data.tables || (Array.isArray(data) ? data : []);
        setTables(tableList.map(table => ({ id: table.id, name: table.id })));
        onStatusUpdate(tableList.length > 0 ? '表格列表獲取成功。' : '該文檔中未找到表格。');
      })
      .catch(error => {
        console.error('GristTableSelector: Error fetching tables:', error);
        onStatusUpdate(`獲取表格列表失敗: ${error.message}`); setTables([]);
      })
      .finally(() => setIsLoading(false));
  }, [selectedDocId, apiKey, onStatusUpdate, onApiKeyInvalidated]);

  return (
    <div style={{ marginBottom: '15px' }}>
      <label htmlFor="tableSelect" style={{ display: 'block', marginBottom: '8px', color: theme.textColorLight, fontSize: theme.fontSizeSmall, fontWeight: '500' }}>選擇表格:</label>
      <select
        id="tableSelect"
        value={currentSelectedTableId}
        onChange={(e) => onTableSelected(e.target.value)}
        disabled={isLoading || tables.length === 0}
        style={{ width: '100%', padding: '10px', fontSize: theme.fontSizeBase, border: `1px solid ${theme.borderColor}`, borderRadius: theme.borderRadius, boxSizing: 'border-box', backgroundColor: '#fff', color: theme.textColor }}
      >
        <option value="">{isLoading ? '正在加載表格...' : (tables.length === 0 && selectedDocId ? '未找到表格或無權限' : '-- 請選擇表格 --')}</option>
        {tables.map((table) => ( <option key={table.id} value={table.id}> {table.name} </option> ))}
      </select>
    </div>
  );
};

// --- 組件 4: GristDataControlsAndDisplay ---
const GristDataControlsAndDisplay = ({ apiKey, selectedDocId, selectedTableId, onStatusUpdate, onDataError, onApiKeyInvalidated }) => {
  const [filterQuery, setFilterQuery] = useState('');
  const [sortQuery, setSortQuery] = useState('');
  const [tableData, setTableData] = useState(null);
  const [columns, setColumns] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  const handleFetchTableData = useCallback(async () => {
    if (!apiKey || !selectedDocId || !selectedTableId) { onDataError('請先選擇文檔和表格。'); return; }
    setIsLoadingData(true); onDataError(''); setTableData(null); setColumns([]);
    onStatusUpdate(`正在獲取 ${selectedTableId} 的數據...`);
    const params = { limit: '50' };
    if (filterQuery) { try { JSON.parse(filterQuery); params.filter = filterQuery; } catch (e) { onDataError('過濾條件JSON無效.'); setIsLoadingData(false); return; }}
    if (sortQuery.trim()) { params.sort = sortQuery.trim(); }

    makeGristApiRequest(apiKey, `/api/docs/${selectedDocId}/tables/${selectedTableId}/records`, 'GET', params, onApiKeyInvalidated)
      .then(data => {
        if (data && data.records) {
          setTableData(data.records);
          if (data.records.length > 0) {
            const allCols = new Set();
            data.records.forEach(rec => rec.fields && Object.keys(rec.fields).forEach(key => allCols.add(key)));
            setColumns(Array.from(allCols));
            onStatusUpdate(`成功獲取 ${data.records.length} 條數據。`);
          } else { setColumns([]); onStatusUpdate('數據獲取成功，但結果為空。'); }
        } else { throw new Error('數據格式不正確，缺少 "records" 屬性。'); }
      })
      .catch(error => {
        console.error('GristDataControlsAndDisplay: Error fetching table data:', error);
        onDataError(`獲取數據失敗: ${error.message}`); setTableData([]);
      })
      .finally(() => setIsLoadingData(false));
  }, [apiKey, selectedDocId, selectedTableId, filterQuery, sortQuery, onStatusUpdate, onDataError, onApiKeyInvalidated]);
  
  // 清理數據當選擇變化時
  useEffect(() => {
    setTableData(null);
    setColumns([]);
    setFilterQuery('');
    setSortQuery('');
  }, [selectedDocId, selectedTableId]);


  if (!selectedDocId || !selectedTableId) return null; // 如果沒有選擇文檔和表格，則不渲染此部分

  return (
    <>
      <div style={{ border: `1px solid ${theme.borderColor}`, padding: '20px', marginTop: '20px', borderRadius: theme.borderRadius, backgroundColor: '#fff' }}>
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
        <button onClick={handleFetchTableData} disabled={isLoadingData} style={{ padding: '12px 20px', marginTop: '10px', width: '100%', boxSizing: 'border-box', backgroundColor: isLoadingData ? '#6c757d' : theme.primaryColor, color: theme.primaryColorText, border: 'none', borderRadius: theme.borderRadius, cursor: isLoadingData ? 'default' : 'pointer', fontSize: '16px', fontWeight: '500', opacity: isLoadingData ? 0.7 : 1 }}>
          {isLoadingData ? '正在加載數據...' : `獲取 "${selectedTableId}" 的數據`}
        </button>
      </div>

      {tableData && tableData.length > 0 && columns.length > 0 && (
        <div style={{ marginTop: '30px', overflowX: 'auto' }}>
          <h3 style={{ marginBottom: '15px', color: theme.textColor }}>數據結果: (前 {Math.min(tableData.length, 50)} 條)</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px', fontSize: theme.fontSizeSmall, boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderRadius: theme.borderRadius, overflow: 'hidden' }}>
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
      {selectedDocId && selectedTableId && tableData && tableData.length === 0 && !isLoadingData && !onDataError && ( // 修改了條件，確保 apiKey 存在
        <p style={{ marginTop: '15px', padding: '12px 15px', backgroundColor: '#fff3cd', border: '1px solid #ffeeba', color: '#856404', borderRadius: theme.borderRadius, fontSize: theme.fontSizeSmall, textAlign: 'center' }}>
            {filterQuery || sortQuery ? '沒有符合目前過濾/排序條件的數據，或表格本身為空。' : '該表格目前沒有數據。'}
        </p>
      )}
    </>
  );
};


// --- 組件 5: GristDynamicSelectorViewer (根組件) ---
function GristDynamicSelectorViewer() {
  const [rootApiKey, setRootApiKey] = useState(''); // 由 GristLoginOrApiKeyProvider 更新
  const [rootStatusMessage, setRootStatusMessage] = useState('');
  const [rootDataError, setRootDataError] = useState('');

  const [selectedOrgId, setSelectedOrgId] = useState(null); // 新增，雖然文檔選擇器內部管理，但根可能也需要知道
  const [selectedDocId, setSelectedDocId] = useState('');
  const [selectedTableId, setSelectedTableId] = useState('');

  const handleApiKeyReady = useCallback((key) => {
    console.log("GristDynamicSelectorViewer (root): API Key is ready/updated:", key ? '******' : '""');
    setRootApiKey(key);
    // 當 API Key 變為空時，清除所有後續選擇
    if (!key) {
      setSelectedOrgId(null);
      setSelectedDocId('');
      setSelectedTableId('');
    }
  }, []);

  const handleApiKeyInvalidated = useCallback(() => {
    console.log("GristDynamicSelectorViewer (root): API Key invalidated by a data request.");
    setRootApiKey(''); // 清除 API Key，會觸發 GristLoginOrApiKeyProvider 的邏輯
    setRootStatusMessage('API Key 已失效或權限不足，請重新登入或設定。');
  }, []);

  const handleDocSelected = useCallback((docId, orgId) => { // GristDocumentSelector 回傳 orgId
    console.log("GristDynamicSelectorViewer (root): Document selected:", docId, "from org:", orgId);
    setSelectedDocId(docId);
    setSelectedOrgId(orgId); // 保存 orgId
    setSelectedTableId(''); // 重置表格選擇
  }, []);

  const handleTableSelected = useCallback((tableId) => {
    console.log("GristDynamicSelectorViewer (root): Table selected:", tableId);
    setSelectedTableId(tableId);
  }, []);

  return (
    <div style={{ padding: '25px', fontFamily: theme.fontFamily, fontSize: theme.fontSizeBase, lineHeight: theme.lineHeightBase, color: theme.textColor, backgroundColor: theme.backgroundColor, maxWidth: '1000px', margin: '20px auto', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', borderRadius: '8px' }}>
      <h1 style={{ color: theme.textColor, textAlign: 'center', marginBottom: '15px', fontSize: '28px' }}>
        Grist 數據動態選擇查看器
      </h1>
      <p style={{ textAlign: 'center', color: theme.textColorSubtle, fontSize: theme.fontSizeSmall, marginBottom: '25px' }}>
        API 目標: <code>{GRIST_API_BASE_URL}</code> (目標組織域名: <code>{TARGET_ORG_DOMAIN || '未指定'}</code>)
      </p>

      {rootStatusMessage && ( <p style={{ padding: '12px 15px', backgroundColor: rootStatusMessage.includes('失敗') || rootStatusMessage.includes('錯誤') || rootStatusMessage.includes('尚未登入') ? theme.errorColorBg : theme.successColorBg, border: `1px solid ${rootStatusMessage.includes('失敗') || rootStatusMessage.includes('錯誤') || rootStatusMessage.includes('尚未登入') ? theme.errorColor : theme.successColor}`, color: rootStatusMessage.includes('失敗') || rootStatusMessage.includes('錯誤') || rootStatusMessage.includes('尚未登入') ? theme.errorColor : theme.successColor, marginTop: '10px', marginBottom: '20px', borderRadius: theme.borderRadius, fontSize: theme.fontSizeSmall, textAlign: 'center' }}> {rootStatusMessage} </p> )}
      {rootDataError && <p style={{ color: theme.errorColor, marginTop: '15px', whiteSpace: 'pre-wrap', padding: '12px 15px', backgroundColor: theme.errorColorBg, border: `1px solid ${theme.errorColor}`, borderRadius: theme.borderRadius, fontSize: theme.fontSizeSmall }}>錯誤：{rootDataError}</p>}


      <GristLoginOrApiKeyProvider onApiKeyReady={handleApiKeyReady} onStatusUpdate={setRootStatusMessage}>
        {/* 只有在 rootApiKey 有效時才渲染後續的數據選擇器 */}
        {rootApiKey && (
          <div style={{ marginTop: '25px', padding: '20px', border: `1px solid ${theme.borderColor}`, borderRadius: theme.borderRadius, backgroundColor: theme.surfaceColor }}>
            <h3 style={{ marginTop: '0', marginBottom: '20px', color: theme.textColor, borderBottom: `1px solid ${theme.borderColor}`, paddingBottom: '10px' }}>選擇數據源</h3>
            <GristDocumentSelector
              apiKey={rootApiKey}
              onDocumentsFetched={() => { /* 可以選擇性處理，例如清除舊表格選擇 */ }}
              onDocSelected={handleDocSelected}
              currentSelectedDocId={selectedDocId}
              onStatusUpdate={setRootStatusMessage}
              onApiKeyInvalidated={handleApiKeyInvalidated}
            />
            {selectedDocId && (
              <GristTableSelector
                apiKey={rootApiKey}
                selectedDocId={selectedDocId}
                onTableSelected={handleTableSelected}
                currentSelectedTableId={selectedTableId}
                onStatusUpdate={setRootStatusMessage}
                onApiKeyInvalidated={handleApiKeyInvalidated}
              />
            )}
            {selectedDocId && selectedTableId && (
              <GristDataControlsAndDisplay
                apiKey={rootApiKey}
                selectedDocId={selectedDocId}
                selectedTableId={selectedTableId}
                onStatusUpdate={setRootStatusMessage}
                onDataError={setRootDataError}
                onApiKeyInvalidated={handleApiKeyInvalidated}
              />
            )}
          </div>
        )}
      </GristLoginOrApiKeyProvider>
    </div>
  );
}

export default GristDynamicSelectorViewer; // 或者你喜歡的頂層應用名稱