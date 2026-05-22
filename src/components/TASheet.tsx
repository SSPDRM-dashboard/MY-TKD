import React, { useState, useEffect, useRef } from 'react';
import { Download, AlertCircle, RefreshCw, Eraser, Check, History, X, Search, Printer, Trophy, Edit2 } from 'lucide-react';
import { motion } from 'motion/react';
import { MatchData, RingStatus, EventData, MatchHistoryItem } from '../types';
import Papa from 'papaparse';
import { cn, formatBoutNumber, normalizeBoutNumber, normalizeBoutWithRing, parseRingNumber } from '../lib/utils';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

interface SignaturePadProps {
  color: 'blue' | 'red';
  onConfirm: (signatureDataUrl: string) => void;
  isConfirmed: boolean;
  boutId: string;
}

function SignaturePad({ color, onConfirm, isConfirmed, boutId }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (isConfirmed) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || isConfirmed) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  useEffect(() => {
    clear();
  }, [boutId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Prevent scrolling when touching the canvas on mobile
    const preventScroll = (e: TouchEvent) => {
      e.preventDefault();
    };
    canvas.addEventListener('touchstart', preventScroll, { passive: false });
    canvas.addEventListener('touchmove', preventScroll, { passive: false });

    return () => {
      canvas.removeEventListener('touchstart', preventScroll);
      canvas.removeEventListener('touchmove', preventScroll);
    };
  }, []);

  const bgColor = color === 'blue' ? 'bg-[#cceeff]' : 'bg-[#ffcccc]';
  const borderColor = color === 'blue' ? 'border-[#00a2e8]' : 'border-[#ed1c24]';

  return (
    <div className={`relative w-full h-48 border-2 ${borderColor} ${bgColor} rounded-xl overflow-hidden`}>
      <div className="absolute top-2 left-2 z-20">
        <span className={`text-xs font-black uppercase tracking-widest ${color === 'blue' ? 'text-[#00a2e8]' : 'text-[#ed1c24]'}`}>
          {color === 'blue' ? 'Chung (Blue)' : 'Hong (Red)'} Signature
        </span>
      </div>
      {isConfirmed && (
        <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-10">
          <div className="bg-white p-4 rounded-full shadow-lg">
            <Check size={48} className={color === 'blue' ? 'text-[#00a2e8]' : 'text-[#ed1c24]'} />
          </div>
        </div>
      )}
      <canvas
        ref={canvasRef}
        width={400}
        height={192}
        className="w-full h-full cursor-crosshair touch-none"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseOut={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />
      <div className="absolute bottom-2 right-2 flex gap-2 z-20">
        <button
          onClick={clear}
          disabled={isConfirmed || !hasSignature}
          className="px-4 py-1.5 bg-white border-2 border-slate-900 rounded-lg font-black text-xs uppercase tracking-widest hover:bg-slate-100 disabled:opacity-50 transition-all active:scale-95"
        >
          Reset
        </button>
        <button
          onClick={() => onConfirm(canvasRef.current?.toDataURL() || '')}
          disabled={isConfirmed || !hasSignature}
          className="px-4 py-1.5 bg-slate-900 text-white rounded-lg font-black text-xs uppercase tracking-widest hover:bg-slate-800 disabled:opacity-50 transition-all active:scale-95"
        >
          Confirm
        </button>
      </div>
    </div>
  );
}

export const INSPECTION_ITEMS = [
  {
    category: "Mandatory Protective Gear",
    items: [
      { id: "head", label: "Head Protector", desc: "Correct color, no cracks/tears" },
      { id: "trunk", label: "Trunk Protector (PSS)", desc: "Battery life & sensor connection" },
      { id: "guards", label: "Forearm & Shin Guards", desc: "Worn underneath Dobok" },
      { id: "groin", label: "Groin Guard", desc: "Worn underneath Dobok" },
      { id: "gloves", label: "Gloves", desc: "Clean, not overly worn" },
      { id: "mouthguard", label: "Mouthguard", desc: "White or Transparent" },
      { id: "badge", label: "TM Badge", desc: "WT approved badge" },
    ]
  },
  {
    category: "Personal Identification & Uniform",
    items: [
      { id: "dobok", label: "Dobok (Uniform)", desc: "Official WT style, no unauthorized patches" },
      { id: "socks", label: "Sensing Socks (E-Socks)", desc: "No dead sensors, correct size" },
      { id: "id", label: "Accreditation Card", desc: "Photo matches player's face" },
    ]
  },
  {
    category: "Physical Safety & Hygiene",
    items: [
      { id: "nails", label: "Fingernails & Toenails", desc: "Trimmed short" },
      { id: "jewelry", label: "Jewelry/Hard Objects", desc: "None allowed" },
      { id: "tape", label: "Medical Tape", desc: "Inspected/cleared" },
      { id: "hair", label: "Hair", desc: "Tied back with soft band" },
    ]
  }
];

export const POOMSAE_INSPECTION_ITEMS = [
  {
    category: "Uniform (Dobok) Compliance",
    items: [
      { id: "dobok_style", label: "Official Poomsae Dobok", desc: "Correct style for division/rank" },
      { id: "v_neck", label: "V-Neck Color", desc: "Matches age/rank (Poom/Black/Yellow)" },
      { id: "logos", label: "Authorized Logos", desc: "Official WT/Club logos only" },
      { id: "belt", label: "Belt Implementation", desc: "Tied properly with equal ends" },
    ]
  },
  {
    category: "Personal Identification & Grooming",
    items: [
      { id: "id", label: "Accreditation Card", desc: "Photo matches player's face" },
      { id: "jewelry", label: "Jewelry / Hard Objects", desc: "None allowed (watches, earrings, etc.)" },
      { id: "hair", label: "Hair Accessories", desc: "Tied back with soft band" },
      { id: "nails", label: "Fingernails & Toenails", desc: "Trimmed short" },
    ]
  },
  {
    category: "Physical Readiness",
    items: [
      { id: "tape", label: "Medical Tape", desc: "Skin-colored/white, properly cleared" },
      { id: "clean", label: "Dobok Cleanliness", desc: "Neat, clean, and pressed" },
    ]
  }
];

