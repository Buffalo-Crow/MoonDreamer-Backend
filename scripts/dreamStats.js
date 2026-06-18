/**
 * MoonDreamer – Dream Activity Stats Script
 *
 * Usage:
 *   node scripts/dreamStats.js
 *   node scripts/dreamStats.js --sort count     (default: sort by dream count)
 *   node scripts/dreamStats.js --sort recent    (sort by most recent dream)
 *
 * Shows per-user dream counts and activity without exposing dream content.
 * Run from the MoonDreamer-Backend directory:
 *   cd MoonDreamer-Backend && node scripts/dreamStats.js
 */

require("dotenv").config();
const mongoose = require("mongoose");

const User = require("../models/members");
const Dream = require("../models/dreams");

const connect = () => mongoose.connect(process.env.MONGODB_URI);
const disconnect = () => mongoose.disconnect();
const getUserCount = () => User.countDocuments({});

const parseArgs = () => {
  const args = process.argv.slice(2);
  const result = { sort: "count" };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--sort" && args[i + 1]) {
      result.sort = args[i + 1];
      i++;
    }
  }
  return result;
};

const pad = (str, len) => String(str ?? "").padEnd(len).slice(0, len);
const padL = (str, len) => String(str ?? "").padStart(len).slice(0, len);

const run = async () => {
  const { sort } = parseArgs();

  await connect();
  console.log("✅ Connected to MongoDB\n");

  const [totalUsers, users] = await Promise.all([
    getUserCount(),
    User.find({}, "_id email username").lean(),
  ]);

  const rows = await Promise.all(
    users.map(async (user) => {
      const total = await Dream.countDocuments({ userId: user._id });
      const pub = await Dream.countDocuments({ userId: user._id, isPublic: true });
      const latest = await Dream.findOne({ userId: user._id })
        .sort({ date: -1 })
        .select("date")
        .lean();

      return {
        email: user.email,
        username: user.username || "(none)",
        total,
        public: pub,
        private: total - pub,
        lastDream: latest ? new Date(latest.date).toLocaleDateString("en-US") : "—",
        lastDreamRaw: latest ? new Date(latest.date) : new Date(0),
      };
    })
  );

  // Sort
  if (sort === "recent") {
    rows.sort((a, b) => b.lastDreamRaw - a.lastDreamRaw);
  } else {
    rows.sort((a, b) => b.total - a.total);
  }

  const totalDreams = await Dream.countDocuments({});
  const activeUsers = rows.filter((r) => r.total > 0).length;
  const accountedDreams = rows.reduce((s, r) => s + r.total, 0);
  const orphanedDreams = totalDreams - accountedDreams;

  // Header
  console.log(
    `${pad("#", 4)} ${pad("username", 22)} ${pad("email", 34)} ${padL("total", 6)} ${padL("public", 7)} ${padL("private", 8)} ${pad("last dream", 12)}`
  );
  console.log("─".repeat(100));

  rows.forEach((r, i) => {
    console.log(
      `${padL(i + 1, 3)}. ${pad(r.username, 22)} ${pad(r.email, 34)} ${padL(r.total, 6)} ${padL(r.public, 7)} ${padL(r.private, 8)} ${r.lastDream}`
    );
  });

  console.log("─".repeat(100));
  let summary = `\nTotal users: ${totalUsers} | Active dreamers: ${activeUsers} | Total dreams logged: ${totalDreams}`;
  if (users.length !== totalUsers) {
    summary += ` (fetched rows: ${users.length})`;
  }
  if (orphanedDreams > 0) {
    summary += ` (${accountedDreams} linked to current users, ${orphanedDreams} orphaned)`;
  }
  console.log(summary);

  await disconnect();
};

run().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
