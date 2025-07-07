import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
// 導入新的 CellRenderer 組件
import { CellRenderer } from '../components/CellRenderer';

// --- 常量 ---
const GRIST_API_BASE_URL = 'https://tiss-grist.fcuai.tw';
const TARGET_ORG_DOMAIN = 'fcuai.tw';

// --- 輔助函數：API 請求 (保持不變) ---
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

// --- 輔助函數：本地篩選 (保持不變) ---
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

    // 獲取文檔列表 (保持不變)
    useEffect(() => {
        if (!apiKey) { setDocuments([]); return; }
        const getOrgAndDocs = async () => { /* ... 內部邏輯不變 ... */ };
        getOrgAndDocs();
    }, [apiKey, handleApiError]);

    // 獲取表格列表 (保持不變)
    useEffect(() => {
        if (!selectedDocId || !apiKey) { setTables([]); return; }
        const fetchTables = async () => { /* ... 內部邏輯不變 ... */ };
        fetchTables();
    }, [selectedDocId, apiKey, handleApiError]);

    // 獲取數據和欄位結構 (保持不變)
    useEffect(() => {
        if (!selectedTableId || !apiKey) {
            setRawTableData(null); setColumnSchema(null); return;
        }
        const fetchDataAndSchema = async () => { /* ... 內部邏輯不變 ... */ };
        fetchDataAndSchema();
    }, [selectedTableId, selectedDocId, apiKey, handleApiError]);

    // 【主要修改點】: 動態產生欄位定義，並使用 CellRenderer
    const tableColumns = useMemo(() => {
        if (!columnSchema) return [];
        
        const idColumn = {
            accessorKey: 'id',
            header: 'id',
            enableSorting: false,
            // id 欄位類型簡單，可以直接渲染
            cell: info => info.getValue(),
        };

        const otherColumns = columnSchema
            .filter(col => !col.fields.isFormula && col.id !== 'id')
            .map(col => {
                const { id: colId, fields: { type: colType, label: colLabel } } = col;
                
                const columnDef = {
                    accessorKey: `fields.${colId}`,
                    header: colLabel || colId,
                    // --- 使用 CellRenderer 進行渲染 ---
                    cell: (info) => React.createElement(CellRenderer, { info }),
                    // --- 將欄位類型儲存在 meta 中，以便 CellRenderer 訪問 ---
                    meta: {
                        columnType: colType,
                    },
                };
                
                // --- 根據欄位類型設定排序函數 ---
                if (colType.startsWith('DateTime') || colType.startsWith('Date')) {
                    columnDef.sortingFn = 'datetime';
                } else if (colType === 'Numeric' || colType === 'Int') {
                    columnDef.sortingFn = 'alphanumeric';
                }
                
                return columnDef;
            });

        return [idColumn, ...otherColumns];
    }, [columnSchema]);

    // 處理篩選後的數據 (保持不變)
    useEffect(() => {
        if (!rawTableData) { setProcessedData(null); return; }
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