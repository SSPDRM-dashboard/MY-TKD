import React, { useState, useEffect, useMemo } from 'react';
import { EventData, MatchHistoryItem } from '../types';
import { Download, RefreshCw, Trophy, Medal, Building2, Search } from 'lucide-react';
import Papa from 'papaparse';
import { getBoutNumber, cn } from '../lib/utils';

interface EventReportProps {
  currentEventId: string | null;
  events: EventData[];
}

interface RawMatch {
  event: string;
  category: string;
  matchNoStr: string;
  matchNo: number;
  blueName: string;
  blueClub: string;
  redName: string;
  redClub: string;
  winner: string;
}

interface WinnerResult {
  place: '1st' | '2nd' | '3rd';
  name: string;
  club: string;
}

interface CategoryResult {
  category: string;
  gold: WinnerResult | null;
  silver: WinnerResult | null;
  bronzes: WinnerResult[];
}

export function EventReport({ currentEventId, events }: EventReportProps) {
  const [activeTab, setActiveTab] = useState<'winners' | 'summary'>('winners');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<RawMatch[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Feature: Option to combine multiple events
  const [includeAllEvents, setIncludeAllEvents] = useState(false);

  const fetchMatches = async () => {
    // If we're getting all events, filter valid ones. Otherwise strictly current event.
    const targetEvents = includeAllEvents 
      ? events.filter(e => e.sheetUrl && e.sheetUrl.includes('docs.google.com/spreadsheets'))
      : events.filter(e => e.id === currentEventId && e.sheetUrl && e.sheetUrl.includes('docs.google.com/spreadsheets'));

    if (targetEvents.length === 0) {
      if (!currentEventId) return; // Silent if just no event selected
      setError("No valid Google Sheet URLs found for the selected event(s).");
      setMatches([]);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    try {
      let combinedMatches: RawMatch[] = [];

      for (const event of targetEvents) {
        let activeUrl = event.sheetUrl;
        if (!activeUrl.includes('/export?')) {
          activeUrl = activeUrl.replace(/\/edit.*$/, '') + '/export?format=csv';
        }

        const response = await fetch(activeUrl);
        if (!response.ok) {
           console.warn(`Failed to fetch data for event: ${event.name}`);
           continue; // Skip if one fails, to at least get the others
        }
        const csvText = await response.text();
        
        await new Promise<void>((resolve) => {
          Papa.parse(csvText, {
            complete: (result) => {
              const rows = result.data as string[][];
              if (rows.length < 2) {
                resolve();
                return;
              }
              
              for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (row.length >= 10 && row[2] && row[3]) { 
                  const sheetEventName = row[1] || '';
                  if (sheetEventName.trim().toLowerCase() !== event.name.trim().toLowerCase()) {
                     continue; 
                  }

                  const matchNoStr = row[3] || '';
                  const winner = row[9] || '';
                  const category = row[4] || '';
                  const blueName = row[5] || '';
                  const blueClub = row[6] || '';
                  const redName = row[7] || '';
                  const redClub = row[8] || '';

                  combinedMatches.push({
                    event: sheetEventName,
                    category,
                    matchNoStr,
                    matchNo: getBoutNumber(matchNoStr),
                    blueName: blueName.trim(),
                    blueClub: blueClub.trim(),
                    redName: redName.trim(),
                    redClub: redClub.trim(),
                    winner: winner.trim()
                  });
                }
              }
              resolve();
            },
            error: (err) => {
              console.warn(`Parse error on event ${event.name}: ${err.message}`);
              resolve();
            },
            skipEmptyLines: true
          });
        });
      }

      setMatches(combinedMatches);
      
      if (combinedMatches.length === 0) {
          setError("No matches parsed successfully. Please check the sheet structures.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches();
  }, [currentEventId, includeAllEvents]);

  const categoryResults = useMemo(() => {
    const categories = Array.from(new Set(matches.map(m => m.category))).filter(Boolean);
    const results: CategoryResult[] = [];

    categories.forEach(cat => {
      // Find all matches for this category
      const catMatches = matches.filter(m => m.category === cat);
      if (catMatches.length === 0) return;

      // Sort by match number descending to find the final
      catMatches.sort((a, b) => b.matchNo - a.matchNo);
      
      const finalMatch = catMatches[0];
      if (!finalMatch || !finalMatch.winner || finalMatch.winner === '-') {
        // Final not completed yet
        results.push({ category: cat, gold: null, silver: null, bronzes: [] });
        return;
      }

      // Determine Gold and Silver
      const goldName = finalMatch.winner;
      let goldClub = '';
      let silverName = '';
      let silverClub = '';

      if (goldName.toLowerCase() === finalMatch.blueName.toLowerCase()) {
        goldClub = finalMatch.blueClub;
        silverName = finalMatch.redName;
        silverClub = finalMatch.redClub;
      } else if (goldName.toLowerCase() === finalMatch.redName.toLowerCase()) {
        goldClub = finalMatch.redClub;
        silverName = finalMatch.blueName;
        silverClub = finalMatch.blueClub;
      } else {
        // Fallback fuzzy match
        if (finalMatch.blueName.toLowerCase().includes(goldName.toLowerCase())) {
          goldClub = finalMatch.blueClub;
          silverName = finalMatch.redName;
          silverClub = finalMatch.redClub;
        } else {
          goldClub = finalMatch.redClub;
          silverName = finalMatch.blueName;
          silverClub = finalMatch.blueClub;
        }
      }

      // Determine Bronzes
      // Bronze 1: Loser to Gold in Gold's previous match
      // Bronze 2: Loser to Silver in Silver's previous match
      const bronzes: WinnerResult[] = [];

      // Find Gold's previous match
      const goldPrevMatch = catMatches.find(m => 
        m.matchNo < finalMatch.matchNo &&
        (m.blueName.toLowerCase() === goldName.toLowerCase() || m.redName.toLowerCase() === goldName.toLowerCase())
      );

      if (goldPrevMatch) {
         let loserName = '';
         let loserClub = '';
         if (goldPrevMatch.blueName.toLowerCase() === goldName.toLowerCase()) {
           loserName = goldPrevMatch.redName;
           loserClub = goldPrevMatch.redClub;
         } else {
           loserName = goldPrevMatch.blueName;
           loserClub = goldPrevMatch.blueClub;
         }
         // Ensure it wasn't a bye
         if (loserName && loserName.toLowerCase() !== 'bye') {
           bronzes.push({ place: '3rd', name: loserName, club: loserClub });
         }
      }

      // Find Silver's previous match
      // Note: Silver lost the final, but we need the match they *won* to get to the final.
      const silverPrevMatch = catMatches.find(m => 
        m.matchNo < finalMatch.matchNo &&
        (m.blueName.toLowerCase() === silverName.toLowerCase() || m.redName.toLowerCase() === silverName.toLowerCase())
      );

      if (silverPrevMatch) {
         let loserName = '';
         let loserClub = '';
         if (silverPrevMatch.blueName.toLowerCase() === silverName.toLowerCase()) {
           loserName = silverPrevMatch.redName;
           loserClub = silverPrevMatch.redClub;
         } else {
           loserName = silverPrevMatch.blueName;
           loserClub = silverPrevMatch.blueClub;
         }
         if (loserName && loserName.toLowerCase() !== 'bye') {
           bronzes.push({ place: '3rd', name: loserName, club: loserClub });
         }
      }

      results.push({
        category: cat,
        gold: { place: '1st', name: goldName, club: goldClub },
        silver: { place: '2nd', name: silverName, club: silverClub },
        bronzes
      });
    });

    // Sort categories alphabetically
    return results.sort((a, b) => a.category.localeCompare(b.category));
  }, [matches]);

  const clubStandings = useMemo(() => {
    const pointsTracker: Record<string, { gold: number, silver: number, bronze: number, points: number }> = {};

    categoryResults.forEach(res => {
      if (res.gold?.club) {
        if (!pointsTracker[res.gold.club]) pointsTracker[res.gold.club] = { gold: 0, silver: 0, bronze: 0, points: 0 };
        pointsTracker[res.gold.club].gold += 1;
        pointsTracker[res.gold.club].points += 7;
      }
      if (res.silver?.club) {
        if (!pointsTracker[res.silver.club]) pointsTracker[res.silver.club] = { gold: 0, silver: 0, bronze: 0, points: 0 };
        pointsTracker[res.silver.club].silver += 1;
        pointsTracker[res.silver.club].points += 3;
      }
      res.bronzes.forEach(b => {
        if (b.club) {
            if (!pointsTracker[b.club]) pointsTracker[b.club] = { gold: 0, silver: 0, bronze: 0, points: 0 };
            pointsTracker[b.club].bronze += 1;
            pointsTracker[b.club].points += 1;
        }
      });
    });

    const standingsArr = Object.keys(pointsTracker).map(club => ({
      club,
      ...pointsTracker[club]
    }));

    // Sort by Total Points -> Most Golds -> Most Silvers -> Most Bronzes
    standingsArr.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.gold !== a.gold) return b.gold - a.gold;
      if (b.silver !== a.silver) return b.silver - a.silver;
      return b.bronze - a.bronze;
    });

    return standingsArr;
  }, [categoryResults]);

  const filteredCategories = categoryResults.filter(c => c.category.toLowerCase().includes(searchQuery.toLowerCase()));

  if (!currentEventId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500">
        <Trophy size={48} className="text-slate-300 mb-4" />
        <h2 className="text-xl font-bold">No Event Selected</h2>
        <p>Please select an event from the top right to view reports.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Trophy className="text-blue-600" />
            Tournament Report
          </h1>
          <p className="text-slate-500 mt-1 flex items-center gap-2">
            {!includeAllEvents ? (
              events.find(e => e.id === currentEventId)?.name || 'Unknown Event'
            ) : (
              `Aggregating across ${events.filter(e => e.sheetUrl?.includes('docs.google.com/spreadsheets')).length} events`
            )}
          </p>
        </div>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer text-slate-600 font-medium bg-slate-50 px-4 py-2 rounded-xl hover:bg-slate-100 transition-colors">
            <input 
              type="checkbox" 
              checked={includeAllEvents}
              onChange={(e) => setIncludeAllEvents(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Merge Multiple Days / Events
          </label>
          <button 
            onClick={fetchMatches}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold rounded-xl flex items-center gap-2 transition-all"
          >
            <RefreshCw size={18} className={cn(isLoading && "animate-spin")} />
            {isLoading ? "Analyzing Data..." : "Refresh Report API"}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200 font-medium">
          {error}
        </div>
      )}

      {/* TABS */}
      <div className="flex gap-4 border-b border-slate-200 pb-px">
        <button
          onClick={() => setActiveTab('winners')}
          className={cn(
            "px-6 py-3 font-bold text-sm tracking-wide rounded-t-xl transition-all relative",
            activeTab === 'winners' 
              ? "text-blue-700 bg-white border border-b-0 border-slate-200" 
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
          )}
        >
          Top 4 Winners (Categories)
          {activeTab === 'winners' && <div className="absolute -bottom-px left-0 right-0 h-px bg-white" />}
        </button>
        <button
          onClick={() => setActiveTab('summary')}
          className={cn(
            "px-6 py-3 font-bold text-sm tracking-wide rounded-t-xl transition-all relative",
            activeTab === 'summary' 
              ? "text-blue-700 bg-white border border-b-0 border-slate-200" 
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
          )}
        >
          Overall Standings (WT Calc)
          {activeTab === 'summary' && <div className="absolute -bottom-px left-0 right-0 h-px bg-white" />}
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {activeTab === 'winners' && (
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-slate-800">Category Placings</h2>
              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search Category..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none w-64"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="p-4 font-bold text-slate-600 text-sm">Category</th>
                    <th className="p-4 font-bold text-slate-600 text-sm"><div className="flex items-center gap-1"><Medal size={16} className="text-yellow-500"/> 1st Place (Gold)</div></th>
                    <th className="p-4 font-bold text-slate-600 text-sm"><div className="flex items-center gap-1"><Medal size={16} className="text-slate-400"/> 2nd Place (Silver)</div></th>
                    <th className="p-4 font-bold text-slate-600 text-sm"><div className="flex items-center gap-1"><Medal size={16} className="text-amber-700"/> 3rd Place (Bronzes)</div></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCategories.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-500">
                        {isLoading ? "Scanning bracket history..." : "No categories processed yet. Are bouts completed on the synced sheet?"}
                      </td>
                    </tr>
                  ) : filteredCategories.map((c, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 font-bold text-slate-800">{c.category}</td>
                      <td className="p-4">
                        {c.gold ? (
                          <div>
                            <div className="font-bold text-slate-900">{c.gold.name}</div>
                            <div className="text-xs text-slate-500 font-medium">{c.gold.club}</div>
                          </div>
                        ) : <span className="text-slate-400 text-sm italic">Pending Finish</span>}
                      </td>
                      <td className="p-4">
                        {c.silver ? (
                          <div>
                            <div className="font-bold text-slate-700">{c.silver.name}</div>
                            <div className="text-xs text-slate-500 font-medium">{c.silver.club}</div>
                          </div>
                        ) : <span className="text-slate-400">-</span>}
                      </td>
                      <td className="p-4">
                        {c.bronzes.length > 0 ? (
                          <div className="flex flex-col gap-2">
                            {c.bronzes.map((b, bi) => (
                              <div key={bi} className="bg-amber-50 px-2 py-1 rounded border border-amber-100 inline-block w-max">
                                <div className="font-bold text-slate-800 text-sm flex gap-2"><span>{b.name}</span><span className="text-amber-700/60 font-black">#3</span></div>
                                <div className="text-xs text-slate-600 font-medium">{b.club}</div>
                              </div>
                            ))}
                          </div>
                        ) : <span className="text-slate-400">-</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'summary' && (
          <div className="p-6 flex flex-col items-center">
            <h2 className="text-lg font-bold text-slate-800 mb-6 w-full max-w-4xl">World Taekwondo Team Standings Classification</h2>
            
            <div className="w-full max-w-4xl border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white">
                    <th className="p-4 font-black tracking-widest text-sm uppercase">Rank</th>
                    <th className="p-4 font-black tracking-widest text-sm uppercase">Club / State</th>
                    <th className="p-4 font-black tracking-widest text-sm uppercase text-center text-yellow-400">Gold</th>
                    <th className="p-4 font-black tracking-widest text-sm uppercase text-center text-slate-300">Silver</th>
                    <th className="p-4 font-black tracking-widest text-sm uppercase text-center text-amber-600">Bronze</th>
                    <th className="p-4 font-black tracking-widest text-sm uppercase text-center bg-blue-600">Total Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {clubStandings.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500">
                         {isLoading ? "Calculating team scores..." : "No club data parsed yet."}
                      </td>
                    </tr>
                  ) : clubStandings.map((c, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="p-4">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center font-black text-sm",
                          i === 0 ? "bg-yellow-400 text-yellow-900" :
                          i === 1 ? "bg-slate-300 text-slate-800" :
                          i === 2 ? "bg-amber-600 text-white" : "bg-slate-100 text-slate-600"
                        )}>
                          {i + 1}
                        </div>
                      </td>
                      <td className="p-4 font-bold text-slate-800 text-lg flex items-center gap-3">
                        <Building2 size={20} className="text-slate-400" />
                        {c.club || 'Unknown Club'}
                      </td>
                      <td className="p-4 font-black text-center text-lg">{c.gold}</td>
                      <td className="p-4 font-black text-center text-lg">{c.silver}</td>
                      <td className="p-4 font-black text-center text-lg">{c.bronze}</td>
                      <td className="p-4 font-black text-center text-xl text-blue-700 bg-blue-50/50">{c.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-8 text-sm text-slate-400 bg-slate-50 p-4 rounded-xl border border-slate-100 max-w-4xl">
              <strong>WT Calculation Rules Applied:</strong> Teams are ranked by Total Points (Gold: 7, Silver: 3, Bronze: 1). If there is a tie in points, the team with the most Gold medals wins, followed by Silver, then Bronze.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
