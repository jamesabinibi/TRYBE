import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { Capacitor } from '@capacitor/core';
import { useState, useEffect, useCallback } from 'react';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Ensure logo URL is absolute for native platforms
export const ensureAbsoluteUrl = (url: string | undefined | null) => {
  if (!url || url.startsWith('data:')) return url;
  
  let baseUrl = import.meta.env.VITE_API_URL || '';
  if (!Capacitor.isNativePlatform() && (baseUrl.includes('ais-pre-') || baseUrl.includes('ais-dev-'))) {
    baseUrl = '';
  }
  
  // If the URL is an absolute URL pointing to AI Studio, strip the origin
  let path = url;
  if (url.startsWith('http')) {
    try {
      const parsed = new URL(url);
      if (parsed.hostname.includes('ais-pre-') || parsed.hostname.includes('ais-dev-')) {
        path = parsed.pathname + parsed.search;
      } else {
        // It's a normal absolute URL (e.g. AWS S3, or already correct), just return it
        return url;
      }
    } catch (e) {
      return url;
    }
  }
  
  if (baseUrl) {
    const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const cleanPath = path.startsWith('/') ? path : '/' + path;
    return `${cleanBase}${cleanPath}`;
  }
  
  return path;
};

export const NUMBER_STYLE = "font-sans font-bold tracking-tight";

// Simple in-memory cache for fast navigation
const memoryCache: Record<string, { data: any; timestamp: number }> = {};
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

