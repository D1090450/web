import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ColumnDef, PaginationState, SortingState } from '@tanstack/react-table';
import { CellRenderer } from '../components/CellRenderer';
import { GristType } from '../utils/validation';

// --- 類型定義 ---
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

// 【主要變更點 1】: 建立 Filter 參數的輔助函數
const buildGristFilter = (filters: any, pagination?: PaginationState, totalRecords?: number): string | null => {
    const filterObject: { [key: string]: any[] } = {};

    // 處理來自 Filter 元件的精確匹配篩選
    if (filters) {
        if (filters.gender && filters.gender !== 'all') {
            filterObject['性別'] = [filters.gender === 'male' ? '男' : '女'];
        }
        if (filters.title && filters.title.trim() !== '') {
            // 注意：Grist 的 filter 只支援精確匹配，這裡假設職稱也是精確的
            filterObject['職稱'] = [filters.title.trim()];
        }
    }
    
    // 【核心邏輯】: 處理分頁，動態產生 ID 陣列
    if (pagination && totalRecords != null) {
        const startId = pagination.pageIndex * pagination.pageSize + 1;
        // 確保不會請求超過總數的 ID
        const endId = Math.min(startId + pagination.pageSize - 1, totalRecords);

        if (startId <= endId) {
            // 產生從 startId 到 endId 的 ID 字串陣列
            filterObject['id'] = Array.from({ length: endId - startId + 1 }, (_, i) => String(startId + i));
        } else {
            // 如果計算出的起始 ID 超過結尾 ID，表示請求的是空頁面
            filterObject['id'] = [];
        }
    }

    // 如果 filterObject 是空的，則不應用任何篩選
    if (Object.keys(filterObject).length === 0) {
        return null;
    }

    return JSON.stringify(filterObject);
};

const buildGristSort = (sortingState: SortingState): string | null => {
    if (!sortingState || sortingState.length === 0) return 'id'; // 預設按 id 升序排序以確保分頁穩定
    return sortingState.map(sort => (sort.desc ? '-' : '') + sort.id).join(',');
};

// --- Hook Props 和返回值的類型定義 ---
interface UseGristDataProps { /* ... */ }
interface UseGristDataReturn { /* ... */ }

// --- 自定義 Hook 主體 ---
export const useGristData = ({ apiKey, selectedDocId, selectedTableId, onAuthError }: any): any => {
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>('');
    const [documents, setDocuments] = useState<GristDocument[]>([]);
    const [tables, setTables] = useState<GristTable[]>([]);
    const [columnSchema, setColumnSchema] = useState<GristColumn[] | null>(null);
    const [pageData, setPageData] = useState<GristRecord[]>([]);
    const [totalRecords, setTotalRecords] = useState<number>(0);

    const [activeFilters, setActiveFilters] = useState<any | null>(null);
    const [sorting, setSorting] = useState<SortingState>([]);
    const [pagination, setPagination] = useState<PaginationState>({
        pageIndex: 0,
        pageSize: 50,
    });
    
    const onAuthErrorRef = useRef(onAuthError);
    useEffect(() => { onAuthErrorRef.current = onAuthError; }, [onAuthError]);

    const handleApiError = useCallback((err: any) => { /* ... */ }, []);

    // 獲取文檔和表格列表 (保持不變)
    useEffect(() => { /* ... */ }, [apiKey, handleApiError]);
    useEffect(() => { /* ... */ }, [selectedDocId, apiKey, handleApiError]);

    // 【主要變更點 2】: 核心數據獲取邏輯更新
    useEffect(() => {
        if (!selectedTableId || !apiKey) {
            setPageData([]);
            setColumnSchema(null);
            return;
        }

        const fetchData = async () => {
            setIsLoading(true);
            setError('');

            try {
                // 步驟 1: (僅在需要時) 獲取符合篩選條件的總記錄數
                if (totalRecords === 0) {
                    const countFilter = buildGristFilter(activeFilters); // 只傳入篩選條件
                    const countParams = {
                        sort: '-id',
                        limit: 1,
                        filter: countFilter,
                    };
                    const countResponse = await apiRequest<{ records: GristRecord[] }>(`/api/docs/${selectedDocId}/tables/${selectedTableId}/records`, apiKey, 'GET', countParams);
                    const lastRecordId = countResponse.records[0]?.id || 0;
                    setTotalRecords(lastRecordId);

                    // 如果沒有記錄，則提前結束
                    if (lastRecordId === 0) {
                        setPageData([]);
                        // 仍然需要獲取欄位結構以顯示表頭
                        if (!columnSchema) {
                            const columnsResponse = await apiRequest<{ columns: GristColumn[] }>(`/api/docs/${selectedDocId}/tables/${selectedTableId}/columns`, apiKey);
                            setColumnSchema(columnsResponse.columns);
                        }
                        return; // 結束
                    }
                }

                // 步驟 2: 根據分頁和篩選條件獲取當前頁的數據
                const dataFilter = buildGristFilter(activeFilters, pagination, totalRecords);
                const sortParam = buildGristSort(sorting);
                const dataParams = {
                    sort: sortParam,
                    filter: dataFilter,
                };

                const [recordsResponse, columnsResponse] = await Promise.all([
                    apiRequest<{ records: GristRecord[] }>(`/api/docs/${selectedDocId}/tables/${selectedTableId}/records`, apiKey, 'GET', dataParams),
                    // 只有在還沒有 schema 時才請求
                    columnSchema ? Promise.resolve(null) : apiRequest<{ columns: GristColumn[] }>(`/api/docs/${selectedDocId}/tables/${selectedTableId}/columns`, apiKey)
                ]);

                setPageData(recordsResponse.records);
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
    }, [apiKey, selectedTableId, selectedDocId, pagination, sorting, activeFilters, totalRecords, columnSchema, handleApiError]);
    
    // 當表格或篩選條件切換時，重置分頁和總數
    useEffect(() => {
        setPagination({ pageIndex: 0, pageSize: 50 });
        setSorting([]);
        setColumnSchema(null);
        setTotalRecords(0); // 【重要】: 重置總數，以便下次觸發重新獲取
    }, [selectedTableId, activeFilters]);
    
    // 動態產生欄位定義 (保持不變)
    const tableColumns = useMemo((): ColumnDef<GristRecord, any>[] => { /* ... */ return []; }, [columnSchema]);
    
    return {
        isLoading, error, documents, tables,
        columns: tableColumns,
        pageData,
        totalRecords, // 返回總記錄數
        pagination,
        sorting,
        setPagination,
        setSorting,
        handleFilterChange: setActiveFilters,
    };
};