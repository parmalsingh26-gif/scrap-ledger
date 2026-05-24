/**
 * BVP Scrap Position — Export Utilities
 * Handles: Print, PDF (single-page mode for summary), Excel, Word
 */

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';

/* ─────────────────────────────────────────
   TYPES
───────────────────────────────────────── */
export interface ExportSummaryRow {
  mo: string;
  ferrous: number; wta: number; nf: number; misc: number; mp_mt: number;
  rs_f: number; rs_w: number; rs_nf: number; rs_m: number; mp_rs: number;
}
export interface ExportSummaryData {
  session: string;
  kpi: { ferrous: number; wta: number; nf: number; misc: number; mp_mt: number; totMT: number; rs_f: number; rs_w: number; rs_nf: number; rs_m: number; mp_rs: number; totRS: number };
  monthly: ExportSummaryRow[];
  target?: { fw: number; nf: number; misc: number; total: number; ach_fw: number; ach_nf: number; ach_misc: number; ach_total: number };
  mpEntries: any[];
}
export interface ExportRecordsData {
  scrap: any[];
  coach: any[];
  survey: any[];
  mp: any[];
}
export interface ExportDashboardData {
  session: string;
  kpis: { label: string; value: string | number; trend?: string }[];
  yearData: Record<string, { ferrous: number; wta: number; nf: number; misc: number; rev: number; pcv: number; ocv: number; mp_mt?: number; mp_rs?: number }>;
}

/* ─────────────────────────────────────────
   COMMON HELPERS
───────────────────────────────────────── */
const today = () => new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

/* ─────────────────────────────────────────
   PDF EXPORT
   singlePage=true → fit entire content on ONE landscape A3 page
   singlePage=false (default) → multi-page A4 landscape
───────────────────────────────────────── */
export async function exportPDF(elementId: string, filename: string, singlePage = false) {
  const element = document.getElementById(elementId);
  if (!element) { alert('Export element not found'); return; }

  const canvas = await html2canvas(element, {
    scale: 1.5,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
  });

  const imgData = canvas.toDataURL('image/png');

  if (singlePage) {
    // Fit entire content onto ONE landscape A4 page, tight margins
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 5;
    const availW = pageW - margin * 2;
    const availH = pageH - margin * 2;
    const imgAspect = canvas.width / canvas.height;
    const pageAspect = availW / availH;

    let drawW: number, drawH: number;
    if (imgAspect > pageAspect) {
      // Content is wider → fit to width
      drawW = availW;
      drawH = availW / imgAspect;
    } else {
      // Content is taller → fit to height
      drawH = availH;
      drawW = availH * imgAspect;
    }
    // Center on page
    const x = margin + (availW - drawW) / 2;
    const y = margin + (availH - drawH) / 2;
    pdf.addImage(imgData, 'PNG', x, y, drawW, drawH);
    pdf.save(filename);
    return;
  }

  // Default: multi-page landscape A4
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const imgW = pageW - 14;
  const imgH = (canvas.height / canvas.width) * imgW;

  let yPos = 7;
  let heightLeft = imgH;

  pdf.addImage(imgData, 'PNG', 7, yPos, imgW, imgH);
  heightLeft -= (pageH - 14);

  while (heightLeft > 0) {
    yPos = heightLeft - imgH + 7;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 7, yPos, imgW, imgH);
    heightLeft -= (pageH - 14);
  }

  pdf.save(filename);
}

