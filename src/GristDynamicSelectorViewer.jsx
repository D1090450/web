import React, { useState, useCallback, useEffect, useRef } from 'react';

import { login } from './login'; 
import Filter from './components/Filter';
import { useGristData } from './hooks/useGristData'; 
import { formatTimestamp } from './utils/formatTimestamp'; 

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
  buttonDisabled: { backgroundColor: '#adb5bd', cursor: 'not-allowed', opacity: 0.7 },
  tableContainer: { marginTop: '30px', overflowX: 'auto', border: '1px solid #dee2e6', borderRadius: '6px' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '14px' },
  th: {
    backgroundColor: '#e9ecef', padding: '14px 12px', textAlign: 'left',
    color: '#333740', fontWeight: '600', borderBottom: '2px solid #dee2e6',
  },
  td: { padding: '12px', whiteSpace: 'nowrap', color: '#555e6d', borderBottom: '1px solid #dee2e6' },
};

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


function GristDynamicSelectorViewer() {
    const [apiKey, setApiKey] = useState(() => localStorage.getItem('gristApiKey') || '');
    const [statusMessage, setStatusMessage] = useState('');
    const [showLoginPrompt, setShowLoginPrompt] = useState(false);
    const [selectedDocId, setSelectedDocId] = useState('');
    const [selectedTableId, setSelectedTableId] = useState('');
    const apiKeyManagerRef = useRef(null);

    const {
        isLoading,
        error: dataError,
        documents,
        tables,
        columns,
        tableData,
        handleFilterChange,
        sortQuery,
        setSortQuery
    } = useGristData({
        apiKey,
        selectedDocId,
        selectedTableId,
        onAuthError: () => { // 權限錯誤時的回調
            setApiKey('');
            localStorage.removeItem('gristApiKey');
            setShowLoginPrompt(true);
            setStatusMessage('API Key 已失效或權限不足，請重新登入 Grist 並刷新頁面，或手動設定。');
        }
    });

    const handleApiKeyUpdate = useCallback((key, autoFetched = false) => {
        setApiKey(key);
        setShowLoginPrompt(false);
        if (key) {
            localStorage.setItem('gristApiKey', key);
            setStatusMessage(autoFetched ? 'API Key 已與 Grist 會話同步！' : 'API Key 已手動設定。');
        } else {
            localStorage.removeItem('gristApiKey');
        }
    }, []);

    // 啟動時自動獲取 API Key
    useEffect(() => {
        setTimeout(() => apiKeyManagerRef.current?.triggerFetchKeyFromProfile(), 100);
    }, []);

    // 啟動時如果沒有 Key，顯示提示
    useEffect(() => {
        if (!apiKey && !localStorage.getItem('gristApiKey')) {
            setShowLoginPrompt(true);
        }
    }, [apiKey]);
    
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

            {statusMessage && (
                <p style={styles.statusMessage(hasErrorStatus)}>
                    {hasErrorStatus ? '⚠️ ' : '✅ '}
                    {isLoading ? '處理中... ' : ''}{statusMessage}
                </p>
            )}

            {dataError && (
                <p style={{...styles.statusMessage(true), marginTop: '15px' }}>
                    ⚠️ 錯誤: {dataError}
                </p>
            )}
            
            <GristApiKeyManager
                ref={apiKeyManagerRef}
                apiKey={apiKey}
                onApiKeyUpdate={handleApiKeyUpdate}
                onStatusUpdate={setStatusMessage}
            />

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
                
                {tableData && (
                <>
                    <Filter onSubmit={handleFilterChange} isLoading={isLoading} />
                    
                    <div style={{ ...styles.card, backgroundColor: '#ffffff', padding: '20px', marginTop: '20px' }}>
                        <h4 style={{ marginTop: '0', marginBottom: '15px' }}>數據排序選項</h4>
                        <input 
                            type="text" 
                            value={sortQuery} 
                            onChange={(e) => setSortQuery(e.target.value)} 
                            placeholder='排序條件 e.g., 欄位ID, -另一個欄位ID' 
                            style={styles.inputBase}
                        />
                         <small style={{display: 'block', marginTop: '8px', color: '#6c757d'}}>輸入欄位 ID 進行排序，加減號 (-) 代表降序。排序會立即生效。</small>
                    </div>
                </>
                )}
            </div>
            )}

            {tableData && tableData.length > 0 && (
            <div style={styles.tableContainer}>
                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th style={{ ...styles.th, position: 'sticky', left: 0, zIndex: 2, backgroundColor: '#e9ecef' }}>id</th>
                            {columns.map((col) => (<th key={col} style={styles.th}>{col}</th>))}
                        </tr>
                    </thead>
                    <tbody>
                        {tableData.map((record, index) => (
                        <tr key={record.id} style={{ backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8f9fa' }}>
                            <td style={{ ...styles.td, position: 'sticky', left: 0, zIndex: 1, backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8f9fa', borderRight: '1px solid #dee2e6' }}>{record.id}</td>
                            {columns.map((col) => {
                                const value = record.fields?.[col];
                                const cellContent = col === 'MOD_DTE'
                                    ? formatTimestamp(value)
                                    : (value != null ? (typeof value === 'object' ? JSON.stringify(value) : String(value)) : '');
                                
                                return (
                                    <td key={`${record.id}-${col}`} style={styles.td}>
                                        {cellContent}
                                    </td>
                                );
                            })}
                        </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            )}
            
            {tableData && tableData.length === 0 && !isLoading && (
              <p style={{textAlign: 'center', ...styles.card, marginTop: '20px'}}>篩選結果為空。</p>
            )}
        </div>
    );
}

export default GristDynamicSelectorViewer;