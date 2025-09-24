const express = require("express");
const tokenAuthorization = require("../middleware/auth");
const {
  createDream,
  getDreams,
  getDreamById,
  updateDream,
  deleteDream,
} = require("../controllers/userDreams");

const router = express.Router();

// Protected routes for authenticated users
router.use(tokenAuthorization);

// CRUD routes
router.post("/", createDream); // Create a dream
router.get("/", getDreams); // Get all dreams for the current user
router.get("/:id", getDreamById); // Get a single dream by ID
router.patch("/:id", updateDream); // Update a dream by ID
router.delete("/:id", deleteDream); // Delete a dream by ID

module.exports = router;