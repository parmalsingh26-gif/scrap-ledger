import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Plus, Upload, Download, Search, Edit3, Trash2, X, ChevronRight,
  Truck, Users, Calendar, AlertTriangle, CheckCircle2, TrendingDown,
  Copy, ArrowLeft, Archive, FileWarning, Gauge, Clock, UserPlus, Save
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell
} from "recharts";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import ExcelJS from "exceljs";


/* =========================================================================
   CONTRACT MODULE — data model
   -------------------------------------------------------------------------
   Two generic CONTRACT TYPES cover every real-world contract this business
   signs, so a brand-new contract never needs new code — only new data:

   1) "equipment"  -> hourly/qty hire contracts (JCB, Tractor, Crane, ...)
      - a running "sanctioned qty" that depletes every month
      - each month: previousRemaining -> entries (date/vehicle/time) -> used -> remaining
      - remaining auto carries forward into the next month

   2) "manpower"   -> attendance/labour contracts (Dynamic A/P style)
      - each month: a worker x day grid of P / A / SUNDAY / HOLIDAY
      - present/absent totals computed per worker, per day, and overall

   Switching to a new contract (new LOA, new firm, new equipment) is just
   "+ New Contract" with different field values — no rebuild required.
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
  if (diff < 0) diff += 24 * 60; // overnight shift safety
  return +(diff / 60).toFixed(2);
};

const entryHours = (e: any, timeMode: string) => {
  if (timeMode === "split") {
    return +(hoursBetween(e.inTime, e.outTime) + hoursBetween(e.inTime2, e.outTime2)).toFixed(2);
  }
  return hoursBetween(e.inTime, e.outTime);
};

// Gross hours minus rest per entry
const entryNetHours = (e: any, timeMode: string, restMinsPerEntry: number) => {
  const gross = entryHours(e, timeMode);
  return +(Math.max(0, gross - restMinsPerEntry / 60)).toFixed(2);
};


/* ---------- sample seed data, mirrors the uploaded Excel structure ---------- */
const seedContracts = () => [
  {
    id: uid(),
    type: "equipment",
    status: "active",
    name: "JCB Hire — Auto Lift",
    firm: "AUTO LIFT",
    loaNo: "GEMC-511687790945033",
    loaDate: "2025-06-04",
    natureOfWork: "HIRING OF EARTH MOVING EQUIPMENT & MATERIAL HANDLING EQUIPMENT (JCB)",
    unit: "Hrs",
    timeMode: "single",
    sanctionedQty: 888,
    vehicles: ["GJ 14 M 4006"],
    months: [
      {
        id: uid(), label: "JUL 2025", year: 2025, monthIdx: 6, totalDays: 31,
        previousRemaining: 864,
        entries: [
          { id: uid(), date: "2025-07-05", vehicle: "GJ 14 M 4006", inTime: "08:30", outTime: "17:30" },
          { id: uid(), date: "2025-07-11", vehicle: "GJ 14 M 4006", inTime: "08:30", outTime: "17:30" },
          { id: uid(), date: "2025-07-23", vehicle: "GJ 14 M 4006", inTime: "08:30", outTime: "17:30" },
        ],
      },
      {
        id: uid(), label: "AUG 2025", year: 2025, monthIdx: 7, totalDays: 31,
        previousRemaining: 840,
        entries: [
          { id: uid(), date: "2025-08-01", vehicle: "GJ 14 M 4006", inTime: "08:30", outTime: "17:30" },
          { id: uid(), date: "2025-08-11", vehicle: "GJ 14 M 4006", inTime: "08:30", outTime: "17:30" },
          { id: uid(), date: "2025-08-25", vehicle: "GJ 14 M 4006", inTime: "08:30", outTime: "17:30" },
        ],
      },
    ],
  },
  {
    id: uid(),
    type: "equipment",
    status: "active",
    name: "Tractor Hire — Auto Lift",
    firm: "AUTO LIFT",
    loaNo: "GEMC-511687790945033",
    loaDate: "2025-06-04",
    natureOfWork: "HIRING OF EARTH MOVING EQUIPMENT & MATERIAL HANDLING EQUIPMENT (TRACTOR)",
    unit: "Hrs",
    timeMode: "split",
    sanctionedQty: 7688,
    vehicles: ["GJ 27 BL 9049"],
    months: [
      {
        id: uid(), label: "JUL 2025", year: 2025, monthIdx: 6, totalDays: 31,
        previousRemaining: 7488,
        entries: [
          { id: uid(), date: "2025-07-03", vehicle: "GJ 27 BL 9049", inTime: "08:30", outTime: "12:30", inTime2: "13:00", outTime2: "17:00" },
          { id: uid(), date: "2025-07-04", vehicle: "GJ 27 BL 9049", inTime: "08:30", outTime: "12:30", inTime2: "13:00", outTime2: "17:00" },
        ],
      },
    ],
  },
  {
    id: uid(),
    type: "manpower",
    status: "active",
    name: "Dynamic A/P — Housekeeping Labour",
    firm: "DYNAMIC",
    loaNo: "",
    loaDate: "",
    natureOfWork: "SUPPLY OF MANPOWER (HOUSEKEEPING / MATERIAL HANDLING)",
    months: [
      {
        id: uid(), label: "DEC 2024", year: 2024, monthIdx: 11, totalDays: 31,
        sundays: [1, 8, 15, 22, 29],
        holidays: [14],
        workers: [
          { id: uid(), srNo: 1, name: "SARVAIYA PRAKASH", attendance: { 2:"P",3:"P",4:"P",5:"P",6:"P",7:"A" } },
          { id: uid(), srNo: 2, name: "KAMBAD DIVYESH BHUPATBHAI", attendance: { 2:"P",3:"P",4:"P",5:"P",6:"P",7:"P" } },
        ],
      },
    ],
  },
];

