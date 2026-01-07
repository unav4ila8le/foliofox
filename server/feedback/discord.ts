"use server";

type DiscordEmbed = {
  title?: string;
  description?: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  timestamp?: string;
};

export async function sendFeedbackToDiscord(feedback: {
  type: "issue" | "idea" | "other";
  message: string;
  username: string;
  email: string;
}): Promise<void> {
  const webhookUrl = process.env.DISCORD_FEEDBACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  const colors = {
    issue: 0xef4444,
    idea: 0x22c55e,
    other: 0x6366f1,
  } as const;

  const embed: DiscordEmbed = {
    title: `New Feedback: ${feedback.type.toUpperCase()}`,
    description: feedback.message,
    color: colors[feedback.type],
    fields: [
      { name: "Username", value: feedback.username, inline: true },
      { name: "Email", value: feedback.email, inline: true },
    ],
    timestamp: new Date().toISOString(),
  };

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] }),
    });
  } catch (error) {
    console.error("Discord feedback webhook failed:", error);
  }
}
