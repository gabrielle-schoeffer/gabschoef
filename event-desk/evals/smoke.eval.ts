import { defineEval } from "@grok/agent-sdk/evals";

export default defineEval({
  tags: ["smoke"],
  cases: [
    {
      id: "london-workback",
      description: "A dated event request uses the workback tool.",
      async test(t) {
        await t.send(
          "Build the workback for the London launch dinner on 2026-11-18. List source is unknown. Do not draft sendable copy.",
        );
        t.succeeded();
        t.calledTool("build_workback");
      },
    },
  ],
});
