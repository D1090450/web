import { useState, useEffect, useCallback, useRef } from 'react';

// --- 常量 ---
// 為了讓 Hook 獨立，我們在這裡重新定義，或者從共享的 config 檔案中導入
const GRIST_API_BASE_URL = 'https://tiss-grist.fcuai.tw';

// --- 輔助函數：API 請求 ---
// 這個函數是從原有的 useGristApi Hook 中提取並簡化而來
const apiRequest = async (endpoint, apiKey, method = 'GET', params = null) => {
    if (!apiKey) return Promise.reject(new Error('API Key 未設定'));

    let url = `${GRIST_API_BASE_URL}${endpoint}`;
    if (params) {
        const queryParams = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== ''));
        if (queryParams.toString()) url += `?${queryParams.toString()}`;
    }

    const response = await fetch(url, {
        method,
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' }
    });

    const responseData = await response.json().catch(() => {
        throw new Error('非 JSON 響應');
    });

    if (!response.ok) {
        const errorMsg = responseData?.error?.message || `請求失敗 (HTTP ${response.status})`;
        // 將狀態碼附加到錯誤中，以便外部處理
        const error = new Error(errorMsg);
        error.status = response.status;
        throw error;
    }
    return responseData;
};

// --- 輔助函數：本地數據處理 ---
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

const applyLocalSort = (data, sortStr) => {
    if (!sortStr || !data) return data;
    const sortKeys = sortStr.split(',').map(key => {
        const trimmedKey = key.trim();
        return { key: trimmedKey.startsWith('-') ? trimmedKey.substring(1) : trimmedKey, order: trimmedKey.startsWith('-') ? 'desc' : 'asc' };
    }).filter(item => item.key);
    if (sortKeys.length === 0) return data;
    const sortedData = [...data];
    sortedData.sort((a, b) => {
        for (const { key, order } of sortKeys) {
            const valA = a.fields?.[key];
            const valB = b.fields?.[key];
            if (valA === valB) continue;
            const comparison = (valA ?? '') < (valB ?? '') ? -1 : 1;
            return order === 'asc' ? comparison : -comparison;
        }
        return 0;
    });
    return sortedData;
};

// --- 自定義 Hook 主體 ---
export const useGristData = ({ apiKey, selectedDocId, selectedTableId, onAuthError }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [documents, setDocuments] = useState([]);
    const [tables, setTables] = useState([]);
    const [columns, setColumns] = useState([]);
    const [rawTableData, setRawTableData] = useState(null);
    const [processedData, setProcessedData] = useState(null);
    const [activeFilters, setActiveFilters] = useState(null);
    const [sortQuery, setSortQuery] = useState('');
    
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
                const determinedOrg = (Array.isArray(orgsData) && orgsData.length > 0) ? (orgsData.find(org => org.domain === 'fcuai.tw') || orgsData[0]) : (orgsData?.id ? orgsData : null);
                if (!determinedOrg?.id) throw new Error('未能確定目標組織');
                const workspaces = await apiRequest(`/api/orgs/${determinedOrg.id}/workspaces`, apiKey);
                const allDocs = [];
                const docNameCounts = {};
                workspaces.forEach(ws => {
                    ws.docs?.forEach(doc => {
                        docNameCounts[doc.name] = (docNameCounts[doc.name] || 0) + 1;
                        allDocs.push({ ...doc, workspaceName: ws.name });
                    });
                });
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
                const tableList = (data.tables || []).map(t => ({ id: t.id, name: t.id }));
                setTables(tableList);
            } catch (err) {
                handleApiError(err);
                setTables([]);
            } finally {
                setIsLoading(false);
            }
        };
        fetchTables();
    }, [selectedDocId, apiKey, handleApiError]);

    // 獲取表格的原始數據
    useEffect(() => {
        if (!selectedTableId || !apiKey) {
            setRawTableData(null);
            setColumns([]);
            return;
        }
        const fetchInitialTableData = async () => {
            setIsLoading(true);
            setError('');
            setActiveFilters(null);
            setSortQuery('');
            try {
                const data = await apiRequest(`/api/docs/${selectedDocId}/tables/${selectedTableId}/records`, apiKey, 'GET', { limit: '200' });
                setRawTableData(data.records);
                if (data.records.length > 0) {
                    const allCols = new Set(data.records.flatMap(rec => Object.keys(rec.fields || {})));
                    setColumns(Array.from(allCols));
                } else {
                    setColumns([]);
                }
            } catch (err) {
                handleApiError(err);
                setRawTableData(null);
            } finally {
                setIsLoading(false);
            }
        };
        fetchInitialTableData();
    }, [selectedTableId, selectedDocId, apiKey, handleApiError]);

    // 監聽數據、篩選和排序的變化，並處理最終要顯示的數據
    useEffect(() => {
        if (!rawTableData) {
            setProcessedData(null);
            return;
        }
        let data = applyLocalFilters(rawTableData, activeFilters);
        data = applyLocalSort(data, sortQuery);
        setProcessedData(data);
    }, [rawTableData, activeFilters, sortQuery]);
    
    // 返回外部組件需要的所有狀態和函數
    return {
        isLoading,
        error,
        documents,
        tables,
        columns,
        tableData: processedData, // 外部直接使用這個處理好的數據
        handleFilterChange: setActiveFilters, // 簡化為直接設定篩選條件
        sortQuery,
        setSortQuery
    };
};