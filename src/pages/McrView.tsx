import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import mcrData from '../../Material_Condemnation_Report.json';

// ─── Types ──────────────────────────────────────────────────────────────────

interface LotRow {
  id: string;
  type: string | null;
  plNo: string | null;
  material: string;
  qty: number | string;
  qtyRaw?: string;
  unit: string;
  scrNo: string | null;
  date: string | null;
  eAuctionDate: string | null;
  lotNo: string | null;
  purchaser: string | null;
  deliveryDate: string | null;
  _isNew?: boolean;
}

interface CoachRow {
  id: string;
  type: string | null;
  qty: number | string;
  coachNo: string | null;
  crReportNo?: string | null;
  date: string | null;
  eAuctionDate: string | null;
  lotNo: string | null;
  purchaser: string | null;
  deliveryDate: string | null;
  _isNew?: boolean;
}

interface WtaRow {
  id: string;
  type: string | null;
  plNo: string | null;
  material: string;
  qty: number | string;
  unit: string;
  railway?: string | null;
  poNo?: string | null;
  transporter?: string | null;
  deliveryDate: string | null;
  _isNew?: boolean;
}

interface MPRow {
  id: string;
  type: string | null;
  plNo: string | null;
  material: string;
  qty: number | string;
  unit: string;
  scrNo: string | null;
  date: string | null;
  eAuctionDate: string | null;
  lotNo: string | null;
  purchaser: string | null;
  deliveryDate: string | null;
  _isNew?: boolean;
}

// ─── Status ──────────────────────────────────────────────────────────────────

export type RowStatus = 'delivered' | 'pending' | 'cancelled';

export function getStatus(row: { eAuctionDate?: string | null; deliveryDate?: string | null }): RowStatus {
  const auc = (row.eAuctionDate || '').toString().toLowerCase().trim();
  if (auc === 'cancelled') return 'cancelled';
  if (!row.deliveryDate || !row.deliveryDate.toString().trim()) return 'pending';
  return 'delivered';
}

