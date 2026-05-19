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
}

export interface OutwardEntry {
  id?: number;
  itemId: number;
  lotNumber: string;
  hsnCode: string;
  quantity: number;
  unitId: number;
  firmName: string;
  dateLotApplied: string;
  dateSold: string;
  dateDelivered: string;
}

export interface InventoryBalance {
  itemId: number;
  approxBalance: number;
  unitId: number;
}

const API_BASE = 'http://localhost:5001/api';

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
  if (!res.ok) throw new Error('API Error');
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
  transaction: async (mode: string, tables: any[], fn: () => Promise<void>) => {
    // Just run the function, ignore Dexie transactions
    await fn();
  }
};

// Initialize DB on first load
apiFetch('/init', { method: 'POST', body: JSON.stringify({}) }).catch(console.error);

