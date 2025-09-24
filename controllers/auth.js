const jwt = require("jsonwebtoken");
const User = require("../models/members");
const BadRequestError = require("../utils/errorClasses/badRequest");
const UnauthorizedError = require("../utils/errorClasses/unauthorized");

const JWT_SECRET = process.env.JWT_SECRET;
const SUCCESS = 200; // ensure this is defined

const login = (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new BadRequestError("Email and password are required"));
  }

  User.findUserByCredentials(email, password)
    .then((user) => {
      // Create token with minimal user info in payload
      const tokenPayload = {
        _id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
      };
      const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "7d" });

      // Send both token and user info to frontend
      return res.status(SUCCESS).send({
        token,
        user: {
          _id: user._id,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
        },
      });
    })
    .catch((err) => {
      if (err.message === "Incorrect email or password") {
        return next(new UnauthorizedError("Incorrect email or password"));
      }
      return next(err);
    });
};

module.exports = login;