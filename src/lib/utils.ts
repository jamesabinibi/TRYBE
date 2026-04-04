import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { Capacitor } from '@capacitor/core';
import { useState, useEffect, useCallback } from 'react';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const NUMBER_STYLE = "font-sans font-bold tracking-tight";

// Simple in-memory cache for fast navigation
const memoryCache: Record<string, { data: any; timestamp: number }> = {};
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

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

export async function apiFetch(url: string, options: RequestInit = {}) {
  const start = performance.now();
  try {
    // Support absolute URLs for mobile/Capacitor, relative for web
    const isNative = Capacitor.isNativePlatform();
    let baseUrl = isNative ? (import.meta.env.VITE_API_URL || '') : '';
    
    if (baseUrl && !baseUrl.startsWith('http')) {
      baseUrl = `https://${baseUrl}`;
    }
    
    if (baseUrl.endsWith('/')) {
      baseUrl = baseUrl.slice(0, -1);
    }
    const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;
    console.log(`[API] Fetching: ${fullUrl} (baseUrl: ${baseUrl})`);
    
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
    console.error(`[API] Request failed: ${url} after ${(end - start).toFixed(2)}ms`, err);
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
      const isRateLimit = 
        error.message?.includes('429') || 
        error.message?.toLowerCase().includes('rate limit') ||
        error.message?.toLowerCase().includes('quota exceeded') ||
        error.status === 429;

      if (isRateLimit && retries < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, retries);
        console.warn(`[AI] Rate limit hit. Retrying in ${delay}ms... (Attempt ${retries + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        retries++;
      } else {
        throw error;
      }
    }
  }
  throw new Error('Max retries exceeded');
}

export async function fetchGeminiKey(): Promise<string> {
  // Try to get from build-time env vars first
  // We also check window.process.env for dynamic injection in AI Studio
  const win = window as any;
  let key = win.process?.env?.API_KEY || 
            win.process?.env?.GEMINI_API_KEY ||
            process.env.API_KEY || 
            process.env.GEMINI_API_KEY || 
            (import.meta as any).env?.VITE_GEMINI_API_KEY;
            
  if (key && key !== '""' && key !== "''") return key;
  
  // Fetch from backend
  try {
    const res = await apiFetch('/api/gemini-key');
    if (res.ok) {
      const data = await res.json();
      if (data.apiKey) return data.apiKey;
    }
  } catch (e) {
    console.error("Failed to fetch Gemini key from backend", e);
  }
  return '';
}
