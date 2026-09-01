import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { db, useLiveQuery, type OutwardEntry, type Item, type DeliverySlot } from '../db/db';
import { CategoryBadge } from './CategoryBadge';
import { useMcrLots, getMcrLots } from '../pages/McrView';

// ── MCR API helper // Utility for API calls inside EditOutwardModal
const MCR_API_BASE = import.meta.env.PROD ? '/api' : 'http://localhost:5001/api';

async function authFetch(url: string, options?: RequestInit) {
  const token = sessionStorage.getItem('token');
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options?.headers
    }
  });
}

async function mcrEditSave(section: string, rowId: string, data: Record<string, string>) {
  try {
    const res = await authFetch(`${MCR_API_BASE}/mcr/${section}/edits`);
    const allEdits = await res.json();
    const existingEdits = allEdits[rowId] || {};
    const mergedData = { ...existingEdits, ...data };

    await authFetch(`${MCR_API_BASE}/mcr/${section}/edits`, {
      method: 'POST',
      body: JSON.stringify({ rowId, data: mergedData }),
    });
  } catch (e) {
    console.warn('[MCR Sync] Failed to update MCR:', e);
  }
}

async function mcrExtraUpdate(section: string, rowId: string, data: Record<string, string>) {
  try {
    const res = await authFetch(`${MCR_API_BASE}/mcr/${section}/extras`);
    const allExtras = await res.json();
    const existingExtra = allExtras.find((r: any) => r.id === rowId || r.rowId === rowId);
    
    if (existingExtra) {
      const mergedData = { ...existingExtra, ...data };
      delete mergedData._isNew;

      await authFetch(`${MCR_API_BASE}/mcr/${section}/extras`, {
        method: 'POST',
        body: JSON.stringify({ rowId, data: mergedData }),
      });
    }
  } catch (e) {
    console.warn('[MCR Sync] Failed to update MCR extra:', e);
  }
}

