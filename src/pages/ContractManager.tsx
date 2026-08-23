import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import ReactDOM from "react-dom";
import {
  Plus, Upload, Download, Search, Edit3, Trash2, X, ChevronRight,
  Truck, Users, Calendar, AlertTriangle, CheckCircle2, TrendingDown,
  Copy, ArrowLeft, Archive, FileWarning, Gauge, Clock, UserPlus, Save,
  Printer, Clipboard, ChevronsDown, Zap, Cloud, CloudOff, Loader2
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell
} from "recharts";
import { exportToExcel, exportToPDF } from "../utils/exportUtils";
import { PrintTemplate } from "../components/PrintTemplate";
function Portal({ children }: { children: React.ReactNode }) {
  return ReactDOM.createPortal(children, document.body);
}

/* =========================================================================
   API BASE
   ========================================================================= */
const API_BASE = import.meta.env.PROD ? "/api" : "http://localhost:5001/api";

async function apiFetch(endpoint: string, options?: RequestInit) {
  const token = sessionStorage.getItem("token");
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: { 
      "Content-Type": "application/json", 
      ...(token ? { "Authorization": `Bearer ${token}` } : {}),
      ...options?.headers 
    },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json();
}

const contractsApi = {
  getAll: (): Promise<any[]> => apiFetch("/contracts"),
  save: (c: any) => apiFetch("/contracts", { method: "POST", body: JSON.stringify(c) }),
  update: (id: string, c: any) => apiFetch(`/contracts/${id}`, { method: "PUT", body: JSON.stringify(c) }),
  delete: (id: string) => apiFetch(`/contracts/${id}`, { method: "DELETE" }),
  batchUpsert: (contracts: any[]) =>
    apiFetch("/contracts/batch", { method: "POST", body: JSON.stringify({ contracts }) }),
};

/* =========================================================================
   HELPERS
   ========================================================================= */
import { uid, MONTH_NAMES, daysInMonth, recalcEquipmentMonth, recalcManpowerMonth } from '../utils/contractUtils';
import { EquipmentDetail } from '../components/ContractManager/EquipmentDetail';
import { ManpowerDetail } from '../components/ContractManager/ManpowerDetail';
import { ImportModal } from '../components/ContractManager/ImportModal';
import { SyncBadge } from '../components/ContractManager/SyncBadge';
import { ContractFormModal } from '../components/ContractManager/ContractFormModal';

/* =========================================================================
   TOAST
   ========================================================================= */
