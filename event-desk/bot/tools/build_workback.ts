import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";

const formats = ["dinner", "booth", "side_event", "owned", "conference"] as const;
const listSources = ["opt_in", "vendor", "unknown"] as const;

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => shiftDate(value, 0) === value, "Use a real calendar date.");

type Priority = "now" | "soon" | "later";

type Task = {
  id: string;
  phase: string;
  title: string;
  owner: string;
  due: string;
  why: string;
  priority: Priority;
};

type Workback = {
  event: {
    name: string;
    date: string;
    city: string;
    format: (typeof formats)[number];
    listSource: (typeof listSources)[number];
    goal: string | null;
    asOf: string;
  };
  pipelineJob: string;
  tasks: Task[];
  blockers: string[];
  handoff: {
    to: string;
    include: string[];
    arthur: string[];
    sender: string[];
  };
};

export default defineTool({
  description:
    "Build the dated AirOps event workback Gabrielle and Ally run: owners, due dates, blockers, and the Ben handoff. Read-only. Does not write to HubSpot, Lemlist, Luma, or Asana.",
  effect: "read",
  inputSchema: z.object({
    name: z.string().min(1),
    date: dateSchema,
    city: z.string().min(1),
    format: z.enum(formats),
    listSource: z.enum(listSources).default("unknown"),
    goal: z.string().optional(),
    asOf: dateSchema.optional(),
  }),
  async execute(input): Promise<Workback> {
    const asOf = input.asOf ?? todayUtc();
    const goal = input.goal?.trim() || null;
    const tasks = tasksFor(input).map((task) => ({
      ...task,
      priority: priorityFor(task.due, asOf),
    }));
    tasks.sort(byPriorityThenDue);

    const blockers: string[] = [];
    if (!goal) {
      blockers.push(
        "Name the pipeline job before anything moves: open qualified conversations, accelerate something in motion, or deepen a relationship.",
      );
    }
    if (input.listSource === "unknown") {
      blockers.push(
        "Confirm whether guests opted in at registration or the list came from a vendor. Do not draft sendable copy until that is known.",
      );
    }
    if (input.listSource === "vendor") {
      blockers.push(
        "Vendor list: Ally reviews compliance copy before the first send. Say they opted in to hear from sponsors at registration, name the conference, include unsubscribe and the privacy policy.",
      );
    }

    return {
      event: {
        name: input.name,
        date: input.date,
        city: input.city,
        format: input.format,
        listSource: input.listSource,
        goal,
        asOf,
      },
      pipelineJob:
        goal ??
        "Unset. Pick one job before the brief moves.",
      tasks,
      blockers,
      handoff: {
        to: "Ben Staveley",
        include: [
          "HubSpot segment (ICP only: Director+ Marketing, Growth, SEO, or Performance)",
          "Lemlist campaign in the Events folder, tokens bold or underlined",
          "Sender requirements",
          "Event tracker link",
        ],
        arthur: [
          "Create the HubSpot marketing event first and wait until Arthur confirms it.",
          "Upload the attendee list in a second message. Say registered, attended, or both.",
          "A dinner beside a conference is its own marketing event under the same campaign.",
        ],
        sender: [
          "Nurture contacts send from the assigned SDR.",
          "Open-deal contacts send from the AE.",
          "Unowned contacts rotate through the sender pool.",
          "Every sequence waits for manual AE approval.",
        ],
      },
    };
  },
});

