import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { CellRenderer } from '../components/CellRenderer';
import { GristType } from '../utils/validation';

// --- 類型定義 ---
// 【主要修正點 1】: 為 Organization 建立明確的類型
interface Organization {
  id: number;
  name: string;
  domain: string;
}
interface GristDocument {
  id: string;
  name: string;
  workspaceName: string;
  displayName: string;
}
interface GristTable {
  id: string;
  name: string;
}
interface GristColumn {
  id: string;
  fields: {
    isFormula: boolean;
    type: GristType;
    label: string;
  };
}
export interface GristRecord {
  id: number;
  fields: { [key: string]: any; };
}

// --- 常量 ---
const GRIST_API_BASE_URL = 'https://tiss-grist.fcuai.tw';
const TARGET_ORG_DOMAIN = 'fcuai.tw';

// --- 輔助函數區塊 ---
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

const applyLocalFilters = (data: GristRecord[], filters: any): GristRecord[] => {
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
                // 【主要修正點 2】: 使用 Organization | Organization[] 聯合類型
                const orgsData = await apiRequest<Organization | Organization[]>('/api/orgs', apiKey);
                
                let determinedOrg: Organization | undefined;

                // 【主要修正點 3】: 使用 Array.isArray 作為類型防護
                if (Array.isArray(orgsData)) {
                    // 在此區塊中，TypeScript 知道 orgsData 是一個陣列
                    determinedOrg = orgsData.find(org => org.domain === TARGET_ORG_DOMAIN) || orgsData[0];
                } else {
                    // 在此區塊中，TypeScript 知道 orgsData 是一個單一物件
                    determinedOrg = orgsData;
                }

                if (!determinedOrg?.id) throw new Error('未能確定目標組織');

                const workspaces = await apiRequest<any[]>(`/api/orgs/${determinedOrg.id}/workspaces`, apiKey);
                const allDocs: any[] = [], docNameCounts: {[key: string]: number} = {};
                workspaces.forEach(ws => { ws.docs?.forEach((doc: any) => { docNameCounts[doc.name] = (docNameCounts[doc.name] || 0) + 1; allDocs.push({ ...doc, workspaceName: ws.name }); }); });
                const processedDocs = allDocs.map(doc => ({ ...doc, displayName: docNameCounts[doc.name] > 1 ? `${doc.name} (${doc.workspaceName})` : doc.name }));
                setDocuments(processedDocs);
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
                const data = await apiRequest<{ tables: GristTable[] }>(`/api/docs/${selectedDocId}/tables`, apiKey);
                setTables(data.tables || []);
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
            accessorKey: 'id', header: 'id', enableSorting: false, cell: info => info.getValue(),
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
        isLoading, error, documents, tables,
        columns: tableColumns,
        tableData: filteredData, 
        handleFilterChange: setActiveFilters,
    };
};