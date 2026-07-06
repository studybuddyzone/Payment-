import crypto from "crypto";
import { db } from "./_firebase.js";

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
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  const rawBody = await getRawBody(req);
  const timestamp = req.headers["x-webhook-timestamp"];
  const signature = req.headers["x-webhook-signature"];

  // signature verify karo
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

    if (uid) {
      const existingSnap = await db.ref(`payments/${uid}`).get();
      const existing = existingSnap.exists() ? existingSnap.val() : {};

      await db.ref(`payments/${uid}`).set({
        ...existing,
        orderId,
        status: "PAID",
        amount: data.order?.order_amount,
        paidAt: Date.now()
      });
    }
  }

  return res.status(200).json({ received: true });
}
