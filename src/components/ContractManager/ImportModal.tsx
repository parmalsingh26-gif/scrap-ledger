import React, { useState, useRef } from "react";
import ReactDOM from "react-dom";
import { Upload, X, Plus, Truck, Users, CheckCircle2, Clipboard } from "lucide-react";
import { uid, AI_ATTENDANCE_PROMPT } from "../../utils/contractUtils";

function Portal({ children }: { children: React.ReactNode }) {
  return ReactDOM.createPortal(children, document.body);
}

export function ImportModal({ onClose, onImport, notify }: any) {
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
