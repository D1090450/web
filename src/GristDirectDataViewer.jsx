// src/GristDirectDataViewer.jsx
import React, { useState, useCallback } from 'react';

// Grist API 的基礎 URL
const GRIST_API_BASE_URL = 'https://grist.tiss.dev'; // 你的 Grist 實例 API URL

// 嵌入 GristApiKeyFetcher 的邏輯或簡化為直接輸入
function GristApiKeyFetcherInline({ onApiKeyFetched, apiKey, setApiKey }) {
  const [localApiKey, setLocalApiKey] = useState(apiKey || '');
  const [fetchStatus, setFetchStatus] = useState('');
  const [isFetching, setIsFetching] = useState(false);

  // 模擬從 /api/profile/apiKey 獲取，需要 CORS 和 cookie 支持
  const fetchKeyFromProfile = useCallback(async () => {
    setIsFetching(true);
    setFetchStatus('正在獲取 API Key...');
    try {
      const response = await fetch(`${GRIST_API_BASE_URL}/api/profile/apiKey`, {
        method: 'GET',
        credentials: 'include', // 關鍵：攜帶 grist.tiss.dev 的 cookie
        headers: {
          'Accept': 'text/plain', // Grist 的 /api/profile/apiKey 通常返回純文本
        },
      });

      const responseText = await response.text();

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${responseText || '無法獲取 API Key'}`);
      }

      // Grist 的 /api/profile/apiKey 直接返回 key 文本
      const fetchedKey = responseText.trim();
      if (!fetchedKey || fetchedKey.includes('<') || fetchedKey.length < 32) { // 簡單的有效性檢查
        throw new Error('獲取到的 API Key 似乎無效。可能未登入或 Grist Cookie 無效/過期。');
      }
      setLocalApiKey(fetchedKey);
      onApiKeyFetched(fetchedKey);
      setFetchStatus('API Key 獲取成功！');
    } catch (error) {
      console.error("Error fetching API key from profile:", error);
      setFetchStatus(`獲取 API Key 失敗: ${error.message}. 請確保您已在 grist.tiss.dev 登入，且 CORS 設定正確允許此操作。您也可以手動輸入 API Key。`);
      onApiKeyFetched(''); // 清除舊 key
    } finally {
      setIsFetching(false);
    }
  }, [onApiKeyFetched]);

  const handleSubmit = () => {
    if (localApiKey.trim()) {
      onApiKeyFetched(localApiKey.trim());
      setFetchStatus('API Key 已設定。');
    } else {
      setFetchStatus('請輸入或獲取 API Key。');
    }
  };

  return (
    <div style={{ marginBottom: '15px', padding: '10px', border: '1px dashed #aaa' }}>
      <h4>API Key 管理</h4>
      <p>
        您必須登入 <code>{GRIST_API_BASE_URL}</code> 才能使 "自動獲取" 按鈕生效 (依賴 Cookie 和 CORS)。
        或者，您可以從 Grist 的 Profile 頁面手動複製 API Key 並在此輸入。
      </p>
      <input
        type="password"
        value={localApiKey}
        onChange={(e) => {
            setLocalApiKey(e.target.value);
            // 如果用戶手動修改，也立即更新外部狀態
            // 但更建議通過 "設定手動輸入的 Key" 按鈕確認
        }}
        placeholder="在此輸入或貼上 Grist API Key"
        style={{ width: '350px', marginRight: '10px', padding: '8px' }}
      />
      <button onClick={handleSubmit} style={{ padding: '8px 12px', marginRight: '5px' }}>
        設定手動輸入的 Key
      </button>
      <button onClick={fetchKeyFromProfile} disabled={isFetching} style={{ padding: '8px 12px' }}>
        {isFetching ? '正在獲取...' : '自動獲取 API Key (需登入Grist)'}
      </button>
      {fetchStatus && <p style={{ marginTop: '5px', color: fetchStatus.includes('失敗') || fetchStatus.includes('無效') ? 'red' : 'green' }}>{fetchStatus}</p>}
    </div>
  );
}


function GristDirectDataViewer() {
  const [apiKey, setApiKey] = useState('');
  const [docId, setDocId] = useState('');
  const [tableName, setTableName] = useState('');

  const [tableData, setTableData] = useState(null);
  const [columns, setColumns] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [dataError, setDataError] = useState('');

  const handleApiKeyFetched = useCallback((key) => {
    setApiKey(key);
  }, []);

  const handleFetchData = useCallback(async () => {
    if (!apiKey.trim()) {
      setDataError('請先獲取或輸入 Grist API Key。');
      return;
    }
    if (!docId.trim() || !tableName.trim()) {
      setDataError('請輸入 Document ID 和 Table Name。');
      return;
    }

    setIsLoadingData(true);
    setDataError('');
    setTableData(null);
    setColumns([]);

    // Grist API 端點
    const endpoint = `${GRIST_API_BASE_URL}/api/docs/${docId}/tables/${tableName}/records`;

    // 你可以在這裡添加 filter, limit, sort 等查詢參數
    const queryParams = new URLSearchParams({ limit: '50' }); // 示例：獲取前50條
    // if (someFilter) queryParams.append('filter', JSON.stringify(someFilter));
    // if (someSort) queryParams.append('sort', someSort);

    const fullUrl = `${endpoint}?${queryParams.toString()}`;

    try {
      const response = await fetch(fullUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
          // 'Content-Type': 'application/json', // GET 請求通常不需要 Content-Type
        },
        // credentials: 'omit' // 或不設置，因為我們用 Bearer token，不依賴 cookie 做數據請求認證
      });

      const responseData = await response.json();

      if (!response.ok) {
        const errorMsg = responseData?.error?.message || responseData?.error || responseData?.message || `HTTP error ${response.status}`;
        throw new Error(errorMsg);
      }

      if (responseData && responseData.records) {
        setTableData(responseData.records);
        if (responseData.records.length > 0 && responseData.records[0].fields) {
          // 獲取所有可能的列名，即使某些記錄沒有該字段
          const allCols = new Set();
          responseData.records.forEach(rec => {
            if(rec.fields) {
              Object.keys(rec.fields).forEach(key => allCols.add(key));
            }
          });
          setColumns(Array.from(allCols));

        } else {
          setColumns([]);
        }
      } else {
        setDataError('從 Grist API 獲取的數據格式不正確，缺少 "records" 屬性。');
        setTableData([]);
      }
    } catch (error) {
      console.error("Error fetching Grist data:", error);
      setDataError(`獲取數據失敗: ${error.message}. 請檢查：1. API Key 是否正確且有效。2. Document ID 和 Table Name 是否存在。3. 瀏覽器控制台是否有 CORS 錯誤。4. Grist 服務是否正常。`);
      setTableData([]);
    } finally {
      setIsLoadingData(false);
    }
  }, [apiKey, docId, tableName]);

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Grist 數據直接查看器 (純前端)</h1>
      <p>API 目標: <code>{GRIST_API_BASE_URL}</code></p>
      <p style={{color: 'orange', fontWeight: 'bold'}}>
        注意：此純前端方案依賴 <code>{GRIST_API_BASE_URL}</code> 正確設定 CORS 標頭，
        以允許來自本網站的跨域請求。如果遇到網路錯誤，請檢查瀏覽器控制台中的 CORS 相關訊息。
      </p>

      <GristApiKeyFetcherInline apiKey={apiKey} onApiKeyFetched={handleApiKeyFetched} setApiKey={setApiKey} />

      {apiKey && (
        <div style={{ marginTop: '20px', padding: '10px', border: '1px solid #ccc' }}>
          <h3>輸入查詢參數</h3>
          <div style={{ marginBottom: '10px' }}>
            <label htmlFor="docId" style={{ marginRight: '5px' }}>Document ID:</label>
            <input
              id="docId"
              type="text"
              value={docId}
              onChange={(e) => setDocId(e.target.value)}
              placeholder="Grist Document ID"
              style={{ width: '300px', padding: '8px' }}
            />
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label htmlFor="tableName" style={{ marginRight: '5px' }}>Table Name:</label>
            <input
              id="tableName"
              type="text"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder="Grist Table Name"
              style={{ width: '200px', padding: '8px' }}
            />
          </div>
          <button onClick={handleFetchData} disabled={isLoadingData || !apiKey} style={{ padding: '10px 15px' }}>
            {isLoadingData ? '正在加載數據...' : '獲取 Grist 數據'}
          </button>
          {dataError && <p style={{ color: 'red', marginTop: '10px', whiteSpace: 'pre-wrap' }}>{dataError}</p>}
        </div>
      )}

      {tableData && tableData.length > 0 && columns.length > 0 && (
        <div style={{ marginTop: '20px', overflowX: 'auto' }}>
          <h3>數據結果: (前 {tableData.length} 條)</h3>
          <table border="1" cellPadding="5" cellSpacing="0" style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
            <thead>
              <tr>
                <th>id (Record ID)</th>
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
                    <td key={`${record.id}-${col}`} style={{ padding: '8px' }}>
                      {record.fields && record.fields[col] !== undefined
                        ? (typeof record.fields[col] === 'object' && record.fields[col] !== null
                          ? JSON.stringify(record.fields[col]) // 顯示陣列或對象為 JSON 字串
                          : String(record.fields[col]))
                        : '' /* 如果字段不存在則顯示空 */}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {tableData && tableData.length === 0 && !isLoadingData && !dataError && apiKey && (
        <p style={{ marginTop: '10px' }}>沒有找到數據，或者表格為空。</p>
      )}
    </div>
  );
}

export default GristDirectDataViewer;