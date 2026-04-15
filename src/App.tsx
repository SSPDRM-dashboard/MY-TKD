import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  Users, 
  LayoutDashboard, 
  Settings, 
  Bell, 
  Shield, 
  ShieldOff, 
  Plus, 
  ChevronLeft,
  ChevronRight,
  Search,
  CheckCircle2,
  Check,
  AlertCircle,
  QrCode,
  CreditCard,
  Trash2,
  LogIn,
  LogOut,
  UserPlus,
  Key,
  User as UserIcon,
  Lock,
  Edit2,
  Calendar,
  AlertTriangle,
  Monitor,
  Maximize,
  Minimize,
  RefreshCw,
  X,
  Database,
  Download,
  ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MatchData, RingStatus, EventData, BoutMapping, MatchHistoryItem } from './types';
import { TASheet } from './components/TASheet';
import { AdminMapping } from './components/AdminMapping';
import { AIBracketSetup } from './components/AIBracketSetup';
import { TournamentAssistant } from './components/TournamentAssistant';
import { syncToGoogleSheets, updateWinnerInGoogleSheets, updateTransferInGoogleSheets, updateBoutDetailsInGoogleSheets, testSync } from './services/googleSheets';
import { cn, normalizeBoutNumber, getBoutNumber, formatBoutNumber } from './lib/utils';
import { collection, addDoc, onSnapshot, query, orderBy, limit, serverTimestamp, doc, setDoc, getDoc, getDocFromServer, where } from 'firebase/firestore';
import { db } from './firebase';
import Papa from 'papaparse';

function sanitizeForFirestore(obj: any): any {
  if (obj === undefined) return null;
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeForFirestore);
  
  const sanitized: any = {};
  for (const key in obj) {
    if (obj[key] !== undefined) {
      sanitized[key] = sanitizeForFirestore(obj[key]);
    }
  }
  return sanitized;
}

function useSyncedState<T>(key: string, initialValue: T) {
  const [state, setState] = useState<T>(() => {
    const saved = localStorage.getItem(key);
    if (saved !== null) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // Fallback for legacy raw string values
        return saved as unknown as T;
      }
    }
    return initialValue;
  });

  useEffect(() => {
    // Initial sync from Firestore
    getDocFromServer(doc(db, 'sync', key)).then(document => {
      if (document.exists()) {
        setState(document.data().value);
        localStorage.setItem(key, JSON.stringify(document.data().value));
      } else {
        // If it doesn't exist in Firestore but we have local state, upload it
        const saved = localStorage.getItem(key);
        if (saved !== null) {
          try {
            const parsed = JSON.parse(saved);
            setDoc(doc(db, 'sync', key), { value: sanitizeForFirestore(parsed) });
          } catch (e) {
            setDoc(doc(db, 'sync', key), { value: sanitizeForFirestore(saved) });
          }
        } else {
          setDoc(doc(db, 'sync', key), { value: sanitizeForFirestore(initialValue) });
        }
      }
    }).catch(error => {
      if (error instanceof Error && error.message.includes('the client is offline')) {
        console.error("Firestore Configuration Error: The client is offline. Please check your Firebase project settings.");
      }
      // Fallback to local storage if Firestore is unavailable
      const saved = localStorage.getItem(key);
      if (saved !== null) {
        try {
          setState(JSON.parse(saved));
        } catch (e) {
          setState(saved as unknown as T);
        }
      }
    });

    const unsub = onSnapshot(doc(db, 'sync', key), (document) => {
      if (document.exists()) {
        setState(document.data().value);
        localStorage.setItem(key, JSON.stringify(document.data().value));
      }
    }, (error) => {
      console.error(`Firestore Sync Error (${key}):`, error);
    });
    return unsub;
  }, [key]);

  const setSyncedState = React.useCallback((updater: T | ((prev: T) => T)) => {
    setState(prev => {
      const newValue = typeof updater === 'function' ? (updater as any)(prev) : updater;
      localStorage.setItem(key, JSON.stringify(newValue));
      setDoc(doc(db, 'sync', key), { value: sanitizeForFirestore(newValue) });
      return newValue;
    });
  }, [key]);

  return [state, setSyncedState] as const;
}

// Mock Initial Data
const INITIAL_RINGS: RingStatus[] = Array.from({ length: 12 }, (_, i) => ({
  ringNumber: i + 1,
  currentBout: null,
  onDeck: null,
  inTheHole: null
}));

interface UserAccount {
  username: string;
  password: string;
  role: 'admin' | 'user' | 'viewer' | 'ta';
  assignedRing?: number;
}

