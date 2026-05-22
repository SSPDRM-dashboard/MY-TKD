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

export function parseRingNumber(ringVal: any): number {
  if (!ringVal) return 1;
  const s = ringVal.toString().trim().toUpperCase();
  // If it is already a straight number
  const num = parseInt(s.replace(/[^0-9]/g, ''));
  if (!isNaN(num) && num > 0) return num;
  
  // Look for match with letters: Ring A, Court A, A
  const letterMatch = s.match(/(?:RING|COURT|AISTUDIO)?\s*([A-Z])/i);
  if (letterMatch && letterMatch[1]) {
    return letterMatch[1].charCodeAt(0) - 'A'.charCodeAt(0) + 1;
  }
  return 1;
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
  
  // Handle cases where someone might input "1022" and we want to compare with "1022"
  return s;
}

export function isBoutMatch(bout1: string | number, bout2: string | number): boolean {
  if (bout1 === bout2) return true;
  if (!bout1 || !bout2) return false;

  const normalizeLenient = (b: string | number) => b.toString().toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
  
  const b1 = normalizeLenient(bout1);
  const b2 = normalizeLenient(bout2);
  
  if (b1 === b2) return true;
  
  const norm1 = normalizeBoutNumber(bout1);
  const norm2 = normalizeBoutNumber(bout2);
  
  if (norm1 === norm2) return true;
  
  // Also check if one is relative (e.g. "22") and the other is absolute (e.g. "1022")
  const num1 = parseInt(norm1.replace(/[^0-9]/g, ''));
  const num2 = parseInt(norm2.replace(/[^0-9]/g, ''));
  
  if (!isNaN(num1) && !isNaN(num2)) {
    if (num1 === num2) return true;
    // If one is < 1000 and the other is exactly (Ring * 1000) + that number
    if (num1 < 1000 && num2 >= 1000 && num2 % 1000 === num1) return true;
    if (num2 < 1000 && num1 >= 1000 && num1 % 1000 === num2) return true;
  }
  
  return false;
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

export function formatBoutNumber(ringNum: number, bout: string | number, mode: 'numeric' | 'alphanumeric' = 'alphanumeric'): string {
  const s = bout.toString().trim().toUpperCase();
  if (!s) return '';

  const num = parseInt(s.replace(/[^0-9]/g, ''));
  const suffix = s.replace(/[0-9]/g, '');

  if (isNaN(num)) return s;

  if (mode === 'numeric') {
    // If it's alphanumeric (e.g., A01), convert to numeric (1001)
    if (/^[A-Z]/.test(s)) {
      const letter = s.charAt(0);
      const ring = letter.charCodeAt(0) - 64;
      const boutNum = parseInt(s.substring(1).replace(/[^0-9]/g, ''));
      return ((ring * 1000) + boutNum).toString() + suffix;
    }
    
    // If it's a small number, add ring offset
    if (num < 1000 && ringNum > 0) {
      return ((ringNum * 1000) + num).toString() + suffix;
    }
    return num.toString() + suffix;
  }

  // Alphanumeric mode (A01)
  // 1. If it already has a letter prefix (e.g., A01), keep it
  if (/^[A-Z]/.test(s)) return s;

  // 2. If it's a "full" numeric ID (>= 1000), convert it back to letter format
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

export function extractWinnerOfBout(nameStr: string | null | undefined): string | null {
  if (!nameStr) return null;
  const s = nameStr.trim().toUpperCase();
  
  // Match "WINNER OF BOUT [BOUT_ID]" or "WINNER BOUT [BOUT_ID]"
  const matchBout = s.match(/(?:WINNER\s+(?:OF\s+)?BOUT\s+)([\w-]+)/i);
  if (matchBout && matchBout[1]) {
    return matchBout[1];
  }

  // Match "WINNER OF [BOUT_ID]" or "WINNER [BOUT_ID]"
  const matchDirect = s.match(/(?:WINNER\s+(?:OF\s+)?\s*)([\w-]+)/i);
  if (matchDirect && matchDirect[1]) {
    // Ensure we didn't just capture "BOUT" because of a space in "WINNER OF BOUT 23"
    if (matchDirect[1] === 'BOUT') {
       // If it captured BOUT, look for the text after "BOUT"
       const postBoutMatch = s.match(/(?:WINNER\s+(?:OF\s+)?BOUT\s+)([\w-]+)/i);
       if (postBoutMatch && postBoutMatch[1]) {
         return postBoutMatch[1];
       }
    }
    return matchDirect[1];
  }
  
  return null;
}

