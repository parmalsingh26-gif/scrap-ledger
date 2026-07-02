import { useMemo, useState } from 'react';

import { db, useLiveQuery } from '../db/db';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { format, subDays, subMonths, subYears, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, startOfDay, endOfDay } from 'date-fns';

type RangeKey = '7d' | '30d' | '3m' | '1y';

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: '7d',  label: 'Last 7 Days'  },
  { key: '30d', label: 'Last 30 Days' },
  { key: '3m',  label: 'Last 3 Months'},
  { key: '1y',  label: 'Last 1 Year'  },
];

export function ScrapChart() {
  const inwardEntries  = useLiveQuery(() => db.inwardEntries.toArray());
  const outwardEntries = useLiveQuery(() => db.outwardEntries.toArray());
  const [range, setRange] = useState<RangeKey>('7d');

  const data = useMemo(() => {
    if (!inwardEntries || !outwardEntries) return [];

    const today = new Date();

    if (range === '7d') {
      // Daily — last 7 days
      return Array.from({ length: 7 }).map((_, i) => {
        const dayStr = format(subDays(today, 6 - i), 'yyyy-MM-dd');
        return {
          name: format(new Date(dayStr), 'MMM d'),
          Inward:  inwardEntries.filter(e => e.date === dayStr).length,
          Outward: outwardEntries.filter(e => e.dateDelivered === dayStr).length,
        };
      });
    }

    if (range === '30d') {
      // Daily — last 30 days
      return Array.from({ length: 30 }).map((_, i) => {
        const dayStr = format(subDays(today, 29 - i), 'yyyy-MM-dd');
        return {
          name: format(new Date(dayStr), 'MMM d'),
          Inward:  inwardEntries.filter(e => e.date === dayStr).length,
          Outward: outwardEntries.filter(e => e.dateDelivered === dayStr).length,
        };
      });
    }

    if (range === '3m') {
      // Weekly buckets — last 13 weeks (~3 months)
      return Array.from({ length: 13 }).map((_, i) => {
        const weekStart = format(subDays(today, (12 - i) * 7), 'yyyy-MM-dd');
        const weekEnd   = format(subDays(today, (12 - i) * 7 - 6), 'yyyy-MM-dd');
        const inCount  = inwardEntries.filter(e => e.date >= weekStart && e.date <= weekEnd).length;
        const outCount = outwardEntries.filter(e => e.dateDelivered >= weekStart && e.dateDelivered <= weekEnd).length;
        return {
          name: format(new Date(weekStart), 'MMM d'),
          Inward:  inCount,
          Outward: outCount,
        };
      });
    }

    // '1y' — Monthly buckets — last 12 months
    return Array.from({ length: 12 }).map((_, i) => {
      const d = subMonths(today, 11 - i);
      const monthStr = format(d, 'yyyy-MM');
      const inCount  = inwardEntries.filter(e => e.date.startsWith(monthStr)).length;
      const outCount = outwardEntries.filter(e => e.dateDelivered.startsWith(monthStr)).length;
      return {
        name: format(d, 'MMM yy'),
        Inward:  inCount,
        Outward: outCount,
      };
    });
  }, [inwardEntries, outwardEntries, range]);

  if (!inwardEntries || !outwardEntries) return null;

  const rangeLabel = RANGE_OPTIONS.find(r => r.key === range)?.label || '';

  return (
    <div className="glass-panel rounded-xl shadow-sm border border-outline-variant/20 p-6 mb-8 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -ml-10 -mt-10 pointer-events-none"></div>

      {/* Header row */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <h3 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[20px]">show_chart</span>
          Activity ({rangeLabel})
        </h3>

        {/* Range pills */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {RANGE_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => setRange(opt.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                range === opt.key
                  ? 'bg-white shadow text-primary'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-64 w-full relative z-10">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" opacity={0.5} />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: range === '30d' ? 10 : 12, fill: '#737686', fontFamily: 'Plus Jakarta Sans' }}
              dy={10}
              interval={range === '30d' ? 4 : 0}
            />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#737686', fontFamily: 'Plus Jakarta Sans' }} />
            <Tooltip
              contentStyle={{
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.4)',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                backgroundColor: 'rgba(255,255,255,0.9)',
                backdropFilter: 'blur(8px)',
                fontFamily: 'Plus Jakarta Sans',
              }}
            />
            <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontFamily: 'Plus Jakarta Sans' }} />
            <Line type="linear" dataKey="Inward"  stroke="#007d55" strokeWidth={2.5} dot={{ r: 3, fill: '#007d55', strokeWidth: 0 }} activeDot={{ r: 6 }} connectNulls strokeLinecap="round" strokeLinejoin="round" />
            <Line type="linear" dataKey="Outward" stroke="#4b41e1" strokeWidth={2.5} dot={{ r: 3, fill: '#4b41e1', strokeWidth: 0 }} activeDot={{ r: 6 }} connectNulls strokeLinecap="round" strokeLinejoin="round" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
