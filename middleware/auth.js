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

const pickFirstNonEmptyEnv = (...names) => {
  for (const name of names) {
    const value = process.env[name];
    if (typeof value === "string" && value.trim() !== "") {
      return value;
    }
  }

  return undefined;
};

const decodeBase64 = (value) => {
  if (typeof value !== "string" || value.trim() === "") {
    return undefined;
  }

  try {
    return Buffer.from(value, "base64").toString("utf8");
  } catch {
    return undefined;
  }
};

const loadFirebaseServiceAccount = () => {
  const rawJson =
    pickFirstNonEmptyEnv(
      "FIREBASE_SERVICE_ACCOUNT",
      "FIREBASE_SERVICE_ACCOUNT_JSON",
      "GOOGLE_SERVICE_ACCOUNT_JSON",
      "FIREBASE_CREDENTIALS_JSON"
    )
    || decodeBase64(pickFirstNonEmptyEnv("FIREBASE_SERVICE_ACCOUNT_BASE64", "GOOGLE_SERVICE_ACCOUNT_BASE64"));

  if (rawJson) {
    try {
      const normalizedRawJson = unwrapQuoted(rawJson);
      let parsed = JSON.parse(normalizedRawJson);

      // Some hosts store JSON env vars as a JSON-encoded string; parse twice when needed.
      if (typeof parsed === "string") {
        parsed = JSON.parse(parsed);
      }

      return {
        projectId: unwrapQuoted(parsed.project_id || parsed.projectId),
        clientEmail: unwrapQuoted(parsed.client_email || parsed.clientEmail),
        privateKey: unwrapQuoted(parsed.private_key || parsed.privateKey || "").replace(/\\n/g, "\n"),
      };
    } catch (error) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT(_JSON) is present but is not valid JSON");
    }
  }

  return {
    projectId: unwrapQuoted(
      pickFirstNonEmptyEnv("FIREBASE_PROJECT_ID", "GOOGLE_CLOUD_PROJECT", "GCLOUD_PROJECT")
    ),
    clientEmail: unwrapQuoted(
      pickFirstNonEmptyEnv("FIREBASE_CLIENT_EMAIL", "GOOGLE_CLIENT_EMAIL")
    ),
    privateKey: unwrapQuoted(
      pickFirstNonEmptyEnv("FIREBASE_PRIVATE_KEY", "GOOGLE_PRIVATE_KEY")
    )?.replace(/\\n/g, "\n"),
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
      .filter((key) => key.startsWith("FIREBASE") || key.startsWith("GOOGLE") || key.startsWith("GCLOUD"))
      .sort();

    const trackedEnvNames = [
      "FIREBASE_PROJECT_ID",
      "FIREBASE_CLIENT_EMAIL",
      "FIREBASE_PRIVATE_KEY",
      "FIREBASE_SERVICE_ACCOUNT",
      "FIREBASE_SERVICE_ACCOUNT_JSON",
      "FIREBASE_SERVICE_ACCOUNT_BASE64",
      "GOOGLE_CLOUD_PROJECT",
      "GCLOUD_PROJECT",
      "GOOGLE_CLIENT_EMAIL",
      "GOOGLE_PRIVATE_KEY",
      "GOOGLE_SERVICE_ACCOUNT_JSON",
      "GOOGLE_SERVICE_ACCOUNT_BASE64",
    ];

    const presentEnvSummary = trackedEnvNames
      .filter((name) => typeof process.env[name] === "string")
      .map((name) => `${name}(len=${process.env[name].length})`)
      .join(", ");

    throw new Error(
      `Missing Firebase credential env vars: ${missing.join(", ")}. `
      + "Set split vars (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY) "
      + "or provide FIREBASE_SERVICE_ACCOUNT(_JSON). "
      + `Visible related keys in runtime: ${visibleFirebaseKeys.join(", ") || "(none)"}. `
      + `Present tracked vars: ${presentEnvSummary || "(none)"}.`
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