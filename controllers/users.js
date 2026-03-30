const User = require("../models/members");
const BadRequestError = require("../utils/errorClasses/badRequest");
const NotFoundError = require("../utils/errorClasses/notFound");
const ConflictError = require("../utils/errorClasses/conflict");

const getCurrentUser = (req, res, next) => {
  const { firebaseUid } = req.user;

  User.findOne({ firebaseUid })
    .orFail()
    .then((user) => res.status(200).send(user))
    .catch((err) => {
      if (err.name === "DocumentNotFoundError") {
        return next(new NotFoundError("User not found"));
      }
      return next(err);
    });
};

const signup = async (req, res, next) => {
  const { firebaseUid } = req.user;
  const { username, email, avatar } = req.body;

  if (!email || !username || !avatar) {
    return next(new BadRequestError("All fields are required"));
  }

  try {
    const user = await User.create({ firebaseUid, username, email, avatar });
    return res.status(201).send(user);
  } catch (err) {
    if (err.name === "ValidationError") {
      return next(new BadRequestError("Invalid Request"));
    }
    if (err.code === 11000) {
      // Check if a user with this email already exists (Google ↔ email/password linking)
      const existingUser = await User.findOne({ email });
      if (existingUser && existingUser.firebaseUid !== firebaseUid) {
        existingUser.firebaseUid = firebaseUid;
        await existingUser.save();
        return res.status(200).send(existingUser);
      }
      // Same firebaseUid already exists — return the existing user
      if (existingUser) {
        return res.status(200).send(existingUser);
      }
      return next(new ConflictError("User already exists"));
    }
    return next(err);
  }
};

const updateUser = (req, res, next) => {
  const { username, avatar } = req.body;

  User.findOneAndUpdate(
    { firebaseUid: req.user.firebaseUid },
    { username, avatar },
    { new: true, runValidators: true }
  )
    .orFail()
    .then((user) => res.status(200).send({ data: user }))
    .catch((err) => {
      if (err.name === "ValidationError") {
        return next(new BadRequestError("Invalid Request"));
      }
      if (err.name === "DocumentNotFoundError") {
        return next(new NotFoundError("User not found"));
      }
      return next(err);
    });
};

module.exports = { signup, getCurrentUser, updateUser };
