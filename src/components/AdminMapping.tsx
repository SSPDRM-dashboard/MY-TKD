import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, where, setDoc, serverTimestamp } from 'firebase/firestore';
import { BoutMapping, EventData } from '../types';
import { Trash2, Plus, Save, Hash, ArrowRight, User, Shield, RefreshCw, Trophy } from 'lucide-react';
import { cn, normalizeBoutNumber } from '../lib/utils';
import Papa from 'papaparse';

interface AdminMappingProps {
  currentEventId: string | null;
  currentEventName: string;
  categories: string[];
  events: EventData[];
}

export function AdminMapping({ currentEventId, currentEventName, categories, events }: AdminMappingProps) {
  const [mappings, setMappings] = useState<BoutMapping[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>(currentEventId || '');
  const [sourceBout, setSourceBout] = useState('');
  const [nextBout, setNextBout] = useState('');
  const [slot, setSlot] = useState<'Chung' | 'Hong'>('Chung');
  const [categoryName, setCategoryName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncingResults, setIsSyncingResults] = useState(false);
  const [isSyncingCategories, setIsSyncingCategories] = useState(false);
  const [fetchedCategories, setFetchedCategories] = useState<string[]>([]);

  const RESULTS_SHEET_URL = "https://docs.google.com/spreadsheets/d/14TrlxR_rk9S7WmdanXGLlE4Y-ry9TqY6_B6HYA0Uuus/export?format=csv";
  const CATEGORIES_SHEET_URL = "https://docs.google.com/spreadsheets/d/1QCGhccGDJboxBLswoJqe82X3dxa9ZZC0aDo4Y3CZF8o/export?format=csv&gid=0";

  useEffect(() => {
    if (currentEventId) {
      setSelectedEventId(currentEventId);
    }
  }, [currentEventId]);

  const syncCategoriesFromSheet = async () => {
    setIsSyncingCategories(true);
    try {
      const response = await fetch(CATEGORIES_SHEET_URL);
      const csvText = await response.text();
      
      Papa.parse(csvText, {
        complete: (result) => {
          const rows = result.data as string[][];
          // Column D is index 3
          const cats = new Set<string>();
          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (row.length >= 4) {
              const cat = row[3]?.trim();
              if (cat && cat !== 'Category' && cat !== '-') {
                cats.add(cat);
              }
            }
          }
          setFetchedCategories(Array.from(cats).sort());
        },
        skipEmptyLines: true
      });
    } catch (error) {
      console.error("Error syncing categories from sheet:", error);
    } finally {
      setIsSyncingCategories(false);
    }
  };

  const syncResultsFromSheet = async () => {
    if (!selectedEventId) return;
    setIsSyncingResults(true);
    try {
      const response = await fetch(RESULTS_SHEET_URL);
      const csvText = await response.text();
      
      Papa.parse(csvText, {
        complete: async (result) => {
          const rows = result.data as string[][];
          // Column J (index 9) is winner result
          // Column C (index 2) is Match No
          // Column D (index 3) is Category
          
          const newHistory: any[] = [];
          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (row.length >= 10) {
              const matchNo = row[2]?.trim();
              const category = row[3]?.trim();
              const winner = row[9]?.trim(); // Column J

              if (matchNo && category && winner && winner !== '-' && winner !== '') {
                const normalizedMatchNo = normalizeBoutNumber(matchNo);
                console.log(`Processing sheet row: Bout ${matchNo} (Normalized: ${normalizedMatchNo}), Category ${category}, Winner ${winner}`);
                const historyId = `${selectedEventId}_${normalizedMatchNo}`;
                const historyItem = {
                  bout: normalizedMatchNo,
                  category: category,
                  winner: winner,
                  eventId: selectedEventId,
                  syncedAt: serverTimestamp()
                };
                
                await setDoc(doc(db, 'matchHistory', historyId), historyItem);
                newHistory.push({ id: historyId, ...historyItem });
              }
            }
          }

          if (newHistory.length > 0) {
            console.log("Found results in sheet:", newHistory);
            alert(`Synced ${newHistory.length} winners from sheet.`);
            window.dispatchEvent(new CustomEvent('tkd_sync_history', { detail: newHistory }));
          } else {
            alert("No winners found in sheet.");
          }
        },
        skipEmptyLines: true
      });
    } catch (error) {
      console.error("Error syncing results from sheet:", error);
    } finally {
      setIsSyncingResults(false);
    }
  };

  useEffect(() => {
    if (!selectedEventId) return;
    syncCategoriesFromSheet();

    const q = query(collection(db, 'event_logic'), where('eventId', '==', selectedEventId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BoutMapping));
      setMappings(data);
    });

    return () => unsubscribe();
  }, [selectedEventId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId || !sourceBout || !nextBout || !categoryName) return;

    const event = events.find(ev => ev.id === selectedEventId);
    if (!event) return;

    setIsSaving(true);
    try {
      await addDoc(collection(db, 'event_logic'), {
        eventId: selectedEventId,
        eventName: event.name,
        categoryName,
        sourceBout: normalizeBoutNumber(sourceBout),
        nextBout: normalizeBoutNumber(nextBout),
        slot
      });
      setSourceBout('');
      setNextBout('');
    } catch (error) {
      console.error("Error saving mapping:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'event_logic', id));
    } catch (error) {
      console.error("Error deleting mapping:", error);
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <Shield size={24} className="text-red-600" />
          Bracket Mapping Logic
        </h3>
        
        <div className="flex justify-end gap-2">
          <button 
            onClick={syncCategoriesFromSheet}
            disabled={isSyncingCategories}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors text-xs uppercase tracking-widest disabled:opacity-50"
          >
            <RefreshCw size={14} className={cn(isSyncingCategories && "animate-spin")} />
            {isSyncingCategories ? 'Syncing Categories...' : 'Sync Categories'}
          </button>
          <button 
            onClick={syncResultsFromSheet}
            disabled={isSyncingResults}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors text-xs uppercase tracking-widest disabled:opacity-50"
          >
            <RefreshCw size={14} className={cn(isSyncingResults && "animate-spin")} />
            {isSyncingResults ? 'Syncing Results...' : 'Sync Results from Google Sheet'}
          </button>
        </div>
        
        <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Select Event</label>
            <div className="relative">
              <Trophy className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <select 
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-red-500"
                required
              >
                <option value="" disabled>Select Event</option>
                {events.map(ev => (
                  <option key={ev.id} value={ev.id}>{ev.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Category Name</label>
            <select 
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-red-500"
              required
            >
              <option value="">Select Category</option>
              {(fetchedCategories.length > 0 ? fetchedCategories : categories).map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Source Bout #</label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                value={sourceBout}
                onChange={(e) => setSourceBout(e.target.value)}
                placeholder="e.g. 1001"
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-red-500"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Next Bout #</label>
            <div className="relative">
              <ArrowRight className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                value={nextBout}
                onChange={(e) => setNextBout(e.target.value)}
                placeholder="e.g. 1010"
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-red-500"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Target Slot</label>
            <select 
              value={slot}
              onChange={(e) => setSlot(e.target.value as 'Chung' | 'Hong')}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-red-500"
              required
            >
              <option value="Chung">Chung (Blue)</option>
              <option value="Hong">Hong (Red)</option>
            </select>
          </div>

          <button 
            type="submit"
            disabled={isSaving}
            className="h-[42px] bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-100 disabled:opacity-50"
          >
            <Save size={16} />
            {isSaving ? 'Saving...' : 'Save Mapping'}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <h4 className="font-black text-slate-800 uppercase tracking-widest text-xs">Active Advancement Logic</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Event</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Source Bout</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Next Bout</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Slot</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {mappings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-sm italic">
                    No mappings defined for the selected event yet.
                  </td>
                </tr>
              ) : (
                mappings.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">{m.eventName || 'Unknown'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold text-slate-700">{m.categoryName}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-slate-100 rounded flex items-center justify-center text-[10px] font-black text-slate-500">
                          #
                        </div>
                        <span className="text-sm font-black text-slate-900">{m.sourceBout}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <ArrowRight size={14} className="text-slate-300" />
                        <span className="text-sm font-black text-slate-900">{m.nextBout}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "text-[10px] font-black px-2 py-1 rounded uppercase tracking-widest",
                        m.slot === 'Chung' ? "bg-blue-50 text-blue-600" : "bg-red-50 text-red-600"
                      )}>
                        {m.slot}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleDelete(m.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
