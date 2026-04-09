import { ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatIC(ic: string): string {
  // Malaysian IC format: YYMMDD-PB-###G
  const cleaned = ic.replace(/\D/g, '');
  if (cleaned.length !== 12) return ic;
  return `${cleaned.slice(0, 6)}-${cleaned.slice(6, 8)}-${cleaned.slice(8)}`;
}

export function validateIC(ic: string): boolean {
  const cleaned = ic.replace(/\D/g, '');
  return cleaned.length === 12;
}
