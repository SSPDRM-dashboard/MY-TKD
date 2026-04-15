import React, { useState, useEffect, useRef } from 'react';
import { Download, AlertCircle, RefreshCw, Eraser, Check, History, X, Search, Printer } from 'lucide-react';
import { motion } from 'motion/react';
import { MatchData, RingStatus } from '../types';
import Papa from 'papaparse';

interface SignaturePadProps {
  color: 'blue' | 'red';
  onConfirm: () => void;
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
          onClick={onConfirm}
          disabled={isConfirmed || !hasSignature}
          className="px-4 py-1.5 bg-slate-900 text-white rounded-lg font-black text-xs uppercase tracking-widest hover:bg-slate-800 disabled:opacity-50 transition-all active:scale-95"
        >
          Confirm
        </button>
      </div>
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
}

interface TASheetProps {
  boutQueue: { id: string, data: MatchData }[];
  rings: RingStatus[];
  currentEventName: string;
  currentEventDate?: string;
  onUpdateInspection?: (ringNo: string, matchNo: string, color: 'blue' | 'red', inspected: boolean) => void;
  viewMode?: 'print' | 'signature';
}

export function TASheet({ boutQueue, rings, currentEventName, currentEventDate, onUpdateInspection, viewMode = 'print' }: TASheetProps) {
  const [matches, setMatches] = useState<SheetMatch[]>([]);
  const [fallbackMatches, setFallbackMatches] = useState<SheetMatch[]>([]);
  const [selectedRing, setSelectedRing] = useState<string>('');
  const [selectedMatchNo, setSelectedMatchNo] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheetDate, setSheetDate] = useState(currentEventDate || '');
  const [sheetDayNo, setSheetDayNo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showReprintModal, setShowReprintModal] = useState(false);
  const [reprintSearchQuery, setReprintSearchQuery] = useState('');
  const [printedMatches, setPrintedMatches] = useState<Set<string>>(new Set());
  const [localSignedMatches, setLocalSignedMatches] = useState<Record<string, {blue: boolean, red: boolean}>>({});

  const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/14TrlxR_rk9S7WmdanXGLlE4Y-ry9TqY6_B6HYA0Uuus/export?format=csv&gid=0";

  const fetchFallbackData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(SHEET_CSV_URL);
      if (!response.ok) {
        throw new Error("Failed to fetch data. Please ensure the Google Sheet is accessible to 'Anyone with the link'.");
      }
      const csvText = await response.text();
      
      Papa.parse(csvText, {
        complete: (result) => {
          const rows = result.data as string[][];
          if (rows.length < 2) {
            setFallbackMatches([]);
            return;
          }
          
          const parsedMatches: SheetMatch[] = [];
          // Skip header row
          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (row.length >= 4 && row[2] && row[3]) { // Ensure Ring No and Match No exist
              parsedMatches.push({
                eventName: row[1] || '',
                ringNo: row[2] || '',
                matchNo: row[3] || '',
                category: row[4] || '',
                blueName: row[5] || '',
                blueClub: row[6] || '',
                redName: row[7] || '',
                redClub: row[8] || ''
              });
            }
          }
          setFallbackMatches(parsedMatches);
        },
        error: (err) => {
          setError(err.message);
        },
        skipEmptyLines: true
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
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

    // Add matches from rings
    rings.forEach(ring => {
      const ringMatches = [ring.currentBout, ring.onDeck, ring.inTheHole].filter(Boolean) as MatchData[];
      ringMatches.forEach(match => {
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
      });
    });

    // Add matches from queue
    boutQueue.forEach(item => {
      const match = item.data;
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
        setSelectedRing(firstRing);
        const firstMatch = allMatches.find(m => m.ringNo === firstRing);
        if (firstMatch) setSelectedMatchNo(firstMatch.matchNo);
      }
    } else {
      setSelectedRing('');
      setSelectedMatchNo('');
    }
  }, [boutQueue, rings, currentEventName, fallbackMatches]);

  const filteredMatches = matches.filter(m => {
    const isPrinted = printedMatches.has(`${m.ringNo}-${m.matchNo}`);
    if (searchQuery) {
      return m.matchNo.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return !isPrinted;
  });

  const uniqueRings = Array.from(new Set(filteredMatches.map(m => m.ringNo))).sort((a, b) => {
    const numA = parseInt(a as string);
    const numB = parseInt(b as string);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return (a as string).localeCompare(b as string);
  });
  
  const ringMatches = filteredMatches.filter(m => m.ringNo === selectedRing);
  const currentMatch = ringMatches.find(m => m.matchNo === selectedMatchNo) || ringMatches[0];

  const [printMode, setPrintMode] = useState<'single' | 'all'>('single');

  const handlePrint = (mode: 'single' | 'all') => {
    setPrintMode(mode);
    
    // Mark as printed
    setPrintedMatches(prev => {
      const newSet = new Set(prev);
      if (mode === 'single' && currentMatch) {
        const status = getMatchStatus(currentMatch);
        if (status.isSigned) {
          newSet.add(`${currentMatch.ringNo}-${currentMatch.matchNo}`);
        }
      } else if (mode === 'all') {
        ringMatches.forEach(m => {
          if (getMatchStatus(m).isSigned) {
            newSet.add(`${m.ringNo}-${m.matchNo}`);
          }
        });
      }
      return newSet;
    });

    setTimeout(() => {
      window.print();
      // Reset back to single after printing
      setTimeout(() => setPrintMode('single'), 100);
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
  const isFullySigned = (!!actualMatchData?.blue_inspected && !!actualMatchData?.red_inspected) || 
                       (localSignedMatches[matchKey]?.blue && localSignedMatches[matchKey]?.red);

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

  const matchesToRender = printMode === 'all' 
    ? ringMatches.filter(m => getMatchStatus(m).isSigned) 
    : (currentMatch ? [currentMatch] : []);

  return (
    <div className="space-y-6">
      <style type="text/css" media="print">
        {`
          @page { 
            size: A4 portrait; 
            margin: 0; 
          }
          body { 
            -webkit-print-color-adjust: exact; 
            print-color-adjust: exact;
            width: 210mm;
            height: 297mm;
            margin: 0;
            padding: 0;
            background: #ffffff !important;
          }
          * { 
            box-shadow: none !important; 
            -webkit-box-shadow: none !important; 
            border-color: #000 !important; 
          }
          .page-break { 
            page-break-after: always; 
            break-inside: avoid;
            width: 210mm !important;
            height: 297mm !important;
            max-width: none !important;
            margin: 0 auto !important;
            padding: 5mm !important;
            box-sizing: border-box;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            background: #ffffff !important;
          }
          .page-break:last-child { page-break-after: auto; }
          table { 
            width: 100% !important; 
            table-layout: fixed; 
            border-collapse: collapse; 
            font-size: 9pt; 
          }
          .no-print { display: none !important; }
        `}
      </style>
      {viewMode === 'print' && (
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 print:hidden flex flex-wrap gap-4 items-end">
        <div className="w-full flex justify-between items-center mb-2">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Download size={20} className="text-slate-400" />
            TA Sheet Generator
          </h2>
          <div className="flex gap-2">
            <button 
              onClick={() => setShowReprintModal(true)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors flex items-center gap-2 text-sm"
              title="Search and reprint signed TA sheets"
            >
              <History size={16} />
              Reprint Signed
            </button>
            <button 
              onClick={fetchFallbackData}
            disabled={isLoading}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors flex items-center gap-2 text-sm disabled:opacity-50"
            title="Fetch directly from Google Sheet if bouts are not in the system yet"
          >
            {isLoading ? <RefreshCw size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Fetch from Google Sheet
          </button>
        </div>
      </div>
    </div>
    )}

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
                setSelectedRing(e.target.value);
                const firstMatch = filteredMatches.find(m => m.ringNo === e.target.value);
                if (firstMatch) setSelectedMatchNo(firstMatch.matchNo);
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
                <option key={idx} value={match.matchNo}>Match {match.matchNo} - {match.category}</option>
              ))}
            </select>
          </div>

          <div className="ml-auto flex flex-col items-end gap-2">
            {viewMode === 'print' && (
            <div className="flex gap-2">
              <button 
                onClick={() => handlePrint('single')}
                disabled={!currentMatch || !isFullySigned}
                className="px-6 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:bg-slate-300 text-sm flex items-center gap-2"
              >
                {!isFullySigned && currentMatch && <AlertCircle size={16} />}
                Print Current Match
              </button>
              <button 
                onClick={() => handlePrint('all')}
                disabled={ringMatches.filter(m => getMatchStatus(m).isSigned).length === 0}
                className="px-6 py-2 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 disabled:bg-slate-300 text-sm"
              >
                Print Signed for Ring {selectedRing}
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
                      setSelectedRing(match.ringNo);
                      setSelectedMatchNo(match.matchNo);
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
                          <span className="text-sm font-black text-slate-800">Match {match.matchNo}</span>
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
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 print:hidden flex gap-8">
          <div className="flex-1 flex flex-col">
            <div className="mb-4 text-center">
              <h3 className="text-lg font-black text-[#00a2e8] uppercase">{actualMatchData?.blue_name || 'Blue Player'}</h3>
              <p className="text-sm font-bold text-slate-500 uppercase">{actualMatchData?.blue_club || 'Blue Club'}</p>
            </div>
            <SignaturePad 
              color="blue" 
              boutId={`${currentMatch.ringNo}-${currentMatch.matchNo}`}
              isConfirmed={!!actualMatchData?.blue_inspected || localSignedMatches[matchKey]?.blue}
              onConfirm={() => {
                setLocalSignedMatches(prev => ({
                  ...prev,
                  [matchKey]: { ...prev[matchKey], blue: true }
                }));
                if (onUpdateInspection) onUpdateInspection(currentMatch.ringNo, currentMatch.matchNo, 'blue', true);
              }}
            />
          </div>
          <div className="flex-1 flex flex-col">
            <div className="mb-4 text-center">
              <h3 className="text-lg font-black text-[#ed1c24] uppercase">{actualMatchData?.red_name || 'Red Player'}</h3>
              <p className="text-sm font-bold text-slate-500 uppercase">{actualMatchData?.red_club || 'Red Club'}</p>
            </div>
            <SignaturePad 
              color="red" 
              boutId={`${currentMatch.ringNo}-${currentMatch.matchNo}`}
              isConfirmed={!!actualMatchData?.red_inspected || localSignedMatches[matchKey]?.red}
              onConfirm={() => {
                setLocalSignedMatches(prev => ({
                  ...prev,
                  [matchKey]: { ...prev[matchKey], red: true }
                }));
                if (onUpdateInspection) onUpdateInspection(currentMatch.ringNo, currentMatch.matchNo, 'red', true);
              }}
            />
          </div>
        </div>
      )}

      {viewMode === 'print' && (
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 print:shadow-none print:border-none print:p-0 overflow-x-auto print:overflow-visible">
        {matchesToRender.map((match, index) => (
          <div key={`${match.ringNo}-${match.matchNo}-${index}`} className="w-full min-w-[700px] max-w-[1000px] mx-auto bg-white print:min-w-0 print:max-w-none print:w-full page-break mb-8 print:mb-0" style={{ fontFamily: 'Arial, sans-serif' }}>
            {/* Header */}
            <div className="flex justify-between items-center mb-2 print:mb-4">
              <div className="w-48 flex items-center gap-2">
                <img 
                  src="https://upload.wikimedia.org/wikipedia/en/thumb/e/e7/World_Taekwondo_logo.svg/512px-World_Taekwondo_logo.svg.png" 
                  alt="World Taekwondo" 
                  className="h-10 object-contain" 
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 30'><text x='0' y='20' font-family='Arial' font-size='12' font-weight='bold' fill='%23000'>WORLD</text><text x='0' y='30' font-family='Arial' font-size='12' font-weight='bold' fill='%23000'>TAEKWONDO</text></svg>";
                  }}
                />
                <div className="h-10 w-10 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold text-[10px] leading-none text-center">TM</div>
              </div>
              <div className="text-center flex-1">
                <h1 className="text-2xl font-black tracking-widest print:text-3xl">TA SHEET</h1>
                <div className="text-xs font-bold mt-0.5">({match.eventName || 'Event Name'})</div>
              </div>
              <div className="text-base font-black w-48 text-right">Best of 3</div>
            </div>

            {/* Match Info */}
            <table className="w-full border-collapse border border-black mb-2 print:mb-4 text-sm font-bold match-info-table">
              <tbody>
                <tr>
                  <td className="border border-black p-1.5 w-[33%]">Date : <span className="ml-2 font-normal">{sheetDate}</span></td>
                  <td className="border border-black p-1.5 w-[33%]">Day No: <span className="ml-2 font-normal">{sheetDayNo}</span></td>
                  <td colSpan={2} className="border border-black p-1.5 w-[34%]">Court No: <span className="text-lg ml-2">{match.ringNo}</span></td>
                </tr>
                <tr>
                  <td className="border border-black p-1.5">Match No: <span className="text-lg ml-2">{match.matchNo}</span></td>
                  <td className="border border-black p-1.5 relative">
                    Weight Category : {match.category}
                    <span className="absolute right-2 top-1.5">kg</span>
                  </td>
                  <td className="border border-black p-1.5 w-[17%]">Hit Level :</td>
                  <td className="border border-black p-1.5 w-[17%]">Hogu Saiz :</td>
                </tr>
              </tbody>
            </table>

            {/* Players */}
            <div className="flex gap-4 mb-2 print:mb-4">
              <table className="w-1/2 border-collapse border border-black text-sm font-bold text-center">
                <thead>
                  <tr>
                    <th colSpan={2} className="bg-[#00a2e8] text-white border border-black p-1.5 text-lg tracking-widest">CHUNG</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="h-[15px] print:h-[15px]">
                    <td className="border border-black p-0 px-1.5 w-[25%] print:w-[10%]">NAME</td>
                    <td className="border border-black p-0 px-1.5 w-[75%] print:w-[90%]">{match.blueName}</td>
                  </tr>
                  <tr className="h-[15px] print:h-[15px]">
                    <td className="border border-black p-0 px-1.5">NOC</td>
                    <td className="border border-black p-0 px-1.5">{match.blueClub}</td>
                  </tr>
                </tbody>
              </table>
              <table className="w-1/2 border-collapse border border-black text-sm font-bold text-center">
                <thead>
                  <tr>
                    <th colSpan={2} className="bg-[#ed1c24] text-white border border-black p-1.5 text-lg tracking-widest">HONG</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="h-[15px] print:h-[15px]">
                    <td className="border border-black p-0 px-1.5 w-[25%] print:w-[10%]">NAME</td>
                    <td className="border border-black p-0 px-1.5 w-[75%] print:w-[90%]">{match.redName}</td>
                  </tr>
                  <tr className="h-[15px] print:h-[15px]">
                    <td className="border border-black p-0 px-1.5">NOC</td>
                    <td className="border border-black p-0 px-1.5">{match.redClub}</td>
                  </tr>
                </tbody>
              </table>
            </div>

          {/* Round Scores */}
          <table className="w-full border-collapse border border-black mb-2 print:mb-4 text-sm text-center font-bold">
            <thead>
              <tr>
                <th className="border border-black p-1.5 w-[15%]">Gam-Jeom</th>
                <th className="border border-black p-1.5 w-[20%]">Deuk-jeum</th>
                <th className="border border-black p-1.5 w-[30%]" colSpan={3}>Round Winner</th>
                <th className="border border-black p-1.5 w-[20%]">Deuk-jeum</th>
                <th className="border border-black p-1.5 w-[15%]">Gam-Jeom</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3].map((round) => (
                <tr key={round} className="h-[30px] print:h-[30px]">
                  <td className="border border-black w-[15%]"></td>
                  <td className="border border-black w-[20%]"></td>
                  <td className="border border-black text-[#00a2e8] w-[12%]">CHUNG</td>
                  <td className="border border-black bg-gray-200 w-[6%]">R{round}</td>
                  <td className="border border-black text-[#ed1c24] w-[12%]">HONG</td>
                  <td className="border border-black w-[20%]"></td>
                  <td className="border border-black w-[15%]"></td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Decision of Superiority */}
          <table className="w-[190mm] mx-auto border-collapse border border-black mb-2 print:mb-4 text-[10px] text-center font-bold">
            <colgroup>
              {/* Chung Superiority: 24mm (8mm each) */}
              <col style={{ width: '8mm' }} />
              <col style={{ width: '8mm' }} />
              <col style={{ width: '8mm' }} />
              {/* Chung Reg Hits: 12mm */}
              <col style={{ width: '12mm' }} />
              {/* Chung Highest Point Value: GJ (9mm), 1 (9mm), 2 (9mm), 3 (9mm) */}
              <col style={{ width: '9mm' }} />
              <col style={{ width: '9mm' }} />
              <col style={{ width: '9mm' }} />
              <col style={{ width: '9mm' }} />
              {/* Chung Turning Kick Pts: 18mm */}
              <col style={{ width: '18mm' }} />
              {/* Round: 10mm */}
              <col style={{ width: '10mm' }} />
              {/* Hong Turning Kick Pts: 18mm */}
              <col style={{ width: '18mm' }} />
              {/* Hong Highest Point Value: 3 (9mm), 2 (9mm), 1 (9mm), GJ (9mm) */}
              <col style={{ width: '9mm' }} />
              <col style={{ width: '9mm' }} />
              <col style={{ width: '9mm' }} />
              <col style={{ width: '9mm' }} />
              {/* Hong Reg Hits: 12mm */}
              <col style={{ width: '12mm' }} />
              {/* Hong Superiority: 24mm (8mm each) */}
              <col style={{ width: '8mm' }} />
              <col style={{ width: '8mm' }} />
              <col style={{ width: '8mm' }} />
            </colgroup>
            <thead>
              <tr>
                <th colSpan={19} className="border border-black p-1.5 bg-gray-200 text-sm tracking-widest">DECISION OF ROUND SUPERIORITY</th>
              </tr>
              <tr>
                <th colSpan={3} className="border border-black p-1 text-[#00a2e8]">Superiority</th>
                <th rowSpan={2} className="border border-black p-1 text-[#00a2e8]">Reg.<br/>Hits</th>
                <th colSpan={4} className="border border-black p-1 text-[#00a2e8]">Highest point value</th>
                <th rowSpan={2} className="border border-black p-1 text-[#00a2e8]">Turning<br/>kick pts</th>
                
                <th rowSpan={2} className="border border-black p-1 bg-gray-200 text-black text-xs">Round</th>
                
                <th rowSpan={2} className="border border-black p-1 text-[#ed1c24]">Turning<br/>kick pts</th>
                <th colSpan={4} className="border border-black p-1 text-[#ed1c24]">Highest point value</th>
                <th rowSpan={2} className="border border-black p-1 text-[#ed1c24]">Reg.<br/>Hits</th>
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
                <tr key={round} className="h-[22px] print:h-[22px]">
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

          {/* Win Types */}
          <table className="w-full border-collapse border border-black mb-2 print:mb-4 text-sm text-center font-bold">
            <tbody>
              <tr className="h-[30px] print:h-[30px]">
                <td className="border border-black w-1/5">PTF</td>
                <td className="border border-black w-1/5">RSC</td>
                <td className="border border-black w-1/5">WDR</td>
                <td className="border border-black w-1/5">DSQ</td>
                <td className="border border-black w-1/5">DQB</td>
              </tr>
            </tbody>
          </table>

          {/* Video Replay & Match Winner */}
          <table className="w-full border-collapse border border-black mb-2 print:mb-4 text-xs text-center font-bold">
            <thead>
              <tr>
                <th className="border border-black p-1.5 bg-[#00a2e8] text-white text-left px-2 w-[20%]">Reason</th>
                <th colSpan={3} className="border border-black p-1.5 bg-[#00a2e8] text-white w-[15%]">Chung Video Replay</th>
                <th colSpan={2} className="border border-black p-1.5 w-[30%]">Match Winner</th>
                <th className="border border-black p-1.5 bg-[#ed1c24] text-white text-left px-2 w-[20%]">Reason</th>
                <th colSpan={3} className="border border-black p-1.5 bg-[#ed1c24] text-white w-[15%]">Hong Video Replay</th>
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
                <tr key={idx} className="h-[18px] print:h-[18px]">
                  <td className="border border-black p-1 text-left px-2">{reason}</td>
                  <td className="border border-black p-1 w-[5%]">A/R</td>
                  <td className="border border-black p-1 w-[5%]">A/R</td>
                  <td className="border border-black p-1 w-[5%]">A/R</td>
                  
                  {idx === 0 && (
                    <>
                      <td rowSpan={3} className="border border-black p-1 text-[#00a2e8] text-xl w-[15%]">CHUNG</td>
                      <td rowSpan={3} className="border border-black p-1 text-[#ed1c24] text-xl w-[15%]">HONG</td>
                    </>
                  )}
                  {idx === 3 && (
                    <td colSpan={2} className="border border-black p-1 text-sm">Round Won</td>
                  )}
                  {idx > 3 && (
                    <>
                      <td className="border border-black p-1 w-[15%]"></td>
                      <td className="border border-black p-1 w-[15%]"></td>
                    </>
                  )}
                  
                  <td className="border border-black p-1 text-left px-2">{reason}</td>
                  <td className="border border-black p-1 w-[5%]">A/R</td>
                  <td className="border border-black p-1 w-[5%]">A/R</td>
                  <td className="border border-black p-1 w-[5%]">A/R</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Yellow Cards */}
          <div className="flex gap-4 mb-0 print:mb-0">
            <table className="w-[48%] border-collapse border border-black text-sm font-bold">
              <thead>
                <tr>
                  <th className="border border-black p-1.5 text-left px-2 w-[40%] bg-yellow-300">Yellow Card</th>
                  <th className="border border-black p-1.5 text-left px-2 w-[30%]">Result</th>
                  <th className="border border-black p-1.5 text-left px-2 w-[30%]">Time</th>
                </tr>
              </thead>
              <tbody>
                <tr className="h-[22px] print:h-[22px]">
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                </tr>
              </tbody>
            </table>
            <table className="w-[48%] border-collapse border border-black text-sm font-bold ml-auto">
              <thead>
                <tr>
                  <th className="border border-black p-1.5 text-left px-2 w-[40%] bg-yellow-300">Yellow Card</th>
                  <th className="border border-black p-1.5 text-left px-2 w-[30%]">Result</th>
                  <th className="border border-black p-1.5 text-left px-2 w-[30%]">Time</th>
                </tr>
              </thead>
              <tbody>
                <tr className="h-[22px] print:h-[22px]">
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-auto">
            {/* Officials */}
            <table className="w-full border-collapse border border-black mb-2 print:mb-0 text-sm text-center font-bold">
              <tbody>
                <tr className="h-7 print:h-7">
                  <td className="border border-black p-1.5 w-[10%] bg-gray-200">Judge 2</td>
                  <td className="border border-black p-1.5 w-[15%]"></td>
                  <td className="border border-black p-1.5 w-[10%] bg-gray-200">Judge 1</td>
                  <td className="border border-black p-1.5 w-[15%]"></td>
                  <td className="border border-black p-1.5 w-[10%] bg-gray-200">Referee</td>
                  <td className="border border-black p-1.5 w-[15%]"></td>
                  <td className="border border-black p-1.5 w-[10%] bg-gray-200">Review Jury</td>
                  <td className="border border-black p-1.5 w-[15%]"></td>
                </tr>
                <tr className="h-8 print:h-8">
                  <td className="border border-black p-1.5 bg-gray-200">NOC</td>
                  <td className="border border-black p-1.5"></td>
                  <td className="border border-black p-1.5 bg-gray-200">NOC</td>
                  <td className="border border-black p-1.5"></td>
                  <td className="border border-black p-1.5 bg-gray-200">NOC</td>
                  <td className="border border-black p-1.5"></td>
                  <td className="border border-black p-1.5 bg-gray-200">NOC</td>
                  <td className="border border-black p-1.5"></td>
                </tr>
              </tbody>
            </table>

            {/* Signature */}
            <div className="flex justify-end mb-0 mt-4">
              <div className="w-64 flex items-end gap-2 text-sm font-bold">
                <span>Signature :</span>
                <div className="flex-1 border-b border-black"></div>
              </div>
            </div>
          </div>
        </div>
        ))}
      </div>
      )}
    </div>
  );
}
