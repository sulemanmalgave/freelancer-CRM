import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  projectId: "gen-lang-client-0198820455",
  appId: "1:446581031176:web:99934ad9fce3592ca2ecbd",
  apiKey: "AIzaSyCBcHLWdB7EnQSpkmxnDEbmcFs7ICQyeoA",
  authDomain: "gen-lang-client-0198820455.firebaseapp.com",
  storageBucket: "gen-lang-client-0198820455.firebasestorage.app",
  messagingSenderId: "446581031176"
};

const databaseId = "ai-studio-d5cae848-c1ed-4f2e-9f89-e9c69ed15c6c";

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore targeting the custom databaseId with experimentalForceLongPolling enabled
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, databaseId);

// Export Firebase Auth
export const auth = getAuth(app);
