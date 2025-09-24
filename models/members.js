const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const validator = require("validator")

const userSchema = new mongoose.Schema({
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

  password: {
    type: String,
    required: true,
    select: false,
  },

  avatar: {
    type: String,
    required: [true, " This field is required."],
    validate:{
        validator(value){
            return validator.isURL(value);
        },
        message: "You must enter a valid Url",
    },
  },
});


userSchema.statics.findUserByCredentials = function findUserCredentials(
  email,
  password
) {
  return this.findOne({ email })
    .select("+password")
    .then((user) => {
      if (!user) {
        return Promise.reject(new Error("Incorrect email or password"));
      }
      return bcrypt.compare(password, user.password).then((matched) => {
        if (!matched) {
          return Promise.reject(new Error("Incorrect email or password"));
        }
        return user;
      });
    });
};

module.exports = mongoose.model("user", userSchema);