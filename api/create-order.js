import admin from "firebase-admin";

// ---------------------------------------------------------------
// Firebase Admin init seedha yahin hai (koi alag _firebase.js nahi hai).
// ---------------------------------------------------------------
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://payment-gateway-8ffe5-default-rtdb.firebaseio.com"
  });
}
const db = admin.database();
const adminAuth = admin.auth();

// ---------------------------------------------------------------
// Subjects seedha yahin hardcoded hain (koi subjects-config.js nahi hai).
// Naya subject / price / drive link badalne ke liye seedha yahi edit karo.
// ---------------------------------------------------------------
const SUBJECTS = {
  BCME:      { name: "Basic Civil & Mechanical Engineering", price: 59, driveLink: "PASTE_LINK_HERE" },
  BEEE:      { name: "Basic Electrical & Electronics Engineering", price: 59, driveLink: "PASTE_LINK_HERE" },
  CHEMISTRY: { name: "Engineering Chemistry", price: 59, driveLink: "PASTE_LINK_HERE" },
  CMS:       { name: "Communication Skills", price: 59, driveLink: "PASTE_LINK_HERE" },
  GRAPHICS:  { name: "Engineering Graphics", price: 59, driveLink: "PASTE_LINK_HERE" },
  M1:        { name: "Engineering Mathematics I", price: 59, driveLink: "PASTE_LINK_HERE" },
  M2:        { name: "Engineering Mathematics II", price: 59, driveLink: "https://drive.google.com/drive/folders/1ZIBJYUdwoBhSi4JQr3HOxAWnVpliUUt1" },
  MECHANIC:  { name: "Engineering Mechanics", price: 59, driveLink: "PASTE_LINK_HERE" },
  PANDPS:    { name: "Programming and Problem Solving", price: 59, driveLink: "PASTE_LINK_HERE" },
  PHYSICS:   { name: "Engineering Physics", price: 59, driveLink: "PASTE_LINK_HERE" }
};
const ALL_PRICE = 499;
const ALL_KEY = "ALL";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { idToken, subjectKey } = req.body;

  if (!idToken || !subjectKey) {
    return res.status(400).json({ error: "idToken aur subjectKey dono chahiye" });
  }

  if (subjectKey !== ALL_KEY && !SUBJECTS[subjectKey]) {
    return res.status(400).json({ error: "Ye subject exist nahi karta" });
  }

  let uid;
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    uid = decoded.uid;
  } catch (err) {
    return res.status(401).json({ error: "Login expire ho gaya, dobara login karein" });
  }

  const snap = await db.ref(`payments/${uid}`).get();
  const existing = snap.exists() ? snap.val() : {};
  const ownedAll = existing.ownedAll === true;
  const ownedSubjects = Array.isArray(existing.ownedSubjects) ? existing.ownedSubjects : [];

  // agar already ALL le chuka hai to kuch bhi dobara mat becho
  if (ownedAll) {
    return res.status(200).json({ alreadyPaid: true, ownedAll: true });
  }

  // agar yahi specific subject pehle se hai to dobara mat becho
  if (subjectKey !== ALL_KEY && ownedSubjects.includes(subjectKey)) {
    return res.status(200).json({ alreadyPaid: true, subjectKey });
  }

  const price = subjectKey === ALL_KEY ? ALL_PRICE : SUBJECTS[subjectKey].price;
  const orderId = "order_" + uid.slice(0, 8) + "_" + Date.now();

  try {
    const response = await fetch("https://api.cashfree.com/pg/orders", {
      method: "POST",
      headers: {
        "x-client-id": process.env.CASHFREE_APP_ID,
        "x-client-secret": process.env.CASHFREE_SECRET_KEY,
        "x-api-version": "2023-08-01",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        order_id: orderId,
        order_amount: price,
        order_currency: "INR",
        customer_details: {
          customer_id: uid,
          customer_phone: "9999999999"
        },
        order_meta: {
          return_url: `https://${req.headers.host}/success.html?order_id={order_id}&uid=${uid}`
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(400).json({ error: data.message || "Order create nahi hua" });
    }

    // sirf pending order record karo, purane owned subjects ko chhedo mat
    await db.ref(`payments/${uid}`).update({
      ownedAll: ownedAll,
      ownedSubjects: ownedSubjects,
      pendingOrder: {
        orderId,
        subjectKey,
        status: "PENDING",
        createdAt: Date.now()
      }
    });

    return res.status(200).json({
      payment_session_id: data.payment_session_id,
      order_id: orderId
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
