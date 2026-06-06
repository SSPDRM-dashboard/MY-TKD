import React, { useState, useMemo } from 'react';
import { BoutMapping, MatchData, MatchHistoryItem } from '../types';
import { formatBoutNumber, normalizeBoutNumber, getBoutNumber, parseRingNumber } from '../lib/utils';
import { Layers } from 'lucide-react';

interface BoutChartProps {
  mappings: BoutMapping[];
  boutQueue: {id: string, data: MatchData}[];
  matchHistory: MatchHistoryItem[];
  boutNumberingMode?: 'numeric' | 'alphanumeric';
}

interface BracketNode {
  id: string; // The bout number
  match: MatchData | MatchHistoryItem | null;
  sources: { sourceId: string; slot: 'Chung' | 'Hong' }[];
  target: string | null;
  depth: number;
  x: number;
  y: number;
}

export function BoutChart({ mappings, boutQueue, matchHistory, boutNumberingMode = 'alphanumeric' }: BoutChartProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  const categories = useMemo(() => {
    const cats = new Set<string>();
    mappings.forEach(m => {
      if (m.categoryName) cats.add(m.categoryName.trim());
    });
    return Array.from(cats).filter(Boolean).sort();
  }, [mappings]);

  const { nodes, edges, width, height } = useMemo(() => {
    if (!selectedCategory) return { nodes: [], edges: [], width: 0, height: 0 };

    const catMappings = mappings.filter(m => m.categoryName?.trim() === selectedCategory);
    
    // Collect all unique bouts
    const boutIds = new Set<string>();
    catMappings.forEach(m => {
      if (m.sourceBout) boutIds.add(normalizeBoutNumber(m.sourceBout));
      if (m.nextBout) boutIds.add(normalizeBoutNumber(m.nextBout));
    });

    // We also want to include any bouts from the bout queue / match history that match this category
    // even if they don't have mappings (maybe it's a finals only category)
    const allMatches = [...boutQueue.map(q => q.data), ...matchHistory];
    const catMatches = allMatches.filter(m => m.category?.trim() === selectedCategory);
    catMatches.forEach(m => {
       boutIds.add(normalizeBoutNumber(m.bout.toString()));
    });

    const nodeMap = new Map<string, BracketNode>();
    boutIds.forEach(id => {
      // Find match data
      const match = catMatches.find(m => normalizeBoutNumber(m.bout.toString()) === id) || null;
      nodeMap.set(id, { id, match, sources: [], target: null, depth: 0, x: 0, y: 0 });
    });

    catMappings.forEach(m => {
      const sourceId = normalizeBoutNumber(m.sourceBout);
      const nextId = normalizeBoutNumber(m.nextBout);
      if (nodeMap.has(sourceId) && nodeMap.has(nextId)) {
        nodeMap.get(sourceId)!.target = nextId;
        nodeMap.get(nextId)!.sources.push({ sourceId, slot: m.slot });
      }
    });

    // Calculate depths (leaves = 0)
    let changed = true;
    while (changed) {
      changed = false;
      nodeMap.forEach(node => {
         if (node.sources.length > 0) {
            const maxChildDepth = Math.max(...node.sources.map(s => nodeMap.get(s.sourceId)?.depth || 0));
            if (node.depth !== maxChildDepth + 1) {
               node.depth = maxChildDepth + 1;
               changed = true;
            }
         }
      });
    }

    const maxDepth = Math.max(0, ...Array.from(nodeMap.values()).map(n => n.depth));
    const nodesArray = Array.from(nodeMap.values());
    
    // Partition nodes by depth
    const nodesByDepth: BracketNode[][] = [];
    for (let d = 0; d <= maxDepth; d++) {
      nodesByDepth.push(nodesArray.filter(n => n.depth === d));
    }

    // Sort nodes within depth 0 (leaves) arbitrarily but consistently.
    // Try to sort by bout number or slot if possible, or just purely alphanumerically for now.
    nodesByDepth[0].sort((a, b) => {
        // Find if they share a common ancestor quickly if we implement a complex sort.
        // For now, Alphanumerically
        return a.id.localeCompare(b.id);
    });

    const NODE_WIDTH = 220;
    const NODE_HEIGHT = 80;
    const X_GAP = 60;
    const Y_GAP = 20;

    // Assign Y to leaves
    let currentY = 20;
    nodesByDepth[0].forEach(node => {
      node.y = currentY;
      currentY += NODE_HEIGHT + Y_GAP;
    });

    // Assign Y to parents (average of children)
    for (let d = 1; d <= maxDepth; d++) {
      nodesByDepth[d].forEach(node => {
        if (node.sources.length > 0) {
           const childYs = node.sources.map(s => nodeMap.get(s.sourceId)!.y);
           node.y = childYs.reduce((a, b) => a + b, 0) / childYs.length;
           
           // Sort sources array so Chung is top, Hong is bottom visually
           node.sources.sort((a, b) => a.slot === 'Chung' ? -1 : 1);
        } else {
           // Should not happen for d > 0, but fallback
           node.y = currentY;
           currentY += NODE_HEIGHT + Y_GAP;
        }
      });
    }

    // Assign X
    nodesArray.forEach(node => {
      node.x = node.depth * (NODE_WIDTH + X_GAP) + 20;
    });

    const totalWidth = (maxDepth + 1) * (NODE_WIDTH + X_GAP) + 40;
    const totalHeight = Math.max(currentY, Math.max(...nodesArray.map(n => n.y)) + NODE_HEIGHT + 40);

    // Build edges for SVG drawing
    interface Edge {
       id: string;
       startX: number;
       startY: number;
       endX: number;
       endY: number;
       slot?: string;
    }
    const svgEdges: Edge[] = [];
    
    nodesArray.forEach(node => {
      node.sources.forEach(source => {
         const sourceNode = nodeMap.get(source.sourceId);
         if (sourceNode) {
            svgEdges.push({
               id: `${source.sourceId}-${node.id}`,
               startX: sourceNode.x + NODE_WIDTH,      // Right side of source
               startY: sourceNode.y + NODE_HEIGHT / 2, // Middle of source
               endX: node.x,                           // Left side of target
               endY: node.y + (source.slot === 'Chung' ? 20 : NODE_HEIGHT - 20), // Target Chung is top, Hong is bottom relative to node Y? We can just map to middle.
               slot: source.slot
            });
         }
      });
    });

    return { nodes: nodesArray, edges: svgEdges, width: totalWidth, height: totalHeight };
  }, [selectedCategory, mappings, boutQueue, matchHistory]);

  const cleanName = (name: string | undefined) => (!name || name === '---') ? '' : name;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-slate-800 tracking-tighter">Bout Chart</h2>
      </div>
      
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
         <div className="w-full md:w-1/3">
            <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">Select Category</label>
            <select 
               value={selectedCategory}
               onChange={e => setSelectedCategory(e.target.value)}
               className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 font-bold"
            >
                <option value="">-- Choose Category --</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
         </div>
         
         {selectedCategory && (
            <div className="w-full overflow-x-auto overflow-y-auto pb-8 rounded-xl border border-slate-200 bg-slate-50" style={{ minHeight: 400 }}>
               {nodes.length === 0 ? (
                  <p className="text-slate-500 font-bold p-8 text-center">No brackets found for this category.</p>
               ) : (
                  <div style={{ width: Math.max(width, 600), height: Math.max(height, 400), position: 'relative' }}>
                     <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }}>
                        {edges.map((e, i) => {
                           // Define Path. Simple curve or right-angle lines.
                           // Standard bracket line: Horizontal, vertical, horizontal.
                           const midX = e.startX + (e.endX - e.startX) / 2;
                           const endY = e.startY; 
                           // Wait, standard brackets start from source middle, go to target port.
                           // Actually let's just go to target middle.
                           const tY = e.endY; // We can use e.endY which is mapped to slot.
                           const path = `M ${e.startX} ${e.startY} L ${midX} ${e.startY} L ${midX} ${tY} L ${e.endX} ${tY}`;
                           
                           return (
                             <path 
                               key={`${e.id}-${i}`}
                               d={path}
                               fill="none"
                               stroke="#cbd5e1"
                               strokeWidth="2"
                               strokeLinejoin="round"
                             />
                           );
                        })}
                     </svg>
                     
                     {nodes.map((node, i) => {
                        const m = node.match as any;
                        
                        // Parse winner. 
                        // MatchHistoryItem has 'winner', MatchData in queue has none unless we check what 'winner' is? Queue has no winner.
                        const winner = m && 'winner' in m ? m.winner : null; 
                        const nodeRing = m?.ring ? m.ring : parseRingNumber(node.id);
                        
                        return (
                          <div 
                             key={`${node.id}-${i}`} 
                             className="absolute bg-white border border-slate-300 rounded-lg shadow-sm overflow-hidden flex flex-col text-xs"
                             style={{ left: node.x, top: node.y, width: 220, height: 80 }}
                          >
                             <div className="bg-slate-100 border-b border-slate-200 px-2 py-1 flex justify-between items-center text-[10px] font-black uppercase text-slate-500">
                                <span>Bout {formatBoutNumber(nodeRing, node.id, boutNumberingMode)}</span>
                                {winner && <span className="text-green-600">Completed</span>}
                             </div>
                             <div className="flex-1 flex flex-col justify-center">
                                <div className={`flex justify-between items-center px-2 py-1 ${winner === 'Blue' ? 'font-bold bg-blue-50 text-blue-700' : 'text-slate-700'}`}>
                                   <span className="truncate w-full pr-2">
                                      {m ? cleanName(m.blue_name) || <span className="italic text-slate-300">TBD</span> : <span className="italic text-slate-300">Unknown</span>}
                                   </span>
                                </div>
                                <div className="border-t border-slate-100"></div>
                                <div className={`flex justify-between items-center px-2 py-1 ${winner === 'Red' ? 'font-bold bg-red-50 text-red-700' : 'text-slate-700'}`}>
                                   <span className="truncate w-full pr-2">
                                      {m ? cleanName(m.red_name) || <span className="italic text-slate-300">TBD</span> : <span className="italic text-slate-300">Unknown</span>}
                                   </span>
                                </div>
                             </div>
                          </div>
                        )
                     })}
                  </div>
               )}
            </div>
         )}
      </div>
    </div>
  );
}

