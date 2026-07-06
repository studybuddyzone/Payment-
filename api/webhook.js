import crypto from "crypto";
import admin from "firebase-admin";

let initError = null;
try {
  if (!admin.apps.length) {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT env variable set hi nahi hai");
    }
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: "https://payment-gateway-8ffe5-default-rtdb.firebaseio.com"
    });
  }
} catch (err) {
  initError = err.message;
}
const db = initError ? null : admin.database();

const ALL_KEY = "ALL";

// Vercel ke liye raw body chahiye signature verify karne ke liye
export const config = {
  api: {
    bodyParser: false
  }
};

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (initError) {
    return res.status(500).json({ error: "Firebase init fail hua: " + initError });
  }

  if (req.method !== "POST") {
    return res.status(405).end();
  }

  const rawBody = await getRawBody(req);
  const timestamp = req.headers["x-webhook-timestamp"];
  const signature = req.headers["x-webhook-signature"];

  const expectedSignature = crypto
    .createHmac("sha256", process.env.CASHFREE_SECRET_KEY)
    .update(timestamp + rawBody)
    .digest("base64");

  if (expectedSignature !== signature) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  const payload = JSON.parse(rawBody);
  const { type, data } = payload;

  if (type === "PAYMENT_SUCCESS_WEBHOOK") {
    const uid = data.customer_details?.customer_id;
    const orderId = data.order?.order_id;

    if (uid && orderId) {
      const snap = await db.ref(`payments/${uid}`).get();
      const existing = snap.exists() ? snap.val() : {};

      const history = Array.isArray(existing.purchaseHistory) ? existing.purchaseHistory : [];
      const alreadyLogged = history.some((h) => h.orderId === orderId);

      let ownedAll = existing.ownedAll === true;
      let ownedSubjects = Array.isArray(existing.ownedSubjects) ? existing.ownedSubjects : [];

      const pending = existing.pendingOrder;
      const subjectKey = pending && pending.orderId === orderId ? pending.subjectKey : null;

      if (!alreadyLogged && subjectKey) {
        if (subjectKey === ALL_KEY) {
          ownedAll = true;
        } else if (!ownedSubjects.includes(subjectKey)) {
          ownedSubjects = [...ownedSubjects, subjectKey];
        }
        history.push({ orderId, subjectKey, amount: data.order?.order_amount, paidAt: Date.now() });
      }

      await db.ref(`payments/${uid}`).update({
        ownedAll,
        ownedSubjects,
        purchaseHistory: history,
        pendingOrder: null,
        status: "PAID",
        lastPaidAt: Date.now()
      });
    }
  }

  return res.status(200).json({ received: true });
}
