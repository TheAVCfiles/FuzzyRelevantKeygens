import {
  GOOGLE_SEARCH,
  InMemoryRunner,
  LlmAgent,
  isFinalResponse,
  type Event,
} from "@google/adk";
import { randomUUID } from "node:crypto";

export const podcastAdkFramework = "Google ADK (@google/adk)";
export const podcastAdkTools = ["googleSearch"] as const;

export type PodcastAdkExecutionEvidence = {
  agent: "source_scout";
  provider: "Google Gemini API";
  framework: typeof podcastAdkFramework;
  model: string;
  execution_id: string;
  tools: string[];
  latency_ms: number;
  status: "completed" | "failed";
  activity: string;
};

type PodcastAdkEvent = {
  invocationId?: string;
  groundingMetadata?: Event["groundingMetadata"];
  errorCode?: string;
  errorMessage?: string;
  final?: boolean;
};

export type PodcastAdkRuntime = {
  execute(input: {
    model: string;
    prompt: string;
  }): AsyncIterable<PodcastAdkEvent>;
};

const googleAdkRuntime: PodcastAdkRuntime = {
  async *execute({ model, prompt }) {
    const agent = new LlmAgent({
      name: "autography_podcast_source_scout",
      description: "Finds current public-web sources for bounded podcast development research.",
      model,
      instruction:
        "Use Google Search to retrieve current public-web context. Return only concise aggregate evidence. Never return identities, usernames, raw comments, quotations, or copied post text.",
      includeContents: "none",
      tools: [GOOGLE_SEARCH],
    });
    const runner = new InMemoryRunner({
      agent,
      appName: "autography_podcast_research",
    });

    for await (const event of runner.runEphemeral({
      userId: "autography-podcast-research",
      newMessage: {
        role: "user",
        parts: [{ text: prompt }],
      },
    })) {
      yield {
        invocationId: event.invocationId,
        groundingMetadata: event.groundingMetadata,
        errorCode: event.errorCode,
        errorMessage: event.errorMessage,
        final: isFinalResponse(event),
      };
    }
  },
};

export class PodcastAdkResearchError extends Error {
  readonly runtimeEvidence: PodcastAdkExecutionEvidence;

  constructor(runtimeEvidence: PodcastAdkExecutionEvidence, cause?: unknown) {
    super("Google ADK grounded podcast research failed.", { cause });
    this.name = "PodcastAdkResearchError";
    this.runtimeEvidence = runtimeEvidence;
  }
}

export function getPodcastAdkFailureEvidence(error: unknown) {
  return error instanceof PodcastAdkResearchError ? error.runtimeEvidence : null;
}

export async function runPodcastAdkResearch(
  input: {
    query: string;
    windowLabel: string;
    googleDateOperators: string;
    model: string;
  },
  runtime: PodcastAdkRuntime = googleAdkRuntime,
) {
  const started = Date.now();
  let executionId = `adk-attempt-${randomUUID()}`;

  try {
    let groundingMetadata: Event["groundingMetadata"];
    let completed = false;
    const prompt =
      `Search the public web for current context about this exact podcast development topic: ${input.query}. ` +
      `Restrict every Google query to ${input.windowLabel} by including these date operators: ${input.googleDateOperators}. ` +
      "Return only a concise, aggregate, non-alleging evidence inventory. " +
      "Do not return identities, usernames, raw comments, quotations, or copied post text.";

    for await (const event of runtime.execute({ model: input.model, prompt })) {
      if (event.invocationId) executionId = event.invocationId;
      if (event.errorCode || event.errorMessage) {
        throw new Error("Google ADK returned an unsuccessful model event.");
      }
      if (event.groundingMetadata) groundingMetadata = event.groundingMetadata;
      if (event.final) completed = true;
    }

    if (!completed || !groundingMetadata) {
      throw new Error("Google ADK did not return a completed grounded response.");
    }

    return {
      groundingMetadata,
      execution: {
        agent: "source_scout",
        provider: "Google Gemini API",
        framework: podcastAdkFramework,
        model: input.model,
        execution_id: executionId,
        tools: [...podcastAdkTools],
        latency_ms: Date.now() - started,
        status: "completed",
        activity: "Executed Google Search-grounded source scouting through Google ADK.",
      } satisfies PodcastAdkExecutionEvidence,
    };
  } catch (error) {
    throw new PodcastAdkResearchError({
      agent: "source_scout",
      provider: "Google Gemini API",
      framework: podcastAdkFramework,
      model: input.model,
      execution_id: executionId,
      tools: [...podcastAdkTools],
      latency_ms: Date.now() - started,
      status: "failed",
      activity: "Google ADK source scouting failed closed; no grounded run was created.",
    }, error);
  }
}