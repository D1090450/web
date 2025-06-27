import React, { useState, useCallback, useEffect, useRef } from 'react';
import { login } from './login';
import Filter from './components/Filter';

const GRIST_API_BASE_URL = 'https://tiss-grist.fcuai.tw';
const TARGET_ORG_DOMAIN = 'fcuai.tw';

const styles = {
  container: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
    color: '#333740',
    backgroundColor: '#ffffff',
    maxWidth: '1000px',
    width: '100%',
    padding: '40px',
    borderRadius: '8px',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    margin: '0 20px',
  },
  header: { textAlign: 'center', marginBottom: '30px' },
  title: { fontSize: '28px', fontWeight: '600', color: '#333740', marginBottom: '10px' },
  subtitle: { color: '#777f8d', fontSize: '14px' },
  statusMessage: (hasError) => ({
    padding: '12px 18px', margin: '20px 0', borderRadius: '6px',
    textAlign: 'center', fontSize: '14px', fontWeight: '500',
    border: `1px solid ${hasError ? '#dc3545' : '#28a745'}`,
    backgroundColor: hasError ? '#fdecea' : '#e9f7ef',
    color: hasError ? '#dc3545' : '#28a745',
  }),
  card: { padding: '25px', marginTop: '25px', border: '1px solid #dee2e6', borderRadius: '6px', backgroundColor: '#f8f9fa' },
  inputBase: {
    width: '100%', padding: '12px', fontSize: '16px',
    border: '1px solid #dee2e6', borderRadius: '6px', boxSizing: 'border-box',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  },
  buttonBase: {
    padding: '12px 20px', fontSize: '16px', fontWeight: '500',
    border: 'none', borderRadius: '6px', cursor: 'pointer',
    transition: 'background-color 0.2s, transform 0.1s',
  },
  buttonPrimary: { backgroundColor: '#007bff', color: '#ffffff' },
  buttonSecondary: { backgroundColor: '#6c757d', color: '#ffffff' },
  buttonDisabled: { backgroundColor: '#adb5bd', cursor: 'not-allowed', opacity: 0.7 },
  tableContainer: { marginTop: '30px', overflowX: 'auto', border: '1px solid #dee2e6', borderRadius: '6px' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '14px' },
  th: {
    backgroundColor: '#e9ecef', padding: '14px 12px', textAlign: 'left',
    color: '#333740', fontWeight: '600', borderBottom: '2px solid #dee2e6',
  },
  td: { padding: '12px', whiteSpace: 'nowrap', color: '#555e6d', borderBottom: '1px solid #dee2e6' },
};

const useGristApi = (apiKey, onAuthError) => {
    const [isLoading, setIsLoading] = useState(false);
    const onAuthErrorRef = useRef(onAuthError);
    useEffect(() => { onAuthErrorRef.current = onAuthError; }, [onAuthError]);
    const request = useCallback(async (endpoint, method = 'GET', params = null) => {
      if (!apiKey) return Promise.reject(new Error('API Key 未設定'));
      setIsLoading(true);
      let url = `${GRIST_API_BASE_URL}${endpoint}`;
      if (params) {
          const queryParams = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== ''));
          if (queryParams.toString()) url += `?${queryParams.toString()}`;
      }
      try {
        const response = await fetch(url, { method, headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' } });
        const responseData = await response.json().catch(() => { throw new Error('非 JSON 響應'); });
        if (!response.ok) {
          const errorMsg = responseData?.error?.message || `請求失敗 (HTTP ${response.status})`;
          if ((response.status === 401 || response.status === 403) && onAuthErrorRef.current) onAuthErrorRef.current();
          throw new Error(errorMsg);
        }
        return responseData;
      } catch (err) { throw err; }
      finally { setIsLoading(false); }
    }, [apiKey]);
    return { request, isLoading };
};

