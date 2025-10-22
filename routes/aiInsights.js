const express = require("express");
const tokenAuthorization = require("../middleware/auth");
const {
  generateSingleInsight,
  generateUserPatternInsight,
  generateCommunityInsight,
  saveInsight,
  getDreamInsights,
  deleteInsight,
} = require("../controllers/aiInsights");

const router = express.Router();

router.post("/single/:id", tokenAuthorization, generateSingleInsight);
router.post("/user-pattern", tokenAuthorization, generateUserPatternInsight);
router.post("/community", tokenAuthorization, generateCommunityInsight);
router.post("/save", tokenAuthorization, saveInsight);
router.get("/dream/:dreamId", tokenAuthorization, getDreamInsights);
router.delete("/:id", tokenAuthorization, deleteInsight);

module.exports = router;
