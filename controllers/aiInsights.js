const Dream = require("../models/dreams");
const AIInsight = require ("../models/insights");
const { generateAIText } = require("../services/aiService");


const MODELS = {
  SINGLE: "claude-3-haiku-20240307",
  USER: "claude-3-opus-20240229",
  COMMUNITY: "claude-3-opus-20240229",
};

/**
 * Generate AI insight for a single dream
 */
const generateSingleInsight = async (req, res, next) => {
  try {
    const dreamId = req.params.id;

    const dream = await Dream.findOne({ _id: dreamId, userId: req.user._id }).orFail();

  
    const prompt = `
Dream summary: ${dream.summary || "No summary provided."}
Moon sign: ${dream.moonSign || "Unknown"}
Categories: ${dream.categories && dream.categories.length > 0 ? dream.categories.join(", ") : "None"}
Tags: ${dream.tags && dream.tags.length > 0 ? dream.tags.join(", ") : "None"}

Please provide an analysis of this dream with reference to the moon sign and any symbolic or psychological patterns.
    `;

    const aiSummary = await generateAIText(
      prompt,
      MODELS.SINGLE,
      "single",
      500
    );

    const insight = await AIInsight.create({
      userId: req.user._id,
      dreamIds: [dream._id],
      summary: aiSummary,
      tags: [],
      scope: "single",
      model: MODELS.SINGLE,
      moonSign: dream.moonSign || null, // ✅ keep it in DB for later use
    });

    res.status(201).json({
      aiResult: insight.summary,
      moonSign: insight.moonSign, // ✅ include for UI display
      insight,
    });
  } catch (err) {
    if (err.name === "DocumentNotFoundError") {
      return res.status(404).json({ message: "Dream not found" });
    }
    next(err);
  }
};

/**
 * Generate AI insight for a user's dream patterns
 */
const generateUserPatternInsight = async (req, res, next) => {
  try {
    const { dreamIds } = req.body;

    const dreams = await Dream.find({ _id: { $in: dreamIds }, userId: req.user._id });

    if (!dreams.length) {
      return res.status(404).json({ message: "No dreams found" });
    }

    const combinedText = dreams.map((d, index) => `
Dream ${index + 1}:
- Summary: ${d.summary}
- Moon sign: ${d.moonSign || "Unknown"}
- Categories: ${d.categories && d.categories.length > 0 ? d.categories.join(", ") : "None"}
- Tags: ${d.tags && d.tags.length > 0 ? d.tags.join(", ") : "None"}
`).join("\n");

    const aiSummary = await generateAIText(
      combinedText,
      MODELS.USER,
      "user-pattern",
      1000
    );

    const insight = await AIInsight.create({
      userId: req.user._id,
      dreamIds: dreams.map((d) => d._id),
      summary: aiSummary,
      tags: [],
      scope: "user-pattern",
      model: MODELS.USER,
    });

    res.status(201).json({ aiResult: insight.summary, insight });
  } catch (err) {
    next(err);
  }
};

/**
 * Generate AI insight across the community (admin or cron job)
 */
const generateCommunityInsight = async (req, res, next) => {
  try {
    const { dreamIds } = req.body;

    const query = dreamIds && dreamIds.length ? { _id: { $in: dreamIds } } : {};
    const dreams = await Dream.find(query);

    if (!dreams.length) {
      return res.status(404).json({ message: "No dreams found" });
    }

    const combinedText = dreams.map((d) => d.summary).join("\n\n");

    const aiSummary = await generateAIText(
      combinedText,
      MODELS.COMMUNITY,
      "community-pattern",
      2000
    );

    const insight = await AIInsight.create({
      userId: req.user._id, // could also be a "system" user
      dreamIds: dreams.map((d) => d._id),
      summary: aiSummary,
      tags: [],
      scope: "community-pattern",
      model: MODELS.COMMUNITY,
    });

    res.status(201).json({ aiResult: insight.summary, insight });
  } catch (err) {
    next(err);
  }
};

const saveInsight = async (req, res, next) => {
  try {
    const { dreamIds, summary, scope = "single" } = req.body;

    if (!dreamIds || !dreamIds.length || !summary) {
      return res.status(400).json({ message: "dreamIds and summary are required" });
    }

    // Verify that all dreams belong to the user
    const dreams = await Dream.find({ 
      _id: { $in: dreamIds }, 
      userId: req.user._id 
    });

    if (dreams.length !== dreamIds.length) {
      return res.status(403).json({ message: "Unauthorized access to one or more dreams" });
    }

    const insight = await AIInsight.create({
      userId: req.user._id,
      dreamIds,
      summary,
      tags: [],
      scope,
      model: MODELS.SINGLE,
      moonSign: dreams[0].moonSign || null,
    });

    res.status(201).json({ 
      message: "Insight saved successfully",
      insight 
    });
  } catch (err) {
    next(err);
  }
};

const getDreamInsights = async (req, res, next) => {
  try {
    const dreamId = req.params.dreamId;
    
    // Verify dream belongs to user
    const dream = await Dream.findOne({ 
      _id: dreamId, 
      userId: req.user._id 
    }).orFail();

    // Find all insights for this dream
    const insights = await AIInsight.find({
      dreamIds: dreamId,
      userId: req.user._id
    }).sort({ createdAt: -1 }); // Most recent first

    res.json({ insights });
  } catch (err) {
    if (err.name === "DocumentNotFoundError") {
      return res.status(404).json({ message: "Dream not found" });
    }
    next(err);
  }
};

const deleteInsight = async (req, res, next) => {
  try {
    const insightId = req.params.id;

    const insight = await AIInsight.findOne({ _id: insightId, userId: req.user._id }).orFail();

    await AIInsight.deleteOne({ _id: insightId });

    res.json({ message: "Insight deleted successfully", insightId });
  } catch (err) {
    if (err.name === "DocumentNotFoundError") {
      return res.status(404).json({ message: "Insight not found or unauthorized" });
    }
    next(err);
  }
};

module.exports = {
  generateSingleInsight,
  generateUserPatternInsight,
  generateCommunityInsight,
  saveInsight,
  getDreamInsights,
  deleteInsight,
};
