import { Router } from "express";

const router = Router();

// test route — check karne ke liye
router.get("/test", (req, res) => {
  res.send("User routes working 👍");
});

export default router;
