import admin from "firebase-admin";

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://payment-gateway-8ffe5-default-rtdb.firebaseio.com"
  });
}
const db = admin.database();

const ALL_KEY = "ALL";

export default async function handler(req, res) {
  const { order_id, uid } = req.query;

  if (!order_id || !uid) {
    return res.status(400).json({ error: "order_id aur uid dono chahiye" });
  }

  try {
    const response = await fetch(`https://api.cashfree.com/pg/orders/${order_id}`, {
      headers: {
        "x-client-id": process.env.CASHFREE_APP_ID,
        "x-client-secret": process.env.CASHFREE_SECRET_KEY,
        "x-api-version": "2023-08-01"
      }
    });

    const data = await response.json();

    if (data.order_status === "PAID") {
      const snap = await db.ref(`payments/${uid}`).get();
      const existing = snap.exists() ? snap.val() : {};

      const history = Array.isArray(existing.purchaseHistory) ? existing.purchaseHistory : [];
      const alreadyLogged = history.some((h) => h.orderId === order_id);

      let ownedAll = existing.ownedAll === true;
      let ownedSubjects = Array.isArray(existing.ownedSubjects) ? existing.ownedSubjects : [];

      const pending = existing.pendingOrder;
      const subjectKey = pending && pending.orderId === order_id ? pending.subjectKey : null;

      if (!alreadyLogged && subjectKey) {
        if (subjectKey === ALL_KEY) {
          ownedAll = true;
        } else if (!ownedSubjects.includes(subjectKey)) {
          ownedSubjects = [...ownedSubjects, subjectKey];
        }
        history.push({ orderId: order_id, subjectKey, amount: data.order_amount, paidAt: Date.now() });
      }

      await db.ref(`payments/${uid}`).update({
        ownedAll,
        ownedSubjects,
        purchaseHistory: history,
        pendingOrder: null,
        status: "PAID",
        lastPaidAt: Date.now()
      });

      return res.status(200).json({ success: true });
    }

    return res.status(200).json({ success: false, status: data.order_status });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
