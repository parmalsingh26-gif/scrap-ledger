import React from "react";

export function PrintTemplate({ contract, month, used, remaining }: any) {
  if (!contract || !month) return null;

  const isManpower = contract.type === "manpower";
  const isSplit = contract.timeMode === "split";
  const restMins = month.restMins ?? 0;

  // Helper
  const hoursBetween = (t1: string, t2: string) => {
    if (!t1 || !t2) return 0;
    const [h1, m1] = t1.split(":").map(Number);
    const [h2, m2] = t2.split(":").map(Number);
    if (Number.isNaN(h1) || Number.isNaN(h2)) return 0;
    let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (diff < 0) diff += 24 * 60;
    return diff / 60;
  };
  const entryNetHours = (e: any) => {
    let gross = 0;
    if (isSplit) {
      gross = +(hoursBetween(e.inTime, e.outTime) + hoursBetween(e.inTime2, e.outTime2)).toFixed(2);
    } else {
      gross = +hoursBetween(e.inTime, e.outTime).toFixed(2);
    }
    const deduct = e.noRest ? 0 : restMins;
    return +(Math.max(0, gross - deduct / 60)).toFixed(2);
  };

  if (isManpower) {
    // Calculate per-day present totals for the TOTAL/day print row
    const perDay: Record<number, number> = {};
    for (let d = 1; d <= 31; d++) {
      const isOff = month.sundays?.includes(d) || month.holidays?.includes(d);
      if (isOff) { perDay[d] = 0; continue; }
      perDay[d] = (month.workers || []).reduce(
        (s: number, w: any) => s + (((w.attendance || {})[d] || "").toUpperCase() === "P" ? 1 : 0), 0
      );
    }
    const totalPresent = (month.workers || []).reduce(
      (s: number, w: any) => s + Object.values(w.attendance || {}).filter((v: any) => (v || "").toUpperCase() === "P").length, 0
    );

    return (
      <div className="hidden print:block w-full text-black bg-white" style={{ fontFamily: 'sans-serif' }}>
        <style>{"@page { size: landscape; margin: 10mm; }"}</style>
        <div className="border border-black p-2 mb-2">
          <div className="text-center mb-4">
            <h1 className="font-bold text-sm uppercase">FORM-D</h1>
            <h2 className="font-bold text-sm uppercase">ATTENDANCE REGISTER</h2>
            <p className="text-[10px]">[See Rule 2(1) of the Ease of Compliance to Maintain Registers Under Various Labour Laws Rules, 2017]</p>
          </div>
          
          <div className="flex justify-between items-center text-xs font-bold mb-1 px-1">
            <div>Name of Establishment : {contract.firm}</div>
            <div>Name of Owner : {contract.firm}</div>
            <div>LOA No. : {contract.loaNo || "-"}</div>
          </div>
          <div className="flex text-xs font-bold px-1 mb-2">
            <div>For the Period from {month.monthIdx !== undefined ? `01/${(month.monthIdx + 1).toString().padStart(2, '0')}/${month.year}` : month.label} to {month.monthIdx !== undefined ? `${month.totalDays}/${(month.monthIdx + 1).toString().padStart(2, '0')}/${month.year}` : month.label}</div>
          </div>

          <table className="w-full border-collapse border border-black text-[10px] text-center">
            <thead>
              <tr className="font-bold text-[9px] bg-white">
                <th className="border border-black p-1 w-8">Sr.No. in<br/>Employee<br/>Register</th>
                <th className="border border-black p-1 w-32">Name</th>
                <th className="border border-black p-1 w-16">Relay or Set<br/>Work</th>
                <th className="border border-black p-1 w-24">Place of<br/>work</th>
                <th className="border border-black p-1" colSpan={32}>Date</th>
                <th className="border border-black p-1 w-12" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>Summary of Days<br/>No. of Days</th>
                <th className="border border-black p-1 w-12" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>Remarks No.<br/>of hours</th>
                <th className="border border-black p-1 w-16" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>**Signature<br/>of Register<br/>keeper</th>
              </tr>
              <tr className="font-bold text-[9px] bg-white">
                <th className="border border-black p-0.5" rowSpan={2}>1</th>
                <th className="border border-black p-0.5" rowSpan={2}>2</th>
                <th className="border border-black p-0.5" rowSpan={2}>3</th>
                <th className="border border-black p-0.5" rowSpan={2}>4</th>
                <th className="border border-black p-0.5" colSpan={32}>5</th>
                <th className="border border-black p-0.5" rowSpan={2}>6</th>
                <th className="border border-black p-0.5" rowSpan={2}>7</th>
                <th className="border border-black p-0.5" rowSpan={2}>8</th>
              </tr>
              <tr className="font-bold text-[9px] bg-white">
                <th className="border border-black p-0.5 w-6"></th>
                {Array.from({ length: 31 }, (_, i) => (
                  <th key={i} className="border border-black p-0.5 w-4">{i + 1}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {month.workers?.map((w: any, idx: number) => {
                const presentCount = Object.values(w.attendance || {}).filter(a => a === "P").length;
                return (
                  <React.Fragment key={w.id}>
                    <tr>
                      <td className="border border-black p-1 font-bold text-center" rowSpan={2}>{idx + 1}</td>
                      <td className="border border-black p-1 font-bold text-left px-2" rowSpan={2}>{w.name}</td>
                      <td className="border border-black p-1 text-center" rowSpan={2}></td>
                      <td className="border border-black p-1 text-center" rowSpan={2}>{w.section || contract.name}</td>
                      <td className="border border-black p-0.5 font-bold text-center text-[8px]">IN</td>
                      {Array.from({ length: 31 }, (_, i) => {
                        const d = i + 1;
                        const isOff = month.sundays?.includes(d) || month.holidays?.includes(d);
                        
                        if (isOff) {
                          const text = month.sundays?.includes(d) ? "SUNDAY   " : "HOLIDAY   ";
                          const letter = text[idx % text.length];
                          return (
                            <td key={`in-${i}`} className="border border-black p-1 text-center text-[10px] font-bold text-gray-600 bg-gray-100">
                              {letter}
                            </td>
                          );
                        }
                        
                        let val = w.attendance?.[d] || "";
                        if (val === "SUNDAY") val = "S";
                        if (val === "HOLIDAY") val = "H";
                        const isSpecial = val === "S" || val === "H";
                        return <td key={`in-${i}`} className={`border border-black p-0.5 text-center text-[9px] font-bold ${isSpecial ? 'italic text-gray-600' : ''}`}>{val}</td>;
                      })}
                      <td className="border border-black p-1 font-bold text-center" rowSpan={2}>{presentCount}</td>
                      <td className="border border-black p-1 text-center" rowSpan={2}></td>
                      <td className="border border-black p-1 text-center" rowSpan={2}></td>
                    </tr>
                    <tr>
                      <td className="border border-black p-0.5 font-bold text-center text-[8px]">OUT</td>
                      {Array.from({ length: 31 }, (_, i) => {
                        const d = i + 1;
                        const isOff = month.sundays?.includes(d) || month.holidays?.includes(d);
                        if (isOff) return <td key={`out-${i}`} className="border border-black p-0.5 text-center text-[9px] bg-gray-100"></td>;
                        return <td key={`out-${i}`} className="border border-black p-0.5 text-center text-[9px]"></td>;
                      })}
                    </tr>
                  </React.Fragment>
                );
              })}
              {(!month.workers || month.workers.length === 0) && (
                <tr>
                  <td colSpan={40} className="border border-black p-4 text-center text-gray-500">No workers found for this month</td>
                </tr>
              )}

              {/* ── TOTAL / day row ── shows per-day present count in each date box */}
              <tr className="font-bold bg-gray-50 text-[9px]">
                <td className="border border-black p-1 text-center font-bold" colSpan={4} style={{ fontSize: '8px' }}>TOTAL / day</td>
                <td className="border border-black p-0.5"></td>
                {Array.from({ length: 31 }, (_, i) => {
                  const d = i + 1;
                  const isOff = month.sundays?.includes(d) || month.holidays?.includes(d);
                  return (
                    <td key={d} className={`border border-black p-0.5 text-center font-bold ${isOff ? 'bg-gray-100 text-gray-400' : 'text-black'}`}>
                      {isOff ? "" : (perDay[d] || "")}
                    </td>
                  );
                })}
                <td className="border border-black p-1 font-bold text-center">{totalPresent}</td>
                <td className="border border-black p-1"></td>
                <td className="border border-black p-1"></td>
              </tr>
            </tbody>
          </table>
          
          <div className="mt-6 flex justify-between px-2 pb-2">
            <div className="text-xs font-bold border-t border-black pt-1 w-48 text-center">Signature of the Contractor's<br/>Representative :</div>
            <div className="flex-1 border border-black ml-4 h-8 flex">
              {Array.from({ length: 31 }, (_, i) => (
                <div key={i} className="flex-1 border-r border-black last:border-r-0"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Equipment (JCB / Tractor)
  return (
    <div className="hidden print:block w-full text-black bg-white" style={{ fontFamily: 'sans-serif' }}>
      <style>{"@page { margin: 10mm; }"}</style>
      <table className="w-full text-[11px] border-collapse border border-black mb-3">
        <tbody>
          <tr><td className="border border-black py-1 px-2 font-semibold bg-gray-100" colSpan={isSplit ? 11 : 8}>LOA No.: {contract.loaNo || "-"} ({contract.loaDate || "-"})</td></tr>
          <tr><td className="border border-black py-1 px-2 font-semibold bg-gray-100" colSpan={isSplit ? 11 : 8}>Firm : {contract.firm}</td></tr>
          <tr><td className="border border-black py-1 px-2 font-semibold bg-gray-100" colSpan={isSplit ? 11 : 8}>Nature of Work : {contract.natureOfWork}</td></tr>
          <tr><td className="border border-black py-1 px-2 font-semibold bg-gray-100" colSpan={isSplit ? 11 : 8}>Qty.: {contract.sanctionedQty || ""} {contract.unit}</td></tr>
          <tr><td className="border border-black py-1 px-2 font-semibold bg-gray-100" colSpan={isSplit ? 11 : 8}>Time Period _____ to _____ ({month.label})</td></tr>
          <tr>
            <td className="border border-black py-1 px-2 bg-gray-100 font-semibold" colSpan={isSplit ? 4 : 3}>Total Previous Remaining Qty. : {month.previousRemaining}</td>
            <td className="border border-black py-1 px-2 bg-gray-100 font-semibold" colSpan={isSplit ? 3 : 2}>Total used Qty. : {used}</td>
            <td className="border border-black py-1 px-2 bg-gray-100 font-semibold" colSpan={isSplit ? 4 : 3}>Total Remaining Qty. : {remaining}</td>
          </tr>
        </tbody>
      </table>

      <table className="w-full text-[10px] border-collapse border border-black text-center">
        <thead>
          <tr className="bg-gray-100 font-bold">
            {isSplit && <th className="border border-black py-1 px-1 w-8" rowSpan={2}>Sr.no.</th>}
            <th className="border border-black py-1 px-1" rowSpan={isSplit ? 2 : 1}>Date</th>
            <th className="border border-black py-1 px-1" rowSpan={isSplit ? 2 : 1}>Vehicle Details</th>
            
            {isSplit ? (
              <>
                <th className="border border-black py-1 px-1" colSpan={2}>B/N period</th>
                <th className="border border-black py-1 px-1" colSpan={2}>A/N period</th>
              </>
            ) : (
              <>
                <th className="border border-black py-1 px-1">In Time</th>
                <th className="border border-black py-1 px-1">Out Time</th>
              </>
            )}

            <th className="border border-black py-1 px-1" rowSpan={isSplit ? 2 : 1}>Total Working Hrs.</th>
            <th className="border border-black py-1 px-1 w-24" rowSpan={isSplit ? 2 : 1}>Sign. of Firm<br/>Supervisor/Driver</th>
            <th className="border border-black py-1 px-1 w-24" rowSpan={isSplit ? 2 : 1}>Sign. of Railway<br/>Supervisor</th>
            <th className="border border-black py-1 px-1 w-32" rowSpan={isSplit ? 2 : 1}>Sign. Of Controlling<br/>Officer & Contractor</th>
          </tr>
          {isSplit && (
            <tr className="bg-gray-100 font-bold">
              <th className="border border-black py-1 px-1">In Time</th>
              <th className="border border-black py-1 px-1">Out Time</th>
              <th className="border border-black py-1 px-1">In Time</th>
              <th className="border border-black py-1 px-1">Out Time</th>
            </tr>
          )}
        </thead>
        <tbody>
          {month.entries?.map((e: any, idx: number) => (
            <tr key={e.id}>
              {isSplit && <td className="border border-black py-0.5 px-1 font-bold">{idx + 1}</td>}
              <td className="border border-black py-0.5 px-1 whitespace-nowrap font-bold">{e.date}</td>
              <td className="border border-black py-0.5 px-1 font-bold">{e.vehicle}</td>
              
              <td className="border border-black py-0.5 px-1 font-bold">{e.inTime}</td>
              <td className="border border-black py-0.5 px-1 font-bold">{e.outTime}</td>
              {isSplit && (
                <>
                  <td className="border border-black py-0.5 px-1 font-bold">{e.inTime2}</td>
                  <td className="border border-black py-0.5 px-1 font-bold">{e.outTime2}</td>
                </>
              )}

              <td className="border border-black py-0.5 px-1 font-bold text-sm">{entryNetHours(e)}</td>
              <td className="border border-black py-0.5 px-1"></td>
              <td className="border border-black py-0.5 px-1"></td>
              <td className="border border-black py-0.5 px-1"></td>
            </tr>
          ))}
          <tr className="font-bold">
            <td className="border border-black py-1 px-1 text-right pr-4" colSpan={isSplit ? 7 : 4}>TOTAL</td>
            <td className="border border-black py-1 px-1 text-center text-base">{used}</td>
            <td className="border border-black py-1 px-1"></td>
            <td className="border border-black py-1 px-1"></td>
            <td className="border border-black py-1 px-1"></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
