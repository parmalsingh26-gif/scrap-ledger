import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { db, useLiveQuery, type OutwardEntry, type Item } from '../db/db';
import { CategoryBadge } from './CategoryBadge';

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

  const [quantity, setQuantity] = useState<string>(String(entry.quantity));
  const [unitId, setUnitId] = useState<string>(String(entry.unitId));
  const [lotNumber, setLotNumber] = useState<string>(entry.lotNumber);
  const [hsnCode, setHsnCode] = useState<string>(entry.hsnCode);
  const [firmName, setFirmName] = useState<string>(entry.firmName);
  
  // dateLotApplied is optional — may be empty string or undefined
  const [dateLotApplied, setDateLotApplied] = useState<string>(entry.dateLotApplied || '');
  const [dateSold, setDateSold] = useState<string>(entry.dateSold);
  const [dateDelivered, setDateDelivered] = useState<string>(entry.dateDelivered);
  const [rcCount, setRcCount] = useState<string>(entry.rcCount ? String(entry.rcCount) : '');
  const [fcCount, setFcCount] = useState<string>(entry.fcCount ? String(entry.fcCount) : '');
  const isCoverItem = item.name.toLowerCase().includes('cover');

  const [isSaving, setIsSaving] = useState(false);

  const selectedCategory = useMemo(() => {
    if (!item || !categories) return null;
    return categories.find(c => c.id === item.categoryId) || null;
  }, [item, categories]);

  const handleSave = async (e: any) => {
    e.preventDefault();
    // dateLotApplied is optional — don't block save if empty
    if (!quantity || !unitId || !lotNumber || !hsnCode || !firmName || !dateSold || !dateDelivered) return;
    
    setIsSaving(true);
    try {
      await db.outwardEntries.update(entry.id!, {
        quantity: Number(quantity),
        unitId: Number(unitId),
        lotNumber,
        hsnCode,
        firmName,
        dateLotApplied: dateLotApplied || undefined,
        dateSold,
        dateDelivered,
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
                  placeholder="Quantity" id="edit-out-qty" required
                />
                <label htmlFor="edit-out-qty" className="floating-label absolute left-4 top-5 font-body-md text-body-md text-outline transition-all duration-200 pointer-events-none">
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
              
              <div className="space-y-2 relative pt-2 col-span-1 md:col-span-2">
                <input
                  type="date"
                  className="glass-input floating-input w-full rounded-xl py-3 pl-12 pr-4 font-body-md text-body-md text-on-surface focus:outline-none"
                  value={dateDelivered} onChange={(e) => setDateDelivered(e.target.value)} required
                />
                <label className="absolute left-12 -top-0.5 bg-surface/80 px-1 font-body-sm text-body-sm text-primary transition-all duration-200 pointer-events-none scale-85">
                  Date Delivered <span className="text-error">*</span>
                </label>
                <div className="absolute left-4 top-5 pointer-events-none text-outline-variant">
                  <span className="material-symbols-outlined text-[20px]">local_shipping</span>
                </div>
              </div>
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
