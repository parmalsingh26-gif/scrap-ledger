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
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
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
const uid = () => Math.random().toString(36).slice(2, 10);
const MONTH_NAMES = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
const daysInMonth = (year: number, monthIdx: number) => new Date(year, monthIdx + 1, 0).getDate();

const toMinutes = (t: string) => {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
};

const hoursBetween = (inT: string, outT: string) => {
  const a = toMinutes(inT), b = toMinutes(outT);
  if (a === null || b === null) return 0;
  let diff = b - a;
  if (diff < 0) diff += 24 * 60;
  return +(diff / 60).toFixed(2);
};

const entryHours = (e: any, timeMode: string) => {
  if (timeMode === "split") {
    return +(hoursBetween(e.inTime, e.outTime) + hoursBetween(e.inTime2, e.outTime2)).toFixed(2);
  }
  return hoursBetween(e.inTime, e.outTime);
};

const entryNetHours = (e: any, timeMode: string, restMinsPerEntry: number) => {
  const gross = entryHours(e, timeMode);
  const deduct = e.noRest ? 0 : restMinsPerEntry;
  return +(Math.max(0, gross - deduct / 60)).toFixed(2);
};

function recalcEquipmentMonth(month: any, timeMode: string) {
  const restMins = month.restMins ?? 0;
  const used = +month.entries.reduce((s: number, e: any) => s + entryNetHours(e, timeMode, restMins), 0).toFixed(2);
  const remaining = +(month.previousRemaining - used).toFixed(2);
  return { used, remaining };
}

function attendanceCount(worker: any, symbol: string) {
  return Object.values(worker.attendance || {}).filter(
    (v: any) => (v || "").toUpperCase() === symbol
  ).length;
}

function recalcManpowerMonth(month: any) {
  const perDay: Record<number, number> = {};
  for (let d = 1; d <= month.totalDays; d++) {
    if (month.sundays?.includes(d) || month.holidays?.includes(d)) { perDay[d] = 0; continue; }
    perDay[d] = month.workers.reduce(
      (s: number, w: any) => s + ((w.attendance[d] || "").toUpperCase() === "P" ? 1 : 0), 0
    );
  }
  const totalPresent = month.workers.reduce((s: number, w: any) => s + attendanceCount(w, "P"), 0);
  const totalAbsent = month.workers.reduce((s: number, w: any) => s + attendanceCount(w, "A"), 0);
  return { perDay, totalPresent, totalAbsent };
}

const cellStyle: Record<string, string> = {
  P: "bg-emerald-50 text-emerald-700 border-emerald-200",
  A: "bg-rose-50 text-rose-600 border-rose-200",
  SUNDAY: "bg-gray-100 text-gray-400 border-gray-200",
  HOLIDAY: "bg-amber-50 text-amber-600 border-amber-200",
  "": "bg-white text-gray-300 border-gray-200",
};
const cellShort: Record<string, string> = { P: "P", A: "A", SUNDAY: "S", HOLIDAY: "H", "": "" };
const cycleOrder = ["", "P", "A", "SUNDAY", "HOLIDAY"];

const AI_ATTENDANCE_PROMPT = `You are generating attendance data for a contract management system.
Output ONLY valid JSON — an array of worker objects.

Each object = one worker with this structure:
{
  "name": "WORKER NAME IN CAPS",
  "1": "P", "2": "P", "3": "A", "4": "SUNDAY", ...
}

Day values must be one of: P (Present), A (Absent), SUNDAY, HOLIDAY

Rules:
- All Sundays → "SUNDAY"
- Government holidays → "HOLIDAY"
- Working days where present → "P"
- Working days where absent → "A"
- Days not yet occurred → omit or leave ""
- Worker names must be IN CAPITAL LETTERS

If data has many workers (>15), output in 2 parts:
  Part 1: workers 1–15 as a JSON array
  Part 2: workers 16–end as a JSON array
Each part is valid JSON. The system will import both parts and merge them correctly.

Example output:
[
  { "name": "RAMESH KUMAR", "1": "P", "2": "P", "3": "A", "4": "SUNDAY", "5": "P" },
  { "name": "SURESH LAL", "1": "P", "2": "A", "3": "P", "4": "SUNDAY", "5": "P" }
]`;

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
   CONTRACT FORM MODAL
   ========================================================================= */
