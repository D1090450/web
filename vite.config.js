import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc';

// 您的 OAuth 提供者和 API 的基礎 URL
const AUTH_PROVIDER_BASE_URL = 'https://datalab-auth.tiss.dev'; // Authentik/OAuth 伺服器
const API_BASE_URL = 'https://datalab.tiss.dev'; // 您的 Grist 或目標 API 伺服器

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173, // 與您目前使用的端口一致
    proxy: {
      // 代理到 OAuth 權杖端點
      '/oauth-token-proxy': {
        target: `${AUTH_PROVIDER_BASE_URL}/application/o/token/`,
        changeOrigin: true,
        secure: false, // 如果目標伺服器使用自簽名證書，可能需要設為 false
        rewrite: (path) => path.replace(/^\/oauth-token-proxy/, ''),
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log(`[Proxy Req] /oauth-token-proxy -> ${options.target}${proxyReq.path}`);
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log(`[Proxy Res] /oauth-token-proxy <- ${proxyRes.statusCode}`);
          });
          proxy.on('error', (err, req, res) => {
            console.error('[Proxy Err] /oauth-token-proxy:', err);
          });
        }
      },
      // 代理到您的 Grist/目標 API
      '/api-proxy': {
        target: API_BASE_URL,
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api-proxy/, '/api'), // 假設您的 Grist API 在 /api 路徑下
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log(`[Proxy Req] /api-proxy -> ${options.target}${proxyReq.path}`);
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log(`[Proxy Res] /api-proxy <- ${proxyRes.statusCode}`);
          });
          proxy.on('error', (err, req, res) => {
            console.error('[Proxy Err] /api-proxy:', err);
          });
        }
      }
    }
  }
})

