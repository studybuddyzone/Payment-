import { db, adminAuth } from "./_firebase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { idToken, subjectKey } = req.body;

  if (!idToken || !subjectKey) {
    return res.status(400).json({ error: "idToken aur subjectKey dono chahiye" });
  }

  let uid;
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    uid = decoded.uid;
  } catch (err) {
    return res.status(401).json({ error: "Login expire ho gaya, dobara login karein" });
  }

  // agar pehle se paid hai to naya order mat banao
  const existing = await db.ref(`payments/${uid}`).get();
  if (existing.exists() && existing.val().status === "PAID") {
    return res.status(200).json({ alreadyPaid: true, subjectKey: existing.val().subjectKey });
  }

  // subject / price / drive link nikalo
  let price, driveLink;

  if (subjectKey === "ALL") {
    const subjectsSnap = await db.ref("subjects").get();
    if (!subjectsSnap.exists()) {
      return res.status(400).json({ error: "Subjects configure nahi hain" });
    }
    const subjects = subjectsSnap.val();
    const keys = Object.keys(subjects).filter((k) => k !== "ALL");
    price = keys.reduce((acc, k) => acc * Number(subjects[k].price), 1);
    driveLink = subjects["ALL"]?.driveLink || null;
  } else {
    const subjectSnap = await db.ref(`subjects/${subjectKey}`).get();
    if (!subjectSnap.exists()) {
      return res.status(400).json({ error: "Ye subject exist nahi karta" });
    }
    price = Number(subjectSnap.val().price);
    driveLink = subjectSnap.val().driveLink;
  }

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

    await db.ref(`payments/${uid}`).set({
      orderId,
      subjectKey,
      driveLink,
      status: "PENDING",
      createdAt: Date.now()
    });

    return res.status(200).json({
      payment_session_id: data.payment_session_id,
      order_id: orderId
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
