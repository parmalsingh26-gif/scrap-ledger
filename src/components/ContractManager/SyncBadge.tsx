import React from "react";
import { Loader2, CloudOff, Cloud } from "lucide-react";

export function SyncBadge({ syncing, error }: { syncing: boolean; error: boolean }) {
  if (syncing) return (
    <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
      <Loader2 size={11} className="animate-spin" /> Saving...
    </span>
  );
  if (error) return (
    <span className="flex items-center gap-1 text-xs text-rose-600 bg-rose-50 px-2 py-1 rounded-full">
      <CloudOff size={11} /> Offline / Error
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
      <Cloud size={11} /> Saved
    </span>
  );
}
