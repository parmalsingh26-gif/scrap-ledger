import { useState, useEffect } from 'react';

export interface Category {
  id?: number;
  name: string;
  bgColor: string;
  hasRedBand: boolean;
}

export interface Unit {
  id?: number;
  name: string;
}

export interface Item {
  id?: number;
  name: string;
  categoryId: number;
  hsnCode?: string;
}

export interface FirmMaster {
  id?: number;
  name: string;
}

export interface InwardEntry {
  id?: number;
  itemId: number;
  quantity: number;
  unitId: number;
  date: string;
  lotNumber?: string;
  machineType?: 'MG' | 'BG';
  coverType?: 'RC' | 'FC';
  rcCount?: number;
  fcCount?: number;
  weightPerNos?: number;
}

export interface OutwardEntry {
  id?: number;
  itemId: number;
  lotNumber: string;
  hsnCode: string;
  quantity: number;
  unitId: number;
  firmName: string;
  dateLotApplied?: string;
  dateSold: string;
  dateDelivered: string;
  weightPerNos?: number;
}

export interface InventoryBalance {
  itemId: number;
  approxBalance: number;
  unitId: number;
}

// ========== BVP Scrap Position Interfaces ==========
export interface BvpScrapEntry {
  id: string;
  session: string;
  date_from: string;
  date_to: string;
  type: string;
  desc: string;
  qty_nos: string | number;
  qty_sets: string | number;
  wt_wta: number;
  wt_tb: number;
  wt_ms: number;
  wt_nf: number;
  wt_other: number;
  wt_total: number;
  lot: string;
  party: string;
  rate: number;
  amount: number;
  remarks: string;
}

export interface BvpCoachEntry {
  id: string;
  session: string;
  sr: number | string;
  coach_no: string;
  code: string;
  cat: string;
  age: string;
  cond_by: string;
  tare: string | number;
  seats: string | number;
  berths: string | number;
  cost: string | number;
  rso: string;
  rso_date: string;
  offer_date: string;
  auc1: string;
  auc2: string;
  sale_order: string;
  sale_date: string;
  purchaser: string;
  del_from: string;
  del_to: string;
  sale_amt: string | number;
  status: string;
  remarks: string;
}

export interface BvpSurveyEntry {
  id: string;
  session: string;
  lot: string;
  location: string;
  desc: string;
  qty: number;
  unit: string;
  wt: number;
  offer_date: string;
  bid: number;
  purchaser: string;
  status: string;
  category: string;
  remarks: string;
}

export interface BvpMpEntry {
  id: string;
  session: string;
  date: string;
  month: string;
  item: string;
  qty: number;
  wt: number;
  location: string;
  cond_by: string;
  lot: string;
  party: string;
  rate: number;
  amount: number;
  status: string;
  remarks: string;
}

const API_BASE = import.meta.env.PROD ? '/api' : 'http://localhost:5001/api';

const listeners = new Set<() => void>();
const notifyChange = () => {
  listeners.forEach(l => l());
};

