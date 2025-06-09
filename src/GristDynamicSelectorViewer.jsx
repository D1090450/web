// ModalPage.jsx
import React, { useState } from 'react';

function ModalPage() {
  // 狀態來控制彈出視窗的顯示與否
  const [isPanelOpen, setIsPanelOpen] = useState(false); // 改名為 isPanelOpen 更貼切

  // 開啟面板的函式
  const openPanel = () => {
    setIsPanelOpen(true);
  };

  // 關閉面板的函式
  const closePanel = () => {
    setIsPanelOpen(false);
  };

  // 浮動面板的樣式
  // 注意：這裡不再有 modalOverlayStyle
  const panelStyle = {
    position: 'fixed', // 固定定位，相對於瀏覽器視窗
    top: '20px',       // 距離頂部 20px
    right: '20px',     // 距離右側 20px (可以調整位置)
    // 或者使用 top: '50%', left: '50%', transform: 'translate(-50%, -50%)' 來居中
    backgroundColor: '#f8f9fa', // 淺色背景
    padding: '20px 25px',
    borderRadius: '8px',
    boxShadow: '0 5px 15px rgba(0, 0, 0, 0.15)', // 更柔和的陰影
    minWidth: '250px',
    maxWidth: '400px',
    zIndex: 1000, // 確保在主內容之上
    border: '1px solid #dee2e6', // 可選的邊框
    // 如果內容可能超出，可以添加：
    // maxHeight: '80vh',
    // overflowY: 'auto',
  };

  // 按鈕的基礎樣式
  const buttonStyle = {
    padding: '10px 20px',
    margin: '10px 5px',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '16px',
    transition: 'background-color 0.2s ease, opacity 0.2s ease',
  };

  // 開啟按鈕樣式
  const primaryButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#007bff',
    color: 'white',
  };

  // 關閉按鈕樣式
  const secondaryButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#6c757d',
    color: 'white',
  };

  // 按鈕禁用時的樣式
  const disabledButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#e9ecef',
    color: '#6c757d',
    cursor: 'not-allowed',
    opacity: 0.7,
  };

  // 主頁面內容的樣式，用於演示互動性
  const mainContentStyle = {
    padding: '20px',
    border: '1px dashed #ccc',
    marginTop: '20px',
    height: '300px', // 給一些高度，方便看到面板浮動效果
    backgroundColor: '#e9ecef',
  };

  return (
    <div>
      <h1>我的網頁</h1>
      <p>點擊按鈕來開啟或關閉一個非模態的浮動面板。</p>
      <p>當面板開啟時，您仍然可以與主頁面的其他部分互動。</p>

      {/* 開啟浮動面板的按鈕 */}
      <button
        style={isPanelOpen ? disabledButtonStyle : primaryButtonStyle}
        onClick={openPanel}
        disabled={isPanelOpen}
      >
        開啟面板
      </button>

      {/* 關閉浮動面板的按鈕 */}
      <button
        style={!isPanelOpen ? disabledButtonStyle : secondaryButtonStyle}
        onClick={closePanel}
        disabled={!isPanelOpen}
      >
        關閉面板
      </button>

      {/* 這裡是主頁面的其他可互動內容 */}
      <div style={mainContentStyle}>
        <h2>主頁面內容區域</h2>
        <p>您可以點擊這裡的文字或下方的按鈕，即使面板已開啟。</p>
        <button style={buttonStyle} onClick={() => alert('主頁面按鈕被點擊！')}>
          主頁面測試按鈕
        </button>
      </div>

      {/* 浮動面板組件 (只有 isPanelOpen 為 true 時才渲染) */}
      {isPanelOpen && (
        <div style={panelStyle}>
          <h3>浮動面板</h3>
          <p>這是浮動面板的內容。</p>
          <p>您可以將此面板拖曳或調整大小（如果實現了相關邏輯）。</p>
          <button style={secondaryButtonStyle} onClick={closePanel}>
            從面板內部關閉
          </button>
          {/* 注意：這個面板內部也可以有自己的關閉按鈕，或者完全依賴主頁面的按鈕 */}
        </div>
      )}
    </div>
  );
}

export default ModalPage;