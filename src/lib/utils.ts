import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | undefined | null, currencyCode: string = 'NGN') {
  const value = typeof amount === 'number' ? amount : 0;
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: currencyCode || 'NGN',
    }).format(value);
  } catch (e) {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
    }).format(value);
  }
}
