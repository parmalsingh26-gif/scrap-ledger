import { Tag } from 'lucide-react';
import type { Category } from '../db/db';

export function CategoryBadge({ category }: { category: Category }) {
  return (
    <div className={`inline-flex items-center rounded-md px-3 py-1 font-medium text-xs text-white ${category.bgColor} relative overflow-hidden shadow-sm h-7`}>
      {category.hasRedBand && (
        <div className="absolute left-0 right-0 top-[2px] h-1.5 bg-red-600 w-full" />
      )}
      <Tag className="w-3.5 h-3.5 mr-1.5 opacity-90 z-10" />
      <span className="z-10 leading-none pb-[1px]">{category.name}</span>
    </div>
  );
}
