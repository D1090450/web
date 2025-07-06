import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { formatTimestamp } from '../utils/formatTimestamp'; // 確保路徑正確

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

// 【主要變更點】: `applyLocalFilters` 現在是一個獨立於 Hook 的純函數
const applyLocalFilters = (data, filters) => {
    if (!filters || !data) return data;
    const isDateFilterActive = (filters.dateRange?.start || filters.dateRange?.end || (filters.days && !filters.days.all));

    return data.filter(record => {
        const fields = record.fields || {};
        if (isDateFilterActive) {
            const timestamp = fields['MOD_DTE'];
            if (timestamp == null || typeof timestamp !== 'number') return false;
            const recordDate = new Date(timestamp * 1000);
            if (isNaN(recordDate.getTime())) return false;
            if (filters.dateRange?.start) {
                const startDate = new Date(filters.dateRange.start);
                startDate.setHours(0, 0, 0, 0);
                if (recordDate < startDate) return false;
            }
            if (filters.dateRange?.end) {
                const endDate = new Date(filters.dateRange.end);
                endDate.setDate(endDate.getDate() + 1);
                endDate.setHours(0, 0, 0, 0);
                if (recordDate >= endDate) return false;
            }
            if (filters.days && !filters.days.all) {
                const dayMap = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
                const recordDayIndex = recordDate.getDay();
                const selectedDays = Object.keys(filters.days).filter(day => day !== 'all' && filters.days[day]).map(day => dayMap[day]);
                if (selectedDays.length > 0 && !selectedDays.includes(recordDayIndex)) return false;
            }
        }
        if (filters.gender && filters.gender !== 'all') {
            if (fields['性別'] !== (filters.gender === 'male' ? '男' : '女')) return false;
        }
        if (filters.title && filters.title.trim() !== '') {
            if (!fields['職稱'] || !String(fields['職稱']).toLowerCase().includes(filters.title.trim().toLowerCase())) return false;
        }
        return true;
    });
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

    // 獲取數據和欄位結構
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

    // 動態產生欄位定義
    const tableColumns = useMemo(() => {
        if (!columnSchema) return [];
        const idColumn = {
            accessorKey: 'id',
            header: 'id',
            enableSorting: false, // id 通常不需要排序
        };
        const otherColumns = columnSchema
            .filter(col => !col.fields.isFormula && col.id !== 'id')
            .map(col => {
                const { id: colId, fields: { type: colType, label: colLabel } } = col;
                const columnDef = {
                    accessorKey: `fields.${colId}`,
                    header: colLabel || colId,
                    cell: info => {
                        const value = info.getValue();
                        if (colType.startsWith('DateTime') || colType.startsWith('Date')) {
                            return formatTimestamp(value);
                        }
                        return value != null ? (typeof value === 'object' ? JSON.stringify(value) : String(value)) : '';
                    }
                };
                if (colType.startsWith('DateTime') || colType.startsWith('Date')) {
                    columnDef.sortingFn = 'datetime';
                } else if (colType === 'Numeric' || colType === 'Int') {
                    // 使用 'alphanumeric' 可以正確處理數字和包含數字的字串
                    columnDef.sortingFn = 'alphanumeric';
                }
                return columnDef;
            });
        return [idColumn, ...otherColumns];
    }, [columnSchema]);

    // 處理篩選後的數據
    useEffect(() => {
        if (!rawTableData) {
            setProcessedData(null);
            return;
        }
        // 使用獨立的輔助函數
        setProcessedData(applyLocalFilters(rawTableData, activeFilters));
    }, [rawTableData, activeFilters]);
    
    // 返回所有需要的狀態和函數
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