function isoToMcrDate(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

const today = new Date().toISOString().split('T')[0];

function emptyDelivery(): DeliverySlot {
  return { date: today, quantity: 0, isFinal: false };
}

function initDeliveries(entry: OutwardEntry): DeliverySlot[] {
  // If entry has deliveries array, use it; otherwise create one from old single dateDelivered
  if (entry.deliveries && entry.deliveries.length > 0) {
    return entry.deliveries;
  }
  return [{ date: entry.dateDelivered, quantity: entry.quantity, isFinal: true }];
}

export function EditOutwardModal({ 
  entry, 
  item, 
  onClose 
}: { 
  entry: OutwardEntry; 
  item: Item; 
  onClose: () => void;
}) {
  const categories = useLiveQuery(() => db.categories.toArray());
  const units = useLiveQuery(() => db.units.toArray());

  const [unitId, setUnitId] = useState<string>(String(entry.unitId));
  const [lotNumber, setLotNumber] = useState<string>(entry.lotNumber);
  const [hsnCode, setHsnCode] = useState<string>(entry.hsnCode);
  const [firmName, setFirmName] = useState<string>(entry.firmName);
  const [dateLotApplied, setDateLotApplied] = useState<string>(entry.dateLotApplied || '');
  const [dateSold, setDateSold] = useState<string>(entry.dateSold);
  const [rcCount, setRcCount] = useState<string>(entry.rcCount ? String(entry.rcCount) : '');
  const [fcCount, setFcCount] = useState<string>(entry.fcCount ? String(entry.fcCount) : '');
  const isCoverItem = item.name.toLowerCase().includes('cover');

  // ── Delivery Slots ────────────────────────────────────────────────────────
  const [deliveries, setDeliveries] = useState<DeliverySlot[]>(initDeliveries(entry));

  const [isSaving, setIsSaving] = useState(false);

  // ── MCR Reference Search ───────────────────────────────────────────────
  const [mcrSearchQuery, setMcrSearchQuery] = useState('');
  const [showMcrPanel, setShowMcrPanel] = useState(false);
  const [selectedMcrLot, setSelectedMcrLot] = useState<ReturnType<typeof getMcrLots>[0] | null>(null);

  const { lots: allMcrLots, loading: mcrLotsLoading } = useMcrLots();

  const mcrSuggestions = useMemo(() => {
    const q = mcrSearchQuery.trim().toLowerCase();
    if (!q || q.length < 2) {
      return allMcrLots.filter(l => l.status === 'pending').slice(0, 8);
    }
    const matched = allMcrLots.filter(l =>
      (l.lotNo || '').toLowerCase().includes(q) ||
      (l.material || '').toLowerCase().includes(q) ||
      (l.purchaser || '').toLowerCase().includes(q) ||
      (l.scrNo || '').toLowerCase().includes(q)
    );
    const pending = matched.filter(l => l.status === 'pending');
    const rest = matched.filter(l => l.status !== 'pending');
    return [...pending, ...rest].slice(0, 12);
  }, [mcrSearchQuery, allMcrLots]);

  const handleMcrLotSelect = (lot: ReturnType<typeof getMcrLots>[0]) => {
    setSelectedMcrLot(lot);
    setShowMcrPanel(false);

    if (lot.lotNo) setLotNumber(lot.lotNo);
    if (lot.purchaser) setFirmName(lot.purchaser);

    if (lot.eAuctionDate && lot.eAuctionDate.toLowerCase() !== 'cancelled') {
      const firstDate = lot.eAuctionDate.split(/[&,\s]/)[0].trim();
      const parts = firstDate.split('/');
      if (parts.length === 3 && parts[2].length === 4) {
        const iso = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        if (!isNaN(Date.parse(iso))) setDateSold(iso);
      }
    }

    if (lot.condnDate && typeof lot.condnDate === 'string' && lot.condnDate.toLowerCase() !== 'cancelled') {
      const firstDate = lot.condnDate.split(/[&,\s]/)[0].trim();
      const normalized = firstDate.replace(/\./g, '/');
      const parts = normalized.split('/');
      if (parts.length === 3 && parts[2].length === 4) {
        const iso = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        if (!isNaN(Date.parse(iso))) setDateLotApplied(iso);
      }
    }
  };

  const clearMcrSelection = () => {
    setSelectedMcrLot(null);
    setMcrSearchQuery('');
  };

  const selectedUnitName = useMemo(() => {
    if (!units) return '';
    return units.find(u => u.id === Number(unitId))?.name || '';
  }, [unitId, units]);

  const totalQty = useMemo(() =>
    deliveries.reduce((sum, d) => sum + (Number(d.quantity) || 0), 0),
  [deliveries]);

  const finalDelivery = useMemo(() =>
    deliveries.find(d => d.isFinal) || deliveries[deliveries.length - 1],
  [deliveries]);

  const selectedCategory = useMemo(() => {
    if (!item || !categories) return null;
    return categories.find(c => c.id === item.categoryId) || null;
  }, [item, categories]);

  // ── Delivery slot handlers ────────────────────────────────────────────────
  const addDelivery = () => {
    setDeliveries(prev => [...prev, { ...emptyDelivery(), isFinal: false }]);
  };

  const removeDelivery = (idx: number) => {
    setDeliveries(prev => {
      const next = prev.filter((_, i) => i !== idx);
      if (next.length > 0 && !next.some(d => d.isFinal)) {
        next[next.length - 1] = { ...next[next.length - 1], isFinal: true };
      }
      return next;
    });
  };

  const updateDelivery = (idx: number, field: keyof DeliverySlot, value: any) => {
    setDeliveries(prev => {
      const next = prev.map((d, i) => i === idx ? { ...d, [field]: value } : d);
      if (field === 'isFinal' && value === true) {
        return next.map((d, i) => ({ ...d, isFinal: i === idx }));
      }
      return next;
    });
  };

  const handleSave = async (e: any) => {
    e.preventDefault();
    if (!unitId || !lotNumber || !hsnCode || !firmName || !dateSold) return;
    if (deliveries.length === 0 || deliveries.some(d => !d.date || !d.quantity)) {
      alert('Sabhi delivery slots mein date aur quantity bharo.');
      return;
    }
    if (!deliveries.some(d => d.isFinal)) {
      alert('Ek delivery ko "Final" mark karo.');
      return;
    }
    
    setIsSaving(true);
    try {
      const dateDelivered = finalDelivery?.date || deliveries[deliveries.length - 1].date;

      await db.outwardEntries.update(entry.id!, {
        quantity: totalQty,
        unitId: Number(unitId),
        lotNumber,
        hsnCode,
        firmName,
        dateLotApplied: dateLotApplied || undefined,
        dateSold,
        dateDelivered,
        deliveries,
        rcCount: rcCount ? Number(rcCount) : undefined,
        fcCount: fcCount ? Number(fcCount) : undefined,
      });

      // ── MCR Bidirectional Sync ─────────────────────────────────────────────
      if (selectedMcrLot) {
        const mcrUpdates: Record<string, string> = {};
        
        // MCR Delivery Date: push ALL dates comma separated
        const mcrDatesStr = deliveries.filter(d => d.date).map(d => isoToMcrDate(d.date)).join(', ');
        if (!selectedMcrLot.deliveryDate && mcrDatesStr)
          mcrUpdates.deliveryDate = mcrDatesStr;
          
        if (!selectedMcrLot.purchaser && firmName)
          mcrUpdates.purchaser = firmName;
        if (!selectedMcrLot.lotNo && lotNumber)
          mcrUpdates.lotNo = lotNumber;
        if (!selectedMcrLot.eAuctionDate && dateSold)
          mcrUpdates.eAuctionDate = isoToMcrDate(dateSold);
        
        if (Object.keys(mcrUpdates).length > 0) {
          if (selectedMcrLot.id.startsWith('new_')) {
            await mcrExtraUpdate(selectedMcrLot.section || 'lot', selectedMcrLot.id, mcrUpdates);
          } else {
            await mcrEditSave(selectedMcrLot.section || 'lot', selectedMcrLot.id, mcrUpdates);
          }
        }
      }

      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to update entry');
    } finally {
      setIsSaving(false);
    }
  };

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: '680px',
        maxHeight: '90vh',
        background: 'rgba(255,255,255,0.97)',
        borderRadius: '20px',
        boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.4)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-outline-variant/20 flex items-center justify-between bg-surface/50 flex-shrink-0">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center border border-secondary/30">
               <span className="material-symbols-outlined text-secondary">edit_square</span>
             </div>
             <div>
               <h3 className="font-headline-md text-[18px] font-bold text-on-surface leading-tight">Edit Outward Entry</h3>
               <p className="font-body-sm text-body-sm text-outline text-[12px]">{item.name}</p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 text-outline hover:text-on-surface rounded-full hover:bg-surface-variant/50 transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto">
          <form id="edit-outward-form" onSubmit={handleSave} className="space-y-6">

            {/* ── MCR Reference Search Panel ──────────────────────────────── */}
            <div className="mb-6 rounded-xl border border-indigo-200 overflow-hidden">
              <div
                className={`px-4 py-3 flex items-center gap-3 cursor-pointer transition-colors ${
                  showMcrPanel ? 'bg-indigo-600' : 'bg-indigo-50 hover:bg-indigo-100'
                }`}
                onClick={() => setShowMcrPanel(p => !p)}
              >
                <span className={`material-symbols-outlined text-[20px] ${showMcrPanel ? 'text-white' : 'text-indigo-600'}`}
                  style={{ fontVariationSettings: "'FILL' 1" }}>inventory_2</span>
                <div className="flex-1">
                  <p className={`text-sm font-bold ${showMcrPanel ? 'text-white' : 'text-indigo-700'}`}>
                    🔍 MCR Lot se Search &amp; Auto-fill
                  </p>
                </div>
                {selectedMcrLot && !showMcrPanel && (
                  <div className="flex items-center gap-2 bg-white border border-emerald-300 rounded-lg px-2.5 py-1.5">
                    <span className="material-symbols-outlined text-emerald-600 text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    <div>
                      <p className="text-[10px] font-bold text-emerald-700">{selectedMcrLot.lotNo || selectedMcrLot.material.slice(0, 20)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); clearMcrSelection(); }}
                      className="ml-1 text-outline hover:text-error transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  </div>
                )}
                <span className={`material-symbols-outlined text-[20px] transition-transform duration-200 ${showMcrPanel ? 'text-white rotate-180' : 'text-indigo-400'}`}>expand_more</span>
              </div>

              {showMcrPanel && (
                <div className="bg-white">
                  <div className="p-3 border-b border-indigo-100">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-indigo-400 text-[18px]">search</span>
                      <input
                        type="text"
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-indigo-200 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                        placeholder="Material name, Lot No, Purchaser ya SCR No type karo..."
                        value={mcrSearchQuery}
                        onChange={e => setMcrSearchQuery(e.target.value)}
                        autoFocus
                      />
                    </div>
                    {!mcrSearchQuery && (
                      <p className="text-[10px] text-indigo-400 mt-1.5 ml-1 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">info</span>
                        {mcrLotsLoading ? '⏳ Loading latest cloud data...' : '⏳ Pending lots automatically dikh rahe hain'}
                      </p>
                    )}
                  </div>

                  <div className="max-h-64 overflow-y-auto">
                    {mcrSuggestions.length === 0 ? (
                      <div className="px-4 py-6 text-center text-outline text-sm">Koi lot nahi mila</div>
                    ) : (
                      mcrSuggestions.map(lot => {
                        const isPending = lot.status === 'pending';
                        const isSelected = selectedMcrLot?.id === lot.id;
                        return (
                          <div
                            key={lot.id}
                            onClick={() => handleMcrLotSelect(lot)}
                            className={`px-4 py-3 cursor-pointer border-b border-indigo-50 last:border-0 transition-all ${
                              isSelected
                                ? 'bg-emerald-50 border-l-4 border-l-emerald-500'
                                : isPending
                                  ? 'hover:bg-amber-50 bg-amber-50/40'
                                  : 'hover:bg-indigo-50'
                            }`}
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-bold text-[11px] text-on-surface tracking-wide">
                                {lot.lotNo || <span className="text-outline italic font-normal">No Lot No</span>}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${isPending ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}`}>
                                {isPending ? '⏳ Pending' : '✅ Delivered'}
                              </span>
                              {isSelected && <span className="material-symbols-outlined text-emerald-600 text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>}
                            </div>
                            <p className="text-xs text-on-surface font-medium mt-0.5 truncate">{lot.material}</p>
                            <div className="flex items-center gap-3 mt-1 text-[10px] text-outline flex-wrap">
                              <span className="font-data-mono font-bold text-primary">{lot.qty} {lot.unit}</span>
                              {lot.purchaser && <span>🏢 {lot.purchaser}</span>}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              
              <div className="space-y-2 col-span-1 md:col-span-2">
                <label className="font-label-md text-label-md text-on-surface-variant">Category</label>
                <div className="h-12 flex items-center">
                  {selectedCategory && <CategoryBadge category={selectedCategory} />}
                </div>
              </div>

              {/* Unit */}
              <div className="space-y-2 relative">
                <div className="relative group pt-2">
                  <select
                    className="glass-input floating-input w-full rounded-xl py-3 px-4 font-body-md text-body-md text-on-surface focus:outline-none appearance-none"
                    value={unitId} onChange={(e) => setUnitId(e.target.value)} required
                  >
                    <option value="" disabled hidden>-- Choose Unit --</option>
                    {units?.map(u => (<option key={u.id} value={u.id}>{u.name}</option>))}
                  </select>
                  <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-outline group-hover:text-primary transition-colors">
                    <span className="material-symbols-outlined mt-2">expand_more</span>
                  </div>
                  <label className="absolute left-4 -top-0.5 bg-surface/80 px-1 font-body-sm text-body-sm text-primary transition-all duration-200 pointer-events-none scale-85">
                    Unit <span className="text-error">*</span>
                  </label>
                </div>
              </div>

              {/* Total Qty Display */}
              <div className="flex items-center gap-2 pl-1">
                <div className="flex items-center gap-2 px-3 py-2 bg-secondary/10 border border-secondary/30 rounded-xl">
                  <span className="material-symbols-outlined text-secondary text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>scale</span>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-secondary/70 tracking-wide">Total Qty</p>
                    <p className="font-data-mono font-bold text-secondary leading-tight">
                      {totalQty > 0 ? `${totalQty} ${selectedUnitName}` : '—'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 relative pt-2">
                <input
                  type="text"
                  className="glass-input floating-input w-full rounded-xl py-3 pl-12 pr-4 font-body-md text-body-md text-on-surface focus:outline-none placeholder-transparent"
                  value={lotNumber} onChange={(e) => setLotNumber(e.target.value)}
                  placeholder="Lot Number" id="edit-out-lot" required
                />
                <label htmlFor="edit-out-lot" className="floating-label absolute left-12 top-5 font-body-md text-body-md text-outline transition-all duration-200 pointer-events-none">
                  Lot No. <span className="text-error">*</span>
                </label>
                <div className="absolute left-4 top-5 pointer-events-none text-outline-variant">
                  <span className="material-symbols-outlined text-[20px]">tag</span>
                </div>
              </div>

              <div className="space-y-2 relative pt-2">
                <input
                  type="text"
                  className="glass-input floating-input w-full rounded-xl py-3 pl-12 pr-4 font-body-md text-body-md text-on-surface focus:outline-none placeholder-transparent"
                  value={hsnCode} onChange={(e) => setHsnCode(e.target.value)}
                  placeholder="HSN Code" id="edit-out-hsn" required
                />
                <label htmlFor="edit-out-hsn" className="floating-label absolute left-12 top-5 font-body-md text-body-md text-outline transition-all duration-200 pointer-events-none">
                  HSN Code <span className="text-error">*</span>
                </label>
                <div className="absolute left-4 top-5 pointer-events-none text-outline-variant">
                  <span className="material-symbols-outlined text-[20px]">qr_code</span>
                </div>
              </div>
              
              <div className="space-y-2 relative pt-2 col-span-1 md:col-span-2">
                <input
                  type="text"
                  className="glass-input floating-input w-full rounded-xl py-3 pl-12 pr-4 font-body-md text-body-md text-on-surface focus:outline-none placeholder-transparent"
                  value={firmName} onChange={(e) => setFirmName(e.target.value)}
                  placeholder="Firm Name" id="edit-out-firm" required
                />
                <label htmlFor="edit-out-firm" className="floating-label absolute left-12 top-5 font-body-md text-body-md text-outline transition-all duration-200 pointer-events-none">
                  Firm Name <span className="text-error">*</span>
                </label>
                <div className="absolute left-4 top-5 pointer-events-none text-outline-variant">
                  <span className="material-symbols-outlined text-[20px]">store</span>
                </div>
              </div>

              {/* Date Lot Applied — OPTIONAL */}
              <div className="space-y-2 relative pt-2">
                <input
                  type="date"
                  className="glass-input floating-input w-full rounded-xl py-3 pl-12 pr-4 font-body-md text-body-md text-on-surface focus:outline-none"
                  value={dateLotApplied}
                  onChange={(e) => setDateLotApplied(e.target.value)}
                />
                <label className="absolute left-12 -top-0.5 bg-surface/80 px-1 font-body-sm text-body-sm text-on-surface-variant transition-all duration-200 pointer-events-none scale-85">
                  Date Lot Applied <span className="text-amber-500 text-[10px]">(optional)</span>
                </label>
                <div className="absolute left-4 top-5 pointer-events-none text-outline-variant">
                  <span className="material-symbols-outlined text-[20px]">calendar_today</span>
                </div>
                {!dateLotApplied && (
                  <p className="text-[10px] text-amber-500 flex items-center gap-0.5 ml-1 mt-1">
                    <span className="material-symbols-outlined text-[12px]">schedule</span>
                    Currently Pending — fill now or later
                  </p>
                )}
              </div>
              
              <div className="space-y-2 relative pt-2">
                <input
                  type="date"
                  className="glass-input floating-input w-full rounded-xl py-3 pl-12 pr-4 font-body-md text-body-md text-on-surface focus:outline-none"
                  value={dateSold} onChange={(e) => setDateSold(e.target.value)} required
                />
                <label className="absolute left-12 -top-0.5 bg-surface/80 px-1 font-body-sm text-body-sm text-primary transition-all duration-200 pointer-events-none scale-85">
                  Date Sold <span className="text-error">*</span>
                </label>
                <div className="absolute left-4 top-5 pointer-events-none text-outline-variant">
                  <span className="material-symbols-outlined text-[20px]">event_available</span>
                </div>
              </div>
            </div>

            {/* ── Delivery Schedule ──────────────────────────────────────────── */}
            <div className="bg-gradient-to-br from-violet-50/80 to-indigo-50/80 border border-violet-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-bold text-violet-800 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>local_shipping</span>
                  Delivery Schedule
                </h4>
                <span className="text-xs font-bold text-violet-700 bg-violet-100 border border-violet-300 px-2.5 py-1 rounded-lg">
                  Total: {totalQty} {selectedUnitName}
                </span>
              </div>

              {/* Column Headers */}
              <div className="grid grid-cols-[1fr_110px_90px_auto] gap-3 mb-2 px-1">
                <p className="text-[10px] font-bold text-outline uppercase tracking-wider">Date</p>
                <p className="text-[10px] font-bold text-outline uppercase tracking-wider">Quantity</p>
                <p className="text-[10px] font-bold text-violet-600 uppercase tracking-wider">Final?</p>
                <p></p>
              </div>

              <div className="space-y-2">
                {deliveries.map((slot, idx) => (
                  <div
                    key={idx}
                    className={`grid grid-cols-[1fr_110px_90px_auto] gap-3 items-center p-2.5 rounded-lg border transition-all ${
                      slot.isFinal ? 'bg-emerald-50 border-emerald-300' : 'bg-white/80 border-outline-variant/30'
                    }`}
                  >
                    <input
                      type="date"
                      value={slot.date}
                      onChange={e => updateDelivery(idx, 'date', e.target.value)}
                      className="w-full glass-input rounded-lg py-2 px-3 text-sm text-on-surface focus:outline-none"
                      required
                    />
                    <input
                      type="number" step="0.01" min="0"
                      value={slot.quantity || ''}
                      onChange={e => updateDelivery(idx, 'quantity', Number(e.target.value))}
                      placeholder="Qty"
                      className="w-full glass-input rounded-lg py-2 px-3 text-sm font-data-mono text-on-surface focus:outline-none"
                      required
                    />
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <div className="relative flex-shrink-0">
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={slot.isFinal}
                          onChange={e => updateDelivery(idx, 'isFinal', e.target.checked)}
                        />
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                          slot.isFinal ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-gray-300 hover:border-violet-400'
                        }`}>
                          {slot.isFinal && <span className="material-symbols-outlined text-white text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>}
                        </div>
                      </div>
                      {slot.isFinal && <span className="text-[10px] font-bold text-emerald-700">🏁</span>}
                    </label>
                    <button
                      type="button"
                      onClick={() => removeDelivery(idx)}
                      disabled={deliveries.length === 1}
                      className="p-1.5 text-outline hover:text-error rounded-lg hover:bg-error/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addDelivery}
                className="mt-3 w-full py-2 border-2 border-dashed border-violet-300 rounded-lg text-xs font-semibold text-violet-600 hover:bg-violet-50 hover:border-violet-400 transition-all flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">add_circle</span>
                Add Another Delivery Date
              </button>

              {/* Summary Pills */}
              {deliveries.length > 1 && (
                <div className="mt-3 pt-3 border-t border-violet-200 flex flex-wrap gap-2">
                  {deliveries.map((d, i) => (
                    <div key={i} className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                      d.isFinal ? 'bg-emerald-100 border-emerald-300 text-emerald-800' : 'bg-white border-gray-200 text-gray-600'
                    }`}>
                      {d.isFinal && <span>🏁</span>}
                      <span>{d.date ? new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}</span>
                      <span className="font-data-mono">{d.quantity || 0} {selectedUnitName}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* RC/FC section for cover items */}
            {isCoverItem && (
              <div className="p-4 bg-gradient-to-br from-blue-50 to-purple-50 border border-indigo-200 rounded-xl">
                <h4 className="text-xs font-bold text-indigo-700 mb-3 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px]">layers</span>
                  Cover Breakdown — RC &amp; FC
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="relative pt-2">
                    <input
                      type="number" min="0"
                      className="glass-input floating-input w-full rounded-xl py-3 px-4 font-body-md text-body-md text-on-surface focus:outline-none placeholder-transparent border-blue-300"
                      value={rcCount}
                      onChange={(e) => setRcCount(e.target.value)}
                      placeholder="RC" id="edit-out-rc"
                    />
                    <label htmlFor="edit-out-rc" className="floating-label absolute left-4 top-5 text-xs text-blue-600 pointer-events-none transition-all">
                      🔵 Rear Cover (RC) Nos
                    </label>
                  </div>
                  <div className="relative pt-2">
                    <input
                      type="number" min="0"
                      className="glass-input floating-input w-full rounded-xl py-3 px-4 font-body-md text-body-md text-on-surface focus:outline-none placeholder-transparent border-purple-300"
                      value={fcCount}
                      onChange={(e) => setFcCount(e.target.value)}
                      placeholder="FC" id="edit-out-fc"
                    />
                    <label htmlFor="edit-out-fc" className="floating-label absolute left-4 top-5 text-xs text-purple-600 pointer-events-none transition-all">
                      🟣 Front Cover (FC) Nos
                    </label>
                  </div>
                </div>
                {(rcCount || fcCount) && (
                  <div className="mt-2 flex gap-2 flex-wrap">
                    {rcCount && <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-xs font-bold border border-blue-200">RC: {rcCount} Nos</span>}
                    {fcCount && <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-700 text-xs font-bold border border-purple-200">FC: {fcCount} Nos</span>}
                    {rcCount && fcCount && <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-xs font-semibold border border-gray-200">= {Number(rcCount)+Number(fcCount)} Total</span>}
                  </div>
                )}
              </div>
            )}
          </form>
        </div>
        
        <div className="px-6 py-4 border-t border-outline-variant/20 flex justify-end flex-shrink-0 space-x-3 bg-surface/50">
          <button type="button" onClick={onClose} className="px-6 py-2 text-label-md font-label-md text-on-surface bg-white border border-outline-variant/30 rounded-xl hover:bg-surface-variant/30 transition-colors">
            Cancel
          </button>
          <button type="submit" form="edit-outward-form" disabled={isSaving} className="px-6 py-2 text-label-md font-label-md text-white bg-secondary rounded-xl hover:bg-secondary/90 focus:ring-2 focus:ring-secondary focus:ring-offset-2 transition-colors disabled:opacity-50 shadow-md hover:shadow-lg flex items-center">
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
