import { useState } from 'react';

import { db, useLiveQuery, type Item, type InwardEntry, type OutwardEntry } from '../db/db';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { WhatsAppReportGenerator } from '../components/WhatsAppReportGenerator';
import { useAuth } from '../components/AuthProvider';
import { EditInwardModal } from '../components/EditInwardModal';
import { ScrapChart } from '../components/ScrapChart';
import { CategoryBadge } from '../components/CategoryBadge';

export function Dashboard() {
  const items = useLiveQuery(() => db.items.toArray());
  const categories = useLiveQuery(() => db.categories.toArray());
  const units = useLiveQuery(() => db.units.toArray());
  const inwardEntries = useLiveQuery(() => db.inwardEntries.toArray());
  const outwardEntries = useLiveQuery(() => db.outwardEntries.toArray());
  const balances = useLiveQuery(() => db.inventoryBalances.toArray());

  const [historyItem, setHistoryItem] = useState<Item | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const { isAdmin, login } = useAuth();
  const [pinPrompt, setPinPrompt] = useState(false);
  const [pin, setPin] = useState('');
  
  const [editingEntry, setEditingEntry] = useState<InwardEntry | null>(null);

  if (!items || !units || !inwardEntries || !outwardEntries || !balances || !categories) return null;

  const unitMap = new Map(units.map(u => [u.id, u.name]));
  const catMap = new Map(categories.map(c => [c.id, c]));

  const handleDeleteEntry = async (id: number) => {
    if (confirm('Are you sure you want to delete this entry?')) {
      try {
        await db.inwardEntries.delete(id);
      } catch(err) {
        alert('Failed to delete entry');
      }
    }
  };

  const getHistory = (itemId: number) => {
    const inward = inwardEntries.filter(e => e.itemId === itemId).map(e => ({
      ...e,
      _type: 'INWARD' as const,
      timestamp: new Date(e.date).getTime()
    }));
    
    const outward = outwardEntries.filter(e => e.itemId === itemId).map(e => ({
      ...e,
      _type: 'OUTWARD' as const,
      timestamp: new Date(e.dateDelivered).getTime()
    }));
    
    return [...inward, ...outward].sort((a, b) => b.timestamp - a.timestamp);
  };

  const exportToCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Item Name,Category,Total Inward,Total Outward,Approx Remaining Balance\n";
    
    items.forEach(item => {
      const cat = catMap.get(item.categoryId);
      const categoryName = cat ? cat.name : '';
      
      const itemInwards = inwardEntries.filter(e => e.itemId === item.id);
      const itemOutwards = outwardEntries.filter(e => e.itemId === item.id);
      
      const inStr = Array.from(new Set(itemInwards.map(e => e.unitId))).map(uid => `${itemInwards.filter(e => e.unitId === uid).reduce((sum, e) => sum + e.quantity, 0)} ${unitMap.get(uid)}`).join(' | ');
      const outStr = Array.from(new Set(itemOutwards.map(e => e.unitId))).map(uid => `${itemOutwards.filter(e => e.unitId === uid).reduce((sum, e) => sum + e.quantity, 0)} ${unitMap.get(uid)}`).join(' | ');
      
      const balance = balances.find(b => b.itemId === item.id);
      let balanceStr = "";
      if (balance) {
         balanceStr = `${balance.approxBalance} ${unitMap.get(balance.unitId)}`;
      }
      
      const row = `"${item.name}","${categoryName}","${inStr}","${outStr}","${balanceStr}"`;
      csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `inventory_export_${format(new Date(), 'yyyyMMdd')}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };
  
  const handlePinSubmit = (e: any) => {
    e.preventDefault();
    if(login(pin)) {
       setPinPrompt(false);
       setPin('');
    } else {
       alert("Incorrect PIN");
       setPin('');
    }
  };

  const totalInward = inwardEntries.reduce((acc, curr) => acc + curr.quantity, 0).toFixed(1);
  const totalOutward = outwardEntries.reduce((acc, curr) => acc + curr.quantity, 0).toFixed(1);
  const totalBalance = balances.reduce((acc, curr) => acc + curr.approxBalance, 0).toFixed(1);

  return (
    <div className="animate-fade-in space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">The Ledger</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">Real-time overview of industrial materials.</p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Search inventory..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-48 bg-white/60 border border-outline-variant/30 rounded-lg px-4 py-2 font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all"
          />
          <button onClick={exportToCSV} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white/60 border border-outline-variant/30 rounded-lg hover:bg-white shadow-sm transition-colors font-label-md text-label-md text-on-surface">
            <span className="material-symbols-outlined text-[18px]">download</span>
            Export
          </button>
          <WhatsAppReportGenerator />
        </div>
      </div>

      {/* Key Metrics Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="glass-card rounded-xl p-6 relative overflow-hidden group hover:shadow-lg transition-shadow duration-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-tertiary-container/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div>
              <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Total Inward</p>
              <h3 className="font-display-lg text-display-lg text-on-surface mt-1">{totalInward}<span className="text-headline-md text-outline">u</span></h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-tertiary-container/20 flex items-center justify-center text-tertiary">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>arrow_downward</span>
            </div>
          </div>
          <div className="mt-4 h-10 flex items-end gap-1 relative z-10 opacity-70">
            <div className="w-1/6 bg-tertiary/20 h-1/4 rounded-t-sm"></div>
            <div className="w-1/6 bg-tertiary/30 h-2/4 rounded-t-sm"></div>
            <div className="w-1/6 bg-tertiary/40 h-1/3 rounded-t-sm"></div>
            <div className="w-1/6 bg-tertiary/50 h-3/4 rounded-t-sm"></div>
            <div className="w-1/6 bg-tertiary/60 h-2/3 rounded-t-sm"></div>
            <div className="w-1/6 bg-tertiary h-full rounded-t-sm"></div>
          </div>
        </div>

        <div className="glass-card rounded-xl p-6 relative overflow-hidden group hover:shadow-lg transition-shadow duration-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-secondary-container/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div>
              <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Total Outward</p>
              <h3 className="font-display-lg text-display-lg text-on-surface mt-1">{totalOutward}<span className="text-headline-md text-outline">u</span></h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-secondary-container/20 flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>arrow_upward</span>
            </div>
          </div>
          <div className="mt-4 h-10 flex items-end gap-1 relative z-10 opacity-70">
            <div className="w-1/6 bg-secondary/80 h-full rounded-t-sm"></div>
            <div className="w-1/6 bg-secondary/60 h-3/4 rounded-t-sm"></div>
            <div className="w-1/6 bg-secondary/50 h-2/3 rounded-t-sm"></div>
            <div className="w-1/6 bg-secondary/30 h-1/3 rounded-t-sm"></div>
            <div className="w-1/6 bg-secondary/40 h-2/4 rounded-t-sm"></div>
            <div className="w-1/6 bg-secondary/20 h-1/4 rounded-t-sm"></div>
          </div>
        </div>

        <div className="glass-card rounded-xl p-6 relative overflow-hidden group hover:shadow-lg transition-shadow duration-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary-container/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div>
              <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Overall Balance</p>
              <h3 className="font-display-lg text-display-lg text-on-surface mt-1 blur-balance" title="Hover to reveal">
                {totalBalance}<span className="text-headline-md text-outline">u</span>
              </h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>account_balance</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-outline-variant font-data-mono text-data-mono relative z-10">
            <span className="material-symbols-outlined text-[16px]">lock</span>
            <span>Admin view only</span>
          </div>
        </div>
      </div>

      <ScrapChart />

      {/* Main Data Table Section */}
      <div className="glass-panel rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-outline-variant/20 flex justify-between items-center bg-white/40">
          <h3 className="font-headline-md text-headline-md text-on-surface">Active Inventory Ledger</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-outline-variant/20 bg-surface-variant/30">
                <th className="px-6 py-4 font-label-md text-label-md text-on-surface-variant font-semibold">Item & Category</th>
                <th className="px-6 py-4 font-label-md text-label-md text-on-surface-variant font-semibold">Total Inward</th>
                <th className="px-6 py-4 font-label-md text-label-md text-on-surface-variant font-semibold">Total Outward</th>
                <th className="px-6 py-4 font-label-md text-label-md text-on-surface-variant font-semibold">Approx Balance</th>
                <th className="px-6 py-4 font-label-md text-label-md text-on-surface-variant font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="font-body-sm text-body-sm">
              {items
                .filter(a => a.name.toLowerCase().includes(searchTerm.toLowerCase()) || catMap.get(a.categoryId)?.name.toLowerCase().includes(searchTerm.toLowerCase()))
                .sort((a,b) => a.name.localeCompare(b.name))
                .map(item => {
                const itemInwards = inwardEntries.filter(e => e.itemId === item.id);
                const itemOutwards = outwardEntries.filter(e => e.itemId === item.id);
                
                const inTotals: Record<string, number> = {};
                itemInwards.forEach(e => {
                  const u = unitMap.get(e.unitId) || 'Unknown';
                  inTotals[u] = (inTotals[u] || 0) + e.quantity;
                });
                
                const outTotals: Record<string, number> = {};
                itemOutwards.forEach(e => {
                  const u = unitMap.get(e.unitId) || 'Unknown';
                  outTotals[u] = (outTotals[u] || 0) + e.quantity;
                });

                const balanceRecord = balances.find(b => b.itemId === item.id);
                const cat = catMap.get(item.categoryId);
                const shortCode = item.name.substring(0, 2).toUpperCase();

                return (
                  <tr key={item.id} className="border-b border-outline-variant/10 hover:bg-white/60 hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] hover:scale-[1.002] transition-all duration-200 group cursor-pointer">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center shadow-sm border border-outline-variant/30 flex-shrink-0">
                          <span className="material-symbols-outlined text-outline-variant text-[20px]">category</span>
                        </div>
                        <div className="flex flex-col items-start gap-1.5">
                          <p className="font-headline-md text-on-surface text-[15px]">{item.name}</p>
                          {cat && <CategoryBadge category={cat} />}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {Object.entries(inTotals).length === 0 ? <span className="text-outline">-</span> : 
                        <div className="flex flex-col gap-1">
                          {Object.entries(inTotals).map(([u, val]) => (
                            <div key={u} className="flex flex-col">
                              <span className="font-data-mono font-medium text-on-surface">{val} {u}</span>
                              <span className="text-tertiary text-xs flex items-center"><span className="material-symbols-outlined text-[12px] mr-0.5">arrow_downward</span> IN</span>
                            </div>
                          ))}
                        </div>
                      }
                    </td>
                    <td className="px-6 py-4">
                      {Object.entries(outTotals).length === 0 ? <span className="text-outline">-</span> : 
                        <div className="flex flex-col gap-1">
                          {Object.entries(outTotals).map(([u, val]) => (
                            <div key={u} className="flex flex-col">
                              <span className="font-data-mono font-medium text-on-surface">{val} {u}</span>
                              <span className="text-secondary text-xs flex items-center"><span className="material-symbols-outlined text-[12px] mr-0.5">arrow_upward</span> OUT</span>
                            </div>
                          ))}
                        </div>
                      }
                    </td>
                    <td className="px-6 py-4">
                      {isAdmin ? (
                         <BalanceInput 
                           item={item} 
                           initialBalance={balanceRecord?.approxBalance} 
                           initialUnitId={balanceRecord?.unitId}
                           units={units}
                         />
                      ) : (
                         <div 
                           className="flex items-center space-x-2 filter blur-[2px] opacity-70 cursor-pointer select-none"
                           onClick={() => setPinPrompt(true)}
                           title="Click to unlock"
                         >
                           <input type="number" disabled className="glass-input w-20 text-sm rounded py-1 px-2" value={balanceRecord ? balanceRecord.approxBalance : ''} />
                           <select disabled className="glass-input w-20 text-sm rounded py-1 px-2 bg-surface-container-lowest">
                              <option>{balanceRecord ? unitMap.get(balanceRecord.unitId) : 'Unit'}</option>
                           </select>
                         </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => setHistoryItem(item)}
                          className="p-1.5 text-outline hover:text-primary bg-white rounded shadow-sm border border-outline-variant/30" title="History"
                        >
                          <span className="material-symbols-outlined text-[18px]">history</span>
                        </button>
                        <button className="p-1.5 text-outline hover:text-error bg-white rounded shadow-sm border border-outline-variant/30" title="Lock" onClick={() => setPinPrompt(true)}>
                          <span className="material-symbols-outlined text-[18px]">{isAdmin ? 'lock_open' : 'lock'}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* PIN Prompt Modal */}
      {pinPrompt && !isAdmin && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-inverse-surface/40 backdrop-blur-sm">
            <div className="glass-card rounded-2xl p-xl max-w-sm w-full text-center flex flex-col items-center relative">
               <button onClick={() => setPinPrompt(false)} className="absolute top-4 right-4 text-outline hover:text-on-surface">
                  <span className="material-symbols-outlined">close</span>
               </button>
               <div className="w-16 h-16 bg-error-container rounded-full flex items-center justify-center mb-6">
                 <span className="material-symbols-outlined text-error" style={{ fontSize: '32px', fontVariationSettings: "'FILL' 1" }}>lock</span>
               </div>
               <h3 className="font-headline-lg text-headline-lg text-on-surface mb-2">Admin Unlock</h3>
               <p className="font-body-md text-body-md text-on-surface-variant mb-6">Enter PIN to edit manual balances.</p>
               <form onSubmit={handlePinSubmit} className="space-y-4 w-full">
                  <input
                     type="password"
                     maxLength={4}
                     value={pin}
                     onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                     className="glass-input w-full text-center tracking-widest text-2xl py-3 rounded-lg focus:outline-none"
                     placeholder="••••"
                     autoFocus
                  />
                  <button type="submit" className="w-full bg-gradient-to-r from-primary-container to-secondary-container text-white font-label-md text-label-md py-3 rounded-lg shadow-md hover:shadow-lg transition-all">
                     Unlock
                  </button>
               </form>
            </div>
         </div>
      )}

      {/* History Modal */}
      {historyItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-inverse-surface/40 backdrop-blur-sm" onClick={() => setHistoryItem(null)}></div>
          <div className="relative w-full max-w-[600px] bg-white/90 dark:bg-inverse-surface/95 backdrop-blur-xl rounded-2xl shadow-xl border border-white/40 dark:border-outline-variant/20 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b border-outline-variant/20 flex justify-between items-center bg-surface/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
                  <span className="material-symbols-outlined text-primary">history</span>
                </div>
                <div>
                  <h3 className="font-headline-md text-[18px] font-bold text-on-surface leading-tight">{historyItem.name}</h3>
                  <p className="font-body-sm text-body-sm text-outline text-[12px]">Material History</p>
                </div>
              </div>
              <button className="p-2 text-outline hover:text-on-surface rounded-full hover:bg-surface-variant/50 transition-colors" onClick={() => setHistoryItem(null)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {(() => {
                const timeline = getHistory(historyItem.id!);
                if (timeline.length === 0) return <div className="text-center text-outline py-8 font-body-sm text-body-sm">No records found.</div>;
                
                return (
                  <div className="relative pl-4 space-y-8 before:absolute before:inset-y-0 before:left-[23px] before:w-px before:bg-outline-variant/40">
                    {timeline.map((entry, idx) => {
                      const isIdxOutward = entry._type === 'OUTWARD';
                      const u = unitMap.get(entry.unitId) || '';
                      return (
                        <div key={idx} className="relative pl-8">
                          <div className={cn("absolute left-[-5px] top-1 w-3 h-3 rounded-full ring-4 ring-white dark:ring-inverse-surface z-10", isIdxOutward ? 'bg-secondary' : 'bg-tertiary')}></div>
                          <div className="flex justify-between items-start mb-1">
                            <span className={cn("font-label-md text-label-md font-bold", isIdxOutward ? 'text-secondary' : 'text-tertiary')}>{entry._type}</span>
                            <span className="font-body-sm text-body-sm text-outline text-[12px]">
                               {isIdxOutward 
                                 ? format(new Date((entry as any).dateDelivered), 'MMM d, HH:mm')
                                 : format(new Date((entry as any).date), 'MMM d, HH:mm')
                               }
                            </span>
                          </div>
                          <div className="bg-surface rounded-lg p-3 border border-outline-variant/20 mt-2 shadow-sm hover:shadow transition-shadow">
                            <div className="flex justify-between items-center">
                              <span className="font-data-mono text-data-mono font-medium">{isIdxOutward ? '-' : '+'}{entry.quantity} {u}</span>
                              <span className="text-xs text-outline font-medium bg-white px-2 py-1 rounded border border-outline-variant/10">{(entry as any).lotNumber || 'No Lot'}</span>
                            </div>
                            
                            <div className="mt-2 text-xs text-on-surface-variant">
                               {isIdxOutward ? (
                                 <p>Buyer: {(entry as any).firmName}</p>
                               ) : (
                                 <p>
                                   {(entry as any).machineType && <span>Source: {(entry as any).machineType} | </span>}
                                   {(entry as any).coverType && <span>Cover: {(entry as any).coverType} </span>}
                                 </p>
                               )}
                            </div>
                            
                            {!isIdxOutward && isAdmin && (
                                <div className="mt-3 pt-2 border-t border-outline-variant/20 flex justify-end space-x-3">
                                  <button onClick={() => setEditingEntry(entry as InwardEntry)} className="text-primary hover:text-primary-container flex items-center text-xs font-label-md transition-colors">
                                    <span className="material-symbols-outlined text-[16px] mr-1">edit</span> Edit
                                  </button>
                                  <button onClick={() => handleDeleteEntry((entry as any).id)} className="text-error flex items-center hover:text-error-container text-xs font-label-md transition-colors">
                                    <span className="material-symbols-outlined text-[16px] mr-1">delete</span> Delete
                                  </button>
                                </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
            <div className="px-6 py-4 border-t border-outline-variant/20 bg-surface/50 flex justify-end">
              <button className="px-4 py-2 bg-white border border-outline-variant/30 text-on-surface font-label-md text-label-md rounded-lg hover:bg-surface-variant/30 transition-colors" onClick={() => setHistoryItem(null)}>
                  Close
              </button>
            </div>
          </div>
        </div>
      )}

      {editingEntry && historyItem && (
        <EditInwardModal 
          entry={editingEntry}
          item={historyItem}
          onClose={() => setEditingEntry(null)}
        />
      )}
    </div>
  );
}

function BalanceInput({ 
  item, 
  initialBalance = undefined, 
  initialUnitId = undefined,
  units
}: { 
  item: Item, 
  initialBalance?: number, 
  initialUnitId?: number,
  units: any[] 
}) {
  const [val, setVal] = useState(initialBalance !== undefined ? String(initialBalance) : '');
  const [uId, setUId] = useState(initialUnitId !== undefined ? String(initialUnitId) : '');
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const handleSave = async () => {
    if (!val) {
      if (initialBalance !== undefined) await db.inventoryBalances.delete(item.id!);
      setIsDirty(false);
      return;
    }
    
    const selectedUId = uId || String(units.find(u => u.name === 'MT')?.id || units[0]?.id);
    setUId(selectedUId);

    setSaving(true);
    await db.inventoryBalances.put({
      itemId: item.id!,
      approxBalance: Number(val),
      unitId: Number(selectedUId)
    });
    setSaving(false);
    setIsDirty(false);
  };

  return (
    <div className="flex items-center space-x-2">
      <input 
        type="number" 
        step="0.01"
        placeholder="Qty"
        className="glass-input w-20 text-sm rounded py-1 px-2 font-data-mono focus:outline-none"
        value={val}
        onChange={(e) => {
          setVal(e.target.value);
          setIsDirty(true);
        }}
      />
      <select 
        className="glass-input w-20 text-sm rounded py-1 px-2 focus:outline-none appearance-none"
        value={uId}
        onChange={(e) => {
          setUId(e.target.value);
          setIsDirty(true);
        }}
      >
        <option value="">Unit</option>
        {units.filter(u => ['MT', 'Kg'].includes(u.name)).map(u => (
          <option key={u.id} value={u.id}>{u.name}</option>
        ))}
      </select>
      
      {isDirty && (
        <button 
          onClick={handleSave}
          disabled={saving}
          className="p-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-md transition-colors flex items-center"
        >
          <span className="material-symbols-outlined text-[16px]">save</span>
        </button>
      )}
    </div>
  )
}
