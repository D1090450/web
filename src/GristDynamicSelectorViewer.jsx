// src/GristDynamicSelectorViewerApp.jsx

import React, { useState, useCallback, useEffect, useRef } from 'react';

// --- 常量和主題 ---
const GRIST_API_BASE_URL = 'https://tiss-grist.fcuai.tw';
const TARGET_ORG_DOMAIN = 'fcuai.tw';
const API_KEY_RETRY_INTERVAL = 3000;

const theme = { /* ... (theme object - 保持不變) ... */ 
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
// (這個組件的邏輯在上次修改後相對穩定，主要問題可能在父組件如何使用它)
// 確保 onApiKeyUpdate, onStatusUpdate 是穩定傳入的
const GristLoginOrApiKeyProvider = ({ children, onApiKeyReady, onStatusUpdate: propOnStatusUpdate }) => {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gristApiKey') || '');
  const [localManualApiKey, setLocalManualApiKey] = useState('');
  const [isFetchingApiKey, setIsFetchingApiKey] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [initialAttemptFailed, setInitialAttemptFailed] = useState(false);
  const retryTimerRef = useRef(null);
  const gristLoginPopupRef = useRef(null);

  // 將 propOnStatusUpdate 包裹在 useCallback 中，以防其引用變化導致不必要的重渲染
  const onStatusUpdate = useCallback((message) => {
    propOnStatusUpdate(message);
  }, [propOnStatusUpdate]);


  const updateApiKeyAndNotify = useCallback((key, autoFetchedSuccess = false) => {
    console.log(`GristLoginOrApiKeyProvider: updateApiKeyAndNotify with key: ${key ? '******' : '""'}, autoFetchedSuccess: ${autoFetchedSuccess}`);
    
    // 只有當 key 的值確實改變時才更新 state 和通知父組件
    setApiKey(prevKey => {
        if (prevKey === key) return prevKey; // 如果 key 沒有變化，不執行任何操作
        onApiKeyReady(key); // 通知父組件 API Key 已準備好 (或變為空)
        return key;
    });


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
    } else {
      localStorage.removeItem('gristApiKey');
      if (!autoFetchedSuccess) {
          setShowLoginPrompt(true);
      }
      setInitialAttemptFailed(true);
      // 避免在重試失敗時覆蓋 "請在新視窗登入..." 的訊息
      if (localStorage.getItem('gristLoginPopupOpen') !== 'true') {
        onStatusUpdate('API Key 獲取失敗或已清除。');
      }
    }
  }, [onApiKeyReady, onStatusUpdate]); // 依賴穩定的 onApiKeyReady 和 onStatusUpdate

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
      
      updateApiKeyAndNotify(fetchedKey, true);
      clearTimeout(retryTimerRef.current);
      return true;
    } catch (error) {
      console.error("GristLoginOrApiKeyProvider: Error fetching API key:", error.message);
      if (!isRetry && localStorage.getItem('gristLoginPopupOpen') !== 'true') { // 避免覆蓋彈窗提示
          onStatusUpdate(`自動獲取 API Key 失敗: ${error.message}`);
      }
      updateApiKeyAndNotify('', false);
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

  // 首次掛載時，如果 localStorage 有 key，則直接使用並通知父組件
  useEffect(() => {
    const storedApiKey = localStorage.getItem('gristApiKey');
    if (storedApiKey) {
        console.log("GristLoginOrApiKeyProvider: Found API key in localStorage on mount.");
        updateApiKeyAndNotify(storedApiKey, false); // false 表示不是“自動獲取成功”而是“從存儲中恢復”
    } else {
        setInitialAttemptFailed(true); // 如果 localStorage 沒有，則標記需要嘗試獲取
    }
  }, [updateApiKeyAndNotify]); // updateApiKeyAndNotify 是穩定的

  useEffect(() => {
    if (apiKey) {
        clearTimeout(retryTimerRef.current);
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
  }, [apiKey, fetchKeyFromProfile, initialAttemptFailed]);


  const openGristLoginPopup = useCallback(() => {
    if (gristLoginPopupRef.current && !gristLoginPopupRef.current.closed) {
      gristLoginPopupRef.current.focus(); return;
    }
    gristLoginPopupRef.current = window.open(`${GRIST_API_BASE_URL}/login`, 'GristLoginPopup', 'width=600,height=700,scrollbars=yes,resizable=yes,noopener,noreferrer');
    localStorage.setItem('gristLoginPopupOpen', 'true');
    onStatusUpdate('請在新視窗中完成 Grist 登入...');
    setInitialAttemptFailed(true);

    const checkPopupClosedInterval = setInterval(() => {
      if (gristLoginPopupRef.current && gristLoginPopupRef.current.closed) {
        clearInterval(checkPopupClosedInterval);
        localStorage.removeItem('gristLoginPopupOpen');
        gristLoginPopupRef.current = null;
        if (!apiKey) {
          onStatusUpdate('Grist 登入視窗已關閉。');
          clearTimeout(retryTimerRef.current);
        }
      }
    }, 1000);
  }, [apiKey, onStatusUpdate]); // 依賴 apiKey, onStatusUpdate

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
      {apiKey ? children : (
          <div style={{textAlign: 'center', padding: '20px', color: theme.textColorSubtle}}>
              {isFetchingApiKey ? "正在嘗試獲取 API Key..." : (showLoginPrompt ? "" : "請設定 API Key 或登入 Grist 以繼續。")}
          </div>
      )}
    </div>
  );
};

