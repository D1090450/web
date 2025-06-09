// ModalPage.jsx
import React, { useState } from 'react';

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

  // 彈出視窗的樣式
  const modalOverlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)', // 仍然保留背景遮罩以區分層次
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  };

  const modalContentStyle = {
    backgroundColor: '#fff',
    padding: '25px 30px',
    borderRadius: '8px',
    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
    minWidth: '300px',
    maxWidth: '90%',
    textAlign: 'center',
    // 如果需要，可以給彈出視窗本身添加 overflow: 'auto' 以便內容過多時滾動
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

  return (
    <div>
      <h1>我的網頁</h1>
      <p>使用下方的按鈕來控制彈出視窗的開啟與關閉。</p>
      <p>這個彈出視窗不會因為點擊背景而關閉。</p>

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
        // *** 主要修改點：移除了 modalOverlayStyle div 上的 onClick 事件 ***
        <div style={modalOverlayStyle}>
          {/* 
            之前 modalContentStyle div 上的 onClick={(e) => e.stopPropagation()} 
            在這種情況下不再嚴格必要，因為父元素不再有關閉事件。
            但保留它也無害，如果未來 overlay 又添加了其他交互，它依然能防止事件冒泡。
          */}
          <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
            <h2>這是一個彈出視窗</h2>
            <p>這裡是彈出視窗的內容。</p>
            <p>這個視窗只能透過主頁面上的「關閉」按鈕來關閉。</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default ModalPage;