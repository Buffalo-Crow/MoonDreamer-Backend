const express = require("express");
const { getCurrentUser, updateUser, signup } = require("../controllers/users");
const tokenAuthorization = require("../middleware/auth");

const router = express.Router();

// create user profile after Firebase auth
router.post("/", tokenAuthorization, signup);

// protected routes
router.get("/me", tokenAuthorization, getCurrentUser);
router.patch("/me", tokenAuthorization, updateUser);

module.exports = router;