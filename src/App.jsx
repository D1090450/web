import React, { useState, useEffect } from 'react';
import './App.css'; // 你可以添加一些樣式

function App() {
  const [apiKey, setApiKey] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isGristLoggedIn, setIsGristLoggedIn] = useState(false); // 簡單的登錄狀態模擬

  // Grist API端點 (相對於根路徑，因為 Vite 的 base 配置會處理前綴)
  // 如果你的 Grist API 不在根路徑下，例如在 /grist-app/api/...
  // 你可能需要寫成 const gristApiKeyEndpoint = '/grist-app/api/v1/me/api_key';
  const gristApiKeyEndpoint = '/api/v1/me/api_key'; // 假設 Grist API 在根的 /api/ 路徑下

  // 嘗試獲取 API Key 的函數
  const fetchGristApiKey = async () => {
    setIsLoading(true);
    setError(null);
    setApiKey(null);

    try {
      // 由於 Vite 的 base 配置，相對路徑會自動加上 /my-app-a/
      // 但我們調用的是 Grist 的 API，它在根域名下，所以我們使用相對於根的路徑
      // 如果 vite.config.js 中的 base 導致 fetch 的 URL 不正確，
      // 你可能需要硬編碼完整的 URL: 'https://grist.tiss.dev/api/v1/me/api_key'
      // 但通常情況下，瀏覽器會將 /api/... 解析為 https://grist.tiss.dev/api/...
      const response = await fetch(gristApiKeyEndpoint, {
        method: 'GET',
        credentials: 'include', // 非常重要，用於發送Cookie
        headers: {
          'Accept': 'application/json',
        },
      });

      if (response.status === 401 || response.status === 403) {
        setError('無法獲取 Grist API Key：用戶未登錄Grist或無權限。請先在另一個標籤頁登錄Grist。');
        setIsGristLoggedIn(false);
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP 錯誤! 狀態碼: ${response.status}, 信息: ${response.statusText}`);
      }

      const data = await response.json();

      if (data && data.apiKey) {
        setApiKey(data.apiKey);
        setIsGristLoggedIn(true); // 假設獲取成功即已登錄
      } else {
        setError('Grist API響應中未找到有效的 API Key。');
        console.warn('API Response:', data);
      }
    } catch (err) {
      setError(`獲取 API Key 時發生錯誤: ${err.message}`);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // 假設一個簡單的方式讓用戶“模擬”或確認他們已在Grist登錄
  // 實際應用中，你可能不需要這個，直接嘗試獲取key
  const handleAssumeLoggedIn = () => {
    // 這裡可以嘗試直接調用 fetchGristApiKey
    // 或者只是更新一個狀態讓用戶可以點擊獲取按鈕
    alert("請確保您已在另一個瀏覽器標籤頁登錄到 grist.tiss.dev。然後點擊 '獲取Grist API Key'。");
    // 你也可以在這裡加一個延遲後自動嘗試獲取API Key
  };


  return (
    <div className="App">
      <header className="App-header">
        <h1>網頁 A - Grist API Key 獲取器</h1>
        <p>
          此應用部署在 <code>/my-app-a/</code> 路徑下。
        </p>
        <p>
          Grist Cookie Domain: <code>.grist.tiss.dev</code> (預期) <br />
          Grist Cookie Path: <code>/</code> (預期)
        </p>

        {!apiKey && (
          <button onClick={fetchGristApiKey} disabled={isLoading}>
            {isLoading ? '正在獲取...' : '獲取Grist API Key'}
          </button>
        )}

        {isLoading && <p>載入中，請稍候...</p>}

        {error && (
          <div style={{ color: 'red', marginTop: '20px' }}>
            <p><strong>錯誤：</strong> {error}</p>
            {error.includes("未登錄Grist") && (
              <p>
                請打開 <a href="https://grist.tiss.dev" target="_blank" rel="noopener noreferrer">Grist (grist.tiss.dev)</a> 並登錄，然後再試一次。
              </p>
            )}
          </div>
        )}

        {apiKey && (
          <div style={{ marginTop: '20px', color: 'green' }}>
            <h2>成功獲取到 Grist API Key!</h2>
            <p><strong>API Key:</strong> <code>{apiKey}</code></p>
            <p><em>(這只是一個演示，請勿在生產環境中這樣直接顯示敏感信息)</em></p>
            <button onClick={() => { setApiKey(null); setError(null); }}>清除 API Key 並重試</button>
          </div>
        )}

        <hr style={{margin: "30px 0"}}/>
        <p><em>開發提示:</em></p>
        <ul style={{textAlign: "left", fontSize: "0.9em"}}>
            <li>確保你已在同一瀏覽器的另一個標籤頁登錄到 <code>grist.tiss.dev</code>。</li>
            <li>打開瀏覽器開發者工具 (F12)，查看網絡(Network)請求和控制台(Console)日誌。</li>
            <li>檢查請求到 <code>{gristApiKeyEndpoint}</code> 的請求頭中是否包含 Grist 的 Cookie。</li>
            <li>如果遇到路徑問題 (例如404)，確認 Vite 的 `base` 配置和 NPM 的路徑轉發/剝離配置。</li>
        </ul>
      </header>
    </div>
  );
}

export default App;