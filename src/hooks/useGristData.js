import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { CellRenderer } from '../components/CellRenderer';

// --- 常量 ---
const GRIST_API_BASE_URL = 'https://tiss-grist.fcuai.tw';
const TARGET_ORG_DOMAIN = 'fcuai.tw';

// --- 輔助函數區塊 ---

// 負責發送 API 請求
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

// 將前端篩選狀態轉換為 Grist API 的 filter 參數
const buildGristFilter = (filters) => {
    if (!filters) return null;
    const conditions = ['and'];
    const getField = (fieldName) => ['record.fields.get', fieldName];

    if (filters.gender && filters.gender !== 'all') {
        conditions.push(['=', getField('性別'), filters.gender === 'male' ? '男' : '女']);
    }
    if (filters.dateRange?.start) {
        const startDate = Math.floor(new Date(filters.dateRange.start).getTime() / 1000);
        conditions.push(['>=', getField('MOD_DTE'), startDate]);
    }
    if (filters.dateRange?.end) {
        const endDate = new Date(filters.dateRange.end);
        endDate.setDate(endDate.getDate() + 1);
        const endTimestamp = Math.floor(endDate.getTime() / 1000);
        conditions.push(['<', getField('MOD_DTE'), endTimestamp]);
    }
    if (filters.title && filters.title.trim() !== '') {
        conditions.push(['.includes', getField('職稱'), filters.title.trim()]);
    }
    return conditions.length > 1 ? JSON.stringify(conditions) : null;
};

// 將 TanStack Table 的排序狀態轉換為 Grist API 的 sort 參數
const buildGristSort = (sortingState) => {
    if (!sortingState || sortingState.length === 0) return null;
    return sortingState.map(sort => (sort.desc ? '-' : '') + sort.id).join(',');
};


