import admin from "firebase-admin";

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://payment-gateway-8ffe5-default-rtdb.firebaseio.com"
  });
}

export const db = admin.database();
export const adminAuth = admin.auth();
