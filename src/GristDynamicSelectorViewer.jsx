import React, { useState, useCallback, useEffect } from 'react';

// --- Imports ---
import Filter from './components/Filter';
import { useGristData } from './hooks/useGristData';
import { useGristLogin } from './hooks/useGristLogin'; // 【主要變更點 1】
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

// --- 【主要變更點 2】: GristApiKeyManager 組件被完全移除 ---

// 主組件
function GristDynamicSelectorViewer() {
    const [apiKey, setApiKey] = useState(() => localStorage.getItem('gristApiKey') || '');
    const [statusMessage, setStatusMessage] = useState('');
    const [showLoginPrompt, setShowLoginPrompt] = useState(false);
    const [selectedDocId, setSelectedDocId] = useState('');
    const [selectedTableId, setSelectedTableId] = useState('');
    // apiKeyManagerRef 被移除

    // 【主要變更點 3】: handleApiKeyUpdate 現在是傳給 useGristLogin 的 onSuccess 回調
    const handleApiKeyUpdate = useCallback((key) => {
        setApiKey(key);
        setShowLoginPrompt(false);
        if (key) {
            localStorage.setItem('gristApiKey', key);
            setStatusMessage('成功獲取 API Key！');
        } else {
            localStorage.removeItem('gristApiKey');
        }
    }, []);

    // 【主要變更點 4】: 使用新的 useGristLogin Hook
    const { openLoginPopup, fetchKey } = useGristLogin({
        onSuccess: handleApiKeyUpdate,
        onStatusUpdate: setStatusMessage,
    });
    
    const {
        isLoading,
        error: dataError,
        documents,
        tables,
        columns,
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
            setStatusMessage('API Key 已失效或權限不足，請重新登入或手動獲取。');
        }
    });

    // 啟動時自動獲取 API Key
    useEffect(() => {
        // 使用從 Hook 中獲取的 fetchKey 函數
        fetchKey();
    }, [fetchKey]);

    useEffect(() => {
        if (!apiKey && !localStorage.getItem('gristApiKey')) {
            setShowLoginPrompt(true);
        }
    }, [apiKey]);
    
    const hasErrorStatus = statusMessage.includes('失敗') || statusMessage.includes('錯誤') || statusMessage.includes('失效') || dataError;
  
    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h1 style={styles.title}>Grist 數據動態選擇查看器</h1>
                <p style={styles.subtitle}>API 目標: <code>{GRIST_API_BASE_URL}</code></p>
            </div>

            {statusMessage && <p style={styles.statusMessage(hasErrorStatus)}>{hasErrorStatus ? '⚠️ ' : '✅ '}{isLoading ? '處理中... ' : ''}{statusMessage}</p>}
            {dataError && <p style={{...styles.statusMessage(true), marginTop: '15px' }}>⚠️ 錯誤: {dataError}</p>}
            
            {/* 【主要變更點 5】: UI 大幅簡化 */}
            {showLoginPrompt && !apiKey && (
            <div style={{ ...styles.card, textAlign: 'center', backgroundColor: '#fdecea', borderColor: '#dc3545' }}>
                <p style={{ margin: '0 0 15px 0', fontWeight: '500', color: '#dc3545' }}>需要有效的 API Key 才能繼續操作。</p>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                    <button onClick={openLoginPopup} style={{...styles.buttonBase, ...styles.buttonPrimary}}>開啟 Grist 登入</button>
                    <button onClick={() => fetchKey()} style={{...styles.buttonBase, ...styles.buttonSecondary}}>重試獲取 Key</button>
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
                
                {tableData && <Filter onSubmit={handleFilterChange} isLoading={isLoading} />}
            </div>
            )}

            {tableData && columns && (
                <Table data={tableData} columns={columns} />
            )}
        </div>
    );
}

export default GristDynamicSelectorViewer;