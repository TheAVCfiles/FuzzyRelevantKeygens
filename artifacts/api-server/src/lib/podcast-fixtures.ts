import { GoogleGenAI } from "@google/genai";
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type {
  PodcastBrief,
  PodcastAudioClip,
  PodcastContextSearchResponse,
  PodcastFilterPreset,
  PodcastReleaseKit,
  PodcastScriptWorkspace,
  PodcastSource,
} from "@workspace/api-zod";

import { recordAgentStage, recordHumanDecision } from "./autography-fixtures";

const model = "gemini-3.6-flash";

const now = () => new Date().toISOString();

type PodcastWorkspaceWithCompatibility = PodcastScriptWorkspace & {
  compatibility_normalized: boolean;
};

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
  {
    id: "trade-fixture-001",
    source_url: "https://example.com/entertainment-trade/format-compression-and-audience-trust",
    platform: "Entertainment trade",
    community: "format reporting",
    post_title: "Format compression is becoming an audience-trust question",
    timestamp: "2026-08-21T16:00:00.000Z",
    retrieved_at: "2026-08-22T14:31:00.000Z",
    engagement: { score: 740, comments: 36 },
    source_id: "trade-format-001",
    access_mode: "fixture" as const,
    source_class: "trade_reporting",
    evidence_type: "supported_evidence",
  },
  {
    id: "interview-fixture-001",
    source_url: "https://example.com/editor-interview/what-never-makes-the-cut",
    platform: "Interview archive",
    community: "post-production",
    post_title: "Editors describe the context that rarely survives the final cut",
    timestamp: "2026-08-20T13:00:00.000Z",
    retrieved_at: "2026-08-22T14:32:00.000Z",
    engagement: { score: 510, comments: 18 },
    source_id: "interview-edit-001",
    access_mode: "fixture" as const,
    source_class: "verified_expertise",
    evidence_type: "supported_evidence",
  },
  {
    id: "ratings-fixture-001",
    source_url: "https://example.com/audience-lab/recap-retention-patterns",
    platform: "Audience research",
    community: "retention lab",
    post_title: "Context-led recaps show stronger completion than outrage-led summaries",
    timestamp: "2026-08-19T17:30:00.000Z",
    retrieved_at: "2026-08-22T14:33:00.000Z",
    engagement: { score: 430, comments: 12 },
    source_id: "research-retention-001",
    access_mode: "fixture" as const,
    source_class: "synthetic_audience_research",
    evidence_type: "directional_evidence",
  },
  {
    id: "festival-fixture-001",
    source_url: "https://example.com/festival-panel/unscripted-story-ethics",
    platform: "Festival panel",
    community: "unscripted development",
    post_title: "A development panel asks who gets to explain the missing scene",
    timestamp: "2026-08-18T12:00:00.000Z",
    retrieved_at: "2026-08-22T14:34:00.000Z",
    engagement: { score: 385, comments: 24 },
    source_id: "panel-ethics-001",
    access_mode: "fixture" as const,
    source_class: "subject_matter_commentary",
    evidence_type: "interpretation",
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
    observed_signal: "Three public communities are converging on the same editorial question within the current episode window.",
    supported_context: "The signal is about edit compression and missing timeline context; it does not establish intent, truth, or responsibility for any individual.",
    unresolved_questions: [
      "Which timeline details were compressed for format, and which remain unavailable?",
      "What context can be verified before a recap makes the uncertainty sound like a verdict?",
    ],
    recommended_route: "producer_review" as const,
    next_reviewer: "Producer / showrunner",
    confidence_label: "medium · directional",
    freshness_label: "fresh · current episode window",
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
    observed_signal: "Two communities are comparing recap fairness with the choices made in the cut.",
    supported_context: "The available sources support a format-level discussion of recap framing, not a claim about a cast member or production motive.",
    unresolved_questions: [
      "Can the episode timeline be reconstructed from verified production context?",
      "Which explanation would clarify the edit without rewarding certainty?",
    ],
    recommended_route: "publicity_clarification" as const,
    next_reviewer: "Publicity / media desk",
    confidence_label: "medium · cross-community pattern",
    freshness_label: "fresh · same episode window",
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
    observed_signal: "Discussion is shifting from outrage-shaped reaction toward requests for a calmer recap format.",
    supported_context: "The sources support an audience-format observation; they do not establish that the broader audience is tired of outrage.",
    unresolved_questions: [
      "Is the shift durable beyond these communities?",
      "Would an experienced recap editor or audience researcher add useful context?",
    ],
    recommended_route: "subject_matter_expert" as const,
    next_reviewer: "Verified audience-research or recap-format expert",
    confidence_label: "low · needs corroboration",
    freshness_label: "recent · limited source diversity",
    status: "needs_review" as const,
  },
  {
    id: "concept-format-trust",
    title: "The cutting-room context audiences now expect",
    summary:
      "Across community, trade, editorial, and research signals, audiences appear to value recaps that explain format choices and clearly name what remains unknowable.",
    relevance: 0.94,
    urgency: 0.83,
    engagement: 0.72,
    freshness: 0.88,
    source_diversity: 0.91,
    source_ids: ["reddit-fixture-001", "trade-fixture-001", "interview-fixture-001", "ratings-fixture-001"],
    observed_signal: "Multiple source classes are asking for format context instead of a louder cast verdict.",
    supported_context: "The evidence supports a discussion of editorial compression, recap design, and audience trust; it does not prove why any scene was cut.",
    unresolved_questions: [
      "Which missing details are format constraints, and which require a first-party clarification?",
      "Does the completion pattern hold outside the synthetic research sample?",
    ],
    recommended_route: "producer_review" as const,
    next_reviewer: "Executive producer / post-production lead",
    confidence_label: "medium-high · cross-source pattern",
    freshness_label: "current · multi-format window",
    status: "ready" as const,
  },
  {
    id: "concept-development-ethics",
    title: "Who should explain the scene that never aired?",
    summary:
      "A development opportunity is emerging around aftershows that separate verified production context, expert interpretation, and questions only participants can answer.",
    relevance: 0.86,
    urgency: 0.71,
    engagement: 0.63,
    freshness: 0.76,
    source_diversity: 0.77,
    source_ids: ["interview-fixture-001", "festival-fixture-001", "reddit-fixture-003"],
    observed_signal: "Editors, development voices, and recap listeners are converging on clearer ownership of explanation.",
    supported_context: "The sources support a format-development discussion, not disclosure of confidential production decisions.",
    unresolved_questions: [
      "Which role can clarify each gap without speaking for a participant?",
      "What context can be shared without exposing protected production material?",
    ],
    recommended_route: "subject_matter_expert" as const,
    next_reviewer: "Format executive / standards reviewer",
    confidence_label: "medium · needs first-party review",
    freshness_label: "recent · development cycle",
    status: "needs_review" as const,
  },
];

