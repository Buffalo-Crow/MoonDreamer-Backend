const mongoose = require("mongoose");
const validator = require("validator");

const userSchema = new mongoose.Schema({
  firebaseUid: {
    type: String,
    required: true,
    unique: true,
  },
  username: {
    type: String,
    required: true,
    minlength: 5,
    maxLength: 30,
  },
  email: {
    type: String,
    required: [true, "This field is required. "],
    unique: true,
    validate: {
      validator(value) {
        return validator.isEmail(value);
      },
      message: "You must enter a valid email address",
    },
  },
  profilePicture: {
    type: String,
    required: [true, " This field is required."],
    validate: {
      validator(value) {
        return validator.isURL(value);
      },
      message: "You must enter a valid Url",
    },
  },
  betaAgreement: {
    accepted: {
      type: Boolean,
      required: true,
      default: false,
    },
    version: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    acceptedAt: {
      type: Date,
      required: true,
    },
    acceptedFromIp: {
      type: String,
      default: null,
    },
    acceptedUserAgent: {
      type: String,
      default: null,
    },
  },
});

module.exports = mongoose.model("user", userSchema);