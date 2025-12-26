const express = require("express");
const tokenAuthorization = require("../middleware/auth");
const {
  createDream,
  getDreams,
  getDreamById,
  updateDream,
  deleteDream,
  getPublicDreams,
  toggleLike,
  addComment,
} = require("../controllers/userDreams");

const router = express.Router();

// Public route: community feed of dreams marked public
router.get("/public", getPublicDreams);

// Protected routes for authenticated users
router.use(tokenAuthorization);

// CRUD routes
router.post("/", createDream); // Create a dream
router.get("/", getDreams); // Get all dreams for the current user
router.get("/:id", getDreamById); // Get a single dream by ID
router.patch("/:id", updateDream); // Update a dream by ID
router.delete("/:id", deleteDream); // Delete a dream by ID

// Social interaction routes
router.post("/:dreamId/like", toggleLike); // Toggle like on a dream
router.post("/:dreamId/comment", addComment); // Add comment to a dream

module.exports = router;