const GristApiKeyManager = React.forwardRef(({ apiKey, onApiKeyUpdate, onStatusUpdate }, ref) => {
    const [localApiKey, setLocalApiKey] = useState(apiKey || '');
    useEffect(() => { setLocalApiKey(apiKey || ''); }, [apiKey]);
    
    const fetchKeyFromProfile = useCallback(async () => {
      try {
        const response = await fetch(`${GRIST_API_BASE_URL}/api/profile/apiKey`, { credentials: 'include', headers: { 'Accept': 'text/plain' } });
        const fetchedKey = await response.text();
        if (!response.ok || !fetchedKey || fetchedKey.includes('<') || fetchedKey.length < 32) {
          if (!apiKey) {
            onStatusUpdate(`自動獲取失敗，請先登入 Grist。`);
          }
          return false;
        }
        onApiKeyUpdate(fetchedKey.trim(), true);
        return true;
      } catch (error) {
        if (!apiKey) {
          onStatusUpdate(`自動獲取失敗，請檢查網路連線或 Grist 服務狀態。`);
        }
        return false;
      }
    }, [apiKey, onApiKeyUpdate, onStatusUpdate]);

    React.useImperativeHandle(ref, () => ({
        triggerFetchKeyFromProfile: fetchKeyFromProfile
    }));

    const handleManualSubmit = () => {
      if (localApiKey.trim()) {
        onApiKeyUpdate(localApiKey.trim(), false);
      } else {
        onStatusUpdate('請輸入有效的 API Key');
      }
    };
    return (
      <div style={{ ...styles.card, borderStyle: 'dashed' }}>
        <h4 style={{ marginTop: '0', marginBottom: '15px' }}>API Key 管理</h4>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input type="password" value={localApiKey} onChange={(e) => setLocalApiKey(e.target.value)} placeholder="在此輸入或貼上 Grist API Key" style={{ ...styles.inputBase, flexGrow: 1 }}/>
          <button onClick={handleManualSubmit} style={{...styles.buttonBase, backgroundColor: '#e9ecef', color: '#333740' }}>手動設定</button>
        </div>
      </div>
    );
});

