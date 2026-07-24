import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';

import { cn } from '../lib/utils';

const STATUS = ["P","A","LAP","LHAP","CL","LEAVE","1/2 LEAVE","CR","NH","DUTY","SUNDAY",""];
const TS_CATS = ["JE","Gr.-I","Gr.-III","Asst/WS"];
const MONTHS = ["JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE","JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER"];
const CAT_CODE: Record<string,number> = {'JE':1,'Gr.-I':2,'Gr.-III':4,'Asst/WS':5};

interface Day { num: number; isSunday: boolean; }

interface TsOverride { cr?: number; leave?: number; nh?: number; duty?: number; }

interface Employee {
  id: string; sr: number; name: string; pf: string;
  tno: string; category: string; workOrder: string;
  status: string[];
  tsOverride?: TsOverride; // Manual TS overrides (saved to DB)
}

function buildDays(y: number, m: number): Day[] {
  const n = new Date(y, m + 1, 0).getDate();
  return Array.from({length: n}, (_,i) => ({num: i+1, isSunday: new Date(y,m,i+1).getDay()===0}));
}

function getAutoFillUpTo(y: number, m: number, numDays: number): number {
  const now = new Date();
  if (y < now.getFullYear() || (y===now.getFullYear() && m<now.getMonth())) return numDays-1;
  if (y===now.getFullYear() && m===now.getMonth()) return Math.max(-1, now.getDate()-2);
  return -1;
}

function mkEmp(sr:number,name:string,pf:string,tno:string,cat:string,wo:string,days:Day[],fillUpTo:number): Employee {
  return {
    id: crypto.randomUUID(), sr, name, pf, tno, category:cat, workOrder:wo,
    status: days.map((d,i) => d.isSunday?'SUNDAY': i<=fillUpTo?'P': ''),
  };
}

function seedEmployees(days: Day[], fillUpTo: number): Employee[] {
  const emps = [
    mkEmp(1,"AMARSINGH MEENA","50818612313","SSE","JE","30695028",days,fillUpTo),
    mkEmp(2,"PREM PRAKASH MEENA","50818610250","2335/JE","JE","30695028",days,fillUpTo),
    mkEmp(3,"AMAN RAJ KUMAR","50818613469","2628/FTR-I","Gr.-I","30695028",days,fillUpTo),
    mkEmp(4,"MUNESH KUMR MEENA","247IQ130013","2651/FTR-I","Gr.-I","30695028",days,fillUpTo),
    mkEmp(5,"PARMAL SINGH GURJAR","22229804512","2909/FTR-III","Gr.-III","30695028",days,fillUpTo),
    mkEmp(6,"JHUNNA KUMAR","22229804599","2995/FTR-III","Gr.-III","30695028",days,fillUpTo),
    mkEmp(7,"MANNU KUMAR","22229804641","3004/WELD-III","Gr.-III","30695028",days,fillUpTo),
    mkEmp(8,"NAVRATAN KUMAR","22229804671","3025/Asst. WS","Asst/WS","30695028",days,fillUpTo),
  ];
  // Apply leave variety from original HTML (only on already-filled, non-Sunday days)
  const setRange = (ei:number,from:number,to:number,code:string) => {
    const e = emps[ei]; if(!e) return;
    for(let i=from-1; i<to && i<e.status.length; i++)
      if(!days[i].isSunday && i<=fillUpTo) e.status[i]=code;
  };
  setRange(3,17,20,'LAP');  // MUNESH KUMR MEENA — days 17-20
  setRange(5, 6,10,'LAP');  // JHUNNA KUMAR      — days 6-10
  setRange(6, 1, 2,'LAP');  // MANNU KUMAR       — days 1-2
  setRange(7, 1,10,'LHAP'); // NAVRATAN KUMAR    — days 1-10
  return emps;
}

function computeTotals(e: Employee, n: number) {
  const present=e.status.filter(s=>s==='P').length;
  const absent=e.status.filter(s=>s==='A').length;
  const crHrs=e.status.filter(s=>s==='CR').length*8;
  const leaveHrs=e.status.filter(s=>['LEAVE','CL','LAP','LHAP'].includes(s)).length*8 + e.status.filter(s=>s==='1/2 LEAVE').length*4;
  const nhHrs=e.status.filter(s=>s==='NH').length*8;
  const dutyHrs=e.status.filter(s=>s==='DUTY').length*8;
  const sundayCount=e.status.filter(s=>s==='SUNDAY').length;
  const monthDutyHr=(n-sundayCount)*8-absent*8;
  return {present,absent,crHrs,leaveHrs,nhHrs,dutyHrs,totalHrs:crHrs+leaveHrs+nhHrs+dutyHrs,monthDutyHr,sundayCount};
}

/** Effective TS values: uses manual override if set, else computed from daily status */
function getTsVals(e: Employee, days: number) {
  const t = computeTotals(e, days);
  const cr    = e.tsOverride?.cr    ?? t.crHrs;
  const leave = e.tsOverride?.leave ?? t.leaveHrs;
  const nh    = e.tsOverride?.nh    ?? t.nhHrs;
  const duty  = e.tsOverride?.duty  ?? t.dutyHrs;
  return { cr, leave, nh, duty, lncod: cr+leave+nh+duty, total: t.monthDutyHr };
}

function getStatusStyle(v:string) {
  if(v==='P') return 'bg-[#E4F3E9] text-[#2E7D4F] border-[#2E7D4F]';
  if(v==='A') return 'bg-[#FBE7E4] text-[#B23A2E] border-[#B23A2E]';
  if(['LAP','LHAP','CL','LEAVE','1/2 LEAVE'].includes(v)) return 'bg-[#F1E9F4] text-[#6E4A7E] border-[#6E4A7E]';
  if(['CR','DUTY'].includes(v)) return 'bg-[#E3F0EE] text-[#1F7A6C] border-[#1F7A6C]';
  if(v==='SUNDAY') return 'bg-[#ECEAE4] text-[#8A8377] border-[#8A8377]';
  return 'bg-white text-[#12213D] border-[#D8D3C4]';
}

const TH_DARK = "bg-[#12213D] text-white font-['IBM_Plex_Mono',monospace] font-semibold text-[11px] border border-[#D8D3C4] px-1 py-1 whitespace-nowrap";
const TD_TS   = "border border-[#D8D3C4] p-0 text-center text-[11.5px]";
const TD_NE   = "border border-[#D8D3C4] p-1 text-center text-[11.5px]";

/** Editable number cell — shows ⚠ badge when value differs from auto-computed */
function TsCell({val, computed, onChange, onReset}: {val:number; computed:number; onChange:(v:number)=>void; onReset:()=>void}) {
  const mismatch = val !== computed;
  return (
    <div className="relative flex items-center justify-center">
      {mismatch && (
        <button
          title={`Auto-computed: ${computed} hrs. Click to reset.`}
          onClick={onReset}
          className="absolute -top-0.5 -right-0.5 text-[8px] text-[#E0A526] leading-none z-10 hover:text-[#B23A2E] no-print"
        >⚠</button>
      )}
      <input
        type="number" min={0} value={val}
        onChange={e => onChange(Math.max(0, Number(e.target.value)))}
        className={cn(
          "w-full min-w-[42px] text-center border-none text-[11.5px] focus:bg-yellow-50 focus:outline focus:outline-1 focus:outline-[#E0A526] py-1 px-0.5",
          mismatch ? "bg-yellow-50 font-semibold" : "bg-transparent"
        )}
      />
    </div>
  );
}

