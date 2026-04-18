const express = require("express");
const {
	getCurrentUser,
	updateUser,
	signup,
} = require("../controllers/users");
const { tokenAuthorization, firebaseTokenOnly } = require("../middleware/auth");

const router = express.Router();

// create user profile after Firebase auth — only needs a valid Firebase token, not an existing DB user
router.post("/", firebaseTokenOnly, signup);

// protected routes
router.get("/me", tokenAuthorization, getCurrentUser);
router.patch("/me", tokenAuthorization, updateUser);

module.exports = router;