let currentBrief: PodcastBrief | null = null;
let currentScript: PodcastWorkspaceWithCompatibility | null = null;
const podcastBriefs = new Map<string, PodcastBrief>();
const podcastScripts = new Map<string, PodcastWorkspaceWithCompatibility>();
const podcastFilterPresets = new Map<string, PodcastFilterPreset>();

const podcastStatePath = join(process.cwd(), ".podcast-room-state.json");
type PodcastStorageHealth = "healthy" | "degraded";
let podcastStorageHealth: PodcastStorageHealth = "healthy";

type PersistedPodcastState = {
  briefs: PodcastBrief[];
  scripts: PodcastWorkspaceWithCompatibility[];
  filterPresets?: PodcastFilterPreset[];
  currentBriefId: string | null;
  currentScriptId: string | null;
};

type LegacyPersistedReleaseKit = {
  id: string;
  script_id: string;
  status: PodcastReleaseKit["status"];
  titles: string[];
  episode_description: string;
  chapters: PodcastReleaseKit["chapters"];
  host_notes: string[];
  promotion_drafts: PodcastReleaseKit["promotion_copy"];
  accessibility_notes: string[];
  provenance_summary: string;
  audio_status: PodcastReleaseKit["audio_status"];
  publishing_status: PodcastReleaseKit["publishing_status"];
  next_reviewer: string;
};

type PersistedScript = Omit<PodcastWorkspaceWithCompatibility, "release_kit"> & {
  release_kit?: PodcastReleaseKit | LegacyPersistedReleaseKit | null;
};

type PersistedPodcastStateInput = Omit<PersistedPodcastState, "scripts"> & {
  scripts?: PersistedScript[];
};

export function getPodcastStorageHealth() {
  return { status: podcastStorageHealth } as const;
}

