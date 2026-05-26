import React, { useState, useMemo } from 'react';
import { db, useLiveQuery } from '../db/db';
import { CategoryBadge } from '../components/CategoryBadge';
import { ProtectedView } from '../components/ProtectedView';

export function OutwardEntry() {
  const items = useLiveQuery(() => db.items.toArray());
  const categories = useLiveQuery(() => db.categories.toArray());
  const units = useLiveQuery(() => db.units.toArray());
  const firmMasters = useLiveQuery(() => db.firmMasters.toArray());

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

  const today = new Date().toISOString().split('T')[0];
  const [dateLotApplied, setDateLotApplied] = useState<string>('');
  const [dateSold, setDateSold] = useState<string>(today);
  const [dateDelivered, setDateDelivered] = useState<string>(today);

  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

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

      if (isNosUnit && weightPerNos) {
        entryData.weightPerNos = Number(weightPerNos);
      }

      await db.outwardEntries.add(entryData);

      setStatus({ type: 'success', msg: 'Outward entry recorded successfully.' });
      setSelectedItemId('');
      setLotNumber('');
      setHsnCode('');
      setHsnAutoFilled(false);
      setQuantity('');
      setUnitId('');
      setFirmName('');
      setFirmInput('');
      setWeightPerNos('');
      setDateLotApplied('');
      setDateSold(today);
      setDateDelivered(today);
      setTimeout(() => setStatus(null), 3000);
    } catch (err) {
      setStatus({ type: 'error', msg: 'Failed to record entry.' });
    }
  };

  return (
    <ProtectedView>
      <div className="animate-fade-in space-y-8">
        <div className="mb-8">
          <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface flex items-center gap-2">
             <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1", fontSize: '32px' }}>upload</span>
             Log Outward / Sale
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">Record materials leaving the yard securely.</p>
        </div>

        <div className="glass-panel rounded-2xl shadow-sm overflow-hidden p-6 md:p-8 max-w-4xl relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-secondary-container/10 rounded-full blur-[80px] -mr-20 -mt-20 pointer-events-none"></div>
          
          {status && (
            <div className={`p-4 rounded-xl flex items-center mb-6 font-label-md text-label-md border backdrop-blur-md ${status.type === 'success' ? 'bg-tertiary-container/20 text-tertiary border-tertiary/30' : 'bg-error-container/20 text-error border-error/30'}`}>
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
                <label className="font-label-md text-label-md text-on-surface-variant flex justify-between">
                  <span>Select Material <span className="text-error">*</span></span>
                </label>
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
                    {selectedCategory ? (
                      <CategoryBadge category={selectedCategory} />
                    ) : (
                      <span className="font-body-sm text-body-sm text-outline italic">Auto-populated</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Section 2: Lot & Sale Details */}
            <div className="bg-surface-container-low/50 backdrop-blur-sm rounded-xl p-6 border border-secondary/20 relative overflow-hidden group hover:border-secondary/40 transition-colors">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-secondary rounded-l-xl"></div>
              <h3 className="font-label-md text-label-md text-on-surface mb-6 flex items-center">
                <span className="material-symbols-outlined text-secondary mr-2 text-[18px]">receipt_long</span>
                Sales Details
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

                {/* HSN Code with auto-fill indicator */}
                <div className="space-y-2 relative pt-2">
                  <input
                    type="text"
                    maxLength={8}
                    pattern="\d{8}"
                    className={`glass-input floating-input w-full rounded-xl py-3 px-4 font-data-mono tracking-wider text-on-surface focus:outline-none placeholder-transparent ${hsnAutoFilled ? 'border-emerald-400 bg-emerald-50/30' : ''}`}
                    value={hsnCode}
                    onChange={(e) => { setHsnCode(e.target.value.replace(/\D/g, '')); setHsnAutoFilled(false); }}
                    placeholder="HSN Code"
                    id="outward-hsn"
                    title="Must be exactly 8 digits"
                    required
                  />
                  <label htmlFor="outward-hsn" className="floating-label absolute left-4 top-5 font-body-md text-body-md text-outline transition-all duration-200 pointer-events-none">
                    8-Digit HSN Code <span className="text-error">*</span>
                  </label>
                  {hsnAutoFilled && (
                    <span className="absolute right-3 top-3.5 text-[10px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full border border-emerald-300">
                      AUTO
                    </span>
                  )}
                </div>

                {/* Firm Name with Master Dropdown */}
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
                          <div
                            className="px-4 py-2.5 flex items-center gap-2 hover:bg-blue-50 cursor-pointer border-b border-outline-variant/10"
                            onMouseDown={() => handleFirmSelect(firmInput)}
                          >
                            <span className="material-symbols-outlined text-primary text-[16px]">add</span>
                            <span className="text-sm text-primary font-medium">Add "{firmInput}" as new firm</span>
                          </div>
                        )}
                        {filteredFirms.length === 0 && !firmInput && (
                          <div className="px-4 py-3 text-sm text-outline italic">Type to search or add new firm</div>
                        )}
                        {filteredFirms.map(f => (
                          <div
                            key={f.id}
                            className="px-4 py-2.5 hover:bg-blue-50 cursor-pointer text-sm text-on-surface flex items-center gap-2"
                            onMouseDown={() => handleFirmSelect(f.name)}
                          >
                            <span className="material-symbols-outlined text-outline text-[14px]">business</span>
                            {f.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pt-6 border-t border-outline-variant/20">
                <div className="space-y-2 relative pt-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
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
                    <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-outline group-hover:text-primary transition-colors">
                      <span className="material-symbols-outlined mt-2">expand_more</span>
                    </div>
                    <label className="absolute left-4 -top-0.5 bg-surface/80 px-1 font-body-sm text-body-sm text-primary transition-all duration-200 pointer-events-none scale-85">
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
                    NOS Weight Calculator <span className="text-amber-500 font-normal">(optional)</span>
                  </h4>
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex-1 min-w-[160px] relative pt-2">
                      <input
                        type="number"
                        step="0.001"
                        min="0"
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
                        <span className="text-xs text-outline">({quantity} × {weightPerNos} Kg ÷ 1000)</span>
                      </div>
                    )}
                    {!weightPerNos && (
                      <p className="text-xs text-amber-600 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">info</span>
                        Leave blank if unknown — update later from records
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Section 3: Timelines */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
               <div className="space-y-2 relative pt-2">
                <input
                  type="date"
                  className="glass-input floating-input w-full rounded-xl py-3 pl-12 pr-4 font-body-md text-body-md text-on-surface focus:outline-none"
                  value={dateLotApplied}
                  onChange={(e) => setDateLotApplied(e.target.value)}
                />
                <label className="absolute left-12 -top-0.5 bg-surface/80 px-1 font-body-sm text-body-sm text-on-surface-variant transition-all duration-200 pointer-events-none scale-85">
                  Date Lot Applied <span className="text-amber-500 text-[10px] font-normal">(optional)</span>
                </label>
                <div className="absolute left-4 top-5 pointer-events-none text-outline-variant">
                  <span className="material-symbols-outlined text-[20px]">calendar_today</span>
                </div>
                {!dateLotApplied && (
                  <p className="text-[10px] text-amber-500 flex items-center gap-0.5 ml-1">
                    <span className="material-symbols-outlined text-[12px]">schedule</span>
                    Can be filled later — will show as "Pending"
                  </p>
                )}
              </div>
              <div className="space-y-2 relative pt-2">
                <input
                  type="date"
                  className="glass-input floating-input w-full rounded-xl py-3 pl-12 pr-4 font-body-md text-body-md text-on-surface focus:outline-none"
                  value={dateSold}
                  onChange={(e) => setDateSold(e.target.value)}
                  required
                />
                <label className="absolute left-12 -top-0.5 bg-surface/80 px-1 font-body-sm text-body-sm text-primary transition-all duration-200 pointer-events-none scale-85">
                  Date Sold (Auction) <span className="text-error">*</span>
                </label>
                <div className="absolute left-4 top-5 pointer-events-none text-outline-variant">
                  <span className="material-symbols-outlined text-[20px]">gavel</span>
                </div>
              </div>
              <div className="space-y-2 relative pt-2">
                <input
                  type="date"
                  className="glass-input floating-input w-full rounded-xl py-3 pl-12 pr-4 font-body-md text-body-md text-on-surface focus:outline-none"
                  value={dateDelivered}
                  onChange={(e) => setDateDelivered(e.target.value)}
                  required
                />
                <label className="absolute left-12 -top-0.5 bg-surface/80 px-1 font-body-sm text-body-sm text-primary transition-all duration-200 pointer-events-none scale-85">
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
