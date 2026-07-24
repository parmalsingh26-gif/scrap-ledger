import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { RowStatus } from '../pages/McrView';

interface ExportRow {
  id: string;
  section: string;
  type?: string | null;
  lotNo?: string | null;
  material?: string;
  qty?: number | string;
  unit?: string;
  purchaser?: string | null;
  eAuctionDate?: string | null;
  deliveryDate?: string | null;
  status: RowStatus;
  plNo?: string | null;
  scrNo?: string | null;
  date?: string | null;
}

// Helper for status colors in Excel
const getStatusColor = (status: RowStatus) => {
  if (status === 'delivered') return 'FFE0F2FE'; // light blue/emerald
  if (status === 'pending') return 'FFFFEDD5'; // light orange
  if (status === 'cancelled') return 'FFFEE2E2'; // light red
  return 'FFFFFFFF';
};

export async function exportMcrToExcel(rows: ExportRow[]) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Scrap Ledger System';
  wb.created = new Date();
  
  const dateStr = new Date().toLocaleDateString('en-GB');

  const addTitle = (sheet: ExcelJS.Worksheet, title: string, colCount: number, color: string) => {
    sheet.mergeCells(1, 1, 1, colCount);
    const titleCell = sheet.getCell(1, 1);
    titleCell.value = title.toUpperCase();
    titleCell.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getRow(1).height = 35;

    sheet.mergeCells(2, 1, 2, colCount);
    const subCell = sheet.getCell(2, 1);
    subCell.value = `Generated on: ${dateStr} | Scrap Ledger System`;
    subCell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF4B5563' } };
    subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
    subCell.alignment = { vertical: 'middle', horizontal: 'right' };
    sheet.getRow(2).height = 20;
  };

  // Create Summary Sheet
  const summarySheet = wb.addWorksheet('Summary', { properties: { tabColor: { argb: 'FF1F2937' } } });
  addTitle(summarySheet, 'Material Condemnation Report - Overall Summary', 4, 'FF1F2937');
  
  summarySheet.getRow(3).values = ['Section', 'Total Lots', 'Delivered', 'Pending'];
  summarySheet.getRow(3).font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  summarySheet.getRow(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' } };
  summarySheet.getRow(3).height = 25;
  summarySheet.getRow(3).alignment = { vertical: 'middle', horizontal: 'center' };

  summarySheet.columns = [
    { key: 'section', width: 25 },
    { key: 'total', width: 20 },
    { key: 'delivered', width: 20 },
    { key: 'pending', width: 20 },
  ];

  const sections = ['lot', 'coach', 'wta', 'mp'];
  sections.forEach((sec, idx) => {
    const secRows = rows.filter(r => r.section === sec);
    const row = summarySheet.addRow({
      section: sec.toUpperCase(),
      total: secRows.length,
      delivered: secRows.filter(r => r.status === 'delivered').length,
      pending: secRows.filter(r => r.status === 'pending').length,
    });
    row.height = 25;
    row.alignment = { vertical: 'middle', horizontal: 'center' };
    row.font = { name: 'Segoe UI', size: 11 };
    if (idx % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
    
    // Border
    row.eachCell(cell => { cell.border = { bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } } }; });
  });

  // Create detailed sheets for each section
  const sectionConfigs = [
    { id: 'lot', name: 'Lot Material', color: 'FF2563EB' },
    { id: 'coach', name: 'Coach', color: 'FF4F46E5' },
    { id: 'wta', name: 'WTA', color: 'FF059669' },
    { id: 'mp', name: 'M&P', color: 'FF7C3AED' }
  ];

  sectionConfigs.forEach(conf => {
    const sheet = wb.addWorksheet(conf.name, { properties: { tabColor: { argb: conf.color } }, views: [{ state: 'frozen', xSplit: 0, ySplit: 3 }] });
    addTitle(sheet, `MCR Detailed Report - ${conf.name}`, 10, conf.color);

    const headers = ['S.No', 'Type', 'Lot No', 'Material', 'Qty', 'Unit', 'Purchaser', 'Auction Date', 'Delivery Date', 'Status'];
    const headerRow = sheet.getRow(3);
    headerRow.values = headers;
    headerRow.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: conf.color } };
    headerRow.height = 25;
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    
    sheet.columns = [
      { key: 'sno', width: 8 },
      { key: 'type', width: 15 },
      { key: 'lotNo', width: 22 },
      { key: 'material', width: 50 },
      { key: 'qty', width: 12 },
      { key: 'unit', width: 10 },
      { key: 'purchaser', width: 35 },
      { key: 'auctionDate', width: 18 },
      { key: 'deliveryDate', width: 18 },
      { key: 'status', width: 18 },
    ];
    
    // Auto filter
    sheet.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: 10 } };

    const secRows = rows.filter(r => r.section === conf.id);
    secRows.forEach((r, idx) => {
      const row = sheet.addRow({
        sno: idx + 1,
        type: r.type || '—',
        lotNo: r.lotNo || '—',
        material: r.material || '—',
        qty: r.qty,
        unit: r.unit || '—',
        purchaser: r.purchaser || '—',
        auctionDate: r.eAuctionDate || '—',
        deliveryDate: r.deliveryDate || '—',
        status: r.status.toUpperCase()
      });

      row.height = 22;
      row.font = { name: 'Segoe UI', size: 10, color: { argb: 'FF1F2937' } };
      row.alignment = { vertical: 'middle', wrapText: true };
      
      // Zebra striping
      if (idx % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }; // gray-50
      
      // Center alignment for specific columns
      row.getCell('sno').alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell('qty').alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell('unit').alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell('auctionDate').alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell('deliveryDate').alignment = { vertical: 'middle', horizontal: 'center' };

      // Apply status colors with bold text
      const statusCell = row.getCell('status');
      const statusColor = getStatusColor(r.status);
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusColor } };
      statusCell.font = { name: 'Segoe UI', size: 10, bold: true, color: r.status === 'delivered' ? { argb: 'FF047857' } : r.status === 'pending' ? { argb: 'FFB45309' } : { argb: 'FFB91C1C' } };
      statusCell.alignment = { vertical: 'middle', horizontal: 'center' };
      
      // Borders
      row.eachCell((cell) => {
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
        };
      });
    });
  });

  // Export
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ScrapLedger_MCR_Advanced_${new Date().toISOString().split('T')[0]}.xlsx`;
  a.click();
  window.URL.revokeObjectURL(url);
}

export function exportMcrToPdf(rows: ExportRow[]) {
  const doc = new jsPDF('landscape', 'mm', 'a4');
  const dateStr = new Date().toLocaleDateString('en-GB');

  // Title
  doc.setFontSize(22);
  doc.setTextColor(31, 41, 55); // gray-800
  doc.text('Material Condemnation Report (MCR)', 14, 22);
  
  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128); // gray-500
  doc.text(`Generated on: ${dateStr}`, 14, 30);
  doc.text(`Total Lots: ${rows.length}`, 14, 35);

  let startY = 45;

  const sections = [
    { id: 'lot', name: 'Lot Material Position', color: [59, 130, 246] }, // blue-500
    { id: 'coach', name: 'Coach Position', color: [99, 102, 241] }, // indigo-500
    { id: 'wta', name: 'WTA Position', color: [16, 185, 129] }, // emerald-500
    { id: 'mp', name: 'M&P Items', color: [139, 92, 246] } // violet-500
  ];

  sections.forEach((sec) => {
    const secRows = rows.filter(r => r.section === sec.id);
    if (secRows.length === 0) return;

    doc.setFontSize(14);
    doc.setTextColor(sec.color[0], sec.color[1], sec.color[2]);
    doc.text(sec.name, 14, startY);
    startY += 5;

    const tableData = secRows.map((r, i) => [
      i + 1,
      r.lotNo || '-',
      r.material ? (r.material.length > 40 ? r.material.substring(0, 40) + '...' : r.material) : '-',
      `${r.qty} ${r.unit || ''}`,
      r.purchaser ? (r.purchaser.length > 20 ? r.purchaser.substring(0, 20) + '...' : r.purchaser) : '-',
      r.eAuctionDate || '-',
      r.deliveryDate || '-',
      r.status.toUpperCase()
    ]);

    autoTable(doc, {
      startY: startY,
      head: [['S.No', 'Lot No', 'Material', 'Qty', 'Purchaser', 'Auction Date', 'Delivery Date', 'Status']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: sec.color as [number, number, number], textColor: [255, 255, 255] },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 30 },
        2: { cellWidth: 80 },
        3: { cellWidth: 20 },
        4: { cellWidth: 40 },
        5: { cellWidth: 25 },
        6: { cellWidth: 25 },
        7: { cellWidth: 25 }
      },
      didParseCell: function(data) {
        if (data.section === 'body' && data.column.index === 7) {
          if (data.cell.raw === 'DELIVERED') data.cell.styles.textColor = [16, 185, 129];
          if (data.cell.raw === 'PENDING') data.cell.styles.textColor = [245, 158, 11];
          if (data.cell.raw === 'CANCELLED') data.cell.styles.textColor = [239, 68, 68];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    });

    startY = (doc as any).lastAutoTable.finalY + 15;
    
    // Add new page if close to bottom
    if (startY > 170) {
      doc.addPage();
      startY = 20;
    }
  });

  doc.save(`MCR_Report_${new Date().toISOString().split('T')[0]}.pdf`);
}
