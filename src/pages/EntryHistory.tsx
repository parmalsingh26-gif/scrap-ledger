import { useState, useMemo } from 'react';
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
  date: string; // normalized date for sorting
  raw: InwardEntry | OutwardEntry;
}

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

    // Tab filter
    if (activeTab === 'inward') merged = merged.filter(e => e._type === 'INWARD');
    if (activeTab === 'outward') merged = merged.filter(e => e._type === 'OUTWARD');

    // Date filter
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

    // Search filter
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

    // Sort by date descending
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
                  activeTab === tab.key
                    ? 'bg-white shadow text-primary'
                    : 'text-gray-500 hover:text-gray-700'
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
                  filterType === f.key
                    ? 'bg-white shadow text-primary'
                    : 'text-gray-500 hover:text-gray-700'
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

            return (
              <div
                key={`${entry._type}-${entry.id}-${idx}`}
                className={`glass-panel rounded-xl p-4 md:p-5 shadow-sm border-l-4 transition-all hover:shadow-md hover:-translate-y-[1px] group ${
                  isOut
                    ? 'border-l-violet-500'
                    : 'border-l-emerald-500'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">

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
                          isOut
                            ? 'bg-violet-100 text-violet-700'
                            : 'bg-emerald-100 text-emerald-700'
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
    </div>
  );
}