function PlayerChecklist({ color, checkedItems, onChange, isPoomsae }: { color: 'blue' | 'red', checkedItems: Set<string>, onChange: (items: Set<string>) => void, isPoomsae?: boolean }) {
  const toggleItem = (id: string) => {
    const newSet = new Set(checkedItems);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    onChange(newSet);
  };

  const items = isPoomsae ? POOMSAE_INSPECTION_ITEMS : INSPECTION_ITEMS;

  return (
    <div className="mt-6 space-y-6">
      {items.map((section, sIdx) => (
        <div key={sIdx}>
          <h4 className={cn(
            "text-xs font-black uppercase tracking-widest mb-3 pb-2 border-b",
            color === 'blue' ? "text-blue-600 border-blue-100" : "text-red-600 border-red-100"
          )}>
            {section.category}
          </h4>
          <div className="space-y-2">
            {section.items.map((item) => (
              <label 
                key={item.id} 
                className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors group"
              >
                <input
                  type="checkbox"
                  className="hidden"
                  checked={checkedItems.has(item.id)}
                  onChange={() => toggleItem(item.id)}
                />
                <div className={cn(
                  "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors",
                  checkedItems.has(item.id) 
                    ? (color === 'blue' ? "bg-blue-600 border-blue-600 text-white" : "bg-red-600 border-red-600 text-white")
                    : "border-slate-300 group-hover:border-slate-400 bg-white"
                )}>
                  {checkedItems.has(item.id) && <Check size={14} strokeWidth={3} />}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-700 leading-none mb-1">{item.label}</p>
                  <p className="text-[10px] font-medium text-slate-500 leading-tight">{item.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

interface SheetMatch {
  eventName: string;
  ringNo: string;
  matchNo: string;
  category: string;
  blueName: string;
  blueClub: string;
  redName: string;
  redClub: string;
  winner?: string;
}

interface TASheetProps {
  boutQueue: { id: string, data: MatchData }[];
  rings: RingStatus[];
  currentEventName: string;
  currentEventDate?: string;
  currentEventId?: string | null;
  events?: EventData[];
  matchHistory?: MatchHistoryItem[];
  onUpdateInspection?: (ringNo: string, matchNo: string, color: 'blue' | 'red', inspected: boolean, signature?: string, checklist?: string[]) => void;
  viewMode?: 'print' | 'signature';
  sharedRing?: string;
  sharedMatchNo?: string;
  onSharedSelectionChange?: (ring: string, matchNo: string) => void;
  boutNumberingMode?: 'numeric' | 'alphanumeric';
  key?: string;
  isAutoUpdateNames?: boolean;
  onToggleAutoUpdateNames?: (val: boolean) => void;
}

export function TASheet({ 
  boutQueue, 
  rings, 
  currentEventName, 
  currentEventDate, 
  currentEventId,
  events = [],
  matchHistory = [],
  onUpdateInspection, 
  viewMode = 'print', 
  sharedRing, 
  sharedMatchNo, 
  onSharedSelectionChange,
  boutNumberingMode = 'alphanumeric',
  isAutoUpdateNames,
  onToggleAutoUpdateNames
}: TASheetProps) {
  const [matches, setMatches] = useState<SheetMatch[]>([]);
  const [fallbackMatches, setFallbackMatches] = useState<SheetMatch[]>([]);
  const [internalSelectedRing, setInternalSelectedRing] = useState<string>('');
  const [internalSelectedMatchNo, setInternalSelectedMatchNo] = useState<string>('');
  
  const selectedRing = sharedRing !== undefined ? sharedRing : internalSelectedRing;
  const selectedMatchNo = sharedMatchNo !== undefined ? sharedMatchNo : internalSelectedMatchNo;

  const setSelectedRing = (ring: string) => {
    if (onSharedSelectionChange) onSharedSelectionChange(ring, selectedMatchNo);
    setInternalSelectedRing(ring);
  };

  const setSelectedMatchNo = (matchNo: string) => {
    if (onSharedSelectionChange) onSharedSelectionChange(selectedRing, matchNo);
    setInternalSelectedMatchNo(matchNo);
  };

  const setRingAndMatch = (ring: string, matchNo: string) => {
    if (onSharedSelectionChange) onSharedSelectionChange(ring, matchNo);
    setInternalSelectedRing(ring);
    setInternalSelectedMatchNo(matchNo);
  };

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheetDate, setSheetDate] = useState(currentEventDate || '');
  const [sheetDayNo, setSheetDayNo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showReprintModal, setShowReprintModal] = useState(false);
  const [reprintSearchQuery, setReprintSearchQuery] = useState('');
  const [printedMatches, setPrintedMatches] = useState<Set<string>>(new Set());

  // Load printed matches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('tkd_printed_matches');
    if (saved) {
      try {
        setPrintedMatches(new Set(JSON.parse(saved)));
      } catch (e) {
        console.error("Failed to load printed matches:", e);
      }
    }
  }, []);

  // Save printed matches to localStorage
  useEffect(() => {
    if (printedMatches.size >= 0) {
      localStorage.setItem('tkd_printed_matches', JSON.stringify(Array.from(printedMatches)));
    }
  }, [printedMatches]);

  const [localSignedMatches, setLocalSignedMatches] = useState<Record<string, {blue: boolean, red: boolean}>>({});
  const [blueChecklist, setBlueChecklist] = useState<Set<string>>(new Set());
  const [redChecklist, setRedChecklist] = useState<Set<string>>(new Set());

  useEffect(() => {
    setBlueChecklist(new Set());
    setRedChecklist(new Set());
  }, [selectedRing, selectedMatchNo]);

  const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/14TrlxR_rk9S7WmdanXGLlE4Y-ry9TqY6_B6HYA0Uuus/export?format=csv&gid=0";

  const fetchFallbackData = async (shouldPropagate = false) => {
    setIsLoading(true);
    setError(null);
    try {
      let activeUrl = SHEET_CSV_URL;
      if (currentEventId && events.length > 0) {
        const event = events.find(e => e.id === currentEventId);
        if (event && event.sheetUrl && event.sheetUrl.includes('docs.google.com/spreadsheets')) {
          activeUrl = event.sheetUrl;
          if (!activeUrl.includes('/export?')) {
            activeUrl = activeUrl.replace(/\/edit.*$/, '') + '/export?format=csv';
          }
        }
      }

      console.log("Fetching results from:", activeUrl);
      const response = await fetch(activeUrl);
      if (!response.ok) {
        throw new Error("Failed to fetch data. Please ensure the Google Sheet is accessible to 'Anyone with the link'.");
      }
      const csvText = await response.text();
      
      Papa.parse(csvText, {
        complete: (result) => {
          const rows = result.data as string[][];
          if (rows.length < 2) {
            setFallbackMatches([]);
            if (shouldPropagate) alert("No data found to update names.");
            return;
          }
          
          const parsedMatches: SheetMatch[] = [];
          const historyItems: any[] = [];
          
          // Skip header row
          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            
            // Basic validation: row should have at least the winner column (index 9)
            if (row.length >= 10 && row[2] && row[3]) { 
              const sheetEventName = row[1] || '';
              
              // 1. MUST MATCH EVENT NAME
              if (currentEventName && sheetEventName.trim().toLowerCase() !== currentEventName.trim().toLowerCase()) {
                 continue; // Skip bouts that belong to a different event
              }

              const matchNo = row[3] || '';
              const winner = row[9] || '';
              const category = row[4] || '';
              
              const blueName = row[5] || '';
              const blueClub = row[6] || '';
              const redName = row[7] || '';
              const redClub = row[8] || '';

              parsedMatches.push({
                eventName: sheetEventName,
                ringNo: row[2] || '',
                matchNo: matchNo,
                category: category,
                blueName: blueName,
                blueClub: blueClub,
                redName: redName,
                redClub: redClub,
                winner: winner
              });

              // If there's a winner, prepare to sync it globally
              if (winner && winner.trim() && winner !== '-') {
                const ringNo = parseRingNumber(row[2]);
                const normalizedMatchNo = normalizeBoutWithRing(matchNo, ringNo);
                const winnerTrimmed = winner.trim();
                const normWinner = winnerTrimmed.toLowerCase();
                const normBlue = blueName.toLowerCase();
                const normRed = redName.toLowerCase();
                
                let winnerClub = '';
                let winnerSide: 'Blue' | 'Red' | undefined = undefined;
                if (normWinner === normBlue || normBlue.includes(normWinner)) {
                  winnerClub = blueClub;
                  winnerSide = 'Blue';
                } else if (normWinner === normRed || normRed.includes(normWinner)) {
                  winnerClub = redClub;
                  winnerSide = 'Red';
                }

                const historyId = `${currentEventId || currentEventName}_${normalizedMatchNo}`;
                
                const existingItem = matchHistory.find((h) => h.id === historyId);
                const isDifferent = !existingItem || 
                                    existingItem.winner !== winnerTrimmed || 
                                    existingItem.winnerClub !== winnerClub ||
                                    existingItem.winnerSide !== winnerSide;

                const historyItem: any = {
                  id: historyId,
                  bout: normalizedMatchNo,
                  category: category,
                  winner: winnerTrimmed,
                  winnerClub: winnerClub,
                  ...(winnerSide && { winnerSide }),
                  eventId: currentEventId || currentEventName,
                  syncedAt: existingItem ? existingItem.syncedAt : new Date().toISOString()
                };
                
                historyItems.push(historyItem);

                if (isDifferent) {
                  try {
                    setDoc(doc(db, 'matchHistory', historyId), {
                      ...historyItem,
                      syncedAt: serverTimestamp()
                    });
                  } catch (err) {
                    console.error("Error saving winner to Firestore:", err);
                  }
                }
              }
            }
          }
          setFallbackMatches(parsedMatches);
          
          if (historyItems.length > 0) {
            console.log("Propagating fetched winners to history:", historyItems.length);
            window.dispatchEvent(new CustomEvent('tkd_sync_history', { detail: historyItems }));
          } 

          if (shouldPropagate) {
            window.dispatchEvent(new CustomEvent('tkd_force_propagate_winners', { detail: parsedMatches }));
            alert(`Finished checking the spreadsheet. Found ${historyItems.length} winners to propagate. Names have been updated.`);
          }
        },
        error: (err) => {
          setError(err.message);
          if (shouldPropagate) alert("Error reading spreadsheet: " + err.message);
        },
        skipEmptyLines: true
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
      if (shouldPropagate) alert("Error fetching spreadsheet data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (currentEventDate) {
      setSheetDate(currentEventDate);
    }
  }, [currentEventDate]);

  useEffect(() => {
    const allMatches: SheetMatch[] = [];

    if (!currentEventId) {
      setMatches([]);
      setRingAndMatch('', '');
      return;
    }

    // Add matches from rings
    rings.forEach(ring => {
      const ringMatches = [ring.currentBout, ring.onDeck, ring.inTheHole].filter(Boolean) as MatchData[];
      ringMatches.forEach(match => {
        if (match.eventId === currentEventId) {
          allMatches.push({
            eventName: currentEventName || '',
            ringNo: match.ring.toString(),
            matchNo: match.bout.toString(),
            category: match.category || '',
            blueName: match.blue_name || '',
            blueClub: match.blue_club || '',
            redName: match.red_name || '',
            redClub: match.red_club || ''
          });
        }
      });
    });

    // Add matches from queue
    boutQueue.forEach(item => {
      const match = item.data;
      if (match.eventId === currentEventId) {
        allMatches.push({
          eventName: currentEventName || '',
          ringNo: match.ring.toString(),
          matchNo: match.bout.toString(),
          category: match.category || '',
          blueName: match.blue_name || '',
          blueClub: match.blue_club || '',
          redName: match.red_name || '',
          redClub: match.red_club || ''
        });
      }
    });

    // Merge fallback matches (only add if not already in allMatches)
    fallbackMatches.forEach(fallbackMatch => {
      if (currentEventName && fallbackMatch.eventName && fallbackMatch.eventName.trim().toLowerCase() !== currentEventName.trim().toLowerCase()) {
        return;
      }
      const exists = allMatches.some(m => m.ringNo === fallbackMatch.ringNo && m.matchNo === fallbackMatch.matchNo);
      if (!exists) {
        allMatches.push(fallbackMatch);
      }
    });

    // Sort matches by bout number
    allMatches.sort((a, b) => {
      const numA = parseInt(a.matchNo.replace(/[^0-9]/g, '')) || 0;
      const numB = parseInt(b.matchNo.replace(/[^0-9]/g, '')) || 0;
      return numA - numB;
    });

    setMatches(allMatches);

    // Auto-select first available ring if none selected or if selected ring has no matches
    if (allMatches.length > 0) {
      const uniqueRings = Array.from(new Set(allMatches.map(m => m.ringNo)));
      if (!selectedRing || !uniqueRings.includes(selectedRing)) {
        const firstRing = uniqueRings[0];
        const firstMatch = allMatches.find(m => m.ringNo === firstRing);
        if (firstMatch) {
          setRingAndMatch(firstRing, firstMatch.matchNo);
        } else {
          setSelectedRing(firstRing);
        }
      }
    } else {
      setRingAndMatch('', '');
    }
  }, [boutQueue, rings, currentEventName, fallbackMatches]);

  // Helper to check if any match in a list is signed
  const getMatchStatus = (m: SheetMatch) => {
    const key = `${m.ringNo}-${m.matchNo}`;
    if (localSignedMatches[key]?.blue && localSignedMatches[key]?.red) {
      return { isSigned: true, hasBlue: true, hasRed: true };
    }

    let data = null;
    for (const ring of rings) {
      if (ring.ringNumber.toString() === m.ringNo) {
        if (ring.currentBout?.bout.toString() === m.matchNo) data = ring.currentBout;
        else if (ring.onDeck?.bout.toString() === m.matchNo) data = ring.onDeck;
        else if (ring.inTheHole?.bout.toString() === m.matchNo) data = ring.inTheHole;
        break;
      }
    }
    if (!data) {
      const queued = boutQueue.find(q => q.data.ring.toString() === m.ringNo && q.data.bout.toString() === m.matchNo);
      if (queued) data = queued.data;
    }
    return {
      isSigned: !!data?.blue_inspected && !!data?.red_inspected,
      hasBlue: !!data?.blue_inspected,
      hasRed: !!data?.red_inspected
    };
  };

  const forcePropagateWinners = () => {
    fetchFallbackData(true);
  };

  const filteredMatches = matches.filter(m => {
    // ALWAYS include the currently selected match so it doesn't disappear during reprint
    if (m.ringNo === selectedRing && m.matchNo === selectedMatchNo && selectedMatchNo) {
      return true;
    }

    const isPrinted = printedMatches.has(`${m.ringNo}-${m.matchNo}`);
    const status = getMatchStatus(m);
    const isSigned = status.isSigned;
    
    // Check if this match is currently in one of the active ring slots (Current, On Deck, In The Hole)
    const isInActiveRing = rings.some(r => 
      r.ringNumber.toString() === m.ringNo && (
        (r.currentBout && r.currentBout.bout.toString() === m.matchNo) ||
        (r.onDeck && r.onDeck.bout.toString() === m.matchNo) ||
        (r.inTheHole && r.inTheHole.bout.toString() === m.matchNo)
      )
    );

    if (searchQuery) {
      return m.matchNo.toLowerCase().includes(searchQuery.toLowerCase());
    }
    
    // For TA account, hide matches based on the current view mode
    if (viewMode === 'signature') {
      // For player signature, remove match from list once both players have signed
      // But if it's in the active ring and not both signed, it MUST be visible
      return !isSigned;
    } else {
      // For TA sheet, keep it if it's in an active ring and not fully signed/inspected,
      // OR if it hasn't been printed yet.
      if (isInActiveRing && !isSigned) return true;
      
      // Otherwise, hide if already printed
      return !isPrinted;
    }
  });

  const uniqueRings = Array.from(new Set(filteredMatches.map(m => m.ringNo))).sort((a, b) => {
    const numA = parseInt(a as string);
    const numB = parseInt(b as string);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return (a as string).localeCompare(b as string);
  });
  
  const ringMatches = filteredMatches.filter(m => m.ringNo === selectedRing);

  // Auto-reset selection if the current match becomes hidden (e.g., signed or printed)
  useEffect(() => {
    if (selectedMatchNo && ringMatches.length > 0) {
      const isAvailable = ringMatches.some(m => m.matchNo === selectedMatchNo);
      if (!isAvailable) {
        // Automatically select the next available match in this ring
        setSelectedMatchNo(ringMatches[0].matchNo);
      }
    } else if (!selectedMatchNo && ringMatches.length > 0) {
      // If none selected but matches available, select first one
      setSelectedMatchNo(ringMatches[0].matchNo);
    }
  }, [ringMatches, selectedMatchNo, viewMode]);

  const currentMatch = ringMatches.find(m => m.matchNo === selectedMatchNo) || ringMatches[0];

  const [printMode, setPrintMode] = useState<'single' | 'all'>('single');
  const [sheetType, setSheetType] = useState<'standard' | 'virtual'>('standard');

  const handlePrint = (mode: 'single' | 'all') => {
    setPrintMode(mode);

    setTimeout(() => {
      window.print();
      // Reset back to single after printing and mark as printed
      setTimeout(() => {
        setPrintMode('single');

        // Mark as printed
        setPrintedMatches(prev => {
          const newSet = new Set(prev);
          if (mode === 'single' && currentMatch) {
            newSet.add(`${currentMatch.ringNo}-${currentMatch.matchNo}`);
          } else if (mode === 'all') {
            ringMatches.forEach(m => {
              if (getMatchStatus(m).isSigned) {
                newSet.add(`${m.ringNo}-${m.matchNo}`);
              }
            });
          }
          return newSet;
        });

        // Clear selection after printing single match
        if (mode === 'single') {
          setSelectedMatchNo('');
        }
      }, 100);
    }, 100);
  };

  const getActualMatchData = () => {
    if (!currentMatch) return null;
    
    for (const ring of rings) {
      if (ring.ringNumber.toString() === currentMatch.ringNo) {
        if (ring.currentBout?.bout.toString() === currentMatch.matchNo) return ring.currentBout;
        if (ring.onDeck?.bout.toString() === currentMatch.matchNo) return ring.onDeck;
        if (ring.inTheHole?.bout.toString() === currentMatch.matchNo) return ring.inTheHole;
      }
    }
    
    const queuedMatch = boutQueue.find(q => q.data.ring.toString() === currentMatch.ringNo && q.data.bout.toString() === currentMatch.matchNo);
    if (queuedMatch) return queuedMatch.data;
    
    return null;
  };

  const actualMatchData = getActualMatchData();
  const matchKey = currentMatch ? `${currentMatch.ringNo}-${currentMatch.matchNo}` : '';
  
  const isPoomsaeMode = currentMatch?.category?.toUpperCase().includes('INDIVIDUAL POOMSAE') || 
                        currentMatch?.category?.toUpperCase().includes('FREESTYLE') ||
                        (currentMatch?.category?.toUpperCase().includes('POOMSAE') && !actualMatchData?.red_name);

  const isFullySigned = (!!actualMatchData?.blue_inspected && (isPoomsaeMode || !!actualMatchData?.red_inspected)) || 
                       (localSignedMatches[matchKey]?.blue && (isPoomsaeMode || localSignedMatches[matchKey]?.red));

  const matchesToRender = printMode === 'all' 
    ? ringMatches.filter(m => getMatchStatus(m).isSigned) 
    : (currentMatch ? [currentMatch] : []);

  return (
    <div className="space-y-6">
      <style type="text/css" media="print">
        {`
          @page { 
            size: A4 portrait; 
            margin: 5mm; 
          }
          body { 
            -webkit-print-color-adjust: exact; 
            print-color-adjust: exact;
            background: #ffffff !important;
          }
          * { 
            box-shadow: none !important; 
            -webkit-box-shadow: none !important; 
          }
          .page-break { 
            page-break-after: always; 
            break-inside: avoid;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-sizing: border-box;
            background: #ffffff !important;
          }
          .virtual-half-page {
            height: 140mm; /* Roughly half of A4's 297mm height minus margins */
            box-sizing: border-box;
            overflow: hidden;
            page-break-inside: avoid;
            margin-bottom: 2mm;
          }
          .page-break:last-child { page-break-after: auto; }
          table { 
            border-collapse: collapse !important; 
            font-size: 9pt; 
          }
          .no-print { display: none !important; }
        `}
      </style>
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 print:hidden flex flex-wrap gap-4 items-end mb-6">
        <div className="w-full flex justify-between items-center">
          <h2 className="text-lg font-bold flex items-center gap-2">
            {viewMode === 'print' ? (
              <><Download size={20} className="text-slate-400" /> TA Sheet Generator</>
            ) : (
              <><Edit2 size={20} className="text-slate-400" /> Player Inspection Dashboard</>
            )}
          </h2>
          <div className="flex flex-wrap gap-2 justify-end items-center">
            {viewMode === 'print' && (
              <button 
                onClick={() => setShowReprintModal(true)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors flex items-center gap-2 text-sm h-10"
                title="Search and reprint signed TA sheets"
              >
                <History size={16} />
                Reprint Signed
              </button>
            )}
            
            {onToggleAutoUpdateNames && (
              <div className="flex bg-slate-100 p-1 rounded-xl items-center mr-2 h-10">
                <button
                  onClick={() => onToggleAutoUpdateNames(false)}
                  className={cn("px-4 py-1 text-xs font-black uppercase tracking-widest rounded-lg transition-all", !isAutoUpdateNames ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700")}
                >
                  Manual
                </button>
                <button
                  onClick={() => onToggleAutoUpdateNames(true)}
                  className={cn("px-4 py-1 text-xs font-black uppercase tracking-widest rounded-lg transition-all", isAutoUpdateNames ? "bg-blue-600 shadow-sm text-white" : "text-slate-500 hover:text-slate-700")}
                  title="Auto update every 5 minutes"
                >
                  Auto
                </button>
              </div>
            )}
            
            <button 
              onClick={forcePropagateWinners}
              className="px-4 py-2 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 font-bold rounded-xl transition-colors flex items-center gap-2 text-sm h-10"
              title="Force replacement of 'WINNER OF X' with actual winner names"
            >
              <Trophy size={16} />
              Update Name
            </button>
          </div>
        </div>
      </div>

      <div className="print:hidden space-y-6">
        {error && (
          <div className="w-full p-4 bg-red-50 text-red-600 rounded-xl text-sm font-bold flex items-center gap-2 border border-red-100">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <div className="w-full flex flex-wrap gap-4 items-end bg-slate-50 p-4 rounded-xl border border-slate-100">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Date</label>
            <input 
              type="date" 
              value={sheetDate} 
              onChange={(e) => setSheetDate(e.target.value)}
              className="px-4 py-2 bg-white border border-slate-200 rounded-xl font-bold text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Day No</label>
            <input 
              type="text" 
              value={sheetDayNo} 
              onChange={(e) => setSheetDayNo(e.target.value)}
              className="px-4 py-2 bg-white border border-slate-200 rounded-xl font-bold w-24 text-sm"
              placeholder="e.g. 1"
            />
          </div>
          <div className="w-px h-10 bg-slate-200 mx-2 self-center"></div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Search Match</label>
            <input 
              type="text" 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-4 py-2 bg-white border border-slate-200 rounded-xl font-bold w-40 text-sm"
              placeholder="Match No..."
            />
          </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Select Ring</label>
            <select 
              value={selectedRing} 
              onChange={(e) => {
                const newRing = e.target.value;
                const firstMatch = filteredMatches.find(m => m.ringNo === newRing);
                if (firstMatch) {
                  setRingAndMatch(newRing, firstMatch.matchNo);
                } else {
                  setSelectedRing(newRing);
                }
              }}
              className="px-4 py-2 bg-white border border-slate-200 rounded-xl font-bold min-w-[120px] text-sm"
              disabled={uniqueRings.length === 0}
            >
              {uniqueRings.length === 0 && <option value="">No Data</option>}
              {uniqueRings.map(ring => (
                <option key={ring} value={ring}>Ring {ring}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Select Match</label>
            <select 
              value={selectedMatchNo} 
              onChange={(e) => setSelectedMatchNo(e.target.value)}
              className="px-4 py-2 bg-white border border-slate-200 rounded-xl font-bold min-w-[250px] text-sm"
              disabled={ringMatches.length === 0}
            >
              {ringMatches.length === 0 && <option value="">No Matches Found</option>}
              {ringMatches.map((match, idx) => (
                <option key={idx} value={match.matchNo}>Match {formatBoutNumber(Number(match.ringNo), match.matchNo, boutNumberingMode)} - {match.category}</option>
              ))}
            </select>
          </div>

          <div className="ml-auto flex flex-col items-end gap-2">
            {viewMode === 'print' && (
            <div className="flex gap-2">
              <select
                value={sheetType}
                onChange={(e) => setSheetType(e.target.value as 'standard' | 'virtual')}
                className="px-4 py-2 bg-white border border-slate-200 rounded-xl font-bold text-sm"
              >
                <option value="standard">Standard TA Sheet</option>
                <option value="virtual">Virtual TA Sheet</option>
              </select>
              <button 
                onClick={() => handlePrint('single')}
                disabled={!currentMatch || !isFullySigned}
                className="px-6 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:bg-slate-300 text-sm flex items-center gap-2"
              >
                {!isFullySigned && currentMatch && <AlertCircle size={16} />}
                Print Current Match
              </button>
            </div>
            )}
            {!isFullySigned && currentMatch && viewMode === 'print' && (
              <p className="text-[10px] font-black text-red-500 uppercase tracking-tighter animate-pulse">
                * Both players must sign before printing
              </p>
            )}
          </div>
        </div>
      </div>

      {showReprintModal && viewMode === 'print' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 print:hidden">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-xl font-black text-slate-800 tracking-tight">Reprint Signed Sheets</h3>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Search through all signed matches</p>
              </div>
              <button 
                onClick={() => setShowReprintModal(false)}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input 
                  type="text"
                  placeholder="Search by Match No, Player Name, or Ring..."
                  value={reprintSearchQuery}
                  onChange={(e) => setReprintSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-red-500 transition-all font-bold"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {matches
                .filter(m => {
                  const status = getMatchStatus(m);
                  if (!status.isSigned) return false;
                  
                  const searchLower = reprintSearchQuery.toLowerCase();
                  return (
                    m.matchNo.toLowerCase().includes(searchLower) ||
                    m.blueName.toLowerCase().includes(searchLower) ||
                    m.redName.toLowerCase().includes(searchLower) ||
                    m.category.toLowerCase().includes(searchLower) ||
                    `ring ${m.ringNo}`.toLowerCase().includes(searchLower)
                  );
                })
                .map((match, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setRingAndMatch(match.ringNo, match.matchNo);
                      setShowReprintModal(false);
                    }}
                    className="w-full p-4 bg-white border border-slate-100 rounded-2xl hover:border-red-200 hover:bg-red-50 transition-all text-left flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-100 rounded-xl flex flex-col items-center justify-center group-hover:bg-red-100 transition-colors">
                        <span className="text-[10px] font-black text-slate-400 uppercase leading-none">Ring</span>
                        <span className="text-lg font-black text-slate-700 leading-none">{match.ringNo}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-slate-800">Match {formatBoutNumber(Number(match.ringNo), match.matchNo, boutNumberingMode)}</span>
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-black rounded-md uppercase tracking-tighter">Signed</span>
                        </div>
                        <p className="text-xs font-bold text-slate-500 mt-0.5">{match.category}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-bold text-blue-600 truncate max-w-[100px]">{match.blueName}</span>
                          <span className="text-[10px] font-bold text-slate-300">vs</span>
                          <span className="text-[10px] font-bold text-red-600 truncate max-w-[100px]">{match.redName}</span>
                        </div>
                      </div>
                    </div>
                    <Printer size={20} className="text-slate-300 group-hover:text-red-500 transition-colors" />
                  </button>
                ))}
              
              {matches.filter(m => getMatchStatus(m).isSigned).length === 0 && (
                <div className="py-12 text-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <History size={32} className="text-slate-300" />
                  </div>
                  <p className="text-slate-500 font-bold">No signed matches found yet.</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {currentMatch && onUpdateInspection && viewMode === 'signature' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex flex-col items-center justify-center">
                <span className="text-[10px] font-black text-slate-400 uppercase leading-none">Ring</span>
                <span className="text-lg font-black text-slate-700 leading-none">{currentMatch.ringNo}</span>
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-800">Match {formatBoutNumber(Number(currentMatch.ringNo), currentMatch.matchNo, boutNumberingMode)}</h3>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{currentMatch.category}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {currentMatch.winner && (
                <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-xl">
                  <Trophy size={16} className="text-yellow-600" />
                  <div className="text-left">
                    <p className="text-[10px] font-black text-yellow-600 uppercase tracking-widest leading-none">Winner Found</p>
                    <p className="text-sm font-black text-slate-800 leading-tight">{currentMatch.winner}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 print:hidden flex gap-8">
          <div className="flex-1 flex flex-col">
            <div className="mb-4 text-center">
              <h3 className="text-lg font-black text-[#00a2e8] uppercase">{actualMatchData?.blue_name || 'Blue Player'}</h3>
              <p className="text-sm font-bold text-yellow-200 uppercase">{actualMatchData?.blue_club || 'Blue Club'}</p>
            </div>
            <SignaturePad 
              color="blue" 
              boutId={`${currentMatch.ringNo}-${currentMatch.matchNo}`}
              isConfirmed={!!actualMatchData?.blue_inspected || localSignedMatches[matchKey]?.blue}
              onConfirm={(signature) => {
                setLocalSignedMatches(prev => ({
                  ...prev,
                  [matchKey]: { ...prev[matchKey], blue: true }
                }));
                if (onUpdateInspection) onUpdateInspection(currentMatch.ringNo, currentMatch.matchNo, 'blue', true, signature, Array.from(blueChecklist));
              }}
            />
            <PlayerChecklist 
              color="blue" 
              checkedItems={blueChecklist} 
              onChange={setBlueChecklist} 
              isPoomsae={isPoomsaeMode}
            />
          </div>
          {!isPoomsaeMode && (
            <>
              <div className="w-px bg-slate-200 self-stretch"></div>
              <div className="flex-1 flex flex-col">
                <div className="mb-4 text-center">
                  <h3 className="text-lg font-black text-[#ed1c24] uppercase">{actualMatchData?.red_name || 'Red Player'}</h3>
                  <p className="text-sm font-bold text-yellow-200 uppercase">{actualMatchData?.red_club || 'Red Club'}</p>
                </div>
                <SignaturePad 
                  color="red" 
                  boutId={`${currentMatch.ringNo}-${currentMatch.matchNo}`}
                  isConfirmed={!!actualMatchData?.red_inspected || localSignedMatches[matchKey]?.red}
                  onConfirm={(signature) => {
                    setLocalSignedMatches(prev => ({
                      ...prev,
                      [matchKey]: { ...prev[matchKey], red: true }
                    }));
                    if (onUpdateInspection) onUpdateInspection(currentMatch.ringNo, currentMatch.matchNo, 'red', true, signature, Array.from(redChecklist));
                  }}
                />
                <PlayerChecklist 
                  color="red" 
                  checkedItems={redChecklist} 
                  onChange={setRedChecklist} 
                  isPoomsae={isPoomsaeMode}
                />
              </div>
            </>
          )}
        </div>
      </div>
      )}

      {viewMode === 'print' && (
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 print:shadow-none print:border-0 print:border-transparent print:p-0 overflow-x-auto print:overflow-visible">
        {matchesToRender.map((match, index) => {
          const isSoloMatch = match.category?.toUpperCase().includes('INDIVIDUAL POOMSAE') || 
                             match.category?.toUpperCase().includes('FREESTYLE') ||
                             (match.category?.toUpperCase().includes('POOMSAE') && !match.redName);

          const isPageBreak = sheetType === 'virtual' ? index % 2 === 1 : true;

          return (
            <div key={`${match.ringNo}-${match.matchNo}-${index}`} className={`w-full min-w-[700px] max-w-[1000px] mx-auto bg-white print:min-w-0 print:w-full print:max-w-none mb-8 print:mb-0 ${isPageBreak ? 'page-break' : ''} ${sheetType === 'virtual' ? 'print:virtual-half-page' : ''}`} style={{ fontFamily: 'Arial, sans-serif' }}>
              {sheetType === 'virtual' ? (
                <div className="virtual-ta-sheet text-black flex flex-col min-h-[600px] print:min-h-0 print:h-full w-full relative pt-8 pb-12 print:pt-2 print:pb-2 justify-between">
                  <div>
                    {/* Header */}
                    <div className="flex justify-between items-center mb-4 print:mb-2 text-black relative">
                      <div className="w-24 flex gap-2 items-center flex-col absolute left-0 top-0">
                         {/* World Taekwondo and TM logos would go here */}
                      </div>
                      <div className="text-center flex-1">
                        <h1 className="text-2xl print:text-xl font-black uppercase tracking-widest mt-2">VIRTUAL TAEKWONDO TA SHEET</h1>
                        <div className="text-xs font-bold mt-1 uppercase tracking-wider">{match.eventName || 'Event Name'}</div>
                      </div>
                    </div>

                    <div className="flex justify-end mb-2 print:mb-1 w-full">
                        <div className="font-bold text-[10px]">Best of 3</div>
                    </div>

                    {/* Match Info */}
                    <table className="w-full border-collapse border border-black mb-4 print:mb-2 text-[10px] font-bold table-fixed text-left">
                      <colgroup>
                        <col style={{ width: '33.33%' }} />
                        <col style={{ width: '33.33%' }} />
                        <col style={{ width: '33.33%' }} />
                      </colgroup>
                      <tbody>
                        <tr className="h-[25px]">
                          <td className="border border-black p-1"><span className="inline-block w-12">Date :</span> <span className="font-normal">{sheetDate}</span></td>
                          <td className="border border-black p-1"><span className="inline-block w-12">Day No:</span> <span className="font-normal">{sheetDayNo}</span></td>
                          <td className="border border-black p-1 text-center align-top relative" rowSpan={2}>
                            <div className="font-bold w-full text-center mb-1">Age & Gender Category</div>
                            <div className="font-normal w-full text-center px-1">{match.category}</div>
                          </td>
                        </tr>
                        <tr className="h-[25px]">
                          <td className="border border-black p-1"><span className="inline-block w-12">Match No:</span> <span className="font-bold text-sm">{formatBoutNumber(Number(match.ringNo), match.matchNo, boutNumberingMode)}</span></td>
                          <td className="border border-black p-1"><span className="inline-block w-12">Court No:</span> <span className="font-bold text-sm">{isNaN(Number(match.ringNo)) ? String(match.ringNo).toUpperCase() : String.fromCharCode(64 + Number(match.ringNo))}</span></td>
                        </tr>
                      </tbody>
                    </table>

                    {/* Players */}
                    <div className="flex w-full mb-4 print:mb-2 text-[10px] print:text-[9px]">
                      <div className="w-[49%]">
                        <table className="w-full border-collapse border border-black font-bold text-left table-fixed">
                          <colgroup>
                            <col style={{ width: '22%' }} />
                            <col style={{ width: '78%' }} />
                          </colgroup>
                          <thead>
                            <tr className="h-[20px]">
                              <th colSpan={2} className="bg-[#00a2e8] text-white border border-black p-1 text-sm tracking-widest text-center uppercase">CHUNG</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="h-[20px]">
                              <td className="border border-black p-1 text-center">NAME</td>
                              <td className="border border-black p-1 whitespace-nowrap overflow-hidden text-ellipsis">{match.blueName}</td>
                            </tr>
                            <tr className="h-[20px]">
                              <td className="border border-black p-1 text-center">NOC</td>
                              <td className="border border-black p-1">{match.blueClub}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      
                      <div className="w-[2%]"></div>

                      <div className="w-[49%]">
                        <table className="w-full border-collapse border border-black font-bold text-left table-fixed">
                          <colgroup>
                            <col style={{ width: '22%' }} />
                            <col style={{ width: '78%' }} />
                          </colgroup>
                          <thead>
                            <tr className="h-[20px]">
                              <th colSpan={2} className="bg-[#ed1c24] text-white border border-black p-1 text-sm tracking-widest text-center uppercase">HONG</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="h-[20px]">
                              <td className="border border-black p-1 text-center">NAME</td>
                              <td className="border border-black p-1 whitespace-nowrap overflow-hidden text-ellipsis">{match.redName}</td>
                            </tr>
                            <tr className="h-[20px]">
                              <td className="border border-black p-1 text-center">NOC</td>
                              <td className="border border-black p-1">{match.redClub}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Round Scores */}
                    <div>
                    <table className="w-full border-collapse border border-black mb-4 print:mb-2 text-[10px] print:text-[8px] text-center font-bold table-fixed">
                      <colgroup>
                        <col style={{ width: '16%' }} />
                        <col style={{ width: '16%' }} />
                        <col style={{ width: '36%' }} />
                        <col style={{ width: '16%' }} />
                        <col style={{ width: '16%' }} />
                      </colgroup>
                      <thead>
                        <tr className="h-[20px]">
                          <th className="border border-black p-1">Gam-Jeom</th>
                          <th className="border border-black p-1">Deuk-jeom</th>
                          <th className="border border-black p-1">Round Winner</th>
                          <th className="border border-black p-1">Deuk-jeom</th>
                          <th className="border border-black p-1">Gam-Jeom</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[1, 2, 3].map((round) => (
                          <tr key={round} className="h-[25px]">
                            <td className="border border-black p-1"></td>
                            <td className="border border-black p-1"></td>
                            <td className="border border-black p-0 h-full">
                              <table className="w-full h-full text-center border-collapse">
                                <tbody>
                                  <tr>
                                    <td className="w-[38%] text-[#00a2e8] border-r border-black p-1 h-full">CHUNG</td>
                                    <td className="w-[24%] border-r border-black p-1 font-black h-full">R{round}</td>
                                    <td className="w-[38%] text-[#ed1c24] p-1 h-full">HONG</td>
                                  </tr>
                                </tbody>
                              </table>
                            </td>
                            <td className="border border-black p-1"></td>
                            <td className="border border-black p-1"></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Win Types */}
                    <table className="w-full border-collapse border border-black text-[10px] text-center font-bold table-fixed">
                      <colgroup>
                        <col style={{ width: '20%' }} />
                        <col style={{ width: '20%' }} />
                        <col style={{ width: '20%' }} />
                        <col style={{ width: '20%' }} />
                        <col style={{ width: '20%' }} />
                      </colgroup>
                      <tbody>
                        <tr className="h-[25px]">
                          <td className="border border-black">PTF</td>
                          <td className="border border-black">PUN</td>
                          <td className="border border-black">WDR</td>
                          <td className="border border-black">DSQ</td>
                          <td className="border border-black">DQB</td>
                        </tr>
                      </tbody>
                    </table>
                    </div>
                  </div>

                  {/* Footer Signatures */}
                  <div className="flex justify-between items-end mt-2 text-[10px] font-bold w-full pt-4">
                     <div>Referee Number : <span className="inline-block border-b border-black w-40"></span></div>
                     <div>Name : <span className="inline-block border-b border-black w-56"></span></div>
                     <div>Signature: <span className="inline-block border-b border-black w-56"></span></div>
                  </div>
                </div>
              ) : (
                <div className="standard-ta-sheet text-black">
              {/* Header */}
            <div className="flex justify-between items-center mb-2 print:mb-2 text-black">
              <div className="w-48"></div>
              <div className="text-center flex-1">
                <h1 className="text-2xl font-black tracking-widest print:text-3xl">TA SHEET</h1>
                <div className="text-xs font-bold mt-0.5 uppercase tracking-wider">{match.eventName || 'Event Name'}</div>
              </div>
              <div className="text-base font-black w-48 text-right flex flex-col items-end">
                <span>Best of 3</span>
              </div>
            </div>

            {/* Match Info */}
            <table className="w-full border-collapse border border-black mb-[7px] print:mb-[7px] text-sm font-bold match-info-table table-fixed">
              <colgroup>
                <col style={{ width: '22%' }} />
                <col style={{ width: '45%' }} />
                <col style={{ width: '16.5%' }} />
                <col style={{ width: '16.5%' }} />
              </colgroup>
              <tbody>
                <tr className="h-[25px]">
                  <td className="border border-black p-1.5">Date : <span className="ml-2 font-normal">{sheetDate}</span></td>
                  <td className="border border-black p-1.5">Day No: <span className="ml-2 font-normal">{sheetDayNo}</span></td>
                  <td colSpan={2} className="border border-black p-1.5">Court No: <span className="text-lg ml-2">{isNaN(Number(match.ringNo)) ? String(match.ringNo).toUpperCase() : String.fromCharCode(64 + Number(match.ringNo))}</span></td>
                </tr>
                <tr className="h-[40px]">
                  <td className="border border-black p-1.5">Match No: <span className="text-lg ml-2">{formatBoutNumber(Number(match.ringNo), match.matchNo, boutNumberingMode)}</span></td>
                  <td className="border border-black p-1.5 relative">
                    Weight Category : {match.category}
                    <span className="absolute right-2 top-1.5">kg</span>
                  </td>
                  <td className="border border-black p-1.5">Hit Level :</td>
                  <td className="border border-black p-1.5">Hogu Saiz :</td>
                </tr>
              </tbody>
            </table>

            {/* Players */}
            <div className="flex gap-4 mb-[7px] print:mb-[7px]">
              <table className={cn("border-collapse border border-black text-sm font-bold text-center table-fixed", isSoloMatch ? "w-full" : "w-1/2")}>
                <colgroup>
                  <col style={{ width: isSoloMatch ? '9%' : '18%' }} />
                  <col style={{ width: isSoloMatch ? '91%' : '82%' }} />
                </colgroup>
                <thead>
                  <tr className="h-[25px]">
                    <th colSpan={2} className="bg-[#00a2e8] text-white border border-black p-1.5 text-lg tracking-widest">{isSoloMatch ? 'PERFORMER' : 'CHUNG'}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="h-[27px] print:h-[27px]">
                    <td className="border border-black p-0 px-1.5">NAME</td>
                    <td className="border border-black p-0 px-1.5">{match.blueName}</td>
                  </tr>
                  <tr className="h-[27px] print:h-[27px]">
                    <td className="border border-black p-0 px-1.5">NOC</td>
                    <td className="border border-black p-0 px-1.5">{match.blueClub}</td>
                  </tr>
                </tbody>
              </table>
              {!isSoloMatch && (
                <table className="w-1/2 border-collapse border border-black text-sm font-bold text-center table-fixed">
                  <colgroup>
                    <col style={{ width: '18%' }} />
                    <col style={{ width: '82%' }} />
                  </colgroup>
                  <thead>
                    <tr className="h-[25px]">
                      <th colSpan={2} className="bg-[#ed1c24] text-white border border-black p-1.5 text-lg tracking-widest">HONG</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="h-[27px] print:h-[27px]">
                      <td className="border border-black p-0 px-1.5">NAME</td>
                      <td className="border border-black p-0 px-1.5">{match.redName}</td>
                    </tr>
                    <tr className="h-[27px] print:h-[27px]">
                      <td className="border border-black p-0 px-1.5">NOC</td>
                      <td className="border border-black p-0 px-1.5">{match.redClub}</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>

          {/* Round Scores */}
          <table className="w-full border-collapse border border-black mb-[7px] print:mb-[7px] text-sm text-center font-bold table-fixed">
            <colgroup>
              <col style={{ width: '13.5%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '4.5%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '4.5%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '13.5%' }} />
            </colgroup>
            <thead>
              <tr className="h-[30px]">
                <th className="border border-black p-1.5">Gam-Jeom</th>
                <th colSpan={2} className="border border-black p-1.5">Deuk-jeum</th>
                <th className="border border-black p-1.5">CHUNG</th>
                <th className="border border-black p-1.5">Round</th>
                <th className="border border-black p-1.5">HONG</th>
                <th colSpan={2} className="border border-black p-1.5">Deuk-jeum</th>
                <th className="border border-black p-1.5">Gam-Jeom</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3].map((round) => (
                <tr key={round} className="h-[30px] print:h-[30px]">
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                  <td className="border border-black text-[#00a2e8]">CHUNG</td>
                  <td className="border border-black bg-gray-200">R{round}</td>
                  <td className="border border-black text-[#ed1c24]">HONG</td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Decision of Superiority */}
          {!isSoloMatch && (
            <table className="w-full border-collapse border border-black mb-[7px] print:mb-[7px] text-[10px] text-center font-bold table-fixed">
            <colgroup>
              {/* Chung Superiority: 13.5% (4.5% each) */}
              <col style={{ width: '4.5%' }} />
              <col style={{ width: '4.5%' }} />
              <col style={{ width: '4.5%' }} />
              {/* Chung Reg Hits: 4.5% */}
              <col style={{ width: '4.5%' }} />
              {/* Chung Highest Point Value: GJ, 1, 2, 3 (4.5% each) */}
              <col style={{ width: '4.5%' }} />
              <col style={{ width: '4.5%' }} />
              <col style={{ width: '4.5%' }} />
              <col style={{ width: '4.5%' }} />
              {/* Chung Turning Kick Pts: 10% */}
              <col style={{ width: '10%' }} />
              {/* Round: 8% */}
              <col style={{ width: '8%' }} />
              {/* Hong Turning Kick Pts: 10% */}
              <col style={{ width: '10%' }} />
              {/* Hong Highest Point Value: 3, 2, 1, GJ (4.5% each) */}
              <col style={{ width: '4.5%' }} />
              <col style={{ width: '4.5%' }} />
              <col style={{ width: '4.5%' }} />
              <col style={{ width: '4.5%' }} />
              {/* Hong Reg Hits: 4.5% */}
              <col style={{ width: '4.5%' }} />
              {/* Hong Superiority: 13.5% (4.5% each) */}
              <col style={{ width: '4.5%' }} />
              <col style={{ width: '4.5%' }} />
              <col style={{ width: '4.5%' }} />
            </colgroup>
            <thead>
              <tr className="h-[18px]">
                <th colSpan={19} className="border border-black p-1.5 bg-gray-200 text-sm tracking-widest">DECISION OF ROUND SUPERIORITY</th>
              </tr>
              <tr className="h-[31px]">
                <th colSpan={3} className="border border-black p-1 text-[#00a2e8]">Superiority</th>
                <th colSpan={4} className="border border-black p-1 text-[#00a2e8]">Highest point value</th>
                <th rowSpan={2} className="border border-black p-1 text-[#00a2e8]">Reg.<br/>Hits</th>
                <th rowSpan={2} className="border border-black p-1 text-[#00a2e8]">Turning<br/>kick pts</th>
                
                <th rowSpan={2} className="border border-black p-1 bg-gray-200 text-black text-xs">Round</th>
                
                <th rowSpan={2} className="border border-black p-1 text-[#ed1c24]">Turning<br/>kick pts</th>
                <th rowSpan={2} className="border border-black p-1 text-[#ed1c24]">Reg.<br/>Hits</th>
                <th colSpan={4} className="border border-black p-1 text-[#ed1c24]">Highest point value</th>
                <th colSpan={3} className="border border-black p-1 text-[#ed1c24]">Superiority</th>
              </tr>
              <tr>
                <th className="border border-black p-1 text-[#00a2e8]">J2</th>
                <th className="border border-black p-1 text-[#00a2e8]">J1</th>
                <th className="border border-black p-1 text-[#00a2e8]">CR</th>
                
                <th className="border border-black p-1 text-[#00a2e8]">GJ</th>
                <th className="border border-black p-1 text-[#00a2e8]">1</th>
                <th className="border border-black p-1 text-[#00a2e8]">2</th>
                <th className="border border-black p-1 text-[#00a2e8]">3</th>
                
                <th className="border border-black p-1 text-[#ed1c24]">3</th>
                <th className="border border-black p-1 text-[#ed1c24]">2</th>
                <th className="border border-black p-1 text-[#ed1c24]">1</th>
                <th className="border border-black p-1 text-[#ed1c24]">GJ</th>
                
                <th className="border border-black p-1 text-[#ed1c24]">CR</th>
                <th className="border border-black p-1 text-[#ed1c24]">J1</th>
                <th className="border border-black p-1 text-[#ed1c24]">J2</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3].map((round) => (
                <tr key={round} className="h-[20px] print:h-[20px]">
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                  
                  <td className="border border-black bg-gray-200 text-black text-xs">R{round}</td>
                  
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                </tr>
              ))}
            </tbody>
          </table>
          )}

          {/* Win Types */}
          {!isSoloMatch && (
            <table className="w-full border-collapse border border-black mb-[7px] print:mb-[7px] text-sm text-center font-bold table-fixed">
            <colgroup>
              <col style={{ width: '20%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '20%' }} />
            </colgroup>
            <tbody>
              <tr className="h-[24px] print:h-[24px]">
                <td className="border border-black">PTF</td>
                <td className="border border-black">RSC</td>
                <td className="border border-black">WDR</td>
                <td className="border border-black">DSQ</td>
                <td className="border border-black">DQB</td>
              </tr>
            </tbody>
          </table>
          )}

          {/* Video Replay & Match Winner */}
          <div className="flex gap-2 mb-[7px] print:mb-[7px] w-full justify-between items-stretch">
            
            {/* Chung Video Replay */}
            {!isSoloMatch && (
              <table className="w-[35%] border-collapse border border-black text-xs text-center font-bold table-fixed">
              <colgroup>
                <col style={{ width: '64%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '12%' }} />
              </colgroup>
              <thead>
                <tr className="h-[36px]">
                  <th className="border border-black p-1 bg-[#00a2e8] text-white text-left px-2">Reason</th>
                  <th colSpan={3} className="border border-black p-1 bg-[#00a2e8] text-white leading-tight">Chung Video<br/>Replay</th>
                </tr>
              </thead>
              <tbody>
                {[
                  "2 Points \"Technical\"",
                  "Head Requested",
                  "Gam-Jeum & Point",
                  "Technical Issue",
                  "Requested by CR",
                  "Rejected by CR"
                ].map((reason, idx) => (
                  <tr key={idx} className="h-[20px] print:h-[20px]">
                    <td className="border border-black p-1 text-left px-2 truncate">{reason}</td>
                    <td className="border border-black p-1">A/R</td>
                    <td className="border border-black p-1">A/R</td>
                    <td className="border border-black p-1">A/R</td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}

            {/* Match Winner */}
            <table className={cn("border-collapse border border-black text-xs text-center font-bold table-fixed", isSoloMatch ? "w-full" : "w-[28%]")}>
              <colgroup>
                <col style={{ width: isSoloMatch ? '100%' : '50%' }} />
                {!isSoloMatch && <col style={{ width: '50%' }} />}
              </colgroup>
              <thead>
                <tr className="h-[36px]">
                  <th colSpan={isSoloMatch ? 1 : 2} className="border border-black p-1 bg-white text-black">Match Result</th>
                </tr>
              </thead>
              <tbody>
                <tr className="h-[40px] print:h-[40px]">
                  <td className={cn(
                    "border border-black p-1 text-[#00a2e8] text-xl relative",
                    isSoloMatch ? "bg-green-50 text-green-700" : (match.winner && match.winner.trim().toLowerCase() === match.blueName.trim().toLowerCase() && "bg-blue-50")
                  )}>
                    {isSoloMatch ? 'PERFORMANCE COMPLETED' : 'CHUNG'}
                    {(isSoloMatch || (match.winner && match.winner.trim().toLowerCase() === match.blueName.trim().toLowerCase())) && (
                      <div className="absolute top-1 right-1">
                        <Check size={16} className={isSoloMatch ? "text-green-600" : "text-blue-600"} />
                      </div>
                    )}
                  </td>
                  {!isSoloMatch && (
                    <td className={cn(
                      "border border-black p-1 text-[#ed1c24] text-xl relative",
                      match.winner && match.winner.trim().toLowerCase() === match.redName.trim().toLowerCase() && "bg-red-50"
                    )}>
                      HONG
                      {match.winner && match.winner.trim().toLowerCase() === match.redName.trim().toLowerCase() && (
                        <div className="absolute top-1 right-1">
                          <Check size={16} className="text-red-600" />
                        </div>
                      )}
                    </td>
                  )}
                </tr>
                {!isSoloMatch && (
                  <>
                    <tr className="h-[20px] print:h-[20px]">
                      <td colSpan={2} className="border border-black p-1 text-sm bg-gray-100">Round Won</td>
                    </tr>
                    <tr className="h-[60px] print:h-[60px]">
                      <td className="border border-black p-1"></td>
                      <td className="border border-black p-1"></td>
                    </tr>
                  </>
                )}
                {isSoloMatch && (
                  <tr className="h-[80px] print:h-[80px]">
                    <td className="border border-black p-1 text-left align-top font-normal p-2">
                       <span className="font-bold uppercase text-[9px] block mb-2">Technical Controller Notes / Total Score:</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Hong Video Replay */}
            {!isSoloMatch && (
              <table className="w-[35%] border-collapse border border-black text-xs text-center font-bold table-fixed">
              <colgroup>
                <col style={{ width: '64%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '12%' }} />
              </colgroup>
              <thead>
                <tr className="h-[36px]">
                  <th className="border border-black p-1 bg-[#ed1c24] text-white text-left px-2">Reason</th>
                  <th colSpan={3} className="border border-black p-1 bg-[#ed1c24] text-white leading-tight">Hong Video<br/>Replay</th>
                </tr>
              </thead>
              <tbody>
                {[
                  "2 Points \"Technical\"",
                  "Head Requested",
                  "Gam-Jeum & Point",
                  "Technical Issue",
                  "Requested by CR",
                  "Rejected by CR"
                ].map((reason, idx) => (
                  <tr key={idx} className="h-[20px] print:h-[20px]">
                    <td className="border border-black p-1 text-left px-2 truncate">{reason}</td>
                    <td className="border border-black p-1">A/R</td>
                    <td className="border border-black p-1">A/R</td>
                    <td className="border border-black p-1">A/R</td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}

          </div>

          {/* Yellow Cards */}
          {!isSoloMatch && (
            <div className="flex gap-4 mb-0 print:mb-0">
              <table className="w-[48%] border-collapse border border-black text-sm font-bold table-fixed">
                <colgroup>
                  <col style={{ width: '40%' }} />
                  <col style={{ width: '30%' }} />
                  <col style={{ width: '30%' }} />
                </colgroup>
                <thead>
                  <tr className="h-[25px]">
                    <th className="border border-black p-1 text-left px-2 bg-yellow-300">Yellow Card</th>
                    <th className="border border-black p-1 text-left px-2">Result</th>
                    <th className="border border-black p-1 text-left px-2">Time</th>
                  </tr>
                </thead>
              </table>
              <table className="w-[48%] border-collapse border border-black text-sm font-bold ml-auto table-fixed">
                <colgroup>
                  <col style={{ width: '40%' }} />
                  <col style={{ width: '30%' }} />
                  <col style={{ width: '30%' }} />
                </colgroup>
                <thead>
                  <tr className="h-[25px]">
                    <th className="border border-black p-1 text-left px-2 bg-yellow-300">Yellow Card</th>
                    <th className="border border-black p-1 text-left px-2">Result</th>
                    <th className="border border-black p-1 text-left px-2">Time</th>
                  </tr>
                </thead>
              </table>
            </div>
          )}

          <div className="mt-[15px]">
            {/* Officials */}
            <table className="w-full border-collapse border border-black mb-2 print:mb-0 text-sm text-center font-bold table-fixed">
              <colgroup>
                <col style={{ width: '12.5%' }} />
                <col style={{ width: '12.5%' }} />
                <col style={{ width: '12.5%' }} />
                <col style={{ width: '12.5%' }} />
                <col style={{ width: '12.5%' }} />
                <col style={{ width: '12.5%' }} />
                <col style={{ width: '12.5%' }} />
                <col style={{ width: '12.5%' }} />
              </colgroup>
              <tbody>
                <tr className="h-[30px] print:h-[30px]">
                  <td className="border border-black p-1 bg-gray-200">Judge 2</td>
                  <td className="border border-black p-1"></td>
                  <td className="border border-black p-1 bg-gray-200">Judge 1</td>
                  <td className="border border-black p-1"></td>
                  <td className="border border-black p-1 bg-gray-200">Referee</td>
                  <td className="border border-black p-1"></td>
                  <td className="border border-black p-1 bg-gray-200">Review Jury</td>
                  <td className="border border-black p-1"></td>
                </tr>
                <tr className="h-[30px] print:h-[30px]">
                  <td className="border border-black p-1 bg-gray-200">NOC</td>
                  <td className="border border-black p-1"></td>
                  <td className="border border-black p-1 bg-gray-200">NOC</td>
                  <td className="border border-black p-1"></td>
                  <td className="border border-black p-1 bg-gray-200">NOC</td>
                  <td className="border border-black p-1"></td>
                  <td className="border border-black p-1 bg-gray-200">NOC</td>
                  <td className="border border-black p-1"></td>
                </tr>
              </tbody>
            </table>

            {/* Signature */}
            <div className="flex justify-end mb-0 mt-8">
              <div className="w-64 flex items-end gap-2 text-sm font-bold">
                <span>Signature :</span>
                <div className="flex-1 border-b border-black"></div>
              </div>
            </div>
          </div>
                </div>
              )}
        </div>
        )
      })}
      </div>
      )}
    </div>
  );
}
