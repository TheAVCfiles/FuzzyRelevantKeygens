import assert from "node:assert/strict";
import { test } from "node:test";

import {
  GeminiTransportConfigurationError,
  resolveGeminiTransport,
} from "./gemini-transport";

test("resolves Gemini Developer API with API-key auth", () => {
  const transport = resolveGeminiTransport({ GEMINI_API_KEY: "developer-secret" });
  assert.equal(transport.mode, "gemini_developer_api");
  assert.deepEqual(transport.evidence, {
    api: "gemini_developer_api",
    auth: "api_key",
  });
  assert.equal(transport.genAI().vertexai, false);
  assert.equal((transport.adkModel("gemini-test") as unknown as { vertexai: boolean }).vertexai, false);
});

test("resolves Vertex AI with ADC, project, and location", () => {
  const transport = resolveGeminiTransport({
    GOOGLE_GENAI_USE_VERTEXAI: "true",
    GOOGLE_CLOUD_PROJECT: "private-project",
    GOOGLE_CLOUD_LOCATION: "us-central1",
  });
  assert.equal(transport.mode, "vertex_ai");
  assert.deepEqual(transport.evidence, {
    api: "vertex_ai",
    auth: "application_default_credentials",
    project_configured: true,
    location_configured: true,
  });
  assert.equal(transport.genAI().vertexai, true);
  assert.equal((transport.adkModel("gemini-test") as unknown as { vertexai: boolean }).vertexai, true);
});

test("rejects mixed Developer API and Vertex AI configuration", () => {
  assert.throws(
    () => resolveGeminiTransport({
      GEMINI_API_KEY: "developer-secret",
      GOOGLE_GENAI_USE_VERTEXAI: "true",
      GOOGLE_CLOUD_PROJECT: "private-project",
      GOOGLE_CLOUD_LOCATION: "us-central1",
    }),
    GeminiTransportConfigurationError,
  );
});

test("rejects missing and incomplete transport configuration", () => {
  assert.throws(() => resolveGeminiTransport({}), /not configured/i);
  assert.throws(
    () => resolveGeminiTransport({
      GOOGLE_GENAI_USE_VERTEXAI: "true",
      GOOGLE_CLOUD_PROJECT: "private-project",
    }),
    /incomplete/i,
  );
});

test("rejects hidden cloud aliases and custom endpoints that could diverge from evidence", () => {
  assert.throws(
    () => resolveGeminiTransport({
      GEMINI_API_KEY: "developer-secret",
      GOOGLE_GENAI_USE_ENTERPRISE: "true",
    }),
    /mixed/i,
  );
  assert.throws(
    () => resolveGeminiTransport({
      GOOGLE_GENAI_USE_VERTEXAI: "false",
      GOOGLE_GENAI_USE_ENTERPRISE: "true",
      GOOGLE_CLOUD_PROJECT: "private-project",
      GOOGLE_CLOUD_LOCATION: "us-central1",
    }),
    /flags disagree/i,
  );
  assert.throws(
    () => resolveGeminiTransport({
      GEMINI_API_KEY: "developer-secret",
      GOOGLE_GEMINI_BASE_URL: "https://proxy.example.test",
    }),
    /custom API endpoints/i,
  );
});

test("execution evidence never contains credentials or cloud identifiers", () => {
  const serializedDeveloper = JSON.stringify(resolveGeminiTransport({
    GEMINI_API_KEY: "credential-must-not-escape",
  }).evidence);
  const serializedVertex = JSON.stringify(resolveGeminiTransport({
    GOOGLE_GENAI_USE_VERTEXAI: "true",
    GOOGLE_CLOUD_PROJECT: "project-must-not-escape",
    GOOGLE_CLOUD_LOCATION: "location-must-not-escape",
  }).evidence);
  assert.doesNotMatch(serializedDeveloper, /credential-must-not-escape/);
  assert.doesNotMatch(serializedVertex, /project-must-not-escape|location-must-not-escape/);
  assert.deepEqual(Object.keys(JSON.parse(serializedDeveloper)).sort(), ["api", "auth"]);
});