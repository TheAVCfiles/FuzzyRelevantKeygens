import { GoogleGenAI } from "@google/genai";

import {
  clusters,
  contextItems,
  events,
  pullRequest,
  recordAgentStage,
  show,
} from "./autography-fixtures";

const model = "gemini-2.5-flash";

type Stage = {
  id: string;
  role: string;
  status: string;
};

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }
  return new GoogleGenAI({ apiKey });
}

async function runStage(
  ai: GoogleGenAI,
  id: string,
  role: string,
  input: string,
): Promise<{ stage: Stage; output: string }> {
  const response = await ai.models.generateContent({
    model,
    contents: input,
    config: { responseMimeType: "application/json" },
  });
  const output = response.text ?? "{}";
  recordAgentStage(id, role, input, output);
  return { stage: { id, role, status: "recorded" }, output };
}

export async function runAutographyAgentFlow() {
  const fallbackStages: Stage[] = [
    { id: "G1", role: "read", status: "fixture retained" },
    { id: "G2", role: "classify", status: "fixture retained" },
    { id: "G3", role: "reconcile", status: "fixture retained" },
    { id: "G4", role: "draft", status: "fixture retained" },
  ];

  try {
    const ai = getClient();
    const g1 = await runStage(
      ai,
      "G1",
      "read",
      `You are a read-only scene analyst. Do not make a decision, publish anything, or infer facts beyond the supplied text. Return JSON with scene_summary, people, actions, and likely_viewer_inferences. This is synthetic material.\n\nSHOW: ${show.title}, episode ${show.episode}\nSCENE PACKAGE: ${show.transcript_excerpt}`,
    );
    const g2 = await runStage(
      ai,
      "G2",
      "classify",
      `You are a read-only signal classifier. Do not decide what is true and do not claim public opinion. Return JSON that groups observed messages into candidate clusters with class, confidence, coordination signals, and uncertainty. Coordination must be a likelihood, never a verdict.\n\nSIGNAL EVENTS:\n${JSON.stringify(events)}`,
    );
    const g3 = await runStage(
      ai,
      "G3",
      "reconcile",
      `You are a read-only reconciliation analyst. Separate authentic audience concern from the loudest observed claim. Do not make a decision or issue a statement. Return JSON with authentic_concern, evidence_basis, uncertainty, and source_refs.\n\nFIXTURE CLUSTERS:\n${JSON.stringify(clusters)}\n\nCONTEXT REPOSITORY:\n${JSON.stringify(contextItems)}\n\nG1 OUTPUT:\n${g1.output}\n\nG2 OUTPUT:\n${g2.output}`,
    );
    await runStage(
      ai,
      "G4",
      "draft",
      `You are a drafting assistant. Stage exactly three candidate moves including Stay dark. Do not choose, approve, publish, or alter policy. Return JSON with candidate moves, projected outcomes, and context_refs. Claims must use only supplied context and must not accuse any third party.\n\nCALL SCOPES: ${JSON.stringify(["drop:issue", "room:open", "offers:receive", "likeness:still"])}\nCONTEXT REPOSITORY: ${JSON.stringify(contextItems)}\nCURRENT STAGED PR: ${JSON.stringify(pullRequest)}\nG3 OUTPUT: ${g3.output}`,
    );

    return {
      mode: "gemini" as const,
      stages: [
        { id: "G1", role: "read", status: "recorded" },
        { id: "G2", role: "classify", status: "recorded" },
        { id: "G3", role: "reconcile", status: "recorded" },
        { id: "G4", role: "draft", status: "recorded" },
      ],
      message:
        "The four-stage read, classify, reconcile, and draft flow was recorded. The fixture-backed presentation remains the demo source of truth.",
    };
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "Unknown Gemini runtime error.";
    recordAgentStage("G1–G4", "flow", "Synthetic episode fixture", `fallback: ${reason}`);
    return {
      mode: "fixture_fallback" as const,
      stages: fallbackStages,
      message: `Gemini could not complete the flow; the recorded fixture path remains active. ${reason}`,
    };
  }
}