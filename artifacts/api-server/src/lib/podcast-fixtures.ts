import { GoogleGenAI } from "@google/genai";
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type {
  PodcastArchetype,
  PodcastBrief,
  PodcastAudioClip,
  PodcastContextSearchResponse,
  PodcastDevelopmentPlan,
  PodcastFilterPreset,
  PodcastFormatVariant,
  PodcastLiveSnapshot,
  PodcastReleaseKit,
  PodcastScriptWorkspace,
  PodcastSource,
} from "@workspace/api-zod";

import { getLiveObservationSnapshot, recordAgentStage, recordHumanDecision } from "./autography-fixtures";

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

export const podcastArchetypes: PodcastArchetype[] = [
  {
    id: "investigative-decoder",
    label: "Investigative decoder",
    point_of_view: "Reconstruct what the evidence establishes, what the edit compresses, and what remains unresolved.",
    delivery_guidance: "Precise, curious, and paced around evidence turns rather than accusation.",
    audience_fit: "Listeners who value reported context, chronology, and transparent uncertainty.",
    non_impersonation_disclosure: "Fictional editorial lens only · never based on or performed as a real person.",
  },
  {
    id: "warm-interviewer",
    label: "Warm interviewer",
    point_of_view: "Turn the evidence gap into humane questions that a responsible guest could answer without being cornered.",
    delivery_guidance: "Inviting and clear, with room for pauses, context, and first-party boundaries.",
    audience_fit: "Listeners who stay for emotional clarity and thoughtful conversation.",
    non_impersonation_disclosure: "Fictional editorial lens only · house narration does not clone or imitate a host.",
  },
  {
    id: "culture-critic",
    label: "Culture critic",
    point_of_view: "Connect the immediate signal to broader entertainment formats and audience expectations.",
    delivery_guidance: "Analytical and vivid while distinguishing documented pattern from interpretation.",
    audience_fit: "Listeners interested in media literacy, format choices, and cultural context.",
    non_impersonation_disclosure: "Fictional editorial lens only · no living writer, critic, or performer is imitated.",
  },
  {
    id: "comic-improviser",
    label: "Comic improviser",
    point_of_view: "Use playful format observations to make uncertainty listenable without making a person the punchline.",
    delivery_guidance: "Quick, warm, and self-aware; humor targets the format problem, never an individual.",
    audience_fit: "Listeners who prefer energetic recaps with a clear ethical boundary.",
    non_impersonation_disclosure: "Fictional editorial lens only · no comedian, actor, or public figure is imitated.",
  },
];

let currentBrief: PodcastBrief | null = null;
let currentScript: PodcastWorkspaceWithCompatibility | null = null;
const podcastBriefs = new Map<string, PodcastBrief>();
const podcastScripts = new Map<string, PodcastWorkspaceWithCompatibility>();
const podcastFilterPresets = new Map<string, PodcastFilterPreset>();
const podcastDevelopmentPlans = new Map<string, PodcastDevelopmentPlan>();

const podcastStatePath = join(process.cwd(), ".podcast-room-state.json");
type PodcastStorageHealth = "healthy" | "degraded";
let podcastStorageHealth: PodcastStorageHealth = "healthy";

type PersistedPodcastState = {
  briefs: PodcastBrief[];
  scripts: PodcastWorkspaceWithCompatibility[];
  filterPresets?: PodcastFilterPreset[];
  developmentPlans?: PodcastDevelopmentPlan[];
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
        developmentPlans: [...podcastDevelopmentPlans.values()],
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
    podcastDevelopmentPlans.clear();
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
    for (const plan of saved.developmentPlans ?? []) {
      if (plan?.id) podcastDevelopmentPlans.set(plan.id, plan);
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

export function getPodcastLiveSnapshot(): PodcastLiveSnapshot {
  const live = getLiveObservationSnapshot();
  const refreshedAt = now();
  if (live) {
    const ageMinutes = Math.max(0, Math.round((Date.now() - new Date(live.received_at).getTime()) / 60_000));
    return {
      source_mode: "approved_live",
      source_status: "active · approved consented source",
      source_id: live.source_id,
      source_class: live.source_class,
      consent_reference: live.consent_ref,
      policy_review_reference: live.policy_review_ref,
      freshness: `${ageMinutes}m since receipt`,
      refreshed_at: refreshedAt,
      observation_window: live.observation_window,
      aggregate_observations: live.observation_count,
      signal_label: "live observation · aggregate-only",
      data_notice: "Approved live newsroom observations are grouped and de-amplified. Identity fields and raw comments are not available to the Podcast Room.",
    };
  }
  const starts = podcastSources.map((source) => source.timestamp).sort()[0] ?? refreshedAt;
  const ends = podcastSources.map((source) => source.retrieved_at).sort().at(-1) ?? refreshedAt;
  return {
    source_mode: "synthetic_fixture",
    source_status: "fixture fallback · no approved live batch available",
    source_id: "podcast-curated-fixture-v1",
    source_class: "synthetic_entertainment_index",
    consent_reference: null,
    policy_review_reference: null,
    freshness: "fixed demonstration window",
    refreshed_at: refreshedAt,
    observation_window: { start: starts, end: ends },
    aggregate_observations: podcastSources.length,
    signal_label: "synthetic fixture · not a live audience measurement",
    data_notice: "This fallback is synthetic and curated. It does not represent current public opinion, platform-wide behavior, or a popularity forecast.",
  };
}

function percent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value <= 1 ? value * 100 : value)));
}

