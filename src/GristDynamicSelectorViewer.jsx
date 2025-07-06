import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';

// --- 更新後的 import ---
import { login } from './login';
import Filter from './components/Filter';
import { useGristData } from './hooks/useGristData';
import { Table } from './components/Table'; 

const GRIST_API_BASE_URL = 'https://tiss-grist.fcuai.tw';

const styles = {
  container: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
    color: '#333740',
    backgroundColor: '#ffffff',
    maxWidth: '1000px',
    width: '100%',
    padding: '40px',
    borderRadius: '8px',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    margin: '0 20px',
  },
  header: { textAlign: 'center', marginBottom: '30px' },
  title: { fontSize: '28px', fontWeight: '600', color: '#333740', marginBottom: '10px' },
  subtitle: { color: '#777f8d', fontSize: '14px' },
  statusMessage: (hasError) => ({
    padding: '12px 18px', margin: '20px 0', borderRadius: '6px',
    textAlign: 'center', fontSize: '14px', fontWeight: '500',
    border: `1px solid ${hasError ? '#dc3545' : '#28a745'}`,
    backgroundColor: hasError ? '#fdecea' : '#e9f7ef',
    color: hasError ? '#dc3545' : '#28a745',
  }),
  card: { padding: '25px', marginTop: '25px', border: '1px solid #dee2e6', borderRadius: '6px', backgroundColor: '#f8f9fa' },
  inputBase: {
    width: '100%', padding: '12px', fontSize: '16px',
    border: '1px solid #dee2e6', borderRadius: '6px', boxSizing: 'border-box',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  },
  buttonBase: {
    padding: '12px 20px', fontSize: '16px', fontWeight: '500',
    border: 'none', borderRadius: '6px', cursor: 'pointer',
    transition: 'background-color 0.2s, transform 0.1s',
  },
  buttonPrimary: { backgroundColor: '#007bff', color: '#ffffff' },
  buttonSecondary: { backgroundColor: '#6c757d', color: '#ffffff' },
};

// API Key 管理組件保持不變
const GristApiKeyManager = React.forwardRef(({ apiKey, onApiKeyUpdate, onStatusUpdate }, ref) => {
    const [localApiKey, setLocalApiKey] = useState(apiKey || '');
    useEffect(() => { setLocalApiKey(apiKey || ''); }, [apiKey]);
    const fetchKeyFromProfile = useCallback(async () => {
      try {
        const response = await fetch(`${GRIST_API_BASE_URL}/api/profile/apiKey`, { credentials: 'include', headers: { 'Accept': 'text/plain' } });
        const fetchedKey = await response.text();
        if (!response.ok || !fetchedKey || fetchedKey.includes('<') || fetchedKey.length < 32) {
          if (!apiKey) onStatusUpdate(`自動獲取失敗，請先登入 Grist。`);
          return false;
        }
        onApiKeyUpdate(fetchedKey.trim(), true);
        return true;
      } catch (error) {
        if (!apiKey) onStatusUpdate(`自動獲取失敗，請檢查網路連線或 Grist 服務狀態。`);
        return false;
      }
    }, [apiKey, onApiKeyUpdate, onStatusUpdate]);
    React.useImperativeHandle(ref, () => ({ triggerFetchKeyFromProfile: fetchKeyFromProfile }));
    const handleManualSubmit = () => {
      if (localApiKey.trim()) onApiKeyUpdate(localApiKey.trim(), false);
      else onStatusUpdate('請輸入有效的 API Key');
    };
    return (
      <div style={{ ...styles.card, borderStyle: 'dashed' }}>
        <h4 style={{ marginTop: '0', marginBottom: '15px' }}>API Key 管理</h4>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input type="password" value={localApiKey} onChange={(e) => setLocalApiKey(e.target.value)} placeholder="在此輸入或貼上 Grist API Key" style={{ ...styles.inputBase, flexGrow: 1 }}/>
          <button onClick={handleManualSubmit} style={{...styles.buttonBase, backgroundColor: '#e9ecef', color: '#333740' }}>手動設定</button>
        </div>
      </div>
    );
});

