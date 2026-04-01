import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

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
    const res = await fetch(url, options);
    const end = performance.now();
    if (end - start > 1000) {
      console.warn(`[API] Slow request: ${url} took ${(end - start).toFixed(2)}ms`);
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
