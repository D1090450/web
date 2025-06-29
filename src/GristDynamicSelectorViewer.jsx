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
    const [columns, setColumns] = useState([]);
    const [dataError, setDataError] = useState('');
    const apiKeyManagerRef = useRef(null);

    const [rawTableData, setRawTableData] = useState(null); 
    const [tableData, setTableData] = useState(null);
    const [activeFilters, setActiveFilters] = useState(null);
    const [sortQuery, setSortQuery] = useState('');

    const clearSubsequentState = useCallback(() => {
      setDocuments([]); setSelectedDocId('');
      setTables([]); setSelectedTableId('');
      setRawTableData(null); setDataError('');
    }, []);
  
    const handleApiKeyUpdate = useCallback((key, autoFetched = false) => {
      setApiKey(key); setShowLoginPrompt(false);
      if (key) {
        localStorage.setItem('gristApiKey', key);
        setStatusMessage(autoFetched ? 'API Key 已與 Grist 會話同步！' : 'API Key 已手動設定。');
      } else {
        localStorage.removeItem('gristApiKey'); clearSubsequentState();
      }
    }, [clearSubsequentState]);
  
    const handleAuthError = useCallback(() => {
      setApiKey(''); localStorage.removeItem('gristApiKey');
      clearSubsequentState(); setShowLoginPrompt(true);
      setStatusMessage('API Key 已失效或權限不足，請重新登入 Grist 並刷新頁面，或手動設定。');
    }, [clearSubsequentState]);

    const { request: apiRequest, isLoading: isApiLoading } = useGristApi(apiKey, handleAuthError);

    // --- 【主要修改點】: 本地篩選函數 ---
    const applyLocalFilters = (data, filters) => {
        if (!filters || !data) return data;

        // 檢查是否有任何與日期相關的篩選被啟用
        const isDateFilterActive = (filters.dateRange?.start || filters.dateRange?.end || (filters.days && !filters.days.all));

        return data.filter(record => {
            const fields = record.fields || {};

            // --- 日期和星期篩選邏輯 ---
            if (isDateFilterActive) {
                const timestamp = fields['MOD_DTE'];

                // 如果沒有時間戳或時間戳不是數字，則過濾掉此記錄
                if (timestamp == null || typeof timestamp !== 'number') {
                    return false;
                }

                // 將 Unix timestamp (假設是秒) 轉換為 JavaScript Date 物件
                // 如果您的 timestamp 是毫秒，請移除 "* 1000"
                const recordDate = new Date(timestamp * 1000);

                // 驗證轉換後的日期是否有效
                if (isNaN(recordDate.getTime())) {
                    return false;
                }

                // 1. 時間區段篩選
                if (filters.dateRange?.start) {
                    const startDate = new Date(filters.dateRange.start);
                    // 為確保比較準確，將時間設為當天開始
                    startDate.setHours(0, 0, 0, 0);
                    if (recordDate < startDate) return false;
                }
                if (filters.dateRange?.end) {
                    const endDate = new Date(filters.dateRange.end);
                    // 將結束日期設為隔天的開始，以包含結束日期的所有時間
                    endDate.setDate(endDate.getDate() + 1);
                    endDate.setHours(0, 0, 0, 0);
                    if (recordDate >= endDate) return false;
                }

                // 2. 星期篩選
                if (filters.days && !filters.days.all) {
                    const dayMap = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
                    const recordDayIndex = recordDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
                    const selectedDays = Object.keys(filters.days)
                        .filter(day => day !== 'all' && filters.days[day])
                        .map(day => dayMap[day]);
                    
                    // 如果有選擇特定星期，但記錄的星期不在其中，則過濾掉
                    if (selectedDays.length > 0 && !selectedDays.includes(recordDayIndex)) {
                        return false;
                    }
                }
            }
            
            // --- 其他篩選邏輯 (保持不變) ---
            if (filters.gender && filters.gender !== 'all') {
                const expectedGender = filters.gender === 'male' ? '男' : '女';
                if (fields['性別'] !== expectedGender) return false;
            }

            if (filters.title && filters.title.trim() !== '') {
                if (!fields['職稱'] || !String(fields['職稱']).toLowerCase().includes(filters.title.trim().toLowerCase())) return false;
            }
            
            // 如果所有篩選都通過，則保留此記錄
            return true;
        });
    };

    const applyLocalSort = (data, sortStr) => {
        if (!sortStr || !data) return data;
        const sortKeys = sortStr.split(',').map(key => {
            const trimmedKey = key.trim();
            return { key: trimmedKey.startsWith('-') ? trimmedKey.substring(1) : trimmedKey, order: trimmedKey.startsWith('-') ? 'desc' : 'asc' };
        }).filter(item => item.key);
        if (sortKeys.length === 0) return data;
        const sortedData = [...data];
        sortedData.sort((a, b) => {
            for (const { key, order } of sortKeys) {
                const valA = a.fields?.[key];
                const valB = b.fields?.[key];
                if (valA === valB) continue;
                const comparison = (valA ?? '') < (valB ?? '') ? -1 : 1;
                return order === 'asc' ? comparison : -comparison;
            }
            return 0;
        });
        return sortedData;
    };
    
    useEffect(() => {
        if (!rawTableData) {
            setTableData(null);
            return;
        }
        let processedData = applyLocalFilters(rawTableData, activeFilters);
        processedData = applyLocalSort(processedData, sortQuery);
        setTableData(processedData);
    }, [rawTableData, activeFilters, sortQuery]);

    useEffect(() => {
      if (!selectedTableId) { 
        setRawTableData(null);
        setColumns([]);
        return; 
      }
      const fetchInitialTableData = async () => {
        setStatusMessage(`正在獲取 ${selectedTableId} 的前 200 筆數據...`);
        setDataError('');
        setActiveFilters(null);
        setSortQuery('');
        try {
          const data = await apiRequest(`/api/docs/${selectedDocId}/tables/${selectedTableId}/records`, 'GET', { limit: '200' });
          if (data?.records) {
            setRawTableData(data.records);
            if (data.records.length > 0) {
              const allCols = new Set(data.records.flatMap(rec => Object.keys(rec.fields || {})));
              setColumns(Array.from(allCols));
              setStatusMessage(`成功獲取 ${data.records.length} 筆數據，您現在可以在下方進行篩選。`);
            } else {
              setColumns([]);
              setStatusMessage('獲取成功，但此表格沒有數據。');
            }
          } else { throw new Error('返回數據格式不正確'); }
        } catch (error) {
          setDataError(`獲取數據失敗: ${error.message}`);
          setRawTableData(null);
        }
      };
      fetchInitialTableData();
    }, [selectedTableId, selectedDocId, apiRequest]);

    const handleFilterChange = useCallback((filters) => {
        setActiveFilters(filters);
    }, []);
    
    useEffect(() => { setTimeout(() => { apiKeyManagerRef.current?.triggerFetchKeyFromProfile(); }, 100); }, []);

    useEffect(() => {
      if (!apiKey) {
        clearSubsequentState();
        if (!localStorage.getItem('gristApiKey')) { setShowLoginPrompt(true); }
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
      if (!selectedDocId) { setTables([]); setSelectedTableId(''); return; }
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
                {isApiLoading && !statusMessage.includes('成功') && !statusMessage.includes('同步') ? '處理中... ' : ''}{statusMessage}
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
                    <select value={selectedDocId} onChange={(e) => { setSelectedDocId(e.target.value); setSelectedTableId(''); setRawTableData(null); }} disabled={isApiLoading || documents.length === 0} style={styles.inputBase}>
                        <option value="">{isApiLoading && !documents.length ? '加載中...' : (documents.length === 0 ? '無可用文檔' : '-- 請選擇 --')}</option>
                        {documents.map((doc) => (<option key={doc.id} value={doc.id}>{doc.displayName}</option>))}
                    </select>
                </div>

                {selectedDocId && (
                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>選擇表格:</label>
                    <select value={selectedTableId} onChange={(e) => { setSelectedTableId(e.target.value); }} disabled={isApiLoading || tables.length === 0} style={styles.inputBase}>
                        <option value="">{isApiLoading && !tables.length ? '加載中...' : (tables.length === 0 ? '無可用表格' : '-- 請選擇 --')}</option>
                        {tables.map((table) => (<option key={table.id} value={table.id}>{table.name}</option>))}
                    </select>
                </div>
                )}
                
                {rawTableData && (
                <>
                    <Filter onSubmit={handleFilterChange} isLoading={isApiLoading} />
                    
                    <div style={{ ...styles.card, backgroundColor: '#ffffff', padding: '20px', marginTop: '20px' }}>
                        <h4 style={{ marginTop: '0', marginBottom: '15px' }}>數據排序選項</h4>
                        <input 
                            type="text" 
                            value={sortQuery} 
                            onChange={(e) => setSortQuery(e.target.value)} 
                            placeholder='排序條件 e.g., 欄位ID, -另一個欄位ID' 
                            style={styles.inputBase}
                        />
                         <small style={{display: 'block', marginTop: '8px', color: '#6c757d'}}>輸入欄位 ID 進行排序，加減號 (-) 代表降序。排序會立即生效。</small>
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
            
            {rawTableData && tableData?.length === 0 && !isApiLoading && !dataError && (
              <p style={{textAlign: 'center', ...styles.card, marginTop: '20px'}}>篩選結果為空。</p>
            )}
        </div>
    );
}

export default GristDynamicSelectorViewer;