const Dream = require("../models/dreams");
const NotFoundError = require("../utils/errorClasses/notFound");
const BadRequestError = require("../utils/errorClasses/badRequest");

const createDream = (req, res, next) => {
  const { date, summary, categories, tags, location, moonSign } = req.body;
  Dream.create({
    userId: req.user._id,
    date,
    summary,
    categories,
    tags,
    location,
    moonSign,
  })
    .then((dream) => res.status(201).send(dream))
    .catch((err) => {
      if (err.name === "ValidationError") {
        next(new BadRequestError("Invalid data provided"));
      } else {
        next(err);
      }
    });
};

const getDreams = (req, res, next) => {
  Dream.find({ userId: req.user._id })
    .then((dreams) => res.status(200).send(dreams))
    .catch(next);
};

const getDreamById = (req, res, next) => {
  Dream.findOne({ _id: req.params.id, userId: req.user._id })
    .orFail()
    .then((dream) => res.status(200).send(dream))
    .catch((err) => {
      if (err.name === "DocumentNotFoundError") {
        next(new NotFoundError("Dream not found"));
      } else {
        next(err);
      }
    });
};

const updateDream = (req, res, next) => {
  const { date, summary, categories, tags, location, moonSign } = req.body;

  Dream.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { date, summary, categories, tags, location, moonSign },
    { new: true, runValidators: true }
  )
    .orFail()
    .then((dream) => res.status(200).send(dream))
    .catch((err) => {
      if (err.name === "ValidationError") {
        return next(new BadRequestError("Invalid data provided"));
      }
      if (err.name === "DocumentNotFoundError") {
        return next(new NotFoundError("Dream not found"));
      } else {
        next(err);
      }
    });
};

const deleteDream = (req, res, next) => {
  Dream.findOneAndDelete({ _id: req.params.id, userId: req.user._id })
    .orFail()
    .then(() => res.status(200).send({ message: "Dream deleted" }))
    .catch((err) => {
      if (err.name === "DocumentNotFoundError") {
        next(new NotFoundError("Dream not found"));
      }
      return next(err);
    });
};

module.exports = {
  createDream,
  getDreams,
  getDreamById,
  updateDream,
  deleteDream,
};
