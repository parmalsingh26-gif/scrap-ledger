import { useMemo } from 'react';

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
import { format, subDays, isAfter } from 'date-fns';

export function ScrapChart() {
  const inwardEntries = useLiveQuery(() => db.inwardEntries.toArray());
  const outwardEntries = useLiveQuery(() => db.outwardEntries.toArray());

  const data = useMemo(() => {
    if (!inwardEntries || !outwardEntries) return [];
    
    // Get last 7 days
    const days = Array.from({length: 7}).map((_, i) => {
       const d = subDays(new Date(), 6 - i);
       return format(d, 'yyyy-MM-dd');
    });

    return days.map(dayStr => {
      // Very basic aggregate - count of entries or total qty. We'll do total count for simplicity across units
      const inEntries = inwardEntries.filter(e => e.date === dayStr).length;
      // Using dateDelivered as proxy for outward for the chart
      const outEntries = outwardEntries.filter(e => e.dateDelivered === dayStr).length;

      return {
        name: format(new Date(dayStr), 'MMM dd'),
        Inward: inEntries,
        Outward: outEntries
      };
    });
  }, [inwardEntries, outwardEntries]);

  if (!inwardEntries || !outwardEntries) return null;

  return (
    <div className="glass-panel rounded-xl shadow-sm border border-outline-variant/20 p-6 mb-8 relative overflow-hidden">
       <div className="absolute top-0 left-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -ml-10 -mt-10 pointer-events-none"></div>
       <h3 className="font-headline-md text-headline-md text-on-surface mb-6 relative z-10 flex items-center gap-2">
         <span className="material-symbols-outlined text-primary text-[20px]">show_chart</span>
         Activity (Last 7 Days)
       </h3>
       <div className="h-64 w-full relative z-10">
         <ResponsiveContainer width="100%" height="100%">
           <LineChart data={data} margin={{ top: 5, right: 20, left: -20, bottom: 0 }}>
             <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" opacity={0.5} />
             <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#737686', fontFamily: 'Plus Jakarta Sans'}} dy={10} />
             <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#737686', fontFamily: 'Plus Jakarta Sans'}} />
             <Tooltip 
               contentStyle={{ borderRadius: '12px', border: '1px solid rgba(255,255,255,0.4)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)', fontFamily: 'Plus Jakarta Sans' }}
             />
             <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontFamily: 'Plus Jakarta Sans' }}/>
             <Line type="monotone" dataKey="Inward" stroke="#007d55" strokeWidth={3} dot={{r: 4, fill: '#007d55', strokeWidth: 0}} activeDot={{r: 6}} />
             <Line type="monotone" dataKey="Outward" stroke="#4b41e1" strokeWidth={3} dot={{r: 4, fill: '#4b41e1', strokeWidth: 0}} activeDot={{r: 6}} />
           </LineChart>
         </ResponsiveContainer>
       </div>
    </div>
  );
}
