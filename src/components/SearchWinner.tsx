import React, { useState } from 'react';
import { Search, Trophy } from 'lucide-react';
import { MatchHistoryItem } from '../types';
import { isBoutMatch } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface SearchWinnerProps {
  matchHistory: MatchHistoryItem[];
  currentEventId: string | null;
}

export function SearchWinner({ matchHistory, currentEventId }: SearchWinnerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [result, setResult] = useState<MatchHistoryItem | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !currentEventId) return;

    const query = searchQuery.trim();
    // Look through match history for the current event
    const found = matchHistory.find(h => 
      h.eventId === currentEventId && isBoutMatch(h.bout, query)
    );

    setResult(found || null);
    setHasSearched(true);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
          <Search size={24} className="text-slate-400" />
          Search Winner
        </h2>

        <form onSubmit={handleSearch} className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20} />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Enter Match No (e.g. A1, 23)"
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-lg font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
            />
          </div>
          <button 
            type="submit"
            className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-2"
          >
            Search
          </button>
        </form>
      </div>

      <AnimatePresence mode="wait">
        {hasSearched && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center"
          >
            {result ? (
              <div className="space-y-6">
                <div>
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-1">Match No</p>
                  <p className="text-2xl font-black text-slate-900">{result.bout}</p>
                </div>
                {result.category && (
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Category</p>
                    <p className="text-sm font-bold text-slate-700">{result.category}</p>
                  </div>
                )}
                <div className="pt-6 border-t border-slate-100 flex flex-col items-center">
                  <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4 text-yellow-600">
                    <Trophy size={32} />
                  </div>
                  <p className="text-[10px] font-black text-yellow-600 uppercase tracking-widest mb-1">Winner</p>
                  <p className="text-3xl font-black text-slate-900 mb-2 uppercase">{result.winner}</p>
                  <p className="text-lg font-bold text-yellow-200 uppercase">{result.winnerClub || 'UNKNOWN CLUB'}</p>
                </div>
              </div>
            ) : (
              <div className="py-12">
                <p className="text-lg font-bold text-slate-500 mb-2">No Winner Found</p>
                <p className="text-sm text-slate-400">We couldn't find a recorded winner for Match "{searchQuery}" in the current event.</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
