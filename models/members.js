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
  avatar: {
    type: String,
    required: [true, " This field is required."],
    validate: {
      validator(value) {
        return validator.isURL(value);
      },
      message: "You must enter a valid Url",
    },
  },
});

module.exports = mongoose.model("user", userSchema);