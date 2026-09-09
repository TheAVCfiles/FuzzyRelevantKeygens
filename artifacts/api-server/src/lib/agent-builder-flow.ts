import {
  InMemoryRunner,
  LlmAgent,
  isFinalResponse,
  stringifyContent,
} from "@google/adk";
import { randomUUID } from "node:crypto";

import {
  resolveGeminiTransport,
  type GeminiTransportEvidence,
} from "./gemini-transport";
import {
  clusters,
  contextItems,
  events,
  pullRequest,
  recordAgentStage,
  show,
} from "./autography-fixtures";

const model = "gemini-3.6-flash";
const framework = "Google ADK (@google/adk)";

type Stage = {
  id: string;
  role: string;
  status: string;
};

export type AgentFlowRuntimeEvidence = {
  stage_id: string;
  framework: typeof framework;
  provider: "Google Gemini API";
  model: string;
  execution_id: string;
  tools: string[];
  latency_ms: number;
  status: "completed" | "failed";
  activity: string;
  transport?: GeminiTransportEvidence;
};

export type AgentFlowAdkRuntime = {
  runStage(input: {
    id: string;
    role: string;
    model: string;
    prompt: string;
  }): Promise<{
    output: string;
    evidence: AgentFlowRuntimeEvidence;
  }>;
};

class AgentFlowAdkStageError extends Error {
  readonly evidence: AgentFlowRuntimeEvidence;

  constructor(evidence: AgentFlowRuntimeEvidence, cause?: unknown) {
    super("Google ADK could not complete an AUTOGRAPHY agent stage.", { cause });
    this.name = "AgentFlowAdkStageError";
    this.evidence = evidence;
  }
}

export class AutographyAdkFlowError extends Error {
  readonly runtimeEvidence: AgentFlowRuntimeEvidence[];

  constructor(runtimeEvidence: AgentFlowRuntimeEvidence[]) {
    super("Google ADK could not complete the AUTOGRAPHY agent flow.");
    this.name = "AutographyAdkFlowError";
    this.runtimeEvidence = runtimeEvidence;
  }
}

const googleAdkRuntime: AgentFlowAdkRuntime = {
  async runStage({ id, role, model: stageModel, prompt }) {
    const started = Date.now();
    let executionId = `adk-attempt-${randomUUID()}`;
    let transportEvidence: GeminiTransportEvidence | undefined;

    try {
      const transport = resolveGeminiTransport();
      transportEvidence = transport.evidence;
      const agent = new LlmAgent({
        name: `autography_${id.toLowerCase()}_${role}`,
        description: `Executes the bounded AUTOGRAPHY ${role} stage without decision or publishing authority.`,
        model: transport.adkModel(stageModel),
        instruction:
          "Follow the supplied stage instructions exactly. Return valid JSON only. Never choose, approve, publish, sign, seal, or change policy.",
        generateContentConfig: {
          responseMimeType: "application/json",
        },
      });
      const runner = new InMemoryRunner({
        agent,
        appName: "autography_agent_flow",
      });
      let output = "";
      let completed = false;

      for await (const event of runner.runEphemeral({
        userId: "autography-agent-flow",
        newMessage: {
          role: "user",
          parts: [{ text: prompt }],
        },
      })) {
        if (event.invocationId) executionId = event.invocationId;
        if (event.errorCode || event.errorMessage) {
          throw new Error("Google ADK returned an unsuccessful model event.");
        }
        if (isFinalResponse(event)) {
          output = stringifyContent(event).trim();
          completed = true;
        }
      }

      if (!completed || !output) {
        throw new Error("Google ADK returned no completed stage output.");
      }

      return {
        output,
        evidence: {
          stage_id: id,
          framework,
          provider: "Google Gemini API",
          model: stageModel,
          execution_id: executionId,
          tools: [],
          latency_ms: Date.now() - started,
          status: "completed",
          activity: `Executed the ${role} stage through Google ADK.`,
          transport: transport.evidence,
        },
      };
    } catch (error) {
      throw new AgentFlowAdkStageError({
        stage_id: id,
        framework,
        provider: "Google Gemini API",
        model: stageModel,
        execution_id: executionId,
        tools: [],
        latency_ms: Date.now() - started,
        status: "failed",
        activity: `Google ADK ${role} stage failed closed.`,
        ...(transportEvidence ? { transport: transportEvidence } : {}),
      }, error);
    }
  },
};

