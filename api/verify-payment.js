import { db } from "./_firebase.js";

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
      const paymentSnap = await db.ref(`payments/${uid}`).get();
      const existing = paymentSnap.exists() ? paymentSnap.val() : {};

      await db.ref(`payments/${uid}`).set({
        ...existing,
        orderId: order_id,
        status: "PAID",
        amount: data.order_amount,
        paidAt: Date.now()
      });

      return res.status(200).json({ success: true, driveLink: existing.driveLink });
    }

    return res.status(200).json({ success: false, status: data.order_status });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