/* ---------------------------------- helpers ---------------------------------- */

function recalcEquipmentMonth(month: any, timeMode: string) {
  const restMins = month.restMins ?? 0;  // rest time per day in minutes
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

/* ================================ TOAST ================================ */
function Toast({ toast }: { toast: { msg: string; type: string } | null }) {
  if (!toast) return null;
  const isErr = toast.type === "error";
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl px-4 py-3 shadow-lg border text-sm font-medium
      ${isErr ? "bg-rose-50 border-rose-200 text-rose-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
      {isErr ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
      {toast.msg}
    </div>
  );
}

/* ============================== STAT CARD ============================== */
function StatCard({ icon, label, value, sub, tone = "blue" }: { icon: React.ReactNode; label: string; value: any; sub?: string; tone?: string }) {
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

/* ============================ CONTRACT CARD ============================= */
function ContractCard({ c, onOpen, onEdit, onArchive, onDuplicate }: any) {
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
          {low && <div className="flex items-center gap-1 text-[11px] text-rose-500 mt-1"><TrendingDown size={12}/> running low</div>}
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
          <button onClick={() => onDuplicate(c.id)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400" title="Duplicate for renewal"><Copy size={14} /></button>
          <button onClick={() => onArchive(c.id)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400" title="Archive"><Archive size={14} /></button>
        </div>
      </div>
    </div>
  );
}

/* ======================== NEW / EDIT CONTRACT MODAL ====================== */
function ContractFormModal({ initial, onClose, onSave }: any) {
  const isEdit = !!initial;
  const [form, setForm] = useState(
    initial || {
      type: "equipment", name: "", firm: "", loaNo: "", loaDate: "",
      natureOfWork: "", unit: "Hrs", timeMode: "single", sanctionedQty: "",
    }
  );
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 bg-gray-900/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
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
                  <div className="text-[11px] text-gray-400">JCB, Tractor, Crane... qty depletes monthly</div>
                </button>
                <button onClick={() => set("type", "manpower")}
                  className={`rounded-xl border-2 p-3 text-left transition-colors ${form.type === "manpower" ? "border-indigo-500 bg-indigo-50" : "border-gray-100"}`}>
                  <Users size={16} className="text-indigo-600 mb-1" />
                  <div className="text-sm font-semibold text-gray-700">Manpower / Attendance</div>
                  <div className="text-[11px] text-gray-400">Dynamic A/P style daily P/A register</div>
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

/* ============================ EQUIPMENT DETAIL =========================== */
function EquipmentDetail({ contract, update, notify }: any) {
  const [selIdx, setSelIdx] = useState(contract.months.length - 1);
  const idx = Math.min(Math.max(selIdx, 0), Math.max(contract.months.length - 1, 0));
  const month = contract.months[idx];
  const [draft, setDraft] = useState({ date: "", vehicle: contract.vehicles?.[0] || "", inTime: "", outTime: "", inTime2: "", outTime2: "" });
  const [newVehicle, setNewVehicle] = useState("");

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
    if (hrs <= 0) { notify("Time galat hai — out time in time ke baad hona chahiye", "error"); return; }
    const entry = { id: uid(), ...draft };
    update((c: any) => ({
      ...c,
      months: c.months.map((m: any, i: number) => (i === idx ? { ...m, entries: [...m.entries, entry] } : m)),
    }));
    setDraft({ date: "", vehicle: draft.vehicle, inTime: "", outTime: "", inTime2: "", outTime2: "" });
  };

  const removeEntry = (id: string) => {
    update((c: any) => ({
      ...c,
      months: c.months.map((m: any, i: number) => (i === idx ? { ...m, entries: m.entries.filter((e: any) => e.id !== id) } : m)),
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
    let monthIdx = (last?.monthIdx ?? -1) + 1;
    if (monthIdx > 11) { monthIdx = 0; year += 1; }
    const newMonth = {
      id: uid(), label: `${MONTH_NAMES[monthIdx]} ${year}`, year, monthIdx,
      totalDays: daysInMonth(year, monthIdx),
      previousRemaining: last ? recalcEquipmentMonth(last, contract.timeMode).remaining : contract.sanctionedQty,
      entries: [],
    };
    update((c: any) => ({ ...c, months: [...c.months, newMonth] }));
    setSelIdx(contract.months.length);
    notify(`${newMonth.label} added, opening balance carried forward`);
  };

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: "portrait" });
    doc.setFontSize(14);
    doc.text(`Contract: ${contract.name}`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Firm: ${contract.firm} | LOA: ${contract.loaNo || "-"}`, 14, 22);
    doc.text(`Month: ${month.label}`, 14, 28);
    doc.text(`Opening Balance: ${month.previousRemaining} ${contract.unit} | Used: ${used} ${contract.unit} | Remaining: ${remaining} ${contract.unit}`, 14, 34);
    if (restMins > 0) doc.text(`Rest Deducted Per Entry: ${restMins} mins`, 14, 40);

    const head = contract.timeMode === "split" 
      ? [["Date", "Vehicle", "B/N In", "B/N Out", "A/N In", "A/N Out", "Hrs"]]
      : [["Date", "Vehicle", "In Time", "Out Time", "Hrs"]];

    const body = month.entries.map((e: any) => contract.timeMode === "split" 
      ? [e.date, e.vehicle, e.inTime, e.outTime, e.inTime2, e.outTime2, entryNetHours(e, contract.timeMode, restMins)]
      : [e.date, e.vehicle, e.inTime, e.outTime, entryNetHours(e, contract.timeMode, restMins)]
    );

    (doc as any).autoTable({
      startY: restMins > 0 ? 45 : 39,
      head,
      body,
      theme: 'grid',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [18, 33, 61] }
    });

    doc.save(`${contract.name.replace(/[^a-z0-9]/gi, '_')}-${month.label}.pdf`);
  };

  const exportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(month.label);

    sheet.addRow([`Contract: ${contract.name}`]);
    sheet.addRow([`Firm: ${contract.firm}`, `LOA: ${contract.loaNo || "-"}`]);
    sheet.addRow([`Month: ${month.label}`]);
    sheet.addRow([`Opening Balance: ${month.previousRemaining}`, `Used: ${used}`, `Remaining: ${remaining}`]);
    if (restMins > 0) sheet.addRow([`Rest Deducted Per Entry: ${restMins} mins`]);
    sheet.addRow([]);

    const head = contract.timeMode === "split" 
      ? ["Date", "Vehicle", "B/N In", "B/N Out", "A/N In", "A/N Out", "Hrs"]
      : ["Date", "Vehicle", "In Time", "Out Time", "Hrs"];
    sheet.addRow(head);
    
    month.entries.forEach((e: any) => {
      sheet.addRow(contract.timeMode === "split" 
        ? [e.date, e.vehicle, e.inTime, e.outTime, e.inTime2, e.outTime2, entryNetHours(e, contract.timeMode, restMins)]
        : [e.date, e.vehicle, e.inTime, e.outTime, entryNetHours(e, contract.timeMode, restMins)]);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${contract.name.replace(/[^a-z0-9]/gi, '_')}-${month.label}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };


  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
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

      <div className="grid grid-cols-3 gap-3 mb-5">
        <StatCard icon={<Gauge size={16} />} label="Opening Balance" value={`${month.previousRemaining} ${contract.unit}`} tone="blue" />
        <StatCard icon={<Clock size={16} />} label="Used This Month" value={`${used} ${contract.unit}`} tone="amber"
          sub={restMins > 0 ? `(Rest ${restMins} min/day already deducted)` : undefined} />
        <StatCard icon={<TrendingDown size={16} />} label="Remaining" value={`${remaining} ${contract.unit}`}
          tone={remaining < 0 ? "rose" : "emerald"} sub={contract.sanctionedQty ? `of ${contract.sanctionedQty} sanctioned` : undefined} />
      </div>

      {/* Rest time input */}
      <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 mb-4">
        <Clock size={15} className="text-amber-600 shrink-0" />
        <span className="text-sm text-amber-800 font-medium">Rest / Break Time per entry:</span>
        <input
          type="number" min={0} max={120} step={5}
          value={restMins}
          onChange={e => setRestMins(Math.max(0, +e.target.value))}
          className="w-20 border border-amber-300 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-300"
        />
        <span className="text-sm text-amber-700">minutes</span>
        {restMins > 0 && (
          <span className="text-xs text-amber-600 ml-1">→ {(restMins/60).toFixed(2)} hr deducted per entry</span>
        )}
        <span className="ml-auto text-xs text-amber-500">e.g. 60 for lunch break — automatic from gross hours</span>
      </div>

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

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="text-sm font-semibold text-gray-700">Entries — {month.label}</div>
            <button onClick={exportPDF} className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded">PDF</button>
            <button onClick={exportExcel} className="text-xs px-2 py-1 bg-green-50 hover:bg-green-100 text-green-700 rounded">Excel</button>
          </div>
          <div className="flex items-center gap-2">
            <input value={newVehicle} onChange={(e) => setNewVehicle(e.target.value)} placeholder="+ vehicle no."
              className="text-xs border border-gray-200 rounded-lg px-2 py-1 w-28 focus:outline-none focus:ring-2 focus:ring-blue-200" />
            <button onClick={addVehicle} className="text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200">Add</button>
          </div>
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
              {month.entries.map((e: any) => (
                <tr key={e.id} className="border-t border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-2 text-gray-600">{e.date}</td>
                  <td className="px-4 py-2 text-gray-600">{e.vehicle}</td>
                  {contract.timeMode === "split" ? (
                    <>
                      <td className="px-4 py-2 text-gray-600">{e.inTime}</td>
                      <td className="px-4 py-2 text-gray-600">{e.outTime}</td>
                      <td className="px-4 py-2 text-gray-600">{e.inTime2}</td>
                      <td className="px-4 py-2 text-gray-600">{e.outTime2}</td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-2 text-gray-600">{e.inTime}</td>
                      <td className="px-4 py-2 text-gray-600">{e.outTime}</td>
                    </>
                  )}
                  <td className="px-4 py-2 font-semibold text-gray-700">
                    {entryNetHours(e, contract.timeMode, restMins)}
                    {restMins > 0 && <span className="text-[10px] text-gray-400 ml-1">(gross {entryHours(e, contract.timeMode)})</span>}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => removeEntry(e.id)} className="text-gray-300 hover:text-rose-500"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}

              {/* inline add-row */}
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
                    <td className="px-4 py-2"><input type="time" value={draft.inTime} onChange={(e) => setDraft({ ...draft, inTime: e.target.value })} className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200" /></td>
                    <td className="px-4 py-2"><input type="time" value={draft.outTime} onChange={(e) => setDraft({ ...draft, outTime: e.target.value })} className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200" /></td>
                    <td className="px-4 py-2"><input type="time" value={draft.inTime2} onChange={(e) => setDraft({ ...draft, inTime2: e.target.value })} className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200" /></td>
                    <td className="px-4 py-2"><input type="time" value={draft.outTime2} onChange={(e) => setDraft({ ...draft, outTime2: e.target.value })} className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200" /></td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-2"><input type="time" value={draft.inTime} onChange={(e) => setDraft({ ...draft, inTime: e.target.value })} className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200" /></td>
                    <td className="px-4 py-2"><input type="time" value={draft.outTime} onChange={(e) => setDraft({ ...draft, outTime: e.target.value })} className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200" /></td>
                  </>
                )}
                <td className="px-4 py-2 text-xs text-gray-400">
                  {entryNetHours(draft, contract.timeMode, restMins) > 0
                    ? <>{entryNetHours(draft, contract.timeMode, restMins)} hr{restMins>0&&<span className="text-[10px] ml-1">(gross {entryHours(draft,contract.timeMode)})</span>}</>  
                    : "—"}
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

/* ============================ MANPOWER DETAIL ============================ */
function ManpowerDetail({ contract, update, notify }: any) {
  const [selIdx, setSelIdx] = useState(contract.months.length - 1);
  const idx = Math.min(Math.max(selIdx, 0), Math.max(contract.months.length - 1, 0));
  const month = contract.months[idx];
  const [newWorker, setNewWorker] = useState("");

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

  const removeWorker = (workerId: string) => {
    update((c: any) => ({
      ...c,
      months: c.months.map((m: any, i: number) => i !== idx ? m : { ...m, workers: m.workers.filter((w: any) => w.id !== workerId) }),
    }));
  };

  const addMonth = () => {
    const last = contract.months.at(-1);
    let year = last?.year ?? new Date().getFullYear();
    let monthIdx = (last?.monthIdx ?? -1) + 1;
    if (monthIdx > 11) { monthIdx = 0; year += 1; }
    const newMonth = {
      id: uid(), label: `${MONTH_NAMES[monthIdx]} ${year}`, year, monthIdx,
      totalDays: daysInMonth(year, monthIdx), sundays: [], holidays: [],
      workers: last ? last.workers.map((w: any) => ({ id: uid(), srNo: w.srNo, name: w.name, attendance: {} })) : [],
    };
    update((c: any) => ({ ...c, months: [...c.months, newMonth] }));
    setSelIdx(contract.months.length);
    notify(`${newMonth.label} added — worker list carried over`);
  };

  const pieData = [
    { name: "Present", value: totalPresent, color: "#10b981" },
    { name: "Absent", value: totalAbsent, color: "#f43f5e" },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
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

      <div className="grid grid-cols-4 gap-3 mb-5">
        <StatCard icon={<Users size={16} />} label="Workers" value={month.workers.length} tone="indigo" />
        <StatCard icon={<CheckCircle2 size={16} />} label="Present (month)" value={totalPresent} tone="emerald" />
        <StatCard icon={<FileWarning size={16} />} label="Absent (month)" value={totalAbsent} tone="rose" />
        <StatCard icon={<Gauge size={16} />} label="Attendance %" value={`${attendancePct}%`} tone="blue" />
      </div>

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

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="text-sm font-semibold text-gray-700">Attendance Register — {month.label}</div>
          <div className="flex items-center gap-2">
            <input value={newWorker} onChange={(e) => setNewWorker(e.target.value)} placeholder="+ worker name"
              className="text-xs border border-gray-200 rounded-lg px-2 py-1 w-40 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            <button onClick={addWorker} className="text-xs px-2 py-1 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center gap-1"><UserPlus size={12}/> Add</button>
          </div>
        </div>
        <p className="px-5 pt-3 text-[11px] text-gray-400">Click a day cell to cycle: blank → P → A → Sunday → Holiday</p>
        <div className="overflow-x-auto">
          <table className="text-xs w-full mt-2">
            <thead>
              <tr className="text-gray-400 uppercase bg-gray-50 sticky left-0">
                <th className="px-3 py-2 text-left sticky left-0 bg-gray-50">Name</th>
                {Array.from({ length: month.totalDays }, (_, i) => i + 1).map((d) => (
                  <th key={d} className="w-7 py-2 font-medium">{d}</th>
                ))}
                <th className="px-2 py-2 text-emerald-600">P</th>
                <th className="px-2 py-2 text-rose-500">A</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {month.workers.map((w: any) => (
                <tr key={w.id} className="border-t border-gray-50">
                  <td className="px-3 py-1.5 whitespace-nowrap font-medium text-gray-600 sticky left-0 bg-white">{w.srNo}. {w.name}</td>
                  {Array.from({ length: month.totalDays }, (_, i) => i + 1).map((d) => {
                    const isOff = month.sundays?.includes(d) || month.holidays?.includes(d);
                    const val = isOff ? (month.sundays?.includes(d) ? "SUNDAY" : "HOLIDAY") : (w.attendance[d] || "");
                    return (
                      <td key={d} className="p-0.5">
                        <button
                          onClick={() => !isOff && cycleCell(w.id, d)}
                          className={`w-6 h-6 rounded border text-[10px] font-semibold flex items-center justify-center ${cellStyle[val]} ${isOff ? "cursor-default" : "hover:brightness-95"}`}>
                          {cellShort[val]}
                        </button>
                      </td>
                    );
                  })}
                  <td className="px-2 text-center font-semibold text-emerald-600">{attendanceCount(w, "P")}</td>
                  <td className="px-2 text-center font-semibold text-rose-500">{attendanceCount(w, "A")}</td>
                  <td className="px-1"><button onClick={() => removeWorker(w.id)} className="text-gray-300 hover:text-rose-500"><Trash2 size={12} /></button></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-100 bg-gray-50 font-semibold text-gray-600">
                <td className="px-3 py-2 sticky left-0 bg-gray-50">TOTAL / day</td>
                {Array.from({ length: month.totalDays }, (_, i) => i + 1).map((d) => (
                  <td key={d} className="text-center">{perDay[d] || ""}</td>
                ))}
                <td className="text-center text-emerald-600">{totalPresent}</td>
                <td className="text-center text-rose-500">{totalAbsent}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ============================== IMPORT / EXPORT =========================== */
function ImportExportBar({ contracts, setContracts, notify }: any) {
  const fileRef = useRef<HTMLInputElement>(null);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ contracts }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `contracts-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); URL.revokeObjectURL(url);
    notify("JSON export ho gaya");
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

  const importJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        const incoming = Array.isArray(parsed) ? parsed : parsed.contracts;
        if (!Array.isArray(incoming)) throw new Error("bad shape");
        const cleaned = incoming.map(withIds);
        const mode = window.confirm(
          `${cleaned.length} contract(s) mili hain JSON mein.\n\n` +
          `OK → Existing contracts ke SAATH add karo (duplicates ho sakte hain)\n` +
          `Cancel → REPLACE karo (sab purane hata ke sirf yeh load hogi)`
        );
        if (mode) {
          setContracts((prev: any[]) => [...prev, ...cleaned]);
          notify(`${cleaned.length} contract(s) add ho gaye`);
        } else {
          setContracts(cleaned);
          notify(`${cleaned.length} contract(s) se replace ho gaya`);
        }
      } catch (err) {
        notify("JSON file sahi format mein nahi hai", "error");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };


  return (
    <div className="flex items-center gap-2">
      <input type="file" accept="application/json" ref={fileRef} className="hidden" onChange={importJson} />
      <button onClick={() => fileRef.current?.click()}
        className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50">
        <Upload size={14} /> Import JSON
      </button>
      <button onClick={exportJson}
        className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50">
        <Download size={14} /> Export JSON
      </button>
    </div>
  );
}

/* =================================== MAIN PAGE =================================== */
export function ContractManager() {
  const [contracts, setContracts] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [modal, setModal] = useState<any>(null);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");

  const notify = (msg: string, type = "success") => {
    setToast({ msg, type });
    clearTimeout((notify as any)._t);
    (notify as any)._t = setTimeout(() => setToast(null), 2800);
  };

  // load persisted data once
  useEffect(() => {
    (async () => {
      try {
        const res = await (window as any).storage?.get("contracts-data", false);
        if (res?.value) setContracts(JSON.parse(res.value));
        else setContracts(seedContracts());
      } catch {
        setContracts(seedContracts());
      }
      setLoaded(true);
    })();
  }, []);

  // persist on every change
  useEffect(() => {
    if (!loaded) return;
    (window as any).storage?.set("contracts-data", JSON.stringify(contracts), false).catch(() => {});
  }, [contracts, loaded]);

  const updateContract = (id: string, fn: (c: any) => any) =>
    setContracts((prev) => prev.map((c) => (c.id === id ? fn(c) : c)));

  const saveNewContract = (form: any) => {
    const contract = {
      id: uid(), status: "active", vehicles: [],
      months: [], ...form,
      sanctionedQty: form.sanctionedQty ? +form.sanctionedQty : null,
    };
    setContracts((prev) => [...prev, contract]);
    setModal(null);
    setOpenId(contract.id);
    notify("Contract ban gaya");
  };

  const saveEditContract = (form: any) => {
    setContracts((prev) => prev.map((c) => (c.id === form.id ? { ...c, ...form, sanctionedQty: form.sanctionedQty ? +form.sanctionedQty : null } : c)));
    setModal(null);
    notify("Contract update ho gaya");
  };

  const duplicateContract = (id: string) => {
    const c = contracts.find((x) => x.id === id);
    if (!c) return;
    const copy = { ...c, id: uid(), name: `${c.name} (Renewal)`, months: [] };
    setContracts((prev) => [...prev, copy]);
    notify("Renewal ke liye contract duplicate ho gaya");
  };

  const archiveContract = (id: string) => {
    updateContract(id, (c) => ({ ...c, status: c.status === "active" ? "completed" : "active" }));
  };

  const openContract = contracts.find((c) => c.id === openId);

  const filtered = contracts.filter((c) => {
    const matchesSearch = (c.name + c.firm + c.loaNo).toLowerCase().includes(search.toLowerCase());
    const matchesType = filterType === "all" || c.type === filterType;
    return matchesSearch && matchesType;
  });

  // dashboard stats
  const stats = useMemo(() => {
    const equip = contracts.filter((c) => c.type === "equipment" && c.status === "active");
    const manp = contracts.filter((c) => c.type === "manpower" && c.status === "active");
    let lowCount = 0;
    equip.forEach((c) => {
      const last = c.months.at(-1);
      if (last) {
        const { remaining } = recalcEquipmentMonth(last, c.timeMode);
        if (c.sanctionedQty && remaining / c.sanctionedQty < 0.15) lowCount++;
      }
    });
    let avgAttendance: number | null = null;
    if (manp.length) {
      let p = 0, a = 0;
      manp.forEach((c) => { const last = c.months.at(-1); if (last) { const r = recalcManpowerMonth(last); p += r.totalPresent; a += r.totalAbsent; } });
      avgAttendance = p + a > 0 ? Math.round((p / (p + a)) * 100) : null;
    }
    return { total: contracts.length, equipCount: equip.length, manpCount: manp.length, lowCount, avgAttendance };
  }, [contracts]);

  if (!loaded) return <div className="p-10 text-center text-gray-400 text-sm">Loading contracts…</div>;

  /* ---------------------- DETAIL VIEW ---------------------- */
  if (openContract) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 font-sans">
        <button onClick={() => setOpenId(null)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft size={14} /> Back to Contracts
        </button>

        <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
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

  /* ---------------------- LIST / DASHBOARD VIEW ---------------------- */
  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Contracts</h1>
          <p className="text-sm text-gray-400">Equipment hire aur manpower contracts ek jagah — sab month-wise auto track.</p>
        </div>
        <div className="flex items-center gap-2">
          <ImportExportBar contracts={contracts} setContracts={setContracts} notify={notify} />
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
        <StatCard icon={<AlertTriangle size={16} />} label="Running Low (<15%)" value={stats.lowCount} tone="rose" />
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
          {filtered.map((c) => (
            <ContractCard key={c.id} c={c} onOpen={setOpenId}
              onEdit={(id: string) => setModal({ mode: "edit", contract: contracts.find((x) => x.id === id) })}
              onArchive={archiveContract} onDuplicate={duplicateContract} />
          ))}
        </div>
      )}

      {modal?.mode === "new" && <ContractFormModal onClose={() => setModal(null)} onSave={saveNewContract} />}
      {modal?.mode === "edit" && <ContractFormModal initial={modal.contract} onClose={() => setModal(null)} onSave={saveEditContract} />}
      <Toast toast={toast} />
    </div>
  );
}