async function apiFetch(endpoint: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers
    }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API Error ${res.status}: ${text}`);
  }
  const data = await res.json();
  if (options && options.method && options.method !== 'GET') {
    notifyChange();
  }
  return data;
}

export function useLiveQuery<T>(queryFn: () => Promise<T>, deps: any[] = []): T | undefined {
  const [data, setData] = useState<T | undefined>(undefined);
  
  useEffect(() => {
    let mounted = true;
    const fetchData = () => {
      queryFn().then(res => {
        if (mounted) setData(res);
      }).catch(console.error);
    };
    
    fetchData();
    listeners.add(fetchData);
    return () => {
      mounted = false;
      listeners.delete(fetchData);
    };
  }, deps);
  
  return data;
}

export const db = {
  categories: {
    toArray: (): Promise<Category[]> => apiFetch('/categories'),
    add: (data: any): Promise<Category> => apiFetch('/categories', { method: 'POST', body: JSON.stringify(data) }),
    clear: () => Promise.resolve(), // Used in import
    bulkAdd: (data: any[]) => Promise.all(data.map(d => db.categories.add(d)))
  },
  units: {
    toArray: (): Promise<Unit[]> => apiFetch('/units'),
    add: (data: any): Promise<Unit> => apiFetch('/units', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: number) => apiFetch(`/units/${id}`, { method: 'DELETE' }),
    clear: () => Promise.resolve(),
    bulkAdd: (data: any[]) => Promise.all(data.map(d => db.units.add(d)))
  },
  items: {
    toArray: (): Promise<Item[]> => apiFetch('/items'),
    add: (data: any): Promise<Item> => apiFetch('/items', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: number) => apiFetch(`/items/${id}`, { method: 'DELETE' }),
    update: (id: number, data: any) => apiFetch(`/items/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    clear: () => Promise.resolve(),
    bulkAdd: (data: any[]) => Promise.all(data.map(d => db.items.add(d)))
  },
  firmMasters: {
    toArray: (): Promise<FirmMaster[]> => apiFetch('/firmMasters'),
    add: (data: any): Promise<FirmMaster> => apiFetch('/firmMasters', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: number) => apiFetch(`/firmMasters/${id}`, { method: 'DELETE' }),
    clear: () => Promise.resolve(),
    bulkAdd: (data: any[]) => Promise.all(data.map(d => db.firmMasters.add(d)))
  },
  inwardEntries: {
    toArray: (): Promise<InwardEntry[]> => apiFetch('/inwardEntries'),
    add: (data: any): Promise<InwardEntry> => apiFetch('/inwardEntries', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: number) => apiFetch(`/inwardEntries/${id}`, { method: 'DELETE' }),
    update: (id: number, data: any) => apiFetch(`/inwardEntries/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    where: (field: string) => ({
      equals: (val: any) => ({
        toArray: () => db.inwardEntries.toArray().then(entries => entries.filter((e: any) => e[field] === val))
      })
    }),
    clear: () => Promise.resolve(),
    bulkAdd: (data: any[]) => Promise.all(data.map(d => db.inwardEntries.add(d)))
  },
  outwardEntries: {
    toArray: (): Promise<OutwardEntry[]> => apiFetch('/outwardEntries'),
    add: (data: any): Promise<OutwardEntry> => apiFetch('/outwardEntries', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: number) => apiFetch(`/outwardEntries/${id}`, { method: 'DELETE' }),
    update: (id: number, data: any) => apiFetch(`/outwardEntries/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    clear: () => Promise.resolve(),
    bulkAdd: (data: any[]) => Promise.all(data.map(d => db.outwardEntries.add(d)))
  },
  inventoryBalances: {
    toArray: (): Promise<InventoryBalance[]> => apiFetch('/inventoryBalances'),
    put: (data: any) => apiFetch(`/inventoryBalances/${data.itemId}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (itemId: number) => apiFetch(`/inventoryBalances/${itemId}`, { method: 'DELETE' }),
    where: (field: string) => ({
      equals: (id: number) => ({
        delete: () => apiFetch(`/custom/inventoryBalancesByItem/${id}`, { method: 'DELETE' })
      })
    }),
    clear: () => Promise.resolve(),
    bulkAdd: (data: any[]) => Promise.all(data.map(d => db.inventoryBalances.put(d)))
  },
  // ========== BVP Scrap Position ==========
  bvpScrapEntries: {
    toArray: (): Promise<BvpScrapEntry[]> => apiFetch('/bvpScrapEntries'),
    add: (data: any): Promise<BvpScrapEntry> => apiFetch('/bvpScrapEntries', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: string) => apiFetch(`/bvpScrapEntries/${id}`, { method: 'DELETE' }),
  },
  bvpCoachEntries: {
    toArray: (): Promise<BvpCoachEntry[]> => apiFetch('/bvpCoachEntries'),
    add: (data: any): Promise<BvpCoachEntry> => apiFetch('/bvpCoachEntries', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: string) => apiFetch(`/bvpCoachEntries/${id}`, { method: 'DELETE' }),
  },
  bvpSurveyEntries: {
    toArray: (): Promise<BvpSurveyEntry[]> => apiFetch('/bvpSurveyEntries'),
    add: (data: any): Promise<BvpSurveyEntry> => apiFetch('/bvpSurveyEntries', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: string) => apiFetch(`/bvpSurveyEntries/${id}`, { method: 'DELETE' }),
  },
  bvpMpEntries: {
    toArray: (): Promise<BvpMpEntry[]> => apiFetch('/bvpMpEntries'),
    add: (data: any): Promise<BvpMpEntry> => apiFetch('/bvpMpEntries', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: string) => apiFetch(`/bvpMpEntries/${id}`, { method: 'DELETE' }),
  },
  bvpInit: () => apiFetch('/bvp/init', { method: 'POST', body: JSON.stringify({}) }),
  transaction: async (mode: string, tables: any[], fn: () => Promise<void>) => {
    // Just run the function, ignore Dexie transactions
    await fn();
  }
};

// Initialization is handled by individual page loads or components
