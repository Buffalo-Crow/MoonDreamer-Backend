const express = require("express");
const tokenAuthorization = require("../middleware/auth");
const {
  generateSingleInsight,
  generateUserPatternInsight,
  generateCommunityInsight,
} = require("../controllers/aiInsights");

const router = express.Router();

router.post("/single/:id", tokenAuthorization, generateSingleInsight);
router.post("/user-pattern", tokenAuthorization, generateUserPatternInsight);
router.post("/community", tokenAuthorization, generateCommunityInsight);

module.exports = router;
