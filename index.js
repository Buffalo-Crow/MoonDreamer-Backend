const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const mongoose = require("mongoose");
const errorHandler = require("./middleware/error");

dotenv.config();

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const moonApi = require("./routes/moonapi");
const aiInsightRoutes = require("./routes/aiInsights");
const dreamRoutes = require("./routes/dreams");
const uploadAvatar = require("./routes/uploadAvatar");

if (!process.env.JWT_SECRET) {
  console.error("❌ Missing JWT_SECRET in environment variables");
  process.exit(1);
}

//  Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

const app = express();

const allowedOrigins = [
<<<<<<< HEAD
  "http://localhost:5173",
  "http://localhost:3001",
  "https://precious-determination-production.up.railway.app", // frontend
  process.env.FRONTEND_URL,
].filter(Boolean);
=======
  "http://localhost:5174",   // local frontend
  "http://localhost:3001",   // local backend
];
      
>>>>>>> parent of 65cf90d (change dockerfile)

// ✅ CORS middleware (keep it at the very top)
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));

// ✅ Add this line: explicitly handle preflight requests for all routes
app.options("*", cors(corsOptions));

app.use(express.json());

// Log incoming requests
app.use((req, res, next) => {
  console.log(`📡 ${req.method} ${req.url}`);
  next();
});

// API routes
app.use("/api/moon", moonApi);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/upload-avatar", uploadAvatar);
app.use("/api/dreams", dreamRoutes);
app.use("/api/insights", aiInsightRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
