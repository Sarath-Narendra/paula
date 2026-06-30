import "server-only";
import { generateJSON, Type, type Schema } from "@/lib/gemini";
import { env } from "@/lib/env";

export interface DecomposedSubtask {
  title: string;
  /** Estimated focused minutes for this step. */
  estDuration: number;
  /** 1 (trivial) – 5 (very hard). */
  difficulty: number;
  energy: "low" | "medium" | "high";
  /** Indices (into this array) of steps that must finish first. */
  deps: number[];
}

export interface Decomposition {
  summary: string;
  /** A concise task title derived from the goal. */
  title: string;
  subtasks: DecomposedSubtask[];
}

const schema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    summary: { type: Type.STRING },
    subtasks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          estDuration: { type: Type.INTEGER },
          difficulty: { type: Type.INTEGER },
          energy: { type: Type.STRING, enum: ["low", "medium", "high"] },
          deps: { type: Type.ARRAY, items: { type: Type.INTEGER } },
        },
        required: ["title", "estDuration", "difficulty", "energy", "deps"],
      },
    },
  },
  required: ["title", "summary", "subtasks"],
};

const SYSTEM = `You are Paula's planning brain. You turn a vague goal into a concrete, ordered set of small, actionable, time-boxed subtasks that a real person can execute.

Rules:
- Produce 3–8 subtasks. Each must be a single concrete action, not a vague theme.
- estDuration is realistic focused minutes (typically 15–90). Avoid blocks > 120 min; split instead.
- Order subtasks logically and express real prerequisites via "deps" (indices of earlier subtasks). Independent subtasks have deps: [].
- difficulty 1–5; energy reflects cognitive load (writing/problem-solving = high, formatting/admin = low).
- Be specific to the goal's domain. The final subtask is usually a review/submit/ship step.`;

/**
 * Ask Gemini to decompose a goal into scheduled-ready subtasks.
 * Uses the Pro model — this is the highest-reasoning step in the pipeline.
 */
export async function decomposeGoal(input: {
  goal: string;
  deadlineIso: string;
  nowIso: string;
  importance: number;
}): Promise<Decomposition> {
  const prompt = `Goal: "${input.goal}"
Current time (ISO): ${input.nowIso}
Deadline (ISO): ${input.deadlineIso}
Importance (1-5): ${input.importance}

Break this goal into an ordered list of actionable, time-boxed subtasks with realistic effort estimates and dependencies.`;

  const result = await generateJSON<Decomposition>({
    prompt,
    schema,
    system: SYSTEM,
    model: env.geminiModelPro,
    temperature: 0.4,
  });

  // Defensive clamping in case the model drifts outside ranges.
  result.subtasks = (result.subtasks ?? []).map((s) => ({
    ...s,
    estDuration: Math.min(180, Math.max(5, Math.round(s.estDuration || 30))),
    difficulty: Math.min(5, Math.max(1, Math.round(s.difficulty || 3))),
    energy: ["low", "medium", "high"].includes(s.energy) ? s.energy : "medium",
    deps: Array.isArray(s.deps) ? s.deps : [],
  }));
  return result;
}
