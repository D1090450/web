// src/GristApiKeyFetcher.jsx
import React, { useState, useCallback } from 'react';

function GristApiKeyFetcher() {
  const [apiKeyData, setApiKeyData] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [rawResponse, setRawResponse] = useState(''); // 新增 state 儲存原始回應

  const fetchApiKey = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setApiKeyData(null);
    setRawResponse(''); // 重置原始回應

    const apiUrl = 'https://grist.tiss.dev/api/profile/apiKey';

    try {
      const response = await fetch(apiUrl, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        },
      });

      // 先獲取回應的文本形式
      const responseText = await response.text();
      setRawResponse(responseText); // 儲存原始回應以供顯示

      console.log("Raw response from server:", responseText); // 在控制台打印原始回應

      if (!response.ok) {
        // 即使 response.ok 是 false，responseText 也可能包含有用的錯誤訊息
        let errorBody = `HTTP error! status: ${response.status}`;
        errorBody += `, message: ${responseText || '(empty response body)'}`;
        throw new Error(errorBody);
      }

      // 嘗試解析文本為 JSON
      try {
        const data = JSON.parse(responseText);
        setApiKeyData(data);
      } catch (parseError) {
        console.error("Error parsing JSON:", parseError);
        console.error("Response text that failed to parse:", responseText); // 再次打印有問題的文本
        // 拋出一個更具體的錯誤，包含原始文本的提示
        throw new Error(`Failed to parse JSON response. Status: ${response.status}. Parser error: ${parseError.message}. Check the 'Raw Server Response' below or console for details.`);
      }

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
      {/* ... (其他說明文字不變) ... */}
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
        <div style={{ color: 'red', marginTop: '10px', border: '1px solid red', padding: '10px' }}>
          <h3>Error:</h3>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{error}</pre>
          <p>
            Check the browser console (F12) for more details, especially the Network tab
            to see the request and response headers. The raw server response is also shown below if available.
          </p>
        </div>
      )}

      {rawResponse && !apiKeyData && ( // 如果有原始回應但解析失敗或還沒成功
        <div style={{ marginTop: '10px', border: '1px solid #ccc', padding: '10px' }}>
          <h3>Raw Server Response (that might have caused parsing error):</h3>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: '200px', overflowY: 'auto', backgroundColor: '#f5f5f5' }}>
            {rawResponse}
          </pre>
        </div>
      )}

      {apiKeyData && (
        <div style={{ marginTop: '10px' }}>
          <h3>API Key Data (Successfully Parsed):</h3>
          <pre>{JSON.stringify(apiKeyData, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

export default GristApiKeyFetcher;