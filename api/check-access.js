import { db, adminAuth } from "./_firebase.js";

export default async function handler(req, res) {
  const { idToken } = req.query;

  if (!idToken) {
    return res.status(400).json({ error: "idToken chahiye" });
  }

  let uid;
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    uid = decoded.uid;
  } catch (err) {
    return res.status(401).json({ error: "Login expire ho gaya" });
  }

  const snap = await db.ref(`payments/${uid}`).get();

  if (snap.exists() && snap.val().status === "PAID") {
    return res.status(200).json({ paid: true, owned: snap.val().subjectKey });
  }

  return res.status(200).json({ paid: false });
}
