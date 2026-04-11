import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { RefreshCw, Download, AlertCircle } from 'lucide-react';

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

export function TASheet() {
  const [matches, setMatches] = useState<SheetMatch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRing, setSelectedRing] = useState<string>('');
  const [selectedMatchNo, setSelectedMatchNo] = useState<string>('');

  const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/1QCGhccGDJboxBLswoJqe82X3dxa9ZZC0aDo4Y3CZF8o/export?format=csv&gid=0";

  const fetchData = async () => {
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
            setMatches([]);
            return;
          }
          
          const parsedMatches: SheetMatch[] = [];
          // Skip header row
          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (row.length >= 3 && row[1] && row[2]) { // Ensure Ring No and Match No exist
              parsedMatches.push({
                eventName: row[0] || '',
                ringNo: row[1] || '',
                matchNo: row[2] || '',
                category: row[3] || '',
                blueName: row[4] || '',
                blueClub: row[5] || '',
                redName: row[6] || '',
                redClub: row[7] || ''
              });
            }
          }
          setMatches(parsedMatches);
          
          // Auto-select first available ring if none selected
          if (parsedMatches.length > 0) {
            const firstRing = parsedMatches[0].ringNo;
            if (!selectedRing) {
              setSelectedRing(firstRing);
              const firstMatch = parsedMatches.find(m => m.ringNo === firstRing);
              if (firstMatch) setSelectedMatchNo(firstMatch.matchNo);
            }
          }
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
    fetchData();
  }, []);

  const uniqueRings = Array.from(new Set(matches.map(m => m.ringNo))).sort((a, b) => {
    const numA = parseInt(a as string);
    const numB = parseInt(b as string);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return (a as string).localeCompare(b as string);
  });
  
  const ringMatches = matches.filter(m => m.ringNo === selectedRing);
  const currentMatch = ringMatches.find(m => m.matchNo === selectedMatchNo) || ringMatches[0];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <style type="text/css" media="print">
        {`
          @page { size: A4 portrait; margin: 8mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          * { box-shadow: none !important; -webkit-box-shadow: none !important; }
        `}
      </style>
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 print:hidden flex flex-wrap gap-4 items-end">
        <div className="w-full flex justify-between items-center mb-2">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Download size={20} className="text-slate-400" />
            Fetch Data from Google Sheet
          </h2>
          <button 
            onClick={fetchData}
            disabled={isLoading}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors flex items-center gap-2 text-sm disabled:opacity-50"
          >
            {isLoading ? <RefreshCw size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Refresh Data
          </button>
        </div>

        {error && (
          <div className="w-full p-4 bg-red-50 text-red-600 rounded-xl text-sm font-bold flex items-center gap-2 border border-red-100">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Select Ring</label>
          <select 
            value={selectedRing} 
            onChange={(e) => {
              setSelectedRing(e.target.value);
              const firstMatch = matches.find(m => m.ringNo === e.target.value);
              if (firstMatch) setSelectedMatchNo(firstMatch.matchNo);
            }}
            className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold min-w-[120px]"
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
            className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold min-w-[250px]"
            disabled={ringMatches.length === 0}
          >
            {ringMatches.length === 0 && <option value="">No Matches Found</option>}
            {ringMatches.map((match, idx) => (
              <option key={idx} value={match.matchNo}>Match {match.matchNo} - {match.category}</option>
            ))}
          </select>
        </div>

        <div className="ml-auto">
          <button 
            onClick={handlePrint}
            disabled={!currentMatch}
            className="px-6 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            Print TA Sheet
          </button>
        </div>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 print:shadow-none print:border-none print:p-0 overflow-x-auto">
        <div className="w-full min-w-[700px] max-w-[1000px] mx-auto bg-white print:min-w-0 print:max-w-none print:w-full" style={{ fontFamily: 'Arial, sans-serif' }}>
          {/* Header */}
          <div className="flex justify-between items-center mb-2">
            <div className="w-48"></div> {/* Empty space to balance the header */}
            <h1 className="text-2xl font-bold tracking-widest">TA SHEET</h1>
            <div className="text-lg font-semibold w-48 text-right">Best of 3</div>
          </div>

          {/* Match Info */}
          <table className="w-full border-collapse border border-black mb-2 text-sm">
            <tbody>
              <tr>
                <td className="border border-black p-1 w-1/3 font-bold">Date :</td>
                <td className="border border-black p-1 w-1/3 font-bold">Day No:</td>
                <td className="border border-black p-1 w-1/3 font-bold" colSpan={2}>
                  <div className="flex items-center">
                    <span>Court No:</span>
                    <span className="flex-1 text-center text-lg">{currentMatch?.ringNo || ''}</span>
                  </div>
                </td>
              </tr>
              <tr>
                <td className="border border-black p-1 font-bold">
                  <div className="flex items-center">
                    <span>Match No:</span>
                    <span className="flex-1 text-center text-lg">{currentMatch?.matchNo || ''}</span>
                  </div>
                </td>
                <td className="border border-black p-1 font-bold">Weight Category : {currentMatch?.category || ''}</td>
                <td className="border border-black p-1 font-bold">Hit Level :</td>
                <td className="border border-black p-1 font-bold">Hogu Saiz :</td>
              </tr>
            </tbody>
          </table>

          {/* Players */}
          <div className="flex gap-4 mb-2">
            <table className="w-1/2 border-collapse border border-black text-sm">
              <thead>
                <tr>
                  <th colSpan={2} className="bg-[#00a2e8] text-black border border-black p-1 font-bold text-lg">CHUNG</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-black p-1 font-bold w-20">NAME</td>
                  <td className="border border-black p-1">{currentMatch?.blueName || ''}</td>
                </tr>
                <tr>
                  <td className="border border-black p-1 font-bold">NOC</td>
                  <td className="border border-black p-1">{currentMatch?.blueClub || ''}</td>
                </tr>
              </tbody>
            </table>
            <table className="w-1/2 border-collapse border border-black text-sm">
              <thead>
                <tr>
                  <th colSpan={2} className="bg-[#ed1c24] text-black border border-black p-1 font-bold text-lg">HONG</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-black p-1 font-bold w-20">NAME</td>
                  <td className="border border-black p-1">{currentMatch?.redName || ''}</td>
                </tr>
                <tr>
                  <td className="border border-black p-1 font-bold">NOC</td>
                  <td className="border border-black p-1">{currentMatch?.redClub || ''}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Round Scores */}
          <table className="w-full border-collapse border border-black mb-2 text-sm text-center">
            <thead>
              <tr>
                <th className="border border-black p-1 font-bold w-1/6">Gam-Jeom</th>
                <th className="border border-black p-1 font-bold w-1/4">Deuk-jeum</th>
                <th className="border border-black p-1 font-bold w-1/6" colSpan={3}>Round Winner</th>
                <th className="border border-black p-1 font-bold w-1/4">Deuk-jeum</th>
                <th className="border border-black p-1 font-bold w-1/6">Gam-Jeom</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3].map((round) => (
                <tr key={round} className="h-6">
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                  <td className="border border-black text-[#00a2e8] font-bold w-[67px]">CHUNG</td>
                  <td className="border border-black font-bold w-12">R{round}</td>
                  <td className="border border-black text-[#ed1c24] font-bold w-[67px]">HONG</td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Decision of Superiority */}
          <table className="w-full border-collapse border border-black mb-2 text-xs text-center relative">
            <thead>
              <tr>
                <th colSpan={9} className="border border-black p-1">Decision of Superiority</th>
                <th rowSpan={3} className="border border-black p-1 font-bold text-sm w-12">Round</th>
                <th colSpan={9} className="border border-black p-1">Decision of Superiority</th>
              </tr>
              <tr>
                <th colSpan={3} className="border border-black p-1 text-[#00a2e8]">Superiority</th>
                <th rowSpan={2} className="border border-black p-1 text-[#00a2e8]">Reg.<br/>Hits</th>
                <th colSpan={4} className="border border-black p-1 text-[#00a2e8]">Highest point value</th>
                <th rowSpan={2} className="border border-black p-1 text-[#00a2e8]">Turning<br/>kick pts</th>
                
                <th rowSpan={2} className="border border-black p-1 text-[#ed1c24]">Turning<br/>kick pts</th>
                <th colSpan={4} className="border border-black p-1 text-[#ed1c24]">Highest point value</th>
                <th rowSpan={2} className="border border-black p-1 text-[#ed1c24]">Reg.<br/>Hits</th>
                <th colSpan={3} className="border border-black p-1 text-[#ed1c24]">Superiority</th>
              </tr>
              <tr>
                <th className="border border-black p-1 text-[#00a2e8] w-6">J2</th>
                <th className="border border-black p-1 text-[#00a2e8] w-6">J1</th>
                <th className="border border-black p-1 text-[#00a2e8] w-6">CR</th>
                <th className="border border-black p-1 text-[#00a2e8] w-6">GJ</th>
                <th className="border border-black p-1 text-[#00a2e8] w-6">1</th>
                <th className="border border-black p-1 text-[#00a2e8] w-6">2</th>
                <th className="border border-black p-1 text-[#00a2e8] w-6">3</th>
                
                <th className="border border-black p-1 text-[#ed1c24] w-6">3</th>
                <th className="border border-black p-1 text-[#ed1c24] w-6">2</th>
                <th className="border border-black p-1 text-[#ed1c24] w-6">1</th>
                <th className="border border-black p-1 text-[#ed1c24] w-6">GJ</th>
                <th className="border border-black p-1 text-[#ed1c24] w-6">CR</th>
                <th className="border border-black p-1 text-[#ed1c24] w-6">J1</th>
                <th className="border border-black p-1 text-[#ed1c24] w-6">J2</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3].map((round) => (
                <tr key={round} className="h-5">
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                  
                  <td className="border border-black font-bold">R{round}</td>
                  
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

          {/* Video Replay & Match Winner */}
          <table className="w-full border-collapse border border-black mb-2 text-xs text-center">
            <thead>
              <tr>
                <th className="border border-black p-1 bg-[#00a2e8] text-black font-bold text-left px-2">Reason</th>
                <th colSpan={3} className="border border-black p-1 bg-[#00a2e8] text-black font-bold">Chung Video Replay</th>
                <th colSpan={2} className="border border-black p-1 font-bold">Match Winner</th>
                <th className="border border-black p-1 bg-[#ed1c24] text-black font-bold text-left px-2">Reason</th>
                <th colSpan={3} className="border border-black p-1 bg-[#ed1c24] text-black font-bold">Hong Video Replay</th>
              </tr>
            </thead>
            <tbody>
              {[
                "2 Points \"Technical\"",
                "Head Requested",
                "Gam-jeum & Point",
                "Technical Issue",
                "Requested by CR",
                "Rejected by CR"
              ].map((reason, idx) => (
                <tr key={idx}>
                  <td className="border border-black p-1 font-bold text-left px-2">{reason}</td>
                  <td className="border border-black p-1 w-8">A/R</td>
                  <td className="border border-black p-1 w-8">A/R</td>
                  <td className="border border-black p-1 w-8">A/R</td>
                  
                  {idx === 0 && (
                    <>
                      <td rowSpan={3} className="border border-black p-1 text-[#00a2e8] font-bold text-lg w-20">CHUNG</td>
                      <td rowSpan={3} className="border border-black p-1 text-[#ed1c24] font-bold text-lg w-20">HONG</td>
                    </>
                  )}
                  {idx === 3 && (
                    <td colSpan={2} className="border border-black p-1 font-bold">Round Won</td>
                  )}
                  {idx > 3 && (
                    <td colSpan={2} className="border border-black p-1"></td>
                  )}
                  
                  <td className="border border-black p-1 font-bold text-left px-2">{reason}</td>
                  <td className="border border-black p-1 w-8">A/R</td>
                  <td className="border border-black p-1 w-8">A/R</td>
                  <td className="border border-black p-1 w-8">A/R</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Win Types */}
          <table className="w-full border-collapse border border-black mb-2 text-sm text-center font-bold">
            <tbody>
              <tr>
                <td className="border border-black p-2 w-1/5">PTF</td>
                <td className="border border-black p-2 w-1/5">RSC</td>
                <td className="border border-black p-2 w-1/5">WDR</td>
                <td className="border border-black p-2 w-1/5">DSQ</td>
                <td className="border border-black p-2 w-1/5">DQB</td>
              </tr>
            </tbody>
          </table>

          {/* Yellow Cards */}
          <div className="flex gap-4 mb-2">
            <table className="w-1/2 border-collapse border border-black text-sm">
              <thead>
                <tr>
                  <th className="border border-black p-1 text-left px-2 w-1/3">Yellow Card</th>
                  <th className="border border-black p-1 text-left px-2 w-1/3">Result</th>
                  <th className="border border-black p-1 text-left px-2 w-1/3">Time</th>
                </tr>
              </thead>
              <tbody>
                <tr className="h-5">
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                </tr>
              </tbody>
            </table>
            <table className="w-1/2 border-collapse border border-black text-sm">
              <thead>
                <tr>
                  <th className="border border-black p-1 text-left px-2 w-1/3">Yellow Card</th>
                  <th className="border border-black p-1 text-left px-2 w-1/3">Result</th>
                  <th className="border border-black p-1 text-left px-2 w-1/3">Time</th>
                </tr>
              </thead>
              <tbody>
                <tr className="h-5">
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                  <td className="border border-black"></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Officials */}
          <table className="w-full border-collapse border border-black mb-4 text-sm">
            <tbody>
              <tr className="h-5">
                <td className="border border-black p-1 font-bold px-2 w-1/4">Judge 2</td>
                <td className="border border-black p-1 font-bold px-2 w-1/4">Judge 1</td>
                <td className="border border-black p-1 font-bold px-2 w-1/4">Referee</td>
                <td className="border border-black p-1 font-bold px-2 w-1/4">Review Jury</td>
              </tr>
              <tr className="h-5">
                <td className="border border-black p-1 font-bold px-2">NOC</td>
                <td className="border border-black p-1 font-bold px-2">NOC</td>
                <td className="border border-black p-1 font-bold px-2">NOC</td>
                <td className="border border-black p-1 font-bold px-2">NOC</td>
              </tr>
            </tbody>
          </table>

          {/* Signature */}
          <div className="flex justify-end mt-6 mb-0">
            <div className="w-64 border-t border-black pt-1 text-center font-bold text-sm">
              Signature :
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
