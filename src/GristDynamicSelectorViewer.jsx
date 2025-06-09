// ModalPage.jsx
import React, { useState } from 'react';

// 主應用程式組件或頁面組件
function ModalPage() {
  // 狀態來控制彈出視窗的顯示與否
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 開啟彈出視窗的函式
  const openModal = () => {
    setIsModalOpen(true);
  };

  // 關閉彈出視窗的函式
  const closeModal = () => {
    setIsModalOpen(false);
  };

  // 彈出視窗的樣式 (可以根據需要調整或移到 CSS 檔案)
  const modalOverlayStyle = {
    position: 'fixed', // 固定位置，覆蓋整個視窗
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)', // 半透明黑色背景
    display: 'flex',
    alignItems: 'center', // 垂直居中
    justifyContent: 'center', // 水平居中
    zIndex: 1000, // 確保在最上層
  };

  const modalContentStyle = {
    backgroundColor: '#fff', // 白色背景
    padding: '25px 30px',
    borderRadius: '8px',
    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
    minWidth: '300px', // 最小寬度
    maxWidth: '90%',   // 最大寬度
    textAlign: 'center',
    position: 'relative', // 為了可能的內部絕對定位元素
  };

  const buttonStyle = {
    padding: '10px 20px',
    margin: '10px 5px',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '16px',
  };

  const primaryButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#007bff',
    color: 'white',
  };

  const secondaryButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#6c757d',
    color: 'white',
  };

  return (
    <div>
      <h1>我的網頁</h1>
      <p>使用下方的按鈕來控制彈出視窗的開啟與關閉。</p>

      {/* 開啟彈出視窗的按鈕 */}
      <button
        style={isModalOpen ? disabledButtonStyle : primaryButtonStyle}
        onClick={openModal}
        disabled={isModalOpen} // 當彈出視窗開啟時，禁用此按鈕
      >
        開啟彈出視窗
      </button>

      {/* 關閉彈出視窗的按鈕 */}
      <button
        style={!isModalOpen ? disabledButtonStyle : secondaryButtonStyle}
        onClick={closeModal}
        disabled={!isModalOpen} // 當彈出視窗關閉時，禁用此按鈕
      >
        關閉彈出視窗
      </button>

      {/* 彈出視窗組件 (只有 isModalOpen 為 true 時才渲染) */}
      {isModalOpen && (
        <div style={modalOverlayStyle} onClick={closeModal}> {/* 點擊背景遮罩也會關閉視窗 */}
          <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}> {/* 防止點擊內容時觸發背景的關閉事件 */}
            <h2>這是一個彈出視窗</h2>
            <p>這裡是彈出視窗的內容。</p>
            <p>你可以加入表單、訊息或任何其他內容。</p>
            {/* 注意：彈出視窗內部不再有自己的關閉按鈕 */}
          </div>
        </div>
      )}
    </div>
  );
}

export default ModalPage;