import { defineAgent } from "@grok/agent-sdk";

export default defineAgent({
  name: "Event Desk",
  description:
    "Workback, outreach copy, and the Ben handoff for AirOps events Gabrielle and Ally run.",
  model: {
    id: "grok-4.5",
    params: [
      { id: "effort", value: "high" },
      { id: "fast", value: "true" },
    ],
  },
});
