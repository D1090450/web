// src/GristDynamicSelectorViewer.jsx
import React, { useState, useCallback, useEffect, useRef } from 'react';

const GRIST_API_BASE_URL = 'https://tiss-grist.fcuai.tw';
const TARGET_ORG_DOMAIN = 'fcuai.tw';
const API_KEY_RETRY_INTERVAL = 3000; // 每3秒重試一次

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

// API Key 管理組件 (與上一個版本相同，包含自動獲取和重試邏輯)
const GristApiKeyManager = React.forwardRef(({ apiKey, onApiKeyUpdate, onStatusUpdate, initialAttemptFailed }, ref) => {
  const [localApiKey, setLocalApiKey] = useState(apiKey || '');
  const [isFetching, setIsFetching] = useState(false);
  const retryTimerRef = useRef(null);

  const fetchKeyFromProfile = useCallback(async (isRetry = false) => {
    if (isFetching && !isRetry) return;

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
      console.log('response from /api/profile/apiKey: ', responseText);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${responseText || '無法獲取 API Key'}`);
      }
      const fetchedKey = responseText.trim();
      if (!fetchedKey || fetchedKey.includes('<') || fetchedKey.length < 32) {
        throw new Error('獲取到的 API Key 似乎無效。');
      }
      setLocalApiKey(fetchedKey);
      onApiKeyUpdate(fetchedKey, true);
      onStatusUpdate('API Key 自動獲取成功！');
      clearTimeout(retryTimerRef.current);
      return true;
    } catch (error) {
      console.error("Error fetching API key from profile (attempt):", error.message);
      if (!isRetry) {
        onStatusUpdate(`自動獲取 API Key 失敗: ${error.message}. 請確保您已登入 Grist。`);
      }
      onApiKeyUpdate('', false);
      return false;
    } finally {
      setIsFetching(false);
    }
  }, [onApiKeyUpdate, onStatusUpdate, isFetching]);

  const handleManualSubmit = () => {
    clearTimeout(retryTimerRef.current);
    const trimmedKey = localApiKey.trim();
    if (trimmedKey) {
      onApiKeyUpdate(trimmedKey, false);
      onStatusUpdate('手動輸入的 API Key 已設定。');
    } else {
      onStatusUpdate('請輸入有效的 API Key。');
    }
  };
  
  useEffect(() => {
    setLocalApiKey(apiKey || '');
  }, [apiKey]);

  useEffect(() => {
    if (apiKey) {
        clearTimeout(retryTimerRef.current);
        return;
    }
    // 初始嘗試獲取 (由 initialAttemptFailed 控制是否立即執行或等待父組件信號)
    // 這裡改為只要 initialAttemptFailed 為 true 且 apiKey 為空就嘗試
    if (initialAttemptFailed && !apiKey) {
        fetchKeyFromProfile().then(success => {
            if (!success) { // 只有在 fetchKeyFromProfile 確定失敗後才啟動定時器
                if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
                retryTimerRef.current = setTimeout(function zichzelf() {
                    console.log("Retrying to fetch API key...");
                    fetchKeyFromProfile(true).then(retrySuccess => {
                        if (!retrySuccess && localStorage.getItem('gristLoginPopupOpen') === 'true') {
                            retryTimerRef.current = setTimeout(zichzelf, API_KEY_RETRY_INTERVAL);
                        } else if (retrySuccess) {
                            localStorage.removeItem('gristLoginPopupOpen');
                        }
                    });
                }, API_KEY_RETRY_INTERVAL);
            }
        });
    }
    
    return () => {
      clearTimeout(retryTimerRef.current);
    };
  }, [apiKey, fetchKeyFromProfile, initialAttemptFailed]);

  React.useImperativeHandle(ref, () => ({
    triggerFetchKeyFromProfile: () => {
        clearTimeout(retryTimerRef.current);
        return fetchKeyFromProfile();
    },
    stopRetrying: () => {
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
      {/* 自動獲取按鈕已移除，因為現在是自動的 */}
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


  const handleApiKeyUpdate = useCallback((key, autoFetchedSuccess = false) => {
    setApiKey(key);
    if (key) {
      localStorage.setItem('gristApiKey', key);
      setShowLoginPrompt(false);
      setInitialApiKeyAttemptFailed(false);

      if (autoFetchedSuccess && gristLoginPopupRef.current && !gristLoginPopupRef.current.closed) {
        try {
            gristLoginPopupRef.current.close();
            localStorage.removeItem('gristLoginPopupOpen');
        } catch (e) {
            console.warn("Could not automatically close Grist login popup:", e);
            setStatusMessage("Grist 登入成功！您可以手動關閉登入視窗。");
        }
        gristLoginPopupRef.current = null;
      }
       if (autoFetchedSuccess && !statusMessage.includes('API Key 自動獲取成功！')) { // 避免重複設定
           setStatusMessage('API Key 自動獲取成功！正在準備加載數據...');
       } else if (!autoFetchedSuccess && !statusMessage.includes('手動輸入的 API Key 已設定')) {
           setStatusMessage('API Key 已設定。正在準備加載數據...');
       }

    } else { // key 為空
      localStorage.removeItem('gristApiKey');
      // 只有在不是因為自動重試循環導致 key 為空時，才顯示登入提示
      // 並且確保 GristApiKeyManager 也會知道需要重試
      if (!autoFetchedSuccess) { // autoFetchedSuccess 為 false 通常表示手動清空或初次加載失敗
        setShowLoginPrompt(true);
      }
      setInitialApiKeyAttemptFailed(true); // 通知 GristApiKeyManager 應該開始/繼續重試
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
  }, [statusMessage]); // 加入 statusMessage 避免閉包

  // === 核心數據獲取邏輯 (保留並確保在 apiKey 有效後執行) ===
  const makeGristApiRequest = useCallback(async (endpoint, method = 'GET', params = null) => {
    // 此函數依賴 apiKey state，所以當 apiKey 更新後，使用它的 useEffect 會重新運行
    if (!apiKey) { // 在這裡再次檢查 apiKey，如果為空則不發請求
      throw new Error('API Key 未設定，無法發送請求。');
    }
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

    const responseData = await response.json().catch(() => {
      return response.text().then(text => {
        throw new Error(`HTTP error ${response.status}: ${text || response.statusText}`);
      });
    });

    if (!response.ok) {
      const errorMsg = responseData?.error?.message || responseData?.error || responseData?.message || `HTTP error ${response.status}`;
      console.error(`Grist API Error for ${method} ${url}:`, responseData);
      // 如果是 401 或 403，可能表示 API Key 失效，觸發重新登入提示
      if (response.status === 401 || response.status === 403) {
        handleApiKeyUpdate(''); // 清除 API Key，觸發登入提示
      }
      throw new Error(errorMsg);
    }
    return responseData;
  }, [apiKey, handleApiKeyUpdate]); // apiKey 是關鍵依賴

  // 步驟 1 (數據獲取): 獲取組織 ID (當 apiKey 有效時)
  useEffect(() => {
    if (!apiKey) { // 如果沒有 apiKey，則不執行後續操作
      setCurrentOrgId(null);
      setDocuments([]);
      return;
    }
    const getOrgIdAndFetchDocs = async () => {
      setIsLoadingDocs(true);
      // setStatusMessage('API Key 有效，正在獲取組織資訊...'); // 這個訊息可能很快被後續的覆蓋
      try {
        const orgsData = await makeGristApiRequest('/api/orgs');
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
          setCurrentOrgId(determinedOrgId);
          // setStatusMessage(`已獲取組織 ID: ${determinedOrgId}。正在獲取文檔...`); // 會被下一個 effect 的訊息覆蓋
        } else {
          throw new Error('未能獲取到有效的組織 ID。');
        }
      } catch (error) {
        console.error('獲取組織 ID 失敗:', error);
        setStatusMessage(`獲取組織 ID 失敗: ${error.message}`);
        setCurrentOrgId(null);
        setDocuments([]);
        setIsLoadingDocs(false); // 確保出錯時也停止加載狀態
      }
      // setIsLoadingDocs(false) 會在下一個 effect 真正獲取文檔後設定
    };
    getOrgIdAndFetchDocs();
  }, [apiKey, makeGristApiRequest]); // 依賴 apiKey 和 makeGristApiRequest

  // 步驟 2 (數據獲取): 當 orgId 確定後，獲取該組織下的工作區和文檔
  useEffect(() => {
    if (!apiKey || !currentOrgId) { // 依賴 apiKey 和 currentOrgId
      setDocuments([]);
      return;
    }
    const fetchDocsFromWorkspaces = async () => {
      setIsLoadingDocs(true); // 在這裡開始標記加載文檔
      setStatusMessage(`正在從組織 ID ${currentOrgId} 獲取文檔列表...`);
      try {
        const workspacesData = await makeGristApiRequest(`/api/orgs/${currentOrgId}/workspaces`);
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
        console.error(`獲取組織 ${currentOrgId} 的文檔列表失敗:`, error);
        setStatusMessage(`獲取文檔列表失敗: ${error.message}`);
        setDocuments([]);
      } finally {
        setIsLoadingDocs(false);
      }
    };
    fetchDocsFromWorkspaces();
  }, [apiKey, currentOrgId, makeGristApiRequest]); // 依賴 apiKey, currentOrgId, makeGristApiRequest

  // 步驟 3 (數據獲取): 獲取選定文檔的表格列表
  useEffect(() => {
    if (!apiKey || !selectedDocId) { // 依賴 apiKey 和 selectedDocId
      setTables([]);
      setSelectedTableId('');
      return;
    }
    const fetchTables = async () => {
      setIsLoadingTables(true);
      setStatusMessage(`正在獲取文檔 "${selectedDocId}" 的表格列表...`);
      setDataError('');
      try {
        const data = await makeGristApiRequest(`/api/docs/${selectedDocId}/tables`);
        const tableList = data.tables || (Array.isArray(data) ? data : []);
        if (Array.isArray(tableList)) {
          setTables(tableList.map(table => ({ id: table.id, name: table.id })));
          setStatusMessage(tableList.length > 0 ? '表格列表獲取成功。' : '該文檔中未找到表格。');
        } else { throw new Error('表格列表格式不正確。'); }
      } catch (error) {
        console.error('獲取表格列表失敗:', error);
        setStatusMessage(`獲取表格列表失敗: ${error.message}`);
        setTables([]);
      } finally { setIsLoadingTables(false); }
    };
    fetchTables();
  }, [apiKey, selectedDocId, makeGristApiRequest]); // 依賴 apiKey, selectedDocId, makeGristApiRequest

  // 步驟 4 (數據獲取): 獲取表格數據 (由按鈕觸發，所以是 useCallback)
  const handleFetchTableData = useCallback(async () => {
    if (!apiKey || !selectedDocId || !selectedTableId) { /* ... */ return; }
    setIsLoadingData(true);
    setDataError('');
    setTableData(null);
    setColumns([]);
    setStatusMessage(`正在獲取 ${selectedTableId} 的數據...`);
    const params = { limit: '50' };
    if (filterQuery) { try { JSON.parse(filterQuery); params.filter = filterQuery; } catch (e) { /* ... */ setIsLoadingData(false); return; }}
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
    } catch (error) { /* ... */ setTableData([]); } 
    finally { setIsLoadingData(false); }
  }, [apiKey, selectedDocId, selectedTableId, makeGristApiRequest, filterQuery, sortQuery]);
  // === 核心數據獲取邏輯結束 ===


  const openGristLoginPopup = () => {
    // ... (openGristLoginPopup logic remains the same, but ensure it triggers initialApiKeyAttemptFailed) ...
    if (gristLoginPopupRef.current && !gristLoginPopupRef.current.closed) {
      gristLoginPopupRef.current.focus();
      return;
    }
    const loginUrl = `${GRIST_API_BASE_URL}/login`;
    gristLoginPopupRef.current = window.open(loginUrl, 'GristLoginPopup', 'width=600,height=700,scrollbars=yes,resizable=yes,noopener,noreferrer');
    localStorage.setItem('gristLoginPopupOpen', 'true'); 
    setStatusMessage('請在新視窗中完成 Grist 登入。本頁面將嘗試自動檢測登入狀態。');
    setInitialApiKeyAttemptFailed(true); // 關鍵：確保 GristApiKeyManager 會開始/繼續重試

    const checkPopupClosedInterval = setInterval(() => {
        if (gristLoginPopupRef.current && gristLoginPopupRef.current.closed) {
            clearInterval(checkPopupClosedInterval);
            localStorage.removeItem('gristLoginPopupOpen');
            gristLoginPopupRef.current = null;
            if (!apiKey) {
                setStatusMessage('Grist 登入視窗已關閉。如果尚未登入，請點擊下方按鈕重試。');
                if (apiKeyManagerRef.current) {
                    apiKeyManagerRef.current.stopRetrying();
                }
                // 這裡不要立即設為 false，否則如果用戶關閉彈窗但未登入，下次打開彈窗時重試不會啟動
                // setInitialApiKeyAttemptFailed(false); 
            }
        }
    }, 1000);
  };

  // 初始加載時，如果 localStorage 中沒有 key，則標記初始嘗試可能失敗
  useEffect(() => {
    if (!localStorage.getItem('gristApiKey') && !apiKey) {
      setInitialApiKeyAttemptFailed(true);
    }
  }, []); // 空依賴，僅執行一次


  return (
    <div style={{ padding: '25px', fontFamily: theme.fontFamily, /* ... */ }}>
      <h1 style={{ color: theme.textColor, textAlign: 'center', /* ... */ }}>Grist 數據動態選擇查看器</h1>
      <p style={{ textAlign: 'center', color: theme.textColorSubtle, /* ... */ }}>
        API 目標: <code>{GRIST_API_BASE_URL}</code> (目標組織域名: <code>{TARGET_ORG_DOMAIN || '未指定'}</code>)
      </p>

      {statusMessage && ( <p style={{ padding: '12px 15px', /* ... */ }}> {statusMessage} </p> )}

      <GristApiKeyManager
        ref={apiKeyManagerRef}
        apiKey={apiKey}
        onApiKeyUpdate={handleApiKeyUpdate}
        onStatusUpdate={setStatusMessage}
        initialAttemptFailed={initialApiKeyAttemptFailed}
      />

      {showLoginPrompt && !apiKey && (
        <div style={{ padding: '20px', margin: '20px 0', border: `1px solid ${theme.errorColor}`, /* ... */ }}>
          <p style={{ color: theme.errorColor, margin: '0 0 15px 0', fontWeight: '500' }}>
            您似乎尚未登入 Grist，或者 API Key 無法自動獲取。
          </p>
          <button onClick={openGristLoginPopup} style={{ padding: '10px 15px', /* ... */ }} >
            開啟 Grist 登入視窗
          </button>
          {/* 可以考慮添加一個按鈕讓用戶手動觸發 API Key 獲取，以防自動機制卡住 */}
          <button 
            onClick={() => apiKeyManagerRef.current && apiKeyManagerRef.current.triggerFetchKeyFromProfile()}
            style={{ padding: '10px 15px', marginLeft: '10px', backgroundColor: '#6c757d', color: theme.primaryColorText, border: 'none', borderRadius: theme.borderRadius, cursor: 'pointer'}}
          >
            手動重試獲取 API Key
          </button>
        </div>
      )}

      {apiKey && (
        <div style={{ marginTop: '25px', padding: '20px', border: `1px solid ${theme.borderColor}`, /* ... */ }}>
          <h3 style={{ marginTop: '0', marginBottom: '20px', /* ... */ }}>選擇數據源</h3>
          {/* 文檔選擇下拉選單 */}
          <div style={{ marginBottom: '15px' }}>
            <label htmlFor="docSelect" style={{ display: 'block', marginBottom: '8px', /* ... */ }}>選擇文檔:</label>
            <select id="docSelect" value={selectedDocId} onChange={(e) => { setSelectedDocId(e.target.value); /* 清理後續狀態 */ }} disabled={isLoadingDocs || documents.length === 0} style={{ width: '100%', padding: '10px', /* ... */ }}>
              <option value="">{isLoadingDocs ? '正在加載文檔...' : (documents.length === 0 && apiKey && currentOrgId ? '當前組織下未找到文檔' : (apiKey ? '-- 請選擇文檔 --' : '請先設定 API Key'))}</option>
              {documents.map((doc) => ( <option key={doc.id} value={doc.id}> {doc.displayName} </option> ))}
            </select>
            {selectedDocId && documents.find(d => d.id === selectedDocId) && <small style={{display: 'block', marginTop: '5px', /* ... */ }}> ID: {selectedDocId}, 所屬工作區: {documents.find(d => d.id === selectedDocId)?.workspaceName || 'N/A'} </small>}
          </div>

          {/* 表格選擇下拉選單 */}
          {selectedDocId && (
            <div style={{ marginBottom: '15px' }}>
              <label htmlFor="tableSelect" style={{ display: 'block', marginBottom: '8px', /* ... */ }}>選擇表格:</label>
              <select id="tableSelect" value={selectedTableId} onChange={(e) => { setSelectedTableId(e.target.value); /* 清理後續狀態 */ }} disabled={isLoadingTables || tables.length === 0} style={{ width: '100%', padding: '10px', /* ... */ }}>
                <option value="">{isLoadingTables ? '正在加載表格...' : (tables.length === 0 && selectedDocId ? '未找到表格或無權限' : '-- 請選擇表格 --')}</option>
                {tables.map((table) => ( <option key={table.id} value={table.id}> {table.name} </option> ))}
              </select>
            </div>
          )}

          {/* 數據獲取選項和按鈕 */}
          {selectedDocId && selectedTableId && (
            <div style={{ border: `1px solid ${theme.borderColor}`, padding: '20px', /* ... */ }}>
              <h4 style={{ marginTop: '0', marginBottom: '15px', /* ... */ }}>數據獲取選項</h4>
              {/* Filter Input */}
              <div style={{ marginBottom: '15px' }}>
                <label htmlFor="filterInput" style={{ display: 'block', /* ... */ }}>過濾條件 (JSON):</label>
                <input id="filterInput" type="text" value={filterQuery} onChange={(e) => setFilterQuery(e.target.value)} /* ... */ />
                <small style={{ display: 'block', /* ... */ }}>參考 Grist API "Filtering records"。</small>
              </div>
              {/* Sort Input */}
              <div style={{ marginBottom: '20px' }}>
                <label htmlFor="sortInput" style={{ display: 'block', /* ... */ }}>排序條件:</label>
                <input id="sortInput" type="text" value={sortQuery} onChange={(e) => setSortQuery(e.target.value)} /* ... */ />
                <small style={{ display: 'block', /* ... */ }}>參考 "Sorting records"。</small>
              </div>
              <button onClick={handleFetchTableData} disabled={isLoadingData} style={{ padding: '12px 20px', /* ... */ }}>
                {isLoadingData ? '正在加載數據...' : `獲取 "${selectedTableId}" 的數據`}
              </button>
            </div>
          )}
          {dataError && <p style={{ color: theme.errorColor, /* ... */ }}>錯誤：{dataError}</p>}
        </div>
      )}

      {/* 表格數據顯示 */}
      {tableData && tableData.length > 0 && columns.length > 0 && (
        <div style={{ marginTop: '30px', overflowX: 'auto' }}>
          <h3 style={{ marginBottom: '15px', /* ... */ }}>數據結果: (前 {Math.min(tableData.length, 50)} 條)</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', /* ... */ }}>
            <thead>
              <tr>
                <th style={{backgroundColor: '#e9ecef', padding: '12px 10px', /* ... */}}>id</th>
                {columns.map((col) => (<th key={col} style={{backgroundColor: '#e9ecef', /* ... */}}>{col}</th>))}
              </tr>
            </thead>
            <tbody>
              {tableData.map((record, rowIndex) => (
                <tr key={record.id} style={{ backgroundColor: rowIndex % 2 === 0 ? '#fff' : theme.surfaceColor, /* ... */ }}>
                  <td style={{ padding: '10px', whiteSpace: 'nowrap', /* ... */ }}>{record.id}</td>
                  {columns.map((col) => (
                    <td key={`${record.id}-${col}`} style={{ padding: '10px', /* ... */ }}>
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
      {/* 無數據提示 */}
      {apiKey && selectedDocId && selectedTableId && tableData && tableData.length === 0 && !isLoadingData && !dataError && (
        <p style={{ marginTop: '15px', padding: '12px 15px', /* ... */ }}>
            {filterQuery || sortQuery ? '沒有符合目前過濾/排序條件的數據，或表格本身為空。' : '該表格目前沒有數據。'}
        </p>
      )}
    </div>
  );
}

export default GristDynamicSelectorViewer;