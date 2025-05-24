// src/App.jsx
import React from 'react';
import GristApiKeyFetcher from './GristApiKeyFetcher'; // 假設 GristApiKeyFetcher.jsx 在同一目錄

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>My App A</h1>
      </header>
      <main>
        <GristApiKeyFetcher />
      </main>
    </div>
  );
}

export default App;