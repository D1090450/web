import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { CellRenderer } from '../components/CellRenderer';

// --- 常量 ---
const GRIST_API_BASE_URL = 'https://tiss-grist.fcuai.tw';
const TARGET_ORG_DOMAIN = 'fcuai.tw';

// --- 輔助函數區塊 ---
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

    // --- 【主要變更點 1】: 狀態變更 ---
    const [hasNextPage, setHasNextPage] = useState(false); // 取代 totalRecords

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

    // 獲取文檔和表格列表 (保持不變)
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

    // --- 【主要變更點 2】: 核心數據獲取邏輯更新 ---
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
                // 請求 page size + 1 筆數據來判斷是否有下一頁
                limit: pagination.pageSize + 1,
                offset: pagination.pageIndex * pagination.pageSize,
                sort: sortParam,
                filter: filterParam
            };
            
            try {
                // 不再需要 Promise.all，因為獲取總數的請求被移除了
                const recordsResponse = await apiRequest(`/api/docs/${selectedDocId}/tables/${selectedTableId}/records`, apiKey, 'GET', params);

                const records = recordsResponse.records || [];
                
                // 檢查返回的記錄數
                const hasMore = records.length > pagination.pageSize;
                setHasNextPage(hasMore);

                // 只儲存當前頁需要的數據
                setPageData(hasMore ? records.slice(0, pagination.pageSize) : records);

                // 如果還沒有欄位結構，則獲取它
                if (!columnSchema) {
                    const columnsResponse = await apiRequest(`/api/docs/${selectedDocId}/tables/${selectedTableId}/columns`, apiKey);
                    setColumnSchema(columnsResponse.columns);
                }

            } catch (err) {
                handleApiError(err);
                setPageData([]);
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
        setColumnSchema(null);
        setHasNextPage(false);
    }, [selectedTableId]);
    
    // 動態產生欄位定義 (保持不變)
    const tableColumns = useMemo(() => {
        if (!columnSchema) return [];
        const idColumn = { accessorKey: 'id', header: 'id', enableSorting: false, cell: info => info.getValue() };
        const otherColumns = columnSchema
            .filter(col => !col.fields.isFormula && col.id !== 'id')
            .map(col => {
                const { id: colId, fields: { type: colType, label: colLabel } } = col;
                const columnDef = {
                    accessorKey: `fields.${colId}`,
                    header: colLabel || colId,
                    cell: (info) => React.createElement(CellRenderer, { info }),
                    meta: { columnType: colType },
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
        hasNextPage, // 【主要變更點 3】: 返回 hasNextPage
        pagination,
        sorting,
        setPagination,
        setSorting,
        handleFilterChange: setActiveFilters,
    };
};