import React, { useState, useEffect } from 'react';

function CookieFetcher() {
  const [targetResponse, setTargetResponse] = useState('');
  const [error, setError] = useState('');

  // 假設這是您想嘗試獲取其 Cookie 的目標網站的某個 API 端點
  // 重要：您需要替換成一個實際的、且該網站期望您攜帶 Cookie 訪問的端點
  const targetUrl = 'https://datalab.tiss.dev/'; // 請替換

  useEffect(() => {
    const fetchWithCookies = async () => {
      try {
        // 嘗試發送帶有憑證的請求
        // 這會讓瀏覽器嘗試包含 api.otherwebsite.com 的 Cookie (如果存在且符合策略)
        const response = await fetch(targetUrl, {
          method: 'GET', // 或其他適當的方法
          credentials: 'include', // 關鍵：嘗試包含跨域 Cookie
          // 您可能還需要根據目標 API 的要求設定其他標頭，例如 Content-Type, Authorization 等
          // headers: {
          //   'Content-Type': 'application/json',
          // },
        });

        if (!response.ok) {
          // 如果目標伺服器因為 CORS 設定不正確 (即使您有插件) 或其他原因拒絕了請求
          // 例如，如果 Access-Control-Allow-Credentials 不是 true，或者 Access-Control-Allow-Origin 不匹配
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        // 您無法直接從 response.headers.get('Set-Cookie') 或 document.cookie 讀取目標域名的 Cookie
        // 瀏覽器出於安全原因不會暴露它們 [9]

        // 您能做的是檢查回應的主體 (body)
        // 如果目標伺服器設計為在回應主體中返回某些與用戶狀態相關的資訊 (這些資訊可能源於 Cookie)
        const data = await response.text(); // 或者 response.json() 如果是 JSON
        setTargetResponse(`成功獲取回應 (但無法直接讀取 Cookie):\n ${data}`);
        setError('');

      } catch (e) {
        console.error('獲取失敗:', e);
        setError(`獲取失敗: ${e.message}. 請檢查瀏覽器控制台以獲取更多 CORS 或網路錯誤的詳細資訊。同時確認目標伺服器是否允許您的來源進行帶憑證的請求。`);
        setTargetResponse('');
      }
    };

    fetchWithCookies();
  }, [targetUrl]); // 當 targetUrl 改變時重新執行

  return (
    <div>
      <h2>嘗試從其他網站獲取資訊 (間接與 Cookie 相關)</h2>
      <p><strong>目標 URL:</strong> {targetUrl}</p>
      {error && <p style={{ color: 'red' }}>錯誤: {error}</p>}
      {targetResponse && (
        <div>
          <h3>來自目標網站的回應:</h3>
          <pre>{targetResponse}</pre>
          <p><strong>請注意:</strong> 這段回應是目標伺服器返回的內容。它本身**並不是**直接的 Cookie 字串。如果目標伺服器根據其接收到的 Cookie (由瀏覽器自動附加到請求中) 來客製化此回應，那麼這段內容可能間接反映了 Cookie 的存在或某些狀態。</p>
          <p>您仍然無法透過 `document.cookie` 在您的 `localhost` 或您的網站上讀取 `otherwebsite.com` 的 Cookie。</p>
        </div>
      )}
      <p><strong>重要提醒：</strong></p>
      <ul>
        <li>直接讀取不同域名的 Cookie 在瀏覽器中是不被允許的，這是出於安全考量。</li>
        <li>即使您的瀏覽器插件處理了 CORS，`credentials: 'include'` 也需要目標伺服器正確設定 `Access-Control-Allow-Origin` (不能是 `*`) 和 `Access-Control-Allow-Credentials: true`。</li>
        <li>目標 Cookie 的 `SameSite` 屬性必須是 `None` 並且設定 `Secure` (HTTPS)，才可能在跨站請求中被發送。 [1, 22]</li>
        <li>`HttpOnly` Cookie 無法透過 JavaScript 存取。</li>
        <li>此範例展示的是**嘗試讓瀏覽器發送 Cookie** 到目標伺服器，並獲取伺服器的回應。它**不能讓您的 JavaScript 直接讀取 Cookie 本身**。</li>
      </ul>
    </div>
  );
}

export default CookieFetcher;