import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { formatTimestamp } from '../utils/formatTimestamp'; // 確保路徑正確

// --- 常量 ---
const GRIST_API_BASE_URL = 'https://tiss-grist.fcuai.tw';

// --- API 請求輔助函數 (保持不變) ---
const apiRequest = async (endpoint, apiKey, method = 'GET', params = null) => {
    if (!apiKey) return Promise.reject(new Error('API Key 未設定'));
    let url = `${GRIST_API_BASE_URL}${endpoint}`;
    if (params) {
        const queryParams = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== ''));
        if (queryParams.toString()) url += `?${queryParams.toString()}`;
    }
    const response = await fetch(url, { method, headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' } });
    const responseData = await response.json().catch(() => { throw new Error('非 JSON 響應'); });
    if (!response.ok) {
        const error = new Error(responseData?.error?.message || `請求失敗 (HTTP ${response.status})`);
        error.status = response.status;
        throw error;
    }
    return responseData;
};

// --- 本地篩選與排序函數 (保持不變) ---
const applyLocalFilters = (data, filters) => { /* ... 內部邏輯不變 ... */ };
const applyLocalSort = (data, sortStr) => { /* ... 內部邏輯不變 ... */ };


// --- 自定義 Hook 主體 (重大更新) ---
export const useGristData = ({ apiKey, selectedDocId, selectedTableId, onAuthError }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [documents, setDocuments] = useState([]);
    const [tables, setTables] = useState([]);
    
    // --- 【主要變更點 1】: 新增 state 來儲存欄位結構 ---
    const [columnSchema, setColumnSchema] = useState(null);
    const [rawTableData, setRawTableData] = useState(null);
    const [processedData, setProcessedData] = useState(null);
    const [activeFilters, setActiveFilters] = useState(null);
    
    const onAuthErrorRef = useRef(onAuthError);
    useEffect(() => { onAuthErrorRef.current = onAuthError; }, [onAuthError]);

    const handleApiError = useCallback((err) => {
        if (err.status === 401 || err.status === 403) {
            onAuthErrorRef.current?.();
        } else {
            setError(err.message);
        }
    }, []);

    // 獲取文檔和表格列表的 useEffect (保持不變)
    useEffect(() => { /* ... 獲取文檔列表邏輯 ... */ }, [apiKey, handleApiError]);
    useEffect(() => { /* ... 獲取表格列表邏輯 ... */ }, [selectedDocId, apiKey, handleApiError]);


    // --- 【主要變更點 2】: 合併獲取數據和欄位結構的 useEffect ---
    useEffect(() => {
        if (!selectedTableId || !apiKey) {
            setRawTableData(null);
            setColumnSchema(null);
            return;
        }
        
        const fetchDataAndSchema = async () => {
            setIsLoading(true);
            setError('');
            setActiveFilters(null);

            try {
                // 使用 Promise.all 並行發送兩個 API 請求
                const [recordsResponse, columnsResponse] = await Promise.all([
                    apiRequest(`/api/docs/${selectedDocId}/tables/${selectedTableId}/records`, apiKey, 'GET', { limit: '200' }),
                    apiRequest(`/api/docs/${selectedDocId}/tables/${selectedTableId}/columns`, apiKey)
                ]);

                setRawTableData(recordsResponse.records);
                setColumnSchema(columnsResponse.columns);

            } catch (err) {
                handleApiError(err);
                setRawTableData(null);
                setColumnSchema(null);
            } finally {
                setIsLoading(false);
            }
        };

        fetchDataAndSchema();
    }, [selectedTableId, selectedDocId, apiKey, handleApiError]);


    // --- 【主要變更點 3】: 動態產生欄位定義的 useMemo ---
    const tableColumns = useMemo(() => {
        if (!columnSchema) return [];

        // 固定 id 欄位在最前面
        const idColumn = {
            accessorKey: 'id',
            header: 'id',
        };

        const otherColumns = columnSchema
            .filter(col => !col.fields.isFormula && col.id !== 'id') // 過濾掉公式欄位和重複的id
            .map(col => {
                const colId = col.id;
                const colType = col.fields.type;
                const colLabel = col.fields.label || colId;

                const columnDef = {
                    accessorKey: `fields.${colId}`,
                    header: colLabel,
                    // 預設儲存格渲染
                    cell: info => {
                        const value = info.getValue();
                        return value != null ? (typeof value === 'object' ? JSON.stringify(value) : String(value)) : '';
                    }
                };
                
                // --- 根據欄位類型自動指派行為 ---
                if (colType.startsWith('DateTime') || colType.startsWith('Date')) {
                    columnDef.cell = info => formatTimestamp(info.getValue());
                    columnDef.sortingFn = 'datetime'; // 告訴 TanStack Table 按日期排序
                } else if (colType === 'Numeric' || colType === 'Int') {
                    columnDef.sortingFn = 'alphanumeric'; // 告訴 TanStack Table 按數字大小排序
                }
                
                return columnDef;
            });
        
        return [idColumn, ...otherColumns];

    }, [columnSchema]); // 當欄位結構變化時，重新計算


    // --- 【主要變更點 4】: 移除手動排序邏輯 ---
    // 監聽數據和篩選的變化，處理最終要顯示的數據
    useEffect(() => {
        if (!rawTableData) {
            setProcessedData(null);
            return;
        }
        // 現在排序由 TanStack Table 內部處理，我們只需要篩選
        const data = applyLocalFilters(rawTableData, activeFilters);
        setProcessedData(data);
    }, [rawTableData, activeFilters]);
    
    
    // 返回外部組件需要的所有狀態和函數
    return {
        isLoading,
        error,
        documents,
        tables,
        columns: tableColumns, // 直接返回處理好的欄位定義
        tableData: processedData,
        handleFilterChange: setActiveFilters,
    };
};


export const FullUseGristData = ({ apiKey, selectedDocId, selectedTableId, onAuthError }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [documents, setDocuments] = useState([]);
    const [tables, setTables] = useState([]);
    const [columnSchema, setColumnSchema] = useState(null);
    const [rawTableData, setRawTableData] = useState(null);
    const [processedData, setProcessedData] = useState(null);
    const [activeFilters, setActiveFilters] = useState(null);
    
    const onAuthErrorRef = useRef(onAuthError);
    useEffect(() => { onAuthErrorRef.current = onAuthError; }, [onAuthError]);

    const handleApiError = useCallback((err) => {
        if (err.status === 401 || err.status === 403) {
            onAuthErrorRef.current?.();
        } else {
            setError(err.message);
        }
    }, []);

    useEffect(() => {
        if (!apiKey) { setDocuments([]); return; }
        const getOrgAndDocs = async () => {
            setIsLoading(true); setError('');
            try {
                const orgsData = await apiRequest('/api/orgs', apiKey);
                const determinedOrg = (Array.isArray(orgsData) && orgsData.length > 0) ? (orgsData.find(org => org.domain === 'fcuai.tw') || orgsData[0]) : (orgsData?.id ? orgsData : null);
                if (!determinedOrg?.id) throw new Error('未能確定目標組織');
                const workspaces = await apiRequest(`/api/orgs/${determinedOrg.id}/workspaces`, apiKey);
                const allDocs = [], docNameCounts = {};
                workspaces.forEach(ws => { ws.docs?.forEach(doc => { docNameCounts[doc.name] = (docNameCounts[doc.name] || 0) + 1; allDocs.push({ ...doc, workspaceName: ws.name }); }); });
                const processedDocs = allDocs.map(doc => ({ ...doc, displayName: docNameCounts[doc.name] > 1 ? `${doc.name} (${doc.workspaceName})` : doc.name }));
                setDocuments(processedDocs);
            } catch (err) { handleApiError(err); setDocuments([]); } finally { setIsLoading(false); }
        };
        getOrgAndDocs();
    }, [apiKey, handleApiError]);

    useEffect(() => {
        if (!selectedDocId || !apiKey) { setTables([]); return; }
        const fetchTables = async () => {
            setIsLoading(true); setError('');
            try {
                const data = await apiRequest(`/api/docs/${selectedDocId}/tables`, apiKey);
                const tableList = (data.tables || []).map(t => ({ id: t.id, name: t.id }));
                setTables(tableList);
            } catch (err) { handleApiError(err); setTables([]); } finally { setIsLoading(false); }
        };
        fetchTables();
    }, [selectedDocId, apiKey, handleApiError]);

    useEffect(() => {
        if (!selectedTableId || !apiKey) {
            setRawTableData(null); setColumnSchema(null); return;
        }
        const fetchDataAndSchema = async () => {
            setIsLoading(true); setError(''); setActiveFilters(null);
            try {
                const [recordsResponse, columnsResponse] = await Promise.all([
                    apiRequest(`/api/docs/${selectedDocId}/tables/${selectedTableId}/records`, apiKey, 'GET', { limit: '200' }),
                    apiRequest(`/api/docs/${selectedDocId}/tables/${selectedTableId}/columns`, apiKey)
                ]);
                setRawTableData(recordsResponse.records);
                setColumnSchema(columnsResponse.columns);
            } catch (err) {
                handleApiError(err); setRawTableData(null); setColumnSchema(null);
            } finally { setIsLoading(false); }
        };
        fetchDataAndSchema();
    }, [selectedTableId, selectedDocId, apiKey, handleApiError]);

    const tableColumns = useMemo(() => {
        if (!columnSchema) return [];
        const idColumn = { accessorKey: 'id', header: 'id', enableSorting: false };
        const otherColumns = columnSchema
            .filter(col => !col.fields.isFormula && col.id !== 'id')
            .map(col => {
                const { id: colId, fields: { type: colType, label: colLabel } } = col;
                const columnDef = {
                    accessorKey: `fields.${colId}`,
                    header: colLabel || colId,
                    cell: info => {
                        const value = info.getValue();
                        if (colType.startsWith('DateTime') || colType.startsWith('Date')) return formatTimestamp(value);
                        return value != null ? (typeof value === 'object' ? JSON.stringify(value) : String(value)) : '';
                    }
                };
                if (colType.startsWith('DateTime') || colType.startsWith('Date')) columnDef.sortingFn = 'datetime';
                else if (colType === 'Numeric' || colType === 'Int') columnDef.sortingFn = 'alphanumeric';
                return columnDef;
            });
        return [idColumn, ...otherColumns];
    }, [columnSchema]);

    useEffect(() => {
        if (!rawTableData) { setProcessedData(null); return; }
        const data = applyLocalFilters(rawTableData, activeFilters);
        setProcessedData(data);
    }, [rawTableData, activeFilters]);
    
    return {
        isLoading, error, documents, tables,
        columns: tableColumns,
        tableData: processedData,
        handleFilterChange: setActiveFilters,
    };
};