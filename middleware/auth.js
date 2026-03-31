const admin = require("firebase-admin");
const UnauthorizedError = require("../utils/errorClasses/unauthorized");
const User = require("../models/members");

const unwrapQuoted = (value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\""))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
};

const loadFirebaseServiceAccount = () => {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson);
      return {
        projectId: parsed.project_id || parsed.projectId,
        clientEmail: parsed.client_email || parsed.clientEmail,
        privateKey: (parsed.private_key || parsed.privateKey || "").replace(/\\n/g, "\n"),
      };
    } catch (error) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT(_JSON) is present but is not valid JSON");
    }
  }

  return {
    projectId: unwrapQuoted(process.env.FIREBASE_PROJECT_ID),
    clientEmail: unwrapQuoted(process.env.FIREBASE_CLIENT_EMAIL),
    privateKey: unwrapQuoted(process.env.FIREBASE_PRIVATE_KEY)?.replace(/\\n/g, "\n"),
  };
};

if (!admin.apps.length) {
  const serviceAccount = loadFirebaseServiceAccount();
  const missing = [
    !serviceAccount.projectId && "FIREBASE_PROJECT_ID",
    !serviceAccount.clientEmail && "FIREBASE_CLIENT_EMAIL",
    !serviceAccount.privateKey && "FIREBASE_PRIVATE_KEY",
  ].filter(Boolean);

  if (missing.length) {
    const visibleFirebaseKeys = Object.keys(process.env)
      .filter((key) => key.startsWith("FIREBASE"))
      .sort();

    throw new Error(
      `Missing Firebase credential env vars: ${missing.join(", ")}. `
      + "Set split vars (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY) "
      + "or provide FIREBASE_SERVICE_ACCOUNT(_JSON). "
      + `Visible FIREBASE keys in runtime: ${visibleFirebaseKeys.join(", ") || "(none)"}.`
    );
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
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