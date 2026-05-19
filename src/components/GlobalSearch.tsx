import { useState } from 'react';

import { db, useLiveQuery } from '../db/db';
import { Search, X, Package } from 'lucide-react';
import { CategoryBadge } from './CategoryBadge';

export function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const items = useLiveQuery(() => db.items.toArray());
  const categories = useLiveQuery(() => db.categories.toArray());
  const balances = useLiveQuery(() => db.inventoryBalances.toArray());
  const units = useLiveQuery(() => db.units.toArray());

  const handleSearchChange = (e: any) => {
    setQuery(e.target.value);
    setIsOpen(e.target.value.length > 1);
  };

  const results = () => {
    if (!query || !items || !categories || !balances || !units) return [];
    const q = query.toLowerCase();
    
    return items
      .filter(i => i.name.toLowerCase().includes(q))
      .map(item => {
        const cat = categories.find(c => c.id === item.categoryId);
        const bal = balances.find(b => b.itemId === item.id);
        const unit = bal ? units.find(u => u.id === bal.unitId)?.name : '';
        return { item, cat, bal, unit };
      });
  };

  const matches = results();

  return (
    <div className="relative w-full max-w-xl">
      <div className="relative z-20">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-gray-400" />
        </div>
        <input
          type="text"
          className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-full leading-5 bg-gray-50 placeholder-gray-500 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
          placeholder="Global Search (Items or Lots)..."
          value={query}
          onChange={handleSearchChange}
          onFocus={() => { if (query.length > 1) setIsOpen(true) }}
        />
        {query && (
          <button 
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
            onClick={() => { setQuery(''); setIsOpen(false); }}
          >
            <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
          </button>
        )}
      </div>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-12 left-0 right-0 z-30 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden max-h-96 overflow-y-auto">
            {matches.length === 0 ? (
              <div className="p-4 text-sm text-gray-500 text-center">No results found for "{query}"</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {matches.map(({ item, cat, bal, unit }) => (
                  <div key={item.id} className="p-4 hover:bg-gray-50 flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-1">{item.name}</h4>
                      {cat && <CategoryBadge category={cat} />}
                    </div>
                    <div className="text-right">
                       <span className="text-xs text-gray-400 block mb-1">In Stock</span>
                       <span className="inline-flex items-center text-sm font-bold text-gray-900 bg-gray-100 px-2 py-1 rounded">
                          <Package className="w-3.5 h-3.5 mr-1.5 text-gray-500" />
                          {bal ? `${bal.approxBalance} ${unit}` : '0'}
                       </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
