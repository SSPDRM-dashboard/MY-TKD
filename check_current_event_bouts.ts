import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import fs from 'fs';

const app = initializeApp(JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8')));
const db = getFirestore(app, "ai-studio-e1347685-6c03-4b4d-bc4e-0dc0bfd5b849");

async function run() {
  const queueRef = doc(db, 'sync', 'tkd_bout_queue');
  const snap = await getDoc(queueRef);
  if (snap.exists()) {
    const queue = snap.data().value || [];
    console.log("Total queue items:", queue.length);
    const eventQueue = queue.filter((qi: any) => qi.data?.eventId === 'b79iiwes0');
    console.log("Total queue items for event b79iiwes0:", eventQueue.length);
    // Sort and print all bouts for Ring 3 and event b79iiwes0 in queue
    const r3Bouts = eventQueue.filter((qi: any) => qi.data?.ring === 3 || String(qi.data?.ring) === '3');
    console.log("Ring 3 bouts in queue count:", r3Bouts.length);
    r3Bouts.sort((a: any, b: any) => {
      return String(a.data?.bout).localeCompare(String(b.data?.bout));
    });
    console.log("All Ring 3 bouts in queue:");
    r3Bouts.forEach((b: any) => {
      console.log(`Bout: ${b.data?.bout}, Red: ${b.data?.red_name} (${b.data?.red_club}), Blue: ${b.data?.blue_name} (${b.data?.blue_club}), Category: ${b.data?.category}`);
    });
  }
  process.exit(0);
}
run();
