import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Chart, registerables } from 'chart.js';
import { db } from '../db/db';
import type { BvpScrapEntry, BvpCoachEntry, BvpSurveyEntry, BvpMpEntry } from '../db/db';
import { exportPDF, printElement, exportSummaryExcel, exportAllRecordsExcel, exportDashboardExcel, exportWord } from '../utils/bvpExport';

Chart.register(...registerables);

/* Historical year aggregates for charts (from Excel) — not user-editable */
const HIST_YEAR: Record<string, { ferrous: number; wta: number; nf: number; misc: number; rev: number; pcv: number; ocv: number; mp_mt?: number; mp_rs?: number }> = {
  '2017-18': { ferrous: 405.8, wta: 643.0, nf: 7.4, misc: 0, rev: 0, pcv: 55, ocv: 7 },
  '2018-19': { ferrous: 302.1, wta: 1208.6, nf: 13.0, misc: 41.9, rev: 0, pcv: 27, ocv: 4 },
  '2019-20': { ferrous: 1170.9, wta: 1083.1, nf: 348.2, misc: 26.7, rev: 0, pcv: 28, ocv: 3 },
  '2020-21': { ferrous: 660.1, wta: 397.9, nf: 132.8, misc: 49, rev: 0, pcv: 38, ocv: 5 },
  '2021-22': { ferrous: 940.3, wta: 593.7, nf: 171.3, misc: 54.5, rev: 0, pcv: 13, ocv: 18 },
  '2022-23': { ferrous: 1004.5, wta: 828.1, nf: 205.1, misc: 95.5, rev: 0, pcv: 135, ocv: 9 },
  '2023-24': { ferrous: 1978.7, wta: 996.7, nf: 393.5, misc: 653.5, rev: 15245, pcv: 27, ocv: 13, mp_mt: 26.071, mp_rs: 1634003 },
  '2024-25': { ferrous: 1477.9, wta: 1292.1, nf: 325.9, misc: 287.3, rev: 12836, pcv: 80, ocv: 11, mp_mt: 10, mp_rs: 0 },
  '2025-26': { ferrous: 2737.8, wta: 1608.3, nf: 320.9, misc: 406.9, rev: 18658, pcv: 40, ocv: 23, mp_mt: 4, mp_rs: 120750 },
};

/* Monthly breakdown data (from Excel) — used in Summary Table */
const MONTHLY_DATA: Record<string, any> = {
  '2023-24': {
    months: ['Apr-23','May-23','Jun-23','Jul-23','Aug-23','Sep-23','Oct-23','Nov-23','Dec-23','Jan-24','Feb-24','Mar-24'],
    ferrous: [174.4,0,383,2,43.911,307.625,285,240.524,42.1,199.03,87.107,214],
    wta: [120.59,0,161.89,81.24,110.83,0,82.155,0,81.75,112.86,82.41,163],
    nf: [79.74,18.3,0,0,130.019,0,0,6.318,97.617,0,47.4,14.093],
    misc: [0,11.678,0,0,4,0,30.185,115,0,12.6,280,200],
    mp_mt: [10.11,0,0,0,0,0,0,0,0,4.317,7.927,3.717],
    rs_f: [6291992,0,14018587,76858,1460702,12264131.75,9739997.4,7673214.41,1588260.9,7137940,4516420,7597641],
    rs_w: [4473191.39,0,5250578.37,2634856.92,3594549.39,0,2664533.12,0,2651397.75,3660388,2951008.65,5286579],
    rs_nf: [8399200,3000000,0,0,13723961,0,0,639387,12216148.5,0,4864000,1367261],
    rs_m: [0,259483.84,0,0,118752,0,492594,202500,0,186379,1197550,250400],
    mp_rs: [360000,0,0,0,0,0,0,0,0,451570,474595,347838]
  },
  '2024-25': {
    months: ['Apr-24','May-24','Jun-24','Jul-24','Aug-24','Sep-24','Oct-24','Nov-24','Dec-24','Jan-25','Feb-25','Mar-25'],
    ferrous: [249,94.625,238.345,25,45,56.95,89.59,160.92,242.12,32.73,23.76,219.895],
    wta: [80.44,123.15,82.285,125.35,124.885,77.55,81.79,140.26,122.4,125.62,166.55,41.77],
    nf: [5.74,0,60.786,0,7.44,85.181,0,0,8,65.12,6.528,87.124],
    misc: [19,0,0,25,0,0,15.2,32,33.1,8,150,5],
    mp_mt: [0,0,0,0,0,0,0,0,0,0,0,0],
    rs_f: [7741547.2,3133903,8477157,689975,1338875,2820350,2360765,5410770,8345520,879877.7,385476,5146333],
    rs_w: [2608910.52,3994123.95,2668749.41,4065476.55,4050395,2515179.15,2652695,4549052,3888328.6,3902653.92,5576060.73,1631327.35],
    rs_nf: [934843,0,7135512,0,1407600,9397690,0,0,1552000,7712500,1180140,8676360],
    rs_m: [93800,0,0,75775,0,0,146748,57200,610055.2,78216,469350,0],
    mp_rs: [0,0,0,0,0,0,0,0,0,0,0,0]
  },
  '2025-26': {
    months: ['Apr-25','May-25','Jun-25','Jul-25','Aug-25','Sep-25','Oct-25','Nov-25','Dec-25','Jan-26','Feb-26','Mar-26'],
    ferrous: [261,6,233.315,235,117.6,398.2,182.818,472,333,43.673,441,14.2],
    wta: [41.75,207.96,166.22,122.17,164.45,84.36,84.17,81.13,208.11,162.95,166.285,118.79],
    nf: [0,0,3.52,91.811,0,83.862,0,0,13.238,8.482,120,0],
    misc: [10,20,0,0,5,114.7,0,195,0,37.16,20,5],
    mp_mt: [0,0,0,0,0,0,0,0,0,0,0,0],
    rs_f: [15403327,240492,7816595.24,10802775,4166786,12369990,9165428,12463345,9328739,2059810.56,14765561,298610],
    rs_w: [1210750,6030840,5066202.22,3542930,5011200,2446440,2440930,2352770,6281189.88,4969299.52,4822265,3444910],
    rs_nf: [0,0,687500,10004463,0,10370212,0,0,2380324,1596120,13396030,0],
    rs_m: [66250,22000,0,0,75775,367402.4,0,304600,0,634342.84,32000,143330],
    mp_rs: [0,0,0,0,0,0,0,0,0,0,0,120750]
  }
};

const TARGETS: Record<string, any> = {
  '2023-24': { fw: 903, nf: 175, misc: 5, total: 1078, ach_fw: 2975.422, ach_nf: 393.487, ach_misc: 653.463, ach_total: 4022.372 },
  '2024-25': { fw: 903, nf: 175, misc: 5, total: 1078, ach_fw: 2769.985, ach_nf: 325.919, ach_misc: 287.3, ach_total: 3383.204 },
  '2025-26': { fw: 903, nf: 175, misc: 5, total: 1078, ach_fw: 4346.151, ach_nf: 320.913, ach_misc: 406.86, ach_total: 5073.924 }
};

const SEED_IDS = [
  's_2526_apr','s_2526_may','s_2526_jun','s_2526_jul','s_2526_aug','s_2526_sep',
  's_2526_oct','s_2526_nov','s_2526_dec','s_2526_jan','s_2526_feb','s_2526_mar',
  's_2425_apr','s_2425_may','s_2425_jun','s_2425_rest','s_2324_all'
];

function fmt(d: string): string {
  if (!d) return '-';
  try {
    const dt = new Date(d);
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
  } catch { return d; }
}

/* ========== Toast Component ========== */
function Toast({ message, show }: { message: string; show: boolean }) {
  return (
    <div className={`bvp-toast ${show ? 'bvp-toast-show' : ''}`}>{message}</div>
  );
}

