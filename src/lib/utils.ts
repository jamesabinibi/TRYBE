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
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: currency,
    }).format(value);
  } catch (e) {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
    }).format(value);
  }
}
