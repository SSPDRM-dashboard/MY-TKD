import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import fs from 'fs';

const app = initializeApp(JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8')));
const db = getFirestore(app, "ai-studio-e1347685-6c03-4b4d-bc4e-0dc0bfd5b849");

async function run() {
  const docRef = doc(db, 'sync', 'tkd_events_v3');
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    console.log("Events v3:", JSON.stringify(snap.data().value, null, 2));
  }
  
  const curRef = doc(db, 'sync', 'tkd_current_event_v3');
  const curSnap = await getDoc(curRef);
  if (curSnap.exists()) {
    console.log("Current Event ID v3:", curSnap.data().value);
  }
  
  // Let's search match history for eventId b79iiwes0
  const histRef = doc(db, 'sync', 'tkd_match_history');
  const histSnap = await getDoc(histRef);
  if (histSnap.exists()) {
    const hist = histSnap.data().value || [];
    const filtered = hist.filter((h: any) => h.eventId === 'b79iiwes0');
    console.log("History elements count for current event b79iiwes0:", filtered.length);
    if (filtered.length > 0) {
      console.log("Sample current event history:", JSON.stringify(filtered.slice(0, 5), null, 2));
    }
    
    // Total events represented in match history
    const eventIds = Array.from(new Set(hist.map((h: any) => h.eventId)));
    console.log("Event IDs with history:", eventIds);
    
    // Are there any matches for 'eujxmu6aq' or other?
    const b79Bouts = filtered.map((h: any) => h.bout);
    console.log("Current event bout numbers:", b79Bouts);
    
    // Search the history for ANY winner of 4045 or 4046 in the whole history across any event
    const search4045 = hist.filter((h: any) => String(h.bout) === '4045');
    const search4046 = hist.filter((h: any) => String(h.bout) === '4046');
    console.log("Any 4045 in any event:", search4045);
    console.log("Any 4046 in any event:", search4046);
  }
  
  // Also list all bouts in the current queue
  const queueRef = doc(db, 'sync', 'tkd_bout_queue');
  const queueSnap = await getDoc(queueRef);
  if (queueSnap.exists()) {
    const queue = queueSnap.data().value || [];
    console.log("Total queue items:", queue.length);
    const currEventQ = queue.filter((qi: any) => qi.data?.eventId === 'b79iiwes0');
    console.log("Queue items for current event (first 10):", currEventQ.slice(0, 10).map((qi: any) => qi.data?.bout));
    
    // Check if 4045 or 4046 are present in the queue
    const q4045 = queue.filter((qi: any) => String(qi.data?.bout) === '4045');
    console.log("Is 4045 in queue?", q4045.map((q: any) => ({ bout: q.data?.bout, ring: q.data?.ring, eventId: q.data?.eventId })));
    const q4046 = queue.filter((qi: any) => String(qi.data?.bout) === '4046');
    console.log("Is 4046 in queue?", q4046.map((q: any) => ({ bout: q.data?.bout, ring: q.data?.ring, eventId: q.data?.eventId })));
    const q4048 = queue.filter((qi: any) => String(qi.data?.bout) === '4048');
    console.log("Is 4048 in queue?", q4048.map((q: any) => ({ bout: q.data?.bout, ring: q.data?.ring, eventId: q.data?.eventId })));
  }
  
  // Also check rings
  const ringsRef = doc(db, 'sync', 'tkd_rings');
  const ringsSnap = await getDoc(ringsRef);
  if (ringsSnap.exists()) {
    const rings = ringsSnap.data().value || [];
    console.log("Rings:", JSON.stringify(rings.map((r: any) => ({
      ringNumber: r.ringNumber,
      currentBout: r.currentBout ? { bout: r.currentBout.bout, red_name: r.currentBout.red_name, blue_name: r.currentBout.blue_name, eventId: r.currentBout.eventId } : null,
      onDeck: r.onDeck ? r.onDeck.bout : null,
      inTheHole: r.inTheHole ? r.inTheHole.bout : null
    })), null, 2));
  }
  
  process.exit(0);
}
run();
