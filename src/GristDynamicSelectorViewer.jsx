// src/GristDynamicSelectorViewer.jsx
import React, { useState, useCallback, useEffect, useRef } from 'react'; // 新增 useRef

// Grist API 的基礎 URL
const GRIST_API_BASE_URL = 'https://tiss-grist.fcuai.tw';
const TARGET_ORG_DOMAIN = 'fcuai.tw';

const theme = {
  // ... (theme object remains the same) ...
  textColor: '#333740', 
  textColorLight: '#555e6d',
  textColorSubtle: '#777f8d',
  backgroundColor: '#ffffff', 
  surfaceColor: '#f8f9fa', 
  borderColor: '#dee2e6',
  primaryColor: '#007bff', 
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
// 我們將 fetchKeyFromProfile 暴露給父組件，以便父組件可以觸發它
const GristApiKeyManager = React.forwardRef(({ apiKey, onApiKeyUpdate, onStatusUpdate }, ref) => {
  const [localApiKey, setLocalApiKey] = useState(apiKey || '');
  const [isFetching, setIsFetching] = useState(false);

  const fetchKeyFromProfile = useCallback(async () => {
    setIsFetching(true);
    onStatusUpdate('正在從個人資料獲取 API Key...');
    try {
      const response = await fetch(`${GRIST_API_BASE_URL}/api/profile/apiKey`, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Accept': 'text/plain' },
      });
      const responseText = await response.text();
      console.log('response from /api/profile/apiKey: ', responseText); // 保留你的 console.log
      if (!response.ok) {
        // 如果 HTTP 狀態碼表示未授權或錯誤，明確地讓 onApiKeyUpdate('') 被調用
        onApiKeyUpdate(''); // 確保父組件知道獲取失敗
        throw new Error(`HTTP ${response.status}: ${responseText || '無法獲取 API Key'}`);
      }
      const fetchedKey = responseText.trim();
      if (!fetchedKey || fetchedKey.includes('<') || fetchedKey.length < 32) {
        onApiKeyUpdate(''); // 確保父組件知道獲取失敗
        throw new Error('獲取到的 API Key 似乎無效。');
      }
      setLocalApiKey(fetchedKey);
      onApiKeyUpdate(fetchedKey); // 成功，傳遞 key
      onStatusUpdate('API Key 自動獲取成功！');
    } catch (error) {
      console.error("Error fetching API key from profile:", error);
      onStatusUpdate(`自動獲取 API Key 失敗: ${error.message}. 請確保您已登入 Grist 或手動輸入。`);
      onApiKeyUpdate(''); // 確保父組件知道獲取失敗
    } finally {
      setIsFetching(false);
    }
  }, [onApiKeyUpdate, onStatusUpdate]);

  const handleManualSubmit = () => {
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

  // 使用 useImperativeHandle 將 fetchKeyFromProfile 暴露給父組件
  React.useImperativeHandle(ref, () => ({
    triggerFetchKeyFromProfile: fetchKeyFromProfile
  }));

  return (
    <div style={{ /* ... (styles remain the same) ... */
      marginBottom: '20px', 
      padding: '15px', 
      border: `1px dashed ${theme.borderColor}`, 
      borderRadius: theme.borderRadius, 
      backgroundColor: theme.surfaceColor, 
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
          width: 'calc(100% - 250px)', 
          marginRight: '10px',
          padding: '10px', 
          fontSize: theme.fontSizeBase,
          border: `1px solid ${theme.borderColor}`,
          borderRadius: theme.borderRadius,
          boxSizing: 'border-box',
          color: theme.textColor,
        }}
      />
      <button onClick={handleManualSubmit} style={{ /* ... */ 
        padding: '10px 15px',
        marginRight: '5px',
        fontSize: theme.fontSizeBase,
        backgroundColor: '#e9ecef', 
        color: theme.textColor,
        border: `1px solid ${theme.borderColor}`,
        borderRadius: theme.borderRadius,
        cursor: 'pointer',
      }}>
        設定手動 Key
      </button>
      <button onClick={fetchKeyFromProfile} disabled={isFetching} style={{ /* ... */ 
        padding: '10px 15px',
        fontSize: theme.fontSizeBase,
        backgroundColor: isFetching ? '#6c757d' : theme.primaryColor, 
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
});


function GristDynamicSelectorViewer() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gristApiKey') || '');
  const [statusMessage, setStatusMessage] = useState('');
  const [currentOrgId, setCurrentOrgId] = useState(null);

  const [documents, setDocuments] = useState([]);
  // ... (other states remain the same) ...
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


  // 新增 state 控制登入提示的顯示
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const apiKeyManagerRef = useRef(null); // Ref for GristApiKeyManager

  const handleApiKeyUpdate = useCallback((key) => {
    setApiKey(key);
    if (key) {
      localStorage.setItem('gristApiKey', key);
      // setStatusMessage('API Key 已更新。正在準備獲取組織信息...'); // 這個訊息可能被 GristApiKeyManager 的成功訊息覆蓋
      setShowLoginPrompt(false); // 如果成功獲取到 key，隱藏登入提示
    } else {
      localStorage.removeItem('gristApiKey');
      // setStatusMessage('API Key 獲取失敗。'); // 這個訊息也可能被 GristApiKeyManager 的失敗訊息覆蓋
      setShowLoginPrompt(true); // 如果 key 為空 (獲取失敗或清除)，顯示登入提示
    }
    // 清理相關狀態 (保持不變)
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

  // ... (makeGristApiRequest and data fetching useEffects remain the same) ...
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
      if (localStorage.getItem('gristApiKey')) { // 如果 localStorage 中還有 key，但 state 中沒有，可能是初始化或清除了
        // 這種情況下，如果 GristApiKeyManager 沒有自動觸發，我們可能需要一個初始的檢查
        // 但通常 GristApiKeyManager 會在 apiKey prop 為空時嘗試獲取或顯示輸入框
      } else {
        // 初始加載時，如果 localStorage 和 state 都沒有 apiKey，也顯示登入提示
        // 但這可能會與 GristApiKeyManager 的“自動獲取”功能競爭，需要小心處理
        // 更好的做法是依賴 GristApiKeyManager 的 onApiKeyUpdate('') 來觸發 setShowLoginPrompt(true)
      }
      return;
    }
    // ... (getOrgIdAndFetchDocs logic remains the same) ...
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
    // ... (fetchDocsFromWorkspaces logic remains the same) ...
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
    // ... (fetchTables logic remains the same) ...
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
    // ... (handleFetchTableData logic remains the same) ...
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


  // 函數：打開 Grist 登入彈出視窗
  const openGristLoginPopup = () => {
    const loginUrl = `${GRIST_API_BASE_URL}/login`; // Grist 登入頁面 URL
    window.open(loginUrl, 'GristLoginPopup', 'width=600,height=700,scrollbars=yes,resizable=yes,noopener,noreferrer');
    setStatusMessage('請在新視窗中完成 Grist 登入後，點擊下方的 "刷新登入狀態" 按鈕。');
  };

  // 函數：嘗試重新獲取 API Key (通過 GristApiKeyManager)
  const handleRetryFetchApiKey = () => {
    if (apiKeyManagerRef.current) {
      setStatusMessage('正在嘗試重新獲取 API Key...');
      apiKeyManagerRef.current.triggerFetchKeyFromProfile();
    } else {
        setStatusMessage('無法觸發 API Key 獲取，請嘗試手動獲取或刷新頁面。');
    }
  };

  // 初始加載時檢查是否需要顯示登入提示
  useEffect(() => {
    if (!localStorage.getItem('gristApiKey') && !apiKey) {
        // 應用剛加載，且 localStorage 和當前 state 都沒有 apiKey
        // 這種情況下，GristApiKeyManager 的 "自動獲取" 會首先嘗試
        // 我們在這裡不立即設置 setShowLoginPrompt(true)，而是等待 GristApiKeyManager 的結果
        // GristApiKeyManager 的 onApiKeyUpdate('') 會觸發 setShowLoginPrompt(true)
    }
  }, [apiKey]); // 依賴 apiKey 即可，因為 handleApiKeyUpdate 會處理 showLoginPrompt


  return (
    <div style={{ /* ... (styles remain the same) ... */ 
      padding: '25px', 
      fontFamily: theme.fontFamily,
      fontSize: theme.fontSizeBase,
      lineHeight: theme.lineHeightBase,
      color: theme.textColor,
      backgroundColor: theme.backgroundColor,
      maxWidth: '1000px',
      margin: '20px auto', 
      boxShadow: '0 4px 12px rgba(0,0,0,0.08)', 
      borderRadius: '8px', 
    }}>
      {/* ... (h1 and p for title and API target remain the same) ... */}
      <h1 style={{
        color: theme.textColor,
        textAlign: 'center', 
        marginBottom: '15px', 
        fontSize: '28px', 
      }}>
        Grist 數據動態選擇查看器
      </h1>
      <p style={{ textAlign: 'center', color: theme.textColorSubtle, fontSize: theme.fontSizeSmall, marginBottom: '25px' }}>
        API 目標: <code>{GRIST_API_BASE_URL}</code> (目標組織域名: <code>{TARGET_ORG_DOMAIN || '未指定'}</code>)
      </p>

      {statusMessage && (
        <p style={{ /* ... (styles remain the same) ... */ 
          padding: '12px 15px', 
          backgroundColor: statusMessage.includes('失敗') || statusMessage.includes('錯誤') || statusMessage.includes('尚未登入') ? theme.errorColorBg : theme.successColorBg,
          border: `1px solid ${statusMessage.includes('失敗') || statusMessage.includes('錯誤') || statusMessage.includes('尚未登入') ? theme.errorColor : theme.successColor}`,
          color: statusMessage.includes('失敗') || statusMessage.includes('錯誤') || statusMessage.includes('尚未登入') ? theme.errorColor : theme.successColor,
          marginTop: '10px',
          marginBottom: '20px', 
          borderRadius: theme.borderRadius,
          fontSize: theme.fontSizeSmall, 
          textAlign: 'center',
        }}>
          {statusMessage}
        </p>
      )}

      {/* 將 ref 傳遞給 GristApiKeyManager */}
      <GristApiKeyManager ref={apiKeyManagerRef} apiKey={apiKey} onApiKeyUpdate={handleApiKeyUpdate} onStatusUpdate={setStatusMessage} />

      {/* 登入提示和按鈕 */}
      {showLoginPrompt && !apiKey && (
        <div style={{
          padding: '20px',
          margin: '20px 0',
          border: `1px solid ${theme.errorColor}`, // 使用錯誤色系邊框
          borderRadius: theme.borderRadius,
          textAlign: 'center',
          backgroundColor: theme.errorColorBg, // 使用錯誤色系背景
        }}>
          <p style={{ color: theme.errorColor, margin: '0 0 15px 0', fontWeight: '500' }}>
            您似乎尚未登入 Grist，或者 API Key 無法自動獲取。
          </p>
          <button
            onClick={openGristLoginPopup}
            style={{
              padding: '10px 15px',
              marginRight: '10px',
              fontSize: theme.fontSizeBase,
              backgroundColor: theme.primaryColor,
              color: theme.primaryColorText,
              border: 'none',
              borderRadius: theme.borderRadius,
              cursor: 'pointer',
            }}
          >
            前往 Grist 登入
          </button>
          <button
            onClick={handleRetryFetchApiKey}
            style={{
              padding: '10px 15px',
              fontSize: theme.fontSizeBase,
              backgroundColor: '#6c757d', // 次要按鈕顏色
              color: theme.primaryColorText,
              border: 'none',
              borderRadius: theme.borderRadius,
              cursor: 'pointer',
            }}
          >
            刷新登入狀態 / 重試自動獲取
          </button>
        </div>
      )}

      {apiKey && (
        <div style={{ /* ... (styles for data source selection remain the same) ... */ 
          marginTop: '25px',
          padding: '20px', 
          border: `1px solid ${theme.borderColor}`,
          borderRadius: theme.borderRadius,
          backgroundColor: theme.surfaceColor, 
        }}>
          {/* ... (h3 and subsequent selects, inputs, buttons for doc, table, data fetching remain the same) ... */}
          <h3 style={{ marginTop: '0', marginBottom: '20px', color: theme.textColor, borderBottom: `1px solid ${theme.borderColor}`, paddingBottom: '10px' }}>
            選擇數據源
          </h3>
          <div style={{ marginBottom: '15px' }}> 
            <label htmlFor="docSelect" style={{ display: 'block', marginBottom: '8px', color: theme.textColorLight, fontSize: theme.fontSizeSmall, fontWeight: '500' }}>
              選擇文檔:
            </label>
            <select
              id="docSelect"
              value={selectedDocId}
              onChange={(e) => { 
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
                padding: '10px', 
                fontSize: theme.fontSizeBase,
                border: `1px solid ${theme.borderColor}`,
                borderRadius: theme.borderRadius,
                boxSizing: 'border-box',
                backgroundColor: '#fff', 
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
            <div style={{ marginBottom: '15px' }}> 
              <label htmlFor="tableSelect" style={{ display: 'block', marginBottom: '8px', color: theme.textColorLight, fontSize: theme.fontSizeSmall, fontWeight: '500' }}>
                選擇表格:
              </label>
              <select
                id="tableSelect"
                value={selectedTableId}
                onChange={(e) => { 
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
              border: `1px solid ${theme.borderColor}`, 
              padding: '20px',
              marginTop: '20px',
              borderRadius: theme.borderRadius,
              backgroundColor: '#fff', 
            }}>
              <h4 style={{ marginTop: '0', marginBottom: '15px', color: theme.textColor, fontSize: '18px' }}>數據獲取選項</h4>
              <div style={{ marginBottom: '15px' }}> 
                <label htmlFor="filterInput" style={{ display: 'block', marginBottom: '5px', color: theme.textColorLight, fontSize: theme.fontSizeSmall }}>過濾條件 (JSON):</label>
                <input id="filterInput" type="text" value={filterQuery} onChange={(e) => setFilterQuery(e.target.value)} placeholder='{"ColumnID": "Value"}' style={{ width: '100%', padding: '10px', fontSize: theme.fontSizeBase, border: `1px solid ${theme.borderColor}`, borderRadius: theme.borderRadius, boxSizing: 'border-box', color: theme.textColor }}/>
                <small style={{ display: 'block', marginTop: '5px', color: theme.textColorSubtle, fontSize: '13px' }}>參考 Grist API "Filtering records"。欄位 ID 區分大小寫。</small>
              </div>
              <div style={{ marginBottom: '20px' }}> 
                <label htmlFor="sortInput" style={{ display: 'block', marginBottom: '5px', color: theme.textColorLight, fontSize: theme.fontSizeSmall }}>排序條件:</label>
                <input id="sortInput" type="text" value={sortQuery} onChange={(e) => setSortQuery(e.target.value)} placeholder='ColumnID, -AnotherColumnID' style={{ width: '100%', padding: '10px', fontSize: theme.fontSizeBase, border: `1px solid ${theme.borderColor}`, borderRadius: theme.borderRadius, boxSizing: 'border-box', color: theme.textColor }}/>
                <small style={{ display: 'block', marginTop: '5px', color: theme.textColorSubtle, fontSize: '13px' }}>參考 "Sorting records"。前綴 "-" 表示降序。</small>
              </div>
              <button onClick={handleFetchTableData} disabled={isLoadingData} style={{
                padding: '12px 20px', 
                marginTop: '10px',
                width: '100%',
                boxSizing: 'border-box',
                backgroundColor: isLoadingData ? '#6c757d' : theme.primaryColor,
                color: theme.primaryColorText,
                border: 'none',
                borderRadius: theme.borderRadius,
                cursor: isLoadingData ? 'default' : 'pointer',
                fontSize: '16px', 
                fontWeight: '500',
                opacity: isLoadingData ? 0.7 : 1,
              }}>
                {isLoadingData ? '正在加載數據...' : `獲取 "${selectedTableId}" 的數據`}
              </button>
            </div>
          )}
          {dataError && <p style={{ /* ... */ 
            color: theme.errorColor, 
            marginTop: '15px',
            whiteSpace: 'pre-wrap',
            padding: '12px 15px',
            backgroundColor: theme.errorColorBg, 
            border: `1px solid ${theme.errorColor}`, 
            borderRadius: theme.borderRadius,
            fontSize: theme.fontSizeSmall,
          }}>錯誤：{dataError}</p>}
        </div>
      )}

      {/* ... (Table display and no-data message remain the same) ... */}
      {tableData && tableData.length > 0 && columns.length > 0 && (
        <div style={{ marginTop: '30px', overflowX: 'auto' }}> 
          <h3 style={{ marginBottom: '15px', color: theme.textColor }}>數據結果: (前 {Math.min(tableData.length, 50)} 條)</h3>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse', 
            minWidth: '600px',
            fontSize: theme.fontSizeSmall, 
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)', 
            borderRadius: theme.borderRadius, 
            overflow: 'hidden', 
          }}>
            <thead>
              <tr>
                <th style={{backgroundColor: '#e9ecef', padding: '12px 10px', textAlign: 'left', color: theme.textColor, fontWeight: '600', borderBottom: `2px solid ${theme.borderColor}`, position: 'sticky', left: 0, zIndex: 1}}>id</th>
                {columns.map((col) => (<th key={col} style={{backgroundColor: '#e9ecef', padding: '12px 10px', textAlign: 'left', color: theme.textColor, fontWeight: '600', borderBottom: `2px solid ${theme.borderColor}`}}>{col}</th>))}
              </tr>
            </thead>
            <tbody>
              {tableData.map((record, rowIndex) => (
                <tr key={record.id} style={{ backgroundColor: rowIndex % 2 === 0 ? '#fff' : theme.surfaceColor , borderBottom: `1px solid ${theme.borderColor}` }}>
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
          backgroundColor: '#fff3cd', 
          border: '1px solid #ffeeba',
          color: '#856404', 
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