/** Double-click to edit any text inline */
function InlineEdit({value, onChange, className, printClass}: {value:string; onChange:(v:string)=>void; className?:string; printClass?:string}) {
  const [editing, setEditing] = React.useState(false);
  const [local, setLocal]     = React.useState(value);
  React.useEffect(()=>setLocal(value),[value]);
  if (editing) {
    return (
      <input
        autoFocus
        value={local}
        onChange={e=>setLocal(e.target.value)}
        onBlur={()=>{ onChange(local); setEditing(false); }}
        onKeyDown={e=>{ if(e.key==='Enter'||e.key==='Escape'){onChange(local);setEditing(false);} }}
        className={cn("border border-[#E0A526] bg-white px-1 py-0.5 rounded text-[11.5px] min-w-[60px]", className)}
      />
    );
  }
  return (
    <span
      onDoubleClick={()=>{ setLocal(value); setEditing(true); }}
      title="Double-click to edit"
      className={cn("cursor-text border-b border-dashed border-transparent hover:border-[#E0A526] no-print-editable", className, printClass)}
    >{value}</span>
  );
}

// Default TS header values
const TS_HDR_DEFAULT = { title:'TIME SHEET   PAY GROUP 0827   FOR DIRECT WORKER   BVP WORKSHOP', section:'Scrap', secCode:'632', consignee:'93798', signatory:'SSE/Scrap-BVPW', place:'BVP WORKSHOP' };

