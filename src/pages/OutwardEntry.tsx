import React, { useState, useMemo } from 'react';
import { db, useLiveQuery } from '../db/db';
import { CategoryBadge } from '../components/CategoryBadge';
import { ProtectedView } from '../components/ProtectedView';
import { useNavigate } from 'react-router-dom';

const GST_RATES = [0, 5, 12, 18];

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
  const [quantity, setQuantity] = useState<string>('');
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

  const today = new Date().toISOString().split('T')[0];
  const [dateLotApplied, setDateLotApplied] = useState<string>('');
  const [dateSold, setDateSold] = useState<string>(today);
  const [dateDelivered, setDateDelivered] = useState<string>(today);

  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

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

    // group by unit
    const inByUnit: Record<number, number> = {};
    inwardEntries.filter(e => e.itemId === itemId).forEach(e => {
      inByUnit[e.unitId] = (inByUnit[e.unitId] || 0) + e.quantity;
    });
    const outByUnit: Record<number, number> = {};
    outwardEntries.filter(e => e.itemId === itemId).forEach(e => {
      outByUnit[e.unitId] = (outByUnit[e.unitId] || 0) + e.quantity;
    });

    // find common units
    const results: { unitName: string; balance: number }[] = [];
    Object.keys(inByUnit).forEach(uid => {
      const u = Number(uid);
      const bal = (inByUnit[u] || 0) - (outByUnit[u] || 0);
      results.push({ unitName: unitMap.get(u) || String(u), balance: bal });
    });
    return results.length > 0 ? results : null;
  }, [selectedItemId, inwardEntries, outwardEntries, unitMap]);

  // ── Rate × Amount calculation ─────────────────────────────────────────────
  const amountCalc = useMemo(() => {
    const qty = Number(quantity);
    const r = Number(rate);
    if (!qty || !r) return null;
    const baseAmount = qty * r;
    const gstAmount = (baseAmount * gstRate) / 100;
    return { baseAmount, gstAmount, grandTotal: baseAmount + gstAmount };
  }, [quantity, rate, gstRate]);

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
    if (!isNosUnit || !quantity || !weightPerNos) return null;
    return ((Number(quantity) * Number(weightPerNos)) / 1000).toFixed(3);
  };

  const filteredFirms = useMemo(() => {
    if (!firmMasters) return [];
    const q = firmInput.toLowerCase();
    return firmMasters.filter(f => f.name.toLowerCase().includes(q));
  }, [firmMasters, firmInput]);

  const handleItemChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedItemId(val);
    if (!val || !items) {
      setHsnAutoFilled(false);
      return;
    }
    const item = items.find(i => i.id === Number(val));
    if (item?.hsnCode) {
      setHsnCode(item.hsnCode);
      setHsnAutoFilled(true);
    } else {
      setHsnCode('');
      setHsnAutoFilled(false);
    }
  };

  const handleFirmSelect = (name: string) => {
    setFirmName(name);
    setFirmInput(name);
    setShowFirmDropdown(false);
  };

  const handleFirmInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFirmInput(val);
    setFirmName(val);
    setShowFirmDropdown(val.length > 0);
  };

  if (!items || !categories || !units) return null;

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!selectedItemId || !lotNumber || !hsnCode || !quantity || !unitId || !firmName) {
      setStatus({ type: 'error', msg: 'Please fill in all required fields.' });
      return;
    }

    try {
      // Auto-save new firm name to master list
      if (firmMasters && !firmMasters.find(f => f.name.toLowerCase() === firmName.toLowerCase())) {
        await db.firmMasters.add({ name: firmName });
      }

      const entryData: any = {
        itemId: Number(selectedItemId),
        lotNumber,
        hsnCode,
        quantity: Number(quantity),
        unitId: Number(unitId),
        firmName,
        dateLotApplied: dateLotApplied || undefined,
        dateSold,
        dateDelivered,
      };

      if (isNosUnit && weightPerNos) entryData.weightPerNos = Number(weightPerNos);
      if (isCoverItem) {
        if (rcCount) entryData.rcCount = Number(rcCount);
        if (fcCount) entryData.fcCount = Number(fcCount);
      }

      await db.outwardEntries.add(entryData);

      // ── Auto-save HSN to item master ──────────────────────────────────────
      const selectedItemObj = items?.find(i => i.id === Number(selectedItemId));
      if (selectedItemObj && hsnCode && selectedItemObj.hsnCode !== hsnCode) {
        try {
          await db.items.update(Number(selectedItemId), { ...selectedItemObj, hsnCode });
        } catch { /* silent */ }
      }

      const hsnMsg = selectedItemObj && selectedItemObj.hsnCode !== hsnCode ? ' HSN bhi save ho gaya!' : '';
      setStatus({ type: 'success', msg: `✅ Outward entry recorded successfully!${hsnMsg}` });

      setSelectedItemId('');
      setLotNumber('');
      setHsnCode('');
      setHsnAutoFilled(false);
      setQuantity('');
      setUnitId('');
      setFirmName('');
      setFirmInput('');
      setWeightPerNos('');
      setRcCount('');
      setFcCount('');
      setRate('');
      setGstRate(0);
      setDateLotApplied('');
      setDateSold(today);
      setDateDelivered(today);
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
                    stockInfo.every(s => s.balance >= 0)
                      ? 'bg-emerald-50 border-emerald-200'
                      : 'bg-red-50 border-red-200'
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
              <h3 className="font-label-md text-label-md text-on-surface mb-6 flex items-center">
                <span className="material-symbols-outlined text-secondary mr-2 text-[18px]">receipt_long</span>
                Sales Details
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Lot Number */}
                <div className="space-y-2 relative pt-2">
                  <input
                    type="text"
                    className="glass-input floating-input w-full rounded-xl py-3 px-4 font-body-md text-body-md text-on-surface focus:outline-none placeholder-transparent uppercase"
                    value={lotNumber}
                    onChange={(e) => setLotNumber(e.target.value)}
                    placeholder="Lot Number"
                    id="outward-lot"
                    required
                  />
                  <label htmlFor="outward-lot" className="floating-label absolute left-4 top-5 font-body-md text-body-md text-outline transition-all duration-200 pointer-events-none">
                    Lot Number <span className="text-error">*</span>
                  </label>
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

              {/* Quantity + Unit */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pt-6 border-t border-outline-variant/20">
                <div className="space-y-2 relative pt-2">
                  <input
                    type="number" step="0.01" min="0"
                    className="glass-input floating-input w-full rounded-xl py-3 px-4 font-body-md text-body-md text-on-surface focus:outline-none placeholder-transparent"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="Quantity"
                    id="outward-qty"
                    required
                  />
                  <label htmlFor="outward-qty" className="floating-label absolute left-4 top-5 font-body-md text-body-md text-outline transition-all duration-200 pointer-events-none">
                    Quantity Sold <span className="text-error">*</span>
                  </label>
                </div>

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
                  {/* Rate */}
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

                  {/* GST Rate */}
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

                  {/* Calculated Result */}
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
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
              <div className="space-y-2 relative pt-2">
                <input type="date"
                  className="glass-input floating-input w-full rounded-xl py-3 pl-12 pr-4 font-body-md text-body-md text-on-surface focus:outline-none"
                  value={dateDelivered} onChange={(e) => setDateDelivered(e.target.value)} required
                />
                <label className="absolute left-12 -top-0.5 bg-surface/80 px-1 font-body-sm text-body-sm text-primary scale-85 pointer-events-none">
                  Date Delivered <span className="text-error">*</span>
                </label>
                <div className="absolute left-4 top-5 pointer-events-none text-outline-variant">
                  <span className="material-symbols-outlined text-[20px]">local_shipping</span>
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
    </ProtectedView>
  );
}