export function StatusBadge({ status }: { status: RowStatus }) {
  const map = {
    delivered: { label: '✅ Delivered', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    pending: { label: '⏳ Pending', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
    cancelled: { label: '🚫 Cancelled', cls: 'bg-red-100 text-red-700 border-red-200' },
  };
  const { label, cls } = map[status];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${cls}`}>{label}</span>;
}

// ─── Local Storage ────────────────────────────────────────────────────────────

const LS_EXTRA = (s: string) => `mcr_extra_rows_${s}`;
const LS_EDITS = (s: string) => `mcr_edits_${s}`;

function loadExtra<T>(section: string): T[] {
  try { return JSON.parse(localStorage.getItem(LS_EXTRA(section)) || '[]'); } catch { return []; }
}
function saveExtra<T>(section: string, rows: T[]) {
  localStorage.setItem(LS_EXTRA(section), JSON.stringify(rows));
}
function loadEdits(section: string): Record<string, any> {
  try { return JSON.parse(localStorage.getItem(LS_EDITS(section)) || '{}'); } catch { return {}; }
}
function saveEdits(section: string, edits: Record<string, any>) {
  localStorage.setItem(LS_EDITS(section), JSON.stringify(edits));
}

// ─── Empty row factories ─────────────────────────────────────────────────────

const uid = () => `new_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

function emptyLot(): LotRow { return { id: uid(), type: 'Mech', plNo: '', material: '', qty: '', qtyRaw: '', unit: 'MT', scrNo: '', date: '', eAuctionDate: '', lotNo: '', purchaser: '', deliveryDate: '', _isNew: true }; }
function emptyCoach(): CoachRow { return { id: uid(), type: 'Coach', qty: '', coachNo: '', crReportNo: '', date: '', eAuctionDate: '', lotNo: '', purchaser: '', deliveryDate: '', _isNew: true }; }
function emptyWta(): WtaRow { return { id: uid(), type: 'WTA', plNo: '', material: '', qty: '', unit: 'MT', railway: '', poNo: '', transporter: '', deliveryDate: '', _isNew: true }; }
function emptyMP(): MPRow { return { id: uid(), type: 'MECH', plNo: '', material: '', qty: '', unit: 'No', scrNo: '', date: '', eAuctionDate: '', lotNo: '', purchaser: '', deliveryDate: '', _isNew: true }; }

// ─── Inline Edit Row for a field ─────────────────────────────────────────────

function InlineInput({ value, onChange, type = 'text', placeholder = '' }: {
  value: string | number | null; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <input
      type={type}
      defaultValue={value?.toString() ?? ''}
      className="w-full min-w-[60px] bg-white/80 border border-primary/30 rounded-md px-1.5 py-1 text-[11px] text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary"
      onBlur={e => onChange(e.target.value)}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}

// ─── Generic Table Component ─────────────────────────────────────────────────

interface ColDef<T> {
  key: keyof T | string;
  header: string;
  render?: (row: T, isEditing: boolean, onChange: (field: string, val: string) => void) => React.ReactNode;
  minWidth?: string;
}

// ─── Lot Tab ─────────────────────────────────────────────────────────────────

function LotTab() {
  const base = mcrData.lotMaterialPosition as LotRow[];
  const [extras, setExtras] = useState<LotRow[]>(() => loadExtra<LotRow>('lot'));
  const [edits, setEdits] = useState<Record<string, Partial<LotRow>>>(() => loadEdits('lot'));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBuf, setEditBuf] = useState<Partial<LotRow>>({});
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'delivered' | 'cancelled'>('all');
  const [saved, setSaved] = useState<string | null>(null);

  // Merge base with edits
  const allRows = useMemo(() => {
    const merged = base.map(r => ({ ...r, ...(edits[r.id] || {}) }));
    return [...merged, ...extras];
  }, [edits, extras]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allRows.filter(row => {
      const matchQ = !q
        || (row.material || '').toLowerCase().includes(q)
        || (row.lotNo || '').toLowerCase().includes(q)
        || (row.purchaser || '').toLowerCase().includes(q)
        || (row.scrNo || '').toLowerCase().includes(q)
        || (row.plNo || '').toLowerCase().includes(q);
      const st = getStatus(row);
      return matchQ && (statusFilter === 'all' || st === statusFilter);
    });
  }, [allRows, search, statusFilter]);

  const stats = useMemo(() => ({
    total: allRows.length,
    delivered: allRows.filter(r => getStatus(r) === 'delivered').length,
    pending: allRows.filter(r => getStatus(r) === 'pending').length,
    cancelled: allRows.filter(r => getStatus(r) === 'cancelled').length,
  }), [allRows]);

  const startEdit = (row: LotRow) => {
    setEditingId(row.id);
    setEditBuf({ ...row });
  };

  const cancelEdit = () => { setEditingId(null); setEditBuf({}); };

  const saveEdit = (row: LotRow) => {
    if (row._isNew) {
      // Save to extras
      setExtras(prev => {
        const next = prev.map(r => r.id === row.id ? { ...r, ...editBuf } : r);
        saveExtra('lot', next);
        return next;
      });
    } else {
      // Save to edits store
      const newEdits = { ...edits, [row.id]: { ...(edits[row.id] || {}), ...editBuf } };
      setEdits(newEdits);
      saveEdits('lot', newEdits);
    }
    setEditingId(null);
    setEditBuf({});
    setSaved(row.id);
    setTimeout(() => setSaved(null), 2000);
  };

  const updateBuf = (field: string, val: string) => {
    setEditBuf(prev => ({ ...prev, [field]: val }));
  };

  const addRow = () => {
    const nr = emptyLot();
    setExtras(prev => { const next = [...prev, nr]; saveExtra('lot', next); return next; });
    setTimeout(() => startEdit(nr), 100);
  };

  const deleteExtra = (id: string) => {
    setExtras(prev => { const next = prev.filter(r => r.id !== id); saveExtra('lot', next); return next; });
    if (editingId === id) cancelEdit();
  };

  const deleteEdit = (id: string) => {
    const newEdits = { ...edits };
    delete newEdits[id];
    setEdits(newEdits);
    saveEdits('lot', newEdits);
  };

  const fields: { key: keyof LotRow; label: string; placeholder?: string; type?: string }[] = [
    { key: 'type', label: 'Type', placeholder: 'Mech' },
    { key: 'plNo', label: 'PL No', placeholder: 'PL Number' },
    { key: 'material', label: 'Material', placeholder: 'Material name' },
    { key: 'qty', label: 'Qty', placeholder: '0', type: 'number' },
    { key: 'unit', label: 'Unit', placeholder: 'MT' },
    { key: 'scrNo', label: 'SCR No', placeholder: 'SCR No' },
    { key: 'date', label: 'Condn Date', placeholder: 'DD.MM.YYYY' },
    { key: 'eAuctionDate', label: 'Auction Date', placeholder: 'DD/MM/YYYY' },
    { key: 'lotNo', label: 'Lot No', placeholder: 'Lot Number' },
    { key: 'purchaser', label: 'Purchaser', placeholder: 'Purchaser name' },
    { key: 'deliveryDate', label: 'Delivery Date', placeholder: 'DD/MM/YYYY' },
  ];

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total', val: stats.total, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Delivered', val: stats.delivered, color: 'text-emerald-700', bg: 'bg-emerald-50' },
          { label: 'Pending', val: stats.pending, color: 'text-amber-700', bg: 'bg-amber-50' },
          { label: 'Cancelled', val: stats.cancelled, color: 'text-red-700', bg: 'bg-red-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-3 text-center border border-white/50 cursor-pointer hover:scale-105 transition-transform`}
            onClick={() => setStatusFilter(s.label.toLowerCase() as any)}>
            <p className={`text-2xl font-extrabold font-data-mono ${s.color}`}>{s.val}</p>
            <p className="text-xs text-outline font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-outline text-[18px]">search</span>
          <input className="w-full pl-9 pr-4 py-2.5 rounded-xl glass-input text-sm text-on-surface focus:outline-none" placeholder="Material, Lot No, Purchaser, SCR No..." value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-error" onClick={() => setSearch('')}><span className="material-symbols-outlined text-[18px]">close</span></button>}
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['all', 'pending', 'delivered', 'cancelled'] as const).map(f => (
            <button key={f} onClick={() => setStatusFilter(f)}
              className={`px-3 py-2 rounded-xl text-xs font-bold capitalize transition-all border ${statusFilter === f ? 'bg-primary text-white border-primary shadow-sm' : 'glass-input text-on-surface-variant border-outline-variant/30 hover:border-primary/40'}`}>
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <button onClick={addRow} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white text-sm font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all whitespace-nowrap">
          <span className="material-symbols-outlined text-[18px]">add</span>Add Row
        </button>
      </div>

      {/* Edit panel */}
      {editingId && (() => {
        const row = allRows.find(r => r.id === editingId);
        if (!row) return null;
        return (
          <div className="bg-gradient-to-br from-primary/5 to-secondary/5 border-2 border-primary/30 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-primary flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>edit_note</span>
                Row Edit kar rahe hain: <span className="font-mono text-sm bg-primary/10 px-2 py-0.5 rounded">{editBuf.lotNo || editBuf.material || row.id}</span>
              </h4>
              <div className="flex gap-2">
                <button onClick={() => saveEdit(row)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition-colors shadow-sm">
                  <span className="material-symbols-outlined text-[18px]">save</span>Save
                </button>
                <button onClick={cancelEdit} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-container text-on-surface-variant text-sm font-medium hover:bg-error-container/20 hover:text-error transition-colors border border-outline-variant/30">
                  <span className="material-symbols-outlined text-[18px]">close</span>Cancel
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {fields.map(f => (
                <div key={f.key as string} className="space-y-1">
                  <label className="text-[10px] font-bold text-outline uppercase tracking-wider">{f.label}</label>
                  <input
                    type={f.type || 'text'}
                    value={(editBuf[f.key] as string) ?? ''}
                    onChange={e => updateBuf(f.key as string, e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full bg-white border border-outline-variant/30 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Table */}
      <div className="rounded-2xl border border-outline-variant/20 overflow-hidden shadow-sm">
        <div className="overflow-x-auto max-h-[55vh] overflow-y-auto">
          <table className="w-full text-xs border-collapse" style={{ minWidth: '1300px' }}>
            <thead className="sticky top-0 z-10">
              <tr className="bg-primary/90 text-white">
                <th className="px-3 py-3 text-left font-bold sticky left-0 bg-primary/90">#</th>
                <th className="px-3 py-3 text-left font-bold">Type</th>
                <th className="px-3 py-3 text-left font-bold">PL No</th>
                <th className="px-3 py-3 text-left font-bold" style={{ minWidth: 200 }}>Material</th>
                <th className="px-3 py-3 text-left font-bold">Qty</th>
                <th className="px-3 py-3 text-left font-bold">Unit</th>
                <th className="px-3 py-3 text-left font-bold">SCR No</th>
                <th className="px-3 py-3 text-left font-bold">Condn Date</th>
                <th className="px-3 py-3 text-left font-bold">Auction Date</th>
                <th className="px-3 py-3 text-left font-bold" style={{ minWidth: 160 }}>Lot No</th>
                <th className="px-3 py-3 text-left font-bold" style={{ minWidth: 140 }}>Purchaser</th>
                <th className="px-3 py-3 text-left font-bold" style={{ minWidth: 120 }}>Delivery Date</th>
                <th className="px-3 py-3 text-left font-bold">Status</th>
                <th className="px-3 py-3 text-left font-bold sticky right-0 bg-primary/90">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => {
                const isNew = !!row._isNew;
                const isEditing = editingId === row.id;
                const hasEdit = !isNew && !!edits[row.id];
                const status = getStatus(row);
                const isSaved = saved === row.id;
                const rowBg = isSaved
                  ? 'bg-emerald-50'
                  : isEditing
                    ? 'bg-primary/5 ring-2 ring-primary/20'
                    : isNew
                      ? 'bg-blue-50/50'
                      : hasEdit
                        ? 'bg-violet-50/50'
                        : status === 'pending'
                          ? 'bg-amber-50/30'
                          : status === 'cancelled'
                            ? 'bg-red-50/20'
                            : 'bg-white/60 hover:bg-white/90';

                return (
                  <tr key={row.id} className={`border-b border-outline-variant/10 transition-all ${rowBg}`}>
                    <td className="px-3 py-2 text-outline font-mono sticky left-0 bg-inherit">{i + 1}</td>
                    <td className="px-3 py-2"><span className="px-1.5 py-0.5 bg-secondary/10 text-secondary rounded text-[10px] font-bold">{row.type || '—'}</span></td>
                    <td className="px-3 py-2 font-mono text-outline text-[10px]">{row.plNo || '—'}</td>
                    <td className="px-3 py-2 font-medium text-on-surface max-w-[240px] truncate" title={row.material}>{row.material || <span className="text-outline/40 italic">—</span>}</td>
                    <td className="px-3 py-2 font-data-mono font-bold text-primary">{row.qty}</td>
                    <td className="px-3 py-2 text-outline">{row.unit}</td>
                    <td className="px-3 py-2 font-mono text-[10px] text-outline">{row.scrNo || '—'}</td>
                    <td className="px-3 py-2 text-outline whitespace-nowrap">{row.date || '—'}</td>
                    <td className="px-3 py-2 text-indigo-700 font-medium whitespace-nowrap">{row.eAuctionDate || '—'}</td>
                    <td className="px-3 py-2 font-mono font-bold text-[10px] text-on-surface">{row.lotNo || <span className="text-outline/40 font-normal">—</span>}</td>
                    <td className="px-3 py-2 max-w-[160px] truncate" title={row.purchaser || ''}>{row.purchaser || <span className="text-outline/40">—</span>}</td>
                    <td className="px-3 py-2 text-outline text-[10px] max-w-[130px]">
                      {row.deliveryDate?.toString() || <span className="text-amber-500 font-bold">Not delivered</span>}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={status} />
                      {isSaved && <span className="ml-1 text-[9px] text-emerald-600 font-bold animate-pulse">Saved!</span>}
                      {hasEdit && !isSaved && <span className="ml-1 text-[9px] text-violet-600 font-bold">Edited</span>}
                    </td>
                    <td className="px-3 py-2 sticky right-0 bg-inherit">
                      <div className="flex gap-1">
                        {isEditing ? (
                          <>
                            <button onClick={() => saveEdit(row)} className="w-7 h-7 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-700 flex items-center justify-center" title="Save">
                              <span className="material-symbols-outlined text-[16px]">save</span>
                            </button>
                            <button onClick={cancelEdit} className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center" title="Cancel">
                              <span className="material-symbols-outlined text-[16px]">close</span>
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEdit(row)} className="w-7 h-7 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center transition-colors" title="Edit row">
                              <span className="material-symbols-outlined text-[16px]">edit</span>
                            </button>
                            {(isNew || hasEdit) && (
                              <button onClick={() => isNew ? deleteExtra(row.id) : deleteEdit(row.id)} className="w-7 h-7 rounded-lg bg-red-100 hover:bg-red-200 text-red-600 flex items-center justify-center transition-colors" title={isNew ? 'Delete row' : 'Revert to original'}>
                                <span className="material-symbols-outlined text-[16px]">{isNew ? 'delete' : 'restart_alt'}</span>
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={14} className="px-4 py-10 text-center text-outline italic">Koi record nahi mila — search filter clear karein</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2.5 bg-surface-container-low/50 border-t border-outline-variant/10 flex items-center justify-between">
          <p className="text-xs text-outline"><span className="font-bold text-on-surface">{filtered.length}</span> of <span className="font-bold">{allRows.length}</span> rows shown
            {extras.length > 0 && <span className="ml-2 text-blue-600 font-medium">• {extras.length} manually added</span>}
            {Object.keys(edits).length > 0 && <span className="ml-2 text-violet-600 font-medium">• {Object.keys(edits).length} edited</span>}
          </p>
          <button onClick={addRow} className="flex items-center gap-1.5 text-xs text-primary font-bold hover:underline">
            <span className="material-symbols-outlined text-[14px]">add_circle</span>Add New Row
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Coach Tab ────────────────────────────────────────────────────────────────

function CoachTab() {
  const base = mcrData.coachPosition as CoachRow[];
  const [extras, setExtras] = useState<CoachRow[]>(() => loadExtra<CoachRow>('coach'));
  const [edits, setEdits] = useState<Record<string, Partial<CoachRow>>>(() => loadEdits('coach'));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBuf, setEditBuf] = useState<Partial<CoachRow>>({});
  const [search, setSearch] = useState('');
  const [saved, setSaved] = useState<string | null>(null);

  const allRows = useMemo(() => [...base.map(r => ({ ...r, ...(edits[r.id] || {}) })), ...extras], [edits, extras]);
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allRows.filter(r => !q || (r.coachNo || '').toLowerCase().includes(q) || (r.lotNo || '').toLowerCase().includes(q) || (r.purchaser || '').toLowerCase().includes(q));
  }, [allRows, search]);

  const startEdit = (row: CoachRow) => { setEditingId(row.id); setEditBuf({ ...row }); };
  const cancelEdit = () => { setEditingId(null); setEditBuf({}); };
  const saveEdit = (row: CoachRow) => {
    if (row._isNew) { setExtras(prev => { const next = prev.map(r => r.id === row.id ? { ...r, ...editBuf } : r); saveExtra('coach', next); return next; }); }
    else { const ne = { ...edits, [row.id]: editBuf }; setEdits(ne); saveEdits('coach', ne); }
    setEditingId(null); setSaved(row.id); setTimeout(() => setSaved(null), 2000);
  };
  const addRow = () => { const nr = emptyCoach(); setExtras(prev => { const n = [...prev, nr]; saveExtra('coach', n); return n; }); setTimeout(() => startEdit(nr), 100); };

  const fields: { key: keyof CoachRow; label: string; placeholder?: string; type?: string }[] = [
    { key: 'type', label: 'Type' }, { key: 'qty', label: 'Qty', type: 'number' },
    { key: 'coachNo', label: 'Coach No', placeholder: 'Coach Number' }, { key: 'crReportNo', label: 'CR Report No' },
    { key: 'date', label: 'Condn Date' }, { key: 'eAuctionDate', label: 'Auction Date' },
    { key: 'lotNo', label: 'Lot No', placeholder: 'Lot Number' }, { key: 'purchaser', label: 'Purchaser' },
    { key: 'deliveryDate', label: 'Delivery Date' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-outline text-[18px]">search</span>
          <input className="w-full pl-9 pr-4 py-2.5 rounded-xl glass-input text-sm focus:outline-none" placeholder="Coach no, lot no, purchaser..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={addRow} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all whitespace-nowrap">
          <span className="material-symbols-outlined text-[18px]">add</span>Add Row
        </button>
      </div>
      {editingId && (() => {
        const row = allRows.find(r => r.id === editingId); if (!row) return null;
        return (
          <div className="bg-indigo-50 border-2 border-indigo-300 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-indigo-700 flex items-center gap-2"><span className="material-symbols-outlined text-[20px]">edit_note</span>Edit Row</h4>
              <div className="flex gap-2">
                <button onClick={() => saveEdit(row)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-bold"><span className="material-symbols-outlined text-[18px]">save</span>Save</button>
                <button onClick={cancelEdit} className="px-4 py-2 rounded-xl border text-sm text-on-surface-variant">Cancel</button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {fields.map(f => (
                <div key={f.key as string} className="space-y-1">
                  <label className="text-[10px] font-bold text-outline uppercase tracking-wider">{f.label}</label>
                  <input type={f.type || 'text'} value={(editBuf[f.key] as string) ?? ''} onChange={e => setEditBuf(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder}
                    className="w-full bg-white border border-indigo-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
              ))}
            </div>
          </div>
        );
      })()}
      <div className="rounded-2xl border border-outline-variant/20 overflow-hidden shadow-sm">
        <div className="overflow-x-auto max-h-[55vh] overflow-y-auto">
          <table className="w-full text-xs border-collapse" style={{ minWidth: 1000 }}>
            <thead className="sticky top-0 z-10">
              <tr className="bg-indigo-600 text-white">
                {['#','Type','Qty','Coach No','CR Report No','Condn Date','Auction Date','Lot No','Purchaser','Delivery Date','Status','Actions'].map(h => (
                  <th key={h} className="px-3 py-3 text-left font-bold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => {
                const isNew = !!row._isNew; const hasEdit = !isNew && !!edits[row.id]; const status = getStatus(row);
                const rowBg = saved === row.id ? 'bg-emerald-50' : isNew ? 'bg-blue-50/50' : hasEdit ? 'bg-violet-50/50' : status === 'pending' ? 'bg-amber-50/30' : 'bg-white/60 hover:bg-white/90';
                return (
                  <tr key={row.id} className={`border-b border-outline-variant/10 transition-colors ${rowBg}`}>
                    <td className="px-3 py-2 text-outline font-mono">{i + 1}</td>
                    <td className="px-3 py-2"><span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[10px] font-bold">{row.type || '—'}</span></td>
                    <td className="px-3 py-2 font-data-mono font-bold text-primary">{row.qty}</td>
                    <td className="px-3 py-2 font-mono font-bold">{row.coachNo || '—'}</td>
                    <td className="px-3 py-2 text-outline text-[10px]">{(row as any).crReportNo || '—'}</td>
                    <td className="px-3 py-2 text-outline whitespace-nowrap">{row.date || '—'}</td>
                    <td className="px-3 py-2 text-indigo-700 font-medium">{row.eAuctionDate || '—'}</td>
                    <td className="px-3 py-2 font-mono font-bold text-[10px]">{row.lotNo || '—'}</td>
                    <td className="px-3 py-2">{row.purchaser || <span className="text-outline/40">—</span>}</td>
                    <td className="px-3 py-2 text-outline text-[10px]">{row.deliveryDate?.toString() || <span className="text-amber-500 font-bold">Not delivered</span>}</td>
                    <td className="px-3 py-2"><StatusBadge status={status} />{saved === row.id && <span className="ml-1 text-[9px] text-emerald-600 font-bold">Saved!</span>}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <button onClick={() => startEdit(row)} className="w-7 h-7 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 flex items-center justify-center" title="Edit">
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                        </button>
                        {(isNew || hasEdit) && (
                          <button onClick={() => { if (isNew) { setExtras(p => { const n = p.filter(r => r.id !== row.id); saveExtra('coach', n); return n; }); } else { const ne = { ...edits }; delete ne[row.id]; setEdits(ne); saveEdits('coach', ne); } }} className="w-7 h-7 rounded-lg bg-red-100 hover:bg-red-200 text-red-600 flex items-center justify-center">
                            <span className="material-symbols-outlined text-[16px]">{isNew ? 'delete' : 'restart_alt'}</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={12} className="px-4 py-10 text-center text-outline italic">Koi record nahi mila</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2.5 bg-surface-container-low/50 border-t border-outline-variant/10 flex justify-between items-center">
          <p className="text-xs text-outline">{filtered.length} of {allRows.length} shown</p>
          <button onClick={addRow} className="flex items-center gap-1.5 text-xs text-indigo-600 font-bold hover:underline"><span className="material-symbols-outlined text-[14px]">add_circle</span>Add Row</button>
        </div>
      </div>
    </div>
  );
}

// ─── WTA Tab ──────────────────────────────────────────────────────────────────

function WtaTab() {
  const base = mcrData.wtaPosition as WtaRow[];
  const [extras, setExtras] = useState<WtaRow[]>(() => loadExtra<WtaRow>('wta'));
  const [edits, setEdits] = useState<Record<string, Partial<WtaRow>>>(() => loadEdits('wta'));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBuf, setEditBuf] = useState<Partial<WtaRow>>({});
  const [search, setSearch] = useState('');
  const [saved, setSaved] = useState<string | null>(null);

  const allRows = useMemo(() => [...base.map(r => ({ ...r, ...(edits[r.id] || {}) })), ...extras], [edits, extras]);
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allRows.filter(r => !q || (r.material || '').toLowerCase().includes(q) || ((r as any).transporter || '').toLowerCase().includes(q) || ((r as any).railway || '').toLowerCase().includes(q));
  }, [allRows, search]);

  const saveEdit = (row: WtaRow) => {
    if (row._isNew) { setExtras(prev => { const n = prev.map(r => r.id === row.id ? { ...r, ...editBuf } : r); saveExtra('wta', n); return n; }); }
    else { const ne = { ...edits, [row.id]: editBuf }; setEdits(ne); saveEdits('wta', ne); }
    setEditingId(null); setSaved(row.id); setTimeout(() => setSaved(null), 2000);
  };

  const fields: { key: string; label: string; placeholder?: string; type?: string }[] = [
    { key: 'type', label: 'Type' }, { key: 'plNo', label: 'PL No' }, { key: 'material', label: 'Material' },
    { key: 'qty', label: 'Qty', type: 'number' }, { key: 'unit', label: 'Unit' },
    { key: 'railway', label: 'Railway' }, { key: 'poNo', label: 'PO No' }, { key: 'transporter', label: 'Transporter' },
    { key: 'deliveryDate', label: 'Delivery Date' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-outline text-[18px]">search</span>
          <input className="w-full pl-9 pr-4 py-2.5 rounded-xl glass-input text-sm focus:outline-none" placeholder="Material, transporter, railway..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={() => { const nr = emptyWta(); setExtras(p => { const n = [...p, nr]; saveExtra('wta', n); return n; }); setTimeout(() => { setEditingId(nr.id); setEditBuf({ ...nr }); }, 100); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all whitespace-nowrap">
          <span className="material-symbols-outlined text-[18px]">add</span>Add Row
        </button>
      </div>
      {editingId && (() => {
        const row = allRows.find(r => r.id === editingId); if (!row) return null;
        return (
          <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-emerald-700 flex items-center gap-2"><span className="material-symbols-outlined text-[20px]">edit_note</span>Edit WTA Row</h4>
              <div className="flex gap-2">
                <button onClick={() => saveEdit(row)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-bold"><span className="material-symbols-outlined text-[18px]">save</span>Save</button>
                <button onClick={() => setEditingId(null)} className="px-4 py-2 rounded-xl border text-sm text-on-surface-variant">Cancel</button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {fields.map(f => (
                <div key={f.key} className="space-y-1">
                  <label className="text-[10px] font-bold text-outline uppercase tracking-wider">{f.label}</label>
                  <input type={f.type || 'text'} value={(editBuf as any)[f.key] ?? ''} onChange={e => setEditBuf(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full bg-white border border-emerald-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
                </div>
              ))}
            </div>
          </div>
        );
      })()}
      <div className="rounded-2xl border border-outline-variant/20 overflow-hidden shadow-sm">
        <div className="overflow-x-auto max-h-[55vh] overflow-y-auto">
          <table className="w-full text-xs border-collapse" style={{ minWidth: 900 }}>
            <thead className="sticky top-0 z-10">
              <tr className="bg-emerald-700 text-white">
                {['#','Type','PL No','Material','Qty','Unit','Railway','PO No','Transporter','Delivery Date','Status','Actions'].map(h => (
                  <th key={h} className="px-3 py-3 text-left font-bold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => {
                const isNew = !!row._isNew; const hasEdit = !isNew && !!edits[row.id]; const status = getStatus(row);
                const rowBg = saved === row.id ? 'bg-emerald-50' : isNew ? 'bg-blue-50/50' : hasEdit ? 'bg-violet-50/50' : status === 'pending' ? 'bg-amber-50/30' : 'bg-white/60 hover:bg-white/90';
                return (
                  <tr key={row.id} className={`border-b border-outline-variant/10 transition-colors ${rowBg}`}>
                    <td className="px-3 py-2 text-outline">{i + 1}</td>
                    <td className="px-3 py-2"><span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[10px] font-bold">{row.type || '—'}</span></td>
                    <td className="px-3 py-2 font-mono text-outline text-[10px]">{row.plNo || '—'}</td>
                    <td className="px-3 py-2 font-medium">{row.material || '—'}</td>
                    <td className="px-3 py-2 font-data-mono font-bold text-primary">{row.qty}</td>
                    <td className="px-3 py-2 text-outline">{row.unit}</td>
                    <td className="px-3 py-2 text-outline">{(row as any).railway || '—'}</td>
                    <td className="px-3 py-2 font-mono text-[10px]">{(row as any).poNo || '—'}</td>
                    <td className="px-3 py-2">{(row as any).transporter || '—'}</td>
                    <td className="px-3 py-2 text-outline text-[10px]">{row.deliveryDate?.toString() || <span className="text-amber-500 font-bold">Not delivered</span>}</td>
                    <td className="px-3 py-2"><StatusBadge status={status} />{saved === row.id && <span className="ml-1 text-[9px] text-emerald-600 font-bold">Saved!</span>}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <button onClick={() => { setEditingId(row.id); setEditBuf({ ...row }); }} className="w-7 h-7 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 flex items-center justify-center"><span className="material-symbols-outlined text-[16px]">edit</span></button>
                        {(isNew || hasEdit) && <button onClick={() => { if (isNew) { setExtras(p => { const n = p.filter(r => r.id !== row.id); saveExtra('wta', n); return n; }); } else { const ne = { ...edits }; delete ne[row.id]; setEdits(ne); saveEdits('wta', ne); } }} className="w-7 h-7 rounded-lg bg-red-100 hover:bg-red-200 text-red-600 flex items-center justify-center"><span className="material-symbols-outlined text-[16px]">{isNew ? 'delete' : 'restart_alt'}</span></button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={12} className="px-4 py-10 text-center text-outline italic">Koi record nahi mila</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2.5 bg-surface-container-low/50 border-t border-outline-variant/10 flex justify-between"><p className="text-xs text-outline">{filtered.length} of {allRows.length}</p></div>
      </div>
    </div>
  );
}

// ─── M&P Tab ─────────────────────────────────────────────────────────────────

function MPTab() {
  const base = mcrData.mAndPItem as MPRow[];
  const [extras, setExtras] = useState<MPRow[]>(() => loadExtra<MPRow>('mp'));
  const [edits, setEdits] = useState<Record<string, Partial<MPRow>>>(() => loadEdits('mp'));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBuf, setEditBuf] = useState<Partial<MPRow>>({});
  const [search, setSearch] = useState('');
  const [saved, setSaved] = useState<string | null>(null);

  const allRows = useMemo(() => [...base.map(r => ({ ...r, ...(edits[r.id] || {}) })), ...extras], [edits, extras]);
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allRows.filter(r => !q || (r.material || '').toLowerCase().includes(q) || (r.lotNo || '').toLowerCase().includes(q) || (r.purchaser || '').toLowerCase().includes(q));
  }, [allRows, search]);

  const saveEdit = (row: MPRow) => {
    if (row._isNew) { setExtras(prev => { const n = prev.map(r => r.id === row.id ? { ...r, ...editBuf } : r); saveExtra('mp', n); return n; }); }
    else { const ne = { ...edits, [row.id]: editBuf }; setEdits(ne); saveEdits('mp', ne); }
    setEditingId(null); setSaved(row.id); setTimeout(() => setSaved(null), 2000);
  };

  const fields: { key: string; label: string; placeholder?: string; type?: string }[] = [
    { key: 'type', label: 'Type' }, { key: 'plNo', label: 'PL No' }, { key: 'material', label: 'Material' },
    { key: 'qty', label: 'Qty', type: 'number' }, { key: 'unit', label: 'Unit' }, { key: 'scrNo', label: 'SCR No' },
    { key: 'date', label: 'Condn Date' }, { key: 'eAuctionDate', label: 'Auction Date' },
    { key: 'lotNo', label: 'Lot No' }, { key: 'purchaser', label: 'Purchaser' }, { key: 'deliveryDate', label: 'Delivery Date' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-outline text-[18px]">search</span>
          <input className="w-full pl-9 pr-4 py-2.5 rounded-xl glass-input text-sm focus:outline-none" placeholder="Material, lot no, purchaser..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={() => { const nr = emptyMP(); setExtras(p => { const n = [...p, nr]; saveExtra('mp', n); return n; }); setTimeout(() => { setEditingId(nr.id); setEditBuf({ ...nr }); }, 100); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-700 text-white text-sm font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all whitespace-nowrap">
          <span className="material-symbols-outlined text-[18px]">add</span>Add Row
        </button>
      </div>
      {editingId && (() => {
        const row = allRows.find(r => r.id === editingId); if (!row) return null;
        return (
          <div className="bg-violet-50 border-2 border-violet-300 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-violet-700 flex items-center gap-2"><span className="material-symbols-outlined text-[20px]">edit_note</span>Edit M&P Row</h4>
              <div className="flex gap-2">
                <button onClick={() => saveEdit(row)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-bold"><span className="material-symbols-outlined text-[18px]">save</span>Save</button>
                <button onClick={() => setEditingId(null)} className="px-4 py-2 rounded-xl border text-sm text-on-surface-variant">Cancel</button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {fields.map(f => (
                <div key={f.key} className="space-y-1">
                  <label className="text-[10px] font-bold text-outline uppercase tracking-wider">{f.label}</label>
                  <input type={f.type || 'text'} value={(editBuf as any)[f.key] ?? ''} onChange={e => setEditBuf(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full bg-white border border-violet-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
                </div>
              ))}
            </div>
          </div>
        );
      })()}
      <div className="rounded-2xl border border-outline-variant/20 overflow-hidden shadow-sm">
        <div className="overflow-x-auto max-h-[55vh] overflow-y-auto">
          <table className="w-full text-xs border-collapse" style={{ minWidth: 1100 }}>
            <thead className="sticky top-0 z-10">
              <tr className="bg-violet-700 text-white">
                {['#','Type','PL No','Material','Qty','Unit','SCR No','Condn Date','Auction Date','Lot No','Purchaser','Delivery Date','Status','Actions'].map(h => (
                  <th key={h} className="px-3 py-3 text-left font-bold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => {
                const isNew = !!row._isNew; const hasEdit = !isNew && !!edits[row.id]; const status = getStatus(row);
                const rowBg = saved === row.id ? 'bg-emerald-50' : isNew ? 'bg-blue-50/50' : hasEdit ? 'bg-violet-50/50' : status === 'pending' ? 'bg-amber-50/30' : 'bg-white/60 hover:bg-white/90';
                return (
                  <tr key={row.id} className={`border-b border-outline-variant/10 transition-colors ${rowBg}`}>
                    <td className="px-3 py-2 text-outline">{i + 1}</td>
                    <td className="px-3 py-2"><span className="px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded text-[10px] font-bold">{row.type || '—'}</span></td>
                    <td className="px-3 py-2 font-mono text-outline text-[10px]">{row.plNo || '—'}</td>
                    <td className="px-3 py-2 font-medium max-w-[200px] truncate">{row.material || '—'}</td>
                    <td className="px-3 py-2 font-data-mono font-bold text-primary">{row.qty}</td>
                    <td className="px-3 py-2 text-outline">{row.unit}</td>
                    <td className="px-3 py-2 font-mono text-[10px] text-outline">{row.scrNo || '—'}</td>
                    <td className="px-3 py-2 text-outline">{row.date || '—'}</td>
                    <td className="px-3 py-2 text-violet-700 font-medium">{row.eAuctionDate || '—'}</td>
                    <td className="px-3 py-2 font-mono font-bold text-[10px]">{row.lotNo || '—'}</td>
                    <td className="px-3 py-2 max-w-[130px] truncate">{row.purchaser || <span className="text-outline/40">—</span>}</td>
                    <td className="px-3 py-2 text-outline text-[10px]">{row.deliveryDate?.toString() || <span className="text-amber-500 font-bold">Not delivered</span>}</td>
                    <td className="px-3 py-2"><StatusBadge status={status} />{saved === row.id && <span className="ml-1 text-[9px] text-emerald-600 font-bold">Saved!</span>}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <button onClick={() => { setEditingId(row.id); setEditBuf({ ...row }); }} className="w-7 h-7 rounded-lg bg-violet-50 hover:bg-violet-100 text-violet-700 flex items-center justify-center"><span className="material-symbols-outlined text-[16px]">edit</span></button>
                        {(isNew || hasEdit) && <button onClick={() => { if (isNew) { setExtras(p => { const n = p.filter(r => r.id !== row.id); saveExtra('mp', n); return n; }); } else { const ne = { ...edits }; delete ne[row.id]; setEdits(ne); saveEdits('mp', ne); } }} className="w-7 h-7 rounded-lg bg-red-100 hover:bg-red-200 text-red-600 flex items-center justify-center"><span className="material-symbols-outlined text-[16px]">{isNew ? 'delete' : 'restart_alt'}</span></button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={14} className="px-4 py-10 text-center text-outline italic">Koi record nahi mila</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2.5 bg-surface-container-low/50 border-t border-outline-variant/10 flex justify-between"><p className="text-xs text-outline">{filtered.length} of {allRows.length}</p></div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type TabId = 'lot' | 'coach' | 'wta' | 'mp';

const TABS: { id: TabId; label: string; icon: string; count: number }[] = [
  { id: 'lot', label: 'Lot Material', icon: 'inventory_2', count: (mcrData.lotMaterialPosition as any[]).length },
  { id: 'coach', label: 'Coach', icon: 'train', count: (mcrData.coachPosition as any[]).length },
  { id: 'wta', label: 'WTA', icon: 'local_shipping', count: (mcrData.wtaPosition as any[]).length },
  { id: 'mp', label: 'M&P', icon: 'precision_manufacturing', count: (mcrData.mAndPItem as any[]).length },
];

const tabColors: Record<TabId, string> = {
  lot: 'from-blue-600 to-primary',
  coach: 'from-indigo-600 to-violet-600',
  wta: 'from-emerald-600 to-teal-600',
  mp: 'from-violet-600 to-purple-700',
};

export function McrView() {
  const [activeTab, setActiveTab] = useState<TabId>('lot');

  return (
    <div className="animate-fade-in space-y-6 max-w-[1440px]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end gap-4 justify-between">
        <div>
          <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1", fontSize: '32px' }}>description</span>
            Material Condemnation Report
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            MCR data — Pencil icon se koi bhi row edit karo | Naya row add karo | Changes browser mein save hote hain
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center text-xs">
          {[
            { dot: 'bg-primary/20', label: 'Original data' },
            { dot: 'bg-violet-200', label: 'Edited row' },
            { dot: 'bg-blue-200', label: 'Manually added' },
          ].map(l => (
            <span key={l.label} className="flex items-center gap-1.5 text-outline">
              <span className={`w-3 h-3 rounded-full ${l.dot} border border-outline-variant/30`}></span>{l.label}
            </span>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 px-5 py-3 rounded-xl font-label-md text-label-md font-bold transition-all duration-200 whitespace-nowrap border ${
                  isActive
                    ? `bg-gradient-to-r ${tabColors[tab.id]} text-white border-transparent shadow-md -translate-y-0.5`
                    : 'glass-input text-on-surface-variant border-outline-variant/30 hover:text-on-surface hover:border-primary/30'
                }`}>
                <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}>{tab.icon}</span>
                {tab.label}
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${isActive ? 'bg-white/25 text-white' : 'bg-primary/10 text-primary'}`}>{tab.count}+</span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 glass-panel rounded-2xl p-5 shadow-sm">
          {activeTab === 'lot' && <LotTab />}
          {activeTab === 'coach' && <CoachTab />}
          {activeTab === 'wta' && <WtaTab />}
          {activeTab === 'mp' && <MPTab />}
        </div>
      </div>

      {/* Help note */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
        <span className="material-symbols-outlined text-blue-500 text-[20px] mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>tips_and_updates</span>
        <div>
          <p className="font-bold mb-1">💡 Kaise use karein?</p>
          <ul className="space-y-0.5 text-xs list-disc list-inside text-blue-700">
            <li><strong>✏️ Pencil button</strong> dabao kisi bhi row pe — edit panel khulega neeche</li>
            <li>Sab fields fill karo → <strong>Save button</strong> dabao → row update hoga aur <span className="text-violet-600 font-bold">purple highlight</span> mein dikhega</li>
            <li><strong>+ Add Row</strong> se naya row add karo (blank) — fir edit karo</li>
            <li><strong>↺ Revert</strong> button se edited row original ho jaayega</li>
            <li>Yahan se save kiye data ko <strong>Outward Entry</strong> mein material/lot name se search kar sako</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ─── Export for OutwardEntry suggestions ─────────────────────────────────────

export interface McrLotSuggestion {
  id: string;
  lotNo: string | null;
  material: string;
  qty: number | string;
  unit: string;
  purchaser: string | null;
  eAuctionDate: string | null;
  deliveryDate: string | null;
  status: RowStatus;
  scrNo: string | null;
  plNo?: string | null;
  section: 'lot' | 'mp';
}

export function getMcrLots(): McrLotSuggestion[] {
  const lotBase = mcrData.lotMaterialPosition as LotRow[];
  const mpBase = mcrData.mAndPItem as MPRow[];

  const lotEdits = loadEdits('lot');
  const mpEdits = loadEdits('mp');
  const extraLot = loadExtra<LotRow>('lot');
  const extraMp = loadExtra<MPRow>('mp');

  const lotRows = [...lotBase.map(r => ({ ...r, ...(lotEdits[r.id] || {}) })), ...extraLot];
  const mpRows = [...mpBase.map(r => ({ ...r, ...(mpEdits[r.id] || {}) })), ...extraMp];

  const toSuggestion = (r: LotRow | MPRow, section: 'lot' | 'mp'): McrLotSuggestion => ({
    id: r.id,
    lotNo: r.lotNo ?? null,
    material: r.material,
    qty: r.qty,
    unit: r.unit,
    purchaser: r.purchaser ?? null,
    eAuctionDate: (r as any).eAuctionDate ?? null,
    deliveryDate: r.deliveryDate ?? null,
    status: getStatus(r),
    scrNo: (r as any).scrNo ?? null,
    plNo: (r as any).plNo ?? null,
    section,
  });

  return [
    ...lotRows.map(r => toSuggestion(r, 'lot')),
    ...mpRows.map(r => toSuggestion(r, 'mp')),
  ];
}
