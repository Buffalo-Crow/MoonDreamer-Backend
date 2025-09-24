const { Anthropic } = require("@anthropic-ai/sdk");

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const generateAIText = async (
  content,
  model = "claude-3-sonnet-20240229", 
  scope = "single",
  maxTokens = 500
) => {
  let systemPrompt = "";

  if (scope === "single") {
    systemPrompt =
      "You are an AI that analyzes a single dream, the anaylsis will be seen through a spiritual yet grounded lens Summarize the dream in 2-3 paragrahs with 3-4 sentences each and highlight key themes based on the Moon sign the dream occured in. ";
  } else if (scope === "user-pattern") {
    systemPrompt =
      "You are an AI that analyzes multiple dreams from the same user. Identify recurring patterns and trends over time, focusing on the correlation between the Moon signs and dream content.";
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
    throw new Error("AI service failed");
  }
};

module.exports = { generateAIText };