function persistPodcastState(operation: string, artifactType: string) {
  const temporaryPath = `${podcastStatePath}.tmp`;
  try {
    writeFileSync(
      temporaryPath,
      JSON.stringify({
        briefs: [...podcastBriefs.values()],
        scripts: [...podcastScripts.values()],
        filterPresets: [...podcastFilterPresets.values()],
        currentBriefId: currentBrief?.id ?? null,
        currentScriptId: currentScript?.id ?? null,
      } satisfies PersistedPodcastState),
      "utf8",
    );
    renameSync(temporaryPath, podcastStatePath);
    podcastStorageHealth = "healthy";
    return true;
  } catch (error) {
    podcastStorageHealth = "degraded";
    console.error(
      "Podcast workspace persistence failed",
      {
        artifact_type: artifactType,
        operation,
        error: error instanceof Error ? error.message : String(error),
      },
    );
    try {
      if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
    } catch {
      // The original persistence error is the actionable failure.
    }
    return false;
  }
}

/**
 * Restore the complete podcast workspace repository on process startup.
 * The status checks in the read/create functions remain the authorization
 * boundary, so persisted drafts and rejected artifacts cannot be opened.
 */
export function restorePodcastState() {
  if (!existsSync(podcastStatePath)) return;
  try {
    rehydratePodcastState(JSON.parse(readFileSync(podcastStatePath, "utf8")));
  } catch {
    // A corrupt local state file must not prevent the API from booting.
  }
}

function normalizePersistedReleaseKit(
  releaseKit: PodcastReleaseKit | LegacyPersistedReleaseKit | null | undefined,
): PodcastReleaseKit | null {
  if (!releaseKit || typeof releaseKit !== "object") return null;
  const candidate = releaseKit as PodcastReleaseKit & {
    titles?: string[];
    promotion_drafts?: PodcastReleaseKit["promotion_copy"];
  };
  return {
    ...candidate,
    title_options: candidate.title_options ?? candidate.titles ?? [],
    promotion_copy: candidate.promotion_copy ?? candidate.promotion_drafts ?? [],
    audio_status: candidate.audio_status === ("blocked_until_final_approval" as PodcastReleaseKit["audio_status"])
      ? "awaiting_audio_approval"
      : candidate.audio_status,
  };
}

/**
 * Rehydrate both the current storage format and the previous release-kit format.
 * Keeping this boundary separate from file I/O lets compatibility fixtures test
 * upgrades without replacing the workspace's real state file.
 */
export function rehydratePodcastState(input: unknown) {
  if (!input || typeof input !== "object") return false;
  const saved = input as PersistedPodcastStateInput;
  if (!Array.isArray(saved.briefs) || !Array.isArray(saved.scripts)) return false;

  try {
    podcastBriefs.clear();
    podcastScripts.clear();
    podcastFilterPresets.clear();
    for (const brief of saved.briefs ?? []) {
      if (brief?.id) podcastBriefs.set(brief.id, brief);
    }
    for (const script of saved.scripts) {
      if (script?.id) {
        const releaseKit = script.release_kit;
        const requiredCompatibilityNormalization =
          Boolean(releaseKit && typeof releaseKit === "object" && ("titles" in releaseKit || "promotion_drafts" in releaseKit));
        podcastScripts.set(script.id, {
          ...script,
          compatibility_normalized: requiredCompatibilityNormalization,
          release_kit: normalizePersistedReleaseKit(releaseKit),
        });
      }
    }
    for (const preset of saved.filterPresets ?? []) {
      if (preset?.id) podcastFilterPresets.set(preset.id, preset);
    }
    currentBrief = saved.currentBriefId ? podcastBriefs.get(saved.currentBriefId) ?? null : null;
    currentScript = saved.currentScriptId ? podcastScripts.get(saved.currentScriptId) ?? null : null;
    return true;
  } catch {
    return false;
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
    filter_presets: [...podcastFilterPresets.values()],
    data_notice:
      "Public-source path only · summaries are pattern-level · comments are never copied verbatim · provenance is retained per item.",
    rendering_status: "blocked_until_approval" as const,
    selected_brief_id: currentBrief?.id ?? null,
  };
}

export function createPodcastFilterPreset(
  name: string,
  platforms: string[],
  communities: string[],
) {
  const preset: PodcastFilterPreset = {
    id: `preset-${Date.now()}`,
    name: name.trim(),
    platforms: [...new Set(platforms)],
    communities: [...new Set(communities)],
  };
  podcastFilterPresets.set(preset.id, preset);
  persistPodcastState("create", "filter_preset");
  return preset;
}

