// src/GristDynamicSelectorViewer.jsx
import React, { useState, useCallback, useEffect } from 'react';

// Grist API 的基礎 URL
const GRIST_API_BASE_URL = 'https://grist.tiss.dev'; // 你的 Grist 實例 API URL

// 嵌入 GristApiKeyFetcher 的邏輯或簡化為直接輸入 (與之前類似)
function GristApiKeyManager({ apiKey, onApiKeyUpdate, onStatusUpdate }) {
  const [localApiKey, setLocalApiKey] = useState(apiKey || '');
  const [isFetching, setIsFetching] = useState(false);

  const fetchKeyFromProfile = useCallback(async () => {
    setIsFetching(true);
    onStatusUpdate('正在從個人資料獲取 API Key...');
    try {
      const response = await fetch(`${GRIST_API_BASE_URL}/api/profile/apiKey`, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Accept': 'text/plain' },
      });
      const responseText = await response.text();
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${responseText || '無法獲取 API Key'}`);
      const fetchedKey = responseText.trim();
      if (!fetchedKey || fetchedKey.includes('<') || fetchedKey.length < 32) {
        throw new Error('獲取到的 API Key 似乎無效。');
      }
      setLocalApiKey(fetchedKey);
      onApiKeyUpdate(fetchedKey);
      onStatusUpdate('API Key 獲取成功！');
    } catch (error) {
      console.error("Error fetching API key from profile:", error);
      onStatusUpdate(`獲取 API Key 失敗: ${error.message}. 請確保您已登入 Grist 且 CORS 設定正確。或手動輸入。`);
      onApiKeyUpdate('');
    } finally {
      setIsFetching(false);
    }
  }, [onApiKeyUpdate, onStatusUpdate]);

  const handleManualSubmit = () => {
    const trimmedKey = localApiKey.trim();
    if (trimmedKey) {
      onApiKeyUpdate(trimmedKey);
      onStatusUpdate('手動輸入的 API Key 已設定。');
    } else {
      onStatusUpdate('請輸入有效的 API Key。');
    }
  };

  useEffect(() => {
    // 如果外部 apiKey 變化 (例如從 localStorage 加載)，更新 localApiKey
    setLocalApiKey(apiKey || '');
  }, [apiKey]);

  return (
    <div style={{ marginBottom: '15px', padding: '10px', border: '1px dashed #aaa' }}>
      <h4>API Key 管理</h4>
      <p>
        登入 <code>{GRIST_API_BASE_URL}</code> 可啟用 "自動獲取" (依賴 Cookie 和 CORS)。
        或從 Grist Profile 頁面手動複製 API Key。
      </p>
      <input
        type="password"
        value={localApiKey}
        onChange={(e) => setLocalApiKey(e.target.value)}
        placeholder="在此輸入或貼上 Grist API Key"
        style={{ width: '350px', marginRight: '10px', padding: '8px' }}
      />
      <button onClick={handleManualSubmit} style={{ padding: '8px 12px', marginRight: '5px' }}>
        設定手動輸入的 Key
      </button>
      <button onClick={fetchKeyFromProfile} disabled={isFetching} style={{ padding: '8px 12px' }}>
        {isFetching ? '正在獲取...' : '自動獲取 API Key'}
      </button>
    </div>
  );
}


function GristDynamicSelectorViewer() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gristApiKey') || ''); // 從 localStorage 初始化
  const [statusMessage, setStatusMessage] = useState('');

  const [documents, setDocuments] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState('');
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);

  const [tables, setTables] = useState([]);
  const [selectedTableId, setSelectedTableId] = useState(''); // Grist API 通常用 tableId
  const [isLoadingTables, setIsLoadingTables] = useState(false);

  const [tableData, setTableData] = useState(null);
  const [columns, setColumns] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [dataError, setDataError] = useState('');

  // 更新 API Key 並存儲到 localStorage
  const handleApiKeyUpdate = useCallback((key) => {
    setApiKey(key);
    if (key) {
      localStorage.setItem('gristApiKey', key);
      setStatusMessage('API Key 已更新。');
    } else {
      localStorage.removeItem('gristApiKey');
      setStatusMessage('API Key 已清除。');
      // 清除相關選擇
      setDocuments([]);
      setSelectedDocId('');
      setTables([]);
      setSelectedTableId('');
      setTableData(null);
    }
  }, []);

  // 通用 API 請求函數
  const makeGristApiRequest = useCallback(async (endpoint, method = 'GET', params = null) => {
    if (!apiKey) {
      throw new Error('API Key 未設定。');
    }
    let url = `${GRIST_API_BASE_URL}${endpoint}`;
    if (params) {
      url += `?${new URLSearchParams(params).toString()}`;
    }

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
    });

    const responseData = await response.json();
    if (!response.ok) {
      const errorMsg = responseData?.error?.message || responseData?.error || responseData?.message || `HTTP error ${response.status}`;
      console.error(`Grist API Error for ${method} ${url}:`, responseData);
      throw new Error(errorMsg);
    }
    return responseData;
  }, [apiKey]);

  // 獲取文檔列表
  useEffect(() => {
    if (!apiKey) {
      setDocuments([]);
      setSelectedDocId('');
      return;
    }
    const fetchDocs = async () => {
      setIsLoadingDocs(true);
      setStatusMessage('正在獲取文檔列表...');
      setDataError('');
      try {
        // *** 假設的端點，你需要確認 Grist 實際的端點 ***
        // 可能需要遍歷 orgs/workspaces，或直接有 /api/docs
        // 這裡簡化為直接調用 /api/docs，並假設它返回 {docs: [{id: '', name: ''}]} 或直接是 [{id: '', name: ''}]
        const data = await makeGristApiRequest('/api/docs');
        const docList = data.docs || data; // 適應兩種可能的返回格式
        if (Array.isArray(docList)) {
          setDocuments(docList.map(doc => ({ id: doc.id, name: doc.name || `文檔 ${doc.id}` }))); // 確保有 name
          setStatusMessage('文檔列表獲取成功。');
        } else {
          throw new Error('文檔列表格式不正確。');
        }
      } catch (error) {
        console.error('獲取文檔列表失敗:', error);
        setStatusMessage(`獲取文檔列表失敗: ${error.message}. 請檢查 API Key 權限和網路。`);
        setDocuments([]);
      } finally {
        setIsLoadingDocs(false);
      }
    };
    fetchDocs();
  }, [apiKey, makeGristApiRequest]);

  // 獲取選定文檔的表格列表
  useEffect(() => {
    if (!apiKey || !selectedDocId) {
      setTables([]);
      setSelectedTableId('');
      return;
    }
    const fetchTables = async () => {
      setIsLoadingTables(true);
      setStatusMessage(`正在獲取文檔 ${selectedDocId} 的表格列表...`);
      setDataError('');
      try {
        // *** 假設的端點，你需要確認 Grist 實際的端點 ***
        // 返回格式通常是 {tables: [{id: '', fields: [...]}]} 或直接是 [{id: '', ...}]
        const data = await makeGristApiRequest(`/api/docs/${selectedDocId}/tables`);
        const tableList = data.tables || data; // 適應兩種可能的返回格式
         if (Array.isArray(tableList)) {
          // Grist API 的 tableId 通常就是其 'name' (normalized)
          // 有時 API 返回的 table 對象會有一個 `id` 字段是 tableId，`fields` 數組裡第一個對象的 `colId` 是 'id'
          // 這裡我們假設 API 返回的每個 table 對象有一個 `id` 屬性作為 tableId (通常是正規化後的表名)
          // 並且有一個 `tableId` 字段（有時也叫 id），用於顯示的名稱可能是 `name` 或 `id`
          setTables(tableList.map(table => ({
            id: table.id, // 這是 API 用於引用 table 的 ID
            name: table.id // 假設 tableId 就是顯示名稱，或者你可以尋找 table.name
          })));
          setStatusMessage('表格列表獲取成功。');
        } else {
          throw new Error('表格列表格式不正確。');
        }
      } catch (error) {
        console.error('獲取表格列表失敗:', error);
        setStatusMessage(`獲取表格列表失敗: ${error.message}`);
        setTables([]);
      } finally {
        setIsLoadingTables(false);
      }
    };
    fetchTables();
  }, [apiKey, selectedDocId, makeGristApiRequest]);

  // 獲取表格數據
  const handleFetchTableData = useCallback(async () => {
    if (!apiKey || !selectedDocId || !selectedTableId) {
      setDataError('請先設定 API Key 並選擇文檔和表格。');
      return;
    }
    setIsLoadingData(true);
    setDataError('');
    setTableData(null);
    setColumns([]);
    setStatusMessage(`正在獲取 ${selectedDocId} / ${selectedTableId} 的數據...`);

    try {
      const data = await makeGristApiRequest(
        `/api/docs/${selectedDocId}/tables/${selectedTableId}/records`,
        'GET',
        { limit: '50' } // 示例參數
      );
      if (data && data.records) {
        setTableData(data.records);
        if (data.records.length > 0 && data.records[0].fields) {
          const allCols = new Set();
          data.records.forEach(rec => {
            if (rec.fields) Object.keys(rec.fields).forEach(key => allCols.add(key));
          });
          setColumns(Array.from(allCols));
        } else {
          setColumns([]);
        }
        setStatusMessage('數據獲取成功！');
      } else {
        throw new Error('數據格式不正確，缺少 "records" 屬性。');
      }
    } catch (error) {
      console.error('獲取表格數據失敗:', error);
      setDataError(`獲取數據失敗: ${error.message}`);
      setStatusMessage(`獲取數據失敗: ${error.message}`);
      setTableData([]);
    } finally {
      setIsLoadingData(false);
    }
  }, [apiKey, selectedDocId, selectedTableId, makeGristApiRequest]);

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '1000px', margin: 'auto' }}>
      <h1>Grist 數據動態選擇查看器</h1>
      <p>API 目標: <code>{GRIST_API_BASE_URL}</code></p>
      {statusMessage && <p style={{ padding: '10px', backgroundColor: '#f0f0f0', border: `1px solid ${statusMessage.includes('失敗') ? 'red' : 'green'}` }}>{statusMessage}</p>}

      <GristApiKeyManager apiKey={apiKey} onApiKeyUpdate={handleApiKeyUpdate} onStatusUpdate={setStatusMessage} />

      {apiKey && (
        <div style={{ marginTop: '20px', padding: '10px', border: '1px solid #ccc' }}>
          <h3>選擇數據源</h3>
          <div style={{ marginBottom: '10px' }}>
            <label htmlFor="docSelect" style={{ marginRight: '10px', display: 'block', marginBottom: '5px' }}>選擇文檔:</label>
            <select
              id="docSelect"
              value={selectedDocId}
              onChange={(e) => {
                setSelectedDocId(e.target.value);
                setSelectedTableId(''); // 重置表格選擇
                setTableData(null); // 清除舊數據
              }}
              disabled={isLoadingDocs || documents.length === 0}
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
            >
              <option value="">{isLoadingDocs ? '正在加載文檔...' : (documents.length === 0 && apiKey ? '未找到文檔或無權限' : '-- 請選擇文檔 --')}</option>
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.name} ({doc.id})
                </option>
              ))}
            </select>
          </div>

          {selectedDocId && (
            <div style={{ marginBottom: '10px' }}>
              <label htmlFor="tableSelect" style={{ marginRight: '10px', display: 'block', marginBottom: '5px' }}>選擇表格:</label>
              <select
                id="tableSelect"
                value={selectedTableId}
                onChange={(e) => {
                    setSelectedTableId(e.target.value);
                    setTableData(null); // 清除舊數據
                }}
                disabled={isLoadingTables || tables.length === 0}
                style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
              >
                <option value="">{isLoadingTables ? '正在加載表格...' : (tables.length === 0 && selectedDocId ? '未找到表格或無權限' : '-- 請選擇表格 --')}</option>
                {tables.map((table) => (
                  <option key={table.id} value={table.id}>
                    {table.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedDocId && selectedTableId && (
            <button
              onClick={handleFetchTableData}
              disabled={isLoadingData}
              style={{ padding: '10px 15px', marginTop: '10px', width: '100%', boxSizing: 'border-box' }}
            >
              {isLoadingData ? '正在加載數據...' : `獲取 ${selectedTableId} 的數據`}
            </button>
          )}
          {dataError && <p style={{ color: 'red', marginTop: '10px', whiteSpace: 'pre-wrap' }}>{dataError}</p>}
        </div>
      )}

      {tableData && tableData.length > 0 && columns.length > 0 && (
        <div style={{ marginTop: '20px', overflowX: 'auto' }}>
          <h3>數據結果: (前 {tableData.length} 條)</h3>
          <table border="1" cellPadding="5" cellSpacing="0" style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
            <thead>
              <tr>
                <th style={{backgroundColor: '#f2f2f2', padding: '8px', textAlign: 'left'}}>id (Record ID)</th>
                {columns.map((col) => (
                  <th key={col} style={{backgroundColor: '#f2f2f2', padding: '8px', textAlign: 'left'}}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.map((record) => (
                <tr key={record.id}>
                  <td style={{ padding: '8px' }}>{record.id}</td>
                  {columns.map((col) => (
                    <td key={`${record.id}-${col}`} style={{ padding: '8px', whiteSpace: 'nowrap' }}>
                      {record.fields && record.fields[col] !== undefined
                        ? (typeof record.fields[col] === 'object' && record.fields[col] !== null
                          ? JSON.stringify(record.fields[col])
                          : String(record.fields[col]))
                        : ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {tableData && tableData.length === 0 && !isLoadingData && !dataError && apiKey && selectedDocId && selectedTableId && (
        <p style={{ marginTop: '10px' }}>沒有找到數據，或者表格為空。</p>
      )}
    </div>
  );
}

export default GristDynamicSelectorViewer;