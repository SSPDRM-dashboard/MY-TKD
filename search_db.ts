import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const app = initializeApp(JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8')));
const db = getFirestore(app, "ai-studio-e1347685-6c03-4b4d-bc4e-0dc0bfd5b849");

async function run() {
  const matchHistSnap = await getDocs(collection(db, 'matchHistory'));
  console.log("Total matchHistory documents in database:", matchHistSnap.size);
  let found = 0;
  matchHistSnap.forEach(doc => {
    const data = doc.data();
    if (String(data.bout).includes('4045') || String(data.bout).includes('4046')) {
      console.log(`Found in matchHistory db collection: ID=${doc.id}`, data);
      found++;
    }
  });
  console.log(`Found ${found} matching bouts in matchHistory collection`);
  process.exit(0);
}
run();
