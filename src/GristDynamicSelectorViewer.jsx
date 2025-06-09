// OpenGooglePage.jsx
import React from 'react';

function OpenGooglePage() {
  // 開啟 Google 首頁在新分頁的函式
  const openGoogleInNewTab = () => {
    // window.open(URL, target, features)
    // URL: 要載入的網址
    // target: '_blank' 會在新視窗或新分頁開啟 (取決於瀏覽器設定)
    // features: 'noopener,noreferrer' 是安全性的最佳實踐，
    //           noopener 防止新頁面透過 window.opener 存取原始頁面，
    //           noreferrer 防止新頁面知道來源頁面。
    window.open('https://www.google.com', '_blank', 'noopener,noreferrer');
  };

  // 按鈕樣式 (可以依照你的喜好調整)
  const buttonStyle = {
    padding: '12px 25px',
    margin: '20px 5px',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '17px',
    backgroundColor: '#4285F4', // Google 的藍色
    color: 'white',
    fontWeight: 'bold',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    transition: 'background-color 0.2s ease, box-shadow 0.2s ease',
  };

  const buttonHoverStyle = { // 只是範例，實際 hover 效果建議用 CSS :hover
    backgroundColor: '#357ae8',
    boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
  };


  // 為了示範 hover 效果，我們可以使用 onMouseEnter 和 onMouseLeave
  // 但在實際專案中，CSS 的 :hover 偽類是更好的選擇
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <div style={{ textAlign: 'center', paddingTop: '50px' }}>
      <h1>我的網頁</h1>
      <p>點擊下方按鈕以在新分頁中開啟 Google 搜尋引擎。</p>

      <button
        style={isHovered ? {...buttonStyle, ...buttonHoverStyle} : buttonStyle}
        onClick={openGoogleInNewTab}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        開啟 Google
      </button>

      {/*
        由於我們是開啟一個新的瀏覽器分頁，
        所以 "關閉彈出視窗" 的按鈕在這裡沒有意義。
        使用者會直接在瀏覽器層級關閉新開啟的 Google 分頁。
      */}
    </div>
  );
}

export default OpenGooglePage;