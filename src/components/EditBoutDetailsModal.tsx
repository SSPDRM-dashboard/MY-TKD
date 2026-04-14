import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Edit2, X } from 'lucide-react';
import { RingStatus, MatchData } from '../types';

interface EditBoutDetailsModalProps {
  onClose: () => void;
  onSubmit: (ringNumber: number, boutNumber: string, updates: Partial<MatchData>) => void;
  rings: RingStatus[];
  queue: { id: string; data: MatchData }[];
  user: any;
}

export function EditBoutDetailsModal({ onClose, onSubmit, rings, queue, user }: EditBoutDetailsModalProps) {
  const defaultRing = user?.role === 'admin' ? (rings[0]?.ringNumber || 1) : (Number(user?.assignedRing) || 1);
  
  const [formData, setFormData] = useState({
    ring: defaultRing,
    bout: '',
    blue_name: '',
    blue_club: '',
    red_name: '',
    red_club: '',
  });

  const availableRings = user?.role === 'admin' 
    ? rings 
    : rings.filter(r => Number(r.ringNumber) === Number(user?.assignedRing));

  const displayRings = availableRings.length > 0 
    ? availableRings 
    : (user?.assignedRing ? [{ ringNumber: Number(user.assignedRing) } as RingStatus] : rings);

  // Auto-fill details when bout number changes
  useEffect(() => {
    if (!formData.bout) return;
    
    // Check active bout
    const ring = rings.find(r => r.ringNumber === formData.ring);
    if (ring?.currentBout && ring.currentBout.bout.toString() === formData.bout) {
      setFormData(prev => ({
        ...prev,
        blue_name: ring.currentBout!.blue_name,
        blue_club: ring.currentBout!.blue_club,
        red_name: ring.currentBout!.red_name,
        red_club: ring.currentBout!.red_club,
      }));
      return;
    }

    // Check queue
    const queuedBout = queue.find(q => q.data.ring === formData.ring && q.data.bout.toString() === formData.bout);
    if (queuedBout) {
      setFormData(prev => ({
        ...prev,
        blue_name: queuedBout.data.blue_name,
        blue_club: queuedBout.data.blue_club,
        red_name: queuedBout.data.red_name,
        red_club: queuedBout.data.red_club,
      }));
    }
  }, [formData.ring, formData.bout, rings, queue]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.bout) return;
    onSubmit(formData.ring, formData.bout, {
      blue_name: formData.blue_name,
      blue_club: formData.blue_club,
      red_name: formData.red_name,
      red_club: formData.red_club,
    });
    onClose();
  };

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
              <h2 className="text-lg font-black tracking-tight">Edit Bout Details</h2>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Update Names & Clubs</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
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
                placeholder="e.g. 101"
                required
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl space-y-4">
              <h3 className="text-xs font-black text-blue-800 uppercase tracking-widest">Blue Corner</h3>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest ml-1">Name</label>
                <input 
                  type="text" 
                  value={formData.blue_name}
                  onChange={(e) => setFormData({...formData, blue_name: e.target.value})}
                  className="w-full px-4 py-2 bg-white border border-blue-200 rounded-lg text-sm font-bold"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest ml-1">Club</label>
                <input 
                  type="text" 
                  value={formData.blue_club}
                  onChange={(e) => setFormData({...formData, blue_club: e.target.value})}
                  className="w-full px-4 py-2 bg-white border border-blue-200 rounded-lg text-sm font-bold"
                  required
                />
              </div>
            </div>

            <div className="p-4 bg-red-50 border border-red-100 rounded-xl space-y-4">
              <h3 className="text-xs font-black text-red-800 uppercase tracking-widest">Red Corner</h3>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-red-600 uppercase tracking-widest ml-1">Name</label>
                <input 
                  type="text" 
                  value={formData.red_name}
                  onChange={(e) => setFormData({...formData, red_name: e.target.value})}
                  className="w-full px-4 py-2 bg-white border border-red-200 rounded-lg text-sm font-bold"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-red-600 uppercase tracking-widest ml-1">Club</label>
                <input 
                  type="text" 
                  value={formData.red_club}
                  onChange={(e) => setFormData({...formData, red_club: e.target.value})}
                  className="w-full px-4 py-2 bg-white border border-red-200 rounded-lg text-sm font-bold"
                  required
                />
              </div>
            </div>
          </div>

          <button 
            type="submit"
            className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black uppercase tracking-widest text-sm transition-all shadow-lg shadow-slate-200"
          >
            Update Details
          </button>
        </form>
      </motion.div>
    </div>
  );
}
