import { Gemini } from "@google/adk";
import { GoogleGenAI } from "@google/genai";

export type GeminiTransportEvidence =
  | {
      api: "gemini_developer_api";
      auth: "api_key";
    }
  | {
      api: "vertex_ai";
      auth: "application_default_credentials";
      project_configured: true;
      location_configured: true;
    };

export type ResolvedGeminiTransport = {
  mode: "gemini_developer_api" | "vertex_ai";
  evidence: GeminiTransportEvidence;
  adkModel: (model: string) => Gemini;
  genAI: () => GoogleGenAI;
};

export class GeminiTransportConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiTransportConfigurationError";
  }
}

function configured(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function configuredBoolean(name: string, value: string | undefined) {
  const configuredValue = configured(value);
  if (configuredValue === undefined) return undefined;
  if (configuredValue === "true") return true;
  if (configuredValue === "false") return false;
  throw new GeminiTransportConfigurationError(
    `Gemini transport configuration is invalid: ${name} must be true or false.`,
  );
}

/**
 * Resolves one explicit server-side Gemini transport. Credentials remain inside
 * constructor closures and are never included in the returned evidence.
 */
export function resolveGeminiTransport(
  env: NodeJS.ProcessEnv = process.env,
): ResolvedGeminiTransport {
  const geminiKey = configured(env.GEMINI_API_KEY);
  const googleGenAiKey = configured(env.GOOGLE_GENAI_API_KEY);
  const googleApiKey = configured(env.GOOGLE_API_KEY);
  const configuredApiKeys = [...new Set(
    [geminiKey, googleGenAiKey, googleApiKey].filter((value): value is string => Boolean(value)),
  )];
  if (configuredApiKeys.length > 1) {
    throw new GeminiTransportConfigurationError(
      "Gemini Developer API configuration is ambiguous: API-key variables disagree.",
    );
  }
  const apiKey = configuredApiKeys[0];
  const vertexFlag = configuredBoolean(
    "GOOGLE_GENAI_USE_VERTEXAI",
    env.GOOGLE_GENAI_USE_VERTEXAI,
  );
  const enterpriseFlag = configuredBoolean(
    "GOOGLE_GENAI_USE_ENTERPRISE",
    env.GOOGLE_GENAI_USE_ENTERPRISE,
  );
  if (
    vertexFlag !== undefined &&
    enterpriseFlag !== undefined &&
    vertexFlag !== enterpriseFlag
  ) {
    throw new GeminiTransportConfigurationError(
      "Gemini transport configuration is ambiguous: cloud transport flags disagree.",
    );
  }
  const cloudFlag = enterpriseFlag ?? vertexFlag;
  const project = configured(env.GOOGLE_CLOUD_PROJECT);
  const location = configured(env.GOOGLE_CLOUD_LOCATION);
  const customEndpoint = [
    env.GOOGLE_GEMINI_BASE_URL,
    env.GOOGLE_VERTEX_BASE_URL,
    env.GEMINI_NEXT_GEN_API_BASE_URL,
  ].some((value) => Boolean(configured(value)));
  if (customEndpoint) {
    throw new GeminiTransportConfigurationError(
      "Gemini transport configuration is unverifiable: custom API endpoints are not supported.",
    );
  }

  const hasVertexConfiguration = cloudFlag === true || Boolean(project) || Boolean(location);
  if (apiKey && hasVertexConfiguration) {
    throw new GeminiTransportConfigurationError(
      "Gemini transport configuration is mixed: choose Developer API or Vertex AI.",
    );
  }

  if (cloudFlag === true) {
    if (!project || !location) {
      throw new GeminiTransportConfigurationError(
        "Vertex AI configuration is incomplete: project and location are required.",
      );
    }
    const evidence: GeminiTransportEvidence = {
      api: "vertex_ai",
      auth: "application_default_credentials",
      project_configured: true,
      location_configured: true,
    };
    return {
      mode: "vertex_ai",
      evidence,
      adkModel: (model) => new Gemini({ model, vertexai: true, project, location }),
      genAI: () => new GoogleGenAI({ enterprise: true, vertexai: true, project, location }),
    };
  }

  if (project || location) {
    throw new GeminiTransportConfigurationError(
      "Vertex AI configuration is incomplete: explicitly enable Vertex AI with project and location.",
    );
  }
  if (!apiKey) {
    throw new GeminiTransportConfigurationError(
      "Gemini transport is not configured: provide a Developer API key or complete Vertex AI configuration.",
    );
  }

  const evidence: GeminiTransportEvidence = {
    api: "gemini_developer_api",
    auth: "api_key",
  };
  return {
    mode: "gemini_developer_api",
    evidence,
    adkModel: (model) => new Gemini({ model, apiKey, vertexai: false }),
    genAI: () => new GoogleGenAI({ apiKey, enterprise: false, vertexai: false }),
  };
}