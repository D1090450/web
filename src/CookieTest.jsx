// src/CookieTest.jsx
import React, { useEffect, useState } from 'react';

function CookieTest() {
  const [currentCookies, setCurrentCookies] = useState('');
  const [lastRefreshed, setLastRefreshed] = useState('');

  const loadCookies = () => {
    // 嘗試讀取當前文檔來源的 Cookie
    // 這將只顯示由 http://localhost:5173 (或您 Vite 運行的端口) 設置的 Cookie
    const cookies = document.cookie;
    setCurrentCookies(cookies || '(沒有找到任何 Cookie)');
    setLastRefreshed(new Date().toLocaleTimeString());
    console.log("嘗試讀取 document.cookie:", cookies);
  };

  useEffect(() => {
    loadCookies(); // 組件載入時讀取一次
  }, []);

  return (
    <div style={{ border: '1px solid #ccc', padding: '20px', margin: '20px' }}>
      <h2>嘗試直接讀取 Cookie (document.cookie)</h2>
      <p>
        這個組件會嘗試使用 <code>document.cookie</code> 來讀取瀏覽器中的 Cookie。
        根據瀏覽器的同源政策，這裡**只會顯示由當前網域 (<code>{window.location.origin}</code>) 設定的 Cookie**。
      </p>
      <p>
        您**無法**透過這種方式直接讀取到其他網站 (例如 <code>.fcuai.tw</code> 或 <code>datalab.tiss.dev</code>) 的 Cookie，
        即使您已經在瀏覽器中登入了那些網站，並且那些網站的 Cookie 確實存在。
        CORS 瀏覽器插件通常也無法改變這個行為。
      </p>
      <button onClick={loadCookies} style={{ marginBottom: '10px' }}>
        重新讀取 Cookie
      </button>
      <p><strong>上次刷新時間:</strong> {lastRefreshed}</p>
      <div>
        <strong><code>document.cookie</code> 的內容:</strong>
        <pre
          style={{
            backgroundColor: '#f0f0f0',
            padding: '10px',
            border: '1px dashed #999',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}
        >
          {currentCookies}
        </pre>
      </div>
      <hr />
      <h4>實驗與觀察：</h4>
      <ol>
        <li>打開瀏覽器的開發者工具 (通常按 F12)。</li>
        <li>
          切換到 "Application" (Chrome/Edge) 或 "Storage" (Firefox) 標籤頁。
        </li>
        <li>
          在左側找到 "Cookies" 部分，您可以看到不同網域下儲存的 Cookie。
          <ul>
            <li>檢查 <code>http://localhost:5173</code> (或您的開發伺服器地址) 下的 Cookie。</li>
            <li>如果您之前訪問過目標網站 (例如 <code>datalab.tiss.dev</code> 或 <code>grist.fcuai.tw</code>)，
                並且它們設定了 Cookie，您應該能在對應的網域下找到它們。</li>
          </ul>
        </li>
        <li>
          比較開發者工具中其他網域的 Cookie 和上面顯示的 <code>document.cookie</code> 內容。
          您會發現，上面只會顯示與 <code>{window.location.origin}</code> 相關的 Cookie。
        </li>
        <li>
          您可以嘗試在開發者工具的控制台手動為 <code>localhost</code> 設定一個 Cookie，然後刷新本頁面看看：
          <br />
          <code>document.cookie = "myLocalCookie=helloFromLocalhost; path=/;"</code>
          <br />
          執行後點擊上面的「重新讀取 Cookie」按鈕。
        </li>
      </ol>
    </div>
  );
}

export default CookieTest;