import React, { useState, useMemo } from 'react';
import { db, useLiveQuery, type DeliverySlot } from '../db/db';
import { CategoryBadge } from '../components/CategoryBadge';
import { ProtectedView } from '../components/ProtectedView';
import { QRScannerModal } from '../components/QRScannerModal';
import { useNavigate } from 'react-router-dom';
import { getMcrLots } from './McrView';

const GST_RATES = [0, 5, 12, 18];

const today = new Date().toISOString().split('T')[0];

function emptyDelivery(): DeliverySlot {
  return { date: today, quantity: 0, isFinal: false };
}

export function OutwardEntry() {
  const items = useLiveQuery(() => db.items.toArray());
  const categories = useLiveQuery(() => db.categories.toArray());
  const units = useLiveQuery(() => db.units.toArray());
  const firmMasters = useLiveQuery(() => db.firmMasters.toArray());
  const inwardEntries = useLiveQuery(() => db.inwardEntries.toArray());
  const outwardEntries = useLiveQuery(() => db.outwardEntries.toArray());

  const navigate = useNavigate();

  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [lotNumber, setLotNumber] = useState<string>('');
  const [hsnCode, setHsnCode] = useState<string>('');
  const [hsnAutoFilled, setHsnAutoFilled] = useState(false);
  const [unitId, setUnitId] = useState<string>('');
  const [firmName, setFirmName] = useState<string>('');
  const [firmInput, setFirmInput] = useState<string>('');
  const [showFirmDropdown, setShowFirmDropdown] = useState(false);
  const [weightPerNos, setWeightPerNos] = useState<string>('');
  const [rcCount, setRcCount] = useState<string>('');
  const [fcCount, setFcCount] = useState<string>('');

  // Rate + GST calculator
  const [rate, setRate] = useState<string>('');
  const [gstRate, setGstRate] = useState<number>(0);

  const [dateLotApplied, setDateLotApplied] = useState<string>('');
  const [dateSold, setDateSold] = useState<string>(today);

  // ── Multiple Delivery Slots ───────────────────────────────────────────────
  const [deliveries, setDeliveries] = useState<DeliverySlot[]>([{ ...emptyDelivery(), isFinal: true }]);

  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const [showQRScanner, setShowQRScanner] = useState(false);
  const [scanAutoFillMsg, setScanAutoFillMsg] = useState<string | null>(null);

  // ── MCR Reference Search ───────────────────────────────────────────────
  const [mcrSearchQuery, setMcrSearchQuery] = useState('');
  const [showMcrPanel, setShowMcrPanel] = useState(false);
  const [selectedMcrLot, setSelectedMcrLot] = useState<ReturnType<typeof getMcrLots>[0] | null>(null);
  const [mcrSearchFocused, setMcrSearchFocused] = useState(false);

  // Load all MCR lots fresh each time (picks up localStorage edits)
  const allMcrLots = useMemo(() => getMcrLots(), []);

  // Filter MCR suggestions based on search query
  const mcrSuggestions = useMemo(() => {
    const q = mcrSearchQuery.trim().toLowerCase();
    if (!q || q.length < 2) {
      // Show pending lots by default when panel opens
      const pending = allMcrLots.filter(l => l.status === 'pending').slice(0, 8);
      return pending;
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

  // Handle MCR lot selection → auto-fill outward form fields
  const handleMcrLotSelect = (lot: ReturnType<typeof getMcrLots>[0]) => {
    setSelectedMcrLot(lot);
    setShowMcrPanel(false);
    setMcrSearchFocused(false);
    setScanAutoFillMsg(null);

    // Auto-fill Lot Number from MCR (user can override)
    if (lot.lotNo) setLotNumber(lot.lotNo);

    // Auto-fill firm name (purchaser from MCR)
    if (lot.purchaser) {
      setFirmName(lot.purchaser);
      setFirmInput(lot.purchaser);
    }

    // Auto-fill date sold from eAuctionDate (convert DD/MM/YYYY → YYYY-MM-DD)
    if (lot.eAuctionDate && lot.eAuctionDate.toLowerCase() !== 'cancelled') {
      // Handle compound dates like "30/06/2023 & 26/07/2023" — take first date
      const firstDate = lot.eAuctionDate.split(/[&,\s]/)[0].trim();
      const parts = firstDate.split('/');
      if (parts.length === 3 && parts[2].length === 4) {
        const iso = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        if (!isNaN(Date.parse(iso))) setDateSold(iso);
      }
    }
  };

  const clearMcrSelection = () => {
    setSelectedMcrLot(null);
    setMcrSearchQuery('');
  };

  const unitMap = useMemo(() => new Map((units || []).map(u => [u.id, u.name])), [units]);

  // ── Pending deliveries alert ──────────────────────────────────────────────
  const pendingDeliveries = useMemo(() => {
    if (!outwardEntries) return [];
    return outwardEntries.filter(e => !e.dateLotApplied);
  }, [outwardEntries]);

  // ── Live Stock Availability ───────────────────────────────────────────────
  const stockInfo = useMemo(() => {
    if (!selectedItemId || !inwardEntries || !outwardEntries || !units) return null;
    const itemId = Number(selectedItemId);
    const inByUnit: Record<number, number> = {};
    inwardEntries.filter(e => e.itemId === itemId).forEach(e => {
      inByUnit[e.unitId] = (inByUnit[e.unitId] || 0) + e.quantity;
    });
    const outByUnit: Record<number, number> = {};
    outwardEntries.filter(e => e.itemId === itemId).forEach(e => {
      outByUnit[e.unitId] = (outByUnit[e.unitId] || 0) + e.quantity;
    });
    const results: { unitName: string; balance: number }[] = [];
    Object.keys(inByUnit).forEach(uid => {
      const u = Number(uid);
      const bal = (inByUnit[u] || 0) - (outByUnit[u] || 0);
      results.push({ unitName: unitMap.get(u) || String(u), balance: bal });
    });
    return results.length > 0 ? results : null;
  }, [selectedItemId, inwardEntries, outwardEntries, unitMap]);

  // ── Total quantity from deliveries ────────────────────────────────────────
  const totalQtyFromDeliveries = useMemo(() => {
    return deliveries.reduce((sum, d) => sum + (Number(d.quantity) || 0), 0);
  }, [deliveries]);

  // ── Rate × Amount calculation ─────────────────────────────────────────────
  const amountCalc = useMemo(() => {
    const qty = totalQtyFromDeliveries;
    const r = Number(rate);
    if (!qty || !r) return null;
    const baseAmount = qty * r;
    const gstAmount = (baseAmount * gstRate) / 100;
    return { baseAmount, gstAmount, grandTotal: baseAmount + gstAmount };
  }, [totalQtyFromDeliveries, rate, gstRate]);

  const selectedItem = useMemo(() => {
    if (!selectedItemId || !items) return null;
    return items.find(i => i.id === Number(selectedItemId)) || null;
  }, [selectedItemId, items]);

  const selectedCategory = useMemo(() => {
    if (!selectedItem || !categories) return null;
    return categories.find(c => c.id === selectedItem.categoryId) || null;
  }, [selectedItem, categories]);

  const selectedUnitName = useMemo(() => {
    if (!unitId || !units) return '';
    return units.find(u => u.id === Number(unitId))?.name || '';
  }, [unitId, units]);

  const isNosUnit = selectedUnitName === 'Nos';
  const isCoverItem = (selectedItem?.name || '').toLowerCase().includes('cover');

  const calcWeightMT = () => {
    if (!isNosUnit || !totalQtyFromDeliveries || !weightPerNos) return null;
    return ((totalQtyFromDeliveries * Number(weightPerNos)) / 1000).toFixed(3);
  };

  const filteredFirms = useMemo(() => {
    if (!firmMasters) return [];
    const q = firmInput.toLowerCase();
    return firmMasters.filter(f => f.name.toLowerCase().includes(q));
  }, [firmMasters, firmInput]);

  const handleItemChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedItemId(val);
    if (!val || !items) { setHsnAutoFilled(false); return; }
    const item = items.find(i => i.id === Number(val));
    if (item?.hsnCode) { setHsnCode(item.hsnCode); setHsnAutoFilled(true); }
    else { setHsnCode(''); setHsnAutoFilled(false); }
  };

  const handleFirmSelect = (name: string) => {
    setFirmName(name); setFirmInput(name); setShowFirmDropdown(false);
  };

  const handleFirmInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFirmInput(val); setFirmName(val);
    setShowFirmDropdown(val.length > 0);
  };

  // ── QR Scan Auto-Fill ─────────────────────────────────────────────────────
  const handleScanSuccess = (scannedText: string) => {
    // 1. Set Lot Number from scan
    setLotNumber(scannedText);
    setScanAutoFillMsg(null);

    if (!inwardEntries || !items) return;

    // 2. Find matching inward entry by Lot Number
    const match = inwardEntries.find(
      e => e.lotNumber?.trim().toUpperCase() === scannedText.trim().toUpperCase()
    );

    if (match) {
      // 3. Auto-fill Item
      setSelectedItemId(String(match.itemId));
      // 4. Auto-fill Unit
      setUnitId(String(match.unitId));
      // 5. Auto-fill HSN from item master
      const matchedItem = items.find(i => i.id === match.itemId);
      if (matchedItem?.hsnCode) {
        setHsnCode(matchedItem.hsnCode);
        setHsnAutoFilled(true);
      }
      const itemName = matchedItem?.name || 'Item';
      const unitName = unitMap.get(match.unitId) || '';
      setScanAutoFillMsg(`✅ Lot "${scannedText}" mila! ${itemName} (${match.quantity} ${unitName}) — Inward: ${match.date}`);
    } else {
      setScanAutoFillMsg(`⚠️ Lot "${scannedText}" kisi inward entry se match nahi hua. Manually select karo.`);
    }
    setTimeout(() => setScanAutoFillMsg(null), 6000);
  };

  // ── Delivery slot handlers ────────────────────────────────────────────────
  const addDelivery = () => {
    setDeliveries(prev => [...prev, { ...emptyDelivery(), isFinal: false }]);
  };

  const removeDelivery = (idx: number) => {
    setDeliveries(prev => {
      const next = prev.filter((_, i) => i !== idx);
      // ensure at least one final
      if (next.length > 0 && !next.some(d => d.isFinal)) {
        next[next.length - 1] = { ...next[next.length - 1], isFinal: true };
      }
      return next;
    });
  };

  const updateDelivery = (idx: number, field: keyof DeliverySlot, value: any) => {
    setDeliveries(prev => {
      const next = prev.map((d, i) => i === idx ? { ...d, [field]: value } : d);
      // isFinal is exclusive — ek hi final ho
      if (field === 'isFinal' && value === true) {
        return next.map((d, i) => ({ ...d, isFinal: i === idx }));
      }
      return next;
    });
  };

  const finalDelivery = useMemo(() => deliveries.find(d => d.isFinal) || deliveries[deliveries.length - 1], [deliveries]);

  if (!items || !categories || !units) return null;

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!selectedItemId || !lotNumber || !hsnCode || !unitId || !firmName) {
      setStatus({ type: 'error', msg: 'Please fill in all required fields.' });
      return;
    }
    if (deliveries.length === 0 || deliveries.some(d => !d.date || !d.quantity)) {
      setStatus({ type: 'error', msg: 'Sabhi delivery slots mein date aur quantity bharo.' });
      return;
    }
    if (!deliveries.some(d => d.isFinal)) {
      setStatus({ type: 'error', msg: 'Ek delivery ko "Final" mark karo.' });
      return;
    }

    try {
      if (firmMasters && !firmMasters.find(f => f.name.toLowerCase() === firmName.toLowerCase())) {
        await db.firmMasters.add({ name: firmName });
      }

      // dateDelivered = final delivery ki date (backward compat)
      const dateDelivered = finalDelivery?.date || deliveries[deliveries.length - 1].date;

      const entryData: any = {
        itemId: Number(selectedItemId),
        lotNumber,
        hsnCode,
        quantity: totalQtyFromDeliveries,
        unitId: Number(unitId),
        firmName,
        dateLotApplied: dateLotApplied || undefined,
        dateSold,
        dateDelivered,
        deliveries,
      };

      if (isNosUnit && weightPerNos) entryData.weightPerNos = Number(weightPerNos);
      if (isCoverItem) {
        if (rcCount) entryData.rcCount = Number(rcCount);
        if (fcCount) entryData.fcCount = Number(fcCount);
      }

      await db.outwardEntries.add(entryData);

      // Auto-save HSN to item master
      const selectedItemObj = items?.find(i => i.id === Number(selectedItemId));
      if (selectedItemObj && hsnCode && selectedItemObj.hsnCode !== hsnCode) {
        try { await db.items.update(Number(selectedItemId), { ...selectedItemObj, hsnCode }); } catch { }
      }

      const hsnMsg = selectedItemObj && selectedItemObj.hsnCode !== hsnCode ? ' HSN bhi save ho gaya!' : '';
      setStatus({ type: 'success', msg: `✅ Outward entry recorded successfully!${hsnMsg}` });

      setSelectedItemId(''); setLotNumber(''); setHsnCode(''); setHsnAutoFilled(false);
      setUnitId(''); setFirmName(''); setFirmInput('');
      setWeightPerNos(''); setRcCount(''); setFcCount('');
      setRate(''); setGstRate(0); setDateLotApplied(''); setDateSold(today);
      setDeliveries([{ ...emptyDelivery(), isFinal: true }]);
      setTimeout(() => setStatus(null), 4000);
    } catch (err) {
      setStatus({ type: 'error', msg: 'Failed to record entry.' });
    }
  };

  return (
    <ProtectedView>
      <div className="animate-fade-in space-y-6 max-w-4xl">

        {/* Page Header */}
        <div>
          <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1", fontSize: '32px' }}>upload</span>
            Log Outward / Sale
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">Record materials leaving the yard securely.</p>
        </div>

        {/* ── Pending Deliveries Alert ────────────────────────────────────────── */}
        {pendingDeliveries.length > 0 && (
          <div
            className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-300 rounded-xl cursor-pointer hover:bg-amber-100 transition-colors group"
            onClick={() => navigate('/history?filter=pending')}
          >
            <div className="w-10 h-10 rounded-xl bg-amber-200 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-amber-700 text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>pending_actions</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-800">
                ⏳ {pendingDeliveries.length} entr{pendingDeliveries.length > 1 ? 'ies' : 'y'} pending — Lot Applied date nahi bhari
              </p>
              <p className="text-xs text-amber-600 mt-0.5">Entry History mein jaake update karein →</p>
            </div>
            <span className="material-symbols-outlined text-amber-600 group-hover:translate-x-1 transition-transform">arrow_forward</span>
          </div>
        )}

        {/* Main Form Card */}
        <div className="glass-panel rounded-2xl shadow-sm overflow-hidden p-6 md:p-8 relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-secondary-container/10 rounded-full blur-[80px] -mr-20 -mt-20 pointer-events-none"></div>

          {status && (
            <div className={`p-4 rounded-xl flex items-center mb-6 font-label-md text-label-md border backdrop-blur-md ${status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-error-container/20 text-error border-error/30'}`}>
              <span className="material-symbols-outlined mr-2" style={{ fontVariationSettings: "'FILL' 1" }}>
                {status.type === 'success' ? 'check_circle' : 'error'}
              </span>
              {status.msg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8 relative z-10">

            {/* Section 1: Item & Category */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              <div className="space-y-2 col-span-1 md:col-span-2">
                <label className="font-label-md text-label-md text-on-surface-variant">Select Material <span className="text-error">*</span></label>
                <div className="relative group">
                  <select
                    className="glass-input w-full rounded-xl py-3 px-4 font-body-md text-body-md text-on-surface focus:outline-none appearance-none"
                    value={selectedItemId}
                    onChange={handleItemChange}
                    required
                  >
                    <option value="">-- Choose Material --</option>
                    {items?.sort((a, b) => a.name.localeCompare(b.name)).map(item => (
                      <option key={item.id} value={item.id}>{item.name}{item.hsnCode ? ` (HSN: ${item.hsnCode})` : ''}</option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-outline group-hover:text-primary transition-colors">
                    <span className="material-symbols-outlined">expand_more</span>
                  </div>
                </div>
              </div>

              {selectedItemId && (
                <div className="space-y-2 col-span-1 md:col-span-2">
                  <label className="font-label-md text-label-md text-on-surface-variant">Assigned Bin Category</label>
                  <div className="h-12 flex items-center">
                    {selectedCategory ? <CategoryBadge category={selectedCategory} /> : <span className="font-body-sm text-body-sm text-outline italic">Auto-populated</span>}
                  </div>
                </div>
              )}

              {/* ── Live Stock Availability Banner ─────────────────────────────── */}
              {selectedItemId && stockInfo && (
                <div className="col-span-1 md:col-span-2">
                  <div className={`rounded-xl p-3 border flex items-center gap-3 flex-wrap ${
                    stockInfo.every(s => s.balance >= 0) ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
                  }`}>
                    <span className={`material-symbols-outlined text-[22px] flex-shrink-0 ${stockInfo.every(s => s.balance >= 0) ? 'text-emerald-600' : 'text-red-600'}`}
                      style={{ fontVariationSettings: "'FILL' 1" }}>
                      {stockInfo.every(s => s.balance >= 0) ? 'inventory_2' : 'warning'}
                    </span>
                    <div>
                      <p className={`text-xs font-bold uppercase tracking-wide ${stockInfo.every(s => s.balance >= 0) ? 'text-emerald-700' : 'text-red-700'}`}>
                        {stockInfo.every(s => s.balance >= 0) ? '📦 Stock Available' : '🔴 Stock Nahi Hai!'}
                      </p>
                      <div className="flex gap-3 flex-wrap mt-0.5">
                        {stockInfo.map(s => (
                          <span key={s.unitName} className={`font-data-mono font-bold text-sm ${s.balance >= 0 ? 'text-emerald-800' : 'text-red-700'}`}>
                            {s.balance >= 0 ? '+' : ''}{s.balance} {s.unitName}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {selectedItemId && !stockInfo && (
                <div className="col-span-1 md:col-span-2 rounded-xl p-3 border border-gray-200 bg-gray-50 flex items-center gap-2">
                  <span className="material-symbols-outlined text-outline text-[18px]">help_outline</span>
                  <p className="text-xs text-outline">Stock balance unknown — koi inward entry nahi hai is material ki</p>
                </div>
              )}
            </div>

            {/* Section 2: Sales Details */}
            <div className="bg-surface-container-low/50 backdrop-blur-sm rounded-xl p-6 border border-secondary/20 relative overflow-hidden group hover:border-secondary/40 transition-colors">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-secondary rounded-l-xl"></div>
              <h3 className="font-label-md text-label-md text-on-surface mb-4 flex items-center">
                <span className="material-symbols-outlined text-secondary mr-2 text-[18px]">receipt_long</span>
                Sales Details
              </h3>

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
                    <p className={`text-xs mt-0.5 ${showMcrPanel ? 'text-indigo-200' : 'text-indigo-500'}`}>
                      Material name, Lot No, ya Purchaser se dhundho — firm name &amp; date auto-fill hoga
                    </p>
                  </div>
                  {selectedMcrLot && !showMcrPanel && (
                    <div className="flex items-center gap-2 bg-white border border-emerald-300 rounded-lg px-2.5 py-1.5">
                      <span className="material-symbols-outlined text-emerald-600 text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                      <div>
                        <p className="text-[10px] font-bold text-emerald-700">{selectedMcrLot.lotNo || selectedMcrLot.material.slice(0, 20)}</p>
                        <p className="text-[9px] text-emerald-600">{selectedMcrLot.qty} {selectedMcrLot.unit} | {selectedMcrLot.purchaser?.slice(0, 18) || '—'}</p>
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
                    {/* Search box */}
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
                        {mcrSearchQuery && (
                          <button className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-error" onClick={() => setMcrSearchQuery('')}>
                            <span className="material-symbols-outlined text-[18px]">close</span>
                          </button>
                        )}
                      </div>
                      {!mcrSearchQuery && (
                        <p className="text-[10px] text-indigo-400 mt-1.5 ml-1 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[12px]">info</span>
                          ⏳ Pending lots automatically dikh rahe hain — type karo to filter ho
                        </p>
                      )}
                    </div>

                    {/* Results list */}
                    <div className="max-h-64 overflow-y-auto">
                      {mcrSuggestions.length === 0 ? (
                        <div className="px-4 py-6 text-center text-outline text-sm">
                          <span className="material-symbols-outlined text-[32px] text-outline/40 block mb-2">search_off</span>
                          Koi lot nahi mila — query badlo
                        </div>
                      ) : (
                        mcrSuggestions.map(lot => {
                          const isPending = lot.status === 'pending';
                          const isCancelled = lot.status === 'cancelled';
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
                                    : isCancelled
                                      ? 'hover:bg-red-50/50 opacity-60'
                                      : 'hover:bg-indigo-50'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-mono font-bold text-[11px] text-on-surface tracking-wide">
                                      {lot.lotNo || <span className="text-outline italic font-normal">No Lot No</span>}
                                    </span>
                                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${
                                      isPending ? 'bg-amber-100 text-amber-700 border-amber-200'
                                        : isCancelled ? 'bg-red-100 text-red-700 border-red-200'
                                        : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                    }`}>
                                      {isPending ? '⏳ Pending' : isCancelled ? '🚫 Cancelled' : '✅ Delivered'}
                                    </span>
                                    {lot.section === 'mp' && (
                                      <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-violet-100 text-violet-700 border border-violet-200">M&amp;P</span>
                                    )}
                                    {isSelected && (
                                      <span className="material-symbols-outlined text-emerald-600 text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                                    )}
                                  </div>
                                  <p className="text-xs text-on-surface font-medium mt-0.5 truncate">{lot.material}</p>
                                  <div className="flex items-center gap-3 mt-1 text-[10px] text-outline flex-wrap">
                                    <span className="font-data-mono font-bold text-primary">{lot.qty} {lot.unit}</span>
                                    {lot.purchaser && <span>🏢 {lot.purchaser}</span>}
                                    {lot.eAuctionDate && <span>📅 Auction: {lot.eAuctionDate}</span>}
                                    {lot.scrNo && <span>📋 SCR: {lot.scrNo}</span>}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="px-4 py-2 bg-indigo-50/50 border-t border-indigo-100 flex items-center justify-between">
                      <p className="text-[10px] text-indigo-400">{mcrSuggestions.length} results</p>
                      <button type="button" onClick={() => setShowMcrPanel(false)} className="text-xs text-indigo-600 font-medium hover:underline">Close</button>
                    </div>
                  </div>
                )}
              </div>

              {/* ── QR Scan Auto-fill Message ───────────────────────────────── */}
              {scanAutoFillMsg && (
                <div className={`mb-4 px-4 py-3 rounded-xl border text-sm font-medium flex items-start gap-2 ${
                  scanAutoFillMsg.startsWith('✅')
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}>
                  <span className="material-symbols-outlined text-[18px] mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>
                    {scanAutoFillMsg.startsWith('✅') ? 'check_circle' : 'warning'}
                  </span>
                  <span>{scanAutoFillMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Lot Number + QR Scan Button */}
                <div className="space-y-2 relative pt-2">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        className="glass-input floating-input w-full rounded-xl py-3 pl-4 pr-12 font-body-md text-body-md text-on-surface focus:outline-none placeholder-transparent uppercase"
                        value={lotNumber}
                        onChange={(e) => { setLotNumber(e.target.value); setScanAutoFillMsg(null); }}
                        placeholder="Lot Number"
                        id="outward-lot"
                        required
                      />
                      <label htmlFor="outward-lot" className="floating-label absolute left-4 top-5 font-body-md text-body-md text-outline transition-all duration-200 pointer-events-none">
                        Lot Number <span className="text-error">*</span>
                      </label>
                    </div>
                    {/* QR / Barcode Scan Button */}
                    <button
                      type="button"
                      onClick={() => setShowQRScanner(true)}
                      title="QR / Barcode Scan karo"
                      className="flex-shrink-0 w-12 h-12 mt-0.5 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all"
                    >
                      <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>qr_code_scanner</span>
                    </button>
                  </div>
                </div>

                {/* HSN Code */}
                <div className="space-y-2 relative pt-2">
                  <input
                    type="text"
                    maxLength={8}
                    className={`glass-input floating-input w-full rounded-xl py-3 px-4 font-data-mono tracking-wider text-on-surface focus:outline-none placeholder-transparent ${hsnAutoFilled ? 'border-emerald-400 bg-emerald-50/30' : ''}`}
                    value={hsnCode}
                    onChange={(e) => { setHsnCode(e.target.value.replace(/\D/g, '')); setHsnAutoFilled(false); }}
                    placeholder="HSN Code"
                    id="outward-hsn"
                    required
                  />
                  <label htmlFor="outward-hsn" className="floating-label absolute left-4 top-5 font-body-md text-body-md text-outline transition-all duration-200 pointer-events-none">
                    8-Digit HSN Code <span className="text-error">*</span>
                  </label>
                  {hsnAutoFilled && (
                    <span className="absolute right-3 top-3.5 text-[10px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full border border-emerald-300">AUTO</span>
                  )}
                </div>

                {/* Firm Name */}
                <div className="space-y-2 relative pt-2 md:col-span-1">
                  <div className="relative">
                    <input
                      type="text"
                      className="glass-input floating-input w-full rounded-xl py-3 px-4 font-body-md text-body-md text-on-surface focus:outline-none placeholder-transparent"
                      value={firmInput}
                      onChange={handleFirmInputChange}
                      onFocus={() => setShowFirmDropdown(firmInput.length > 0 || (firmMasters?.length || 0) > 0)}
                      onBlur={() => setTimeout(() => setShowFirmDropdown(false), 150)}
                      placeholder="Firm Name"
                      id="outward-firm"
                      required
                    />
                    <label htmlFor="outward-firm" className="floating-label absolute left-4 top-5 font-body-md text-body-md text-outline transition-all duration-200 pointer-events-none">
                      Buyer Firm Name <span className="text-error">*</span>
                    </label>
                    {showFirmDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-outline-variant/20 z-50 max-h-48 overflow-y-auto">
                        {firmInput && !filteredFirms.find(f => f.name.toLowerCase() === firmInput.toLowerCase()) && (
                          <div className="px-4 py-2.5 flex items-center gap-2 hover:bg-blue-50 cursor-pointer border-b border-outline-variant/10" onMouseDown={() => handleFirmSelect(firmInput)}>
                            <span className="material-symbols-outlined text-primary text-[16px]">add</span>
                            <span className="text-sm text-primary font-medium">Add "{firmInput}" as new firm</span>
                          </div>
                        )}
                        {filteredFirms.length === 0 && !firmInput && (
                          <div className="px-4 py-3 text-sm text-outline italic">Type to search or add new firm</div>
                        )}
                        {filteredFirms.map(f => (
                          <div key={f.id} className="px-4 py-2.5 hover:bg-blue-50 cursor-pointer text-sm text-on-surface flex items-center gap-2" onMouseDown={() => handleFirmSelect(f.name)}>
                            <span className="material-symbols-outlined text-outline text-[14px]">business</span>
                            {f.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Unit */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pt-6 border-t border-outline-variant/20">
                <div className="space-y-2 relative">
                  <div className="relative group pt-2">
                    <select
                      className="glass-input floating-input w-full rounded-xl py-3 px-4 font-body-md text-body-md text-on-surface focus:outline-none appearance-none"
                      value={unitId}
                      onChange={(e) => { setUnitId(e.target.value); setWeightPerNos(''); }}
                      required
                    >
                      <option value="" disabled hidden>-- Choose Unit --</option>
                      {units?.filter(u => ['MT', 'Kg'].includes(u.name)).map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                      {units?.filter(u => !['MT', 'Kg'].includes(u.name)).map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-outline">
                      <span className="material-symbols-outlined mt-2">expand_more</span>
                    </div>
                    <label className="absolute left-4 -top-0.5 bg-surface/80 px-1 font-body-sm text-body-sm text-primary scale-85 pointer-events-none">
                      Unit <span className="text-error">*</span>
                    </label>
                  </div>
                </div>

                {/* Total Qty Display */}
                <div className="flex items-center gap-3 pl-2">
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-secondary/10 border border-secondary/30 rounded-xl">
                    <span className="material-symbols-outlined text-secondary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>scale</span>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-secondary/70 tracking-wide">Total Quantity</p>
                      <p className="font-data-mono font-bold text-secondary text-lg leading-tight">
                        {totalQtyFromDeliveries > 0 ? `${totalQtyFromDeliveries} ${selectedUnitName}` : '—'}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-outline">Auto-calculated from deliveries below</p>
                </div>
              </div>

              {/* NOS Weight Calculator */}
              {isNosUnit && (
                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <h4 className="text-xs font-semibold text-amber-700 mb-3 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">calculate</span>
                    NOS Weight Calculator
                  </h4>
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex-1 min-w-[160px] relative pt-2">
                      <input
                        type="number" step="0.001" min="0"
                        className="glass-input floating-input w-full rounded-xl py-2.5 px-4 font-body-md text-body-md text-on-surface focus:outline-none placeholder-transparent border-amber-300"
                        value={weightPerNos}
                        onChange={(e) => setWeightPerNos(e.target.value)}
                        placeholder="Weight per 1 NOS"
                        id="outward-wt-nos"
                      />
                      <label htmlFor="outward-wt-nos" className="floating-label absolute left-4 top-4 font-body-sm text-body-sm text-amber-600 transition-all duration-200 pointer-events-none">
                        Weight per 1 NOS (Kg)
                      </label>
                    </div>
                    {calcWeightMT() && (
                      <div className="flex items-center gap-2 bg-white border border-emerald-300 rounded-lg px-4 py-2">
                        <span className="material-symbols-outlined text-emerald-600 text-[18px]">scale</span>
                        <span className="text-sm font-bold text-emerald-700">≈ {calcWeightMT()} MT</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Rate × Amount + GST Calculator ───────────────────────────── */}
              <div className="mt-6 pt-6 border-t border-outline-variant/20">
                <h4 className="text-xs font-bold text-indigo-700 mb-4 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">currency_rupee</span>
                  Rate & Amount Calculator
                  <span className="text-indigo-400 font-normal">(optional)</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="relative pt-2">
                    <input
                      type="number" step="0.01" min="0"
                      className="glass-input floating-input w-full rounded-xl py-3 pl-10 pr-4 font-body-md text-body-md text-on-surface focus:outline-none placeholder-transparent border-indigo-200"
                      value={rate}
                      onChange={(e) => setRate(e.target.value)}
                      placeholder="Rate"
                      id="outward-rate"
                    />
                    <label htmlFor="outward-rate" className="floating-label absolute left-10 top-5 font-body-md text-body-md text-outline transition-all duration-200 pointer-events-none">
                      Rate per {selectedUnitName || 'unit'} (₹)
                    </label>
                    <div className="absolute left-3 top-5 pointer-events-none text-indigo-400 font-bold text-sm">₹</div>
                  </div>

                  <div className="relative">
                    <div className="relative group pt-2">
                      <select
                        className="glass-input floating-input w-full rounded-xl py-3 px-4 font-body-md text-body-md text-on-surface focus:outline-none appearance-none border-indigo-200"
                        value={gstRate}
                        onChange={(e) => setGstRate(Number(e.target.value))}
                      >
                        {GST_RATES.map(r => (
                          <option key={r} value={r}>GST {r}%</option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-outline">
                        <span className="material-symbols-outlined mt-2">expand_more</span>
                      </div>
                      <label className="absolute left-4 -top-0.5 bg-surface/80 px-1 font-body-sm text-body-sm text-indigo-600 scale-85 pointer-events-none">GST Rate</label>
                    </div>
                  </div>

                  {amountCalc ? (
                    <div className="flex flex-col gap-1 bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl p-3">
                      <div className="flex justify-between text-xs text-indigo-600">
                        <span>Base Amount</span>
                        <span className="font-bold">₹{amountCalc.baseAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                      </div>
                      {gstRate > 0 && (
                        <div className="flex justify-between text-xs text-indigo-500">
                          <span>GST ({gstRate}%)</span>
                          <span className="font-semibold">₹{amountCalc.gstAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm text-indigo-800 border-t border-indigo-200 pt-1 mt-1">
                        <span className="font-bold">Grand Total</span>
                        <span className="font-extrabold">₹{amountCalc.grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center rounded-xl border border-dashed border-indigo-200 bg-indigo-50/50 text-xs text-indigo-400 p-3 text-center">
                      Rate dalein to amount auto-calculate hoga
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* RC/FC Cover Breakdown */}
            {isCoverItem && (
              <div className="p-5 bg-gradient-to-br from-blue-50 to-purple-50 border border-indigo-200 rounded-xl">
                <h4 className="text-xs font-bold text-indigo-700 mb-4 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">layers</span>
                  Cover Breakdown — RC & FC
                  <span className="text-indigo-400 font-normal ml-1">(kitne gaye)</span>
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="relative pt-2">
                    <input type="number" min="0"
                      className="glass-input floating-input w-full rounded-xl py-3 px-4 font-body-md text-body-md text-on-surface focus:outline-none placeholder-transparent border-blue-300"
                      value={rcCount} onChange={(e) => setRcCount(e.target.value)}
                      placeholder="RC Count" id="outward-rc"
                    />
                    <label htmlFor="outward-rc" className="floating-label absolute left-4 top-5 font-body-md text-body-md text-blue-600 transition-all duration-200 pointer-events-none">
                      🔵 Rear Cover (RC) — Nos
                    </label>
                  </div>
                  <div className="relative pt-2">
                    <input type="number" min="0"
                      className="glass-input floating-input w-full rounded-xl py-3 px-4 font-body-md text-body-md text-on-surface focus:outline-none placeholder-transparent border-purple-300"
                      value={fcCount} onChange={(e) => setFcCount(e.target.value)}
                      placeholder="FC Count" id="outward-fc"
                    />
                    <label htmlFor="outward-fc" className="floating-label absolute left-4 top-5 font-body-md text-body-md text-purple-600 transition-all duration-200 pointer-events-none">
                      🟣 Front Cover (FC) — Nos
                    </label>
                  </div>
                </div>
                {(rcCount || fcCount) && (
                  <div className="mt-3 flex items-center gap-3 flex-wrap">
                    {rcCount && <span className="px-2.5 py-1 rounded-lg bg-blue-100 border border-blue-200 text-blue-700 text-xs font-bold">RC: {rcCount} Nos</span>}
                    {fcCount && <span className="px-2.5 py-1 rounded-lg bg-purple-100 border border-purple-200 text-purple-700 text-xs font-bold">FC: {fcCount} Nos</span>}
                    {rcCount && fcCount && (
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
                        = {Number(rcCount) + Number(fcCount)} Total
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Section 3: Timelines */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="space-y-2 relative pt-2">
                <input type="date"
                  className="glass-input floating-input w-full rounded-xl py-3 pl-12 pr-4 font-body-md text-body-md text-on-surface focus:outline-none"
                  value={dateLotApplied} onChange={(e) => setDateLotApplied(e.target.value)}
                />
                <label className="absolute left-12 -top-0.5 bg-surface/80 px-1 font-body-sm text-body-sm text-on-surface-variant scale-85 pointer-events-none">
                  Date Lot Applied <span className="text-amber-500 text-[10px] font-normal">(optional)</span>
                </label>
                <div className="absolute left-4 top-5 pointer-events-none text-outline-variant">
                  <span className="material-symbols-outlined text-[20px]">calendar_today</span>
                </div>
                {!dateLotApplied && (
                  <p className="text-[10px] text-amber-500 flex items-center gap-0.5 ml-1">
                    <span className="material-symbols-outlined text-[12px]">schedule</span>
                    Will show as "Pending"
                  </p>
                )}
              </div>
              <div className="space-y-2 relative pt-2">
                <input type="date"
                  className="glass-input floating-input w-full rounded-xl py-3 pl-12 pr-4 font-body-md text-body-md text-on-surface focus:outline-none"
                  value={dateSold} onChange={(e) => setDateSold(e.target.value)} required
                />
                <label className="absolute left-12 -top-0.5 bg-surface/80 px-1 font-body-sm text-body-sm text-primary scale-85 pointer-events-none">
                  Date Sold (Auction) <span className="text-error">*</span>
                </label>
                <div className="absolute left-4 top-5 pointer-events-none text-outline-variant">
                  <span className="material-symbols-outlined text-[20px]">gavel</span>
                </div>
              </div>
            </div>

            {/* ── Section 4: Delivery Schedule ──────────────────────────────── */}
            <div className="bg-gradient-to-br from-violet-50/60 to-indigo-50/60 border border-violet-200 rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-violet-500 to-indigo-500 rounded-l-2xl"></div>

              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-label-md text-label-md text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-violet-600 text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>local_shipping</span>
                    Delivery Schedule
                    <span className="bg-violet-200 text-violet-800 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      {deliveries.length} {deliveries.length === 1 ? 'date' : 'dates'}
                    </span>
                  </h3>
                  <p className="text-xs text-outline mt-0.5 ml-7">
                    Jis din kuch bhi gaya, ek alag row add karo. Final delivery ko ✅ mark karo.
                  </p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-100 border border-violet-300 rounded-lg">
                  <span className="material-symbols-outlined text-violet-600 text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>sigma</span>
                  <span className="text-xs font-bold text-violet-700">Total: {totalQtyFromDeliveries} {selectedUnitName || 'unit'}</span>
                </div>
              </div>

              {/* Column Headers */}
              <div className="grid grid-cols-[32px_1fr_120px_100px_auto] gap-3 mb-2 px-1">
                <p className="text-[10px] font-bold text-outline uppercase tracking-wider">#</p>
                <p className="text-[10px] font-bold text-outline uppercase tracking-wider">Date</p>
                <p className="text-[10px] font-bold text-outline uppercase tracking-wider">Quantity</p>
                <p className="text-[10px] font-bold text-violet-600 uppercase tracking-wider flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px]">flag</span>Final?
                </p>
                <p></p>
              </div>

              {/* Delivery Rows */}
              <div className="space-y-3">
                {deliveries.map((slot, idx) => (
                  <div
                    key={idx}
                    className={`grid grid-cols-[32px_1fr_120px_100px_auto] gap-3 items-center p-3 rounded-xl border transition-all ${
                      slot.isFinal
                        ? 'bg-emerald-50 border-emerald-300 shadow-sm'
                        : 'bg-white/70 border-outline-variant/30'
                    }`}
                  >
                    {/* Row Number */}
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold ${
                      slot.isFinal ? 'bg-emerald-500 text-white' : 'bg-violet-100 text-violet-700'
                    }`}>
                      {idx + 1}
                    </div>

                    {/* Date */}
                    <div className="relative">
                      <input
                        type="date"
                        value={slot.date}
                        onChange={e => updateDelivery(idx, 'date', e.target.value)}
                        className="w-full glass-input rounded-lg py-2 px-3 text-sm text-on-surface focus:outline-none"
                        required
                      />
                    </div>

                    {/* Quantity */}
                    <div className="relative">
                      <input
                        type="number" step="0.01" min="0"
                        value={slot.quantity || ''}
                        onChange={e => updateDelivery(idx, 'quantity', Number(e.target.value))}
                        placeholder="Qty"
                        className="w-full glass-input rounded-lg py-2 px-3 text-sm font-data-mono text-on-surface focus:outline-none"
                        required
                      />
                    </div>

                    {/* Final checkbox */}
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 cursor-pointer select-none group">
                        <div className="relative">
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={slot.isFinal}
                            onChange={e => updateDelivery(idx, 'isFinal', e.target.checked)}
                          />
                          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                            slot.isFinal
                              ? 'bg-emerald-500 border-emerald-500'
                              : 'bg-white border-outline-variant/60 group-hover:border-violet-400'
                          }`}>
                            {slot.isFinal && <span className="material-symbols-outlined text-white text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>}
                          </div>
                        </div>
                        {slot.isFinal && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full border border-emerald-300 whitespace-nowrap">
                            🏁 Final
                          </span>
                        )}
                      </label>
                    </div>

                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={() => removeDelivery(idx)}
                      disabled={deliveries.length === 1}
                      className="p-1.5 text-outline hover:text-error rounded-lg hover:bg-error/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Remove delivery"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                ))}
              </div>

              {/* Add Delivery Button */}
              <button
                type="button"
                onClick={addDelivery}
                className="mt-4 w-full py-2.5 border-2 border-dashed border-violet-300 rounded-xl text-sm font-semibold text-violet-600 hover:bg-violet-50 hover:border-violet-400 transition-all flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">add_circle</span>
                Add Another Delivery Date
              </button>

              {/* ── Live Preview — HAMESHA dikhega ───────────────────────────── */}
              <div className="mt-5 pt-4 border-t border-violet-200">
                <p className="text-[10px] font-bold text-violet-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>preview</span>
                  Live Preview — Date-wise Breakup
                  <span className="font-normal text-violet-400">(save hone ke baad aisi hi dikhegi)</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {deliveries.map((d, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border shadow-sm transition-all ${
                        d.isFinal
                          ? 'bg-emerald-100 border-emerald-400 text-emerald-800'
                          : 'bg-violet-50 border-violet-300 text-violet-800'
                      }`}
                    >
                      <span className={`text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold flex-shrink-0 ${
                        d.isFinal ? 'bg-emerald-600 text-white' : 'bg-violet-300 text-violet-900'
                      }`}>{i + 1}</span>
                      {d.isFinal && <span className="material-symbols-outlined text-emerald-600 text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>flag</span>}
                      <span className="font-data-mono font-bold">
                        {d.date ? new Date(d.date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-- date --'}
                      </span>
                      <span className="font-bold text-sm">→ {d.quantity || 0} {selectedUnitName || 'unit'}</span>
                      {d.isFinal && <span className="text-[9px] bg-emerald-600 text-white px-1.5 py-0.5 rounded-full font-bold">FINAL</span>}
                    </div>
                  ))}
                  {totalQtyFromDeliveries > 0 && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border bg-gray-100 border-gray-300 text-gray-700 shadow-sm">
                      <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>sigma</span>
                      Total: {totalQtyFromDeliveries} {selectedUnitName || 'unit'}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-outline-variant/20 flex justify-end">
              <button
                type="submit"
                className="bg-secondary hover:bg-secondary/90 text-white font-label-md text-label-md py-3 px-8 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2 hover:-translate-y-0.5"
              >
                <span className="material-symbols-outlined text-[20px]">send</span>
                Log Outward Sale
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* QR Scanner Modal */}
      {showQRScanner && (
        <QRScannerModal
          onScanSuccess={handleScanSuccess}
          onClose={() => setShowQRScanner(false)}
        />
      )}
    </ProtectedView>
  );
}
