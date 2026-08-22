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
    return (
      <div className="hidden print:block w-full text-black bg-white" style={{ fontFamily: 'sans-serif' }}>
        {/* Form-D Layout */}
        <div className="text-center mb-4">
          <h1 className="font-bold text-2xl uppercase tracking-widest">Form-D</h1>
          <h2 className="font-bold text-xl uppercase tracking-wider">Attendance Register</h2>
          <p className="text-xs">[See Rule 2(1) of the Ease of Compliance to Maintain Registers Under Various Labour Laws Rules, 2017]</p>
        </div>
        
        <div className="flex justify-between items-center text-sm font-semibold mb-2">
          <div>Name of Establishment: {contract.firm}</div>
          <div>Name of Owner: {contract.firm} <span className="ml-8">LIN:</span></div>
        </div>
        <div className="text-sm font-semibold mb-4">
          For the Period from {month.label}
        </div>

        <table className="w-full border-collapse border border-black text-[10px] text-center">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-black p-1 w-8" rowSpan={3}>Sr.No.<br/>in<br/>Employee<br/>Register</th>
              <th className="border border-black p-1 w-32" rowSpan={3}>Name</th>
              <th className="border border-black p-1 w-16" rowSpan={3}>Relay or<br/>Set Work</th>
              <th className="border border-black p-1 w-24" rowSpan={3}>Place of<br/>work</th>
              <th className="border border-black p-1" colSpan={31}>Date</th>
              <th className="border border-black p-1 w-12" rowSpan={3}>Summary<br/>of No. of<br/>days</th>
              <th className="border border-black p-1 w-20" rowSpan={3}>Remarks</th>
              <th className="border border-black p-1 w-20" rowSpan={3}>Signature<br/>of Register</th>
            </tr>
            <tr className="bg-gray-100">
              {Array.from({ length: 31 }, (_, i) => (
                <th key={i} className="border border-black p-0.5 w-4 font-bold">{i + 1}</th>
              ))}
            </tr>
            <tr className="bg-gray-100">
              {Array.from({ length: 31 }, (_, i) => (
                <th key={i} className="border border-black p-0.5 font-normal text-[8px]">IN</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {contract.workers?.map((w: any, idx: number) => (
              <React.Fragment key={w.id}>
                <tr>
                  <td className="border border-black p-1 font-bold" rowSpan={2}>{idx + 1}</td>
                  <td className="border border-black p-1 font-bold text-left" rowSpan={2}>{w.name}</td>
                  <td className="border border-black p-1" rowSpan={2}></td>
                  <td className="border border-black p-1" rowSpan={2}>{contract.name}</td>
                  {Array.from({ length: 31 }, (_, i) => {
                    const d = String(i + 1).padStart(2, "0");
                    const dateStr = `${month.year}-${String(month.monthIdx + 1).padStart(2, "0")}-${d}`;
                    const att = w.attendance?.[dateStr];
                    const val = att === "present" ? "P" : att === "absent" ? "A" : att === "holiday" ? "H" : "";
                    return <td key={`in-${i}`} className="border border-black p-0.5 font-bold">{val}</td>;
                  })}
                  <td className="border border-black p-1 font-bold" rowSpan={2}>
                    P: {Object.values(w.attendance || {}).filter(a => a === "present").length}
                  </td>
                  <td className="border border-black p-1" rowSpan={2}></td>
                  <td className="border border-black p-1" rowSpan={2}></td>
                </tr>
                <tr>
                  {Array.from({ length: 31 }, (_, i) => (
                    <td key={`out-${i}`} className="border border-black p-0.5 text-gray-300"></td>
                  ))}
                </tr>
              </React.Fragment>
            ))}
          </tbody>
        </table>
        
        <div className="mt-16 flex justify-between px-8">
          <div className="text-sm font-bold border-t border-black pt-2 w-48 text-center">Signature of Contractor</div>
          <div className="text-sm font-bold border-t border-black pt-2 w-48 text-center">Signature of Principal Employer</div>
        </div>
      </div>
    );
  }

  // Equipment (JCB / Tractor)
  return (
    <div className="hidden print:block w-full text-black bg-white" style={{ fontFamily: 'sans-serif' }}>
      <table className="w-full text-sm border-collapse border border-black mb-4">
        <tbody>
          <tr><td className="border border-black p-1.5 font-semibold bg-gray-100" colSpan={isSplit ? 11 : 8}>LOA No.: {contract.loaNo || "-"} ({contract.loaDate || "-"})</td></tr>
          <tr><td className="border border-black p-1.5 font-semibold bg-gray-100" colSpan={isSplit ? 11 : 8}>Firm : {contract.firm}</td></tr>
          <tr><td className="border border-black p-1.5 font-semibold bg-gray-100" colSpan={isSplit ? 11 : 8}>Nature of Work : {contract.natureOfWork}</td></tr>
          <tr><td className="border border-black p-1.5 font-semibold bg-gray-100" colSpan={isSplit ? 11 : 8}>Qty.: {contract.sanctionedQty || ""} {contract.unit}</td></tr>
          <tr><td className="border border-black p-1.5 font-semibold bg-gray-100" colSpan={isSplit ? 11 : 8}>Time Period _____ to _____ ({month.label})</td></tr>
          <tr>
            <td className="border border-black p-1.5 bg-gray-100 font-semibold" colSpan={isSplit ? 4 : 3}>Total Previous Remaining Qty. : {month.previousRemaining}</td>
            <td className="border border-black p-1.5 bg-gray-100 font-semibold" colSpan={isSplit ? 3 : 2}>Total used Qty. : {used}</td>
            <td className="border border-black p-1.5 bg-gray-100 font-semibold" colSpan={isSplit ? 4 : 3}>Total Remaining Qty. : {remaining}</td>
          </tr>
        </tbody>
      </table>

      <table className="w-full text-[11px] border-collapse border border-black text-center">
        <thead>
          <tr className="bg-gray-100 font-bold">
            {isSplit && <th className="border border-black p-1 w-8" rowSpan={2}>Sr.no.</th>}
            <th className="border border-black p-1" rowSpan={isSplit ? 2 : 1}>Date</th>
            <th className="border border-black p-1" rowSpan={isSplit ? 2 : 1}>Vehicle Details</th>
            
            {isSplit ? (
              <>
                <th className="border border-black p-1" colSpan={2}>B/N period</th>
                <th className="border border-black p-1" colSpan={2}>A/N period</th>
              </>
            ) : (
              <>
                <th className="border border-black p-1">In Time</th>
                <th className="border border-black p-1">Out Time</th>
              </>
            )}

            <th className="border border-black p-1" rowSpan={isSplit ? 2 : 1}>Total Working Hrs.</th>
            <th className="border border-black p-1 w-24" rowSpan={isSplit ? 2 : 1}>Sign. of Firm<br/>Supervisor/Driver</th>
            <th className="border border-black p-1 w-24" rowSpan={isSplit ? 2 : 1}>Sign. of Railway<br/>Supervisor</th>
            <th className="border border-black p-1 w-32" rowSpan={isSplit ? 2 : 1}>Sign. Of Controlling<br/>Officer & Contractor</th>
          </tr>
          {isSplit && (
            <tr className="bg-gray-100 font-bold">
              <th className="border border-black p-1">In Time</th>
              <th className="border border-black p-1">Out Time</th>
              <th className="border border-black p-1">In Time</th>
              <th className="border border-black p-1">Out Time</th>
            </tr>
          )}
        </thead>
        <tbody>
          {month.entries?.map((e: any, idx: number) => (
            <tr key={e.id}>
              {isSplit && <td className="border border-black p-1.5 font-bold">{idx + 1}</td>}
              <td className="border border-black p-1.5 whitespace-nowrap font-bold">{e.date}</td>
              <td className="border border-black p-1.5 font-bold">{e.vehicle}</td>
              
              <td className="border border-black p-1.5 font-bold">{e.inTime}</td>
              <td className="border border-black p-1.5 font-bold">{e.outTime}</td>
              {isSplit && (
                <>
                  <td className="border border-black p-1.5 font-bold">{e.inTime2}</td>
                  <td className="border border-black p-1.5 font-bold">{e.outTime2}</td>
                </>
              )}

              <td className="border border-black p-1.5 font-bold">{entryNetHours(e)}</td>
              <td className="border border-black p-1.5"></td>
              <td className="border border-black p-1.5"></td>
              <td className="border border-black p-1.5"></td>
            </tr>
          ))}
          <tr className="font-bold">
            <td className="border border-black p-1.5 text-right pr-4" colSpan={isSplit ? 7 : 4}>TOTAL</td>
            <td className="border border-black p-1.5 text-center text-lg">{used}</td>
            <td className="border border-black p-1.5"></td>
            <td className="border border-black p-1.5"></td>
            <td className="border border-black p-1.5"></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
