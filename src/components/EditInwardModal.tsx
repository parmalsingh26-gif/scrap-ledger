import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { db, useLiveQuery, type InwardEntry, type Item } from '../db/db';
import { CategoryBadge } from './CategoryBadge';

export function EditInwardModal({ 
  entry, 
  item, 
  onClose 
}: { 
  entry: InwardEntry; 
  item: Item; 
  onClose: () => void;
}) {
  const items = useLiveQuery(() => db.items.toArray());
  const categories = useLiveQuery(() => db.categories.toArray());
  const units = useLiveQuery(() => db.units.toArray());

  const [quantity, setQuantity] = useState<string>(String(entry.quantity));
  const [unitId, setUnitId] = useState<string>(String(entry.unitId));
  const [date, setDate] = useState<string>(entry.date);
  const [lotNumber, setLotNumber] = useState<string>(entry.lotNumber || '');
  
  const [machineType, setMachineType] = useState<'MG' | 'BG' | ''>(entry.machineType || '');
  const [coverType, setCoverType] = useState<'RC' | 'FC' | ''>(entry.coverType || '');
  const [rcCount, setRcCount] = useState<string>(entry.rcCount ? String(entry.rcCount) : '');
  const [fcCount, setFcCount] = useState<string>(entry.fcCount ? String(entry.fcCount) : '');
  const [weightPerNos, setWeightPerNos] = useState<string>(entry.weightPerNos ? String(entry.weightPerNos) : '');

  // Value fields
  const [valueMode, setValueMode] = useState<string>(entry.valueMode || 'weight');
  const [rate, setRate] = useState<string>(entry.rate ? String(entry.rate) : '');
  const [manualTotalValue, setManualTotalValue] = useState<string>(entry.totalValue ? String(entry.totalValue) : '');

  const [isSaving, setIsSaving] = useState(false);

  const selectedCategory = useMemo(() => {
    if (!item || !categories) return null;
    return categories.find(c => c.id === item.categoryId) || null;
  }, [item, categories]);

  const selectedUnitName = useMemo(() => {
    if (!unitId || !units) return '';
    return units.find(u => u.id === Number(unitId))?.name || '';
  }, [unitId, units]);

  const isNosUnit = selectedUnitName === 'Nos';
  const isVolumeUnit = ['LTR', 'KL', 'L'].includes(selectedUnitName.toUpperCase());
  const isWeightUnit = ['MT', 'Kg', 'KG'].includes(selectedUnitName);

  const calculatedValue = useMemo(() => {
    const qty = Number(quantity);
    const r = Number(rate);
    if (!qty || !r || valueMode === 'manual') return null;
    return qty * r;
  }, [quantity, rate, valueMode]);

  const totalValue = valueMode === 'manual' ? Number(manualTotalValue) || 0 : (calculatedValue || 0);

  const calcWeightMT = () => {
    if (!isNosUnit || !quantity || !weightPerNos) return null;
    return ((Number(quantity) * Number(weightPerNos)) / 1000).toFixed(3);
  };

  const itemName = item?.name?.toLowerCase() || '';
  const isBearingOrCover = itemName.includes('bearing') || itemName.includes('cover');
  const isCover = itemName.includes('cover');

  const handleSave = async (e: any) => {
    e.preventDefault();
    if (!quantity || !unitId || !date) return;
    
    setIsSaving(true);
    try {
      await db.inwardEntries.update(entry.id!, {
        quantity: Number(quantity),
        unitId: Number(unitId),
        date,
        lotNumber: lotNumber || undefined,
        machineType: machineType ? machineType as 'MG' | 'BG' : undefined,
        coverType: coverType ? coverType as 'RC' | 'FC' : undefined,
        rcCount: rcCount ? Number(rcCount) : undefined,
        fcCount: fcCount ? Number(fcCount) : undefined,
        weightPerNos: weightPerNos ? Number(weightPerNos) : undefined,
        valueMode: valueMode as any,
        rate: rate ? Number(rate) : undefined,
        totalValue: totalValue || undefined,
      });
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
        maxWidth: '600px',
        maxHeight: '90vh',
        background: 'rgba(255,255,255,0.97)',
        borderRadius: '20px',
        boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.4)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div className="px-6 py-4 border-b border-outline-variant/20 flex items-center justify-between bg-surface/50 flex-shrink-0">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
               <span className="material-symbols-outlined text-primary">edit_square</span>
             </div>
             <div>
               <h3 className="font-headline-md text-[18px] font-bold text-on-surface leading-tight">Edit Entry</h3>
               <p className="font-body-sm text-body-sm text-outline text-[12px]">{item.name}</p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 text-outline hover:text-on-surface rounded-full hover:bg-surface-variant/50 transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto">
          <form id="edit-inward-form" onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              
              <div className="space-y-2 col-span-1 md:col-span-2">
                <label className="font-label-md text-label-md text-on-surface-variant">Category</label>
                <div className="h-12 flex items-center">
                  {selectedCategory && <CategoryBadge category={selectedCategory} />}
                </div>
              </div>

              <div className="space-y-2 relative pt-2">
                <input
                  type="number" step="0.01" min="0"
                  className="glass-input floating-input w-full rounded-xl py-3 px-4 font-body-md text-body-md text-on-surface focus:outline-none placeholder-transparent"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="Quantity" id="edit-qty" required
                />
                <label htmlFor="edit-qty" className="floating-label absolute left-4 top-5 font-body-md text-body-md text-outline transition-all duration-200 pointer-events-none">
                  Quantity <span className="text-error">*</span>
                </label>
              </div>

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

              {/* Weight per NOS — shows when unit = Nos */}
              {isNosUnit && (
                <div className="col-span-1 md:col-span-2 p-4 bg-amber-50 border border-amber-200 rounded-xl">
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
                        id="edit-wt-nos"
                      />
                      <label htmlFor="edit-wt-nos" className="floating-label absolute left-4 top-4 font-body-sm text-body-sm text-amber-600 transition-all duration-200 pointer-events-none">
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

              {/* Value Section */}
              <div className="col-span-1 md:col-span-2 p-4 bg-indigo-50/70 border border-indigo-200/60 rounded-xl">
                <h4 className="text-xs font-semibold text-indigo-700 mb-3 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">currency_rupee</span>
                  Value Details
                </h4>
                <div className="flex gap-2 flex-wrap mb-3">
                  {['weight', 'nos', 'volume', 'manual'].map(mode => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setValueMode(mode)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${
                        valueMode === mode
                          ? 'bg-indigo-100 border-indigo-400 text-indigo-800 shadow-sm'
                          : 'bg-white/70 border-gray-200 text-gray-500 hover:border-gray-400'
                      }`}
                    >
                      {mode === 'weight' ? '⚖️ Weight' : mode === 'nos' ? '🔢 Nos' : mode === 'volume' ? '💧 Volume' : '✏️ Manual'}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {valueMode !== 'manual' ? (
                    <div className="relative pt-2">
                      <input
                        type="number" step="0.01" min="0"
                        className="glass-input floating-input w-full rounded-xl py-2.5 px-4 font-body-md text-body-md text-on-surface focus:outline-none placeholder-transparent border-indigo-300"
                        value={rate}
                        onChange={(e) => setRate(e.target.value)}
                        placeholder="Rate"
                        id="edit-rate"
                      />
                      <label htmlFor="edit-rate" className="floating-label absolute left-4 top-4 font-body-sm text-body-sm text-indigo-600 transition-all duration-200 pointer-events-none">
                        Rate per {valueMode === 'nos' ? 'Nos' : selectedUnitName || 'unit'} (₹)
                      </label>
                    </div>
                  ) : (
                    <div className="relative pt-2">
                      <input
                        type="number" step="0.01" min="0"
                        className="glass-input floating-input w-full rounded-xl py-2.5 px-4 font-body-md text-body-md text-on-surface focus:outline-none placeholder-transparent border-indigo-300"
                        value={manualTotalValue}
                        onChange={(e) => setManualTotalValue(e.target.value)}
                        placeholder="Total Value"
                        id="edit-manual-value"
                      />
                      <label htmlFor="edit-manual-value" className="floating-label absolute left-4 top-4 font-body-sm text-body-sm text-indigo-600 transition-all duration-200 pointer-events-none">
                        Total Value (₹)
                      </label>
                    </div>
                  )}
                  {totalValue > 0 && (
                    <div className="flex items-center gap-2 bg-white border border-emerald-300 rounded-lg px-4 py-2">
                      <span className="material-symbols-outlined text-emerald-600 text-[18px]">payments</span>
                      <span className="text-sm font-bold text-emerald-700">₹ {totalValue.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2 relative pt-2">
                <input
                  type="text"
                  className="glass-input floating-input w-full rounded-xl py-3 pl-12 pr-4 font-body-md text-body-md text-on-surface focus:outline-none placeholder-transparent"
                  value={lotNumber} onChange={(e) => setLotNumber(e.target.value)}
                  placeholder="Lot Number" id="edit-lot"
                />
                <label htmlFor="edit-lot" className="floating-label absolute left-12 top-5 font-body-md text-body-md text-outline transition-all duration-200 pointer-events-none">
                  Lot / Reference No.
                </label>
                <div className="absolute left-4 top-5 pointer-events-none text-outline-variant">
                  <span className="material-symbols-outlined text-[20px]">tag</span>
                </div>
              </div>

              <div className="space-y-2 relative pt-2">
                <input
                  type="date"
                  className="glass-input floating-input w-full rounded-xl py-3 pl-12 pr-4 font-body-md text-body-md text-on-surface focus:outline-none"
                  value={date} onChange={(e) => setDate(e.target.value)} required
                />
                <label className="absolute left-12 -top-0.5 bg-surface/80 px-1 font-body-sm text-body-sm text-primary transition-all duration-200 pointer-events-none scale-85">
                  Date Received <span className="text-error">*</span>
                </label>
                <div className="absolute left-4 top-5 pointer-events-none text-outline-variant">
                  <span className="material-symbols-outlined text-[20px]">calendar_today</span>
                </div>
              </div>
            </div>

            {isBearingOrCover && (
              <div className="mt-8 bg-surface-container-low/50 backdrop-blur-sm rounded-xl p-6 border border-tertiary/20 relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-tertiary rounded-l-xl"></div>
                <h3 className="font-label-md text-label-md text-on-surface mb-4 flex items-center">
                  <span className="material-symbols-outlined text-tertiary mr-2 text-[18px]">add_circle</span>
                  Additional Specifications
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 relative pt-2">
                    <select
                      className="glass-input floating-input w-full rounded-xl py-3 px-4 font-body-md text-body-md text-on-surface focus:outline-none appearance-none"
                      value={machineType} onChange={(e) => setMachineType(e.target.value as 'MG'|'BG')} required
                    >
                      <option value="" disabled hidden></option>
                      <option value="MG">MG (Meter Gauge)</option>
                      <option value="BG">BG (Broad Gauge)</option>
                    </select>
                    <label className="absolute left-4 -top-0.5 bg-surface/80 px-1 font-body-sm text-body-sm text-primary transition-all duration-200 pointer-events-none scale-85">
                      Machine Type <span className="text-error">*</span>
                    </label>
                    <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-outline transition-colors">
                      <span className="material-symbols-outlined mt-2">expand_more</span>
                    </div>
                  </div>
                  
                  {isCover && (
                    <>
                      <div className="space-y-2 relative pt-2">
                        <select
                          className="glass-input floating-input w-full rounded-xl py-3 px-4 font-body-md text-body-md text-on-surface focus:outline-none appearance-none"
                          value={coverType} onChange={(e) => setCoverType(e.target.value as 'RC'|'FC')}
                        >
                          <option value="">Any / Not Specific</option>
                          <option value="RC">Rear Cover (RC)</option>
                          <option value="FC">Front Cover (FC)</option>
                        </select>
                        <label className="absolute left-4 -top-0.5 bg-surface/80 px-1 font-body-sm text-body-sm text-primary transition-all duration-200 pointer-events-none scale-85">
                          Cover Designation
                        </label>
                        <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-outline mt-2 transition-colors">
                          <span className="material-symbols-outlined">expand_more</span>
                        </div>
                      </div>
                      <div className="col-span-1 md:col-span-2 grid grid-cols-2 gap-6">
                        <div className="space-y-2 relative pt-2">
                          <input type="number" min="0"
                            className="glass-input floating-input w-full rounded-xl py-3 px-4 font-body-md text-body-md text-on-surface focus:outline-none placeholder-transparent"
                            value={rcCount} onChange={(e) => setRcCount(e.target.value)}
                            placeholder="RC Count" id="edit-rc-count"
                          />
                          <label htmlFor="edit-rc-count" className="floating-label absolute left-4 top-5 font-body-md text-body-md text-outline transition-all duration-200 pointer-events-none">RC Count (Optional)</label>
                        </div>
                        <div className="space-y-2 relative pt-2">
                          <input type="number" min="0"
                            className="glass-input floating-input w-full rounded-xl py-3 px-4 font-body-md text-body-md text-on-surface focus:outline-none placeholder-transparent"
                            value={fcCount} onChange={(e) => setFcCount(e.target.value)}
                            placeholder="FC Count" id="edit-fc-count"
                          />
                          <label htmlFor="edit-fc-count" className="floating-label absolute left-4 top-5 font-body-md text-body-md text-outline transition-all duration-200 pointer-events-none">FC Count (Optional)</label>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </form>
        </div>
        
        <div className="px-6 py-4 border-t border-outline-variant/20 flex justify-end flex-shrink-0 space-x-3 bg-surface/50">
          <button type="button" onClick={onClose} className="px-6 py-2 text-label-md font-label-md text-on-surface bg-white border border-outline-variant/30 rounded-xl hover:bg-surface-variant/30 transition-colors">
            Cancel
          </button>
          <button type="submit" form="edit-inward-form" disabled={isSaving} className="px-6 py-2 text-label-md font-label-md text-white bg-primary rounded-xl hover:bg-primary/90 focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors disabled:opacity-50 shadow-md hover:shadow-lg flex items-center">
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
