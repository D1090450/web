// src/GristDynamicSelectorViewer.jsx
import React, { useState, useCallback, useEffect, useRef } from 'react';

const GRIST_API_BASE_URL = 'https://tiss-grist.fcuai.tw';
const TARGET_ORG_DOMAIN = 'fcuai.tw';
const API_KEY_RETRY_INTERVAL = 2000; // Increased interval for less aggressive polling

const theme = {
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

const GristApiKeyManager = React.forwardRef(({ apiKey: apiKeyProp, onApiKeyUpdate, onStatusUpdate, initialAttemptFailed }, ref) => {
  const [localApiKey, setLocalApiKey] = useState(apiKeyProp || '');
  const [isFetching, setIsFetching] = useState(false);
  const retryTimerRef = useRef(null);

  const fetchKeyFromProfile = useCallback(async () => {
    if (isFetching) return false;
    setIsFetching(true);
    try {
      const response = await fetch(`${GRIST_API_BASE_URL}/api/profile/apiKey`, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Accept': 'text/plain' },
      });
      const responseText = await response.text();
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${responseText || 'Unable to fetch API Key'}`);
      }
      const fetchedKey = responseText.trim();
      if (!fetchedKey || fetchedKey.includes('<') || fetchedKey.length < 32) {
        throw new Error('The fetched API Key appears to be invalid.');
      }
      setLocalApiKey(fetchedKey);
      onApiKeyUpdate(fetchedKey, true);
      clearTimeout(retryTimerRef.current);
      return true;
    } catch (error) {
      onApiKeyUpdate('', false);
      return false;
    } finally {
      setIsFetching(false);
    }
  }, [onApiKeyUpdate, isFetching]);

  const handleManualSubmit = useCallback(() => {
    clearTimeout(retryTimerRef.current);
    const trimmedKey = localApiKey.trim();
    if (trimmedKey) {
      onApiKeyUpdate(trimmedKey, false);
    } else {
      onStatusUpdate('Please enter a valid API Key.');
    }
  }, [localApiKey, onApiKeyUpdate, onStatusUpdate]);

  useEffect(() => {
    setLocalApiKey(apiKeyProp || '');
  }, [apiKeyProp]);

  useEffect(() => {
    if (apiKeyProp) {
      clearTimeout(retryTimerRef.current);
      return;
    }

    if (initialAttemptFailed) {
      fetchKeyFromProfile().then(success => {
        if (!success) {
          clearTimeout(retryTimerRef.current);
          retryTimerRef.current = setTimeout(function retry() {
            if (localStorage.getItem('gristLoginPopupOpen') !== 'true') {
              clearTimeout(retryTimerRef.current);
              return;
            }
            fetchKeyFromProfile().then(retrySuccess => {
              if (retrySuccess) {
                localStorage.removeItem('gristLoginPopupOpen');
              } else {
                retryTimerRef.current = setTimeout(retry, API_KEY_RETRY_INTERVAL);
              }
            });
          }, API_KEY_RETRY_INTERVAL);
        }
      });
    } else {
      clearTimeout(retryTimerRef.current);
    }

    return () => clearTimeout(retryTimerRef.current);
  }, [apiKeyProp, fetchKeyFromProfile, initialAttemptFailed]);

  React.useImperativeHandle(ref, () => ({
    triggerFetchKey: () => {
      clearTimeout(retryTimerRef.current);
      return fetchKeyFromProfile();
    },
  }));

  return (
    <div style={{ marginBottom: '20px', padding: '15px', border: `1px dashed ${theme.borderColor}`, borderRadius: theme.borderRadius, backgroundColor: theme.surfaceColor }}>
      <h4 style={{ marginTop: '0', marginBottom: '10px', color: theme.textColor }}>API Key Management</h4>
      <p style={{ fontSize: theme.fontSizeSmall, color: theme.textColorSubtle, marginBottom: '15px' }}>
        To enable "Auto-Fetch", please log in to your Grist instance (<code>{GRIST_API_BASE_URL}</code>).
        Alternatively, manually copy the API Key from your Grist profile page.
      </p>
      <input
        type="password"
        value={localApiKey}
        onChange={(e) => setLocalApiKey(e.target.value)}
        placeholder="Enter or paste Grist API Key here"
        style={{ width: 'calc(100% - 160px)', marginRight: '10px', padding: '10px', fontSize: theme.fontSizeBase, border: `1px solid ${theme.borderColor}`, borderRadius: theme.borderRadius, boxSizing: 'border-box', color: theme.textColor, }}
      />
      <button onClick={handleManualSubmit} style={{ padding: '10px 15px', fontSize: theme.fontSizeBase, backgroundColor: '#e9ecef', color: theme.textColor, border: `1px solid ${theme.borderColor}`, borderRadius: theme.borderRadius, cursor: 'pointer', }}>
        Set Manual Key
      </button>
    </div>
  );
});

function GristDynamicSelectorViewer() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gristApiKey') || '');
  const [statusMessage, setStatusMessage] = useState('');
  const [currentOrgId, setCurrentOrgId] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState('');
  const [tables, setTables] = useState([]);
  const [selectedTableId, setSelectedTableId] = useState('');
  const [tableData, setTableData] = useState(null);
  const [columns, setColumns] = useState([]);
  const [filterQuery, setFilterQuery] = useState('');
  const [sortQuery, setSortQuery] = useState('');
  const [dataError, setDataError] = useState('');

  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [isLoadingTables, setIsLoadingTables] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [initialApiKeyAttemptFailed, setInitialApiKeyAttemptFailed] = useState(false);
  const apiKeyManagerRef = useRef(null);

  const resetState = useCallback((level = 'all') => {
    if (['all', 'key'].includes(level)) {
      setCurrentOrgId(null);
      setDocuments([]);
      setSelectedDocId('');
    }
    if (['all', 'key', 'doc'].includes(level)) {
      setTables([]);
      setSelectedTableId('');
    }
    if (['all', 'key', 'doc', 'table'].includes(level)) {
      setTableData(null);
      setColumns([]);
      setDataError('');
    }
  }, []);

  const handleApiKeyUpdate = useCallback((key, autoFetchedSuccess = false) => {
    setApiKey(key);
    resetState('all');
    if (key) {
      localStorage.setItem('gristApiKey', key);
      setShowLoginPrompt(false);
      setInitialApiKeyAttemptFailed(false);
      setStatusMessage(autoFetchedSuccess ? 'API Key automatically fetched successfully!' : 'API Key has been set.');
      if (autoFetchedSuccess) {
          localStorage.removeItem('gristLoginPopupOpen');
      }
    } else {
      localStorage.removeItem('gristApiKey');
      setStatusMessage('API Key has been cleared or is invalid.');
      setInitialApiKeyAttemptFailed(true);
      setShowLoginPrompt(true);
    }
  }, [resetState]);

  const makeGristApiRequest = useCallback(async (endpoint, method = 'GET', params = null) => {
    if (!apiKey) throw new Error('API Key is not set.');
    
    let url = new URL(`${GRIST_API_BASE_URL}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          url.searchParams.append(key, value);
        }
      });
    }

    const response = await fetch(url.toString(), {
      method,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
    });

    const responseData = await response.json().catch(async () => {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text || response.statusText}`);
    });

    if (!response.ok) {
      if ([401, 403].includes(response.status)) {
        handleApiKeyUpdate('');
      }
      throw new Error(responseData?.error?.message || `HTTP ${response.status}`);
    }
    return responseData;
  }, [apiKey, handleApiKeyUpdate]);

  useEffect(() => {
    if (!apiKey) {
      resetState('all');
      return;
    }
    const getOrgAndDocs = async () => {
      setIsLoadingDocs(true);
      setStatusMessage('Loading data sources...');
      try {
        const orgsData = await makeGristApiRequest('/api/orgs');
        const orgList = Array.isArray(orgsData) ? orgsData : [orgsData];
        const targetOrg = orgList.find(org => org.domain === TARGET_ORG_DOMAIN) || orgList[0];

        if (!targetOrg?.id) throw new Error('Could not determine a valid organization ID.');
        setCurrentOrgId(targetOrg.id);

        const workspacesData = await makeGristApiRequest(`/api/orgs/${targetOrg.id}/workspaces`);
        const allDocs = workspacesData.flatMap(ws => ws.docs?.map(doc => ({ ...doc, workspaceName: ws.name })) || []);
        const docNameCounts = allDocs.reduce((acc, doc) => ({...acc, [doc.name]: (acc[doc.name] || 0) + 1}), {});
        const processedDocs = allDocs.map(doc => ({
            ...doc,
            displayName: docNameCounts[doc.name] > 1 ? `${doc.name} (${doc.workspaceName})` : doc.name
        }));

        setDocuments(processedDocs);
        setStatusMessage(processedDocs.length > 0 ? 'Data sources loaded successfully. Please select a document.' : 'No documents found in the organization.');
      } catch (error) {
        setStatusMessage(`Error loading data sources: ${error.message}`);
        resetState('all');
      } finally {
        setIsLoadingDocs(false);
      }
    };
    getOrgAndDocs();
  }, [apiKey, makeGristApiRequest, resetState]);

  useEffect(() => {
    if (!selectedDocId) {
      resetState('doc');
      return;
    }
    const fetchTables = async () => {
      setIsLoadingTables(true);
      setDataError('');
      try {
        const data = await makeGristApiRequest(`/api/docs/${selectedDocId}/tables`);
        const tableList = data.tables || (Array.isArray(data) ? data : []);
        setTables(tableList.map(table => ({ id: table.id, name: table.id })));
      } catch (error) {
        setStatusMessage(`Error fetching tables: ${error.message}`);
        setTables([]);
      } finally {
        setIsLoadingTables(false);
      }
    };
    fetchTables();
  }, [selectedDocId, makeGristApiRequest, resetState]);

  const handleFetchTableData = useCallback(async () => {
    if (!selectedDocId || !selectedTableId) {
      setDataError('Please select a document and a table first.');
      return;
    }
    setIsLoadingData(true);
    resetState('table');
    
    const params = { limit: '50' };
    try {
      if (filterQuery) { JSON.parse(filterQuery); params.filter = filterQuery; }
      if (sortQuery.trim()) { params.sort = sortQuery.trim(); }
    } catch (e) {
      setDataError('Filter condition is not valid JSON format.');
      setIsLoadingData(false);
      return;
    }

    try {
      const data = await makeGristApiRequest(`/api/docs/${selectedDocId}/tables/${selectedTableId}/records`, 'GET', params);
      if (data?.records) {
        setTableData(data.records);
        if (data.records.length > 0) {
          const allCols = new Set(data.records.flatMap(rec => Object.keys(rec.fields || {})));
          setColumns(Array.from(allCols));
        } else {
          setColumns([]);
        }
      } else {
        throw new Error('Data format is incorrect, missing "records" property.');
      }
    } catch (error) {
      setDataError(`Failed to fetch data: ${error.message}`);
      setTableData([]);
    } finally {
      setIsLoadingData(false);
    }
  }, [apiKey, selectedDocId, selectedTableId, makeGristApiRequest, filterQuery, sortQuery, resetState]);

  const openGristLoginPopup = useCallback(() => {
    const loginUrl = `${GRIST_API_BASE_URL}/login`;
    window.open(loginUrl, 'GristLoginPopup', 'width=600,height=700,scrollbars=yes,resizable=yes');
    localStorage.setItem('gristLoginPopupOpen', 'true');
    setStatusMessage('Please complete the Grist login in the new window. This page will update automatically upon success.');
    setInitialApiKeyAttemptFailed(true);
  }, []);

  useEffect(() => {
    if (!apiKey) {
      setInitialApiKeyAttemptFailed(true);
      setShowLoginPrompt(true);
    }
  }, []);

  return (
    <div style={{ padding: '25px', fontFamily: theme.fontFamily, fontSize: theme.fontSizeBase, lineHeight: theme.lineHeightBase, color: theme.textColor, backgroundColor: theme.backgroundColor, maxWidth: '1000px', margin: '20px auto', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', borderRadius: '8px', }}>
      <h1 style={{ color: theme.textColor, textAlign: 'center', marginBottom: '15px', fontSize: '28px', }}>Grist Dynamic Data Viewer</h1>
      <p style={{ textAlign: 'center', color: theme.textColorSubtle, fontSize: theme.fontSizeSmall, marginBottom: '25px' }}>
        API Target: <code>{GRIST_API_BASE_URL}</code> (Org Domain: <code>{TARGET_ORG_DOMAIN || 'Not specified'}</code>)
      </p>

      {statusMessage && ( <p style={{ padding: '12px 15px', backgroundColor: statusMessage.includes('Error') || statusMessage.includes('Failed') || statusMessage.includes('invalid') ? theme.errorColorBg : theme.successColorBg, border: `1px solid ${statusMessage.includes('Error') || statusMessage.includes('Failed') || statusMessage.includes('invalid') ? theme.errorColor : theme.successColor}`, color: statusMessage.includes('Error') || statusMessage.includes('Failed') || statusMessage.includes('invalid') ? theme.errorColor : theme.successColor, marginTop: '10px', marginBottom: '20px', borderRadius: theme.borderRadius, fontSize: theme.fontSizeSmall, textAlign: 'center', }}> {statusMessage} </p> )}

      <GristApiKeyManager
        ref={apiKeyManagerRef}
        apiKey={apiKey}
        onApiKeyUpdate={handleApiKeyUpdate}
        onStatusUpdate={setStatusMessage}
        initialAttemptFailed={initialApiKeyAttemptFailed}
      />

      {showLoginPrompt && !apiKey && (
        <div style={{ padding: '20px', margin: '20px 0', border: `1px solid ${theme.errorColor}`, borderRadius: theme.borderRadius, textAlign: 'center', backgroundColor: theme.errorColorBg, }}>
          <p style={{ color: theme.errorColor, margin: '0 0 15px 0', fontWeight: '500' }}>
            It seems you are not logged into Grist, or the API Key could not be fetched automatically.
          </p>
          <button onClick={openGristLoginPopup} style={{ padding: '10px 15px', marginRight: '10px', fontSize: theme.fontSizeBase, backgroundColor: theme.primaryColor, color: theme.primaryColorText, border: 'none', borderRadius: theme.borderRadius, cursor: 'pointer', }} >
            Open Grist Login Window
          </button>
          <button onClick={() => apiKeyManagerRef.current?.triggerFetchKey()} style={{ padding: '10px 15px', backgroundColor: '#6c757d', color: theme.primaryColorText, border: 'none', borderRadius: theme.borderRadius, cursor: 'pointer'}}>
            Retry Fetching API Key
          </button>
        </div>
      )}

      {apiKey && (
        <div style={{ marginTop: '25px', padding: '20px', border: `1px solid ${theme.borderColor}`, borderRadius: theme.borderRadius, backgroundColor: theme.surfaceColor, }}>
          <h3 style={{ marginTop: '0', marginBottom: '20px', color: theme.textColor, borderBottom: `1px solid ${theme.borderColor}`, paddingBottom: '10px' }}>Select Data Source</h3>
          <div style={{ marginBottom: '15px' }}>
            <label htmlFor="docSelect" style={{ display: 'block', marginBottom: '8px', color: theme.textColorLight, fontSize: theme.fontSizeSmall, fontWeight: '500' }}>Select Document:</label>
            <select id="docSelect" value={selectedDocId} onChange={(e) => setSelectedDocId(e.target.value)} disabled={isLoadingDocs || documents.length === 0} style={{ width: '100%', padding: '10px', fontSize: theme.fontSizeBase, border: `1px solid ${theme.borderColor}`, borderRadius: theme.borderRadius, boxSizing: 'border-box', backgroundColor: '#fff', color: theme.textColor, }}>
              <option value="">{isLoadingDocs ? 'Loading documents...' : (documents.length === 0 ? 'No documents found' : '-- Select a document --')}</option>
              {documents.map((doc) => ( <option key={doc.id} value={doc.id}> {doc.displayName} </option> ))}
            </select>
          </div>

          {selectedDocId && (
            <div style={{ marginBottom: '15px' }}>
              <label htmlFor="tableSelect" style={{ display: 'block', marginBottom: '8px', color: theme.textColorLight, fontSize: theme.fontSizeSmall, fontWeight: '500' }}>Select Table:</label>
              <select id="tableSelect" value={selectedTableId} onChange={(e) => setSelectedTableId(e.target.value)} disabled={isLoadingTables || tables.length === 0} style={{ width: '100%', padding: '10px', fontSize: theme.fontSizeBase, border: `1px solid ${theme.borderColor}`, borderRadius: theme.borderRadius, boxSizing: 'border-box', backgroundColor: '#fff', color: theme.textColor, }}>
                <option value="">{isLoadingTables ? 'Loading tables...' : (tables.length === 0 ? 'No tables found' : '-- Select a table --')}</option>
                {tables.map((table) => ( <option key={table.id} value={table.id}> {table.name} </option> ))}
              </select>
            </div>
          )}

          {selectedTableId && (
            <div style={{ border: `1px solid ${theme.borderColor}`, padding: '20px', marginTop: '20px', borderRadius: theme.borderRadius, backgroundColor: '#fff', }}>
              <h4 style={{ marginTop: '0', marginBottom: '15px', color: theme.textColor, fontSize: '18px' }}>Data Fetching Options</h4>
              <div style={{ marginBottom: '15px' }}>
                <label htmlFor="filterInput" style={{ display: 'block', marginBottom: '5px', color: theme.textColorLight, fontSize: theme.fontSizeSmall }}>Filter (JSON):</label>
                <input id="filterInput" type="text" value={filterQuery} onChange={(e) => setFilterQuery(e.target.value)} placeholder='{"ColumnID": "Value"}' style={{ width: '100%', padding: '10px', fontSize: theme.fontSizeBase, border: `1px solid ${theme.borderColor}`, borderRadius: theme.borderRadius, boxSizing: 'border-box', color: theme.textColor }}/>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label htmlFor="sortInput" style={{ display: 'block', marginBottom: '5px', color: theme.textColorLight, fontSize: theme.fontSizeSmall }}>Sort:</label>
                <input id="sortInput" type="text" value={sortQuery} onChange={(e) => setSortQuery(e.target.value)} placeholder='ColumnID, -AnotherColumnID' style={{ width: '100%', padding: '10px', fontSize: theme.fontSizeBase, border: `1px solid ${theme.borderColor}`, borderRadius: theme.borderRadius, boxSizing: 'border-box', color: theme.textColor }}/>
              </div>
              <button onClick={handleFetchTableData} disabled={isLoadingData} style={{ padding: '12px 20px', width: '100%', boxSizing: 'border-box', backgroundColor: isLoadingData ? '#6c757d' : theme.primaryColor, color: theme.primaryColorText, border: 'none', borderRadius: theme.borderRadius, cursor: isLoadingData ? 'default' : 'pointer', fontSize: '16px', fontWeight: '500' }}>
                {isLoadingData ? 'Loading Data...' : `Fetch Data from "${selectedTableId}"`}
              </button>
            </div>
          )}
          {dataError && <p style={{ color: theme.errorColor, marginTop: '15px', whiteSpace: 'pre-wrap', padding: '12px 15px', backgroundColor: theme.errorColorBg, border: `1px solid ${theme.errorColor}`, borderRadius: theme.borderRadius, fontSize: theme.fontSizeSmall, }}>Error: {dataError}</p>}
        </div>
      )}

      {tableData?.length > 0 && (
        <div style={{ marginTop: '30px', overflowX: 'auto' }}>
          <h3 style={{ marginBottom: '15px', color: theme.textColor }}>Data Results: (First {Math.min(tableData.length, 50)} records)</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px', fontSize: theme.fontSizeSmall, boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderRadius: theme.borderRadius, overflow: 'hidden', }}>
            <thead>
              <tr>
                <th style={{backgroundColor: '#e9ecef', padding: '12px 10px', textAlign: 'left', fontWeight: '600', borderBottom: `2px solid ${theme.borderColor}`, position: 'sticky', left: 0, zIndex: 1}}>id</th>
                {columns.map((col) => (<th key={col} style={{backgroundColor: '#e9ecef', padding: '12px 10px', textAlign: 'left', fontWeight: '600', borderBottom: `2px solid ${theme.borderColor}`}}>{col}</th>))}
              </tr>
            </thead>
            <tbody>
              {tableData.map((record, rowIndex) => (
                <tr key={record.id} style={{ backgroundColor: rowIndex % 2 === 0 ? '#fff' : theme.surfaceColor , borderBottom: `1px solid ${theme.borderColor}` }}>
                  <td style={{ padding: '10px', whiteSpace: 'nowrap', position: 'sticky', left: 0, backgroundColor: rowIndex % 2 === 0 ? '#fff' : theme.surfaceColor, zIndex: 1, borderRight: `1px solid ${theme.borderColor}` }}>{record.id}</td>
                  {columns.map((col) => (
                    <td key={`${record.id}-${col}`} style={{ padding: '10px', whiteSpace: 'nowrap', color: theme.textColorLight }}>
                      {record.fields && record.fields[col] != null ? (typeof record.fields[col] === 'object' ? JSON.stringify(record.fields[col]) : String(record.fields[col])) : ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {tableData?.length === 0 && !isLoadingData && !dataError && (
        <p style={{ marginTop: '15px', padding: '12px 15px', backgroundColor: '#fff3cd', border: '1px solid #ffeeba', color: '#856404', borderRadius: theme.borderRadius, fontSize: theme.fontSizeSmall, textAlign: 'center', }}>
            {filterQuery || sortQuery ? 'No data matches the current filter/sort criteria, or the table is empty.' : 'This table currently has no data.'}
        </p>
      )}
    </div>
  );
}

export default GristDynamicSelectorViewer;