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

// 【新增點】: 將前端篩選狀態轉換為 Grist API 的 filter 參數
const buildGristFilter = (filters) => {
    if (!filters) return null;
    const conditions = ['and'];
    const getField = (fieldName) => ['record.fields.get', fieldName];

    if (filters.gender && filters.gender !== 'all') {
        conditions.push(['=', getField('性別'), filters.gender === 'male' ? '男' : '女']);
    }
    if (filters.dateRange?.start) {
        // Grist 的 DateTime 篩選需要 Unix Timestamp
        const startDate = Math.floor(new Date(filters.dateRange.start).getTime() / 1000);
        conditions.push(['>=', getField('MOD_DTE'), startDate]);
    }
    if (filters.dateRange?.end) {
        // 包含結束日期當天，所以取隔天的開始
        const endDate = new Date(filters.dateRange.end);
        endDate.setDate(endDate.getDate() + 1);
        const endTimestamp = Math.floor(endDate.getTime() / 1000);
        conditions.push(['<', getField('MOD_DTE'), endTimestamp]);
    }
    // 注意：後端驅動時，星期篩選較為複雜，因為 Grist filter 不直接支援 weekday 函數。
    // 這裡暫時移除，若要實現需在前端處理或 Grist 端新增公式欄位。
    if (filters.title && filters.title.trim() !== '') {
        conditions.push(['.includes', getField('職稱'), filters.title.trim()]);
    }
    return conditions.length > 1 ? JSON.stringify(conditions) : null;
};

// 【新增點】: 將 TanStack Table 的排序狀態轉換為 Grist API 的 sort 參數
const buildGristSort = (sortingState) => {
    if (!sortingState || sortingState.length === 0) return null;
    return sortingState.map(sort => (sort.desc ? '-' : '') + sort.id).join(',');
};


// --- 自定義 Hook 主體 (伺服器端分頁版) ---
export const useGristData = ({ apiKey, selectedDocId, selectedTableId, onAuthError }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [documents, setDocuments] = useState([]);
    const [tables, setTables] = useState([]);
    const [columnSchema, setColumnSchema] = useState(null);
    const [pageData, setPageData] = useState([]);
    const [totalRecords, setTotalRecords] = useState(0);

    // --- 【主要變更點 1】: 管理表格的完整狀態 ---
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
        if (!selectedDocId || !apiKey) {
            setTables([]);
            return;
        }
        // --- 【修正點】: 補全 fetchTables 的完整邏輯 ---
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

    // 獲取數據和欄位結構
    useEffect(() => {
        if (!selectedTableId || !apiKey) {
            setRawTableData(null);
            setColumnSchema(null);
            return;
        }
        // --- 【修正點】: 補全 fetchDataAndSchema 的完整邏輯 ---
        const fetchDataAndSchema = async () => {
            setIsLoading(true);
            setError('');
            setActiveFilters(null);
            try {
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

    // --- 【主要變更點 2】: 核心的數據獲取 useEffect ---
    // 在表格、分頁、排序或篩選改變時觸發
    useEffect(() => {
        if (!selectedTableId || !apiKey) {
            setPageData([]);
            setColumnSchema(null);
            return;
        }

        const fetchData = async () => {
            setIsLoading(true);
            setError('');

            // 組合 API 參數
            const filterParam = buildGristFilter(activeFilters);
            const sortParam = buildGristSort(sorting);
            const params = {
                limit: pagination.pageSize,
                skip: pagination.pageIndex * pagination.pageSize,
                sort: sortParam,
                filter: filterParam
            };
            
            try {
                // 並行獲取數據、總數和欄位結構 (僅在需要時)
                const promises = [
                    apiRequest(`/api/docs/${selectedDocId}/tables/${selectedTableId}/records`, apiKey, 'GET', params),
                    apiRequest(`/api/docs/${selectedDocId}/tables/${selectedTableId}/data/count`, apiKey, 'GET', { filter: filterParam })
                ];
                // 只有在還沒有 schema 時才請求
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
        columnSchema // 當 columnSchema 被設置後，避免不必要的重新請求
    ]);
    
    // 當表格切換時，重置分頁、排序和篩選
    useEffect(() => {
        setPagination({ pageIndex: 0, pageSize: 50 });
        setSorting([]);
        setActiveFilters(null);
        setColumnSchema(null); // 強制重新獲取新表格的 schema
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
                    // 為了讓伺服器排序正常工作，我們需要禁用客戶端排序
                    enableSorting: true, 
                };
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