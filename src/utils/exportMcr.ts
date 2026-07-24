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

  // Create Summary Sheet
  const summarySheet = wb.addWorksheet('Summary', { properties: { tabColor: { argb: 'FF0000FF' } } });
  summarySheet.columns = [
    { header: 'Section', key: 'section', width: 20 },
    { header: 'Total Lots', key: 'total', width: 15 },
    { header: 'Delivered', key: 'delivered', width: 15 },
    { header: 'Pending', key: 'pending', width: 15 },
  ];
  
  // Style headers
  summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  summarySheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };

  const sections = ['lot', 'coach', 'wta', 'mp'];
  sections.forEach(sec => {
    const secRows = rows.filter(r => r.section === sec);
    summarySheet.addRow({
      section: sec.toUpperCase(),
      total: secRows.length,
      delivered: secRows.filter(r => r.status === 'delivered').length,
      pending: secRows.filter(r => r.status === 'pending').length,
    });
  });

  // Create detailed sheets for each section
  const sectionConfigs = [
    { id: 'lot', name: 'Lot Material', color: 'FF3B82F6' },
    { id: 'coach', name: 'Coach', color: 'FF6366F1' },
    { id: 'wta', name: 'WTA', color: 'FF10B981' },
    { id: 'mp', name: 'M&P', color: 'FF8B5CF6' }
  ];

  sectionConfigs.forEach(conf => {
    const sheet = wb.addWorksheet(conf.name, { properties: { tabColor: { argb: conf.color } } });
    sheet.columns = [
      { header: 'S.No', key: 'sno', width: 8 },
      { header: 'Type', key: 'type', width: 12 },
      { header: 'Lot No', key: 'lotNo', width: 20 },
      { header: 'Material', key: 'material', width: 45 },
      { header: 'Qty', key: 'qty', width: 12 },
      { header: 'Unit', key: 'unit', width: 10 },
      { header: 'Purchaser', key: 'purchaser', width: 30 },
      { header: 'Auction Date', key: 'auctionDate', width: 15 },
      { header: 'Delivery Date', key: 'deliveryDate', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
    ];

    // Header styling
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: conf.color } };

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

      // Apply status colors
      const color = getStatusColor(r.status);
      row.getCell('status').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
      row.getCell('status').font = { bold: true };
      
      // Borders
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
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
  a.download = `MCR_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
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
