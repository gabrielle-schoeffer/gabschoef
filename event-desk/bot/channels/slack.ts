import {
  createDefaultOnInbound,
  credentialsFromEnv,
  fetchSlackUserInfo,
  slackChannel,
  type SlackBinding,
  type SlackDispatchDecision,
  type SlackMessage,
} from "@grok/agent-sdk/channels/slack";

const ENV_PREFIX = "EVENT_DESK";

const ALLOWED_EMAILS = new Set(["gabrielle@airops.com", "ally@airops.com"]);

const credentials = credentialsFromEnv(ENV_PREFIX);
const admit = createDefaultOnInbound(
  ["Checking dates and owners…", "Leaving the send for Ally…"],
  { respondTo: "thread", blockExternals: true },
);

const allowedUserIds = new Set<string>();
const deniedUserIds = new Set<string>();

async function onlyGabrielleAndAlly(
  ctx: SlackBinding,
  message: SlackMessage,
): Promise<SlackDispatchDecision | null> {
  const userId = message.author?.userId ?? "";
  if (userId === "" || message.author?.isBot === true) {
    return null;
  }
  if (deniedUserIds.has(userId)) {
    return null;
  }
  if (!allowedUserIds.has(userId)) {
    const allowed = await emailIsAllowed(userId);
    if (allowed === true) {
      allowedUserIds.add(userId);
    } else {
      if (allowed === false) {
        deniedUserIds.add(userId);
      }
      return null;
    }
  }
  const decision = await admit(ctx, message);
  return decision ?? null;
}

async function emailIsAllowed(userId: string): Promise<boolean | null> {
  let record: Record<string, unknown> | undefined;
  try {
    record = await fetchSlackUserInfo({
      botToken: credentials.botToken,
      userId,
    });
  } catch {
    return null;
  }
  if (record === undefined) {
    return null;
  }
  const profile = record.profile;
  const email =
    profile !== null &&
    typeof profile === "object" &&
    "email" in profile &&
    typeof profile.email === "string"
      ? profile.email.toLowerCase()
      : undefined;
  return email !== undefined && ALLOWED_EMAILS.has(email);
}

export default slackChannel({
  envPrefix: ENV_PREFIX,
  policy: { respondTo: "thread", blockExternals: true },
  suggestedPrompts: [
    {
      title: "Workback",
      message:
        "Build the workback for our next event. Ask for the date, city, and format if you do not have them.",
    },
    {
      title: "Copy for Ally",
      message:
        "Draft the next outreach touch for Ally to review. Do not treat it as ready to send.",
    },
  ],
  onAppMention: onlyGabrielleAndAlly,
  onDirectMessage: onlyGabrielleAndAlly,
});