function methodologyFactors(
  concept: (typeof podcastConcepts)[number],
  sourceIds: string[],
  format: PodcastFormatVariant["format"],
) {
  const selectedSources = podcastSources.filter((source) => sourceIds.includes(source.id));
  const retrieved = selectedSources.filter((source) => source.access_mode !== "manual_url").length;
  const sourceClasses = new Set(selectedSources.map((source) => source.source_class ?? source.platform));
  const formatBoost: Record<PodcastFormatVariant["format"], { clarity: number; pacing: number; title: number }> = {
    cold_open_explainer: { clarity: 86, pacing: 91, title: 88 },
    reported_explainer: { clarity: 93, pacing: 76, title: 81 },
    structured_debate: { clarity: 78, pacing: 87, title: 84 },
    context_recap: { clarity: 89, pacing: 82, title: 79 },
    listener_question: { clarity: 84, pacing: 88, title: 86 },
  };
  const boost = formatBoost[format];
  return [
    { id: "audience-fit", label: "Audience fit", score: percent(concept.relevance), evidence: `${concept.confidence_label}; tailored to the selected audience and use case.`, uncertainty: "Fit is an editorial hypothesis until a controlled listening test is run." },
    { id: "clarity", label: "Narrative clarity", score: boost.clarity, evidence: "The segment spine separates observation, supported context, interpretation, and unresolved questions.", uncertainty: "A script read-through is still needed to test comprehension." },
    { id: "novelty", label: "Novelty", score: Math.round((percent(concept.relevance) + percent(concept.source_diversity)) / 2), evidence: `${sourceClasses.size} source classes support a format-level angle beyond raw reaction.`, uncertainty: "Novelty is relative to this bounded source set, not the whole market." },
    { id: "tension", label: "Constructive tension", score: percent((concept.urgency + concept.engagement) / 2), evidence: concept.unresolved_questions[0] ?? "An unresolved editorial question remains visible.", uncertainty: "Tension must not be converted into unsupported certainty or targeting." },
    { id: "source-diversity", label: "Source diversity", score: Math.min(100, Math.round((sourceClasses.size / Math.max(1, selectedSources.length)) * 100)), evidence: `${sourceClasses.size} distinct source classes across ${selectedSources.length} selected sources.`, uncertainty: `${retrieved} of ${selectedSources.length} selected sources are retrieval-complete.` },
    { id: "freshness", label: "Freshness", score: percent(concept.freshness), evidence: concept.freshness_label, uncertainty: "Freshness describes the recorded observation window, not continuing audience momentum." },
    { id: "pacing", label: "Pacing hypothesis", score: boost.pacing, evidence: "The proposed sequence alternates evidence, interpretation, and an open question.", uncertainty: "Pacing requires a timed table read or audio preview." },
    { id: "title-promise", label: "Title promise", score: boost.title, evidence: "The title states a specific editorial question the cited segment spine can answer.", uncertainty: "Click and completion behavior cannot be inferred from a title alone." },
  ];
}

