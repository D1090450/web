import React, { useState, useCallback, useEffect } from 'react';

// --- Imports ---
import { useGristLogin } from './hooks/useGristLogin';
import { useGristData } from './hooks/useGristData';
import Filter from './components/Filter';
import { Table } from './components/Table'; 

const GRIST_API_BASE_URL = 'https://tiss-grist.fcuai.tw';

const styles: { [key: string]: React.CSSProperties | ((hasError: boolean) => React.CSSProperties) } = {
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
  title: { fontSize: '28px', fontWeight: 600, color: '#333740', marginBottom: '10px' },
  subtitle: { color: '#777f8d', fontSize: '14px' },
  statusMessage: (hasError: boolean) => ({
    padding: '12px 18px', margin: '20px 0', borderRadius: '6px',
    textAlign: 'center', fontSize: '14px', fontWeight: 500,
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
    padding: '12px 20px', fontSize: '16px', fontWeight: 500,
    border: 'none', borderRadius: '6px', cursor: 'pointer',
    transition: 'background-color 0.2s, transform 0.1s',
  },
  buttonPrimary: { backgroundColor: '#007bff', color: '#ffffff' },
  buttonSecondary: { backgroundColor: '#6c757d', color: '#ffffff' },
};

// 主組件
const GristDynamicSelectorViewer: React.FC = () => {
    const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('gristApiKey') || '');
    const [statusMessage, setStatusMessage] = useState<string>('');
    const [showLoginPrompt, setShowLoginPrompt] = useState<boolean>(false);
    const [selectedDocId, setSelectedDocId] = useState<string>('');
    const [selectedTableId, setSelectedTableId] = useState<string>('');
    
    const handleApiKeyUpdate = useCallback((key: string) => {
        setApiKey(key);
        setShowLoginPrompt(false);
        if (key) {
            localStorage.setItem('gristApiKey', key);
            setStatusMessage('成功獲取 API Key！');
        } else {
            localStorage.removeItem('gristApiKey');
        }
    }, []);

    const { openLoginPopup, fetchKey } = useGristLogin({
        onSuccess: handleApiKeyUpdate,
        onStatusUpdate: setStatusMessage,
    });
    
    // 從 useGristData Hook 獲取所有需要的狀態和函數
    const {
        isLoading,
        error: dataError,
        documents,
        tables,
        columns,
        pageData,
        totalRecords, // 新增
        pagination,   // 新增
        setPagination,// 新增
        sorting,      // 新增
        setSorting,   // 新增
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

    // 計算總頁數
    const pageCount = totalRecords ? Math.ceil(totalRecords / pagination.pageSize) : 0;

    useEffect(() => {
        fetchKey();
    }, [fetchKey]);

    useEffect(() => {
        if (!apiKey && !localStorage.getItem('gristApiKey')) {
            setShowLoginPrompt(true);
        }
    }, [apiKey]);
    
    const hasErrorStatus = !!dataError || ['失敗', '錯誤', '失效'].some(term => statusMessage.includes(term));
  
    return (
        <div style={styles.container as React.CSSProperties}>
            <div style={styles.header as React.CSSProperties}>
                <h1 style={styles.title as React.CSSProperties}>Grist 數據動態選擇查看器</h1>
                <p style={styles.subtitle as React.CSSProperties}>API 目標: <code>{GRIST_API_BASE_URL}</code></p>
            </div>

            {statusMessage && <p style={(styles.statusMessage as (hasError: boolean) => React.CSSProperties)(hasErrorStatus)}>{hasErrorStatus ? '⚠️ ' : '✅ '}{isLoading ? '處理中... ' : ''}{statusMessage}</p>}
            {dataError && <p style={{ ...((styles.statusMessage as (hasError: boolean) => React.CSSProperties)(true)), marginTop: '15px' }}>⚠️ 錯誤: {dataError}</p>}

            {showLoginPrompt && !apiKey && (
                <div style={{ ...(styles.card as React.CSSProperties), textAlign: 'center', backgroundColor: '#fdecea', borderColor: '#dc3545' }}>
                    <p style={{ margin: '0 0 15px 0', fontWeight: 500, color: '#dc3545' }}>需要有效的 API Key 才能繼續操作。</p>
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                        <button onClick={openLoginPopup} style={{...(styles.buttonBase as React.CSSProperties), ...(styles.buttonPrimary as React.CSSProperties)}}>開啟 Grist 登入</button>
                        <button onClick={fetchKey} style={{...(styles.buttonBase as React.CSSProperties), ...(styles.buttonSecondary as React.CSSProperties)}}>重試獲取 Key</button>
                    </div>
                </div>
            )}

            {apiKey && (
            <div style={styles.card as React.CSSProperties}>
                <h3 style={{ marginTop: '0', marginBottom: '20px', borderBottom: '1px solid #dee2e6', paddingBottom: '10px' }}>選擇數據源</h3>
                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>選擇文檔:</label>
                    <select value={selectedDocId} onChange={(e) => { setSelectedDocId(e.target.value); setSelectedTableId(''); }} disabled={isLoading || documents.length === 0} style={styles.inputBase as React.CSSProperties}>
                        <option value="">{isLoading && !documents.length ? '加載中...' : (documents.length === 0 ? '無可用文檔' : '-- 請選擇 --')}</option>
                        {documents.map((doc) => (<option key={doc.id} value={doc.id}>{doc.displayName}</option>))}
                    </select>
                </div>
                {selectedDocId && (
                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>選擇表格:</label>
                    <select value={selectedTableId} onChange={(e) => { setSelectedTableId(e.target.value); }} disabled={isLoading || tables.length === 0} style={styles.inputBase as React.CSSProperties}>
                        <option value="">{isLoading && !tables.length ? '加載中...' : (tables.length === 0 ? '無可用表格' : '-- 請選擇 --')}</option>
                        {tables.map((table) => (
                            <option key={table.id} value={table.id}>
                                {table.id}
                            </option>
                        ))}
                    </select>
                </div>
                )}
                
                {selectedTableId && <Filter onSubmit={handleFilterChange} isLoading={isLoading} />}
            </div>
            )}
            
            {/* --- 【主要修正點】: 將所有必需的 props 傳遞給 Table 組件 --- */}
            {selectedTableId && !dataError && columns.length > 0 && (
                <Table 
                  data={pageData ?? []}
                  columns={columns}
                  pageCount={pageCount}
                  pagination={pagination}
                  setPagination={setPagination}
                  sorting={sorting}
                  setSorting={setSorting}
                />
            )}
            
            {pageData && pageData.length === 0 && !isLoading && !dataError && (
              <p style={{textAlign: 'center', ...(styles.card as React.CSSProperties), marginTop: '20px'}}>找不到符合條件的記錄。</p>
            )}
        </div>
    );
}

export default GristDynamicSelectorViewer;