import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { formatTimestamp } from '../utils/formatTimestamp'; // 確保路徑正確

// --- 常量 ---
const GRIST_API_BASE_URL = 'https://tiss-grist.fcuai.tw';
const TARGET_ORG_DOMAIN = 'fcuai.tw';

// --- 輔助函數 (保持不變) ---
const apiRequest = async (endpoint, apiKey, method = 'GET', params = null) => {
    // ... 內部邏輯不變 ...
};
const applyLocalFilters = (data, filters) => {
    // ... 內部邏輯不變 ...
};

// --- 自定義 Hook 主體 ---
export const useGristData = ({ apiKey, selectedDocId, selectedTableId, onAuthError }) => {
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

    // 獲取文檔和表格列表的 useEffects (保持不變)
    useEffect(() => {
        // ... 獲取文檔列表邏輯 ...
    }, [apiKey, handleApiError]);
    useEffect(() => {
        // ... 獲取表格列表邏輯 ...
    }, [selectedDocId, apiKey, handleApiError]);
    useEffect(() => {
        // ... 獲取數據和欄位結構邏輯 ...
    }, [selectedTableId, selectedDocId, apiKey, handleApiError]);

    // --- 【主要變更點】: 動態產生欄位定義的 useMemo ---
    const tableColumns = useMemo(() => {
        if (!columnSchema) return [];
        
        const idColumn = {
            accessorKey: 'id',
            header: 'id',
            enableSorting: false,
        };

        const otherColumns = columnSchema
            .filter(col => !col.fields.isFormula && col.id !== 'id')
            .map(col => {
                const { id: colId, fields: { type: colType, label: colLabel } } = col;
                const columnDef = {
                    accessorKey: `fields.${colId}`,
                    header: colLabel || colId,
                };
                
                // --- 根據欄位類型自動指派行為 ---
                if (colType.startsWith('DateTime') || colType.startsWith('Date')) {
                    // --- 這是核心修改部分 ---
                    columnDef.cell = info => {
                        const value = info.getValue();
                        try {
                            // 嘗試格式化
                            return formatTimestamp(value);
                        } catch (e) {
                            // 如果格式化失敗，以紅色文字顯示原始值
                            return (
                                <span style={{ color: 'red', fontStyle: 'italic' }}>
                                    {String(value)}
                                </span>
                            );
                        }
                    };
                    columnDef.sortingFn = 'datetime';
                } else if (colType === 'Numeric' || colType === 'Int') {
                    columnDef.sortingFn = 'alphanumeric';
                    columnDef.cell = info => {
                        const value = info.getValue();
                        return value != null ? String(value) : '';
                    };
                } else {
                    // 預設的儲存格渲染
                    columnDef.cell = info => {
                        const value = info.getValue();
                        return value != null ? (typeof value === 'object' ? JSON.stringify(value) : String(value)) : '';
                    };
                }
                
                return columnDef;
            });
        
        return [idColumn, ...otherColumns];

    }, [columnSchema]); // 當欄位結構變化時，重新計算

    // 處理篩選後的數據 (保持不變)
    useEffect(() => {
        if (!rawTableData) {
            setProcessedData(null);
            return;
        }
        setProcessedData(applyLocalFilters(rawTableData, activeFilters));
    }, [rawTableData, activeFilters]);
    
    return {
        isLoading,
        error,
        documents,
        tables,
        columns: tableColumns,
        tableData: processedData,
        handleFilterChange: setActiveFilters,
    };
};

// 為了讓您能直接複製，這裡也附上省略的邏輯
// 請用下面的完整程式碼替換您的檔案

const FullUseGristData = ({ apiKey, selectedDocId, selectedTableId, onAuthError }) => {
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
                setTables((data.tables || []).map(t => ({ id: t.id, name: t.id })));
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
                };
                if (colType.startsWith('DateTime') || colType.startsWith('Date')) {
                    columnDef.cell = info => {
                        const value = info.getValue();
                        try {
                            return formatTimestamp(value);
                        } catch (e) {
                            return <span style={{ color: 'red', fontStyle: 'italic' }}>{String(value ?? '')}</span>;
                        }
                    };
                    columnDef.sortingFn = 'datetime';
                } else if (colType === 'Numeric' || colType === 'Int') {
                    columnDef.sortingFn = 'alphanumeric';
                    columnDef.cell = info => String(info.getValue() ?? '');
                } else {
                    columnDef.cell = info => {
                        const value = info.getValue();
                        return value != null ? (typeof value === 'object' ? JSON.stringify(value) : String(value)) : '';
                    };
                }
                return columnDef;
            });
        return [idColumn, ...otherColumns];
    }, [columnSchema]);

    useEffect(() => {
        if (!rawTableData) { setProcessedData(null); return; }
        setProcessedData(applyLocalFilters(rawTableData, activeFilters));
    }, [rawTableData, activeFilters]);
    
    return {
        isLoading, error, documents, tables,
        columns: tableColumns,
        tableData: processedData,
        handleFilterChange: setActiveFilters,
    };
};