function makeVariant(
  concept: (typeof podcastConcepts)[number],
  sourceIds: string[],
  format: PodcastFormatVariant["format"],
  title: string,
  premise: string,
  openingBeat: string,
  tradeoff: string,
): PodcastFormatVariant {
  const factors = methodologyFactors(concept, sourceIds, format);
  return {
    id: `${format}-${concept.id}`,
    title,
    format,
    premise,
    opening_beat: openingBeat,
    segment_spine: [
      { label: "Open", purpose: openingBeat, source_ids: sourceIds },
      { label: "Evidence turn", purpose: concept.supported_context, source_ids: sourceIds },
      { label: "Unresolved turn", purpose: concept.unresolved_questions[0] ?? "Name what the available evidence cannot resolve.", source_ids: sourceIds },
      { label: "Close", purpose: "Offer one answerable next question and state the limits of the forecast.", source_ids: sourceIds },
    ],
    citation_ids: sourceIds,
    methodology_factors: factors,
    hypotheses: [
      { metric: "listen-through", statement: "A clear evidence turn may reduce early confusion and improve completion in a controlled comparison.", validation_method: "Compare aggregate 25%, 50%, and 90% completion across matched pilot variants." },
      { metric: "subscription intent", statement: "A repeatable source-backed format may increase stated intent to hear the next episode.", validation_method: "Use an aggregate post-listen intent question; do not identify or retarget respondents." },
    ],
    risks: [
      "A strong premise can overstate a directional signal if the uncertainty language is removed.",
      "Forecast factors are hypotheses, not promises of popularity, conversion, or platform ranking.",
    ],
    tradeoff,
    forecast_label: "Testable editorial hypothesis · not a popularity guarantee",
  };
}

export function createPodcastDevelopment(
  conceptId: string,
  requestedSourceIds: string[],
  audience: string,
  useCase: string,
) {
  const concept = podcastConcepts.find((item) => item.id === conceptId);
  if (!concept) return null;
  const sourceIds = concept.source_ids.filter((id) => requestedSourceIds.includes(id));
  if (!sourceIds.length) return null;
  const snapshot = getPodcastLiveSnapshot();
  const variants = [
    makeVariant(concept, sourceIds, "cold_open_explainer", "The question before the answer", "Lead with the missing piece, then earn the explanation through cited context.", "Open on the shared question, then reveal which part the evidence can actually answer.", "Fastest hook, but the opening must not imply the unresolved point is already proven."),
    makeVariant(concept, sourceIds, "reported_explainer", "What the record can support", "Build a compact reported explainer around chronology, source classes, and the limits of the available record.", "Begin with two facts from different source classes and the gap between them.", "Highest clarity, with less room for spontaneous host chemistry."),
    makeVariant(concept, sourceIds, "structured_debate", "Certainty versus context", "Stage the strongest responsible interpretations against the evidence boundary without manufacturing conflict.", "State two plausible format readings, then disclose what neither can prove.", "Creates tension, but requires disciplined moderation to avoid false equivalence."),
    makeVariant(concept, sourceIds, "context_recap", "The scene between the scenes", "Recap the episode through editorial choices and audience questions rather than a verdict about a person.", "Start at the edit point that made chronology difficult to follow.", "Familiar and accessible, but can feel conventional without a sharp evidence turn."),
    makeVariant(concept, sourceIds, "listener_question", "The question the cut leaves open", "Use a grouped, answerable audience question as the recurring structure for a concise episode.", "Ask the safest unresolved question and explain why it is answerable only in part.", "Inviting and repeatable, but must not imply a small observed group represents all listeners."),
  ];
  const factorScores = Object.fromEntries(
    variants[0].methodology_factors.map((factor) => [factor.id, factor.score]),
  );
  const id = `development-${concept.id}-${Date.now()}`;
  const plan: PodcastDevelopmentPlan = {
    id,
    concept_id: concept.id,
    source_ids: sourceIds,
    audience,
    use_case: useCase,
    source_snapshot: snapshot,
    archetypes: podcastArchetypes,
    format_variants: variants,
    methodology_note: "Scores expose the evidence and assumptions behind each editorial hypothesis. They rank neither people nor public opinion and cannot guarantee popularity, retention, subscriptions, revenue, or platform placement.",
    measurement_record: {
      id: `measurement-${id}`,
      recorded_at: now(),
      concept_id: concept.id,
      source_ids: sourceIds,
      source_mode: snapshot.source_mode,
      archetype_id: null,
      format_id: null,
      factor_scores: factorScores,
      validation_status: "pending",
      validation_note: "Awaiting a human format decision. Future validation must use aggregate listening or approved outcome data.",
    },
    status: "draft",
    selected_archetype_id: null,
    selected_format_id: null,
    decision_note: "Draft only. A human producer must select and validate one fictional editorial lens and one format before brief generation.",
  };
  podcastDevelopmentPlans.set(id, plan);
  persistPodcastState("create", "podcast_development");
  recordAgentStage("PODCAST-DEVELOPMENT", "draft", concept.title, `${variants.length} cited variants · ${snapshot.source_mode}`);
  return plan;
}

