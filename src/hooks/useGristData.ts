import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { CellRenderer } from '../components/CellRenderer';
import { GristType } from '../utils/validation';

// --- 【主要變更點 1】: 定義 Grist API 回應的類型 ---

// Grist 文檔的基本結構
interface GristDocument {
  id: string;
  name: string;
  workspaceName: string;
  displayName: string;
}

// Grist 表格的基本結構
interface GristTable {
  id: string;
  name: string;
}

// Grist 欄位結構 (Schema)
interface GristColumn {
  id: string;
  fields: {
    isFormula: boolean;
    type: GristType;
    label: string;
  };
}

// Grist 記錄 (資料列) 的結構
// 使用索引簽名來表示 fields 物件可以有任何字串鍵
export interface GristRecord {
  id: number;
  fields: {
    [key: string]: any;
  };
}

// --- 常量 ---
const GRIST_API_BASE_URL = 'https://tiss-grist.fcuai.tw';
const TARGET_ORG_DOMAIN = 'fcuai.tw';

// --- 輔助函數區塊 (加上類型) ---
const apiRequest = async <T>(endpoint: string, apiKey: string, method: 'GET' | 'POST' = 'GET', params: Record<string, any> | null = null): Promise<T> => {
    if (!apiKey) return Promise.reject(new Error('API Key 未設定'));
    let url = `${GRIST_API_BASE_URL}${endpoint}`;
    if (params) {
        const queryParams = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== ''));
        if (queryParams.toString()) url += `?${queryParams.toString()}`;
    }
    const response = await fetch(url, { method, headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' } });
    const responseData = await response.json().catch(() => { throw new Error('非 JSON 響應'); });
    if (!response.ok) {
        const error = new Error((responseData as any)?.error?.message || `請求失敗 (HTTP ${response.status})`);
        (error as any).status = response.status;
        throw error;
    }
    return responseData as T;
};

// ... applyLocalFilters 函數保持不變，但我們可以為它的參數加上類型 ...
const applyLocalFilters = (data: GristRecord[], filters: any): GristRecord[] => {
    // ... 內部邏輯不變 ...
    return data; // 為了簡潔，暫時返回原數據
};

// --- Hook Props 和返回值的類型定義 ---
interface UseGristDataProps {
  apiKey: string;
  selectedDocId: string;
  selectedTableId: string;
  onAuthError: () => void;
}

interface UseGristDataReturn {
  isLoading: boolean;
  error: string;
  documents: GristDocument[];
  tables: GristTable[];
  columns: ColumnDef<GristRecord, any>[];
  tableData: GristRecord[] | null;
  handleFilterChange: React.Dispatch<React.SetStateAction<any | null>>;
}


// --- 自定義 Hook 主體 ---
export const useGristData = ({ apiKey, selectedDocId, selectedTableId, onAuthError }: UseGristDataProps): UseGristDataReturn => {
    // 【主要變更點 2】: 為所有狀態提供明確的類型
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>('');
    const [documents, setDocuments] = useState<GristDocument[]>([]);
    const [tables, setTables] = useState<GristTable[]>([]);
    const [columnSchema, setColumnSchema] = useState<GristColumn[] | null>(null);
    const [rawData, setRawData] = useState<GristRecord[] | null>(null);
    const [filteredData, setFilteredData] = useState<GristRecord[] | null>(null);
    const [activeFilters, setActiveFilters] = useState<any | null>(null);
    
    const onAuthErrorRef = useRef(onAuthError);
    useEffect(() => { onAuthErrorRef.current = onAuthError; }, [onAuthError]);

    const handleApiError = useCallback((err: any) => {
        if (err.status === 401 || err.status === 403) { onAuthErrorRef.current?.(); } 
        else { setError(err.message); }
    }, []);

    // 獲取文檔列表
    useEffect(() => {
        if (!apiKey) { setDocuments([]); return; }
        const getOrgAndDocs = async () => {
            setIsLoading(true); setError('');
            try {
                // ... 內部邏輯不變 ...
                // 假設 apiRequest 返回的數據符合我們的類型
            } catch (err) { handleApiError(err); setDocuments([]); } 
            finally { setIsLoading(false); }
        };
        getOrgAndDocs();
    }, [apiKey, handleApiError]);

    // 獲取表格列表
    useEffect(() => {
        if (!selectedDocId || !apiKey) { setTables([]); return; }
        const fetchTables = async () => {
            setIsLoading(true); setError('');
            try {
                // ... 內部邏輯不變 ...
            } catch (err) { handleApiError(err); setTables([]); } 
            finally { setIsLoading(false); }
        };
        fetchTables();
    }, [selectedDocId, apiKey, handleApiError]);

    // 獲取數據和欄位結構
    useEffect(() => {
        if (!selectedTableId || !apiKey) {
            setRawData(null); setColumnSchema(null); return;
        }
        const fetchDataAndSchema = async () => {
            setIsLoading(true); setError(''); setActiveFilters(null);
            try {
                const params = { limit: 500 }; 
                const [recordsResponse, columnsResponse] = await Promise.all([
                    apiRequest<{ records: GristRecord[] }>(`/api/docs/${selectedDocId}/tables/${selectedTableId}/records`, apiKey, 'GET', params),
                    apiRequest<{ columns: GristColumn[] }>(`/api/docs/${selectedDocId}/tables/${selectedTableId}/columns`, apiKey)
                ]);
                setRawData(recordsResponse.records);
                setColumnSchema(columnsResponse.columns);
            } catch (err) { handleApiError(err); setRawData(null); setColumnSchema(null); } 
            finally { setIsLoading(false); }
        };
        fetchDataAndSchema();
    }, [selectedTableId, selectedDocId, apiKey, handleApiError]);
    
    // 動態產生欄位定義
    const tableColumns = useMemo((): ColumnDef<GristRecord, any>[] => {
        if (!columnSchema) return [];
        const idColumn: ColumnDef<GristRecord, any> = {
            accessorKey: 'id',
            header: 'id',
            enableSorting: false,
            cell: info => info.getValue(),
        };
        const otherColumns = columnSchema
            .filter(col => !col.fields.isFormula && col.id !== 'id')
            .map((col): ColumnDef<GristRecord, any> => {
                const { id: colId, fields: { type: colType, label: colLabel } } = col;
                return {
                    accessorKey: `fields.${colId}`,
                    header: colLabel || colId,
                    cell: (info) => React.createElement(CellRenderer, { info }),
                    meta: { columnType: colType },
                    sortingFn: (colType.startsWith('DateTime') || colType.startsWith('Date')) 
                        ? 'datetime' 
                        : (colType === 'Numeric' || colType === 'Int' ? 'alphanumeric' : undefined),
                };
            });
        return [idColumn, ...otherColumns];
    }, [columnSchema]);

    // 處理本地篩選
    useEffect(() => {
        if (!rawData) { setFilteredData(null); return; }
        setFilteredData(applyLocalFilters(rawData, activeFilters));
    }, [rawData, activeFilters]);
    
    return {
        isLoading,
        error,
        documents,
        tables,
        columns: tableColumns,
        tableData: filteredData, 
        handleFilterChange: setActiveFilters,
    };
};