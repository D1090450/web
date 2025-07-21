import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ColumnDef, PaginationState, SortingState } from '@tanstack/react-table';
import { CellRenderer } from '../components/CellRenderer';
import { GristType } from '../utils/validation';

// --- 類型定義 ---
interface Organization { id: number; name: string; domain: string; }
interface GristDocument { id: string; name: string; workspaceName: string; displayName: string; }
interface GristTable { id: string; }
interface GristColumn { id: string; fields: { isFormula: boolean; type: GristType; label: string; }; }
export interface GristRecord { id: number; fields: { [key: string]: any; }; }

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

const escapeSqlValue = (value: any): string | number => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
    return 'NULL';
};

const buildWhereClause = (filters: any): string => {
    if (!filters) return '';
    const conditions: string[] = [];

    if (filters.gender && filters.gender !== 'all') {
        conditions.push(`"性別" = ${escapeSqlValue(filters.gender === 'male' ? '男' : '女')}`);
    }
    if (filters.dateRange?.start) {
        const startDate = Math.floor(new Date(filters.dateRange.start).getTime() / 1000);
        conditions.push(`"MOD_DTE" >= ${startDate}`);
    }
    if (filters.dateRange?.end) {
        const endDate = new Date(filters.dateRange.end);
        endDate.setDate(endDate.getDate() + 1);
        const endTimestamp = Math.floor(endDate.getTime() / 1000);
        conditions.push(`"MOD_DTE" < ${endTimestamp}`);
    }
    if (filters.title && filters.title.trim() !== '') {
        conditions.push(`"職稱" LIKE ${escapeSqlValue('%' + filters.title.trim() + '%')}`);
    }

    return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
};

const buildOrderByClause = (sortingState: SortingState): string => {
    if (!sortingState || sortingState.length === 0) return 'ORDER BY "id" ASC';
    const sortClauses = sortingState.map(sort => `"${sort.id}" ${sort.desc ? 'DESC' : 'ASC'}`);
    return `ORDER BY ${sortClauses.join(', ')}`;
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
  pageData: GristRecord[];
  totalRecords: number;
  pagination: PaginationState;
  setPagination: React.Dispatch<React.SetStateAction<PaginationState>>;
  sorting: SortingState;
  setSorting: React.Dispatch<React.SetStateAction<SortingState>>;
  handleFilterChange: React.Dispatch<React.SetStateAction<any | null>>;
}

// --- 自定義 Hook 主體 ---
export const useGristData = ({ apiKey, selectedDocId, selectedTableId, onAuthError }: UseGristDataProps): UseGristDataReturn => {
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>('');
    const [documents, setDocuments] = useState<GristDocument[]>([]);
    const [tables, setTables] = useState<GristTable[]>([]);
    const [columnSchema, setColumnSchema] = useState<GristColumn[] | null>(null);
    const [pageData, setPageData] = useState<GristRecord[]>([]);
    const [totalRecords, setTotalRecords] = useState<number>(0);

    const [activeFilters, setActiveFilters] = useState<any | null>(null);
    const [sorting, setSorting] = useState<SortingState>([]);
    const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 50 });
    
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
                const orgsData = await apiRequest<Organization | Organization[]>('/api/orgs', apiKey);
                let determinedOrg: Organization | undefined;
                if (Array.isArray(orgsData)) {
                    determinedOrg = orgsData.find(org => org.domain === TARGET_ORG_DOMAIN) || orgsData[0];
                } else {
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

    // 核心的 SQL 數據獲取
    useEffect(() => {
        if (!selectedTableId || !apiKey) {
            setPageData([]);
            setColumnSchema(null);
            return;
        }
        const fetchDataWithSql = async () => {
            setIsLoading(true);
            setError('');
            
            const whereClause = buildWhereClause(activeFilters);

            try {
                const countQuery = `SELECT COUNT("id") as count FROM "${selectedTableId}" ${whereClause}`;
                const countResponse = await apiRequest<{ records: { fields: { count: number } }[] }>(
                    `/api/docs/${selectedDocId}/sql`, apiKey, 'GET', { q: countQuery }
                );
                const total = countResponse.records[0]?.fields.count || 0;
                setTotalRecords(total);

                if (total === 0) {
                    setPageData([]);
                    if (!columnSchema) {
                        const columnsResponse = await apiRequest<{ columns: GristColumn[] }>(`/api/docs/${selectedDocId}/tables/${selectedTableId}/columns`, apiKey);
                        setColumnSchema(columnsResponse.columns);
                    }
                    setIsLoading(false);
                    return;
                }
                
                const orderByClause = buildOrderByClause(sorting);
                const limit = pagination.pageSize;
                const offset = pagination.pageIndex * pagination.pageSize;
                const dataQuery = `SELECT * FROM "${selectedTableId}" ${whereClause} ${orderByClause} LIMIT ${limit} OFFSET ${offset}`;
                
                const dataResponse = await apiRequest<{ records: GristRecord[] }>(
                    `/api/docs/${selectedDocId}/sql`, apiKey, 'GET', { q: dataQuery }
                );
                setPageData(dataResponse.records);

                if (!columnSchema) {
                    const columnsResponse = await apiRequest<{ columns: GristColumn[] }>(
                        `/api/docs/${selectedDocId}/tables/${selectedTableId}/columns`, apiKey
                    );
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

        fetchDataWithSql();
    }, [apiKey, selectedDocId, selectedTableId, pagination, sorting, activeFilters, columnSchema, handleApiError]);
    
    // 當表格或篩選條件切換時，重置
    useEffect(() => {
        setPagination({ pageIndex: 0, pageSize: 50 });
        setSorting([]);
        setColumnSchema(null);
    }, [selectedTableId, activeFilters]);
    
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