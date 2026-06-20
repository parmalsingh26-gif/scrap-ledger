import React, { useState, useRef } from 'react';
import { db, useLiveQuery } from '../db/db';
import { ProtectedView } from '../components/ProtectedView';
import { useAuth } from '../components/AuthProvider';

export function AdminSettings() {
  const items = useLiveQuery(() => db.items.toArray());
  const categories = useLiveQuery(() => db.categories.toArray());
  const units = useLiveQuery(() => db.units.toArray());

  const [newItemName, setNewItemName] = useState('');
  const [newCategoryId, setNewCategoryId] = useState('');
  const [newItemHsn, setNewItemHsn] = useState('');
  
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editItemName, setEditItemName] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editItemHsn, setEditItemHsn] = useState('');

  const [newUnitName, setNewUnitName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinStatus, setPinStatus] = useState('');

  const [oldNbPin, setOldNbPin] = useState('');
  const [newNbPin, setNewNbPin] = useState('');
  const [nbPinStatus, setNbPinStatus] = useState('');
  
  const [dbStatus, setDbStatus] = useState('');
  
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState('');
  
  const { updatePin, changePassword, updateNotebookPin } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!items || !categories || !units) return null;

  const handleAddItem = async (e: any) => {
    e.preventDefault();
    if (!newItemName || !newCategoryId) return;
    await db.items.add({
      name: newItemName,
      categoryId: Number(newCategoryId),
      hsnCode: newItemHsn || undefined
    });
    setNewItemName('');
    setNewItemHsn('');
  };

  const handleDeleteItem = async (id: number) => {
    if (confirm('Are you sure you want to delete this item?')) {
      await db.items.delete(id);
      await db.inventoryBalances.where('itemId').equals(id).delete();
    }
  };

  const handleStartEdit = (item: any) => {
    setEditingItemId(item.id);
    setEditItemName(item.name);
    setEditCategoryId(item.categoryId.toString());
    setEditItemHsn(item.hsnCode || '');
  };

  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItemId || !editItemName || !editCategoryId) return;
    
    await db.items.update(editingItemId, {
      name: editItemName,
      categoryId: Number(editCategoryId),
      hsnCode: editItemHsn || undefined
    });
    setEditingItemId(null);
  };

  const handleAddUnit = async (e: any) => {
    e.preventDefault();
    if (!newUnitName) return;
    await db.units.add({
      name: newUnitName
    });
    setNewUnitName('');
  };

  const handleDeleteUnit = async (id: number) => {
    if (confirm('Are you sure you want to delete this unit?')) {
      await db.units.delete(id);
    }
  };
  
  const handleChangePin = (e: any) => {
    e.preventDefault();
    if (updatePin(oldPin, newPin)) {
       setPinStatus('PIN updated successfully!');
       setOldPin('');
       setNewPin('');
       setTimeout(() => setPinStatus(''), 3000);
    } else {
       setPinStatus('Error: Old PIN is incorrect.');
    }
  };

  const handleChangeNotebookPin = (e: any) => {
    e.preventDefault();
    if (updateNotebookPin(oldNbPin, newNbPin)) {
       setNbPinStatus('Notebook PIN updated successfully!');
       setOldNbPin('');
       setNewNbPin('');
       setTimeout(() => setNbPinStatus(''), 3000);
    } else {
       setNbPinStatus('Error: Old Notebook PIN is incorrect.');
    }
  };

  const handleChangePassword = (e: any) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordStatus('Error: New passwords do not match.');
      return;
    }
    if (newPassword.length < 4) {
      setPasswordStatus('Error: Password must be at least 4 characters.');
      return;
    }
    if (changePassword(oldPassword, newPassword)) {
      setPasswordStatus('Login password updated successfully!');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordStatus(''), 3000);
    } else {
      setPasswordStatus('Error: Current password is incorrect.');
    }
  };

  const handleExportJSON = async () => {
    try {
      const exCats = await db.categories.toArray();
      const exItems = await db.items.toArray();
      const exUnits = await db.units.toArray();
      const exIn = await db.inwardEntries.toArray();
      const exOut = await db.outwardEntries.toArray();
      const exBal = await db.inventoryBalances.toArray();
      
      const payload = {
         categories: exCats,
         items: exItems,
         units: exUnits,
         inwardEntries: exIn,
         outwardEntries: exOut,
         inventoryBalances: exBal,
         timestamp: new Date().toISOString()
      };
      
      const blob = new Blob([JSON.stringify(payload, null, 2)], {type: "application/json"});
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ScrapYardDB_Backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setDbStatus('Backup exported successfully.');
      setTimeout(() => setDbStatus(''), 3000);
    } catch (err) {
       console.error("Export error", err);
       setDbStatus('Error exporting backup.');
    }
  };
  
  const handleImportJSON = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!confirm('WARNING: Importing a backup will completely overwrite your existing database. Continue?')) {
       e.target.value = '';
       return;
    }
    
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const payload = JSON.parse(ev.target?.result as string);
        if (!payload.categories || !payload.items) throw new Error("Invalid backup format");
        
        await db.transaction('rw', [db.categories, db.items, db.units, db.inwardEntries, db.outwardEntries, db.inventoryBalances], async () => {
           await db.categories.clear();
           await db.items.clear();
           await db.units.clear();
           await db.inwardEntries.clear();
           await db.outwardEntries.clear();
           await db.inventoryBalances.clear();
           
           if(payload.categories.length) await db.categories.bulkAdd(payload.categories);
           if(payload.items.length) await db.items.bulkAdd(payload.items);
           if(payload.units.length) await db.units.bulkAdd(payload.units);
           if(payload.inwardEntries.length) await db.inwardEntries.bulkAdd(payload.inwardEntries);
           if(payload.outwardEntries.length) await db.outwardEntries.bulkAdd(payload.outwardEntries);
           if(payload.inventoryBalances?.length) await db.inventoryBalances.bulkAdd(payload.inventoryBalances);
        });
        
        setDbStatus('Backup restored successfully!');
      } catch (err) {
         console.error("Import error", err);
         setDbStatus('Error restoring backup. Invalid file format.');
      }
      if(fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const catMap = new Map(categories.map(c => [c.id, c]));

  return (
    <ProtectedView>
      <div className="animate-fade-in space-y-8">
        <div className="mb-8">
          <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface flex items-center gap-2">
             <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1", fontSize: '32px' }}>admin_panel_settings</span>
             Admin Settings
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">Manage master data, security, and database backups.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* ITEMS SECTION */}
          <div className="glass-panel rounded-2xl shadow-sm overflow-hidden flex flex-col max-h-[700px] border border-outline-variant/20">
            <div className="px-6 py-4 border-b border-outline-variant/20 bg-surface-variant/30 flex justify-between items-center">
              <h3 className="font-headline-md text-[18px] text-on-surface flex items-center">
                <span className="material-symbols-outlined mr-2 text-primary">category</span>
                Scrap Items
              </h3>
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="Search items..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="glass-input text-sm rounded-full py-1.5 pl-8 pr-4 border border-outline-variant/30 w-48 focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <span className="material-symbols-outlined absolute left-2 top-1.5 text-[18px] text-outline">search</span>
              </div>
            </div>
            
            <div className="p-6 border-b border-outline-variant/10 bg-white/40">
              <form onSubmit={handleAddItem} className="flex flex-col sm:flex-row gap-4 items-start sm:items-end flex-wrap">
                <div className="flex-1 space-y-1 w-full min-w-[140px]">
                  <label className="text-xs font-label-md text-on-surface-variant">Item Name</label>
                  <input 
                    type="text" 
                    className="glass-input w-full rounded-xl py-2.5 px-3 font-body-md text-body-md text-on-surface focus:outline-none placeholder-outline-variant/50"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="e.g. Broken Glass"
                    required
                  />
                </div>
                <div className="w-full sm:w-28 space-y-1">
                  <label className="text-xs font-label-md text-on-surface-variant">HSN Code</label>
                  <input 
                    type="text" 
                    maxLength={8}
                    className="glass-input w-full rounded-xl py-2.5 px-3 font-data-mono text-on-surface focus:outline-none"
                    value={newItemHsn}
                    onChange={(e) => setNewItemHsn(e.target.value.replace(/\D/g, ''))}
                    placeholder="8-digit"
                  />
                </div>
                <div className="w-full sm:w-1/3 space-y-1 relative">
                  <label className="text-xs font-label-md text-on-surface-variant">Category Tag</label>
                  <select 
                    className="glass-input w-full rounded-xl py-2.5 px-3 font-body-md text-body-md text-on-surface focus:outline-none appearance-none"
                    value={newCategoryId}
                    onChange={(e) => setNewCategoryId(e.target.value)}
                    required
                  >
                    <option value="" disabled hidden>-- select --</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-3 bottom-0 flex items-center pointer-events-none text-outline">
                    <span className="material-symbols-outlined pt-5">expand_more</span>
                  </div>
                </div>
                <button 
                  type="submit"
                  className="bg-primary hover:bg-primary/90 text-white p-2.5 rounded-xl transition-colors w-full sm:w-auto flex justify-center items-center shadow-sm"
                >
                  <span className="material-symbols-outlined text-[20px]">add</span>
                </button>
              </form>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {items
                .filter(a => a.name.toLowerCase().includes(searchTerm.toLowerCase()))
                .sort((a,b) => a.name.localeCompare(b.name))
                .map(item => {
                const cat = catMap.get(item.categoryId);
                
                if (editingItemId === item.id) {
                  return (
                    <div key={item.id} className="p-3 border border-primary/30 rounded-xl bg-primary/5 shadow-sm">
                      <form onSubmit={handleUpdateItem} className="flex flex-col sm:flex-row gap-2 flex-wrap">
                        <div className="flex-1 min-w-[120px]">
                          <input 
                            type="text" 
                            className="glass-input w-full rounded-lg py-1.5 px-3 font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-primary/50 bg-white"
                            value={editItemName}
                            onChange={(e) => setEditItemName(e.target.value)}
                            required
                          />
                        </div>
                        <div className="w-24">
                          <input 
                            type="text"
                            maxLength={8}
                            className="glass-input w-full rounded-lg py-1.5 px-3 font-data-mono text-body-sm focus:outline-none focus:ring-1 focus:ring-primary/50 bg-white"
                            value={editItemHsn}
                            onChange={(e) => setEditItemHsn(e.target.value.replace(/\D/g, ''))}
                            placeholder="HSN"
                          />
                        </div>
                        <div className="sm:w-1/3">
                          <select 
                            className="glass-input w-full rounded-lg py-1.5 px-3 font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-primary/50 appearance-none bg-white"
                            value={editCategoryId}
                            onChange={(e) => setEditCategoryId(e.target.value)}
                            required
                          >
                            <option value="" disabled hidden>Category</option>
                            {categories.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex gap-1 justify-end mt-2 sm:mt-0">
                          <button type="submit" className="text-white bg-primary hover:bg-primary/90 p-1.5 rounded-lg transition-colors">
                            <span className="material-symbols-outlined text-[18px]">check</span>
                          </button>
                          <button type="button" onClick={() => setEditingItemId(null)} className="text-on-surface-variant bg-surface-variant hover:bg-outline-variant/30 p-1.5 rounded-lg transition-colors">
                            <span className="material-symbols-outlined text-[18px]">close</span>
                          </button>
                        </div>
                      </form>
                    </div>
                  );
                }

                return (
                  <div key={item.id} className="flex items-center justify-between p-3 border border-outline-variant/20 rounded-xl bg-white/60 hover:bg-white hover:shadow-sm transition-all group">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center bg-surface-variant text-on-surface-variant font-data-mono text-xs font-bold">
                        {item.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-label-md text-label-md text-on-surface truncate">{item.name}</div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {cat && (
                            <div className="text-[10px] text-outline font-medium flex items-center">
                               <span className="material-symbols-outlined text-[12px] mr-0.5">sell</span>
                               {cat.name}
                            </div>
                          )}
                          {item.hsnCode && (
                            <div className="text-[10px] text-blue-600 font-mono bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                              HSN: {item.hsnCode}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleStartEdit(item)}
                        className="text-outline hover:text-primary p-2 rounded-full hover:bg-primary-container/20 transition-colors"
                        title="Edit Item"
                      >
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                      </button>
                      <button 
                        onClick={() => handleDeleteItem(item.id!)}
                        className="text-outline hover:text-error p-2 rounded-full hover:bg-error-container/20 transition-colors"
                        title="Delete Item"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* RIGHT COLUMN (Units, Security, Backup) */}
          <div className="space-y-8 flex flex-col">
            
            {/* UNITS SECTION */}
            <div className="glass-panel rounded-2xl shadow-sm border border-outline-variant/20 overflow-hidden flex flex-col max-h-[350px]">
              <div className="px-6 py-4 border-b border-outline-variant/20 bg-surface-variant/30 flex items-center">
                <span className="material-symbols-outlined mr-2 text-secondary">straighten</span>
                <h3 className="font-headline-md text-[18px] text-on-surface">Measuring Units</h3>
              </div>
              
              <div className="p-6 border-b border-outline-variant/10 bg-white/40">
                <form onSubmit={handleAddUnit} className="flex space-x-3 items-end">
                  <div className="flex-1 space-y-1 relative">
                    <input 
                      type="text" 
                      className="glass-input floating-input w-full rounded-xl py-2.5 px-3 font-body-md text-body-md text-on-surface focus:outline-none placeholder-transparent"
                      value={newUnitName}
                      onChange={(e) => setNewUnitName(e.target.value)}
                      placeholder="Unit Name"
                      id="unit-name"
                      required
                    />
                    <label htmlFor="unit-name" className="floating-label absolute left-3 top-3.5 font-body-sm text-body-sm text-outline transition-all duration-200 pointer-events-none">
                      Unit Name
                    </label>
                  </div>
                  <button 
                    type="submit"
                    className="bg-secondary hover:bg-secondary/90 text-white p-2.5 rounded-xl transition-colors flex items-center justify-center shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[20px]">add</span>
                  </button>
                </form>
              </div>

              <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-2 content-start">
                {units.map(unit => (
                   <div key={unit.id} className="flex items-center justify-between p-2.5 border border-outline-variant/20 rounded-xl bg-white/60 hover:bg-white transition-all group col-span-1">
                     <div className="font-label-md text-label-md text-on-surface flex items-center">
                       <span className="w-2 h-2 rounded-full bg-secondary mr-2"></span>
                       {unit.name}
                     </div>
                     <button 
                       onClick={() => handleDeleteUnit(unit.id!)}
                       className="text-outline hover:text-error p-1 rounded-full hover:bg-error-container/20 transition-colors opacity-0 group-hover:opacity-100"
                     >
                       <span className="material-symbols-outlined text-[16px]">close</span>
                     </button>
                   </div>
                ))}
              </div>
            </div>

            {/* PIN Change Section */}
            <div className="glass-panel rounded-2xl shadow-sm border border-outline-variant/20 overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-error-container/20 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
              <div className="px-6 py-4 border-b border-outline-variant/20 bg-surface-variant/30 flex items-center relative z-10">
                 <span className="material-symbols-outlined mr-2 text-error" style={{ fontVariationSettings: "'FILL' 1" }}>lock_person</span>
                 <h3 className="font-headline-md text-[18px] text-on-surface">Security Settings</h3>
              </div>
              <div className="p-6 relative z-10 space-y-8">
                 {/* Admin PIN */}
                 <form onSubmit={handleChangePin} className="space-y-4">
                    <h4 className="font-label-lg text-on-surface">Admin PIN</h4>
                    {pinStatus && (
                       <div className={`p-3 text-label-md rounded-xl border backdrop-blur-md flex items-center ${pinStatus.includes('Error') ? 'bg-error-container/20 text-error border-error/30' : 'bg-tertiary-container/20 text-tertiary border-tertiary/30'}`}>
                          <span className="material-symbols-outlined mr-2 text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                            {pinStatus.includes('Error') ? 'error' : 'check_circle'}
                          </span>
                          {pinStatus}
                       </div>
                    )}
                    <div className="flex gap-4">
                      <div className="flex-1 space-y-1 relative pt-2">
                        <input 
                          type="password" 
                          maxLength={4}
                          className="glass-input floating-input w-full rounded-xl py-2.5 px-4 font-data-mono tracking-widest text-on-surface focus:outline-none placeholder-transparent text-center"
                          value={oldPin}
                          onChange={(e) => setOldPin(e.target.value.replace(/\D/g, ''))}
                          placeholder="Old PIN"
                          id="old-pin"
                          required
                        />
                        <label htmlFor="old-pin" className="floating-label absolute left-4 top-4.5 font-body-sm text-body-sm text-outline transition-all duration-200 pointer-events-none">
                          Current PIN
                        </label>
                      </div>
                      <div className="flex-1 space-y-1 relative pt-2">
                        <input 
                          type="password" 
                          maxLength={4}
                          className="glass-input floating-input w-full rounded-xl py-2.5 px-4 font-data-mono tracking-widest text-on-surface focus:outline-none placeholder-transparent text-center border-primary/40 focus:border-primary"
                          value={newPin}
                          onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                          placeholder="New PIN"
                          id="new-pin"
                          required
                        />
                        <label htmlFor="new-pin" className="floating-label absolute left-4 top-4.5 font-body-sm text-body-sm text-outline transition-all duration-200 pointer-events-none text-primary">
                          New PIN
                        </label>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button type="submit" className="bg-surface-variant hover:bg-outline-variant/40 text-on-surface border border-outline-variant/30 px-6 py-2.5 rounded-xl font-label-md text-label-md transition-colors shadow-sm">
                         Update Admin PIN
                      </button>
                    </div>
                 </form>

                 <div className="h-px bg-outline-variant/30 w-full"></div>

                 {/* Notebook PIN */}
                 <form onSubmit={handleChangeNotebookPin} className="space-y-4">
                    <h4 className="font-label-lg text-on-surface">Notebook PIN</h4>
                    {nbPinStatus && (
                       <div className={`p-3 text-label-md rounded-xl border backdrop-blur-md flex items-center ${nbPinStatus.includes('Error') ? 'bg-error-container/20 text-error border-error/30' : 'bg-tertiary-container/20 text-tertiary border-tertiary/30'}`}>
                          <span className="material-symbols-outlined mr-2 text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                            {nbPinStatus.includes('Error') ? 'error' : 'check_circle'}
                          </span>
                          {nbPinStatus}
                       </div>
                    )}
                    <div className="flex gap-4">
                      <div className="flex-1 space-y-1 relative pt-2">
                        <input 
                          type="password" 
                          maxLength={4}
                          className="glass-input floating-input w-full rounded-xl py-2.5 px-4 font-data-mono tracking-widest text-on-surface focus:outline-none placeholder-transparent text-center"
                          value={oldNbPin}
                          onChange={(e) => setOldNbPin(e.target.value.replace(/\D/g, ''))}
                          placeholder="Old PIN"
                          id="old-nb-pin"
                          required
                        />
                        <label htmlFor="old-nb-pin" className="floating-label absolute left-4 top-4.5 font-body-sm text-body-sm text-outline transition-all duration-200 pointer-events-none">
                          Current Notebook PIN
                        </label>
                      </div>
                      <div className="flex-1 space-y-1 relative pt-2">
                        <input 
                          type="password" 
                          maxLength={4}
                          className="glass-input floating-input w-full rounded-xl py-2.5 px-4 font-data-mono tracking-widest text-on-surface focus:outline-none placeholder-transparent text-center border-primary/40 focus:border-primary"
                          value={newNbPin}
                          onChange={(e) => setNewNbPin(e.target.value.replace(/\D/g, ''))}
                          placeholder="New PIN"
                          id="new-nb-pin"
                          required
                        />
                        <label htmlFor="new-nb-pin" className="floating-label absolute left-4 top-4.5 font-body-sm text-body-sm text-outline transition-all duration-200 pointer-events-none text-primary">
                          New Notebook PIN
                        </label>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button type="submit" className="bg-surface-variant hover:bg-outline-variant/40 text-on-surface border border-outline-variant/30 px-6 py-2.5 rounded-xl font-label-md text-label-md transition-colors shadow-sm">
                         Update Notebook PIN
                      </button>
                    </div>
                 </form>
              </div>
            </div>

            {/* Login Password Change Section */}
            <div className="glass-panel rounded-2xl shadow-sm border border-outline-variant/20 overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary-container/20 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
              <div className="px-6 py-4 border-b border-outline-variant/20 bg-surface-variant/30 flex items-center relative z-10">
                 <span className="material-symbols-outlined mr-2 text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>key</span>
                 <h3 className="font-headline-md text-[18px] text-on-surface">Change Login Password</h3>
              </div>
              <div className="p-6 relative z-10">
                 <form onSubmit={handleChangePassword} className="space-y-5">
                    {passwordStatus && (
                       <div className={`p-3 text-label-md rounded-xl border backdrop-blur-md flex items-center ${passwordStatus.includes('Error') ? 'bg-error-container/20 text-error border-error/30' : 'bg-tertiary-container/20 text-tertiary border-tertiary/30'}`}>
                          <span className="material-symbols-outlined mr-2 text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                            {passwordStatus.includes('Error') ? 'error' : 'check_circle'}
                          </span>
                          {passwordStatus}
                       </div>
                    )}
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-xs font-label-md text-on-surface-variant">Current Password</label>
                        <input 
                          type="password" 
                          className="glass-input w-full rounded-xl py-2.5 px-4 font-body-md text-on-surface focus:outline-none"
                          value={oldPassword}
                          onChange={(e) => setOldPassword(e.target.value)}
                          placeholder="Enter current password"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-label-md text-on-surface-variant">New Password</label>
                        <input 
                          type="password" 
                          className="glass-input w-full rounded-xl py-2.5 px-4 font-body-md text-on-surface focus:outline-none"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Enter new password"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-label-md text-on-surface-variant">Confirm New Password</label>
                        <input 
                          type="password" 
                          className="glass-input w-full rounded-xl py-2.5 px-4 font-body-md text-on-surface focus:outline-none"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Confirm new password"
                          required
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button type="submit" className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-xl font-label-md text-label-md transition-colors shadow-sm">
                         Update Password
                      </button>
                    </div>
                 </form>
              </div>
            </div>

            {/* Backup & Restore Section */}
            <div className="glass-panel rounded-2xl shadow-sm border border-outline-variant/20 overflow-hidden">
              <div className="px-6 py-4 border-b border-outline-variant/20 bg-surface-variant/30 flex items-center">
                 <span className="material-symbols-outlined mr-2 text-tertiary">cloud_sync</span>
                 <h3 className="font-headline-md text-[18px] text-on-surface">Data Backup & Restore</h3>
              </div>
              <div className="p-6 space-y-6">
                 {dbStatus && (
                    <div className={`p-3 text-label-md rounded-xl border backdrop-blur-md flex items-center ${dbStatus.includes('Error') ? 'bg-error-container/20 text-error border-error/30' : 'bg-tertiary-container/20 text-tertiary border-tertiary/30'}`}>
                       <span className="material-symbols-outlined mr-2 text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                         {dbStatus.includes('Error') ? 'error' : 'check_circle'}
                       </span>
                       {dbStatus}
                    </div>
                 )}
                 
                 <div className="flex items-center justify-between p-4 border border-tertiary/20 bg-tertiary/5 rounded-xl">
                    <div>
                      <h4 className="font-label-md text-label-md text-on-surface">Export Data</h4>
                      <p className="text-xs text-on-surface-variant mt-0.5">Download full JSON backup.</p>
                    </div>
                    <button 
                       onClick={handleExportJSON}
                       className="bg-white text-tertiary border border-tertiary/30 px-4 py-2 rounded-xl text-sm font-label-md hover:bg-tertiary hover:text-white transition-all flex items-center shadow-sm"
                    >
                       <span className="material-symbols-outlined mr-2 text-[18px]">download</span> Export
                    </button>
                 </div>

                 <div className="flex items-center justify-between p-4 border border-error/20 bg-error/5 rounded-xl">
                    <div>
                      <h4 className="font-label-md text-label-md text-on-surface">Restore Data</h4>
                      <p className="text-xs text-error mt-0.5 font-medium flex items-center">
                         <span className="material-symbols-outlined text-[14px] mr-0.5">warning</span> Overwrites DB!
                      </p>
                    </div>
                    <label className="cursor-pointer bg-white text-error border border-error/30 px-4 py-2 rounded-xl text-sm font-label-md hover:bg-error hover:text-white transition-all flex items-center shadow-sm">
                       <span className="material-symbols-outlined mr-2 text-[18px]">upload</span> Restore
                       <input 
                          type="file" 
                          accept=".json"
                          ref={fileInputRef}
                          className="hidden"
                          onChange={handleImportJSON}
                       />
                    </label>
                 </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </ProtectedView>
  );
}
