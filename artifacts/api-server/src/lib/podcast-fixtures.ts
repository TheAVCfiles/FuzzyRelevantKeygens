import { GoogleGenAI } from "@google/genai";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type {
  PodcastBrief,
  PodcastScriptWorkspace,
  PodcastSource,
} from "@workspace/api-zod";

import { recordAgentStage, recordHumanDecision } from "./autography-fixtures";

const model = "gemini-3.6-flash";

const now = () => new Date().toISOString();

export const podcastSources: PodcastSource[] = [
  {
    id: "reddit-fixture-001",
    source_url: "https://www.reddit.com/r/television/comments/1abc234/the_reunion_edit_changed_everything/",
    platform: "Reddit",
    community: "r/television",
    post_title: "The reunion edit changed everything — what did the audience actually miss?",
    timestamp: "2026-08-22T14:05:00.000Z",
    retrieved_at: "2026-08-22T14:28:00.000Z",
    engagement: { score: 1840, comments: 312 },
    source_id: "1abc234",
    access_mode: "fixture" as const,
  },
  {
    id: "reddit-fixture-002",
    source_url: "https://www.reddit.com/r/BravoRealHousewives/comments/1def567/why_did_the_reunion_skip_the_context/",
    platform: "Reddit",
    community: "r/BravoRealHousewives",
    post_title: "Why did the reunion skip the context everyone was asking for?",
    timestamp: "2026-08-22T13:42:00.000Z",
    retrieved_at: "2026-08-22T14:29:00.000Z",
    engagement: { score: 965, comments: 178 },
    source_id: "1def567",
    access_mode: "fixture" as const,
  },
  {
    id: "reddit-fixture-003",
    source_url: "https://www.reddit.com/r/podcasts/comments/1ghi890/the_best_reality_tv_recap_is_about_the_edit/",
    platform: "Reddit",
    community: "r/podcasts",
    post_title: "The best reality TV recap is about the edit, not the cast",
    timestamp: "2026-08-22T12:58:00.000Z",
    retrieved_at: "2026-08-22T14:30:00.000Z",
    engagement: { score: 622, comments: 94 },
    source_id: "1ghi890",
    access_mode: "fixture" as const,
  },
];

export const podcastConcepts = [
  {
    id: "concept-edit-context",
    title: "The missing-context problem",
    summary:
      "Listeners are not asking for more reaction. They are asking what the edit leaves out, and whether the timeline can be reconstructed without targeting a person.",
    relevance: 0.96,
    urgency: 0.91,
    engagement: 0.88,
    freshness: 0.94,
    source_diversity: 0.42,
    source_ids: podcastSources.map((source) => source.id),
    status: "ready" as const,
  },
  {
    id: "concept-recap-trust",
    title: "Can a recap be fair when the cut is not neutral?",
    summary:
      "A recurring audience tension: recap culture rewards certainty, while viewers increasingly want the production choices and uncertainty named.",
    relevance: 0.89,
    urgency: 0.78,
    engagement: 0.74,
    freshness: 0.86,
    source_diversity: 0.32,
    source_ids: [podcastSources[0].id, podcastSources[2].id],
    status: "ready" as const,
  },
  {
    id: "concept-reaction-fatigue",
    title: "The audience is tired of outrage-shaped recaps",
    summary:
      "Multiple communities are separating genuine confusion from the loudest accusation and looking for a more useful post-episode format.",
    relevance: 0.82,
    urgency: 0.69,
    engagement: 0.67,
    freshness: 0.79,
    source_diversity: 0.28,
    source_ids: [podcastSources[1].id, podcastSources[2].id],
    status: "needs_review" as const,
  },
];

let currentBrief: PodcastBrief | null = null;
let currentScript: PodcastScriptWorkspace | null = null;
const podcastBriefs = new Map<string, PodcastBrief>();
const podcastScripts = new Map<string, PodcastScriptWorkspace>();

const podcastStatePath = join(process.cwd(), ".podcast-room-state.json");
type PersistedPodcastState = {
  briefs: PodcastBrief[];
  scripts: PodcastScriptWorkspace[];
  currentBriefId: string | null;
  currentScriptId: string | null;
};

function persistPodcastState() {
  const temporaryPath = `${podcastStatePath}.tmp`;
  writeFileSync(
    temporaryPath,
    JSON.stringify({
      briefs: [...podcastBriefs.values()],
      scripts: [...podcastScripts.values()],
      currentBriefId: currentBrief?.id ?? null,
      currentScriptId: currentScript?.id ?? null,
    } satisfies PersistedPodcastState),
    "utf8",
  );
  renameSync(temporaryPath, podcastStatePath);
}