function GristDynamicSelectorViewer() {
    const [apiKey, setApiKey] = useState(() => localStorage.getItem('gristApiKey') || '');
    const [statusMessage, setStatusMessage] = useState('');
    const [showLoginPrompt, setShowLoginPrompt] = useState(false);
    const [documents, setDocuments] = useState([]);
    const [selectedDocId, setSelectedDocId] = useState('');
    const [tables, setTables] = useState([]);
    const [selectedTableId, setSelectedTableId] = useState('');
    const [sortQuery, setSortQuery] = useState('');
    const [tableData, setTableData] = useState(null);
    const [columns, setColumns] = useState([]);
    const [dataError, setDataError] = useState('');
    const apiKeyManagerRef = useRef(null);

    const clearSubsequentState = useCallback(() => {
      setDocuments([]); setSelectedDocId('');
      setTables([]); setSelectedTableId('');
      setTableData(null); setDataError('');
    }, []);
  
    const handleApiKeyUpdate = useCallback((key, autoFetched = false) => {
      setApiKey(key);
      setShowLoginPrompt(false);
      if (key) {
        localStorage.setItem('gristApiKey', key);
        if (autoFetched) {
             setStatusMessage('API Key 已與 Grist 會話同步！');
        } else {
             setStatusMessage('API Key 已手動設定。');
        }
      } else {
        localStorage.removeItem('gristApiKey');
        clearSubsequentState();
      }
    }, [clearSubsequentState]);
  
    const handleAuthError = useCallback(() => {
      setApiKey(''); 
      localStorage.removeItem('gristApiKey');
      clearSubsequentState();
      setShowLoginPrompt(true);
      setStatusMessage('API Key 已失效或權限不足，請重新登入 Grist 並刷新頁面，或手動設定。');
    }, [clearSubsequentState]);
  
    const { request: apiRequest, isLoading: isApiLoading } = useGristApi(apiKey, handleAuthError);
    
    useEffect(() => {
        setTimeout(() => {
            apiKeyManagerRef.current?.triggerFetchKeyFromProfile();
        }, 100);
    }, []);

    useEffect(() => {
      if (!apiKey) {
        clearSubsequentState();
        if (!localStorage.getItem('gristApiKey')) {
            setShowLoginPrompt(true);
        }
        return;
      }
      setShowLoginPrompt(false);
      const getOrgAndDocs = async () => {
        setStatusMessage('正在獲取組織與文檔...');
        try {
          const orgsData = await apiRequest('/api/orgs');
          const determinedOrg = (Array.isArray(orgsData) && orgsData.length > 0)
            ? (orgsData.find(org => org.domain === TARGET_ORG_DOMAIN) || orgsData[0])
            : (orgsData?.id ? orgsData : null);
          if (!determinedOrg?.id) throw new Error('未能確定目標組織');
          const workspaces = await apiRequest(`/api/orgs/${determinedOrg.id}/workspaces`);
          const allDocs = []; const docNameCounts = {};
          workspaces.forEach(ws => {
            ws.docs?.forEach(doc => {
              docNameCounts[doc.name] = (docNameCounts[doc.name] || 0) + 1;
              allDocs.push({ ...doc, workspaceName: ws.name });
            });
          });
          const processedDocs = allDocs.map(doc => ({ ...doc, displayName: docNameCounts[doc.name] > 1 ? `${doc.name} (${doc.workspaceName})` : doc.name }));
          setDocuments(processedDocs);
          setStatusMessage(processedDocs.length > 0 ? '文檔加載成功' : '組織下無文檔');
        } catch (error) { setDocuments([]); setStatusMessage(`獲取組織或文檔失敗: ${error.message}`); }
      };
      getOrgAndDocs();
    }, [apiKey, apiRequest, clearSubsequentState]);
    
    useEffect(() => {
      if (!selectedDocId) { setTables([]); setSelectedTableId(''); setTableData(null); return; }
      const fetchTables = async () => {
        setStatusMessage('正在獲取表格...');
        try {
          const data = await apiRequest(`/api/docs/${selectedDocId}/tables`);
          const tableList = (data.tables || []).map(t => ({ id: t.id, name: t.id }));
          setTables(tableList);
          setStatusMessage(tableList.length > 0 ? '表格列表加載成功' : '文檔中無表格');
        } catch (error) { setTables([]); setStatusMessage(`獲取表格失敗: ${error.message}`); }
      };
      fetchTables();
    }, [selectedDocId, apiRequest]);
  
    const buildGristFilter = (filters) => {
        const conditions = ['and'];
        const getField = (fieldName) => ['record.fields.get', fieldName];

        if (filters.gender && filters.gender !== 'all') {
            conditions.push(['=', getField('性別'), filters.gender === 'male' ? '男' : '女']);
        }
        if (filters.dateRange?.start) {
            conditions.push(['>=', getField('日期'), filters.dateRange.start]);
        }
        if (filters.dateRange?.end) {
            conditions.push(['<=', getField('日期'), filters.dateRange.end]);
        }
        if (filters.days && !filters.days.all) {
            const dayMap = { sun: '星期日', mon: '星期一', tue: '星期二', wed: '星期三', thu: '星期四', fri: '星期五', sat: '星期六' };
            const selectedDays = Object.keys(filters.days)
                .filter(day => day !== 'all' && filters.days[day])
                .map(day => dayMap[day]);
            if (selectedDays.length > 0) {
                conditions.push(['in', getField('星期'), selectedDays]);
            }
        }
        if (filters.title && filters.title.trim() !== '') {
            conditions.push(['.includes', getField('職稱'), filters.title.trim()]);
        }
        return conditions.length > 1 ? JSON.stringify(conditions) : null;
    };

    const handleFilterSubmit = useCallback(async (filters) => {
      if (!selectedTableId) {
        setDataError('請先選擇表格');
        return;
      }
      setDataError('');
      setTableData(null);
      setColumns([]);
      setStatusMessage(`正在根據篩選條件獲取 ${selectedTableId} 數據...`);

      const filterJson = buildGristFilter(filters);
      const params = { limit: '50' };

      if (filterJson) {
        params.filter = filterJson;
      }
      if (sortQuery.trim()) {
        params.sort = sortQuery.trim();
      }

      try {
        const data = await apiRequest(`/api/docs/${selectedDocId}/tables/${selectedTableId}/records`, 'GET', params);
        if (data?.records) {
          setTableData(data.records);
          if (data.records.length > 0) {
            const allCols = new Set(data.records.flatMap(rec => Object.keys(rec.fields || {})));
            setColumns(Array.from(allCols));
            setStatusMessage(`成功獲取 ${data.records.length} 條數據`);
          } else {
            setColumns([]);
            setStatusMessage('獲取成功，但結果為空');
          }
        } else {
          throw new Error('返回數據格式不正確');
        }
      } catch (error) {
        setDataError(`獲取數據失敗: ${error.message}`);
      }
    }, [selectedDocId, selectedTableId, sortQuery, apiRequest, buildGristFilter]);
  
    const { openLoginPopup } = login({
      onFetchKeyAttempt: () => apiKeyManagerRef.current?.triggerFetchKeyFromProfile(),
      onStatusUpdate: setStatusMessage,
      hasApiKey: !!apiKey,
    });
  
    const hasErrorStatus = statusMessage.includes('失敗') || statusMessage.includes('錯誤') || statusMessage.includes('失效') || dataError;
  
    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h1 style={styles.title}>Grist 數據動態選擇查看器</h1>
                <p style={styles.subtitle}>API 目標: <code>{GRIST_API_BASE_URL}</code></p>
            </div>

            {statusMessage && (
            <p style={styles.statusMessage(hasErrorStatus)}>
                {hasErrorStatus ? '⚠️ ' : '✅ '}
                {isApiLoading && !statusMessage.includes('成功') ? '處理中... ' : ''}{statusMessage}
            </p>
            )}

            <GristApiKeyManager
                ref={apiKeyManagerRef}
                apiKey={apiKey}
                onApiKeyUpdate={handleApiKeyUpdate}
                onStatusUpdate={setStatusMessage}
            />

            {showLoginPrompt && !apiKey && (
            <div style={{ ...styles.card, textAlign: 'center', backgroundColor: '#fdecea', borderColor: '#dc3545' }}>
                <p style={{ margin: '0 0 15px 0', fontWeight: '500', color: '#dc3545' }}>需要有效的 API Key 才能繼續操作。</p>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                    <button onClick={openLoginPopup} style={{...styles.buttonBase, ...styles.buttonPrimary}}>開啟 Grist 登入</button>
                    <button onClick={() => apiKeyManagerRef.current?.triggerFetchKeyFromProfile()} style={{...styles.buttonBase, ...styles.buttonSecondary}}>重試自動獲取</button>
                </div>
            </div>
            )}

            {apiKey && (
            <div style={styles.card}>
                <h3 style={{ marginTop: '0', marginBottom: '20px', borderBottom: '1px solid #dee2e6', paddingBottom: '10px' }}>選擇數據源</h3>
                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>選擇文檔:</label>
                    <select value={selectedDocId} onChange={(e) => { setSelectedDocId(e.target.value); setSelectedTableId(''); setTableData(null); }} disabled={isApiLoading || documents.length === 0} style={styles.inputBase}>
                        <option value="">{isApiLoading && !documents.length ? '加載中...' : (documents.length === 0 ? '無可用文檔' : '-- 請選擇 --')}</option>
                        {documents.map((doc) => (<option key={doc.id} value={doc.id}>{doc.displayName}</option>))}
                    </select>
                </div>

                {selectedDocId && (
                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>選擇表格:</label>
                    <select value={selectedTableId} onChange={(e) => { setSelectedTableId(e.target.value); setTableData(null); }} disabled={isApiLoading || tables.length === 0} style={styles.inputBase}>
                        <option value="">{isApiLoading && !tables.length ? '加載中...' : (tables.length === 0 ? '無可用表格' : '-- 請選擇 --')}</option>
                        {tables.map((table) => (<option key={table.id} value={table.id}>{table.name}</option>))}
                    </select>
                </div>
                )}

                {selectedTableId && (
                <>
                    <Filter onSubmit={handleFilterSubmit} isLoading={isApiLoading} />
                    <div style={{ ...styles.card, backgroundColor: '#ffffff', padding: '20px', marginTop: '20px' }}>
                        <h4 style={{ marginTop: '0', marginBottom: '15px' }}>數據排序選項</h4>
                        <input type="text" value={sortQuery} onChange={(e) => setSortQuery(e.target.value)} placeholder='排序條件 e.g., Column, -AnotherColumn' style={styles.inputBase}/>
                         <small style={{display: 'block', marginTop: '8px', color: '#6c757d'}}>排序功能與上方篩選器可同時使用。在上方點擊「套用篩選並獲取數據」按鈕以生效。</small>
                    </div>
                </>
                )}
                {dataError && <p style={{...styles.statusMessage(true), marginTop: '15px' }}>⚠️ 錯誤: {dataError}</p>}
            </div>
            )}

            {tableData && tableData.length > 0 && (
            <div style={styles.tableContainer}>
                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th style={{ ...styles.th, position: 'sticky', left: 0, zIndex: 2, backgroundColor: '#e9ecef' }}>id</th>
                            {columns.map((col) => (<th key={col} style={styles.th}>{col}</th>))}
                        </tr>
                    </thead>
                    <tbody>
                        {tableData.map((record, index) => (
                        <tr key={record.id} style={{ backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8f9fa' }}>
                            <td style={{ ...styles.td, position: 'sticky', left: 0, zIndex: 1, backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8f9fa', borderRight: '1px solid #dee2e6' }}>{record.id}</td>
                            {columns.map((col) => (
                            <td key={`${record.id}-${col}`} style={styles.td}>
                                {record.fields?.[col] != null ? (typeof record.fields[col] === 'object' ? JSON.stringify(record.fields[col]) : String(record.fields[col])) : ''}
                            </td>
                            ))}
                        </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            )}
            {apiKey && tableData?.length === 0 && !isApiLoading && !dataError && <p style={{textAlign: 'center', ...styles.card, marginTop: '20px'}}>查詢結果為空。</p>}
        </div>
    );
}

export default GristDynamicSelectorViewer;