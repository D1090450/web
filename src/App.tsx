import React from 'react';
// 假設您有一個 App.css 檔案來定義 "App" 類別的樣式
import './App.css'; 
import GristDynamicSelectorViewer from './GristDynamicSelectorViewer'; // Vite/CRA 會自動解析 .tsx 副檔名

// 使用 React.FC (Functional Component) 來定義元件的類型
const App: React.FC = () => {
  return (
    // "App" 類別通常用於設定整個應用的基礎佈局，例如置中內容
    <div className="App">
      <main>
        <GristDynamicSelectorViewer />
      </main>
    </div>
  );
}

export default App;