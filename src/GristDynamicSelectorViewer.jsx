// src/GristDynamicSelectorViewer.jsx
import React, { useState, useCallback, useEffect } from 'react';

// Grist API 的基礎 URL
const GRIST_API_BASE_URL = 'https://grist.tiss.dev';
const TARGET_ORG_DOMAIN = 'fcuai';

// --- CSS Variables (模擬) ---
// 為了方便管理，可以將常用顏色和字體定義在這裡，然後在 style 中引用
// 但在 JSX 的 style prop 中不能直接用 CSS 變數, 這裡僅作概念展示
// 實際應用中，這些可以放在一個 <style> 標籤或外部 CSS 文件
const theme = {
  textColor: '#333740', // 深灰色文字
  textColorLight: '#555e6d',
  textColorSubtle: '#777f8d',
  backgroundColor: '#ffffff', // 主背景色
  surfaceColor: '#f8f9fa', // 卡片、輸入框等背景
  borderColor: '#dee2e6',
  primaryColor: '#007bff', // 主題色 (例如按鈕)
  primaryColorText: '#ffffff',
  successColor: '#28a745',
  successColorBg: '#e9f7ef',
  errorColor: '#dc3545',
  errorColorBg: '#fdecea',
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif',
  fontSizeBase: '16px',
  fontSizeSmall: '14px',
  lineHeightBase: '1.6',
  borderRadius: '4px',
};

