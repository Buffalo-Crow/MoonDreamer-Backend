const express = require("express");
const router = express.Router();
require("dotenv").config();

// POST /api/moon-sign/dream
// This endpoint calculates the moon sign based on the user's dream date, time, and location
// It uses an external astrology API to get the moon sign based on the provided parameters
// first it checks the location and then calculates the lat and long and sends it to the astrology API

router.post("/moon-sign/dream", async (req, res) => {
  try {
    const { date, time = "23:00:00", latitude, longitude } = req.body;
    console.log("📥 /moon-sign request:", { date, time, latitude, longitude });
    if (!date || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const [hours, minutes, seconds] = time.split(":").map(Number);
    const dateObj = new Date(date);
    const payload = {
      year: dateObj.getFullYear(),
      month: dateObj.getMonth() + 1,
      date: dateObj.getDate(),
      hours,
      minutes,
      seconds,
      latitude,
      longitude,
      timezone: -4,
      config: {
        observation_point: "topocentric",
        ayanamsha: "tropical",
        language: "en",
      },
    };

    const response = await fetch(
      "https://json.freeastrologyapi.com/western/planets",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.API_KEY,
        },
        body: JSON.stringify(payload),
      }
    );

    const text = await response.text();
    if (!response.ok) {
      console.error("API error:", response.status, text);
      return res.status(500).json({ error: "External API failed" });
    }

    const data = JSON.parse(text);
    const moon = data.output?.find((obj) => obj.planet.en === "Moon");
    const moonSign = moon?.zodiac_sign?.name?.en || "Unknown";

    res.json({ moonSign });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// This endpoint fetches the current moon sign defaulted to New York, NY
// It uses the OpenCage API to get the coordinates and then calls the astrology API to get the moon sign
// The date is set to today's date
router.get("/moon-sign", async (req, res) => {
  try {
    // 1️⃣ Default location
    const location = "New York, NY";
    const date = new Date().toISOString().split("T")[0]; // today

    console.log("Fetching moon sign for:", location, "on date:", date);

    // 2️⃣ Geocode to lat/lon
    const geoRes = await fetch(
      `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(
        location
      )}&key=${process.env.OPENCAGE_API_KEY}`
    );
    const geoData = await geoRes.json();

    if (!geoData.results || geoData.results.length === 0) {
      return res.status(400).json({ error: "Could not resolve location" });
    }

    const { lat, lng } = geoData.results[0].geometry;
    console.log("Resolved coordinates:", lat, lng);

    // 3️⃣ Build payload like the working /western/planets endpoint
    const [year, month, day] = date.split("-").map(Number);
    const payload = {
      year,
      month,
      date: day,
      hours: 12, // noon default
      minutes: 0,
      seconds: 0,
      latitude: lat,
      longitude: lng,
      timezone: -4, // Eastern Time
      config: {
        observation_point: "topocentric",
        ayanamsha: "tropical",
        language: "en",
      },
    };

    // 4️⃣ Call astrology API
    const astroRes = await fetch(
      "https://json.freeastrologyapi.com/western/planets",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.API_KEY,
        },
        body: JSON.stringify(payload),
      }
    );

    const text = await astroRes.text();
    const data = JSON.parse(text);

    // 5️⃣ Extract Moon sign
    const moon = data.output?.find((obj) => obj.planet.en === "Moon");
    const moonSign = moon?.zodiac_sign?.name?.en || "Unknown";

    console.log("Moon sign:", moonSign);

    res.json({ moonSign });
  } catch (err) {
    console.error("Moon sign route error:", err);
    res.status(500).json({ error: "Failed to fetch moon sign" });
  }
});

// GET /api/geocode location to get latitude and longitude

router.get("/geocode", async (req, res) => {
  const location = req.query.location;
  if (!location) {
    return res.status(400).json({ error: "Missing location query" });
  }

  try {
    const response = await fetch(
      `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(
        location
      )}&key=${process.env.OPENCAGE_API_KEY}`
    );

    const data = await response.json();

    if (!data.results.length) {
      return res
        .status(404)
        .json({ error: "No coordinates found for that location." });
    }

    const { lat, lng } = data.results[0].geometry;
    res.json({ latitude: lat, longitude: lng });
  } catch (err) {
    console.error("Geocode error:", err);
    res.status(500).json({ error: "Failed to fetch coordinates" });
  }
});

module.exports = router;