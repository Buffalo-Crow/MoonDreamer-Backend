/**
 * MoonDreamer – Manual User Cleanup Script
 *
 * Usage:
 *   node scripts/cleanupUsers.js list
 *   node scripts/cleanupUsers.js delete-email user@example.com
 *   node scripts/cleanupUsers.js delete-orphans
 *
 * Requires the same env vars as the server (MONGODB_URI, FIREBASE_SERVICE_ACCOUNT or split vars).
 * Run from the MoonDreamer-Backend directory:
 *   cd MoonDreamer-Backend && node scripts/cleanupUsers.js list
 */

require("dotenv").config();
const mongoose = require("mongoose");
const admin = require("firebase-admin");

// ── Firebase Admin init ──────────────────────────────────────────────────────
const loadFirebaseServiceAccount = () => {
  const rawJson =
    process.env.FIREBASE_SERVICE_ACCOUNT ||
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (rawJson) {
    let parsed = JSON.parse(rawJson.trim().replace(/^"|"$/g, ""));
    if (typeof parsed === "string") parsed = JSON.parse(parsed);
    return {
      projectId: parsed.project_id || parsed.projectId,
      clientEmail: parsed.client_email || parsed.clientEmail,
      privateKey: (parsed.private_key || parsed.privateKey || "").replace(/\\n/g, "\n"),
    };
  }

  return {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  };
};

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(loadFirebaseServiceAccount()) });
}

// ── Mongoose models ──────────────────────────────────────────────────────────
const User = require("../models/members");
const Dream = require("../models/dreams");
const Insight = require("../models/insights");

// ── Helpers ──────────────────────────────────────────────────────────────────
const connect = () => mongoose.connect(process.env.MONGODB_URI);
const disconnect = () => mongoose.disconnect();

const deleteUserEverywhere = async (user) => {
  const { _id, firebaseUid, email } = user;

  // 1. Delete user's dreams and insights from MongoDB
  const dreamsResult = await Dream.deleteMany({ userId: _id });
  const insightsResult = await Insight.deleteMany({ userId: _id });

  // 2. Delete MongoDB user record
  await User.deleteOne({ _id });

  // 3. Delete Firebase Auth user (best-effort — may already not exist)
  let firebaseDeleted = false;
  if (firebaseUid) {
    try {
      await admin.auth().deleteUser(firebaseUid);
      firebaseDeleted = true;
    } catch (err) {
      if (err.code === "auth/user-not-found") {
        firebaseDeleted = "already-absent";
      } else {
        console.warn(`  ⚠️  Firebase delete failed for ${email}: ${err.message}`);
      }
    }
  }

  console.log(
    `  ✅ Deleted ${email} | dreams: ${dreamsResult.deletedCount} | insights: ${insightsResult.deletedCount} | firebase: ${firebaseDeleted}`
  );
};

// ── Commands ─────────────────────────────────────────────────────────────────

const listUsers = async () => {
  const users = await User.find({}, "email username firebaseUid createdAt").lean();
  if (!users.length) {
    console.log("No users found in MongoDB.");
    return;
  }
  console.log(`\n${"#".padEnd(4)} ${"email".padEnd(35)} ${"username".padEnd(20)} firebaseUid`);
  console.log("─".repeat(95));
  users.forEach((u, i) => {
    console.log(
      `${String(i + 1).padEnd(4)} ${(u.email || "").padEnd(35)} ${(u.username || "").padEnd(20)} ${u.firebaseUid || "MISSING"}`
    );
  });
  console.log(`\nTotal: ${users.length} user(s)\n`);
};

const deleteByEmail = async (email) => {
  const user = await User.findOne({ email });
  if (!user) {
    console.log(`No MongoDB user found with email: ${email}`);
    return;
  }
  console.log(`\nDeleting user: ${email}`);
  await deleteUserEverywhere(user);
};

/**
 * Finds MongoDB users whose firebaseUid no longer exists in Firebase Auth and deletes them.
 * These are "orphan" accounts — they can never sign in.
 */
const deleteOrphans = async () => {
  const users = await User.find({}, "email username firebaseUid").lean();
  console.log(`\nChecking ${users.length} MongoDB user(s) against Firebase Auth…\n`);

  let orphanCount = 0;

  for (const user of users) {
    if (!user.firebaseUid) {
      console.log(`  ⚠️  ${user.email} has no firebaseUid — skipping (delete manually with delete-email)`);
      continue;
    }

    try {
      await admin.auth().getUser(user.firebaseUid);
      // Firebase user exists — keep them
    } catch (err) {
      if (err.code === "auth/user-not-found") {
        console.log(`  🔍 Orphan found: ${user.email}`);
        const fullUser = await User.findById(user._id);
        await deleteUserEverywhere(fullUser);
        orphanCount++;
      } else {
        console.warn(`  ⚠️  Could not check Firebase for ${user.email}: ${err.message}`);
      }
    }
  }

  console.log(`\nDone. Removed ${orphanCount} orphan account(s).`);
};

// ── Entry point ──────────────────────────────────────────────────────────────
const [, , command, arg] = process.argv;

(async () => {
  try {
    await connect();
    console.log("✅ Connected to MongoDB");

    switch (command) {
      case "list":
        await listUsers();
        break;
      case "delete-email":
        if (!arg) {
          console.error("Usage: node scripts/cleanupUsers.js delete-email user@example.com");
          process.exit(1);
        }
        await deleteByEmail(arg);
        break;
      case "delete-orphans":
        await deleteOrphans();
        break;
      default:
        console.log(`
Commands:
  list                          – List all MongoDB users
  delete-email <email>          – Delete one user by email (MongoDB + Firebase + their data)
  delete-orphans                – Delete all MongoDB users whose Firebase account no longer exists
        `);
    }
  } catch (err) {
    console.error("Fatal error:", err.message);
    process.exit(1);
  } finally {
    await disconnect();
  }
})();
