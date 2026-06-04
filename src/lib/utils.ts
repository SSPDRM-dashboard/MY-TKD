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
  let s = bout.toString().replace(/\s+/g, '').toUpperCase();
  if (!s) return '';
  
  // Replace letter 'O' with digit '0' if it is inside the alphabetic ring prefix of a bout (e.g., "CO1" -> "C01")
  s = s.replace(/^([A-H])O+(\d+)([A-Z]*)$/, '$10$2$3');
  
  // Handle A01, B01, C01 format (A=1000, B=2000, C=3000, etc.) with optional suffix
  const match = s.match(/^([A-Z])(\d+)([A-Z]*)$/);
  if (match) {
    const letter = match[1];
    const number = parseInt(match[2]);
    const suffix = match[3] || '';
    const ringOffset = (letter.charCodeAt(0) - 'A'.charCodeAt(0) + 1) * 1000;
    return (ringOffset + number).toString() + suffix;
  }
  
  // Handle cases where someone might input "1022" and we want to compare with "1022"
  return s;
}

export function isBoutMatch(bout1: string | number, bout2: string | number): boolean {
  if (bout1 === bout2) return true;
  if (!bout1 || !bout2) return false;

  const getSuffix = (b: string | number): string => {
    const s = b.toString().toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
    const match = s.match(/([0-9]+)([A-Z]+)$/);
    return match ? match[2] : '';
  };

  const suffix1 = getSuffix(bout1);
  const suffix2 = getSuffix(bout2);

  if (suffix1 !== suffix2) return false;

  const normalizeLenient = (b: string | number) => {
    let s = b.toString().toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
    // Also cover lenient "O" to "0" replacing for single letter prefixes
    s = s.replace(/^([A-H])O+(\d+)([A-Z]*)$/, '$10$2$3');
    return s;
  };
  
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
  let s = bout.toString().replace(/\s+/g, '').toUpperCase();
  if (!s) return '';
  
  // Normalize O to 0
  s = s.replace(/^([A-H])O+(\d+)([A-Z]*)$/, '$10$2$3');
  
  // If it already has a letter, use standard normalization
  if (/^[A-Z]/.test(s)) return normalizeBoutNumber(s);
  
  const num = parseInt(s.replace(/[^0-9]/g, ''));
  if (isNaN(num)) return s;

  // Extract suffix
  const suffixMatch = s.match(/([0-9]+)([A-Z]+)$/);
  const suffix = suffixMatch ? suffixMatch[2] : '';
  
  // If it's a small number, assume it's relative to the ring
  if (num < 1000) {
    return ((ringNum * 1000) + num).toString() + suffix;
  }
  
  return num.toString() + suffix;
}

export function getBoutNumber(bout: string | number): number {
  return parseInt(normalizeBoutNumber(bout)) || 0;
}

export function formatBoutNumber(ringNum: number, bout: string | number, mode: 'numeric' | 'alphanumeric' = 'alphanumeric'): string {
  const s = bout.toString().trim().toUpperCase();
  if (!s) return '';

  const num = parseInt(s.replace(/[^0-9]/g, ''));
  
  // Extract custom suffix using safe pattern
  const match = s.match(/([0-9]+)([A-Z]+)$/);
  const suffix = match ? match[2] : '';

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
  let s = nameStr.trim().toUpperCase();
  
  // Normalize variations of WINNER OF BOUT / WINNER OF MATCH / WINNER BOUT / WINNER
  s = s.replace(/\b(?:WINNER|WINN|WINNR)\s+(?:OF\s+)?(?:BOUT\s+|MATCH\s+)?/i, 'WINNER OF ');
  
  // Clean letter 'O' vs number '0' typos inside alphabetic ring prefix of a bout code (e.g., "C O1" -> "C01", "CO1" -> "C01")
  s = s.replace(/([A-H])\s*O\s*(\d+)/g, '$10$2');
  
  // Clean spaced bout numbers (e.g., "C 01" -> "C01")
  s = s.replace(/([A-H])\s*(\d+)/g, '$1$2');

  // Perform extracting match
  const matchOf = s.match(/WINNER OF\s*([\w-]+)/i);
  if (matchOf && matchOf[1]) {
    let extracted = matchOf[1].trim();
    // Normalize "O" to "0" one more time inside extracted bout
    if (/^[A-H]O+\d+$/.test(extracted)) {
      extracted = extracted.charAt(0) + extracted.substring(1).replace(/O/g, '0');
    }
    return extracted;
  }
  
  return null;
}

