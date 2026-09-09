import {
  GOOGLE_SEARCH,
  InMemoryRunner,
  LlmAgent,
  isFinalResponse,
  type Event,
} from "@google/adk";
import { randomUUID } from "node:crypto";

import {
  resolveGeminiTransport,
  type GeminiTransportEvidence,
} from "./gemini-transport";

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
  transport?: GeminiTransportEvidence;
};

type PodcastAdkEvent = {
  invocationId?: string;
  groundingMetadata?: Event["groundingMetadata"];
  errorCode?: string;
  errorMessage?: string;
  final?: boolean;
  transport?: GeminiTransportEvidence;
};

export type PodcastAdkRuntime = {
  execute(input: {
    model: string;
    prompt: string;
  }): AsyncIterable<PodcastAdkEvent>;
};

const googleAdkRuntime: PodcastAdkRuntime = {
  async *execute({ model, prompt }) {
    const transport = resolveGeminiTransport();
    const agent = new LlmAgent({
      name: "autography_podcast_source_scout",
      description: "Finds current public-web sources for bounded podcast development research.",
      model: transport.adkModel(model),
      instruction:
        "Use Google Search to retrieve current public-web context from named, diverse sources. Prefer an official event or publisher source plus reputable reporting; when the topic asks about audience reaction or preferences, include at least one genuine public community source. Ground every finding to its source. Preserve publisher and community names, but never return usernames, participant identities, raw comments, quotations, or copied post text. Summarize community reaction only as aggregate themes.",
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
        transport: transport.evidence,
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
  let transport: GeminiTransportEvidence | undefined;

  try {
    let groundingMetadata: Event["groundingMetadata"];
    let completed = false;
    const prompt =
      `Search the public web for current context about this exact podcast development topic: ${input.query}. ` +
      `Restrict every Google query to ${input.windowLabel} by including these date operators: ${input.googleDateOperators}. ` +
      "Return a concise, concrete, non-alleging evidence inventory with named publishers, source-linked findings, and clear support boundaries. " +
      "Use source diversity: seek an official event or publisher source, reputable reporting, and a genuine public community source for any audience-reaction claim. " +
      "Do not return usernames, participant identities, raw comments, quotations, or copied post text; summarize community reactions only as aggregate themes.";

    for await (const event of runtime.execute({ model: input.model, prompt })) {
      if (event.transport) transport = event.transport;
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
        ...(transport ? { transport } : {}),
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
      ...(transport ? { transport } : {}),
    }, error);
  }
}