import React, { useState, useMemo, useEffect } from 'react';
import mcrData from '../../Material_Condemnation_Report.json';
import { getStatus, RowStatus, StatusBadge } from '../pages/McrView';

// Need the row types here as well
interface AnyRow {
  id: string;
  type?: string | null;
  section: string;
  qty?: number | string;
  date?: string | null;
  eAuctionDate?: string | null;
  deliveryDate?: string | null;
  lotNo?: string | null;
  purchaser?: string | null;
  material?: string;
  unit?: string;
  status: RowStatus;
  _isNew?: boolean;
}

const API_BASE = import.meta.env.PROD ? '/api' : 'http://localhost:5001/api';

async function mcrApi(path: string) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API error`);
  return res.json();
}

export function McrSummary() {
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState(1);
  const [cloudData, setCloudData] = useState<{ extras: any[], edits: Record<string, any> }>({ extras: [], edits: {} });

  useEffect(() => {
    async function loadAllData() {
      setLoading(true);
      try {
        const sections = ['lot', 'coach', 'wta', 'mp'];
        let allExtras: any[] = [];
        let allEdits: Record<string, any> = {};

        for (const sec of sections) {
          const [ext, edt] = await Promise.all([
            mcrApi(`/mcr/${sec}/extras`).catch(() => []),
            mcrApi(`/mcr/${sec}/edits`).catch(() => ({}))
          ]);
          allExtras = [...allExtras, ...ext.map((x: any) => ({ ...x, section: sec }))];
          allEdits = { ...allEdits, ...edt };
        }
        setCloudData({ extras: allExtras, edits: allEdits });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadAllData();
  }, []);

  const allRows = useMemo(() => {
    const lotBase = (mcrData.lotMaterialPosition as any[]).map(r => ({ ...r, section: 'lot' }));
    const coachBase = (mcrData.coachPosition as any[]).map(r => ({ ...r, section: 'coach' }));
    const wtaBase = (mcrData.wtaPosition as any[]).map(r => ({ ...r, section: 'wta' }));
    const mpBase = (mcrData.mAndPItem as any[]).map(r => ({ ...r, section: 'mp' }));

    let baseRows = [...lotBase, ...coachBase, ...wtaBase, ...mpBase];
    baseRows = baseRows.map(r => ({ ...r, ...(cloudData.edits[r.id] || {}) }));
    
    const combined = [...baseRows, ...cloudData.extras];
    return combined.map(r => {
      const status = getStatus(r);
      return { ...r, status } as AnyRow;
    });
  }, [cloudData]);

  const SUB_TABS = [
    { id: 1, label: 'Overview', icon: 'dashboard' },
    { id: 2, label: 'Lot-Wise', icon: 'list_alt' },
    { id: 3, label: 'Month-Wise', icon: 'calendar_month' },
    { id: 4, label: 'Purchasers', icon: 'groups' },
    { id: 5, label: 'Materials', icon: 'category' },
    { id: 6, label: 'Sections', icon: 'pie_chart' },
    { id: 7, label: 'Date Report', icon: 'date_range' },
    { id: 8, label: 'Timeline', icon: 'schedule' },
  ];

  if (loading) return <div className="flex justify-center p-20 text-primary"><span className="material-symbols-outlined animate-spin text-[32px]">progress_activity</span></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-end flex-wrap gap-4">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin flex-1">
          {SUB_TABS.map(st => (
            <button key={st.id} onClick={() => setActiveSubTab(st.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeSubTab === st.id 
                  ? 'bg-primary text-white shadow-md' 
                  : 'bg-surface-container hover:bg-primary/10 text-on-surface-variant'
              }`}>
              <span className="material-symbols-outlined text-[16px]">{st.icon}</span>{st.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 pb-2">
          <button onClick={() => import('../utils/exportMcr').then(m => m.exportMcrToExcel(allRows))} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold hover:bg-emerald-100 hover:-translate-y-0.5 hover:shadow-sm transition-all whitespace-nowrap shadow-sm">
            <span className="material-symbols-outlined text-[16px]">table_chart</span>Export Excel
          </button>
          <button onClick={() => import('../utils/exportMcr').then(m => m.exportMcrToPdf(allRows))} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 text-red-700 border border-red-200 text-xs font-bold hover:bg-red-100 hover:-translate-y-0.5 hover:shadow-sm transition-all whitespace-nowrap shadow-sm">
            <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>Export PDF
          </button>
        </div>
      </div>

      <div className="bg-white/50 border border-outline-variant/30 rounded-2xl p-4 shadow-sm min-h-[500px]">
        {activeSubTab === 1 && <OverviewView rows={allRows} />}
        {activeSubTab === 2 && <LotWiseView rows={allRows} />}
        {activeSubTab === 3 && <MonthWiseView rows={allRows} />}
        {activeSubTab === 4 && <PurchaserView rows={allRows} />}
        {activeSubTab === 5 && <MaterialView rows={allRows} />}
        {activeSubTab === 6 && <SectionView rows={allRows} />}
        {activeSubTab === 7 && <DateReportView rows={allRows} />}
        {activeSubTab === 8 && <TimelineView rows={allRows} />}
      </div>
    </div>
  );
}