export function renamePodcastFilterPreset(id: string, name: string) {
  const preset = podcastFilterPresets.get(id);
  if (!preset) return null;
  const renamed = { ...preset, name: name.trim() };
  podcastFilterPresets.set(id, renamed);
  persistPodcastState("rename", "filter_preset");
  return renamed;
}

export function deletePodcastFilterPreset(id: string) {
  if (!podcastFilterPresets.delete(id)) return false;
  persistPodcastState("delete", "filter_preset");
  return true;
}

function fixtureScript(brief: PodcastBrief): PodcastWorkspaceWithCompatibility {
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
    audio_clip: null,
    compatibility_normalized: false,
    release_kit: null,
  };
}

function fixtureReleaseKit(script: PodcastWorkspaceWithCompatibility): PodcastReleaseKit {
  return {
    id: `release-kit-${script.id}`,
    script_id: script.id,
    status: "staged",
    title_options: [
      script.title,
      "The Scene Between the Scenes",
      "What the Edit Leaves Behind",
    ],
    episode_description:
      "A source-backed conversation about how editing shapes what audiences can reconstruct, and how to make room for uncertainty without turning curiosity into a verdict.",
    chapters: [
      { label: "The shared question", timing: "00:00–04:00", purpose: "Name the recurring audience gap without targeting a person." },
      { label: "What the sources support", timing: "04:00–13:00", purpose: "Separate repeated public patterns from claims the evidence cannot resolve." },
      { label: "The edit and the uncertainty", timing: "13:00–24:00", purpose: "Explore format-level explanations and the boundary of responsible recap." },
      { label: "A better way to clarify", timing: "24:00–30:00", purpose: "Offer a useful next question for producers, media teams, and listeners." },
    ],
    host_notes: [
      "Lead with the audience question, not the loudest accusation.",
      "Name the source window and confidence level before making an interpretive turn.",
      "Keep unresolved questions open; do not convert them into identity-sensitive claims.",
    ],
    promotion_copy: [
      { channel: "show notes", copy: "What happens when an edit leaves a timeline gap? We trace the question, the evidence, and the uncertainty." },
      { channel: "newsletter", copy: "A calmer recap starts by separating what viewers noticed from what the evidence can actually explain." },
      { channel: "social draft", copy: "New episode draft: the scene between the scenes — a source-backed look at editing, context, and better questions." },
    ],
    accessibility_notes: [
      "Publish a complete transcript with speaker labels and chapter timestamps.",
      "Describe editorial uncertainty in plain language rather than relying on tone or audio cues.",
      "Keep source links and the provenance summary available alongside the episode notes.",
    ],
    provenance_summary: `${script.provenance.length} retrieved public sources are attached to the approved script. The package summarizes patterns without reproducing user comments verbatim.`,
    audio_status: "awaiting_audio_approval",
    publishing_status: "blocked_until_final_approval",
    next_reviewer: "Final producer / publishing approver",
  };
}

const compatibilityBrief = fixtureBrief("concept-edit-context", podcastConcepts[0].source_ids);
const compatibilityScript = {
  ...fixtureScript(compatibilityBrief),
  status: "approved" as const,
  release_kit: fixtureReleaseKit({
    ...fixtureScript(compatibilityBrief),
    status: "approved" as const,
  }),
};

/**
 * Snapshot of the storage format written before release-kit field names were
 * aligned with the API contract. It intentionally omits newer optional fields.
 */
export const olderPersistedPodcastWorkspaceFixture: PersistedPodcastStateInput = {
  briefs: [{ ...compatibilityBrief, status: "approved" }],
  scripts: [
    {
      ...compatibilityScript,
      release_kit: {
        ...compatibilityScript.release_kit,
        titles: compatibilityScript.release_kit.title_options,
        promotion_drafts: compatibilityScript.release_kit.promotion_copy,
      },
    },
  ],
  currentBriefId: compatibilityBrief.id,
  currentScriptId: compatibilityScript.id,
};

/**
 * Older persisted workspaces can contain scripts for briefs that were never
 * approved. Keep both blocked statuses in one snapshot so API retrieval tests
 * exercise restoration rather than only the in-memory decision path.
 */
