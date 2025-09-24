const express = require("express");
const { getCurrentUser, updateUser } = require("../controllers/users");
const tokenAuthorization = require("../middleware/auth");

const router = express.Router();

// protected routes
router.get("/me", tokenAuthorization, getCurrentUser);
router.patch("/me", tokenAuthorization, updateUser);

module.exports = router;