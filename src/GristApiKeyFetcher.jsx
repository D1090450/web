// src/GristApiKeyFetcher.jsx
import React, { useState, useCallback } from 'react';

function GristApiKeyFetcher() {
  const [apiKeyData, setApiKeyData] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchApiKey = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setApiKeyData(null);

    const apiUrl = 'https://grist.tiss.dev/api/profile/apiKey';

    try {
      const response = await fetch(apiUrl, {
        method: 'GET',
        // credentials: 'include' 是關鍵，它告訴 fetch API 發送跨域請求時要攜帶 cookie
        credentials: 'include',
        headers: {
          // 可以根據 Grist API 的要求添加其他必要的 header
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        // 嘗試讀取錯誤回應的本文
        let errorBody = `HTTP error! status: ${response.status}`;
        try {
            const text = await response.text();
            errorBody += `, message: ${text}`;
        } catch (e) {
            // 如果讀取錯誤本文失敗，忽略
        }
        throw new Error(errorBody);
      }

      const data = await response.json();
      setApiKeyData(data);
    } catch (err) {
      console.error("Error fetching API key:", err);
      setError(err.message || 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <div>
      <h2>Grist API Key Fetcher</h2>
      <p>
        This component attempts to fetch your Grist API key from
        <code>https://grist.tiss.dev/api/profile/apiKey</code> using cookies
        set for that domain.
      </p>
      <p>
        <strong>Important:</strong> For this to work, you must be logged into
        <code>https://grist.tiss.dev</code> in another tab (or have a valid session cookie),
        and the Grist server must have proper CORS configuration allowing requests
        from <code>https://webapp.tiss.dev</code> with credentials.
        The cookie must also have <code>SameSite=None; Secure</code> attributes.
      </p>
      <button onClick={fetchApiKey} disabled={isLoading}>
        {isLoading ? 'Fetching...' : 'Get Grist API Key'}
      </button>

      {isLoading && <p>Loading...</p>}

      {error && (
        <div style={{ color: 'red', marginTop: '10px' }}>
          <h3>Error:</h3>
          <pre>{error}</pre>
          <p>
            Check the browser console (F12) for more details, especially the Network tab
            to see the request and response headers (look for CORS errors).
          </p>
        </div>
      )}

      {apiKeyData && (
        <div style={{ marginTop: '10px' }}>
          <h3>API Key Data:</h3>
          <pre>{JSON.stringify(apiKeyData, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

export default GristApiKeyFetcher;