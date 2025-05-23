import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

// --- 設定 ---
// 重要：這些值必須與您在 Vite Proxy 中設定的路徑以及 OAuth Provider 的設定相符
const TOKEN_ENDPOINT_PROXY = '/oauth-token-proxy'; // 使用 Vite Proxy 的路徑
const CLIENT_ID = 'dvWFbhyb3Xf6oxkEyXchJFUI6RTPttaKVeELaKDG1'; // 您的 Client ID
const REDIRECT_URI = 'http://localhost:5173/oauth2/callback'; // 您的回呼 URI，必須與請求授權碼時使用的一致
// --- 設定結束 ---


function AuthCallback({ onLoginSuccess }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const exchangeCodeForToken = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');

      const storedState = sessionStorage.getItem('oauth_state');
      const codeVerifier = sessionStorage.getItem('oauth_code_verifier');

      // 清理 sessionStorage
      sessionStorage.removeItem('oauth_state');
      sessionStorage.removeItem('oauth_code_verifier');

      if (!code) {
        setError('錯誤：URL 中未找到授權碼 (code)。');
        setLoading(false);
        return;
      }

      if (!storedState || storedState !== state) {
        setError('錯誤：State 不匹配，可能存在 CSRF 攻擊。');
        setLoading(false);
        return;
      }

      if (!codeVerifier) {
        setError('錯誤：找不到 PKCE 的 code_verifier。');
        setLoading(false);
        return;
      }

      const params = new URLSearchParams();
      params.append('grant_type', 'authorization_code');
      params.append('code', code);
      params.append('redirect_uri', REDIRECT_URI);
      params.append('client_id', CLIENT_ID);
      params.append('code_verifier', codeVerifier);

      try {
        const response = await fetch(TOKEN_ENDPOINT_PROXY, { // 注意：這裡使用代理路徑
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: '無法解析錯誤回應' }));
          throw new Error(`交換 Token 失敗: ${response.status} - ${errorData.error || errorData.message || '未知錯誤'}`);
        }

        const tokenData = await response.json();
        if (tokenData.access_token) {
          onLoginSuccess(tokenData.access_token, tokenData.refresh_token, tokenData.id_token);
          navigate('/'); // 登入成功後跳轉到首頁
        } else {
          setError('錯誤：回應中未找到 Access Token。');
        }
      } catch (err) {
        console.error('交換 Token 時發生錯誤:', err);
        setError(`交換 Token 時發生錯誤: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    exchangeCodeForToken();
  }, [searchParams, navigate, onLoginSuccess]);

  if (loading) {
    return <p>正在處理登入回呼，請稍候...</p>;
  }

  if (error) {
    return (
      <div>
        <h2>登入失敗</h2>
        <p style={{ color: 'red' }}>{error}</p>
        <button onClick={() => navigate('/')}>返回首頁</button>
      </div>
    );
  }

  return null; // 成功時會跳轉，理論上不會看到這個
}

export default AuthCallback;