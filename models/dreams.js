const mongoose = require("mongoose");
const validator = require("validator");

const dreamSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  date: {
    type: Date,
    required: [true, "This field is required"],
    validate: {
      validator(value) {
        return validator.isDate(value);
      },
    },
  },

  summary: {
    type: String,
    required: true,
    minlength: 15,
    maxlength: 20000,
  },

  categories: {
    type: [String],
    validate: {
      validator: (arr) => arr.length <= 5,
      message: "You can select up to 5 categories",
    },
  },

  tags: {
    type: [String],
    validate: {
      validator: (arr) => arr.length <= 10,
      message: "You can create up to 10 tags",
    },
  },

  location: {
    type: String,
    required: [
      true,
      "This is a required field in order to calculate dream Moon sign",
    ],
  },
  moonSign: {
    type: String,
    required: true,
  },
});

module.exports = mongoose.model("dream", dreamSchema);
