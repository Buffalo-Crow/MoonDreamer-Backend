const { Anthropic } = require("@anthropic-ai/sdk");

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const DEFAULT_MODEL =
  process.env.ANTHROPIC_MODEL_DEFAULT || "claude-3-7-sonnet-20250219";

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
  } else if (scope === "community-pattern") {
    systemPrompt =
      "You are an AI that analyzes dreams from multiple users. Identify collective themes and Moon sign trends across the community.";
  }

  try {
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      messages: [
        {
          role: "user",
          content: `${systemPrompt}\n\nDream Content:\n${content}`,
        },
      ],
      temperature: 0.7,
    });

    return response.content[0].text.trim();
  } catch (err) {
    console.error("Anthropic AI service error:", err);
    throw new Error(`AI service failed${model ? ` (model: ${model})` : ""}`);
  }
};

const getSystemPrompt = (scope = "single") => {
  if (scope === "single") {
    return "You are an AI that analyzes a single dream, the anaylsis will be seen through a spiritual yet grounded lens Summarize the dream in 2-3 paragrahs with 3-4 sentences each and highlight key themes based on the Moon sign the dream occured in. Strongly consider the dream's categories and tags to provide deeper context and insights in your calculations. Address the dreamer as 'you'. Do the task without speaking about doing the task. Only the insight not a dialogue.";
  }

  if (scope === "user-pattern") {
    return "You are an AI that analyzes multiple dreams from the same user. Identify recurring patterns and trends over time, focusing on the correlation between the Moon signs, categories, tags, and dream content.";
  }

  if (scope === "community-pattern") {
    return "You are an AI that analyzes dreams from multiple users. Identify collective themes and Moon sign trends across the community.";
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

  try {
    const stream = await client.messages.create({
      model,
      max_tokens: maxTokens,
      stream: true,
      messages: [
        {
          role: "user",
          content: `${systemPrompt}\n\nDream Content:\n${content}`,
        },
      ],
      temperature: 0.7,
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
    console.error("Anthropic AI stream error:", err);
    throw new Error(`AI streaming service failed${model ? ` (model: ${model})` : ""}`);
  }
};

module.exports = { generateAIText, generateAITextStream };
