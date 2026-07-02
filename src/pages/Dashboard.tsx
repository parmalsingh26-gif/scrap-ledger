import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import ExcelJS from 'exceljs';

import { db, useLiveQuery, type Item, type InwardEntry, type OutwardEntry } from '../db/db';
import { cn } from '../lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { WhatsAppReportGenerator } from '../components/WhatsAppReportGenerator';
import { useAuth } from '../components/AuthProvider';
import { EditInwardModal } from '../components/EditInwardModal';
import { EditOutwardModal } from '../components/EditOutwardModal';
import { ScrapChart } from '../components/ScrapChart';
import { CategoryBadge } from '../components/CategoryBadge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export function Dashboard() {
  const items = useLiveQuery(() => db.items.toArray());
  const categories = useLiveQuery(() => db.categories.toArray());
  const units = useLiveQuery(() => db.units.toArray());
  const inwardEntries = useLiveQuery(() => db.inwardEntries.toArray());
  const outwardEntries = useLiveQuery(() => db.outwardEntries.toArray());
  const balances = useLiveQuery(() => db.inventoryBalances.toArray());

  const [historyItem, setHistoryItem] = useState<Item | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const { isAdmin, login } = useAuth();
  const [pinPrompt, setPinPrompt] = useState(false);
  const [pin, setPin] = useState('');
  
  const [editingEntry, setEditingEntry] = useState<InwardEntry | null>(null);
  const [editingOutwardEntry, setEditingOutwardEntry] = useState<OutwardEntry | null>(null);

  // Lock body scroll when history modal is open — keeps modal in viewport center
  useEffect(() => {
    if (historyItem) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [historyItem]);

  // ── ALL useMemo hooks MUST be before any early return ────────────────────
  const unitMap = useMemo(() => new Map((units || []).map(u => [u.id, u.name])), [units]);
  const catMap = useMemo(() => new Map((categories || []).map(c => [c.id, c])), [categories]);

  // Top 5 Materials by Inward quantity
  const topMaterials = useMemo(() => {
    if (!inwardEntries || !items) return [];
    const totals: Record<number, number> = {};
    inwardEntries.forEach(e => {
      totals[e.itemId] = (totals[e.itemId] || 0) + e.quantity;
    });
    return Object.entries(totals)
      .map(([id, qty]) => ({
        name: (items.find(i => i.id === Number(id))?.name || 'Unknown').substring(0, 18),
        qty: Math.round(qty * 10) / 10,
      }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [inwardEntries, items]);

  // Negative balance items
  const negativeBalanceItems = useMemo(() => {
    if (!items || !inwardEntries || !outwardEntries) return [];
    const result: { itemName: string; balance: number; unit: string }[] = [];
    items.forEach(item => {
      const inByUnit: Record<number, number> = {};
      inwardEntries.filter(e => e.itemId === item.id).forEach(e => {
        inByUnit[e.unitId] = (inByUnit[e.unitId] || 0) + e.quantity;
      });
      const outByUnit: Record<number, number> = {};
      outwardEntries.filter(e => e.itemId === item.id).forEach(e => {
        outByUnit[e.unitId] = (outByUnit[e.unitId] || 0) + e.quantity;
      });
      Object.keys(outByUnit).forEach(uid => {
        const u = Number(uid);
        if (inByUnit[u] !== undefined) {
          const bal = (inByUnit[u] || 0) - (outByUnit[u] || 0);
          if (bal < 0) result.push({ itemName: item.name, balance: bal, unit: unitMap.get(u) || '' });
        }
      });
    });
    return result;
  }, [items, inwardEntries, outwardEntries, unitMap]);

  // Activity Feed — last 10 actions
  const activityFeed = useMemo(() => {
    if (!inwardEntries || !outwardEntries || !items) return [];
    const inActions = inwardEntries.map(e => ({
      type: 'INWARD' as const,
      id: e.id,
      itemName: items.find(i => i.id === e.itemId)?.name || 'Unknown',
      qty: e.quantity,
      unit: unitMap.get(e.unitId) || '',
      date: new Date(e.date),
      lot: e.lotNumber,
    }));
    const outActions = outwardEntries.map(e => ({
      type: 'OUTWARD' as const,
      id: e.id,
      itemName: items.find(i => i.id === e.itemId)?.name || 'Unknown',
      qty: e.quantity,
      unit: unitMap.get(e.unitId) || '',
      date: new Date(e.dateDelivered || e.dateSold),
      lot: e.lotNumber,
      firm: e.firmName,
    }));
    return [...inActions, ...outActions]
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 10);
  }, [inwardEntries, outwardEntries, items, unitMap]);
  // ─────────────────────────────────────────────────────────────────────────

  if (!items || !units || !inwardEntries || !outwardEntries || !balances || !categories) return null;

  const handleDeleteEntry = async (id: number) => {
    if (confirm('Are you sure you want to delete this inward entry?')) {
      try {
        await db.inwardEntries.delete(id);
      } catch(err) {
        alert('Failed to delete entry');
      }
    }
  };

  const handleDeleteOutwardEntry = async (id: number) => {
    if (confirm('Are you sure you want to delete this outward entry?')) {
      try {
        await db.outwardEntries.delete(id);
      } catch(err) {
        alert('Failed to delete entry');
      }
    }
  };

  const getHistory = (itemId: number) => {
    const inward = inwardEntries.filter(e => e.itemId === itemId).map(e => ({
      ...e,
      _type: 'INWARD' as const,
      timestamp: new Date(e.date || '1970-01-01').getTime()
    }));
    
    const outward = outwardEntries.filter(e => e.itemId === itemId).map(e => ({
      ...e,
      _type: 'OUTWARD' as const,
      // dateDelivered pe fallback — invalid date se NaN avoid karo
      timestamp: new Date(e.dateDelivered || e.dateSold || '1970-01-01').getTime()
    }));
    
    return [...inward, ...outward].sort((a, b) => b.timestamp - a.timestamp);
  };

  // Calculates automatic balance per unit (inward - outward) where unit exists in both.
  // Returns array like [{ unit: 'Nos', balance: 5 }, ...] or [] if no matching units.
  const calcAutoBalance = (
    itemInwards: typeof inwardEntries,
    itemOutwards: typeof outwardEntries
  ): { unit: string; balance: number }[] => {
    const inTotalsById: Record<number, number> = {};
    itemInwards.forEach(e => {
      inTotalsById[e.unitId] = (inTotalsById[e.unitId] || 0) + e.quantity;
    });
    const outTotalsById: Record<number, number> = {};
    itemOutwards.forEach(e => {
      outTotalsById[e.unitId] = (outTotalsById[e.unitId] || 0) + e.quantity;
    });

    const results: { unit: string; balance: number }[] = [];
    // Only compute for units present in BOTH inward AND outward
    Object.keys(inTotalsById).forEach(uidStr => {
      const uid = Number(uidStr);
      if (outTotalsById[uid] !== undefined) {
        const bal = inTotalsById[uid] - outTotalsById[uid];
        results.push({ unit: unitMap.get(uid) || String(uid), balance: bal });
      }
    });
    return results;
  };

  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Scrap Ledger App';
    workbook.created = new Date();

    // Custom Colors
    const primaryColor = 'FF1E3A8A'; // Dark Blue
    const secondaryColor = 'FFF1F5F9'; // Light Gray
    const accentColor = 'FF2563EB'; // Bright Blue
    const inwardColor = 'FF16A34A'; // Green
    const outwardColor = 'FFDC2626'; // Red
    const textColor = 'FF1E293B'; // Slate 800

    // 1. Create Index Sheet
    const indexSheet = workbook.addWorksheet('Index');
    
    // Title for Index
    indexSheet.mergeCells('A1:E1');
    const titleCell = indexSheet.getCell('A1');
    titleCell.value = 'INVENTORY MASTER INDEX';
    titleCell.font = { name: 'Arial', size: 20, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: primaryColor } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    indexSheet.getRow(1).height = 40;

    indexSheet.addRow([]); // Empty row
    
    // Headers for Index
    const headers = ['S.No.', 'Material Name', 'Category', 'Total Inward', 'Total Outward', 'Approx Balance', 'Action'];
    const headerRow = indexSheet.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: accentColor } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
      };
    });
    headerRow.height = 25;

    indexSheet.columns = [
      { width: 10 },
      { width: 35 },
      { width: 30 },
      { width: 25 },
      { width: 25 },
      { width: 20 },
      { width: 20 }
    ];

    // Build data sheets and populate index
    let sno = 1;
    const sortedItems = [...items].sort((a,b) => a.name.localeCompare(b.name));
    
    for (const item of sortedItems) {
      const cat = catMap.get(item.categoryId);
      const categoryName = cat ? cat.name : 'Unknown';
      
      const itemInwards = inwardEntries.filter(e => e.itemId === item.id);
      const itemOutwards = outwardEntries.filter(e => e.itemId === item.id);
      
      const inStr = Array.from(new Set(itemInwards.map(e => e.unitId))).map(uid => `${itemInwards.filter(e => e.unitId === uid).reduce((sum, e) => sum + e.quantity, 0)} ${unitMap.get(uid)}`).join(' | ');
      const outStr = Array.from(new Set(itemOutwards.map(e => e.unitId))).map(uid => `${itemOutwards.filter(e => e.unitId === uid).reduce((sum, e) => sum + e.quantity, 0)} ${unitMap.get(uid)}`).join(' | ');
      
      const balance = balances.find(b => b.itemId === item.id);
      const balanceStr = balance ? `${balance.approxBalance} ${unitMap.get(balance.unitId)}` : '-';

      // Auto-calculated balance: inward - outward (only where units match)
      const autoBalances = calcAutoBalance(itemInwards, itemOutwards);
      const autoBalStr = autoBalances.length > 0
        ? autoBalances.map(b => `${b.balance} ${b.unit}`).join(' | ')
        : '';

      // Clean sheet name (Excel limits to 31 chars, no special chars)
      // Remove all chars invalid in Excel sheet names: \ / ? * [ ] : and trim
      let safeSheetName = item.name.replace(/[\\/?*\[\]:]/g, '').trim().substring(0, 31).trim();
      // Ensure no duplicate sheet names
      const existingNames = workbook.worksheets.map(ws => ws.name);
      if (existingNames.includes(safeSheetName)) {
        safeSheetName = safeSheetName.substring(0, 28) + `_${sno}`;
      }
      
      // Add Row to Index
      // In index: show auto-balance if available, else manual balance, else '-'
      const indexBalStr = autoBalStr || balanceStr;
      const row = indexSheet.addRow([sno++, item.name, categoryName, inStr || '-', outStr || '-', indexBalStr, 'View Sheet ➡️']);
      
      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Arial', size: 11, color: { argb: textColor } };
        cell.alignment = { vertical: 'middle', horizontal: colNumber > 3 ? 'center' : 'left' };
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } }
        };
        // Add hyperlink to Item Name column and Action column
        if (colNumber === 2 || colNumber === 7) {
          cell.value = {
            text: colNumber === 2 ? item.name : 'View Sheet ➡️',
            hyperlink: `#'${safeSheetName}'!A1`,
            tooltip: `Go to ${item.name} sheet`
          };
          cell.font = { name: 'Arial', size: 11, color: { argb: accentColor }, underline: true, bold: true };
        }
      });
      if (sno % 2 === 1) {
        row.eachCell(cell => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        });
      }

      // --- CREATE INDIVIDUAL ITEM SHEET ---
      const itemSheet = workbook.addWorksheet(safeSheetName);
      
      // Back to Index link
      itemSheet.mergeCells('A1:G1');
      const backCell = itemSheet.getCell('A1');
      backCell.value = { text: '⬅ Back to Index', hyperlink: `#'Index'!A1` };
      backCell.font = { name: 'Arial', size: 12, color: { argb: accentColor }, underline: true, italic: true };
      backCell.alignment = { vertical: 'middle' };
      itemSheet.getRow(1).height = 25;

      // Item Title
      itemSheet.mergeCells('A2:G2');
      const itemTitle = itemSheet.getCell('A2');
      itemTitle.value = `MATERIAL LEDGER: ${item.name.toUpperCase()}`;
      itemTitle.font = { name: 'Arial', size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
      itemTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: primaryColor } };
      itemTitle.alignment = { horizontal: 'center', vertical: 'middle' };
      itemSheet.getRow(2).height = 35;

      // Summary Info
      itemSheet.mergeCells('A3:G3');
      const summaryCell = itemSheet.getCell('A3');
      const summaryBalStr = autoBalStr ? `Calculated Balance: ${autoBalStr}  |  Manual Balance: ${balanceStr}` : `Approx Balance: ${balanceStr}`;
      summaryCell.value = `Category: ${categoryName}  |  Total Inward: ${inStr || '0'}  |  Total Outward: ${outStr || '0'}  |  ${summaryBalStr}`;
      summaryCell.font = { name: 'Arial', size: 12, bold: true, color: { argb: textColor } };
      summaryCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: secondaryColor } };
      summaryCell.alignment = { horizontal: 'center', vertical: 'middle' };
      itemSheet.getRow(3).height = 30;

      itemSheet.addRow([]); // Empty row

      // Entries Table Headers
      // Auto balance row (only when units match)
      if (autoBalances.length > 0) {
        itemSheet.addRow([]); // spacing
        const balLabelRow = itemSheet.addRow(['', 'CALCULATED BALANCE (Inward − Outward)', ...autoBalances.map(b => `${b.balance} ${b.unit}`), '', '', '']);
        balLabelRow.eachCell((cell, col) => {
          if (col === 2) {
            cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF1E3A8A' } };
          } else if (col >= 3 && col < 3 + autoBalances.length) {
            cell.font = { name: 'Arial', size: 12, bold: true, color: { argb: autoBalances[col - 3].balance >= 0 ? 'FF16A34A' : 'FFDC2626' } };
          }
          cell.alignment = { vertical: 'middle', horizontal: col >= 3 ? 'center' : 'left' };
        });
        balLabelRow.height = 22;
        itemSheet.addRow([]); // spacing
      }

      const entryHeaders = ['Date', 'Type', 'Quantity', 'Unit', 'Lot Number', 'Details/Source', 'Firm/Buyer'];
      const eHeaderRow = itemSheet.addRow(entryHeaders);
      eHeaderRow.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: accentColor } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
        };
      });
      eHeaderRow.height = 20;

      itemSheet.columns = [
        { width: 20 },
        { width: 15 },
        { width: 15 },
        { width: 10 },
        { width: 20 },
        { width: 30 },
        { width: 30 }
      ];

      // Combine and sort entries
      const allEntries = [
        ...itemInwards.map(e => ({ ...e, _type: 'INWARD' as const, ts: new Date(e.date).getTime(), dateStr: format(new Date(e.date), 'dd-MMM-yyyy HH:mm') })),
        ...itemOutwards.map(e => ({ ...e, _type: 'OUTWARD' as const, ts: new Date(e.dateDelivered).getTime(), dateStr: format(new Date(e.dateDelivered), 'dd-MMM-yyyy HH:mm') }))
      ].sort((a, b) => a.ts - b.ts);

      let rowNum = 0;
      allEntries.forEach(entry => {
        rowNum++;
        const isOutward = entry._type === 'OUTWARD';
        const qtyStr = isOutward ? `-${entry.quantity}` : `+${entry.quantity}`;
        const unitName = unitMap.get(entry.unitId) || '';
        const lotNumber = (entry as any).lotNumber || '-';
        const details = isOutward ? '-' : `${(entry as any).machineType || ''} ${(entry as any).coverType || ''}`.trim() || '-';
        const firm = isOutward ? (entry as any).firmName : '-';
        
        const row = itemSheet.addRow([
          entry.dateStr,
          entry._type,
          qtyStr,
          unitName,
          lotNumber,
          details,
          firm
        ]);

        row.eachCell((cell, colNumber) => {
          cell.font = { name: 'Arial', size: 10, color: { argb: textColor }, bold: colNumber === 3 };
          cell.alignment = { vertical: 'middle', horizontal: [3, 4, 5].includes(colNumber) ? 'center' : 'left' };
          cell.border = { bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } } };
          
          if (colNumber === 2) {
             cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: isOutward ? outwardColor : inwardColor } };
          }
          if (colNumber === 3) {
             cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: isOutward ? outwardColor : inwardColor } };
          }
        });
        
        if (rowNum % 2 === 0) {
          row.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
          });
        }
      });
      
      if (allEntries.length === 0) {
        const emptyRow = itemSheet.addRow(['No entries found for this material.', '', '', '', '', '', '']);
        itemSheet.mergeCells(`A${emptyRow.number}:G${emptyRow.number}`);
        emptyRow.getCell(1).alignment = { horizontal: 'center' };
        emptyRow.getCell(1).font = { italic: true, color: { argb: 'FF9CA3AF' } };
      }
    }

    // Export using ArrayBuffer and Blob
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Premium_Scrap_Ledger_${format(new Date(), 'yyyy_MM_dd')}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };
  
  const handlePinSubmit = (e: any) => {
    e.preventDefault();
    if(login(pin)) {
       setPinPrompt(false);
       setPin('');
    } else {
       alert("Incorrect PIN");
       setPin('');
    }
  };

  // ── Unit-wise totals for Dashboard KPI (correct representation) ──
  // Mixed units ko directly add karna galat hai, isliye unit-wise dikhao
  const inwardTotalsByUnit: Record<string, number> = {};
  const outwardTotalsByUnit: Record<string, number> = {};
  inwardEntries.forEach(e => {
    const u = unitMap.get(e.unitId) || 'Unknown';
    inwardTotalsByUnit[u] = (inwardTotalsByUnit[u] || 0) + e.quantity;
  });
  outwardEntries.forEach(e => {
    const u = unitMap.get(e.unitId) || 'Unknown';
    outwardTotalsByUnit[u] = (outwardTotalsByUnit[u] || 0) + e.quantity;
  });
  const totalInwardStr = Object.entries(inwardTotalsByUnit).map(([u, v]) => `${v.toFixed(1)} ${u}`).join(' + ') || '0';
  const totalOutwardStr = Object.entries(outwardTotalsByUnit).map(([u, v]) => `${v.toFixed(1)} ${u}`).join(' + ') || '0';
  const totalBalance = balances.reduce((acc, curr) => acc + curr.approxBalance, 0).toFixed(1);

  return (
    <div className="animate-fade-in space-y-6">
      {/* Page Header — Title left, Actions right */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
        <div className="flex-1">
          <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">The Ledger</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">Real-time overview of industrial materials.</p>
        </div>
        <div className="flex gap-2 items-center flex-shrink-0">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-outline text-[16px]">search</span>
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-2 w-36 bg-white/60 border border-outline-variant/30 rounded-lg font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all"
            />
          </div>
          <button onClick={exportToExcel} className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-lg shadow-sm hover:shadow-md hover:from-emerald-600 hover:to-emerald-700 transition-all text-white text-sm font-medium whitespace-nowrap">
            <span className="material-symbols-outlined text-[16px]">download</span>
            Excel
          </button>
        </div>
      </div>

      {/* Stats + WhatsApp — 3 columns in one row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Inward */}
        <div className="glass-card rounded-xl p-4 relative overflow-hidden group hover:shadow-lg transition-shadow duration-300 flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-20 h-20 bg-tertiary-container/10 rounded-full blur-2xl -mr-4 -mt-4"></div>
          <div className="flex justify-between items-start relative z-10">
            <div>
              <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider text-[11px]">Total Inward</p>
              <h3 className="font-display-lg text-display-lg text-on-surface mt-1 text-lg leading-tight break-all">{totalInwardStr}</h3>
            </div>
            <div className="w-8 h-8 rounded-full bg-tertiary-container/20 flex items-center justify-center text-tertiary">
              <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>arrow_downward</span>
            </div>
          </div>
          <div className="mt-6 h-8 flex items-end gap-0.5 relative z-10 opacity-60">
            <div className="flex-1 bg-tertiary/20 h-1/4 rounded-t-sm"></div>
            <div className="flex-1 bg-tertiary/30 h-2/4 rounded-t-sm"></div>
            <div className="flex-1 bg-tertiary/40 h-1/3 rounded-t-sm"></div>
            <div className="flex-1 bg-tertiary/50 h-3/4 rounded-t-sm"></div>
            <div className="flex-1 bg-tertiary/60 h-2/3 rounded-t-sm"></div>
            <div className="flex-1 bg-tertiary h-full rounded-t-sm"></div>
          </div>
        </div>

        {/* Total Outward */}
        <div className="glass-card rounded-xl p-4 relative overflow-hidden group hover:shadow-lg transition-shadow duration-300 flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-20 h-20 bg-secondary-container/10 rounded-full blur-2xl -mr-4 -mt-4"></div>
          <div className="flex justify-between items-start relative z-10">
            <div>
              <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider text-[11px]">Total Outward</p>
              <h3 className="font-display-lg text-display-lg text-on-surface mt-1 text-lg leading-tight break-all">{totalOutwardStr}</h3>
            </div>
            <div className="w-8 h-8 rounded-full bg-secondary-container/20 flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>arrow_upward</span>
            </div>
          </div>
          <div className="mt-6 h-8 flex items-end gap-0.5 relative z-10 opacity-60">
            <div className="flex-1 bg-secondary/80 h-full rounded-t-sm"></div>
            <div className="flex-1 bg-secondary/60 h-3/4 rounded-t-sm"></div>
            <div className="flex-1 bg-secondary/50 h-2/3 rounded-t-sm"></div>
            <div className="flex-1 bg-secondary/30 h-1/3 rounded-t-sm"></div>
            <div className="flex-1 bg-secondary/40 h-2/4 rounded-t-sm"></div>
            <div className="flex-1 bg-secondary/20 h-1/4 rounded-t-sm"></div>
          </div>
        </div>

        {/* WhatsApp card — 3rd column */}
        <div className="col-span-1">
          <WhatsAppReportGenerator />
        </div>
      </div>

      <ScrapChart />

      {/* ── Negative Balance Alert ─────────────────────────────────────── */}
      {negativeBalanceItems.length > 0 && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <span className="material-symbols-outlined text-red-600 text-[22px] flex-shrink-0 mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
          <div>
            <p className="text-sm font-bold text-red-700">⚠️ {negativeBalanceItems.length} item{negativeBalanceItems.length > 1 ? 's mein' : ' mein'} stock negative hai!</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {negativeBalanceItems.map((item, idx) => (
                <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-100 border border-red-200 text-red-800 text-xs font-semibold">
                  <span className="material-symbols-outlined text-[12px]">arrow_downward</span>
                  {item.itemName}: <span className="font-mono font-bold ml-1">{item.balance} {item.unit}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Top Materials + Activity Feed ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Top Materials Chart */}
        <div className="glass-panel rounded-xl shadow-sm p-5">
          <h3 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-primary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>bar_chart</span>
            Top 5 Materials (Inward)
          </h3>
          {topMaterials.length > 0 ? (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topMaterials} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" opacity={0.5} />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#737686' }} />
                  <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#374151' }} width={110} />
                  <Tooltip
                    contentStyle={{ borderRadius: '10px', border: '1px solid #E5E7EB', fontSize: '12px', fontFamily: 'Plus Jakarta Sans' }}
                    formatter={(val: any) => [`${val} units`, 'Inward Qty']}
                  />
                  <Bar dataKey="qty" radius={[0, 6, 6, 0]}>
                    {topMaterials.map((_, index) => (
                      <Cell key={index} fill={['#007d55','#4b41e1','#f59e0b','#ef4444','#8b5cf6'][index % 5]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-52 flex items-center justify-center text-outline text-sm">Koi inward data nahi</div>
          )}
        </div>

        {/* Activity Feed */}
        <div className="glass-panel rounded-xl shadow-sm p-5">
          <h3 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-secondary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>rss_feed</span>
            Live Activity Feed
          </h3>
          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {activityFeed.length === 0 && (
              <div className="text-center text-outline text-sm py-8">Koi activity nahi</div>
            )}
            {activityFeed.map((action, idx) => (
              <div key={idx} className={`flex items-center gap-3 p-2.5 rounded-xl border transition-colors hover:bg-white/50 ${
                action.type === 'INWARD' ? 'border-emerald-100 bg-emerald-50/50' : 'border-violet-100 bg-violet-50/50'
              }`}>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  action.type === 'INWARD' ? 'bg-emerald-100' : 'bg-violet-100'
                }`}>
                  <span className={`material-symbols-outlined text-[14px] ${
                    action.type === 'INWARD' ? 'text-emerald-600' : 'text-violet-600'
                  }`}>{action.type === 'INWARD' ? 'arrow_downward' : 'arrow_upward'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-on-surface truncate">{action.itemName}</p>
                  <p className="text-[10px] text-outline">
                    <span className={`font-bold ${
                      action.type === 'INWARD' ? 'text-emerald-700' : 'text-violet-700'
                    }`}>{action.type === 'INWARD' ? '+' : '-'}{action.qty} {action.unit}</span>
                    {action.type === 'OUTWARD' && (action as any).firm ? ` → ${(action as any).firm}` : ''}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[10px] text-outline">{format(action.date, 'dd MMM')}</p>
                  {action.lot && <p className="text-[9px] text-outline-variant font-mono">{action.lot}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>


      {/* Main Data Table Section */}
      <div className="glass-panel rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-outline-variant/20 flex justify-between items-center bg-white/40">
          <h3 className="font-headline-md text-headline-md text-on-surface">Active Inventory Ledger</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-outline-variant/20 bg-surface-variant/30">
                <th className="px-6 py-4 font-label-md text-label-md text-on-surface-variant font-semibold">Item & Category</th>
                <th className="px-6 py-4 font-label-md text-label-md text-on-surface-variant font-semibold">Total Inward</th>
                <th className="px-6 py-4 font-label-md text-label-md text-on-surface-variant font-semibold">Total Outward</th>
                <th className="px-6 py-4 font-label-md text-label-md text-on-surface-variant font-semibold">Approx Balance</th>
                <th className="px-6 py-4 font-label-md text-label-md text-on-surface-variant font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="font-body-sm text-body-sm">
              {items
                .filter(a => a.name.toLowerCase().includes(searchTerm.toLowerCase()) || catMap.get(a.categoryId)?.name.toLowerCase().includes(searchTerm.toLowerCase()))
                .sort((a,b) => a.name.localeCompare(b.name))
                .map(item => {
                const itemInwards = inwardEntries.filter(e => e.itemId === item.id);
                const itemOutwards = outwardEntries.filter(e => e.itemId === item.id);
                
                const inTotals: Record<string, number> = {};
                itemInwards.forEach(e => {
                  const u = unitMap.get(e.unitId) || 'Unknown';
                  inTotals[u] = (inTotals[u] || 0) + e.quantity;
                });
                
                const outTotals: Record<string, number> = {};
                itemOutwards.forEach(e => {
                  const u = unitMap.get(e.unitId) || 'Unknown';
                  outTotals[u] = (outTotals[u] || 0) + e.quantity;
                });

                // RC/FC breakdown for cover items
                const isCoverItem = item.name.toLowerCase().includes('cover');
                const inRC = isCoverItem ? itemInwards.reduce((s, e) => s + ((e as any).rcCount || 0), 0) : 0;
                const inFC = isCoverItem ? itemInwards.reduce((s, e) => s + ((e as any).fcCount || 0), 0) : 0;
                const outRC = isCoverItem ? itemOutwards.reduce((s, e) => s + ((e as any).rcCount || 0), 0) : 0;
                const outFC = isCoverItem ? itemOutwards.reduce((s, e) => s + ((e as any).fcCount || 0), 0) : 0;

                // Auto balance: inward - outward, only for matching units
                const itemAutoBalances = calcAutoBalance(itemInwards, itemOutwards);

                const balanceRecord = balances.find(b => b.itemId === item.id);
                const cat = catMap.get(item.categoryId);
                const shortCode = item.name.substring(0, 2).toUpperCase();

                return (
                  <tr key={item.id} className="border-b border-outline-variant/10 hover:bg-white/60 hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] hover:scale-[1.002] transition-all duration-200 group cursor-pointer">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center shadow-sm border border-outline-variant/30 flex-shrink-0">
                          <span className="material-symbols-outlined text-outline-variant text-[20px]">category</span>
                        </div>
                        <div className="flex flex-col items-start gap-1.5">
                          <p className="font-headline-md text-on-surface text-[15px]">{item.name}</p>
                          {cat && <CategoryBadge category={cat} />}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {Object.entries(inTotals).length === 0 ? <span className="text-outline">-</span> : 
                        <div className="flex flex-col gap-1">
                          {Object.entries(inTotals).map(([u, val]) => (
                            <div key={u} className="flex flex-col">
                              <span className="font-data-mono font-medium text-on-surface">{val} {u}</span>
                              <span className="text-tertiary text-xs flex items-center"><span className="material-symbols-outlined text-[12px] mr-0.5">arrow_downward</span> IN</span>
                            </div>
                          ))}
                          {/* RC/FC breakdown for cover items */}
                          {isCoverItem && (inRC > 0 || inFC > 0) && (
                            <div className="mt-1 p-1.5 bg-blue-50 border border-blue-100 rounded-lg text-[11px]">
                              {inRC > 0 && <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span><span className="text-blue-700 font-semibold">RC: {inRC} Nos</span></div>}
                              {inFC > 0 && <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500 inline-block"></span><span className="text-purple-700 font-semibold">FC: {inFC} Nos</span></div>}
                              {inRC > 0 && inFC > 0 && <div className="text-gray-500 font-medium border-t border-blue-100 pt-0.5 mt-0.5">Total: {inRC + inFC} Nos</div>}
                            </div>
                          )}
                        </div>
                      }
                    </td>
                    <td className="px-6 py-4">
                      {Object.entries(outTotals).length === 0 ? <span className="text-outline">-</span> : 
                        <div className="flex flex-col gap-1">
                          {Object.entries(outTotals).map(([u, val]) => (
                            <div key={u} className="flex flex-col">
                              <span className="font-data-mono font-medium text-on-surface">{val} {u}</span>
                              <span className="text-secondary text-xs flex items-center"><span className="material-symbols-outlined text-[12px] mr-0.5">arrow_upward</span> OUT</span>
                            </div>
                          ))}
                          {/* RC/FC breakdown for cover items outward */}
                          {isCoverItem && (outRC > 0 || outFC > 0) && (
                            <div className="mt-1 p-1.5 bg-orange-50 border border-orange-100 rounded-lg text-[11px]">
                              {outRC > 0 && <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span><span className="text-blue-700 font-semibold">RC: {outRC} Nos</span></div>}
                              {outFC > 0 && <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500 inline-block"></span><span className="text-purple-700 font-semibold">FC: {outFC} Nos</span></div>}
                              {outRC > 0 && outFC > 0 && <div className="text-gray-500 font-medium border-t border-orange-100 pt-0.5 mt-0.5">Total: {outRC + outFC} Nos</div>}
                            </div>
                          )}
                        </div>
                      }
                    </td>
                    <td className="px-6 py-4">
                      {/* Auto-calculated balance — always visible (units must match) */}
                      {itemAutoBalances.length > 0 && (
                        <div className="mb-2 flex flex-col gap-1">
                          {itemAutoBalances.map(b => (
                            <div key={b.unit} className="flex items-center gap-1.5">
                              <span className={`font-data-mono font-bold text-sm ${
                                b.balance >= 0 ? 'text-emerald-600' : 'text-red-600'
                              }`}>
                                {b.balance >= 0 ? '+' : ''}{b.balance} {b.unit}
                              </span>
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">AUTO</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {isAdmin ? (
                         <BalanceInput 
                           item={item} 
                           initialBalance={balanceRecord?.approxBalance} 
                           initialUnitId={balanceRecord?.unitId}
                           units={units}
                         />
                      ) : (
                         <div 
                           className="flex items-center space-x-2 filter blur-[2px] opacity-70 cursor-pointer select-none"
                           onClick={() => setPinPrompt(true)}
                           title="Click to unlock"
                         >
                           <input type="number" disabled className="glass-input w-20 text-sm rounded py-1 px-2" value={balanceRecord ? balanceRecord.approxBalance : ''} />
                           <select disabled className="glass-input w-20 text-sm rounded py-1 px-2 bg-surface-container-lowest">
                              <option>{balanceRecord ? unitMap.get(balanceRecord.unitId) : 'Unit'}</option>
                           </select>
                         </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => setHistoryItem(item)}
                          className="p-1.5 text-outline hover:text-primary bg-white rounded shadow-sm border border-outline-variant/30" title="History"
                        >
                          <span className="material-symbols-outlined text-[18px]">history</span>
                        </button>
                        <button className="p-1.5 text-outline hover:text-error bg-white rounded shadow-sm border border-outline-variant/30" title="Lock" onClick={() => setPinPrompt(true)}>
                          <span className="material-symbols-outlined text-[18px]">{isAdmin ? 'lock_open' : 'lock'}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* PIN Prompt Modal */}
      {pinPrompt && !isAdmin && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-inverse-surface/40 backdrop-blur-sm">
            <div className="glass-card rounded-2xl p-8 max-w-sm w-full text-center flex flex-col items-center relative">
               <button onClick={() => setPinPrompt(false)} className="absolute top-4 right-4 text-outline hover:text-on-surface">
                  <span className="material-symbols-outlined">close</span>
               </button>
               <div className="w-16 h-16 bg-error-container rounded-full flex items-center justify-center mb-6">
                 <span className="material-symbols-outlined text-error" style={{ fontSize: '32px', fontVariationSettings: "'FILL' 1" }}>lock</span>
               </div>
               <h3 className="font-headline-lg text-headline-lg text-on-surface mb-2">Admin Unlock</h3>
               <p className="font-body-md text-body-md text-on-surface-variant mb-6">Enter PIN to edit manual balances.</p>
               <form onSubmit={handlePinSubmit} className="space-y-4 w-full">
                  <input
                     type="password"
                     maxLength={4}
                     value={pin}
                     onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                     className="glass-input w-full text-center tracking-widest text-2xl py-3 rounded-lg focus:outline-none"
                     placeholder="••••"
                     autoFocus
                  />
                  <button type="submit" className="w-full bg-gradient-to-r from-primary-container to-secondary-container text-white font-label-md text-label-md py-3 rounded-lg shadow-md hover:shadow-lg transition-all">
                     Unlock
                  </button>
               </form>
            </div>
         </div>
      )}

      {historyItem && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          {/* Backdrop */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.45)',
              backdropFilter: 'blur(4px)',
            }}
            onClick={() => setHistoryItem(null)}
          />
          {/* Modal Box */}
          <div style={{
            position: 'relative',
            width: '100%',
            maxWidth: '600px',
            maxHeight: '88vh',
            background: 'rgba(255,255,255,0.97)',
            borderRadius: '20px',
            boxShadow: '0 25px 60px rgba(0,0,0,0.25)',
            border: '1px solid rgba(255,255,255,0.4)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div className="px-6 py-4 border-b border-outline-variant/20 flex justify-between items-center bg-surface/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
                  <span className="material-symbols-outlined text-primary">history</span>
                </div>
                <div>
                  <h3 className="font-headline-md text-[18px] font-bold text-on-surface leading-tight">{historyItem.name}</h3>
                  <p className="font-body-sm text-body-sm text-outline text-[12px]">Material History</p>
                </div>
              </div>
              <button className="p-2 text-outline hover:text-on-surface rounded-full hover:bg-surface-variant/50 transition-colors" onClick={() => setHistoryItem(null)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {(() => {
                const timeline = getHistory(historyItem.id!);
                if (timeline.length === 0) return <div className="text-center text-outline py-8 font-body-sm text-body-sm">No records found.</div>;

                // RC/FC totals for cover items
                const isCoverHistory = historyItem.name.toLowerCase().includes('cover');
                const allInwards = timeline.filter(e => e._type === 'INWARD');
                const allOutwards = timeline.filter(e => e._type === 'OUTWARD');
                const totalInRC = allInwards.reduce((s, e) => s + ((e as any).rcCount || 0), 0);
                const totalInFC = allInwards.reduce((s, e) => s + ((e as any).fcCount || 0), 0);
                const totalOutRC = allOutwards.reduce((s, e) => s + ((e as any).rcCount || 0), 0);
                const totalOutFC = allOutwards.reduce((s, e) => s + ((e as any).fcCount || 0), 0);
                const balRC = totalInRC - totalOutRC;
                const balFC = totalInFC - totalOutFC;

                return (
                  <div className="space-y-4">
                    {/* RC/FC Summary Banner for cover items */}
                    {isCoverHistory && (totalInRC > 0 || totalInFC > 0) && (
                      <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50 p-4">
                        <h4 className="text-xs font-bold text-indigo-700 mb-3 flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[14px]">summarize</span>
                          RC / FC Breakdown Summary
                        </h4>
                        <div className="grid grid-cols-3 gap-2">
                          {/* INWARD */}
                          <div className="bg-white rounded-lg p-2.5 border border-blue-100 shadow-sm">
                            <p className="text-[10px] text-gray-400 font-medium uppercase mb-1.5">Total Inward</p>
                            {totalInRC > 0 && <div className="flex items-center gap-1 mb-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span><span className="text-xs font-bold text-blue-700">RC: {totalInRC} Nos</span></div>}
                            {totalInFC > 0 && <div className="flex items-center gap-1 mb-1"><span className="w-2 h-2 rounded-full bg-purple-500"></span><span className="text-xs font-bold text-purple-700">FC: {totalInFC} Nos</span></div>}
                            <div className="text-[11px] font-bold text-gray-600 border-t border-gray-100 pt-1 mt-1">Total: {totalInRC + totalInFC} Nos</div>
                          </div>
                          {/* OUTWARD */}
                          <div className="bg-white rounded-lg p-2.5 border border-orange-100 shadow-sm">
                            <p className="text-[10px] text-gray-400 font-medium uppercase mb-1.5">Total Outward</p>
                            {totalOutRC > 0 && <div className="flex items-center gap-1 mb-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span><span className="text-xs font-bold text-blue-700">RC: {totalOutRC} Nos</span></div>}
                            {totalOutFC > 0 && <div className="flex items-center gap-1 mb-1"><span className="w-2 h-2 rounded-full bg-purple-500"></span><span className="text-xs font-bold text-purple-700">FC: {totalOutFC} Nos</span></div>}
                            <div className="text-[11px] font-bold text-gray-600 border-t border-gray-100 pt-1 mt-1">Total: {totalOutRC + totalOutFC} Nos</div>
                          </div>
                          {/* BALANCE */}
                          <div className="bg-white rounded-lg p-2.5 border border-emerald-100 shadow-sm">
                            <p className="text-[10px] text-gray-400 font-medium uppercase mb-1.5">Balance Left</p>
                            <div className="flex items-center gap-1 mb-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span><span className={`text-xs font-bold ${balRC >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>RC: {balRC} Nos</span></div>
                            <div className="flex items-center gap-1 mb-1"><span className="w-2 h-2 rounded-full bg-purple-500"></span><span className={`text-xs font-bold ${balFC >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>FC: {balFC} Nos</span></div>
                            <div className={`text-[11px] font-bold border-t border-gray-100 pt-1 mt-1 ${(balRC + balFC) >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>Total: {balRC + balFC} Nos</div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="relative pl-4 space-y-8 before:absolute before:inset-y-0 before:left-[23px] before:w-px before:bg-outline-variant/40">
                      {timeline.map((entry, idx) => {
                        const isIdxOutward = entry._type === 'OUTWARD';
                        const u = unitMap.get(entry.unitId) || '';
                        const entryRC = (entry as any).rcCount;
                        const entryFC = (entry as any).fcCount;
                        const hasRCFC = isCoverHistory && (entryRC || entryFC);
                        return (
                          <div key={idx} className="relative pl-8">
                            <div className={cn("absolute left-[-5px] top-1 w-3 h-3 rounded-full ring-4 ring-white z-10", isIdxOutward ? 'bg-secondary' : 'bg-tertiary')}></div>
                            <div className="flex justify-between items-start mb-1">
                              <span className={cn("font-label-md text-label-md font-bold", isIdxOutward ? 'text-secondary' : 'text-tertiary')}>{entry._type}</span>
                              <span className="font-body-sm text-body-sm text-outline text-[12px]">
                                 {isIdxOutward
                                   ? format(new Date((entry as any).dateDelivered), 'MMM d, HH:mm')
                                   : format(new Date((entry as any).date), 'MMM d, HH:mm')
                                 }
                              </span>
                            </div>
                            <div className="bg-surface rounded-lg p-3 border border-outline-variant/20 mt-2 shadow-sm hover:shadow transition-shadow">
                              <div className="flex justify-between items-center">
                                <span className="font-data-mono text-data-mono font-medium">{isIdxOutward ? '-' : '+'}{entry.quantity} {u}</span>
                                <span className="text-xs text-outline font-medium bg-white px-2 py-1 rounded border border-outline-variant/10">{(entry as any).lotNumber || 'No Lot'}</span>
                              </div>

                              {/* RC/FC inline badge for this entry */}
                              {hasRCFC && (
                                <div className="mt-2 flex gap-2 flex-wrap">
                                  {entryRC ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[11px] font-bold border border-blue-200"><span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>RC: {entryRC} Nos</span> : null}
                                  {entryFC ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[11px] font-bold border border-purple-200"><span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>FC: {entryFC} Nos</span> : null}
                                  {entryRC && entryFC ? <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[11px] font-semibold border border-gray-200">= {entryRC + entryFC} Total</span> : null}
                                </div>
                              )}

                              <div className="mt-2 text-xs text-on-surface-variant space-y-1">
                                 {isIdxOutward ? (
                                   <>
                                     {(entry as any).firmName && <p><span className="text-outline">Buyer:</span> <span className="font-medium">{(entry as any).firmName}</span></p>}
                                     {(entry as any).dateSold && <p><span className="text-outline">Date Sold:</span> <span className="font-medium">{(entry as any).dateSold}</span></p>}
                                     <p className="flex items-center gap-1">
                                       <span className="text-outline">Lot Applied:</span>{' '}
                                       {(entry as any).dateLotApplied
                                         ? <span className="font-medium">{(entry as any).dateLotApplied}</span>
                                         : <span className="text-amber-500 font-semibold bg-amber-50 px-1.5 py-0.5 rounded text-[10px] border border-amber-200">Pending</span>}
                                     </p>
                                     {(entry as any).weightPerNos && <p><span className="text-outline">Wt/Nos:</span> <span className="font-medium">{(entry as any).weightPerNos} Kg</span></p>}
                                   </>
                                 ) : (
                                   <>
                                     {(entry as any).machineType && (
                                       <p><span className="text-outline">Machine Type:</span> <span className="font-medium">{(entry as any).machineType}</span></p>
                                     )}
                                   </>
                                 )}
                              </div>

                              {isAdmin && (
                                  <div className="mt-3 pt-2 border-t border-outline-variant/20 flex justify-end space-x-3">
                                    <button onClick={() => isIdxOutward ? setEditingOutwardEntry(entry as OutwardEntry) : setEditingEntry(entry as InwardEntry)} className="text-primary hover:text-primary-container flex items-center text-xs font-label-md transition-colors">
                                      <span className="material-symbols-outlined text-[16px] mr-1">edit</span> Edit
                                    </button>
                                    <button onClick={() => isIdxOutward ? handleDeleteOutwardEntry((entry as any).id) : handleDeleteEntry((entry as any).id)} className="text-error flex items-center hover:text-error-container text-xs font-label-md transition-colors">
                                      <span className="material-symbols-outlined text-[16px] mr-1">delete</span> Delete
                                    </button>
                                  </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="px-6 py-4 border-t border-outline-variant/20 bg-surface/50 flex justify-end">
              <button className="px-4 py-2 bg-white border border-outline-variant/30 text-on-surface font-label-md text-label-md rounded-lg hover:bg-surface-variant/30 transition-colors" onClick={() => setHistoryItem(null)}>
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {editingEntry && historyItem && (
        <EditInwardModal 
          entry={editingEntry}
          item={historyItem}
          onClose={() => setEditingEntry(null)}
        />
      )}

      {editingOutwardEntry && historyItem && (
        <EditOutwardModal 
          entry={editingOutwardEntry}
          item={historyItem}
          onClose={() => setEditingOutwardEntry(null)}
        />
      )}
    </div>
  );
}

function BalanceInput({ 
  item, 
  initialBalance = undefined, 
  initialUnitId = undefined,
  units
}: { 
  item: Item, 
  initialBalance?: number, 
  initialUnitId?: number,
  units: any[] 
}) {
  const [val, setVal] = useState(initialBalance !== undefined ? String(initialBalance) : '');
  const [uId, setUId] = useState(initialUnitId !== undefined ? String(initialUnitId) : '');
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const handleSave = async () => {
    if (!val) {
      if (initialBalance !== undefined) await db.inventoryBalances.delete(item.id!);
      setIsDirty(false);
      return;
    }
    
    const selectedUId = uId || String(units.find(u => u.name === 'MT')?.id || units[0]?.id);
    setUId(selectedUId);

    setSaving(true);
    await db.inventoryBalances.put({
      itemId: item.id!,
      approxBalance: Number(val),
      unitId: Number(selectedUId)
    });
    setSaving(false);
    setIsDirty(false);
  };

  return (
    <div className="flex items-center space-x-2">
      <input 
        type="number" 
        step="0.01"
        placeholder="Qty"
        className="glass-input w-20 text-sm rounded py-1 px-2 font-data-mono focus:outline-none"
        value={val}
        onChange={(e) => {
          setVal(e.target.value);
          setIsDirty(true);
        }}
      />
      <select 
        className="glass-input w-20 text-sm rounded py-1 px-2 focus:outline-none appearance-none"
        value={uId}
        onChange={(e) => {
          setUId(e.target.value);
          setIsDirty(true);
        }}
      >
        <option value="">Unit</option>
        {units.filter(u => ['MT', 'Kg'].includes(u.name)).map(u => (
          <option key={u.id} value={u.id}>{u.name}</option>
        ))}
      </select>
      
      {isDirty && (
        <button 
          onClick={handleSave}
          disabled={saving}
          className="p-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-md transition-colors flex items-center"
        >
          <span className="material-symbols-outlined text-[16px]">save</span>
        </button>
      )}
    </div>
  )
}
