import { toast } from 'sonner';

interface OfflineRequest {
  id: string;
  url: string;
  options: RequestInit;
  timestamp: number;
  retryCount: number;
  description: string;
}

const QUEUE_KEY = 'gryndee_offline_queue';

export const offlineQueue = {
  get: (): OfflineRequest[] => {
    try {
      const saved = localStorage.getItem(QUEUE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  },

  add: (url: string, options: RequestInit, description: string) => {
    const queue = offlineQueue.get();
    const newRequest: OfflineRequest = {
      id: Math.random().toString(36).substring(2, 15),
      url,
      options,
      timestamp: Date.now(),
      retryCount: 0,
      description
    };
    queue.push(newRequest);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    
    toast.info(`Offline: ${description} queued for sync`, {
      description: 'We will sync this automatically when you are back online.',
      duration: 5000
    });
    
    return newRequest.id;
  },

  remove: (id: string) => {
    const queue = offlineQueue.get().filter(req => req.id !== id);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  },

  clear: () => {
    localStorage.removeItem(QUEUE_KEY);
  },

  sync: async (fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>) => {
    const queue = offlineQueue.get();
    if (queue.length === 0) return;

    console.log(`[Offline] Starting sync for ${queue.length} items...`);
    const toastId = toast.loading(`Syncing ${queue.length} offline transactions...`);

    let successCount = 0;
    let failCount = 0;

    for (const req of queue) {
      try {
        const res = await fetchWithAuth(req.url, req.options);
        if (res.ok) {
          offlineQueue.remove(req.id);
          successCount++;
        } else {
          console.error(`[Offline] Sync failed for ${req.id}:`, await res.text());
          failCount++;
        }
      } catch (err) {
        console.error(`[Offline] Sync error for ${req.id}:`, err);
        failCount++;
      }
    }

    toast.dismiss(toastId);
    if (successCount > 0) {
      toast.success(`Successfully synced ${successCount} transactions!`);
    }
    if (failCount > 0) {
      toast.error(`Failed to sync ${failCount} transactions. Will retry later.`);
    }
  }
};
