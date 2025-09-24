const express = require("express");
const login = require("../controllers/auth");
const { signup } = require("../controllers/users");

const router = express.Router();

// signup
router.post("/signup",signup);

// login
router.post("/login", login);

module.exports = router;