export function useQueryClient() {
  return {
    getQueryData: (key: string) => {
      if (memoryCache[key] && (Date.now() - memoryCache[key].timestamp < CACHE_EXPIRY)) {
        return memoryCache[key].data;
      }
      try {
        const saved = localStorage.getItem(`cache_${key}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Date.now() - parsed.timestamp < CACHE_EXPIRY * 2) {
            return parsed.data;
          }
        }
      } catch (e) {}
      return null;
    }
  };
}

export function formatCurrency(amount: number | string | undefined | null, currencyCode?: string) {
  let value = 0;
  if (typeof amount === 'number') {
    value = amount;
  } else if (typeof amount === 'string') {
    value = parseFloat(amount) || 0;
  }
  
  const currency = currencyCode || 'NGN';
  return `${currency} ${value.toLocaleString('en-NG', { minimumFractionDigits: 0 })}`;
}

export const getOptimizedImageUrl = (url: string | undefined | null, width: number = 300) => {
  if (!url) return '';
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;
  
  let key = url;
  if (url.startsWith('/api/images/')) {
    key = url.replace('/api/images/', '');
  } else if (url.startsWith('http')) {
    try {
      const urlObj = new URL(url);
      key = urlObj.pathname.substring(1);
      
      if (url.includes('amazonaws.com')) {
        // For S3 URLs, the key is just the pathname without the leading slash
        key = urlObj.pathname.substring(1);
      } else if (url.includes('cloudinary.com')) {
        const uploadIndex = url.indexOf('/upload/');
        if (uploadIndex !== -1) {
           const afterUpload = url.substring(uploadIndex + 8);
           const parts = afterUpload.split('/');
           if (parts.length > 1 && parts[0].startsWith('v')) {
             key = parts.slice(1).join('/');
           } else {
             key = afterUpload;
           }
        }
      }
    } catch (e) {
      // fallback
    }
  }
  
  return `https://pmp323myg6rsao42jsmdzpidb40xhakc.lambda-url.us-east-1.on.aws/?key=${encodeURIComponent(key)}&w=${width}`;
};

export async function apiFetch(url: string, options: RequestInit = {}) {
  const start = performance.now();
  let baseUrl = import.meta.env.VITE_API_URL || '';
  // Strip AI Studio URLs in the web preview so it uses relative paths and hits the active dev server.
  // Keep them for native Android/iOS so they know where to connect.
  if (!Capacitor.isNativePlatform() && (baseUrl.includes('ais-pre-') || baseUrl.includes('ais-dev-'))) {
    baseUrl = '';
  }
  const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;
  
  try {
    console.log(`[API] Fetching: ${fullUrl}`);
    
    const res = await fetch(fullUrl, {
      ...options,
      credentials: 'include'
    });
    const end = performance.now();
    if (end - start > 1000) {
      console.warn(`[API] Slow request: ${fullUrl} took ${(end - start).toFixed(2)}ms`);
    }
    return res;
  } catch (err) {
    const end = performance.now();
    console.error(`[API] Request failed: ${fullUrl} after ${(end - start).toFixed(2)}ms`, err);
    throw err;
  }
}

/**
 * A standard hook for fetching data with caching (Stale-While-Revalidate)
 * This makes the app feel instant by showing old data while fetching fresh data.
 */
export function useQuery<T>(key: string, fetcher: () => Promise<T>, options: { 
  enabled?: boolean;
  persist?: boolean;
  onSuccess?: (data: T) => void;
} = {}) {
  const { enabled = true, persist = false, onSuccess } = options;
  const [data, setData] = useState<T | null>(() => {
    // Try memory cache first
    if (memoryCache[key] && (Date.now() - memoryCache[key].timestamp < CACHE_EXPIRY)) {
      return memoryCache[key].data;
    }
    // Try localStorage if persist is enabled
    if (persist) {
      try {
        const saved = localStorage.getItem(`cache_${key}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Date.now() - parsed.timestamp < CACHE_EXPIRY * 2) {
            return parsed.data;
          }
        }
      } catch (e) {}
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState(!data);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!enabled) return;
    
    try {
      const result = await fetcher();
      setData(result);
      setIsLoading(false);
      
      // Update memory cache
      memoryCache[key] = { data: result, timestamp: Date.now() };
      
      // Update localStorage if persist is enabled
      if (persist) {
        try {
          localStorage.setItem(`cache_${key}`, JSON.stringify({
            data: result,
            timestamp: Date.now()
          }));
        } catch (e) {}
      }
      
      if (onSuccess) onSuccess(result);
    } catch (err: any) {
      setError(err);
      setIsLoading(false);
    }
  }, [key, enabled, persist, onSuccess]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let retries = 0;
  while (retries < maxRetries) {
    try {
      return await fn();
    } catch (error: any) {
      const isRetryable = 
        error.message?.includes('429') || 
        error.message?.includes('503') ||
        error.message?.toLowerCase().includes('rate limit') ||
        error.message?.toLowerCase().includes('quota exceeded') ||
        error.message?.toLowerCase().includes('high demand') ||
        error.message?.toLowerCase().includes('unavailable') ||
        error.status === 429 ||
        error.status === 503;

      if (isRetryable && retries < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, retries);
        console.warn(`[AI] Retryable error hit (${error.status || 'unknown'}). Retrying in ${delay}ms... (Attempt ${retries + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        retries++;
      } else {
        throw error;
      }
    }
  }
  throw new Error('Max retries exceeded');
}

let cachedGeminiKey: string | null = null;

export async function fetchGeminiKey(): Promise<string> {
  if (cachedGeminiKey) return cachedGeminiKey;

  // Try to get from build-time env vars first
  // We also check window.process.env for dynamic injection in AI Studio
  let key = '';
  try {
    const win = window as any;
    key = win.process?.env?.API_KEY || 
          win.process?.env?.GEMINI_API_KEY ||
          (typeof process !== 'undefined' ? (process.env.API_KEY || process.env.GEMINI_API_KEY) : undefined) || 
          (import.meta as any).env?.VITE_GEMINI_API_KEY;
  } catch (e) {
    console.warn('Error accessing process.env in browser:', e);
  }
            
  if (key && key !== '""' && key !== "''") {
    cachedGeminiKey = key;
    return key;
  }
  
  // Fetch from backend
  try {
    let userId = '';
    try {
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        const user = JSON.parse(savedUser);
        userId = user?.id?.toString() || '';
      }
    } catch (e) {}

    const res = await apiFetch('/api/gemini-key', {
      headers: {
        'x-user-id': userId
      }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.apiKey) {
        cachedGeminiKey = data.apiKey;
        return data.apiKey;
      }
    }
  } catch (e) {
    console.error("Failed to fetch Gemini key from backend", e);
  }
  return '';
}