function tasksFor(input: {
  date: string;
  format: (typeof formats)[number];
  listSource: (typeof listSources)[number];
}): Omit<Task, "priority">[] {
  const on = input.date;
  const tasks: Omit<Task, "priority">[] = [
    task(
      "brief",
      "Phase 1",
      "Lock the event brief with Ally, the relevant AEs, and exec.",
      "Ally + Gabrielle",
      weeksBefore(on, 8),
      "Nothing else moves until the job, audience, and format are agreed.",
    ),
    task(
      "workbook",
      "Phase 1",
      "Open the event workbook in Notion and the matching Asana project.",
      "Gabrielle",
      weeksBefore(on, 8),
      "The workbook is how Gabrielle learns the event and keeps the running tracker.",
    ),
    task(
      "systems",
      "Phase 1",
      "Set the HubSpot campaign, one marketing event per gathering, and Luma only if this event needs a page.",
      "Gabrielle",
      weeksBefore(on, 8),
      "Attendee data stays clean when a conference and a dinner are separate events.",
    ),
    task(
      "abm",
      "Phase 1",
      "Ask Julia whether this is a standalone play or one step in an ABM sequence, and which accounts are already being touched.",
      "Julia",
      weeksBefore(on, 8),
      "A second sequence on an account already in market double-touches them.",
    ),
    task(
      "creative",
      "Phase 1",
      "Send Jess the creative brief: name, one-liner, audience, tone, assets, and deadlines.",
      "Gabrielle → Jess",
      weeksBefore(on, 8),
      "Tier 1–2 events need Jess on the Luma page, invite, and swag. Tier 3–4 still need her review.",
    ),
    task(
      "invite-list",
      "Phase 2",
      "Build the Invite List tab before any outreach: name, email, company, title, LinkedIn, segment, tier, AE, SDR, lifecycle, notes.",
      "Ally + AEs",
      weeksBefore(on, 6),
      "The sheet is the working layer. HubSpot stays the system of record.",
    ),
    task(
      "icp",
      "Phase 2",
      "Cut the list to ICP only and split net-new from in-funnel. Strip vendors, competitors, and non-buyers.",
      "Gabrielle + Ally",
      weeksBefore(on, 6),
      "Both standing segments get their own HubSpot view. Ben still checks the first cuts.",
    ),
    task(
      "touch-1",
      "Phase 4",
      "Touch 1 email: context, the event, and a soft invite or meeting offer.",
      "Ally + Gabrielle draft; AE or SDR sends",
      weeksBefore(on, 6),
      "First touch opens the conversation. It does not hard-close a date.",
    ),
    task(
      "touch-2",
      "Phase 4",
      "LinkedIn connect that references the email.",
      "AE or SDR",
      weeksBefore(on, 5),
      "The connect lands after they have seen the note, not before.",
    ),
    task(
      "touch-3",
      "Phase 4",
      "Email the agenda and nudge for time.",
      "AE or Lemlist",
      weeksBefore(on, 4),
      "Agenda gives a reason to reply that is not another generic invite.",
    ),
    task(
      "touch-4",
      "Phase 4",
      "LinkedIn note specific to their company or a speaker.",
      "AE",
      weeksBefore(on, 3),
      "Specific beats a second copy of the invite.",
    ),
    task(
      "touch-5",
      "Phase 4",
      "Email a calendar link and a real constraint on seats or time.",
      "AE or Lemlist",
      weeksBefore(on, 2),
      "Urgency only works after the earlier touches have context.",
    ),
    task(
      "touch-6",
      "Phase 4",
      "Final nudge or day-before confirmation.",
      "AE or SDR",
      weeksBefore(on, 1),
      "This is the last planned touch, not a new sequence.",
    ),
    task(
      "meetings",
      "Phase 6",
      "Each AE arrives with at least three confirmed 1:1 or small-group meetings.",
      "AEs",
      shiftDate(on, -3),
      "The room does not produce pipeline if the meetings are not booked.",
    ),
    task(
      "kbyg",
      "Phase 6",
      "Publish the KBYG: venue, travel, hotel, what is shipping, agenda, booth or room, and day-of contacts.",
      "Gabrielle",
      shiftDate(on, -3),
      "The team should not be hunting Slack and Gmail the morning of.",
    ),
    task(
      "attended",
      "Phase 6",
      "Mark who showed up, who cancelled, and who no-showed.",
      "Ally + Gabrielle + AEs",
      shiftDate(on, 1),
      "Cancelled and no-show get different follow-up. Do it inside 24 hours.",
    ),
    task(
      "debrief",
      "Phase 7",
      "Debrief every conversation and score follow-up within 24 hours.",
      "Ally",
      shiftDate(on, 1),
      "Memory fades. The score decides who gets a human note versus a sequence.",
    ),
    task(
      "follow-up",
      "Phase 7",
      "AEs update followed-up and responded, and log the outreach in HubSpot.",
      "AEs",
      shiftDate(on, 3),
      "The sheet tells them who to call. HubSpot is where the activity has to land.",
    ),
    task(
      "retro",
      "Phase 8",
      "Run the retro: goal, who showed up, what to change in the sequence, what to cut.",
      "Ally + Gabrielle",
      shiftDate(on, 14),
      "The playbook only gets better if the retro is written down.",
    ),
  ];

  if (input.format === "dinner" || input.format === "owned") {
    tasks.push(
      task(
        "venue",
        "Phase 5",
        "Confirm the venue and sign the contract.",
        "Gabrielle",
        weeksBefore(on, 10),
        "A hosted room slips when the contract is still open inside eight weeks.",
      ),
      task(
        "menu",
        "Phase 5",
        "Finalize the menu.",
        "Gabrielle",
        weeksBefore(on, 4),
        "Menu locks before dietary notes and the final headcount.",
      ),
      task(
        "dietary",
        "Phase 5",
        "Collect dietary restrictions from RSVPs.",
        "Gabrielle",
        weeksBefore(on, 1),
        "The venue needs this before the final count, not the morning of.",
      ),
      task(
        "headcount",
        "Phase 5",
        "Send the venue the final headcount.",
        "Gabrielle",
        shiftDate(on, -2),
        "Catering treats a late count as a new event.",
      ),
    );
  }

  if (input.format === "booth" || input.format === "conference") {
    tasks.push(
      task(
        "swag",
        "Phase 5",
        "Get Jess's sign-off on swag mockups before the order.",
        "Jess",
        weeksBefore(on, 7),
        "International swag does not recover from a late proof.",
      ),
      task(
        "signage",
        "Phase 5",
        "Lock onsite signage and print files.",
        "Jess",
        weeksBefore(on, 3),
        "Print has no same-week backup once the team is traveling.",
      ),
    );
  }

  if (input.format === "side_event") {
    tasks.push(
      task(
        "separate-event",
        "Phase 1",
        "Create a separate marketing event and sheet tab for the side gathering. Keep it under the parent campaign.",
        "Gabrielle",
        weeksBefore(on, 8),
        "Mixing dinner guests into the conference event makes the follow-up list wrong.",
      ),
    );
  }

  if (input.listSource === "vendor") {
    tasks.push(
      task(
        "compliance",
        "Phase 3",
        "Draft the vendor-list disclosure and get Ally's review before Touch 1.",
        "Gabrielle drafts; Ally reviews",
        weeksBefore(on, 6),
        "A sponsor list is not an opt-in until the disclosure is in the first email.",
      ),
    );
  }

  return tasks;
}

function task(
  id: string,
  phase: string,
  title: string,
  owner: string,
  due: string,
  why: string,
): Omit<Task, "priority"> {
  return { id, phase, title, owner, due, why };
}

function priorityFor(due: string, asOf: string): Priority {
  const days = Math.round(
    (Date.parse(`${due}T00:00:00Z`) - Date.parse(`${asOf}T00:00:00Z`)) / 86_400_000,
  );
  if (days <= 7) return "now";
  if (days <= 21) return "soon";
  return "later";
}

function byPriorityThenDue(a: Task, b: Task): number {
  const rank: Record<Priority, number> = { now: 0, soon: 1, later: 2 };
  return rank[a.priority] - rank[b.priority] || a.due.localeCompare(b.due);
}

function weeksBefore(eventDate: string, weeks: number): string {
  return shiftDate(eventDate, weeks * -7);
}

function shiftDate(isoDate: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return "";
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return "";
  }
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}
