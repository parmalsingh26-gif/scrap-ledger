import { useState, useMemo } from 'react';
import { db, useLiveQuery } from '../db/db';
import { CategoryBadge } from '../components/CategoryBadge';
import { WhatsAppReportGenerator } from '../components/WhatsAppReportGenerator';

export function InwardEntry() {
  const items = useLiveQuery(() => db.items.toArray());
  const categories = useLiveQuery(() => db.categories.toArray());
  const units = useLiveQuery(() => db.units.toArray());

  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');
  const [unitId, setUnitId] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [lotNumber, setLotNumber] = useState<string>('');
  
  const [machineType, setMachineType] = useState<'MG' | 'BG' | ''>('');
  const [coverType, setCoverType] = useState<'RC' | 'FC' | ''>('');
  const [rcCount, setRcCount] = useState<string>('');
  const [fcCount, setFcCount] = useState<string>('');
  const [weightPerNos, setWeightPerNos] = useState<string>('');

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

  if (!items || !categories || !units) return null;

  const itemName = selectedItem?.name?.toLowerCase() || '';
  const isBearingOrCover = itemName.includes('bearing') || itemName.includes('cover');
  const isCover = itemName.includes('cover');

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!selectedItemId || !quantity || !unitId || !date) {
      setStatus({ type: 'error', msg: 'Please fill in all required fields.' });
      return;
    }

    try {
      await db.inwardEntries.add({
        itemId: Number(selectedItemId),
        quantity: Number(quantity),
        unitId: Number(unitId),
        date,
        lotNumber: lotNumber ? lotNumber : undefined,
        machineType: machineType ? machineType as 'MG' | 'BG' : undefined,
        coverType: coverType ? coverType as 'RC' | 'FC' : undefined,
        rcCount: rcCount ? Number(rcCount) : undefined,
        fcCount: fcCount ? Number(fcCount) : undefined,
        weightPerNos: weightPerNos ? Number(weightPerNos) : undefined,
      });

      setStatus({ type: 'success', msg: 'Inward entry recorded successfully.' });
      setSelectedItemId('');
      setQuantity('');
      setLotNumber('');
      setMachineType('');
      setCoverType('');
      setRcCount('');
      setFcCount('');
      setWeightPerNos('');
      setTimeout(() => setStatus(null), 3000);
    } catch (err) {
      setStatus({ type: 'error', msg: 'Failed to record entry.' });
    }
  };

  return (
    <div className="animate-fade-in space-y-8">
      {/* Page Header */}
      <div className="mb-8">
        <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">Log Inward Material</h2>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">Record incoming scrap materials and components securely.</p>
      </div>

      <div className="glass-panel rounded-2xl shadow-sm overflow-hidden p-6 md:p-8 max-w-4xl relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-tertiary-container/10 rounded-full blur-[80px] -mr-20 -mt-20 pointer-events-none"></div>
        
        {status && (
          <div className={`p-4 rounded-xl flex items-center mb-6 font-label-md text-label-md border backdrop-blur-md ${status.type === 'success' ? 'bg-tertiary-container/20 text-tertiary border-tertiary/30' : 'bg-error-container/20 text-error border-error/30'}`}>
            <span className="material-symbols-outlined mr-2" style={{ fontVariationSettings: "'FILL' 1" }}>
              {status.type === 'success' ? 'check_circle' : 'error'}
            </span>
            {status.msg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            
            {/* Item Selection */}
            <div className="space-y-2 col-span-1 md:col-span-2">
              <label className="font-label-md text-label-md text-on-surface-variant flex justify-between">
                <span>Select Material <span className="text-error">*</span></span>
              </label>
              <div className="relative group">
                <select 
                  className="glass-input w-full rounded-xl py-3 px-4 font-body-md text-body-md text-on-surface focus:outline-none appearance-none"
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  required
                >
                  <option value="">-- Choose Material --</option>
                  {items?.sort((a, b) => a.name.localeCompare(b.name)).map(item => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-outline group-hover:text-primary transition-colors">
                  <span className="material-symbols-outlined">expand_more</span>
                </div>
              </div>
            </div>

            {/* Readonly Category / Bin Tag */}
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

            {/* Quantity */}
            <div className="space-y-2 relative pt-2">
              <input
                type="number"
                step="0.01"
                min="0"
                className="glass-input floating-input w-full rounded-xl py-3 px-4 font-body-md text-body-md text-on-surface focus:outline-none placeholder-transparent"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Quantity"
                id="inward-qty"
                required
              />
              <label htmlFor="inward-qty" className="floating-label absolute left-4 top-5 font-body-md text-body-md text-outline transition-all duration-200 pointer-events-none">
                Quantity <span className="text-error">*</span>
              </label>
            </div>

            {/* Unit */}
            <div className="space-y-2 relative">
              <div className="relative group pt-2">
                <select 
                  className="glass-input floating-input w-full rounded-xl py-3 px-4 font-body-md text-body-md text-on-surface focus:outline-none appearance-none"
                  value={unitId}
                  onChange={(e) => setUnitId(e.target.value)}
                  required
                >
                  <option value="" disabled hidden>-- Choose Unit --</option>
                  {units?.map(u => (
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

            {/* NOS Weight Calculator */}
            {isNosUnit && (
              <div className="col-span-1 md:col-span-2 p-4 bg-amber-50 border border-amber-200 rounded-xl">
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
                      id="inward-wt-nos"
                    />
                    <label htmlFor="inward-wt-nos" className="floating-label absolute left-4 top-4 font-body-sm text-body-sm text-amber-600 transition-all duration-200 pointer-events-none">
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

            {/* Lot Number */}
            <div className="space-y-2 relative pt-2">
              <input
                type="text"
                className="glass-input floating-input w-full rounded-xl py-3 pl-12 pr-4 font-body-md text-body-md text-on-surface focus:outline-none placeholder-transparent"
                value={lotNumber}
                onChange={(e) => setLotNumber(e.target.value)}
                placeholder="Lot Number"
                id="inward-lot"
              />
              <label htmlFor="inward-lot" className="floating-label absolute left-12 top-5 font-body-md text-body-md text-outline transition-all duration-200 pointer-events-none">
                Lot / Reference No.
              </label>
              <div className="absolute left-4 top-5 pointer-events-none text-outline-variant">
                <span className="material-symbols-outlined text-[20px]">tag</span>
              </div>
            </div>

            {/* Date */}
            <div className="space-y-2 relative pt-2">
              <input
                type="date"
                className="glass-input floating-input w-full rounded-xl py-3 pl-12 pr-4 font-body-md text-body-md text-on-surface focus:outline-none"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
              <label className="absolute left-12 -top-0.5 bg-surface/80 px-1 font-body-sm text-body-sm text-primary transition-all duration-200 pointer-events-none scale-85">
                Date Received <span className="text-error">*</span>
              </label>
              <div className="absolute left-4 top-5 pointer-events-none text-outline-variant">
                <span className="material-symbols-outlined text-[20px]">calendar_today</span>
              </div>
            </div>
          </div>

          {/* Conditional Fields block */}
          {isBearingOrCover && (
            <div className="mt-8 bg-surface-container-low/50 backdrop-blur-sm rounded-xl p-6 border border-tertiary/20 relative overflow-hidden group hover:border-tertiary/40 transition-colors">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-tertiary rounded-l-xl"></div>
              <h3 className="font-label-md text-label-md text-on-surface mb-4 flex items-center">
                <span className="material-symbols-outlined text-tertiary mr-2 text-[18px]">add_circle</span>
                Additional Specifications (Bearings / Covers)
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 relative pt-2">
                  <select 
                    className="glass-input floating-input w-full rounded-xl py-3 px-4 font-body-md text-body-md text-on-surface focus:outline-none appearance-none"
                    value={machineType}
                    onChange={(e) => setMachineType(e.target.value as 'MG'|'BG')}
                    required
                  >
                    <option value="" disabled hidden></option>
                    <option value="MG">MG (Meter Gauge)</option>
                    <option value="BG">BG (Broad Gauge)</option>
                  </select>
                  <label className="absolute left-4 -top-0.5 bg-surface/80 px-1 font-body-sm text-body-sm text-primary transition-all duration-200 pointer-events-none scale-85">
                    Machine Type <span className="text-error">*</span>
                  </label>
                  <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-outline group-hover:text-primary transition-colors">
                    <span className="material-symbols-outlined mt-2">expand_more</span>
                  </div>
                </div>
                
                {isCover && (
                  <>
                    <div className="space-y-2 relative pt-2">
                      <select 
                        className="glass-input floating-input w-full rounded-xl py-3 px-4 font-body-md text-body-md text-on-surface focus:outline-none appearance-none"
                        value={coverType}
                        onChange={(e) => setCoverType(e.target.value as 'RC'|'FC')}
                      >
                        <option value="">Any / Not Specific</option>
                        <option value="RC">Rear Cover (RC)</option>
                        <option value="FC">Front Cover (FC)</option>
                      </select>
                      <label className="absolute left-4 -top-0.5 bg-surface/80 px-1 font-body-sm text-body-sm text-primary transition-all duration-200 pointer-events-none scale-85">
                        Cover Designation
                      </label>
                      <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-outline mt-2 group-hover:text-primary transition-colors">
                        <span className="material-symbols-outlined">expand_more</span>
                      </div>
                    </div>

                    <div className="col-span-1 md:col-span-2 grid grid-cols-2 gap-6">
                      <div className="space-y-2 relative pt-2">
                        <input 
                          type="number"
                          min="0"
                          className="glass-input floating-input w-full rounded-xl py-3 px-4 font-body-md text-body-md text-on-surface focus:outline-none placeholder-transparent"
                          value={rcCount}
                          onChange={(e) => setRcCount(e.target.value)}
                          placeholder="RC Count"
                          id="rc-count"
                        />
                        <label htmlFor="rc-count" className="floating-label absolute left-4 top-5 font-body-md text-body-md text-outline transition-all duration-200 pointer-events-none">
                          RC Count (Optional)
                        </label>
                      </div>
                      <div className="space-y-2 relative pt-2">
                        <input 
                          type="number"
                          min="0"
                          className="glass-input floating-input w-full rounded-xl py-3 px-4 font-body-md text-body-md text-on-surface focus:outline-none placeholder-transparent"
                          value={fcCount}
                          onChange={(e) => setFcCount(e.target.value)}
                          placeholder="FC Count"
                          id="fc-count"
                        />
                        <label htmlFor="fc-count" className="floating-label absolute left-4 top-5 font-body-md text-body-md text-outline transition-all duration-200 pointer-events-none">
                          FC Count (Optional)
                        </label>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="pt-6 border-t border-outline-variant/20 flex justify-end">
            <button
              type="submit"
              className="bg-primary hover:bg-primary/90 text-white font-label-md text-label-md py-3 px-8 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2 hover:-translate-y-0.5"
            >
              <span className="material-symbols-outlined text-[20px]">how_to_reg</span>
              Submit Entry
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
