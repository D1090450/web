import React from 'react'
import ReactDOM from 'react-dom/client'
import AppWrapper from './App' // 修改這裡
import './index.css' // 如果您有 index.css

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppWrapper /> {/* 修改這裡 */}
  </React.StrictMode>,
)