// API Key 管理組件
function GristApiKeyManager({ apiKey, onApiKeyUpdate, onStatusUpdate }) {
  const [localApiKey, setLocalApiKey] = useState(apiKey || '');
  const [isFetching, setIsFetching] = useState(false);

  const fetchKeyFromProfile = useCallback(async () => {
    // ... (邏輯不變) ...
    setIsFetching(true);
    onStatusUpdate('正在從個人資料獲取 API Key...');
    try {
      const response = await fetch(`${GRIST_API_BASE_URL}/api/profile/apiKey`, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Accept': 'text/plain' },
      });
      const responseText = await response.text();
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${responseText || '無法獲取 API Key'}`);
      const fetchedKey = responseText.trim();
      if (!fetchedKey || fetchedKey.includes('<') || fetchedKey.length < 32) {
        throw new Error('獲取到的 API Key 似乎無效。');
      }
      setLocalApiKey(fetchedKey);
      onApiKeyUpdate(fetchedKey);
      onStatusUpdate('API Key 自動獲取成功！');
    } catch (error) {
      console.error("Error fetching API key from profile:", error);
      onStatusUpdate(`自動獲取 API Key 失敗: ${error.message}. 請確保您已登入 Grist 或手動輸入。`);
      onApiKeyUpdate('');
    } finally {
      setIsFetching(false);
    }
  }, [onApiKeyUpdate, onStatusUpdate]);

  const handleManualSubmit = () => {
    // ... (邏輯不變) ...
    const trimmedKey = localApiKey.trim();
    if (trimmedKey) {
      onApiKeyUpdate(trimmedKey);
      onStatusUpdate('手動輸入的 API Key 已設定。');
    } else {
      onStatusUpdate('請輸入有效的 API Key。');
    }
  };
  
  useEffect(() => {
    setLocalApiKey(apiKey || '');
  }, [apiKey]);

  return (
    <div style={{
      marginBottom: '20px', // 增加下方間距
      padding: '15px', // 增加內邊距
      border: `1px dashed ${theme.borderColor}`, // 使用主題邊框色
      borderRadius: theme.borderRadius, // 統一圓角
      backgroundColor: theme.surfaceColor, // 輕微背景色以區分
    }}>
      <h4 style={{ marginTop: '0', marginBottom: '10px', color: theme.textColor }}>API Key 管理</h4>
      <p style={{ fontSize: theme.fontSizeSmall, color: theme.textColorSubtle, marginBottom: '15px' }}>
        若要啟用 "自動獲取"，請先登入您的 Grist 實例 (<code>{GRIST_API_BASE_URL}</code>)。
        或從 Grist 個人資料頁面手動複製 API Key。
      </p>
      <input
        type="password"
        value={localApiKey}
        onChange={(e) => setLocalApiKey(e.target.value)}
        placeholder="在此輸入或貼上 Grist API Key"
        style={{
          width: 'calc(100% - 250px)', // 調整寬度以適應按鈕
          marginRight: '10px',
          padding: '10px', // 增加輸入框內邊距
          fontSize: theme.fontSizeBase,
          border: `1px solid ${theme.borderColor}`,
          borderRadius: theme.borderRadius,
          boxSizing: 'border-box',
          color: theme.textColor,
        }}
      />
      <button onClick={handleManualSubmit} style={{
        padding: '10px 15px',
        marginRight: '5px',
        fontSize: theme.fontSizeBase,
        backgroundColor: '#e9ecef', // 按鈕背景色
        color: theme.textColor,
        border: `1px solid ${theme.borderColor}`,
        borderRadius: theme.borderRadius,
        cursor: 'pointer',
      }}>
        設定手動 Key
      </button>
      <button onClick={fetchKeyFromProfile} disabled={isFetching} style={{
        padding: '10px 15px',
        fontSize: theme.fontSizeBase,
        backgroundColor: isFetching ? '#6c757d' : theme.primaryColor, // 禁用時不同顏色
        color: theme.primaryColorText,
        border: 'none',
        borderRadius: theme.borderRadius,
        cursor: isFetching ? 'default' : 'pointer',
        opacity: isFetching ? 0.7 : 1,
      }}>
        {isFetching ? '正在獲取...' : '自動獲取 API Key'}
      </button>
    </div>
  );
}


function GristDynamicSelectorViewer() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gristApiKey') || '');
  const [statusMessage, setStatusMessage] = useState('');
  const [currentOrgId, setCurrentOrgId] = useState(null);

  const [documents, setDocuments] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState('');
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);

  const [tables, setTables] = useState([]);
  const [selectedTableId, setSelectedTableId] = useState('');
  const [isLoadingTables, setIsLoadingTables] = useState(false);

  const [filterQuery, setFilterQuery] = useState('');
  const [sortQuery, setSortQuery] = useState('');

  const [tableData, setTableData] = useState(null);
  const [columns, setColumns] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [dataError, setDataError] = useState('');

  // ... (所有 JS 邏輯函數 handleApiKeyUpdate, makeGristApiRequest, useEffects for data fetching, handleFetchTableData 保持不變) ...
  // 這裡只展示 JSX 和 style 的修改
  // 省略 JS 邏輯函數的重複程式碼...
  const handleApiKeyUpdate = useCallback((key) => {
    setApiKey(key);
    if (key) {
      localStorage.setItem('gristApiKey', key);
      setStatusMessage('API Key 已更新。正在準備獲取組織信息...');
    } else {
      localStorage.removeItem('gristApiKey');
      setStatusMessage('API Key 已清除。');
    }
    setCurrentOrgId(null);
    setDocuments([]);
    setSelectedDocId('');
    setTables([]);
    setSelectedTableId('');
    setTableData(null);
    setFilterQuery('');
    setSortQuery('');
    setDataError('');
  }, []);

  const makeGristApiRequest = useCallback(async (endpoint, method = 'GET', params = null) => {
    if (!apiKey) {
      throw new Error('API Key 未設定。');
    }
    let url = `${GRIST_API_BASE_URL}${endpoint}`;
    const queryParams = new URLSearchParams();
    if (params) {
      for (const key in params) {
        if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
           queryParams.append(key, params[key]);
        }
      }
    }
    if (queryParams.toString()){
        url += `?${queryParams.toString()}`;
    }

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
        'Content-Type': method !== 'GET' ? 'application/json' : undefined,
      },
    });

    const responseData = await response.json().catch(() => {
      return response.text().then(text => {
        throw new Error(`HTTP error ${response.status}: ${text || response.statusText}`);
      });
    });

    if (!response.ok) {
      const errorMsg = responseData?.error?.message || responseData?.error || responseData?.message || `HTTP error ${response.status}`;
      console.error(`Grist API Error for ${method} ${url}:`, responseData);
      throw new Error(errorMsg);
    }
    return responseData;
  }, [apiKey]);

  useEffect(() => {
    if (!apiKey) {
      setCurrentOrgId(null);
      setDocuments([]); 
      return;
    }
    const getOrgIdAndFetchDocs = async () => {
      setIsLoadingDocs(true); 
      setStatusMessage('正在獲取組織資訊...');
      try {
        const orgsData = await makeGristApiRequest('/api/orgs');
        let determinedOrgId = null;
        if (orgsData && Array.isArray(orgsData) && orgsData.length > 0) {
          if (TARGET_ORG_DOMAIN) {
            const targetOrg = orgsData.find(org => org.domain === TARGET_ORG_DOMAIN);
            if (targetOrg) {
              determinedOrgId = targetOrg.id;
              setStatusMessage(`已找到目標組織 "${TARGET_ORG_DOMAIN}" (ID: ${determinedOrgId})。正在獲取文檔...`);
            } else {
              determinedOrgId = orgsData[0].id; 
              setStatusMessage(`未找到域名為 "${TARGET_ORG_DOMAIN}" 的組織，將使用第一個組織 (ID: ${determinedOrgId})。正在獲取文檔...`);
            }
          } else {
            determinedOrgId = orgsData[0].id; 
            setStatusMessage(`將使用第一個可用組織 (ID: ${determinedOrgId})。正在獲取文檔...`);
          }
        } else if (orgsData && orgsData.id) { 
            determinedOrgId = orgsData.id;
            setStatusMessage(`已獲取組織 (ID: ${determinedOrgId})。正在獲取文檔...`);
        }
        if (determinedOrgId) {
          setCurrentOrgId(determinedOrgId);
        } else {
          throw new Error('未能獲取到有效的組織 ID。');
        }
      } catch (error) {
        console.error('獲取組織 ID 失敗:', error);
        setStatusMessage(`獲取組織 ID 失敗: ${error.message}`);
        setCurrentOrgId(null);
        setDocuments([]);
        setIsLoadingDocs(false);
      }
    };
    getOrgIdAndFetchDocs();
  }, [apiKey, makeGristApiRequest]);

  useEffect(() => {
    if (!apiKey || !currentOrgId) {
      setDocuments([]);
      return;
    }
    const fetchDocsFromWorkspaces = async () => {
      try {
        const workspacesData = await makeGristApiRequest(`/api/orgs/${currentOrgId}/workspaces`);
        const allDocs = [];
        let docNameCounts = {}; 
        workspacesData.forEach(workspace => {
          if (workspace.docs && Array.isArray(workspace.docs)) {
            workspace.docs.forEach(doc => {
              docNameCounts[doc.name] = (docNameCounts[doc.name] || 0) + 1;
              allDocs.push({
                id: doc.id,
                name: doc.name, 
                workspaceName: workspace.name, 
                workspaceId: workspace.id,
              });
            });
          }
        });
        const processedDocs = allDocs.map(doc => {
            if (docNameCounts[doc.name] > 1) {
                return {...doc, displayName: `${doc.name} (${doc.workspaceName})`};
            }
            return {...doc, displayName: doc.name};
        });
        if (processedDocs.length > 0) {
          setDocuments(processedDocs);
          setStatusMessage('文檔列表獲取成功。請選擇一個文檔。');
        } else {
          setDocuments([]);
          setStatusMessage(`在組織 ID ${currentOrgId} 下未找到任何文檔。`);
        }
      } catch (error) {
        console.error(`獲取組織 ${currentOrgId} 的文檔列表失敗:`, error);
        setStatusMessage(`獲取文檔列表失敗: ${error.message}`);
        setDocuments([]);
      } finally {
        setIsLoadingDocs(false); 
      }
    };
    fetchDocsFromWorkspaces();
  }, [apiKey, currentOrgId, makeGristApiRequest]);

  useEffect(() => {
    if (!apiKey || !selectedDocId) {
      setTables([]);
      setSelectedTableId('');
      return;
    }
    const fetchTables = async () => {
      setIsLoadingTables(true);
      setStatusMessage(`正在獲取文檔 "${selectedDocId}" 的表格列表...`);
      setDataError('');
      try {
        const data = await makeGristApiRequest(`/api/docs/${selectedDocId}/tables`);
        const tableList = data.tables || (Array.isArray(data) ? data : []);
        if (Array.isArray(tableList)) {
          setTables(tableList.map(table => ({
            id: table.id,
            name: table.id
          })));
          setStatusMessage(tableList.length > 0 ? '表格列表獲取成功。' : '該文檔中未找到表格。');
        } else {
          throw new Error('表格列表格式不正確。');
        }
      } catch (error) {
        console.error('獲取表格列表失敗:', error);
        setStatusMessage(`獲取表格列表失敗: ${error.message}`);
        setTables([]);
      } finally {
        setIsLoadingTables(false);
      }
    };
    fetchTables();
  }, [apiKey, selectedDocId, makeGristApiRequest]);

  const handleFetchTableData = useCallback(async () => {
    if (!apiKey || !selectedDocId || !selectedTableId) {
      setDataError('請先設定 API Key 並選擇文檔和表格。');
      return;
    }
    setIsLoadingData(true);
    setDataError('');
    setTableData(null);
    setColumns([]);
    setStatusMessage(`正在獲取 ${selectedTableId} 的數據...`);
    const params = { limit: '50' };
    if (filterQuery) {
      try {
        JSON.parse(filterQuery);
        params.filter = filterQuery;
      } catch (e) {
        setDataError('過濾條件不是有效的 JSON 格式。');
        setStatusMessage('過濾條件格式錯誤。');
        setIsLoadingData(false);
        return;
      }
    }
    if (sortQuery.trim()) {
      params.sort = sortQuery.trim();
    }
    try {
      const data = await makeGristApiRequest(
        `/api/docs/${selectedDocId}/tables/${selectedTableId}/records`,
        'GET',
        params
      );
      if (data && data.records) {
        setTableData(data.records);
        if (data.records.length > 0) {
          const allCols = new Set();
          data.records.forEach(rec => {
            if (rec.fields) Object.keys(rec.fields).forEach(key => allCols.add(key));
          });
          setColumns(Array.from(allCols));
          setStatusMessage(`成功獲取 ${data.records.length} 條數據。`);
        } else {
          setColumns([]);
          setStatusMessage('數據獲取成功，但結果為空。');
        }
      } else {
        throw new Error('數據格式不正確，缺少 "records" 屬性。');
      }
    } catch (error) {
      console.error('獲取表格數據失敗:', error);
      setDataError(`獲取數據失敗: ${error.message}`);
      setStatusMessage(`獲取數據失敗: ${error.message}`);
      setTableData([]);
    } finally {
      setIsLoadingData(false);
    }
  }, [apiKey, selectedDocId, selectedTableId, makeGristApiRequest, filterQuery, sortQuery]);


  return (
    <div style={{
      padding: '25px', // 增加整體 padding
      fontFamily: theme.fontFamily,
      fontSize: theme.fontSizeBase,
      lineHeight: theme.lineHeightBase,
      color: theme.textColor,
      backgroundColor: theme.backgroundColor,
      maxWidth: '1000px',
      margin: '20px auto', // 上下增加 margin
      boxShadow: '0 4px 12px rgba(0,0,0,0.08)', // 添加細微陰影
      borderRadius: '8px', // 容器圓角
    }}>
      <h1 style={{
        color: theme.textColor,
        textAlign: 'center', // 標題居中
        marginBottom: '15px', // 標題下方間距
        fontSize: '28px', // 增大標題字號
      }}>
        Grist 數據動態選擇查看器
      </h1>
      <p style={{ textAlign: 'center', color: theme.textColorSubtle, fontSize: theme.fontSizeSmall, marginBottom: '25px' }}>
        API 目標: <code>{GRIST_API_BASE_URL}</code> (目標組織域名: <code>{TARGET_ORG_DOMAIN || '未指定'}</code>)
      </p>

      {statusMessage && (
        <p style={{
          padding: '12px 15px', // 調整 padding
          backgroundColor: statusMessage.includes('失敗') || statusMessage.includes('錯誤') ? theme.errorColorBg : theme.successColorBg,
          border: `1px solid ${statusMessage.includes('失敗') || statusMessage.includes('錯誤') ? theme.errorColor : theme.successColor}`,
          color: statusMessage.includes('失敗') || statusMessage.includes('錯誤') ? theme.errorColor : theme.successColor,
          marginTop: '10px',
          marginBottom: '20px', // 增加下方間距
          borderRadius: theme.borderRadius,
          fontSize: theme.fontSizeSmall, // 狀態消息字體稍小
          textAlign: 'center',
        }}>
          {statusMessage}
        </p>
      )}

      <GristApiKeyManager apiKey={apiKey} onApiKeyUpdate={handleApiKeyUpdate} onStatusUpdate={setStatusMessage} />

      {apiKey && (
        <div style={{
          marginTop: '25px',
          padding: '20px', // 增加內邊距
          border: `1px solid ${theme.borderColor}`,
          borderRadius: theme.borderRadius,
          backgroundColor: theme.surfaceColor, // 數據源選擇區域背景色
        }}>
          <h3 style={{ marginTop: '0', marginBottom: '20px', color: theme.textColor, borderBottom: `1px solid ${theme.borderColor}`, paddingBottom: '10px' }}>
            選擇數據源
          </h3>
          <div style={{ marginBottom: '15px' }}> {/* 間距調整 */}
            <label htmlFor="docSelect" style={{ display: 'block', marginBottom: '8px', color: theme.textColorLight, fontSize: theme.fontSizeSmall, fontWeight: '500' }}>
              選擇文檔:
            </label>
            <select
              id="docSelect"
              value={selectedDocId}
              onChange={(e) => { /* ... (邏輯不變) ... */
                setSelectedDocId(e.target.value);
                setSelectedTableId('');
                setTableData(null);
                setFilterQuery('');
                setSortQuery('');
                setDataError('');
              }}
              disabled={isLoadingDocs || documents.length === 0}
              style={{
                width: '100%',
                padding: '10px', // 增加 padding
                fontSize: theme.fontSizeBase,
                border: `1px solid ${theme.borderColor}`,
                borderRadius: theme.borderRadius,
                boxSizing: 'border-box',
                backgroundColor: '#fff', // 下拉選單背景
                color: theme.textColor,
              }}
            >
              <option value="">{isLoadingDocs ? '正在加載文檔...' : (documents.length === 0 && apiKey && currentOrgId ? '當前組織下未找到文檔' : (apiKey ? '-- 請選擇文檔 --' : '請先設定 API Key'))}</option>
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.displayName}
                </option>
              ))}
            </select>
            {selectedDocId && documents.find(d => d.id === selectedDocId) &&
                <small style={{display: 'block', marginTop: '5px', color: theme.textColorSubtle, fontSize: '13px' }}>
                    ID: {selectedDocId}, 所屬工作區: {documents.find(d => d.id === selectedDocId)?.workspaceName || 'N/A'}
                </small>
            }
          </div>

          {selectedDocId && (
            <div style={{ marginBottom: '15px' }}> {/* 間距調整 */}
              <label htmlFor="tableSelect" style={{ display: 'block', marginBottom: '8px', color: theme.textColorLight, fontSize: theme.fontSizeSmall, fontWeight: '500' }}>
                選擇表格:
              </label>
              <select
                id="tableSelect"
                value={selectedTableId}
                onChange={(e) => { /* ... (邏輯不變) ... */
                    setSelectedTableId(e.target.value);
                    setTableData(null); 
                    setFilterQuery('');
                    setSortQuery('');
                    setDataError('');
                }}
                disabled={isLoadingTables || tables.length === 0}
                style={{
                  width: '100%',
                  padding: '10px',
                  fontSize: theme.fontSizeBase,
                  border: `1px solid ${theme.borderColor}`,
                  borderRadius: theme.borderRadius,
                  boxSizing: 'border-box',
                  backgroundColor: '#fff',
                  color: theme.textColor,
                }}
              >
                <option value="">{isLoadingTables ? '正在加載表格...' : (tables.length === 0 && selectedDocId ? '未找到表格或無權限' : '-- 請選擇表格 --')}</option>
                {tables.map((table) => (
                  <option key={table.id} value={table.id}>
                    {table.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedDocId && selectedTableId && (
            <div style={{
              border: `1px solid ${theme.borderColor}`, // 使用主題邊框色
              padding: '20px',
              marginTop: '20px',
              borderRadius: theme.borderRadius,
              backgroundColor: '#fff', // 數據獲取選項區域用白色背景
            }}>
              <h4 style={{ marginTop: '0', marginBottom: '15px', color: theme.textColor, fontSize: '18px' }}>數據獲取選項</h4>
              <div style={{ marginBottom: '15px' }}> {/* 間距調整 */}
                <label htmlFor="filterInput" style={{ display: 'block', marginBottom: '5px', color: theme.textColorLight, fontSize: theme.fontSizeSmall }}>過濾條件 (JSON):</label>
                <input id="filterInput" type="text" value={filterQuery} onChange={(e) => setFilterQuery(e.target.value)} placeholder='{"ColumnID": "Value"}' style={{ width: '100%', padding: '10px', fontSize: theme.fontSizeBase, border: `1px solid ${theme.borderColor}`, borderRadius: theme.borderRadius, boxSizing: 'border-box', color: theme.textColor }}/>
                <small style={{ display: 'block', marginTop: '5px', color: theme.textColorSubtle, fontSize: '13px' }}>參考 Grist API "Filtering records"。欄位 ID 區分大小寫。</small>
              </div>
              <div style={{ marginBottom: '20px' }}> {/* 間距調整 */}
                <label htmlFor="sortInput" style={{ display: 'block', marginBottom: '5px', color: theme.textColorLight, fontSize: theme.fontSizeSmall }}>排序條件:</label>
                <input id="sortInput" type="text" value={sortQuery} onChange={(e) => setSortQuery(e.target.value)} placeholder='ColumnID, -AnotherColumnID' style={{ width: '100%', padding: '10px', fontSize: theme.fontSizeBase, border: `1px solid ${theme.borderColor}`, borderRadius: theme.borderRadius, boxSizing: 'border-box', color: theme.textColor }}/>
                <small style={{ display: 'block', marginTop: '5px', color: theme.textColorSubtle, fontSize: '13px' }}>參考 "Sorting records"。前綴 "-" 表示降序。</small>
              </div>
              <button onClick={handleFetchTableData} disabled={isLoadingData} style={{
                padding: '12px 20px', // 增大按鈕 padding
                marginTop: '10px',
                width: '100%',
                boxSizing: 'border-box',
                backgroundColor: isLoadingData ? '#6c757d' : theme.primaryColor,
                color: theme.primaryColorText,
                border: 'none',
                borderRadius: theme.borderRadius,
                cursor: isLoadingData ? 'default' : 'pointer',
                fontSize: '16px', // 增大按鈕字號
                fontWeight: '500',
                opacity: isLoadingData ? 0.7 : 1,
              }}>
                {isLoadingData ? '正在加載數據...' : `獲取 "${selectedTableId}" 的數據`}
              </button>
            </div>
          )}
          {dataError && <p style={{
            color: theme.errorColor, // 錯誤文字顏色
            marginTop: '15px',
            whiteSpace: 'pre-wrap',
            padding: '12px 15px',
            backgroundColor: theme.errorColorBg, // 錯誤背景
            border: `1px solid ${theme.errorColor}`, // 錯誤邊框
            borderRadius: theme.borderRadius,
            fontSize: theme.fontSizeSmall,
          }}>錯誤：{dataError}</p>}
        </div>
      )}

      {tableData && tableData.length > 0 && columns.length > 0 && (
        <div style={{ marginTop: '30px', overflowX: 'auto' }}> {/* 增加上方間距 */}
          <h3 style={{ marginBottom: '15px', color: theme.textColor }}>數據結果: (前 {Math.min(tableData.length, 50)} 條)</h3>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse', // 改為 collapse 以獲得更現代的表格外觀
            minWidth: '600px',
            fontSize: theme.fontSizeSmall, // 表格文字稍小
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)', // 表格細微陰影
            borderRadius: theme.borderRadius, // 表格圓角 (外層div)
            overflow: 'hidden', // 配合 borderRadius
          }}>
            <thead>
              <tr>
                <th style={{backgroundColor: '#e9ecef', padding: '12px 10px', textAlign: 'left', color: theme.textColor, fontWeight: '600', borderBottom: `2px solid ${theme.borderColor}`, position: 'sticky', left: 0, zIndex: 1}}>id</th>
                {columns.map((col) => (<th key={col} style={{backgroundColor: '#e9ecef', padding: '12px 10px', textAlign: 'left', color: theme.textColor, fontWeight: '600', borderBottom: `2px solid ${theme.borderColor}`}}>{col}</th>))}
              </tr>
            </thead>
            <tbody>
              {tableData.map((record, rowIndex) => (
                <tr key={record.id} style={{ backgroundColor: rowIndex % 2 === 0 ? '#fff' : theme.surfaceColor /* 斑馬紋 */, borderBottom: `1px solid ${theme.borderColor}` }}>
                  <td style={{ padding: '10px', whiteSpace: 'nowrap', color: theme.textColorLight, position: 'sticky', left: 0, backgroundColor: rowIndex % 2 === 0 ? '#fff' : theme.surfaceColor, zIndex: 1, borderRight: `1px solid ${theme.borderColor}` }}>{record.id}</td>
                  {columns.map((col) => (
                    <td key={`${record.id}-${col}`} style={{ padding: '10px', whiteSpace: 'nowrap', color: theme.textColorLight }}>
                      {record.fields && record.fields[col] !== undefined && record.fields[col] !== null
                        ? (typeof record.fields[col] === 'object' ? JSON.stringify(record.fields[col]) : String(record.fields[col]))
                        : ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {apiKey && selectedDocId && selectedTableId && tableData && tableData.length === 0 && !isLoadingData && !dataError && (
        <p style={{
          marginTop: '15px',
          padding: '12px 15px',
          backgroundColor: '#fff3cd', // 警告類背景色
          border: '1px solid #ffeeba',
          color: '#856404', // 警告類文字顏色
          borderRadius: theme.borderRadius,
          fontSize: theme.fontSizeSmall,
          textAlign: 'center',
        }}>
            {filterQuery || sortQuery ? '沒有符合目前過濾/排序條件的數據，或表格本身為空。' : '該表格目前沒有數據。'}
        </p>
      )}
    </div>
  );
}

export default GristDynamicSelectorViewer;