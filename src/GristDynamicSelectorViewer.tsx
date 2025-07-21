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

// 主组件
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
            setStatusMessage('成功获取 API Key！');
        } else {
            localStorage.removeItem('gristApiKey');
        }
    }, []);

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
        pageData,
        totalRecords,
        pagination,
        setPagination,
        sorting,
        setSorting,
        handleFilterChange,
    } = useGristData({
        apiKey,
        selectedDocId,
        selectedTableId,
        onAuthError: () => {
            setApiKey('');
            localStorage.removeItem('gristApiKey');
            setShowLoginPrompt(true);
            setStatusMessage('API Key 已失效或权限不足，请重新登入或手动获取。');
        }
    });

    // 计算总页数
    const pageCount = totalRecords ? Math.ceil(totalRecords / pagination.pageSize) : 0;

    useEffect(() => {
        fetchKey();
    }, [fetchKey]);

    useEffect(() => {
        if (!apiKey && !localStorage.getItem('gristApiKey')) {
            setShowLoginPrompt(true);
        }
    }, [apiKey]);
    
    const hasErrorStatus = !!dataError || ['失败', '错误', '失效'].some(term => statusMessage.includes(term));
  
    return (
        <div style={styles.container as React.CSSProperties}>
            <div style={styles.header as React.CSSProperties}>
                <h1 style={styles.title as React.CSSProperties}>Grist 数据动态选择查看器</h1>
                <p style={styles.subtitle as React.CSSProperties}>API 目标: <code>{GRIST_API_BASE_URL}</code></p>
            </div>

            {statusMessage && <p style={(styles.statusMessage as (hasError: boolean) => React.CSSProperties)(hasErrorStatus)}>{hasErrorStatus ? '⚠️ ' : '✅ '}{isLoading ? '处理中... ' : ''}{statusMessage}</p>}
            {dataError && <p style={{ ...((styles.statusMessage as (hasError: boolean) => React.CSSProperties)(true)), marginTop: '15px' }}>⚠️ 错误: {dataError}</p>}

            {showLoginPrompt && !apiKey && (
                <div style={{ ...(styles.card as React.CSSProperties), textAlign: 'center', backgroundColor: '#fdecea', borderColor: '#dc3545' }}>
                    <p style={{ margin: '0 0 15px 0', fontWeight: 500, color: '#dc3545' }}>需要有效的 API Key 才能继续操作。</p>
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                        <button onClick={openLoginPopup} style={{...(styles.buttonBase as React.CSSProperties), ...(styles.buttonPrimary as React.CSSProperties)}}>开启 Grist 登入</button>
                        <button onClick={fetchKey} style={{...(styles.buttonBase as React.CSSProperties), ...(styles.buttonSecondary as React.CSSProperties)}}>重试获取 Key</button>
                    </div>
                </div>
            )}

            {apiKey && (
            <div style={styles.card as React.CSSProperties}>
                <h3 style={{ marginTop: '0', marginBottom: '20px', borderBottom: '1px solid #dee2e6', paddingBottom: '10px' }}>选择数据源</h3>
                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>选择文档:</label>
                    <select value={selectedDocId} onChange={(e) => { setSelectedDocId(e.target.value); setSelectedTableId(''); }} disabled={isLoading || documents.length === 0} style={styles.inputBase as React.CSSProperties}>
                        <option value="">{isLoading && !documents.length ? '加载中...' : (documents.length === 0 ? '无可用文档' : '-- 请选择 --')}</option>
                        {documents.map((doc) => (<option key={doc.id} value={doc.id}>{doc.displayName}</option>))}
                    </select>
                </div>
                {selectedDocId && (
                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>选择表格:</label>
                    <select value={selectedTableId} onChange={(e) => { setSelectedTableId(e.target.value); }} disabled={isLoading || tables.length === 0} style={styles.inputBase as React.CSSProperties}>
                        <option value="">{isLoading && !tables.length ? '加载中...' : (tables.length === 0 ? '无可用表格' : '-- 请选择 --')}</option>
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
            
            {/* 传递所有必需的 props 给 Table 组件 */}
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
              <p style={{textAlign: 'center', ...(styles.card as React.CSSProperties), marginTop: '20px'}}>找不到符合条件的纪录。</p>
            )}
        </div>
    );
}

export default GristDynamicSelectorViewer;