/* ─────────────────────────────────────────
   PRINT — opens styled print window
   summaryMode=true → A3 landscape, compact font/padding, one page
───────────────────────────────────────── */
export function printElement(elementId: string, title: string, summaryMode = false) {
  const element = document.getElementById(elementId);
  if (!element) { alert('Print element not found'); return; }

  const printContent = element.innerHTML;
  const win = window.open('', '_blank', 'width=1400,height=900');
  if (!win) { alert('Popup blocked. Please allow popups.'); return; }

  const summaryExtraCSS = summaryMode ? `
    @page { size: A3 landscape; margin: 8mm 10mm; }
    /* Hide session tab buttons and info banner */
    .bvp-info-banner { display: none !important; }
    /* Compact everything */
    body { font-size: 9px !important; }
    table { font-size: 8px !important; }
    th, td { padding: 3px 5px !important; }
    thead th { font-size: 7.5px !important; }
    /* No page breaks inside table */
    .bvp-entries-wrap { break-inside: avoid; }
    table { page-break-inside: avoid; }
    thead { display: table-header-group; }
    tbody tr { page-break-inside: avoid; }
  ` : `
    @media print {
      body { padding: 10mm 12mm; }
      .no-print { display: none !important; }
      table { page-break-inside: auto; }
      thead { display: table-header-group; }
      tbody tr { page-break-inside: avoid; }
    }
  `;

  win.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; padding: 16px; font-family: 'Inter', sans-serif; color: #0f172a; background: #fff; }
    h1,h2,h3,h4,p { margin: 0; }

    .print-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 2px solid #185FA5; }
    .print-header-title { font-size: 17px; font-weight: 800; color: #185FA5; letter-spacing: -0.5px; }
    .print-header-sub { font-size: 10px; color: #64748b; margin-top: 2px; }
    .print-header-meta { text-align: right; font-size: 10px; color: #64748b; }
    .print-header-date { font-weight: 600; color: #0f172a; font-size: 11px; }

    .bvp-kpi-grid { display: grid; grid-template-columns: repeat(auto-fit,minmax(130px,1fr)); gap: 8px; margin-bottom: 14px; }
    .bvp-kpi { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; background: #f8fafc; }
    .bvp-kpi-label { font-size: 9px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 3px; }
    .bvp-kpi-val { font-size: 17px; font-weight: 700; color: #0f172a; }
    .bvp-kpi-trend { font-size: 10px; margin-top: 2px; color: #64748b; }

    .bvp-info-banner { background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 7px; padding: 7px 11px; font-size: 11px; color: #1E40AF; margin-bottom: 12px; }

    .bvp-entries-wrap { border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; margin-bottom: 12px; }
    .bvp-entries-header { padding: 10px 14px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; }
    .bvp-entries-header h3 { font-size: 12px; font-weight: 600; color: #0f172a; }
    .bvp-entries-header p { font-size: 10px; color: #64748b; margin-top: 2px; }

    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    thead th { padding: 6px 9px; background: #1e3a5f; color: #fff; font-weight: 600; font-size: 9.5px; text-transform: uppercase; letter-spacing: .04em; text-align: center; border: 0.5px solid rgba(255,255,255,0.2); white-space: nowrap; }
    tbody td { padding: 6px 9px; border-bottom: 0.5px solid #e2e8f0; color: #0f172a; text-align: right; white-space: nowrap; }
    tbody tr:nth-child(even) { background: #f8fafc; }

    .bvp-badge { display: inline-block; padding: 2px 7px; border-radius: 20px; font-size: 9.5px; font-weight: 600; }
    .bvp-badge-sold { background: #DCFCE7; color: #166534; }
    .bvp-badge-auction { background: #FAEEDA; color: #92400e; }
    .bvp-badge-ns { background: #FEE2E2; color: #991b1b; }
    .bvp-badge-oa { background: #EFF6FF; color: #1d4ed8; }

    .bvp-section-title { font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: .08em; margin: 14px 0 6px; }

    .tgt-good { color: #166534; }
    .tgt-ok   { color: #854F0B; }
    .tgt-bad  { color: #991b1b; }

    .bvp-prog-item { margin-bottom: 8px; }
    .bvp-prog-hd { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px; }
    .bvp-prog-track { background: #e2e8f0; border-radius: 4px; height: 5px; }
    .bvp-prog-fill { height: 5px; border-radius: 4px; }

    .print-footer { margin-top: 14px; padding-top: 8px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 8px; color: #94a3b8; }

    ${summaryExtraCSS}
  </style>
</head>
<body>
  <div class="print-header">
    <div>
      <div class="print-header-title">🚂 BVP Workshop — Scrap Position</div>
      <div class="print-header-sub">${title}</div>
    </div>
    <div class="print-header-meta">
      <div class="print-header-date">${today()}</div>
      <div style="margin-top:2px">Bhavnagar Workshop • Indian Railways</div>
      <div style="color:#185FA5;font-weight:600;margin-top:2px">CONFIDENTIAL</div>
    </div>
  </div>
  ${printContent}
  <div class="print-footer">
    <span>Generated: ${new Date().toLocaleString('en-IN')} | BVP Scrap Position System</span>
    <span>Bhavnagar Workshop — All figures in MT &amp; Rs.</span>
  </div>
</body>
</html>`);
  win.document.close();
  setTimeout(() => { win.print(); }, 800);
}

/* ─────────────────────────────────────────
   EXCEL EXPORT — SUMMARY TABLE
───────────────────────────────────────── */
export function exportSummaryExcel(data: ExportSummaryData) {
  const wb = XLSX.utils.book_new();
  const { session, kpi, monthly, target, mpEntries } = data;

  const summaryRows: any[][] = [];
  summaryRows.push([`BVP Workshop — Monthly Scrap Summary — ${session}`, '', '', '', '', '', '', '', '', '', '', '', '']);
  summaryRows.push([`Generated: ${today()}`, '', '', '', '', '', '', '', '', '', '', '', '']);
  summaryRows.push([]);

  summaryRows.push(['KPI OVERVIEW', '', '', '', '', '', '', '', '', '', '', '', '']);
  summaryRows.push(['MS Ferrous', 'WTA', 'Non-Ferrous', 'Misc', 'M&P Items', 'Grand Total MT', 'Grand Total Rs.', '', '', '', '', '', '']);
  summaryRows.push([
    kpi.ferrous.toFixed(3), kpi.wta.toFixed(3), kpi.nf.toFixed(3), kpi.misc.toFixed(3),
    kpi.mp_mt > 0 ? kpi.mp_mt.toFixed(3) + ' MT' : mpEntries.length + ' nos.',
    kpi.totMT.toFixed(3), Math.round(kpi.totRS),
    '', '', '', '', '', ''
  ]);
  summaryRows.push([]);

  summaryRows.push([
    'Month', 'MS Ferrous (MT)', 'WTA (MT)', 'Non-Ferrous (MT)', 'Misc (MT)', 'Total (MT)', 'M&P Items (MT)',
    'MS Ferrous (Rs)', 'WTA (Rs)', 'Non-Ferrous (Rs)', 'Misc (Rs)', 'Total (Rs)', 'M&P Items (Rs)'
  ]);

  monthly.forEach(m => {
    const tt = m.ferrous + m.wta + m.nf + m.misc;
    const tr = m.rs_f + m.rs_w + m.rs_nf + m.rs_m;
    summaryRows.push([
      m.mo,
      m.ferrous || '', m.wta || '', m.nf || '', m.misc || '', tt || '',
      m.mp_mt > 0 ? m.mp_mt : '',
      m.rs_f || '', m.rs_w || '', m.rs_nf || '', m.rs_m || '', tr || '',
      m.mp_rs > 0 ? m.mp_rs : ''
    ]);
  });

  const totMT = kpi.ferrous + kpi.wta + kpi.nf + kpi.misc;
  const totRS = kpi.rs_f + kpi.rs_w + kpi.rs_nf + kpi.rs_m;
  summaryRows.push([
    'TOTAL',
    kpi.ferrous, kpi.wta, kpi.nf, kpi.misc, totMT, kpi.mp_mt > 0 ? kpi.mp_mt : '',
    kpi.rs_f, kpi.rs_w, kpi.rs_nf, kpi.rs_m, totRS, kpi.mp_rs > 0 ? kpi.mp_rs : ''
  ]);

  if (target) {
    summaryRows.push([]);
    summaryRows.push(['TARGET VS ACHIEVEMENT', '', '', '', '', '', '', '', '', '', '', '', '']);
    summaryRows.push(['Category', 'Target (MT)', 'Achieved (MT)', '%']);
    summaryRows.push(['MS Ferrous+WTA+T.B', target.fw, target.ach_fw, ((target.ach_fw / target.fw) * 100).toFixed(1) + '%']);
    summaryRows.push(['Non-Ferrous', target.nf, target.ach_nf, ((target.ach_nf / target.nf) * 100).toFixed(1) + '%']);
    summaryRows.push(['Misc', target.misc, target.ach_misc, ((target.ach_misc / target.misc) * 100).toFixed(1) + '%']);
    summaryRows.push(['Total', target.total, target.ach_total, ((target.ach_total / target.total) * 100).toFixed(1) + '%']);
  }

  const ws1 = XLSX.utils.aoa_to_sheet(summaryRows);
  ws1['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws1, `Summary-${session}`);

  if (mpEntries.length > 0) {
    const mpRows: any[][] = [];
    mpRows.push([`M&P Items — ${session}`, '', '', '', '', '', '', '', '', '', '']);
    mpRows.push([`Generated: ${today()}`]);
    mpRows.push([]);
    mpRows.push(['Session', 'Date', 'Month', 'Item Description', 'Qty', 'Wt (MT)', 'Lot No.', 'Party', 'Rate (Rs)', 'Amount (Rs)', 'Status', 'Remarks']);
    const MN: Record<string, string> = { '04':'Apr','05':'May','06':'Jun','07':'Jul','08':'Aug','09':'Sep','10':'Oct','11':'Nov','12':'Dec','01':'Jan','02':'Feb','03':'Mar' };
    mpEntries.forEach(r => {
      mpRows.push([r.session, r.date, MN[r.month] || r.month, r.item, r.qty, r.wt || '', r.lot || '', r.party || '', r.rate || '', r.amount || '', r.status, r.remarks || '']);
    });
    const ws2 = XLSX.utils.aoa_to_sheet(mpRows);
    ws2['!cols'] = [{ wch: 9 }, { wch: 12 }, { wch: 7 }, { wch: 30 }, { wch: 6 }, { wch: 8 }, { wch: 18 }, { wch: 20 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'M&P Items');
  }

  XLSX.writeFile(wb, `BVP_Summary_${session}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/* ─────────────────────────────────────────
   EXCEL EXPORT — ALL RECORDS
───────────────────────────────────────── */
export function exportAllRecordsExcel(data: ExportRecordsData) {
  const wb = XLSX.utils.book_new();

  const scrapRows: any[][] = [];
  scrapRows.push(['BVP Workshop — Scrap Disposal Records', '', '', '', '', '', '', '', '']);
  scrapRows.push([`Generated: ${today()}`]);
  scrapRows.push([]);
  scrapRows.push(['Session', 'Date From', 'Date To', 'Type', 'Description', 'Qty (Nos)', 'Total Wt (MT)', 'Party', 'Amount (Rs)', 'Lot No', 'Remarks']);
  data.scrap.forEach(r => {
    scrapRows.push([r.session, r.date_from, r.date_to, r.type, r.desc, r.qty_nos || '', r.wt_total || '', r.party || '', r.amount || '', r.lot || '', r.remarks || '']);
  });
  const ws1 = XLSX.utils.aoa_to_sheet(scrapRows);
  ws1['!cols'] = [{ wch: 9 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 35 }, { wch: 9 }, { wch: 12 }, { wch: 20 }, { wch: 14 }, { wch: 16 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Scrap Records');

  const coachRows: any[][] = [];
  coachRows.push(['BVP Workshop — Coach Condemnation Records', '', '', '', '', '', '']);
  coachRows.push([`Generated: ${today()}`]);
  coachRows.push([]);
  coachRows.push(['Session', 'Sr', 'Coach No', 'Code', 'Category', 'Age', 'Cond By', 'RSO No', 'RSO Date', 'Offer Date', 'Purchaser', 'Sale Amt', 'Status', 'Remarks']);
  data.coach.filter((r: any) => r.sr !== 'AGG').forEach(r => {
    coachRows.push([r.session, r.sr, r.coach_no, r.code, r.cat, r.age, r.cond_by, r.rso || '', r.rso_date || '', r.offer_date || '', r.purchaser || '', r.sale_amt || '', r.status, r.remarks || '']);
  });
  const ws2 = XLSX.utils.aoa_to_sheet(coachRows);
  ws2['!cols'] = [{ wch: 9 }, { wch: 5 }, { wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Coach Records');

  const surveyRows: any[][] = [];
  surveyRows.push(['BVP Workshop — Survey / Auction Records', '', '', '', '', '', '']);
  surveyRows.push([`Generated: ${today()}`]);
  surveyRows.push([]);
  surveyRows.push(['Session', 'Lot No', 'Category', 'Location', 'Description', 'Qty', 'Unit', 'Wt (MT)', 'Offer Date', 'Bid (Rs)', 'Purchaser', 'Status', 'Remarks']);
  data.survey.forEach(r => {
    surveyRows.push([r.session, r.lot, r.category || '', r.location || '', r.desc, r.qty, r.unit, r.wt || '', r.offer_date || '', r.bid || '', r.purchaser || '', r.status, r.remarks || '']);
  });
  const ws3 = XLSX.utils.aoa_to_sheet(surveyRows);
  ws3['!cols'] = [{ wch: 9 }, { wch: 18 }, { wch: 12 }, { wch: 28 }, { wch: 40 }, { wch: 7 }, { wch: 6 }, { wch: 9 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 14 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, ws3, 'Survey Records');

  if (data.mp.length > 0) {
    const mpRows: any[][] = [];
    mpRows.push(['BVP Workshop — M&P Items Records', '', '', '', '', '', '']);
    mpRows.push([`Generated: ${today()}`]);
    mpRows.push([]);
    mpRows.push(['Session', 'Date', 'Month', 'Item', 'Qty', 'Wt (MT)', 'Lot', 'Party', 'Rate', 'Amount (Rs)', 'Status', 'Remarks']);
    const MN: Record<string, string> = { '04':'Apr','05':'May','06':'Jun','07':'Jul','08':'Aug','09':'Sep','10':'Oct','11':'Nov','12':'Dec','01':'Jan','02':'Feb','03':'Mar' };
    data.mp.forEach(r => {
      mpRows.push([r.session, r.date, MN[r.month] || r.month, r.item, r.qty, r.wt || '', r.lot || '', r.party || '', r.rate || '', r.amount || '', r.status, r.remarks || '']);
    });
    const ws4 = XLSX.utils.aoa_to_sheet(mpRows);
    ws4['!cols'] = [{ wch: 9 }, { wch: 12 }, { wch: 7 }, { wch: 30 }, { wch: 6 }, { wch: 8 }, { wch: 18 }, { wch: 20 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws4, 'M&P Items');
  }

  XLSX.writeFile(wb, `BVP_AllRecords_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/* ─────────────────────────────────────────
   EXCEL EXPORT — DASHBOARD
───────────────────────────────────────── */
export function exportDashboardExcel(data: ExportDashboardData) {
  const wb = XLSX.utils.book_new();
  const rows: any[][] = [];

  rows.push([`BVP Workshop — Dashboard Summary — ${data.session}`, '', '', '', '']);
  rows.push([`Generated: ${today()}`]);
  rows.push([]);
  rows.push(['KPI OVERVIEW', '', '', '', '']);
  rows.push(['Label', 'Value', 'Trend', '', '']);
  data.kpis.forEach(k => rows.push([k.label, k.value, k.trend || '', '', '']));
  rows.push([]);
  rows.push(['YEAR-WISE SUMMARY', '', '', '', '']);
  rows.push(['Year', 'MS Ferrous (MT)', 'WTA (MT)', 'Non-Ferrous (MT)', 'Misc (MT)', 'Total (MT)', 'Revenue (L)', 'PCV', 'OCV', 'M&P (MT)', 'M&P (Rs)']);
  Object.entries(data.yearData).sort(([a], [b]) => a.localeCompare(b)).forEach(([yr, d]) => {
    const tot = +(d.ferrous + d.wta + d.nf + d.misc).toFixed(1);
    rows.push([yr, d.ferrous, d.wta, d.nf, d.misc, tot, d.rev, d.pcv, d.ocv, d.mp_mt || '', d.mp_rs || '']);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 6 }, { wch: 6 }, { wch: 10 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws, `Dashboard-${data.session}`);
  XLSX.writeFile(wb, `BVP_Dashboard_${data.session}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/* ─────────────────────────────────────────
   WORD EXPORT — Styled HTML → .doc
───────────────────────────────────────── */
export function exportWord(htmlContent: string, filename: string, title: string) {
  const wordHTML = `<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office'
      xmlns:w='urn:schemas-microsoft-com:office:word'
      xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset='UTF-8' />
  <title>${title}</title>
  <style>
    body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #0f172a; margin: 1cm 2cm; }
    h1 { font-size: 18pt; color: #185FA5; border-bottom: 2pt solid #185FA5; padding-bottom: 4pt; }
    h2 { font-size: 13pt; color: #1e3a5f; margin-top: 14pt; }
    h3 { font-size: 11pt; color: #334155; margin-top: 10pt; }
    p.sub { font-size: 9pt; color: #64748b; }
    table { border-collapse: collapse; width: 100%; font-size: 9pt; margin-bottom: 12pt; }
    th { background: #1e3a5f; color: #fff; padding: 5pt 7pt; font-weight: bold; text-align: center; border: 0.5pt solid #fff; }
    td { padding: 5pt 7pt; border: 0.5pt solid #e2e8f0; color: #0f172a; }
    tr:nth-child(even) td { background: #f8fafc; }
    .footer { font-size: 8pt; color: #94a3b8; margin-top: 20pt; border-top: 0.5pt solid #e2e8f0; padding-top: 4pt; }
  </style>
</head>
<body>
  <h1>🚂 BVP Workshop — Scrap Position</h1>
  <p class="sub">${title} | Generated: ${today()} | Bhavnagar Workshop — Indian Railways</p>
  <hr />
  ${htmlContent}
  <p class="footer">Generated: ${new Date().toLocaleString('en-IN')} | BVP Scrap Position System | All figures in MT &amp; Rs.</p>
</body>
</html>`;

  const blob = new Blob(['\ufeff', wordHTML], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
