import { db, adminAuth } from "./_firebase.js";

export default async function handler(req, res) {
  const { idToken, subjectKey } = req.query;

  if (!idToken || !subjectKey) {
    return res.status(400).json({ error: "idToken aur subjectKey dono chahiye" });
  }

  let uid;
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    uid = decoded.uid;
  } catch (err) {
    return res.status(401).json({ error: "Login expire ho gaya" });
  }

  const paymentSnap = await db.ref(`payments/${uid}`).get();
  if (!paymentSnap.exists() || paymentSnap.val().status !== "PAID") {
    return res.status(403).json({ error: "Access nahi hai" });
  }

  const owned = paymentSnap.val().subjectKey;
  if (owned !== "ALL" && owned !== subjectKey) {
    return res.status(403).json({ error: "Ye subject aapne nahi khareeda" });
  }

  const subjectSnap = await db.ref(`subjects/${subjectKey}`).get();
  if (!subjectSnap.exists() || !subjectSnap.val().driveLink) {
    return res.status(404).json({ error: "Link abhi available nahi hai" });
  }

  return res.status(200).json({ driveLink: subjectSnap.val().driveLink });
}
