import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Helper functions for hours calculation
const hoursBetween = (t1: string, t2: string) => {
  if (!t1 || !t2) return 0;
  const [h1, m1] = t1.split(":").map(Number);
  const [h2, m2] = t2.split(":").map(Number);
  if (Number.isNaN(h1) || Number.isNaN(h2)) return 0;
  let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (diff < 0) diff += 24 * 60;
  return diff / 60;
};

const entryHours = (e: any, timeMode: string) => {
  if (timeMode === "split") {
    return +(hoursBetween(e.inTime, e.outTime) + hoursBetween(e.inTime2, e.outTime2)).toFixed(2);
  }
  return +hoursBetween(e.inTime, e.outTime).toFixed(2);
};

const entryNetHours = (e: any, timeMode: string, restMinsPerEntry: number) => {
  const gross = entryHours(e, timeMode);
  return +(Math.max(0, gross - restMinsPerEntry / 60)).toFixed(2);
};

export const exportToExcel = async (contract: any, month: any, used: number, remaining: number) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(month.label, { pageSetup: { orientation: 'landscape', paperSize: 9 } });

  const isManpower = contract.type === "manpower";
  const isSplit = contract.timeMode === "split";
  const restMins = month.restMins ?? 0;

  if (isManpower) {
    // Form-D Format
    sheet.mergeCells("A1:AL1");
    sheet.getCell("A1").value = "FORM-D";
    sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
    sheet.getCell("A1").font = { bold: true, size: 14 };

    sheet.mergeCells("A2:AL2");
    sheet.getCell("A2").value = "ATTENDANCE REGISTER";
    sheet.getCell("A2").alignment = { horizontal: "center", vertical: "middle" };
    sheet.getCell("A2").font = { bold: true, size: 12 };

    sheet.mergeCells("A3:AL3");
    sheet.getCell("A3").value = "[See Rule 2(1) of the Ease of Compliance to Maintain Registers Under Various Labour Laws Rules, 2017]";
    sheet.getCell("A3").alignment = { horizontal: "center", vertical: "middle" };
    sheet.getCell("A3").font = { size: 9 };

    sheet.mergeCells("A4:J4");
    sheet.getCell("A4").value = `Name of Establishment: ${contract.firm}`;
    sheet.mergeCells("K4:AL4");
    sheet.getCell("K4").value = `Name of Owner: ${contract.firm}      LIN: -`;

    sheet.mergeCells("A5:AL5");
    sheet.getCell("A5").value = `For the Period from ${month.label}`;

    // Columns
    sheet.getCell("A6").value = "Sr.No. in\nEmployee\nRegister";
    sheet.getCell("B6").value = "Name";
    sheet.getCell("C6").value = "Relay or\nSet Work";
    sheet.getCell("D6").value = "Place of\nwork";
    sheet.mergeCells("A6:A8"); sheet.mergeCells("B6:B8"); sheet.mergeCells("C6:C8"); sheet.mergeCells("D6:D8");

    sheet.mergeCells("E6:AI6");
    sheet.getCell("E6").value = "Date";
    sheet.getCell("E6").alignment = { horizontal: "center" };

    // Days 1 to 31
    for (let i = 1; i <= 31; i++) {
      const colLetter = sheet.getColumn(4 + i).letter;
      sheet.getCell(`${colLetter}7`).value = i;
      sheet.getCell(`${colLetter}8`).value = "IN";
      sheet.getColumn(4 + i).width = 4;
    }

    sheet.getCell("AJ6").value = "Summary\nof No. of\ndays";
    sheet.getCell("AK6").value = "Remarks";
    sheet.getCell("AL6").value = "Signature\nof Register";
    sheet.mergeCells("AJ6:AJ8"); sheet.mergeCells("AK6:AK8"); sheet.mergeCells("AL6:AL8");

    sheet.getColumn("A").width = 8;
    sheet.getColumn("B").width = 25;
    sheet.getColumn("C").width = 10;
    sheet.getColumn("D").width = 15;
    sheet.getColumn("AJ").width = 10;
    sheet.getColumn("AK").width = 15;
    sheet.getColumn("AL").width = 15;

    // Data
    let rowIdx = 9;
    contract.workers.forEach((w: any, idx: number) => {
      sheet.getCell(`A${rowIdx}`).value = idx + 1;
      sheet.getCell(`B${rowIdx}`).value = w.name;
      sheet.getCell(`C${rowIdx}`).value = "";
      sheet.getCell(`D${rowIdx}`).value = contract.name;

      for (let i = 1; i <= 31; i++) {
        const d = String(i).padStart(2, "0");
        const dateStr = `${month.year}-${String(month.monthIdx + 1).padStart(2, "0")}-${d}`;
        const colLetter = sheet.getColumn(4 + i).letter;
        const att = w.attendance?.[dateStr];
        sheet.getCell(`${colLetter}${rowIdx}`).value = att === "present" ? "P" : att === "absent" ? "A" : att === "holiday" ? "H" : "";
      }

      // Add a dummy OUT row just to match the visual of Form-D
      sheet.getCell(`E${rowIdx+1}`).value = "OUT";
      for (let i = 2; i <= 31; i++) {
        const colLetter = sheet.getColumn(4 + i).letter;
        sheet.getCell(`${colLetter}${rowIdx+1}`).value = "";
      }
      
      // Merge outer cells for the 2-row block
      sheet.mergeCells(`A${rowIdx}:A${rowIdx+1}`);
      sheet.mergeCells(`B${rowIdx}:B${rowIdx+1}`);
      sheet.mergeCells(`C${rowIdx}:C${rowIdx+1}`);
      sheet.mergeCells(`D${rowIdx}:D${rowIdx+1}`);
      sheet.mergeCells(`AJ${rowIdx}:AJ${rowIdx+1}`);
      sheet.mergeCells(`AK${rowIdx}:AK${rowIdx+1}`);
      sheet.mergeCells(`AL${rowIdx}:AL${rowIdx+1}`);

      // Apply borders and alignment to this block
      for (let r = rowIdx; r <= rowIdx + 1; r++) {
        for (let c = 1; c <= 38; c++) {
          const cell = sheet.getCell(r, c);
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        }
      }
      rowIdx += 2;
    });

    // Header styling
    for (let r = 6; r <= 8; r++) {
      for (let c = 1; c <= 38; c++) {
        const cell = sheet.getCell(r, c);
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.font = { bold: true, size: 9 };
      }
    }

  } else {
    // Equipment Formats (JCB / Tractor)
    sheet.getCell("A1").value = `LOA No.: ${contract.loaNo || "-"} (${contract.loaDate || "-"})`;
    sheet.getCell("A2").value = `Firm : ${contract.firm}`;
    sheet.getCell("A3").value = `Nature of Work : ${contract.natureOfWork} (${contract.name})`;
    sheet.getCell("A4").value = `Qty.: ${contract.sanctionedQty || ""} ${contract.unit}`;
    sheet.getCell("A5").value = `Time Period _____ to _____ (${month.label})`;
    sheet.getCell("A6").value = `Total Previous Remaining Qty. : ${month.previousRemaining}     |     Total used Qty. : ${used}     |     Total Remaining Qty. : ${remaining}`;

    for (let r = 1; r <= 6; r++) {
      sheet.mergeCells(`A${r}:K${r}`);
      sheet.getCell(`A${r}`).font = { size: 10, bold: r <= 3 };
      sheet.getCell(`A${r}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
      sheet.getCell(`A${r}`).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    }

    if (isSplit) {
      // Tractor format
      sheet.getCell("A7").value = "Sr.no.";
      sheet.getCell("B7").value = "Date";
      sheet.getCell("C7").value = "Vehicle Details";
      sheet.getCell("D7").value = "B/N period";
      sheet.getCell("F7").value = "A/N period";
      sheet.getCell("H7").value = "Total Working Hrs.";
      sheet.getCell("I7").value = "Sign. of Firm\nSupervisor/Driv";
      sheet.getCell("J7").value = "Sign. of Railway\nSupervisor";
      sheet.getCell("K7").value = "Sign. Of Controlling\nOfficer & Contractor";

      sheet.mergeCells("A7:A8"); sheet.mergeCells("B7:B8"); sheet.mergeCells("C7:C8");
      sheet.mergeCells("D7:E7"); sheet.mergeCells("F7:G7");
      sheet.mergeCells("H7:H8"); sheet.mergeCells("I7:I8"); sheet.mergeCells("J7:J8"); sheet.mergeCells("K7:K8");

      sheet.getCell("D8").value = "In Time"; sheet.getCell("E8").value = "Out Time";
      sheet.getCell("F8").value = "In Time"; sheet.getCell("G8").value = "Out Time";

      sheet.getColumn("A").width = 8; sheet.getColumn("B").width = 12; sheet.getColumn("C").width = 15;
      sheet.getColumn("D").width = 10; sheet.getColumn("E").width = 10; sheet.getColumn("F").width = 10; sheet.getColumn("G").width = 10;
      sheet.getColumn("H").width = 15; sheet.getColumn("I").width = 20; sheet.getColumn("J").width = 20; sheet.getColumn("K").width = 25;

      let r = 9;
      month.entries.forEach((e: any, idx: number) => {
        sheet.addRow([
          idx + 1, e.date, e.vehicle, e.inTime, e.outTime, e.inTime2, e.outTime2, entryNetHours(e, contract.timeMode, restMins), "", "", ""
        ]);
        r++;
      });
      sheet.addRow(["", "", "", "", "", "", "TOTAL", used, "", "", ""]);

      // Borders
      for (let i = 7; i <= r; i++) {
        for (let c = 1; c <= 11; c++) {
          const cell = sheet.getCell(i, c);
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
          cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
          if (i <= 8) { cell.font = { bold: true }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } }; }
        }
      }
    } else {
      // JCB format
      sheet.getCell("A7").value = "Date";
      sheet.getCell("B7").value = "Vehicle Details";
      sheet.getCell("C7").value = "In Time";
      sheet.getCell("D7").value = "Out Time";
      sheet.getCell("E7").value = "Total Working Hrs.";
      sheet.getCell("F7").value = "Sign. of Firm\nSupervisor/Driver";
      sheet.getCell("G7").value = "Sign. of Railway\nSupervisor";
      sheet.getCell("H7").value = "Sign. Of Controlling\nOfficer & Contractor";

      sheet.getColumn("A").width = 15; sheet.getColumn("B").width = 20; sheet.getColumn("C").width = 12; sheet.getColumn("D").width = 12;
      sheet.getColumn("E").width = 15; sheet.getColumn("F").width = 20; sheet.getColumn("G").width = 20; sheet.getColumn("H").width = 25;

      let r = 8;
      month.entries.forEach((e: any) => {
        sheet.addRow([
          e.date, e.vehicle, e.inTime, e.outTime, entryNetHours(e, contract.timeMode, restMins), "", "", ""
        ]);
        r++;
      });
      sheet.addRow(["", "", "", "TOTAL", used, "", "", ""]);

      // Borders
      for (let i = 7; i <= r; i++) {
        for (let c = 1; c <= 8; c++) {
          const cell = sheet.getCell(i, c);
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
          cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
          if (i === 7) { cell.font = { bold: true }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } }; }
        }
      }
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url;
  a.download = `${contract.name.replace(/[^a-z0-9]/gi, "_")}-${month.label}.xlsx`;
  a.click(); URL.revokeObjectURL(url);
};

export const exportToPDF = (contract: any, month: any, used: number, remaining: number) => {
  const doc = new jsPDF({ orientation: contract.type === "manpower" ? "landscape" : "portrait" });
  const isManpower = contract.type === "manpower";
  const isSplit = contract.timeMode === "split";
  const restMins = month.restMins ?? 0;

  doc.setFontSize(10);
  
  if (isManpower) {
    doc.setFontSize(14);
    doc.text("FORM-D", 140, 15, { align: "center" });
    doc.setFontSize(12);
    doc.text("ATTENDANCE REGISTER", 140, 22, { align: "center" });
    doc.setFontSize(8);
    doc.text("[See Rule 2(1) of the Ease of Compliance to Maintain Registers Under Various Labour Laws Rules, 2017]", 140, 27, { align: "center" });
    doc.setFontSize(10);
    doc.text(`Name of Establishment: ${contract.firm}`, 14, 35);
    doc.text(`Name of Owner: ${contract.firm}    LIN: -`, 150, 35);
    doc.text(`For the Period from ${month.label}`, 14, 42);

    const head = [[
      { content: "Sr.", rowSpan: 2 },
      { content: "Name", rowSpan: 2 },
      { content: "Relay", rowSpan: 2 },
      { content: "Place", rowSpan: 2 },
      { content: "Date", colSpan: 31, styles: { halign: 'center' as const } },
      { content: "Days", rowSpan: 2 },
      { content: "Remarks", rowSpan: 2 },
      { content: "Sign", rowSpan: 2 }
    ], Array.from({length: 31}, (_, i) => String(i + 1))];

    const body: any[] = [];
    contract.workers.forEach((w: any, idx: number) => {
      const row1: any[] = [{ content: idx + 1, rowSpan: 2 }, { content: w.name, rowSpan: 2 }, { content: "", rowSpan: 2 }, { content: contract.name, rowSpan: 2 }];
      const row2: any[] = [];
      
      for (let i = 1; i <= 31; i++) {
        const d = String(i).padStart(2, "0");
        const dateStr = `${month.year}-${String(month.monthIdx + 1).padStart(2, "0")}-${d}`;
        const att = w.attendance?.[dateStr];
        row1.push(att === "present" ? "P" : att === "absent" ? "A" : att === "holiday" ? "H" : "");
        row2.push(""); // empty "OUT" row
      }
      row1.push({ content: "", rowSpan: 2 }, { content: "", rowSpan: 2 }, { content: "", rowSpan: 2 });
      body.push(row1);
      body.push(row2);
    });

    autoTable(doc, {
      startY: 45,
      head: head,
      body: body,
      theme: "grid",
      styles: { fontSize: 7, cellPadding: 1, halign: "center", valign: "middle" },
      headStyles: { fillColor: [200, 200, 200], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0,0,0] },
      bodyStyles: { lineWidth: 0.1, lineColor: [0,0,0] }
    });

  } else {
    doc.setFillColor(245, 245, 245);
    doc.rect(14, 10, 182, 45, "F");
    doc.text(`LOA No.: ${contract.loaNo || "-"} (${contract.loaDate || "-"})`, 16, 16);
    doc.text(`Firm : ${contract.firm}`, 16, 23);
    doc.text(`Nature of Work : ${contract.natureOfWork} (${contract.name})`, 16, 30);
    doc.text(`Qty.: ${contract.sanctionedQty || ""} ${contract.unit}`, 16, 37);
    doc.text(`Time Period _____ to _____ (${month.label})`, 16, 44);
    doc.text(`Total Previous Remaining Qty. : ${month.previousRemaining}  |  Total used Qty. : ${used}  |  Total Remaining Qty. : ${remaining}`, 16, 51);

    if (isSplit) {
      const head = [[
        { content: "Sr.", rowSpan: 2 },
        { content: "Date", rowSpan: 2 },
        { content: "Vehicle", rowSpan: 2 },
        { content: "B/N period", colSpan: 2, styles: { halign: 'center' as const } },
        { content: "A/N period", colSpan: 2, styles: { halign: 'center' as const } },
        { content: "Total Hrs", rowSpan: 2 },
        { content: "Sign Firm", rowSpan: 2 },
        { content: "Sign Rly", rowSpan: 2 },
        { content: "Sign Ctrl", rowSpan: 2 }
      ], ["In", "Out", "In", "Out"]];

      const body = month.entries.map((e: any, idx: number) => [
        idx + 1, e.date, e.vehicle, e.inTime, e.outTime, e.inTime2, e.outTime2, entryNetHours(e, contract.timeMode, restMins), "", "", ""
      ]);

      body.push([{ content: "TOTAL", colSpan: 7, styles: { halign: 'right' as const, fontStyle: 'bold' as const } }, used, "", "", ""]);

      autoTable(doc, {
        startY: 57,
        head: head,
        body: body,
        theme: "grid",
        styles: { fontSize: 8, halign: "center", valign: "middle", cellPadding: 2 },
        headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0,0,0] },
        bodyStyles: { lineWidth: 0.1, lineColor: [0,0,0] }
      });
    } else {
      const head = [["Date", "Vehicle", "In Time", "Out Time", "Total Hrs", "Sign Firm", "Sign Rly", "Sign Ctrl"]];
      const body = month.entries.map((e: any) => [
        e.date, e.vehicle, e.inTime, e.outTime, entryNetHours(e, contract.timeMode, restMins), "", "", ""
      ]);
      body.push([{ content: "TOTAL", colSpan: 4, styles: { halign: 'right' as const, fontStyle: 'bold' as const } }, used, "", "", ""]);

      autoTable(doc, {
        startY: 57,
        head: head,
        body: body,
        theme: "grid",
        styles: { fontSize: 9, halign: "center", valign: "middle", cellPadding: 3 },
        headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0,0,0] },
        bodyStyles: { lineWidth: 0.1, lineColor: [0,0,0] }
      });
    }
  }

  doc.save(`${contract.name.replace(/[^a-z0-9]/gi, "_")}-${month.label}.pdf`);
};
