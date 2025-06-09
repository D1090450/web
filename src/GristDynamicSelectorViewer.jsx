// SameOriginPopupPage.jsx
import React, { useState, useRef, useEffect } from 'react';

function SameOriginPopupPage() {
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const popupWindowRef = useRef(null); // 用來儲存彈出視窗的引用

  // 開啟彈出分頁的函式
  const openPopup = () => {
    // 檢查彈出視窗是否已開啟且未被使用者手動關閉
    if (popupWindowRef.current && !popupWindowRef.current.closed) {
      popupWindowRef.current.focus(); // 如果已開啟，則聚焦
      alert('彈出視窗已經開啟了！');
      return;
    }

    // '/popupContent.html' 是相對於 public 資料夾的路徑
    // 瀏覽器可能會根據設定在新分頁或新視窗中開啟
    const newWindow = window.open(
      '/popupContent.html',
      'myPopupWindow', // 給視窗一個名稱，可以避免重複開啟相同名稱的視窗
      'width=600,height=400,resizable=yes,scrollbars=yes' // 可選的視窗特性
    );

    if (newWindow) {
      popupWindowRef.current = newWindow;
      setIsPopupOpen(true);
      newWindow.focus(); // 確保新視窗獲得焦點

      // 監聽彈出視窗是否被使用者手動關閉
      const checkInterval = setInterval(() => {
        if (popupWindowRef.current && popupWindowRef.current.closed) {
          clearInterval(checkInterval);
          setIsPopupOpen(false);
          popupWindowRef.current = null; // 清除引用
          console.log('彈出視窗已被使用者手動關閉。');
        }
      }, 500); // 每 500ms 檢查一次

    } else {
      alert('無法開啟彈出視窗。請檢查瀏覽器的彈出視窗攔截設定。');
    }
  };

  // 從主畫面關閉彈出分頁的函式
  const closePopup = () => {
    if (popupWindowRef.current && !popupWindowRef.current.closed) {
      popupWindowRef.current.close();
      setIsPopupOpen(false);
      popupWindowRef.current = null; // 清除引用
      console.log('彈出視窗已從主頁面關閉。');
    } else {
      alert('沒有可關閉的彈出視窗，或者它已被關閉。');
      setIsPopupOpen(false); // 確保狀態同步
      popupWindowRef.current = null;
    }
  };

  // 可選：向彈出視窗傳送訊息
  const sendMessageToPopup = () => {
    if (popupWindowRef.current && !popupWindowRef.current.closed) {
      const message = prompt("請輸入要傳送到彈出視窗的訊息：");
      if (message !== null) {
        // '*' 表示可以發送到任何來源，但為了安全，最好指定彈出視窗的確切來源
        // 例如：popupWindowRef.current.postMessage(message, window.location.origin);
        popupWindowRef.current.postMessage(message, '*');
      }
    } else {
      alert('彈出視窗未開啟或已被關閉。');
    }
  };

  // 監聽來自彈出視窗的訊息 (可選)
  useEffect(() => {
    const handleMessage = (event) => {
      // 確保訊息來自預期的來源 (彈出視窗)
      // 並且是我們預期的格式
      if (event.source === popupWindowRef.current && event.data) {
        console.log('Message received from popup:', event.data);
        if (event.data.type === 'popup_loaded') {
          alert('彈出視窗已成功載入！');
        } else if (typeof event.data === 'string') {
          // 處理來自彈出視窗的其他字串訊息
        }
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
      // 組件卸載時，如果彈出視窗仍然開啟，也嘗試關閉它 (可選行為)
      if (popupWindowRef.current && !popupWindowRef.current.closed) {
        // popupWindowRef.current.close();
      }
    };
  }, []); // 空依賴陣列，effect 只在掛載和卸載時執行


  // 按鈕樣式
  const buttonStyle = {
    padding: '10px 20px',
    margin: '10px 5px',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '16px',
  };
  const primaryButtonStyle = { ...buttonStyle, backgroundColor: '#007bff', color: 'white' };
  const secondaryButtonStyle = { ...buttonStyle, backgroundColor: '#6c757d', color: 'white' };
  const warningButtonStyle = { ...buttonStyle, backgroundColor: '#ffc107', color: 'black' };
  const disabledButtonStyle = { ...buttonStyle, backgroundColor: '#e9ecef', color: '#6c757d', cursor: 'not-allowed' };

  return (
    <div style={{ padding: '20px' }}>
      <h1>主頁面</h1>
      <p>使用按鈕來開啟和關閉一個同源的新分頁/視窗。</p>

      <button
        style={isPopupOpen ? disabledButtonStyle : primaryButtonStyle}
        onClick={openPopup}
        disabled={isPopupOpen}
      >
        開啟同源分頁
      </button>

      <button
        style={!isPopupOpen ? disabledButtonStyle : secondaryButtonStyle}
        onClick={closePopup}
        disabled={!isPopupOpen}
      >
        從主畫面關閉分頁
      </button>

      <button
        style={!isPopupOpen ? disabledButtonStyle : warningButtonStyle}
        onClick={sendMessageToPopup}
        disabled={!isPopupOpen}
      >
        向彈出視窗傳送訊息 (可選)
      </button>

      {isPopupOpen && <p style={{color: 'green', marginTop: '10px'}}>彈出視窗目前是開啟狀態。</p>}
      {!isPopupOpen && popupWindowRef.current === null && <p style={{color: 'red', marginTop: '10px'}}>彈出視窗目前是關閉狀態。</p>}
    </div>
  );
}

export default SameOriginPopupPage;