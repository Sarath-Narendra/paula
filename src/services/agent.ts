import "server-only";
import {
  type Content,
  type FunctionDeclaration,
  Type,
} from "@google/genai";
import { ai } from "@/lib/gemini";
import { env } from "@/lib/env";
import type { OAuthClient } from "@/lib/google";
import { createPlan } from "@/services/planner";
import { listTasks, listBlocks } from "@/services/tasks";
import { getUser } from "@/services/users";
import type { Importance } from "@/lib/types";

export interface AgentMessage {
  role: "user" | "model";
  text: string;
}

export interface AgentAction {
  tool: string;
  summary: string;
}

const tools: FunctionDeclaration[] = [
  {
    name: "create_plan",
    description:
      "Decompose a goal into subtasks and schedule them into the user's real calendar. Use whenever the user states something they want to accomplish.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        goal: {
          type: Type.STRING,
          description: "The goal in the user's own words.",
        },
        deadlineIso: {
          type: Type.STRING,
          description:
            "Deadline as a full ISO 8601 timestamp. Resolve relative dates (e.g. 'Friday', 'tomorrow 5pm') against the current time provided in the system prompt.",
        },
        importance: {
          type: Type.INTEGER,
          description: "1=trivial, 3=normal, 5=critical. Default 3.",
        },
      },
      required: ["goal", "deadlineIso"],
    },
  },
  {
    name: "list_tasks",
    description: "List the user's current tasks with deadlines and status.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "get_upcoming_schedule",
    description:
      "Get the user's upcoming scheduled work blocks (what Paula has planned next).",
    parameters: { type: Type.OBJECT, properties: {} },
  },
];

async function executeTool(
  uid: string,
  client: OAuthClient | null,
  name: string,
  args: Record<string, unknown>
): Promise<{ result: unknown; action?: AgentAction }> {
  switch (name) {
    case "create_plan": {
      const result = await createPlan(uid, client, {
        goal: String(args.goal ?? ""),
        deadline: new Date(
          String(args.deadlineIso ?? Date.now())
        ).toISOString(),
        importance: (Number(args.importance) || 3) as Importance,
      });
      return {
        result,
        action: { tool: "create_plan", summary: `Planned “${result.title}”` },
      };
    }
    case "list_tasks": {
      const tasks = await listTasks(uid);
      return {
        result: tasks.map((t) => ({
          title: t.title,
          deadline: t.deadline,
          status: t.status,
          confidence: t.confidence,
        })),
      };
    }
    case "get_upcoming_schedule": {
      const blocks = (await listBlocks(uid))
        .filter((b) => new Date(b.start) >= new Date())
        .slice(0, 10);
      return {
        result: blocks.map((b) => ({
          title: b.title,
          start: b.start,
          end: b.end,
          type: b.type,
        })),
      };
    }
    default:
      return { result: { error: `Unknown tool ${name}` } };
  }
}

const MAX_STEPS = 6;

/**
 * Run a single agent turn: Gemini may call tools (which act on the user's real
 * data/calendar) in a loop before producing its final natural-language reply.
 */
export async function runAgent(opts: {
  uid: string;
  client: OAuthClient | null;
  message: string;
  history?: AgentMessage[];
}): Promise<{ reply: string; actions: AgentAction[] }> {
  const user = await getUser(opts.uid);
  const tz = user?.timezone ?? "UTC";

  const system = `You are Paula, an autonomous execution planner. You don't just remind — you plan, schedule, and help people finish work before deadlines.

Current time: ${new Date().toISOString()} (user timezone: ${tz}).

Guidelines:
- When the user states anything they need to do, call create_plan. If they didn't give a deadline, infer a sensible one and mention your assumption.
- Be concise, warm, and action-oriented. After planning, briefly summarize what you scheduled.
- Use list_tasks / get_upcoming_schedule to answer questions about their plan.`;

  const contents: Content[] = [
    ...(opts.history ?? []).map(
      (m): Content => ({ role: m.role, parts: [{ text: m.text }] })
    ),
    { role: "user", parts: [{ text: opts.message }] },
  ];

  const actions: AgentAction[] = [];

  for (let step = 0; step < MAX_STEPS; step++) {
    const res = await ai().models.generateContent({
      model: env.geminiModelFlash,
      contents,
      config: {
        systemInstruction: system,
        tools: [{ functionDeclarations: tools }],
        temperature: 0.5,
      },
    });

    const calls = res.functionCalls ?? [];
    if (calls.length === 0) {
      return { reply: res.text ?? "", actions };
    }

    // Append the model's tool-call turn, then the tool results.
    const modelContent = res.candidates?.[0]?.content;
    if (modelContent) contents.push(modelContent);

    const responseParts = [];
    for (const call of calls) {
      const { result, action } = await executeTool(
        opts.uid,
        opts.client,
        call.name ?? "",
        (call.args as Record<string, unknown>) ?? {}
      );
      if (action) actions.push(action);
      responseParts.push({
        functionResponse: {
          name: call.name ?? "",
          response: { result },
        },
      });
    }
    contents.push({ role: "user", parts: responseParts });
  }

  return {
    reply:
      "I've taken some actions but couldn't fully wrap up — check your Tasks view.",
    actions,
  };
}
