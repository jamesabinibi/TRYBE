import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { Capacitor } from '@capacitor/core';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const NUMBER_STYLE = "font-sans font-bold tracking-tight";

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
  let key = process.env.API_KEY || process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY;
  if (key) return key;
  
  // Fetch from backend
  try {
    const res = await apiFetch('/api/gemini-key');
    if (res.ok) {
      const data = await res.json();
      return data.apiKey || '';
    }
  } catch (e) {
    console.error("Failed to fetch Gemini key from backend", e);
  }
  return '';
}