export function AttendanceTimesheet() {
  const now = new Date();
  const [year,setYear]   = useState(now.getFullYear());
  const [month,setMonth] = useState(now.getMonth());
  const [days,setDays]   = useState<Day[]>([]);
  const [employees,setEmployees] = useState<Employee[]>([]);
  const [activeTab,setActiveTab] = useState<'entry'|'preview'>('entry');
  const [loading,setLoading]   = useState(false);
  const [saving,setSaving]     = useState(false);
  const [saveErr,setSaveErr]   = useState('');
  const [dataLoaded,setDataLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>|null>(null);

  // ── TS Header (persisted per month via localStorage) ────────────────
  const tsHdrKey = `tsHeader-${year}-${month}`;
  const [tsHdr, setTsHdr] = useState(TS_HDR_DEFAULT);
  const updHdr = (k: keyof typeof TS_HDR_DEFAULT, v: string) =>
    setTsHdr(p => { const n={...p,[k]:v}; localStorage.setItem(tsHdrKey,JSON.stringify(n)); return n; });

  // Load tsHeader when month/year changes
  useEffect(()=>{
    const raw=localStorage.getItem(`tsHeader-${year}-${month}`);
    setTsHdr(raw ? {...TS_HDR_DEFAULT,...JSON.parse(raw)} : TS_HDR_DEFAULT);
  },[year,month]);

  // ── Load from MongoDB ──────────────────────────────────────────────
  const loadMonth = useCallback(async (y:number,m:number,forceSeed=false) => {
    setLoading(true); setDataLoaded(false);
    const nd = buildDays(y,m); setDays(nd);
    const fillUpTo = getAutoFillUpTo(y,m,nd.length);
    try {
      const saved: Employee[] = forceSeed ? [] : await fetch(`/api/attendance/${y}/${m}`).then(r=>r.json());
      if(Array.isArray(saved) && saved.length>0) {
        const aligned = saved.map(e => {
          const s=[...e.status];
          while(s.length<nd.length) s.push('');
          nd.forEach((d,i)=>{ if(d.isSunday&&!s[i]) s[i]='SUNDAY'; });
          return {...e, status:s.slice(0,nd.length)};
        });
        setEmployees(aligned);
      } else {
        setEmployees(seedEmployees(nd,fillUpTo));
      }
    } catch {
      setEmployees(seedEmployees(nd,fillUpTo));
    } finally { setLoading(false); setDataLoaded(true); }
  }, []);

  useEffect(()=>{ loadMonth(year,month); },[]);

  // ── Debounced auto-save ────────────────────────────────────────────
  useEffect(()=>{
    if(!dataLoaded||employees.length===0) return;
    if(saveTimer.current) clearTimeout(saveTimer.current);
    setSaveErr('');
    saveTimer.current = setTimeout(async()=>{
      setSaving(true);
      try {
        const r = await fetch(`/api/attendance/${year}/${month}`,{
          method:'PUT', headers:{'Content-Type':'application/json'},
          body:JSON.stringify({employees}),
        });
        if(!r.ok) throw new Error();
      } catch { setSaveErr('Auto-save failed.'); }
      finally { setSaving(false); }
    },1200);
    return ()=>{ if(saveTimer.current) clearTimeout(saveTimer.current); };
  },[employees,dataLoaded]);

  // ── Controls ──────────────────────────────────────────────────────
  const handleAdd = () => {
    const nd=buildDays(year,month); const fu=getAutoFillUpTo(year,month,nd.length);
    setEmployees(p=>[...p, mkEmp(p.length+1,"NEW EMPLOYEE","","","JE","",nd,fu)]);
  };
  const updField = (id:string,f:keyof Employee,v:string) =>
    setEmployees(p=>p.map(e=>e.id===id?{...e,[f]:v}:e));
  const updStatus = (id:string,di:number,v:string) =>
    setEmployees(p=>p.map(e=>{if(e.id!==id)return e;const s=[...e.status];s[di]=v;return{...e,status:s};}));
  const removeEmp = (id:string) =>
    setEmployees(p=>p.filter(e=>e.id!==id).map((e,i)=>({...e,sr:i+1})));

  // TS override setter — stored on employee, auto-saves to DB
  const setTsOv = (id:string, field:keyof TsOverride, v:number) =>
    setEmployees(p=>p.map(e=>e.id!==id?e:{...e, tsOverride:{...e.tsOverride,[field]:v}}));

  const dailyPres = useMemo(
    ()=>days.map((_,di)=>employees.filter(e=>e.status[di]==='P').length),
    [employees,days]
  );

  // ── Derived TS data ───────────────────────────────────────────────
  const tsEmployees = useMemo(()=>employees.filter(e=>e.tno!=='SSE'),[employees]);
  const workOrders  = useMemo(()=>Array.from(new Set(tsEmployees.map(e=>e.workOrder).filter(Boolean))),[tsEmployees]);
  const tsCatOrder  = useMemo(()=>TS_CATS.filter(c=>tsEmployees.some(e=>e.category===c)),[tsEmployees]);

  // ── PDF Export — Portrait A4, exact TS format ─────────────────────
  const downloadPDF = () => {
    const doc = new jsPDF({orientation:'portrait',format:'a4',unit:'mm'});
    const PW=210, ML=12, MW=PW-ML*2;
    let y = ML;

    // Header
    doc.setFontSize(11);doc.setFont('helvetica','bold');
    doc.text('TIME SHEET   PAY GROUP 0827   FOR DIRECT WORKER   BVP WORKSHOP',PW/2,y,{align:'center'});
    y+=5;
    doc.setFontSize(7.5);doc.setFont('helvetica','normal');
    doc.text(`Date From: 01/${String(month+1).padStart(2,'0')}/${year}     To: ${days.length}/${String(month+1).padStart(2,'0')}/${year}`,ML,y);
    doc.text('Section: Scrap  |  Sec. Code: 632  |  Consignee: 93798',PW-ML,y,{align:'right'});
    y+=5;

    // Per-category tables
    tsCatOrder.forEach(cat=>{
      const rows=tsEmployees.filter(e=>e.category===cat);
      if(!rows.length) return;
      type WoSums={cr:number;leave:number;nh:number;duty:number;lncod:number};
      const wos:Record<string,WoSums>={};
      workOrders.forEach(wo=>{wos[wo]={cr:0,leave:0,nh:0,duty:0,lncod:0};});
      let catTot=0;

      // Two-level header
      const wo0=workOrders[0]||'';
      const head=[
        ['Category','Code','T.No',...workOrders.flatMap(wo=>[wo,'','','','']),'Total'],
        ['','','',...workOrders.flatMap(()=>['CR','LEAVE','NH','ON DUTY','L+NH+CR+ON DUTY']),''],
      ];

      const body:(string|number)[][]=[];
      rows.forEach((e,ri)=>{
        const tv=getTsVals(e,days.length);
        catTot+=tv.total;
        const wo=e.workOrder;
        if(wos[wo]){wos[wo].cr+=tv.cr;wos[wo].leave+=tv.leave;wos[wo].nh+=tv.nh;wos[wo].duty+=tv.duty;wos[wo].lncod+=tv.lncod;}
        body.push([
          ri===0?cat:'', ri===0?(CAT_CODE[cat]??''):'',
          e.tno.split('/')[0],
          ...workOrders.flatMap(wo2=>{
            const is=wo===wo2;
            return [is?tv.cr:'',is?tv.leave:'',is?tv.nh:'',is?tv.duty:'',is?tv.lncod:''];
          }),
          tv.total,
        ]);
      });
      body.push(['Total Hours','',...Array(workOrders.length===0?1:1).fill(''),
        ...workOrders.flatMap(wo2=>[wos[wo2].cr,wos[wo2].leave,wos[wo2].nh,wos[wo2].duty,wos[wo2].lncod]),
        catTot]);

      autoTable(doc,{
        head,body,startY:y,
        styles:{fontSize:6.5,cellPadding:1.1,font:'helvetica'},
        headStyles:{fillColor:[18,33,61],textColor:255,fontStyle:'bold',halign:'center'},
        alternateRowStyles:{fillColor:[245,243,236]},
        bodyStyles:{halign:'center'},
        columnStyles:{0:{halign:'center'},1:{halign:'center'},2:{halign:'center'}},
        margin:{left:ML,right:ML},
      });
      y=(doc as any).lastAutoTable.finalY+3;
    });

    // Grand summary
    y+=2;
    type GS={cr:number;leave:number;nh:number;duty:number;lncod:number};
    const gs:Record<string,GS>={};
    workOrders.forEach(wo=>{gs[wo]={cr:0,leave:0,nh:0,duty:0,lncod:0};});
    const catSummaryRows:(string|number)[][]=[];
    let grandTot=0;
    tsCatOrder.forEach(cat=>{
      const cr2=tsEmployees.filter(e=>e.category===cat);
      const cs2:GS={cr:0,leave:0,nh:0,duty:0,lncod:0};
      let ct2=0;
      cr2.forEach(e=>{
        const tv=getTsVals(e,days.length);
        ct2+=tv.total; grandTot+=tv.total;
        const wo=e.workOrder;
        if(gs[wo]){gs[wo].cr+=tv.cr;gs[wo].leave+=tv.leave;gs[wo].nh+=tv.nh;gs[wo].duty+=tv.duty;gs[wo].lncod+=tv.lncod;}
        if(cs2){cs2.cr+=tv.cr;cs2.leave+=tv.leave;cs2.nh+=tv.nh;cs2.duty+=tv.duty;cs2.lncod+=tv.lncod;}
      });
      catSummaryRows.push([cat,CAT_CODE[cat]??'',
        ...workOrders.flatMap(wo2=>[cs2.cr,cs2.leave,cs2.nh,cs2.duty,cs2.lncod]),ct2]);
    });
    catSummaryRows.push(['Total Hours','',
      ...workOrders.flatMap(wo2=>[gs[wo2].cr,gs[wo2].leave,gs[wo2].nh,gs[wo2].duty,gs[wo2].lncod]),grandTot]);

    const sumHead=[
      ['Category','Code',...workOrders.flatMap(wo=>[wo,'','','','']),'Total'],
      ['','',...workOrders.flatMap(()=>['CR','LEAVE','NH','ON DUTY','L+NH+CR+ON DUTY']),''],
    ];
    autoTable(doc,{
      head:sumHead,body:catSummaryRows,startY:y,
      styles:{fontSize:6.5,cellPadding:1.1,font:'helvetica',fontStyle:'italic'},
      headStyles:{fillColor:[18,33,61],textColor:255,fontStyle:'bold',halign:'center'},
      alternateRowStyles:{fillColor:[245,243,236]},
      bodyStyles:{halign:'center'},
      margin:{left:ML,right:ML},
    });
    y=(doc as any).lastAutoTable.finalY+8;

    // Signature
    doc.setFontSize(8);doc.setFont('helvetica','normal');
    doc.text('SSE/Scrap-BVPW',PW-ML,y,{align:'right'});
    doc.line(PW-ML-38,y+5,PW-ML,y+5);
    doc.setFontSize(7);
    doc.text('Signature & Stamp',PW-ML-19,y+9,{align:'center'});

    doc.save(`TimeSheet-${MONTHS[month]}-${year}.pdf`);
  };

  // ── Excel Export — Styled (ExcelJS) ──────────────────────────────
  const downloadExcel = async () => {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Attendance Register'; wb.created = new Date();

    // ── Shared style helpers ──
    const NAVY='FF12213D', CREAM='FFF5F3EC', CREAM2='FFEFECDF', TOTBG='FFF0EEE6', WHITE='FFFFFFFF';
    const navyFill  = (a?:string): ExcelJS.Fill => ({type:'pattern',pattern:'solid',fgColor:{argb:a||NAVY}});
    const solidFill = (a:string):  ExcelJS.Fill => ({type:'pattern',pattern:'solid',fgColor:{argb:a}});
    const thinBorder = (color='FFD8D3C4'): Partial<ExcelJS.Borders> => ({
      top:{style:'thin',color:{argb:color}}, bottom:{style:'thin',color:{argb:color}},
      left:{style:'thin',color:{argb:color}}, right:{style:'thin',color:{argb:color}},
    });
    const medBorder = (): Partial<ExcelJS.Borders> => ({
      top:{style:'medium',color:{argb:NAVY}}, bottom:{style:'medium',color:{argb:NAVY}},
      left:{style:'medium',color:{argb:NAVY}}, right:{style:'medium',color:{argb:NAVY}},
    });
    const hdrFont  = (sz=9): Partial<ExcelJS.Font> => ({bold:true,size:sz,color:{argb:WHITE},name:'Calibri'});
    const bodyFont = (sz=9,bold=false,color='FF12213D'): Partial<ExcelJS.Font> => ({bold,size:sz,color:{argb:color},name:'Calibri'});
    const ctrAlign: Partial<ExcelJS.Alignment> = {horizontal:'center',vertical:'middle',wrapText:false};
    const leftAlign: Partial<ExcelJS.Alignment> = {horizontal:'left',vertical:'middle'};

    const statusFill = (s:string): ExcelJS.Fill => {
      if(s==='P')       return solidFill('FFE4F3E9');
      if(s==='A')       return solidFill('FFFBE7E4');
      if(['LAP','LHAP','CL','LEAVE','1/2 LEAVE'].includes(s)) return solidFill('FFF1E9F4');
      if(['CR','DUTY'].includes(s)) return solidFill('FFE3F0EE');
      if(s==='SUNDAY')  return solidFill('FFECEAE4');
      return solidFill(WHITE);
    };
    const statusFont = (s:string): Partial<ExcelJS.Font> => {
      if(s==='P')       return {color:{argb:'FF2E7D4F'},bold:true,size:8,name:'Calibri'};
      if(s==='A')       return {color:{argb:'FFB23A2E'},bold:true,size:8,name:'Calibri'};
      if(['LAP','LHAP','CL','LEAVE','1/2 LEAVE'].includes(s)) return {color:{argb:'FF6E4A7E'},bold:true,size:7,name:'Calibri'};
      if(['CR','DUTY'].includes(s)) return {color:{argb:'FF1F7A6C'},bold:true,size:8,name:'Calibri'};
      if(s==='SUNDAY')  return {color:{argb:'FF8A8377'},size:7,name:'Calibri'};
      return {color:{argb:'FF12213D'},size:8,name:'Calibri'};
    };

    // ════════════════════════════════════════════════════════════
    // SHEET 1 — Attendance Register
    // ════════════════════════════════════════════════════════════
    const ws1 = wb.addWorksheet(`Attendance ${MONTHS[month].slice(0,3)} ${year}`, {
      views:[{state:'frozen',ySplit:3}],
      properties:{tabColor:{argb:'FF12213D'}},
    });
    const INFO_COLS = 6; const TOT_COLS = 8; const nDays = days.length;
    const totalC = INFO_COLS + nDays + TOT_COLS;

    // Row 1 — Title
    ws1.mergeCells(1,1,1,totalC);
    const t1 = ws1.getCell(1,1);
    t1.value = `ATTENDANCE REGISTER  —  ${MONTHS[month]} ${year}  |  PAY GROUP 0827  |  BVP WORKSHOP`;
    t1.style = {font:hdrFont(13),fill:navyFill(),alignment:{horizontal:'center',vertical:'middle'},border:medBorder()};
    ws1.getRow(1).height = 24;

    // Row 2 — Sub-info
    ws1.mergeCells(2,1,2,totalC);
    const t2 = ws1.getCell(2,1);
    t2.value = `Section: Scrap  |  Pay Group: 0827  |  Unit: BVP Workshop  |  ${MONTHS[month]} ${year}`;
    t2.style = {font:{...hdrFont(9),bold:false},fill:solidFill('FF1F3560'),alignment:{horizontal:'center',vertical:'middle'},border:medBorder()};
    ws1.getRow(2).height = 16;

    // Row 3 — Column headers
    const dayHeaders = days.map(d => d.num);
    ws1.addRow(['Sr.','Name','PF No.','T.No / Desig.','Category','Work Order',...dayHeaders,'P','A','CR','LV','NH','DT','TOT','MDH']);
    const hRow = ws1.getRow(3); hRow.height = 18;
    hRow.eachCell((cell, col) => {
      const isSunDay = col > INFO_COLS && col <= INFO_COLS+nDays && days[col-INFO_COLS-1].isSunday;
      cell.style = {
        font: hdrFont(isSunDay?8:9),
        fill: isSunDay ? solidFill('FF5B5648') : navyFill(),
        alignment: ctrAlign, border: thinBorder(),
      };
    });

    // Data rows
    employees.forEach((e, ei) => {
      const t = computeTotals(e, days.length);
      const rowData: (string|number)[] = [e.sr,e.name,e.pf,e.tno,e.category,e.workOrder,
        ...e.status, t.present,t.absent,t.crHrs,t.leaveHrs,t.nhHrs,t.dutyHrs,t.totalHrs,t.monthDutyHr];
      const row = ws1.addRow(rowData);
      row.height = 16;
      const rowBg = ei%2===0 ? solidFill(WHITE) : solidFill(CREAM);
      row.eachCell((cell, col) => {
        cell.style = {font:bodyFont(9), fill:rowBg, alignment:ctrAlign, border:thinBorder()};
      });
      row.getCell(2).style = {...row.getCell(2).style, alignment:leftAlign};

      // Status cells
      e.status.forEach((s, si) => {
        const cell = row.getCell(INFO_COLS+1+si);
        cell.style = {font:statusFont(s), fill:statusFill(s), alignment:ctrAlign, border:thinBorder()};
      });
      // Totals
      for(let i=0;i<TOT_COLS;i++) {
        const cell = row.getCell(INFO_COLS+nDays+1+i);
        cell.style = {font:bodyFont(9,true), fill:solidFill(CREAM2), alignment:ctrAlign, border:thinBorder()};
      }
    });

    // Footer: Daily totals
    const dailyP = days.map((_,di)=>employees.filter(e=>e.status[di]==='P').length);
    const ftData: (string|number)[] = ['','','','','','DAILY P →',...dailyP,'','','','','','','',''];
    const ft = ws1.addRow(ftData);
    ft.height = 16;
    ft.eachCell(cell => {
      cell.style = {font:bodyFont(9,true,'FF12213D'), fill:solidFill(TOTBG), alignment:ctrAlign, border:thinBorder()};
    });
    ft.getCell(6).style = {...ft.getCell(6).style, alignment:{horizontal:'right',vertical:'middle'}};

    // Column widths
    ws1.getColumn(1).width=5; ws1.getColumn(2).width=24; ws1.getColumn(3).width=15;
    ws1.getColumn(4).width=14; ws1.getColumn(5).width=9; ws1.getColumn(6).width=12;
    for(let i=7;i<=6+nDays;i++) ws1.getColumn(i).width=5.5;
    for(let i=7+nDays;i<=totalC;i++) ws1.getColumn(i).width=5.5;

    // ════════════════════════════════════════════════════════════
    // SHEET 2 — Time Sheet (matching preview layout)
    // ════════════════════════════════════════════════════════════
    const ws2 = wb.addWorksheet(`TimeSheet ${MONTHS[month].slice(0,3)} ${year}`, {
      properties:{tabColor:{argb:'FF1F7A6C'}},
    });
    const tsWOs: string[] = Array.from(new Set(tsEmployees.map(e=>e.workOrder).filter(Boolean))) as string[];
    const tsCatOrd = TS_CATS.filter(c=>tsEmployees.some(e=>e.category===c));
    const perWOCols = 5; // CR LEAVE NH DUTY LNCOD
    const tsTotalC = 3 + tsWOs.length*perWOCols + 1; // Cat+Code+TNo + WOs + Total

    // Column widths for TS sheet
    ws2.getColumn(1).width=10; ws2.getColumn(2).width=7; ws2.getColumn(3).width=8;
    for(let i=4;i<=3+tsWOs.length*perWOCols;i++) ws2.getColumn(i).width=11;
    ws2.getColumn(3+tsWOs.length*perWOCols+1).width=9;

    let tsRow = 1;

    // Title row
    ws2.mergeCells(tsRow,1,tsRow,tsTotalC);
    const ts1 = ws2.getCell(tsRow,1);
    ts1.value = tsHdr.title;
    ts1.style = {font:hdrFont(13),fill:navyFill(),alignment:{horizontal:'center',vertical:'middle'},border:medBorder()};
    ws2.getRow(tsRow).height=24; tsRow++;

    // Info row
    ws2.mergeCells(tsRow,1,tsRow,tsTotalC);
    const ts2 = ws2.getCell(tsRow,1);
    ts2.value = `Section: ${tsHdr.section}  |  Sec. Code: ${tsHdr.secCode}  |  Consignee Code: ${tsHdr.consignee}  |  From: 01/${String(month+1).padStart(2,'0')}/${year}  To: ${days.length}/${String(month+1).padStart(2,'0')}/${year}`;
    ts2.style = {font:{...hdrFont(9),bold:false},fill:solidFill('FF1F3560'),alignment:{horizontal:'center',vertical:'middle'},border:medBorder()};
    ws2.getRow(tsRow).height=16; tsRow++;

    const addTSBlankRow = () => {
      ws2.mergeCells(tsRow,1,tsRow,tsTotalC);
      ws2.getRow(tsRow).height=5;
      tsRow++;
    };
    addTSBlankRow();

    // Helper: add category table header
    const addCatHeader = (title:string) => {
      // Row: WORK ORDER header
      ws2.getCell(tsRow,1).value='Category';
      ws2.getCell(tsRow,2).value='Code';
      ws2.getCell(tsRow,3).value='T.No.';
      tsWOs.forEach((wo,wi)=>{
        const startC=4+wi*perWOCols;
        ws2.mergeCells(tsRow,startC,tsRow,startC+perWOCols-1);
        ws2.getCell(tsRow,startC).value='WORK ORDER NUMBER';
      });
      ws2.getCell(tsRow,3+tsWOs.length*perWOCols+1).value='Total';
      const r1=ws2.getRow(tsRow); r1.height=14;
      r1.eachCell((c,col)=>{if(col<=tsTotalC)c.style={font:hdrFont(9),fill:navyFill(),alignment:ctrAlign,border:thinBorder()};});
      tsRow++;

      // Row: WO numbers
      ws2.getCell(tsRow,1).value=''; ws2.getCell(tsRow,2).value=''; ws2.getCell(tsRow,3).value='';
      tsWOs.forEach((wo,wi)=>{
        const startC=4+wi*perWOCols;
        ws2.mergeCells(tsRow,startC,tsRow,startC+perWOCols-1);
        ws2.getCell(tsRow,startC).value=wo;
      });
      ws2.getCell(tsRow,3+tsWOs.length*perWOCols+1).value='';
      const r2=ws2.getRow(tsRow); r2.height=14;
      r2.eachCell((c,col)=>{if(col<=tsTotalC)c.style={font:hdrFont(9),fill:navyFill(),alignment:ctrAlign,border:thinBorder()};});
      tsRow++;

      // Row: CR LEAVE NH ON DUTY L+NH+CR+ON DUTY
      ws2.getCell(tsRow,1).value=''; ws2.getCell(tsRow,2).value=''; ws2.getCell(tsRow,3).value='';
      tsWOs.forEach((_,wi)=>{
        ['CR','LEAVE','NH','ON DUTY','L+NH+CR+ON DUTY'].forEach((h,hi)=>{
          const c=ws2.getCell(tsRow,4+wi*perWOCols+hi);
          c.value=h;
        });
      });
      ws2.getCell(tsRow,3+tsWOs.length*perWOCols+1).value='';
      const r3=ws2.getRow(tsRow); r3.height=14;
      r3.eachCell((c,col)=>{if(col<=tsTotalC)c.style={font:{...hdrFont(8),bold:true},fill:solidFill(CREAM2),alignment:ctrAlign,border:thinBorder()};});
      tsRow++;
    };

    // Per-category tables
    const grandSums: Record<string,{cr:number;leave:number;nh:number;duty:number;lncod:number}> = {};
    tsWOs.forEach(wo=>{grandSums[wo]={cr:0,leave:0,nh:0,duty:0,lncod:0};});
    let grandTotal=0;
    const catSummary: {cat:string; cs:Record<string,number[]>; ct:number}[] = [];

    tsCatOrd.forEach(cat=>{
      const rows=tsEmployees.filter(e=>e.category===cat);
      if(!rows.length) return;
      addCatHeader(cat);

      const woCatSums: Record<string,number[]>={};
      tsWOs.forEach(wo=>{woCatSums[wo]=[0,0,0,0,0];});
      let catTot=0;
      const dataStartRow=tsRow;

      rows.forEach((e,ri)=>{
        const tv=getTsVals(e,days.length);
        catTot+=tv.total; grandTotal+=tv.total;
        const wo=e.workOrder;
        if(woCatSums[wo]){woCatSums[wo][0]+=tv.cr;woCatSums[wo][1]+=tv.leave;woCatSums[wo][2]+=tv.nh;woCatSums[wo][3]+=tv.duty;woCatSums[wo][4]+=tv.lncod;}
        if(grandSums[wo]){grandSums[wo].cr+=tv.cr;grandSums[wo].leave+=tv.leave;grandSums[wo].nh+=tv.nh;grandSums[wo].duty+=tv.duty;grandSums[wo].lncod+=tv.lncod;}

        const rowBg = ri%2===0 ? solidFill(WHITE) : solidFill(CREAM);
        ws2.getCell(tsRow,3).value=e.tno.split('/')[0];
        tsWOs.forEach((wo2,wi)=>{
          const isThis=wo===wo2;
          const vals=isThis?[tv.cr,tv.leave,tv.nh,tv.duty,tv.lncod]:['','','','',''];
          vals.forEach((v,vi)=>{ ws2.getCell(tsRow,4+wi*perWOCols+vi).value=v; });
        });
        ws2.getCell(tsRow,3+tsWOs.length*perWOCols+1).value=tv.total;
        const dr=ws2.getRow(tsRow); dr.height=15;
        dr.eachCell((c,col)=>{if(col<=tsTotalC)c.style={font:bodyFont(9),fill:rowBg,alignment:ctrAlign,border:thinBorder()};});
        ws2.getCell(tsRow,3+tsWOs.length*perWOCols+1).style={font:bodyFont(9,true),fill:rowBg,alignment:ctrAlign,border:thinBorder()};
        tsRow++;
      });

      // Merge Cat + Code cells
      if(rows.length>1) {
        ws2.mergeCells(dataStartRow,1,dataStartRow+rows.length-1,1);
        ws2.mergeCells(dataStartRow,2,dataStartRow+rows.length-1,2);
      }
      ws2.getCell(dataStartRow,1).value=cat;
      ws2.getCell(dataStartRow,1).style={font:bodyFont(9,true),fill:solidFill(CREAM),alignment:ctrAlign,border:thinBorder()};
      ws2.getCell(dataStartRow,2).value=CAT_CODE[cat]??'';
      ws2.getCell(dataStartRow,2).style={font:bodyFont(9),fill:solidFill(CREAM),alignment:ctrAlign,border:thinBorder()};

      // Total row
      ws2.getCell(tsRow,1).value='Total Hours';
      ws2.mergeCells(tsRow,1,tsRow,3);
      tsWOs.forEach((wo2,wi)=>{
        [woCatSums[wo2][0],woCatSums[wo2][1],woCatSums[wo2][2],woCatSums[wo2][3],woCatSums[wo2][4]].forEach((v,vi)=>{ ws2.getCell(tsRow,4+wi*perWOCols+vi).value=v; });
      });
      ws2.getCell(tsRow,3+tsWOs.length*perWOCols+1).value=catTot;
      const totRow=ws2.getRow(tsRow); totRow.height=15;
      totRow.eachCell((c,col)=>{if(col<=tsTotalC)c.style={font:bodyFont(9,true),fill:solidFill(TOTBG),alignment:ctrAlign,border:thinBorder()};});
      catSummary.push({cat, cs: Object.fromEntries(Object.entries(woCatSums).map(([k,v])=>[k,v] as [string,number[]])) as Record<string,number[]>, ct:catTot});
      tsRow++;
      addTSBlankRow();
    });

    // Grand summary table
    addCatHeader('GRAND SUMMARY');
    catSummary.forEach(({cat,cs,ct},ri)=>{
      ws2.getCell(tsRow,1).value=cat;
      ws2.getCell(tsRow,2).value=CAT_CODE[cat]??'';
      tsWOs.forEach((wo,wi)=>{
        (cs[wo]||[0,0,0,0,0]).forEach((v:number,vi:number)=>{ ws2.getCell(tsRow,4+wi*perWOCols+vi).value=v; });
      });
      ws2.getCell(tsRow,3+tsWOs.length*perWOCols+1).value=ct;
      const r=ws2.getRow(tsRow); r.height=15;
      r.eachCell((c,col)=>{if(col<=tsTotalC)c.style={font:bodyFont(9,ri%2===0),fill:ri%2===0?solidFill(WHITE):solidFill(CREAM),alignment:ctrAlign,border:thinBorder()};});
      tsRow++;
    });
    // Grand total
    ws2.getCell(tsRow,1).value='Total Hours'; ws2.mergeCells(tsRow,1,tsRow,3);
    tsWOs.forEach((wo,wi)=>{
      [grandSums[wo].cr,grandSums[wo].leave,grandSums[wo].nh,grandSums[wo].duty,grandSums[wo].lncod].forEach((v,vi)=>{ ws2.getCell(tsRow,4+wi*perWOCols+vi).value=v; });
    });
    ws2.getCell(tsRow,3+tsWOs.length*perWOCols+1).value=grandTotal;
    const gtRow=ws2.getRow(tsRow); gtRow.height=16;
    gtRow.eachCell((c,col)=>{if(col<=tsTotalC)c.style={font:hdrFont(9),fill:navyFill(),alignment:ctrAlign,border:thinBorder()};});
    tsRow+=2;

    // Signature
    ws2.mergeCells(tsRow,1,tsRow,3);
    ws2.getCell(tsRow,1).value=`Place: ${tsHdr.place}`;
    ws2.getCell(tsRow,1).style={font:bodyFont(9),alignment:leftAlign};
    ws2.mergeCells(tsRow,tsTotalC-1,tsRow,tsTotalC);
    ws2.getCell(tsRow,tsTotalC-1).value=tsHdr.signatory;
    ws2.getCell(tsRow,tsTotalC-1).style={font:bodyFont(9,true),alignment:{horizontal:'center',vertical:'middle'},border:{bottom:{style:'medium',color:{argb:NAVY}}}};

    // ── Save ──
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=`Attendance-${MONTHS[month]}-${year}.xlsx`;
    a.click(); URL.revokeObjectURL(url);
  };


  // ── Render ────────────────────────────────────────────────────────
  return (
    <>
      {/* Print: only TS preview prints, portrait A4 */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .only-print-ts { display: block !important; }
          thead { display: table-header-group; }
          tr    { page-break-inside: avoid; }
          table { font-size: 9.5px !important; }
          @page  { size: A4 portrait; margin: 8mm; }
        }
        .only-print-ts { display: none; }
      `}</style>

      {/* ── TOP HEADER — hidden on print ── */}
      <div className="no-print w-full max-w-[1400px] mx-auto bg-[#F5F3EC] text-[#12213D] font-['IBM_Plex_Sans',sans-serif] px-6 pt-6">
        <div className="flex justify-between items-end border-b-[3px] border-[#12213D] pb-3">
          <div>
            <h1 className="font-['Rajdhani',sans-serif] font-bold text-[32px] m-0">Attendance Register</h1>
            <div className="text-[12px] text-[#3C4A66] mt-1 font-['IBM_Plex_Mono',monospace]">Daily status entry → auto totals → category-wise Time Sheet</div>
          </div>
          <div className="font-['IBM_Plex_Mono',monospace] text-[11px] text-right text-[#3C4A66] leading-[1.7]">
            PAY GROUP <b className="text-[#12213D]">0827</b> · DIRECT WORKER<br /><b className="text-[#12213D]">BVP WORKSHOP</b>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2 bg-white border border-[#D8D3C4] px-3 py-2.5 my-3 rounded-sm">
          <label className="text-[12px] text-[#3C4A66] font-semibold">Month</label>
          <select className="border border-[#D8D3C4] bg-white px-2 py-1.5 text-[13px] text-[#12213D] rounded-sm" value={month} onChange={e=>setMonth(Number(e.target.value))}>
            {MONTHS.map((m,i)=><option key={m} value={i}>{m}</option>)}
          </select>
          <label className="text-[12px] text-[#3C4A66] font-semibold ml-2">Year</label>
          <input type="number" className="w-20 border border-[#D8D3C4] bg-white px-2 py-1.5 text-[13px] rounded-sm" value={year} onChange={e=>setYear(Number(e.target.value))} />
          <button onClick={()=>loadMonth(year,month)} className="border border-[#12213D] px-2.5 py-1 text-[12px] font-semibold rounded-sm hover:opacity-80">Load</button>
          <button onClick={()=>loadMonth(year,month,true)} title="Clear saved data and reload default seed" className="border border-[#B23A2E] text-[#B23A2E] px-2.5 py-1 text-[12px] font-semibold rounded-sm hover:opacity-80">Reset Seed</button>
          <span className={`text-[11px] ml-1 ${saving?'text-[#E0A526]':saveErr?'text-[#B23A2E]':'text-[#2E7D4F]'}`}>
            {saving?'⏳ Saving…':saveErr?'⚠ '+saveErr:dataLoaded?'✓ Saved':''}
          </span>
          <span className="flex-1" />
          <button onClick={handleAdd} className="border border-[#12213D] px-4 py-2 text-[13px] font-semibold rounded-sm hover:opacity-80">+ Add Employee</button>
          <button onClick={()=>setActiveTab('preview')} className="bg-[#E0A526] text-[#12213D] border border-[#E0A526] px-4 py-2 text-[13px] font-semibold rounded-sm hover:opacity-80">Generate Time Sheet</button>
          <button onClick={()=>window.print()} className="border border-[#12213D] px-4 py-2 text-[13px] font-semibold rounded-sm hover:opacity-80">🖨 Print</button>
          <button onClick={downloadPDF} className="bg-[#12213D] text-white px-4 py-2 text-[13px] font-semibold rounded-sm hover:opacity-80">↓ PDF</button>
          <button onClick={downloadExcel} className="bg-[#1F7A6C] text-white px-4 py-2 text-[13px] font-semibold rounded-sm hover:opacity-80">↓ Excel</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0.5">
          {(['entry','preview'] as const).map(t=>(
            <button key={t} onClick={()=>setActiveTab(t)}
              className={cn("border border-b-0 px-5 py-2 text-[13px] rounded-t-sm",
                activeTab===t?"bg-white border-[#12213D] font-bold text-[#12213D]":"bg-transparent border-[#D8D3C4] text-[#3C4A66]")}>
              {t==='entry'?'Attendance Entry':'Time Sheet Preview'}
            </button>
          ))}
        </div>
      </div>

      {/* ── MAIN CONTENT AREA ── */}
      <div className="w-full max-w-[1400px] mx-auto px-6 pb-20 font-['IBM_Plex_Sans',sans-serif]">

        {loading && <div className="bg-white border border-[#D8D3C4] p-8 text-center text-[#3C4A66]">Loading attendance data…</div>}

        {/* ENTRY TABLE — hidden on print */}
        {!loading && activeTab==='entry' && (
          <div className="no-print bg-white border border-[#D8D3C4] border-t-0 p-3 overflow-x-auto">
            <table className="border-collapse w-full text-[12px]">
              <thead>
                <tr>
                  {["Sr.","Name","PF No.","T.No/Desig.","Category","Work Order"].map(h=>(
                    <th key={h} className={TH_DARK} style={{position:'sticky',top:0,zIndex:10}}>{h}</th>
                  ))}
                  {days.map(d=>(
                    <th key={d.num} className={cn(TH_DARK, d.isSunday && "bg-[#5B5648]")} style={{position:'sticky',top:0,zIndex:10}}>{d.num}</th>
                  ))}
                  {["P","A","CR","LV","NH","DT","TOT","MDH",""].map((h,i)=>(
                    <th key={i} className={TH_DARK} style={{position:'sticky',top:0,zIndex:10}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.map(e=>{
                  const t=computeTotals(e,days.length);
                  return (
                    <tr key={e.id}>
                      <td className="font-['IBM_Plex_Mono',monospace] border border-[#D8D3C4] p-1 text-center text-[11px] text-[#3C4A66]">{e.sr}</td>
                      {([['name','min-w-[140px] text-left'],['pf','min-w-[120px]'],['tno','min-w-[90px]'],['category','min-w-[70px]'],['workOrder','min-w-[75px]']] as [keyof Employee,string][]).map(([f,cls])=>(
                        <td key={f} className={cn("border border-[#D8D3C4] p-0.5",cls)}>
                          <input type="text" className="w-full border-none bg-transparent text-[12px] text-[#12213D] px-0.5 focus:outline focus:outline-1 focus:outline-[#12213D] focus:bg-white" value={String(e[f]??'')} onChange={ev=>updField(e.id,f,ev.target.value)} />
                        </td>
                      ))}
                      {days.map((d,di)=>(
                        <td key={di} className={cn("border border-[#D8D3C4] p-0.5 text-center",d.isSunday&&"bg-[#EFEDE6]")}>
                          <select className={cn("w-[58px] text-[10.5px] p-0.5 border font-['IBM_Plex_Mono',monospace] font-semibold text-center rounded-[2px]",getStatusStyle(e.status[di]))}
                            value={e.status[di]} onChange={ev=>updStatus(e.id,di,ev.target.value)}>
                            {STATUS.map(s=><option key={s} value={s}>{s||'—'}</option>)}
                          </select>
                        </td>
                      ))}
                      {[t.present,t.absent,t.crHrs,t.leaveHrs,t.nhHrs,t.dutyHrs,t.totalHrs,t.monthDutyHr].map((v,i)=>(
                        <td key={i} className="bg-[#EFECDF] font-semibold font-['IBM_Plex_Mono',monospace] border border-[#D8D3C4] p-1 text-center text-[11px]">{v}</td>
                      ))}
                      <td className="border border-[#D8D3C4] p-1 text-center">
                        <button className="text-[#B23A2E] text-[11px] hover:bg-red-50 px-1.5 rounded" onClick={()=>removeEmp(e.id)}>✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={6} className="bg-[#F0EEE6] font-bold font-['IBM_Plex_Mono',monospace] border border-[#D8D3C4] p-1 text-right text-[11px]">DAILY TOTAL (Present)</td>
                  {days.map((_,di)=>(
                    <td key={di} className="bg-[#F0EEE6] font-bold font-['IBM_Plex_Mono',monospace] border border-[#D8D3C4] p-1 text-center text-[11px]">{dailyPres[di]}</td>
                  ))}
                  {Array(9).fill(null).map((_,i)=><td key={i} className="bg-[#F0EEE6] border border-[#D8D3C4]" />)}
                </tr>
              </tfoot>
            </table>
            {/* Legend */}
            <div className="flex gap-3 flex-wrap mt-2 text-[11px] text-[#3C4A66]">
              {[['#2E7D4F','P — Present'],['#B23A2E','A — Absent'],['#6E4A7E','LAP/LHAP/CL/LEAVE'],['#1F7A6C','CR/DUTY'],['#8A8377','SUNDAY'],['#E0A526','NH']].map(([c,l])=>(
                <span key={l} className="inline-flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-[2px] inline-block" style={{background:c}} />{l}</span>
              ))}
              <span className="ml-auto text-[10px]">Blank = entry pending &nbsp;|&nbsp; Time Sheet CR/LEAVE/NH/ON DUTY cells are editable</span>
            </div>
          </div>
        )}

        {/* TIME SHEET PREVIEW — also shows for print */}
        {!loading && (activeTab==='preview') && (
          <div className="bg-white border border-[#D8D3C4] border-t-0 p-4 overflow-x-auto" style={{fontFamily:'IBM Plex Mono,monospace'}}>

            {/* Mismatch warning bar */}
            {(()=>{
              const cnt=tsEmployees.filter(e=>{
                const t=computeTotals(e,days.length);
                const ov=e.tsOverride;
                return ov&&(ov.cr!==undefined&&ov.cr!==t.crHrs||ov.leave!==undefined&&ov.leave!==t.leaveHrs||ov.nh!==undefined&&ov.nh!==t.nhHrs||ov.duty!==undefined&&ov.duty!==t.dutyHrs);
              }).length;
              return cnt>0?(
                <div className="no-print mb-2 px-3 py-2 bg-yellow-50 border border-[#E0A526] rounded-sm text-[11.5px] text-[#7A5500] flex items-center gap-3">
                  <span>⚠ <b>{cnt} employee(s)</b> have manual overrides that differ from Attendance Entry data.</span>
                  <button onClick={()=>setEmployees(p=>p.map(e=>({...e,tsOverride:undefined})))} className="ml-auto border border-[#E0A526] px-2 py-0.5 rounded text-[11px] hover:bg-yellow-100">
                    Reset All to Computed
                  </button>
                </div>
              ):null;
            })()}

            {/* Header — double-click any field to edit */}
            <p className="no-print text-[10px] text-[#3C4A66] mb-1">💡 Double-click any heading, section, or signature text to edit it. CR / LEAVE / NH / ON DUTY cells are directly editable.</p>
            <table className="w-full border-collapse text-[11.5px] mb-0">
              <tbody>
                <tr>
                  <td colSpan={workOrders.length*5+4} className="border border-[#12213D] p-0">
                    <div className="flex">
                      <div className="flex-1 flex items-center justify-center font-bold text-[13px] py-2 px-4 border-r border-[#12213D]">
                        <InlineEdit value={tsHdr.title} onChange={v=>updHdr('title',v)} className="font-bold text-[13px] text-center w-full" />
                      </div>
                      <div className="text-[10.5px] p-2 grid grid-cols-2 gap-x-3">
                        <span className="font-semibold">Section</span>
                        <InlineEdit value={tsHdr.section} onChange={v=>updHdr('section',v)} />
                        <span className="font-semibold">Sec. Code</span>
                        <InlineEdit value={tsHdr.secCode} onChange={v=>updHdr('secCode',v)} />
                        <span className="font-semibold">Consignee Code</span>
                        <InlineEdit value={tsHdr.consignee} onChange={v=>updHdr('consignee',v)} />
                      </div>
                    </div>
                  </td>
                </tr>
                <tr className="text-[11px]">
                  <td className="border border-[#D8D3C4] p-1 font-semibold">Date</td>
                  <td className="border border-[#D8D3C4] p-1 font-semibold">From</td>
                  <td className="border border-[#D8D3C4] p-1">01/{String(month+1).padStart(2,'0')}/{year}</td>
                  <td className="border border-[#D8D3C4] p-1 font-semibold">To</td>
                  <td className="border border-[#D8D3C4] p-1" colSpan={workOrders.length*5}>{days.length}/{String(month+1).padStart(2,'0')}/{year}</td>
                </tr>
              </tbody>
            </table>

            {/* Per-category tables with EDITABLE cells */}
            {tsCatOrder.map(cat=>{
              const rows=tsEmployees.filter(e=>e.category===cat);
              if(!rows.length) return null;
              type WS={cr:number;leave:number;nh:number;duty:number;lncod:number};
              const woCatSums:Record<string,WS>={};
              workOrders.forEach(wo=>{woCatSums[wo]={cr:0,leave:0,nh:0,duty:0,lncod:0};});
              let catTot=0;

              return (
                <table key={cat} className="w-full border-collapse text-[11.5px] mt-0">
                  <thead>
                    <tr className="bg-[#F5F3EC]">
                      <td className="border border-[#D8D3C4] p-1 font-bold text-center" rowSpan={2}>Category</td>
                      <td className="border border-[#D8D3C4] p-1 font-bold text-center" rowSpan={2}>Code</td>
                      <td className="border border-[#D8D3C4] p-1 font-bold text-center" rowSpan={2}>T.No.</td>
                      <td className="border border-[#D8D3C4] p-1 font-bold text-center" colSpan={workOrders.length*5}>WORK ORDER NUMBER</td>
                      <td className="border border-[#D8D3C4] p-1 font-bold text-center" rowSpan={2}>Total</td>
                    </tr>
                    <tr className="bg-[#F5F3EC]">
                      {workOrders.map(wo=><td key={wo} colSpan={5} className="border border-[#D8D3C4] p-1 font-bold text-center">{wo}</td>)}
                    </tr>
                    <tr className="bg-[#EFECDF] text-[10.5px]">
                      <td className="border border-[#D8D3C4] p-0.5"/><td className="border border-[#D8D3C4] p-0.5"/><td className="border border-[#D8D3C4] p-0.5"/>
                      {workOrders.map(wo=>(
                        <React.Fragment key={wo}>
                          {['CR','LEAVE','NH','ON DUTY','L+NH+CR+ON DUTY'].map(h=>(
                            <td key={h} className="border border-[#D8D3C4] p-0.5 text-center font-bold">{h}</td>
                          ))}
                        </React.Fragment>
                      ))}
                      <td className="border border-[#D8D3C4] p-0.5"/>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((e,ri)=>{
                      const tv=getTsVals(e,days.length);
                      const tc=computeTotals(e,days.length); // computed (for mismatch check)
                      catTot+=tv.total;
                      const wo=e.workOrder;
                      if(woCatSums[wo]){woCatSums[wo].cr+=tv.cr;woCatSums[wo].leave+=tv.leave;woCatSums[wo].nh+=tv.nh;woCatSums[wo].duty+=tv.duty;woCatSums[wo].lncod+=tv.lncod;}
                      return (
                        <tr key={e.id} className={ri%2===0?'bg-white':'bg-[#FAFAF7]'}>
                          {ri===0&&<td className="border border-[#D8D3C4] p-1 text-center font-semibold" rowSpan={rows.length}>{cat}</td>}
                          {ri===0&&<td className="border border-[#D8D3C4] p-1 text-center" rowSpan={rows.length}>{CAT_CODE[cat]??''}</td>}
                          <td className={TD_NE}>{e.tno.split('/')[0]}</td>
                          {workOrders.map(wo2=>{
                            const isThis=wo===wo2;
                            return (
                              <React.Fragment key={wo2}>
                                <td className={TD_TS}>{isThis?<TsCell val={tv.cr} computed={tc.crHrs} onChange={v=>setTsOv(e.id,'cr',v)} onReset={()=>setTsOv(e.id,'cr',tc.crHrs)}/>:''}</td>
                                <td className={TD_TS}>{isThis?<TsCell val={tv.leave} computed={tc.leaveHrs} onChange={v=>setTsOv(e.id,'leave',v)} onReset={()=>setTsOv(e.id,'leave',tc.leaveHrs)}/>:''}</td>
                                <td className={TD_TS}>{isThis?<TsCell val={tv.nh} computed={tc.nhHrs} onChange={v=>setTsOv(e.id,'nh',v)} onReset={()=>setTsOv(e.id,'nh',tc.nhHrs)}/>:''}</td>
                                <td className={TD_TS}>{isThis?<TsCell val={tv.duty} computed={tc.dutyHrs} onChange={v=>setTsOv(e.id,'duty',v)} onReset={()=>setTsOv(e.id,'duty',tc.dutyHrs)}/>:''}</td>
                                <td className={TD_NE}>{isThis?tv.lncod:''}</td>
                              </React.Fragment>
                            );
                          })}
                          <td className="border border-[#D8D3C4] p-1 text-center font-semibold text-[11.5px]">{tv.total}</td>
                        </tr>
                      );
                    })}
                    {/* Category total row */}
                    <tr className="bg-[#F0EEE6] font-bold">
                      <td colSpan={3} className="border border-[#D8D3C4] p-1 text-center text-[11.5px]">Total Hours</td>
                      {workOrders.map(wo=>(
                        <React.Fragment key={wo}>
                          {(['cr','leave','nh','duty','lncod'] as const).map(k=>(
                            <td key={k} className={TD_NE}>{woCatSums[wo]?.[k]??0}</td>
                          ))}
                        </React.Fragment>
                      ))}
                      <td className={TD_NE}>{catTot}</td>
                    </tr>
                  </tbody>
                </table>
              );
            })}

            {/* Grand Summary table */}
            {(()=>{
              type GS2={cr:number;leave:number;nh:number;duty:number;lncod:number};
              const gs2:Record<string,GS2>={};
              workOrders.forEach(wo=>{gs2[wo]={cr:0,leave:0,nh:0,duty:0,lncod:0};});
              let grandTot2=0;
              const sumRows=tsCatOrder.map(cat=>{
                const cr=tsEmployees.filter(e=>e.category===cat);
                const cs:GS2={cr:0,leave:0,nh:0,duty:0,lncod:0};
                let ct=0;
                cr.forEach(e=>{const tv=getTsVals(e,days.length);ct+=tv.total;grandTot2+=tv.total;const wo=e.workOrder;if(gs2[wo]){gs2[wo].cr+=tv.cr;gs2[wo].leave+=tv.leave;gs2[wo].nh+=tv.nh;gs2[wo].duty+=tv.duty;gs2[wo].lncod+=tv.lncod;}cs.cr+=tv.cr;cs.leave+=tv.leave;cs.nh+=tv.nh;cs.duty+=tv.duty;cs.lncod+=tv.lncod;});
                return {cat,cs,ct};
              });
              return (
                <table className="w-full border-collapse text-[11.5px] mt-4">
                  <thead>
                    <tr className="bg-[#F5F3EC]">
                      <td className="border border-[#D8D3C4] p-1 font-bold text-center">Category</td>
                      <td className="border border-[#D8D3C4] p-1 font-bold text-center">Code</td>
                      <td className="border border-[#D8D3C4] p-1 font-bold text-center" colSpan={workOrders.length*5}>WORK ORDER NUMBER</td>
                      <td className="border border-[#D8D3C4] p-1 font-bold text-center">Total</td>
                    </tr>
                    <tr className="bg-[#F5F3EC]">
                      <td className="border border-[#D8D3C4] p-1"/><td className="border border-[#D8D3C4] p-1"/>
                      {workOrders.map(wo=><td key={wo} colSpan={5} className="border border-[#D8D3C4] p-1 font-bold text-center">{wo}</td>)}
                      <td className="border border-[#D8D3C4] p-1"/>
                    </tr>
                    <tr className="bg-[#EFECDF] text-[10.5px]">
                      <td className="border border-[#D8D3C4] p-0.5"/><td className="border border-[#D8D3C4] p-0.5"/>
                      {workOrders.map(wo=>(
                        <React.Fragment key={wo}>
                          {['CR','LEAVE','NH','ON DUTY','L+NH+CR+ON DUTY'].map(h=>(
                            <td key={h} className="border border-[#D8D3C4] p-0.5 text-center font-bold">{h}</td>
                          ))}
                        </React.Fragment>
                      ))}
                      <td className="border border-[#D8D3C4] p-0.5"/>
                    </tr>
                  </thead>
                  <tbody>
                    {sumRows.map(({cat,cs,ct})=>(
                      <tr key={cat} className="italic text-[11px]">
                        <td className="border border-[#D8D3C4] p-1 text-center font-semibold not-italic">{cat}</td>
                        <td className={TD_NE}>{CAT_CODE[cat]??''}</td>
                        {workOrders.map(wo=>(
                          <React.Fragment key={wo}>
                            {(['cr','leave','nh','duty','lncod'] as const).map(k=>(
                              <td key={k} className={TD_NE}>{cs[k]??0}</td>
                            ))}
                          </React.Fragment>
                        ))}
                        <td className={TD_NE}>{ct}</td>
                      </tr>
                    ))}
                    <tr className="bg-[#F0EEE6] font-bold">
                      <td colSpan={2} className="border border-[#D8D3C4] p-1 text-center text-[11.5px]">Total Hours</td>
                      {workOrders.map(wo=>(
                        <React.Fragment key={wo}>
                          {(['cr','leave','nh','duty','lncod'] as const).map(k=>(
                            <td key={k} className={TD_NE}>{gs2[wo]?.[k]??0}</td>
                          ))}
                        </React.Fragment>
                      ))}
                      <td className={TD_NE + " font-bold"}>{grandTot2}</td>
                    </tr>
                  </tbody>
                </table>
              );
            })()}

            {/* Signature box — all text double-click editable */}
            <div className="mt-8 flex justify-between items-end border-t border-[#D8D3C4] pt-4" style={{fontFamily:'IBM Plex Mono,monospace'}}>
              <div className="text-[11px] text-[#3C4A66]">
                <div>Date: _______________</div>
                <div className="mt-1">Place: <InlineEdit value={tsHdr.place} onChange={v=>updHdr('place',v)} /></div>
              </div>
              <div className="text-center text-[11px] text-[#12213D]">
                <div className="mt-8 w-44 border-t border-[#12213D] pt-1">
                  <InlineEdit value={tsHdr.signatory} onChange={v=>updHdr('signatory',v)} className="font-semibold" />
                </div>
                <div className="text-[10px] text-[#3C4A66]">Signature &amp; Stamp</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
