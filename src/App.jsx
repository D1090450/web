import React, { useState, useEffect, useCallback } from 'react';
import './App.css'; // 確保你的 CSS 文件存在且路徑正確

// --- DataTable 組件 (保持不變) ---
function DataTable({ records, columns }) {
  if (!records || records.length === 0) {
    if (columns && columns.length > 0) {
        return (
            <table>
                <thead>
                    <tr>
                        {columns.map(key => <th key={key}>{key}</th>)}
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td colSpan={columns.length} style={{ textAlign: 'center' }}>沒有資料可顯示。</td>
                    </tr>
                </tbody>
            </table>
        );
    }
    return <p>沒有資料可顯示或尚未載入。</p>;
  }

  const columnKeys = columns && columns.length > 0 ? columns : Object.keys(records[0]?.fields || {});

  if (columnKeys.length === 0) {
      return <p>資料格式有誤或缺少 'fields' 結構。</p>;
  }

  return (
    <table>
      <thead>
        <tr>
          {columnKeys.map(key => (
            <th key={key}>{key}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {records.map(record => (
          <tr key={record.id}>
            {columnKeys.map(key => (
              <td key={`${record.id}-${key}`}>
                {record.fields && typeof record.fields[key] !== 'undefined' && record.fields[key] !== null
                    ? String(record.fields[key])
                    : ''}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// --- 主要 App 組件 ---
function App() {
  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // --- State for Grist Connection Info ---
  // 使用 Vite 環境變數或留空讓使用者輸入
  // **不要直接在程式碼中硬編碼生產環境的 API Key**
  const [gristUrl, setGristUrl] = useState(import.meta.env.VITE_GRIST_BASE_URL || ''); // 例如 'https://grist.example.com'
  const [apiKey, setApiKey] = useState(import.meta.env.VITE_GRIST_API_KEY_DEV || ''); // **僅供開發測試，或讓使用者輸入**

  const [inputDocId, setInputDocId] = useState('sGPkY6u1ZcXtNm3Qpi2LLP');
  const [inputTableName, setInputTableName] = useState('Flight');

  const fetchData = useCallback(async () => {
    const trimmedGristUrl = gristUrl.trim().replace(/\/$/, ''); // 移除末尾斜線
    const trimmedApiKey = apiKey.trim();
    const trimmedDocId = inputDocId.trim();
    const trimmedTableName = inputTableName.trim();

    if (!trimmedGristUrl) {
      setError(new Error("請輸入 Grist 服務 URL。"));
      return;
    }
    if (!trimmedApiKey) {
      setError(new Error("請輸入您的 Grist API Key。"));
      return;
    }
    if (!trimmedDocId || !trimmedTableName) {
      setError(new Error("請輸入有效的 Document ID 和 Table Name。"));
      setData([]);
      setColumns([]);
      return;
    }

    setLoading(true);
    setError(null);
    setData([]);
    setColumns([]);

    const requestUrl = `${trimmedGristUrl}/api/docs/${trimmedDocId}/tables/${trimmedTableName}/records`;
    // 你可能還想加上 limit 或 sort 等參數
    // const requestUrl = `${trimmedGristUrl}/api/docs/${trimmedDocId}/tables/${trimmedTableName}/records?limit=50&sort=-id`;

    try {
      const response = await fetch(requestUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${trimmedApiKey}`,
          'Accept': 'application/json',
          // 'Content-Type': 'application/json', // GET 請求通常不需要 Content-Type
        },
      });

      if (!response.ok) {
        let errorMsg = `HTTP 錯誤! 狀態碼: ${response.status} (URL: ${requestUrl})`;
        try {
            const errorData = await response.json();
            errorMsg = errorData.error || errorData.details || (Array.isArray(errorData.errors) && errorData.errors[0]?.detail) || errorMsg;
        } catch (e) {
            console.warn("無法解析 Grist 錯誤回應為 JSON:", e);
            const textError = await response.text();
            if (textError) {
                errorMsg += ` - ${textError.substring(0, 200)}`;
            }
        }
        throw new Error(errorMsg);
      }

      const result = await response.json();

      if (result && Array.isArray(result.records)) {
        setData(result.records);
        if (result.records.length > 0 && result.records[0]?.fields) {
          setColumns(Object.keys(result.records[0].fields));
        } else {
          setColumns([]);
          if (result.records.length === 0) {
            // 讓 DataTable 顯示 "沒有資料"
          }
        }
      } else {
        console.warn("Grist API 回應格式不正確:", result);
        setData([]);
        setColumns([]);
        setError(new Error("從 Grist API 收到的資料格式不正確。期待 { records: [...] }。"));
      }

    } catch (err) {
      console.error("獲取資料時發生錯誤:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
      setData([]);
      setColumns([]);
    } finally {
      setLoading(false);
    }
  }, [gristUrl, apiKey, inputDocId, inputTableName]);

  const handleFetchClick = () => {
    fetchData();
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter') {
      // 可以在輸入 Grist URL 或 API Key 時也觸發，或者只在 Doc ID/Table Name 時觸發
      if (document.activeElement.id === "docIdInput" || document.activeElement.id === "tableNameInput") {
        handleFetchClick();
      }
    }
  };

  return (
    <div className="App">
      <h1>Grist 資料檢視器 (前端直連)</h1>

      <div className="input-area">
        <div>
          <label htmlFor="gristUrlInput">Grist 服務 URL:</label>
          <input
            id="gristUrlInput"
            type="text"
            value={gristUrl}
            onChange={(e) => setGristUrl(e.target.value)}
            placeholder="例如: https://your-grist.example.com"
            disabled={loading}
            onKeyPress={handleKeyPress}
          />
        </div>
        <div>
          <label htmlFor="apiKeyInput">Grist API Key:</label>
          <input
            id="apiKeyInput"
            type="password" // 使用 password 類型稍微隱藏，但仍在前端
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="輸入您的 Grist API Key"
            disabled={loading}
            onKeyPress={handleKeyPress}
          />
        </div>
        <hr /> {/* 分隔線 */}
        <div>
          <label htmlFor="docIdInput">Document ID:</label>
          <input
            id="docIdInput"
            type="text"
            value={inputDocId}
            onChange={(e) => setInputDocId(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="輸入 Document ID"
            disabled={loading}
          />
        </div>
        <div>
          <label htmlFor="tableNameInput">Table Name:</label>
          <input
            id="tableNameInput"
            type="text"
            value={inputTableName}
            onChange={(e) => setInputTableName(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="輸入 Table Name"
            disabled={loading}
          />
        </div>
        <button
          onClick={handleFetchClick}
          disabled={loading || !gristUrl.trim() || !apiKey.trim() || !inputDocId.trim() || !inputTableName.trim()}
        >
          {loading ? '正在載入...' : '獲取資料'}
        </button>
      </div>

      <div className="output-area">
        {loading && <p className="loading-message" role="status">載入中...</p>}
        {error && (
            <p className="error-message" role="alert">
                錯誤: {error.message}
            </p>
        )}
        {!loading && !error && <DataTable records={data} columns={columns} />}
      </div>
    </div>
  );
}

export default App;