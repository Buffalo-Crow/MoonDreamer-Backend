const admin = require("firebase-admin");
const UnauthorizedError = require("../utils/errorClasses/unauthorized");
const User = require("../models/members");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const tokenAuthorization = async (req, res, next) => {
  const { authorization } = req.headers;

  if (!authorization || !authorization.startsWith("Bearer ")) {
    return next(new UnauthorizedError("Authorization header is required"));
  }

  const token = authorization.replace("Bearer ", "");

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);

    // Look up the MongoDB user by Firebase UID
    const user = await User.findOne({ firebaseUid: decodedToken.uid });

    if (!user) {
      return next(new UnauthorizedError("User not found in database"));
    }

    // Set _id so all controllers (comments, likes, dreams) work correctly
    req.user = { _id: user._id, firebaseUid: decodedToken.uid, email: decodedToken.email };
    return next();
  } catch (err) {
    if (err.name === "UnauthorizedError") {
      return next(err);
    }
    return next(new UnauthorizedError("Invalid or expired token"));
  }
};

module.exports = tokenAuthorization;