// --- 工具函數: makeGristApiRequest ---
// (保持不變，但確保 onApiKeyInvalidated 被正確使用)
const makeGristApiRequest = async (apiKey, endpoint, method = 'GET', params = null, onApiKeyInvalidated = () => {}) => {
  if (!apiKey) {
    console.warn("makeGristApiRequest (util): API Key is not set. Aborting request to", endpoint);
    throw new Error('API Key 未設定，無法發送請求。');
  }
  console.log(`makeGristApiRequest (util): Fetching ${endpoint}.`);
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
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json', 'Content-Type': method !== 'GET' ? 'application/json' : undefined },
  });
  const responseData = await response.json().catch(async () => { const text = await response.text(); throw new Error(`HTTP error ${response.status}: ${text || response.statusText} (Non-JSON response)`); });
  if (!response.ok) {
    const errorMsg = responseData?.error?.message || responseData?.error || responseData?.message || `HTTP error ${response.status}`;
    console.error(`Grist API Error for ${method} ${url}:`, responseData);
    if (response.status === 401 || response.status === 403) {
      onApiKeyInvalidated(); 
    }
    throw new Error(errorMsg);
  }
  return responseData;
};


// --- 組件 2: GristDocumentSelector ---
const GristDocumentSelector = ({ apiKey, onDocSelected, currentSelectedDocId, onStatusUpdate, onApiKeyInvalidated }) => {
  const [currentOrgId, setCurrentOrgId] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetchedOrg, setHasFetchedOrg] = useState(false); // 新增標記
  const [hasFetchedDocs, setHasFetchedDocs] = useState(false); // 新增標記


  // 獲取組織 ID - 只在 apiKey 變化且未獲取過 org 時執行
  useEffect(() => {
    if (!apiKey || hasFetchedOrg) { // 如果沒有 apiKey 或已經獲取過組織，則不執行
        if (!apiKey) { // 如果 apiKey 變為空，重置狀態
            setCurrentOrgId(null);
            setDocuments([]);
            setHasFetchedOrg(false);
            setHasFetchedDocs(false);
        }
        return;
    }
    
    console.log("GristDocumentSelector: API Key present, fetching org ID.");
    setIsLoading(true);
    onStatusUpdate('正在獲取組織資訊 (文檔選擇器)...');
    makeGristApiRequest(apiKey, '/api/orgs', 'GET', null, onApiKeyInvalidated)
      .then(orgsData => {
        console.log("GristDocumentSelector: Orgs data:", orgsData);
        let determinedOrgId = null;
        // ... (組織 ID 判斷邏輯不變) ...
        if (orgsData && Array.isArray(orgsData) && orgsData.length > 0) {
          const targetOrg = TARGET_ORG_DOMAIN ? orgsData.find(org => org.domain === TARGET_ORG_DOMAIN) : null;
          determinedOrgId = targetOrg ? targetOrg.id : orgsData[0].id;
        } else if (orgsData && orgsData.id) { determinedOrgId = orgsData.id; }
        
        if (determinedOrgId) { 
            setCurrentOrgId(determinedOrgId); 
            setHasFetchedOrg(true); // 標記已獲取
        } else { 
            throw new Error('未能獲取到有效的組織 ID (文檔選擇器)。'); 
        }
      })
      .catch(error => {
        console.error('GristDocumentSelector: Error fetching org ID:', error);
        onStatusUpdate(`獲取組織 ID 失敗: ${error.message}`);
        setCurrentOrgId(null); setDocuments([]); setIsLoading(false); setHasFetchedOrg(false); // 出錯時也重置標記
      });
  }, [apiKey, hasFetchedOrg, onStatusUpdate, onApiKeyInvalidated]); // 依賴 apiKey 和 hasFetchedOrg

  // 獲取文檔列表 - 只在 currentOrgId 變化且未獲取過 docs 時執行
  useEffect(() => {
    if (!currentOrgId || !apiKey || hasFetchedDocs) { // 如果沒有 orgId, apiKey 或已經獲取過文檔，則不執行
        if (!currentOrgId || !apiKey) { // 如果 orgId 或 apiKey 變為空，重置狀態
            setDocuments([]);
            setHasFetchedDocs(false);
        }
        return;
    }
    console.log("GristDocumentSelector: Org ID present, fetching documents for org:", currentOrgId);
    setIsLoading(true); // 這裡可以共用 isLoading 狀態，或者為 docs 創建一個新的
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
        setHasFetchedDocs(true); // 標記已獲取
        onStatusUpdate(allDocs.length > 0 ? '文檔列表獲取成功。' : `組織 ${currentOrgId} 下無文檔。`);
      })
      .catch(error => {
        console.error('GristDocumentSelector: Error fetching documents:', error);
        onStatusUpdate(`獲取文檔列表失敗: ${error.message}`);
        setDocuments([]); setHasFetchedDocs(false); // 出錯時重置標記
      })
      .finally(() => setIsLoading(false));
  }, [currentOrgId, apiKey, hasFetchedDocs, onStatusUpdate, onApiKeyInvalidated]); // 依賴 currentOrgId, apiKey, hasFetchedDocs

  const handleDocChange = (e) => {
    const docId = e.target.value;
    onDocSelected(docId, currentOrgId); // 仍然回傳 currentOrgId
    setHasFetchedDocs(false); // 當文檔選擇改變時，可能需要重新獲取表格，但不影響已獲取的文檔列表
                               // 這裡的 setHasFetchedDocs(false) 是不對的，因為文檔列表本身不需要重載
                               // 表格的重載由 GristTableSelector 處理
  };


  return (
    <div style={{ marginBottom: '15px' }}>
      <label htmlFor="docSelect" style={{ display: 'block', marginBottom: '8px', color: theme.textColorLight, fontSize: theme.fontSizeSmall, fontWeight: '500' }}>選擇文檔:</label>
      <select
        id="docSelect"
        value={currentSelectedDocId}
        onChange={handleDocChange}
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
// (基本保持不變，但確保依賴項正確)
const GristTableSelector = ({ apiKey, selectedDocId, onTableSelected, currentSelectedTableId, onStatusUpdate, onApiKeyInvalidated }) => {
  const [tables, setTables] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetchedTablesForDoc, setHasFetchedTablesForDoc] = useState(''); // 記錄為哪個docId獲取過

  useEffect(() => {
    if (!selectedDocId || !apiKey || hasFetchedTablesForDoc === selectedDocId) {
        if (!selectedDocId || !apiKey) { // 如果 docId 或 apiKey 為空，則清空
            setTables([]);
            setHasFetchedTablesForDoc('');
        }
        return;
    }
    console.log("GristTableSelector: Doc ID present, fetching tables for doc:", selectedDocId);
    setIsLoading(true);
    onStatusUpdate(`正在獲取文檔 "${selectedDocId}" 的表格列表...`);
    makeGristApiRequest(apiKey, `/api/docs/${selectedDocId}/tables`, 'GET', null, onApiKeyInvalidated)
      .then(data => {
        console.log("GristTableSelector: Tables data:", data);
        const tableList = data.tables || (Array.isArray(data) ? data : []);
        setTables(tableList.map(table => ({ id: table.id, name: table.id })));
        setHasFetchedTablesForDoc(selectedDocId); // 標記已為此 docId 獲取過表格
        onStatusUpdate(tableList.length > 0 ? '表格列表獲取成功。' : '該文檔中未找到表格。');
      })
      .catch(error => {
        console.error('GristTableSelector: Error fetching tables:', error);
        onStatusUpdate(`獲取表格列表失敗: ${error.message}`); setTables([]); setHasFetchedTablesForDoc('');
      })
      .finally(() => setIsLoading(false));
  }, [selectedDocId, apiKey, hasFetchedTablesForDoc, onStatusUpdate, onApiKeyInvalidated]);

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
// (基本保持不變，但確保依賴項正確)
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
  
  useEffect(() => {
    setTableData(null); setColumns([]); setFilterQuery(''); setSortQuery('');
  }, [selectedDocId, selectedTableId]);

  if (!selectedDocId || !selectedTableId) return null;

  return ( /* ... (JSX for controls and table display - 保持不變) ... */ 
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
      {apiKey && selectedDocId && selectedTableId && tableData && tableData.length === 0 && !isLoadingData && !onDataError && (
        <p style={{ marginTop: '15px', padding: '12px 15px', backgroundColor: '#fff3cd', border: '1px solid #ffeeba', color: '#856404', borderRadius: theme.borderRadius, fontSize: theme.fontSizeSmall, textAlign: 'center' }}>
            {filterQuery || sortQuery ? '沒有符合目前過濾/排序條件的數據，或表格本身為空。' : '該表格目前沒有數據。'}
        </p>
      )}
    </>
  );
};


