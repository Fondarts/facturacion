import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBHXwrnBUQ8V8L9dDCuQXalFJCwpAYoH-Q",
  authDomain: "facturacion-d42fe.firebaseapp.com",
  projectId: "facturacion-d42fe",
  storageBucket: "facturacion-d42fe.firebasestorage.app",
  messagingSenderId: "38660774310",
  appId: "1:38660774310:web:b1daccb10c53436f4ad767",
  measurementId: "G-MJ2M3FQY62"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);

export default app;

