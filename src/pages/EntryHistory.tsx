import { useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { db, useLiveQuery, type InwardEntry, type OutwardEntry } from '../db/db';
import { EditInwardModal } from '../components/EditInwardModal';
import { EditOutwardModal } from '../components/EditOutwardModal';
import { useAuth } from '../components/AuthProvider';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear, isWithinInterval, parseISO } from 'date-fns';

type TabType = 'all' | 'inward' | 'outward';
type FilterType = 'daily' | 'monthly' | 'yearly';

interface CombinedEntry {
  _type: 'INWARD' | 'OUTWARD';
  id?: number;
  date: string;
  raw: InwardEntry | OutwardEntry;
}

// ── Export Helpers ────────────────────────────────────────────────────────────

function formatDateSafe(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  try { return format(parseISO(dateStr), 'dd MMM yyyy'); } catch { return dateStr; }
}

function exportToCSV(
  entries: CombinedEntry[],
  itemMap: Map<number | undefined, any>,
  unitMap: Map<number | undefined, string>,
  filterLabel: string
) {
  const rows: string[][] = [];

  // Header
  rows.push([
    'Type', 'Material', 'Lot Number', 'Date', 'Quantity', 'Unit',
    'Firm Name', 'HSN Code', 'Date Sold', 'Date Lot Applied',
    'Delivery Schedule', 'Final Delivery Date',
    'Machine Type', 'Cover Type', 'RC Count', 'FC Count'
  ]);

  entries.forEach(entry => {
    const raw = entry.raw as any;
    const item = itemMap.get(raw.itemId);
    const unitName = unitMap.get(raw.unitId) || '';

    if (entry._type === 'OUTWARD') {
      const out = raw as OutwardEntry;
      let deliverySchedule = '';
      let finalDeliveryDate = formatDateSafe(out.dateDelivered);

      if (out.deliveries && out.deliveries.length > 0) {
        deliverySchedule = out.deliveries
          .map(d => `${formatDateSafe(d.date)}: ${d.quantity} ${unitName}${d.isFinal ? ' [FINAL]' : ''}`)
          .join(' | ');
        const final = out.deliveries.find(d => d.isFinal);
        if (final) finalDeliveryDate = formatDateSafe(final.date);
      } else {
        deliverySchedule = `${formatDateSafe(out.dateDelivered)}: ${out.quantity} ${unitName} [FINAL]`;
      }

      rows.push([
        'OUTWARD',
        item?.name || 'Unknown',
        out.lotNumber || '',
        formatDateSafe(entry.date),
        String(out.quantity),
        unitName,
        out.firmName || '',
        out.hsnCode || '',
        formatDateSafe(out.dateSold),
        out.dateLotApplied ? formatDateSafe(out.dateLotApplied) : 'Pending',
        deliverySchedule,
        finalDeliveryDate,
        '', '', '', ''
      ]);
    } else {
      const inw = raw as InwardEntry;
      rows.push([
        'INWARD',
        item?.name || 'Unknown',
        inw.lotNumber || '',
        formatDateSafe(entry.date),
        String(inw.quantity),
        unitName,
        '', '', '', '', '', '',
        inw.machineType || '',
        inw.coverType || '',
        inw.rcCount ? String(inw.rcCount) : '',
        inw.fcCount ? String(inw.fcCount) : '',
      ]);
    }
  });

  const csv = rows.map(row =>
    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
  ).join('\n');

  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `entry-history-${filterLabel}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function printAsPDF(
  entries: CombinedEntry[],
  itemMap: Map<number | undefined, any>,
  unitMap: Map<number | undefined, string>,
  filterLabel: string
) {
  const outward = entries.filter(e => e._type === 'OUTWARD');
  const inward = entries.filter(e => e._type === 'INWARD');

  const renderOutwardRows = () => outward.map(entry => {
    const out = entry.raw as OutwardEntry;
    const item = itemMap.get(out.itemId);
    const unitName = unitMap.get(out.unitId) || '';

    let deliveriesHtml = '';
    if (out.deliveries && out.deliveries.length > 0) {
      deliveriesHtml = out.deliveries.map(d =>
        `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600;margin:2px;${
          d.isFinal
            ? 'background:#d1fae5;border:1px solid #6ee7b7;color:#065f46;'
            : 'background:#f3f4f6;border:1px solid #d1d5db;color:#374151;'
        }">${d.isFinal ? '🏁 ' : ''}${formatDateSafe(d.date)}: ${d.quantity} ${unitName}</span>`
      ).join('');
    } else {
      deliveriesHtml = `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600;margin:2px;background:#d1fae5;border:1px solid #6ee7b7;color:#065f46;">🏁 ${formatDateSafe(out.dateDelivered)}: ${out.quantity} ${unitName}</span>`;
    }

    const finalSlot = out.deliveries?.find(d => d.isFinal);
    const finalDate = finalSlot ? formatDateSafe(finalSlot.date) : formatDateSafe(out.dateDelivered);

    return `
      <tr>
        <td>${item?.name || '—'}</td>
        <td><b>${out.lotNumber}</b></td>
        <td>${out.firmName}</td>
        <td>${out.quantity} ${unitName}</td>
        <td>${formatDateSafe(out.dateSold)}</td>
        <td>${deliveriesHtml}</td>
        <td style="color:#065f46;font-weight:700;">${finalDate}</td>
        <td>${out.dateLotApplied ? formatDateSafe(out.dateLotApplied) : '<span style="color:#d97706;">Pending</span>'}</td>
      </tr>
    `;
  }).join('');

  const renderInwardRows = () => inward.map(entry => {
    const inw = entry.raw as InwardEntry;
    const item = itemMap.get(inw.itemId);
    const unitName = unitMap.get(inw.unitId) || '';
    return `
      <tr>
        <td>${item?.name || '—'}</td>
        <td>${inw.lotNumber || '—'}</td>
        <td>${inw.quantity} ${unitName}</td>
        <td>${formatDateSafe(inw.date)}</td>
        <td>${inw.machineType || '—'}</td>
        <td>${inw.coverType || '—'}</td>
        <td>${inw.rcCount ? inw.rcCount + ' Nos' : '—'}</td>
        <td>${inw.fcCount ? inw.fcCount + ' Nos' : '—'}</td>
      </tr>
    `;
  }).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Entry History — ${filterLabel}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #111; padding: 24px; font-size: 12px; }
  h1 { font-size: 22px; font-weight: 800; color: #1e1b4b; margin-bottom: 4px; }
  .subtitle { font-size: 13px; color: #6b7280; margin-bottom: 20px; }
  .section-title { font-size: 14px; font-weight: 700; margin: 20px 0 8px; padding: 6px 12px; border-radius: 8px; display: flex; align-items: center; gap: 8px; }
  .outward-title { background: #ede9fe; color: #4c1d95; }
  .inward-title { background: #d1fae5; color: #065f46; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th { background: #1e1b4b; color: white; padding: 8px 10px; text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
  td { padding: 8px 10px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  tr:nth-child(even) td { background: #f9fafb; }
  tr:hover td { background: #f0f7ff; }
  .badge { display:inline-block;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700; }
  .footer { margin-top: 24px; font-size: 11px; color: #9ca3af; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 12px; }
  @media print { body { padding: 12px; } }
</style>
</head>
<body>
  <h1>📊 Entry History Report</h1>
  <p class="subtitle">Period: ${filterLabel} &nbsp;|&nbsp; Generated: ${format(new Date(), 'dd MMM yyyy, HH:mm')} &nbsp;|&nbsp; Total: ${entries.length} entries (${outward.length} Outward + ${inward.length} Inward)</p>

  ${outward.length > 0 ? `
  <div class="section-title outward-title">▲ Outward Entries (${outward.length})</div>
  <table>
    <thead>
      <tr>
        <th>Material</th><th>Lot No.</th><th>Firm</th><th>Total Qty</th>
        <th>Date Sold</th><th>Delivery Schedule</th><th>Final Delivery</th><th>Lot Applied</th>
      </tr>
    </thead>
    <tbody>${renderOutwardRows()}</tbody>
  </table>
  ` : ''}

  ${inward.length > 0 ? `
  <div class="section-title inward-title">▼ Inward Entries (${inward.length})</div>
  <table>
    <thead>
      <tr>
        <th>Material</th><th>Lot No.</th><th>Quantity</th><th>Date</th>
        <th>Machine</th><th>Cover</th><th>RC Count</th><th>FC Count</th>
      </tr>
    </thead>
    <tbody>${renderInwardRows()}</tbody>
  </table>
  ` : ''}

  <div class="footer">Scrap Ledger — Printed on ${format(new Date(), 'dd MMM yyyy')}</div>
  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export function EntryHistory() {
  const items = useLiveQuery(() => db.items.toArray());
  const units = useLiveQuery(() => db.units.toArray());
  const inwardEntries = useLiveQuery(() => db.inwardEntries.toArray());
  const outwardEntries = useLiveQuery(() => db.outwardEntries.toArray());

  const { isAdmin } = useAuth();

  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [filterType, setFilterType] = useState<FilterType>('daily');
  const [searchTerm, setSearchTerm] = useState('');

  const today = new Date();
  const [selectedDate, setSelectedDate] = useState<string>(format(today, 'yyyy-MM-dd'));
  const [selectedMonth, setSelectedMonth] = useState<string>(format(today, 'yyyy-MM'));
  const [selectedYear, setSelectedYear] = useState<string>(format(today, 'yyyy'));

  const [editingEntry, setEditingEntry] = useState<InwardEntry | null>(null);
  const [editingOutwardEntry, setEditingOutwardEntry] = useState<OutwardEntry | null>(null);
  const [editingItem, setEditingItem] = useState<any>(null);

  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const unitMap = useMemo(() => new Map((units || []).map(u => [u.id, u.name])), [units]);
  const itemMap = useMemo(() => new Map((items || []).map(i => [i.id, i])), [items]);

  // Build combined + filtered entries
  const combinedEntries = useMemo((): CombinedEntry[] => {
    if (!inwardEntries || !outwardEntries) return [];

    const inward: CombinedEntry[] = inwardEntries.map(e => ({
      _type: 'INWARD' as const,
      id: e.id,
      date: e.date,
      raw: e,
    }));

    const outward: CombinedEntry[] = outwardEntries.map(e => ({
      _type: 'OUTWARD' as const,
      id: e.id,
      date: e.dateDelivered || e.dateSold,
      raw: e,
    }));

    let merged = [...inward, ...outward];

    if (activeTab === 'inward') merged = merged.filter(e => e._type === 'INWARD');
    if (activeTab === 'outward') merged = merged.filter(e => e._type === 'OUTWARD');

    merged = merged.filter(entry => {
      const entryDate = parseISO(entry.date);
      if (filterType === 'daily') {
        const d = parseISO(selectedDate);
        return isWithinInterval(entryDate, { start: startOfDay(d), end: endOfDay(d) });
      }
      if (filterType === 'monthly') {
        const d = parseISO(selectedMonth + '-01');
        return isWithinInterval(entryDate, { start: startOfMonth(d), end: endOfMonth(d) });
      }
      if (filterType === 'yearly') {
        const d = parseISO(selectedYear + '-01-01');
        return isWithinInterval(entryDate, { start: startOfYear(d), end: endOfYear(d) });
      }
      return true;
    });

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      merged = merged.filter(entry => {
        const item = itemMap.get((entry.raw as any).itemId);
        const itemName = item?.name?.toLowerCase() || '';
        const lot = ((entry.raw as any).lotNumber || '').toLowerCase();
        const firm = ((entry.raw as any).firmName || '').toLowerCase();
        return itemName.includes(q) || lot.includes(q) || firm.includes(q);
      });
    }

    return merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [inwardEntries, outwardEntries, activeTab, filterType, selectedDate, selectedMonth, selectedYear, searchTerm, itemMap]);

  // Summary stats
  const stats = useMemo(() => {
    if (!inwardEntries || !outwardEntries) return { todayIn: 0, todayOut: 0, monthIn: 0, monthOut: 0, totalIn: 0, totalOut: 0 };
    const todayStr = format(today, 'yyyy-MM-dd');
    const monthStr = format(today, 'yyyy-MM');
    return {
      todayIn: inwardEntries.filter(e => e.date === todayStr).length,
      todayOut: outwardEntries.filter(e => (e.dateDelivered || e.dateSold) === todayStr).length,
      monthIn: inwardEntries.filter(e => e.date.startsWith(monthStr)).length,
      monthOut: outwardEntries.filter(e => (e.dateDelivered || e.dateSold || '').startsWith(monthStr)).length,
      totalIn: inwardEntries.length,
      totalOut: outwardEntries.length,
    };
  }, [inwardEntries, outwardEntries]);

  // Filter label for export filename
  const filterLabel = useMemo(() => {
    if (filterType === 'daily') return format(parseISO(selectedDate), 'dd-MMM-yyyy');
    if (filterType === 'monthly') return format(parseISO(selectedMonth + '-01'), 'MMM-yyyy');
    return selectedYear;
  }, [filterType, selectedDate, selectedMonth, selectedYear]);

  const handleDeleteInward = async (id: number) => {
    if (confirm('Kya aap is inward entry ko delete karna chahte hain?')) {
      await db.inwardEntries.delete(id);
    }
  };

  const handleDeleteOutward = async (id: number) => {
    if (confirm('Kya aap is outward entry ko delete karna chahte hain?')) {
      await db.outwardEntries.delete(id);
    }
  };

  const handleExportCSV = () => {
    exportToCSV(combinedEntries, itemMap, unitMap, filterLabel);
    setShowExportMenu(false);
  };

  const handleExportPDF = () => {
    printAsPDF(combinedEntries, itemMap, unitMap, filterLabel);
    setShowExportMenu(false);
  };

  if (!items || !units || !inwardEntries || !outwardEntries) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
          <p className="text-outline font-body-sm text-body-sm">Loading history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1", fontSize: '32px' }}>history</span>
            Entry History
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">Inward aur Outward ki poori history — ek jagah.</p>
        </div>

        {/* ── Export Button ──────────────────────────────────────────────────── */}
        <div className="relative" ref={exportRef}>
          <button
            onClick={() => setShowExportMenu(v => !v)}
            disabled={combinedEntries.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold text-sm rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
          >
            <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>download</span>
            Export
            <span className="material-symbols-outlined text-[16px]">{showExportMenu ? 'expand_less' : 'expand_more'}</span>
          </button>

          {showExportMenu && (
            <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-2xl border border-outline-variant/20 z-50 overflow-hidden animate-fade-in">
              <div className="px-3 py-2 bg-gray-50 border-b border-outline-variant/20">
                <p className="text-[10px] font-bold text-outline uppercase tracking-wider">Export Current View</p>
                <p className="text-[10px] text-outline-variant">{combinedEntries.length} entries</p>
              </div>
              <button
                onClick={handleExportPDF}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 transition-colors text-left group"
              >
                <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center group-hover:bg-red-200 transition-colors">
                  <span className="material-symbols-outlined text-red-600 text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>picture_as_pdf</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-on-surface">Export PDF</p>
                  <p className="text-[10px] text-outline">Print-ready format</p>
                </div>
              </button>
              <button
                onClick={handleExportCSV}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-emerald-50 transition-colors text-left group border-t border-outline-variant/10"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                  <span className="material-symbols-outlined text-emerald-600 text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>table_view</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-on-surface">Export Excel (CSV)</p>
                  <p className="text-[10px] text-outline">Opens in Excel/Sheets</p>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Summary Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Aaj Inward', value: stats.todayIn, icon: 'arrow_downward', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
          { label: 'Aaj Outward', value: stats.todayOut, icon: 'arrow_upward', color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200' },
          { label: 'Is Mahine Inward', value: stats.monthIn, icon: 'calendar_month', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
          { label: 'Is Mahine Outward', value: stats.monthOut, icon: 'calendar_month', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
          { label: 'Total Inward', value: stats.totalIn, icon: 'inventory', color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-200' },
          { label: 'Total Outward', value: stats.totalOut, icon: 'local_shipping', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
        ].map((stat, idx) => (
          <div key={idx} className={`glass-card rounded-xl p-3 border ${stat.border} flex flex-col gap-1 hover:shadow-md transition-shadow`}>
            <div className="flex items-center gap-1.5">
              <span className={`material-symbols-outlined text-[14px] ${stat.color}`}>{stat.icon}</span>
              <p className="text-[10px] text-outline-variant font-semibold uppercase tracking-wider leading-tight">{stat.label}</p>
            </div>
            <p className={`font-data-mono font-bold text-2xl ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Controls Panel */}
      <div className="glass-panel rounded-2xl p-4 md:p-5 shadow-sm space-y-4">

        {/* Row 1: Tabs + Search */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          {/* Tab Switcher */}
          <div className="flex gap-1 bg-gray-100/80 rounded-xl p-1">
            {([
              { key: 'all', label: 'Sab', icon: 'list' },
              { key: 'inward', label: 'Inward', icon: 'arrow_downward' },
              { key: 'outward', label: 'Outward', icon: 'arrow_upward' },
            ] as { key: TabType; label: string; icon: string }[]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === tab.key ? 'bg-white shadow text-primary' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 sm:max-w-xs">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[16px]">search</span>
            <input
              type="text"
              placeholder="Material, Lot, Firm name..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="glass-input w-full pl-9 pr-4 py-2.5 rounded-xl font-body-sm text-body-sm text-on-surface focus:outline-none"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Date Filter */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          {/* Filter Type Pills */}
          <div className="flex gap-1 bg-gray-100/80 rounded-xl p-1 flex-shrink-0">
            {([
              { key: 'daily', label: 'Daily' },
              { key: 'monthly', label: 'Monthly' },
              { key: 'yearly', label: 'Yearly' },
            ] as { key: FilterType; label: string }[]).map(f => (
              <button
                key={f.key}
                onClick={() => setFilterType(f.key)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                  filterType === f.key ? 'bg-white shadow text-primary' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Date Input */}
          {filterType === 'daily' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="glass-input px-3 py-2 rounded-xl text-sm text-on-surface focus:outline-none"
              />
              <button
                onClick={() => setSelectedDate(format(today, 'yyyy-MM-dd'))}
                className="text-xs text-primary font-semibold px-3 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors"
              >
                Aaj
              </button>
            </div>
          )}
          {filterType === 'monthly' && (
            <div className="flex items-center gap-2">
              <input
                type="month"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="glass-input px-3 py-2 rounded-xl text-sm text-on-surface focus:outline-none"
              />
              <button
                onClick={() => setSelectedMonth(format(today, 'yyyy-MM'))}
                className="text-xs text-primary font-semibold px-3 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors"
              >
                Is Mahine
              </button>
            </div>
          )}
          {filterType === 'yearly' && (
            <div className="flex items-center gap-2">
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(e.target.value)}
                className="glass-input px-3 py-2 rounded-xl text-sm text-on-surface focus:outline-none appearance-none pr-8 bg-white/60"
              >
                {Array.from({ length: 6 }, (_, i) => String(today.getFullYear() - i)).map(yr => (
                  <option key={yr} value={yr}>{yr}</option>
                ))}
              </select>
              <button
                onClick={() => setSelectedYear(String(today.getFullYear()))}
                className="text-xs text-primary font-semibold px-3 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors"
              >
                Is Saal
              </button>
            </div>
          )}

          {/* Result count */}
          <span className="ml-auto text-xs text-outline font-medium bg-gray-100 px-3 py-1.5 rounded-full">
            {combinedEntries.length} entries mili
          </span>
        </div>
      </div>

      {/* Entries List */}
      {combinedEntries.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 text-center shadow-sm">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-outline text-[32px]">search_off</span>
          </div>
          <h3 className="font-headline-md text-on-surface mb-2">Koi entry nahi mili</h3>
          <p className="font-body-sm text-body-sm text-outline">
            {filterType === 'daily' ? `${format(parseISO(selectedDate), 'dd MMM yyyy')} ki` :
              filterType === 'monthly' ? `${format(parseISO(selectedMonth + '-01'), 'MMMM yyyy')} ki` :
              `${selectedYear} ki`} koi entry nahi hai.
          </p>
          <p className="text-xs text-outline mt-1 opacity-70">Filter ya search badlo.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {combinedEntries.map((entry, idx) => {
            const isOut = entry._type === 'OUTWARD';
            const raw = entry.raw;
            const item = itemMap.get((raw as any).itemId);
            const unitName = unitMap.get(raw.unitId) || '';
            const inwardRaw = !isOut ? (raw as InwardEntry) : null;
            const outwardRaw = isOut ? (raw as OutwardEntry) : null;

            // Delivery schedule info for outward
            const hasDeliveries = outwardRaw?.deliveries && outwardRaw.deliveries.length > 0;
            const finalSlot = outwardRaw?.deliveries?.find(d => d.isFinal);
            const finalDeliveryDate = finalSlot?.date || outwardRaw?.dateDelivered;

            return (
              <div
                key={`${entry._type}-${entry.id}-${idx}`}
                className={`glass-panel rounded-xl p-4 md:p-5 shadow-sm border-l-4 transition-all hover:shadow-md hover:-translate-y-[1px] group ${
                  isOut ? 'border-l-violet-500' : 'border-l-emerald-500'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">

                  {/* Type Badge */}
                  <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${
                    isOut ? 'bg-violet-100' : 'bg-emerald-100'
                  }`}>
                    <span className={`material-symbols-outlined text-[20px] ${isOut ? 'text-violet-600' : 'text-emerald-600'}`}
                      style={{ fontVariationSettings: "'FILL' 1" }}>
                      {isOut ? 'arrow_upward' : 'arrow_downward'}
                    </span>
                  </div>

                  {/* Main Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div>
                        <span className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mb-1 ${
                          isOut ? 'bg-violet-100 text-violet-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {isOut ? '▲ Outward' : '▼ Inward'}
                        </span>
                        <p className="font-headline-md text-on-surface text-[15px] font-semibold leading-tight">{item?.name || 'Unknown Item'}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`font-data-mono font-bold text-lg ${isOut ? 'text-violet-700' : 'text-emerald-700'}`}>
                          {isOut ? '-' : '+'}{raw.quantity} {unitName}
                        </p>
                        <p className="text-[11px] text-outline">{format(parseISO(entry.date), 'dd MMM yyyy')}</p>
                      </div>
                    </div>

                    {/* Details Row */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                      {(raw as any).lotNumber && (
                        <span className="flex items-center gap-1 text-xs text-outline">
                          <span className="material-symbols-outlined text-[12px]">tag</span>
                          Lot: <span className="font-semibold text-on-surface">{(raw as any).lotNumber}</span>
                        </span>
                      )}
                      {isOut && outwardRaw && (
                        <>
                          <span className="flex items-center gap-1 text-xs text-outline">
                            <span className="material-symbols-outlined text-[12px]">business</span>
                            Firm: <span className="font-semibold text-on-surface">{outwardRaw.firmName}</span>
                          </span>
                          {outwardRaw.hsnCode && (
                            <span className="flex items-center gap-1 text-xs text-outline">
                              <span className="material-symbols-outlined text-[12px]">qr_code</span>
                              HSN: <span className="font-mono font-semibold text-on-surface">{outwardRaw.hsnCode}</span>
                            </span>
                          )}
                          {outwardRaw.dateSold && (
                            <span className="flex items-center gap-1 text-xs text-outline">
                              <span className="material-symbols-outlined text-[12px]">gavel</span>
                              Sold: <span className="font-semibold text-on-surface">{format(parseISO(outwardRaw.dateSold), 'dd MMM yyyy')}</span>
                            </span>
                          )}
                        </>
                      )}
                      {!isOut && inwardRaw && (
                        <>
                          {inwardRaw.machineType && (
                            <span className="flex items-center gap-1 text-xs text-outline">
                              <span className="material-symbols-outlined text-[12px]">precision_manufacturing</span>
                              <span className="font-semibold text-on-surface">{inwardRaw.machineType}</span>
                            </span>
                          )}
                          {inwardRaw.coverType && (
                            <span className="flex items-center gap-1 text-xs text-outline">
                              <span className="material-symbols-outlined text-[12px]">layers</span>
                              Cover: <span className="font-semibold text-on-surface">{inwardRaw.coverType}</span>
                            </span>
                          )}
                          {(inwardRaw.rcCount || inwardRaw.fcCount) && (
                            <span className="flex items-center gap-1 text-xs text-outline">
                              {inwardRaw.rcCount ? <span className="text-blue-700 font-bold">RC:{inwardRaw.rcCount}</span> : null}
                              {inwardRaw.fcCount ? <span className="text-purple-700 font-bold ml-1">FC:{inwardRaw.fcCount}</span> : null}
                            </span>
                          )}
                        </>
                      )}
                    </div>

                    {/* ── Delivery Schedule (Outward only) ───────────────────── */}
                    {isOut && outwardRaw && (
                      <div className="mt-3 pt-3 border-t border-outline-variant/15">
                        <p className="text-[10px] font-bold text-outline uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>local_shipping</span>
                          Delivery Breakup
                          {hasDeliveries && (
                            <span className="bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full text-[9px] font-bold">
                              {outwardRaw.deliveries!.length} date{outwardRaw.deliveries!.length > 1 ? 'en' : ''}
                            </span>
                          )}
                        </p>

                        {hasDeliveries ? (
                          <div className="flex flex-wrap gap-2">
                            {outwardRaw.deliveries!.map((d, di) => (
                              <div
                                key={di}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                  d.isFinal
                                    ? 'bg-emerald-100 border-emerald-300 text-emerald-800 shadow-sm'
                                    : 'bg-violet-50 border-violet-200 text-violet-700'
                                }`}
                              >
                                {/* Delivery number */}
                                <span className={`text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold ${
                                  d.isFinal ? 'bg-emerald-600 text-white' : 'bg-violet-200 text-violet-800'
                                }`}>{di + 1}</span>
                                {d.isFinal && (
                                  <span className="material-symbols-outlined text-emerald-600 text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>flag</span>
                                )}
                                <span className="font-data-mono">{formatDateSafe(d.date)}</span>
                                <span className="font-bold text-sm">{d.quantity} {unitName}</span>
                                {d.isFinal && (
                                  <span className="text-[9px] bg-emerald-600 text-white px-1.5 py-0.5 rounded-full font-bold tracking-wide">FINAL</span>
                                )}
                              </div>
                            ))}
                            {/* Total strip if more than 1 */}
                            {outwardRaw.deliveries!.length > 1 && (
                              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border bg-gray-100 border-gray-300 text-gray-700">
                                <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>sigma</span>
                                Total: {outwardRaw.quantity} {unitName}
                              </div>
                            )}
                          </div>
                        ) : (
                          // Old format — no deliveries array, just show dateDelivered
                          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border bg-emerald-100 border-emerald-300 text-emerald-800 w-fit">
                            <span className="material-symbols-outlined text-emerald-600 text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>flag</span>
                            <span className="font-data-mono">{formatDateSafe(finalDeliveryDate)}</span>
                            <span className="font-bold">{outwardRaw.quantity} {unitName}</span>
                            <span className="text-[9px] bg-emerald-600 text-white px-1.5 py-0.5 rounded-full font-bold tracking-wide">FINAL</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {isAdmin && (
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button
                        onClick={() => {
                          const itemObj = itemMap.get((raw as any).itemId);
                          setEditingItem(itemObj || null);
                          if (isOut) setEditingOutwardEntry(raw as OutwardEntry);
                          else setEditingEntry(raw as InwardEntry);
                        }}
                        className="p-2 text-outline hover:text-primary bg-white rounded-lg shadow-sm border border-outline-variant/30 transition-colors"
                        title="Edit"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                      </button>
                      <button
                        onClick={() => {
                          if (isOut) handleDeleteOutward(entry.id!);
                          else handleDeleteInward(entry.id!);
                        }}
                        className="p-2 text-outline hover:text-error bg-white rounded-lg shadow-sm border border-outline-variant/30 transition-colors"
                        title="Delete"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modals */}
      {editingEntry && editingItem && createPortal(
        <EditInwardModal
          entry={editingEntry}
          item={editingItem}
          onClose={() => { setEditingEntry(null); setEditingItem(null); }}
        />,
        document.body
      )}
      {editingOutwardEntry && editingItem && createPortal(
        <EditOutwardModal
          entry={editingOutwardEntry}
          item={editingItem}
          onClose={() => { setEditingOutwardEntry(null); setEditingItem(null); }}
        />,
        document.body
      )}

      {/* Close export menu on outside click */}
      {showExportMenu && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 40 }}
          onClick={() => setShowExportMenu(false)}
        />
      )}
    </div>
  );
}
