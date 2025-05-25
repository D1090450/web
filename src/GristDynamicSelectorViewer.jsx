// src/GristDynamicSelectorViewer.jsx
import React, { useState, useCallback, useEffect } from 'react';

// Grist API 的基礎 URL
const GRIST_API_BASE_URL = 'https://grist.tiss.dev'; // 請替換成您的 Grist 實例 API URL

// API Key 管理組件 (與您提供的版本基本相同)
function GristApiKeyManager({ apiKey, onApiKeyUpdate, onStatusUpdate }) {
  const [localApiKey, setLocalApiKey] = useState(apiKey || '');
  const [isFetching, setIsFetching] = useState(false);

  const fetchKeyFromProfile = useCallback(async () => {
    setIsFetching(true);
    onStatusUpdate('正在從個人資料獲取 API Key...');
    try {
      const response = await fetch(`${GRIST_API_BASE_URL}/api/profile/apiKey`, {
        method: 'GET',
        credentials: 'include', // 重要：為了讓瀏覽器發送 Grist 網站的 cookie
        headers: { 'Accept': 'text/plain' },
      });
      const responseText = await response.text();
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${responseText || '無法獲取 API Key'}`);
      const fetchedKey = responseText.trim();
      // 基本的 API Key 格式檢查 (Grist API Key 通常是較長的字串)
      if (!fetchedKey || fetchedKey.includes('<') || fetchedKey.length < 32) {
        throw new Error('獲取到的 API Key 似乎無效。請確認您已登入 Grist 且瀏覽器允許傳送 Cookie。');
      }
      setLocalApiKey(fetchedKey);
      onApiKeyUpdate(fetchedKey);
      onStatusUpdate('API Key 自動獲取成功！');
    } catch (error) {
      console.error("Error fetching API key from profile:", error);
      onStatusUpdate(`自動獲取 API Key 失敗: ${error.message}. 請確保您已登入 Grist 主站，或嘗試手動輸入。`);
      onApiKeyUpdate(''); // 清除可能無效的 key
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
    setLocalApiKey(apiKey || '');
  }, [apiKey]);

  return (
    <div style={{ marginBottom: '15px', padding: '10px', border: '1px dashed #aaa' }}>
      <h4>API Key 管理</h4>
      <p>
        若要啟用 "自動獲取"，請先登入您的 Grist 實例 (<code>{GRIST_API_BASE_URL}</code>)。
        或者，您可以從 Grist 個人資料頁面手動複製 API Key 貼於下方。
      </p>
      <input
        type="password"
        value={localApiKey}
        onChange={(e) => setLocalApiKey(e.target.value)}
        placeholder="在此輸入或貼上 Grist API Key"
        style={{ width: 'calc(100% - 230px)', marginRight: '10px', padding: '8px', boxSizing: 'border-box' }}
      />
      <button onClick={handleManualSubmit} style={{ padding: '8px 12px', marginRight: '5px' }}>
        設定手動 Key
      </button>
      <button onClick={fetchKeyFromProfile} disabled={isFetching} style={{ padding: '8px 12px' }}>
        {isFetching ? '正在獲取...' : '自動獲取 API Key'}
      </button>
    </div>
  );
}


function GristDynamicSelectorViewer() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gristApiKey') || '');
  const [statusMessage, setStatusMessage] = useState('');

  const [documents, setDocuments] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState('');
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);

  const [tables, setTables] = useState([]);
  const [selectedTableId, setSelectedTableId] = useState('');
  const [isLoadingTables, setIsLoadingTables] = useState(false);

  // 新增 filter 和 sort 狀態
  const [filterQuery, setFilterQuery] = useState(''); // 用於用戶輸入的 JSON 字串
  const [sortQuery, setSortQuery] = useState('');   // 用於用戶輸入的排序字串

  const [tableData, setTableData] = useState(null);
  const [columns, setColumns] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [dataError, setDataError] = useState('');

  const handleApiKeyUpdate = useCallback((key) => {
    setApiKey(key);
    if (key) {
      localStorage.setItem('gristApiKey', key);
      setStatusMessage('API Key 已更新。請選擇文檔。');
    } else {
      localStorage.removeItem('gristApiKey');
      setStatusMessage('API Key 已清除。');
    }
    // 清除相關選擇和數據
    setDocuments([]);
    setSelectedDocId('');
    setTables([]);
    setSelectedTableId('');
    setTableData(null);
    setFilterQuery('');
    setSortQuery('');
    setDataError('');
  }, []);

  const makeGristApiRequest = useCallback(async (endpoint, method = 'GET', params = null) => {
    if (!apiKey) {
      throw new Error('API Key 未設定。');
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
        'Content-Type': method !== 'GET' ? 'application/json' : undefined, // GET請求不應有Content-Type
      },
      // body: method !== 'GET' && bodyParams ? JSON.stringify(bodyParams) : undefined,
    });

    const responseData = await response.json().catch(() => {
      // 如果 JSON 解析失敗，嘗試讀取純文本錯誤訊息
      return response.text().then(text => {
        throw new Error(`HTTP error ${response.status}: ${text || response.statusText}`);
      });
    });

    if (!response.ok) {
      const errorMsg = responseData?.error?.message || responseData?.error || responseData?.message || `HTTP error ${response.status}`;
      console.error(`Grist API Error for ${method} ${url}:`, responseData);
      throw new Error(errorMsg);
    }
    return responseData;
  }, [apiKey]);

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
        // Grist API 的 /api/docs 端點會返回使用者有權限存取的所有文檔
        const data = await makeGristApiRequest('/api/docs');
        const docList = data.docs || (Array.isArray(data) ? data : []);
        if (Array.isArray(docList)) {
          setDocuments(docList.map(doc => ({ id: doc.id, name: doc.name || `文檔 ${doc.id}` })));
          setStatusMessage(docList.length > 0 ? '文檔列表獲取成功。請選擇一個文檔。' : '未找到任何文檔，或 API Key 無權限訪問。');
        } else {
          throw new Error('文檔列表格式不正確。');
        }
      } catch (error) {
        console.error('獲取文檔列表失敗:', error);
        setStatusMessage(`獲取文檔列表失敗: ${error.message}`);
        setDocuments([]);
      } finally {
        setIsLoadingDocs(false);
      }
    };
    fetchDocs();
  }, [apiKey, makeGristApiRequest]);

  useEffect(() => {
    if (!apiKey || !selectedDocId) {
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
          setTables(tableList.map(table => ({
            id: table.id, // table.id 即為 tableId
            name: table.id // Grist 中 tableId 通常也作為其識別名稱
          })));
          setStatusMessage(tableList.length > 0 ? '表格列表獲取成功。請選擇一個表格。' : '該文檔中未找到表格，或表格名稱無法解析。');
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

  const handleFetchTableData = useCallback(async () => {
    if (!apiKey || !selectedDocId || !selectedTableId) {
      setDataError('請先設定 API Key 並選擇文檔和表格。');
      return;
    }
    setIsLoadingData(true);
    setDataError('');
    setTableData(null);
    setColumns([]);
    setStatusMessage(`正在從文檔 "${selectedDocId}" 的表格 "${selectedTableId}" 中獲取數據...`);

    const params = { limit: '50' }; // 預設獲取50條，您可以讓這個值也可配置

    if (filterQuery) {
      try {
        JSON.parse(filterQuery); // 驗證 filterQuery 是否為合法的 JSON
        params.filter = filterQuery;
      } catch (e) {
        setDataError('過濾條件不是有效的 JSON 格式。請檢查輸入，例如：{"ColumnID": "Value"}');
        setStatusMessage('過濾條件格式錯誤。');
        setIsLoadingData(false);
        return;
      }
    }

    if (sortQuery.trim()) {
      params.sort = sortQuery.trim();
    }

    try {
      const data = await makeGristApiRequest(
        `/api/docs/${selectedDocId}/tables/${selectedTableId}/records`,
        'GET',
        params
      );
      if (data && data.records) {
        setTableData(data.records);
        if (data.records.length > 0) {
          // 從第一條記錄的 fields 推斷欄位名稱 (Grist 的 Column ID)
          // 更好的做法可能是從 /tables/{tableId}/columns 端點獲取欄位定義
          const allCols = new Set();
          data.records.forEach(rec => {
            if (rec.fields) Object.keys(rec.fields).forEach(key => allCols.add(key));
          });
          setColumns(Array.from(allCols));
          setStatusMessage(`成功獲取 ${data.records.length} 條數據。`);
        } else {
          setColumns([]);
          setStatusMessage('數據獲取成功，但表格為空或篩選結果為空。');
        }
      } else {
        throw new Error('數據格式不正確，缺少 "records" 屬性。');
      }
    } catch (error) {
      console.error('獲取表格數據失敗:', error);
      setDataError(`獲取數據失敗: ${error.message}`);
      setStatusMessage(`獲取數據失敗: ${error.message}`);
      setTableData([]); // 出錯時設為空陣列，避免渲染錯誤
    } finally {
      setIsLoadingData(false);
    }
  }, [apiKey, selectedDocId, selectedTableId, makeGristApiRequest, filterQuery, sortQuery]);

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '1000px', margin: 'auto' }}>
      <h1>Grist 數據動態選擇查看器</h1>
      <p>API 目標: <code>{GRIST_API_BASE_URL}</code></p>
      {statusMessage && (
        <p style={{
          padding: '10px',
          backgroundColor: statusMessage.includes('失敗') || statusMessage.includes('錯誤') ? '#ffebee' : '#e8f5e9',
          border: `1px solid ${statusMessage.includes('失敗') || statusMessage.includes('錯誤') ? 'red' : 'green'}`,
          color: statusMessage.includes('失敗') || statusMessage.includes('錯誤') ? 'red' : 'green',
          marginTop: '10px',
          marginBottom: '10px'
        }}>
          {statusMessage}
        </p>
      )}

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
                setSelectedTableId('');
                setTableData(null);
                setFilterQuery('');
                setSortQuery('');
                setDataError('');
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
                    setTableData(null);
                    setFilterQuery('');
                    setSortQuery('');
                    setDataError('');
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
            <div style={{ border: '1px solid #eee', padding: '15px', marginTop: '15px' }}>
              <h4>數據獲取選項</h4>
              <div style={{ marginTop: '10px' }}>
                <label htmlFor="filterInput" style={{ display: 'block', marginBottom: '5px' }}>
                  過濾條件 (JSON 格式):
                </label>
                <input
                  id="filterInput"
                  type="text"
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  placeholder='例如：{"ColumnID": "Value"} 或 {"Age": [">", 30]}'
                  style={{ width: '100%', padding: '8px', boxSizing: 'border-box', marginBottom: '5px' }}
                />
                <small>需為有效的 JSON。欄位 ID 區分大小寫。詳細語法請參考 Grist API 文件關於 "Filtering records" 的說明。</small>
              </div>

              <div style={{ marginTop: '10px', marginBottom: '10px' }}>
                <label htmlFor="sortInput" style={{ display: 'block', marginBottom: '5px' }}>
                  排序條件:
                </label>
                <input
                  id="sortInput"
                  type="text"
                  value={sortQuery}
                  onChange={(e) => setSortQuery(e.target.value)}
                  placeholder='例如：Name, -Age (按 Name 升序，再按 Age 降序)'
                  style={{ width: '100%', padding: '8px', boxSizing: 'border-box', marginBottom: '5px' }}
                />
                <small>欄位 ID 區分大小寫，前綴 "-" 表示降序。多個條件用逗號分隔。參考 "Sorting records"。</small>
              </div>

              <button
                onClick={handleFetchTableData}
                disabled={isLoadingData}
                style={{ padding: '10px 15px', marginTop: '10px', width: '100%', boxSizing: 'border-box', backgroundColor: '#4CAF50', color: 'white', border: 'none', cursor: 'pointer' }}
              >
                {isLoadingData ? '正在加載數據...' : `獲取 "${selectedTableId}" 的數據`}
              </button>
            </div>
          )}
          {dataError && <p style={{ color: 'red', marginTop: '10px', whiteSpace: 'pre-wrap', padding: '10px', backgroundColor: '#fff0f0', border: '1px solid darkred' }}>錯誤：{dataError}</p>}
        </div>
      )}

      {tableData && tableData.length > 0 && columns.length > 0 && (
        <div style={{ marginTop: '20px', overflowX: 'auto' }}>
          <h3>數據結果: (前 {Math.min(tableData.length, 50)} 條紀錄)</h3>
          <table border="1" cellPadding="5" cellSpacing="0" style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
            <thead>
              <tr>
                <th style={{backgroundColor: '#f2f2f2', padding: '8px', textAlign: 'left', position: 'sticky', left: 0, zIndex: 1}}>id (Record ID)</th>
                {columns.map((col) => (
                  <th key={col} style={{backgroundColor: '#f2f2f2', padding: '8px', textAlign: 'left'}}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.map((record) => (
                <tr key={record.id}>
                  <td style={{ padding: '8px', position: 'sticky', left: 0, backgroundColor: 'white', zIndex: 1 }}>{record.id}</td>
                  {columns.map((col) => (
                    <td key={`${record.id}-${col}`} style={{ padding: '8px', whiteSpace: 'nowrap' }}>
                      {record.fields && record.fields[col] !== undefined && record.fields[col] !== null
                        ? (typeof record.fields[col] === 'object'
                          ? JSON.stringify(record.fields[col]) // 對於陣列或物件型別的欄位
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
      {apiKey && selectedDocId && selectedTableId && tableData && tableData.length === 0 && !isLoadingData && !dataError && (
        <p style={{ marginTop: '10px', padding: '10px', backgroundColor: '#fffbe6', border: '1px solid #ffc107' }}>
            {filterQuery || sortQuery ? '沒有符合目前過濾/排序條件的數據，或者表格本身為空。' : '該表格目前沒有數據。'}
        </p>
      )}
    </div>
  );
}

export default GristDynamicSelectorViewer;