// --- 組件 5: GristDynamicSelectorViewer (根組件) ---
function GristDynamicSelectorViewer() {
  const [rootApiKey, setRootApiKey] = useState('');
  const [rootStatusMessage, setRootStatusMessage] = useState('');
  const [rootDataError, setRootDataError] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState(null);
  const [selectedDocId, setSelectedDocId] = useState('');
  const [selectedTableId, setSelectedTableId] = useState('');

  const handleApiKeyReady = useCallback((key) => {
    console.log("GristDynamicSelectorViewer (root): API Key is ready/updated:", key ? '******' : '""');
    // 只有當 key 的值確實改變時才更新 rootApiKey，以避免不必要的重渲染觸發 effect
    setRootApiKey(prevKey => {
        if (prevKey === key) return prevKey;
        // 當 API Key 變為空時，清除所有後續選擇
        if (!key) {
            setSelectedOrgId(null);
            setSelectedDocId('');
            setSelectedTableId('');
        }
        return key;
    });
  }, []); // 依賴項為空

  const handleApiKeyInvalidated = useCallback(() => {
    console.log("GristDynamicSelectorViewer (root): API Key invalidated by a data request.");
    setRootApiKey(''); // 清除 API Key
    setRootStatusMessage('API Key 已失效或權限不足，請重新登入或設定。');
    // 清除選擇
    setSelectedOrgId(null);
    setSelectedDocId('');
    setSelectedTableId('');
  }, []); // 依賴項為空

  const handleSetStatusMessage = useCallback((message) => {
      setRootStatusMessage(message);
  }, []); // 依賴項為空

  const handleSetDataError = useCallback((message) => {
      setRootDataError(message);
  }, []); // 依賴項為空


  const handleDocSelected = useCallback((docId, orgId) => {
    console.log("GristDynamicSelectorViewer (root): Document selected:", docId, "from org:", orgId);
    setSelectedDocId(docId);
    setSelectedOrgId(orgId);
    setSelectedTableId('');
  }, []); // 依賴項為空

  const handleTableSelected = useCallback((tableId) => {
    console.log("GristDynamicSelectorViewer (root): Table selected:", tableId);
    setSelectedTableId(tableId);
  }, []); // 依賴項為空

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


      <GristLoginOrApiKeyProvider onApiKeyReady={handleApiKeyReady} onStatusUpdate={handleSetStatusMessage}>
        {rootApiKey && (
          <div style={{ marginTop: '25px', padding: '20px', border: `1px solid ${theme.borderColor}`, borderRadius: theme.borderRadius, backgroundColor: theme.surfaceColor }}>
            <h3 style={{ marginTop: '0', marginBottom: '20px', color: theme.textColor, borderBottom: `1px solid ${theme.borderColor}`, paddingBottom: '10px' }}>選擇數據源</h3>
            <GristDocumentSelector
              apiKey={rootApiKey}
              onDocSelected={handleDocSelected}
              currentSelectedDocId={selectedDocId}
              onStatusUpdate={handleSetStatusMessage}
              onApiKeyInvalidated={handleApiKeyInvalidated}
              // onDocumentsFetched={() => {}} // 可以移除如果父組件不需要原始列表
            />
            {selectedDocId && ( // 只有在選了文檔後才顯示表格選擇器
              <GristTableSelector
                apiKey={rootApiKey}
                selectedDocId={selectedDocId}
                onTableSelected={handleTableSelected}
                currentSelectedTableId={selectedTableId}
                onStatusUpdate={handleSetStatusMessage}
                onApiKeyInvalidated={handleApiKeyInvalidated}
              />
            )}
            {selectedDocId && selectedTableId && ( // 只有選了文檔和表格後才顯示數據控制
              <GristDataControlsAndDisplay
                apiKey={rootApiKey}
                selectedDocId={selectedDocId}
                selectedTableId={selectedTableId}
                onStatusUpdate={handleSetStatusMessage}
                onDataError={handleSetDataError}
                onApiKeyInvalidated={handleApiKeyInvalidated}
              />
            )}
          </div>
        )}
      </GristLoginOrApiKeyProvider>
    </div>
  );
}

export default GristDynamicSelectorViewer;