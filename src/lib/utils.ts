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
