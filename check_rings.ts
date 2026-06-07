import { initializeApp } from 'firebase/app';
import { getFirestore, getDoc, doc } from 'firebase/firestore';
import fs from 'fs';

const app = initializeApp(JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8')));
const db = getFirestore(app, "ai-studio-e1347685-6c03-4b4d-bc4e-0dc0bfd5b849");

async function run() {
  const rDoc = await getDoc(doc(db, 'sync', 'tkd_rings'));
  if (rDoc.exists()) {
    let data = rDoc.data().value;
    console.log("Rings:", data.length);
    for (const r of data) {
      console.log(`Ring ${r.ringNumber} current:`, r.currentBout ? r.currentBout.eventId : "None");
    }
  }
  process.exit(0);
}
run();
