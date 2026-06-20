import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDocFromServer, disableNetwork, setLogLevel } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

setLogLevel('silent');

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export const disableFirestoreNetwork = async () => {
  try {
    setLogLevel('silent');
    await disableNetwork(db);
    console.log("Firestore network disabled due to quota exhaustion.");
  } catch (err) {
    console.error("Failed to disable Firestore network:", err);
  }
};

// Test Firestore connection on boot with safety retries and grace delays
async function testFirestoreConnection() {
  if (localStorage.getItem('tkd_disable_firebase') === 'true') {
    disableFirestoreNetwork();
    return;
  }

  // Defer first check to allow network interfaces to fully settle
  await new Promise(resolve => setTimeout(resolve, 2000));

  let retries = 3;
  while (retries > 0) {
    try {
      await getDocFromServer(doc(db, 'sync', 'connection_test'));
      console.log("Firestore connection verified.");
      return; // Success!
    } catch (error: any) {
      if (error.code === 'resource-exhausted' || error.message?.toLowerCase().includes('quota')) {
        console.warn("Firestore Quota Exceeded on boot.");
        disableFirestoreNetwork();
        window.dispatchEvent(new CustomEvent('firestore-quota-exceeded'));
        return;
      }
      
      retries--;
      if (retries > 0) {
        console.warn(`Firestore connection attempt failed. Retrying in 2s... (Remaining: ${retries})`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        // All retries failed. Handle gracefully to allow local/offline operation.
        console.log("Firestore connection test finished: cache-first or offline mode active.");
        if (error instanceof Error && error.message.toLowerCase().includes('offline')) {
          console.info("Firestore connection check info: Cache/Offline mode is currently active.", error.message);
        } else {
          console.info("Firestore connection check info: non-blocking warning.", error);
        }
      }
    }
  }
}
testFirestoreConnection();
