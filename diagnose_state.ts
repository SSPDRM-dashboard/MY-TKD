import { initializeApp } from 'firebase/app';
import { getFirestore, getDoc, doc } from 'firebase/firestore';
import fs from 'fs';

const app = initializeApp(JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8')));
const db = getFirestore(app, "ai-studio-e1347685-6c03-4b4d-bc4e-0dc0bfd5b849");

async function run() {
  const currentEventDoc = await getDoc(doc(db, 'sync', 'tkd_current_event_v3'));
  console.log("Current Event ID in Firestore:", currentEventDoc.exists() ? currentEventDoc.data().value : "None");

  const eventsDoc = await getDoc(doc(db, 'sync', 'tkd_events_v3'));
  const events = eventsDoc.exists() ? (eventsDoc.data().value || []) : [];
  console.log("Events found in Firestore:", events.length);
  events.forEach((e: any) => {
    console.log(`- Event ID: ${e.id} | Name: ${e.name}`);
  });

  const qDoc = await getDoc(doc(db, 'sync', 'tkd_bout_queue'));
  if (qDoc.exists()) {
    const queue = qDoc.data().value || [];
    console.log("Total Queue items:", queue.length);
    const eventIdsInQueue = Array.from(new Set(queue.map((qi: any) => qi.data?.eventId)));
    console.log("Unique eventIds in Queue:", eventIdsInQueue);
    
    // Print first 5 items
    console.log("First 5 Queue items sample:");
    queue.slice(0, 5).forEach((qi: any) => {
      console.log(`- id: ${qi.id} | eventId: ${qi.data?.eventId} | ring: ${qi.data?.ring} | bout: ${qi.data?.bout} | name: ${qi.data?.blue_name} vs ${qi.data?.red_name}`);
    });
  } else {
    console.log("No tkd_bout_queue found in Firestore.");
  }
  process.exit(0);
}
run();