// 主組件
function GristDynamicSelectorViewer() {
    const [apiKey, setApiKey] = useState(() => localStorage.getItem('gristApiKey') || '');
    const [statusMessage, setStatusMessage] = useState('');
    const [showLoginPrompt, setShowLoginPrompt] = useState(false);
    const [selectedDocId, setSelectedDocId] = useState('');
    const [selectedTableId, setSelectedTableId] = useState('');
    const apiKeyManagerRef = useRef(null);

    // --- 所有數據邏輯都已封裝在 useGristData Hook 中 ---
    const {
        isLoading,
        error: dataError,
        documents,
        tables,
        columns, // 直接獲取 TanStack Table 需要的欄位定義
        tableData,
        handleFilterChange,
    } = useGristData({
        apiKey,
        selectedDocId,
        selectedTableId,
        onAuthError: () => {
            setApiKey('');
            localStorage.removeItem('gristApiKey');
            setShowLoginPrompt(true);
            setStatusMessage('API Key 已失效或權限不足，請重新登入 Grist 並刷新頁面，或手動設定。');
        }
    });

    const handleApiKeyUpdate = useCallback((key, autoFetched = false) => {
        setApiKey(key); setShowLoginPrompt(false);
        if (key) {
            localStorage.setItem('gristApiKey', key);
            setStatusMessage(autoFetched ? 'API Key 已與 Grist 會話同步！' : 'API Key 已手動設定。');
        } else {
            localStorage.removeItem('gristApiKey');
        }
    }, []);

    useEffect(() => { setTimeout(() => apiKeyManagerRef.current?.triggerFetchKeyFromProfile(), 100); }, []);
    useEffect(() => { if (!apiKey && !localStorage.getItem('gristApiKey')) { setShowLoginPrompt(true); } }, [apiKey]);
    
    const { openLoginPopup } = login({
        onFetchKeyAttempt: () => apiKeyManagerRef.current?.triggerFetchKeyFromProfile(),
        onStatusUpdate: setStatusMessage,
        hasApiKey: !!apiKey,
    });
  
    const hasErrorStatus = statusMessage.includes('失敗') || statusMessage.includes('錯誤') || statusMessage.includes('失效') || dataError;
  
    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h1 style={styles.title}>Grist 數據動態選擇查看器</h1>
                <p style={styles.subtitle}>API 目標: <code>{GRIST_API_BASE_URL}</code></p>
            </div>

            {statusMessage && <p style={styles.statusMessage(hasErrorStatus)}>{hasErrorStatus ? '⚠️ ' : '✅ '}{isLoading ? '處理中... ' : ''}{statusMessage}</p>}
            {dataError && <p style={{...styles.statusMessage(true), marginTop: '15px' }}>⚠️ 錯誤: {dataError}</p>}
            
            <GristApiKeyManager ref={apiKeyManagerRef} apiKey={apiKey} onApiKeyUpdate={handleApiKeyUpdate} onStatusUpdate={setStatusMessage} />

            {showLoginPrompt && !apiKey && (
            <div style={{ ...styles.card, textAlign: 'center', backgroundColor: '#fdecea', borderColor: '#dc3545' }}>
                <p style={{ margin: '0 0 15px 0', fontWeight: '500', color: '#dc3545' }}>需要有效的 API Key 才能繼續操作。</p>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                    <button onClick={openLoginPopup} style={{...styles.buttonBase, ...styles.buttonPrimary}}>開啟 Grist 登入</button>
                    <button onClick={() => apiKeyManagerRef.current?.triggerFetchKeyFromProfile()} style={{...styles.buttonBase, ...styles.buttonSecondary}}>重試自動獲取</button>
                </div>
            </div>
            )}

            {apiKey && (
            <div style={styles.card}>
                <h3 style={{ marginTop: '0', marginBottom: '20px', borderBottom: '1px solid #dee2e6', paddingBottom: '10px' }}>選擇數據源</h3>
                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>選擇文檔:</label>
                    <select value={selectedDocId} onChange={(e) => { setSelectedDocId(e.target.value); setSelectedTableId(''); }} disabled={isLoading || documents.length === 0} style={styles.inputBase}>
                        <option value="">{isLoading && !documents.length ? '加載中...' : (documents.length === 0 ? '無可用文檔' : '-- 請選擇 --')}</option>
                        {documents.map((doc) => (<option key={doc.id} value={doc.id}>{doc.displayName}</option>))}
                    </select>
                </div>
                {selectedDocId && (
                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>選擇表格:</label>
                    <select value={selectedTableId} onChange={(e) => { setSelectedTableId(e.target.value); }} disabled={isLoading || tables.length === 0} style={styles.inputBase}>
                        <option value="">{isLoading && !tables.length ? '加載中...' : (tables.length === 0 ? '無可用表格' : '-- 請選擇 --')}</option>
                        {tables.map((table) => (<option key={table.id} value={table.id}>{table.name}</option>))}
                    </select>
                </div>
                )}
                
                {/* 只有在有數據時才顯示篩選器 */}
                {/* 手動排序框已被移除，排序功能整合進表格標題的點擊事件中 */}
                {tableData && <Filter onSubmit={handleFilterChange} isLoading={isLoading} />}
            </div>
            )}

            {/* --- 使用新的 Table 組件渲染表格 --- */}
            {/* 排序功能現在由 Table 組件內部處理 (點擊表頭) */}
            {tableData && tableData.length > 0 && (
                <Table data={tableData} columns={columns} />
            )}
            
            {tableData && tableData.length === 0 && !isLoading && (
              <p style={{textAlign: 'center', ...styles.card, marginTop: '20px'}}>篩選結果為空。</p>
            )}
        </div>
    );
}

export default GristDynamicSelectorViewer;