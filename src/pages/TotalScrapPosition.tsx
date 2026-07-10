import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Chart, registerables } from 'chart.js';
import { db, useLiveQuery } from '../db/db';

Chart.register(...registerables);

// ── Density factors for unit conversion (Kg per unit) ──────────────────────
const DENSITY: Record<string, number> = {
  'LTR': 0.85,   // General oils/lubricants
  'KL':  850,    // Kilolitres
  'L':   0.85,
};

function convertToMT(qty: number, unit: string): number | null {
  if (unit === 'MT') return qty;
  if (unit === 'Kg' || unit === 'KG') return qty / 1000;
  const density = DENSITY[unit.toUpperCase()];
  if (density) return (qty * density) / 1000;
  return null;
}

function fmtNum(n: number, dec = 2): string {
  if (Object.is(n, -0)) n = 0; // negative zero fix
  return n.toFixed(dec).replace(/\.?0+$/, '') || '0';
}

// ── Unit Converter Widget ──────────────────────────────────────────────────
function UnitConverterWidget() {
  const [value, setValue] = useState('');
  const [fromUnit, setFromUnit] = useState('Kg');
  const [toUnit, setToUnit] = useState('MT');
  const [density, setDensity] = useState('0.85');

  const UNITS = ['MT', 'Kg', 'LTR', 'KL', 'Nos', 'Sets'];

  const convert = useCallback(() => {
    const v = Number(value);
    if (!v || !fromUnit || !toUnit) return '—';
    // Convert fromUnit → Kg first
    let kg: number;
    if (fromUnit === 'Kg') kg = v;
    else if (fromUnit === 'MT') kg = v * 1000;
    else if (fromUnit === 'LTR' || fromUnit === 'L') kg = v * Number(density);
    else if (fromUnit === 'KL') kg = v * Number(density) * 1000;
    else return `${v} ${fromUnit}`;
    // Convert Kg → toUnit
    if (toUnit === 'Kg') return `${fmtNum(kg, 3)} Kg`;
    if (toUnit === 'MT') return `${fmtNum(kg / 1000, 4)} MT`;
    if (toUnit === 'LTR') return `${fmtNum(kg / Number(density), 2)} LTR`;
    return `${fmtNum(kg, 3)} Kg → ${toUnit}`;
  }, [value, fromUnit, toUnit, density]);

  return (
    <div className="tsp-card">
      <div className="tsp-card-header">
        <span className="material-symbols-outlined text-amber-600">calculate</span>
        <h3 className="tsp-card-title">Unit Converter</h3>
        <span className="text-xs text-gray-400 ml-auto">Interactive calculator</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
        <div>
          <label className="tsp-label">Value</label>
          <input type="number" step="any" className="tsp-input" value={value} onChange={e => setValue(e.target.value)} placeholder="Enter quantity" />
        </div>
        <div>
          <label className="tsp-label">From Unit</label>
          <select className="tsp-input" value={fromUnit} onChange={e => setFromUnit(e.target.value)}>
            {UNITS.map(u => <option key={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label className="tsp-label">To Unit</label>
          <select className="tsp-input" value={toUnit} onChange={e => setToUnit(e.target.value)}>
            {UNITS.map(u => <option key={u}>{u}</option>)}
          </select>
        </div>
        {(fromUnit === 'LTR' || fromUnit === 'KL') && (
          <div>
            <label className="tsp-label">Density (Kg/L)</label>
            <input type="number" step="0.001" className="tsp-input" value={density} onChange={e => setDensity(e.target.value)} />
          </div>
        )}
        <div className="sm:col-span-1">
          <div className="tsp-result-box">
            <span className="material-symbols-outlined text-emerald-600 text-[18px]">swap_horiz</span>
            <span className="text-base font-bold text-emerald-700">{value ? convert() : '—'}</span>
          </div>
        </div>
      </div>
      {(fromUnit === 'LTR' || fromUnit === 'KL') && (
        <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
          <span className="material-symbols-outlined text-[12px]">info</span>
          Using density: {density} Kg/L. Standard oil = 0.85 Kg/L.
        </p>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export function TotalScrapPosition() {
  const items = useLiveQuery(() => db.items.toArray());
  const categories = useLiveQuery(() => db.categories.toArray());
  const units = useLiveQuery(() => db.units.toArray());
  const inwardEntries = useLiveQuery(() => db.inwardEntries.toArray());
  const outwardEntries = useLiveQuery(() => db.outwardEntries.toArray());

  const [activeTab, setActiveTab] = useState<'overview' | 'monthly' | 'pending' | 'converter'>('overview');
  const [selectedCatId, setSelectedCatId] = useState<number | 'all'>('all');

  // ── Monthly Inward Manual Overrides (persisted in localStorage) ────────────
  // Key: YYYY-MM, Value: manual inwardMT override
  const LS_KEY = 'tsp_monthly_inward_overrides';
  const [monthlyOverrides, setMonthlyOverrides] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });

  // Inline edit state: which month is being edited and its draft value
  const [editingMonth, setEditingMonth] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<string>('');

  const saveOverride = (ym: string, value: string) => {
    const num = parseFloat(value);
    setMonthlyOverrides(prev => {
      const next = { ...prev };
      if (isNaN(num) || value.trim() === '') {
        delete next[ym]; // revert to auto
      } else {
        next[ym] = num;
      }
      localStorage.setItem(LS_KEY, JSON.stringify(next));
      return next;
    });
    setEditingMonth(null);
  };

  const resetOverride = (ym: string) => {
    setMonthlyOverrides(prev => {
      const next = { ...prev };
      delete next[ym];
      localStorage.setItem(LS_KEY, JSON.stringify(next));
      return next;
    });
  };

  const barChartRef = useRef<HTMLCanvasElement>(null);
  const pieChartRef = useRef<HTMLCanvasElement>(null);
  const chartInstances = useRef<Record<string, Chart>>({});

  const unitMap = useMemo(() => new Map((units || []).map(u => [u.id!, u.name])), [units]);
  const catMap = useMemo(() => new Map((categories || []).map(c => [c.id!, c])), [categories]);

  // ── Aggregation by category ──────────────────────────────────────────────
  const categoryData = useMemo(() => {
    if (!items || !categories || !units || !inwardEntries || !outwardEntries) return [];

    return categories.map(cat => {
      const catItems = items.filter(i => i.categoryId === cat.id);

      // Per-unit aggregation
      const inwardByUnit: Record<string, number> = {};
      const outwardByUnit: Record<string, number> = {};
      let inwardMT = 0, outwardMT = 0;
      let nosInward = 0, nosOutward = 0;
      let hasNos = false;

      catItems.forEach(item => {
        const iEntries = inwardEntries.filter(e => e.itemId === item.id);
        const oEntries = outwardEntries.filter(e => e.itemId === item.id);

        iEntries.forEach(e => {
          const uName = unitMap.get(e.unitId) || 'Unknown';
          inwardByUnit[uName] = (inwardByUnit[uName] || 0) + e.quantity;
          const asMT = convertToMT(e.quantity, uName);
          if (asMT !== null) inwardMT += asMT;
          if (uName === 'Nos') { hasNos = true; nosInward += e.quantity; }
        });

        oEntries.forEach(e => {
          const uName = unitMap.get(e.unitId) || 'Unknown';
          outwardByUnit[uName] = (outwardByUnit[uName] || 0) + e.quantity;
          const asMT = convertToMT(e.quantity, uName);
          if (asMT !== null) outwardMT += asMT;
          if (uName === 'Nos') { nosOutward += e.quantity; }
        });
      });

      // Mixed unit balance string
      const balByUnit: Record<string, number> = {};
      const allUnits = new Set([...Object.keys(inwardByUnit), ...Object.keys(outwardByUnit)]);
      allUnits.forEach(u => {
        balByUnit[u] = (inwardByUnit[u] || 0) - (outwardByUnit[u] || 0);
      });

      const balStr = Object.entries(balByUnit)
        .filter(([, v]) => Math.abs(v) > 0)
        .map(([u, v]) => `${v >= 0 ? '+' : ''}${fmtNum(v, 2)} ${u}`)
        .join(' + ') || '—';

      return {
        cat,
        inwardByUnit,
        outwardByUnit,
        balByUnit,
        balStr,
        inwardMT: +inwardMT.toFixed(3),
        outwardMT: +outwardMT.toFixed(3),
        netMT: +(inwardMT - outwardMT).toFixed(3),
        hasNos,
        nosInward,
        nosOutward,
        itemCount: catItems.length,
      };
    });
  }, [items, categories, units, inwardEntries, outwardEntries, unitMap]);

  // ── Month-wise Aggregation ───────────────────────────────────────────────
  const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const monthlyData = useMemo(() => {
    if (!inwardEntries || !outwardEntries || !units) return [];

    // Collect all year-month keys from both inward and outward entries
    const monthSet = new Set<string>();
    inwardEntries.forEach(e => {
      if (e.date) monthSet.add(e.date.slice(0, 7)); // YYYY-MM
    });
    outwardEntries.forEach(e => {
      if (e.dateSold) monthSet.add(e.dateSold.slice(0, 7));
    });

    // Sort months chronologically
    const sortedMonths = Array.from(monthSet).sort();

    return sortedMonths.map(ym => {
      const [year, mon] = ym.split('-');
      const label = MONTH_LABELS[parseInt(mon) - 1] + '-' + year.slice(2);

      // Inward entries for this month
      const iEntries = inwardEntries.filter(e => (e.date || '').startsWith(ym));
      let inwardMT = 0;
      const inwardByUnit: Record<string, number> = {};
      iEntries.forEach(e => {
        const uName = unitMap.get(e.unitId) || 'Unknown';
        inwardByUnit[uName] = (inwardByUnit[uName] || 0) + e.quantity;
        const asMT = convertToMT(e.quantity, uName);
        if (asMT !== null) inwardMT += asMT;
      });

      // Outward entries for this month
      const oEntries = outwardEntries.filter(e => (e.dateSold || '').startsWith(ym));
      let outwardMT = 0;
      const outwardByUnit: Record<string, number> = {};
      oEntries.forEach(e => {
        const uName = unitMap.get(e.unitId) || 'Unknown';
        outwardByUnit[uName] = (outwardByUnit[uName] || 0) + e.quantity;
        const asMT = convertToMT(e.quantity, uName);
        if (asMT !== null) outwardMT += asMT;
      });

      const netMT = inwardMT - outwardMT;

      return {
        ym,
        label,
        inwardMT: +inwardMT.toFixed(3),
        inwardMT_auto: +inwardMT.toFixed(3), // always raw auto-calculated
        outwardMT: +outwardMT.toFixed(3),
        netMT: +netMT.toFixed(3),
        inwardCount: iEntries.length,
        outwardCount: oEntries.length,
        inwardByUnit,
        outwardByUnit,
      };
    });
  }, [inwardEntries, outwardEntries, units, unitMap]);

  // Apply overrides on top of raw monthly data
  const monthlyDataWithOverrides = useMemo(() => {
    return monthlyData.map(m => {
      const override = monthlyOverrides[m.ym];
      if (override !== undefined) {
        const newNet = override - m.outwardMT;
        return { ...m, inwardMT: override, netMT: +newNet.toFixed(3), isOverridden: true };
      }
      return { ...m, isOverridden: false };
    });
  }, [monthlyData, monthlyOverrides]);

  // ── Pending entries audit ─────────────────────────────────────────────────
  const pendingEntries = useMemo(() => {
    if (!outwardEntries || !inwardEntries || !items || !units) return [];
    const pending: Array<{
      id: number; type: 'INWARD' | 'OUTWARD'; itemName: string; reason: string; date: string;
    }> = [];

    outwardEntries.forEach(e => {
      const item = items.find(i => i.id === e.itemId);
      const uName = unitMap.get(e.unitId) || '';
      if (!e.dateLotApplied) {
        pending.push({ id: e.id!, type: 'OUTWARD', itemName: item?.name || '?', reason: 'Missing Date of Lot Applied', date: e.dateSold });
      }
      if (uName === 'Nos' && !e.weightPerNos) {
        pending.push({ id: e.id!, type: 'OUTWARD', itemName: item?.name || '?', reason: 'Missing Weight per NOS', date: e.dateSold });
      }
    });

    inwardEntries.forEach(e => {
      const item = items.find(i => i.id === e.itemId);
      const uName = unitMap.get(e.unitId) || '';
      if (uName === 'Nos' && !e.weightPerNos) {
        pending.push({ id: e.id!, type: 'INWARD', itemName: item?.name || '?', reason: 'Missing Weight per NOS', date: e.date });
      }
    });

    return pending.sort((a, b) => b.date.localeCompare(a.date));
  }, [outwardEntries, inwardEntries, items, unitMap, units]);

  // ── Chart rendering ───────────────────────────────────────────────────────
  const mkChart = useCallback((ref: React.RefObject<HTMLCanvasElement | null>, id: string, cfg: any) => {
    if (!ref.current) return;
    if (chartInstances.current[id]) { chartInstances.current[id].destroy(); delete chartInstances.current[id]; }
    chartInstances.current[id] = new Chart(ref.current, cfg);
  }, []);

  useEffect(() => {
    if (activeTab !== 'overview' || !categoryData.length || selectedCatId !== 'all') return;
    const timer = setTimeout(() => {
      const labels = categoryData.map(d => d.cat.name);
      const inMT = categoryData.map(d => d.inwardMT);
      const outMT = categoryData.map(d => d.outwardMT);
      const netMT = categoryData.map(d => d.netMT);

      const GC = 'rgba(128,128,128,0.1)';
      const TC = '#999';

      mkChart(barChartRef, 'tspBar', {
        type: 'bar',
        data: {
          labels,
          datasets: [
            { label: 'Total Inward (MT)', data: inMT, backgroundColor: '#3B82F6', borderRadius: 4 },
            { label: 'Total Outward (MT)', data: outMT, backgroundColor: '#F59E0B', borderRadius: 4 },
            { label: 'Net Balance (MT)', data: netMT, backgroundColor: netMT.map(v => v >= 0 ? '#10B981' : '#EF4444'), borderRadius: 4 },
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { labels: { color: '#6B7280', font: { size: 11 } } } },
          scales: {
            x: { grid: { color: GC }, ticks: { color: TC, font: { size: 11 } } },
            y: { grid: { color: GC }, ticks: { color: TC, font: { size: 11 }, callback: (v: any) => v + ' MT' } }
          },
          animation: { duration: 700, easing: 'easeInOutQuart' as const }
        }
      });

      const netTotals = categoryData.map(d => Math.max(0, d.netMT));
      const totalNet = netTotals.reduce((a, b) => a + b, 0) || 1;
      mkChart(pieChartRef, 'tspPie', {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{ data: netTotals, backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'], borderWidth: 3, hoverOffset: 6 }]
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '62%',
          plugins: { legend: { position: 'bottom' as const, labels: { color: '#6B7280', font: { size: 11 } } } },
          animation: { duration: 700 }
        }
      });
    }, 100);
    return () => clearTimeout(timer);
  }, [activeTab, categoryData, mkChart, selectedCatId]);

  // ── Filtered data ─────────────────────────────────────────────────────────
  const displayData = selectedCatId === 'all'
    ? categoryData
    : categoryData.filter(d => d.cat.id === selectedCatId);

  const totalInMT = categoryData.reduce((a, d) => a + d.inwardMT, 0);
  const totalOutMT = categoryData.reduce((a, d) => a + d.outwardMT, 0);
  const totalNetMT = totalInMT - totalOutMT;

  if (!items || !categories || !units || !inwardEntries || !outwardEntries) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1", fontSize: '32px' }}>analytics</span>
            Total Scrap Position
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">
            Category-wise live analytics • Mixed-unit handling • Unit converter
          </p>
        </div>
        {pendingEntries.length > 0 && (
          <button
            onClick={() => setActiveTab('pending')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-700 text-sm font-medium hover:bg-amber-100 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">warning</span>
            {pendingEntries.length} Pending Details
          </button>
        )}
      </div>

      {/* Top KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Inward (Converted)', value: `${fmtNum(totalInMT, 2)} MT`, icon: 'arrow_downward', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
          { label: 'Total Outward (Converted)', value: `${fmtNum(totalOutMT, 2)} MT`, icon: 'arrow_upward', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
          { label: 'Net Balance (Approx)', value: `${fmtNum(totalNetMT, 2)} MT`, icon: 'scale', color: totalNetMT >= 0 ? 'text-emerald-600' : 'text-red-600', bg: totalNetMT >= 0 ? 'bg-emerald-50' : 'bg-red-50', border: totalNetMT >= 0 ? 'border-emerald-200' : 'border-red-200' },
        ].map((k, i) => (
          <div key={i} className={`glass-card rounded-xl p-4 border ${k.border} ${k.bg}`}>
            <div className="flex items-center gap-3">
              <span className={`material-symbols-outlined ${k.color} text-[28px]`} style={{ fontVariationSettings: "'FILL' 1" }}>{k.icon}</span>
              <div>
                <p className="text-xs text-gray-500 font-medium">{k.label}</p>
                <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 flex-wrap">
        {[
          { id: 'overview', label: 'Category Overview', icon: 'bar_chart' },
          { id: 'monthly', label: 'Monthly Summary', icon: 'calendar_month' },
          { id: 'pending', label: `Pending (${pendingEntries.length})`, icon: 'pending_actions' },
          { id: 'converter', label: 'Unit Converter', icon: 'calculate' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-white shadow-sm text-primary'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Category filter */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-medium text-gray-500">Filter by category:</span>
            <button
              onClick={() => setSelectedCatId('all')}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${selectedCatId === 'all' ? 'bg-primary text-white border-primary' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'}`}
            >
              All
            </button>
            {categories.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedCatId(c.id!)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${selectedCatId === c.id ? 'bg-primary text-white border-primary' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'}`}
                style={selectedCatId === c.id ? {} : { borderColor: c.bgColor + '60' }}
              >
                {c.name}
              </button>
            ))}
          </div>

          {/* Charts — always mounted, hidden via CSS when a category is selected */}
          <div style={{ display: selectedCatId === 'all' ? 'grid' : 'none' }} className="grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="tsp-card lg:col-span-2">
              <div className="tsp-card-header">
                <span className="material-symbols-outlined text-primary">bar_chart</span>
                <h3 className="tsp-card-title">Category-wise MT Breakdown</h3>
              </div>
              <div style={{ height: 280 }}><canvas ref={barChartRef}></canvas></div>
            </div>
            <div className="tsp-card">
              <div className="tsp-card-header">
                <span className="material-symbols-outlined text-primary">donut_large</span>
                <h3 className="tsp-card-title">Net Balance Share</h3>
              </div>
              <div style={{ height: 280 }}><canvas ref={pieChartRef}></canvas></div>
            </div>
          </div>

          {/* Category cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayData.map(({ cat, inwardByUnit, outwardByUnit, balByUnit, balStr, inwardMT, outwardMT, netMT, hasNos, nosInward, nosOutward, itemCount }) => (
              <div key={cat.id} className="tsp-card group hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-10 rounded-full" style={{ background: cat.bgColor || '#6B7280' }}></div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{cat.name}</h3>
                      <p className="text-xs text-gray-400">{itemCount} materials</p>
                    </div>
                  </div>
                  <div className={`px-2 py-0.5 rounded-full text-xs font-bold ${netMT >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {netMT >= 0 ? '+' : ''}{fmtNum(netMT, 2)} MT net
                  </div>
                </div>

                {/* Unit breakdown */}
                <div className="grid grid-cols-3 gap-3 text-center mb-4">
                  <div className="bg-blue-50 rounded-lg p-2">
                    <p className="text-[10px] text-blue-500 font-medium uppercase">Inward</p>
                    <p className="text-sm font-bold text-blue-700">{fmtNum(inwardMT)} MT</p>
                    <div className="text-[10px] text-blue-400 mt-0.5">
                      {Object.entries(inwardByUnit).map(([u, v]) => <span key={u} className="block">{fmtNum(v as number, 1)} {u}</span>)}
                    </div>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-2">
                    <p className="text-[10px] text-amber-500 font-medium uppercase">Outward</p>
                    <p className="text-sm font-bold text-amber-700">{fmtNum(outwardMT)} MT</p>
                    <div className="text-[10px] text-amber-400 mt-0.5">
                      {Object.entries(outwardByUnit).map(([u, v]) => <span key={u} className="block">{fmtNum(v as number, 1)} {u}</span>)}
                    </div>
                  </div>
                  <div className={`rounded-lg p-2 ${netMT >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                    <p className={`text-[10px] font-medium uppercase ${netMT >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>Balance</p>
                    <p className={`text-xs font-bold leading-tight ${netMT >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{balStr}</p>
                  </div>
                </div>

                {/* Mixed unit note */}
                {hasNos && (
                  <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-700">
                    <span className="font-semibold">NOS:</span> {nosInward} in / {nosOutward} out
                    <span className="text-gray-400 ml-1">(weight data may be incomplete)</span>
                  </div>
                )}

                {/* LTR conversion note */}
                {Object.keys(inwardByUnit).some(u => ['LTR', 'KL', 'L'].includes(u.toUpperCase())) && (
                  <div className="mt-1 p-2 bg-purple-50 border border-purple-200 rounded-lg text-[11px] text-purple-700">
                    <span className="font-semibold">Volume units</span> converted using density = 0.85 Kg/L
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── MONTHLY SUMMARY TAB ── */}
      {activeTab === 'monthly' && (
        <div className="space-y-4">
          {/* Info banner */}
          <div className="flex items-start gap-2 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
            <span className="material-symbols-outlined text-[18px] mt-0.5">info</span>
            <span>Inward entries ki <strong>date</strong> aur Outward entries ki <strong>dateSold</strong> se automatically month-wise group hota hai. 2 April + 22 April → dono <strong>Apr</strong> mein count honge.</span>
          </div>

          {monthlyData.length === 0 ? (
            <div className="glass-panel rounded-xl p-12 text-center">
              <span className="material-symbols-outlined text-gray-300 text-[56px]" style={{ fontVariationSettings: "'FILL' 1" }}>calendar_month</span>
              <p className="text-gray-500 mt-3 font-medium">Koi entries nahi hain abhi</p>
              <p className="text-sm text-gray-400 mt-1">Scrap entries add karo — woh automatically is table mein aayengi.</p>
            </div>
          ) : (
            <div className="glass-panel rounded-xl overflow-hidden shadow-sm">
              {/* KPI summary row */}
              <div className="grid grid-cols-3 gap-4 p-5 border-b border-outline-variant/20 bg-surface-variant/20">
                {[
                  {
                    label: 'Total Inward (All Months)',
                    value: fmtNum(monthlyDataWithOverrides.reduce((a, m) => a + m.inwardMT, 0), 2) + ' MT',
                    icon: 'arrow_downward', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200'
                  },
                  {
                    label: 'Total Outward (All Months)',
                    value: fmtNum(monthlyDataWithOverrides.reduce((a, m) => a + m.outwardMT, 0), 2) + ' MT',
                    icon: 'arrow_upward', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200'
                  },
                  {
                    label: 'Net Balance (All Months)',
                    value: (() => { const n = monthlyDataWithOverrides.reduce((a, m) => a + m.netMT, 0); return (n >= 0 ? '+' : '') + fmtNum(n, 2) + ' MT'; })(),
                    icon: 'scale',
                    color: monthlyDataWithOverrides.reduce((a, m) => a + m.netMT, 0) >= 0 ? 'text-emerald-600' : 'text-red-600',
                    bg: monthlyDataWithOverrides.reduce((a, m) => a + m.netMT, 0) >= 0 ? 'bg-emerald-50' : 'bg-red-50',
                    border: monthlyDataWithOverrides.reduce((a, m) => a + m.netMT, 0) >= 0 ? 'border-emerald-200' : 'border-red-200'
                  },
                ].map((k, i) => (
                  <div key={i} className={`flex items-center gap-3 rounded-xl p-3 border ${k.border} ${k.bg}`}>
                    <span className={`material-symbols-outlined ${k.color} text-[24px]`} style={{ fontVariationSettings: "'FILL' 1" }}>{k.icon}</span>
                    <div>
                      <p className="text-xs text-gray-500 font-medium">{k.label}</p>
                      <p className={`text-lg font-bold ${k.color}`}>{k.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Monthly Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse" style={{ minWidth: 700 }}>
                  <thead>
                    <tr className="border-b border-outline-variant/20 bg-surface-variant/30">
                      <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Month</th>
                      <th className="px-5 py-3 text-xs font-semibold text-blue-600 uppercase tracking-wide text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          Inward (MT)
                          <span className="text-[9px] bg-amber-100 text-amber-700 border border-amber-300 px-1.5 py-0.5 rounded-full font-bold tracking-wide">✏️ Editable</span>
                        </div>
                      </th>
                      <th className="px-5 py-3 text-xs font-semibold text-amber-600 uppercase tracking-wide text-right">Outward (MT)</th>
                      <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Net Balance (MT)</th>
                      <th className="px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide text-right">Inward Entries</th>
                      <th className="px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide text-right">Outward Entries</th>
                      <th className="px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide text-center">Balance Bar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...monthlyDataWithOverrides].reverse().map((m, i) => {
                      const maxMT = Math.max(...monthlyDataWithOverrides.map(x => x.inwardMT), 1);
                      const inPct = Math.min(100, (m.inwardMT / maxMT) * 100);
                      const outPct = Math.min(100, (m.outwardMT / maxMT) * 100);
                      const isPositive = m.netMT >= 0;
                      const isEditing = editingMonth === m.ym;

                      return (
                        <tr key={m.ym} className={`border-b border-outline-variant/10 hover:bg-blue-50/30 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-gray-800">{m.label}</span>
                              {m.isOverridden && (
                                <span className="text-[9px] bg-amber-100 text-amber-700 border border-amber-300 px-1.5 py-0.5 rounded-full font-bold">✏️ Manual</span>
                              )}
                            </div>
                          </td>

                          {/* ── Editable Inward Cell ──────────────────────── */}
                          <td className="px-5 py-3 text-right">
                            {isEditing ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <input
                                  autoFocus
                                  type="number"
                                  step="0.001"
                                  value={editDraft}
                                  onChange={e => setEditDraft(e.target.value)}
                                  onBlur={() => saveOverride(m.ym, editDraft)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') saveOverride(m.ym, editDraft);
                                    if (e.key === 'Escape') setEditingMonth(null);
                                  }}
                                  className="w-24 text-right text-sm font-bold text-blue-700 bg-blue-50 border-2 border-blue-400 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                  placeholder="MT"
                                />
                                <button
                                  onMouseDown={() => saveOverride(m.ym, editDraft)}
                                  className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                                  title="Save"
                                >
                                  <span className="material-symbols-outlined text-[16px]">check</span>
                                </button>
                                <button
                                  onMouseDown={() => setEditingMonth(null)}
                                  className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                                  title="Cancel"
                                >
                                  <span className="material-symbols-outlined text-[16px]">close</span>
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-2 group/cell">
                                <div className="text-right">
                                  <span className={`text-sm font-semibold ${m.isOverridden ? 'text-amber-700' : 'text-blue-700'}`}>
                                    {m.inwardMT > 0 ? fmtNum(m.inwardMT, 3) : '—'}
                                  </span>
                                  {m.isOverridden && (
                                    <div className="text-[10px] text-gray-400 line-through">
                                      Auto: {fmtNum(m.inwardMT_auto, 3)}
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover/cell:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => { setEditingMonth(m.ym); setEditDraft(String(m.inwardMT)); }}
                                    className="p-1 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Manual edit karo"
                                  >
                                    <span className="material-symbols-outlined text-[14px]">edit</span>
                                  </button>
                                  {m.isOverridden && (
                                    <button
                                      onClick={() => resetOverride(m.ym)}
                                      className="p-1 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                                      title="Auto-calculate par wapas jao"
                                    >
                                      <span className="material-symbols-outlined text-[14px]">restart_alt</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </td>

                          <td className="px-5 py-3 text-right">
                            <span className="text-sm font-semibold text-amber-700">{m.outwardMT > 0 ? fmtNum(m.outwardMT, 3) : '—'}</span>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${
                              isPositive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {m.netMT >= 0 ? '+' : ''}{fmtNum(m.netMT, 3)} MT
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right text-xs text-gray-500">{m.inwardCount} entries</td>
                          <td className="px-5 py-3 text-right text-xs text-gray-500">{m.outwardCount} entries</td>
                          <td className="px-5 py-3">
                            <div className="flex flex-col gap-1" style={{ minWidth: 120 }}>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] text-blue-500 w-5">IN</span>
                                <div className="flex-1 h-2 bg-blue-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: inPct + '%' }} />
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] text-amber-500 w-5">OUT</span>
                                <div className="flex-1 h-2 bg-amber-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: outPct + '%' }} />
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {/* Grand Total Row */}
                    <tr className="bg-gray-100 border-t-2 border-gray-300">
                      <td className="px-5 py-3 font-bold text-sm text-gray-800">
                        Grand Total
                        {Object.keys(monthlyOverrides).length > 0 && (
                          <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 border border-amber-300 px-1.5 py-0.5 rounded-full font-semibold">
                            {Object.keys(monthlyOverrides).length} manual override{Object.keys(monthlyOverrides).length > 1 ? 's' : ''}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-blue-700 text-sm">
                        {fmtNum(monthlyDataWithOverrides.reduce((a, m) => a + m.inwardMT, 0), 3)} MT
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-amber-700 text-sm">
                        {fmtNum(monthlyData.reduce((a, m) => a + m.outwardMT, 0), 3)} MT
                      </td>
                      <td className="px-5 py-3 text-right">
                        {(() => {
                          const n = monthlyDataWithOverrides.reduce((a, m) => a + m.netMT, 0);
                          return (
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${
                              n >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {n >= 0 ? '+' : ''}{fmtNum(n, 3)} MT
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-5 py-3 text-right text-xs font-semibold text-gray-600">
                        {monthlyData.reduce((a, m) => a + m.inwardCount, 0)} entries
                      </td>
                      <td className="px-5 py-3 text-right text-xs font-semibold text-gray-600">
                        {monthlyData.reduce((a, m) => a + m.outwardCount, 0)} entries
                      </td>
                      <td className="px-5 py-3"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── PENDING TAB ── */}
      {activeTab === 'pending' && (
        <PendingTabContent pendingEntries={pendingEntries} />
      )}

      {/* ── CONVERTER TAB ── */}
      {activeTab === 'converter' && (
        <div className="space-y-6">
          <UnitConverterWidget />

          {/* Standard densities reference */}
          <div className="tsp-card">
            <div className="tsp-card-header">
              <span className="material-symbols-outlined text-gray-500">science</span>
              <h3 className="tsp-card-title">Standard Density Reference</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { material: 'Engine Oil / Lube Oil', density: '0.85 Kg/L' },
                { material: 'Diesel / HSD', density: '0.83 Kg/L' },
                { material: 'Transformer Oil', density: '0.87 Kg/L' },
                { material: 'Water', density: '1.00 Kg/L' },
                { material: 'Kerosene', density: '0.80 Kg/L' },
                { material: 'Hydraulic Oil', density: '0.87 Kg/L' },
                { material: 'Grease (avg)', density: '0.90 Kg/L' },
                { material: 'Battery Acid', density: '1.27 Kg/L' },
              ].map((r, i) => (
                <div key={i} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                  <p className="text-xs text-gray-500">{r.material}</p>
                  <p className="text-sm font-bold text-gray-800 mt-1">{r.density}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── PendingTabContent with "Fix Now" Inline Editor ──────────────────────────
function PendingTabContent({ pendingEntries }: { pendingEntries: Array<{ id: number; type: 'INWARD' | 'OUTWARD'; itemName: string; reason: string; date: string; }> }) {
  const [editingId, setEditingId] = useState<string | null>(null); // "INWARD-5" or "OUTWARD-3-date"
  const [editValue, setEditValue] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const getEditKey = (p: typeof pendingEntries[0]) => `${p.type}-${p.id}-${p.reason}`;

  const handleFixNow = (p: typeof pendingEntries[0]) => {
    setEditingId(getEditKey(p));
    setEditValue('');
    setSavedMsg(null);
  };

  const handleSave = async (p: typeof pendingEntries[0]) => {
    if (!editValue) return;
    setSaving(true);
    try {
      if (p.reason.includes('Weight per NOS')) {
        const weightVal = Number(editValue);
        if (!weightVal || weightVal <= 0) { alert('Please enter a valid weight'); setSaving(false); return; }
        if (p.type === 'INWARD') {
          await db.inwardEntries.update(p.id, { weightPerNos: weightVal });
        } else {
          await db.outwardEntries.update(p.id, { weightPerNos: weightVal });
        }
      } else if (p.reason.includes('Date of Lot Applied')) {
        if (!editValue) { alert('Please select a date'); setSaving(false); return; }
        await db.outwardEntries.update(p.id, { dateLotApplied: editValue });
      }
      setSavedMsg(`✅ Entry #${p.id} updated!`);
      setEditingId(null);
      setEditValue('');
      setTimeout(() => setSavedMsg(null), 2500);
    } catch (err) {
      console.error(err);
      alert('Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditValue('');
  };

  return (
    <div className="space-y-4">
      {savedMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium flex items-center gap-2 animate-fade-in">
          <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          {savedMsg}
        </div>
      )}

      <div className="glass-panel rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-outline-variant/20 flex items-center gap-3 bg-amber-50">
          <span className="material-symbols-outlined text-amber-600" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
          <div>
            <h3 className="font-semibold text-gray-900">Pending Data Audit</h3>
            <p className="text-xs text-amber-600 mt-0.5">{pendingEntries.length} entries need attention — click "Fix Now" to update directly</p>
          </div>
        </div>
        {pendingEntries.length === 0 ? (
          <div className="p-12 text-center">
            <span className="material-symbols-outlined text-emerald-500 text-[48px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            <p className="text-gray-600 mt-3 font-medium">All entries are complete!</p>
            <p className="text-sm text-gray-400 mt-1">No missing data found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-outline-variant/20 bg-surface-variant/30">
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase">ID</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Type</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Material</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Missing Data</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingEntries.map((p, i) => {
                  const key = getEditKey(p);
                  const isEditing = editingId === key;
                  const isWeightFix = p.reason.includes('Weight per NOS');
                  const isDateFix = p.reason.includes('Date of Lot Applied');

                  return (
                    <tr key={i} className={`border-b border-outline-variant/10 transition-colors ${isEditing ? 'bg-amber-50/80 ring-1 ring-amber-200 ring-inset' : 'hover:bg-amber-50/40'}`}>
                      <td className="px-5 py-3 font-mono text-xs text-gray-500">#{p.id}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          p.type === 'OUTWARD' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {p.type}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm font-medium text-gray-900">{p.itemName}</td>
                      <td className="px-5 py-3 text-sm text-gray-600">{p.date || '—'}</td>
                      <td className="px-5 py-3">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            {isWeightFix && (
                              <div className="relative">
                                <input
                                  type="number"
                                  step="0.001"
                                  min="0"
                                  className="w-36 px-3 py-1.5 rounded-lg border border-amber-400 bg-white text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-500"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  placeholder="Kg per NOS"
                                  autoFocus
                                />
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-amber-500 font-medium">Kg</span>
                              </div>
                            )}
                            {isDateFix && (
                              <input
                                type="date"
                                className="w-40 px-3 py-1.5 rounded-lg border border-amber-400 bg-white text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-500"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                autoFocus
                              />
                            )}
                            <button
                              onClick={() => handleSave(p)}
                              disabled={saving || !editValue}
                              className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 disabled:opacity-50 transition-colors flex items-center gap-1 shadow-sm"
                            >
                              <span className="material-symbols-outlined text-[14px]">save</span>
                              {saving ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={handleCancel}
                              className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-500 text-xs font-medium hover:bg-gray-50 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <span className="flex items-center gap-1 text-amber-700 text-xs font-medium">
                            <span className="material-symbols-outlined text-[14px]">error_outline</span>
                            {p.reason}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-center">
                        {!isEditing && (
                          <button
                            onClick={() => handleFixNow(p)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-100 border border-amber-300 text-amber-800 text-xs font-semibold hover:bg-amber-200 hover:shadow-sm transition-all duration-200 group"
                          >
                            <span className="material-symbols-outlined text-[14px] group-hover:rotate-12 transition-transform">build</span>
                            Fix Now
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
