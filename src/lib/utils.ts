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

  // 2. If it's already a "full" numeric ID (>= 1000), keep it
  if (num >= 1000) return s;

  // 3. For small numbers (e.g., "1"), default to the letter format (e.g., "A01")
  // as it was the previous preferred format, but this only applies to raw inputs.
  const letter = String.fromCharCode(64 + ringNum);
  return `${letter}${num.toString().padStart(2, '0')}${suffix}`;
}
