import { useState, useMemo } from 'react';
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

  const [isSaving, setIsSaving] = useState(false);

  const selectedCategory = useMemo(() => {
    if (!item || !categories) return null;
    return categories.find(c => c.id === item.categoryId) || null;
  }, [item, categories]);

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
      });
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to update entry');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-inverse-surface/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative w-full max-w-2xl bg-white/95 dark:bg-inverse-surface/95 backdrop-blur-xl rounded-2xl shadow-xl border border-white/40 dark:border-outline-variant/20 overflow-hidden flex flex-col max-h-[90vh]">
        
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
                  type="number"
                  step="0.01"
                  min="0"
                  className="glass-input floating-input w-full rounded-xl py-3 px-4 font-body-md text-body-md text-on-surface focus:outline-none placeholder-transparent"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="Quantity"
                  id="edit-qty"
                  required
                />
                <label htmlFor="edit-qty" className="floating-label absolute left-4 top-5 font-body-md text-body-md text-outline transition-all duration-200 pointer-events-none">
                  Quantity <span className="text-error">*</span>
                </label>
              </div>

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

              <div className="space-y-2 relative pt-2">
                <input
                  type="text"
                  className="glass-input floating-input w-full rounded-xl py-3 pl-12 pr-4 font-body-md text-body-md text-on-surface focus:outline-none placeholder-transparent"
                  value={lotNumber}
                  onChange={(e) => setLotNumber(e.target.value)}
                  placeholder="Lot Number"
                  id="edit-lot"
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
                    <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-outline transition-colors">
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
                        <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-outline mt-2 transition-colors">
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
                            id="edit-rc-count"
                          />
                          <label htmlFor="edit-rc-count" className="floating-label absolute left-4 top-5 font-body-md text-body-md text-outline transition-all duration-200 pointer-events-none">
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
                            id="edit-fc-count"
                          />
                          <label htmlFor="edit-fc-count" className="floating-label absolute left-4 top-5 font-body-md text-body-md text-outline transition-all duration-200 pointer-events-none">
                            FC Count (Optional)
                          </label>
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
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 text-label-md font-label-md text-on-surface bg-white border border-outline-variant/30 rounded-xl hover:bg-surface-variant/30 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="edit-inward-form"
            disabled={isSaving}
            className="px-6 py-2 text-label-md font-label-md text-white bg-primary rounded-xl hover:bg-primary/90 focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors disabled:opacity-50 shadow-md hover:shadow-lg flex items-center"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
