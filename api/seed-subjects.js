import { db } from "./_firebase.js";

const SUBJECTS_DATA = {
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

export default async function handler(req, res) {
  const { key } = req.query;

  if (key !== process.env.SEED_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // private node - driveLink ke saath, sirf Admin SDK access karega
    await db.ref("subjects").set(SUBJECTS_DATA);

    // public node - sirf name aur price, client-side card display ke liye
    const publicData = {};
    Object.keys(SUBJECTS_DATA).forEach((k) => {
      publicData[k] = { name: SUBJECTS_DATA[k].name, price: SUBJECTS_DATA[k].price };
    });
    await db.ref("subjects_public").set(publicData);

    return res.status(200).json({ success: true, message: "Subjects seed ho gaye (private + public dono)" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