async function runStage(
  runtime: AgentFlowAdkRuntime,
  id: string,
  role: string,
  input: string,
): Promise<{ stage: Stage; output: string; evidence: AgentFlowRuntimeEvidence }> {
  const result = await runtime.runStage({ id, role, model, prompt: input });
  recordAgentStage(id, role, input, result.output);
  return {
    stage: { id, role, status: "recorded" },
    output: result.output,
    evidence: result.evidence,
  };
}

export async function runAutographyAgentFlow(
  runtime: AgentFlowAdkRuntime = googleAdkRuntime,
) {
  const fallbackStages: Stage[] = [
    { id: "G1", role: "read", status: "fixture retained" },
    { id: "G2", role: "classify", status: "fixture retained" },
    { id: "G3", role: "reconcile", status: "fixture retained" },
    { id: "G4", role: "draft", status: "fixture retained" },
  ];
  const runtimeEvidence: AgentFlowRuntimeEvidence[] = [];

  try {
    const g1 = await runStage(
      runtime,
      "G1",
      "read",
      `You are a read-only scene analyst. Do not make a decision, publish anything, or infer facts beyond the supplied text. Return JSON with scene_summary, people, actions, and likely_viewer_inferences. This is synthetic material.\n\nSHOW: ${show.title}, episode ${show.episode}\nSCENE PACKAGE: ${show.transcript_excerpt}`,
    );
    runtimeEvidence.push(g1.evidence);
    const g2 = await runStage(
      runtime,
      "G2",
      "classify",
      `You are a read-only signal classifier. Do not decide what is true and do not claim public opinion. Return JSON that groups observed messages into candidate clusters with class, confidence, coordination signals, and uncertainty. Coordination must be a likelihood, never a verdict.\n\nSIGNAL EVENTS:\n${JSON.stringify(events)}`,
    );
    runtimeEvidence.push(g2.evidence);
    const g3 = await runStage(
      runtime,
      "G3",
      "reconcile",
      `You are a read-only reconciliation analyst. Separate authentic audience concern from the loudest observed claim. Do not make a decision or issue a statement. Return JSON with authentic_concern, evidence_basis, uncertainty, and source_refs.\n\nFIXTURE CLUSTERS:\n${JSON.stringify(clusters)}\n\nCONTEXT REPOSITORY:\n${JSON.stringify(contextItems)}\n\nG1 OUTPUT:\n${g1.output}\n\nG2 OUTPUT:\n${g2.output}`,
    );
    runtimeEvidence.push(g3.evidence);
    const g4 = await runStage(
      runtime,
      "G4",
      "draft",
      `You are a drafting assistant. Stage exactly three candidate moves including Stay dark. Do not choose, approve, publish, or alter policy. Return JSON with candidate moves, projected outcomes, and context_refs. Claims must use only supplied context and must not accuse any third party.\n\nCALL SCOPES: ${JSON.stringify(["drop:issue", "room:open", "offers:receive", "likeness:still"])}\nCONTEXT REPOSITORY: ${JSON.stringify(contextItems)}\nCURRENT STAGED PR: ${JSON.stringify(pullRequest)}\nG3 OUTPUT: ${g3.output}`,
    );
    runtimeEvidence.push(g4.evidence);

    return {
      mode: "google_adk" as const,
      stages: [g1.stage, g2.stage, g3.stage, g4.stage],
      runtime_evidence: runtimeEvidence,
      message:
        "Google ADK executed and recorded the four-stage read, classify, reconcile, and draft flow. The fixture-backed presentation remains the demo source of truth.",
    };
  } catch (error) {
    if (error instanceof AgentFlowAdkStageError) {
      runtimeEvidence.push(error.evidence);
    }
    recordAgentStage(
      "G1–G4",
      "flow",
      "Synthetic episode fixture",
      "Google ADK flow failed; no model output advanced.",
    );
    if (process.env.NODE_ENV === "production") {
      throw new AutographyAdkFlowError(runtimeEvidence);
    }
    return {
      mode: "fixture_fallback" as const,
      stages: fallbackStages,
      runtime_evidence: runtimeEvidence,
      message:
        "Google ADK could not complete the flow; the explicitly labeled development fixture remains active.",
    };
  }
}