export interface OfflineRequest {
  id: string;
  endpoint: string;
  method: string;
  body: any;
  timestamp: number;
}

export const getOfflineQueue = (): OfflineRequest[] => {
  try {
    const q = localStorage.getItem('offline_queue');
    return q ? JSON.parse(q) : [];
  } catch (e) {
    return [];
  }
};

export const addToOfflineQueue = (endpoint: string, method: string, body: any) => {
  const q = getOfflineQueue();
  const req: OfflineRequest = {
    id: Math.random().toString(36).substring(2, 11),
    endpoint,
    method,
    body: typeof body === 'string' ? JSON.parse(body) : body,
    timestamp: Date.now()
  };
  q.push(req);
  localStorage.setItem('offline_queue', JSON.stringify(q));
  window.dispatchEvent(new Event('offline-queue-updated'));
  return req;
};

export const removeFromOfflineQueue = (id: string) => {
  const q = getOfflineQueue();
  const newQ = q.filter(req => req.id !== id);
  localStorage.setItem('offline_queue', JSON.stringify(newQ));
  window.dispatchEvent(new Event('offline-queue-updated'));
};

export const clearOfflineQueue = () => {
  localStorage.removeItem('offline_queue');
  window.dispatchEvent(new Event('offline-queue-updated'));
};

export const saveToCache = (endpoint: string, data: any) => {
  const key = `cache_${endpoint}`;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn("Could not save to cache", e);
  }
};

export const getFromCache = (endpoint: string): any | null => {
  const key = `cache_${endpoint}`;
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    return null;
  }
};

export const applyPendingQueueToCache = (endpoint: string, cachedData: any) => {
  if (!Array.isArray(cachedData)) return cachedData;
  
  const queue = getOfflineQueue();
  const pendingForEndpoint = queue.filter(req => {
    // If endpoint is /api/items, match /items
    const baseEndpoint = endpoint.split('?')[0]; // simple strip
    return req.endpoint === baseEndpoint || req.endpoint.startsWith(baseEndpoint + '/');
  });
  
  let result = [...cachedData];
  
  for (const req of pendingForEndpoint) {
    if (req.method === 'POST') {
      result.push({ ...req.body, id: req.id, _isPending: true });
    } else if (req.method === 'PUT') {
      const idMatch = req.endpoint.match(/\/([^/]+)$/);
      const idToUpdate = idMatch ? idMatch[1] : req.body.id;
      result = result.map((item: any) => String(item.id) === String(idToUpdate) ? { ...item, ...req.body, _isPending: true } : item);
    } else if (req.method === 'DELETE') {
      const idMatch = req.endpoint.match(/\/([^/]+)$/);
      if (idMatch) {
        const idToDelete = idMatch[1];
        result = result.filter((item: any) => String(item.id) !== String(idToDelete));
      }
    }
  }
  
  return result;
};