/**
 * Restore the complete podcast workspace repository on process startup.
 * The status checks in the read/create functions remain the authorization
 * boundary, so persisted drafts and rejected artifacts cannot be opened.
 */
export function restorePodcastState() {
  if (!existsSync(podcastStatePath)) return;
  try {
    const saved = JSON.parse(readFileSync(podcastStatePath, "utf8")) as PersistedPodcastState;
    podcastBriefs.clear();
    podcastScripts.clear();
    for (const brief of saved.briefs ?? []) {
      if (brief?.id) podcastBriefs.set(brief.id, brief);
    }
    for (const script of saved.scripts ?? []) {
      if (script?.id) podcastScripts.set(script.id, script);
    }
    currentBrief = saved.currentBriefId ? podcastBriefs.get(saved.currentBriefId) ?? null : null;
    currentScript = saved.currentScriptId ? podcastScripts.get(saved.currentScriptId) ?? null : null;
  } catch {
    // A corrupt local state file must not prevent the API from booting.
  }
}

restorePodcastState();

type GeneratedPodcastDraft = Pick<
  PodcastBrief,
  | "topic_angle"
  | "audience_pain"
  | "why_now"
  | "key_tensions"
  | "risk_notes"
  | "episode_outline"
  | "suggested_title"
>;

function fixtureBrief(conceptId: string, sourceIds: string[]): PodcastBrief {
  return {
    id: `brief-${conceptId}`,
    concept_id: conceptId,
    selected_source_ids: sourceIds,
    status: "draft" as const,
    generated_mode: "fixture_fallback" as const,
    topic_angle:
      "The smartest recap is not a verdict on the cast. It is a reconstruction of what the edit makes visible, what it compresses, and what the audience is still trying to place.",
    audience_pain:
      "Viewers feel that the emotional stakes are obvious but the timeline is not. They want context without being pushed toward a pile-on.",
    why_now:
      `The same question is appearing across ${new Set(podcastSources.filter((source) => sourceIds.includes(source.id)).map((source) => source.community)).size} public communities within the current episode window, with high discussion velocity and a clear shift from reaction to context-seeking.`,
    key_tensions: [
      "Narrative clarity versus editorial compression",
      "A satisfying explanation versus unsupported certainty",
      "Audience curiosity versus targeting an individual",
    ],
    source_links: podcastSources.filter((source) => sourceIds.includes(source.id)).map((source) => ({
      source_id: source.id,
      url: source.source_url,
      label: `${source.community} · ${source.post_title}`,
      retrieved_at: source.retrieved_at,
    })),
    risk_notes: [
      "Do not quote comments verbatim or imply that a Reddit discussion represents the whole audience.",
      "Do not identify or speculate about a real person. Keep the analysis at edit, format, and audience-pattern level.",
      "Any script or audio rendering remains blocked until a human approves this brief.",
    ],
    episode_outline: [
      { segment: "Cold open", purpose: "Start with the audience's shared question: what did the edit ask us to assume?" },
      { segment: "The reconstruction", purpose: "Lay out the public-source pattern and distinguish repetition from independent concern." },
      { segment: "The editorial tension", purpose: "Explore why compression can create a strong feeling without a complete timeline." },
      { segment: "What a better recap does", purpose: "Offer a source-backed, non-targeting format for explaining uncertainty." },
      { segment: "Close", purpose: "Leave listeners with a question to watch for in the next cut." },
    ],
    suggested_title: "The Scene Between the Scenes",
    approval_note: "Draft only. Human approval is required before any script or audio rendering.",
  };
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function containsSourceText(value: string, sources: PodcastSource[]) {
  const normalized = value.trim().toLowerCase();
  return sources.some((source) => {
    const title = source.post_title.trim().toLowerCase();
    return title.length > 20 && normalized.includes(title);
  });
}

/**
 * Keep model output at summary level. A malformed response or text that repeats
 * source material is rejected field-by-field, leaving the known-safe fixture.
 */
export function buildSafePodcastDraft(
  parsed: unknown,
  fallback: GeneratedPodcastDraft,
  sources: PodcastSource[],
): GeneratedPodcastDraft {
  const candidate = parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
  const safeText = (value: unknown, fallbackValue: string) =>
    nonEmptyString(value) && !containsSourceText(value, sources) ? value : fallbackValue;
  const safeStringArray = (value: unknown, fallbackValue: string[]) =>
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => nonEmptyString(item) && !containsSourceText(item, sources))
      ? value
      : fallbackValue;
  const safeOutline = (value: unknown) =>
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        nonEmptyString((item as { segment?: unknown }).segment) &&
        nonEmptyString((item as { purpose?: unknown }).purpose) &&
        !containsSourceText((item as { segment: string }).segment, sources) &&
        !containsSourceText((item as { purpose: string }).purpose, sources),
    )
      ? value as PodcastBrief["episode_outline"]
      : fallback.episode_outline;

  return {
    topic_angle: safeText(candidate.topic_angle, fallback.topic_angle),
    audience_pain: safeText(candidate.audience_pain, fallback.audience_pain),
    why_now: safeText(candidate.why_now, fallback.why_now),
    key_tensions: safeStringArray(candidate.key_tensions, fallback.key_tensions),
    risk_notes: safeStringArray(candidate.risk_notes, fallback.risk_notes),
    episode_outline: safeOutline(candidate.episode_outline),
    suggested_title: safeText(candidate.suggested_title, fallback.suggested_title),
  };
}

