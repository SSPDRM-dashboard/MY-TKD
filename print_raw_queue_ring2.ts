import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import fs from 'fs';

const app = initializeApp(JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8')));
const db = getFirestore(app, "ai-studio-e1347685-6c03-4b4d-bc4e-0dc0bfd5b849");

async function run() {
  const qDoc = await getDoc(doc(db, 'sync', 'tkd_bout_queue'));
  if (qDoc.exists()) {
    const queue = qDoc.data().value || [];
    console.log("Total queue size:", queue.length);
    const ring2 = queue.filter((item: any) => String(item.data.ring) === '2');
    console.log("Total Ring 2 queue items:", ring2.length);
    ring2.forEach((item: any) => {
      console.log(`Bout ID: ${item.id} | Bout: ${item.data.bout} | EventId: ${item.data.eventId} | Blue: ${item.data.blue_name} vs Red: ${item.data.red_name}`);
    });
  }
  process.exit(0);
}
run();
