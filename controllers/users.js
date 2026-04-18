const User = require("../models/members");
const BadRequestError = require("../utils/errorClasses/badRequest");
const NotFoundError = require("../utils/errorClasses/notFound");
const ConflictError = require("../utils/errorClasses/conflict");

const BETA_AGREEMENT_VERSION = "2026-04";
const BETA_AGREEMENT_TITLE = "MoonDreamer Beta User Agreement";

const buildBetaAgreementRecord = (req, betaAgreementAcceptance) => ({
  accepted: true,
  version: betaAgreementAcceptance.version,
  title: BETA_AGREEMENT_TITLE,
  acceptedAt: new Date(),
  acceptedFromIp: req.ip || null,
  acceptedUserAgent: req.get("user-agent") || null,
});

const serializeUser = (user) => {
  const userObject = typeof user.toObject === "function" ? user.toObject() : user;

  return {
    ...userObject,
    agreementStatus: userObject.betaAgreement
      ? {
          accepted: userObject.betaAgreement.accepted,
          version: userObject.betaAgreement.version,
          title: userObject.betaAgreement.title,
          acceptedAt: userObject.betaAgreement.acceptedAt,
        }
      : null,
  };
};

const getCurrentUser = (req, res, next) => {
  const { firebaseUid } = req.user;

  User.findOne({ firebaseUid })
    .orFail()
    .then((user) => res.status(200).send(serializeUser(user)))
    .catch((err) => {
      if (err.name === "DocumentNotFoundError") {
        return next(new NotFoundError("User not found"));
      }
      return next(err);
    });
};

const signup = async (req, res, next) => {
  const { firebaseUid } = req.user;
  const { username, email, avatar, betaAgreementAcceptance } = req.body;

  if (!email || !username || !avatar) {
    return next(new BadRequestError("All fields are required"));
  }

  if (
    !betaAgreementAcceptance ||
    betaAgreementAcceptance.accepted !== true ||
    betaAgreementAcceptance.version !== BETA_AGREEMENT_VERSION
  ) {
    return next(new BadRequestError("You must accept the beta user agreement to register"));
  }

  const betaAgreement = buildBetaAgreementRecord(req, betaAgreementAcceptance);

  try {
    const user = await User.create({
      firebaseUid,
      username,
      email,
      avatar,
      betaAgreement,
    });
    return res.status(201).send(serializeUser(user));
  } catch (err) {
    if (err.name === "ValidationError") {
      return next(new BadRequestError("Invalid Request"));
    }
    if (err.code === 11000) {
      // Duplicate key protection: never reassign a profile to a different Firebase UID.
      // This keeps provider identities stable and prevents login regressions.
      const existingUser = await User.findOne({ email });
      if (existingUser && existingUser.firebaseUid !== firebaseUid) {
        return next(
          new ConflictError(
            "An account with this email already exists. Please sign in with the original method for this account."
          )
        );
      }
      // Same firebaseUid already exists — return the existing user
      if (existingUser) {
        existingUser.betaAgreement = existingUser.betaAgreement?.accepted
          ? existingUser.betaAgreement
          : betaAgreement;
        await existingUser.save();
        return res.status(200).send(serializeUser(existingUser));
      }
      return next(new ConflictError("User already exists"));
    }
    return next(err);
  }
};

const updateUser = (req, res, next) => {
  const { username, avatar } = req.body;
  const updates = {};

  if (typeof username !== "undefined") {
    const normalizedUsername = String(username).trim();
    if (!normalizedUsername) {
      return next(new BadRequestError("Username cannot be empty"));
    }
    updates.username = normalizedUsername;
  }

  if (typeof avatar !== "undefined") {
    updates.avatar = avatar;
  }

  if (!Object.keys(updates).length) {
    return next(new BadRequestError("At least one field is required"));
  }

  User.findOneAndUpdate(
    { firebaseUid: req.user.firebaseUid },
    updates,
    { new: true, runValidators: true }
  )
    .orFail()
    .then((user) => res.status(200).send({ data: serializeUser(user) }))
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

module.exports = {
  signup,
  getCurrentUser,
  updateUser,
};