export function getPodcastRoom() {
  return {
    sources: podcastSources,
    concepts: podcastConcepts,
    data_notice:
      "Public-source path only · summaries are pattern-level · comments are never copied verbatim · provenance is retained per item.",
    rendering_status: "blocked_until_approval" as const,
    selected_brief_id: currentBrief?.id ?? null,
  };
}

function fixtureScript(brief: PodcastBrief): PodcastScriptWorkspace {
  const sourceIds = brief.source_links.map((link) => link.source_id);
  return {
    id: `script-${brief.id}`,
    brief_id: brief.id,
    status: "draft",
    title: brief.suggested_title,
    sections: brief.episode_outline.map((item, index) => ({
      segment: item.segment,
      script:
        index === 0
          ? `Open with the shared question behind this episode: what does the edit make visible, and what does it leave for the audience to reconstruct?`
          : `${item.purpose} Frame this as a pattern across public discussions, not a claim about any individual. Name uncertainty where the source trail cannot resolve the timeline.`,
      source_ids: sourceIds,
    })),
    provenance: brief.source_links,
    safety_note:
      "Draft language summarizes recurring public patterns. It contains no verbatim Reddit comments, personal targeting, or unsupported audience-wide claims.",
    review_note:
      "Draft only. A separate human script review is required before any audio workflow.",
    audio_status: "blocked_until_script_approval",
  };
}

export function createPodcastScript(briefId: string) {
  const brief = podcastBriefs.get(briefId) ?? (currentBrief?.id === briefId ? currentBrief : null);
  if (!brief) return { kind: "not_found" as const };
  if (brief.status !== "approved") return { kind: "brief_not_approved" as const };
  currentBrief = brief;
  currentScript = podcastScripts.get(`script-${brief.id}`) ?? fixtureScript(brief);
  podcastScripts.set(currentScript.id, currentScript);
  persistPodcastState();
  return { kind: "created" as const, script: currentScript };
}

export function getPodcastScriptByBriefId(briefId: string) {
  const brief = podcastBriefs.get(briefId) ?? (currentBrief?.id === briefId ? currentBrief : null);
  if (!brief) return { kind: "not_found" as const };
  if (brief.status !== "approved") return { kind: "brief_not_approved" as const };
  const script = podcastScripts.get(`script-${brief.id}`);
  if (!script) return { kind: "not_found" as const };
  currentBrief = brief;
  currentScript = script;
  return { kind: "found" as const, script };
}

export function getPodcastScriptById(scriptId: string) {
  const script = podcastScripts.get(scriptId) ?? (currentScript?.id === scriptId ? currentScript : null);
  if (!script) return { kind: "not_found" as const };
  const brief = podcastBriefs.get(script.brief_id);
  if (!brief || brief.status !== "approved") return { kind: "brief_not_approved" as const };
  currentBrief = brief;
  currentScript = script;
  return { kind: "found" as const, script };
}

export function decidePodcastScript(id: string, decision: "approve" | "reject") {
  const script = podcastScripts.get(id) ?? (currentScript?.id === id ? currentScript : null);
  if (!script) return null;
  currentScript = {
    ...script,
    status: decision === "approve" ? "approved" : "rejected",
    review_note:
      decision === "approve"
        ? "Approved by a human script reviewer. Audio work remains a separate production decision."
        : "Rejected by a human script reviewer. No audio rendering or publishing is permitted.",
  };
  podcastScripts.set(currentScript.id, currentScript);
  persistPodcastState();
  return currentScript;
}

