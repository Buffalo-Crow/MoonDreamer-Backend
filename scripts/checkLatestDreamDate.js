/**
 * Verify the latest dream date storage and rendering behavior.
 *
 * Usage:
 *   node scripts/checkLatestDreamDate.js
 *   node scripts/checkLatestDreamDate.js --email user@example.com
 *   node scripts/checkLatestDreamDate.js --username johndoe
 *   node scripts/checkLatestDreamDate.js --id 65f8a3b2c9d4e5f6g7h8i9j0
 */

require("dotenv").config();
const mongoose = require("mongoose");
const Dream = require("../models/dreams");
const User = require("../models/members");

const connect = () => mongoose.connect(process.env.MONGODB_URI);
const disconnect = () => mongoose.disconnect();

const parseArgs = () => {
  const args = process.argv.slice(2);
  const result = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith("--")) continue;

    const key = arg.slice(2);
    const value = args[i + 1];
    if (value && !value.startsWith("--")) {
      result[key] = value;
      i++;
    } else {
      result[key] = true;
    }
  }

  return result;
};

const usage = () => {
  console.log(`
Usage: node scripts/checkLatestDreamDate.js [OPTIONS]

Options:
  --email <email>       Filter by user email
  --username <username> Filter by username
  --id <id>             Filter by user MongoDB id

Examples:
  node scripts/checkLatestDreamDate.js
  node scripts/checkLatestDreamDate.js --email user@example.com
  node scripts/checkLatestDreamDate.js --username johndoe
`);
};

const resolveUserId = async (args) => {
  if (!args.email && !args.username && !args.id) return null;

  let user = null;

  if (args.email) {
    user = await User.findOne({ email: args.email }).lean();
  } else if (args.username) {
    user = await User.findOne({ username: args.username }).lean();
  } else if (args.id) {
    if (!mongoose.Types.ObjectId.isValid(args.id)) {
      throw new Error("Invalid --id value");
    }
    user = await User.findById(args.id).lean();
  }

  if (!user) {
    throw new Error("User not found for supplied filter");
  }

  return user._id;
};

const formatOutput = (dream) => {
  const dt = new Date(dream.date);

  return {
    dreamId: String(dream._id),
    userId: String(dream.userId),
    dateInput: dream.dateInput || null,
    originalStoredValue: dream.date,
    isoUtc: dt.toISOString(),
    yyyyMmDdFromIso: dt.toISOString().slice(0, 10),
    localDateString: dt.toLocaleDateString("en-US"),
    localDateTimeString: dt.toString(),
  };
};

const main = async () => {
  const args = parseArgs();

  if (args.help || args.h) {
    usage();
    process.exit(0);
  }

  try {
    await connect();

    const userId = await resolveUserId(args);
    const filter = userId ? { userId } : {};

    // Sort by newest insertion order so you can verify the dream you just created.
    const latestDream = await Dream.findOne(filter).sort({ _id: -1 }).lean();

    if (!latestDream) {
      console.log("No dreams found for the selected scope.");
      await disconnect();
      process.exit(0);
    }

    const report = formatOutput(latestDream);

    console.log("Latest dream date verification:");
    console.log(JSON.stringify(report, null, 2));

    await disconnect();
  } catch (err) {
    console.error("Error:", err.message);
    await disconnect().catch(() => {});
    process.exit(1);
  }
};

main();
