import React, { useState } from "react";
import ReactDOM from "react-dom";
import { X } from "lucide-react";

function Portal({ children }: { children: React.ReactNode }) {
  return ReactDOM.createPortal(children, document.body);
}

export function ContractFormModal({ initial, onClose, onSave }: any) {
  const [draft, setDraft] = useState(
    initial || {
      name: "", firm: "", type: "equipment",
      loaNo: "", loaDate: "", natureOfWork: "",
      sanctionedQty: "", unit: "hr", timeMode: "split"
    }
  );

  return (
    <Portal>
      <div className="fixed z-50 flex items-center justify-center p-4" style={{ top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(17, 24, 39, 0.5)' }}>
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ width: '100%', maxWidth: '450px', maxHeight: '90vh' }}>
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <h3 className="font-bold text-gray-800">{initial ? "Edit Contract" : "New Contract"}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
          </div>
          <div className="p-5 overflow-y-auto space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500">Contract Type</label>
              <select value={draft.type} onChange={e => setDraft({...draft, type: e.target.value})} disabled={!!initial} className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 focus:outline-none">
                <option value="equipment">Equipment Hire</option>
                <option value="manpower">Manpower Supply</option>
              </select>
            </div>
            {draft.type === "equipment" && (
              <div>
                <label className="text-xs font-semibold text-gray-500">Time Mode</label>
                <select value={draft.timeMode} onChange={e => setDraft({...draft, timeMode: e.target.value})} disabled={!!initial} className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 focus:outline-none">
                  <option value="split">Split (B/N & A/N)</option>
                  <option value="continuous">Continuous (In/Out)</option>
                </select>
              </div>
            )}
            <div>
              <label className="text-xs font-semibold text-gray-500">Name</label>
              <input value={draft.name} onChange={e => setDraft({...draft, name: e.target.value})} className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 focus:outline-none" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500">Firm / Agency</label>
              <input value={draft.firm} onChange={e => setDraft({...draft, firm: e.target.value})} className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 focus:outline-none" />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs font-semibold text-gray-500">LOA No.</label>
                <input value={draft.loaNo} onChange={e => setDraft({...draft, loaNo: e.target.value})} className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 focus:outline-none" />
              </div>
              <div className="flex-1">
                <label className="text-xs font-semibold text-gray-500">LOA Date</label>
                <input type="date" value={draft.loaDate} onChange={e => setDraft({...draft, loaDate: e.target.value})} className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 focus:outline-none" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500">Nature of Work</label>
              <textarea value={draft.natureOfWork} onChange={e => setDraft({...draft, natureOfWork: e.target.value})} className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 focus:outline-none resize-none" rows={2} />
            </div>
            {draft.type === "equipment" && (
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-gray-500">Sanctioned Qty</label>
                  <input type="number" value={draft.sanctionedQty} onChange={e => setDraft({...draft, sanctionedQty: e.target.value})} className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 focus:outline-none" />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-semibold text-gray-500">Unit</label>
                  <input value={draft.unit} onChange={e => setDraft({...draft, unit: e.target.value})} className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 focus:outline-none" />
                </div>
              </div>
            )}
          </div>
          <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-200">Cancel</button>
            <button onClick={() => onSave(draft)} className="px-4 py-2 rounded-xl text-sm font-medium bg-blue-600 text-white hover:bg-blue-700">Save Contract</button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
