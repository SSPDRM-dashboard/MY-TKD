import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import fs from 'fs';

const app = initializeApp(JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8')));
const db = getFirestore(app, "ai-studio-e1347685-6c03-4b4d-bc4e-0dc0bfd5b849");

async function run() {
  const currentEventDoc = await getDoc(doc(db, 'sync', 'tkd_current_event_v3'));
  let currentEventId = '';
  if (currentEventDoc.exists()) {
    currentEventId = currentEventDoc.data().value;
  }
  console.log("Current Event ID:", currentEventId);

  // Get event metadata
  const eventsDoc = await getDoc(doc(db, 'sync', 'tkd_events_v3'));
  if (eventsDoc.exists()) {
    const events = eventsDoc.data().value || [];
    const currentEvent = events.find((e: any) => e.id === currentEventId);
    console.log("Current Event:", JSON.stringify(currentEvent, null, 2));
  } else {
    console.log("Events document not found.");
  }
  process.exit(0);
}
run();
