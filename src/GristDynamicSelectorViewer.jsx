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

// --- 自定義 Hook: 封裝 Grist API 請求邏輯 ---
const useGristApi = (apiKey, onAuthError) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

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
      const queryParams = new URLSearchParams();
      for (const key in params) {
        if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
          queryParams.append(key, params[key]);
        }
      }
      if (queryParams.toString()) {
        url += `?${queryParams.toString()}`;
      }
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
        const errorMsg = responseData?.error?.message || responseData?.error || `請求失敗 (HTTP ${response.status})`
        if (response.status === 401 || response.status === 403) {
          onAuthError(); // 觸發授權失敗的回調
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
  }, [apiKey, onAuthError]);

  return { request, isLoading, error };
};


// --- API Key 管理組件 ---
const GristApiKeyManager = React.forwardRef(({ apiKey: apiKeyProp, onApiKeyUpdate, onStatusUpdate, initialAttemptFailed }, ref) => {
  const [localApiKey, setLocalApiKey] = useState(apiKeyProp || '');

  const { request: fetchKeyRequest, isLoading } = useGristApi(null, () => {}); // 授權錯誤在此不適用

  useEffect(() => {
    setLocalApiKey(apiKeyProp || '');
  }, [apiKeyProp]);

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
      onStatusUpdate('手動輸入的 API Key 已設定。');
    } else {
      onStatusUpdate('請輸入有效的 API Key。');
    }
  };

  return (
    <div style={{ marginBottom: '20px', padding: '15px', border: `1px dashed ${theme.borderColor}`, borderRadius: theme.borderRadius, backgroundColor: theme.surfaceColor }}>
      <h4 style={{ marginTop: '0', marginBottom: '10px', color: theme.textColor }}>API Key 管理</h4>
      <input
        type="password"
        value={localApiKey}
        onChange={(e) => setLocalApiKey(e.target.value)}
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
  
  const [currentOrgId, setCurrentOrgId] = useState(null);
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

  const clearSubsequentState = () => {
    setCurrentOrgId(null);
    setDocuments([]);
    setSelectedDocId('');
    setTables([]);
    setSelectedTableId('');
    setTableData(null);
    setDataError('');
  };

  const handleApiKeyUpdate = useCallback((key, autoFetched = false) => {
    setApiKey(key);
    clearSubsequentState();
    if (key) {
      localStorage.setItem('gristApiKey', key);
      setInitialApiKeyAttemptFailed(false);
      if(autoFetched) setStatusMessage('API Key 自動獲取成功！');
      else setStatusMessage('API Key 已設定。');
    } else {
      localStorage.removeItem('gristApiKey');
      setInitialApiKeyAttemptFailed(true);
      setStatusMessage('API Key 已被清除或已失效，請重新設定。');
    }
  }, []);

  const { request: apiRequest, isLoading: isApiLoading, error: apiError } = useGristApi(apiKey, () => handleApiKeyUpdate(''));
  
  useEffect(() => {
    if (!localStorage.getItem('gristApiKey') && !apiKey) {
      setInitialApiKeyAttemptFailed(true);
    }
  }, []);

  useEffect(() => {
    if (!apiKey) return;
    const getOrgAndDocs = async () => {
      setStatusMessage('正在獲取組織與文檔資訊...');
      try {
        const orgs = await apiRequest('/api/orgs');
        const targetOrg = Array.isArray(orgs) ? (orgs.find(org => org.domain === TARGET_ORG_DOMAIN) || orgs[0]) : orgs;
        
        if (!targetOrg?.id) throw new Error('未能確定目標組織。');
        setCurrentOrgId(targetOrg.id);
        
        const workspaces = await apiRequest(`/api/orgs/${targetOrg.id}/workspaces`);
        const docNameCounts = {};
        const allDocs = workspaces.flatMap(ws => ws.docs || []).map(doc => {
            docNameCounts[doc.name] = (docNameCounts[doc.name] || 0) + 1;
            return { ...doc, workspaceName: ws.name, workspaceId: ws.id };
        });

        const processedDocs = allDocs.map(doc => ({
            ...doc,
            displayName: docNameCounts[doc.name] > 1 ? `${doc.name} (${doc.workspaceName})` : doc.name
        }));

        setDocuments(processedDocs);
        setStatusMessage(processedDocs.length > 0 ? '文檔列表加載成功。' : '此組織下沒有找到任何文檔。');
      } catch (error) {
        setStatusMessage(`獲取組織或文檔失敗: ${error.message}`);
        setDocuments([]);
      }
    };
    getOrgAndDocs();
  }, [apiKey, apiRequest]);
  
  useEffect(() => {
    if (!selectedDocId) return;
    const fetchTables = async () => {
      setTables([]);
      setSelectedTableId('');
      setTableData(null);
      setStatusMessage('正在獲取表格列表...');
      try {
        const data = await apiRequest(`/api/docs/${selectedDocId}/tables`);
        const tableList = (data.tables || []).map(t => ({ id: t.id, name: t.id }));
        setTables(tableList);
        setStatusMessage(tableList.length > 0 ? '表格列表加載成功。' : '此文檔中未找到表格。');
      } catch (error) {
        setStatusMessage(`獲取表格列表失敗: ${error.message}`);
      }
    };
    fetchTables();
  }, [selectedDocId, apiRequest]);

  const handleFetchTableData = useCallback(async () => {
    if (!selectedTableId) {
      setDataError('請先選擇一個表格。');
      return;
    }
    setDataError('');
    setTableData(null);
    setColumns([]);
    setStatusMessage(`正在從 ${selectedTableId} 獲取數據...`);

    const params = { limit: '50' };
    try {
        if (filterQuery) params.filter = JSON.stringify(JSON.parse(filterQuery));
    } catch (e) {
        setDataError('過濾條件不是有效的 JSON 格式。');
        return;
    }
    if (sortQuery.trim()) params.sort = sortQuery.trim();

    try {
      const data = await apiRequest(`/api/docs/${selectedDocId}/tables/${selectedTableId}/records`, 'GET', params);
      if (data?.records) {
        setTableData(data.records);
        if (data.records.length > 0) {
          const allCols = new Set(data.records.flatMap(rec => Object.keys(rec.fields || {})));
          setColumns(Array.from(allCols));
          setStatusMessage(`成功獲取 ${data.records.length} 條數據。`);
        } else {
          setStatusMessage('數據獲取成功，但結果為空。');
        }
      } else {
        throw new Error('返回的數據格式不正確。');
      }
    } catch (error) {
      setDataError(`獲取數據失敗: ${error.message}`);
    }
  }, [selectedDocId, selectedTableId, filterQuery, sortQuery, apiRequest]);

  const openGristLoginPopup = useCallback(() => {
    const loginUrl = `${GRIST_API_BASE_URL}/login`;
    const popup = window.open(loginUrl, 'GristLoginPopup', 'width=600,height=700');
    if (!popup) {
      setStatusMessage("彈出視窗被瀏覽器阻擋，請允許彈出視窗後重試。");
      return;
    }
    
    setStatusMessage('請在新視窗中完成 Grist 登入...');

    const checkLoginInterval = setInterval(async () => {
      if (popup.closed) {
        clearInterval(checkLoginInterval);
        if (!apiKey) setStatusMessage('登入視窗已關閉。');
        return;
      }

      const success = await apiKeyManagerRef.current?.triggerFetchKeyFromProfile();
      if (success) {
        clearInterval(checkLoginInterval);
        popup.close();
      }
    }, 2000);
  }, [apiKey]);

  const isLoading = isApiLoading; // Central loading indicator
  const hasErrorStatus = statusMessage.includes('失敗') || statusMessage.includes('錯誤') || dataError;

  return (
    <div style={{ padding: '25px', fontFamily: theme.fontFamily, fontSize: theme.fontSizeBase, color: theme.textColor, maxWidth: '1000px', margin: '20px auto', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', borderRadius: '8px' }}>
      <h1 style={{ textAlign: 'center' }}>Grist 數據動態選擇查看器</h1>
      <p style={{ textAlign: 'center', color: theme.textColorSubtle, fontSize: theme.fontSizeSmall, marginBottom: '25px' }}>
        API 目標: <code>{GRIST_API_BASE_URL}</code> (組織域名: <code>{TARGET_ORG_DOMAIN || '未指定'}</code>)
      </p>

      {statusMessage && (
        <p style={{ padding: '12px 15px', backgroundColor: hasErrorStatus ? theme.errorColorBg : theme.successColorBg, border: `1px solid ${hasErrorStatus ? theme.errorColor : theme.successColor}`, color: hasErrorStatus ? theme.errorColor : theme.successColor, borderRadius: theme.borderRadius, textAlign: 'center' }}>
          {isLoading ? '處理中... ' : ''}{statusMessage}
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
          
          {/* 文檔選擇 */}
          <div style={{ marginBottom: '15px' }}>
            <label htmlFor="docSelect" style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>選擇文檔:</label>
            <select id="docSelect" value={selectedDocId} onChange={(e) => setSelectedDocId(e.target.value)} disabled={isLoading || documents.length === 0} style={{ width: '100%', padding: '10px' }}>
              <option value="">{isLoading ? '加載中...' : (documents.length === 0 ? '無可用文檔' : '-- 請選擇 --')}</option>
              {documents.map((doc) => (<option key={doc.id} value={doc.id}>{doc.displayName}</option>))}
            </select>
          </div>

          {/* 表格選擇 */}
          {selectedDocId && (
            <div style={{ marginBottom: '15px' }}>
              <label htmlFor="tableSelect" style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>選擇表格:</label>
              <select id="tableSelect" value={selectedTableId} onChange={(e) => setSelectedTableId(e.target.value)} disabled={isLoading || tables.length === 0} style={{ width: '100%', padding: '10px' }}>
                <option value="">{isLoading ? '加載中...' : (tables.length === 0 ? '無可用表格' : '-- 請選擇 --')}</option>
                {tables.map((table) => (<option key={table.id} value={table.id}>{table.name}</option>))}
              </select>
            </div>
          )}

          {/* 數據獲取選項 */}
          {selectedTableId && (
            <div style={{ border: `1px solid ${theme.borderColor}`, padding: '20px', marginTop: '20px', borderRadius: theme.borderRadius, backgroundColor: '#fff' }}>
              <h4 style={{ marginTop: '0' }}>數據獲取選項</h4>
              <input type="text" value={filterQuery} onChange={(e) => setFilterQuery(e.target.value)} placeholder='過濾條件 (JSON格式) e.g., {"Column": "Value"}' style={{ width: '100%', padding: '10px', boxSizing: 'border-box', marginBottom: '10px' }}/>
              <input type="text" value={sortQuery} onChange={(e) => setSortQuery(e.target.value)} placeholder='排序條件 e.g., Column, -AnotherColumn' style={{ width: '100%', padding: '10px', boxSizing: 'border-box', marginBottom: '20px' }}/>
              <button onClick={handleFetchTableData} disabled={isLoading} style={{ width: '100%', padding: '12px 20px', backgroundColor: isLoading ? '#6c757d' : theme.primaryColor, color: theme.primaryColorText, border: 'none', cursor: 'pointer' }}>
                {isLoading ? '加載中...' : `獲取 "${selectedTableId}" 的數據`}
              </button>
            </div>
          )}
          {dataError && <p style={{ color: theme.errorColor, marginTop: '15px', backgroundColor: theme.errorColorBg, padding: '10px' }}>錯誤: {dataError}</p>}
        </div>
      )}

      {/* 數據結果表格 */}
      {tableData && tableData.length > 0 && (
        <div style={{ marginTop: '30px', overflowX: 'auto' }}>
          <h3 style={{ marginBottom: '15px' }}>數據結果 (前 {tableData.length} 條)</h3>
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
      {tableData?.length === 0 && !isLoading && <p style={{textAlign: 'center', marginTop: '15px'}}>查詢結果為空。</p>}
    </div>
  );
}

export default GristDynamicSelectorViewer;