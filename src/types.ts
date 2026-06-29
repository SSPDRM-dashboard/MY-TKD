export interface EventData {
  id: string;
  name: string;
  eventDate: string;
  sheetUrl: string;
  winnerSheetUrl?: string; // Standard docs.google.com URL for CSV export
  ringQuantity: number;
  createdAt: Date;
}

export interface BoutMapping {
  id: string;
  eventId: string;
  eventName: string;
  categoryName: string;
  sourceBout: string;
  nextBout: string;
  slot: 'Chung' | 'Hong';
}

export interface MatchData {
  ring: number;
  originalRing?: number;
  bout: string | number;
  blue_name: string;
  blue_club: string;
  red_name: string;
  red_club: string;
  category: string;
  privacy_mode: boolean;
  eventId?: string | null;
  blue_inspected?: boolean;
  red_inspected?: boolean;
  blue_signature?: string;
  red_signature?: string;
  blue_checklist?: string[];
  red_checklist?: string[];
  inspectedAt?: number;
  points?: {
    r1Blue?: string;
    r1Red?: string;
    r2Blue?: string;
    r2Red?: string;
    r3Blue?: string;
    r3Red?: string;
    r1Winner?: 'Blue' | 'Red' | '';
    r2Winner?: 'Blue' | 'Red' | '';
    r3Winner?: 'Blue' | 'Red' | '';
  };
  isManuallyEdited?: boolean;
  allowCompleted?: boolean;
}

export interface RingStatus {
  ringNumber: number;
  totalBouts?: number;
  nextBoutNumber?: number;
  currentBout: MatchData | null;
  onDeck: MatchData | null;
  inTheHole: MatchData | null;
  isFinalBouts?: boolean;
  eventId?: string | null;
  version?: number;
  updatedAt?: number;
  suspendedBouts?: MatchData[];
  isDeleted?: boolean;
}

export interface MatchHistoryItem {
  id: string;
  bout: string;
  category: string;
  winner: string;
  winnerClub?: string;
  winnerSide?: 'Blue' | 'Red';
  blue_name?: string;
  blue_club?: string;
  red_name?: string;
  red_club?: string;
  eventId: string;
  ring?: number;
  syncedAt?: string | Date | any;
}
