import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { db, useLiveQuery } from '../db/db';
import { Search, X, Package, TrendingDown, TrendingUp, Tag } from 'lucide-react';
import { CategoryBadge } from './CategoryBadge';

export function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const items = useLiveQuery(() => db.items.toArray());
  const categories = useLiveQuery(() => db.categories.toArray());
  const balances = useLiveQuery(() => db.inventoryBalances.toArray());
  const units = useLiveQuery(() => db.units.toArray());
  const inwardEntries = useLiveQuery(() => db.inwardEntries.toArray());
  const outwardEntries = useLiveQuery(() => db.outwardEntries.toArray());

  // Calculate dropdown position from input bounding rect (portal approach)
  const updateDropdownPosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const dropWidth = Math.max(rect.width, 480);
    const viewportW = window.innerWidth;
    // If right-overflow would happen, align to right edge of viewport with margin
    let left = rect.left;
    if (left + dropWidth > viewportW - 12) {
      left = viewportW - dropWidth - 12;
    }
    // Never go off left edge
    if (left < 8) left = 8;
    setDropdownPos({
      top: rect.bottom + 8,
      left,
      width: Math.min(dropWidth, viewportW - 20),
    });
  }, []);

  useEffect(() => {
    if (isOpen) {
      updateDropdownPosition();
      window.addEventListener('scroll', updateDropdownPosition, true);
      window.addEventListener('resize', updateDropdownPosition);
    }
    return () => {
      window.removeEventListener('scroll', updateDropdownPosition, true);
      window.removeEventListener('resize', updateDropdownPosition);
    };
  }, [isOpen, updateDropdownPosition]);

  // Keyboard: Escape closes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setQuery('');
        inputRef.current?.blur();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setIsOpen(val.length >= 1);
    if (val.length >= 1) updateDropdownPosition();
  };

  const handleClear = () => {
    setQuery('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const matches = (() => {
    if (!query || !items || !categories || !balances || !units) return [];
    const q = query.toLowerCase().trim();
    if (!q) return [];

    return items
      .filter(i => i.name.toLowerCase().includes(q))
      .map(item => {
        const cat = categories.find(c => c.id === item.categoryId);
        const bal = balances.find(b => b.itemId === item.id);
        const unit = bal ? units.find(u => u.id === bal.unitId)?.name : '';

        // inward/outward totals
        const itemIn = inwardEntries?.filter(e => e.itemId === item.id) ?? [];
        const itemOut = outwardEntries?.filter(e => e.itemId === item.id) ?? [];
        const totalIn = itemIn.reduce((s, e) => s + e.quantity, 0);
        const totalOut = itemOut.reduce((s, e) => s + e.quantity, 0);

        return { item, cat, bal, unit, totalIn, totalOut };
      })
      .sort((a, b) => a.item.name.localeCompare(b.item.name))
      .slice(0, 10); // limit to 10 results
  })();

  const dropdown = isOpen ? (
    <>
      {/* Backdrop — closes on outside click */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
        onClick={() => setIsOpen(false)}
      />

      {/* Dropdown portal — always above everything */}
      <div
        style={{
          position: 'fixed',
          top: dropdownPos.top,
          left: dropdownPos.left,
          width: dropdownPos.width,
          zIndex: 9999,
        }}
        className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-dropdown"
      >
        {/* Header */}
        <div className="px-4 py-2.5 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-100 flex items-center justify-between">
          <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
            <Search className="w-3 h-3" />
            {matches.length > 0 ? `${matches.length} result${matches.length > 1 ? 's' : ''} found` : 'No results'}
          </span>
          {query && (
            <span className="text-xs text-gray-400 bg-white border border-gray-200 px-2 py-0.5 rounded-full">
              "{query}"
            </span>
          )}
        </div>

        <div className="overflow-y-auto overscroll-contain" style={{ maxHeight: 'min(420px, 65vh)' }}>
          {matches.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Search className="w-5 h-5 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-600">No items match "{query}"</p>
              <p className="text-xs text-gray-400 mt-1">Try a different search term</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {matches.map(({ item, cat, bal, unit, totalIn, totalOut }) => (
                <div
                  key={item.id}
                  className="px-4 py-3 hover:bg-blue-50/60 transition-colors duration-150 cursor-pointer group"
                  onClick={() => setIsOpen(false)}
                >
                  {/* Item name + category */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-[10px] font-bold text-blue-700">
                          {item.name.substring(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-semibold text-gray-900 leading-tight break-words whitespace-normal">
                          {item.name}
                        </h4>
                        {cat && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <Tag className="w-3 h-3 text-gray-400" />
                            <span className="text-[11px] text-gray-500">{cat.name}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Stock badge */}
                    <div className="flex-shrink-0 text-right">
                      <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2 py-1 shadow-sm">
                        <Package className="w-3 h-3 text-gray-500" />
                        <span className="text-xs font-bold text-gray-800">
                          {bal ? `${bal.approxBalance} ${unit}` : '—'}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-400 mt-0.5 block">In Stock</span>
                    </div>
                  </div>

                  {/* Inward / Outward pills */}
                  {(totalIn > 0 || totalOut > 0) && (
                    <div className="flex gap-2 pl-10">
                      {totalIn > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          <TrendingDown className="w-2.5 h-2.5" />
                          {totalIn} IN
                        </span>
                      )}
                      {totalOut > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
                          <TrendingUp className="w-2.5 h-2.5" />
                          {totalOut} OUT
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <span className="text-[10px] text-gray-400">Press <kbd className="bg-white border border-gray-200 rounded px-1 py-0.5 text-[10px] font-mono">Esc</kbd> to close</span>
          <span className="text-[10px] text-gray-400">Scrap Ledger Search</span>
        </div>
      </div>
    </>
  ) : null;

  return (
    <>
      <div ref={containerRef} className="relative w-full max-w-xs">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className={`h-4 w-4 transition-colors ${isOpen ? 'text-blue-500' : 'text-gray-400'}`} />
          </div>
          <input
            ref={inputRef}
            type="text"
            className={`block w-full pl-10 pr-9 py-2 border rounded-full leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white sm:text-sm transition-all duration-200 ${
              isOpen
                ? 'border-blue-400 ring-2 ring-blue-100 bg-white'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            placeholder="Search items..."
            value={query}
            onChange={handleSearchChange}
            onFocus={() => {
              if (query.length >= 1) {
                setIsOpen(true);
                updateDropdownPosition();
              }
            }}
            autoComplete="off"
          />
          {query && (
            <button
              className="absolute inset-y-0 right-0 pr-3 flex items-center hover:opacity-70 transition-opacity"
              onClick={handleClear}
              tabIndex={-1}
            >
              <X className="h-3.5 w-3.5 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Portal: render dropdown outside header to avoid stacking context clipping */}
      {typeof document !== 'undefined' && createPortal(dropdown, document.body)}
    </>
  );
}
