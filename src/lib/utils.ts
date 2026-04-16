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

export function normalizeBoutNumber(bout: string | number): string {
  const s = bout.toString().trim().toUpperCase();
  if (!s) return '';
  
  // Handle A01, B01, C01 format (A=1000, B=2000, C=3000, etc.)
  const match = s.match(/^([A-Z])(\d+)$/);
  if (match) {
    const letter = match[1];
    const number = parseInt(match[2]);
    const ringOffset = (letter.charCodeAt(0) - 'A'.charCodeAt(0) + 1) * 1000;
    return (ringOffset + number).toString();
  }
  
  return s;
}

export function normalizeBoutWithRing(bout: string | number, ringNum: number): string {
  const s = bout.toString().trim().toUpperCase();
  if (!s) return '';
  
  // If it already has a letter, use standard normalization
  if (/^[A-Z]/.test(s)) return normalizeBoutNumber(s);
  
  const num = parseInt(s.replace(/[^0-9]/g, ''));
  if (isNaN(num)) return s;
  
  // If it's a small number, assume it's relative to the ring
  if (num < 1000) {
    return ((ringNum * 1000) + num).toString();
  }
  
  return num.toString();
}

export function getBoutNumber(bout: string | number): number {
  return parseInt(normalizeBoutNumber(bout)) || 0;
}

export function formatBoutNumber(ringNum: number, bout: string | number): string {
  const s = bout.toString().trim().toUpperCase();
  if (!s) return '';

  // 1. If it already has a letter prefix (e.g., A01), keep it
  if (/^[A-Z]/.test(s)) return s;

  const num = parseInt(s.replace(/[^0-9]/g, ''));
  const suffix = s.replace(/[0-9]/g, '');

  if (isNaN(num)) return s;

  // 2. If it's a "full" numeric ID (>= 1000), convert it back to letter format
  // e.g., 1001 -> A01, 2005 -> B05
  if (num >= 1000) {
    const ring = Math.floor(num / 1000);
    const boutInRing = num % 1000;
    const letter = String.fromCharCode(64 + ring);
    return `${letter}${boutInRing.toString().padStart(2, '0')}${suffix}`;
  }

  // 3. For small numbers (e.g., "1"), default to the letter format (e.g., "A01")
  const letter = String.fromCharCode(64 + ringNum);
  return `${letter}${num.toString().padStart(2, '0')}${suffix}`;
}

/**
 * Detects if the event data is using the A01 format.
 * If any bout in the queue or rings starts with a letter, we assume A01 method.
 */
export function isUsingA01Method(data: any[]): boolean {
  return data.some(item => {
    const bout = item.data?.bout || item.bout || '';
    return /^[A-Z]/.test(bout.toString().trim().toUpperCase());
  });
}
