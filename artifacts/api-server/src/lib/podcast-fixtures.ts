import { GoogleGenAI } from "@google/genai";
import type { PodcastBrief, PodcastSource } from "@workspace/api-zod";

import { recordAgentStage } from "./autography-fixtures";

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
    source_ids: [podcastSources[1].id, podcastSources[2].id],
    status: "needs_review" as const,
  },
];

let currentBrief: PodcastBrief | null = null;

function fixtureBrief(conceptId: string): PodcastBrief {
  return {
    id: `brief-${conceptId}`,
    concept_id: conceptId,
    status: "draft" as const,
    generated_mode: "fixture_fallback" as const,
    topic_angle:
      "The smartest recap is not a verdict on the cast. It is a reconstruction of what the edit makes visible, what it compresses, and what the audience is still trying to place.",
    audience_pain:
      "Viewers feel that the emotional stakes are obvious but the timeline is not. They want context without being pushed toward a pile-on.",
    why_now:
      "The same question is appearing across three public communities within the current episode window, with high discussion velocity and a clear shift from reaction to context-seeking.",
    key_tensions: [
      "Narrative clarity versus editorial compression",
      "A satisfying explanation versus unsupported certainty",
      "Audience curiosity versus targeting an individual",
    ],
    source_links: podcastSources.map((source) => ({
      source_id: source.id,
      url: source.source_url,
      label: `${source.community} · ${source.post_title}`,
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

export async function generatePodcastBrief(conceptId: string) {
  const concept = podcastConcepts.find((item) => item.id === conceptId);
  if (!concept) return null;

  const fallback = fixtureBrief(conceptId);
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model,
      contents: `You are a read-only podcast development editor. Create a JSON podcast brief from the supplied audience concept and source metadata. Do not quote comments verbatim, do not identify people, do not invent facts, and do not publish or render anything. Preserve the supplied source links. Return fields topic_angle, audience_pain, why_now, key_tensions, risk_notes, episode_outline, suggested_title.\n\nCONCEPT:\n${JSON.stringify(concept)}\n\nSOURCES:\n${JSON.stringify(podcastSources)}`,
      config: { responseMimeType: "application/json" },
    });
    const parsed = JSON.parse(response.text ?? "{}");
    const safeDraft = {
      topic_angle:
        typeof parsed.topic_angle === "string"
          ? parsed.topic_angle
          : fallback.topic_angle,
      audience_pain:
        typeof parsed.audience_pain === "string"
          ? parsed.audience_pain
          : fallback.audience_pain,
      why_now:
        typeof parsed.why_now === "string" ? parsed.why_now : fallback.why_now,
      key_tensions:
        Array.isArray(parsed.key_tensions) &&
        parsed.key_tensions.every((item: unknown) => typeof item === "string")
          ? parsed.key_tensions
          : fallback.key_tensions,
      risk_notes:
        Array.isArray(parsed.risk_notes) &&
        parsed.risk_notes.every((item: unknown) => typeof item === "string")
          ? parsed.risk_notes
          : fallback.risk_notes,
      episode_outline:
        Array.isArray(parsed.episode_outline) &&
        parsed.episode_outline.every(
          (item: unknown) =>
            typeof item === "object" &&
            item !== null &&
            typeof (item as { segment?: unknown }).segment === "string" &&
            typeof (item as { purpose?: unknown }).purpose === "string",
        )
          ? parsed.episode_outline
          : fallback.episode_outline,
      suggested_title:
        typeof parsed.suggested_title === "string"
          ? parsed.suggested_title
          : fallback.suggested_title,
    };
    currentBrief = {
      ...fallback,
      ...safeDraft,
      generated_mode: "gemini",
      source_links: fallback.source_links,
      status: "draft",
      approval_note: fallback.approval_note,
    };
    recordAgentStage("PODCAST-BRIEF", "draft", concept.title, response.text ?? "{}");
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown Gemini runtime error.";
    recordAgentStage("PODCAST-BRIEF", "draft", concept.title, `fallback: ${reason}`);
    currentBrief = fallback;
  }
  return currentBrief;
}

export function decidePodcastBrief(id: string, decision: "approve" | "reject") {
  if (!currentBrief || currentBrief.id !== id) return null;
  currentBrief = {
    ...currentBrief,
    status: decision === "approve" ? "approved" : "rejected",
    approval_note:
      decision === "approve"
        ? "Approved by a human reviewer. Script and audio rendering may be considered in a later, separately gated workflow."
        : "Rejected by a human reviewer. No script or audio rendering is permitted from this brief.",
  };
  return currentBrief;
}