// 1. Overview Dashboard
function OverviewView({ rows }: { rows: AnyRow[] }) {
  const total = rows.length;
  const delivered = rows.filter(r => r.status === 'delivered').length;
  const pending = rows.filter(r => r.status === 'pending').length;
  const cancelled = rows.filter(r => r.status === 'cancelled').length;
  const pct = total ? Math.round((delivered / total) * 100) : 0;
  
  const purchasers = new Set(rows.map(r => (r.purchaser || '').trim().toUpperCase()).filter(Boolean)).size;
  
  // Pending lots sorted by auction date oldest
  const parseDate = (d: string) => {
    if (!d) return 0;
    const parts = d.split(/[\/\-\.]/);
    if (parts.length === 3) return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).getTime();
    return 0;
  };
  const topPending = rows.filter(r => r.status === 'pending' && r.eAuctionDate).sort((a, b) => parseDate(a.eAuctionDate!) - parseDate(b.eAuctionDate!)).slice(0, 5);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Lots', val: total, color: 'text-primary' },
          { label: 'Delivered', val: delivered, color: 'text-emerald-600' },
          { label: 'Pending', val: pending, color: 'text-amber-600' },
          { label: 'Cancelled', val: cancelled, color: 'text-red-600' },
        ].map(s => (
          <div key={s.label} className="bg-surface-container rounded-xl p-4 text-center border border-outline-variant/20 shadow-sm">
            <div className={`text-3xl font-extrabold font-data-mono ${s.color}`}>{s.val}</div>
            <div className="text-xs font-bold text-outline mt-1 uppercase tracking-wider">{s.label}</div>
          </div>
        ))}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-primary/5 to-secondary/10 rounded-xl p-5 border border-primary/20">
          <h3 className="font-bold text-on-surface mb-4 flex items-center gap-2"><span className="material-symbols-outlined text-primary">donut_large</span>Overall Delivery Rate</h3>
          <div className="flex items-center gap-4">
            <div className="relative w-24 h-24 rounded-full flex items-center justify-center bg-white shadow-inner" style={{ background: `conic-gradient(#10b981 ${pct}%, #e5e7eb ${pct}%)` }}>
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center font-bold text-xl">{pct}%</div>
            </div>
            <div>
              <p className="text-sm font-medium text-outline"><span className="text-emerald-600 font-bold">{delivered}</span> delivered out of {total}</p>
              <p className="text-xs text-outline mt-1">{purchasers} Unique Purchasers Active</p>
            </div>
          </div>
        </div>

        <div className="bg-amber-50/50 rounded-xl p-5 border border-amber-200/50">
          <h3 className="font-bold text-amber-800 mb-4 flex items-center gap-2"><span className="material-symbols-outlined">warning</span>Urgent Pending Lots</h3>
          <div className="space-y-2">
            {topPending.map(r => (
              <div key={r.id} className="flex justify-between items-center text-xs bg-white p-2 rounded-lg border border-amber-100 shadow-sm">
                <span className="font-bold font-mono text-amber-700">{r.lotNo || r.material?.substring(0,15)}</span>
                <span className="text-outline">Auction: {r.eAuctionDate}</span>
                <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold uppercase">{r.section}</span>
              </div>
            ))}
            {topPending.length === 0 && <p className="text-xs text-outline">No pending lots found.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// 2. Lot-Wise Summary
function LotWiseView({ rows }: { rows: AnyRow[] }) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter(r => !q || (r.lotNo || '').toLowerCase().includes(q) || (r.material || '').toLowerCase().includes(q) || (r.purchaser || '').toLowerCase().includes(q));
  }, [rows, search]);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-outline">search</span>
        <input className="flex-1 bg-white border border-outline-variant/30 px-3 py-2 rounded-xl text-sm focus:outline-primary" placeholder="Search across all sections (lot no, material, purchaser)..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="overflow-x-auto max-h-[450px] border border-outline-variant/30 rounded-xl shadow-sm">
        <table className="w-full text-xs text-left">
          <thead className="bg-surface-container sticky top-0">
            <tr>
              {['Section', 'Lot No', 'Material', 'Qty', 'Purchaser', 'Auction Date', 'Status'].map(h => <th key={h} className="p-3 font-bold border-b whitespace-nowrap">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 100).map(r => (
              <tr key={r.id} className="border-b hover:bg-black/5 bg-white">
                <td className="p-3 uppercase font-bold text-outline">{r.section}</td>
                <td className="p-3 font-mono font-bold text-primary">{r.lotNo || '—'}</td>
                <td className="p-3 max-w-[200px] truncate" title={r.material}>{r.material || '—'}</td>
                <td className="p-3 font-data-mono">{r.qty} {r.unit}</td>
                <td className="p-3 max-w-[150px] truncate">{r.purchaser || '—'}</td>
                <td className="p-3">{r.eAuctionDate || '—'}</td>
                <td className="p-3"><StatusBadge status={r.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-outline text-right">Showing top 100 results ({filtered.length} total)</p>
    </div>
  );
}

// 3. Month-Wise
function MonthWiseView({ rows }: { rows: AnyRow[] }) {
  const [year, setYear] = useState('2023');
  const [type, setType] = useState<'condn' | 'auction' | 'delivery'>('auction');

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  
  const getMonthStr = (d: string | null | undefined) => {
    if (!d) return null;
    const parts = d.split(/[\/\-\.]/);
    if (parts.length === 3) {
      let y = parts[2];
      if (y.length === 2) y = '20' + y;
      if (y === year) return parseInt(parts[1], 10) - 1; // 0-11
    }
    return null;
  };

  const data = useMemo(() => {
    const counts = new Array(12).fill(0);
    rows.forEach(r => {
      let d = type === 'condn' ? r.date : type === 'auction' ? r.eAuctionDate : r.deliveryDate;
      const m = getMonthStr(d);
      if (m !== null && m >= 0 && m < 12) counts[m]++;
    });
    return counts;
  }, [rows, year, type]);

  const max = Math.max(...data, 1);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex gap-4 items-center">
        <select value={year} onChange={e => setYear(e.target.value)} className="bg-white border px-3 py-2 rounded-xl text-sm font-bold focus:outline-primary">
          {['2022', '2023', '2024', '2025', '2026'].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={type} onChange={e => setType(e.target.value as any)} className="bg-white border px-3 py-2 rounded-xl text-sm font-bold focus:outline-primary">
          <option value="condn">Condemnation Month</option>
          <option value="auction">Auction Month</option>
          <option value="delivery">Delivery Month</option>
        </select>
      </div>

      <div className="h-64 flex items-end gap-2 border-b border-outline-variant/30 pb-2">
        {data.map((val, i) => (
          <div key={i} className="flex-1 flex flex-col items-center justify-end group h-full">
            <div className="text-[10px] font-bold text-primary mb-1 opacity-0 group-hover:opacity-100 transition-opacity">{val}</div>
            <div className="w-full bg-primary/80 rounded-t-sm hover:bg-primary transition-all flex-shrink-0" style={{ height: `${(val / max) * 100}%`, minHeight: val ? '4px' : '0' }}></div>
            <div className="text-[10px] text-outline mt-2">{months[i]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 4. Purchaser-Wise
function PurchaserView({ rows }: { rows: AnyRow[] }) {
  const [search, setSearch] = useState('');
  
  const data = useMemo(() => {
    const map: Record<string, { total: number, delivered: number, pending: number }> = {};
    rows.forEach(r => {
      const p = (r.purchaser || '').trim().toUpperCase();
      if (!p) return;
      if (!map[p]) map[p] = { total: 0, delivered: 0, pending: 0 };
      map[p].total++;
      if (r.status === 'delivered') map[p].delivered++;
      if (r.status === 'pending') map[p].pending++;
    });
    return Object.entries(map)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.total - a.total);
  }, [rows]);

  const filtered = data.filter(d => d.name.includes(search.toUpperCase()));

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-outline">search</span>
        <input className="w-full bg-white border border-outline-variant/30 px-3 py-2 rounded-xl text-sm focus:outline-primary" placeholder="Search Purchaser..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[450px] overflow-y-auto pr-2">
        {filtered.map(p => (
          <div key={p.name} className="border border-outline-variant/30 rounded-xl p-3 bg-white shadow-sm hover:border-primary/50 transition-all group">
            <div className="font-bold text-sm text-on-surface truncate group-hover:text-primary transition-colors" title={p.name}>{p.name}</div>
            <div className="flex gap-2 mt-2 text-xs">
              <span className="bg-primary/10 text-primary px-2 py-0.5 rounded font-bold">{p.total} Lots</span>
              <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold">{p.delivered} Done</span>
              <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-bold">{p.pending} Pend</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 5. Material-Wise
function MaterialView({ rows }: { rows: AnyRow[] }) {
  const data = useMemo(() => {
    const map: Record<string, number> = {};
    rows.forEach(r => {
      const m = (r.material || '').trim().toUpperCase();
      if (!m) return;
      map[m] = (map[m] || 0) + 1;
    });
    return Object.entries(map).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [rows]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[450px] overflow-y-auto animate-fade-in pr-2">
      {data.slice(0, 100).map(m => (
        <div key={m.name} className="flex justify-between items-center p-3 border border-outline-variant/20 rounded-lg text-sm bg-white shadow-sm hover:bg-surface-container transition-colors">
          <span className="truncate pr-2 text-on-surface font-medium" title={m.name}>{m.name}</span>
          <span className="font-mono font-bold bg-primary/10 px-2 py-0.5 rounded text-primary text-xs">{m.count} Lots</span>
        </div>
      ))}
    </div>
  );
}

// 6. Section Comparison
function SectionView({ rows }: { rows: AnyRow[] }) {
  const sections = ['lot', 'coach', 'wta', 'mp'];
  const data = sections.map(sec => {
    const sr = rows.filter(r => r.section === sec);
    return {
      sec,
      total: sr.length,
      delivered: sr.filter(r => r.status === 'delivered').length,
      pending: sr.filter(r => r.status === 'pending').length
    };
  });

  return (
    <div className="space-y-4 animate-fade-in">
      {data.map(d => (
        <div key={d.sec} className="bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between font-bold uppercase tracking-wider mb-2">
            <span className="text-primary text-lg">{d.sec}</span>
            <span className="text-on-surface">{d.total} Lots</span>
          </div>
          <div className="flex h-6 rounded-full overflow-hidden bg-surface-container border border-outline-variant/30">
            <div className="bg-emerald-500 h-full flex items-center justify-center text-[10px] text-white font-bold" style={{ width: `${(d.delivered/(d.total||1))*100}%` }}>
              {d.delivered > 0 && `${Math.round((d.delivered/(d.total||1))*100)}%`}
            </div>
            <div className="bg-amber-500 h-full flex items-center justify-center text-[10px] text-white font-bold" style={{ width: `${(d.pending/(d.total||1))*100}%` }}>
              {d.pending > 0 && `${Math.round((d.pending/(d.total||1))*100)}%`}
            </div>
          </div>
          <div className="flex justify-between text-xs mt-2 text-outline">
            <span><strong className="text-emerald-700">{d.delivered}</strong> Delivered</span>
            <span><strong className="text-amber-700">{d.pending}</strong> Pending</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// 7. Date Report
function DateReportView({ rows }: { rows: AnyRow[] }) {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [dateType, setDateType] = useState<'condn' | 'auction' | 'delivery'>('auction');

  const parseDateStr = (d: string | null | undefined) => {
    if (!d) return 0;
    const parts = d.split(/[\/\-\.]/);
    if (parts.length === 3) {
      let y = parts[2];
      if (y.length === 2) y = '20' + y;
      return new Date(`${y}-${parts[1]}-${parts[0]}`).getTime();
    }
    return 0;
  };

  const filtered = useMemo(() => {
    if (!fromDate || !toDate) return [];
    const fromTs = new Date(fromDate).getTime();
    const toTs = new Date(toDate).getTime();
    
    return rows.filter(r => {
      let d = dateType === 'condn' ? r.date : dateType === 'auction' ? r.eAuctionDate : r.deliveryDate;
      const ts = parseDateStr(d);
      return ts >= fromTs && ts <= toTs;
    });
  }, [rows, fromDate, toDate, dateType]);

  const totalLots = filtered.length;
  const totalDelivered = filtered.filter(r => r.status === 'delivered').length;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-wrap gap-4 items-end bg-surface-container/50 p-4 rounded-xl border border-outline-variant/30">
        <div>
          <label className="block text-[10px] font-bold text-outline uppercase mb-1">Date Field</label>
          <select value={dateType} onChange={e => setDateType(e.target.value as any)} className="bg-white border border-outline-variant/30 px-3 py-2 rounded-xl text-sm font-bold focus:outline-primary">
            <option value="condn">Condemnation Date</option>
            <option value="auction">Auction Date</option>
            <option value="delivery">Delivery Date</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-outline uppercase mb-1">From Date</label>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="bg-white border border-outline-variant/30 px-3 py-2 rounded-xl text-sm focus:outline-primary" />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-outline uppercase mb-1">To Date</label>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="bg-white border border-outline-variant/30 px-3 py-2 rounded-xl text-sm focus:outline-primary" />
        </div>
      </div>

      {fromDate && toDate ? (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-primary/5 p-3 rounded-xl border border-primary/20">
            <span className="font-bold text-primary">Found {totalLots} lots</span>
            <span className="text-sm font-medium text-outline"><strong className="text-emerald-700">{totalDelivered}</strong> Delivered</span>
          </div>
          <div className="overflow-x-auto max-h-[350px] border border-outline-variant/30 rounded-xl shadow-sm">
            <table className="w-full text-xs text-left bg-white">
              <thead className="bg-surface-container sticky top-0">
                <tr>
                  {['Section', 'Lot No', 'Material', 'Qty', 'Purchaser', 'Date', 'Status'].map(h => <th key={h} className="p-3 font-bold border-b">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="border-b hover:bg-black/5">
                    <td className="p-3 uppercase font-bold text-outline">{r.section}</td>
                    <td className="p-3 font-mono font-bold text-primary">{r.lotNo || '—'}</td>
                    <td className="p-3 max-w-[200px] truncate" title={r.material}>{r.material || '—'}</td>
                    <td className="p-3 font-data-mono">{r.qty} {r.unit}</td>
                    <td className="p-3 max-w-[150px] truncate">{r.purchaser || '—'}</td>
                    <td className="p-3 font-medium">
                      {dateType === 'condn' ? r.date : dateType === 'auction' ? r.eAuctionDate : r.deliveryDate}
                    </td>
                    <td className="p-3"><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-outline italic">No records found for this date range.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="p-10 text-center text-outline bg-surface-container-low rounded-xl border border-dashed border-outline-variant/50">
          <span className="material-symbols-outlined text-4xl text-outline-variant mb-2">date_range</span>
          <p>Please select From and To dates to generate a report.</p>
        </div>
      )}
    </div>
  );
}

// 8. Timeline (Overdue alerts)
function TimelineView({ rows }: { rows: AnyRow[] }) {
  const parseDateTs = (d: string | null | undefined) => {
    if (!d) return 0;
    const parts = d.split(/[\/\-\.]/);
    if (parts.length === 3) {
      let y = parts[2];
      if (y.length === 2) y = '20' + y;
      return new Date(`${y}-${parts[1]}-${parts[0]}`).getTime();
    }
    return 0;
  };

  const now = Date.now();
  const ONE_DAY = 1000 * 60 * 60 * 24;

  const overdueLots = useMemo(() => {
    const pending = rows.filter(r => r.status === 'pending' && r.eAuctionDate);
    return pending.map(r => {
      const ts = parseDateTs(r.eAuctionDate);
      const daysOverdue = ts ? Math.floor((now - ts) / ONE_DAY) : 0;
      return { ...r, daysOverdue };
    }).filter(r => r.daysOverdue >= 0).sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [rows, now]);

  const critical = overdueLots.filter(r => r.daysOverdue > 180);
  const warning = overdueLots.filter(r => r.daysOverdue > 90 && r.daysOverdue <= 180);
  const normal = overdueLots.filter(r => r.daysOverdue <= 90);

  const SectionList = ({ title, lots, colorClass, icon }: { title: string, lots: any[], colorClass: string, icon: string }) => (
    <div className={`border rounded-xl p-4 bg-white shadow-sm ${colorClass}`}>
      <h3 className="font-bold flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined">{icon}</span>
        {title} ({lots.length})
      </h3>
      <div className="max-h-[250px] overflow-y-auto space-y-2 pr-2">
        {lots.map(r => (
          <div key={r.id} className="flex justify-between items-center p-2 bg-surface-container rounded-lg border border-outline-variant/30 text-xs hover:border-current transition-colors">
            <div>
              <div className="font-bold font-mono text-on-surface">{r.lotNo || r.material?.substring(0, 15)}</div>
              <div className="text-outline mt-0.5">{r.eAuctionDate}</div>
            </div>
            <div className="text-right">
              <div className="font-bold uppercase opacity-80">{r.section}</div>
              <div className="font-bold mt-0.5">{r.daysOverdue} days</div>
            </div>
          </div>
        ))}
        {lots.length === 0 && <div className="text-xs text-outline italic p-2">None</div>}
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in">
      <SectionList title="Critical (>180 Days)" lots={critical} colorClass="border-red-200 text-red-800" icon="error" />
      <SectionList title="Warning (>90 Days)" lots={warning} colorClass="border-amber-200 text-amber-800" icon="warning" />
      <SectionList title="Normal (<=90 Days)" lots={normal} colorClass="border-blue-200 text-blue-800" icon="info" />
    </div>
  );
}
