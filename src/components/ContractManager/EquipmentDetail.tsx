import React, { useState } from "react";
import { Plus, Trash2, Copy, ChevronsDown, Zap, Printer, Clock, TrendingDown, Gauge, Calendar } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { exportToPDF, exportToExcel } from "../../utils/exportUtils";
import { PrintTemplate } from "../PrintTemplate";
import { 
  uid, MONTH_NAMES, daysInMonth, entryNetHours, recalcEquipmentMonth, entryHours 
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

export function EquipmentDetail({ contract, update, notify }: any) {
  const [selIdx, setSelIdx] = useState(contract.months?.length ? contract.months.length - 1 : 0);
  const idx = Math.min(Math.max(selIdx, 0), Math.max((contract.months?.length || 1) - 1, 0));
  const month = contract.months?.[idx];
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

  const exportPDFLocal = () => exportToPDF(contract, month, used, remaining);
  const exportExcelLocal = () => exportToExcel(contract, month, used, remaining);

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
            <button onClick={exportPDFLocal} className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded">PDF</button>
            <button onClick={exportExcelLocal} className="text-xs px-2 py-1 bg-green-50 hover:bg-green-100 text-green-700 rounded">Excel</button>
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
