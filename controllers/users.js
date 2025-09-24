const User = require("../models/members");
const bcrypt = require("bcryptjs");
const BadRequestError = require("../utils/errorClasses/badRequest");
const NotFoundError = require("../utils/errorClasses/notFound");
const ConflictError = require("../utils/errorClasses/conflict");

const getCurrentUser = (req, res, next) => {
  const { _id: userId } = req.user;

  User.findById(userId)
    .orFail()
    .then((user) => {
      res.status(200).send(user);
    })

    .catch((err) => {
      if (err.name === "CastError") {
        return next(new BadRequestError("Invalid user ID format"));
      }
      if (err.name === "DocumentNotFoundError") {
        return next(new NotFoundError("User not found"));
      }
      return next(err);
    });
};

const signup = async (req, res, next ) => {
  const { username, email, password, avatar } = req.body;
  if (!email || !password) {
    next(new BadRequestError("Email and password are required"));
    return;
  }
  bcrypt
    .hash(password, 10)
    .then((hash) => User.create({ username, email, password: hash, avatar }))
    .then((user) => {
      const userObject = user.toObject();
      delete userObject.password;
      res.status(201).send(userObject);
    })
    .catch((err) => {
      console.error(err);
      if (err.name === "ValidationError") {
        return next(new BadRequestError("Invalid Request"));
      }
      if (err.code === 11000) {
        return next(new ConflictError("Email already exists"));
      }
      return next(err);
    });
  }

const updateUser = (req, res, next) => {
  const { username, avatar } = req.body;
  User.findByIdAndUpdate(
    req.user._id,
    { username, avatar },
    { new: true, runValidators: true }
  )
    .orFail()
    .then((user) => {
      res.status(200).send({ data: user });
    })
    .catch((err) => {
      if (err.name === "ValidationError") {
        return next(new BadRequestError("Invalid Request"));
      }
      if (err.name === "DocumentNotFoundError") {
        return next(new NotFoundError("User not found"));
      }
      if (err.name === "CastError") {
        return next(new BadRequestError("Invalid user ID format"));
      }
      return next(err);
    });
};

module.exports = {
  signup,
  getCurrentUser,
  updateUser,
};
