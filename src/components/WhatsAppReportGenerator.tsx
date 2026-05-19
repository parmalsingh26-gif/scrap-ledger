import { useState } from 'react';

import { db, useLiveQuery } from '../db/db';
import { format } from 'date-fns';
import { MessageCircle, Check, Copy } from 'lucide-react';

export function WhatsAppReportGenerator() {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [copied, setCopied] = useState(false);

  const inwardEntries = useLiveQuery(() => db.inwardEntries.where('date').equals(selectedDate).toArray(), [selectedDate]);
  const items = useLiveQuery(() => db.items.toArray());
  const units = useLiveQuery(() => db.units.toArray());

  const generateReportText = () => {
    if (!inwardEntries || inwardEntries.length === 0) return `*Scrap Movement Report - ${format(new Date(selectedDate), 'MMM d, yyyy')}*\n\nNo entries found.`;
    if (!items || !units) return '';

    const lines = inwardEntries.map(entry => {
      const item = items.find(i => i.id === entry.itemId);
      const unit = units.find(u => u.id === entry.unitId);
      let details = '';
      if (entry.machineType) details += ` ${entry.machineType}`;
      if (entry.coverType) {
        if (entry.rcCount && entry.fcCount) {
          details += ` rear cover ${entry.rcCount} and front cover ${entry.fcCount}`;
        } else if (entry.coverType === 'RC' && entry.rcCount) {
          details += ` rear cover ${entry.rcCount}`;
        } else if (entry.coverType === 'FC' && entry.fcCount) {
           details += ` front cover ${entry.fcCount}`;
        } else {
           details += ` ${entry.coverType}`;
        }
      }
      return `• ${entry.quantity} ${unit?.name?.toLowerCase() || ''} ${item?.name?.toLowerCase() || ''}${details}`;
    });

    return `*Scrap Movement Report - ${format(new Date(selectedDate), 'dd/MM/yyyy')}*\n${lines.join('\n')}`;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generateReportText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    const text = encodeURIComponent(generateReportText());
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  return (
    <div className="bg-green-50 border border-green-200 rounded-xl p-5 mt-8">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
        <h3 className="text-lg font-semibold text-green-900 flex items-center">
          <MessageCircle className="w-5 h-5 mr-2 text-green-600" />
          WhatsApp Report Generator
        </h3>
        <input 
          type="date"
          className="form-input text-sm border-green-200 rounded-md py-1.5 px-3 focus:ring-green-500 max-w-[200px]"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        />
      </div>

      <div className="bg-white p-4 rounded-lg border border-green-100 shadow-inner font-mono text-sm leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto mb-4 text-gray-700">
        {generateReportText()}
      </div>

      <div className="flex space-x-3">
        <button 
          onClick={handleCopy}
          className="flex-1 bg-white border border-gray-300 shadow-sm py-2 px-4 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center justify-center transition-colors"
        >
          {copied ? <Check className="w-4 h-4 mr-2 text-green-600" /> : <Copy className="w-4 h-4 mr-2" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button 
          onClick={handleShare}
          className="flex-1 bg-[#25D366] hover:bg-[#128C7E] text-white shadow-sm py-2 px-4 rounded-lg text-sm font-medium flex items-center justify-center transition-colors"
        >
          <MessageCircle className="w-4 h-4 mr-2" />
          Share to WhatsApp
        </button>
      </div>
    </div>
  );
}