function AnnouncementPopup({ announcement, onClose, size = 'normal' }: { announcement: { message: string, id: string } | null, onClose: () => void, size?: 'normal' | 'large' }) {
  const isLarge = size === 'large';
  return (
    <AnimatePresence>
      {announcement && (
        <motion.div
          initial={{ opacity: 0, x: "-50%", y: "-40%", scale: 0.9 }}
          animate={{ opacity: 1, x: "-50%", y: "-50%", scale: 1 }}
          exit={{ opacity: 0, x: "-50%", y: "-40%", scale: 0.9 }}
          className={cn(
            "fixed top-1/2 left-1/2 z-[100] w-full px-4",
            isLarge ? "max-w-6xl" : "max-w-2xl"
          )}
        >
          <div className="bg-slate-900 border-4 border-red-600 rounded-[2rem] shadow-[0_20px_50px_rgba(220,38,38,0.3)] overflow-hidden">
            <div className={cn("bg-red-600 flex items-center justify-between", isLarge ? "px-10 py-5" : "px-8 py-3")}>
              <div className="flex items-center gap-3">
                <Bell size={isLarge ? 32 : 20} className="text-white animate-bounce" />
                <span className={cn("font-black text-white uppercase tracking-[0.2em]", isLarge ? "text-xl" : "text-sm")}>Official Announcement</span>
              </div>
              <button 
                onClick={onClose}
                className="p-1 hover:bg-white/20 rounded-lg text-white transition-colors"
              >
                <X size={isLarge ? 32 : 20} />
              </button>
            </div>
            <div className={cn("text-center", isLarge ? "p-16" : "p-8")}>
              <p className={cn("font-black text-white leading-tight tracking-tight", isLarge ? "text-5xl" : "text-2xl")}>
                {announcement.message}
              </p>
              <div className={cn("flex items-center justify-center gap-2", isLarge ? "mt-10" : "mt-6")}>
                <div className={cn("bg-red-600/30 rounded-full overflow-hidden", isLarge ? "h-2 w-24" : "h-1 w-12")}>
                  <motion.div 
                    initial={{ width: "100%" }}
                    animate={{ width: "0%" }}
                    transition={{ duration: 60, ease: "linear" }}
                    className="h-full bg-red-600"
                  />
                </div>
                <span className={cn("font-bold text-slate-500 uppercase tracking-widest", isLarge ? "text-sm" : "text-[10px]")}>Closing in 1m</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

import { EditBoutDetailsModal } from './components/EditBoutDetailsModal';

export default function App() {
  const [events, setEvents] = useSyncedState<EventData[]>('tkd_events', []);
  const [currentEventId, setCurrentEventId] = useSyncedState<string | null>('tkd_current_event', null);

  const [user, setUser] = useState<UserAccount | null>(() => {
    const saved = localStorage.getItem('tkd_user');
    const loginTime = localStorage.getItem('tkd_login_time');
    
    if (saved && loginTime) {
      const now = new Date().getTime();
      const loginTs = parseInt(loginTime);
      const eighteenHours = 18 * 60 * 60 * 1000;
      
      if (now - loginTs > eighteenHours) {
        localStorage.removeItem('tkd_user');
        localStorage.removeItem('tkd_login_time');
        return null;
      }
      return JSON.parse(saved);
    }
    return null;
  });
  const [accounts, setAccounts] = useSyncedState<UserAccount[]>('tkd_accounts', (() => {
    let parsed: UserAccount[] = [
      { username: 'admin', password: 'lee093', role: 'admin' }
    ];
    for (let i = 1; i <= 12; i++) {
      parsed.push({
        username: `ring${i}`,
        password: '123',
        role: 'user',
        assignedRing: i
      });
    }
    parsed.push({ username: 'viewer', password: '123', role: 'viewer' });
    parsed.push({ username: 'TA', password: '123', role: 'ta' });
    return parsed;
  })());

  const [rings, setRings] = useSyncedState<RingStatus[]>('tkd_rings', INITIAL_RINGS);
  const [autoPullRings, setAutoPullRings] = useSyncedState<Record<number, boolean>>('tkd_autopull', {});
  const [boutQueue, setBoutQueue] = useSyncedState<{id: string, data: MatchData}[]>('tkd_bout_queue', []);
  const [matchHistory, setMatchHistory] = useSyncedState<MatchHistoryItem[]>('tkd_match_history', []);
  const [sharedSelectedRing, setSharedSelectedRing] = useSyncedState<string>('tkd_shared_ring', '');
  const [sharedSelectedMatchNo, setSharedSelectedMatchNo] = useSyncedState<string>('tkd_shared_match', '');
  const [mappings, setMappings] = useState<BoutMapping[]>([]);
  const [athletes, setAthletes] = useState([
    { name: "Ahmad bin Ibrahim", ic: "080512-14-5567", club: "KST", category: "Junior Male -45kg", status: "Verified" as const },
    { name: "Lim Wei Kang", ic: "091122-08-1234", club: "TKT", category: "Junior Male -45kg", status: "Pending" as const },
    { name: "Siti Nurhaliza", ic: "100101-10-9876", club: "PST", category: "Junior Female -42kg", status: "Verified" as const },
  ]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeAnnouncement, setActiveAnnouncement] = useState<{ message: string, id: string } | null>(null);
  const [showAnnouncementInput, setShowAnnouncementInput] = useState(false);
  const [announcementText, setAnnouncementText] = useState('');
  const [announcementTarget, setAnnouncementTarget] = useState<'all' | 'users'>('all');

  useEffect(() => {
    if (!currentEventId) return;
    const q = query(collection(db, 'event_logic'), where('eventId', '==', currentEventId));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BoutMapping));
      console.log('Mappings updated:', data.length);
      setMappings(data);
    });
    return unsub;
  }, [currentEventId]);

  useEffect(() => {
    if (!currentEventId) return;
    const q = query(collection(db, 'matchHistory'), where('eventId', '==', currentEventId));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      console.log('Match history updated from Firestore:', data.length);
      setMatchHistory(prev => {
        const updated = [...prev];
        data.forEach(item => {
          const index = updated.findIndex(h => h.id === item.id);
          if (index !== -1) {
            updated[index] = item;
          } else {
            updated.push(item);
          }
        });
        return updated;
      });
    });
    return unsub;
  }, [currentEventId, setMatchHistory]);

  useEffect(() => {
    const handleSyncHistory = (e: any) => {
      const newHistory = e.detail;
      setMatchHistory(prev => {
        let updated = [...prev];
        newHistory.forEach((item: any) => {
          const index = updated.findIndex(h => h.id === item.id);
          if (index !== -1) {
            updated[index] = item;
          } else {
            updated.push(item);
          }
        });
        return updated;
      });
    };
    window.addEventListener('tkd_sync_history', handleSyncHistory);
    return () => window.removeEventListener('tkd_sync_history', handleSyncHistory);
  }, [setMatchHistory]);

  // Ensure TA account exists for returning users
  useEffect(() => {
    if (accounts.length > 0 && !accounts.some(a => a.username === 'TA')) {
      setAccounts(prev => [...prev, { username: 'TA', password: '123', role: 'ta' }]);
    }
  }, [accounts, setAccounts]);

  // Auto-logout check interval
  useEffect(() => {
    if (!user) return;

    const checkTimeout = () => {
      const loginTime = localStorage.getItem('tkd_login_time');
      if (loginTime) {
        const now = new Date().getTime();
        const loginTs = parseInt(loginTime);
        const eighteenHours = 18 * 60 * 60 * 1000;
        
        if (now - loginTs > eighteenHours) {
          handleLogout();
        }
      }
    };

    const interval = setInterval(checkTimeout, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    const q = query(collection(db, 'announcements'), orderBy('timestamp', 'desc'), limit(1));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        const id = snapshot.docs[0].id;
        
        const target = data.target || 'all';
        if (target === 'users' && user?.role !== 'user') return;
        
        // Check if it's too old (more than 12 hours)
        if (data.timestamp) {
          const ts = data.timestamp.toDate ? data.timestamp.toDate() : new Date(data.timestamp);
          const now = new Date();
          if (now.getTime() - ts.getTime() > 12 * 60 * 60 * 1000) return;
        }

        const lastSeen = localStorage.getItem('tkd_last_announcement');
        const isDismissed = localStorage.getItem(`tkd_announcement_dismissed_${id}`);
        
        if (lastSeen !== id && !isDismissed) {
          setActiveAnnouncement({ message: data.message, id });
          localStorage.setItem('tkd_last_announcement', id);
          
          const timer = setTimeout(() => {
            setActiveAnnouncement(null);
          }, 60000);
          return () => clearTimeout(timer);
        }
      }
    });
    return () => unsubscribe();
  }, [user?.role]);

  const handleAnnouncementClose = () => {
    if (activeAnnouncement) {
      localStorage.setItem(`tkd_announcement_dismissed_${activeAnnouncement.id}`, 'true');
    }
    setActiveAnnouncement(null);
  };

  const handleSendAnnouncement = async () => {
    if (!announcementText.trim()) return;
    try {
      await addDoc(collection(db, 'announcements'), {
        message: announcementText,
        timestamp: serverTimestamp(),
        author: user?.username || 'Admin',
        target: announcementTarget
      });
      setAnnouncementText('');
      setShowAnnouncementInput(false);
    } catch (error) {
      console.error("Error sending announcement:", error);
    }
  };
  const [activeTab, setActiveTab] = useState<'dashboard' | 'mats' | 'athletes' | 'settings' | 'general' | 'standby' | 'mapping' | 'ai-setup'>(() => {
    const savedUser = localStorage.getItem('tkd_user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        if (parsed.role === 'viewer') return 'general';
        if (parsed.role === 'user') return 'mats';
      } catch (e) {
        // ignore
      }
    }
    return 'dashboard';
  });
  const [isImportingBouts, setIsImportingBouts] = useState(false);
  const [isPublicView, setIsPublicView] = useState(() => {
    // Check environment variable or URL parameter
    const isPublicEnv = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_APP_MODE === 'PUBLIC';
    const isPublicUrl = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('view') === 'public';
    return isPublicEnv || isPublicUrl;
  });
  const [showLogin, setShowLogin] = useState(false);
  const [showNewBoutModal, setShowNewBoutModal] = useState(false);
  const [newBoutInitialRing, setNewBoutInitialRing] = useState<number | undefined>(undefined);
  const [showEditResultModal, setShowEditResultModal] = useState(false);
  const [showEditBoutDetailsModal, setShowEditBoutDetailsModal] = useState(false);
  const [showAddRingModal, setShowAddRingModal] = useState(false);
  const [missingBoutPrompt, setMissingBoutPrompt] = useState<{ ringNumber: number; expectedBout: number; totalBouts: number } | null>(null);
  const [finalBoutCheck, setFinalBoutCheck] = useState<{ ringNumber: number; remainingCount: number } | null>(null);
  const [ringNamingMode, setRingNamingMode] = useState<'number' | 'alphabet'>('number');
  const [categories, setCategories] = useSyncedState<string[]>('tkd_categories', ["Junior Male -45kg", "Junior Female -42kg", "Senior Male -54kg"]);
  const [clubs, setClubs] = useSyncedState<string[]>('tkd_clubs', ["KST", "TKT", "PST", "MTA"]);
  const [googleSheetUrl, setGoogleSheetUrl] = useSyncedState<string>('tkd_sheet_url', '');
  const [isSheetSaved, setIsSheetSaved] = useState(false);

  // Persistence & Cross-tab Sync handled by useSyncedState

  const getRingName = (num: number) => {
    if (ringNamingMode === 'number') return num.toString();
    return String.fromCharCode(64 + num); // 1 -> A, 2 -> B, etc.
  };

  const getCurrentEventName = () => {
    if (!currentEventId) return '-';
    const event = events.find(e => e.id === currentEventId);
    return event ? event.name : '-';
  };

  const getCurrentEventDate = () => {
    if (!currentEventId) return '';
    const event = events.find(e => e.id === currentEventId);
    return event ? event.eventDate : '';
  };

  const formatTime = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getFilteredQueue = (ringNum?: number) => {
    return boutQueue
      .filter(item => {
        const matchesEvent = !item.data.eventId || item.data.eventId === currentEventId;
        const itemRing = Number(item.data.ring);
        const matchesRing = ringNum === undefined || itemRing === Number(ringNum);
        const matchesUserRing = user?.role === 'admin' || itemRing === Number(user?.assignedRing);
        return matchesEvent && matchesRing && matchesUserRing;
      })
      .sort((a, b) => {
        const boutA = parseInt(normalizeBoutNumber(a.data.bout)) || 0;
        const boutB = parseInt(normalizeBoutNumber(b.data.bout)) || 0;
        return boutA - boutB;
      });
  };

  const [lastSyncError, setLastSyncError] = useState<string | null>(null);
  const [syncLog, setSyncLog] = useState<{timestamp: Date, action: string, status: 'success' | 'error', message: string}[]>([]);

  const addToSyncLog = (action: string, status: 'success' | 'error', message: string) => {
    setSyncLog(prev => [{ timestamp: new Date(), action, status, message }, ...prev].slice(0, 50));
  };

  // Sync googleSheetUrl with current event
  useEffect(() => {
    if (currentEventId && events.length > 0) {
      const event = events.find(e => e.id === currentEventId);
      if (event && event.sheetUrl && event.sheetUrl !== googleSheetUrl) {
        console.log("Auto-syncing Google Sheet URL from event:", event.name);
        setGoogleSheetUrl(event.sheetUrl);
      }
    }
  }, [currentEventId, events, googleSheetUrl, setGoogleSheetUrl]);

  const handleNewBoutSubmit = async (ringNumber: number, newData: MatchData) => {
    console.log("Creating new bout:", newData);
    
    // Capitalize all letters
    const capitalizedData: MatchData = {
      ...newData,
      blue_name: newData.blue_name?.toUpperCase() || '',
      blue_club: newData.blue_club?.toUpperCase() || '',
      red_name: newData.red_name?.toUpperCase() || '',
      red_club: newData.red_club?.toUpperCase() || '',
      category: newData.category?.toUpperCase() || '',
      bout: newData.bout?.toString().toUpperCase() || '',
    };

    // Update categories and clubs lists
    if (capitalizedData.category && !categories.includes(capitalizedData.category)) {
      setCategories(prev => [...prev, capitalizedData.category]);
    }
    if (capitalizedData.blue_club && !clubs.includes(capitalizedData.blue_club)) {
      setClubs(prev => [...prev, capitalizedData.blue_club]);
    }
    if (capitalizedData.red_club && !clubs.includes(capitalizedData.red_club)) {
      setClubs(prev => [...prev, capitalizedData.red_club]);
    }

    // Add to queue
    const queueItem = { id: Math.random().toString(36).substr(2, 9), data: { ...capitalizedData, eventId: currentEventId || null } };
    setBoutQueue(prev => [...prev, queueItem]);

    // Note: We removed the direct sync to Google Sheets from here to prevent duplicate entries.
    // The bout will be synced to Google Sheets when it is pulled to a ring via handleBoutUpdate.
    console.log("Bout added to queue. It will sync to Google Sheets when pulled to a ring.");
  };

  const handleImportInitialBouts = async () => {
    if (!user?.assignedRing) {
      alert("No ring assigned to this account.");
      return;
    }

    setIsImportingBouts(true);
    try {
      const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/14TrlxR_rk9S7WmdanXGLlE4Y-ry9TqY6_B6HYA0Uuus/export?format=csv";
      const response = await fetch(SHEET_CSV_URL);
      if (!response.ok) throw new Error("Failed to fetch sheet data.");
      
      const csvText = await response.text();
      const results = Papa.parse<string[]>(csvText, {
        skipEmptyLines: true
      });

      const rows = results.data;
      if (rows.length < 2) {
        alert("Sheet is empty or missing data.");
        return;
      }

      // Skip header row
      const dataRows = rows.slice(1);
      const currentEventName = getCurrentEventName();

      // Filter by event name AND assigned ring
      const ringBouts = dataRows.filter(row => {
        const rowEventName = row[0]?.trim();
        const rowRingNo = parseInt(row[1]);
        return rowEventName === currentEventName && rowRingNo === Number(user.assignedRing);
      });
      
      if (ringBouts.length === 0) {
        alert(`No bouts found for Event "${currentEventName}" and Ring ${getRingName(Number(user.assignedRing))} in the sheet.`);
        return;
      }

      const newBouts = ringBouts.filter(row => {
        const boutNo = normalizeBoutNumber(row[2]?.trim());
        // Check if bout already exists in queue or rings
        const existsInQueue = boutQueue.some(q => normalizeBoutNumber(q.data.bout) === boutNo);
        const existsInRings = rings.some(r => 
          (r.currentBout && normalizeBoutNumber(r.currentBout.bout) === boutNo) ||
          (r.onDeck && normalizeBoutNumber(r.onDeck.bout) === boutNo) ||
          (r.inTheHole && normalizeBoutNumber(r.inTheHole.bout) === boutNo)
        );
        return !existsInQueue && !existsInRings;
      }).map(row => {
        const normalizedBout = normalizeBoutNumber(row[2]?.trim());
        return {
          id: Math.random().toString(36).substr(2, 9),
          data: {
            ring: parseInt(row[1]),
            bout: normalizedBout,
            category: row[3],
            blue_name: row[4],
            blue_club: row[5],
            red_name: row[6],
            red_club: row[7],
            privacy_mode: false,
            eventId: currentEventId || null
          } as MatchData
        };
      });

      if (newBouts.length === 0) {
        alert(`No new bouts to import for Ring ${getRingName(Number(user.assignedRing))}. All bouts from sheet already exist in system.`);
        return;
      }

      setBoutQueue(prev => [...prev, ...newBouts]);
      alert(`Successfully imported ${newBouts.length} new bouts for Ring ${getRingName(Number(user.assignedRing))}.`);
    } catch (error) {
      console.error("Error importing bouts:", error);
      alert("Error importing bouts. Please check console for details.");
    } finally {
      setIsImportingBouts(false);
    }
  };

  const handleAdminImportBouts = async () => {
    setIsImportingBouts(true);
    try {
      const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/14TrlxR_rk9S7WmdanXGLlE4Y-ry9TqY6_B6HYA0Uuus/export?format=csv";
      const response = await fetch(SHEET_CSV_URL);
      if (!response.ok) throw new Error("Failed to fetch sheet data.");
      
      const csvText = await response.text();
      const results = Papa.parse<string[]>(csvText, {
        skipEmptyLines: true
      });

      const rows = results.data;
      if (rows.length < 2) {
        alert("Sheet is empty or missing data.");
        return;
      }

      const dataRows = rows.slice(1);
      const currentEventName = getCurrentEventName();

      const eventBouts = dataRows.filter(row => {
        const rowEventName = row[0]?.trim();
        return rowEventName === currentEventName;
      });
      
      if (eventBouts.length === 0) {
        alert(`No bouts found for Event "${currentEventName}" in the sheet.`);
        return;
      }

      const newBouts = eventBouts.filter(row => {
        const boutNo = normalizeBoutNumber(row[2]?.trim());
        const existsInQueue = boutQueue.some(q => normalizeBoutNumber(q.data.bout) === boutNo);
        const existsInRings = rings.some(r => 
          (r.currentBout && normalizeBoutNumber(r.currentBout.bout) === boutNo) ||
          (r.onDeck && normalizeBoutNumber(r.onDeck.bout) === boutNo) ||
          (r.inTheHole && normalizeBoutNumber(r.inTheHole.bout) === boutNo)
        );
        return !existsInQueue && !existsInRings;
      }).map(row => {
        const normalizedBout = normalizeBoutNumber(row[2]?.trim());
        return {
          id: Math.random().toString(36).substr(2, 9),
          data: {
            ring: parseInt(row[1]) || 1,
            bout: normalizedBout,
            category: row[3],
            blue_name: row[4],
            blue_club: row[5],
            red_name: row[6],
            red_club: row[7],
            privacy_mode: false,
            eventId: currentEventId || null
          } as MatchData
        };
      });

      if (newBouts.length === 0) {
        alert(`No new bouts to import for Event "${currentEventName}". All bouts from sheet already exist in system.`);
        return;
      }

      setBoutQueue(prev => [...prev, ...newBouts]);
      alert(`Successfully imported ${newBouts.length} new bouts for Event "${currentEventName}".`);
    } catch (error) {
      console.error("Error importing bouts:", error);
      alert("Error importing bouts. Please check console for details.");
    } finally {
      setIsImportingBouts(false);
    }
  };

  const handleForceSync = async (data: MatchData) => {
    let activeUrl = googleSheetUrl;
    if (!activeUrl && currentEventId && events.length > 0) {
      const event = events.find(e => e.id === currentEventId);
      if (event && event.sheetUrl) {
        activeUrl = event.sheetUrl;
        setGoogleSheetUrl(activeUrl);
      }
    }

    if (activeUrl) {
      setIsSyncing(true);
      try {
        await syncToGoogleSheets(activeUrl, data, getCurrentEventName());
        addToSyncLog('Force Sync', 'success', `Bout ${data.bout} manually synced`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        addToSyncLog('Force Sync', 'error', msg);
      } finally {
        setIsSyncing(false);
      }
    } else {
      addToSyncLog('Force Sync', 'error', 'No Google Sheet URL configured');
    }
  };

  const syncResultsFromSheet = async () => {
    const RESULTS_SHEET_URL = "https://docs.google.com/spreadsheets/d/14TrlxR_rk9S7WmdanXGLlE4Y-ry9TqY6_B6HYA0Uuus/export?format=csv";
    if (!currentEventId) {
      console.log('Sync skipped: No currentEventId');
      return;
    }
    setIsSyncing(true);
    console.log('Starting sync from sheet...', RESULTS_SHEET_URL);
    try {
      const response = await fetch(RESULTS_SHEET_URL);
      const csvText = await response.text();
      console.log('Fetched CSV text length:', csvText.length);
      
      return new Promise<void>((resolve, reject) => {
        Papa.parse(csvText, {
          complete: async (result) => {
            try {
              const rows = result.data as string[][];
              console.log('Parsed rows count:', rows.length);
              let syncCount = 0;
              for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (row.length >= 10) {
                  const rawMatchNo = row[2]?.trim();
                  const matchNo = normalizeBoutNumber(rawMatchNo);
                  const category = row[3]?.trim();
                  const winner = row[9]?.trim(); // Column J

                  if (matchNo && category && winner && winner !== '-' && winner !== '') {
                    const historyId = `${currentEventId}_${matchNo}`;
                    const historyItem = {
                      bout: matchNo,
                      category: category,
                      winner: winner,
                      eventId: currentEventId,
                      syncedAt: new Date().toISOString()
                    };
                    
                    console.log(`Syncing result: Bout ${matchNo}, Category ${category}, Winner ${winner}`);
                    await setDoc(doc(db, 'matchHistory', historyId), historyItem);
                    syncCount++;
                  }
                }
              }
              
              console.log('Sync completed. Total synced:', syncCount);
              if (syncCount > 0) {
                addToSyncLog('Bracket Sync', 'success', `Synced ${syncCount} results from sheet`);
                alert(`Successfully synced ${syncCount} winners from the Google Sheet.`);
              } else {
                addToSyncLog('Bracket Sync', 'success', 'No new results found in sheet');
                alert("No new winners found in the Google Sheet. Make sure Column J has winner names.");
              }
              resolve();
            } catch (err) {
              console.error('Error in Papa.parse complete:', err);
              reject(err);
            }
          },
          error: (err) => {
            console.error('Papa.parse error:', err);
            reject(err);
          },
          skipEmptyLines: true
        });
      });
    } catch (error) {
      console.error("Error syncing results from sheet:", error);
      addToSyncLog('Bracket Sync', 'error', error instanceof Error ? error.message : String(error));
    } finally {
      setIsSyncing(false);
    }
  };

  const pullBout = async (queueId: string) => {
    const item = boutQueue.find(q => q.id === queueId);
    if (!item) return;

    // Remove from queue
    setBoutQueue(prev => {
      const updated = prev.filter(q => q.id !== queueId);
      localStorage.setItem('tkd_bout_queue', JSON.stringify(updated));
      return updated;
    });

    // Update ring
    handleBoutUpdate(item.data.ring, item.data);
  };

  const deleteBoutFromQueue = (queueId: string) => {
    setBoutQueue(prev => {
      const updated = prev.filter(q => q.id !== queueId);
      localStorage.setItem('tkd_bout_queue', JSON.stringify(updated));
      return updated;
    });
  };

  const handleMissingBoutReason = async (ringNumber: number, boutNumber: number, reason: string) => {
    // Close prompt immediately for responsiveness
    setMissingBoutPrompt(null);

    if (googleSheetUrl) {
      setIsSyncing(true);
      const dummyMatch: MatchData = {
        ring: ringNumber,
        bout: boutNumber,
        category: "Skipped",
        blue_name: "-",
        blue_club: "-",
        red_name: "-",
        red_club: "-",
        privacy_mode: false,
        eventId: currentEventId || null
      };
      
      // Sync in background
      Promise.all([
        syncToGoogleSheets(googleSheetUrl, dummyMatch, getCurrentEventName(), reason),
        updateWinnerInGoogleSheets(googleSheetUrl, ringNumber, boutNumber, reason, getCurrentEventName(), 'N/A')
      ]).finally(() => setIsSyncing(false));
    }

    const ring = rings.find(r => r.ringNumber === ringNumber);
    const nextExpectedBout = boutNumber + 1;

    // Update the ring's nextBoutNumber
    setRings(prev => {
      const updated = prev.map(r => r.ringNumber === ringNumber ? { ...r, nextBoutNumber: nextExpectedBout } : r);
      localStorage.setItem('tkd_rings', JSON.stringify(updated));
      return updated;
    });

    if (ring && ring.totalBouts && nextExpectedBout <= ring.totalBouts) {
      const nextBoutIndex = boutQueue.findIndex(q => q.data.ring === ringNumber);
      if (nextBoutIndex !== -1) {
        pullBout(boutQueue[nextBoutIndex].id);
      }
    }
    
    // Always close the prompt after recording a reason.
    // If there's no next bout in the queue, the ring will just become inactive.
    setMissingBoutPrompt(null);
  };

  const handleUpdateMatchInspection = async (ringNo: string, matchNo: string, color: 'blue' | 'red', inspected: boolean) => {
    setRings(prev => {
      const updated = [...prev];
      let changed = false;
      updated.forEach(ring => {
        if (ring.ringNumber.toString() === ringNo) {
          if (ring.currentBout && ring.currentBout.bout.toString() === matchNo) {
            ring.currentBout = { ...ring.currentBout, [`${color}_inspected`]: inspected };
            changed = true;
          }
          if (ring.onDeck && ring.onDeck.bout.toString() === matchNo) {
            ring.onDeck = { ...ring.onDeck, [`${color}_inspected`]: inspected };
            changed = true;
          }
          if (ring.inTheHole && ring.inTheHole.bout.toString() === matchNo) {
            ring.inTheHole = { ...ring.inTheHole, [`${color}_inspected`]: inspected };
            changed = true;
          }
        }
      });
      return changed ? updated : prev;
    });

    setBoutQueue(prev => {
      const updated = [...prev];
      let changed = false;
      updated.forEach(item => {
        if (item.data.ring.toString() === ringNo && item.data.bout.toString() === matchNo) {
          item.data = { ...item.data, [`${color}_inspected`]: inspected };
          changed = true;
        }
      });
      return changed ? updated : prev;
    });
  };

  const handleMissingBoutManual = async (ringNumber: number, data: MatchData) => {
    setMissingBoutPrompt(null);
    handleBoutUpdate(ringNumber, data);
  };

  useEffect(() => {
    if (!currentEventId || mappings.length === 0 || matchHistory.length === 0) {
      return;
    }

    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '').trim();

    // Group mappings by target bout to handle both slots
    const targetBouts = new Map<string, { category: string, bout: string, blue?: string, red?: string }>();

    mappings.forEach(mapping => {
      const match = matchHistory.find(h => 
        normalizeBoutNumber(h.bout) === normalizeBoutNumber(mapping.sourceBout) && 
        normalize(h.category) === normalize(mapping.categoryName) &&
        h.eventId === currentEventId
      );

      if (match) {
        const key = `${normalize(mapping.categoryName)}_${normalizeBoutNumber(mapping.nextBout)}`;
        if (!targetBouts.has(key)) {
          targetBouts.set(key, { category: mapping.categoryName, bout: normalizeBoutNumber(mapping.nextBout) });
        }
        const target = targetBouts.get(key)!;
        if (mapping.slot === 'Chung') target.blue = match.winner;
        if (mapping.slot === 'Hong') target.red = match.winner;
      }
    });

    if (targetBouts.size === 0) return;

    let changed = false;
    let updatedQueue = [...boutQueue];
    let updatedRings = [...rings];

    targetBouts.forEach((info) => {
      let found = false;
      const targetBoutStr = normalizeBoutNumber(info.bout);

      // Check rings
      updatedRings = updatedRings.map(ring => {
        let ringDocChanged = false;
        const updateBout = (bout: MatchData | null) => {
          if (bout && normalizeBoutNumber(bout.bout) === targetBoutStr) {
            // If bout number matches, we consider it found even if category is slightly different
            found = true;
            const newData = { ...bout };
            let boutChanged = false;
            if (info.blue && newData.blue_name !== info.blue) {
              newData.blue_name = info.blue;
              boutChanged = true;
            }
            if (info.red && newData.red_name !== info.red) {
              newData.red_name = info.red;
              boutChanged = true;
            }
            if (boutChanged) {
              ringDocChanged = true;
              changed = true;
            }
            return newData;
          }
          return bout;
        };

        const newCurrent = updateBout(ring.currentBout);
        const newOnDeck = updateBout(ring.onDeck);
        const newInTheHole = updateBout(ring.inTheHole);

        if (ringDocChanged) {
          return { ...ring, currentBout: newCurrent, onDeck: newOnDeck, inTheHole: newInTheHole };
        }
        return ring;
      });

      // Check queue
      updatedQueue = updatedQueue.map(item => {
        if (normalizeBoutNumber(item.data.bout) === targetBoutStr) {
          found = true;
          const newData = { ...item.data };
          let itemChanged = false;
          if (info.blue && newData.blue_name !== info.blue) {
            newData.blue_name = info.blue;
            itemChanged = true;
          }
          if (info.red && newData.red_name !== info.red) {
            newData.red_name = info.red;
            itemChanged = true;
          }
          if (itemChanged) {
            changed = true;
            return { ...item, data: newData };
          }
        }
        return item;
      });

      // If not found anywhere, generate it (only if both players are available as per user request)
      if (!found && info.blue && info.red) {
        const boutNum = parseInt(targetBoutStr);
        const prefix = targetBoutStr.charAt(0).toUpperCase();
        let ringNum = 1;

        if (!isNaN(boutNum) && boutNum >= 1000) {
          ringNum = Math.floor(boutNum / 1000);
        } else if (prefix === 'A') ringNum = 1;
        else if (prefix === 'B') ringNum = 2;
        else if (prefix === 'C') ringNum = 3;
        else if (prefix === 'D') ringNum = 4;
        else if (prefix === 'E') ringNum = 5;
        else if (prefix === 'F') ringNum = 6;
        else if (prefix === 'G') ringNum = 7;
        else if (prefix === 'H') ringNum = 8;
        
        const newBout: MatchData = {
          ring: ringNum,
          bout: targetBoutStr,
          category: info.category,
          blue_name: info.blue || '',
          blue_club: '',
          red_name: info.red || '',
          red_club: '',
          privacy_mode: false,
          eventId: currentEventId
        };

        updatedQueue.push({
          id: `gen_${currentEventId}_${targetBoutStr}_${info.category}`,
          data: newBout
        });
        changed = true;
      }
    });

    if (changed) {
      setBoutQueue(updatedQueue);
      setRings(updatedRings);
      localStorage.setItem('tkd_bout_queue', JSON.stringify(updatedQueue));
      localStorage.setItem('tkd_rings', JSON.stringify(updatedRings));
    }
  }, [mappings, matchHistory, currentEventId, boutQueue, rings]);

  // Auto-pull logic removed as per user request (manual pull only)
  
  const handleWinnerSelect = async (ringNumber: number, boutNumber: string | number, winner: string) => {
    let activeUrl = googleSheetUrl;
    if (!activeUrl && currentEventId && events.length > 0) {
      const event = events.find(e => e.id === currentEventId);
      if (event && event.sheetUrl) {
        activeUrl = event.sheetUrl;
        setGoogleSheetUrl(activeUrl);
      }
    }

    const ring = rings.find(r => r.ringNumber === ringNumber);
    const currentBout = ring?.currentBout;
    const winnerName = winner === 'Blue' ? currentBout?.blue_name : currentBout?.red_name;

    if (activeUrl) {
      setIsSyncing(true);
      setLastSyncError(null);
      updateWinnerInGoogleSheets(
        activeUrl, 
        ringNumber, 
        boutNumber, 
        winnerName || winner,
        getCurrentEventName(),
        winner,
        currentBout?.blue_name,
        currentBout?.red_name
      ).then(() => {
        addToSyncLog('Winner', 'success', `Winner for Bout ${boutNumber} sent`);
      }).catch(e => {
        const msg = e instanceof Error ? e.message : String(e);
        setLastSyncError(`Winner sync failed: ${msg}`);
        addToSyncLog('Winner', 'error', msg);
      }).finally(() => setIsSyncing(false));
    }

    // Save to match history for advancement logic
    if (currentEventId && currentBout) {
      const historyItem: MatchHistoryItem = {
        id: `${currentEventId}_${boutNumber}`,
        bout: boutNumber.toString(),
        category: currentBout.category,
        winner: winnerName || winner,
        winnerClub: winner === 'Blue' ? currentBout.blue_club : currentBout.red_club,
        eventId: currentEventId
      };
      
      setMatchHistory(prev => {
        const filtered = prev.filter(h => h.id !== historyItem.id);
        const updated = [...filtered, historyItem];
        return updated;
      });

      // Also save to Firestore
      const historyId = `${currentEventId}_${boutNumber}`;
      setDoc(doc(db, 'matchHistory', historyId), {
        ...historyItem,
        syncedAt: serverTimestamp()
      }).catch(err => console.error("Error saving match history:", err));

      // Check and generate next bout
      checkAndGenerateNextBout(boutNumber, winnerName || winner, winner === 'Blue' ? currentBout.blue_club : currentBout.red_club);
    }
    
    const ringQueue = boutQueue.filter(q => q.data.ring === ringNumber && (!q.data.eventId || q.data.eventId === currentEventId));
    const nextBoutIndex = boutQueue.findIndex(q => q.data.ring === ringNumber && (!q.data.eventId || q.data.eventId === currentEventId));
    
    // Check if we need to prompt for final bouts
    // If we have a next bout, and after pulling it, the queue for this ring will be < 3
    if (nextBoutIndex !== -1 && !ring?.isFinalBouts && ringQueue.length < 4) {
      setFinalBoutCheck({ ringNumber, remainingCount: ringQueue.length - 1 });
    }

    // Auto-advance ring: Move onDeck to current, inTheHole to onDeck
    let pulledFromQueue = false;
    let nextItemToPull: {id: string, data: MatchData} | null = null;

    if (autoPullRings[ringNumber] && !ring?.onDeck) {
      if (ringQueue.length > 0) {
        nextItemToPull = ringQueue[0];
        pulledFromQueue = true;
      }
    }

    setRings(prev => {
      const updated = prev.map(r => {
        if (r.ringNumber === ringNumber) {
          let nextBout = r.onDeck;
          let nextNextBout = r.inTheHole;
          
          if (!nextBout && pulledFromQueue && nextItemToPull) {
            nextBout = nextItemToPull.data;
          }

          return {
            ...r,
            currentBout: nextBout,
            onDeck: nextNextBout,
            inTheHole: null,
            nextBoutNumber: nextBout ? getBoutNumber(nextBout.bout) + 1 : r.nextBoutNumber
          };
        }
        return r;
      });
      localStorage.setItem('tkd_rings', JSON.stringify(updated));
      return updated;
    });

    if (pulledFromQueue && nextItemToPull) {
      setBoutQueue(prev => {
        const updated = prev.filter(q => q.id !== nextItemToPull!.id);
        localStorage.setItem('tkd_bout_queue', JSON.stringify(updated));
        return updated;
      });
    }

    // If queue is empty but we haven't reached total bouts, show the missing bout prompt
    if (ring && ring.totalBouts && !ring.onDeck && !ring.inTheHole && ringQueue.length === (pulledFromQueue ? 1 : 0) && getBoutNumber(ring.currentBout?.bout || 0) < ring.totalBouts) {
      setMissingBoutPrompt({ ringNumber, expectedBout: getBoutNumber(ring.currentBout?.bout || 0) + 1, totalBouts: ring.totalBouts });
    }
  };

  const handleTransferSelect = async (ringNumber: number, boutNumber: string | number, reason: string) => {
    const ring = rings.find(r => r.ringNumber === ringNumber);
    let activeUrl = googleSheetUrl;
    if (!activeUrl && currentEventId && events.length > 0) {
      const event = events.find(e => e.id === currentEventId);
      if (event && event.sheetUrl) {
        activeUrl = event.sheetUrl;
        setGoogleSheetUrl(activeUrl);
      }
    }

    if (activeUrl) {
      setIsSyncing(true);
      setLastSyncError(null);
      updateTransferInGoogleSheets(
        activeUrl,
        ringNumber,
        boutNumber,
        reason,
        getCurrentEventName()
      ).then(() => {
        addToSyncLog('Transfer', 'success', `Transfer for Bout ${boutNumber} sent`);
      }).catch(e => {
        const msg = e instanceof Error ? e.message : String(e);
        setLastSyncError(`Transfer sync failed: ${msg}`);
        addToSyncLog('Transfer', 'error', msg);
      }).finally(() => setIsSyncing(false));
    }
    
    const ringQueue = boutQueue.filter(q => q.data.ring === ringNumber && (!q.data.eventId || q.data.eventId === currentEventId));
    const nextBoutIndex = boutQueue.findIndex(q => q.data.ring === ringNumber && (!q.data.eventId || q.data.eventId === currentEventId));
    
    if (nextBoutIndex !== -1 && !ring?.isFinalBouts && ringQueue.length < 4) {
      setFinalBoutCheck({ ringNumber, remainingCount: ringQueue.length - 1 });
    }

    // Auto-advance ring: Move onDeck to current, inTheHole to onDeck
    let pulledFromQueue = false;
    let nextItemToPull: {id: string, data: MatchData} | null = null;

    if (autoPullRings[ringNumber] && !ring?.onDeck) {
      if (ringQueue.length > 0) {
        nextItemToPull = ringQueue[0];
        pulledFromQueue = true;
      }
    }

    setRings(prev => {
      const updated = prev.map(r => {
        if (r.ringNumber === ringNumber) {
          let nextBout = r.onDeck;
          let nextNextBout = r.inTheHole;
          
          if (!nextBout && pulledFromQueue && nextItemToPull) {
            nextBout = nextItemToPull.data;
          }

          return {
            ...r,
            currentBout: nextBout,
            onDeck: nextNextBout,
            inTheHole: null,
            nextBoutNumber: nextBout ? getBoutNumber(nextBout.bout) + 1 : (r.currentBout ? getBoutNumber(r.currentBout.bout) + 1 : r.nextBoutNumber)
          };
        }
        return r;
      });
      localStorage.setItem('tkd_rings', JSON.stringify(updated));
      return updated;
    });

    if (pulledFromQueue && nextItemToPull) {
      setBoutQueue(prev => {
        const updated = prev.filter(q => q.id !== nextItemToPull!.id);
        localStorage.setItem('tkd_bout_queue', JSON.stringify(updated));
        return updated;
      });
    }

    // If queue is empty but we haven't reached total bouts, show the missing bout prompt
    if (ring && ring.totalBouts && !ring.onDeck && !ring.inTheHole && ringQueue.length === (pulledFromQueue ? 1 : 0) && getBoutNumber(ring.currentBout?.bout || 0) < ring.totalBouts) {
      setMissingBoutPrompt({ ringNumber, expectedBout: getBoutNumber(ring.currentBout?.bout || 0) + 1, totalBouts: ring.totalBouts });
    }
  };

  const getRingFromBout = (bout: string | number): number => {
    const boutStr = bout.toString().toUpperCase();
    const prefix = boutStr.charAt(0);
    const boutNum = parseInt(boutStr.replace(/[^0-9]/g, ''));
    
    // Numeric range logic (1000s = Ring 1, 2000s = Ring 2, etc.)
    if (!isNaN(boutNum) && boutNum >= 1000) {
      return Math.floor(boutNum / 1000);
    }
    
    // Letter prefix logic
    if (prefix === 'A') return 1;
    if (prefix === 'B') return 2;
    if (prefix === 'C') return 3;
    if (prefix === 'D') return 4;
    if (prefix === 'E') return 5;
    if (prefix === 'F') return 6;
    if (prefix === 'G') return 7;
    if (prefix === 'H') return 8;
    
    return 1; // Default
  };

  const checkAndGenerateNextBout = (completedBout: string | number, winnerName: string, winnerClub: string) => {
    if (!currentEventId) return;

    // 1. Find mappings where this bout is a source
    const relevantMappings = mappings.filter(m => m.sourceBout.toString() === completedBout.toString());
    
    for (const mapping of relevantMappings) {
      const nextBoutId = mapping.nextBout;
      
      // 2. Find the other mapping for the same nextBout
      const otherMapping = mappings.find(m => m.nextBout === nextBoutId && m.id !== mapping.id);
      
      let blue_name = '';
      let blue_club = '';
      let red_name = '';
      let red_club = '';
      
      let shouldGenerate = false;

      if (mapping.slot === 'Chung') {
        blue_name = winnerName;
        blue_club = winnerClub;
      } else {
        red_name = winnerName;
        red_club = winnerClub;
      }

      if (otherMapping) {
        // Check if the other source bout has a winner
        const otherWinner = matchHistory.find(h => h.bout.toString() === otherMapping.sourceBout.toString() && h.eventId === currentEventId);
        if (otherWinner) {
          if (otherMapping.slot === 'Chung') {
            blue_name = otherWinner.winner;
            blue_club = otherWinner.winnerClub || '';
          } else {
            red_name = otherWinner.winner;
            red_club = otherWinner.winnerClub || '';
          }
          shouldGenerate = true;
        }
      } else {
        // Only one source bout, so the other player is already available (e.g. bye)
        shouldGenerate = true;
      }

      // Check if already in queue
      const existingQueueIndex = boutQueue.findIndex(q => q.data.bout.toString() === nextBoutId.toString() && q.data.eventId === currentEventId);
      
      if (existingQueueIndex !== -1) {
        // Update existing bout in queue
        setBoutQueue(prev => {
          const updated = [...prev];
          const existing = updated[existingQueueIndex].data;
          updated[existingQueueIndex].data = {
            ...existing,
            blue_name: blue_name ? blue_name.toUpperCase() : existing.blue_name,
            blue_club: blue_club ? blue_club.toUpperCase() : existing.blue_club,
            red_name: red_name ? red_name.toUpperCase() : existing.red_name,
            red_club: red_club ? red_club.toUpperCase() : existing.red_club,
          };
          localStorage.setItem('tkd_bout_queue', JSON.stringify(updated));
          return updated;
        });
      } else if (shouldGenerate) {
        // Check if already in rings
        const existsInRings = rings.some(r => (
          (r.currentBout?.bout.toString() === nextBoutId.toString() && (!r.currentBout.eventId || r.currentBout.eventId === currentEventId)) || 
          (r.onDeck?.bout.toString() === nextBoutId.toString() && (!r.onDeck.eventId || r.onDeck.eventId === currentEventId)) || 
          (r.inTheHole?.bout.toString() === nextBoutId.toString() && (!r.inTheHole.eventId || r.inTheHole.eventId === currentEventId))
        ));

        if (!existsInRings) {
          // Generate the bout
          const ringNum = getRingFromBout(nextBoutId);
          const newMatch: MatchData = {
            ring: ringNum,
            bout: nextBoutId,
            blue_name: blue_name.toUpperCase(),
            blue_club: blue_club.toUpperCase(),
            red_name: red_name.toUpperCase(),
            red_club: red_club.toUpperCase(),
            category: '', // Category should be the same as source bouts
            privacy_mode: false,
            eventId: currentEventId
          };
          
          // Try to find category from source bouts
          const sourceMatch = matchHistory.find(h => h.bout.toString() === completedBout.toString());
          if (sourceMatch) newMatch.category = sourceMatch.category.toUpperCase();

          setBoutQueue(prev => {
            const updated = [...prev, { id: `auto_${currentEventId}_${nextBoutId}_${Date.now()}`, data: newMatch }];
            localStorage.setItem('tkd_bout_queue', JSON.stringify(updated));
            return updated;
          });
        }
      }
    }
  };

  const handleBoutUpdate = async (ringNumber: number, newData: MatchData) => {
    // Capitalize all letters for ring controller
    const capitalizedData: MatchData = {
      ...newData,
      blue_name: newData.blue_name?.toUpperCase() || '',
      blue_club: newData.blue_club?.toUpperCase() || '',
      red_name: newData.red_name?.toUpperCase() || '',
      red_club: newData.red_club?.toUpperCase() || '',
      category: newData.category?.toUpperCase() || '',
      bout: newData.bout?.toString().toUpperCase() || '',
    };

    // Update categories and clubs lists
    if (capitalizedData.category && !categories.includes(capitalizedData.category)) {
      const newCats = [...categories, capitalizedData.category];
      setCategories(newCats);
      localStorage.setItem('tkd_categories', JSON.stringify(newCats));
    }
    if (capitalizedData.blue_club && !clubs.includes(capitalizedData.blue_club)) {
      const newClubs = [...clubs, capitalizedData.blue_club];
      setClubs(newClubs);
      localStorage.setItem('tkd_clubs', JSON.stringify(newClubs));
    }
    if (capitalizedData.red_club && !clubs.includes(capitalizedData.red_club)) {
      const newClubs = [...clubs, capitalizedData.red_club];
      setClubs(newClubs);
      localStorage.setItem('tkd_clubs', JSON.stringify(newClubs));
    }

    // Update rings state IMMEDIATELY for real-time sync
    setRings(prev => {
      const updated = prev.map(r => r.ringNumber === ringNumber ? { 
        ...r, 
        currentBout: capitalizedData,
        nextBoutNumber: getBoutNumber(capitalizedData.bout) + 1
      } : r);
      localStorage.setItem('tkd_rings', JSON.stringify(updated));
      return updated;
    });

    // Auto sync to Google Sheets
    let activeUrl = googleSheetUrl;
    if (!activeUrl && currentEventId && events.length > 0) {
      const event = events.find(e => e.id === currentEventId);
      if (event && event.sheetUrl) {
        activeUrl = event.sheetUrl;
        setGoogleSheetUrl(activeUrl);
      }
    }

    if (activeUrl) {
      setIsSyncing(true);
      try {
        await syncToGoogleSheets(activeUrl, capitalizedData, getCurrentEventName());
      } catch (e) {
        console.error('Sync error:', e);
      } finally {
        setIsSyncing(false);
      }
    }
  };

  const startRing = (ringNumber: number) => {
    const ring = rings.find(r => r.ringNumber === ringNumber);
    const nextBoutIndex = boutQueue.findIndex(q => q.data.ring === ringNumber);
    
    // Reset final bouts flag when starting a new session
    setRings(prev => {
      const updated = prev.map(r => r.ringNumber === ringNumber ? { ...r, isFinalBouts: false } : r);
      localStorage.setItem('tkd_rings', JSON.stringify(updated));
      return updated;
    });

    if (nextBoutIndex !== -1) {
      pullBout(boutQueue[nextBoutIndex].id);
    } else if (ring && ring.totalBouts) {
      // If queue is empty but we have total bouts, show the missing bout prompt
      const expectedBout = ring.nextBoutNumber || 1;
      if (expectedBout <= ring.totalBouts) {
        setMissingBoutPrompt({ ringNumber, expectedBout, totalBouts: ring.totalBouts });
      }
    } else {
      const defaultMatch: MatchData = {
        ring: ringNumber,
        bout: ring?.nextBoutNumber || 1,
        blue_name: "New Competitor",
        blue_club: "Club A",
        red_name: "New Competitor",
        red_club: "Club B",
        category: "Open Category",
        privacy_mode: false
      };
      handleBoutUpdate(ringNumber, defaultMatch);
    }
  };

  const addRing = (ringNumber: number) => {
    setRings(prev => {
      if (prev.some(r => r.ringNumber === ringNumber)) return prev;
      const newRing: RingStatus = {
        ringNumber: ringNumber,
        currentBout: null,
        onDeck: null,
        inTheHole: null,
        nextBoutNumber: 1
      };
      const next = [...prev, newRing].sort((a, b) => a.ringNumber - b.ringNumber);
      localStorage.setItem('tkd_rings', JSON.stringify(next));
      return next;
    });
  };

  const deleteRing = (ringNumber: number) => {
    setRings(prev => {
      const next = prev.filter(r => r.ringNumber !== ringNumber);
      localStorage.setItem('tkd_rings', JSON.stringify(next));
      return next;
    });
  };

  const handleUpdateTotalBouts = (ringNumber: number, total: number) => {
    setRings(prev => {
      const ring = prev.find(r => r.ringNumber === ringNumber);
      if (ring) {
        const isSessionInProgress = ring.nextBoutNumber && ring.nextBoutNumber > 1 && ring.totalBouts && ring.nextBoutNumber <= ring.totalBouts;
        if (isSessionInProgress) return prev;
      }
      const updated = prev.map(r => r.ringNumber === ringNumber ? { ...r, totalBouts: total, isFinalBouts: false } : r);
      localStorage.setItem('tkd_rings', JSON.stringify(updated));
      return updated;
    });
  };

  const handleLogin = (username: string, pass: string, eventId?: string) => {
    const found = accounts.find(a => a.username === username && a.password === pass);
    if (found) {
      setUser(found);
      localStorage.setItem('tkd_user', JSON.stringify(found));
      localStorage.setItem('tkd_login_time', new Date().getTime().toString());
      if (eventId) {
        setCurrentEventId(eventId);
        localStorage.setItem('tkd_current_event', eventId);
        const event = events.find(e => e.id === eventId);
        if (event && event.sheetUrl) {
          setGoogleSheetUrl(event.sheetUrl);
          localStorage.setItem('tkd_sheet_url', event.sheetUrl);
        }
      }
      
      if (found.role === 'viewer') {
        setActiveTab('general');
      } else if (found.role === 'user') {
        setActiveTab('mats');
      } else {
        setActiveTab('dashboard');
      }
      
      return true;
    }
    return false;
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Secret shortcut: Ctrl + Shift + L to show login
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'l') {
        if (!user) setShowLogin(true);
        else setIsPublicView(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [user]);

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('tkd_user');
    localStorage.removeItem('tkd_login_time');
    setShowLogin(true);
  };

  const handleAddEvent = (newEvent: EventData) => {
    const updated = [...events, newEvent];
    setEvents(updated);
    localStorage.setItem('tkd_events', JSON.stringify(updated));
    
    // Also auto-generate rings up to ringQuantity if they don't exist
    // For simplicity, we just set the rings to the new quantity
    const newRings = Array.from({ length: newEvent.ringQuantity }, (_, i) => ({
      ringNumber: i + 1,
      currentBout: null,
      onDeck: null,
      inTheHole: null
    }));
    setRings(newRings);
    localStorage.setItem('tkd_rings', JSON.stringify(newRings));
  };

  const handleDeleteEvent = (id: string) => {
    const updated = events.filter(e => e.id !== id);
    setEvents(updated);
    localStorage.setItem('tkd_events', JSON.stringify(updated));
    
    // Remove related bout queue
    const updatedQueue = boutQueue.filter(b => b.data.eventId !== id);
    setBoutQueue(updatedQueue);
    localStorage.setItem('tkd_bout_queue', JSON.stringify(updatedQueue));

    // Remove related match history
    const updatedHistory = matchHistory.filter(h => h.eventId !== id);
    setMatchHistory(updatedHistory);
    localStorage.setItem('tkd_match_history', JSON.stringify(updatedHistory));

    // Remove related bout mappings
    const updatedMappings = mappings.filter(m => m.eventId !== id);
    setMappings(updatedMappings);
    localStorage.setItem('tkd_bout_mappings', JSON.stringify(updatedMappings));

    if (currentEventId === id) {
      setCurrentEventId(null);
      localStorage.removeItem('tkd_current_event');
      // Clear rings if current event is deleted
      const clearedRings = rings.map(r => ({
        ...r,
        currentBout: null,
        onDeck: null,
        inTheHole: null
      }));
      setRings(clearedRings);
      localStorage.setItem('tkd_rings', JSON.stringify(clearedRings));
    }
  };

  const handleAddAccount = (newAcc: UserAccount) => {
    const updated = [...accounts, newAcc];
    setAccounts(updated);
    localStorage.setItem('tkd_accounts', JSON.stringify(updated));
  };

  const handleDeleteAccount = (username: string) => {
    if (username === 'admin') return; // Protect main admin
    const updated = accounts.filter(a => a.username !== username);
    setAccounts(updated);
    localStorage.setItem('tkd_accounts', JSON.stringify(updated));
    if (user?.username === username) {
      handleLogout();
    }
  };

  const handleEditPassword = (username: string, newPassword: string) => {
    const updated = accounts.map(a => a.username === username ? { ...a, password: newPassword } : a);
    setAccounts(updated);
    localStorage.setItem('tkd_accounts', JSON.stringify(updated));
  };

  if (!user && showLogin && !isPublicView) {
    return <LoginScreen onLogin={handleLogin} events={events} onBack={() => setShowLogin(false)} />;
  }

  if (!user) {
    return (
      <PublicDashboardView 
        rings={rings} 
        boutQueue={boutQueue} 
        namingMode={ringNamingMode} 
        onBack={() => setShowLogin(true)} 
        isSpectator={true}
      />
    );
  }

  if (isPublicView) {
    return (
      <PublicDashboardView 
        rings={rings} 
        boutQueue={boutQueue} 
        namingMode={ringNamingMode} 
        onBack={() => setIsPublicView(false)} 
      />
    );
  }

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col md:flex-row text-slate-900 font-sans">
      {/* Mobile Header */}
      <header className="md:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between sticky top-0 z-[60] print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-red-200">
            <Trophy size={18} />
          </div>
          <h1 className="font-bold text-base leading-tight">MY-TKD</h1>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleLogout}
            className="p-2 text-slate-400 hover:text-red-600 transition-colors"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* Sidebar (Desktop) */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col hidden md:flex h-screen sticky top-0 print:hidden">
        <div className="p-6 flex items-center gap-3 border-b border-slate-100">
          <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-red-200">
            <Trophy size={24} />
          </div>
          <div>
            <h1 className="font-black text-lg leading-tight tracking-tighter">MY-TKD</h1>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Tournament Manager</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {user?.role === 'admin' && (
            <>
              <NavItem 
                icon={<LayoutDashboard size={20} />} 
                label="Dashboard" 
                active={activeTab === 'dashboard'} 
                onClick={() => setActiveTab('dashboard')} 
              />
              <NavItem 
                icon={<Monitor size={20} />} 
                label="Onsite View" 
                active={activeTab === 'general'} 
                onClick={() => setActiveTab('general')} 
              />
              <NavItem 
                icon={<LayoutDashboard size={20} />} 
                label="Standby View" 
                active={activeTab === 'standby'} 
                onClick={() => setActiveTab('standby')} 
              />
              <NavItem 
                icon={<LayoutDashboard size={20} />} 
                label="Live Controller" 
                active={activeTab === 'mats'} 
                onClick={() => setActiveTab('mats')} 
              />
              <NavItem 
                icon={<Users size={20} />} 
                label="Athlete DB" 
                active={activeTab === 'athletes'} 
                onClick={() => setActiveTab('athletes')} 
              />
              <NavItem 
                icon={<Shield size={20} />} 
                label="Bracket Logic" 
                active={activeTab === 'mapping'} 
                onClick={() => setActiveTab('mapping')} 
              />
              <NavItem 
                icon={<RefreshCw size={20} />} 
                label="AI Setup" 
                active={activeTab === 'ai-setup'} 
                onClick={() => setActiveTab('ai-setup')} 
              />
            </>
          )}
          {user?.role === 'user' && (
            <>
              <NavItem 
                icon={<LayoutDashboard size={20} />} 
                label={`Ring ${getRingName(Number(user?.assignedRing) || 1)}`} 
                active={activeTab === 'mats'} 
                onClick={() => setActiveTab('mats')} 
                badge={rings.find(r => r.ringNumber === Number(user?.assignedRing))?.totalBouts || 0}
              />
              <NavItem 
                icon={<Database size={20} />} 
                label="Data Sync" 
                active={activeTab === 'data-sync'} 
                onClick={() => setActiveTab('data-sync')} 
              />
            </>
          )}
          {user?.role === 'viewer' && (
            <>
              <NavItem 
                icon={<Monitor size={20} />} 
                label="Onsite View" 
                active={activeTab === 'general'} 
                onClick={() => setActiveTab('general')} 
              />
              <NavItem 
                icon={<LayoutDashboard size={20} />} 
                label="Standby View" 
                active={activeTab === 'standby'} 
                onClick={() => setActiveTab('standby')} 
              />
            </>
          )}
          {user?.role === 'ta' && (
            <>
              <NavItem 
                icon={<LayoutDashboard size={20} />} 
                label="TA Sheet" 
                active={activeTab === 'ta-sheet'} 
                onClick={() => setActiveTab('ta-sheet')} 
              />
              <NavItem 
                icon={<Edit2 size={20} />} 
                label="Player Signature" 
                active={activeTab === 'player-signature'} 
                onClick={() => setActiveTab('player-signature')} 
              />
            </>
          )}
          {user?.role === 'admin' && (
            <>
              <NavItem 
                icon={<Database size={20} />} 
                label="Data Sync" 
                active={activeTab === 'data-sync'} 
                onClick={() => setActiveTab('data-sync')} 
              />
              <NavItem 
                icon={<Settings size={20} />} 
                label="Settings" 
                active={activeTab === 'settings'} 
                onClick={() => setActiveTab('settings')} 
              />
            </>
          )}
          <div className="pt-4 mt-4 border-t border-slate-100 space-y-2">
            <div className="px-4 py-2 bg-slate-50 rounded-xl flex items-center gap-3">
              <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-slate-600 font-bold text-xs">
                {user?.username.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate">{user?.username}</p>
                <p className="text-[10px] text-slate-500 uppercase font-black">{user?.role}</p>
              </div>
              <button 
                onClick={handleLogout}
                className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                title="Logout"
              >
                <LogOut size={16} />
              </button>
            </div>
            {(user?.role === 'admin' || user?.role === 'viewer') && (
              <button 
                onClick={() => setIsPublicView(true)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all group"
              >
                <QrCode size={20} className="group-hover:scale-110 transition-transform" />
                Public View
              </button>
            )}
          </div>
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={cn(
                "w-2 h-2 rounded-full",
                googleSheetUrl ? "bg-green-500 animate-pulse" : "bg-slate-300"
              )} />
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Live Sync</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              {googleSheetUrl ? (
                <>
                  {user?.role === 'admin' ? 'Connected to Google Sheets:' : 'Connected to System'} <br/>
                  <span className="text-slate-600 truncate block">Active Web App</span>
                </>
              ) : (
                <>
                  {user?.role === 'admin' ? 'Google Sheets:' : 'System Status:'} <br/>
                  <span className="text-red-400 font-bold">Not Configured</span>
                </>
              )}
            </p>
            {lastSyncError && (
              <div className="mt-2 p-2 bg-red-50 border border-red-100 rounded-lg">
                <p className="text-[9px] font-bold text-red-600 leading-tight">
                  {lastSyncError}
                </p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col md:h-screen overflow-hidden">
        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 md:space-y-8 pb-24 md:pb-8">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 md:mb-8 print:hidden">
            <div className="flex items-center gap-4">
              <h2 className="text-xl md:text-2xl font-black text-slate-900 capitalize tracking-tight">{activeTab}</h2>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 md:gap-4">
              {events.length > 0 && (
                (currentEventId && user?.role !== 'admin') ? (
                  <div className="px-4 py-2 bg-slate-100 rounded-xl text-[10px] md:text-xs font-black text-slate-600 border border-slate-200 uppercase tracking-widest flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    Event: {events.find(e => e.id === currentEventId)?.name}
                  </div>
                ) : (
                  <select
                    value={currentEventId || ''}
                    onChange={(e) => {
                      const id = e.target.value;
                      setCurrentEventId(id);
                      localStorage.setItem('tkd_current_event', id);
                      const event = events.find(ev => ev.id === id);
                      if (event && event.sheetUrl) {
                        setGoogleSheetUrl(event.sheetUrl);
                        localStorage.setItem('tkd_sheet_url', event.sheetUrl);
                      }
                    }}
                    className="flex-1 sm:flex-none px-3 md:px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs md:text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-500 shadow-sm"
                  >
                    <option value="" disabled>Select Event</option>
                    {events.map(ev => (
                      <option key={ev.id} value={ev.id}>{ev.name}</option>
                    ))}
                  </select>
                )
              )}
              <div className="flex flex-col items-end gap-2 w-full sm:w-auto">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button 
                    onClick={() => setShowAnnouncementInput(true)}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 md:px-6 py-2 md:py-2.5 bg-red-600 text-white rounded-xl text-[10px] md:text-sm font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-200"
                  >
                    <Bell size={16} />
                    <span>Broadcast</span>
                  </button>
                  <button 
                    onClick={() => setShowEditBoutDetailsModal(true)}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 md:px-6 py-2 md:py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] md:text-sm font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                  >
                    <Edit2 size={16} />
                    <span className="hidden md:inline">Edit Details</span>
                    <span className="md:hidden">Details</span>
                  </button>
                  {user?.role !== 'ta' && (
                    <>
                      <button 
                        onClick={() => setShowEditResultModal(true)}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 md:px-6 py-2 md:py-2.5 bg-blue-600 text-white rounded-xl text-[10px] md:text-sm font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                      >
                        <Edit2 size={16} />
                        <span className="hidden md:inline">Edit Result</span>
                        <span className="md:hidden">Result</span>
                      </button>
                      <button 
                        onClick={() => setShowNewBoutModal(true)}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 md:px-6 py-2 md:py-2.5 bg-slate-900 text-white rounded-xl text-[10px] md:text-sm font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
                      >
                        <Plus size={16} />
                        <span>New</span>
                      </button>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                </div>
              </div>
            </div>
          </div>

          {activeTab === 'dashboard' && (() => {
            const dashboardRings = rings.filter(r => user?.role === 'admin' || r.ringNumber === Number(user?.assignedRing));
            const activeCount = dashboardRings.filter(r => r.currentBout).length;

            return (
              <>
                {/* Bout Summary - Admin Only */}
                {user?.role === 'admin' && (
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                        <Trophy size={16} className="text-red-600" />
                        Bout Summary
                      </h3>
                      <div className="bg-red-50 text-red-600 px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest">
                        Total: {rings.reduce((acc, r) => acc + (r.totalBouts || 0), 0)} Bouts
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                      {rings.map(ring => (
                        <div key={ring.ringNumber} className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ring {getRingName(ring.ringNumber)}</p>
                          <p className="text-lg font-black text-slate-800">{ring.totalBouts || 0} <span className="text-[10px] text-slate-500">Bouts</span></p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Live Rings */}
                  <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold flex items-center gap-2 text-slate-800">
                        <LayoutDashboard size={20} className="text-red-600" />
                        Active Ring Overview
                      </h3>
                      <div className="flex items-center gap-2">
                        <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-xs font-bold text-green-600 uppercase tracking-widest">
                          {activeCount} Live
                        </span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {dashboardRings.length === 0 ? (
                        <div className="col-span-full py-20 bg-white border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center text-slate-400 space-y-4">
                          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                            <LayoutDashboard size={32} />
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-bold text-slate-600">No Rings Assigned</p>
                            <p className="text-xs font-medium">Rings will appear here once they are added by an administrator.</p>
                          </div>
                        </div>
                      ) : (
                        dashboardRings.map((ring) => (
                          <RingCard 
                            key={ring.ringNumber} 
                            ring={ring} 
                            namingMode={ringNamingMode}
                            categories={categories}
                            clubs={clubs}
                            queueCount={getFilteredQueue(ring.ringNumber).length}
                            onUpdate={(data) => handleBoutUpdate(ring.ringNumber, data)}
                            onUpdateTotalBouts={(total) => handleUpdateTotalBouts(ring.ringNumber, total)}
                            onStart={() => startRing(ring.ringNumber)}
                            onDelete={user?.role === 'admin' ? () => deleteRing(ring.ringNumber) : undefined}
                            onWinnerSelect={(winner) => handleWinnerSelect(ring.ringNumber, ring.currentBout?.bout || 0, winner)}
                            onTransferSelect={(reason) => handleTransferSelect(ring.ringNumber, ring.currentBout?.bout || 0, reason)}
                            currentEventId={currentEventId}
                            onForceSync={handleForceSync}
                            isAutoPull={autoPullRings[ring.ringNumber] || false}
                            onToggleAutoPull={() => setAutoPullRings(prev => ({ ...prev, [ring.ringNumber]: !prev[ring.ringNumber] }))}
                            user={user}
                          />
                        ))
                      )}
                    </div>
                  </div>

                  {/* Sidebar (Queue Only) */}
                  <div className="space-y-6">
                    {/* Bout Queue */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold flex items-center gap-2 text-slate-800">
                          <Calendar size={20} className="text-red-600" />
                          Upcoming Bouts
                        </h3>
                        <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-1 rounded-full">
                          {getFilteredQueue().length}
                        </span>
                      </div>
                      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col max-h-[400px]">
                        <div className="p-4 overflow-y-auto space-y-3">
                          {getFilteredQueue().length === 0 ? (
                            <p className="text-sm text-slate-500 text-center py-8">No upcoming bouts.</p>
                          ) : (
                            getFilteredQueue().map(item => (
                              <div key={item.id} className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                                <div>
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="text-[11px] font-bold text-slate-600 bg-slate-200 px-2 py-1 rounded-md">Ring {item.data.ring}</span>
                                    <span className="text-[11px] font-bold text-red-600 bg-red-100 px-2 py-1 rounded-md">Bout {item.data.bout}</span>
                                  </div>
                                  <p className="text-sm font-bold text-slate-800">{item.data.blue_name} vs {item.data.red_name}</p>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">{item.data.category}</p>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                  <button 
                                    onClick={() => pullBout(item.id)}
                                    className="p-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors"
                                    title="Pull to Active Ring"
                                  >
                                    <ChevronLeft size={18} />
                                  </button>
                                  <button 
                                    onClick={() => deleteBoutFromQueue(item.id)}
                                    className="p-1.5 text-slate-300 hover:text-red-500 transition-all"
                                    title="Remove from Queue"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
              </div>
            </>
          );
        })()}

          {activeTab === 'standby' && (
            <StandbyView 
              rings={rings} 
              boutQueue={boutQueue} 
              namingMode={ringNamingMode} 
              activeAnnouncement={activeAnnouncement}
              onAnnouncementClose={handleAnnouncementClose}
              currentEventId={currentEventId}
            />
          )}

          {activeTab === 'general' && (
            <OnsiteView 
              rings={rings} 
              boutQueue={boutQueue} 
              namingMode={ringNamingMode} 
              activeAnnouncement={activeAnnouncement}
              onAnnouncementClose={handleAnnouncementClose}
              currentEventId={currentEventId}
            />
          )}

          {activeTab === 'mats' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <LayoutDashboard size={20} className="text-red-600" />
                  {user?.role === 'admin' ? "Live Ring Control Center" : `Ring ${getRingName(Number(user?.assignedRing) || 1)} Controller`}
                  {isSyncing && (
                    <span className="ml-4 flex items-center gap-2 text-green-600 text-[10px] font-black animate-pulse">
                      <div className="w-1.5 h-1.5 bg-green-600 rounded-full" />
                      SYNCING TO SYSTEM
                    </span>
                  )}
                  {!googleSheetUrl && (
                    <span className="ml-4 text-red-500 text-[10px] font-black animate-pulse">
                      SYNC DISABLED (NO URL)
                    </span>
                  )}
                </h3>
                {user?.role === 'admin' && (
                  <button 
                    onClick={() => setShowAddRingModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
                  >
                    <Plus size={18} />
                    Add New Ring
                  </button>
                )}
              </div>
              <div className={user?.role === 'admin' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"}>
                {user?.role === 'admin' ? (
                  rings.map((ring) => (
                    <RingCard 
                      key={ring.ringNumber} 
                      ring={ring} 
                      namingMode={ringNamingMode}
                      categories={categories}
                      clubs={clubs}
                      queueCount={getFilteredQueue(ring.ringNumber).length}
                      onUpdate={(data) => handleBoutUpdate(ring.ringNumber, data)}
                      onUpdateTotalBouts={(total) => handleUpdateTotalBouts(ring.ringNumber, total)}
                      onStart={() => startRing(ring.ringNumber)}
                      onDelete={() => deleteRing(ring.ringNumber)}
                      onWinnerSelect={(winner) => handleWinnerSelect(ring.ringNumber, ring.currentBout?.bout || 0, winner)}
                      onTransferSelect={(reason) => handleTransferSelect(ring.ringNumber, ring.currentBout?.bout || 0, reason)}
                      currentEventId={currentEventId}
                      onForceSync={handleForceSync}
                      isAutoPull={autoPullRings[ring.ringNumber] || false}
                      onToggleAutoPull={() => setAutoPullRings(prev => ({ ...prev, [ring.ringNumber]: !prev[ring.ringNumber] }))}
                      user={user}
                    />
                  ))
                ) : (
                  <>
                    <div className="lg:col-span-2">
                      {rings.filter(r => r.ringNumber === Number(user?.assignedRing)).map((ring) => (
                        <RingCard 
                          key={ring.ringNumber} 
                          ring={ring} 
                          namingMode={ringNamingMode}
                          categories={categories}
                          clubs={clubs}
                          queueCount={getFilteredQueue(ring.ringNumber).length}
                          onUpdate={(data) => handleBoutUpdate(ring.ringNumber, data)}
                          onUpdateTotalBouts={(total) => handleUpdateTotalBouts(ring.ringNumber, total)}
                          onStart={() => startRing(ring.ringNumber)}
                          onWinnerSelect={(winner) => handleWinnerSelect(ring.ringNumber, ring.currentBout?.bout || 0, winner)}
                          onTransferSelect={(reason) => handleTransferSelect(ring.ringNumber, ring.currentBout?.bout || 0, reason)}
                          currentEventId={currentEventId}
                          onForceSync={handleForceSync}
                          isAutoPull={autoPullRings[ring.ringNumber] || false}
                          onToggleAutoPull={() => setAutoPullRings(prev => ({ ...prev, [ring.ringNumber]: !prev[ring.ringNumber] }))}
                          user={user}
                        />
                      ))}
                    </div>
                    <div className="lg:col-span-2 space-y-6">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-bold flex items-center gap-2 text-slate-800">
                            <Calendar size={20} className="text-red-600" />
                            Upcoming Bouts
                          </h3>
                          <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-1 rounded-full">
                            {getFilteredQueue().length}
                          </span>
                        </div>
                        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col max-h-[600px]">
                          <div className="p-4 overflow-y-auto space-y-3">
                            {getFilteredQueue().length === 0 ? (
                              <p className="text-sm text-slate-500 text-center py-8">No upcoming bouts.</p>
                            ) : (
                              getFilteredQueue().map(item => (
                                <div key={item.id} className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                                  <div>
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className="text-[11px] font-bold text-slate-600 bg-slate-200 px-2 py-1 rounded-md">Ring {item.data.ring}</span>
                                      <span className="text-[11px] font-bold text-red-600 bg-red-100 px-2 py-1 rounded-md">Bout {item.data.bout}</span>
                                    </div>
                                    <p className="text-sm font-bold text-slate-800">{item.data.blue_name} vs {item.data.red_name}</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">{item.data.category}</p>
                                  </div>
                                  <div className="flex flex-col items-end gap-2">
                                    <button 
                                      onClick={() => pullBout(item.id)}
                                      className="p-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors"
                                      title="Pull to Active Ring"
                                    >
                                      <ChevronLeft size={18} />
                                    </button>
                                    <button 
                                      onClick={() => deleteBoutFromQueue(item.id)}
                                      className="p-1.5 text-slate-300 hover:text-red-500 transition-all"
                                      title="Remove from Queue"
                                    >
                                      <X size={14} />
                                    </button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {activeTab === 'athletes' && user?.role === 'admin' && (
            <div className="space-y-8">
              <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-xl font-bold">Athlete Database</h3>
                    <p className="text-sm text-slate-500">Verify IC numbers and manage registrations</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="text" 
                        placeholder="Search by name or IC..."
                        className="pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-red-500 outline-none transition-all w-64"
                      />
                    </div>
                    <button 
                      onClick={() => {
                        const name = prompt("Enter Athlete Name:");
                        const ic = prompt("Enter IC Number (YYMMDD-PB-####):");
                        if (name && ic) {
                          setAthletes(prev => [...prev, { name, ic, club: "NEW", category: "TBD", status: "Pending" }]);
                        }
                      }}
                      className="px-4 py-2 bg-slate-900 text-white rounded-lg font-bold text-sm flex items-center gap-2"
                    >
                      <Plus size={18} />
                      Add Athlete
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="pb-4 font-bold text-xs text-slate-400 uppercase tracking-widest">Athlete</th>
                        <th className="pb-4 font-bold text-xs text-slate-400 uppercase tracking-widest">IC Number</th>
                        <th className="pb-4 font-bold text-xs text-slate-400 uppercase tracking-widest">Club</th>
                        <th className="pb-4 font-bold text-xs text-slate-400 uppercase tracking-widest">Category</th>
                        <th className="pb-4 font-bold text-xs text-slate-400 uppercase tracking-widest">Status</th>
                        <th className="pb-4"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {athletes.map((athlete, idx) => (
                        <AthleteRow 
                          key={idx}
                          name={athlete.name} 
                          ic={athlete.ic} 
                          club={athlete.club} 
                          category={athlete.category} 
                          status={athlete.status}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ta-sheet' && (
            <div className="max-w-5xl mx-auto">
              <TASheet 
                boutQueue={boutQueue} 
                rings={rings} 
                currentEventName={getCurrentEventName()} 
                currentEventDate={getCurrentEventDate()}
                onUpdateInspection={handleUpdateMatchInspection}
                viewMode="print"
                selectedRing={sharedSelectedRing}
                setSelectedRing={setSharedSelectedRing}
                selectedMatchNo={sharedSelectedMatchNo}
                setSelectedMatchNo={setSharedSelectedMatchNo}
              />
            </div>
          )}

          {activeTab === 'player-signature' && (
            <div className="max-w-5xl mx-auto">
              <TASheet 
                boutQueue={boutQueue} 
                rings={rings} 
                currentEventName={getCurrentEventName()} 
                currentEventDate={getCurrentEventDate()}
                onUpdateInspection={handleUpdateMatchInspection}
                viewMode="signature"
                selectedRing={sharedSelectedRing}
                setSelectedRing={setSharedSelectedRing}
                selectedMatchNo={sharedSelectedMatchNo}
                setSelectedMatchNo={setSharedSelectedMatchNo}
              />
            </div>
          )}

          {activeTab === 'data-sync' && (
            <div className="max-w-4xl mx-auto">
              <DataUpdater setCategories={setCategories} setClubs={setClubs} />
            </div>
          )}

          {activeTab === 'mapping' && user?.role === 'admin' && (
            <AdminMapping 
              currentEventId={currentEventId} 
              currentEventName={getCurrentEventName()}
              categories={categories} 
              events={events}
              onSyncMatches={handleAdminImportBouts}
              isSyncingMatches={isImportingBouts}
            />
          )}

          {activeTab === 'ai-setup' && user?.role === 'admin' && (
            <AIBracketSetup 
              currentEventId={currentEventId}
              events={events}
              onSuccess={() => setActiveTab('mapping')}
              rings={rings}
              setRings={setRings}
              setBoutQueue={setBoutQueue}
            />
          )}

          {activeTab === 'settings' && user?.role === 'admin' && (
            <div className="max-w-4xl mx-auto space-y-8">
              <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Settings size={24} className="text-slate-400" />
                  System Configuration
                </h3>
                
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <label className="block text-sm font-bold text-slate-700 mb-2">Google Sheets Web App URL</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={googleSheetUrl}
                        onChange={(e) => setGoogleSheetUrl(e.target.value)}
                        placeholder="https://script.google.com/macros/s/.../exec"
                        className="flex-1 px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-red-500 outline-none transition-all"
                      />
                      <button 
                        onClick={() => {
                          localStorage.setItem('tkd_sheet_url', googleSheetUrl);
                          setIsSheetSaved(true);
                          setTimeout(() => setIsSheetSaved(false), 2000);
                        }}
                        className={cn(
                          "px-4 py-2 rounded-lg font-bold text-sm transition-all",
                          isSheetSaved ? "bg-green-600 text-white" : "bg-slate-900 text-white"
                        )}
                      >
                        {isSheetSaved ? "Saved!" : "Save URL"}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-2">
                      Deploy a Google Apps Script as a Web App to receive match data.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-slate-700">Ring Naming Mode</p>
                        <p className="text-[10px] text-slate-500">Numbers vs Alphabets</p>
                      </div>
                      <div className="flex bg-slate-200 p-1 rounded-lg">
                        <button 
                          onClick={() => setRingNamingMode('number')}
                          className={cn(
                            "px-3 py-1 text-[10px] font-bold rounded-md transition-all",
                            ringNamingMode === 'number' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                          )}
                        >
                          1, 2, 3
                        </button>
                        <button 
                          onClick={() => setRingNamingMode('alphabet')}
                          className={cn(
                            "px-3 py-1 text-[10px] font-bold rounded-md transition-all",
                            ringNamingMode === 'alphabet' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                          )}
                        >
                          A, B, C
                        </button>
                      </div>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-slate-700">PDPA Privacy Mode</p>
                        <p className="text-[10px] text-slate-500">Global override for minors</p>
                      </div>
                      <div className="w-12 h-6 bg-red-600 rounded-full relative cursor-pointer">
                        <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
                      </div>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-slate-700">Multilingual Engine</p>
                        <p className="text-[10px] text-slate-500">English & Bahasa Melayu</p>
                      </div>
                      <CheckCircle2 className="text-green-500" size={20} />
                    </div>
                  </div>
                </div>
              </div>

              <DataUpdater setCategories={setCategories} setClubs={setClubs} />

              <EventManagement 
                events={events}
                onAdd={handleAddEvent}
                onDelete={handleDeleteEvent}
              />

              <UserManagement 
                accounts={accounts} 
                onAdd={handleAddAccount} 
                onDelete={handleDeleteAccount} 
                onEditPassword={handleEditPassword}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <IntegrationCard 
                  title="Billplz" 
                  description="Malaysian Payment Gateway" 
                  icon={<CreditCard className="text-blue-600" />}
                />
                <IntegrationCard 
                  title="WhatsApp API" 
                  description="Coach Notifications" 
                  icon={<Bell className="text-green-600" />}
                />
              </div>
            </div>
          )}
        </div>
      </main>

      {showNewBoutModal && (
        <NewBoutModal 
          onClose={() => {
            setShowNewBoutModal(false);
            setNewBoutInitialRing(undefined);
          }}
          onSubmit={(ringNumber, data) => handleNewBoutSubmit(ringNumber, data)}
          categories={categories}
          clubs={clubs}
          rings={rings}
          queue={boutQueue}
          user={user}
          initialRing={newBoutInitialRing}
          currentEventId={currentEventId}
          isSyncing={isSyncing}
        />
      )}

      {finalBoutCheck && (
        <FinalBoutCheckModal 
          ringNumber={finalBoutCheck.ringNumber}
          remainingCount={finalBoutCheck.remainingCount}
          onConfirmFinal={() => {
            setRings(prev => {
              const updated = prev.map(r => r.ringNumber === finalBoutCheck.ringNumber ? { ...r, isFinalBouts: true } : r);
              localStorage.setItem('tkd_rings', JSON.stringify(updated));
              return updated;
            });
            setFinalBoutCheck(null);
          }}
          onAddBout={() => {
            setNewBoutInitialRing(finalBoutCheck.ringNumber);
            setFinalBoutCheck(null);
            setShowNewBoutModal(true);
          }}
        />
      )}

      {showEditResultModal && (
        <EditResultModal
          onClose={() => setShowEditResultModal(false)}
          onSubmit={(ringNumber, boutNumber, winner) => {
            if (googleSheetUrl) {
              setIsSyncing(true);
              updateWinnerInGoogleSheets(
                googleSheetUrl,
                ringNumber,
                boutNumber,
                winner,
                winner
              ).finally(() => setIsSyncing(false));
            }
          }}
          rings={rings}
          user={user}
        />
      )}

      {showEditBoutDetailsModal && (
        <EditBoutDetailsModal
          onClose={() => setShowEditBoutDetailsModal(false)}
          onSubmit={(ringNumber, boutNumber, updates) => {
            // Update in rings
            setRings(prev => prev.map(r => {
              if (r.ringNumber === ringNumber && r.currentBout && r.currentBout.bout.toString() === boutNumber) {
                return {
                  ...r,
                  currentBout: { ...r.currentBout, ...updates }
                };
              }
              return r;
            }));

            // Update in queue
            setBoutQueue(prev => prev.map(q => {
              if (q.data.ring === ringNumber && q.data.bout.toString() === boutNumber) {
                return {
                  ...q,
                  data: { ...q.data, ...updates }
                };
              }
              return q;
            }));

            // Sync to Google Sheets
            if (googleSheetUrl) {
              setIsSyncing(true);
              updateBoutDetailsInGoogleSheets(
                googleSheetUrl,
                ringNumber,
                boutNumber,
                updates.blue_name || '',
                updates.blue_club || '',
                updates.red_name || '',
                updates.red_club || '',
                getCurrentEventName()
              ).finally(() => setIsSyncing(false));
            }
          }}
          rings={rings}
          queue={boutQueue}
          user={user}
        />
      )}

      {!['standby', 'general'].includes(activeTab) && (
        <AnnouncementPopup announcement={activeAnnouncement} onClose={handleAnnouncementClose} />
      )}

      {/* Announcement Input Modal */}
      <AnimatePresence>
        {showAnnouncementInput && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-[110]">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-8 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center shadow-lg shadow-red-900/20">
                    <Bell size={24} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black uppercase tracking-tight italic">Broadcast Message</h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Send to all users instantly</p>
                  </div>
                </div>
                <button onClick={() => setShowAnnouncementInput(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                  <X size={24} />
                </button>
              </div>
              
              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Target Audience</label>
                  <select
                    value={announcementTarget}
                    onChange={(e) => setAnnouncementTarget(e.target.value as 'all' | 'users')}
                    className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-3xl text-sm font-bold text-slate-800 focus:border-red-600 focus:ring-0 outline-none transition-all"
                  >
                    <option value="all">Broadcast to All (Including Viewers)</option>
                    <option value="users">Ring Controllers Only</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Announcement Text</label>
                  <textarea 
                    value={announcementText}
                    onChange={(e) => setAnnouncementText(e.target.value)}
                    placeholder="Enter your message here..."
                    className="w-full h-32 px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-3xl text-lg font-bold text-slate-800 focus:border-red-600 focus:ring-0 outline-none transition-all resize-none"
                  />
                </div>
                
                <div className="flex gap-4">
                  <button 
                    onClick={() => setShowAnnouncementInput(false)}
                    className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSendAnnouncement}
                    disabled={!announcementText.trim()}
                    className="flex-2 py-4 bg-red-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-red-700 disabled:bg-slate-200 disabled:text-slate-400 transition-all shadow-lg shadow-red-200"
                  >
                    Send Broadcast
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {showAddRingModal && (
        <AddRingModal
          onClose={() => setShowAddRingModal(false)}
          onAdd={addRing}
          existingRings={rings.map(r => r.ringNumber)}
          namingMode={ringNamingMode}
        />
      )}

      {missingBoutPrompt && (
        <MissingBoutModal
          prompt={missingBoutPrompt}
          onClose={() => setMissingBoutPrompt(null)}
          onSubmitReason={handleMissingBoutReason}
          onSubmitManual={handleMissingBoutManual}
          categories={categories}
          clubs={clubs}
        />
      )}

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 flex items-center justify-between z-[60] shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        {user?.role === 'admin' && (
          <>
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={cn("flex flex-col items-center gap-1 transition-colors", activeTab === 'dashboard' ? "text-red-600" : "text-slate-400")}
            >
              <LayoutDashboard size={20} />
              <span className="text-[10px] font-bold">Home</span>
            </button>
            <button 
              onClick={() => setActiveTab('mats')}
              className={cn("flex flex-col items-center gap-1 transition-colors", activeTab === 'mats' ? "text-red-600" : "text-slate-400")}
            >
              <Monitor size={20} />
              <span className="text-[10px] font-bold">Rings</span>
            </button>
            <button 
              onClick={() => setActiveTab('athletes')}
              className={cn("flex flex-col items-center gap-1 transition-colors", activeTab === 'athletes' ? "text-red-600" : "text-slate-400")}
            >
              <Users size={20} />
              <span className="text-[10px] font-bold">DB</span>
            </button>
            <button 
              onClick={() => setActiveTab('ai-setup')}
              className={cn("flex flex-col items-center gap-1 transition-colors", activeTab === 'ai-setup' ? "text-red-600" : "text-slate-400")}
            >
              <RefreshCw size={20} />
              <span className="text-[10px] font-bold">AI Setup</span>
            </button>
            <button 
              onClick={() => setActiveTab('settings')}
              className={cn("flex flex-col items-center gap-1 transition-colors", activeTab === 'settings' ? "text-red-600" : "text-slate-400")}
            >
              <Settings size={20} />
              <span className="text-[10px] font-bold">System</span>
            </button>
          </>
        )}
        {user?.role === 'user' && (
          <>
            <button 
              onClick={() => setActiveTab('mats')}
              className={cn("flex flex-col items-center gap-1 transition-colors relative", activeTab === 'mats' ? "text-red-600" : "text-slate-400")}
            >
              <div className="relative">
                <LayoutDashboard size={24} />
                <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full">
                  {rings.find(r => r.ringNumber === Number(user?.assignedRing))?.totalBouts || 0}
                </span>
              </div>
              <span className="text-[10px] font-bold">Ring {getRingName(Number(user?.assignedRing) || 1)}</span>
            </button>
            <button 
              onClick={() => setActiveTab('general')}
              className={cn("flex flex-col items-center gap-1 transition-colors", activeTab === 'general' ? "text-red-600" : "text-slate-400")}
            >
              <Monitor size={24} />
              <span className="text-[10px] font-bold">Live View</span>
            </button>
          </>
        )}
      </nav>

      {user?.role === 'admin' && (
        <TournamentAssistant 
          currentEventId={currentEventId}
          events={events}
          rings={rings}
          boutQueue={boutQueue}
          athletes={athletes}
        />
      )}
    </div>
  );
}

interface MissingBoutModalProps {
  prompt: { ringNumber: number; expectedBout: number; totalBouts: number };
  onClose: () => void;
  onSubmitReason: (ringNumber: number, boutNumber: number, reason: string) => void;
  onSubmitManual: (ringNumber: number, data: MatchData) => void;
  categories: string[];
  clubs: string[];
}

function MissingBoutModal({ prompt, onClose, onSubmitReason, onSubmitManual, categories, clubs }: MissingBoutModalProps) {
  const [mode, setMode] = useState<'reason' | 'manual'>('reason');
  const [reason, setReason] = useState('Walkover');
  const [customReason, setCustomReason] = useState('');

  const [manualData, setManualData] = useState<MatchData>(() => {
    const savedCategory = localStorage.getItem('tkd_last_category') || categories[0] || '';
    const savedBlueClub = localStorage.getItem('tkd_last_blue_club') || '';
    const savedRedClub = localStorage.getItem('tkd_last_red_club') || '';
    
    return {
      ring: prompt.ringNumber,
      bout: prompt.expectedBout,
      category: savedCategory,
      blue_name: '',
      blue_club: savedBlueClub,
      red_name: '',
      red_club: savedRedClub,
      privacy_mode: false
    };
  });

  const handleClearMemory = () => {
    localStorage.removeItem('tkd_last_category');
    localStorage.removeItem('tkd_last_blue_club');
    localStorage.removeItem('tkd_last_red_club');
    setManualData(prev => ({
      ...prev,
      category: '',
      blue_club: '',
      red_club: ''
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'reason') {
      const finalReason = reason === 'Other' ? customReason : reason;
      onSubmitReason(prompt.ringNumber, prompt.expectedBout, finalReason);
    } else {
      localStorage.setItem('tkd_last_category', manualData.category);
      localStorage.setItem('tkd_last_blue_club', manualData.blue_club);
      localStorage.setItem('tkd_last_red_club', manualData.red_club);
      onSubmitManual(prompt.ringNumber, manualData);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black">Queue Empty</h2>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Bout {prompt.expectedBout} of {prompt.totalBouts}</p>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setMode('reason')}
              className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-colors ${mode === 'reason' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Record Reason
            </button>
            <button
              type="button"
              onClick={() => setMode('manual')}
              className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-colors ${mode === 'manual' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Manual Entry
            </button>
          </div>

          <form id="missing-bout-form" onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
            {mode === 'reason' ? (
              <div className="space-y-4">
                <p className="text-sm text-slate-600">
                  There are no upcoming bouts in the queue for Ring {prompt.ringNumber}. Please provide a reason to skip Bout {prompt.expectedBout} and continue.
                </p>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Reason</label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold"
                    autoComplete="off"
                  >
                    <option value="Walkover">Walkover</option>
                    <option value="Player No-Show">Player No-Show</option>
                    <option value="Disqualification">Disqualification</option>
                    <option value="Break / Lunch">Break / Lunch</option>
                    <option value="Other">Other...</option>
                  </select>
                </div>
                {reason === 'Other' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Specify Reason</label>
                    <input
                      type="text"
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold"
                      required
                      placeholder="Enter reason..."
                      autoComplete="off"
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Category</label>
                  <select
                    value={manualData.category}
                    onChange={(e) => setManualData({...manualData, category: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold"
                    required
                    autoComplete="off"
                  >
                    <option value="" disabled>Select Category</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-1">Blue Player</label>
                    <input
                      type="text"
                      value={manualData.blue_name}
                      onChange={(e) => setManualData({...manualData, blue_name: e.target.value})}
                      className="w-full px-3 py-2 bg-white border border-blue-200 rounded-xl text-sm font-bold"
                      placeholder="Name"
                      required
                      autoComplete="off"
                    />
                    <select
                      value={manualData.blue_club}
                      onChange={(e) => setManualData({...manualData, blue_club: e.target.value})}
                      className="w-full px-3 py-2 bg-white border border-blue-200 rounded-xl text-sm font-bold"
                      required
                      autoComplete="off"
                    >
                      <option value="" disabled>Select Club</option>
                      {clubs.map(club => (
                        <option key={club} value={club}>{club}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-red-500 uppercase tracking-widest ml-1">Red Player</label>
                    <input
                      type="text"
                      value={manualData.red_name}
                      onChange={(e) => setManualData({...manualData, red_name: e.target.value})}
                      className="w-full px-3 py-2 bg-white border border-red-200 rounded-xl text-sm font-bold"
                      placeholder="Name"
                      required
                      autoComplete="off"
                    />
                    <select
                      value={manualData.red_club}
                      onChange={(e) => setManualData({...manualData, red_club: e.target.value})}
                      className="w-full px-3 py-2 bg-white border border-red-200 rounded-xl text-sm font-bold"
                      required
                      autoComplete="off"
                    >
                      <option value="" disabled>Select Club</option>
                      {clubs.map(club => (
                        <option key={club} value={club}>{club}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </form>

          <div className="flex gap-3 pt-2">
            {mode === 'manual' && (
              <button
                type="button"
                onClick={handleClearMemory}
                className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-black text-xs uppercase tracking-widest transition-colors"
                title="Clear remembered category and clubs"
              >
                Clear Memory
              </button>
            )}
            <button
              type="submit"
              form="missing-bout-form"
              className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-red-200 transition-all"
            >
              {mode === 'reason' ? 'Record & Continue' : 'Start Bout'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function NavItem({ icon, label, active, onClick, badge }: { icon: React.ReactNode, label: string, active?: boolean, onClick: () => void, badge?: React.ReactNode }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200",
        active 
          ? "bg-red-50 text-red-600 shadow-sm" 
          : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
      )}
    >
      <div className="flex items-center gap-3">
        {icon}
        {label}
      </div>
      {badge !== undefined && (
        <span className={cn(
          "px-2 py-0.5 rounded-full text-[10px] font-black",
          active ? "bg-red-100 text-red-600" : "bg-slate-200 text-slate-500"
        )}>
          {badge}
        </span>
      )}
    </button>
  );
}

function StatCard({ label, value, trend }: { label: string, value: string, trend: string }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <h4 className="text-3xl font-black text-slate-800">{value}</h4>
        <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">{trend}</span>
      </div>
    </div>
  );
}

interface RingCardProps {
  key?: React.Key;
  ring: RingStatus;
  namingMode: 'number' | 'alphabet';
  categories: string[];
  clubs: string[];
  queueCount?: number;
  onUpdate: (data: MatchData) => void;
  onUpdateTotalBouts?: (total: number) => void;
  onStart?: () => void;
  onDelete?: () => void;
  onWinnerSelect?: (winner: string) => void;
  onTransferSelect?: (reason: string) => void;
  isAutoPull?: boolean;
  onToggleAutoPull?: () => void;
  user?: UserAccount | null;
}

interface EditResultModalProps {
  onClose: () => void;
  onSubmit: (ringNumber: number, boutNumber: string | number, winner: string) => void;
  rings: RingStatus[];
  user: UserAccount | null;
}

function EditResultModal({ onClose, onSubmit, rings, user }: EditResultModalProps) {
  const defaultRing = user?.role === 'admin' ? (rings[0]?.ringNumber || 1) : (Number(user?.assignedRing) || 1);
  
  const [formData, setFormData] = useState({
    ring: defaultRing,
    bout: '',
    winner: 'Blue'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.bout) return;
    onSubmit(formData.ring, formData.bout, formData.winner);
    onClose();
  };

  const availableRings = user?.role === 'admin' 
    ? rings 
    : rings.filter(r => r.ringNumber === Number(user?.assignedRing));

  const displayRings = availableRings.length > 0 
    ? availableRings 
    : (user?.assignedRing ? [{ ringNumber: Number(user.assignedRing) } as RingStatus] : rings);

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <Edit2 size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">Edit Result</h2>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Update Winner</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Ring</label>
              <select 
                value={formData.ring || ''}
                onChange={(e) => setFormData({...formData, ring: parseInt(e.target.value)})}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold"
                required
              >
                <option value="" disabled>Select Ring</option>
                {displayRings.map(r => (
                  <option key={r.ringNumber} value={r.ringNumber}>Ring {r.ringNumber}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Bout Number</label>
              <input 
                type="text" 
                value={formData.bout}
                onChange={(e) => setFormData({...formData, bout: e.target.value})}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Winner</label>
            <select 
              value={formData.winner}
              onChange={(e) => setFormData({...formData, winner: e.target.value})}
              className={cn(
                "w-full px-4 py-3 border rounded-xl text-sm font-bold transition-colors",
                formData.winner === 'Blue' ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-red-50 border-red-200 text-red-700"
              )}
              required
            >
              <option value="Blue">Blue Corner</option>
              <option value="Red">Red Corner</option>
            </select>
          </div>

          <button 
            type="submit"
            className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black uppercase tracking-widest text-sm transition-all shadow-lg shadow-slate-200"
          >
            Update Result
          </button>
        </form>
      </motion.div>
    </div>
  );
}

interface FinalBoutCheckModalProps {
  ringNumber: number;
  remainingCount: number;
  onConfirmFinal: () => void;
  onAddBout: () => void;
}

function FinalBoutCheckModal({ ringNumber, remainingCount, onConfirmFinal, onAddBout }: FinalBoutCheckModalProps) {
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="p-6 bg-red-600 text-white flex items-center gap-4">
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
            <AlertTriangle size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight">Upcoming Bouts Alert</h2>
            <p className="text-xs text-red-100 font-bold uppercase tracking-widest">Ring {ringNumber}</p>
          </div>
        </div>
        
        <div className="p-8 space-y-6">
          <div className="space-y-2 text-center">
            <p className="text-slate-600 font-medium">
              There are only <span className="text-red-600 font-black">{remainingCount}</span> upcoming bouts remaining for this ring.
            </p>
            <p className="text-sm text-slate-500">
              A minimum of 3 standby bouts is required unless these are the final bouts of the session.
            </p>
          </div>
          
          <div className="flex flex-col gap-3">
            <button 
              onClick={onConfirmFinal}
              className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
            >
              Yes, these are final bouts
            </button>
            <button 
              onClick={onAddBout}
              className="w-full py-4 bg-white text-slate-900 border-2 border-slate-200 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
            >
              No, add more bouts
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

interface NewBoutModalProps {
  onClose: () => void;
  onSubmit: (ringNumber: number, data: MatchData) => void;
  categories: string[];
  clubs: string[];
  rings: RingStatus[];
  queue: { id: string; data: MatchData }[];
  user: UserAccount | null;
  initialRing?: number;
  currentEventId: string | null;
  isSyncing: boolean;
}

function NewBoutModal({ onClose, onSubmit, categories, clubs, rings, queue, user, initialRing, currentEventId, isSyncing }: NewBoutModalProps) {
  const defaultRing = initialRing || (user?.role === 'admin' ? (rings[0]?.ringNumber || 1) : (Number(user?.assignedRing) || 1));
  
  const getNextBoutNumber = (ringNum: number) => {
    let maxBout = ringNum * 1000;
    let foundAny = false;

    queue.forEach(q => {
      if (q.data.ring === ringNum && (!q.data.eventId || q.data.eventId === currentEventId)) {
        let boutNum = parseInt(q.data.bout.toString().replace(/\D/g, '')) || 0;
        if (boutNum < 1000) {
          boutNum = ringNum * 1000 + boutNum;
        }
        if (boutNum > maxBout) {
          maxBout = boutNum;
          foundAny = true;
        }
      }
    });

    const ringStatus = rings.find(r => r.ringNumber === ringNum);
    if (ringStatus?.currentBout && (!ringStatus.currentBout.eventId || ringStatus.currentBout.eventId === currentEventId)) {
      let boutNum = parseInt(ringStatus.currentBout.bout.toString().replace(/\D/g, '')) || 0;
      if (boutNum < 1000) {
        boutNum = ringNum * 1000 + boutNum;
      }
      if (boutNum > maxBout) {
        maxBout = boutNum;
        foundAny = true;
      }
    }
    
    // Also check nextBoutNumber from ringStatus to ensure we don't reuse completed bouts
    if (ringStatus?.nextBoutNumber) {
      let nextBout = ringStatus.nextBoutNumber;
      if (nextBout < 1000) {
        nextBout = ringNum * 1000 + nextBout;
      }
      if (nextBout > maxBout) {
        maxBout = nextBout - 1; // maxBout is the highest existing, so nextBout - 1
        foundAny = true;
      }
    }
    
    return foundAny ? maxBout + 1 : ringNum * 1000 + 1;
  };

  const [formData, setFormData] = useState<MatchData>(() => {
    return {
      ring: defaultRing,
      bout: getNextBoutNumber(defaultRing),
      category: '',
      blue_name: '',
      blue_club: '',
      red_name: '',
      red_club: '',
      privacy_mode: false
    };
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleRingChange = (newRing: number) => {
    setFormData(prev => ({
      ...prev,
      ring: newRing,
      bout: getNextBoutNumber(newRing)
    }));
  };

  const handleClearMemory = () => {
    setFormData(prev => ({
      ...prev,
      category: '',
      blue_club: '',
      red_club: ''
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const normalizeBout = (ring: number, bout: string | number) => {
      let num = parseInt(bout.toString().replace(/\D/g, '')) || 0;
      if (num < 1000) num = ring * 1000 + num;
      return num.toString() + bout.toString().replace(/[0-9]/g, '');
    };

    const targetBout = normalizeBout(formData.ring, formData.bout);

    // Check if bout number already exists in queue or current bout for THIS event
    const inQueue = queue.find(q => 
      q.data.ring === formData.ring && 
      normalizeBout(q.data.ring, q.data.bout) === targetBout &&
      (currentEventId ? q.data.eventId === currentEventId : !q.data.eventId)
    );
    
    const inCurrent = rings.find(r => 
      r.ringNumber === formData.ring && 
      r.currentBout && 
      normalizeBout(r.ringNumber, r.currentBout.bout) === targetBout &&
      (currentEventId ? r.currentBout.eventId === currentEventId : !r.currentBout.eventId)
    );
                       
    if (inQueue) {
      setErrorMsg(`Bout ${targetBout} is already in the Waiting Queue for Ring ${formData.ring}.`);
      return;
    }
    if (inCurrent) {
      setErrorMsg(`Bout ${targetBout} is currently the Active Match in Ring ${formData.ring}.`);
      return;
    }
    
    // Update formData with normalized bout number before submitting
    const finalData = { ...formData, bout: targetBout, eventId: currentEventId || null };
    
    onSubmit(formData.ring, finalData);
    onClose();
  };

  const availableRings = user?.role === 'admin' 
    ? rings 
    : rings.filter(r => r.ringNumber === Number(user?.assignedRing));

  const displayRings = availableRings.length > 0 
    ? availableRings 
    : (user?.assignedRing ? [{ ringNumber: Number(user.assignedRing) } as RingStatus] : rings);

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
      >
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center">
              <Plus size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">Create New Bout</h2>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Manual Entry</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6" autoComplete="off">
          {errorMsg && (
            <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-bold border border-red-100">
              {errorMsg}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Ring</label>
              <select 
                value={formData.ring}
                onChange={(e) => handleRingChange(parseInt(e.target.value))}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold"
                required
                autoComplete="off"
              >
                {displayRings.map(r => (
                  <option key={r.ringNumber} value={r.ringNumber}>Ring {r.ringNumber}</option>
                ))}
              </select>
            </div>
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Bout Number</label>
                  <input 
                    type="text" 
                    value={formData.bout}
                    onChange={(e) => setFormData({...formData, bout: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold"
                    required
                    autoComplete="off"
                  />
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const boutNumStr = formData.bout.toString();
                    if (!boutNumStr) return;
                    
                    try {
                      // Fetch bracket data from Firestore
                      const bracketRef = doc(db, 'tournaments', currentEventId || 'default', 'bracket', 'data');
                      const bracketSnap = await getDoc(bracketRef);
                      
                      if (bracketSnap.exists()) {
                        const bracketData = bracketSnap.data().matches;
                        if (bracketData && Array.isArray(bracketData)) {
                          const match = bracketData.find(m => m.bout.toString() === boutNumStr);
                          if (match) {
                            setFormData(prev => ({
                              ...prev,
                              category: match.category || prev.category,
                              blue_name: match.blue_name || prev.blue_name,
                              blue_club: match.blue_club || prev.blue_club,
                              red_name: match.red_name || prev.red_name,
                              red_club: match.red_club || prev.red_club,
                            }));
                            setErrorMsg(null);
                          } else {
                            setErrorMsg(`Bout ${boutNumStr} not found in bracket data.`);
                          }
                        }
                      }
                    } catch (err) {
                      console.error("Error auto-filling bout:", err);
                      setErrorMsg("Failed to auto-fill bout data.");
                    }
                  }}
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors h-[46px] flex items-center justify-center"
                  title="Auto-fill from bracket data"
                >
                  <Search size={16} />
                </button>
              </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Category / Weight</label>
            <input 
              type="text" 
              list="new-bout-cats"
              value={formData.category}
              onChange={(e) => setFormData({...formData, category: e.target.value})}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold"
              placeholder="Select or type category (e.g. -45kg)"
              required
              autoComplete="off"
            />
            <datalist id="new-bout-cats">
              {categories.map(cat => <option key={cat} value={cat} />)}
            </datalist>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Blue Corner */}
            <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-blue-600 rounded-full" />
                <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Blue Corner</span>
              </div>
              <input 
                type="text" 
                value={formData.blue_name}
                onChange={(e) => setFormData({...formData, blue_name: e.target.value})}
                className="w-full px-3 py-2 bg-white border border-blue-200 rounded-xl text-sm font-bold"
                placeholder="Player Name"
                required
                autoComplete="off"
              />
              <input 
                type="text" 
                list="new-bout-clubs"
                value={formData.blue_club}
                onChange={(e) => setFormData({...formData, blue_club: e.target.value})}
                className="w-full px-3 py-2 bg-white border border-blue-200 rounded-xl text-sm font-bold"
                placeholder="Club Name"
                required
                autoComplete="off"
              />
            </div>

            {/* Red Corner */}
            <div className="p-4 bg-red-50/50 rounded-2xl border border-red-100 space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-red-600 rounded-full" />
                <span className="text-[10px] font-black text-red-600 uppercase tracking-widest">Red Corner</span>
              </div>
              <input 
                type="text" 
                value={formData.red_name}
                onChange={(e) => setFormData({...formData, red_name: e.target.value})}
                className="w-full px-3 py-2 bg-white border border-red-200 rounded-xl text-sm font-bold"
                placeholder="Player Name"
                required
                autoComplete="off"
              />
              <input 
                type="text" 
                list="new-bout-clubs"
                value={formData.red_club}
                onChange={(e) => setFormData({...formData, red_club: e.target.value})}
                className="w-full px-3 py-2 bg-white border border-red-200 rounded-xl text-sm font-bold"
                placeholder="Club Name"
                required
                autoComplete="off"
              />
            </div>
          </div>
          <datalist id="new-bout-clubs">
            {clubs.map(club => <option key={club} value={club} />)}
          </datalist>

          <div className="pt-4 flex gap-3">
            <button 
              type="submit"
              className="flex-1 py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-red-200 transition-all flex items-center justify-center gap-2"
            >
              {isSyncing ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  Syncing to Cloud...
                </>
              ) : (
                "Create Bout & Sync"
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

interface AddRingModalProps {
  onClose: () => void;
  onAdd: (ringNumber: number) => void;
  existingRings: number[];
  namingMode: 'number' | 'alphabet';
}

function AddRingModal({ onClose, onAdd, existingRings, namingMode }: AddRingModalProps) {
  const availableRings = Array.from({ length: 20 }, (_, i) => i + 1).filter(r => !existingRings.includes(r));
  const [selectedRing, setSelectedRing] = useState<number>(availableRings[0] || 1);

  useEffect(() => {
    if (availableRings.length > 0 && !availableRings.includes(selectedRing)) {
      setSelectedRing(availableRings[0]);
    }
  }, [availableRings, selectedRing]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (availableRings.includes(selectedRing)) {
      onAdd(selectedRing);
      onClose();
    }
  };

  const getRingName = (num: number) => namingMode === 'number' ? num.toString() : String.fromCharCode(64 + num);

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
          <h2 className="text-xl font-black">Add New Ring</h2>
          <button type="button" onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {availableRings.length === 0 ? (
            <p className="text-sm text-slate-500 text-center">All 20 rings are already active.</p>
          ) : (
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Select Ring Number</label>
              <select 
                value={selectedRing}
                onChange={(e) => setSelectedRing(parseInt(e.target.value))}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-500"
              >
                {availableRings.map(r => (
                  <option key={r} value={r}>Ring {getRingName(r)}</option>
                ))}
              </select>
            </div>
          )}
          
          <div className="flex gap-3 pt-4">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-black text-xs uppercase tracking-widest transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={availableRings.length === 0}
              className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-red-200 transition-all"
            >
              Add Ring
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function RingCard({ ring, namingMode, categories, clubs, queueCount = 0, onUpdate, onUpdateTotalBouts, onStart, onDelete, onWinnerSelect, onTransferSelect, currentEventId, onForceSync, isAutoPull, onToggleAutoPull, user }: RingCardProps & { currentEventId?: string | null, onForceSync?: (data: MatchData) => void }) {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isFinalBoutSelection, setIsFinalBoutSelection] = useState(false);
  const [transferReason, setTransferReason] = useState('');
  const [isSyncingLocal, setIsSyncingLocal] = useState(false);
  const [showInspectionWarning, setShowInspectionWarning] = useState(false);
  
  // Only show current bout if it belongs to the current event
  const current = ring.currentBout && (!currentEventId || ring.currentBout.eventId === currentEventId) ? ring.currentBout : null;

  useEffect(() => {
    if (current) {
      if (!current.blue_inspected || !current.red_inspected) {
        setShowInspectionWarning(true);
      } else {
        setShowInspectionWarning(false);
      }
    } else {
      setShowInspectionWarning(false);
    }
  }, [current?.bout, current?.blue_inspected, current?.red_inspected]);
  
  const ringName = namingMode === 'number' ? ring.ringNumber.toString() : String.fromCharCode(64 + ring.ringNumber);
  
  const progress = ring.totalBouts && current ? Math.min(100, (getBoutNumber(current.bout) / ring.totalBouts) * 100) : 0;

  return (
    <div className="relative bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:border-red-200 transition-colors">
      <div className="p-4 bg-slate-900 flex items-center justify-between text-white">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center font-black text-sm">
            {ringName}
          </div>
          <div>
            <span className="font-bold text-sm uppercase tracking-wider block leading-none">Ring {ringName}</span>
            <div className="flex items-center gap-2 mt-1">
              {ring.totalBouts && (
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  {current?.bout || 0} / {ring.totalBouts} Bouts
                  {onUpdateTotalBouts && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); onUpdateTotalBouts(ring.totalBouts! + 1); }}
                      className="p-0.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 transition-colors"
                      title="Add 1 bout to total"
                    >
                      <Plus size={10} />
                    </button>
                  )}
                </span>
              )}
              {current && onForceSync && (
                <button 
                  onClick={async (e) => {
                    e.stopPropagation();
                    setIsSyncingLocal(true);
                    await onForceSync(current);
                    setIsSyncingLocal(false);
                  }}
                  disabled={isSyncingLocal}
                  className="text-[9px] font-black text-blue-400 hover:text-blue-300 uppercase tracking-widest flex items-center gap-1 disabled:opacity-50"
                  title="Force sync this bout to Google Sheets"
                >
                  <RefreshCw size={10} className={isSyncingLocal ? "animate-spin" : ""} />
                  {isSyncingLocal ? "Syncing..." : "Sync"}
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onToggleAutoPull && (
            <button
              onClick={onToggleAutoPull}
              className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest transition-colors ${isAutoPull ? 'bg-green-500/20 text-green-400' : 'bg-slate-800 text-slate-400'}`}
              title={isAutoPull ? "Auto-pull is ON" : "Auto-pull is OFF"}
            >
              {isAutoPull ? "Auto" : "Manual"}
            </button>
          )}
          {onDelete && (
            <div className="flex items-center">
              {isConfirmingDelete ? (
                <div className="flex items-center gap-1 bg-red-600 rounded px-1 py-0.5 mr-1">
                  <button 
                    onClick={onDelete}
                    className="text-[8px] font-black uppercase hover:underline"
                  >
                    Confirm
                  </button>
                  <button 
                    onClick={() => setIsConfirmingDelete(false)}
                    className="text-[8px] font-black uppercase opacity-50 hover:opacity-100"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setIsConfirmingDelete(true)}
                  className="p-1.5 hover:bg-red-500/20 text-slate-400 hover:text-red-500 rounded transition-colors mr-1"
                  title="Delete Ring"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          )}
          {!current && (
            <button 
              onClick={onStart}
              className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-[10px] font-bold uppercase transition-colors"
            >
              Start Ring
            </button>
          )}
        </div>
      </div>

      {ring.totalBouts && (
        <div className="h-1 bg-slate-800 w-full">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className="h-full bg-red-600"
          />
        </div>
      )}
      
      <div className="p-6 space-y-6">
        {current ? (
          <>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Bout {formatBoutNumber(ring.ringNumber, current.bout)} {ring.totalBouts ? `of ${ring.totalBouts}` : ''}
                </span>
                <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded uppercase">Live</span>
              </div>
              
              <div className="flex items-center gap-4">
                <FighterSide color="blue" name={current.blue_name} club={current.blue_club} privacy={current.privacy_mode} inspected={current.blue_inspected} />
                <div className="text-xs font-black text-slate-300 italic">VS</div>
                <FighterSide color="red" name={current.red_name} club={current.red_club} privacy={current.privacy_mode} inspected={current.red_inspected} />
              </div>
              
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield size={14} className={current.privacy_mode ? "text-red-500" : "text-green-500"} />
                  <span className="text-[10px] font-bold text-slate-500 uppercase">{current.category}</span>
                </div>
                {current.privacy_mode && (
                  <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded">PDPA ACTIVE</span>
                )}
              </div>

              {onWinnerSelect && (
                <div className="pt-4 border-t border-slate-100">
                  <p className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Select Winner</p>
                  <div className="flex gap-3 mb-4">
                    <button 
                      onClick={() => onWinnerSelect('Blue')}
                      className="flex-1 py-3 md:py-2 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-xl md:rounded-lg font-black md:font-bold text-xs uppercase transition-all border border-blue-200 hover:border-blue-600 active:scale-95"
                    >
                      Blue Wins
                    </button>
                    <button 
                      onClick={() => onWinnerSelect('Red')}
                      className="flex-1 py-3 md:py-2 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-xl md:rounded-lg font-black md:font-bold text-xs uppercase transition-all border border-red-200 hover:border-red-600 active:scale-95"
                    >
                      Red Wins
                    </button>
                  </div>
                  
                  {onTransferSelect && (
                    <div className="space-y-2">
                      <p className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Transfer Bout</p>
                      <div className="flex gap-2">
                        <input 
                          type="text"
                          value={transferReason}
                          onChange={(e) => setTransferReason(e.target.value)}
                          placeholder="Reason (e.g. Ring 2)"
                          className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-red-500"
                        />
                        <button 
                          onClick={() => {
                            if (transferReason.trim()) {
                              onTransferSelect(transferReason);
                              setTransferReason('');
                            }
                          }}
                          disabled={!transferReason.trim()}
                          className="px-6 py-3 md:px-4 md:py-2 bg-slate-800 text-white rounded-xl md:rounded-lg text-xs font-black md:font-bold uppercase tracking-widest hover:bg-slate-900 disabled:bg-slate-200 disabled:text-slate-400 transition-all active:scale-95"
                        >
                          Send
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
              <Trophy size={32} />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-800">Ring is currently inactive</p>
              <p className="text-xs text-slate-500">Set total bouts and start the session</p>
            </div>
            
            <div className="w-full max-w-[200px] space-y-4">
              <div className="space-y-1 text-left">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Total Bouts Today</label>
                {(() => {
                  const isSessionInProgress = ring.nextBoutNumber && ring.nextBoutNumber > 1 && ring.totalBouts && ring.nextBoutNumber <= ring.totalBouts;
                  return (
                    <>
                      <div className="flex items-center gap-2">
                        <input 
                          type="number" 
                          value={ring.totalBouts || ''}
                          onChange={(e) => onUpdateTotalBouts?.(parseInt(e.target.value) || 0)}
                          disabled={!!isSessionInProgress}
                          className={cn(
                            "w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-center",
                            isSessionInProgress && "opacity-50 cursor-not-allowed bg-slate-100"
                          )}
                          placeholder="e.g. 50"
                        />
                        {isSessionInProgress && (
                          <button 
                            type="button"
                            onClick={() => onUpdateTotalBouts?.((ring.totalBouts || 0) + 1)}
                            className="p-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl transition-colors flex-shrink-0"
                            title="Add 1 bout"
                          >
                            <Plus size={20} />
                          </button>
                        )}
                      </div>
                      {isSessionInProgress && (
                        <p className="text-[9px] text-red-500 font-bold uppercase mt-1 text-center">
                          Finish current session ({ring.nextBoutNumber - 1}/{ring.totalBouts}) to change
                        </p>
                      )}
                    </>
                  );
                })()}
              </div>
              
              {(!ring.totalBouts || ring.totalBouts < 3 || queueCount < 3) && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={isFinalBoutSelection}
                    onChange={(e) => setIsFinalBoutSelection(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                  />
                  <span className="text-xs font-bold text-slate-600">Final bout selection</span>
                </label>
              )}

              <button 
                onClick={onStart}
                disabled={!ring.totalBouts || ((ring.totalBouts < 3 || queueCount < 3) && !isFinalBoutSelection)}
                className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-red-200 transition-all"
              >
                Start Ring Session
              </button>
            </div>
          </div>
        )}
      </div>

      {showInspectionWarning && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl overflow-hidden max-w-[280px] w-full"
          >
            <div className="p-4 text-center space-y-3">
              <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Inspection Required</h3>
                <p className="text-[10px] font-bold text-slate-500 mt-1 leading-relaxed">
                  One or both players have not passed inspection. Please ensure they are inspected before starting the bout.
                </p>
              </div>
              <button
                onClick={() => setShowInspectionWarning(false)}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-colors"
              >
                Acknowledge
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function FighterSide({ color, name, club, privacy, inspected }: { color: 'blue' | 'red', name: string, club: string, privacy: boolean, inspected?: boolean }) {
  const getDynamicFontSize = (name: string) => {
    const len = name.length;
    if (len <= 15) return 'text-[18px]';
    if (len <= 25) return 'text-[16px]';
    if (len <= 35) return 'text-[14px]';
    return 'text-[12px]';
  };

  return (
    <div className="flex-1 space-y-1">
      <div className={cn(
        "flex items-center gap-1 text-[9px] font-black uppercase tracking-widest mb-1",
        inspected 
          ? (color === 'blue' ? "text-[#00a2e8]" : "text-[#ed1c24]")
          : "text-slate-400"
      )}>
        INSPECTION {inspected ? <Check size={12} strokeWidth={4} /> : <X size={12} strokeWidth={4} />}
      </div>
      <div className={cn(
        "h-1 w-full rounded-full mb-2",
        color === 'blue' ? "bg-[#00a2e8]" : "bg-[#ed1c24]"
      )} />
      <p className={cn(
        "font-black text-slate-800 leading-tight line-clamp-3",
        getDynamicFontSize(privacy ? "---" : name)
      )}>
        {privacy ? "---" : name}
      </p>
      <p className="text-[10px] font-bold text-slate-400 uppercase">{club}</p>
    </div>
  );
}

function QueueItem({ label, data }: { label: string, data: MatchData | null }) {
  return (
    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
      <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">{label}</p>
      {data ? (
        <div className="space-y-0.5">
          <p className="text-[10px] font-bold text-slate-700 truncate">
            {data.privacy_mode ? "---" : data.blue_name} vs {data.privacy_mode ? "---" : data.red_name}
          </p>
          <p className="text-[8px] font-medium text-slate-400 uppercase">{data.blue_club} / {data.red_club}</p>
        </div>
      ) : (
        <p className="text-[10px] font-medium text-slate-300">TBD</p>
      )}
    </div>
  );
}

function IntegrationCard({ title, description, icon }: { title: string, description: string, icon: React.ReactNode }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 flex items-center gap-4 shadow-sm hover:shadow-md transition-all cursor-pointer">
      <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center">
        {icon}
      </div>
      <div>
        <h4 className="font-bold text-slate-800">{title}</h4>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      <ChevronRight className="ml-auto text-slate-300" size={20} />
    </div>
  );
}

interface AthleteRowProps {
  key?: React.Key;
  name: string;
  ic: string;
  club: string;
  category: string;
  status: 'Verified' | 'Pending';
}

function AthleteRow({ name, ic, club, category, status }: AthleteRowProps) {
  return (
    <tr className="group hover:bg-slate-50 transition-colors">
      <td className="py-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs">
            {name.charAt(0)}
          </div>
          <span className="font-bold text-slate-700">{name}</span>
        </div>
      </td>
      <td className="py-4 font-mono text-xs text-slate-500">{ic}</td>
      <td className="py-4 font-bold text-slate-600">{club}</td>
      <td className="py-4 text-xs font-medium text-slate-500">{category}</td>
      <td className="py-4">
        <span className={cn(
          "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
          status === 'Verified' ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"
        )}>
          {status}
        </span>
      </td>
      <td className="py-4 text-right">
        <button className="p-2 text-slate-300 hover:text-slate-600 transition-colors">
          <ChevronRight size={18} />
        </button>
      </td>
    </tr>
  );
}

interface PublicRingCardProps {
  key?: React.Key;
  ring: RingStatus;
  namingMode: 'number' | 'alphabet';
  queueCount?: number;
}

function StandbyView({ rings, boutQueue, namingMode, activeAnnouncement, onAnnouncementClose, currentEventId }: { rings: RingStatus[], boutQueue: {id: string, data: MatchData}[], namingMode: 'number' | 'alphabet', activeAnnouncement?: { message: string, id: string } | null, onAnnouncementClose?: () => void, currentEventId: string | null }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [currentPage, setCurrentPage] = React.useState(0);
  const ringsPerPage = 4;
  const totalPages = Math.ceil(rings.length / ringsPerPage);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      if (!document.fullscreenElement) {
        setCurrentPage(0);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (totalPages > 1) {
      interval = setInterval(() => {
        setCurrentPage((prev) => (prev + 1) % totalPages);
      }, 30000); // 30 seconds
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [totalPages]);

  const displayedRings = rings.slice(currentPage * ringsPerPage, (currentPage + 1) * ringsPerPage);

  return (
    <div 
      ref={containerRef}
      className={cn(
        "bg-[#0a0e1a] min-h-full shadow-2xl border border-slate-800 transition-all duration-500 flex flex-col relative overflow-hidden",
        isFullscreen ? "rounded-none p-0" : "rounded-[2.5rem] p-6 space-y-8"
      )}
      style={{
        backgroundImage: `radial-gradient(circle at 2px 2px, rgba(255,255,255,0.03) 1px, transparent 0)`,
        backgroundSize: '4px 4px'
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 bg-[#1a2235]/50 border-b border-white/10 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center shadow-lg shadow-red-900/20">
            <Trophy size={24} className="text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic leading-none">Standby View</h2>
            <p className="text-[10px] font-black text-white uppercase tracking-[0.3em] mt-1">Live Tournament Standby Monitoring</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <button 
            onClick={toggleFullScreen}
            className="p-3 bg-slate-900 text-white hover:bg-slate-800 rounded-2xl border border-slate-800 transition-all group"
          >
            {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
          </button>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-4">
        {displayedRings.map((ring) => {
          const ringQueue = boutQueue
            .filter(q => 
              q.data.ring === ring.ringNumber && 
              (!q.data.eventId || q.data.eventId === currentEventId)
            )
            .sort((a, b) => {
              const boutA = parseInt(normalizeBoutNumber(a.data.bout)) || 0;
              const boutB = parseInt(normalizeBoutNumber(b.data.bout)) || 0;
              return boutA - boutB;
            })
            .slice(0, 3);
          const current = ring.currentBout;
          const standby = ringQueue;
          const ringName = namingMode === 'number' ? ring.ringNumber.toString() : String.fromCharCode(64 + ring.ringNumber);
          
          return (
            <div key={ring.ringNumber} className="flex gap-1 h-48">
              {/* Left: Current Match */}
              <div className="flex-[3] flex flex-col bg-[#0d1526] border border-white/10 rounded-lg overflow-hidden">
                {/* Header */}
                <div className="grid grid-cols-12 bg-[#1a2235] border-b border-white/10 py-2 px-4">
                  <div className="col-span-2 bg-lime-500 text-slate-950 text-[16px] font-black px-3 py-1 rounded flex items-center justify-center mr-4">
                    {current?.category.split(' ')[0] || "---"}
                  </div>
                  <div className="col-span-10 text-white text-[18px] font-bold flex items-center">
                    {current?.category || "---"}
                  </div>
                </div>
                {/* Content */}
                <div className="flex-1 grid grid-cols-12">
                  {/* Bout Num */}
                  <div className="col-span-2 flex items-center justify-center text-3xl font-black text-white border-r border-white/10 bg-[#161f33]">
                    {current ? formatBoutNumber(ring.ringNumber, current.bout) : "---"}
                  </div>
                  {/* Players */}
                  <div className="col-span-10 flex flex-col">
                    <div className="flex-1 bg-blue-600/90 flex flex-col justify-center px-4 border-b border-white/10 relative">
                      <p className="text-[10px] font-bold text-blue-200 uppercase leading-none mb-1">{current?.blue_club || "---"}</p>
                      <h4 className="text-[30px] font-black text-white uppercase leading-none truncate">{current?.blue_name || "---"}</h4>
                    </div>
                    <div className="flex-1 bg-red-600/90 flex flex-col justify-center px-4 relative">
                      <p className="text-[10px] font-bold text-red-200 uppercase leading-none mb-1">{current?.red_club || "---"}</p>
                      <h4 className="text-[30px] font-black text-white uppercase leading-none truncate">{current?.red_name || "---"}</h4>
                    </div>
                  </div>
                </div>
              </div>

              {/* Middle: Ring Num */}
              <div className="flex-1 flex flex-col items-center justify-center">
                <span className="text-9xl font-black text-white italic tracking-tighter leading-none">{ringName}</span>
                <span className="text-[18px] font-black text-white uppercase tracking-[0.5em] mt-4">COURT</span>
              </div>

              {/* Right: Standby Queue */}
              <div className="flex-[2] flex flex-col gap-1">
                {[0, 1, 2].map((idx) => {
                  const b = standby[idx];
                  return (
                    <div key={idx} className="flex-1 grid grid-cols-12 bg-[#0d1526] border border-white/10 rounded overflow-hidden">
                      <div className="col-span-3 flex items-center justify-center text-xl font-black text-white bg-[#161f33] border-r border-white/10">
                        {b ? formatBoutNumber(ring.ringNumber, b.data.bout) : "---"}
                      </div>
                      <div className="col-span-5 bg-blue-600/80 flex flex-col justify-center px-3 border-r border-white/10 relative">
                        <span className="text-[8px] font-bold text-blue-200 uppercase leading-none">{b?.data.blue_club || "---"}</span>
                        <span className="text-[16px] font-black text-white uppercase truncate leading-tight">{b?.data.blue_name || "---"}</span>
                        {b?.data.blue_inspected && (
                          <div className="absolute bottom-1 right-1">
                            <span className="text-[8px] font-black text-green-400 uppercase tracking-tighter">INSPECTED</span>
                          </div>
                        )}
                      </div>
                      <div className="col-span-4 bg-red-600/80 flex flex-col justify-center px-3 relative">
                        <span className="text-[8px] font-bold text-red-200 uppercase leading-none">{b?.data.red_club || "---"}</span>
                        <span className="text-[16px] font-black text-white uppercase truncate leading-tight">{b?.data.red_name || "---"}</span>
                        {b?.data.red_inspected && (
                          <div className="absolute bottom-1 right-1">
                            <span className="text-[8px] font-black text-green-400 uppercase tracking-tighter">INSPECTED</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <AnnouncementPopup announcement={activeAnnouncement || null} onClose={onAnnouncementClose || (() => {})} size={isFullscreen ? 'large' : 'normal'} />
    </div>
  );
}

function OnsiteView({ rings, boutQueue, namingMode, activeAnnouncement, onAnnouncementClose, currentEventId }: { rings: RingStatus[], boutQueue: {id: string, data: MatchData}[], namingMode: 'number' | 'alphabet', activeAnnouncement?: { message: string, id: string } | null, onAnnouncementClose?: () => void, currentEventId: string | null }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [currentPage, setCurrentPage] = React.useState(0);
  const ringsPerPage = 4;
  const totalPages = Math.ceil(rings.length / ringsPerPage);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      if (!document.fullscreenElement) {
        setCurrentPage(0);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Auto-scroll logic
  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (totalPages > 1) {
      interval = setInterval(() => {
        setCurrentPage((prev) => (prev + 1) % totalPages);
      }, 30000); // 30 seconds
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [totalPages]);

  const displayedRings = rings.slice(currentPage * ringsPerPage, (currentPage + 1) * ringsPerPage);

  const getDynamicFontSize = (name: string) => {
    const len = name.length;
    if (len <= 15) return isFullscreen ? 'text-[52px] tracking-[2px]' : 'text-[34px] tracking-[1px]';
    if (len <= 25) return isFullscreen ? 'text-[38px] tracking-[1px]' : 'text-[26px] tracking-normal';
    if (len <= 35) return isFullscreen ? 'text-[28px] tracking-tight' : 'text-[20px] tracking-tight';
    if (len <= 45) return isFullscreen ? 'text-[22px] tracking-tighter' : 'text-[16px] tracking-tighter';
    return isFullscreen ? 'text-[18px] tracking-tighter' : 'text-[12px] tracking-tighter';
  };

  return (
    <div 
      ref={containerRef}
      className={cn(
        "bg-slate-950 min-h-full shadow-2xl border border-slate-800 transition-all duration-500 flex flex-col relative",
        isFullscreen ? "rounded-none px-12 py-6 overflow-hidden" : "rounded-[2.5rem] p-6 space-y-8"
      )}
    >
      {!isFullscreen && (
        <div className="flex items-center justify-between px-4 flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center shadow-lg shadow-red-900/20">
              <Trophy size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic leading-none">Onsite Tournament Overview</h2>
              <p className="text-[10px] font-black text-white uppercase tracking-[0.3em] mt-1">Live Multi-Court Monitoring System</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-xs font-black text-green-500 uppercase tracking-widest">System Live</span>
              </div>
              <p className="text-[9px] font-bold text-white uppercase tracking-widest mt-1">Real-time Data Sync</p>
            </div>
            <button 
              onClick={toggleFullScreen}
              className="p-3 bg-slate-900 text-white hover:text-white hover:bg-slate-800 rounded-2xl border border-slate-800 transition-all group"
              title="Enter Fullscreen"
            >
              <Maximize size={20} className="group-hover:scale-110 transition-transform" />
            </button>
          </div>
        </div>
      )}

      {isFullscreen && (
        <>
          <div className="absolute top-6 left-12 flex items-center gap-4 z-50">
            <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center shadow-lg shadow-red-900/20">
              <Trophy size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic leading-none">Onsite Tournament Overview</h2>
              <p className="text-[10px] font-black text-white uppercase tracking-[0.3em] mt-1">Live Multi-Court Monitoring System</p>
            </div>
          </div>
          <button 
            onClick={toggleFullScreen}
            className="absolute top-6 right-6 p-3 bg-slate-900/50 hover:bg-slate-800 text-slate-400 hover:text-white rounded-2xl border border-slate-800 transition-all z-50 opacity-0 hover:opacity-100"
            title="Exit Fullscreen"
          >
            <Minimize size={20} />
          </button>
        </>
      )}

      <div className={cn(
        "flex-1 overflow-y-auto custom-scrollbar px-4",
        isFullscreen ? "flex flex-col justify-around pt-24 pb-4 gap-y-8" : "space-y-24 py-12"
      )}>
        {displayedRings.map((ring) => {
          const ringQueue = boutQueue
            .filter(q => 
              q.data.ring === ring.ringNumber && 
              (!q.data.eventId || q.data.eventId === currentEventId)
            )
            .sort((a, b) => {
              const boutA = parseInt(normalizeBoutNumber(a.data.bout)) || 0;
              const boutB = parseInt(normalizeBoutNumber(b.data.bout)) || 0;
              return boutA - boutB;
            })
            .slice(0, 3);
          const current = ring.currentBout;
          const ringName = namingMode === 'number' ? ring.ringNumber.toString() : String.fromCharCode(64 + ring.ringNumber);
          
          return (
            <div key={ring.ringNumber} className="grid grid-cols-12 gap-8 items-center">
              {/* Ring Number */}
              <div className="col-span-1 flex flex-col items-center justify-center">
                <div className="text-7xl font-black text-white italic leading-none tracking-tighter">{ringName}</div>
                <div className="text-[10px] font-black text-white uppercase tracking-[0.4em] mt-2 ml-1">Court</div>
              </div>

              {/* Active Match Capsule */}
              <div className="col-span-8">
                <div className="relative">
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex items-center gap-3">
                    <div className="h-[1px] w-12 bg-slate-800" />
                    <div className="bg-yellow-400 text-slate-950 px-6 py-1 rounded-full text-[13px] font-black uppercase tracking-[0.2em] whitespace-nowrap shadow-lg shadow-yellow-900/20">
                      {current?.category || "Waiting for Session"}
                    </div>
                    <div className="h-[1px] w-12 bg-slate-800" />
                  </div>
                  
                  <div className={cn(
                    "flex items-center bg-slate-900 rounded-[3rem] border-4 border-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden transition-all duration-500",
                    isFullscreen ? "h-36" : "h-40"
                  )}>
                    {/* Blue Side */}
                    <div className="flex-1 h-full bg-blue-600 flex flex-col justify-center px-10 relative overflow-hidden group">
                      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/20 to-transparent pointer-events-none" />
                      <div className="absolute -right-4 top-1/2 -translate-y-1/2 text-8xl font-black text-white/5 italic select-none">BLUE</div>
                      <p className="text-[15px] font-black text-blue-200 uppercase tracking-[0.2em] mb-1 relative z-10">{current?.blue_club || "---"}</p>
                      <h4 className={cn(
                        "font-black text-white uppercase relative z-10 leading-tight line-clamp-3",
                        getDynamicFontSize(current?.blue_name || "")
                      )}>
                        {current?.privacy_mode ? "---" : (current?.blue_name || "---")}
                      </h4>
                    </div>

                    {/* Bout Number Circle */}
                    <div className="z-20 -mx-10 w-[120px] h-[120px] bg-white rounded-full border-[10px] border-slate-800 flex items-center justify-center shadow-2xl transform hover:scale-105 transition-transform">
                      <span className="text-[36px] font-black text-slate-900 leading-none">
                        {current ? formatBoutNumber(ring.ringNumber, current.bout) : "---"}
                      </span>
                    </div>

                    {/* Red Side */}
                    <div className="flex-1 h-full bg-red-600 flex flex-col justify-center px-10 text-right relative overflow-hidden group">
                      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-bl from-white/20 to-transparent pointer-events-none" />
                      <div className="absolute -left-4 top-1/2 -translate-y-1/2 text-8xl font-black text-white/5 italic select-none">RED</div>
                      <p className="text-[15px] font-black text-red-200 uppercase tracking-[0.2em] mb-1 relative z-10">{current?.red_club || "---"}</p>
                      <h4 className={cn(
                        "font-black text-white uppercase relative z-10 leading-tight line-clamp-3",
                        getDynamicFontSize(current?.red_name || "")
                      )}>
                        {current?.privacy_mode ? "---" : (current?.red_name || "---")}
                      </h4>
                    </div>
                  </div>
                </div>
              </div>

              {/* Standby Queue */}
              <div className={cn(
                "col-span-3 transition-all duration-500",
                isFullscreen ? "space-y-2" : "space-y-3"
              )}>
                <div className="flex items-center justify-between px-2">
                  <div className="text-[10px] font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-red-600 rounded-full" />
                    Ring {ringName}
                  </div>
                  <div className="text-[9px] font-bold text-white uppercase tracking-widest">Next 3 Bouts</div>
                </div>
                <div className={cn(
                  "transition-all duration-500",
                  isFullscreen ? "space-y-1.5" : "space-y-2.5"
                )}>
                  {[0, 1, 2].map((idx) => {
                    const bout = ringQueue[idx];
                    return (
                      <div key={idx} className="flex items-center bg-slate-900 rounded-full border border-slate-800 overflow-hidden min-h-[2.5rem] py-1 shadow-lg group hover:border-slate-600 transition-colors">
                        {/* Blue Side */}
                        <div className="flex-1 self-stretch bg-blue-600/90 flex flex-col justify-center px-3 min-w-0 relative">
                          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
                          <p className="text-[8px] font-bold text-blue-200 uppercase leading-none mb-0.5 relative z-10">
                            {bout ? bout.data.blue_club : "---"}
                          </p>
                          <p className="text-[12px] font-black text-white uppercase tracking-[1px] relative z-10 leading-tight line-clamp-2">
                            {bout ? (bout.data.privacy_mode ? "---" : bout.data.blue_name) : "---"}
                          </p>
                          {bout?.data.blue_inspected && (
                            <div className="absolute bottom-0.5 right-1 z-20">
                              <span className="text-[8px] font-black text-green-400 uppercase tracking-tighter">INSPECTED</span>
                            </div>
                          )}
                        </div>
                        
                        {/* Bout Number */}
                        <div className="z-10 -mx-4 w-10 h-10 bg-white rounded-full border-4 border-slate-900 flex items-center justify-center flex-shrink-0 shadow-xl group-hover:scale-110 transition-transform">
                          <span className="text-[10px] font-black text-slate-900">
                            {bout ? formatBoutNumber(ring.ringNumber, bout.data.bout) : "---"}
                          </span>
                        </div>

                        {/* Red Side */}
                        <div className="flex-1 self-stretch bg-red-600/90 flex flex-col justify-center px-3 min-w-0 text-right relative">
                          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-bl from-white/10 to-transparent pointer-events-none" />
                          <p className="text-[8px] font-bold text-red-200 uppercase leading-none mb-0.5 relative z-10">
                            {bout ? bout.data.red_club : "---"}
                          </p>
                          <p className="text-[12px] font-black text-white uppercase tracking-[1px] relative z-10 leading-tight line-clamp-2">
                            {bout ? (bout.data.privacy_mode ? "---" : bout.data.red_name) : "---"}
                          </p>
                          {bout?.data.red_inspected && (
                            <div className="absolute bottom-0.5 right-1 z-20">
                              <span className="text-[8px] font-black text-green-400 uppercase tracking-tighter">INSPECTED</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {isFullscreen && totalPages > 1 && (
        <div className="flex justify-center gap-3 py-4 flex-shrink-0">
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentPage(i)}
              className={cn(
                "w-3 h-3 rounded-full transition-all duration-300",
                currentPage === i 
                  ? "bg-red-600 w-8 shadow-[0_0_15px_rgba(220,38,38,0.5)]" 
                  : "bg-slate-800 hover:bg-slate-700"
              )}
            />
          ))}
        </div>
      )}
      <AnnouncementPopup announcement={activeAnnouncement || null} onClose={onAnnouncementClose || (() => {})} size={isFullscreen ? 'large' : 'normal'} />
    </div>
  );
}

function PublicDashboardView({ rings, boutQueue, namingMode, onBack, isSpectator }: { rings: RingStatus[], boutQueue: {id: string, data: MatchData}[], namingMode: 'number' | 'alphabet', onBack: () => void, isSpectator?: boolean }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [currentPage, setCurrentPage] = React.useState(0);
  const [logoClicks, setLogoClicks] = React.useState(0);
  const clickTimer = React.useRef<NodeJS.Timeout | null>(null);

  const isStrictPublic = import.meta.env.VITE_APP_MODE === 'PUBLIC' || new URLSearchParams(window.location.search).get('view') === 'public';

  const handleLogoClick = () => {
    setLogoClicks(prev => prev + 1);
    if (clickTimer.current) clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => setLogoClicks(0), 1000);
    
    if (logoClicks >= 2) { // 3rd click
      // Only allow exiting if not in strict public mode
      if (!isStrictPublic) {
        onBack();
      }
      setLogoClicks(0);
    }
  };

  const ringsPerPage = 9; // Show 9 rings per page in fullscreen
  const totalPages = Math.ceil(rings.length / ringsPerPage);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      if (!document.fullscreenElement) {
        setCurrentPage(0);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isFullscreen && totalPages > 1) {
      interval = setInterval(() => {
        setCurrentPage((prev) => (prev + 1) % totalPages);
      }, 30000); // 30 seconds
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isFullscreen, totalPages]);

  const displayedRings = isFullscreen 
    ? rings.slice(currentPage * ringsPerPage, (currentPage + 1) * ringsPerPage)
    : rings;

  return (
    <div ref={containerRef} className="min-h-[100dvh] bg-slate-900 text-white font-sans overflow-x-hidden flex flex-col">
      {/* Public Header */}
      <header className={cn(
        "p-6 bg-slate-800 border-b border-slate-700 flex items-center justify-between sticky top-0 z-50 transition-all",
        isFullscreen && "opacity-0 h-0 p-0 overflow-hidden"
      )}>
        <div 
          className="flex items-center gap-3 cursor-pointer select-none"
          onClick={handleLogoClick}
        >
          <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-red-900/20">
            <Trophy size={24} />
          </div>
          <div>
            <h1 className="font-black text-xl leading-tight tracking-tighter">MY-TKD LIVE</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Web View Dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={toggleFullScreen}
            className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors"
            title="Fullscreen Mode"
          >
            <Maximize size={20} />
          </button>
        </div>
      </header>

      <div className={cn(
        "p-4 md:p-8 space-y-8 max-w-[1600px] mx-auto flex-1",
        isFullscreen && "max-w-none w-full flex flex-col justify-center p-12"
      )}>
        <div className="grid grid-cols-1 gap-8">
          {/* Mats Grid */}
          <div className="space-y-6">
            {!isFullscreen && (
              <h3 className="text-lg font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <LayoutDashboard size={20} className="text-red-500" />
                Live Ring Status
              </h3>
            )}
            <div className={cn(
              "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6",
              isFullscreen && "lg:grid-cols-3 gap-8"
            )}>
              {displayedRings.map((ring) => (
                <PublicRingCard 
                  key={ring.ringNumber} 
                  ring={ring} 
                  namingMode={namingMode} 
                  queueCount={boutQueue.filter(q => q.data.ring === ring.ringNumber).length}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {!isFullscreen && (
        <footer className="p-8 bg-slate-800 border-t border-slate-700 mt-12 text-center space-y-4">
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 bg-white p-1 rounded-lg">
              <QrCode size={40} className="text-slate-900" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Scan for Live Updates</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <p className="text-xs text-slate-500 font-medium">© 2026 MY-TKD Tournament Management System</p>
            {/* Hide back button in strict public mode */}
            {!isStrictPublic && (
              <button 
                onClick={onBack}
                className="px-4 py-2 bg-slate-700/30 hover:bg-slate-700 text-[10px] text-slate-400 hover:text-white uppercase font-black tracking-widest transition-all mt-4 rounded-lg border border-slate-700/50"
              >
                {isSpectator ? "Operator Access" : "Exit Public View"}
              </button>
            )}
          </div>
        </footer>
      )}

      {isFullscreen && totalPages > 1 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
          {[...Array(totalPages)].map((_, i) => (
            <div 
              key={i} 
              className={cn(
                "w-2 h-2 rounded-full transition-all duration-500",
                currentPage === i ? "w-8 bg-red-500" : "bg-slate-700"
              )}
            />
          ))}
        </div>
      )}
      
      {isFullscreen && (
        <button 
          onClick={toggleFullScreen}
          className="fixed top-8 right-8 p-4 bg-slate-800/80 hover:bg-slate-800 text-white rounded-2xl border border-slate-700 transition-all opacity-40 hover:opacity-100 z-50"
        >
          <Minimize size={24} />
        </button>
      )}
    </div>
  );
}

function PublicRingCard({ ring, namingMode, queueCount }: PublicRingCardProps) {
  const current = ring.currentBout;
  const ringName = namingMode === 'number' ? ring.ringNumber.toString() : String.fromCharCode(64 + ring.ringNumber);
  
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-3xl overflow-hidden shadow-2xl">
      <div className="p-4 bg-slate-700/50 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center font-black text-xl shadow-lg shadow-red-900/20">
            {ringName}
          </div>
          <div>
            <h4 className="font-black text-[20px] uppercase tracking-widest text-white">Ring {ringName}</h4>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-bold text-green-500 uppercase tracking-widest">Live Match</span>
            </div>
          </div>
        </div>
        {current && (
          <div className="text-right">
            <p className="text-[40px] font-black text-white leading-none">
              {formatBoutNumber(ring.ringNumber, current.bout)}
              <span className="mx-2 text-white/40">/</span>
              {ring.totalBouts || queueCount || 0}
            </p>
          </div>
        )}
      </div>
      
      <div className="p-6 space-y-4">
        {current ? (
          <>
            <div className="space-y-4">
              <div className="flex items-center justify-center">
                <span className="text-[20px] font-black text-white uppercase tracking-widest">{current.category}</span>
              </div>
              
              <div className="flex items-center gap-6">
                <PublicFighterSide color="blue" name={current.blue_name} club={current.blue_club} privacy={current.privacy_mode} />
                <div className="text-xl font-black text-white italic">VS</div>
                <PublicFighterSide color="red" name={current.red_name} club={current.red_club} privacy={current.privacy_mode} />
              </div>
            </div>
          </>
        ) : (
          <div className="py-8 flex flex-col items-center justify-center text-slate-600 space-y-4">
            <AlertCircle size={48} />
            <p className="text-sm font-black uppercase tracking-widest">Ring Inactive</p>
          </div>
        )}
      </div>
    </div>
  );
}

function PublicFighterSide({ color, name, club, privacy }: { color: 'blue' | 'red', name: string, club: string, privacy: boolean }) {
  const getDynamicFontSize = (name: string) => {
    const len = name.length;
    if (len <= 15) return 'text-[24px]';
    if (len <= 25) return 'text-[20px]';
    if (len <= 35) return 'text-[16px]';
    return 'text-[14px]';
  };

  return (
    <div className="flex-1 space-y-2 relative">
      <div className={cn(
        "h-2 w-full rounded-full shadow-inner",
        color === 'blue' ? "bg-[#00a2e8] shadow-blue-900/50" : "bg-[#ed1c24] shadow-red-900/50"
      )} />
      <p className={cn(
        "font-black text-white tracking-tight leading-tight line-clamp-3",
        getDynamicFontSize(privacy ? "---" : name)
      )}>
        {privacy ? "---" : name}
      </p>
      <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">{club}</p>
    </div>
  );
}

function LoginScreen({ onLogin, events, onBack }: { onLogin: (u: string, p: string, eventId?: string) => boolean, events: EventData[], onBack?: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [eventId, setEventId] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onLogin(username, password, eventId)) {
      setError(true);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white p-8 rounded-3xl border border-slate-200 shadow-xl relative"
      >
        {onBack && (
          <button 
            onClick={onBack}
            className="absolute top-6 left-6 p-2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
        )}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-red-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-red-200 mb-4">
            <Trophy size={32} />
          </div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tighter">MY-TKD LIVE</h1>
          <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mt-1">Tournament Management</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Username</label>
            <div className="relative">
              <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all font-bold"
                placeholder="Enter username"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all font-bold"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Event</label>
            <div className="relative">
              <Trophy className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" size={18} />
              <select
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                className="w-full pl-12 pr-10 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all font-bold relative z-20 appearance-none cursor-pointer"
                required={username !== 'admin' && events.length > 0}
              >
                <option value="" disabled>
                  {events.length === 0 ? "No events available (Admin must create one)" : "Select an Event"}
                </option>
                {events.map(ev => (
                  <option key={ev.id} value={ev.id}>{ev.name}</option>
                ))}
              </select>
              {/* Custom dropdown arrow to replace the default one since we use appearance-none */}
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none z-30 text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
              </div>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600">
              <AlertCircle size={18} />
              <p className="text-xs font-bold">Invalid username or password</p>
            </div>
          )}

          <button 
            type="submit"
            className="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-red-200 transition-all flex items-center justify-center gap-2"
          >
            <LogIn size={20} />
            Login to System
          </button>
        </form>

        <div className="mt-8 pt-8 border-t border-slate-100 text-center">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
            © 2026 MY-TKD Tournament Management System
          </p>
        </div>
      </motion.div>
    </div>
  );
}

function DataUpdater({ 
  setCategories, 
  setClubs 
}: { 
  setCategories: (cats: string[]) => void, 
  setClubs: (clubs: string[]) => void 
}) {
  const [isUpdatingCategory, setIsUpdatingCategory] = useState(false);
  const [isUpdatingClub, setIsUpdatingClub] = useState(false);
  const [selectedRing, setSelectedRing] = useState<number>(1);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/10WgCWYqQpuu6I48jZ9cyZvMb0bbMYIuk0oAArnMKp04/export?format=csv&gid=0";

  const fetchCSV = async () => {
    const response = await fetch(SHEET_CSV_URL);
    if (!response.ok) {
      throw new Error("Failed to fetch data. Please ensure the Google Sheet is published to the web (File > Share > Publish to web) or is accessible to 'Anyone with the link'.");
    }
    const csvText = await response.text();
    return new Promise<Papa.ParseResult<string[]>>((resolve, reject) => {
      Papa.parse(csvText, {
        complete: resolve,
        error: reject,
        skipEmptyLines: true
      });
    });
  };

  const handleUpdateCategory = async () => {
    setIsUpdatingCategory(true);
    setMessage(null);
    try {
      const result = await fetchCSV();
      const rows = result.data;
      if (rows.length < 2) throw new Error("Sheet is empty or missing data.");
      
      // Ring 1 is col 0 (A), Ring 2 is col 1 (B), etc.
      const colIndex = selectedRing - 1;
      const newCategories: string[] = [];
      
      // Start from row 1 (A2)
      for (let i = 1; i < rows.length; i++) {
        const cat = rows[i][colIndex];
        if (cat && cat.trim() !== '') {
          newCategories.push(cat.trim());
        }
      }
      
      if (newCategories.length === 0) {
        throw new Error(`No categories found for Ring ${selectedRing} in column ${String.fromCharCode(65 + colIndex)}.`);
      }
      
      setCategories(newCategories);
      setMessage({ text: `Successfully updated ${newCategories.length} categories for Ring ${selectedRing}.`, type: 'success' });
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : "An error occurred.", type: 'error' });
    } finally {
      setIsUpdatingCategory(false);
    }
  };

  const handleUpdateClub = async () => {
    setIsUpdatingClub(true);
    setMessage(null);
    try {
      const result = await fetchCSV();
      const rows = result.data;
      if (rows.length < 2) throw new Error("Sheet is empty or missing data.");
      
      // Clubs are in column Z (index 25)
      const colIndex = 25;
      const newClubs: string[] = [];
      
      // Start from row 1 (Z2)
      for (let i = 1; i < rows.length; i++) {
        const club = rows[i][colIndex];
        if (club && club.trim() !== '') {
          newClubs.push(club.trim());
        }
      }
      
      if (newClubs.length === 0) {
        throw new Error("No clubs found in column Z.");
      }
      
      setClubs(newClubs);
      setMessage({ text: `Successfully updated ${newClubs.length} clubs.`, type: 'success' });
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : "An error occurred.", type: 'error' });
    } finally {
      setIsUpdatingClub(false);
    }
  };

  return (
    <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
      <h3 className="text-xl font-bold flex items-center gap-2">
        <Database size={24} className="text-slate-400" />
        Data Synchronization
      </h3>
      
      {message && (
        <div className={cn("p-4 rounded-xl text-sm font-bold border", message.type === 'success' ? "bg-green-50 text-green-700 border-green-100" : "bg-red-50 text-red-600 border-red-100")}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 bg-slate-50 rounded-xl border border-slate-100 space-y-4 flex flex-col">
          <div>
            <h4 className="font-bold text-slate-800">Update Category</h4>
            <p className="text-[10px] text-slate-500 mt-1">Fetch categories from Google Sheet for a specific ring.</p>
          </div>
          
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Select Ring</label>
            <select 
              value={selectedRing}
              onChange={(e) => setSelectedRing(parseInt(e.target.value))}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(num => (
                <option key={num} value={num}>Ring {num}</option>
              ))}
            </select>
          </div>

          <div className="mt-auto pt-4">
            <button 
              onClick={handleUpdateCategory}
              disabled={isUpdatingCategory}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isUpdatingCategory ? <RefreshCw size={16} className="animate-spin" /> : <Download size={16} />}
              Update Category
            </button>
          </div>
        </div>

        <div className="p-6 bg-slate-50 rounded-xl border border-slate-100 space-y-4 flex flex-col">
          <div>
            <h4 className="font-bold text-slate-800">Update Club</h4>
            <p className="text-[10px] text-slate-500 mt-1">Fetch club names from column Z in the Google Sheet.</p>
          </div>
          
          <div className="mt-auto pt-4">
            <button 
              onClick={handleUpdateClub}
              disabled={isUpdatingClub}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isUpdatingClub ? <RefreshCw size={16} className="animate-spin" /> : <Download size={16} />}
              Update Club
            </button>
          </div>
        </div>
      </div>
      
      <div className="p-4 bg-blue-50 text-blue-800 rounded-xl text-xs font-medium border border-blue-100">
        <strong>Note:</strong> For this to work, the Google Sheet must be accessible. Please ensure you have set the sharing settings to <strong>"Anyone with the link"</strong> can view.
      </div>
    </div>
  );
}

function EventManagement({ events, onAdd, onDelete }: { events: EventData[], onAdd: (e: EventData) => void, onDelete: (id: string) => void }) {
  const [name, setName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [ringQuantity, setRingQuantity] = useState(1);
  const [sheetUrl, setSheetUrl] = useState('');
  const [showScript, setShowScript] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean, message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const handleTestSync = async () => {
    if (!sheetUrl) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await testSync(sheetUrl);
      setTestResult(result);
    } catch (e) {
      setTestResult({ success: false, message: 'Test failed' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const finalSheetUrl = sheetUrl.trim() || 'https://script.google.com/macros/s/AKfycbxj_LHC3MLU7IHjMSwklvIuXZxbsk1jhNTdU23piVTdx8kC6DhVD5EAHe7z72wYb774/exec';

    onAdd({
      id: Math.random().toString(36).substr(2, 9),
      name,
      eventDate,
      ringQuantity,
      sheetUrl: finalSheetUrl,
      createdAt: new Date()
    });
    setName('');
    setEventDate('');
    setRingQuantity(1);
    setSheetUrl('');
  };

  return (
    <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <Calendar size={24} className="text-slate-400" />
          Event Management
        </h3>
        <button onClick={() => setShowScript(!showScript)} className="text-xs text-blue-600 hover:underline">
          How to auto-create Google Sheets?
        </button>
      </div>

      {showScript && (
        <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-800 space-y-2">
          <p className="font-bold">Google Apps Script Setup:</p>
          <p>1. Go to script.google.com and create a new project.</p>
          <p>2. Paste the provided script (which handles creating sheets in your specific folder and receiving data).</p>
          <p>3. Deploy as a Web App and paste the URL below when creating an event.</p>
          <pre className="bg-white p-2 text-[10px] rounded border border-blue-200 overflow-x-auto">
{`function doPost(e) {
  let data;
  try {
    // Try parsing as JSON first
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    // Fallback if sent as form data
    data = e.parameter;
  }
  
  if (data.action === 'ping') {
    return ContentService.createTextOutput("Pong").setMimeType(ContentService.MimeType.TEXT);
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Sheet 1") || ss.getSheets()[0];
  
  if (data.action === 'updateWinner') {
    if (sheet) {
      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();
      for (let i = 1; i < values.length; i++) {
        // Match Ring (Col B) and Bout (Col C)
        if (values[i][1] == data.ring && values[i][2] == data.bout) {
          sheet.getRange(i + 1, 9).setValue(data.winner); // Column I is Winner
          break;
        }
      }
    }
    return ContentService.createTextOutput("Winner Updated");
  }

  if (data.action === 'updateTransfer') {
    if (sheet) {
      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();
      for (let i = 1; i < values.length; i++) {
        if (values[i][1] == data.ring && values[i][2] == data.bout) {
          sheet.getRange(i + 1, 9).setValue("TRANSFERRED: " + data.reason);
          break;
        }
      }
    }
    return ContentService.createTextOutput("Transfer Updated");
  }
  
  // Handle new bout
  if (data.action === 'newBout' && sheet) {
    sheet.appendRow([
      data.event_name,
      data.ring,
      data.bout,
      data.category,
      data.blue_name,
      data.blue_club,
      data.red_name,
      data.red_club
    ]);
  }
  return ContentService.createTextOutput("Success");
}`}
          </pre>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
        <div className="space-y-1 md:col-span-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Event Name</label>
          <input 
            type="text" 
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold"
            placeholder="e.g. National Open 2026"
            required
          />
        </div>
        <div className="space-y-1 md:col-span-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Event Date</label>
          <input 
            type="date" 
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold"
            required
          />
        </div>
        <div className="space-y-1 md:col-span-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ring Quantity</label>
          <input 
            type="number" 
            min="1"
            max="20"
            value={ringQuantity}
            onChange={(e) => setRingQuantity(parseInt(e.target.value))}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold"
            required
          />
        </div>
        <div className="space-y-1 md:col-span-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Google Sheet Web App URL</label>
          <input 
            type="text" 
            value={sheetUrl}
            onChange={(e) => setSheetUrl(e.target.value)}
            className={cn(
              "w-full px-3 py-2 bg-slate-50 border rounded-xl text-sm font-bold",
              sheetUrl && !sheetUrl.includes('/exec') ? "border-amber-300 bg-amber-50" : "border-slate-200"
            )}
            placeholder="Leave blank for default"
          />
          {sheetUrl && !sheetUrl.includes('/exec') && (
            <p className="text-[9px] text-amber-600 font-bold mt-1 ml-1 animate-pulse">
              ⚠️ Warning: URL should end with /exec
            </p>
          )}
          {sheetUrl && (
            <button 
              type="button"
              onClick={handleTestSync}
              disabled={isTesting}
              className="mt-2 text-[9px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-800 disabled:opacity-50"
            >
              {isTesting ? 'Testing...' : 'Test Connection'}
            </button>
          )}
          {testResult && (
            <p className={cn(
              "text-[9px] font-bold mt-1 ml-1",
              testResult.success ? "text-green-600" : "text-red-600"
            )}>
              {testResult.message}
            </p>
          )}
        </div>
        <button 
          type="submit"
          className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all h-[38px] md:col-span-1"
        >
          Create Event
        </button>
      </form>

      <div className="space-y-2">
        {events.map(ev => (
          <div key={ev.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
            <div>
              <p className="text-sm font-bold text-slate-800">{ev.name}</p>
              <p className="text-[10px] text-slate-500">
                {ev.ringQuantity} Rings • Date: {ev.eventDate || 'Not set'} • Created: {new Date(ev.createdAt).toLocaleDateString()}
              </p>
            </div>
            <button 
              onClick={() => onDelete(ev.id)}
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {events.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-4">No events created yet.</p>
        )}
      </div>
    </div>
  );
}

function UserManagement({ accounts, onAdd, onDelete, onEditPassword }: { accounts: UserAccount[], onAdd: (a: UserAccount) => void, onDelete: (u: string) => void, onEditPassword: (u: string, p: string) => void }) {
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'user'>('user');
  const [assignedRing, setAssignedRing] = useState<number>(1);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editPasswordValue, setEditPasswordValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newUsername && newPassword) {
      onAdd({
        username: newUsername,
        password: newPassword,
        role: newRole,
        assignedRing: newRole === 'user' ? assignedRing : undefined
      });
      setNewUsername('');
      setNewPassword('');
    }
  };

  return (
    <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
      <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
        <UserPlus className="text-red-500" size={24} />
        User Management
      </h3>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Add User Form */}
        <div className="lg:col-span-1 p-6 bg-slate-50 rounded-2xl border border-slate-100">
          <h4 className="font-bold text-slate-800 mb-4 text-sm uppercase tracking-widest">Add New Account</h4>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Username</label>
              <input 
                type="text" 
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold"
                placeholder="e.g. ring2"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Password</label>
              <input 
                type="text" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold"
                placeholder="e.g. 1234"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Role</label>
              <select 
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as 'admin' | 'user')}
                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold"
              >
                <option value="user">Ring Controller</option>
                <option value="admin">System Admin</option>
              </select>
            </div>
            {newRole === 'user' && (
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Assigned Ring</label>
                <input 
                  type="number" 
                  value={assignedRing}
                  onChange={(e) => setAssignedRing(parseInt(e.target.value))}
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold"
                  min="1"
                />
              </div>
            )}
            <button 
              type="submit"
              className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all"
            >
              Create Account
            </button>
          </form>
        </div>

        {/* User List */}
        <div className="lg:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-slate-100">
                  <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Username</th>
                  <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Password</th>
                  <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Role</th>
                  <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Access</th>
                  <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {accounts.map((acc) => (
                  <tr key={acc.username} className="group">
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500">
                          <UserIcon size={16} />
                        </div>
                        <span className="font-bold text-slate-700">{acc.username}</span>
                      </div>
                    </td>
                    <td className="py-4">
                      <div className="flex items-center gap-2">
                        <Key size={12} className="text-slate-300" />
                        {editingUser === acc.username ? (
                          <div className="flex items-center gap-2">
                            <input 
                              type="text" 
                              value={editPasswordValue} 
                              onChange={e => setEditPasswordValue(e.target.value)} 
                              className="w-24 px-2 py-1 text-xs border border-slate-200 rounded outline-none focus:border-red-500"
                            />
                            <button onClick={() => { onEditPassword(acc.username, editPasswordValue); setEditingUser(null); }} className="text-green-600 hover:text-green-700"><Check size={14}/></button>
                            <button onClick={() => setEditingUser(null)} className="text-red-600 hover:text-red-700"><X size={14}/></button>
                          </div>
                        ) : (
                          <>
                            <span className="font-mono text-xs font-bold text-slate-600">{acc.password}</span>
                            <button onClick={() => { setEditingUser(acc.username); setEditPasswordValue(acc.password); }} className="text-slate-400 hover:text-blue-600 ml-2"><Edit2 size={12}/></button>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="py-4">
                      <span className={cn(
                        "px-2 py-1 rounded-lg text-[10px] font-bold uppercase",
                        acc.role === 'admin' ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"
                      )}>
                        {acc.role}
                      </span>
                    </td>
                    <td className="py-4 text-xs font-bold text-slate-500">
                      {acc.role === 'admin' ? "Full System" : `Ring ${acc.assignedRing}`}
                    </td>
                    <td className="py-4">
                      {acc.username !== 'admin' && (
                        <button 
                          onClick={() => onDelete(acc.username)}
                          className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function PublicQueueItem({ label, data }: { label: string, data: MatchData | null }) {
  return (
    <div className="p-4 bg-slate-900/50 rounded-2xl border border-slate-700/50">
      <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">{label}</p>
      {data ? (
        <div className="space-y-1">
          <p className="text-xs font-black text-slate-300 truncate">
            {data.privacy_mode ? "---" : data.blue_name} vs {data.privacy_mode ? "---" : data.red_name}
          </p>
          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{data.blue_club} / {data.red_club}</p>
        </div>
      ) : (
        <p className="text-xs font-bold text-slate-700 uppercase tracking-widest">TBD</p>
      )}
    </div>
  );
}
