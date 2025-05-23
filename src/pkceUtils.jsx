// PKCE (Proof Key for Code Exchange) Helper Functions

// 產生一個隨機字串作為 code_verifier
export function generateCodeVerifier() {
  const array = new Uint32Array(28); // 產生足夠的隨機性
  window.crypto.getRandomValues(array);
  return Array.from(array, dec => ('0' + dec.toString(16)).slice(-2)).join('');
}

// 根據 code_verifier 產生 code_challenge
export async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  return base64urlEncode(digest);
}

// 將 ArrayBuffer 轉換為 Base64 URL-safe 字串
function base64urlEncode(arrayBuffer) {
  let str = '';
  const bytes = new Uint8Array(arrayBuffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}