/* ========== MAIN COMPONENT ========== */
export function BvpScrapPosition() {
  const [activeView, setActiveView] = useState('dashboard');
  const [currentSession, setCurrentSession] = useState('2026-27');
  const [showNewSession, setShowNewSession] = useState(false);

  const [scrapEntries, setScrapEntries] = useState<BvpScrapEntry[]>([]);
  const [coachEntries, setCoachEntries] = useState<BvpCoachEntry[]>([]);
  const [surveyEntries, setSurveyEntries] = useState<BvpSurveyEntry[]>([]);
  const [mpEntries, setMpEntries] = useState<BvpMpEntry[]>([]);

  const [toast, setToast] = useState({ message: '', show: false });
  const [scrapFilter, setScrapFilter] = useState('all');
  const [coachFilter, setCoachFilter] = useState('all');
  const [surveyFilter, setSurveyFilter] = useState('all');
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState<string | null>(null);
  const [mpFilter, setMpFilter] = useState('all');
  const [summarySession, setSummarySession] = useState(currentSession);
  const [mainChartMode, setMainChartMode] = useState('total');

  // Form states
  const [scrapForm, setScrapForm] = useState({
    date_from: '', date_to: '', type: '', desc: '', qty_nos: '', qty_sets: '',
    wt_wta: '', wt_tb: '', wt_ms: '', wt_nf: '', wt_other: '',
    lot: '', party: '', rate: '', remarks: ''
  });
  const [coachForm, setCoachForm] = useState({
    coach_no: '', code: '', tare: '', seats: '', berths: '', cost: '',
    age: '', cond_by: '', cat: 'PCV', rso: '', rso_date: '', offer_date: '',
    auc1: '', auc2: '', sale_order: '', sale_date: '', purchaser: '',
    del_from: '', del_to: '', sale_amt: '', status: 'SOLD', remarks: ''
  });
  const [surveyForm, setSurveyForm] = useState({
    lot: '', location: '', desc: '', qty: '', unit: 'MT', wt: '',
    offer_date: '', bid: '', purchaser: '', status: 'UNDER AUCTION',
    category: '', remarks: ''
  });
  const [mpForm, setMpForm] = useState({
    date: '', item: '', qty: '', wt: '', month: '04', location: '', cond_by: '',
    lot: '', party: '', rate: '', status: 'SOLD', remarks: ''
  });

  // Chart refs
  const mainChartRef = useRef<HTMLCanvasElement>(null);
  const pieChartRef = useRef<HTMLCanvasElement>(null);
  const revChartRef = useRef<HTMLCanvasElement>(null);
  const monthChartRef = useRef<HTMLCanvasElement>(null);
  const catChartRef = useRef<HTMLCanvasElement>(null);
  const coachChartRef = useRef<HTMLCanvasElement>(null);
  const chartInstances = useRef<Record<string, Chart>>({});

  const showToast = useCallback((msg: string) => {
    setToast({ message: msg, show: true });
    setTimeout(() => setToast({ message: '', show: false }), 3000);
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [s, c, sv, mp] = await Promise.all([
        db.bvpScrapEntries.toArray(),
        db.bvpCoachEntries.toArray(),
        db.bvpSurveyEntries.toArray(),
        db.bvpMpEntries.toArray()
      ]);
      setScrapEntries(s);
      setCoachEntries(c);
      setSurveyEntries(sv);
      setMpEntries(mp);
    } catch (e) { console.error('Failed to load BVP data:', e); }
  }, []);

  useEffect(() => { 
    loadData(); 
    return () => {
      Object.values(chartInstances.current).forEach(c => c.destroy());
      chartInstances.current = {};
    };
  }, [loadData]);

  /* ===== Auto Calculations ===== */
  const calcWtTotal = () => {
    return +(
      (+scrapForm.wt_wta || 0) + (+scrapForm.wt_tb || 0) + (+scrapForm.wt_ms || 0) +
      (+scrapForm.wt_nf || 0) + (+scrapForm.wt_other || 0)
    ).toFixed(3);
  };
  const calcAmount = () => {
    const total = calcWtTotal();
    const rate = +scrapForm.rate || 0;
    return rate && total ? Math.round(rate * total) : 0;
  };

  /* ===== Session Handling ===== */
  const sessions = ['2026-27', '2025-26', '2024-25', '2023-24', '2022-23'];
  const allSessions = [...new Set([
    ...Object.keys(HIST_YEAR),
    ...scrapEntries.map(x => x.session),
    ...coachEntries.map(x => x.session),
    ...surveyEntries.map(x => x.session),
    ...mpEntries.map(x => x.session),
    currentSession
  ])].sort().reverse();

  const handleSessionChange = (val: string) => {
    if (val === 'new') {
      setShowNewSession(true);
      return;
    }
    setShowNewSession(false);
    setCurrentSession(val);
  };

  /* ===== Merged Data for Charts ===== */
  const getMergedData = useCallback(() => {
    const merged: Record<string, { ferrous: number; wta: number; nf: number; misc: number; rev: number; pcv: number; ocv: number; mp_mt?: number; mp_rs?: number }> = { ...HIST_YEAR };

    // Calculate user-added entries (non-seed) for existing sessions
    Object.keys(merged).forEach(sess => {
      const userNew = scrapEntries.filter(x => x.session === sess && !SEED_IDS.includes(x.id));
      if (userNew.length) {
        const extra = { ferrous: 0, wta: 0, nf: 0, misc: 0, rev: 0 };
        userNew.forEach(e => {
          if (e.type === 'WTA') {
            extra.wta += +e.wt_wta || 0;
          } else if (e.type === 'Non Ferrous') {
            extra.nf += +e.wt_nf || 0;
          } else {
            extra.ferrous += (+e.wt_ms || 0) + (+e.wt_wta || 0) + (+e.wt_tb || 0);
          }
          extra.misc += +e.wt_other || 0;
          extra.rev += +e.amount || 0;
        });
        merged[sess] = {
          ferrous: merged[sess].ferrous + extra.ferrous,
          wta: merged[sess].wta + extra.wta,
          nf: merged[sess].nf + extra.nf,
          misc: merged[sess].misc + extra.misc,
          rev: merged[sess].rev + (extra.rev / 100000),
          pcv: merged[sess].pcv, ocv: merged[sess].ocv
        };
      }
    });

    // Brand new sessions from user entries
    const userSessions: string[] = Array.from(new Set(scrapEntries.map(e => e.session)));
    userSessions.forEach((sess: string) => {
      if (!merged[sess]) {
        const entries = scrapEntries.filter(e => e.session === sess);
        const r = { ferrous: 0, wta: 0, nf: 0, misc: 0, rev: 0 };
        entries.forEach(e => {
          if (e.type === 'WTA') {
            r.wta += +e.wt_wta || 0;
          } else if (e.type === 'Non Ferrous') {
            r.nf += +e.wt_nf || 0;
          } else {
            r.ferrous += (+e.wt_ms || 0) + (+e.wt_wta || 0) + (+e.wt_tb || 0);
          }
          r.misc += +e.wt_other || 0;
          r.rev += +e.amount || 0;
        });
        merged[sess as string] = { ferrous: r.ferrous, wta: r.wta, nf: r.nf, misc: r.misc, rev: r.rev / 100000, pcv: 0, ocv: 0 };
      }
    });

    // Coach entries for new sessions
    coachEntries.filter(x => x.sr !== 'AGG').forEach(c => {
      if (!merged[c.session]) merged[c.session] = { ferrous: 0, wta: 0, nf: 0, misc: 0, rev: 0, pcv: 0, ocv: 0 };
      if (c.cat === 'PCV') merged[c.session].pcv++;
      else merged[c.session].ocv++;
    });

    return merged;
  }, [scrapEntries, coachEntries]);

  const getSortedYears = (data: Record<string, any>) => {
    return Object.keys(data).sort((a, b) => {
      const ya = parseInt(a.split('-')[0]);
      const yb = parseInt(b.split('-')[0]);
      return ya - yb;
    });
  };

  /* ===== Chart Building ===== */
  const GC = 'rgba(128,128,128,0.1)';
  const TC = '#999';

  const mkChart = useCallback((canvasRef: React.RefObject<HTMLCanvasElement | null>, id: string, cfg: any) => {
    if (!canvasRef.current) return;
    if (chartInstances.current[id]) {
      chartInstances.current[id].destroy();
      delete chartInstances.current[id];
    }
    const c = new Chart(canvasRef.current, cfg);
    chartInstances.current[id] = c;
    return c;
  }, []);

  const buildCharts = useCallback(() => {
    const d = getMergedData();
    const years = getSortedYears(d);

    // Main Year Chart
    const getData = (mode: string) => years.map(y => {
      const r = d[y];
      if (mode === 'total') return +((r.ferrous + r.wta + r.nf + r.misc).toFixed(1));
      if (mode === 'ferrous') return +r.ferrous.toFixed(1);
      if (mode === 'wta') return +r.wta.toFixed(1);
      if (mode === 'nf') return +r.nf.toFixed(1);
      return +r.misc.toFixed(1);
    });
    const colors: Record<string, string> = { total: '#185FA5', ferrous: '#378ADD', wta: '#1D9E75', nf: '#BA7517', misc: '#888780' };
    const labels: Record<string, string> = { total: 'Total disposal (MT)', ferrous: 'MS Ferrous (MT)', wta: 'WTA (MT)', nf: 'Non-Ferrous (MT)', misc: 'Misc (MT)' };

    mkChart(mainChartRef, 'mainChart', {
      type: 'bar',
      data: { labels: years, datasets: [{ label: labels[mainChartMode], data: getData(mainChartMode), backgroundColor: colors[mainChartMode], borderRadius: 5 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: GC }, ticks: { color: TC, font: { size: 11 }, autoSkip: false, maxRotation: 45 } }, y: { grid: { color: GC }, ticks: { color: TC, font: { size: 11 } } } }, animation: { duration: 600, easing: 'easeInOutQuart' as const } }
    });

    // Pie Chart
    const cur = d[currentSession] || { ferrous: 0, wta: 0, nf: 0, misc: 0 };
    const vals = [cur.ferrous, cur.wta, cur.nf, cur.misc].map(v => +v.toFixed(1));
    mkChart(pieChartRef, 'pieChart', {
      type: 'doughnut',
      data: { labels: ['Ferrous', 'WTA', 'Non-Ferrous', 'Misc'], datasets: [{ data: vals, backgroundColor: ['#185FA5', '#1D9E75', '#BA7517', '#888780'], borderWidth: 3, hoverOffset: 8 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, cutout: '60%', animation: { duration: 600 } }
    });

    // Revenue Chart
    const revYears = years.filter(y => d[y].rev > 0);
    mkChart(revChartRef, 'revChart', {
      type: 'line',
      data: { labels: revYears, datasets: [{ label: 'Revenue (₹L)', data: revYears.map(y => +d[y].rev.toFixed(1)), borderColor: '#D85A30', backgroundColor: 'rgba(216,90,48,0.07)', fill: true, pointBackgroundColor: '#D85A30', pointRadius: 5, tension: 0.35 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: GC }, ticks: { color: TC, font: { size: 11 }, autoSkip: false, maxRotation: 45 } }, y: { grid: { color: GC }, ticks: { color: TC, font: { size: 11 }, callback: (v: any) => '₹' + v + 'L' } } }, animation: { duration: 600 } }
    });

    // Monthly chart
    const MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
    const MKEYS = ['04', '05', '06', '07', '08', '09', '10', '11', '12', '01', '02', '03'];
    const sessYear = parseInt(currentSession.split('-')[0]);
    const sessScrap = scrapEntries.filter(x => x.session === currentSession);
    const monthly = MKEYS.map((mk, i) => {
      const yr = i >= 9 ? sessYear + 1 : sessYear;
      const prefix = yr + '-' + mk;
      const rows = sessScrap.filter(x => (x.date_from || '').startsWith(prefix) || (x.date_to || '').startsWith(prefix));
      return {
        ferrous: rows.reduce((a, x) => a + (+x.wt_ms || 0) + (+x.wt_tb || 0) + (x.type === 'WTA' ? 0 : (+x.wt_wta || 0)), 0),
        wta: rows.reduce((a, x) => a + (x.type === 'WTA' ? (+x.wt_wta || 0) : 0), 0),
        nf: rows.reduce((a, x) => a + (+x.wt_nf || 0), 0),
        misc: rows.reduce((a, x) => a + (+x.wt_other || 0), 0),
      };
    });
    mkChart(monthChartRef, 'monthChart', {
      type: 'bar',
      data: {
        labels: MONTHS, datasets: [
          { label: 'Ferrous', data: monthly.map(m => +m.ferrous.toFixed(1)), backgroundColor: '#185FA5', stack: 'm', borderRadius: 3 },
          { label: 'WTA', data: monthly.map(m => +m.wta.toFixed(1)), backgroundColor: '#1D9E75', stack: 'm', borderRadius: 3 },
          { label: 'NF', data: monthly.map(m => +m.nf.toFixed(1)), backgroundColor: '#BA7517', stack: 'm', borderRadius: 3 },
          { label: 'Misc', data: monthly.map(m => +m.misc.toFixed(1)), backgroundColor: '#888780', stack: 'm', borderRadius: 3 },
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { stacked: true, grid: { color: GC }, ticks: { color: TC, font: { size: 11 }, autoSkip: false } }, y: { stacked: true, grid: { color: GC }, ticks: { color: TC, font: { size: 11 } } } }, animation: { duration: 600 } }
    });

    // Category chart all years
    mkChart(catChartRef, 'catChart', {
      type: 'bar',
      data: {
        labels: years, datasets: [
          { label: 'Ferrous', data: years.map(y => +d[y].ferrous.toFixed(1)), backgroundColor: '#185FA5', borderRadius: 3 },
          { label: 'WTA', data: years.map(y => +d[y].wta.toFixed(1)), backgroundColor: '#1D9E75', borderRadius: 3 },
          { label: 'NF', data: years.map(y => +d[y].nf.toFixed(1)), backgroundColor: '#BA7517', borderRadius: 3 },
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: GC }, ticks: { color: TC, font: { size: 11 }, autoSkip: false, maxRotation: 45 } }, y: { grid: { color: GC }, ticks: { color: TC, font: { size: 11 } } } }, animation: { duration: 600 } }
    });

    // Coach chart
    mkChart(coachChartRef, 'coachChart', {
      type: 'bar',
      data: {
        labels: years, datasets: [
          { label: 'PCV', data: years.map(y => d[y].pcv || 0), backgroundColor: '#185FA5', stack: 'c', borderRadius: 3 },
          { label: 'OCV', data: years.map(y => d[y].ocv || 0), backgroundColor: '#E24B4A', stack: 'c', borderRadius: 3 },
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { stacked: true, grid: { color: GC }, ticks: { color: TC, font: { size: 10 }, autoSkip: false, maxRotation: 45 } }, y: { stacked: true, grid: { color: GC }, ticks: { color: TC, font: { size: 11 } } } }, animation: { duration: 600 } }
    });
  }, [getMergedData, currentSession, mainChartMode, scrapEntries, mkChart]);

  useEffect(() => {
    if (activeView === 'dashboard') {
      setTimeout(() => buildCharts(), 100);
    }
  }, [activeView, buildCharts]);

  /* ===== SAVE HANDLERS ===== */
  const saveScrapEntry = async () => {
    if (!scrapForm.type) { showToast('⚠️ Scrap Type select karo'); return; }
    if (!scrapForm.desc) { showToast('⚠️ Description required hai'); return; }
    if (!scrapForm.party) { showToast('⚠️ Party name required hai'); return; }
    if (!scrapForm.date_from) { showToast('⚠️ Date From required hai'); return; }

    const entry: BvpScrapEntry = {
      id: 'se_' + Date.now(),
      session: currentSession,
      date_from: scrapForm.date_from,
      date_to: scrapForm.date_to,
      type: scrapForm.type,
      desc: scrapForm.desc,
      qty_nos: scrapForm.qty_nos,
      qty_sets: scrapForm.qty_sets,
      wt_wta: +scrapForm.wt_wta || 0,
      wt_tb: +scrapForm.wt_tb || 0,
      wt_ms: +scrapForm.wt_ms || 0,
      wt_nf: +scrapForm.wt_nf || 0,
      wt_other: +scrapForm.wt_other || 0,
      wt_total: calcWtTotal(),
      lot: scrapForm.lot,
      party: scrapForm.party,
      rate: +scrapForm.rate || 0,
      amount: calcAmount(),
      remarks: scrapForm.remarks
    };

    await db.bvpScrapEntries.add(entry);
    showToast('✓ Scrap entry saved! Dashboard update ho gaya.');
    setScrapForm({ date_from: '', date_to: '', type: '', desc: '', qty_nos: '', qty_sets: '', wt_wta: '', wt_tb: '', wt_ms: '', wt_nf: '', wt_other: '', lot: '', party: '', rate: '', remarks: '' });
    loadData();
  };

  const saveCoachEntry = async () => {
    if (!coachForm.coach_no) { showToast('⚠️ Coach No. required hai'); return; }
    if (!coachForm.code) { showToast('⚠️ Coach code/type select karo'); return; }
    if (!coachForm.age) { showToast('⚠️ Overaged/Underaged select karo'); return; }

    // Calculate the next Sr number safely
    const sessionCoaches = coachEntries.filter(x => x.session === currentSession && x.sr !== 'AGG');
    const sr = sessionCoaches.length > 0 ? Math.max(...sessionCoaches.map(c => typeof c.sr === 'number' ? c.sr : 0)) + 1 : 1;
    const entry: BvpCoachEntry = {
      id: 'ce_' + Date.now(),
      session: currentSession,
      sr,
      coach_no: coachForm.coach_no,
      code: coachForm.code,
      cat: coachForm.cat,
      age: coachForm.age,
      cond_by: coachForm.cond_by,
      tare: coachForm.tare,
      seats: coachForm.seats,
      berths: coachForm.berths,
      cost: coachForm.cost,
      rso: coachForm.rso,
      rso_date: coachForm.rso_date,
      offer_date: coachForm.offer_date,
      auc1: coachForm.auc1,
      auc2: coachForm.auc2,
      sale_order: coachForm.sale_order,
      sale_date: coachForm.sale_date,
      purchaser: coachForm.purchaser,
      del_from: coachForm.del_from,
      del_to: coachForm.del_to,
      sale_amt: coachForm.sale_amt,
      status: coachForm.status,
      remarks: coachForm.remarks
    };

    await db.bvpCoachEntries.add(entry);
    showToast('✓ Coach entry saved!');
    setCoachForm({ coach_no: '', code: '', tare: '', seats: '', berths: '', cost: '', age: '', cond_by: '', cat: 'PCV', rso: '', rso_date: '', offer_date: '', auc1: '', auc2: '', sale_order: '', sale_date: '', purchaser: '', del_from: '', del_to: '', sale_amt: '', status: 'SOLD', remarks: '' });
    loadData();
  };

  const saveSurveyEntry = async () => {
    if (!surveyForm.lot) { showToast('⚠️ Lot No. required hai'); return; }
    if (!surveyForm.desc) { showToast('⚠️ Description required hai'); return; }
    if (!surveyForm.qty) { showToast('⚠️ Quantity required hai'); return; }

    const entry: BvpSurveyEntry = {
      id: 'sv_' + Date.now(),
      session: currentSession,
      lot: surveyForm.lot,
      location: surveyForm.location,
      desc: surveyForm.desc,
      qty: +surveyForm.qty,
      unit: surveyForm.unit,
      wt: +surveyForm.wt || 0,
      offer_date: surveyForm.offer_date,
      bid: +surveyForm.bid || 0,
      purchaser: surveyForm.purchaser,
      status: surveyForm.status,
      category: surveyForm.category,
      remarks: surveyForm.remarks
    };

    await db.bvpSurveyEntries.add(entry);
    showToast('✓ Lot entry saved!');
    setSurveyForm({ lot: '', location: '', desc: '', qty: '', unit: 'MT', wt: '', offer_date: '', bid: '', purchaser: '', status: 'UNDER AUCTION', category: '', remarks: '' });
    loadData();
  };

  const deleteEntry = async (type: 'scrap' | 'coach' | 'survey', id: string) => {
    if (!confirm('Ye entry delete karein?')) return;
    if (type === 'scrap') await db.bvpScrapEntries.delete(id);
    else if (type === 'coach') await db.bvpCoachEntries.delete(id);
    else await db.bvpSurveyEntries.delete(id);
    showToast('Entry deleted.');
    loadData();
  };

  const saveMPEntry = async () => {
    if (!mpForm.item) { showToast('⚠️ Item description required hai'); return; }
    if (!mpForm.qty) { showToast('⚠️ Quantity required hai'); return; }
    const wt = +mpForm.wt || 0;
    const qty = +mpForm.qty || 0;
    const rate = +mpForm.rate || 0;
    const base = wt > 0 ? wt : qty;
    const amount = rate && base ? Math.round(rate * base) : 0;
    const entry: BvpMpEntry = {
      id: 'mp_' + Date.now(),
      session: currentSession,
      date: mpForm.date,
      month: mpForm.month,
      item: mpForm.item,
      qty,
      wt,
      location: mpForm.location,
      cond_by: mpForm.cond_by,
      lot: mpForm.lot,
      party: mpForm.party,
      rate,
      amount,
      status: mpForm.status,
      remarks: mpForm.remarks
    };
    await db.bvpMpEntries.add(entry);
    showToast('✓ M&P entry saved! Summary table update ho gaya.');
    setMpForm({ date: '', item: '', qty: '', wt: '', month: '04', location: '', cond_by: '', lot: '', party: '', rate: '', status: 'SOLD', remarks: '' });
    loadData();
  };

  const deleteMPEntry = async (id: string) => {
    if (!confirm('Delete this M&P entry?')) return;
    await db.bvpMpEntries.delete(id);
    showToast('M&P entry deleted.');
    loadData();
  };

  const exportData = () => {
    const data = { scrap: scrapEntries, coach: coachEntries, survey: surveyEntries, mp_items: mpEntries };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'BVP_Scrap_Data_' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    showToast('Data exported as JSON (includes M&P items)!');
  };

  /* ===== COMPUTE SUMMARY DATA FOR EXPORT ===== */
  const buildSummaryExportData = (sess: string) => {
    const MKEYS = ['04','05','06','07','08','09','10','11','12','01','02','03'];
    const MLAB = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'];
    const SEED_IDS_SET_EXP = new Set(SEED_IDS);
    const hasMD = !!MONTHLY_DATA[sess];
    const sessMP = mpEntries.filter(x => x.session === sess);
    const sessScrap = scrapEntries.filter(x => x.session === sess);
    const monthly = MLAB.map((mo, i) => ({ mo, ferrous:0,wta:0,nf:0,misc:0,mp_mt:0,rs_f:0,rs_w:0,rs_nf:0,rs_m:0,mp_rs:0 }));
    if (hasMD) {
      const md = MONTHLY_DATA[sess];
      monthly.forEach((m,i) => { m.ferrous=md.ferrous[i]||0;m.wta=md.wta[i]||0;m.nf=md.nf[i]||0;m.misc=md.misc[i]||0;m.mp_mt=md.mp_mt[i]||0;m.rs_f=md.rs_f[i]||0;m.rs_w=md.rs_w[i]||0;m.rs_nf=md.rs_nf[i]||0;m.rs_m=md.rs_m[i]||0;m.mp_rs=md.mp_rs[i]||0; });
    }
    // Always add user entries (non-seed)
    sessScrap.filter(e=>!SEED_IDS_SET_EXP.has(e.id)).forEach(e=>{
      const idx=MKEYS.indexOf((e.date_from||'').slice(5,7));
      if(idx<0)return;
      const t = e.type || '';
      if(t==='WTA'){monthly[idx].wta+=+e.wt_wta||0;monthly[idx].rs_w+=+e.amount||0;}
      else if(t==='Non Ferrous'){monthly[idx].nf+=+e.wt_nf||0;monthly[idx].rs_nf+=+e.amount||0;}
      else {monthly[idx].ferrous+=(+e.wt_ms||0)+(+e.wt_wta||0)+(+e.wt_tb||0);monthly[idx].rs_f+=+e.amount||0;}
      monthly[idx].misc+=+e.wt_other||0;
    });
    sessMP.forEach(e=>{ const idx=MKEYS.indexOf(e.month); if(idx>=0){monthly[idx].mp_mt+=+e.wt||0;monthly[idx].mp_rs+=+e.amount||0;} });
    const tot=monthly.reduce((a,m)=>({ferrous:a.ferrous+m.ferrous,wta:a.wta+m.wta,nf:a.nf+m.nf,misc:a.misc+m.misc,mp_mt:a.mp_mt+m.mp_mt,rs_f:a.rs_f+m.rs_f,rs_w:a.rs_w+m.rs_w,rs_nf:a.rs_nf+m.rs_nf,rs_m:a.rs_m+m.rs_m,mp_rs:a.mp_rs+m.mp_rs}),{ferrous:0,wta:0,nf:0,misc:0,mp_mt:0,rs_f:0,rs_w:0,rs_nf:0,rs_m:0,mp_rs:0});
    const totMT=tot.ferrous+tot.wta+tot.nf+tot.misc;
    const totRS=tot.rs_f+tot.rs_w+tot.rs_nf+tot.rs_m;
    return { session:sess, kpi:{...tot,totMT,totRS}, monthly, target:TARGETS[sess], mpEntries:sessMP };
  };

  /* ===== EXPORT HANDLERS ===== */
  const handleExport = async (type: 'print' | 'pdf' | 'excel' | 'word') => {
    setExportLoading(type);
    setExportMenuOpen(false);
    try {
      const view = activeView;
      if (view === 'dashboard') {
        const kpis = [
          { label: `Total Disposal — ${currentSession}`, value: totalDisposal + ' MT' },
          { label: `Revenue — ${currentSession}`, value: '₹' + curData.rev.toFixed(1) + ' L' },
          { label: 'MS Ferrous', value: curData.ferrous.toFixed(1) + ' MT' },
          { label: 'WTA Scrap', value: curData.wta.toFixed(1) + ' MT' },
          { label: 'Non-Ferrous', value: curData.nf.toFixed(1) + ' MT' },
          { label: 'M&P Items', value: mpCount, trend: mpTotalAmt ? '₹'+mpTotalAmt.toLocaleString() : '' },
          { label: 'Coaches', value: sessCoaches + ' nos.' },
          { label: 'Under Auction', value: underAuction + ' lots' },
          { label: 'Sold Out', value: soldOut + ' lots' },
        ];
        if (type === 'print') printElement('bvp-print-dashboard', `Dashboard — ${currentSession}`);
        else if (type === 'pdf') await exportPDF('bvp-print-dashboard', `BVP_Dashboard_${currentSession}.pdf`);
        else if (type === 'excel') exportDashboardExcel({ session: currentSession, kpis, yearData: getMergedData() });
        else if (type === 'word') { const el = document.getElementById('bvp-print-dashboard'); if(el) exportWord(el.innerHTML, `BVP_Dashboard_${currentSession}.doc`, `Dashboard — ${currentSession}`); }
      } else if (view === 'summary-table') {
        const sess = summarySession;
        if (type === 'print') printElement('bvp-print-summary', `Summary Table — ${sess}`, true);
        else if (type === 'pdf') await exportPDF('bvp-summary-content', `BVP_Summary_${sess}.pdf`, true);
        else if (type === 'excel') exportSummaryExcel(buildSummaryExportData(sess));
        else if (type === 'word') { const el = document.getElementById('bvp-summary-content'); if(el) exportWord(el.innerHTML, `BVP_Summary_${sess}.doc`, `Summary Table — ${sess}`); }
      } else if (view === 'all-records') {
        if (type === 'print') printElement('bvp-print-records', 'All Records');
        else if (type === 'pdf') await exportPDF('bvp-print-records', 'BVP_AllRecords.pdf');
        else if (type === 'excel') exportAllRecordsExcel({ scrap: scrapEntries, coach: coachEntries, survey: surveyEntries, mp: mpEntries });
        else if (type === 'word') { const el = document.getElementById('bvp-print-records'); if(el) exportWord(el.innerHTML, 'BVP_AllRecords.doc', 'All Records'); }
      }
      showToast(type === 'print' ? '🖨️ Print dialog khula!' : `✅ ${type.toUpperCase()} export complete!`);
    } catch(e) { console.error(e); showToast('⚠️ Export failed. Console check karo.'); }
    setExportLoading(null);
  };

  const canExport = ['dashboard','summary-table','all-records'].includes(activeView);

  /* ===== KPI Data ===== */
  const mergedData = getMergedData();
  const curData = mergedData[currentSession] || { ferrous: 0, wta: 0, nf: 0, misc: 0, rev: 0, pcv: 0, ocv: 0 };
  const totalDisposal = +(curData.ferrous + curData.wta + curData.nf + curData.misc).toFixed(1);
  const sortedYears = getSortedYears(mergedData);
  const prevIdx = sortedYears.indexOf(currentSession);
  const prevData = prevIdx > 0 ? mergedData[sortedYears[prevIdx - 1]] : null;
  const prevTotal = prevData ? +(prevData.ferrous + prevData.wta + prevData.nf + prevData.misc).toFixed(1) : 0;
  const pct = prevTotal ? (((totalDisposal - prevTotal) / prevTotal) * 100).toFixed(1) : null;

  const sessCoaches = (curData.pcv || 0) + (curData.ocv || 0);
  const survSess = surveyEntries.filter(x => x.session === currentSession);
  const underAuction = survSess.filter(x => x.status === 'UNDER AUCTION').length;
  const soldOut = survSess.filter(x => x.status === 'SOLD OUT').length;

  const mpSess = mpEntries.filter(x => x.session === currentSession);
  const mpHistMT = HIST_YEAR[currentSession]?.mp_mt || 0;
  const mpHistRS = HIST_YEAR[currentSession]?.mp_rs || 0;
  const mpTotalAmt = mpSess.reduce((a, x) => a + (+x.amount || 0), 0) + mpHistRS;
  const mpCount = mpHistMT > 0 ? mpHistMT.toFixed(3) + ' MT' : (mpSess.length + ' nos.');

  const filteredMp = mpFilter === 'all' ? mpEntries : mpEntries.filter(x => x.session === mpFilter);

  const sessionEntryCount = {
    scrap: scrapEntries.filter(x => x.session === currentSession).length,
    coach: coachEntries.filter(x => x.session === currentSession).length,
    survey: surveyEntries.filter(x => x.session === currentSession).length,
    mp: mpEntries.filter(x => x.session === currentSession).length,
  };

  // Pie legend percentages
  const pieTotal = curData.ferrous + curData.wta + curData.nf + curData.misc || 1;
  const piePcts = [curData.ferrous, curData.wta, curData.nf, curData.misc].map(v => ((v / pieTotal) * 100).toFixed(1));

  // Progress bars
  const progBars = [
    { l: 'MS Ferrous vs prev year', val: `${curData.ferrous.toFixed(1)} MT`, pct: prevData && prevData.ferrous ? Math.min(100, Math.round((curData.ferrous / prevData.ferrous) * 100)) : 100, c: '#185FA5' },
    { l: 'WTA vs prev year', val: `${curData.wta.toFixed(1)} MT`, pct: prevData && prevData.wta ? Math.min(100, Math.round((curData.wta / prevData.wta) * 100)) : 100, c: '#1D9E75' },
    { l: 'Revenue vs prev year', val: `₹${curData.rev.toFixed(1)}L`, pct: prevData && prevData.rev ? Math.min(100, Math.round((curData.rev / prevData.rev) * 100)) : 100, c: '#D85A30' },
    { l: 'Coaches condemned', val: `${sessCoaches} coaches`, pct: 65, c: '#BA7517' },
    { l: 'M&P Items — ' + currentSession, val: mpCount, pct: 80, c: '#BA7517' },
  ];

  // Recent entries (all types combined)
  const recentAll = [
    ...scrapEntries.map(x => ({ session: x.session, type: 'Scrap', date: x.date_from, desc: x.desc, qty: x.wt_total ? x.wt_total + ' MT' : '', amt: x.amount })),
    ...coachEntries.filter(x => x.sr !== 'AGG').map(x => ({ session: x.session, type: 'Coach', date: x.rso_date, desc: 'Coach ' + x.coach_no + ' (' + x.code + ')', qty: '', amt: '' as any })),
    ...surveyEntries.map(x => ({ session: x.session, type: 'Lot', date: x.offer_date, desc: x.lot + ': ' + x.desc.slice(0, 50), qty: x.qty + ' ' + x.unit, amt: x.bid })),
  ].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 10);

  // Filtered tables
  const filteredScrap = scrapFilter === 'all' ? scrapEntries : scrapEntries.filter(x => x.session === scrapFilter);
  const filteredCoach = coachFilter === 'all' ? coachEntries : coachEntries.filter(x => x.session === coachFilter);
  const filteredSurvey = surveyFilter === 'all' ? surveyEntries : surveyEntries.filter(x => x.session === surveyFilter);

  // All records KPIs
  const totalScrapWT = scrapEntries.reduce((a, x) => a + (+x.wt_total || 0), 0);
  const totalAmt = scrapEntries.reduce((a, x) => a + (+x.amount || 0), 0);
  const totalCoachesCount = coachEntries.filter(x => x.sr !== 'AGG').length;

  /* ===== Chart Mode Labels ===== */
  const chartModeColors: Record<string, string> = { total: '#185FA5', ferrous: '#378ADD', wta: '#1D9E75', nf: '#BA7517', misc: '#888780' };
  const chartModeLabels: Record<string, string> = { total: 'Total disposal', ferrous: 'MS Ferrous', wta: 'WTA scrap', nf: 'Non-Ferrous', misc: 'Misc/Other' };

  return (
    <div className="bvp-page animate-fade-in">
      {/* Header */}
      <div className="bvp-header">
        <div>
          <h1 className="bvp-title">BVP Workshop — Scrap Position</h1>
          <p className="bvp-subtitle">Live entry system • Auto-updating dashboard</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          {/* Export Panel — shows for dashboard, summary-table, all-records */}
          {canExport && (
            <div style={{ position:'relative' }}>
              <button
                className="bvp-btn bvp-btn-primary"
                style={{ fontSize:12, gap:6, display:'flex', alignItems:'center' }}
                onClick={() => setExportMenuOpen(o => !o)}
                disabled={!!exportLoading}
              >
                {exportLoading ? (
                  <span style={{ display:'flex',alignItems:'center',gap:5 }}><span style={{animation:'spin 1s linear infinite',display:'inline-block'}}>⟳</span> {exportLoading.toUpperCase()}...</span>
                ) : (
                  <span style={{ display:'flex',alignItems:'center',gap:5 }}>📤 Export / Print <span style={{ fontSize:10, opacity:.8 }}>▼</span></span>
                )}
              </button>
              {exportMenuOpen && (
                <div style={{ position:'absolute', right:0, top:'calc(100% + 6px)', background:'var(--bvp-surface)', border:'1px solid var(--bvp-border)', borderRadius:12, boxShadow:'0 8px 30px rgba(0,0,0,0.15)', minWidth:210, zIndex:200, overflow:'hidden' }}>
                  <div style={{ padding:'8px 14px 6px', fontSize:9, fontWeight:700, color:'var(--bvp-text3)', textTransform:'uppercase', letterSpacing:'.07em', borderBottom:'0.5px solid var(--bvp-border)' }}>
                    {activeView === 'dashboard' ? '📊 Dashboard' : activeView === 'summary-table' ? '📋 Summary Table' : '📁 All Records'}
                  </div>
                  {[
                    { icon:'🖨️', label:'Print', sub:'Best quality print', key:'print', color:'#185FA5' },
                    { icon:'📄', label:'Download PDF', sub:'Exact screen layout', key:'pdf', color:'#D84E4E' },
                    { icon:'📊', label:'Download Excel', sub:'Editable spreadsheet', key:'excel', color:'#1D7044' },
                    { icon:'📝', label:'Download Word', sub:'Editable document', key:'word', color:'#2B579A' },
                  ].map(item => (
                    <button key={item.key}
                      onClick={() => handleExport(item.key as any)}
                      style={{ display:'flex', alignItems:'center', gap:10, width:'100%', padding:'10px 14px', background:'none', border:'none', cursor:'pointer', textAlign:'left', transition:'background .15s' }}
                      onMouseEnter={e => (e.currentTarget.style.background='var(--bvp-surface2)')}
                      onMouseLeave={e => (e.currentTarget.style.background='none')}
                    >
                      <span style={{ fontSize:20 }}>{item.icon}</span>
                      <span>
                        <div style={{ fontSize:13, fontWeight:600, color:'var(--bvp-text)' }}>{item.label}</div>
                        <div style={{ fontSize:10, color:'var(--bvp-text3)' }}>{item.sub}</div>
                      </span>
                    </button>
                  ))}
                  <div style={{ borderTop:'0.5px solid var(--bvp-border)', padding:'6px 14px 8px' }}>
                    <button onClick={exportData} style={{ fontSize:11, color:'var(--bvp-text3)', background:'none', border:'none', cursor:'pointer', padding:0 }}>⬇ Export JSON (Backup)</button>
                  </div>
                </div>
              )}
            </div>
          )}
          {!canExport && (
            <button className="bvp-btn bvp-btn-ghost" onClick={exportData} style={{ fontSize:'12px' }}>⬇ Export JSON</button>
          )}
        </div>
      </div>
      {/* Close export menu on outside click */}
      {exportMenuOpen && <div style={{ position:'fixed',inset:0,zIndex:199 }} onClick={() => setExportMenuOpen(false)} />}

      {/* Top Nav Tabs */}
      <div className="bvp-top-nav">
        {[
          { id: 'dashboard', label: '📊 Dashboard' },
          { id: 'scrap-entry', label: '➕ Scrap Entry' },
          { id: 'coach-entry', label: '🚃 Coach Entry' },
          { id: 'survey-entry', label: '📋 Survey / Auction' },
          { id: 'all-records', label: '📁 All Records' },
          { id: 'summary-table', label: '📊 Summary Table' },
          { id: 'mp-entry', label: '🔧 M&P Entry' },
        ].map(tab => (
          <button key={tab.id} className={`bvp-nav-btn ${activeView === tab.id ? 'active' : ''}`}
            onClick={() => setActiveView(tab.id)}>{tab.label}</button>
        ))}
      </div>

      {/* Session Bar */}
      <div className="bvp-session-bar">
        <label className="bvp-session-label">Active Session</label>
        <select className="bvp-session-select" value={showNewSession ? 'new' : currentSession}
          onChange={e => handleSessionChange(e.target.value)}>
          {sessions.map(s => <option key={s} value={s}>{s}</option>)}
          <option value="new">new</option>
        </select>
        {showNewSession && (
          <input type="text" className="bvp-input" placeholder="e.g. 2027-28" style={{ maxWidth: 120 }}
            onChange={e => { if (e.target.value.length >= 5) setCurrentSession(e.target.value); }} />
        )}
        <span className="bvp-session-badge">Session: {currentSession}</span>
        <span className="bvp-session-count">{sessionEntryCount.scrap} scrap entries • {sessionEntryCount.coach} coaches • {sessionEntryCount.survey} lots • {sessionEntryCount.mp} M&P</span>
      </div>

      {/* ==================== DASHBOARD VIEW ==================== */}
      {activeView === 'dashboard' && (
        <div className="bvp-view" id="bvp-print-dashboard">
          <div className="bvp-kpi-grid">
            {[
              { l: `Total disposal — ${currentSession}`, v: totalDisposal + ' MT', t: pct ? `${Number(pct) > 0 ? '↑' : '↓'} ${Math.abs(Number(pct))}% vs prev. year` : 'First session', c: Number(pct) > 0 ? 'up' : 'neutral' },
              { l: `Revenue — ${currentSession}`, v: '₹' + curData.rev.toFixed(1) + ' L', t: prevData ? `vs ₹${prevData.rev.toFixed(0)}L prev` : '', c: '' },
              { l: 'MS Ferrous', v: curData.ferrous.toFixed(1) + ' MT', t: '', c: '' },
              { l: 'WTA Scrap', v: curData.wta.toFixed(1) + ' MT', t: 'Wheel / Tyre / Axle', c: '' },
              { l: 'Non-Ferrous', v: curData.nf.toFixed(1) + ' MT', t: '', c: '' },
              { l: `M&P Items — ${currentSession}`, v: mpCount, t: mpTotalAmt ? '₹' + mpTotalAmt.toLocaleString() : 'Condemned items', c: 'neutral' },
              { l: `Coaches — ${currentSession}`, v: sessCoaches || '-', t: `${curData.pcv || 0} PCV + ${curData.ocv || 0} OCV`, c: '' },
              { l: 'Under Auction', v: underAuction, t: 'lots pending', c: underAuction ? 'down' : 'up' },
              { l: 'Sold Out Lots', v: soldOut, t: `lots in ${currentSession}`, c: 'up' },
            ].map((k, i) => (
              <div key={i} className="bvp-kpi">
                <div className="bvp-kpi-label">{k.l}</div>
                <div className="bvp-kpi-val">{k.v}</div>
                <div className={`bvp-kpi-trend ${k.c}`}>{k.t}</div>
              </div>
            ))}
          </div>

          <div className="bvp-section-title">Year-wise scrap disposal (MT)</div>
          <div className="bvp-chart-card">
            <div className="bvp-tab-bar">
              {(['total', 'ferrous', 'wta', 'nf', 'misc'] as const).map(mode => (
                <button key={mode} className={`bvp-tab-btn ${mainChartMode === mode ? 'active' : ''}`}
                  onClick={() => setMainChartMode(mode)}>
                  {mode === 'total' ? 'Total' : mode === 'ferrous' ? 'MS Ferrous' : mode === 'wta' ? 'WTA' : mode === 'nf' ? 'Non-Ferrous' : 'Misc'}
                </button>
              ))}
            </div>
            <div className="bvp-legend">
              <span><span className="bvp-ldot" style={{ background: chartModeColors[mainChartMode] }}></span>{chartModeLabels[mainChartMode]} (MT)</span>
            </div>
            <div className="bvp-chart-wrap" style={{ height: 280 }}><canvas ref={mainChartRef}></canvas></div>
          </div>

          <div className="bvp-two-col">
            <div>
              <div className="bvp-section-title">Category breakdown (current session)</div>
              <div className="bvp-chart-card">
                <div className="bvp-legend">
                  {[['Ferrous', '#185FA5'], ['WTA', '#1D9E75'], ['Non-F', '#BA7517'], ['Misc', '#888780']].map(([l, c], i) => (
                    <span key={i}><span className="bvp-ldot" style={{ background: c }}></span>{l} {piePcts[i]}%</span>
                  ))}
                </div>
                <div className="bvp-chart-wrap" style={{ height: 230 }}><canvas ref={pieChartRef}></canvas></div>
              </div>
            </div>
            <div>
              <div className="bvp-section-title">Revenue trend (₹ Crore)</div>
              <div className="bvp-chart-card">
                <div className="bvp-chart-wrap" style={{ height: 230 }}><canvas ref={revChartRef}></canvas></div>
              </div>
            </div>
          </div>

          <div className="bvp-section-title">Month-wise disposal — current session (MT)</div>
          <div className="bvp-chart-card">
            <div className="bvp-legend">
              <span><span className="bvp-ldot" style={{ background: '#185FA5' }}></span>Ferrous</span>
              <span><span className="bvp-ldot" style={{ background: '#1D9E75' }}></span>WTA</span>
              <span><span className="bvp-ldot" style={{ background: '#BA7517' }}></span>Non-Ferrous</span>
              <span><span className="bvp-ldot" style={{ background: '#888780' }}></span>Misc</span>
            </div>
            <div className="bvp-chart-wrap" style={{ height: 260 }}><canvas ref={monthChartRef}></canvas></div>
          </div>

          <div className="bvp-section-title">Category-wise — all sessions (MT)</div>
          <div className="bvp-chart-card">
            <div className="bvp-legend">
              <span><span className="bvp-ldot" style={{ background: '#185FA5' }}></span>Ferrous</span>
              <span><span className="bvp-ldot" style={{ background: '#1D9E75' }}></span>WTA</span>
              <span><span className="bvp-ldot" style={{ background: '#BA7517' }}></span>Non-Ferrous</span>
            </div>
            <div className="bvp-chart-wrap" style={{ height: 270 }}><canvas ref={catChartRef}></canvas></div>
          </div>

          <div className="bvp-section-title">Coach condemnation — year-wise</div>
          <div className="bvp-chart-card">
            <div className="bvp-legend">
              <span><span className="bvp-ldot" style={{ background: '#185FA5' }}></span>PCV</span>
              <span><span className="bvp-ldot" style={{ background: '#E24B4A' }}></span>OCV</span>
            </div>
            <div className="bvp-chart-wrap" style={{ height: 250 }}><canvas ref={coachChartRef}></canvas></div>
          </div>

          <div className="bvp-section-title">KPI summary</div>
          <div className="bvp-chart-card">
            {progBars.map((p, i) => (
              <div key={i} className="bvp-prog-item">
                <div className="bvp-prog-hd"><span style={{ color: 'var(--bvp-text2)' }}>{p.l}</span><span style={{ fontWeight: 500 }}>{p.val}</span></div>
                <div className="bvp-prog-track"><div className="bvp-prog-fill" style={{ width: p.pct + '%', background: p.c }}></div></div>
              </div>
            ))}
          </div>

          <div className="bvp-section-title">Recent entries (all types)</div>
          <div className="bvp-entries-wrap">
            <div className="bvp-entries-header"><h3>Latest 10 entries</h3></div>
            <div className="bvp-tbl-wrap">
              <table className="bvp-table">
                <thead><tr><th>Session</th><th>Type</th><th>Date</th><th>Description</th><th>Weight/Qty</th><th>Amount</th></tr></thead>
                <tbody>
                  {recentAll.length > 0 ? recentAll.map((r, i) => (
                    <tr key={i}>
                      <td><span className="bvp-badge bvp-badge-oa">{r.session}</span></td>
                      <td><span className={`bvp-badge ${r.type === 'Scrap' ? 'bvp-badge-sold' : r.type === 'Coach' ? 'bvp-badge-auction' : 'bvp-badge-ns'}`}>{r.type}</span></td>
                      <td>{fmt(r.date)}</td>
                      <td style={{ maxWidth: 240, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.desc}</td>
                      <td>{r.qty || '-'}</td>
                      <td>{r.amt ? '₹' + Number(r.amt).toLocaleString() : '-'}</td>
                    </tr>
                  )) : <tr><td colSpan={6} className="bvp-empty-state">No entries yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== SCRAP ENTRY VIEW ==================== */}
      {activeView === 'scrap-entry' && (
        <div className="bvp-view">
          <div className="bvp-info-banner">ℹ️ Scrap disposal entry — date, type, weight aur party select karo. Total amount auto-calculate hoga. Entry save hote hi dashboard update ho jayega.</div>

          <div className="bvp-form-card">
            <h3><span className="bvp-icon" style={{ background: 'var(--bvp-accent-light)' }}>⚙️</span>Scrap Disposal Entry</h3>
            <div className="bvp-form-grid">
              <div className="bvp-form-group">
                <label className="bvp-fl bvp-required">Session (Year)</label>
                <input type="text" className="bvp-input bvp-auto-field" readOnly value={currentSession} />
              </div>
              <div className="bvp-form-group">
                <label className="bvp-fl bvp-required">Date (From)</label>
                <input type="date" className="bvp-input" value={scrapForm.date_from} onChange={e => setScrapForm({ ...scrapForm, date_from: e.target.value })} />
              </div>
              <div className="bvp-form-group">
                <label className="bvp-fl bvp-required">Date (To / Delivery)</label>
                <input type="date" className="bvp-input" value={scrapForm.date_to} onChange={e => setScrapForm({ ...scrapForm, date_to: e.target.value })} />
              </div>
              <div className="bvp-form-group">
                <label className="bvp-fl bvp-required">Scrap Type</label>
                <select className="bvp-input" value={scrapForm.type} onChange={e => setScrapForm({ ...scrapForm, type: e.target.value })}>
                  <option value="">-- Select Type --</option>
                  <option value="WTA">WTA (Wheel/Tyre/Axle)</option>
                  <option value="MS Ferrous">MS Ferrous / Junk Scrap</option>
                  <option value="Turning Boring">Turning Boring Scrap</option>
                  <option value="Non Ferrous">Non-Ferrous (Copper/Al/SS)</option>
                  <option value="Rubber">Rubber Scrap</option>
                  <option value="Wooden">Wooden Scrap</option>
                  <option value="PVC Plastic">PVC / Plastic / Rexine</option>
                  <option value="Oil Grease">Oil / Grease / Lubricant</option>
                  <option value="Battery">Battery (VRLA / SMF)</option>
                  <option value="Machine Plant">Machine & Plant (M&P)</option>
                  <option value="Mix Kachara">Mix Hetro / Junk Kachara</option>
                  <option value="Other">Other Misc Scrap</option>
                </select>
              </div>
              <div className="bvp-form-group bvp-full">
                <label className="bvp-fl bvp-required">Description of Condemned Scrap</label>
                <textarea className="bvp-input bvp-textarea" value={scrapForm.desc} onChange={e => setScrapForm({ ...scrapForm, desc: e.target.value })} placeholder="e.g. SCRAP OLD USED & U/S DIFFERENT GRADE OIL 3950 LTR WITH 20 DRUM CAP. 200 LTR." />
              </div>
              <div className="bvp-form-group">
                <label className="bvp-fl">Qty (in Nos)</label>
                <input type="number" className="bvp-input" value={scrapForm.qty_nos} onChange={e => setScrapForm({ ...scrapForm, qty_nos: e.target.value })} placeholder="0" />
              </div>
              <div className="bvp-form-group">
                <label className="bvp-fl">Qty (in Sets)</label>
                <input type="number" className="bvp-input" value={scrapForm.qty_sets} onChange={e => setScrapForm({ ...scrapForm, qty_sets: e.target.value })} placeholder="0" />
              </div>
              <div className="bvp-form-group">
                <label className="bvp-fl">WTA / MS Scrap Weight (MT)</label>
                <input type="number" className="bvp-input" value={scrapForm.wt_wta} onChange={e => setScrapForm({ ...scrapForm, wt_wta: e.target.value })} placeholder="0.00" step="0.01" />
                <span className="bvp-hint">Wheel, Tyre, Axle or MS Ferrous weight in Metric Tons</span>
              </div>
              <div className="bvp-form-group">
                <label className="bvp-fl">Turning Boring Weight (MT)</label>
                <input type="number" className="bvp-input" value={scrapForm.wt_tb} onChange={e => setScrapForm({ ...scrapForm, wt_tb: e.target.value })} placeholder="0.00" step="0.01" />
              </div>
              <div className="bvp-form-group">
                <label className="bvp-fl">MS Scrap Weight (MT)</label>
                <input type="number" className="bvp-input" value={scrapForm.wt_ms} onChange={e => setScrapForm({ ...scrapForm, wt_ms: e.target.value })} placeholder="0.00" step="0.01" />
                <span className="bvp-hint">For MS junk, bogie frames, etc.</span>
              </div>
              <div className="bvp-form-group">
                <label className="bvp-fl">Non-Ferrous Weight (MT)</label>
                <input type="number" className="bvp-input" value={scrapForm.wt_nf} onChange={e => setScrapForm({ ...scrapForm, wt_nf: e.target.value })} placeholder="0.00" step="0.01" />
                <span className="bvp-hint">Copper, Aluminium, SS, Bronze</span>
              </div>
              <div className="bvp-form-group">
                <label className="bvp-fl">Other Scrap Weight (MT)</label>
                <input type="number" className="bvp-input" value={scrapForm.wt_other} onChange={e => setScrapForm({ ...scrapForm, wt_other: e.target.value })} placeholder="0.00" step="0.01" />
                <span className="bvp-hint">Oil/Grease/Rubber/Wooden (MT)</span>
              </div>
              <div className="bvp-form-group">
                <label className="bvp-fl">Total Weight (MT) — Auto</label>
                <input type="number" className="bvp-input bvp-auto-field" readOnly value={calcWtTotal() || ''} placeholder="Auto calculated" />
              </div>
              <div className="bvp-form-group">
                <label className="bvp-fl bvp-required">Lot No. / Advice Note No.</label>
                <input type="text" className="bvp-input" value={scrapForm.lot} onChange={e => setScrapForm({ ...scrapForm, lot: e.target.value })} placeholder="e.g. 88260308GRADEOILWS" />
              </div>
              <div className="bvp-form-group">
                <label className="bvp-fl bvp-required">Handed Over To (Party)</label>
                <input type="text" className="bvp-input" value={scrapForm.party} onChange={e => setScrapForm({ ...scrapForm, party: e.target.value })} placeholder="e.g. GALAXY PETROLEUM - RAIGADH" />
              </div>
              <div className="bvp-form-group">
                <label className="bvp-fl">Rate (₹ per MT / unit)</label>
                <input type="number" className="bvp-input" value={scrapForm.rate} onChange={e => setScrapForm({ ...scrapForm, rate: e.target.value })} placeholder="0" />
              </div>
              <div className="bvp-form-group">
                <label className="bvp-fl">Total Amount (₹) — Auto</label>
                <input type="text" className="bvp-input bvp-auto-field" readOnly value={calcAmount() ? '₹' + calcAmount().toLocaleString() : ''} placeholder="Auto calculated" />
              </div>
              <div className="bvp-form-group">
                <label className="bvp-fl">Remarks</label>
                <input type="text" className="bvp-input" value={scrapForm.remarks} onChange={e => setScrapForm({ ...scrapForm, remarks: e.target.value })} placeholder="Optional remarks" />
              </div>
            </div>
            <div className="bvp-btn-row">
              <button className="bvp-btn bvp-btn-primary" onClick={saveScrapEntry}>✓ Save Entry</button>
              <button className="bvp-btn bvp-btn-ghost" onClick={() => setScrapForm({ date_from: '', date_to: '', type: '', desc: '', qty_nos: '', qty_sets: '', wt_wta: '', wt_tb: '', wt_ms: '', wt_nf: '', wt_other: '', lot: '', party: '', rate: '', remarks: '' })}>✕ Clear</button>
              {calcWtTotal() > 0 && <span className="bvp-calc-badge">Total: {calcWtTotal()} MT {calcAmount() ? '• ₹' + calcAmount().toLocaleString() : ''}</span>}
            </div>
          </div>

          {/* Scrap entries table */}
          <div className="bvp-entries-wrap">
            <div className="bvp-entries-header">
              <h3>Scrap Entries — {currentSession}</h3>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select className="bvp-input" style={{ fontSize: 12, padding: '4px 8px', width: 'auto' }} value={scrapFilter} onChange={e => setScrapFilter(e.target.value)}>
                  <option value="all">All Sessions</option>
                  {allSessions.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <span style={{ fontSize: 12, color: 'var(--bvp-text3)' }}>{filteredScrap.length} entries</span>
              </div>
            </div>
            <div className="bvp-tbl-wrap">
              <table className="bvp-table">
                <thead><tr><th>Session</th><th>Date From</th><th>Date To</th><th>Type</th><th>Description</th><th>Total WT (MT)</th><th>Lot No.</th><th>Party</th><th>Rate ₹</th><th>Amount ₹</th><th></th></tr></thead>
                <tbody>
                  {filteredScrap.length > 0 ? [...filteredScrap].reverse().map(r => (
                    <tr key={r.id}>
                      <td><span className="bvp-badge bvp-badge-oa">{r.session}</span></td>
                      <td>{fmt(r.date_from)}</td><td>{fmt(r.date_to)}</td>
                      <td><span className="bvp-badge bvp-badge-auction">{r.type}</span></td>
                      <td style={{ maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.desc}>{r.desc}</td>
                      <td>{r.wt_total ? r.wt_total + ' MT' : '-'}</td>
                      <td style={{ fontSize: 11, fontFamily: 'monospace' }}>{r.lot || '-'}</td>
                      <td>{r.party}</td>
                      <td>{r.rate ? '₹' + r.rate.toLocaleString() : '-'}</td>
                      <td>{r.amount ? '₹' + (r.amount / 100000).toFixed(1) + 'L' : '-'}</td>
                      <td><button className="bvp-del-btn" onClick={() => deleteEntry('scrap', r.id)}>×</button></td>
                    </tr>
                  )) : <tr><td colSpan={11} className="bvp-empty-state">No entries yet. Upar form se add karo.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== COACH ENTRY VIEW ==================== */}
      {activeView === 'coach-entry' && (
        <div className="bvp-view">
          <div className="bvp-info-banner">ℹ️ Coach condemnation entry — har coach ke liye ek row. Coach No., type, RSO number, sale details add karo.</div>

          <div className="bvp-form-card">
            <h3><span className="bvp-icon" style={{ background: 'var(--bvp-amber-light)' }}>🚃</span>Coach Condemnation Entry</h3>
            <div className="bvp-form-grid">
              <div className="bvp-form-group">
                <label className="bvp-fl bvp-required">Session (Year)</label>
                <input type="text" className="bvp-input bvp-auto-field" readOnly value={currentSession} />
              </div>
              <div className="bvp-form-group">
                <label className="bvp-fl bvp-required">Coach No.</label>
                <input type="text" className="bvp-input" value={coachForm.coach_no} onChange={e => setCoachForm({ ...coachForm, coach_no: e.target.value })} placeholder="e.g. 942370" />
              </div>
              <div className="bvp-form-group">
                <label className="bvp-fl bvp-required">Coach Code / Type</label>
                <select className="bvp-input" value={coachForm.code} onChange={e => setCoachForm({ ...coachForm, code: e.target.value })}>
                  <option value="">-- Select Type --</option>
                  {['GS','GSLR','GSLRD','RCC','PP','RH','RHV','RSM','RT','RE','VPH/VPUHX','VPU','WGCB','WGSCN','WGSCZ','WGFCWAC','WGACCN','WGACCW','WGSCZAC','GSLR/RH','WGSCN/RE','GSLRD DMU','Other'].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="bvp-form-group">
                <label className="bvp-fl">Tare Weight</label>
                <input type="number" className="bvp-input" value={coachForm.tare} onChange={e => setCoachForm({ ...coachForm, tare: e.target.value })} placeholder="e.g. 39.4" step="0.1" />
              </div>
              <div className="bvp-form-group">
                <label className="bvp-fl">No. of Seats</label>
                <input type="number" className="bvp-input" value={coachForm.seats} onChange={e => setCoachForm({ ...coachForm, seats: e.target.value })} placeholder="e.g. 72" />
              </div>
              <div className="bvp-form-group">
                <label className="bvp-fl">No. of Berths</label>
                <input type="number" className="bvp-input" value={coachForm.berths} onChange={e => setCoachForm({ ...coachForm, berths: e.target.value })} placeholder="e.g. 72" />
              </div>
              <div className="bvp-form-group">
                <label className="bvp-fl">Cost ('000)</label>
                <input type="number" className="bvp-input" value={coachForm.cost} onChange={e => setCoachForm({ ...coachForm, cost: e.target.value })} placeholder="e.g. 2350" />
              </div>
              <div className="bvp-form-group">
                <label className="bvp-fl bvp-required">Overaged / Underaged</label>
                <select className="bvp-input" value={coachForm.age} onChange={e => setCoachForm({ ...coachForm, age: e.target.value })}>
                  <option value="">-- Select --</option>
                  <option>OVERAGED</option>
                  <option>UNDERAGED</option>
                </select>
              </div>
              <div className="bvp-form-group">
                <label className="bvp-fl bvp-required">Condemned By</label>
                <select className="bvp-input" value={coachForm.cond_by} onChange={e => setCoachForm({ ...coachForm, cond_by: e.target.value })}>
                  <option value="">-- Select --</option>
                  {['CWM-BVP', 'CME-CCG', 'CWE-CCG', 'CWE-BVP', 'Other'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="bvp-form-group">
                <label className="bvp-fl">Coach Category</label>
                <select className="bvp-input" value={coachForm.cat} onChange={e => setCoachForm({ ...coachForm, cat: e.target.value })}>
                  <option value="PCV">PCV (Passenger Carrying)</option>
                  <option value="OCV">OCV (Other Coaching)</option>
                </select>
              </div>
              <div className="bvp-form-group">
                <label className="bvp-fl">RSO No.</label>
                <input type="text" className="bvp-input" value={coachForm.rso} onChange={e => setCoachForm({ ...coachForm, rso: e.target.value })} placeholder="e.g. M.100/2/RSO/2026-27/01" />
              </div>
              <div className="bvp-form-group">
                <label className="bvp-fl">RSO Date</label>
                <input type="date" className="bvp-input" value={coachForm.rso_date} onChange={e => setCoachForm({ ...coachForm, rso_date: e.target.value })} />
              </div>
              <div className="bvp-form-group">
                <label className="bvp-fl">Offer / Auction Date</label>
                <input type="date" className="bvp-input" value={coachForm.offer_date} onChange={e => setCoachForm({ ...coachForm, offer_date: e.target.value })} />
              </div>
              <div className="bvp-form-group">
                <label className="bvp-fl">1st Auction Date</label>
                <input type="date" className="bvp-input" value={coachForm.auc1} onChange={e => setCoachForm({ ...coachForm, auc1: e.target.value })} />
              </div>
              <div className="bvp-form-group">
                <label className="bvp-fl">2nd Auction Date</label>
                <input type="date" className="bvp-input" value={coachForm.auc2} onChange={e => setCoachForm({ ...coachForm, auc2: e.target.value })} />
              </div>
              <div className="bvp-form-group">
                <label className="bvp-fl">Sale Order No.</label>
                <input type="text" className="bvp-input" value={coachForm.sale_order} onChange={e => setCoachForm({ ...coachForm, sale_order: e.target.value })} placeholder="e.g. 88230507.COACH.4WS" />
              </div>
              <div className="bvp-form-group">
                <label className="bvp-fl">Sale Order Date</label>
                <input type="date" className="bvp-input" value={coachForm.sale_date} onChange={e => setCoachForm({ ...coachForm, sale_date: e.target.value })} />
              </div>
              <div className="bvp-form-group">
                <label className="bvp-fl">Purchaser Name</label>
                <input type="text" className="bvp-input" value={coachForm.purchaser} onChange={e => setCoachForm({ ...coachForm, purchaser: e.target.value })} placeholder="e.g. GAJENDRA SCRAPE SUPPLIERS GNC" />
              </div>
              <div className="bvp-form-group">
                <label className="bvp-fl">Delivery From</label>
                <input type="date" className="bvp-input" value={coachForm.del_from} onChange={e => setCoachForm({ ...coachForm, del_from: e.target.value })} />
              </div>
              <div className="bvp-form-group">
                <label className="bvp-fl">Delivery To</label>
                <input type="date" className="bvp-input" value={coachForm.del_to} onChange={e => setCoachForm({ ...coachForm, del_to: e.target.value })} />
              </div>
              <div className="bvp-form-group">
                <label className="bvp-fl">Sale Amount (₹)</label>
                <input type="number" className="bvp-input" value={coachForm.sale_amt} onChange={e => setCoachForm({ ...coachForm, sale_amt: e.target.value })} placeholder="e.g. 852111" />
              </div>
              <div className="bvp-form-group">
                <label className="bvp-fl">Disposal Status</label>
                <select className="bvp-input" value={coachForm.status} onChange={e => setCoachForm({ ...coachForm, status: e.target.value })}>
                  <option value="SOLD">SOLD</option>
                  <option value="NOT SOLD">NOT SOLD</option>
                  <option value="PENDING">PENDING</option>
                </select>
              </div>
              <div className="bvp-form-group bvp-full">
                <label className="bvp-fl">Special Remarks / CRS Letter</label>
                <textarea className="bvp-input bvp-textarea" value={coachForm.remarks} onChange={e => setCoachForm({ ...coachForm, remarks: e.target.value })} placeholder="Any special condemnation order or letter reference" />
              </div>
            </div>
            <div className="bvp-btn-row">
              <button className="bvp-btn bvp-btn-primary" onClick={saveCoachEntry}>✓ Save Coach Entry</button>
              <button className="bvp-btn bvp-btn-ghost" onClick={() => setCoachForm({ coach_no: '', code: '', tare: '', seats: '', berths: '', cost: '', age: '', cond_by: '', cat: 'PCV', rso: '', rso_date: '', offer_date: '', auc1: '', auc2: '', sale_order: '', sale_date: '', purchaser: '', del_from: '', del_to: '', sale_amt: '', status: 'SOLD', remarks: '' })}>✕ Clear</button>
            </div>
          </div>

          {/* Coach table */}
          <div className="bvp-entries-wrap">
            <div className="bvp-entries-header">
              <h3>Coach Entries</h3>
              <select className="bvp-input" style={{ fontSize: 12, padding: '4px 8px', width: 'auto' }} value={coachFilter} onChange={e => setCoachFilter(e.target.value)}>
                <option value="all">All Sessions</option>
                {allSessions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="bvp-tbl-wrap">
              <table className="bvp-table">
                <thead><tr><th>Sr.</th><th>Session</th><th>Coach No.</th><th>Code</th><th>Category</th><th>Age</th><th>Cond. By</th><th>RSO No.</th><th>Purchaser</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {filteredCoach.length > 0 ? [...filteredCoach].reverse().map((r, idx) => (
                    <tr key={r.id}>
                      <td>{idx + 1}</td>
                      <td><span className="bvp-badge bvp-badge-oa">{r.session}</span></td>
                      <td style={{ fontWeight: 600 }}>{r.coach_no}</td>
                      <td><span className="bvp-badge bvp-badge-auction">{r.code}</span></td>
                      <td>{r.cat || '-'}</td>
                      <td><span className={`bvp-badge ${r.age === 'OVERAGED' ? 'bvp-badge-sold' : 'bvp-badge-ns'}`}>{r.age || '-'}</span></td>
                      <td>{r.cond_by || '-'}</td>
                      <td style={{ fontSize: 11 }}>{r.rso || '-'}</td>
                      <td>{r.purchaser || '-'}</td>
                      <td><span className={`bvp-badge ${r.status === 'SOLD' ? 'bvp-badge-sold' : r.status === 'NOT SOLD' ? 'bvp-badge-ns' : 'bvp-badge-auction'}`}>{r.status}</span></td>
                      <td><button className="bvp-del-btn" onClick={() => deleteEntry('coach', r.id)}>×</button></td>
                    </tr>
                  )) : <tr><td colSpan={11} className="bvp-empty-state">No coach entries.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== SURVEY ENTRY VIEW ==================== */}
      {activeView === 'survey-entry' && (
        <div className="bvp-view">
          <div className="bvp-info-banner">ℹ️ Survey Committee — auction lot entry. Har lot ke liye description, qty, offer date aur status add karo.</div>

          <div className="bvp-form-card">
            <h3><span className="bvp-icon" style={{ background: 'var(--bvp-green-light)' }}>📋</span>Survey Committee / Auction Lot Entry</h3>
            <div className="bvp-form-grid">
              <div className="bvp-form-group">
                <label className="bvp-fl bvp-required">Session</label>
                <input type="text" className="bvp-input bvp-auto-field" readOnly value={currentSession} />
              </div>
              <div className="bvp-form-group">
                <label className="bvp-fl bvp-required">Lot No.</label>
                <input type="text" className="bvp-input" value={surveyForm.lot} onChange={e => setSurveyForm({ ...surveyForm, lot: e.target.value })} placeholder="e.g. 25.26.04.07" />
              </div>
              <div className="bvp-form-group bvp-full">
                <label className="bvp-fl bvp-required">Location</label>
                <input type="text" className="bvp-input" value={surveyForm.location} onChange={e => setSurveyForm({ ...surveyForm, location: e.target.value })} placeholder="e.g. BVP BG Workshop near Incinerator area" />
              </div>
              <div className="bvp-form-group bvp-full">
                <label className="bvp-fl bvp-required">Description of Scrap</label>
                <textarea className="bvp-input bvp-textarea" value={surveyForm.desc} onChange={e => setSurveyForm({ ...surveyForm, desc: e.target.value })} placeholder="Detailed description of the lot including composition, approximate weight, delivery mode, etc." />
              </div>
              <div className="bvp-form-group">
                <label className="bvp-fl bvp-required">Quantity</label>
                <input type="number" className="bvp-input" value={surveyForm.qty} onChange={e => setSurveyForm({ ...surveyForm, qty: e.target.value })} placeholder="e.g. 50" step="0.001" />
              </div>
              <div className="bvp-form-group">
                <label className="bvp-fl bvp-required">Unit</label>
                <select className="bvp-input" value={surveyForm.unit} onChange={e => setSurveyForm({ ...surveyForm, unit: e.target.value })}>
                  <option value="MT">MT (Metric Ton)</option>
                  <option value="Kg">Kg</option>
                  <option value="No">No. (Numbers)</option>
                  <option value="Set">Set</option>
                  <option value="Ltr">Ltr</option>
                </select>
              </div>
              <div className="bvp-form-group">
                <label className="bvp-fl">Approx Weight (MT)</label>
                <input type="number" className="bvp-input" value={surveyForm.wt} onChange={e => setSurveyForm({ ...surveyForm, wt: e.target.value })} placeholder="0.00" step="0.01" />
              </div>
              <div className="bvp-form-group">
                <label className="bvp-fl bvp-required">Offer / Auction Date</label>
                <input type="date" className="bvp-input" value={surveyForm.offer_date} onChange={e => setSurveyForm({ ...surveyForm, offer_date: e.target.value })} />
              </div>
              <div className="bvp-form-group">
                <label className="bvp-fl">Bid Amount (₹)</label>
                <input type="number" className="bvp-input" value={surveyForm.bid} onChange={e => setSurveyForm({ ...surveyForm, bid: e.target.value })} placeholder="0" />
              </div>
              <div className="bvp-form-group">
                <label className="bvp-fl">Purchaser Name</label>
                <input type="text" className="bvp-input" value={surveyForm.purchaser} onChange={e => setSurveyForm({ ...surveyForm, purchaser: e.target.value })} placeholder="Firm / party name" />
              </div>
              <div className="bvp-form-group">
                <label className="bvp-fl bvp-required">Status</label>
                <select className="bvp-input" value={surveyForm.status} onChange={e => setSurveyForm({ ...surveyForm, status: e.target.value })}>
                  <option value="UNDER AUCTION">UNDER AUCTION</option>
                  <option value="SOLD OUT">SOLD OUT</option>
                  <option value="NOT SOLD">NOT SOLD</option>
                  <option value="RE-AUCTION">RE-AUCTION</option>
                </select>
              </div>
              <div className="bvp-form-group">
                <label className="bvp-fl">Scrap Category</label>
                <select className="bvp-input" value={surveyForm.category} onChange={e => setSurveyForm({ ...surveyForm, category: e.target.value })}>
                  <option value="">-- Optional --</option>
                  {['MS Ferrous', 'Non-Ferrous', 'WTA', 'Rubber', 'Wooden', 'PVC/Plastic', 'Battery', 'Mix/Junk', 'Machine/Plant', 'Other'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="bvp-form-group bvp-full">
                <label className="bvp-fl">Remarks</label>
                <input type="text" className="bvp-input" value={surveyForm.remarks} onChange={e => setSurveyForm({ ...surveyForm, remarks: e.target.value })} placeholder="e.g. SOLD OUT, RE AUCTION" />
              </div>
            </div>
            <div className="bvp-btn-row">
              <button className="bvp-btn bvp-btn-success" onClick={saveSurveyEntry}>✓ Save Lot Entry</button>
              <button className="bvp-btn bvp-btn-ghost" onClick={() => setSurveyForm({ lot: '', location: '', desc: '', qty: '', unit: 'MT', wt: '', offer_date: '', bid: '', purchaser: '', status: 'UNDER AUCTION', category: '', remarks: '' })}>✕ Clear</button>
            </div>
          </div>

          {/* Survey table */}
          <div className="bvp-entries-wrap">
            <div className="bvp-entries-header">
              <h3>Auction Lot Tracker</h3>
              <select className="bvp-input" style={{ fontSize: 12, padding: '4px 8px', width: 'auto' }} value={surveyFilter} onChange={e => setSurveyFilter(e.target.value)}>
                <option value="all">All Sessions</option>
                {allSessions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="bvp-tbl-wrap">
              <table className="bvp-table">
                <thead><tr><th>Sr.</th><th>Session</th><th>Lot No.</th><th>Category</th><th>Qty</th><th>Unit</th><th>Offer Date</th><th>Purchaser</th><th>Bid ₹</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {filteredSurvey.length > 0 ? [...filteredSurvey].reverse().map((r, idx) => (
                    <tr key={r.id}>
                      <td>{idx + 1}</td>
                      <td><span className="bvp-badge bvp-badge-oa">{r.session}</span></td>
                      <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.lot}</td>
                      <td>{r.category || '-'}</td>
                      <td>{r.qty}</td><td>{r.unit}</td>
                      <td>{fmt(r.offer_date)}</td>
                      <td>{r.purchaser || '-'}</td>
                      <td>{r.bid ? '₹' + r.bid.toLocaleString() : '-'}</td>
                      <td><span className={`bvp-badge ${r.status === 'SOLD OUT' ? 'bvp-badge-sold' : r.status === 'NOT SOLD' ? 'bvp-badge-ns' : 'bvp-badge-auction'}`}>{r.status}</span></td>
                      <td><button className="bvp-del-btn" onClick={() => deleteEntry('survey', r.id)}>×</button></td>
                    </tr>
                  )) : <tr><td colSpan={11} className="bvp-empty-state">No lots entered yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== ALL RECORDS VIEW ==================== */}
      {activeView === 'all-records' && (
        <div className="bvp-view" id="bvp-print-records">
          <div className="bvp-kpi-grid">
            {[
              { l: 'Total Scrap Entries', v: scrapEntries.length },
              { l: 'Total Weight (MT)', v: totalScrapWT.toFixed(1) + ' MT' },
              { l: 'Total Revenue', v: '₹' + (totalAmt / 10000000).toFixed(2) + ' Cr' },
              { l: 'Coach Entries', v: totalCoachesCount },
              { l: 'Auction Lots', v: surveyEntries.length },
            ].map((k, i) => (
              <div key={i} className="bvp-kpi">
                <div className="bvp-kpi-label">{k.l}</div>
                <div className="bvp-kpi-val">{k.v}</div>
              </div>
            ))}
          </div>

          <div className="bvp-section-title">All Scrap Entries</div>
          <div className="bvp-entries-wrap">
            <div className="bvp-entries-header"><h3>Scrap Disposal Records</h3></div>
            <div className="bvp-tbl-wrap">
              <table className="bvp-table">
                <thead><tr><th>Session</th><th>Date</th><th>Type</th><th>Description (short)</th><th>Total WT</th><th>Party</th><th>Amount ₹</th></tr></thead>
                <tbody>
                  {scrapEntries.length > 0 ? [...scrapEntries].reverse().map(r => (
                    <tr key={r.id}>
                      <td><span className="bvp-badge bvp-badge-oa">{r.session}</span></td>
                      <td>{fmt(r.date_from)}</td>
                      <td><span className="bvp-badge bvp-badge-auction">{r.type}</span></td>
                      <td style={{ maxWidth: 200, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{r.desc}</td>
                      <td>{r.wt_total ? r.wt_total + ' MT' : '-'}</td>
                      <td>{r.party}</td>
                      <td>{r.amount ? '₹' + r.amount.toLocaleString() : '-'}</td>
                    </tr>
                  )) : <tr><td colSpan={7} className="bvp-empty-state">No records</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bvp-section-title">All Coach Entries</div>
          <div className="bvp-entries-wrap">
            <div className="bvp-entries-header"><h3>Coach Condemnation Records</h3></div>
            <div className="bvp-tbl-wrap">
              <table className="bvp-table">
                <thead><tr><th>Session</th><th>Sr.</th><th>Coach No.</th><th>Code</th><th>Cat.</th><th>Age</th><th>Purchaser</th><th>Status</th></tr></thead>
                <tbody>
                  {coachEntries.length > 0 ? [...coachEntries].reverse().map(r => (
                    <tr key={r.id}>
                      <td><span className="bvp-badge bvp-badge-oa">{r.session}</span></td>
                      <td>{r.sr}</td>
                      <td style={{ fontWeight: 600 }}>{r.coach_no}</td>
                      <td>{r.code}</td><td>{r.cat || '-'}</td>
                      <td><span className={`bvp-badge ${r.age === 'OVERAGED' ? 'bvp-badge-sold' : 'bvp-badge-ns'}`}>{r.age || '-'}</span></td>
                      <td>{r.purchaser || '-'}</td>
                      <td><span className={`bvp-badge ${r.status === 'SOLD' ? 'bvp-badge-sold' : 'bvp-badge-ns'}`}>{r.status}</span></td>
                    </tr>
                  )) : <tr><td colSpan={8} className="bvp-empty-state">No records</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bvp-section-title">All Auction Lots</div>
          <div className="bvp-entries-wrap">
            <div className="bvp-entries-header"><h3>Survey Committee Records</h3></div>
            <div className="bvp-tbl-wrap">
              <table className="bvp-table">
                <thead><tr><th>Session</th><th>Lot No.</th><th>Qty</th><th>Unit</th><th>Offer Date</th><th>Bid ₹</th><th>Status</th></tr></thead>
                <tbody>
                  {surveyEntries.length > 0 ? surveyEntries.map(r => (
                    <tr key={r.id}>
                      <td><span className="bvp-badge bvp-badge-oa">{r.session}</span></td>
                      <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.lot}</td>
                      <td>{r.qty}</td><td>{r.unit}</td>
                      <td>{fmt(r.offer_date)}</td>
                      <td>{r.bid ? '₹' + r.bid.toLocaleString() : '-'}</td>
                      <td><span className={`bvp-badge ${r.status === 'SOLD OUT' ? 'bvp-badge-sold' : r.status === 'NOT SOLD' ? 'bvp-badge-ns' : 'bvp-badge-auction'}`}>{r.status}</span></td>
                    </tr>
                  )) : <tr><td colSpan={7} className="bvp-empty-state">No records</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== SUMMARY TABLE VIEW ==================== */}
      {activeView === 'summary-table' && (() => {
        const MKEYS = ['04','05','06','07','08','09','10','11','12','01','02','03'];
        const MLAB = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'];
        const SEED_IDS_SET = new Set(SEED_IDS);

        const allSumSessions = [...new Set([
          ...Object.keys(MONTHLY_DATA),
          ...scrapEntries.map(x => x.session),
          ...mpEntries.map(x => x.session),
          currentSession
        ])].sort().reverse();

        const renderSummary = (sess: string) => {
          const hasMD = !!MONTHLY_DATA[sess];
          const sessMP = mpEntries.filter(x => x.session === sess);
          const sessScrap = scrapEntries.filter(x => x.session === sess);

          const monthly = MLAB.map((mo, i) => ({
            mo, ferrous: 0, wta: 0, nf: 0, misc: 0, mp_mt: 0,
            rs_f: 0, rs_w: 0, rs_nf: 0, rs_m: 0, mp_rs: 0
          }));

          if (hasMD) {
            const md = MONTHLY_DATA[sess];
            monthly.forEach((m, i) => {
              m.ferrous = md.ferrous[i] || 0; m.wta = md.wta[i] || 0;
              m.nf = md.nf[i] || 0; m.misc = md.misc[i] || 0; m.mp_mt = md.mp_mt[i] || 0;
              m.rs_f = md.rs_f[i] || 0; m.rs_w = md.rs_w[i] || 0;
              m.rs_nf = md.rs_nf[i] || 0; m.rs_m = md.rs_m[i] || 0; m.mp_rs = md.mp_rs[i] || 0;
            });
          }
          // Always add user entries (non-seed)
          sessScrap.filter(e => !SEED_IDS_SET.has(e.id)).forEach(e => {
            const mk = (e.date_from || '').slice(5, 7);
            const idx = MKEYS.indexOf(mk);
            if (idx < 0) return;
            const t = e.type || '';
            if (t === 'WTA') { monthly[idx].wta += +e.wt_wta || 0; monthly[idx].rs_w += +e.amount || 0; }
            else if (t === 'Non Ferrous') { monthly[idx].nf += +e.wt_nf || 0; monthly[idx].rs_nf += +e.amount || 0; }
            else { monthly[idx].ferrous += (+e.wt_ms || 0) + (+e.wt_wta || 0) + (+e.wt_tb || 0); monthly[idx].rs_f += +e.amount || 0; }
            monthly[idx].misc += +e.wt_other || 0;
          });

          sessMP.forEach(e => {
            const idx = MKEYS.indexOf(e.month);
            if (idx >= 0) { monthly[idx].mp_mt += +e.wt || 0; monthly[idx].mp_rs += +e.amount || 0; }
          });

          const tot = monthly.reduce((a, m) => ({
            ferrous: a.ferrous + m.ferrous, wta: a.wta + m.wta, nf: a.nf + m.nf, misc: a.misc + m.misc, mp_mt: a.mp_mt + m.mp_mt,
            rs_f: a.rs_f + m.rs_f, rs_w: a.rs_w + m.rs_w, rs_nf: a.rs_nf + m.rs_nf, rs_m: a.rs_m + m.rs_m, mp_rs: a.mp_rs + m.mp_rs
          }), { ferrous: 0, wta: 0, nf: 0, misc: 0, mp_mt: 0, rs_f: 0, rs_w: 0, rs_nf: 0, rs_m: 0, mp_rs: 0 });
          const totMT = tot.ferrous + tot.wta + tot.nf + tot.misc;
          const totRS = tot.rs_f + tot.rs_w + tot.rs_nf + tot.rs_m;
          const cr = (v: number) => '₹' + (v / 10000000).toFixed(2) + ' Cr';
          const fMT = (v: number) => v ? +(+v).toFixed(3) + '' : '—';
          const fRS = (v: number) => v ? Math.round(v).toLocaleString('en-IN') : '—';

          const tgt = TARGETS[sess];
          const pct = (a: number, t: number) => ((a / t) * 100).toFixed(1);
          const cls = (p: string) => +p >= 200 ? 'tgt-good' : +p >= 100 ? 'tgt-ok' : 'tgt-bad';

          return (
            <div className="bvp-entries-wrap" id="bvp-summary-content" key={sess}>
              <div className="bvp-entries-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                <h3>Mechanical &amp; Electrical Scrap Handed Over / Delivered — {sess}</h3>
                <p style={{ fontSize: 11, color: 'var(--bvp-text3)' }}>In Metric Ton &amp; In Rs. | M&amp;P items highlighted in amber column</p>
              </div>
              {/* KPI row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 10, padding: '14px 18px', borderBottom: '0.5px solid var(--bvp-border)' }}>
                {[
                  { l: 'MS Ferrous', v: tot.ferrous.toFixed(1) + ' MT', s: cr(tot.rs_f) },
                  { l: 'WTA', v: tot.wta.toFixed(1) + ' MT', s: cr(tot.rs_w) },
                  { l: 'Non-Ferrous', v: tot.nf.toFixed(1) + ' MT', s: cr(tot.rs_nf) },
                  { l: 'Misc', v: tot.misc.toFixed(1) + ' MT', s: cr(tot.rs_m) },
                ].map((k, i) => (
                  <div key={i} style={{ background: 'var(--bvp-surface2)', borderRadius: 10, padding: '10px 12px', border: '0.5px solid var(--bvp-border)' }}>
                    <div style={{ fontSize: 10, color: 'var(--bvp-text3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>{k.l}</div>
                    <div style={{ fontSize: 17, fontWeight: 600 }}>{k.v}</div>
                    <div style={{ fontSize: 11, color: 'var(--bvp-text2)', marginTop: 2 }}>{k.s}</div>
                  </div>
                ))}
                <div style={{ background: 'var(--bvp-surface2)', borderRadius: 10, padding: '10px 12px', border: '1px solid var(--bvp-amber)' }}>
                  <div style={{ fontSize: 10, color: 'var(--bvp-amber)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>M&amp;P Items</div>
                  <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--bvp-amber)' }}>{tot.mp_mt > 0 ? tot.mp_mt.toFixed(3) + ' MT' : sessMP.length + ' nos.'}</div>
                  <div style={{ fontSize: 11, color: 'var(--bvp-text2)', marginTop: 2 }}>{tot.mp_rs > 0 ? '₹' + tot.mp_rs.toLocaleString('en-IN') : '—'}</div>
                </div>
                <div style={{ background: 'var(--bvp-surface2)', borderRadius: 10, padding: '10px 12px', border: '1px solid var(--bvp-accent)' }}>
                  <div style={{ fontSize: 10, color: 'var(--bvp-text3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>Grand Total</div>
                  <div style={{ fontSize: 17, fontWeight: 600 }}>{totMT.toFixed(1)} MT</div>
                  <div style={{ fontSize: 11, color: 'var(--bvp-text2)', marginTop: 2 }}>{cr(totRS)}</div>
                </div>
              </div>
              {/* Table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ minWidth: 1100, fontSize: 12, borderCollapse: 'collapse', width: '100%' }}>
                  <thead>
                    <tr>
                      <th rowSpan={2} style={{ textAlign: 'left', minWidth: 60, padding: '7px 8px', fontSize: 10, fontWeight: 600, color: 'var(--bvp-text3)', textTransform: 'uppercase', letterSpacing: '.03em', borderBottom: '0.5px solid var(--bvp-border)', background: 'var(--bvp-surface2)', whiteSpace: 'nowrap' }}>Month &amp; Year</th>
                      <th colSpan={6} style={{ textAlign: 'center', padding: '7px 8px', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: '0.5px solid var(--bvp-border)', background: '#E6F1FB', color: '#185FA5' }}>In Metric Ton</th>
                      <th colSpan={6} style={{ textAlign: 'center', padding: '7px 8px', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: '0.5px solid var(--bvp-border)', background: '#E1F5EE', color: '#1D9E75' }}>In Rs.</th>
                    </tr>
                    <tr>
                      {['MS Ferrous','W.T.A.','Non-Ferrous','Misc.','Total'].map(h => (
                        <th key={h} style={{ padding: '6px 8px', textAlign: 'right', fontSize: 10, fontWeight: 600, color: 'var(--bvp-text3)', textTransform: 'uppercase', letterSpacing: '.03em', borderBottom: '0.5px solid var(--bvp-border)', background: 'var(--bvp-surface2)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                      <th style={{ padding: '6px 8px', textAlign: 'right', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.03em', borderBottom: '0.5px solid var(--bvp-border)', background: '#FAEEDA', color: '#BA7517', whiteSpace: 'nowrap' }}>M&amp;P Items</th>
                      {['MS Ferrous','W.T.A.','Non-Ferrous','Misc.','Total'].map(h => (
                        <th key={'r'+h} style={{ padding: '6px 8px', textAlign: 'right', fontSize: 10, fontWeight: 600, color: 'var(--bvp-text3)', textTransform: 'uppercase', letterSpacing: '.03em', borderBottom: '0.5px solid var(--bvp-border)', background: 'var(--bvp-surface2)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                      <th style={{ padding: '6px 8px', textAlign: 'right', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.03em', borderBottom: '0.5px solid var(--bvp-border)', background: '#FAEEDA', color: '#BA7517', whiteSpace: 'nowrap' }}>M&amp;P Items</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthly.map((m, i) => {
                      const tt = m.ferrous + m.wta + m.nf + m.misc;
                      const tr2 = m.rs_f + m.rs_w + m.rs_nf + m.rs_m;
                      const td: React.CSSProperties = { padding: '7px 8px', textAlign: 'right', borderBottom: '0.5px solid var(--bvp-border)', color: 'var(--bvp-text)', whiteSpace: 'nowrap', fontSize: 12 };
                      return (
                        <tr key={i} style={{ cursor: 'default' }}>
                          <td style={{ ...td, textAlign: 'left', fontWeight: 500, color: 'var(--bvp-text2)' }}>{m.mo}</td>
                          <td style={td}>{fMT(m.ferrous)}</td>
                          <td style={td}>{fMT(m.wta)}</td>
                          <td style={td}>{fMT(m.nf)}</td>
                          <td style={td}>{fMT(m.misc)}</td>
                          <td style={{ ...td, fontWeight: 600 }}>{fMT(tt)}</td>
                          <td style={{ ...td, color: '#BA7517', fontWeight: 500 }}>{m.mp_mt > 0 ? fMT(m.mp_mt) : '—'}</td>
                          <td style={td}>{fRS(m.rs_f)}</td>
                          <td style={td}>{fRS(m.rs_w)}</td>
                          <td style={td}>{fRS(m.rs_nf)}</td>
                          <td style={td}>{fRS(m.rs_m)}</td>
                          <td style={{ ...td, fontWeight: 600 }}>{fRS(tr2)}</td>
                          <td style={{ ...td, color: '#BA7517', fontWeight: 500 }}>{m.mp_rs > 0 ? fRS(m.mp_rs) : '—'}</td>
                        </tr>
                      );
                    })}
                    <tr style={{ background: 'var(--bvp-accent-light)' }}>
                      <td style={{ padding: '7px 8px', textAlign: 'left', fontWeight: 700, color: 'var(--bvp-accent)', borderTop: '1.5px solid var(--bvp-accent)' }}>Total</td>
                      {[tot.ferrous, tot.wta, tot.nf, tot.misc, totMT].map((v, i) => (
                        <td key={i} style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 600, color: 'var(--bvp-accent)', borderTop: '1.5px solid var(--bvp-accent)' }}>{i < 4 ? fMT(v) : totMT.toFixed(3)}</td>
                      ))}
                      <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 600, color: '#BA7517', borderTop: '1.5px solid var(--bvp-accent)' }}>{tot.mp_mt > 0 ? tot.mp_mt.toFixed(3) : '—'}</td>
                      {[tot.rs_f, tot.rs_w, tot.rs_nf, tot.rs_m, totRS].map((v, i) => (
                        <td key={'r'+i} style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 600, color: 'var(--bvp-accent)', borderTop: '1.5px solid var(--bvp-accent)' }}>{Math.round(v).toLocaleString('en-IN')}</td>
                      ))}
                      <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 600, color: '#BA7517', borderTop: '1.5px solid var(--bvp-accent)' }}>{tot.mp_rs > 0 ? Math.round(tot.mp_rs).toLocaleString('en-IN') : '—'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {/* Target vs Achievement */}
              {tgt && (
                <div style={{ padding: '14px 18px', borderTop: '0.5px solid var(--bvp-border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--bvp-text3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>Target vs Achievement</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 10 }}>
                    {[
                      { title: 'MS Ferrous + WTA + T.B', fw: tgt.fw, ach: tgt.ach_fw },
                      { title: 'Non-Ferrous', fw: tgt.nf, ach: tgt.ach_nf },
                      { title: 'Misc', fw: tgt.misc, ach: tgt.ach_misc },
                      { title: 'Total Target', fw: tgt.total, ach: tgt.ach_total },
                    ].map((t2, i) => {
                      const p = pct(t2.ach, t2.fw);
                      return (
                        <div key={i} style={{ background: 'var(--bvp-surface2)', borderRadius: 10, padding: '11px 14px', border: '0.5px solid var(--bvp-border)' }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--bvp-text3)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>{t2.title}</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}><span style={{ color: 'var(--bvp-text3)' }}>Targeted</span><span style={{ fontWeight: 500 }}>{t2.fw} MT</span></div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}><span style={{ color: 'var(--bvp-text3)' }}>Achieved</span><span style={{ fontWeight: 500 }}>{t2.ach} MT</span></div>
                          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 6 }} className={cls(p)}>{p}%</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        };

        return (
          <div className="bvp-view" id="bvp-print-summary">
            <div className="bvp-section-title">Session-wise Monthly Summary</div>
            <div className="bvp-info-banner">ℹ️ Historical data 2023-24 se. Naye sessions ke entries automatically yahan add ho jayenge. M&amp;P items amber column mein dikhenge.</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
              {allSumSessions.map((s, i) => (
                <button key={s}
                  style={{ background: summarySession === s ? 'var(--bvp-accent)' : 'var(--bvp-surface2)', color: summarySession === s ? '#fff' : 'var(--bvp-text2)', border: summarySession === s ? '0.5px solid var(--bvp-accent)' : '0.5px solid var(--bvp-border)', borderRadius: 10, padding: '5px 16px', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}
                  onClick={() => setSummarySession(s)}>{s}</button>
              ))}
            </div>
            {renderSummary(summarySession || allSumSessions[0])}
          </div>
        );
      })()}

      {/* ==================== M&P ENTRY VIEW ==================== */}
      {activeView === 'mp-entry' && (
        <div className="bvp-view">
          <div className="bvp-info-banner">ℹ️ Machine &amp; Plant (M&amp;P) items condemned entry. Ye data Summary Table ke amber (M&amp;P) column mein automatically appear hoga aur dashboard KPI bhi update hoga.</div>
          <div className="bvp-form-card">
            <h3><span className="bvp-icon" style={{ background: 'var(--bvp-amber-light)' }}>🔧</span>M&amp;P Items Condemnation Entry</h3>
            <div className="bvp-form-grid">
              <div className="bvp-form-group">
                <label className="bvp-fl bvp-required">Session</label>
                <input type="text" className="bvp-input bvp-auto-field" readOnly value={currentSession} />
              </div>
              <div className="bvp-form-group">
                <label className="bvp-fl bvp-required">Date</label>
                <input type="date" className="bvp-input" value={mpForm.date} onChange={e => setMpForm({ ...mpForm, date: e.target.value })} />
              </div>
              <div className="bvp-form-group bvp-full">
                <label className="bvp-fl bvp-required">M&amp;P Item Description</label>
                <input type="text" className="bvp-input" value={mpForm.item} onChange={e => setMpForm({ ...mpForm, item: e.target.value })} placeholder="e.g. Lathe Machine / Drill Press / Transformer" />
              </div>
              <div className="bvp-form-group">
                <label className="bvp-fl bvp-required">Qty (Nos.)</label>
                <input type="number" className="bvp-input" value={mpForm.qty} onChange={e => setMpForm({ ...mpForm, qty: e.target.value })} placeholder="1" min="1" />
              </div>
              <div className="bvp-form-group">
                <label className="bvp-fl">Weight (MT)</label>
                <input type="number" className="bvp-input" value={mpForm.wt} onChange={e => setMpForm({ ...mpForm, wt: e.target.value })} placeholder="0.000" step="0.001" min="0" />
                <span className="bvp-hint">Leave blank if weight not known</span>
              </div>
              <div className="bvp-form-group">
                <label className="bvp-fl bvp-required">Month (For Summary Table)</label>
                <select className="bvp-input" value={mpForm.month} onChange={e => setMpForm({ ...mpForm, month: e.target.value })}>
                  {[['04','April'],['05','May'],['06','June'],['07','July'],['08','August'],['09','September'],['10','October'],['11','November'],['12','December'],['01','January'],['02','February'],['03','March']].map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div className="bvp-form-group">
                <label className="bvp-fl">Location</label>
                <input type="text" className="bvp-input" value={mpForm.location} onChange={e => setMpForm({ ...mpForm, location: e.target.value })} placeholder="e.g. BG Workshop Machine Shop" />
              </div>
              <div className="bvp-form-group">
                <label className="bvp-fl">Condemned By</label>
                <select className="bvp-input" value={mpForm.cond_by} onChange={e => setMpForm({ ...mpForm, cond_by: e.target.value })}>
                  <option value="">-- Select --</option>
                  {['CWM-BVP','CME-CCG','CWE-CCG','CWE-BVP','Other'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="bvp-form-group">
                <label className="bvp-fl">Lot / Advice No.</label>
                <input type="text" className="bvp-input" value={mpForm.lot} onChange={e => setMpForm({ ...mpForm, lot: e.target.value })} placeholder="e.g. MP-2026-27-01" />
              </div>
              <div className="bvp-form-group">
                <label className="bvp-fl">Party / Purchaser Name</label>
                <input type="text" className="bvp-input" value={mpForm.party} onChange={e => setMpForm({ ...mpForm, party: e.target.value })} placeholder="Purchaser firm name" />
              </div>
              <div className="bvp-form-group">
                <label className="bvp-fl">Rate (₹)</label>
                <input type="number" className="bvp-input" value={mpForm.rate} onChange={e => setMpForm({ ...mpForm, rate: e.target.value })} placeholder="0" min="0" />
              </div>
              <div className="bvp-form-group">
                <label className="bvp-fl">Total Amount (₹) — Auto</label>
                <input type="text" className="bvp-input bvp-auto-field" readOnly value={(() => { const w = +mpForm.wt || 0; const q = +mpForm.qty || 0; const r2 = +mpForm.rate || 0; const b = w > 0 ? w : q; const a = r2 && b ? Math.round(r2 * b) : 0; return a ? '₹' + a.toLocaleString() : ''; })()} placeholder="Auto calculated" />
              </div>
              <div className="bvp-form-group">
                <label className="bvp-fl">Status</label>
                <select className="bvp-input" value={mpForm.status} onChange={e => setMpForm({ ...mpForm, status: e.target.value })}>
                  <option>SOLD</option><option>NOT SOLD</option><option>PENDING</option>
                </select>
              </div>
              <div className="bvp-form-group bvp-full">
                <label className="bvp-fl">Remarks</label>
                <textarea className="bvp-input bvp-textarea" value={mpForm.remarks} onChange={e => setMpForm({ ...mpForm, remarks: e.target.value })} placeholder="Any additional remarks" />
              </div>
            </div>
            <div className="bvp-btn-row">
              <button className="bvp-btn bvp-btn-primary" onClick={saveMPEntry}>✓ Save M&amp;P Entry</button>
              <button className="bvp-btn bvp-btn-ghost" onClick={() => setMpForm({ date: '', item: '', qty: '', wt: '', month: '04', location: '', cond_by: '', lot: '', party: '', rate: '', status: 'SOLD', remarks: '' })}>✕ Clear</button>
            </div>
          </div>

          {/* M&P Table */}
          <div className="bvp-entries-wrap">
            <div className="bvp-entries-header">
              <h3>M&amp;P Items Entries</h3>
              <select className="bvp-input" style={{ fontSize: 12, padding: '4px 8px', width: 'auto' }} value={mpFilter} onChange={e => setMpFilter(e.target.value)}>
                <option value="all">All Sessions</option>
                {allSessions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="bvp-tbl-wrap">
              <table className="bvp-table">
                <thead><tr><th>Session</th><th>Date</th><th>Month</th><th>Item</th><th>Qty</th><th>Wt (MT)</th><th>Lot No.</th><th>Party</th><th>Amount ₹</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {filteredMp.length > 0 ? [...filteredMp].reverse().map(r => {
                    const MN: Record<string, string> = { '04':'Apr','05':'May','06':'Jun','07':'Jul','08':'Aug','09':'Sep','10':'Oct','11':'Nov','12':'Dec','01':'Jan','02':'Feb','03':'Mar' };
                    return (
                      <tr key={r.id}>
                        <td><span className="bvp-badge bvp-badge-oa">{r.session}</span></td>
                        <td>{fmt(r.date)}</td>
                        <td>{MN[r.month] || r.month}</td>
                        <td style={{ fontWeight: 500 }}>{r.item}</td>
                        <td>{r.qty}</td>
                        <td>{r.wt || '—'}</td>
                        <td style={{ fontSize: 11, fontFamily: 'monospace' }}>{r.lot || '—'}</td>
                        <td>{r.party || '—'}</td>
                        <td>{r.amount ? '₹' + r.amount.toLocaleString() : '—'}</td>
                        <td><span className={`bvp-badge ${r.status === 'SOLD' ? 'bvp-badge-sold' : r.status === 'NOT SOLD' ? 'bvp-badge-ns' : 'bvp-badge-auction'}`}>{r.status}</span></td>
                        <td><button className="bvp-del-btn" onClick={() => deleteMPEntry(r.id)}>×</button></td>
                      </tr>
                    );
                  }) : <tr><td colSpan={11} className="bvp-empty-state">No M&P entries yet. Upar form se add karo.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <Toast message={toast.message} show={toast.show} />
    </div>
  );
}
