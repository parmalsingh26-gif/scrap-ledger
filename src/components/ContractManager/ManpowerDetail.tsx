import React, { useState } from "react";
import { Plus, Users, CheckCircle2, FileWarning, Gauge, Upload, UserPlus, Printer, Zap, X, ChevronsDown, Trash2 } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell } from "recharts";
import { PrintTemplate } from "../PrintTemplate";
import { ImportModal } from "./ImportModal";
import { 
  uid, MONTH_NAMES, daysInMonth, recalcManpowerMonth, cycleOrder, cellStyle, cellShort, attendanceCount
} from "../../utils/contractUtils";

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

export function ManpowerDetail({ contract, update, notify }: any) {
  const [selIdx, setSelIdx] = useState(contract.months?.length ? contract.months.length - 1 : 0);
  const idx = Math.min(Math.max(selIdx, 0), Math.max((contract.months?.length || 1) - 1, 0));
  const month = contract.months?.[idx];
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

  const setDayType = (day: number, type: string) => {
    update((c: any) => ({
      ...c,
      months: c.months.map((m: any, i: number) => {
        if (i !== idx) return m;
        
        let newSundays = m.sundays || [];
        let newHolidays = m.holidays || [];
        let newWorkers = m.workers;

        // Remove from both off-days lists
        newSundays = newSundays.filter((d: number) => d !== day);
        newHolidays = newHolidays.filter((d: number) => d !== day);
        
        if (type === "SUNDAY") {
          newSundays.push(day);
        } else if (type === "HOLIDAY") {
          newHolidays.push(day);
        } else if (type === "P" || type === "A" || type === "CLEAR") {
          // Update all workers
          newWorkers = m.workers.map((w: any) => ({
            ...w,
            attendance: { ...w.attendance, [day]: type === "CLEAR" ? "" : type }
          }));
        }

        return { ...m, sundays: newSundays, holidays: newHolidays, workers: newWorkers };
      }),
    }));
    if (type === "CLEAR") notify(`Day ${day} cleared`);
    else notify(`Day ${day} marked as ${type}`);
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
                <th className="px-2 py-2 text-left bg-gray-50 w-20">Section</th>
                {Array.from({ length: month.totalDays }, (_, i) => i + 1).map((d) => (
                  <th key={d} className="w-7 p-0 font-medium text-center">
                    <div className="relative flex items-center justify-center">
                      <span className="hidden print:inline">{d}</span>
                      <select 
                        className="w-full h-full text-center bg-transparent cursor-pointer outline-none print:hidden hover:bg-gray-200 py-2 text-[11px]"
                        style={{ appearance: 'none', MozAppearance: 'none', WebkitAppearance: 'none' }}
                        title={`Day ${d} options`}
                        value={d}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v !== d.toString()) setDayType(d, v);
                        }}
                      >
                        <option value={d}>{d} ▾</option>
                        <option value="P">✓ All P</option>
                        <option value="A">✗ All A</option>
                        <option value="SUNDAY">S Sunday</option>
                        <option value="HOLIDAY">H Holiday</option>
                        <option value="CLEAR">🧹 Clear All</option>
                      </select>
                    </div>
                  </th>
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
                  <td className="px-2 py-1.5 bg-inherit">
                    <input value={w.section || ""}
                      onChange={e => update((c: any) => ({
                        ...c, months: c.months.map((m: any, i: number) => i !== idx ? m : {
                          ...m, workers: m.workers.map((ww: any) => ww.id === w.id ? { ...ww, section: e.target.value.toUpperCase() } : ww)
                        })
                      }))}
                      placeholder="SECTION"
                      className="font-medium text-gray-500 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-400 focus:outline-none text-[10px] w-16 uppercase" />
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
                <td colSpan={3} className="px-3 py-2 sticky left-0 bg-gray-50">TOTAL / day</td>
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
