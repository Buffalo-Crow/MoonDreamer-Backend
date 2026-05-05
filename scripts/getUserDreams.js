/**
 * MoonDreamer – Get User Dreams Script
 *
 * Usage:
 *   node scripts/getUserDreams.js --email user@example.com
 *   node scripts/getUserDreams.js --username johndoe
 *   node scripts/getUserDreams.js --id 65f8a3b2c9d4e5f6g7h8i9j0
 *   node scripts/getUserDreams.js --email user@example.com --export
 *   node scripts/getUserDreams.js --username johndoe --json
 *
 * Requires the same env vars as the server (MONGODB_URI).
 * Run from the MoonDreamer-Backend directory:
 *   cd MoonDreamer-Backend && node scripts/getUserDreams.js --email user@example.com
 */

require("dotenv").config();
const mongoose = require("mongoose");
const fs = require("fs");

// ── Mongoose models ──────────────────────────────────────────────────────────
const User = require("../models/members");
const Dream = require("../models/dreams");

// ── Helpers ──────────────────────────────────────────────────────────────────
const connect = () => mongoose.connect(process.env.MONGODB_URI);
const disconnect = () => mongoose.disconnect();

/**
 * Parse command line arguments
 */
const parseArgs = () => {
  const args = process.argv.slice(2);
  const result = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const value = args[i + 1];
      if (value && !value.startsWith("--")) {
        result[key] = value;
        i++;
      } else {
        result[key] = true;
      }
    }
  }

  return result;
};

/**
 * Format dream for display
 */
const formatDream = (dream) => {
  const date = new Date(dream.date);
  return {
    id: dream._id.toString(),
    date: date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    moonSign: dream.moonSign || "N/A",
    location: dream.location,
    categories: dream.categories || [],
    tags: dream.tags || [],
    summary: dream.summary.substring(0, 150) + (dream.summary.length > 150 ? "..." : ""),
    isPublic: dream.isPublic || false,
    likes: dream.likes?.length || 0,
    comments: dream.comments?.length || 0,
    fullText: dream.summary,
  };
};

/**
 * Display dreams in a readable table format
 */
const displayDreams = (user, dreams) => {
  console.log("\n" + "═".repeat(100));
  console.log(`\n📖 Dreams for ${user.email} (@${user.username})`);
  console.log(`Total dreams: ${dreams.length}\n`);

  if (dreams.length === 0) {
    console.log("No dreams found for this user.\n");
    return;
  }

  dreams.forEach((dream, index) => {
    const formatted = formatDream(dream);
    console.log(`\n${index + 1}. 📅 ${formatted.date} | 🌙 ${formatted.moonSign} | 📍 ${formatted.location}`);
    console.log(`   Status: ${formatted.isPublic ? "PUBLIC" : "PRIVATE"} | Likes: ${formatted.likes} | Comments: ${formatted.comments}`);
    if (formatted.categories.length > 0) {
      console.log(`   Categories: ${formatted.categories.join(", ")}`);
    }
    if (formatted.tags.length > 0) {
      console.log(`   Tags: ${formatted.tags.join(", ")}`);
    }
    console.log(`   Summary: ${formatted.summary}`);
    console.log(`   ID: ${formatted.id}`);
  });

  console.log("\n" + "═".repeat(100) + "\n");
};

/**
 * Export dreams to JSON file
 */
const exportDreamsToJSON = (user, dreams, outputFile) => {
  const exported = {
    user: {
      id: user._id.toString(),
      email: user.email,
      username: user.username,
    },
    exportedAt: new Date().toISOString(),
    dreamCount: dreams.length,
    dreams: dreams.map((dream) => ({
      id: dream._id.toString(),
      date: dream.date,
      summary: dream.summary,
      location: dream.location,
      moonSign: dream.moonSign,
      categories: dream.categories || [],
      tags: dream.tags || [],
      isPublic: dream.isPublic || false,
      likes: dream.likes?.length || 0,
      comments: dream.comments?.length || 0,
    })),
  };

  const filename = outputFile || `${user.username}_dreams_${Date.now()}.json`;
  fs.writeFileSync(filename, JSON.stringify(exported, null, 2));
  console.log(`\n✅ Exported to ${filename}\n`);
};

/**
 * Main entry point
 */
const main = async () => {
  const args = parseArgs();

  // Validate arguments
  if (!args.email && !args.username && !args.id) {
    console.log(`
Usage: node scripts/getUserDreams.js [OPTIONS]

Options:
  --email <email>       Find user by email address
  --username <username> Find user by username
  --id <id>            Find user by MongoDB ID
  --export             Export dreams to JSON file
  --json               Output in JSON format (no table display)

Examples:
  node scripts/getUserDreams.js --email user@example.com
  node scripts/getUserDreams.js --username johndoe
  node scripts/getUserDreams.js --id 65f8a3b2c9d4e5f6g7h8i9j0 --export
  node scripts/getUserDreams.js --email user@example.com --json
    `);
    process.exit(0);
  }

  try {
    await connect();
    console.log("✅ Connected to MongoDB");

    // Find user
    let user;
    if (args.email) {
      user = await User.findOne({ email: args.email });
      if (!user) {
        console.log(`❌ No user found with email: ${args.email}`);
        process.exit(1);
      }
    } else if (args.username) {
      user = await User.findOne({ username: args.username });
      if (!user) {
        console.log(`❌ No user found with username: ${args.username}`);
        process.exit(1);
      }
    } else if (args.id) {
      user = await User.findById(args.id);
      if (!user) {
        console.log(`❌ No user found with ID: ${args.id}`);
        process.exit(1);
      }
    }

    console.log(`✅ Found user: ${user.email}`);

    // Get all dreams for this user
    const dreams = await Dream.find({ userId: user._id }).sort({ date: -1 }).lean();

    console.log(`✅ Found ${dreams.length} dream(s)`);

    // Display or export based on arguments
    if (args.json) {
      console.log(JSON.stringify(dreams, null, 2));
    } else {
      displayDreams(user, dreams);
    }

    if (args.export) {
      exportDreamsToJSON(user, dreams, args.export === true ? null : args.export);
    }

    await disconnect();
    console.log("✅ Disconnected from MongoDB");
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
};

main();
