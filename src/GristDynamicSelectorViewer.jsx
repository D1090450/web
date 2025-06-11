import React, { useState, useCallback, useEffect, useRef } from 'react';

// --- 常量與主題配置 ---
const GRIST_API_BASE_URL = 'https://tiss-grist.fcuai.tw';
const TARGET_ORG_DOMAIN = 'fcuai.tw';

const theme = {
  textColor: '#333740', textColorLight: '#555e6d', textColorSubtle: '#777f8d',
  backgroundColor: '#ffffff', surfaceColor: '#f8f9fa', borderColor: '#dee2e6',
  primaryColor: '#007bff', primaryColorText: '#ffffff',
  successColor: '#28a745', successColorBg: '#e9f7ef',
  errorColor: '#dc3545', errorColorBg: '#fdecea',
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif',
  fontSizeBase: '16px', fontSizeSmall: '14px', lineHeightBase: '1.6', borderRadius: '4px',
};

// --- 自定義 Hook: 穩定且能處理授權錯誤 ---
const useGristApi = (apiKey, onAuthError) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const onAuthErrorRef = useRef(onAuthError);
  useEffect(() => {
    onAuthErrorRef.current = onAuthError;
  }, [onAuthError]);

  const request = useCallback(async (endpoint, method = 'GET', params = null, body = null) => {
    if (!apiKey) {
      const authError = new Error('API Key 未設定，無法發送請求。');
      setError(authError);
      return Promise.reject(authError);
    }

    setIsLoading(true);
    setError(null);
    
    let url = `${GRIST_API_BASE_URL}${endpoint}`;
    if (params) {
        const queryParams = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== null && value !== undefined && value !== ''));
        if (queryParams.toString()) url += `?${queryParams.toString()}`;
    }

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : null,
      });

      const responseData = await response.json().catch(async () => {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text || response.statusText} (非 JSON 響應)`);
      });

      if (!response.ok) {
        const errorMsg = responseData?.error?.message || responseData?.error || `請求失敗 (HTTP ${response.status})`;
        if ((response.status === 401 || response.status === 403) && onAuthErrorRef.current) {
          onAuthErrorRef.current();
        }
        throw new Error(errorMsg);
      }
      return responseData;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [apiKey]);

  return { request, isLoading, error };
};


// --- API Key 管理組件 ---
const GristApiKeyManager = React.forwardRef(({ apiKey: apiKeyProp, onApiKeyUpdate, onStatusUpdate, initialAttemptFailed }, ref) => {
  const [localApiKey, setLocalApiKey] = useState(apiKeyProp || '');

  useEffect(() => { setLocalApiKey(apiKeyProp || ''); }, [apiKeyProp]);

  const fetchKeyFromProfile = useCallback(async () => {
    onStatusUpdate('正在從個人資料獲取 API Key...');
    try {
      const response = await fetch(`${GRIST_API_BASE_URL}/api/profile/apiKey`, {
        method: 'GET', credentials: 'include', headers: { 'Accept': 'text/plain' },
      });
      const fetchedKey = await response.text();
      if (!response.ok || !fetchedKey || fetchedKey.includes('<') || fetchedKey.length < 32) {
        throw new Error('獲取到的 API Key 似乎無效。請確保您已登入 Grist。');
      }
      onApiKeyUpdate(fetchedKey.trim(), true);
      onStatusUpdate('API Key 自動獲取成功！');
      return true;
    } catch (error) {
      onStatusUpdate(`自動獲取 API Key 失敗: ${error.message}`);
      return false;
    }
  }, [onApiKeyUpdate, onStatusUpdate]);

  useEffect(() => {
    if (initialAttemptFailed && !apiKeyProp) {
      fetchKeyFromProfile();
    }
  }, [initialAttemptFailed, apiKeyProp, fetchKeyFromProfile]);

  React.useImperativeHandle(ref, () => ({
    triggerFetchKeyFromProfile: fetchKeyFromProfile,
  }));

  const handleManualSubmit = () => {
    const trimmedKey = localApiKey.trim();
    if (trimmedKey) {
      onApiKeyUpdate(trimmedKey, false);
    } else {
      onStatusUpdate('請輸入有效的 API Key。');
    }
  };

  return (
    <div style={{ marginBottom: '20px', padding: '15px', border: `1px dashed ${theme.borderColor}`, borderRadius: theme.borderRadius, backgroundColor: theme.surfaceColor }}>
      <h4 style={{ marginTop: '0', marginBottom: '10px' }}>API Key 管理</h4>
      <input
        type="password" value={localApiKey} onChange={(e) => setLocalApiKey(e.target.value)}
        placeholder="在此輸入或貼上 Grist API Key"
        style={{ width: 'calc(100% - 160px)', marginRight: '10px', padding: '10px', fontSize: theme.fontSizeBase, border: `1px solid ${theme.borderColor}`, borderRadius: theme.borderRadius }}
      />
      <button onClick={handleManualSubmit} style={{ padding: '10px 15px', fontSize: theme.fontSizeBase, backgroundColor: '#e9ecef', color: theme.textColor, border: `1px solid ${theme.borderColor}`, cursor: 'pointer' }}>
        設定手動 Key
      </button>
    </div>
  );
});


// --- 主應用組件 ---
function GristDynamicSelectorViewer() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gristApiKey') || '');
  const [statusMessage, setStatusMessage] = useState('');
  const [initialApiKeyAttemptFailed, setInitialApiKeyAttemptFailed] = useState(false);
  
  const [documents, setDocuments] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState('');
  const [tables, setTables] = useState([]);
  const [selectedTableId, setSelectedTableId] = useState('');
  
  const [filterQuery, setFilterQuery] = useState('');
  const [sortQuery, setSortQuery] = useState('');
  const [tableData, setTableData] = useState(null);
  const [columns, setColumns] = useState([]);
  const [dataError, setDataError] = useState('');
  
  const apiKeyManagerRef = useRef(null);
  const pollingTimerRef = useRef(null);

  const clearSubsequentState = useCallback(() => {
    setDocuments([]);
    setSelectedDocId('');
    setTables([]);
    setSelectedTableId('');
    setTableData(null);
    setDataError('');
  }, []);

  const handleApiKeyUpdate = useCallback((key, autoFetched = false) => {
    setApiKey(key);
    if (key) {
      localStorage.setItem('gristApiKey', key);
      setInitialApiKeyAttemptFailed(false);
      setStatusMessage(autoFetched ? 'API Key 自動獲取成功！' : 'API Key 已設定。');
    } else {
      localStorage.removeItem('gristApiKey');
      clearSubsequentState();
    }
  }, [clearSubsequentState]);

  const handleAuthError = useCallback(() => {
    setApiKey('');
    localStorage.removeItem('gristApiKey');
    setInitialApiKeyAttemptFailed(true);
    clearSubsequentState();
    setStatusMessage('API Key 已失效或權限不足，請重新設定。');
  }, [clearSubsequentState]);

  const { request: apiRequest, isLoading: isApiLoading } = useGristApi(apiKey, handleAuthError);
  
  useEffect(() => {
    if (!localStorage.getItem('gristApiKey') && !apiKey) {
      setInitialApiKeyAttemptFailed(true);
    }
    return () => clearTimeout(pollingTimerRef.current);
  }, [apiKey]);

  useEffect(() => {
    if (!apiKey) {
        clearSubsequentState();
        return;
    }
    const getOrgAndDocs = async () => {
      setStatusMessage('正在獲取組織與文檔資訊...');
      try {
        const orgsData = await apiRequest('/api/orgs');
        let determinedOrg = null;

        if (Array.isArray(orgsData) && orgsData.length > 0) {
            determinedOrg = orgsData.find(org => org.domain === TARGET_ORG_DOMAIN) || orgsData[0];
        } else if (orgsData && orgsData.id) {
            determinedOrg = orgsData;
        }

        if (!determinedOrg?.id) throw new Error('未能確定目標組織。');
        
        const workspaces = await apiRequest(`/api/orgs/${determinedOrg.id}/workspaces`);
        
        const allDocs = [];
        const docNameCounts = {};
        workspaces.forEach(workspace => {
            if (workspace.docs && Array.isArray(workspace.docs)) {
                workspace.docs.forEach(doc => {
                    docNameCounts[doc.name] = (docNameCounts[doc.name] || 0) + 1;
                    allDocs.push({ ...doc, workspaceName: workspace.name });
                });
            }
        });

        const processedDocs = allDocs.map(doc => ({
            ...doc,
            displayName: docNameCounts[doc.name] > 1 ? `${doc.name} (${doc.workspaceName})` : doc.name
        }));

        setDocuments(processedDocs);
        setStatusMessage(processedDocs.length > 0 ? '文檔列表加載成功。' : '此組織下沒有找到任何文檔。');
      } catch (error) {
        setDocuments([]);
        setStatusMessage(`獲取組織或文檔失敗: ${error.message}`);
      }
    };
    getOrgAndDocs();
  }, [apiKey, apiRequest, clearSubsequentState]);
  
  useEffect(() => {
    if (!selectedDocId) {
        setTables([]);
        setSelectedTableId('');
        setTableData(null);
        return;
    }
    const fetchTables = async () => {
      setStatusMessage('正在獲取表格列表...');
      try {
        const data = await apiRequest(`/api/docs/${selectedDocId}/tables`);
        const tableList = (data.tables || []).map(t => ({ id: t.id, name: t.id }));
        setTables(tableList);
        setStatusMessage(tableList.length > 0 ? '表格列表加載成功。' : '此文檔中未找到表格。');
      } catch (error) {
        setTables([]);
        setStatusMessage(`獲取表格列表失敗: ${error.message}`);
      }
    };
    fetchTables();
  }, [selectedDocId, apiRequest]);

  const handleFetchTableData = useCallback(async () => {
    if (!selectedTableId) { setDataError('請先選擇一個表格。'); return; }
    setDataError('');
    setTableData(null);
    setColumns([]);
    setStatusMessage(`正在從 ${selectedTableId} 獲取數據...`);

    const params = { limit: '50' };
    try {
        if (filterQuery) params.filter = JSON.stringify(JSON.parse(filterQuery));
    } catch (e) {
        setDataError('過濾條件不是有效的 JSON 格式。'); return;
    }
    if (sortQuery.trim()) params.sort = sortQuery.trim();

    try {
      // 【修正】這裡使用了正確的 selectedDocId，而不是錯誤的 selectedTableId
      const data = await apiRequest(`/api/docs/${selectedDocId}/tables/${selectedTableId}/records`, 'GET', params);
      
      if (data?.records) {
        setTableData(data.records);
        if (data.records.length > 0) {
          const allCols = new Set(data.records.flatMap(rec => Object.keys(rec.fields || {})));
          setColumns(Array.from(allCols));
          setStatusMessage(`成功獲取 ${data.records.length} 條數據。`);
        } else {
          setColumns([]);
          setStatusMessage('數據獲取成功，但結果為空。');
        }
      } else { throw new Error('返回的數據格式不正確。'); }
    } catch (error) {
      setDataError(`獲取數據失敗: ${error.message}`);
    }
  }, [selectedDocId, selectedTableId, filterQuery, sortQuery, apiRequest]);

  const openGristLoginPopup = useCallback(() => {
    clearTimeout(pollingTimerRef.current);
    const loginUrl = `${GRIST_API_BASE_URL}/login`;
    const popup = window.open(loginUrl, 'GristLoginPopup', 'width=600,height=700');
    if (!popup) { setStatusMessage("彈出視窗被瀏覽器阻擋，請允許後重試。"); return; }
    
    setStatusMessage('請在新視窗中完成 Grist 登入...');

    const pollForApiKey = async () => {
      if (popup.closed) {
        clearTimeout(pollingTimerRef.current);
        if (!apiKey) setStatusMessage('登入視窗已關閉。');
        return;
      }

      const success = await apiKeyManagerRef.current?.triggerFetchKeyFromProfile();
      if (success) {
        clearTimeout(pollingTimerRef.current);
        popup.close();
      } else {
        pollingTimerRef.current = setTimeout(pollForApiKey, 2500);
      }
    };
    
    pollingTimerRef.current = setTimeout(pollForApiKey, 1000);

  }, [apiKey]);

  const hasErrorStatus = statusMessage.includes('失敗') || statusMessage.includes('錯誤') || statusMessage.includes('失效') || dataError;

  return (
    <div style={{ padding: '25px', fontFamily: theme.fontFamily, color: theme.textColor, maxWidth: '1000px', margin: '20px auto', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', borderRadius: '8px' }}>
      <h1 style={{ textAlign: 'center' }}>Grist 數據動態選擇查看器</h1>
      <p style={{ textAlign: 'center', color: theme.textColorSubtle, fontSize: theme.fontSizeSmall, marginBottom: '25px' }}>
        API 目標: <code>{GRIST_API_BASE_URL}</code>
      </p>

      {statusMessage && (
        <p style={{ padding: '12px 15px', backgroundColor: hasErrorStatus ? theme.errorColorBg : theme.successColorBg, border: `1px solid ${hasErrorStatus ? theme.errorColor : theme.successColor}`, color: hasErrorStatus ? theme.errorColor : theme.successColor, borderRadius: theme.borderRadius, textAlign: 'center' }}>
          {isApiLoading ? '處理中... ' : ''}{statusMessage}
        </p>
      )}

      <GristApiKeyManager
        ref={apiKeyManagerRef}
        apiKey={apiKey}
        onApiKeyUpdate={handleApiKeyUpdate}
        onStatusUpdate={setStatusMessage}
        initialAttemptFailed={initialApiKeyAttemptFailed}
      />

      {initialApiKeyAttemptFailed && !apiKey && (
        <div style={{ padding: '20px', margin: '20px 0', border: `1px solid ${theme.errorColor}`, borderRadius: theme.borderRadius, textAlign: 'center', backgroundColor: theme.errorColorBg }}>
          <p style={{ color: theme.errorColor, margin: '0 0 15px 0', fontWeight: '500' }}>需要 API Key 才能繼續。</p>
          <button onClick={openGristLoginPopup} style={{ padding: '10px 15px', marginRight: '10px', fontSize: theme.fontSizeBase, backgroundColor: theme.primaryColor, color: theme.primaryColorText, border: 'none', cursor: 'pointer' }}>
            開啟 Grist 登入視窗
          </button>
          <button onClick={() => apiKeyManagerRef.current?.triggerFetchKeyFromProfile()} style={{ padding: '10px 15px', backgroundColor: '#6c757d', color: theme.primaryColorText, border: 'none', cursor: 'pointer' }}>
            重試自動獲取
          </button>
        </div>
      )}

      {apiKey && (
        <div style={{ marginTop: '25px', padding: '20px', border: `1px solid ${theme.borderColor}`, borderRadius: theme.borderRadius, backgroundColor: theme.surfaceColor }}>
          <h3 style={{ marginTop: '0', marginBottom: '20px', borderBottom: `1px solid ${theme.borderColor}`, paddingBottom: '10px' }}>選擇數據源</h3>
          
          <div style={{ marginBottom: '15px' }}>
            <label htmlFor="docSelect" style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>選擇文檔:</label>
            <select id="docSelect" value={selectedDocId} onChange={(e) => { setSelectedDocId(e.target.value); setSelectedTableId(''); setTableData(null); }} disabled={isApiLoading || documents.length === 0} style={{ width: '100%', padding: '10px', fontSize: theme.fontSizeBase }}>
              <option value="">{isApiLoading && !documents.length ? '加載中...' : (documents.length === 0 ? '無可用文檔' : '-- 請選擇 --')}</option>
              {documents.map((doc) => (<option key={doc.id} value={doc.id}>{doc.displayName}</option>))}
            </select>
          </div>

          {selectedDocId && (
            <div style={{ marginBottom: '15px' }}>
              <label htmlFor="tableSelect" style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>選擇表格:</label>
              <select id="tableSelect" value={selectedTableId} onChange={(e) => { setSelectedTableId(e.target.value); setTableData(null); }} disabled={isApiLoading || tables.length === 0} style={{ width: '100%', padding: '10px', fontSize: theme.fontSizeBase }}>
                <option value="">{isApiLoading && !tables.length ? '加載中...' : (tables.length === 0 ? '無可用表格' : '-- 請選擇 --')}</option>
                {tables.map((table) => (<option key={table.id} value={table.id}>{table.name}</option>))}
              </select>
            </div>
          )}

          {selectedTableId && (
            <div style={{ border: `1px solid ${theme.borderColor}`, padding: '20px', marginTop: '20px', borderRadius: theme.borderRadius, backgroundColor: '#fff' }}>
              <h4 style={{ marginTop: '0' }}>數據獲取選項</h4>
              <input type="text" value={filterQuery} onChange={(e) => setFilterQuery(e.target.value)} placeholder='過濾條件 (JSON格式) e.g., {"Column": "Value"}' style={{ width: '100%', padding: '10px', boxSizing: 'border-box', marginBottom: '10px' }}/>
              <input type="text" value={sortQuery} onChange={(e) => setSortQuery(e.target.value)} placeholder='排序條件 e.g., Column, -AnotherColumn' style={{ width: '100%', padding: '10px', boxSizing: 'border-box', marginBottom: '20px' }}/>
              <button onClick={handleFetchTableData} disabled={isApiLoading} style={{ width: '100%', padding: '12px 20px', backgroundColor: isApiLoading ? '#6c757d' : theme.primaryColor, color: theme.primaryColorText, border: 'none', cursor: 'pointer', fontSize: '16px' }}>
                {isApiLoading ? '加載中...' : `獲取 "${selectedTableId}" 的數據`}
              </button>
            </div>
          )}
          {dataError && <p style={{ color: theme.errorColor, marginTop: '15px', backgroundColor: theme.errorColorBg, padding: '12px', borderRadius: theme.borderRadius }}>錯誤: {dataError}</p>}
        </div>
      )}

      {tableData && tableData.length > 0 && (
        <div style={{ marginTop: '30px', overflowX: 'auto' }}>
          <h3>數據結果 (前 {tableData.length} 條)</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{backgroundColor: '#e9ecef'}}>
                <th style={{ padding: '12px 10px', textAlign: 'left', borderBottom: `2px solid ${theme.borderColor}` }}>id</th>
                {columns.map((col) => (<th key={col} style={{ padding: '12px 10px', textAlign: 'left', borderBottom: `2px solid ${theme.borderColor}` }}>{col}</th>))}
              </tr>
            </thead>
            <tbody>
              {tableData.map((record, index) => (
                <tr key={record.id} style={{ backgroundColor: index % 2 === 0 ? '#fff' : theme.surfaceColor, borderBottom: `1px solid ${theme.borderColor}` }}>
                  <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>{record.id}</td>
                  {columns.map((col) => (
                    <td key={`${record.id}-${col}`} style={{ padding: '10px', whiteSpace: 'nowrap' }}>
                      {record.fields?.[col] !== null && record.fields?.[col] !== undefined
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
      {apiKey && tableData?.length === 0 && !isApiLoading && !dataError && <p style={{textAlign: 'center', marginTop: '15px', padding: '12px', backgroundColor: '#fff3cd', border: '1px solid #ffeeba', color: '#856404', borderRadius: theme.borderRadius }}>查詢結果為空。</p>}
    </div>
  );
}

export default GristDynamicSelectorViewer;