import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import AuthCallback from './AuthCallback';
import { generateCodeVerifier, generateCodeChallenge } from './pkceUtils';
import './App.css'; // 如果您有 App.css

// --- 設定 ---
// 重要：這些值必須與您在 OAuth Provider 的設定相符
const AUTHORIZATION_ENDPOINT = 'https://auth.tiss.dev/application/o/authorize/';
const CLIENT_ID = 'dvWFbhyb3Xf6oxkEyXchJFUI6RTPttaKVeELaKDG1';
const REDIRECT_URI = 'http://localhost:5173/oauth2/callback'; // 必須與 AuthCallback.jsx 中的 REDIRECT_URI 一致，並在 OAuth Provider 註冊
const SCOPE = 'openid email profile'; // 根據您的需求調整

// 您的 API 端點 (透過 Vite Proxy)
const API_PROFILE_APIKEY_ENDPOINT_PROXY = '/api-proxy/profile/apiKey'; // 假設您的 API 是 /api/profile/apiKey
// --- 設定結束 ---

function HomePage({ accessToken, onLogout, fetchApiKey }) {
  const [apiKey, setApiKey] = useState(null);
  const [apiError, setApiError] = useState(null);
  const [loadingApiKey, setLoadingApiKey] = useState(false);

  const handleFetchApiKey = async () => {
    if (!accessToken) {
      setApiError("請先登入以獲取 API Key。");
      return;
    }
    setLoadingApiKey(true);
    setApiError(null);
    try {
      // 步驟 2: POST /api/profile/apiKey (如果需要先生成)
      // 這裡假設您的 API 設計是先 POST 請求來觸發生成，然後 GET 來獲取
      // 如果您的 API 只需要 GET，可以直接跳到 GET 請求
      // 根據您的 API 設計，您可能需要調整這裡的邏輯
      const postResponse = await fetch(API_PROFILE_APIKEY_ENDPOINT_PROXY, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json', // 如果 POST 有 body
        },
        // body: JSON.stringify({ some_data_if_needed }), // 如果 POST 需要 body
      });

      if (!postResponse.ok) {
        // 嘗試解析錯誤訊息
        let errorMsg = `生成 API Key 失敗: ${postResponse.status}`;
        try {
            const errorData = await postResponse.json();
            errorMsg += ` - ${errorData.detail || errorData.message || JSON.stringify(errorData)}`;
        } catch (e) { /* 忽略解析錯誤 */ }
        throw new Error(errorMsg);
      }
      console.log("API Key 生成請求成功 (POST)");


      // 步驟 3: GET /api/profile/apiKey
      const getResponse = await fetch(API_PROFILE_APIKEY_ENDPOINT_PROXY, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!getResponse.ok) {
        let errorMsg = `獲取 API Key 失敗: ${getResponse.status}`;
        try {
            const errorData = await getResponse.json();
            errorMsg += ` - ${errorData.detail || errorData.message || JSON.stringify(errorData)}`;
        } catch (e) { /* 忽略解析錯誤 */ }
        throw new Error(errorMsg);
      }

      const data = await getResponse.json();
      setApiKey(data.apiKey || JSON.stringify(data)); // 假設 API 回應中有 apiKey 欄位
    } catch (err) {
      console.error("API Key 操作錯誤:", err);
      setApiError(err.message);
      setApiKey(null);
    } finally {
      setLoadingApiKey(false);
    }
  };

  useEffect(() => {
    // 您可以在這裡決定是否在組件載入時自動獲取 API Key
    // if (accessToken) {
    //   handleFetchApiKey();
    // }
  }, [accessToken]);


  if (!accessToken) {
    return (
      <div>
        <h2>請登入</h2>
        <p>您需要登入才能訪問此內容並獲取 API Key。</p>
      </div>
    );
  }

  return (
    <div>
      <h2>歡迎!</h2>
      <p>您已成功登入。</p>
      <button onClick={handleFetchApiKey} disabled={loadingApiKey}>
        {loadingApiKey ? '正在獲取 API Key...' : '獲取/刷新 API Key'}
      </button>
      {apiError && <p style={{ color: 'red' }}>API 錯誤: {apiError}</p>}
      {apiKey && (
        <div>
          <h3>您的 API Key:</h3>
          <pre>{typeof apiKey === 'string' ? apiKey : JSON.stringify(apiKey, null, 2)}</pre>
        </div>
      )}
      <button onClick={onLogout} style={{ marginTop: '20px' }}>登出</button>
    </div>
  );
}

function App() {
  const [accessToken, setAccessToken] = useState(sessionStorage.getItem('access_token'));
  // 可以考慮也儲存 refresh_token 和 id_token 如果您的應用需要
  // const [refreshToken, setRefreshToken] = useState(sessionStorage.getItem('refresh_token'));
  // const [idToken, setIdToken] = useState(sessionStorage.getItem('id_token'));

  const navigate = useNavigate(); // Hook for programmatic navigation

  const handleLogin = async () => {
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    const state = generateCodeVerifier(); // 也可以用 uuid

    sessionStorage.setItem('oauth_code_verifier', verifier);
    sessionStorage.setItem('oauth_state', state);

    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: SCOPE,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state: state,
    });

    window.location.href = `${AUTHORIZATION_ENDPOINT}?${params.toString()}`;
  };

  const handleLogout = () => {
    setAccessToken(null);
    sessionStorage.removeItem('access_token');
    // sessionStorage.removeItem('refresh_token');
    // sessionStorage.removeItem('id_token');
    // 可選：如果您的 OAuth Provider 支援 RP-Initiated Logout，可以在這裡跳轉到登出端點
    // window.location.href = 'YOUR_OAUTH_PROVIDER_LOGOUT_ENDPOINT';
    navigate('/'); // 跳轉回首頁或登入頁面
    console.log("已登出");
  };

  const handleLoginSuccess = (newAccessToken, newRefreshToken, newIdToken) => {
    setAccessToken(newAccessToken);
    sessionStorage.setItem('access_token', newAccessToken);
    // if (newRefreshToken) sessionStorage.setItem('refresh_token', newRefreshToken);
    // if (newIdToken) sessionStorage.setItem('id_token', newIdToken);
    console.log("登入成功，已獲取 Access Token:", newAccessToken);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>OAuth PKCE 範例應用</h1>
        <nav>
          <Link to="/">首頁</Link>
          {!accessToken && (
            <button onClick={handleLogin} style={{ marginLeft: '10px' }}>登入</button>
          )}
        </nav>
      </header>
      <main>
        <Routes>
          <Route
            path="/oauth2/callback"
            element={<AuthCallback onLoginSuccess={handleLoginSuccess} />}
          />
          <Route
            path="/"
            element={
              <HomePage
                accessToken={accessToken}
                onLogout={handleLogout}
              />
            }
          />
        </Routes>
      </main>
    </div>
  );
}

// 將 App 組件包裝在 Router 內部，這樣 App 內部才能使用 navigate
function AppWrapper() {
  return (
    <Router>
      <App />
    </Router>
  );
}

export default AppWrapper;