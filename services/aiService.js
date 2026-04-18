const { Anthropic } = require("@anthropic-ai/sdk");

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const DEFAULT_MODEL =
  process.env.ANTHROPIC_MODEL_DEFAULT || "claude-3-7-sonnet-20250219";

let cachedAvailableModelIds = null;

const DEPRECATED_MODEL_ALIASES = {
  "claude-3-opus-20240229": "claude-3-7-sonnet-20250219",
  "claude-3-sonnet-20240229": "claude-3-7-sonnet-20250219",
  "claude-3-haiku-20240307": "claude-3-5-haiku-20241022",
};

const SCOPE_FALLBACK_MODELS = {
  single: ["claude-3-5-haiku-20241022", "claude-3-7-sonnet-20250219"],
  "user-pattern": ["claude-3-7-sonnet-20250219", "claude-3-5-haiku-20241022"],
};

const resolveModelAlias = (model) => {
  if (!model) {
    return DEFAULT_MODEL;
  }

  return DEPRECATED_MODEL_ALIASES[model] || model;
};

const isModelNotFoundError = (err) => {
  const nestedType = err?.error?.error?.type;
  const directType = err?.error?.type;
  const message = String(err?.error?.error?.message || err?.message || "").toLowerCase();

  return (
    err?.status === 404
    || nestedType === "not_found_error"
    || directType === "not_found_error"
    || (message.includes("not_found_error") && message.includes("model"))
    || (message.includes("model:") && message.includes("not found"))
  );
};

const getAvailableModelIds = async () => {
  if (cachedAvailableModelIds) {
    return cachedAvailableModelIds;
  }

  try {
    const response = await client.models.list();
    const models = Array.isArray(response?.data) ? response.data : [];
    const ids = models
      .map((model) => model?.id)
      .filter(Boolean);

    cachedAvailableModelIds = ids;
    return ids;
  } catch (err) {
    console.warn("Unable to fetch Anthropic model list; using configured candidates only.");
    return [];
  }
};

const buildModelCandidates = async (scope, requestedModel) => {
  const candidates = [
    resolveModelAlias(requestedModel),
    resolveModelAlias(DEFAULT_MODEL),
    ...(SCOPE_FALLBACK_MODELS[scope] || []),
  ];

  const uniqueCandidates = [...new Set(candidates.filter(Boolean))];
  const availableIds = await getAvailableModelIds();

  if (!availableIds.length) {
    return uniqueCandidates;
  }

  const availableSet = new Set(availableIds);
  const filtered = uniqueCandidates.filter((id) => availableSet.has(id));

  if (filtered.length) {
    return filtered;
  }

  // If none of the preferred candidates are available, use the first available model.
  return [availableIds[0]];
};

const generateAIText = async (
  content,
  model = DEFAULT_MODEL,
  scope = "single",
  maxTokens = 500
) => {
  let systemPrompt = "";

  if (scope === "single") {
    systemPrompt =
      "You are an AI that analyzes a single dream, the anaylsis will be seen through a spiritual yet grounded lens Summarize the dream in 2-3 paragrahs with 3-4 sentences each and highlight key themes based on the Moon sign the dream occured in. Strongly consider the dream's categories and tags to provide deeper context and insights in your calculations. Address the dreamer as 'you'.";
  } else if (scope === "user-pattern") {
    systemPrompt =
      "You are an AI that analyzes multiple dreams from the same user. Identify recurring patterns and trends over time, focusing on the correlation between the Moon signs, categories, tags, and dream content.";
  }

  const modelCandidates = await buildModelCandidates(scope, model);
  let lastError = null;

  for (const candidateModel of modelCandidates) {
    try {
      const response = await client.messages.create({
        model: candidateModel,
        max_tokens: maxTokens,
        messages: [
          {
            role: "user",
            content: `${systemPrompt}\n\nDream Content:\n${content}`,
          },
        ],
      });

      return response.content[0].text.trim();
    } catch (err) {
      lastError = err;
      if (isModelNotFoundError(err)) {
        console.warn(`Anthropic model unavailable, retrying with fallback: ${candidateModel}`);
        continue;
      }

      console.error("Anthropic AI service error:", err);
      throw new Error(`AI service failed${candidateModel ? ` (model: ${candidateModel})` : ""}`);
    }
  }

  console.error("Anthropic AI service error:", lastError);
  throw new Error("AI service failed: no available model from configured fallbacks");
};

const getSystemPrompt = (scope = "single") => {
  if (scope === "single") {
    return "You are an AI that analyzes a single dream, the anaylsis will be seen through a spiritual yet grounded lens Summarize the dream in 2-3 paragrahs with 3-4 sentences each and highlight key themes based on the Moon sign the dream occured in. Strongly consider the dream's categories and tags to provide deeper context and insights in your calculations. Address the dreamer as 'you'. Do the task without speaking about doing the task. Only the insight not a dialogue.";
  }

  if (scope === "user-pattern") {
    return "You are an AI that analyzes multiple dreams from the same user. Identify recurring patterns and trends over time, focusing on the correlation between the Moon signs, categories, tags, and dream content.";
  }

  return "";
};

const generateAITextStream = async (
  content,
  onToken,
  model = DEFAULT_MODEL,
  scope = "single",
  maxTokens = 500
) => {
  const systemPrompt = getSystemPrompt(scope);
  let fullText = "";

  const modelCandidates = await buildModelCandidates(scope, model);
  let lastError = null;

  for (const candidateModel of modelCandidates) {
    try {
      const stream = await client.messages.create({
        model: candidateModel,
        max_tokens: maxTokens,
        stream: true,
        messages: [
          {
            role: "user",
            content: `${systemPrompt}\n\nDream Content:\n${content}`,
          },
        ],
      });

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
          const token = event.delta.text || "";
          if (!token) {
            continue;
          }

          fullText += token;
          if (typeof onToken === "function") {
            onToken(token);
          }
        }
      }

      return fullText.trim();
    } catch (err) {
      lastError = err;
      if (isModelNotFoundError(err)) {
        console.warn(`Anthropic stream model unavailable, retrying with fallback: ${candidateModel}`);
        continue;
      }

      console.error("Anthropic AI stream error:", err);
      throw new Error(`AI streaming service failed${candidateModel ? ` (model: ${candidateModel})` : ""}`);
    }
  }

  console.error("Anthropic AI stream error:", lastError);
  throw new Error("AI streaming service failed: no available model from configured fallbacks");
};

module.exports = { generateAIText, generateAITextStream };
