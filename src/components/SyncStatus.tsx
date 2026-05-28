import React, { useState, useEffect } from 'react';
import { getOfflineQueue } from '../db/offlineSync';

export const SyncStatus: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const updateStatus = () => {
      setIsOnline(navigator.onLine);
      const queue = getOfflineQueue();
      setPendingCount(queue.length);
    };

    updateStatus();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleQueueUpdate = () => updateStatus();
    const handleSyncStarted = () => setIsSyncing(true);
    const handleSyncFinished = () => {
      setIsSyncing(false);
      updateStatus();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('offline-queue-updated', handleQueueUpdate);
    window.addEventListener('offline-sync-started', handleSyncStarted);
    window.addEventListener('offline-sync-finished', handleSyncFinished);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('offline-queue-updated', handleQueueUpdate);
      window.removeEventListener('offline-sync-started', handleSyncStarted);
      window.removeEventListener('offline-sync-finished', handleSyncFinished);
    };
  }, []);

  if (isOnline && pendingCount === 0 && !isSyncing) {
    return null; // Hide when everything is synced and online
  }

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex items-center gap-2 px-4 py-2 rounded-full shadow-lg text-sm font-medium transition-all"
         style={{
           backgroundColor: !isOnline ? '#FEF2F2' : (isSyncing ? '#EFF6FF' : '#F0FDF4'),
           color: !isOnline ? '#991B1B' : (isSyncing ? '#1D4ED8' : '#166534'),
           border: `1px solid ${!isOnline ? '#FCA5A5' : (isSyncing ? '#BFDBFE' : '#BBF7D0')}`
         }}>
      
      {!isOnline && (
        <>
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </span>
          <span>Offline Mode ({pendingCount} pending)</span>
        </>
      )}

      {isOnline && isSyncing && (
        <>
          <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
          <span>Syncing {pendingCount} item(s)...</span>
        </>
      )}

      {isOnline && !isSyncing && pendingCount > 0 && (
        <>
          <span className="material-symbols-outlined text-[16px]">sync_problem</span>
          <span>Syncing...</span>
        </>
      )}
    </div>
  );
};
