import React, { useState, useCallback, useEffect, useRef } from 'react';

// --- Imports (使用 .ts/.tsx 版本) ---
import { useGristLogin } from './hooks/useGristLogin';
import { useGristData } from './hooks/useGristData';
import Filter from './components/Filter';
import { Table } from './components/Table'; 

const GRIST_API_BASE_URL = 'https://tiss-grist.fcuai.tw';

const styles: { [key: string]: React.CSSProperties | ((hasError: boolean) => React.CSSProperties) } = {
  // ... styles object (內容不變) ...
  container: { /* ... */ },
  // ...
};

// --- 為 GristApiKeyManager 定義 Props 和 Ref 的類型 ---
interface ApiKeyManagerProps {
  apiKey: string;
  onApiKeyUpdate: (key: string, autoFetched?: boolean) => void;
  onStatusUpdate: (message: string) => void;
}
interface ApiKeyManagerRef {
  // 暴露出去的方法名稱
  triggerFetchKeyFromProfile: () => Promise<boolean>;
}

const GristApiKeyManager = React.forwardRef<ApiKeyManagerRef, ApiKeyManagerProps>(
  ({ apiKey, onApiKeyUpdate, onStatusUpdate }, ref) => {
    const [localApiKey, setLocalApiKey] = useState<string>(apiKey || '');
    useEffect(() => { setLocalApiKey(apiKey || ''); }, [apiKey]);
    
    const fetchKeyFromProfile = useCallback(async (): Promise<boolean> => {
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

    // --- 【主要修正點】: 將暴露的方法物件的鍵名改為 'triggerFetchKeyFromProfile' ---
    React.useImperativeHandle(ref, () => ({
        triggerFetchKeyFromProfile: fetchKeyFromProfile 
    }), [fetchKeyFromProfile]);

    const handleManualSubmit = () => {
      if (localApiKey.trim()) onApiKeyUpdate(localApiKey.trim(), false);
      else onStatusUpdate('請輸入有效的 API Key');
    };

    return (
      <div style={styles.card as React.CSSProperties}>
        <h4 style={{ marginTop: '0', marginBottom: '15px' }}>API Key 管理</h4>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input type="password" value={localApiKey} onChange={(e) => setLocalApiKey(e.target.value)} placeholder="在此輸入或貼上 Grist API Key" style={styles.inputBase as React.CSSProperties}/>
          <button onClick={handleManualSubmit} style={{...(styles.buttonBase as React.CSSProperties), backgroundColor: '#e9ecef', color: '#333740' }}>手動設定</button>
        </div>
      </div>
    );
});

// 主組件
const GristDynamicSelectorViewer: React.FC = () => {
    const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('gristApiKey') || '');
    const [statusMessage, setStatusMessage] = useState<string>('');
    const [showLoginPrompt, setShowLoginPrompt] = useState<boolean>(false);
    const [selectedDocId, setSelectedDocId] = useState<string>('');
    const [selectedTableId, setSelectedTableId] = useState<string>('');
    
    // 【重要】: 雖然 useGristLogin 很好，但如果您決定保留 GristApiKeyManager，
    // 我們需要一個 Ref 來引用它。
    const apiKeyManagerRef = useRef<ApiKeyManagerRef>(null);

    const handleApiKeyUpdate = useCallback((key: string, autoFetched: boolean = false) => {
        setApiKey(key);
        setShowLoginPrompt(false);
        if (key) {
            localStorage.setItem('gristApiKey', key);
            setStatusMessage(autoFetched ? '成功與 Grist 會話同步！' : 'API Key 已手動設定。');
        } else {
            localStorage.removeItem('gristApiKey');
        }
    }, []);

    // 這裡我們暫時不使用 useGristLogin，而是使用 ref 來手動觸發
    // 如果您想切換回 useGristLogin，只需取消註解下一行，並註解掉 apiKeyManagerRef 的相關邏輯
    // const { openLoginPopup, fetchKey } = useGristLogin(...);
    
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

    useEffect(() => {
        // 在組件掛載時，使用 ref 來觸發自動獲取
        apiKeyManagerRef.current?.triggerFetchKeyFromProfile();
    }, []);

    useEffect(() => {
        if (!apiKey && !localStorage.getItem('gristApiKey')) {
            setShowLoginPrompt(true);
        }
    }, [apiKey]);
    
    const hasErrorStatus = statusMessage.includes('失敗') || statusMessage.includes('錯誤') || statusMessage.includes('失效') || !!dataError;
  
    return (
        <div style={styles.container as React.CSSProperties}>
            <div style={styles.header as React.CSSProperties}>
                <h1 style={styles.title as React.CSSProperties}>Grist 數據動態選擇查看器</h1>
                <p style={styles.subtitle as React.CSSProperties}>API 目標: <code>{GRIST_API_BASE_URL}</code></p>
            </div>

            {statusMessage && <p style={(styles.statusMessage as (hasError: boolean) => React.CSSProperties)(hasErrorStatus)}>{hasErrorStatus ? '⚠️ ' : '✅ '}{isLoading ? '處理中... ' : ''}{statusMessage}</p>}
            {dataError && <p style={{...(styles.statusMessage as (hasError: boolean) => React.CSSProperties)(true), marginTop: '15px' }}>⚠️ 錯誤: {dataError}</p>}
            
            {/* GristApiKeyManager 現在被保留了 */}
            <GristApiKeyManager 
                ref={apiKeyManagerRef} 
                apiKey={apiKey} 
                onApiKeyUpdate={handleApiKeyUpdate}
                onStatusUpdate={setStatusMessage}
            />

            {showLoginPrompt && !apiKey && (
            <div style={{ ...(styles.card as React.CSSProperties), textAlign: 'center', backgroundColor: '#fdecea', borderColor: '#dc3545' }}>
                <p style={{ margin: '0 0 15px 0', fontWeight: 500, color: '#dc3545' }}>需要有效的 API Key 才能繼續操作。</p>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                    {/* 這裡我們假設有一個全局的 openLoginPopup 函數或使用 window.open */}
                    <button onClick={() => window.open(`${GRIST_API_BASE_URL}/login`, 'GristLoginPopup', 'width=600,height=700')} style={{...(styles.buttonBase as React.CSSProperties), ...(styles.buttonPrimary as React.CSSProperties)}}>開啟 Grist 登入</button>
                    <button onClick={() => apiKeyManagerRef.current?.triggerFetchKeyFromProfile()} style={{...(styles.buttonBase as React.CSSProperties), ...(styles.buttonSecondary as React.CSSProperties)}}>重試獲取 Key</button>
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