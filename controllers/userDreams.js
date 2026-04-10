const Dream = require("../models/dreams");
const NotFoundError = require("../utils/errorClasses/notFound");
const BadRequestError = require("../utils/errorClasses/badRequest");

const normalizeTags = (tags) => {
  if (Array.isArray(tags)) {
    return tags
      .map((tag) => String(tag).trim().replace(/^#+/, ""))
      .filter(Boolean);
  }

  if (typeof tags !== "string" || !tags.trim()) {
    return [];
  }

  return tags
    .split(/[\s,]+/)
    .map((tag) => tag.trim().replace(/^#+/, ""))
    .filter(Boolean);
};

const createDream = (req, res, next) => {
  const { date, summary, categories, tags, location, moonSign, isPublic } = req.body;


  // Normalize categories/tags to arrays if sent as comma-separated strings
  const categoriesArr = Array.isArray(categories)
    ? categories
    : typeof categories === "string" && categories.trim()
    ? categories.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  const tagsArr = normalizeTags(tags);

  const dreamData = {
    userId: req.user._id,
    date,
    summary,
    categories: categoriesArr,
    tags: tagsArr,
    location,
    moonSign,
    isPublic: Boolean(isPublic),
  };

  console.log("📝 Processed dream data:", dreamData);

  Dream.create(dreamData)
    .then((dream) => res.status(201).send(dream))
    .catch((err) => {
      console.error("❌ Dream creation error:", err);
      if (err.name === "ValidationError") {
        console.error("❌ Validation errors:", err.errors);
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
  const { date, summary, categories, tags, location, moonSign, isPublic } = req.body;

  const categoriesArr = Array.isArray(categories)
    ? categories
    : typeof categories === "string" && categories.trim()
    ? categories.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  const tagsArr = normalizeTags(tags);

  Dream.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { date, summary, categories: categoriesArr, tags: tagsArr, location, moonSign, isPublic: Boolean(isPublic) },
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

// Public feed - returns dreams shared publicly
const getPublicDreams = (req, res, next) => {
  Dream.find({ isPublic: true })
    .populate('userId', 'username avatar')
    .populate('comments.user', 'username avatar')
    .sort({ date: -1 }) // Most recent first
    .then((dreams) => {
      // Transform the data to match frontend expectations
      const formattedDreams = dreams.map(dream => ({
        ...dream.toObject(),
        user: dream.userId || { _id: 'unknown', username: 'Anonymous', avatar: '' }
      }));
      res.status(200).send(formattedDreams);
    })
    .catch((err) => {
      console.error("❌ Public dreams error:", err);
      // If populate fails, return dreams without user data
      Dream.find({ isPublic: true })
        .sort({ date: -1 })
        .then((dreams) => {
          const formattedDreams = dreams.map(dream => ({
            ...dream.toObject(),
            user: { _id: 'unknown', username: 'Anonymous', avatar: '' }
          }));
          res.status(200).send(formattedDreams);
        })
        .catch(next);
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

// Toggle like on a public dream
const toggleLike = (req, res, next) => {
  const { dreamId } = req.params;
  const userId = req.user._id;

  Dream.findById(dreamId)
    .then((dream) => {
      if (!dream) {
        throw new NotFoundError("Dream not found");
      }
      
      // Check if user already liked this dream
      const likeIndex = dream.likes.indexOf(userId);
      
      if (likeIndex > -1) {
        // Unlike: remove user from likes array
        dream.likes.splice(likeIndex, 1);
      } else {
        // Like: add user to likes array
        dream.likes.push(userId);
      }
      
      return dream.save();
    })
    .then((dream) => res.status(200).send(dream))
    .catch(next);
};

// Add comment to a public dream
const addComment = (req, res, next) => {
  const { dreamId } = req.params;
  const { text } = req.body;
  const userId = req.user._id;

  if (!text || !text.trim()) {
    return next(new BadRequestError("Comment text is required"));
  }

  return Dream.findById(dreamId)
    .then((dream) => {
      if (!dream) {
        throw new NotFoundError("Dream not found");
      }
      dream.comments.push({ user: userId, text: text.trim() });
      return dream.save();
    })
    .then((dream) =>
      Dream.findById(dream._id)
        .populate("userId", "username avatar")
        .populate("comments.user", "username avatar")
    )
    .then((dream) => res.status(200).send(dream))
    .catch(next);
};

// Delete a comment (only comment author or dream owner)
const deleteComment = (req, res, next) => {
  const { dreamId, commentId } = req.params;
  const userId = req.user._id.toString();

  Dream.findById(dreamId)
    .then((dream) => {
      if (!dream) {
        throw new NotFoundError("Dream not found");
      }

      const comment = dream.comments.id(commentId);
      if (!comment) {
        throw new NotFoundError("Comment not found");
      }

      // Only allow the comment author or the dream owner to delete
      const isCommentAuthor = comment.user.toString() === userId;
      const isDreamOwner = dream.userId.toString() === userId;

      if (!isCommentAuthor && !isDreamOwner) {
        throw new BadRequestError("You are not authorized to delete this comment");
      }

      comment.deleteOne();
      return dream.save();
    })
    .then((dream) =>
      Dream.findById(dream._id)
        .populate("userId", "username avatar")
        .populate("comments.user", "username avatar")
    )
    .then((dream) => res.status(200).send(dream))
    .catch(next);
};

// Toggle like on a comment
const toggleCommentLike = (req, res, next) => {
  const { dreamId, commentId } = req.params;
  const userId = req.user._id;

  Dream.findById(dreamId)
    .then((dream) => {
      if (!dream) {
        throw new NotFoundError("Dream not found");
      }

      const comment = dream.comments.id(commentId);
      if (!comment) {
        throw new NotFoundError("Comment not found");
      }

      const likeIndex = comment.likes.indexOf(userId);
      if (likeIndex === -1) {
        comment.likes.push(userId);
      } else {
        comment.likes.splice(likeIndex, 1);
      }

      return dream.save();
    })
    .then((dream) =>
      Dream.findById(dream._id)
        .populate("userId", "username avatar")
        .populate("comments.user", "username avatar")
    )
    .then((dream) => res.status(200).send(dream))
    .catch(next);
};

module.exports = {
  createDream,
  getDreams,
  getDreamById,
  updateDream,
  deleteDream,
  getPublicDreams,
  toggleLike,
  addComment,
  deleteComment,
  toggleCommentLike,
};
