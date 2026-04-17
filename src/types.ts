export interface EventData {
  id: string;
  name: string;
  eventDate: string;
  sheetUrl: string;
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
}

export interface MatchHistoryItem {
  id: string;
  bout: string;
  category: string;
  winner: string;
  winnerClub?: string;
  eventId: string;
  syncedAt?: string | Date | any;
}