export const blockedLegacyPodcastWorkspaceFixture: PersistedPodcastStateInput = {
  briefs: (["draft", "rejected"] as const).map((status) => ({
    ...compatibilityBrief,
    id: `legacy-${status}-brief`,
    status,
  })),
  scripts: (["draft", "rejected"] as const).map((status) => ({
    ...compatibilityScript,
    id: `script-legacy-${status}-brief`,
    brief_id: `legacy-${status}-brief`,
    status,
    release_kit: {
      ...compatibilityScript.release_kit,
      titles: compatibilityScript.release_kit.title_options,
      promotion_drafts: compatibilityScript.release_kit.promotion_copy,
    },
  })),
  currentBriefId: "legacy-draft-brief",
  currentScriptId: "script-legacy-draft-brief",
};

export function createPodcastScript(briefId: string) {
  const brief = podcastBriefs.get(briefId) ?? (currentBrief?.id === briefId ? currentBrief : null);
  if (!brief) return { kind: "not_found" as const };
  if (brief.status !== "approved") return { kind: "brief_not_approved" as const };
  currentBrief = brief;
  const existing = podcastScripts.get(`script-${brief.id}`);
  const sameEvidence = existing &&
    existing.provenance.map((item) => item.source_id).join(",") === brief.source_links.map((item) => item.source_id).join(",");
  currentScript = sameEvidence ? existing : fixtureScript(brief);
  podcastScripts.set(currentScript.id, currentScript);
  persistPodcastState("create", "script_workspace");
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

export function isBlockedLegacyPodcastBrief(id: string) {
  const brief = podcastBriefs.get(id);
  const script = [...podcastScripts.values()].find((item) => item.brief_id === id);
  return Boolean(brief && brief.status !== "approved" && script?.compatibility_normalized);
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
  persistPodcastState("decision", "script_workspace");
  return currentScript;
}

export function createPodcastReleaseKit(scriptId: string) {
  const script = podcastScripts.get(scriptId) ?? (currentScript?.id === scriptId ? currentScript : null);
  if (!script) return { kind: "not_found" as const };
  if (script.status !== "approved") return { kind: "script_not_approved" as const };
  const releaseKit = script.release_kit ?? fixtureReleaseKit(script);
  currentScript = { ...script, release_kit: releaseKit, audio_status: "awaiting_audio_approval" };
  podcastScripts.set(currentScript.id, currentScript);
  persistPodcastState("create", "release_kit");
  return { kind: "created" as const, releaseKit };
}

export function searchPodcastContexts(
  query: string,
  audience: string,
  useCase: string,
  sourceClasses: string[] = [],
): PodcastContextSearchResponse {
  const terms = query.toLowerCase().split(/\W+/).filter((term) => term.length > 2);
  const allowedSources = podcastSources.filter(
    (source) => !sourceClasses.length || sourceClasses.includes(source.source_class ?? source.platform),
  );
  const scored = podcastConcepts.map((concept) => {
    const sources = concept.source_ids
      .map((id) => allowedSources.find((source) => source.id === id))
      .filter(Boolean) as PodcastSource[];
    const haystack = [
      concept.title,
      concept.summary,
      concept.observed_signal,
      concept.supported_context,
      ...sources.flatMap((source) => [source.platform, source.community, source.post_title, source.source_class ?? ""]),
    ].join(" ").toLowerCase();
    const termMatches = terms.filter((term) => haystack.includes(term)).length;
    const score = termMatches * 2 + concept.relevance + sources.length * 0.08;
    return { concept, sources, score, termMatches };
  }).filter((item) => item.sources.length > 0)
    .sort((a, b) => b.score - a.score);
  const selected = scored.some((item) => item.termMatches > 0)
    ? scored.filter((item) => item.termMatches > 0)
    : scored.slice(0, 3);
  return {
    query,
    audience,
    use_case: useCase,
    generated_at: now(),
    search_mode: "curated_synthetic_index",
    results: selected.map(({ concept, sources, termMatches }) => ({
      concept,
      sources,
      match_reason: termMatches
        ? `${termMatches} query signal${termMatches === 1 ? "" : "s"} matched across ${sources.length} cited sources for ${audience}.`
        : `Closest source-backed entertainment context for the ${useCase.replaceAll("_", " ")} use case.`,
      speculation: "Unresolved questions remain explicitly unverified and must not be presented as fact.",
      safest_next_reviewer: concept.next_reviewer,
    })),
  };
}

export function decidePodcastAudio(id: string, decision: "approve" | "reject") {
  const script = podcastScripts.get(id) ?? (currentScript?.id === id ? currentScript : null);
  if (!script) return { kind: "not_found" as const };
  if (script.status !== "approved" || !script.release_kit) return { kind: "not_ready" as const };
  const audioStatus = decision === "approve" ? "ready_to_generate" as const : "rejected" as const;
  const updated = {
    ...script,
    audio_status: audioStatus,
    release_kit: { ...script.release_kit, audio_status: audioStatus },
  };
  currentScript = updated;
  podcastScripts.set(id, updated);
  persistPodcastState("decision", "podcast_audio");
  return { kind: "updated" as const, script: updated };
}

const audioDirectory = join(process.cwd(), ".podcast-audio");
const ttsModel = "gemini-2.5-flash-preview-tts";

function pcmToWav(pcm: Buffer, sampleRate = 24000) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function clipTranscript(script: PodcastWorkspaceWithCompatibility) {
  return script.sections.map((section) => `${section.segment}. ${section.script}`).join(" ").slice(0, 1500);
}

export async function generatePodcastAudio(id: string) {
  const script = podcastScripts.get(id) ?? (currentScript?.id === id ? currentScript : null);
  if (!script) return { kind: "not_found" as const };
  if (script.audio_status !== "ready_to_generate" || !script.release_kit) return { kind: "not_approved" as const };
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { kind: "generation_failed" as const, error: "Audio service is not configured." };
  try {
    const transcript = clipTranscript(script);
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: ttsModel,
      contents: `Read this as a calm, premium entertainment-industry podcast host. Do not imitate or name any real person. Keep a measured pace and make uncertainty audible without sounding dramatic.\n\n${transcript}`,
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } },
      },
    });
    const data = response.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data)?.inlineData?.data;
    if (!data) throw new Error("The audio model returned no playable data.");
    const wav = pcmToWav(Buffer.from(data, "base64"));
    mkdirSync(audioDirectory, { recursive: true });
    const clipId = `clip-${script.id}`;
    writeFileSync(join(audioDirectory, `${clipId}.wav`), wav);
    const clip: PodcastAudioClip = {
      id: clipId,
      script_id: script.id,
      status: "ready",
      audio_url: `/api/podcast/audio/${clipId}/stream`,
      mime_type: "audio/wav",
      duration_seconds: Math.round((wav.length - 44) / (24000 * 2)),
      transcript,
      voice_disclosure: "Synthetic house narration · Gemini Kore voice · no voice cloning or impersonation",
      format_disclosure: "Short evidence-backed development clip · not published",
      source_ids: [...new Set(script.provenance.map((source) => source.source_id))],
      provenance_summary: script.release_kit.provenance_summary,
      generated_at: now(),
    };
    const updated = {
      ...script,
      audio_status: "generated" as const,
      audio_clip: clip,
      release_kit: { ...script.release_kit, audio_status: "generated" as const },
    };
    currentScript = updated;
    podcastScripts.set(id, updated);
    persistPodcastState("generate", "podcast_audio");
    recordAgentStage("PODCAST-AUDIO", "render", script.id, `${clip.id} · ${clip.duration_seconds}s · ${clip.source_ids.length} sources`);
    return { kind: "generated" as const, clip };
  } catch (error) {
    return { kind: "generation_failed" as const, error: error instanceof Error ? error.message : "Audio generation failed." };
  }
}

export function getPodcastAudioByScript(id: string) {
  const script = podcastScripts.get(id) ?? (currentScript?.id === id ? currentScript : null);
  return script?.audio_clip ?? null;
}

export function getPodcastAudioPath(clipId: string) {
  if (!/^clip-[a-zA-Z0-9_-]+$/.test(clipId)) return null;
  const filePath = join(audioDirectory, `${clipId}.wav`);
  return existsSync(filePath) ? filePath : null;
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
    persistPodcastState("create", "podcast_brief");
    recordAgentStage("PODCAST-BRIEF", "draft", concept.title, response.text ?? "{}");
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown Gemini runtime error.";
    recordAgentStage("PODCAST-BRIEF", "draft", concept.title, `fallback: ${reason}`);
    currentBrief = fallback;
    podcastBriefs.set(currentBrief.id, currentBrief);
    persistPodcastState("create", "podcast_brief");
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
  persistPodcastState("decision", "podcast_brief");
  return currentBrief;
}

export function recordPodcastDecision(
  kind: "brief" | "script" | "audio",
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