function Toast({ toast }: { toast: { msg: string; type: string } | null }) {
  if (!toast) return null;
  const isErr = toast.type === "error";
  return (
    <div className={`fixed bottom-6 right-6 z-[9999] flex items-center gap-2 rounded-xl px-4 py-3 shadow-lg border text-sm font-medium
      ${isErr ? "bg-rose-50 border-rose-200 text-rose-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
      {isErr ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
      {toast.msg}
    </div>
  );
}

/* =========================================================================
   STAT CARD
   ========================================================================= */
function StatCard({ icon, label, value, sub, tone = "blue" }: any) {
  const tones: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    emerald: "bg-emerald-50 text-emerald-600",
    indigo: "bg-indigo-50 text-indigo-600",
    rose: "bg-rose-50 text-rose-600",
    amber: "bg-amber-50 text-amber-600",
  };
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex-1 min-w-[200px]">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold tracking-wide text-gray-400 uppercase">{label}</span>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${tones[tone]}`}>{icon}</div>
      </div>
      <div className="text-2xl font-bold text-gray-800">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

/* =========================================================================
   CONTRACT CARD
   ========================================================================= */
function ContractCard({ c, onOpen, onEdit, onArchive, onDuplicate, onDelete }: any) {
  const isEquip = c.type === "equipment";
  const lastMonth = c.months[c.months.length - 1];
  let remaining = null, pct = null;
  if (isEquip && lastMonth) {
    const r = recalcEquipmentMonth(lastMonth, c.timeMode);
    remaining = r.remaining;
    pct = c.sanctionedQty ? Math.max(0, Math.min(100, (remaining / c.sanctionedQty) * 100)) : null;
  }
  const low = pct !== null && pct < 15;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow group">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isEquip ? "bg-blue-50 text-blue-600" : "bg-indigo-50 text-indigo-600"}`}>
            {isEquip ? <Truck size={18} /> : <Users size={18} />}
          </div>
          <div>
            <div className="font-semibold text-gray-800 leading-tight">{c.name}</div>
            <div className="text-xs text-gray-400">{c.firm || "—"} {c.loaNo ? `· LOA ${c.loaNo}` : ""}</div>
          </div>
        </div>
        <span className={`text-[10px] px-2 py-1 rounded-full font-semibold uppercase tracking-wide
          ${c.status === "active" ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-400"}`}>
          {c.status}
        </span>
      </div>

      {isEquip ? (
        <div className="mt-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Remaining {c.unit}</span>
            <span className="font-semibold text-gray-700">{remaining ?? "—"} / {c.sanctionedQty ?? "—"}</span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div className={`h-full rounded-full ${low ? "bg-rose-400" : "bg-blue-500"}`} style={{ width: `${pct ?? 0}%` }} />
          </div>
          {low && <div className="flex items-center gap-1 text-[11px] text-rose-500 mt-1"><TrendingDown size={12}/>running low</div>}
        </div>
      ) : (
        <div className="mt-4 text-xs text-gray-500">
          {lastMonth ? `${lastMonth.workers.length} workers · ${lastMonth.label}` : "No entries yet"}
        </div>
      )}

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-50">
        <button onClick={() => onOpen(c.id)} className="text-sm font-medium text-blue-600 flex items-center gap-1 hover:gap-1.5 transition-all">
          Open <ChevronRight size={14} />
        </button>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(c.id)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400" title="Edit"><Edit3 size={14} /></button>
          <button onClick={() => onDuplicate(c.id)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400" title="Duplicate"><Copy size={14} /></button>
          <button onClick={() => onArchive(c.id)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400" title="Archive"><Archive size={14} /></button>
          <button onClick={() => onDelete(c.id)} className="p-1.5 rounded-lg hover:bg-rose-50 text-gray-300 hover:text-rose-500" title="Delete"><Trash2 size={14} /></button>
        </div>
      </div>
    </div>
  );
}


/* =========================================================================
function SyncBadge({ syncing, error }: { syncing: boolean; error: boolean }) {
  if (syncing) return (
    <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
      <Loader2 size={11} className="animate-spin" /> Saving...
    </span>
  );
  if (error) return (
    <span className="flex items-center gap-1 text-xs text-rose-600 bg-rose-50 px-2 py-1 rounded-full">
      <CloudOff size={11} /> Save failed
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
      <Cloud size={11} /> Saved
    </span>
  );
}

/* =========================================================================
   MAIN PAGE
   ========================================================================= */
export function ContractManager() {
  const [contracts, setContracts] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [modal, setModal] = useState<any>(null);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [showImport, setShowImport] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState(false);
  const saveTimers = useRef<Record<string, any>>({});
  const contractsRef = useRef<any[]>([]);

  useEffect(() => { contractsRef.current = contracts; }, [contracts]);

  const notify = (msg: string, type = "success") => {
    setToast({ msg, type });
    clearTimeout((notify as any)._t);
    (notify as any)._t = setTimeout(() => setToast(null), 3000);
  };

  // Load from MongoDB on mount
  useEffect(() => {
    contractsApi.getAll()
      .then(data => {
        setContracts(data && data.length > 0 ? data : []);
        setLoaded(true);
      })
      .catch(() => {
        try {
          const val = localStorage.getItem("contracts-data");
          if (val) setContracts(JSON.parse(val));
        } catch {}
        setLoaded(true);
        notify("Offline mode — server se connect nahi hua", "error");
      });
  }, []);

  // Debounced save to MongoDB
  const saveContractToDb = useCallback((contract: any) => {
    const id = contract.id;
    if (saveTimers.current[id]) clearTimeout(saveTimers.current[id]);
    saveTimers.current[id] = setTimeout(async () => {
      setSyncing(true); setSyncError(false);
      try {
        await contractsApi.update(id, contract);
        setSyncing(false);
        try { localStorage.setItem("contracts-data", JSON.stringify(contractsRef.current)); } catch {}
      } catch {
        setSyncing(false); setSyncError(true);
        setTimeout(() => setSyncError(false), 4000);
      }
    }, 700);
  }, []);

  const updateContract = (id: string, fn: (c: any) => any) => {
    setContracts(prev => prev.map(c => {
      if (c.id !== id) return c;
      const updated = fn(c);
      saveContractToDb(updated);
      return updated;
    }));
  };

  const saveNewContract = async (form: any) => {
    const contract = {
      id: uid(), status: "active", vehicles: [], months: [], ...form,
      sanctionedQty: form.sanctionedQty ? +form.sanctionedQty : null,
    };
    setSyncing(true);
    try {
      await contractsApi.save(contract);
      setSyncing(false);
    } catch { setSyncing(false); setSyncError(true); setTimeout(() => setSyncError(false), 4000); }
    setContracts(prev => [...prev, contract]);
    setModal(null);
    setOpenId(contract.id);
    notify("Contract ban gaya ✓");
  };

  const saveEditContract = async (form: any) => {
    const existing = contracts.find(c => c.id === form.id);
    const updated = { ...existing, ...form, sanctionedQty: form.sanctionedQty ? +form.sanctionedQty : null };
    setContracts(prev => prev.map(c => c.id === form.id ? updated : c));
    setModal(null);
    notify("Contract update ho gaya");
    try { await contractsApi.update(form.id, updated); } catch { setSyncError(true); setTimeout(() => setSyncError(false), 4000); }
  };

  const duplicateContract = async (id: string) => {
    const c = contracts.find(x => x.id === id);
    if (!c) return;
    const copy = { ...c, id: uid(), name: `${c.name} (Renewal)`, months: [] };
    setContracts(prev => [...prev, copy]);
    notify("Renewal ke liye duplicate ho gaya");
    try { await contractsApi.save(copy); } catch {}
  };

  const archiveContract = async (id: string) => {
    const c = contracts.find(x => x.id === id);
    if (!c) return;
    const updated = { ...c, status: c.status === "active" ? "completed" : "active" };
    setContracts(prev => prev.map(x => x.id === id ? updated : x));
    try { await contractsApi.update(id, updated); } catch {}
  };

  const deleteContract = async (id: string) => {
    if (!window.confirm("Is contract ko permanently delete karo?")) return;
    setContracts(prev => prev.filter(c => c.id !== id));
    try { await contractsApi.delete(id); notify("Contract delete ho gaya"); }
    catch { notify("Delete fail hua server pe", "error"); }
  };

  const handleImport = async (incoming: any[], mode: string) => {
    if (mode === "replace") {
      setContracts(incoming);
      try {
        for (const c of contractsRef.current) { try { await contractsApi.delete(c.id); } catch {} }
        await contractsApi.batchUpsert(incoming);
        notify(`${incoming.length} contracts replace ho gaye`);
      } catch { notify(`${incoming.length} contracts replace ho gaye (server fail)`, "error"); }
    } else {
      setContracts(prev => {
        const map = new Map(prev.map(c => [c.id, c]));
        incoming.forEach(c => {
          const existing = map.get(c.id) as any;
          if (existing) {
            const existingMonthIds = new Set((existing.months || []).map((m: any) => m.id));
            const newMonths = (c.months || []).filter((m: any) => !existingMonthIds.has(m.id));
            map.set(c.id, { ...existing, ...c, months: [...(existing.months || []), ...newMonths] });
          } else {
            map.set(c.id, c);
          }
        });
        return Array.from(map.values());
      });
      try {
        await contractsApi.batchUpsert(incoming);
        notify(`${incoming.length} contracts merge ho gaye`);
      } catch { notify(`Merge ho gaye (server fail)`, "error"); }
    }
    setShowImport(false);
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ contracts }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `contracts-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); URL.revokeObjectURL(url);
    notify("JSON export ho gaya");
  };

  const openContract = contracts.find(c => c.id === openId);

  const filtered = contracts.filter(c => {
    const matchesSearch = (c.name + c.firm + c.loaNo).toLowerCase().includes(search.toLowerCase());
    const matchesType = filterType === "all" || c.type === filterType;
    return matchesSearch && matchesType;
  });

  const stats = useMemo(() => {
    const equip = contracts.filter(c => c.type === "equipment" && c.status === "active");
    const manp = contracts.filter(c => c.type === "manpower" && c.status === "active");
    let lowCount = 0;
    equip.forEach(c => {
      const last = c.months.at(-1);
      if (last) { const { remaining } = recalcEquipmentMonth(last, c.timeMode); if (c.sanctionedQty && remaining / c.sanctionedQty < 0.15) lowCount++; }
    });
    let avgAttendance: number | null = null;
    if (manp.length) {
      let p = 0, a = 0;
      manp.forEach(c => { const last = c.months.at(-1); if (last) { const r = recalcManpowerMonth(last); p += r.totalPresent; a += r.totalAbsent; } });
      avgAttendance = p + a > 0 ? Math.round((p / (p + a)) * 100) : null;
    }
    return { total: contracts.length, equipCount: equip.length, manpCount: manp.length, lowCount, avgAttendance };
  }, [contracts]);

  if (!loaded) return (
    <div className="p-10 text-center text-gray-400 text-sm flex flex-col items-center gap-3">
      <Loader2 size={28} className="animate-spin text-blue-400" />
      Loading contracts from MongoDB…
    </div>
  );

  /* ---- DETAIL VIEW ---- */
  if (openContract) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 font-sans print:bg-white print:p-0">
        <div className="flex items-center justify-between mb-4 print:hidden">
          <button onClick={() => setOpenId(null)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft size={14} /> Back to Contracts
          </button>
          <SyncBadge syncing={syncing} error={syncError} />
        </div>

        <div className="flex flex-wrap items-start justify-between gap-3 mb-6 print:hidden">
          <div>
            <div className="flex items-center gap-2">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${openContract.type === "equipment" ? "bg-blue-50 text-blue-600" : "bg-indigo-50 text-indigo-600"}`}>
                {openContract.type === "equipment" ? <Truck size={16} /> : <Users size={16} />}
              </div>
              <h1 className="text-xl font-bold text-gray-800">{openContract.name}</h1>
            </div>
            <p className="text-sm text-gray-400 mt-1">
              {openContract.firm}{openContract.loaNo ? ` · LOA ${openContract.loaNo}` : ""}{openContract.loaDate ? ` (${openContract.loaDate})` : ""}
            </p>
            {openContract.natureOfWork && <p className="text-xs text-gray-400 max-w-2xl mt-0.5">{openContract.natureOfWork}</p>}
          </div>
          <button onClick={() => setModal({ mode: "edit", contract: openContract })}
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50">
            <Edit3 size={14} /> Edit Details
          </button>
        </div>

        {openContract.type === "equipment"
          ? <EquipmentDetail key={openContract.id} contract={openContract} update={(fn: any) => updateContract(openContract.id, fn)} notify={notify} />
          : <ManpowerDetail key={openContract.id} contract={openContract} update={(fn: any) => updateContract(openContract.id, fn)} notify={notify} />}

        {modal?.mode === "edit" && (
          <ContractFormModal initial={modal.contract} onClose={() => setModal(null)} onSave={saveEditContract} />
        )}
        <Toast toast={toast} />
      </div>
    );
  }

  /* ---- LIST / DASHBOARD VIEW ---- */
  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Contracts</h1>
          <p className="text-sm text-gray-400">Equipment hire aur manpower contracts — MongoDB mein safe, kabhi nahi jayenge.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SyncBadge syncing={syncing} error={syncError} />
          <button onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50">
            <Upload size={14} /> Import JSON
          </button>
          <button onClick={exportJson}
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50">
            <Download size={14} /> Export JSON
          </button>
          <button onClick={() => setModal({ mode: "new" })}
            className="flex items-center gap-1.5 text-sm font-semibold px-3.5 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">
            <Plus size={15} /> New Contract
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 mb-6">
        <StatCard icon={<FileWarning size={16} />} label="Total Contracts" value={stats.total} tone="blue" />
        <StatCard icon={<Truck size={16} />} label="Equipment Active" value={stats.equipCount} tone="indigo" />
        <StatCard icon={<Users size={16} />} label="Manpower Active" value={stats.manpCount} tone="emerald" />
        <StatCard icon={<AlertTriangle size={16} />} label="Running Low" value={stats.lowCount} tone="rose" />
        <StatCard icon={<Gauge size={16} />} label="Avg. Attendance" value={stats.avgAttendance !== null ? `${stats.avgAttendance}%` : "—"} tone="amber" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search contract, firm, LOA..."
            className="pl-8 pr-3 py-2 text-sm rounded-lg border border-gray-200 w-64 focus:outline-none focus:ring-2 focus:ring-blue-200" />
        </div>
        <div className="flex gap-1.5">
          {[["all", "All"], ["equipment", "Equipment"], ["manpower", "Manpower"]].map(([v, l]) => (
            <button key={v} onClick={() => setFilterType(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${filterType === v ? "bg-gray-800 text-white" : "bg-white border border-gray-200 text-gray-500"}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
          <FileWarning className="mx-auto text-gray-300 mb-3" size={28} />
          <p className="text-sm text-gray-500 mb-4">Koi contract nahi mila. Naya banao ya JSON import karo.</p>
          <button onClick={() => setModal({ mode: "new" })} className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">
            + New Contract
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => (
            <ContractCard key={c.id} c={c} onOpen={setOpenId}
              onEdit={(id: string) => setModal({ mode: "edit", contract: contracts.find(x => x.id === id) })}
              onArchive={archiveContract} onDuplicate={duplicateContract} onDelete={deleteContract} />
          ))}
        </div>
      )}

      {modal?.mode === "new" && <ContractFormModal onClose={() => setModal(null)} onSave={saveNewContract} />}
      {modal?.mode === "edit" && <ContractFormModal initial={modal.contract} onClose={() => setModal(null)} onSave={saveEditContract} />}
      {showImport && <ImportModal onClose={() => setShowImport(false)} onImport={handleImport} notify={notify} />}
      <Toast toast={toast} />
    </div>
  );
}