function ContractFormModal({ initial, onClose, onSave }: any) {
  const isEdit = !!initial;
  const [form, setForm] = useState(
    initial || { type: "equipment", name: "", firm: "", loaNo: "", loaDate: "",
      natureOfWork: "", unit: "Hrs", timeMode: "single", sanctionedQty: "" }
  );
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  return (
    <Portal>
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(17, 24, 39, 0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
        <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', width: '100%', maxWidth: '600px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">{isEdit ? "Edit Contract" : "New Contract"}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-4">
          {!isEdit && (
            <div>
              <label className="text-xs font-semibold text-gray-500">Contract Type</label>
              <div className="grid grid-cols-2 gap-2 mt-1.5">
                <button onClick={() => set("type", "equipment")}
                  className={`rounded-xl border-2 p-3 text-left transition-colors ${form.type === "equipment" ? "border-blue-500 bg-blue-50" : "border-gray-100"}`}>
                  <Truck size={16} className="text-blue-600 mb-1" />
                  <div className="text-sm font-semibold text-gray-700">Equipment Hire</div>
                  <div className="text-[11px] text-gray-400">JCB, Tractor, Crane...</div>
                </button>
                <button onClick={() => set("type", "manpower")}
                  className={`rounded-xl border-2 p-3 text-left transition-colors ${form.type === "manpower" ? "border-indigo-500 bg-indigo-50" : "border-gray-100"}`}>
                  <Users size={16} className="text-indigo-600 mb-1" />
                  <div className="text-sm font-semibold text-gray-700">Manpower / Attendance</div>
                  <div className="text-[11px] text-gray-400">Daily P/A register</div>
                </button>
              </div>
            </div>
          )}

          <Field label="Contract Name" value={form.name} onChange={(v: string) => set("name", v)} placeholder="e.g. JCB Hire — Auto Lift" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Firm" value={form.firm} onChange={(v: string) => set("firm", v)} placeholder="AUTO LIFT" />
            <Field label="LOA No." value={form.loaNo} onChange={(v: string) => set("loaNo", v)} placeholder="GEMC-..." />
          </div>
          <Field label="LOA Date" type="date" value={form.loaDate} onChange={(v: string) => set("loaDate", v)} />
          <Field label="Nature of Work" value={form.natureOfWork} onChange={(v: string) => set("natureOfWork", v)}
            placeholder="HIRING OF EARTH MOVING EQUIPMENT..." textarea />

          {form.type === "equipment" && (
            <div className="grid grid-cols-3 gap-3">
              <Field label="Unit" value={form.unit} onChange={(v: string) => set("unit", v)} placeholder="Hrs / Trips / MT" />
              <div>
                <label className="text-xs font-semibold text-gray-500">Time Entry Mode</label>
                <select value={form.timeMode} onChange={(e) => set("timeMode", e.target.value)}
                  className="w-full mt-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
                  <option value="single">Single Shift (In/Out)</option>
                  <option value="split">Split Shift (B/N + A/N)</option>
                </select>
              </div>
              <Field label="Sanctioned Qty" type="number" value={form.sanctionedQty} onChange={(v: string) => set("sanctionedQty", v)} placeholder="864" />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 rounded-lg">Cancel</button>
          <button
            onClick={() => onSave(form)}
            disabled={!form.name.trim()}
            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 rounded-lg flex items-center gap-1.5">
            <Save size={14} /> {isEdit ? "Save Changes" : "Create Contract"}
          </button>
        </div>
      </div>
      </div>
    </Portal>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", textarea }: any) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-500">{label}</label>
      {textarea ? (
        <textarea rows={2} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
          className="w-full mt-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-200" />
      ) : (
        <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
          className="w-full mt-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
      )}
    </div>
  );
}

/* =========================================================================
   MULTI-JSON IMPORT MODAL
   ========================================================================= */
function ImportModal({ onClose, onImport, notify }: any) {
  const [tab, setTab] = useState<"file" | "paste" | "prompt">("file");
  const [pasteSlots, setPasteSlots] = useState<string[]>(["", ""]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const [mergeMode, setMergeMode] = useState<"merge" | "replace">("merge");

  const addSlot = () => setPasteSlots(s => [...s, ""]);
  const removeSlot = (i: number) => setPasteSlots(s => s.filter((_, idx) => idx !== i));
  const updateSlot = (i: number, val: string) => setPasteSlots(s => s.map((v, idx) => idx === i ? val : v));

  const copyPrompt = () => {
    navigator.clipboard.writeText(AI_ATTENDANCE_PROMPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const withIds = (contract: any) => {
    const c = { id: contract.id || uid(), status: contract.status || "active", vehicles: contract.vehicles || [], ...contract };
    c.months = (contract.months || []).map((m: any) => {
      const month = { id: m.id || uid(), ...m };
      if (c.type === "equipment") {
        month.entries = (m.entries || []).map((en: any) => ({ id: en.id || uid(), ...en }));
      } else {
        month.workers = (m.workers || []).map((w: any) => ({ id: w.id || uid(), ...w }));
      }
      return month;
    });
    return c;
  };

  const parseJson = (raw: string): any[] | null => {
    try {
      const parsed = JSON.parse(raw.trim());
      const arr = Array.isArray(parsed) ? parsed : parsed.contracts;
      if (!Array.isArray(arr)) return null;
      return arr.map(withIds);
    } catch { return null; }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = parseJson(reader.result as string);
      if (!result) { notify("JSON file sahi format mein nahi hai", "error"); return; }
      onImport(result, mergeMode);
      onClose();
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handlePasteImport = () => {
    const allContracts: any[] = [];
    let errors = 0;
    for (const slot of pasteSlots) {
      if (!slot.trim()) continue;
      const result = parseJson(slot);
      if (!result) { errors++; continue; }
      allContracts.push(...result);
    }
    if (errors > 0) notify(`${errors} JSON(s) mein error tha — baki import ho gaye`, "error");
    if (allContracts.length > 0) { onImport(allContracts, mergeMode); onClose(); }
    else notify("Koi valid contract nahi mila pastes mein", "error");
  };

  const handleAttendancePaste = () => {
    const allWorkers: any[] = [];
    let errors = 0;
    for (const slot of pasteSlots) {
      if (!slot.trim()) continue;
      try {
        const parsed = JSON.parse(slot.trim());
        if (!Array.isArray(parsed)) { errors++; continue; }
        const workers = parsed.map((w: any, i: number) => {
          const attendance: Record<number, string> = {};
          for (let d = 1; d <= 31; d++) {
            if (w[d] !== undefined) {
              const val = String(w[d]).toUpperCase().trim();
              if (["P", "A", "SUNDAY", "HOLIDAY", "S", "H"].includes(val)) {
                attendance[d] = val === "S" ? "SUNDAY" : val === "H" ? "HOLIDAY" : val;
              }
            }
          }
          return { id: uid(), srNo: i + 1, name: (w.name || w.WorkerName || w.Name || `Worker ${i+1}`).toUpperCase(), attendance };
        });
        allWorkers.push(...workers);
      } catch { errors++; }
    }
    if (errors > 0) notify(`${errors} JSON parts mein error tha`, "error");
    if (allWorkers.length > 0) { onImport(allWorkers, "workers"); onClose(); }
    else notify("Koi worker nahi mila", "error");
  };

  return (
    <Portal>
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(17, 24, 39, 0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
        <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', width: '100%', maxWidth: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2"><Upload size={16} />Import JSON</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-6">
          {(["file", "paste", "prompt"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors capitalize ${tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-gray-400 hover:text-gray-600"}`}>
              {t === "file" ? "File Upload" : t === "paste" ? "Paste JSON" : "AI Prompt"}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Merge mode */}
          <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 mb-5">
            <span className="text-xs font-semibold text-gray-500">Import Mode:</span>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="radio" name="importmode" checked={mergeMode === "merge"} onChange={() => setMergeMode("merge")} />
              <span className="text-sm text-gray-700">Merge (existing + new, no overwrite)</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="radio" name="importmode" checked={mergeMode === "replace"} onChange={() => setMergeMode("replace")} />
              <span className="text-sm text-gray-700">Replace all</span>
            </label>
          </div>

          {tab === "file" && (
            <div className="text-center py-8">
              <input type="file" accept="application/json" ref={fileRef} className="hidden" onChange={handleFile} />
              <Upload size={32} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm text-gray-500 mb-4">Contract backup JSON file select karo</p>
              <button onClick={() => fileRef.current?.click()}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700">
                Browse File
              </button>
            </div>
          )}

          {tab === "paste" && (
            <div className="space-y-4">
              <p className="text-xs text-gray-400">
                AI se milne wale JSON yahan paste karo. Agar AI ne 2 parts mein diya ho to dono alag boxes mein paste karo — automatically merge honge.
              </p>
              {pasteSlots.map((slot, i) => (
                <div key={i} className="relative">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-400">JSON Part {i + 1}</span>
                    {pasteSlots.length > 1 && (
                      <button onClick={() => removeSlot(i)} className="text-xs text-gray-300 hover:text-rose-500"><X size={12} /></button>
                    )}
                  </div>
                  <textarea
                    rows={5}
                    value={slot}
                    onChange={(e) => updateSlot(i, e.target.value)}
                    placeholder={`JSON paste karo yahan... (Part ${i + 1})`}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"
                  />
                </div>
              ))}
              <button onClick={addSlot}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
                <Plus size={12} /> Add Another JSON Part
              </button>
              <div className="flex items-center gap-3 pt-2">
                <button onClick={handlePasteImport}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 flex items-center justify-center gap-2">
                  <Truck size={14} /> Import as Contracts
                </button>
                <button onClick={handleAttendancePaste}
                  className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 flex items-center justify-center gap-2">
                  <Users size={14} /> Import as Attendance Workers
                </button>
              </div>
              <p className="text-[10px] text-gray-400 text-center">
                "Contracts" = full backup JSON &nbsp;|&nbsp; "Attendance Workers" = AI se aaya month-wise P/A list
              </p>
            </div>
          )}

          {tab === "prompt" && (
            <div className="space-y-4">
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-indigo-800">AI ke liye Prompt</span>
                  <button onClick={copyPrompt}
                    className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${copied ? "bg-emerald-500 text-white" : "bg-indigo-600 text-white hover:bg-indigo-700"}`}>
                    {copied ? <CheckCircle2 size={12} /> : <Clipboard size={12} />}
                    {copied ? "Copied!" : "Copy Prompt"}
                  </button>
                </div>
                <pre className="text-xs text-indigo-900 whitespace-pre-wrap font-mono bg-white rounded-lg p-3 border border-indigo-100 max-h-64 overflow-y-auto">
                  {AI_ATTENDANCE_PROMPT}
                </pre>
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-xs text-amber-700 space-y-1">
                <div className="font-semibold">📋 Kaise use karein:</div>
                <div>1. Upar "Copy Prompt" karo</div>
                <div>2. ChatGPT / Claude mein paste karo</div>
                <div>3. Phir worker names aur month batao</div>
                <div>4. AI se mila JSON → "Paste JSON" tab mein paste karo</div>
                <div>5. "Import as Attendance Workers" click karo</div>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </Portal>
  );
}

/* =========================================================================
   EQUIPMENT DETAIL
   ========================================================================= */
function EquipmentDetail({ contract, update, notify }: any) {
  const [selIdx, setSelIdx] = useState(contract.months.length - 1);
  const idx = Math.min(Math.max(selIdx, 0), Math.max(contract.months.length - 1, 0));
  const month = contract.months[idx];
  const [draft, setDraft] = useState({ date: "", vehicle: contract.vehicles?.[0] || "", inTime: "", outTime: "", inTime2: "", outTime2: "", noRest: false });
  const [newVehicle, setNewVehicle] = useState("");
  const [addNCount, setAddNCount] = useState(1);

  if (!month) {
    return <EmptyMonthState onAdd={(m: any) => update((c: any) => ({ ...c, months: [m] }))} contract={contract} />;
  }

  const { used, remaining } = recalcEquipmentMonth(month, contract.timeMode);
  const restMins = month.restMins ?? 0;

  const setRestMins = (v: number) => {
    update((c: any) => ({
      ...c,
      months: c.months.map((m: any, i: number) => i === idx ? { ...m, restMins: v } : m),
    }));
  };

  const chartData = contract.months.map((m: any) => {
    const r = recalcEquipmentMonth(m, contract.timeMode);
    return { name: m.label, Used: r.used, Remaining: r.remaining };
  });

  const addEntry = () => {
    if (!draft.date || !draft.vehicle || !draft.inTime || !draft.outTime) {
      notify("Date, vehicle, in/out time bharo", "error"); return;
    }
    const hrs = entryHours(draft, contract.timeMode);
    if (hrs <= 0) { notify("Time galat hai", "error"); return; }
    const entry = { id: uid(), ...draft };
    update((c: any) => ({
      ...c,
      months: c.months.map((m: any, i: number) => i === idx ? { ...m, entries: [...m.entries, entry] } : m),
    }));
    setDraft({ date: "", vehicle: draft.vehicle, inTime: "", outTime: "", inTime2: "", outTime2: "", noRest: false });
  };

  const cloneEntryBelow = (e: any) => {
    const newEntry = { ...e, id: uid(), date: "" };
    update((c: any) => {
      const entries = [...c.months[idx].entries];
      const pos = entries.findIndex((x: any) => x.id === e.id);
      entries.splice(pos + 1, 0, newEntry);
      return { ...c, months: c.months.map((m: any, i: number) => i === idx ? { ...m, entries } : m) };
    });
  };

  const addNRowsSameAsAbove = () => {
    const last = month.entries[month.entries.length - 1];
    if (!last) { notify("Pehle ek entry daalo", "error"); return; }
    const newEntries = Array.from({ length: addNCount }, () => ({ ...last, id: uid(), date: "" }));
    update((c: any) => ({
      ...c,
      months: c.months.map((m: any, i: number) => i === idx ? { ...m, entries: [...m.entries, ...newEntries] } : m),
    }));
    notify(`${addNCount} rows add ho gaye — dates bharo`);
  };

  const fillDownTime = (field: "inTime" | "outTime" | "inTime2" | "outTime2", fromIdx: number) => {
    const val = month.entries[fromIdx]?.[field];
    if (!val) return;
    update((c: any) => ({
      ...c,
      months: c.months.map((m: any, i: number) => i !== idx ? m : {
        ...m,
        entries: m.entries.map((e: any, ei: number) => ei >= fromIdx ? { ...e, [field]: val } : e),
      }),
    }));
    notify(`${field} fill down ho gaya`);
  };

  const removeEntry = (id: string) => {
    update((c: any) => ({
      ...c,
      months: c.months.map((m: any, i: number) => i === idx ? { ...m, entries: m.entries.filter((e: any) => e.id !== id) } : m),
    }));
  };

  const addVehicle = () => {
    if (!newVehicle.trim()) return;
    update((c: any) => ({ ...c, vehicles: [...(c.vehicles || []), newVehicle.trim()] }));
    setDraft((d) => ({ ...d, vehicle: newVehicle.trim() }));
    setNewVehicle("");
  };

  const addMonth = () => {
    const last = contract.months.at(-1);
    let year = last?.year ?? new Date().getFullYear();
    let mIdx = (last?.monthIdx ?? -1) + 1;
    if (mIdx > 11) { mIdx = 0; year += 1; }
    const newMonth = {
      id: uid(), label: `${MONTH_NAMES[mIdx]} ${year}`, year, monthIdx: mIdx,
      totalDays: daysInMonth(year, mIdx),
      previousRemaining: last ? recalcEquipmentMonth(last, contract.timeMode).remaining : contract.sanctionedQty,
      entries: [],
    };
    update((c: any) => ({ ...c, months: [...c.months, newMonth] }));
    setSelIdx(contract.months.length);
    notify(`${newMonth.label} added, opening balance carried forward`);
  };

  const exportPDF = () => exportToPDF(contract, month, used, remaining);
  const exportExcel = () => exportToExcel(contract, month, used, remaining);

  return (
    <div>
      <div className="print:hidden">
      {/* Month Tabs */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {contract.months.map((m: any, i: number) => (
            <button key={m.id ?? i} onClick={() => setSelIdx(i)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap ${i === idx ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
              {m.label}
            </button>
          ))}
          <button onClick={addMonth} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-dashed border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600 flex items-center gap-1">
            <Plus size={14} /> Month
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <StatCard icon={<Gauge size={16} />} label="Opening Balance" value={`${month.previousRemaining} ${contract.unit}`} tone="blue" />
        <StatCard icon={<Clock size={16} />} label="Used This Month" value={`${used} ${contract.unit}`} tone="amber"
          sub={restMins > 0 ? `(Rest ${restMins} min/day deducted)` : undefined} />
        <StatCard icon={<TrendingDown size={16} />} label="Remaining" value={`${remaining} ${contract.unit}`}
          tone={remaining < 0 ? "rose" : "emerald"} sub={contract.sanctionedQty ? `of ${contract.sanctionedQty} sanctioned` : undefined} />
      </div>

      {/* Rest time */}
      <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 mb-4">
        <Clock size={15} className="text-amber-600 shrink-0" />
        <span className="text-sm text-amber-800 font-medium">Rest / Break per entry:</span>
        <input type="number" min={0} max={120} step={5} value={restMins}
          onChange={e => setRestMins(Math.max(0, +e.target.value))}
          className="w-20 border border-amber-300 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-300" />
        <span className="text-sm text-amber-700">minutes</span>
        {restMins > 0 && <span className="text-xs text-amber-600 ml-1">→ {(restMins/60).toFixed(2)} hr deducted per entry</span>}
      </div>

      {/* Chart */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
        <div className="text-sm font-semibold text-gray-700 mb-3">Monthly Trend</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="Used" fill="#2563eb" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Remaining" fill="#a5b4fc" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Entries Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="text-sm font-semibold text-gray-700">Entries — {month.label}</div>
            <button onClick={exportPDF} className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded">PDF</button>
            <button onClick={exportExcel} className="text-xs px-2 py-1 bg-green-50 hover:bg-green-100 text-green-700 rounded">Excel</button>
            <button onClick={() => window.print()} className="text-xs px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded flex items-center gap-1">
              <Printer size={11} /> Print
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input value={newVehicle} onChange={(e) => setNewVehicle(e.target.value)} placeholder="+ vehicle no."
              className="text-xs border border-gray-200 rounded-lg px-2 py-1 w-28 focus:outline-none focus:ring-2 focus:ring-blue-200" />
            <button onClick={addVehicle} className="text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200">Add</button>
          </div>
        </div>

        {/* Add N rows same as above */}
        <div className="flex items-center gap-2 px-5 py-2 bg-blue-50/40 border-b border-gray-100">
          <Zap size={13} className="text-blue-500" />
          <span className="text-xs text-blue-700 font-medium">Add same rows:</span>
          <input type="number" min={1} max={31} value={addNCount} onChange={e => setAddNCount(Math.max(1, +e.target.value))}
            className="w-14 text-xs border border-blue-200 rounded px-2 py-1 text-center focus:outline-none" />
          <button onClick={addNRowsSameAsAbove}
            className="text-xs px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1">
            <ChevronsDown size={12} /> Add {addNCount} rows (same as above)
          </button>
          <span className="text-[10px] text-gray-400">Sirf date change karo baad mein</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase bg-gray-50">
                <th className="px-4 py-2 font-semibold">Date</th>
                <th className="px-4 py-2 font-semibold">Vehicle</th>
                {contract.timeMode === "split" ? (
                  <>
                    <th className="px-4 py-2 font-semibold">B/N In</th>
                    <th className="px-4 py-2 font-semibold">B/N Out</th>
                    <th className="px-4 py-2 font-semibold">A/N In</th>
                    <th className="px-4 py-2 font-semibold">A/N Out</th>
                  </>
                ) : (
                  <>
                    <th className="px-4 py-2 font-semibold">In Time</th>
                    <th className="px-4 py-2 font-semibold">Out Time</th>
                  </>
                )}
                <th className="px-4 py-2 font-semibold">Hrs</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {month.entries.map((e: any, ei: number) => (
                <tr key={e.id} className="border-t border-gray-50 hover:bg-gray-50/50 group/row">
                  <td className="px-4 py-2">
                    <input type="date" value={e.date}
                      onChange={ev => update((c: any) => ({
                        ...c, months: c.months.map((m: any, i: number) => i !== idx ? m : {
                          ...m, entries: m.entries.map((en: any) => en.id === e.id ? { ...en, date: ev.target.value } : en)
                        })
                      }))}
                      className="border border-transparent hover:border-gray-200 rounded px-1 py-0.5 text-xs w-28 focus:outline-none focus:border-blue-400 bg-transparent" />
                  </td>
                  <td className="px-4 py-2">
                    <select value={e.vehicle}
                      onChange={ev => update((c: any) => ({
                        ...c, months: c.months.map((m: any, i: number) => i !== idx ? m : {
                          ...m, entries: m.entries.map((en: any) => en.id === e.id ? { ...en, vehicle: ev.target.value } : en)
                        })
                      }))}
                      className="border border-gray-200 rounded px-1 py-0.5 text-xs focus:outline-none">
                      {(contract.vehicles || []).map((v: string) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </td>
                  {contract.timeMode === "split" ? (
                    <>
                      <td className="px-2 py-2"><TimeEditCell value={e.inTime} field="inTime" entryId={e.id} idx={idx} ei={ei} update={update} fillDown={fillDownTime} /></td>
                      <td className="px-2 py-2"><TimeEditCell value={e.outTime} field="outTime" entryId={e.id} idx={idx} ei={ei} update={update} fillDown={fillDownTime} /></td>
                      <td className="px-2 py-2"><TimeEditCell value={e.inTime2 || ""} field="inTime2" entryId={e.id} idx={idx} ei={ei} update={update} fillDown={fillDownTime} /></td>
                      <td className="px-2 py-2"><TimeEditCell value={e.outTime2 || ""} field="outTime2" entryId={e.id} idx={idx} ei={ei} update={update} fillDown={fillDownTime} /></td>
                    </>
                  ) : (
                    <>
                      <td className="px-2 py-2"><TimeEditCell value={e.inTime} field="inTime" entryId={e.id} idx={idx} ei={ei} update={update} fillDown={fillDownTime} /></td>
                      <td className="px-2 py-2"><TimeEditCell value={e.outTime} field="outTime" entryId={e.id} idx={idx} ei={ei} update={update} fillDown={fillDownTime} /></td>
                    </>
                  )}
                  <td className="px-4 py-2 font-semibold text-gray-700">
                    <div className="flex items-center gap-2">
                      <span>{entryNetHours(e, contract.timeMode, restMins)}</span>
                      {restMins > 0 && (
                        <button 
                          onClick={() => update((c: any) => ({ ...c, months: c.months.map((m: any, i: number) => i !== idx ? m : { ...m, entries: m.entries.map((en: any) => en.id === e.id ? { ...en, noRest: !en.noRest } : en) }) }))}
                          className={`text-[10px] px-1.5 py-0.5 rounded border ${e.noRest ? 'bg-amber-100 text-amber-700 border-amber-200' : 'text-gray-400 border-gray-200 hover:bg-gray-100'}`}
                          title="Toggle Break Deduction"
                        >
                          {e.noRest ? 'No Break' : 'Break'}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                      <button onClick={() => cloneEntryBelow(e)} className="text-gray-300 hover:text-blue-500" title="Clone row"><Copy size={13} /></button>
                      <button onClick={() => removeEntry(e.id)} className="text-gray-300 hover:text-rose-500"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}

              {/* Add row */}
              <tr className="border-t border-gray-100 bg-blue-50/30">
                <td className="px-4 py-2">
                  <input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                    className="border border-gray-200 rounded-lg px-2 py-1 text-xs w-32 focus:outline-none focus:ring-2 focus:ring-blue-200" />
                </td>
                <td className="px-4 py-2">
                  <select value={draft.vehicle} onChange={(e) => setDraft({ ...draft, vehicle: e.target.value })}
                    className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200">
                    {(contract.vehicles || []).map((v: string) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </td>
                {contract.timeMode === "split" ? (
                  <>
                    <td className="px-2 py-2"><input type="time" value={draft.inTime} onChange={(e) => setDraft({ ...draft, inTime: e.target.value })} className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none" /></td>
                    <td className="px-2 py-2"><input type="time" value={draft.outTime} onChange={(e) => setDraft({ ...draft, outTime: e.target.value })} className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none" /></td>
                    <td className="px-2 py-2"><input type="time" value={draft.inTime2} onChange={(e) => setDraft({ ...draft, inTime2: e.target.value })} className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none" /></td>
                    <td className="px-2 py-2"><input type="time" value={draft.outTime2} onChange={(e) => setDraft({ ...draft, outTime2: e.target.value })} className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none" /></td>
                  </>
                ) : (
                  <>
                    <td className="px-2 py-2"><input type="time" value={draft.inTime} onChange={(e) => setDraft({ ...draft, inTime: e.target.value })} className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none" /></td>
                    <td className="px-2 py-2"><input type="time" value={draft.outTime} onChange={(e) => setDraft({ ...draft, outTime: e.target.value })} className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none" /></td>
                  </>
                )}
                <td className="px-4 py-2 text-xs text-gray-400">
                  <div className="flex items-center gap-2">
                    <span>{entryNetHours(draft, contract.timeMode, restMins) > 0 ? `${entryNetHours(draft, contract.timeMode, restMins)} hr` : "—"}</span>
                    {restMins > 0 && (
                      <button 
                        onClick={() => setDraft(d => ({ ...d, noRest: !d.noRest }))}
                        className={`text-[10px] px-1.5 py-0.5 rounded border ${draft.noRest ? 'bg-amber-100 text-amber-700 border-amber-200' : 'text-gray-400 border-gray-200 hover:bg-gray-100'}`}
                        title="Toggle Break Deduction"
                      >
                        {draft.noRest ? 'No Break' : 'Break'}
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2 text-right">
                  <button onClick={addEntry} className="text-blue-600 hover:text-blue-700"><Plus size={16} /></button>
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-100 bg-gray-50">
                <td colSpan={contract.timeMode === "split" ? 6 : 4} className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Total Used</td>
                <td className="px-4 py-2 font-bold text-blue-600">{used}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      </div>
      
      {/* Hidden print template */}
      <div className="hidden print:block">
        <PrintTemplate contract={contract} month={month} used={used} remaining={remaining} />
      </div>
    </div>
  );
}

/* Time cell with fill-down button */
function TimeEditCell({ value, field, entryId, idx, ei, update, fillDown }: any) {
  const [hover, setHover] = useState(false);
  return (
    <div className="relative flex items-center" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <input type="time" value={value}
        onChange={e => update((c: any) => ({
          ...c, months: c.months.map((m: any, i: number) => i !== idx ? m : {
            ...m, entries: m.entries.map((en: any) => en.id === entryId ? { ...en, [field]: e.target.value } : en)
          })
        }))}
        className="border border-gray-200 rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300 w-20" />
      {hover && (
        <button onClick={() => fillDown(field, ei)} title="Fill down all rows"
          className="absolute -right-5 text-gray-300 hover:text-blue-500 z-10">
          <ChevronsDown size={12} />
        </button>
      )}
    </div>
  );
}

function EmptyMonthState({ contract, onAdd }: any) {
  return (
    <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
      <Calendar className="mx-auto text-gray-300 mb-3" size={28} />
      <p className="text-sm text-gray-500 mb-4">Is contract mein abhi koi month nahi hai.</p>
      <button
        onClick={() => onAdd({
          id: uid(), label: `${MONTH_NAMES[new Date().getMonth()]} ${new Date().getFullYear()}`,
          year: new Date().getFullYear(), monthIdx: new Date().getMonth(),
          totalDays: daysInMonth(new Date().getFullYear(), new Date().getMonth()),
          previousRemaining: contract.sanctionedQty || 0, entries: [],
        })}
        className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">
        Start First Month
      </button>
    </div>
  );
}

/* =========================================================================
   MANPOWER DETAIL
   ========================================================================= */
function ManpowerDetail({ contract, update, notify }: any) {
  const [selIdx, setSelIdx] = useState(contract.months.length - 1);
  const idx = Math.min(Math.max(selIdx, 0), Math.max(contract.months.length - 1, 0));
  const month = contract.months[idx];
  const [newWorker, setNewWorker] = useState("");
  const [addNCount, setAddNCount] = useState(1);
  const [hoveredCell, setHoveredCell] = useState<{ workerId: string; day: number } | null>(null);
  const [selectedWorkers, setSelectedWorkers] = useState<Set<string>>(new Set());
  const [showImportModal, setShowImportModal] = useState(false);

  if (!month) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
        <Users className="mx-auto text-gray-300 mb-3" size={28} />
        <p className="text-sm text-gray-500 mb-4">Is contract mein abhi koi month nahi hai.</p>
        <button
          onClick={() => update((c: any) => ({
            ...c, months: [{
              id: uid(), label: `${MONTH_NAMES[new Date().getMonth()]} ${new Date().getFullYear()}`,
              year: new Date().getFullYear(), monthIdx: new Date().getMonth(),
              totalDays: daysInMonth(new Date().getFullYear(), new Date().getMonth()),
              sundays: [], holidays: [], workers: [],
            }],
          }))}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700">
          Start First Month
        </button>
      </div>
    );
  }

  const { perDay, totalPresent, totalAbsent } = recalcManpowerMonth(month);
  const attendancePct = totalPresent + totalAbsent > 0 ? Math.round((totalPresent / (totalPresent + totalAbsent)) * 100) : 0;

  const cycleCell = (workerId: string, day: number) => {
    update((c: any) => ({
      ...c,
      months: c.months.map((m: any, i: number) => i !== idx ? m : {
        ...m,
        workers: m.workers.map((w: any) => {
          if (w.id !== workerId) return w;
          const cur = (w.attendance[day] || "").toUpperCase();
          const next = cycleOrder[(cycleOrder.indexOf(cur) + 1) % cycleOrder.length];
          return { ...w, attendance: { ...w.attendance, [day]: next } };
        }),
      }),
    }));
  };

  const setCell = (workerId: string, day: number, val: string) => {
    update((c: any) => ({
      ...c,
      months: c.months.map((m: any, i: number) => i !== idx ? m : {
        ...m,
        workers: m.workers.map((w: any) => w.id !== workerId ? w : { ...w, attendance: { ...w.attendance, [day]: val } }),
      }),
    }));
  };

  const fillDayAll = (day: number, val: string) => {
    update((c: any) => ({
      ...c,
      months: c.months.map((m: any, i: number) => i !== idx ? m : {
        ...m,
        workers: m.workers.map((w: any) => {
          const isOff = m.sundays?.includes(day) || m.holidays?.includes(day);
          if (isOff) return w;
          return { ...w, attendance: { ...w.attendance, [day]: val } };
        }),
      }),
    }));
  };

  const fillWorkerAll = (workerId: string, val: string) => {
    update((c: any) => ({
      ...c,
      months: c.months.map((m: any, i: number) => i !== idx ? m : {
        ...m,
        workers: m.workers.map((w: any) => {
          if (w.id !== workerId) return w;
          const att: Record<number, string> = {};
          for (let d = 1; d <= m.totalDays; d++) {
            att[d] = m.sundays?.includes(d) ? "SUNDAY" : m.holidays?.includes(d) ? "HOLIDAY" : val;
          }
          return { ...w, attendance: att };
        }),
      }),
    }));
  };

  const fillAllWorkers = (val: string) => {
    update((c: any) => ({
      ...c,
      months: c.months.map((m: any, i: number) => i !== idx ? m : {
        ...m,
        workers: m.workers.map((w: any) => {
          const att: Record<number, string> = {};
          for (let d = 1; d <= m.totalDays; d++) {
            att[d] = m.sundays?.includes(d) ? "SUNDAY" : m.holidays?.includes(d) ? "HOLIDAY" : val;
          }
          return { ...w, attendance: att };
        }),
      }),
    }));
    notify(`Sab workers ke liye ${val} fill ho gaya`);
  };

  const fillSelected = (val: string) => {
    if (selectedWorkers.size === 0) { notify("Koi worker select nahi hai", "error"); return; }
    update((c: any) => ({
      ...c,
      months: c.months.map((m: any, i: number) => i !== idx ? m : {
        ...m,
        workers: m.workers.map((w: any) => {
          if (!selectedWorkers.has(w.id)) return w;
          const att: Record<number, string> = {};
          for (let d = 1; d <= m.totalDays; d++) {
            att[d] = m.sundays?.includes(d) ? "SUNDAY" : m.holidays?.includes(d) ? "HOLIDAY" : val;
          }
          return { ...w, attendance: att };
        }),
      }),
    }));
    notify(`${selectedWorkers.size} workers ke liye ${val} fill ho gaya`);
    setSelectedWorkers(new Set());
  };

  const toggleWorkerSelect = (id: string) => {
    setSelectedWorkers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const addWorker = () => {
    if (!newWorker.trim()) return;
    update((c: any) => ({
      ...c,
      months: c.months.map((m: any, i: number) => i !== idx ? m : {
        ...m,
        workers: [...m.workers, { id: uid(), srNo: m.workers.length + 1, name: newWorker.trim().toUpperCase(), attendance: {} }],
      }),
    }));
    setNewWorker("");
  };

  const addNWorkersSameAsAbove = () => {
    const last = month.workers[month.workers.length - 1];
    if (!last) { notify("Pehle ek worker daalo", "error"); return; }
    const newWorkers = Array.from({ length: addNCount }, (_, i) => ({
      ...last, id: uid(), srNo: month.workers.length + i + 1, name: `WORKER ${month.workers.length + i + 1}`, attendance: { ...last.attendance }
    }));
    update((c: any) => ({
      ...c,
      months: c.months.map((m: any, i: number) => i !== idx ? m : { ...m, workers: [...m.workers, ...newWorkers] }),
    }));
    notify(`${addNCount} workers added — names update karo`);
  };

  const removeWorker = (workerId: string) => {
    update((c: any) => ({
      ...c,
      months: c.months.map((m: any, i: number) => i !== idx ? m : { ...m, workers: m.workers.filter((w: any) => w.id !== workerId) }),
    }));
    setSelectedWorkers(prev => { const next = new Set(prev); next.delete(workerId); return next; });
  };

  const addMonth = () => {
    const last = contract.months.at(-1);
    let year = last?.year ?? new Date().getFullYear();
    let mIdx = (last?.monthIdx ?? -1) + 1;
    if (mIdx > 11) { mIdx = 0; year += 1; }
    const newMonth = {
      id: uid(), label: `${MONTH_NAMES[mIdx]} ${year}`, year, monthIdx: mIdx,
      totalDays: daysInMonth(year, mIdx), sundays: [], holidays: [],
      workers: last ? last.workers.map((w: any) => ({ id: uid(), srNo: w.srNo, name: w.name, attendance: {} })) : [],
    };
    update((c: any) => ({ ...c, months: [...c.months, newMonth] }));
    setSelIdx(contract.months.length);
    notify(`${newMonth.label} added — worker list carried over`);
  };

  const handleWorkerImport = (workers: any[], mode: string) => {
    if (mode !== "workers") { notify("Yeh attendance workers import ke liye hai", "error"); return; }
    update((c: any) => ({
      ...c,
      months: c.months.map((m: any, i: number) => {
        if (i !== idx) return m;
        const merged = [...m.workers];
        workers.forEach((iw: any) => {
          const found = merged.findIndex((ew: any) => ew.name.toUpperCase() === iw.name.toUpperCase());
          if (found >= 0) {
            merged[found] = { ...merged[found], attendance: { ...merged[found].attendance, ...iw.attendance } };
          } else {
            merged.push({ ...iw, srNo: merged.length + 1 });
          }
        });
        return { ...m, workers: merged };
      }),
    }));
    notify(`${workers.length} workers import/merge ho gaye`);
  };

  const pieData = [
    { name: "Present", value: totalPresent, color: "#10b981" },
    { name: "Absent", value: totalAbsent, color: "#f43f5e" },
  ];

  const workerTooltip = hoveredCell
    ? month.workers.find((w: any) => w.id === hoveredCell.workerId)?.name
    : null;

  return (
    <div>
      <div className="print:hidden">
      {/* Month Tabs */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {contract.months.map((m: any, i: number) => (
            <button key={m.id ?? i} onClick={() => setSelIdx(i)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap ${i === idx ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
              {m.label}
            </button>
          ))}
          <button onClick={addMonth} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-dashed border-gray-300 text-gray-500 hover:border-indigo-400 hover:text-indigo-600 flex items-center gap-1">
            <Plus size={14} /> Month
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <StatCard icon={<Users size={16} />} label="Workers" value={month.workers.length} tone="indigo" />
        <StatCard icon={<CheckCircle2 size={16} />} label="Present (month)" value={totalPresent} tone="emerald" />
        <StatCard icon={<FileWarning size={16} />} label="Absent (month)" value={totalAbsent} tone="rose" />
        <StatCard icon={<Gauge size={16} />} label="Attendance %" value={`${attendancePct}%`} tone="blue" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-3 gap-5 mb-5">
        <div className="col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="text-sm font-semibold text-gray-700 mb-3">Daily Present Count</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={Object.entries(perDay).map(([d, v]) => ({ day: d, present: v }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} interval={2} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="present" stroke="#4f46e5" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="text-sm font-semibold text-gray-700 mb-3">Present vs Absent</div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} dataKey="value" innerRadius={45} outerRadius={70} paddingAngle={3}>
                {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Attendance Register */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-wrap gap-2">
          <div className="text-sm font-semibold text-gray-700">Attendance Register — {month.label}</div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setShowImportModal(true)}
              className="text-xs px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 flex items-center gap-1">
              <Upload size={12}/> Import JSON
            </button>
            <input value={newWorker} onChange={(e) => setNewWorker(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addWorker()}
              placeholder="+ worker name"
              className="text-xs border border-gray-200 rounded-lg px-2 py-1 w-40 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            <button onClick={addWorker} className="text-xs px-2 py-1 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center gap-1"><UserPlus size={12}/> Add</button>
            <button onClick={() => window.print()} className="text-xs px-2 py-1 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 flex items-center gap-1">
              <Printer size={12} /> Print
            </button>
          </div>
        </div>

        {/* Power toolbar */}
        <div className="flex items-center gap-3 px-5 py-2.5 bg-indigo-50/50 border-b border-gray-100 flex-wrap">
          <div className="flex items-center gap-1.5 border-r border-indigo-100 pr-3">
            <Zap size={13} className="text-indigo-500" />
            <span className="text-xs font-semibold text-indigo-700">Fill All:</span>
            <button onClick={() => fillAllWorkers("P")}
              className="text-xs px-2 py-1 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 font-semibold">✓ All P</button>
            <button onClick={() => fillAllWorkers("A")}
              className="text-xs px-2 py-1 bg-rose-500 text-white rounded-lg hover:bg-rose-600 font-semibold">✗ All A</button>
          </div>
          {selectedWorkers.size > 0 && (
            <div className="flex items-center gap-1.5 border-r border-indigo-100 pr-3">
              <span className="text-xs text-indigo-600 font-medium">{selectedWorkers.size} selected:</span>
              <button onClick={() => fillSelected("P")} className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg">P</button>
              <button onClick={() => fillSelected("A")} className="text-xs px-2 py-1 bg-rose-100 text-rose-700 rounded-lg">A</button>
              <button onClick={() => setSelectedWorkers(new Set())} className="text-xs text-gray-400 hover:text-gray-600"><X size={11} /></button>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <ChevronsDown size={13} className="text-indigo-500" />
            <span className="text-xs font-semibold text-indigo-700">Add rows:</span>
            <input type="number" min={1} max={50} value={addNCount} onChange={e => setAddNCount(Math.max(1, +e.target.value))}
              className="w-12 text-xs border border-indigo-200 rounded px-1 py-0.5 text-center focus:outline-none" />
            <button onClick={addNWorkersSameAsAbove}
              className="text-xs px-2 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
              Add {addNCount} Workers
            </button>
          </div>
          <span className="text-[10px] text-gray-400 ml-auto">Click cell to cycle P/A/S/H | Press P or A key on focused cell</span>
        </div>

        {/* Tooltip bar */}
        {hoveredCell && workerTooltip && (
          <div className="px-5 py-1 text-xs text-indigo-700 bg-indigo-50 border-b border-indigo-100">
            ✏️ Editing: <strong>{workerTooltip}</strong> — Day {hoveredCell.day}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="text-xs w-full mt-1">
            <thead>
              <tr className="text-gray-400 uppercase bg-gray-50">
                <th className="w-6 px-2 py-2 sticky left-0 bg-gray-50">
                  <input type="checkbox"
                    checked={selectedWorkers.size === month.workers.length && month.workers.length > 0}
                    onChange={e => setSelectedWorkers(e.target.checked ? new Set(month.workers.map((w: any) => w.id)) : new Set())}
                    className="rounded" />
                </th>
                <th className="px-3 py-2 text-left sticky left-6 bg-gray-50 min-w-[160px]">Name</th>
                {Array.from({ length: month.totalDays }, (_, i) => i + 1).map((d) => (
                  <th key={d} className="w-7 py-2 font-medium text-center">{d}</th>
                ))}
                <th className="px-2 py-2 text-emerald-600">P</th>
                <th className="px-2 py-2 text-rose-500">A</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {month.workers.map((w: any) => (
                <tr key={w.id} className={`border-t border-gray-50 ${selectedWorkers.has(w.id) ? "bg-indigo-50/30" : ""}`}>
                  <td className="w-6 px-2 sticky left-0 bg-inherit">
                    <input type="checkbox" checked={selectedWorkers.has(w.id)} onChange={() => toggleWorkerSelect(w.id)} className="rounded" />
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap sticky left-6 bg-inherit">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-gray-500 text-[10px]">{w.srNo}.</span>
                      <input value={w.name}
                        onChange={e => update((c: any) => ({
                          ...c, months: c.months.map((m: any, i: number) => i !== idx ? m : {
                            ...m, workers: m.workers.map((ww: any) => ww.id === w.id ? { ...ww, name: e.target.value.toUpperCase() } : ww)
                          })
                        }))}
                        className="font-medium text-gray-700 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-400 focus:outline-none text-xs w-40 uppercase" />
                    </div>
                  </td>
                  {Array.from({ length: month.totalDays }, (_, i) => i + 1).map((d) => {
                    const isOff = month.sundays?.includes(d) || month.holidays?.includes(d);
                    const val = isOff ? (month.sundays?.includes(d) ? "SUNDAY" : "HOLIDAY") : (w.attendance[d] || "");
                    const isHovered = hoveredCell?.workerId === w.id && hoveredCell?.day === d;
                    return (
                      <td key={d} className="p-0.5">
                        <button
                          onClick={() => !isOff && cycleCell(w.id, d)}
                          onMouseEnter={() => !isOff && setHoveredCell({ workerId: w.id, day: d })}
                          onMouseLeave={() => setHoveredCell(null)}
                          onKeyDown={(e) => {
                            if (isOff) return;
                            if (e.key === "p" || e.key === "P") { setCell(w.id, d, "P"); e.preventDefault(); }
                            else if (e.key === "a" || e.key === "A") { setCell(w.id, d, "A"); e.preventDefault(); }
                          }}
                          title={`${w.name} — Day ${d}`}
                          className={`w-6 h-6 rounded border text-[10px] font-semibold flex items-center justify-center transition-all
                            ${cellStyle[val]}
                            ${isOff ? "cursor-default" : "hover:brightness-90 hover:scale-110 cursor-pointer"}
                            ${isHovered ? "ring-2 ring-indigo-400 ring-offset-1" : ""}`}>
                          {cellShort[val]}
                        </button>
                      </td>
                    );
                  })}
                  <td className="px-2 text-center font-semibold text-emerald-600">{attendanceCount(w, "P")}</td>
                  <td className="px-2 text-center font-semibold text-rose-500">{attendanceCount(w, "A")}</td>
                  <td className="px-1 py-1.5 flex items-center gap-0.5">
                    <button onClick={() => fillWorkerAll(w.id, "P")} title="Fill all P" className="text-gray-200 hover:text-emerald-500"><CheckCircle2 size={11} /></button>
                    <button onClick={() => removeWorker(w.id)} className="text-gray-200 hover:text-rose-500"><Trash2 size={11} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-100 bg-gray-50 font-semibold text-gray-600">
                <td colSpan={2} className="px-3 py-2 sticky left-0 bg-gray-50">TOTAL / day</td>
                {Array.from({ length: month.totalDays }, (_, i) => i + 1).map((d) => (
                  <td key={d} className="text-center py-1.5">
                    <button onClick={() => fillDayAll(d, "P")} title={`Fill P for day ${d}`}
                      className="text-center w-full hover:bg-emerald-100 rounded text-gray-600 font-semibold">
                      {perDay[d] || ""}
                    </button>
                  </td>
                ))}
                <td className="text-center text-emerald-600">{totalPresent}</td>
                <td className="text-center text-rose-500">{totalAbsent}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Worker import modal */}
      {showImportModal && (
        <ImportModal
          onClose={() => setShowImportModal(false)}
          onImport={handleWorkerImport}
          notify={notify}
        />
      )}
      </div>
      
      {/* Hidden print template */}
      <div className="hidden print:block">
        <PrintTemplate contract={contract} month={month} />
      </div>
    </div>
  );
}

/* =========================================================================
   SYNC BADGE
   ========================================================================= */
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