export function addPodcastSource(sourceUrl: string) {
  let parsed: URL;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    return null;
  }
  if (!["http:", "https:"].includes(parsed.protocol)) return null;

  const isReddit = parsed.hostname.endsWith("reddit.com");
  const communityMatch = parsed.pathname.match(/\/r\/([^/]+)/i);
  const source: PodcastSource = {
    id: `manual-${Date.now()}`,
    source_url: sourceUrl,
    platform: isReddit ? "Reddit" : "Public web",
    community: communityMatch ? `r/${communityMatch[1]}` : parsed.hostname,
    post_title: "Manually supplied source — retrieval pending",
    timestamp: now(),
    retrieved_at: now(),
    engagement: { score: 0, comments: 0 },
    source_id: null,
    access_mode: "manual_url" as const,
  };
  podcastSources.unshift(source);
  return getPodcastRoom();
}

export async function generatePodcastBrief(conceptId: string, requestedSourceIds: string[]) {
  const concept = podcastConcepts.find((item) => item.id === conceptId);
  if (!concept) return null;

  const sourceIds = concept.source_ids.filter((id) => requestedSourceIds.includes(id));
  const selectedSources = podcastSources.filter((source) => sourceIds.includes(source.id));
  const fallback = fixtureBrief(conceptId, sourceIds);
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model,
        contents: `You are a read-only podcast development editor. Create a JSON podcast brief from the supplied audience concept and source metadata. Do not quote comments verbatim, do not identify people, do not invent facts, and do not publish or render anything. Preserve the supplied source links. Return fields topic_angle, audience_pain, why_now, key_tensions, risk_notes, episode_outline, suggested_title.\n\nCONCEPT:\n${JSON.stringify(concept)}\n\nSELECTED SOURCES:\n${JSON.stringify(selectedSources)}`,
      config: { responseMimeType: "application/json" },
    });
    const parsed = JSON.parse(response.text ?? "{}");
    const safeDraft = buildSafePodcastDraft(parsed, fallback, selectedSources);
    currentBrief = {
      ...fallback,
      ...safeDraft,
      generated_mode: "gemini",
      source_links: fallback.source_links,
      status: "draft",
      approval_note: fallback.approval_note,
    };
    podcastBriefs.set(currentBrief.id, currentBrief);
    persistPodcastState();
    recordAgentStage("PODCAST-BRIEF", "draft", concept.title, response.text ?? "{}");
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown Gemini runtime error.";
    recordAgentStage("PODCAST-BRIEF", "draft", concept.title, `fallback: ${reason}`);
    currentBrief = fallback;
    podcastBriefs.set(currentBrief.id, currentBrief);
    persistPodcastState();
  }
  return currentBrief;
}

export function decidePodcastBrief(id: string, decision: "approve" | "reject") {
  if (!currentBrief || currentBrief.id !== id) return null;
  if (decision === "approve" && !isPodcastEvidenceSufficient(currentBrief)) {
    return {
      ...currentBrief,
      status: "draft" as const,
      approval_note:
        "Approval unavailable until evidence trail is sufficient.",
    };
  }
  currentBrief = {
    ...currentBrief,
    status: decision === "approve" ? "approved" : "rejected",
    approval_note:
      decision === "approve"
        ? "Approved by a human reviewer. Script and audio rendering may be considered in a later, separately gated workflow."
        : "Rejected by a human reviewer. No script or audio rendering is permitted from this brief.",
  };
  podcastBriefs.set(currentBrief.id, currentBrief);
  persistPodcastState();
  return currentBrief;
}

export function recordPodcastDecision(
  kind: "brief" | "script",
  id: string,
  decision: "approve" | "reject",
  reviewer: string,
) {
  recordHumanDecision(kind, id, decision, reviewer);
}

export function isPodcastEvidenceSufficient(brief: PodcastBrief) {
  if (!brief.source_links.length) return false;
  return brief.source_links.every((link) => {
    const source = podcastSources.find((item) => item.id === link.source_id);
    return Boolean(
      source &&
        source.access_mode !== "manual_url" &&
        !source.post_title.toLowerCase().includes("retrieval pending"),
    );
  });
}