export function recordPodcastDevelopmentValidation(
  id: string,
  decision: "validate" | "reject",
  archetypeId: string,
  formatId: string,
  reviewer: string,
) {
  const plan = podcastDevelopmentPlans.get(id);
  if (!plan) return null;
  const archetype = plan.archetypes.find((item) => item.id === archetypeId);
  const format = plan.format_variants.find((item) => item.id === formatId);
  if (!archetype || !format) return null;
  const status = decision === "validate" ? "validated" as const : "rejected" as const;
  const updated: PodcastDevelopmentPlan = {
    ...plan,
    status,
    selected_archetype_id: archetype.id,
    selected_format_id: format.id,
    decision_note: decision === "validate"
      ? "Validated by a human producer as a development hypothesis. Brief, script, release, audio, and publishing gates remain separate."
      : "Rejected by a human producer. No brief may be generated from this plan.",
    measurement_record: {
      ...plan.measurement_record,
      archetype_id: archetype.id,
      format_id: format.id,
      factor_scores: Object.fromEntries(format.methodology_factors.map((factor) => [factor.id, factor.score])),
      validation_status: status,
      validation_note: decision === "validate"
        ? "Human-selected hypothesis recorded for controlled listening validation."
        : "Human rejected this hypothesis before brief generation.",
    },
  };
  podcastDevelopmentPlans.set(id, updated);
  if (!persistPodcastState("decision", "podcast_development")) {
    podcastDevelopmentPlans.set(id, plan);
    return false;
  }
  recordHumanDecision("development", id, decision, reviewer);
  return updated;
}

export function getPodcastDevelopmentPlan(id: string) {
  return podcastDevelopmentPlans.get(id) ?? null;
}

export function isPodcastDevelopmentReady(id: string, conceptId: string, sourceIds: string[]) {
  const plan = podcastDevelopmentPlans.get(id);
  if (
    !plan ||
    plan.status !== "validated" ||
    !plan.selected_archetype_id ||
    !plan.selected_format_id ||
    plan.concept_id !== conceptId
  ) return false;
  const planned = [...new Set(plan.source_ids)].sort();
  const requested = [...new Set(sourceIds)].sort();
  return planned.length === requested.length && planned.every((sourceId, index) => sourceId === requested[index]);
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

export async function generatePodcastBrief(
  conceptId: string,
  requestedSourceIds: string[],
  developmentPlanId?: string,
) {
  const concept = podcastConcepts.find((item) => item.id === conceptId);
  if (!concept) return null;

  const sourceIds = concept.source_ids.filter((id) => requestedSourceIds.includes(id));
  const selectedSources = podcastSources.filter((source) => sourceIds.includes(source.id));
  const fallback = fixtureBrief(conceptId, sourceIds);
  const developmentPlan = developmentPlanId ? getPodcastDevelopmentPlan(developmentPlanId) : null;
  const selectedArchetype = developmentPlan?.archetypes.find(
    (item) => item.id === developmentPlan.selected_archetype_id,
  );
  const selectedFormat = developmentPlan?.format_variants.find(
    (item) => item.id === developmentPlan.selected_format_id,
  );
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model,
        contents: `You are a read-only podcast development editor. Create a JSON podcast brief from the supplied audience concept, source metadata, fictional editorial lens, and format hypothesis. Do not quote comments verbatim, identify people, imitate a real person's style, invent facts, guarantee popularity, or publish or render anything. Preserve the supplied source links. Return fields topic_angle, audience_pain, why_now, key_tensions, risk_notes, episode_outline, suggested_title.\n\nCONCEPT:\n${JSON.stringify(concept)}\n\nSELECTED SOURCES:\n${JSON.stringify(selectedSources)}\n\nFICTIONAL EDITORIAL LENS:\n${JSON.stringify(selectedArchetype ?? null)}\n\nFORMAT HYPOTHESIS:\n${JSON.stringify(selectedFormat ?? null)}`,
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
      development_plan_id: developmentPlan?.id,
      editorial_archetype: selectedArchetype,
      selected_format: selectedFormat,
      methodology_summary: developmentPlan?.methodology_note,
    };
    podcastBriefs.set(currentBrief.id, currentBrief);
    persistPodcastState("create", "podcast_brief");
    recordAgentStage("PODCAST-BRIEF", "draft", concept.title, response.text ?? "{}");
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown Gemini runtime error.";
    recordAgentStage("PODCAST-BRIEF", "draft", concept.title, `fallback: ${reason}`);
    currentBrief = {
      ...fallback,
      development_plan_id: developmentPlan?.id,
      editorial_archetype: selectedArchetype,
      selected_format: selectedFormat,
      methodology_summary: developmentPlan?.methodology_note,
    };
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