// --- 自定義 Hook 主體 ---
export const useGristData = ({ apiKey, selectedDocId, selectedTableId, onAuthError }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [documents, setDocuments] = useState([]);
    const [tables, setTables] = useState([]);
    const [columnSchema, setColumnSchema] = useState(null);
    const [pageData, setPageData] = useState([]);
    const [totalRecords, setTotalRecords] = useState(0);

    const [activeFilters, setActiveFilters] = useState(null);
    const [sorting, setSorting] = useState([]);
    const [pagination, setPagination] = useState({
        pageIndex: 0,
        pageSize: 50,
    });
    
    const onAuthErrorRef = useRef(onAuthError);
    useEffect(() => { onAuthErrorRef.current = onAuthError; }, [onAuthError]);

    const handleApiError = useCallback((err) => {
        if (err.status === 401 || err.status === 403) { onAuthErrorRef.current?.(); } 
        else { setError(err.message); }
    }, []);

    // 獲取文檔列表
    useEffect(() => {
        if (!apiKey) {
            setDocuments([]);
            return;
        }
        const getOrgAndDocs = async () => {
            setIsLoading(true);
            setError('');
            try {
                const orgsData = await apiRequest('/api/orgs', apiKey);
                const determinedOrg = (Array.isArray(orgsData) && orgsData.length > 0) ? (orgsData.find(org => org.domain === TARGET_ORG_DOMAIN) || orgsData[0]) : (orgsData?.id ? orgsData : null);
                if (!determinedOrg?.id) throw new Error('未能確定目標組織');
                const workspaces = await apiRequest(`/api/orgs/${determinedOrg.id}/workspaces`, apiKey);
                const allDocs = [], docNameCounts = {};
                workspaces.forEach(ws => { ws.docs?.forEach(doc => { docNameCounts[doc.name] = (docNameCounts[doc.name] || 0) + 1; allDocs.push({ ...doc, workspaceName: ws.name }); }); });
                const processedDocs = allDocs.map(doc => ({ ...doc, displayName: docNameCounts[doc.name] > 1 ? `${doc.name} (${doc.workspaceName})` : doc.name }));
                setDocuments(processedDocs);
            } catch (err) {
                handleApiError(err);
                setDocuments([]);
            } finally {
                setIsLoading(false);
            }
        };
        getOrgAndDocs();
    }, [apiKey, handleApiError]);

    // 獲取表格列表
    useEffect(() => {
        if (!selectedDocId || !apiKey) {
            setTables([]);
            return;
        }
        const fetchTables = async () => {
            setIsLoading(true);
            setError('');
            try {
                const data = await apiRequest(`/api/docs/${selectedDocId}/tables`, apiKey);
                setTables((data.tables || []).map(t => ({ id: t.id, name: t.id })));
            } catch (err) {
                handleApiError(err);
                setTables([]);
            } finally {
                setIsLoading(false);
            }
        };
        fetchTables();
    }, [selectedDocId, apiKey, handleApiError]);

    // 核心數據獲取：在表格、分頁、排序或篩選改變時觸發
    useEffect(() => {
        if (!selectedTableId || !apiKey) {
            setPageData([]);
            setColumnSchema(null);
            return;
        }

        const fetchData = async () => {
            setIsLoading(true);
            setError('');

            const filterParam = buildGristFilter(activeFilters);
            const sortParam = buildGristSort(sorting);
            const params = {
                limit: pagination.pageSize,
                skip: pagination.pageIndex * pagination.pageSize,
                sort: sortParam,
                filter: filterParam
            };
            
            try {
                const promises = [
                    apiRequest(`/api/docs/${selectedDocId}/tables/${selectedTableId}/records`, apiKey, 'GET', params),
                    apiRequest(`/api/docs/${selectedDocId}/tables/${selectedTableId}/data/count`, apiKey, 'GET', { filter: filterParam })
                ];
                if (!columnSchema) {
                    promises.push(apiRequest(`/api/docs/${selectedDocId}/tables/${selectedTableId}/columns`, apiKey));
                }

                const [recordsResponse, countResponse, columnsResponse] = await Promise.all(promises);

                setPageData(recordsResponse.records);
                setTotalRecords(countResponse.count);
                if (columnsResponse) {
                    setColumnSchema(columnsResponse.columns);
                }

            } catch (err) {
                handleApiError(err);
                setPageData([]);
                setTotalRecords(0);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [
        apiKey,
        selectedTableId,
        selectedDocId,
        pagination,
        sorting,
        activeFilters,
        handleApiError,
        columnSchema
    ]);
    
    // 當表格切換時，重置所有相關狀態
    useEffect(() => {
        setPagination({ pageIndex: 0, pageSize: 50 });
        setSorting([]);
        setActiveFilters(null);
        setColumnSchema(null); // 強制重新獲取新表格的 schema
    }, [selectedTableId]);
    
    // 動態產生欄位定義
    const tableColumns = useMemo(() => {
        if (!columnSchema) return [];
        const idColumn = {
            accessorKey: 'id',
            header: 'id',
            enableSorting: false,
            cell: info => info.getValue(),
        };
        const otherColumns = columnSchema
            .filter(col => !col.fields.isFormula && col.id !== 'id')
            .map(col => {
                const { id: colId, fields: { type: colType, label: colLabel } } = col;
                const columnDef = {
                    accessorKey: `fields.${colId}`,
                    header: colLabel || colId,
                    cell: (info) => React.createElement(CellRenderer, { info }),
                    meta: {
                        columnType: colType,
                    },
                };
                if (colType.startsWith('DateTime') || colType.startsWith('Date')) {
                    columnDef.sortingFn = 'datetime';
                } else if (colType === 'Numeric' || colType === 'Int') {
                    columnDef.sortingFn = 'alphanumeric';
                }
                return columnDef;
            });
        return [idColumn, ...otherColumns];
    }, [columnSchema]);
    
    // 返回所有需要的狀態和函數給外部組件
    return {
        isLoading,
        error,
        documents,
        tables,
        columns: tableColumns,
        pageData,
        totalRecords,
        pagination,
        sorting,
        setPagination,
        setSorting,
        handleFilterChange: setActiveFilters,
    };
};