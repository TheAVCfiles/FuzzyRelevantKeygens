import { GoogleGenAI } from "@google/genai";
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { isIP } from "node:net";
import { join } from "node:path";
import type {
  PodcastArchetype,
  PodcastBrief,
  PodcastAudioClip,
  PodcastContextSearchResponse,
  PodcastConcept,
  PodcastCutKey,
  PodcastCuttingRoomAttestation,
  PodcastGroundedRun,
  PodcastDevelopmentPlan,
  PodcastFilterPreset,
  PodcastFormatVariant,
  PodcastGroundingSource,
  PodcastLiveSnapshot,
  PodcastReleaseKit,
  PodcastScriptWorkspace,
  PodcastSource,
} from "@workspace/api-zod";

import {
  getLiveObservationSnapshot,
  getPodcastDecisionHistory,
  recordAgentStage,
  recordHumanDecision,
} from "./autography-fixtures";
import { logger } from "./logger";
import {
  getPodcastAudioFile,
  loadPodcastStateFromDatabase,
  migrateLocalPodcastAudio,
  savePodcastStateToDatabase,
  uploadPodcastAudio,
} from "./podcast-persistence";
import {
  podcastAdkFramework,
  podcastAdkTools,
  runPodcastAdkResearch,
} from "./podcast-adk-research";

const model = "gemini-3.6-flash";
const currentContextPolicyReference = "podcast-current-context-policy-v1";
const publicWebConsentReference = "public-web-metadata-only-v1";

const now = () => new Date().toISOString();

type PodcastWorkspaceWithCompatibility = PodcastScriptWorkspace & {
  compatibility_normalized: boolean;
  workspace_revision?: string;
  claim_support_verified?: boolean;
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
const activeGroundedSources: PodcastSource[] = [];
const activeGroundedConcepts: PodcastConcept[] = [];
const syntheticDemoEnabled = () => process.env.PODCAST_SYNTHETIC_DEMO === "true";
const allPodcastSources = () => syntheticDemoEnabled() ? [...activeGroundedSources, ...podcastSources] : [...activeGroundedSources];
const allPodcastConcepts = () => syntheticDemoEnabled() ? [...activeGroundedConcepts, ...podcastConcepts] : [...activeGroundedConcepts];

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

type OwnedPodcastFilterPreset = PodcastFilterPreset & { owner_id: string | null };
type PodcastAuthorityRecordType = "SCRIPT_APPROVED" | "AUDIO_RENDER_AUTHORIZED";
type PodcastApprovalReceipt = {
  stage: "development" | "brief" | "script" | "audio";
  reviewer: string;
  decided_at: string;
  artifact_sha256?: string;
  parent_execution_id?: string;
  authority_record_type?: PodcastAuthorityRecordType;
  receipt_id?: string;
  reviewer_reference?: string;
  source_run_id?: string;
  policy_version?: string;
};
const podcastFilterPresets = new Map<string, OwnedPodcastFilterPreset>();
const podcastDevelopmentPlans = new Map<string, PodcastDevelopmentPlan>();
const podcastGroundedRuns = new Map<string, PodcastGroundedRun>();
const podcastAttestations = new Map<string, PodcastCuttingRoomAttestation & { raw_text?: string }>();
const podcastCutKeys = new Map<string, PodcastCutKey>();
const podcastAudioAssets = new Map<string, string>();
const podcastApprovalReceipts = new Map<string, PodcastApprovalReceipt>();
const podcastExecutionRecords = new Map<string, PodcastGroundedRun["agent_executions"][number]>();

const podcastStatePath = process.env.PODCAST_STATE_PATH ?? join(process.cwd(), ".podcast-room-state.json");
const audioDirectory = process.env.PODCAST_AUDIO_DIRECTORY ?? join(process.cwd(), ".podcast-audio");
type PodcastStorageHealth = "healthy" | "degraded";
let podcastStorageHealth: PodcastStorageHealth = "healthy";
let podcastPersistenceQueue: Promise<void> = Promise.resolve();
let podcastPersistenceRevision: number | null = null;
let podcastMutationLock: Promise<void> = Promise.resolve();
let podcastMutationActive = false;
let stagedPodcastState: PersistedPodcastState | null = null;
const podcastLockContext = new AsyncLocalStorage<PodcastMutationLock>();

export type PodcastMutationLock = {
  release: () => void;
  yieldForExternalWork: <T>(work: () => Promise<T>) => Promise<T>;
};

type PersistedPodcastState = {
  briefs: PodcastBrief[];
  scripts: PodcastWorkspaceWithCompatibility[];
  filterPresets?: OwnedPodcastFilterPreset[];
  developmentPlans?: PodcastDevelopmentPlan[];
  currentBriefId: string | null;
  currentScriptId: string | null;
  groundedRuns?: PodcastGroundedRun[];
  attestations?: (PodcastCuttingRoomAttestation & { raw_text?: string })[];
  cutKeys?: PodcastCutKey[];
  audioAssets?: { clipId: string; sha256: string }[];
  approvalReceipts?: { key: string; receipt: PodcastApprovalReceipt }[];
  executionRecords?: { key: string; execution: PodcastGroundedRun["agent_executions"][number] }[];
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

function serializedPodcastState(): PersistedPodcastState {
  return {
    briefs: [...podcastBriefs.values()],
    scripts: [...podcastScripts.values()],
    filterPresets: [...podcastFilterPresets.values()],
    developmentPlans: [...podcastDevelopmentPlans.values()],
    currentBriefId: currentBrief?.id ?? null,
    currentScriptId: currentScript?.id ?? null,
    groundedRuns: [...podcastGroundedRuns.values()],
    attestations: [...podcastAttestations.values()],
    cutKeys: [...podcastCutKeys.values()],
    audioAssets: [...podcastAudioAssets.entries()].map(([clipId, sha256]) => ({ clipId, sha256 })),
    approvalReceipts: [...podcastApprovalReceipts.entries()].map(([key, receipt]) => ({ key, receipt })),
    executionRecords: [...podcastExecutionRecords.entries()].map(([key, execution]) => ({ key, execution })),
  };
}

function enqueuePodcastPersistence(work: () => Promise<void>, operation: string, artifactType: string) {
  if (process.env.PODCAST_DURABILITY_DISABLED === "true") return;
  podcastPersistenceQueue = podcastPersistenceQueue
    .then(work)
    .then(
      () => {
        podcastStorageHealth = "healthy";
      },
      (error) => {
        podcastStorageHealth = "degraded";
        logger.error(
          { artifact_type: artifactType, operation, error: error instanceof Error ? error.message : String(error) },
          "Podcast durable persistence failed",
        );
        throw error;
      },
    );
  podcastPersistenceQueue.catch(() => undefined);
}

export async function flushPodcastPersistence() {
  if (podcastMutationActive && stagedPodcastState) {
    const state = stagedPodcastState;
    stagedPodcastState = null;
    enqueuePodcastPersistence(async () => {
      podcastPersistenceRevision = await savePodcastStateToDatabase(state, podcastPersistenceRevision);
    }, "commit", "podcast_request");
  }
  try {
    await podcastPersistenceQueue;
    return true;
  } catch {
    return false;
  }
}

async function acquirePodcastMutationLockRelease() {
  let release!: () => void;
  const previous = podcastMutationLock;
  podcastMutationLock = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  if (
    process.env.PODCAST_DURABILITY_DISABLED !== "true" &&
    !await preparePodcastPersistence()
  ) {
    release();
    throw new Error("Podcast persistence is unavailable.");
  }
  podcastMutationActive = true;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    podcastMutationActive = false;
    stagedPodcastState = null;
    release();
  };
}

export async function acquirePodcastMutationLock(): Promise<PodcastMutationLock> {
  let currentRelease = await acquirePodcastMutationLockRelease();
  let released = false;
  const lock: PodcastMutationLock = {
    release: () => {
      if (released) return;
      released = true;
      currentRelease();
    },
    yieldForExternalWork: async <T>(work: () => Promise<T>) => {
      if (released) throw new Error("Podcast mutation lock is no longer active.");
      if (stagedPodcastState) {
        throw new Error("Podcast state cannot yield after mutation staging has begun.");
      }
      const expectedRevision = podcastPersistenceRevision;
      currentRelease();
      let result: T | undefined;
      let workError: unknown;
      try {
        result = await work();
      } catch (error) {
        workError = error;
      }
      currentRelease = await acquirePodcastMutationLockRelease();
      if (podcastPersistenceRevision !== expectedRevision) {
        throw new Error("Podcast state changed while external work was running; retry the request.");
      }
      if (workError) throw workError;
      return result as T;
    },
  };
  return lock;
}

export function runWithPodcastMutationLock<T>(lock: PodcastMutationLock, work: () => T) {
  return podcastLockContext.run(lock, work);
}

async function yieldPodcastMutationLock<T>(work: () => Promise<T>) {
  const lock = podcastLockContext.getStore();
  return lock ? lock.yieldForExternalWork(work) : work();
}

export async function refreshPodcastPersistence() {
  if (process.env.PODCAST_DURABILITY_DISABLED === "true") return;
  const stored = await loadPodcastStateFromDatabase();
  if (!stored) return;
  if (!rehydratePodcastState(stored.state)) throw new Error("Stored podcast state is invalid.");
  podcastPersistenceRevision = stored.revision;
}

async function preparePodcastPersistence() {
  if (!await flushPodcastPersistence()) {
    podcastPersistenceQueue = Promise.resolve();
    podcastStorageHealth = "degraded";
  }
  try {
    await refreshPodcastPersistence();
    return true;
  } catch (error) {
    podcastStorageHealth = "degraded";
    logger.error({ error: error instanceof Error ? error.message : String(error) }, "Podcast state refresh failed");
    return false;
  }
}

function persistPodcastState(operation: string, artifactType: string) {
  const temporaryPath = `${podcastStatePath}.tmp`;
  const state = serializedPodcastState();
  if (podcastMutationActive) {
    stagedPodcastState = state;
  } else {
    enqueuePodcastPersistence(async () => {
      podcastPersistenceRevision = await savePodcastStateToDatabase(state, podcastPersistenceRevision);
    }, operation, artifactType);
  }
  try {
    writeFileSync(
      temporaryPath,
      JSON.stringify(state),
      "utf8",
    );
    renameSync(temporaryPath, podcastStatePath);
    return true;
  } catch (error) {
    logger.warn(
      {
        artifact_type: artifactType,
        operation,
        error: error instanceof Error ? error.message : String(error),
      },
      "Podcast workspace compatibility mirror failed",
    );
    try {
      if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
    } catch {
      // The original persistence error is the actionable failure.
    }
    return true;
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
    if (!rehydratePodcastState(JSON.parse(readFileSync(podcastStatePath, "utf8")))) {
      podcastStorageHealth = "degraded";
    }
  } catch (error) {
    podcastStorageHealth = "degraded";
    logger.error({
      error: error instanceof Error ? error.message : String(error),
    }, "Podcast workspace restoration failed");
  }
}

export async function initializePodcastPersistence() {
  try {
    let importedLocalState = false;
    const databaseState = await loadPodcastStateFromDatabase();
    if (databaseState) {
      if (!rehydratePodcastState(databaseState.state)) {
        podcastStorageHealth = "degraded";
        throw new Error("Stored podcast state is invalid.");
      }
      podcastPersistenceRevision = databaseState.revision;
    } else if (existsSync(podcastStatePath)) {
      restorePodcastState();
      if (podcastStorageHealth === "degraded") {
        throw new Error("The local podcast state could not be imported safely.");
      }
      importedLocalState = true;
    }
    const discoveredLegacyAudio = await migratePersistedPodcastAudio();
    if (importedLocalState || discoveredLegacyAudio) {
      const importedState = serializedPodcastState();
      try {
        podcastPersistenceRevision = await savePodcastStateToDatabase(
          importedState,
          podcastPersistenceRevision,
        );
      } catch (error) {
        const winningState = await loadPodcastStateFromDatabase();
        if (
          !winningState ||
          !persistedPodcastStateRetainsImport(importedState, winningState.state) ||
          !rehydratePodcastState(winningState.state)
        ) {
          throw error;
        }
        podcastPersistenceRevision = winningState.revision;
        await migratePersistedPodcastAudio();
        logger.info(
          { revision: winningState.revision },
          "Podcast startup converged on a concurrent durable import",
        );
      }
    }
    podcastStorageHealth = "healthy";
  } catch (error) {
    podcastStorageHealth = "degraded";
    logger.error({
      error: error instanceof Error ? error.message : String(error),
    }, "Podcast durable persistence initialization failed");
    throw error;
  }
}

function persistedPodcastStateRetainsImport(expected: PersistedPodcastState, candidate: unknown) {
  if (!candidate || typeof candidate !== "object") return false;
  const actual = candidate as Partial<PersistedPodcastState>;
  const retainsIds = <T>(
    expectedItems: T[] | undefined,
    actualItems: T[] | undefined,
    identity: (item: T) => string,
  ) => {
    const actualIds = new Set((actualItems ?? []).map(identity));
    return (expectedItems ?? []).every((item) => actualIds.has(identity(item)));
  };
  return (
    retainsIds(expected.briefs, actual.briefs, (item) => item.id) &&
    retainsIds(expected.scripts, actual.scripts, (item) => item.id) &&
    retainsIds(expected.filterPresets, actual.filterPresets, (item) => item.id) &&
    retainsIds(expected.developmentPlans, actual.developmentPlans, (item) => item.id) &&
    retainsIds(expected.groundedRuns, actual.groundedRuns, (item) => item.id) &&
    retainsIds(expected.attestations, actual.attestations, (item) => item.id) &&
    retainsIds(expected.cutKeys, actual.cutKeys, (item) => `${item.key}:${item.audio_sha256}`) &&
    retainsIds(expected.audioAssets, actual.audioAssets, (item) => `${item.clipId}:${item.sha256}`) &&
    retainsIds(expected.approvalReceipts, actual.approvalReceipts, (item) => item.key) &&
    retainsIds(expected.executionRecords, actual.executionRecords, (item) => item.key)
  );
}

async function migratePersistedPodcastAudio() {
  let discoveredLegacyAudio = false;
  for (const script of podcastScripts.values()) {
    const clipId = script.audio_clip?.id;
    if (!clipId) continue;
    const manifest = [...podcastCutKeys.values()].find(
      (candidate) => candidate.clip_id === clipId,
    );
    let expectedSha256 = manifest?.audio_sha256 ?? podcastAudioAssets.get(clipId);
    const localPath = join(audioDirectory, `${clipId}.wav`);
    if (!expectedSha256 && existsSync(localPath)) {
      expectedSha256 = createHash("sha256").update(readFileSync(localPath)).digest("hex");
      podcastAudioAssets.set(clipId, expectedSha256);
      discoveredLegacyAudio = true;
    }
    if (!expectedSha256) continue;
    const available = await migrateLocalPodcastAudio(
      clipId,
      localPath,
      expectedSha256,
    );
    if (!available) throw new Error(`Durable podcast audio is missing for ${clipId}`);
  }
  return discoveredLegacyAudio;
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

function normalizeGroundingSource(
  source: PodcastGroundingSource,
  fallbackPolicyReference: string,
): PodcastGroundingSource {
  const uncertainty = source.what_remains_uncertain?.trim()
    || "The available source does not settle identity, intent, representativeness, or platform-wide opinion.";
  return {
    ...source,
    source_identifier: source.source_identifier
      ?? createHash("sha256").update(source.url).digest("hex").slice(0, 16),
    consent_reference: source.consent_reference ?? null,
    policy_reference: source.policy_reference ?? fallbackPolicyReference,
    aggregate_summary: source.aggregate_summary
      ?? (fallbackPolicyReference === "legacy-unverified-provenance"
        ? "Legacy citation; aggregate-only handling was not recorded."
        : "Topic-level source metadata only; no identity or copied comment text is retained."),
    evidence_gaps: source.evidence_gaps?.length ? source.evidence_gaps : [uncertainty],
  };
}

function normalizeGroundedRun(run: PodcastGroundedRun): PodcastGroundedRun {
  let provider = run.provider ?? "legacy_unverified";
  let policyReference = run.policy_reference
    ?? (provider === "synthetic_fixture" ? "synthetic-fixture-policy-v1" : "legacy-unverified-provenance");
  if (provider === "google_public_web" && policyReference === currentContextPolicyReference) {
    try {
      strictPodcastEvidenceConcept(run.concept, run.sources.map((source) => source.title));
    } catch {
      provider = "legacy_unverified";
      policyReference = "legacy-unverified-provenance";
    }
  }
  const normalizedSources = run.sources.map((source, index) => {
    const normalized = normalizeGroundingSource(source, policyReference);
    return provider === "google_public_web"
      ? {
          ...normalized,
          title: nonEmptyString(normalized.publisher) ? normalized.title : `Approved public-web result ${index + 1}`,
          snippet: "",
          what_remains_uncertain: [
            "This source alone does not establish any additional event details beyond the supported finding.",
            ...(normalized.evidence_gaps ?? []),
          ].join(" "),
        }
      : normalized;
  });
  const sources = provider === "google_public_web"
    ? normalizedSources.filter((source) => !retainsIdentityBearingSocialPath(source.url))
    : normalizedSources;
  if (
    provider === "google_public_web" &&
    (
      sources.length < 2 ||
      new Set(sources.map((source) => new URL(source.url).hostname.toLowerCase().replace(/^www\./, ""))).size < 2
    )
  ) {
    provider = "legacy_unverified";
    policyReference = "legacy-unverified-provenance";
  }
  const removedUnsafeSources = sources.length !== normalizedSources.length;
  const hasCommunitySource = sources.some((source) => source.source_type === "community");
  const normalizeLiveConcept = provider === "google_public_web" && policyReference === currentContextPolicyReference;
  const concept = normalizeLiveConcept
    ? {
        ...run.concept,
        source_ids: run.concept.source_ids.filter((sourceId) => sources.some((source) => source.id === sourceId)),
        summary: sources.map((source) => source.aggregate_summary).join(" "),
        observed_signal: sources.map((source) => source.what_it_supports).join(" "),
        supported_context: hasCommunitySource
          ? "The retained evidence includes an explicitly selected community source. Raw provider text never enters development."
          : "The retained evidence is limited to publisher reporting. It cannot establish what audiences or fans want, think, feel, ask, or believe.",
        unresolved_questions: [
          ...run.concept.unresolved_questions,
          ...(removedUnsafeSources
            ? ["Identity-bearing social source links were withheld from the retained historical run."]
            : []),
        ],
      }
    : run.concept;
  return {
    ...run,
    provider,
    window: run.window ?? "not_recorded",
    policy_reference: policyReference,
    sources,
    concept,
  };
}

function groundedRunRoomSources(run: PodcastGroundedRun): PodcastSource[] {
  const accessMode = run.provider === "google_public_web" && run.policy_reference === currentContextPolicyReference
    ? "approved_live" as const
    : run.provider === "synthetic_fixture"
      ? "fixture" as const
      : "public_url" as const;
  return run.sources.map((source) => ({
    id: source.id, source_url: source.url, platform: source.publisher ?? "Public web", community: new URL(source.url).hostname,
    post_title: source.title, publisher: source.publisher, published_at: source.published_at,
    timestamp: source.published_at ?? source.retrieved_at, retrieved_at: source.retrieved_at,
    engagement: { score: 0, comments: 0 }, source_id: source.source_identifier, access_mode: accessMode,
    source_class: source.source_type, evidence_type: source.classification,
    consent_reference: source.consent_reference,
    policy_reference: source.policy_reference,
    evidence_gaps: source.evidence_gaps,
  }));
}

function activeGroundedRun() {
  return [...podcastGroundedRuns.values()]
    .filter((candidate) => syntheticDemoEnabled() || isLivePodcastRuntime(candidate.runtime_status))
    .at(-1) ?? null;
}

function developmentRunMissingFields(
  run: PodcastGroundedRun | null,
  conceptId: string,
  requestedSourceIds: string[],
) {
  if (!run) return ["current_grounded_run"];
  const missing: string[] = [];
  if (run.concept.id !== conceptId) missing.push("current_grounded_run.concept_id");
  if (!syntheticDemoEnabled()) {
    if (!isLivePodcastRuntime(run.runtime_status)) missing.push("current_grounded_run.runtime_status");
    if (run.provider !== "google_public_web") missing.push("current_grounded_run.provider");
    if (run.policy_reference !== currentContextPolicyReference) missing.push("current_grounded_run.policy_reference");
  }
  for (const sourceId of [...new Set(requestedSourceIds)]) {
    const source = run.sources.find((candidate) => candidate.id === sourceId);
    if (!source) {
      missing.push(`source_ids.${sourceId}`);
      continue;
    }
    if (!nonEmptyString(source.source_identifier)) missing.push(`sources.${sourceId}.source_identifier`);
    if (!nonEmptyString(source.publisher)) missing.push(`sources.${sourceId}.publisher`);
    if (!nonEmptyString(source.retrieved_at)) missing.push(`sources.${sourceId}.retrieved_at`);
    if (!nonEmptyString(source.source_type)) missing.push(`sources.${sourceId}.source_type`);
    if (!nonEmptyString(source.classification)) missing.push(`sources.${sourceId}.classification`);
    if (!nonEmptyString(source.policy_reference)) missing.push(`sources.${sourceId}.policy_reference`);
    if (!Array.isArray(source.evidence_gaps) || source.evidence_gaps.length === 0) {
      missing.push(`sources.${sourceId}.evidence_gaps`);
    }
  }
  return missing;
}

function groundedRunForDevelopment(conceptId: string, requestedSourceIds: string[]) {
  return [...podcastGroundedRuns.values()].reverse().find((run) =>
    run.concept.id === conceptId &&
    (syntheticDemoEnabled() || isLivePodcastRuntime(run.runtime_status)),
  ) ?? null;
}

function groundedRunSnapshot(
  run: PodcastGroundedRun,
  requestedSourceIds: string[] = run.sources.map((source) => source.id),
): PodcastLiveSnapshot {
  const requested = new Set(requestedSourceIds);
  const sources = run.sources.filter((source) => requested.has(source.id));
  const retrievedTimes = sources
    .map((source) => new Date(source.retrieved_at).getTime())
    .filter(Number.isFinite)
    .sort((left, right) => left - right);
  const refreshedAt = now();
  const start = retrievedTimes[0] ?? new Date(refreshedAt).getTime();
  const end = retrievedTimes.at(-1) ?? start;
  const ageMinutes = Math.max(0, Math.round((Date.now() - end) / 60_000));
  const sourceClasses = [...new Set(sources.map((source) => source.source_type).filter(nonEmptyString))];
  const consentReferences = [...new Set(sources.map((source) => source.consent_reference).filter(nonEmptyString))];
  const approvedLive =
    isLivePodcastRuntime(run.runtime_status) &&
    run.provider === "google_public_web" &&
    run.policy_reference === currentContextPolicyReference;
  return {
    source_mode: approvedLive ? "approved_live" : "synthetic_fixture",
    source_status: approvedLive
      ? "active · selected Google-grounded run"
      : "fixture · selected synthetic development run",
    source_id: run.id,
    source_class: sourceClasses.join(", ") || (approvedLive ? "public_web" : "synthetic_entertainment_index"),
    consent_reference: consentReferences.length === 1 ? consentReferences[0]! : null,
    policy_review_reference: run.policy_reference,
    freshness: `${ageMinutes}m since selected run retrieval`,
    refreshed_at: refreshedAt,
    observation_window: {
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
    },
    aggregate_observations: sources.length,
    signal_label: approvedLive
      ? `${run.runtime_status} · ${run.window.replaceAll("_", " ")}`
      : "synthetic fixture · not a live audience measurement",
    data_notice: approvedLive
      ? "This snapshot is bound to the selected Google-grounded run and its approved source metadata. It contains no identity fields or copied comments."
      : "This fallback is synthetic and curated. It does not represent current public opinion, platform-wide behavior, or a popularity forecast.",
  };
}

function rehydrateActiveGroundedIndexes() {
  activeGroundedSources.splice(0);
  activeGroundedConcepts.splice(0);
  // Runs are persisted in insertion order; the newest run remains the room's active run.
  const run = activeGroundedRun();
  if (!run) return;
  activeGroundedSources.push(...groundedRunRoomSources(run));
  activeGroundedConcepts.push(run.concept);
}

export function runForPodcastArtifact(conceptId: string, sourceIds: string[]) {
  return [...podcastGroundedRuns.values()].reverse().find((run) =>
    (syntheticDemoEnabled() || isLivePodcastRuntime(run.runtime_status)) &&
    run.concept.id === conceptId &&
    sourceIds.length === run.sources.length &&
    sourceIds.every((id) => run.sources.some((source) => source.id === id)),
  ) ?? null;
}

function isLivePodcastRuntime(runtimeStatus: PodcastGroundedRun["runtime_status"]) {
  return runtimeStatus === "Live Google ADK" || runtimeStatus === "Live Gemini";
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
    currentBrief = null;
    currentScript = null;
    podcastBriefs.clear();
    podcastScripts.clear();
    podcastFilterPresets.clear();
    podcastDevelopmentPlans.clear();
    podcastGroundedRuns.clear();
    podcastAttestations.clear();
    podcastCutKeys.clear();
    podcastAudioAssets.clear();
    podcastApprovalReceipts.clear();
    podcastExecutionRecords.clear();
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
          workspace_revision: script.workspace_revision ?? randomUUID(),
          compatibility_normalized: requiredCompatibilityNormalization,
          release_kit: normalizePersistedReleaseKit(releaseKit),
        });
      }
    }
    for (const preset of saved.filterPresets ?? []) {
      if (preset?.id) {
        podcastFilterPresets.set(preset.id, {
          ...preset,
          owner_id: typeof preset.owner_id === "string" ? preset.owner_id : null,
        });
      }
    }
    for (const plan of saved.developmentPlans ?? []) {
      if (plan?.id) podcastDevelopmentPlans.set(plan.id, plan);
    }
    for (const run of saved.groundedRuns ?? []) {
      if (run?.id) podcastGroundedRuns.set(run.id, normalizeGroundedRun(run));
    }
    for (const attestation of saved.attestations ?? []) {
      if (attestation?.id && attestation.run_id) {
        podcastAttestations.set(attestation.run_id, attestation);
      }
    }
    for (const cutKey of saved.cutKeys ?? []) {
      if (isValidPodcastCutKey(cutKey)) podcastCutKeys.set(cutKey.key, cutKey);
    }
    for (const asset of saved.audioAssets ?? []) {
      if (asset?.clipId && /^[a-f0-9]{64}$/.test(asset.sha256)) {
        podcastAudioAssets.set(asset.clipId, asset.sha256);
      }
    }
    for (const item of saved.approvalReceipts ?? []) if (item?.key && item.receipt) podcastApprovalReceipts.set(item.key, item.receipt);
    for (const item of saved.executionRecords ?? []) if (item?.key && item.execution) podcastExecutionRecords.set(item.key, item.execution);
    for (const script of podcastScripts.values()) {
      const run = script.run_id ? podcastGroundedRuns.get(script.run_id) : null;
      const hasPerformanceReceipt =
        podcastApprovalReceipts.has(`script:${script.id}`) ||
        podcastApprovalReceipts.has(`audio:${script.id}`);
      if (run && hasPerformanceReceipt && !podcastPerformanceAuthority(script, run)) {
        podcastApprovalReceipts.delete(`script:${script.id}`);
        podcastApprovalReceipts.delete(`audio:${script.id}`);
      }
    }
    rehydrateActiveGroundedIndexes();
    currentBrief = saved.currentBriefId ? podcastBriefs.get(saved.currentBriefId) ?? null : null;
    for (const script of podcastScripts.values()) {
      const brief = podcastBriefs.get(script.brief_id);
      if (brief && !podcastWorkspaceMatchesBrief(script, brief)) {
        discardPodcastWorkspace(script);
      }
    }
    currentScript = saved.currentScriptId ? podcastScripts.get(saved.currentScriptId) ?? null : null;
    podcastStorageHealth = "healthy";
    return true;
  } catch (error) {
    currentBrief = null;
    currentScript = null;
    podcastBriefs.clear();
    podcastScripts.clear();
    podcastFilterPresets.clear();
    podcastDevelopmentPlans.clear();
    podcastGroundedRuns.clear();
    podcastAttestations.clear();
    podcastCutKeys.clear();
    podcastAudioAssets.clear();
    podcastApprovalReceipts.clear();
    podcastExecutionRecords.clear();
    activeGroundedSources.splice(0);
    activeGroundedConcepts.splice(0);
    podcastStorageHealth = "degraded";
    console.error("Podcast workspace rehydration failed", {
      error: error instanceof Error ? error.message : String(error),
    });
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
    run_id: null,
    attestation_id: null,
    status: "draft" as const,
    generated_mode: "synthetic_demo" as const,
    topic_angle:
      "The smartest recap is not a verdict on the cast. It is a reconstruction of what the edit makes visible, what it compresses, and what the audience is still trying to place.",
    audience_pain:
      "Viewers feel that the emotional stakes are obvious but the timeline is not. They want context without being pushed toward a pile-on.",
    why_now:
      `The same question is appearing across ${new Set(allPodcastSources().filter((source) => sourceIds.includes(source.id)).map((source) => source.community)).size} public communities within the current episode window, with high discussion velocity and a clear shift from reaction to context-seeking.`,
    key_tensions: [
      "Narrative clarity versus editorial compression",
      "A satisfying explanation versus unsupported certainty",
      "Audience curiosity versus targeting an individual",
    ],
    source_links: allPodcastSources().filter((source) => sourceIds.includes(source.id)).map((source) => ({
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

function containsUnsafeCurrentContextText(
  value: string,
  forbiddenSourceTitles: string[],
  forbiddenIdentities: string[] = [],
) {
  const normalized = value.toLowerCase();
  return /[@“”"]|\b(?:u|r)\/[a-z0-9_-]+|https?:\/\//i.test(value)
    || forbiddenIdentities.some((identity) => normalized.includes(identity.toLowerCase()))
    || forbiddenSourceTitles.some((title) => {
      const normalizedTitle = title.trim().toLowerCase();
      return normalizedTitle.length > 20 && normalized.includes(normalizedTitle);
    });
}

export function strictPodcastEvidenceConcept(
  input: unknown,
  forbiddenSourceTitles: string[] = [],
  forbiddenIdentities: string[] = [],
) {
  const parsed = input as Partial<PodcastConcept>;
  const returnedText = [
    parsed.title,
    parsed.summary,
    parsed.observed_signal,
    parsed.supported_context,
    ...(Array.isArray(parsed.unresolved_questions) ? parsed.unresolved_questions : []),
  ].filter(nonEmptyString);
  const containsUnsafeProviderText = returnedText.some((value) =>
    containsUnsafeCurrentContextText(value, forbiddenSourceTitles, forbiddenIdentities));
  if (
    !nonEmptyString(parsed.title) ||
    !nonEmptyString(parsed.summary) ||
    !nonEmptyString(parsed.observed_signal) ||
    !nonEmptyString(parsed.supported_context) ||
    !Array.isArray(parsed.unresolved_questions) ||
    parsed.unresolved_questions.length === 0 ||
    !parsed.unresolved_questions.every(nonEmptyString) ||
    containsUnsafeProviderText
  ) {
    throw new Error("Evidence editor returned malformed structured output.");
  }
  return {
    title: parsed.title,
    summary: parsed.summary,
    observed_signal: parsed.observed_signal,
    supported_context: parsed.supported_context,
    unresolved_questions: parsed.unresolved_questions,
  };
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

function podcastDecisionHistory(briefId: string | null, scriptId: string | null) {
  const legacyHistory = getPodcastDecisionHistory({ briefId, scriptId }).filter(
    (entry) => entry.artifact_type === "brief" || entry.decision === "reject",
  );
  if (!scriptId) return legacyHistory;
  const authorityHistory = ([
    ["script", podcastApprovalReceipts.get(`script:${scriptId}`)],
    ["audio", podcastApprovalReceipts.get(`audio:${scriptId}`)],
  ] as const).flatMap(([artifactType, receipt]) => {
    if (
      !receipt?.authority_record_type ||
      !receipt.receipt_id ||
      !receipt.reviewer_reference ||
      !receipt.artifact_sha256 ||
      !receipt.source_run_id ||
      !receipt.policy_version
    ) return [];
    return [{
      artifact_type: artifactType,
      artifact_id: scriptId,
      reviewer: receipt.reviewer,
      decision: "approve" as const,
      decided_at: receipt.decided_at,
      artifact_creation: "none" as const,
      authority_record_type: receipt.authority_record_type,
      receipt_id: receipt.receipt_id,
      reviewer_reference: receipt.reviewer_reference,
      script_sha256: receipt.artifact_sha256,
      source_run_id: receipt.source_run_id,
      policy_version: receipt.policy_version,
      publication_status: "blocked_until_final_approval" as const,
    }];
  });
  return [...authorityHistory, ...legacyHistory];
}

function buildPodcastRoom(presetVisible: (preset: OwnedPodcastFilterPreset) => boolean) {
  const selectedBriefId = currentBrief?.id ?? null;
  const selectedScriptId =
    currentScript && currentScript.brief_id === selectedBriefId ? currentScript.id : null;
  return {
    sources: allPodcastSources(),
    concepts: allPodcastConcepts(),
    filter_presets: [...podcastFilterPresets.values()].filter(presetVisible),
    data_notice:
      "Public-source path only · summaries are pattern-level · comments are never copied verbatim · provenance is retained per item.",
    rendering_status: "blocked_until_approval" as const,
    selected_brief_id: selectedBriefId,
    decision_history: podcastDecisionHistory(selectedBriefId, selectedScriptId),
  };
}
export function getPodcastRoom(producerId: string) {
  return buildPodcastRoom(
    (preset) => preset.owner_id === null || preset.owner_id === producerId,
  );
}

export function getUnscopedPodcastRoom() {
  return buildPodcastRoom(() => true);
}
export function getPodcastLiveSnapshot(): PodcastLiveSnapshot {
  const currentRun = activeGroundedRun();
  if (
    currentRun &&
    developmentRunMissingFields(
      currentRun,
      currentRun.concept.id,
      currentRun.sources.map((source) => source.id),
    ).length === 0
  ) {
    return groundedRunSnapshot(currentRun);
  }
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

export class PodcastDevelopmentLinkageError extends Error {
  readonly missingFields: string[];

  constructor(missingFields: string[]) {
    super(`Development plan is missing required current-run fields: ${missingFields.join(", ")}`);
    this.name = "PodcastDevelopmentLinkageError";
    this.missingFields = missingFields;
  }
}

function percent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value <= 1 ? value * 100 : value)));
}

function methodologyFactors(
  concept: PodcastConcept,
  sourceIds: string[],
  format: PodcastFormatVariant["format"],
) {
  const selectedSources = allPodcastSources().filter((source) => sourceIds.includes(source.id));
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
  concept: PodcastConcept,
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
  const concept = allPodcastConcepts().find((item) => item.id === conceptId);
  if (!concept) {
    if (!syntheticDemoEnabled()) throw new Error("No exact grounded concept is available for production brief generation.");
    return null;
  }
  const sourceIds = concept.source_ids.filter((id) => requestedSourceIds.includes(id));
  if (!sourceIds.length) return null;
  const run = groundedRunForDevelopment(concept.id, sourceIds);
  const missingFields = developmentRunMissingFields(run, concept.id, sourceIds);
  if (missingFields.length > 0 && !syntheticDemoEnabled()) {
    throw new PodcastDevelopmentLinkageError(missingFields);
  }
  const snapshot = run && missingFields.length === 0
    ? groundedRunSnapshot(run, sourceIds)
    : getPodcastLiveSnapshot();
  const variants = [
    makeVariant(concept, sourceIds, "cold_open_explainer", "The question before the answer", "Lead with the missing piece, then earn the explanation through cited context.", "Open on the shared question, then reveal which part the evidence can actually answer.", "Fastest hook, but the opening must not imply the unresolved point is already proven."),
    makeVariant(concept, sourceIds, "reported_explainer", "What the record can support", "Build a compact reported explainer around chronology, source classes, and the limits of the available record.", "Begin with two facts from the selected sources and the gap between them.", "Highest clarity, with less room for spontaneous host chemistry."),
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
  producerId?: string,
) {
  const preset: OwnedPodcastFilterPreset = {
    id: `preset-${randomUUID()}`,
    name: name.trim(),
    owner_id: producerId ?? null,
    platforms: [...new Set(platforms)],
    communities: [...new Set(communities)],
  };
  podcastFilterPresets.set(preset.id, preset);
  persistPodcastState("create", "filter_preset");
  return preset;
}

export function renamePodcastFilterPreset(id: string, name: string, producerId?: string) {
  const preset = podcastFilterPresets.get(id);
  if (!preset || (producerId !== undefined && preset.owner_id !== producerId)) return null;
  const renamed = { ...preset, name: name.trim() };
  podcastFilterPresets.set(id, renamed);
  persistPodcastState("rename", "filter_preset");
  return renamed;
}

export function deletePodcastFilterPreset(id: string, producerId?: string) {
  const preset = podcastFilterPresets.get(id);
  if (!preset || (producerId !== undefined && preset.owner_id !== producerId)) return false;
  if (!podcastFilterPresets.delete(id)) return false;
  persistPodcastState("delete", "filter_preset");
  return true;
}

function performedFormatOpening(brief: PodcastBrief) {
  return {
    cold_open_explainer: "Everybody saw the same cut. Somehow, everybody walked away with a different missing scene.",
    reported_explainer: "Two facts can sit next to each other and still leave a hole big enough for the whole internet to fall through.",
    structured_debate: "One reading says the edit clarified the story. Another says it created the mystery.",
    context_recap: "The most important scene in this episode may be the one we never actually saw.",
    listener_question: "A listener asked the question this entire conversation keeps circling: what, exactly, are we being asked to assume?",
  }[brief.selected_format?.format ?? "cold_open_explainer"]
    ?? "Everybody saw the same cut. Somehow, everybody walked away with a different missing scene.";
}

function performedArchetypePerspective(brief: PodcastBrief) {
  return {
    "investigative-decoder": "The timeline gives us a trail, but not permission to turn every gap into a conclusion.",
    "warm-interviewer": "There is a humane version of this conversation—one that leaves room for an answer without cornering a person.",
    "culture-critic": "This is bigger than one recap; it is about the way entertainment edits train us to mistake compression for certainty.",
    "comic-improviser": "Reality television can fit three weeks into forty-two minutes, which is efficient storytelling and absolutely terrible calendar management.",
  }[brief.editorial_archetype?.id ?? "investigative-decoder"]
    ?? "The timeline gives us a trail, but not permission to turn every gap into a conclusion.";
}

function fixtureScript(brief: PodcastBrief): PodcastWorkspaceWithCompatibility {
  const sourceIds = brief.source_links.map((link) => link.source_id);
  const tension = brief.key_tensions[0] ?? "The loudest version of the story is not necessarily the best-supported one.";
  const secondTension = brief.key_tensions[1] ?? "What remains unknown matters as much as what the source trail can confirm.";
  const formatOpening = performedFormatOpening(brief);
  const archetypePerspective = performedArchetypePerspective(brief);
  const spokenSections = [
    {
      segment: "cold_open",
      script: `${formatOpening} Here is the strange thing about ${brief.topic_angle.toLowerCase()}: the moment everyone thinks they know what happened is usually the moment the missing context starts doing the most work.`,
    },
    {
      segment: "banter",
      script: `${brief.why_now} That does not make the conversation true by volume. It makes it worth examining—carefully, and with the receipts still attached.`,
    },
    {
      segment: "evidence",
      script: `${tension} So let us separate the signal from the certainty: several sources point to the same editorial pressure, but repetition is not proof and attention is not a verdict.`,
    },
    {
      segment: "reveal",
      script: `${secondTension} This is the gap on the cutting-room floor: we can show what the available record supports, and we can name what it cannot settle. We do not get to invent the missing scene.`,
    },
    {
      segment: "uncertainty",
      script: `${secondTension} This is the gap on the cutting-room floor: we can show what the available record supports, and we can name what it cannot settle. We do not get to invent the missing scene.`,
    },
    {
      segment: "closing_button",
      script: `${archetypePerspective} The useful question is not “who can we blame?” It is “what changes when the audience can inspect the source trail for itself?” That is where this story gets more interesting—and more honest.`,
    },
  ];
  return {
    id: `script-${brief.id}`,
    brief_id: brief.id,
    run_id: brief.run_id,
    attestation_id: brief.attestation_id,
    status: "draft",
    title: brief.suggested_title,
    sections: spokenSections.map((item) => ({
      segment: item.segment,
      script: item.script,
      source_ids: sourceIds,
      classification: item.segment === "uncertainty" ? "unresolved" as const : item.segment === "reveal" ? "disputed" as const : "source_backed" as const,
      speaker: ["banter", "reveal", "closing_button"].includes(item.segment) ? "BACKSTAGE" as const : "FRONT ROW" as const,
    })),
    provenance: brief.source_links.map((link) => {
      const source = allPodcastSources().find((candidate) => candidate.id === link.source_id);
      return {
        ...link,
        ...(source?.access_mode === "approved_live" ? {
          title: source.post_title,
          publisher: source.publisher,
          published_at: source.published_at ?? null,
          source_class: source.source_class ?? source.platform,
        } : {}),
      };
    }),
    safety_note:
      "Performed sample summarizes recurring public patterns. It contains no verbatim social comments, personal targeting, or unsupported audience-wide claims.",
    review_note:
      "Draft only. A separate human script review is required before any audio workflow.",
    audio_status: "blocked_until_script_approval",
    audio_clip: null,
    compatibility_normalized: false,
    workspace_revision: randomUUID(),
    release_kit: null,
  };
}

function podcastWorkspaceMatchesBrief(
  script: PodcastWorkspaceWithCompatibility,
  brief: PodcastBrief,
) {
  if (podcastExecutionRecords.has(`script:${script.id}`)) {
    const allowedSourceIds = new Set(brief.source_links.map((item) => item.source_id));
    return (
      script.brief_id === brief.id &&
      script.provenance.map((item) => item.source_id).join(",") ===
        brief.source_links.map((item) => item.source_id).join(",") &&
      script.sections.length === 6 &&
      script.sections.every(
        (section) =>
          section.source_ids.length > 0 &&
          section.source_ids.every((sourceId) => allowedSourceIds.has(sourceId)),
      ) &&
      script.sections.some((section) => section.speaker === "FRONT ROW") &&
      script.sections.some((section) => section.speaker === "BACKSTAGE") &&
      script.sections.some(
        (section) =>
          section.segment === "uncertainty" &&
          section.classification === "unresolved",
      )
    );
  }
  const hasEditorialSelection = Boolean(brief.selected_format || brief.editorial_archetype);
  if (!hasEditorialSelection && script.compatibility_normalized) return true;
  return (
    script.title === brief.suggested_title &&
    script.provenance.map((item) => item.source_id).join(",") ===
      brief.source_links.map((item) => item.source_id).join(",") &&
    script.sections[0]?.script.includes(brief.topic_angle.toLowerCase()) &&
    script.sections[0]?.script.startsWith(performedFormatOpening(brief)) &&
    script.sections.at(-1)?.script.startsWith(performedArchetypePerspective(brief))
  );
}

function discardPodcastWorkspace(script: PodcastWorkspaceWithCompatibility) {
  podcastApprovalReceipts.delete(`script:${script.id}`);
  podcastApprovalReceipts.delete(`audio:${script.id}`);
  podcastExecutionRecords.delete(`script:${script.id}`);
  podcastExecutionRecords.delete(`audio:${script.id}`);
  podcastScripts.delete(script.id);
  if (currentScript?.id === script.id) currentScript = null;
  if (script.audio_clip) {
    const audioPath = getPodcastAudioPath(script.audio_clip.id);
    if (audioPath) {
      try {
        unlinkSync(audioPath);
      } catch {
        // The workspace is still invalidated even if an orphaned local clip cannot be removed.
      }
    }
  }
}

function fixtureReleaseKit(script: PodcastWorkspaceWithCompatibility): PodcastReleaseKit {
  const sectionCount = script.sections.length;
  return {
    id: `release-kit-${script.id}`,
    script_id: script.id,
    status: "staged",
    title_options: [
      script.title,
      `AUTOGRAPHY Preview: ${script.title}`,
      `Source Record: ${script.title}`,
    ],
    episode_description:
      `FRONT ROW and BACKSTAGE perform the exact approved script for “${script.title}” from its selected public source record and stated uncertainty.`,
    chapters: script.sections.map((section, index) => ({
      label: section.segment.replaceAll("_", " "),
      timing: `Turn ${index + 1} of ${sectionCount}`,
      purpose: section.script,
    })),
    host_notes: [
      "Perform only the exact approved section text.",
      "Use the fictional FRONT ROW and BACKSTAGE house voices; do not imitate a real person.",
      "Do not add claims, ad-libs, or audience attribution during performance.",
    ],
    promotion_copy: [
      { channel: "show notes", copy: `${script.title}. An AUTOGRAPHY preview performed from the exact approved script and attached public source record.` },
      { channel: "newsletter", copy: `New AUTOGRAPHY preview: ${script.title}.` },
      { channel: "social draft", copy: `Preview draft: ${script.title}.` },
    ],
    accessibility_notes: [
      "Publish a complete transcript with speaker labels and chapter timestamps.",
      "Describe editorial uncertainty in plain language rather than relying on tone or audio cues.",
      "Keep source links and the provenance summary available alongside the episode notes.",
    ],
    provenance_summary: `${script.provenance.length} retrieved public sources are attached to the approved script. Release copy is derived from that exact script and does not reproduce raw social text.`,
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
  if (existing && !podcastWorkspaceMatchesBrief(existing, brief)) {
    discardPodcastWorkspace(existing);
  }
  currentScript = existing && podcastWorkspaceMatchesBrief(existing, brief)
    ? existing
    : fixtureScript(brief);
  podcastScripts.set(currentScript.id, currentScript);
  persistPodcastState("create", "script_workspace");
  return { kind: "created" as const, script: currentScript };
}

/** The HTTP production path is asynchronous; the legacy synchronous creator is
 * retained only for explicit synthetic-demo fixtures and compatibility tests. */
export async function createPodcastScriptFromGemini(briefId: string) {
  if (process.env.PODCAST_SYNTHETIC_DEMO === "true") return createPodcastScript(briefId);
  const brief = podcastBriefs.get(briefId);
  if (!brief) return { kind: "not_found" as const };
  if (brief.status !== "approved") return { kind: "brief_not_approved" as const };
  const run = brief.run_id ? podcastGroundedRuns.get(brief.run_id) ?? null : null;
  const attestation = brief.attestation_id ? podcastAttestations.get(brief.run_id ?? "") : null;
  if (!run || !attestation || run.id !== brief.run_id || attestation.id !== brief.attestation_id || !runForPodcastArtifact(brief.concept_id, brief.selected_source_ids)) throw new Error("Bound grounded run and attestation are required.");
  const agenticRun = traceablePodcastRunExecutions(run);
  if (!agenticRun) throw new Error("Bound Google ADK research and editorial execution evidence is required.");
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini script generation is not configured.");
  const started = Date.now();
  const ai = new GoogleGenAI({ apiKey });
  const response = await yieldPodcastMutationLock(() => ai.models.generateContent({
    model,
    contents: `Write an original two-host entertainment podcast highlight based only on this exact live Google-grounded search and its selected sources. This is finished dialogue, not instructions, a compliance summary, a source report, or a generic template. Use the brief's literal suggested title or an equally narrow factual variant. Every factual sentence must restate only one or more propositions explicitly present in the mapped source's title, publication date, aggregate_summary, or what_it_supports. Map each section to only the source IDs needed for that section. Never infer an institutional contradiction, genre shift, category restructuring, broadcast change, trend, motive, consequence, popularity effect, or broader meaning. Words such as means, proves, signals, because, therefore, shift, change, contradiction, and trend must not introduce a new premise. FRONT ROW and BACKSTAGE may use brief non-factual reactions such as asking to read the record carefully, but those reactions must add no factual claim. ${run.sources.filter((source) => brief.selected_source_ids.includes(source.id)).some((source) => source.source_type === "community") ? "Audience or fan attribution is allowed only when mapped to the returned community source." : "No selected community source was returned. Do not say or imply what audiences, fans, listeners, viewers, people, or social consensus want, think, feel, ask, believe, prefer, need, expect, or struggle with; describe only what the selected publisher coverage reports."} Use six short, speakable turns. Return JSON {title,sections}. Exactly six sections, in this order: cold_open, banter, evidence, reveal, uncertainty, closing_button. Every section has segment, script, speaker (FRONT ROW or BACKSTAGE), classification (source_backed, first_party_attested, disputed, unresolved), source_ids. Cite every selected source ID in metadata across the six sections, but never say source IDs aloud. Include both speakers. The uncertainty section may state only an explicit missing publication date or the supplied evidence limits. Never write production instructions, stage directions, legal/compliance language, allegations, raw private text, or claims beyond the supplied evidence. Only this permitted public attestation summary may be used: ${attestation.permitted_public_summary ?? "None"}.\nQUERY:${run.query}\nSELECTED SOURCE IDS:${JSON.stringify(brief.selected_source_ids)}\nSOURCES:${JSON.stringify(run.sources.filter((source) => brief.selected_source_ids.includes(source.id)))}\nUNCERTAINTIES:${JSON.stringify(run.uncertainties)}\nBRIEF:${JSON.stringify(brief)}\nFORMAT:${JSON.stringify(brief.selected_format)}\nARCHETYPE:${JSON.stringify(brief.editorial_archetype)}`,
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: {
        type: "object",
        additionalProperties: false,
        required: ["title", "sections"],
        properties: {
          title: { type: "string", minLength: 1 },
          sections: {
            type: "array",
            minItems: 6,
            maxItems: 6,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["segment", "script", "speaker", "classification", "source_ids"],
              properties: {
                segment: { type: "string", enum: ["cold_open", "banter", "evidence", "reveal", "uncertainty", "closing_button"] },
                script: { type: "string", minLength: 1 },
                speaker: { type: "string", enum: ["FRONT ROW", "BACKSTAGE"] },
                classification: { type: "string", enum: ["source_backed", "first_party_attested", "disputed", "unresolved"] },
                source_ids: { type: "array", minItems: 1, items: { type: "string" } },
              },
            },
          },
        },
      },
    },
  }));
  const parsed = JSON.parse(response.text ?? "{}") as { title?: unknown; sections?: unknown };
  const valid = validateGeneratedScript(parsed, run, attestation, brief.selected_source_ids);
  const claimCheckResponse = await yieldPodcastMutationLock(() => ai.models.generateContent({
    model,
    contents: `Verify each numbered podcast section against only the source records named in that section's source_ids. A section is supported only when every concrete factual claim is directly entailed by the mapped sources' publisher title, publication date, aggregate_summary, and what_it_supports. Natural reactions and transitions may be supported only when they add no new factual premise. Do not treat a plausible inference, trend extension, cross-source merge, or broader industry claim as supported. Return one result per section with section_index, supported, and unsupported_claims. If any concrete claim is not directly supported, supported must be false and unsupported_claims must name that claim concisely.\n\nSOURCES:${JSON.stringify(run.sources.filter((source) => brief.selected_source_ids.includes(source.id)).map((source) => ({ id: source.id, title: source.title, publisher: source.publisher, published_at: source.published_at, aggregate_summary: source.aggregate_summary, what_it_supports: source.what_it_supports, what_remains_uncertain: source.what_remains_uncertain })))}\n\nSECTIONS:${JSON.stringify(valid.sections)}`,
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: {
        type: "object",
        additionalProperties: false,
        required: ["checks"],
        properties: {
          checks: {
            type: "array",
            minItems: valid.sections.length,
            maxItems: valid.sections.length,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["section_index", "supported", "unsupported_claims"],
              properties: {
                section_index: { type: "integer", minimum: 1, maximum: valid.sections.length },
                supported: { type: "boolean" },
                unsupported_claims: { type: "array", items: { type: "string" } },
              },
            },
          },
        },
      },
    },
  }));
  const claimChecks = JSON.parse(claimCheckResponse.text ?? "{}") as { checks?: unknown };
  validateScriptClaimSupport(claimChecks.checks, valid.sections.length);
  const base = fixtureScript(brief);
  const script: PodcastWorkspaceWithCompatibility = { ...base, title: valid.title, sections: valid.sections, run_id: run.id, attestation_id: attestation.id, workspace_revision: randomUUID(), claim_support_verified: true };
  const existingScript = podcastScripts.get(script.id);
  if (existingScript) discardPodcastWorkspace(existingScript);
  podcastExecutionRecords.set(`script:${script.id}`, { agent: "script_performer", provider: "Google Gemini", framework: "Direct @google/genai", model, execution_id: randomUUID(), parent_execution_id: agenticRun.parentExecutionId, tools: [], latency_ms: Date.now() - started, status: "completed", activity: "Created structured performed copy from the ADK-grounded editorial envelope." });
  currentScript = script;
  podcastScripts.set(script.id, script);
  persistPodcastState("create", "script_workspace");
  recordAgentStage("PODCAST-SCRIPT", "draft", script.id, `Gemini performed script ${Date.now() - started}ms`);
  return { kind: "created" as const, script };
}

export function validateGeneratedScript(parsed: { title?: unknown; sections?: unknown }, run: PodcastGroundedRun, attestation: PodcastCuttingRoomAttestation & { raw_text?: string }, requiredSourceIds: string[] = run.sources.map((source) => source.id)) {
  if (!nonEmptyString(parsed.title) || !Array.isArray(parsed.sections) || parsed.sections.length !== 6) throw new Error("Malformed Gemini script output.");
  const beats = ["cold_open", "banter", "evidence", "reveal", "uncertainty", "closing_button"];
  const ids = new Set(run.sources.map((source) => source.id));
  const allowedClasses = new Set(["source_backed", "first_party_attested", "disputed", "unresolved"]);
  const sections = parsed.sections.map((item, index) => {
    const s = item as Record<string, unknown>;
    if (s.segment !== beats[index] || !nonEmptyString(s.script) || !["FRONT ROW", "BACKSTAGE"].includes(s.speaker as string) || !allowedClasses.has(s.classification as string) || !Array.isArray(s.source_ids) || !s.source_ids.length || !s.source_ids.every((id) => typeof id === "string" && ids.has(id)) || /\b(open with|say|instructions?|stage direction|compliance summary|policy review|legal analysis|proves?|definitely|guilty|lied|cover[- ]?up)\b/i.test(s.script) || (attestation.raw_text && s.script.includes(attestation.raw_text))) throw new Error("Malformed or unsafe Gemini script output.");
    if (s.classification === "first_party_attested" && (!attestation.attested || !attestation.authorized_uses.includes("podcast_script"))) throw new Error("First-party attested script line is outside the authorized use scope.");
    return { segment: s.segment, script: s.script, speaker: s.speaker, classification: s.classification, source_ids: s.source_ids } as PodcastWorkspaceWithCompatibility["sections"][number];
  });
  const cited = new Set(sections.flatMap((section) => section.source_ids));
  if (!sections.some((s) => s.speaker === "FRONT ROW") || !sections.some((s) => s.speaker === "BACKSTAGE") || sections[4]?.classification !== "unresolved" || requiredSourceIds.some((id) => !cited.has(id))) throw new Error("Malformed Gemini script speaker, source coverage, or uncertainty beat.");
  validateAudienceAttributionBoundary(
    parsed.title,
    sections,
    run.sources.filter((source) => requiredSourceIds.includes(source.id)).map((source) => source.source_type),
  );
  return { title: parsed.title, sections };
}

export function validateScriptClaimSupport(input: unknown, expectedSectionCount: number) {
  if (!Array.isArray(input) || input.length !== expectedSectionCount) {
    throw new Error("Script claim support verification was incomplete.");
  }
  const indexes = new Set<number>();
  for (const item of input) {
    const check = item as Record<string, unknown>;
    if (
      !Number.isInteger(check.section_index) ||
      (check.section_index as number) < 1 ||
      (check.section_index as number) > expectedSectionCount ||
      typeof check.supported !== "boolean" ||
      !Array.isArray(check.unsupported_claims) ||
      check.unsupported_claims.some((claim) => typeof claim !== "string")
    ) {
      throw new Error("Script claim support verification was malformed.");
    }
    indexes.add(check.section_index as number);
    if (check.supported !== true || check.unsupported_claims.length > 0) {
      throw new Error("Gemini script contained source-unsupported transformed claims.");
    }
  }
  if (indexes.size !== expectedSectionCount) {
    throw new Error("Script claim support verification contained duplicate sections.");
  }
}

export function validateGroundedFindingSupport(input: unknown, expectedSourceCount: number) {
  if (!Array.isArray(input) || input.length !== expectedSourceCount) {
    throw new Error("Grounded finding support verification was incomplete.");
  }
  const indexes = new Set<number>();
  for (const item of input) {
    const check = item as Record<string, unknown>;
    if (
      !Number.isInteger(check.source_index) ||
      (check.source_index as number) < 1 ||
      (check.source_index as number) > expectedSourceCount ||
      typeof check.supported !== "boolean" ||
      !Array.isArray(check.unsupported_claims) ||
      check.unsupported_claims.some((claim) => typeof claim !== "string")
    ) {
      throw new Error("Grounded finding support verification was malformed.");
    }
    indexes.add(check.source_index as number);
    if (check.supported !== true || check.unsupported_claims.length > 0) {
      throw new Error("Grounded source editor introduced unsupported transformed claims.");
    }
  }
  if (indexes.size !== expectedSourceCount) {
    throw new Error("Grounded finding support verification contained duplicate sources.");
  }
}

export function validateBriefClaimSupport(
  input: unknown,
  draft: GeneratedPodcastDraft,
  hasCommunitySource: boolean,
) {
  const check = input && typeof input === "object" ? input as Record<string, unknown> : null;
  if (
    !check ||
    typeof check.supported !== "boolean" ||
    !Array.isArray(check.unsupported_claims) ||
    check.unsupported_claims.some((claim) => typeof claim !== "string")
  ) {
    throw new Error("Podcast brief claim-support verification was malformed.");
  }
  if (check.supported !== true || check.unsupported_claims.length > 0) {
    throw new Error("Podcast brief introduced source-unsupported transformed claims.");
  }
  if (!hasCommunitySource) {
    const audienceClaimText = [
      draft.topic_angle,
      draft.audience_pain,
      draft.why_now,
      ...draft.key_tensions,
      draft.suggested_title,
      ...draft.episode_outline.map((item) => item.purpose),
    ].join(" ");
    if (/\b(?:audiences?|fans?|listeners?)\b.{0,48}\b(?:want|think|feel|ask|believe|prefer|struggle|expect|react|need|care)\b/i.test(audienceClaimText)) {
      throw new Error("Podcast brief attributed a view or need to audiences without a selected community source.");
    }
  }
}

export function getPodcastScriptByBriefId(briefId: string) {
  const brief = podcastBriefs.get(briefId) ?? (currentBrief?.id === briefId ? currentBrief : null);
  if (!brief) return { kind: "not_found" as const };
  if (brief.status !== "approved") return { kind: "brief_not_approved" as const };
  const script = podcastScripts.get(`script-${brief.id}`);
  if (!script) return { kind: "not_found" as const };
  if (!podcastWorkspaceMatchesBrief(script, brief)) {
    discardPodcastWorkspace(script);
    persistPodcastState("invalidate", "script_workspace");
    return { kind: "not_found" as const };
  }
  currentBrief = brief;
  currentScript = script;
  return { kind: "found" as const, script };
}

export function getPodcastScriptById(scriptId: string) {
  const script = podcastScripts.get(scriptId) ?? (currentScript?.id === scriptId ? currentScript : null);
  if (!script) return { kind: "not_found" as const };
  const brief = podcastBriefs.get(script.brief_id);
  if (!brief || brief.status !== "approved") return { kind: "brief_not_approved" as const };
  if (!podcastWorkspaceMatchesBrief(script, brief)) {
    discardPodcastWorkspace(script);
    persistPodcastState("invalidate", "script_workspace");
    return { kind: "not_found" as const };
  }
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
  const brief = podcastBriefs.get(script.brief_id);
  const run = brief?.run_id ? podcastGroundedRuns.get(brief.run_id) : null;
  if (decision === "approve" && run && isLivePodcastRuntime(run.runtime_status) && script.claim_support_verified !== true) {
    throw new PodcastClaimSupportError();
  }
  const releaseKit = decision === "approve" ? script.release_kit ?? fixtureReleaseKit(script) : script.release_kit;
  currentScript = {
    ...script,
    status: decision === "approve" ? "approved" : "rejected",
    release_kit: releaseKit,
    audio_status: decision === "approve" ? "ready_to_generate" : "rejected",
    review_note:
      decision === "approve"
        ? "Approved by one human script reviewer for immediate performance with the configured house voices. Publishing remains blocked."
        : "Rejected by a human script reviewer. No audio rendering or publishing is permitted.",
  };
  podcastScripts.set(currentScript.id, currentScript);
  if (decision === "reject") {
    podcastApprovalReceipts.delete(`script:${id}`);
    podcastApprovalReceipts.delete(`audio:${id}`);
  }
  persistPodcastState("decision", "script_workspace");
  return currentScript;
}

export class PodcastClaimSupportError extends Error {
  constructor() {
    super("Every concrete script claim must be directly supported by its mapped sources before approval.");
    this.name = "PodcastClaimSupportError";
  }
}

const audienceAttributionPattern = /\b(?:(?:audiences?|fans?|viewers?|people|everyone)\s+(?:want|wants|wanted|think|thinks|thought|say|says|said|believe|believes|feel|feels|expect|expects|demand|demands|ask|asks|wonder|wonders)|audience\s+(?:questions?|reaction|response|demand|sentiment|consensus)|fan\s+(?:reaction|response|demand|sentiment|consensus)|social\s+consensus)\b/i;

export function validateAudienceAttributionBoundary(
  title: string,
  sections: { script: string }[],
  sourceTypes: string[],
) {
  if (!sourceTypes.includes("community") && audienceAttributionPattern.test([title, ...sections.map((section) => section.script)].join(" "))) {
    throw new Error("Audience or fan attribution requires a mapped community source returned by Google.");
  }
}

export function createPodcastReleaseKit(scriptId: string) {
  const script = podcastScripts.get(scriptId) ?? (currentScript?.id === scriptId ? currentScript : null);
  if (!script) return { kind: "not_found" as const };
  if (script.status !== "approved") return { kind: "script_not_approved" as const };
  const releaseKit = fixtureReleaseKit(script);
  currentScript = { ...script, release_kit: releaseKit, audio_status: "awaiting_audio_approval" };
  podcastScripts.set(currentScript.id, currentScript);
  persistPodcastState("create", "release_kit");
  return { kind: "created" as const, releaseKit };
}

type SafeGroundedFinding = {
  safe_headline: string;
  aggregate_summary: string;
  what_it_supports: string;
  what_remains_uncertain: string;
};

type ResolvedGroundingPublication = {
  url: string;
  title: string;
  publisher: string;
  published_at: string | null;
  evidence: string[];
};

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function htmlMeta(html: string, key: string) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attributes = new Map<string, string>();
    for (const match of tag.matchAll(/([a-zA-Z:-]+)\s*=\s*(["'])(.*?)\2/g)) {
      attributes.set(match[1]!.toLowerCase(), decodeHtml(match[3]!));
    }
    if ([attributes.get("property"), attributes.get("name"), attributes.get("itemprop")]
      .some((value) => value?.toLowerCase() === key.toLowerCase())) {
      return attributes.get("content") ?? "";
    }
  }
  return "";
}

function publicSourceUrl(value: string) {
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" ||
    host === "localhost" ||
    host.endsWith(".local") ||
    host === "0.0.0.0" ||
    host === "::1" ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(?:1[6-9]|2\d|3[01])\./.test(host)
  ) {
    throw new Error("Grounded source redirect did not resolve to a public HTTPS publisher.");
  }
  return url;
}

function privateOrLinkLocalAddress(value: string) {
  const address = value.toLowerCase().replace(/^\[|\]$/g, "");
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b! >= 64 && b! <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b! >= 16 && b! <= 31) ||
      (a === 192 && b === 168) ||
      a! >= 224
    );
  }
  if (isIP(address) === 6) {
    if (address.startsWith("::ffff:")) return privateOrLinkLocalAddress(address.slice(7));
    return address === "::" || address === "::1" || /^f[cd]/.test(address) || /^fe[89ab]/.test(address);
  }
  return false;
}

async function assertPublicNetworkTarget(url: URL) {
  if (privateOrLinkLocalAddress(url.hostname)) {
    throw new Error("Grounded source destination resolved to a private or link-local address.");
  }
  if (isIP(url.hostname.replace(/^\[|\]$/g, ""))) return;
  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => privateOrLinkLocalAddress(address))) {
    throw new Error("Grounded source destination resolved to a private or link-local address.");
  }
}

export function validateGoogleGroundingRedirectUrl(value: string) {
  const url = publicSourceUrl(value);
  if (
    url.hostname.toLowerCase() !== "vertexaisearch.cloud.google.com" ||
    !url.pathname.startsWith("/grounding-api-redirect/")
  ) {
    throw new Error("Only Google grounding redirect URLs may be resolved.");
  }
  return url;
}

function groundedSourceClass(value: string) {
  const host = new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  return /(?:^|\.)(?:reddit\.com|x\.com|twitter\.com|threads\.net|facebook\.com|instagram\.com|tiktok\.com|bsky\.app)$/.test(host)
    ? "community"
    : /(?:^|\.)(?:youtube\.com|youtu\.be)$/.test(host)
      ? "video_platform"
      : "publisher_reporting";
}

export function retainsIdentityBearingSocialPath(value: string) {
  const url = publicSourceUrl(value);
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const identityBearingHosts = new Set([
    "facebook.com",
    "reddit.com",
    "x.com",
    "twitter.com",
    "threads.net",
    "tiktok.com",
  ]);
  return identityBearingHosts.has(host) && /(?:^|\/)(?:@[^/]+|posts?|status|comments|user|users)(?:\/|$)/i.test(url.pathname);
}

export function extractPublishedSourceMetadata(html: string, finalUrl: string, googleTitle = ""): ResolvedGroundingPublication {
  const url = publicSourceUrl(finalUrl);
  const titleTag = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  const title = decodeHtml(htmlMeta(html, "og:title") || htmlMeta(html, "twitter:title") || titleTag || googleTitle);
  const publisher = decodeHtml(
    htmlMeta(html, "og:site_name") ||
    htmlMeta(html, "application-name") ||
    url.hostname.replace(/^www\./, ""),
  );
  const rawPublishedAt =
    htmlMeta(html, "article:published_time") ||
    htmlMeta(html, "datePublished") ||
    htmlMeta(html, "date") ||
    html.match(/"datePublished"\s*:\s*"([^"]+)"/i)?.[1] ||
    "";
  const publishedTime = Date.parse(rawPublishedAt);
  if (!title || title.length > 240 || !publisher || publisher.length > 120) {
    throw new Error("Publisher title and publisher are required for every grounded source.");
  }
  return {
    url: url.toString(),
    title,
    publisher,
    published_at: Number.isFinite(publishedTime) ? new Date(publishedTime).toISOString() : null,
    evidence: [title, publisher, Number.isFinite(publishedTime) ? new Date(publishedTime).toISOString() : "Publication date unknown"],
  };
}

function googleGroundingPublication(url: URL, googleTitle: string): ResolvedGroundingPublication {
  const title = decodeHtml(googleTitle);
  const publisher = url.hostname.toLowerCase().replace(/^www\./, "");
  if (!title || title.length > 240) {
    throw new Error("Google grounding did not provide a usable public page title.");
  }
  return {
    url: url.toString(),
    title,
    publisher,
    published_at: null,
    evidence: [title, publisher, "Publication date unknown"],
  };
}

async function resolveGroundingPublication(sourceUrl: string, googleTitle: string) {
  let current = validateGoogleGroundingRedirectUrl(sourceUrl);
  const signal = AbortSignal.timeout(12_000);
  for (let redirect = 0; redirect < 6; redirect += 1) {
    await assertPublicNetworkTarget(current);
    const response = await fetch(current, {
      redirect: "manual",
      signal,
      headers: {
        "user-agent": "AutographyEvidenceResolver/1.0",
        accept: "text/html,application/xhtml+xml",
      },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Grounded source redirect omitted its destination.");
      current = publicSourceUrl(new URL(location, current).toString());
      continue;
    }
    if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) {
      await response.body?.cancel();
      return googleGroundingPublication(current, googleTitle);
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Grounded publisher metadata response had no body.");
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    while (bytes < 131_072) {
      const { done, value } = await reader.read();
      if (done) break;
      const remaining = 131_072 - bytes;
      chunks.push(value.byteLength > remaining ? value.slice(0, remaining) : value);
      bytes += Math.min(value.byteLength, remaining);
      if (Buffer.concat(chunks).includes(Buffer.from("</head>"))) break;
    }
    await reader.cancel();
    const html = Buffer.concat(chunks).toString("utf8");
    return extractPublishedSourceMetadata(html, current.toString(), googleTitle);
  }
  throw new Error("Grounded source exceeded the redirect limit.");
}

export function validateSafeGroundedFinding(
  input: {
    safe_headline?: unknown;
    aggregate_summary?: unknown;
    what_it_supports?: unknown;
    what_remains_uncertain?: unknown;
  },
  rawEvidence: string[],
): SafeGroundedFinding {
  const finding = {
    safe_headline: typeof input.safe_headline === "string" ? input.safe_headline.trim() : "",
    aggregate_summary: typeof input.aggregate_summary === "string" ? input.aggregate_summary.trim() : "",
    what_it_supports: typeof input.what_it_supports === "string" ? input.what_it_supports.trim() : "",
    what_remains_uncertain: typeof input.what_remains_uncertain === "string" ? input.what_remains_uncertain.trim() : "",
  };
  const values = Object.values(finding);
  const unsafeText = /(?:https?:\/\/|www\.|[\w.+-]+@[\w.-]+|(?:^|\s)[ur]\/[\w-]+|@[a-z0-9_]+|["“”]|(?:^|\s)(?:i|i'm|i’ve|me|my|mine|we|our)\b|\b(?:open with|say|instructions?|stage direction|compliance summary|policy review|legal analysis|proves?|definitely|guilty|lied|cover[- ]?up)\b)/i;
  if (
    finding.safe_headline.split(/\s+/).length < 3 ||
    finding.safe_headline.split(/\s+/).length > 12 ||
    finding.safe_headline.length > 120 ||
    finding.aggregate_summary.length < 10 ||
    finding.aggregate_summary.length > 280 ||
    finding.what_it_supports.length < 10 ||
    finding.what_it_supports.length > 240 ||
    finding.what_remains_uncertain.length < 10 ||
    finding.what_remains_uncertain.length > 240 ||
    values.some((value) => unsafeText.test(value)) ||
    values.some((value) => /\b(?:taxonomy signal|aggregate industry data|media platforms (?:are )?testing)\b/i.test(value))
  ) {
    throw new Error("Evidence editor returned an unsafe or generic grounded finding.");
  }
  const normalizeWords = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  const rawWords = normalizeWords(rawEvidence.join(" "));
  const copiedEightWordSpans = new Set<string>();
  for (let index = 0; index <= rawWords.length - 8; index += 1) {
    copiedEightWordSpans.add(rawWords.slice(index, index + 8).join(" "));
  }
  for (const value of values) {
    const words = normalizeWords(value);
    for (let index = 0; index <= words.length - 8; index += 1) {
      if (copiedEightWordSpans.has(words.slice(index, index + 8).join(" "))) {
        throw new Error("Evidence editor copied provider text instead of paraphrasing it.");
      }
    }
  }
  return finding;
}

export async function searchPodcastContexts(
  query: string,
  audience: string,
  useCase: string,
  provider: "google_public_web" = "google_public_web",
  window: "past_24_hours" | "past_7_days" | "past_30_days" = "past_7_days",
  sourceClasses: string[] = [],
): Promise<PodcastContextSearchResponse> {
  if (process.env.PODCAST_SYNTHETIC_DEMO !== "true") {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Google Search grounded podcast search is not configured; set PODCAST_SYNTHETIC_DEMO=true only for an explicit demo.");
    const ai = new GoogleGenAI({ apiKey });
    const windowLabel = {
      past_24_hours: "the past 24 hours",
      past_7_days: "the past 7 days",
      past_30_days: "the past 30 days",
    }[window];
    const windowDays = { past_24_hours: 1, past_7_days: 7, past_30_days: 30 }[window];
    const before = new Date();
    before.setUTCDate(before.getUTCDate() + 1);
    const after = new Date();
    after.setUTCDate(after.getUTCDate() - windowDays);
    const googleDateOperators = `after:${after.toISOString().slice(0, 10)} before:${before.toISOString().slice(0, 10)}`;
    const scout = await yieldPodcastMutationLock(() => runPodcastAdkResearch({
      model,
      query,
      windowLabel,
      googleDateOperators,
    }));
    const chunks = scout.groundingMetadata.groundingChunks ?? [];
    const supports = scout.groundingMetadata.groundingSupports ?? [];
    const web = chunks.flatMap((chunk: any, chunkIndex: number) =>
      chunk.web?.uri && chunk.web?.title ? [{ ...chunk.web, chunkIndex }] : []);
    let unique = [...new Map(web.map((item: any) => [item.uri, item])).values()].slice(0, 5);
    if (unique.length < 2) throw new Error("Google Search returned fewer than two unique web sources.");
    const sourceIndexByChunk = new Map(
      unique.map((item: any, sourceIndex) => [item.chunkIndex, sourceIndex + 1]),
    );
    let evidenceInventory: { source_refs: number[]; aggregate_text: string }[] = supports.flatMap((support: any) => {
      const text = support.segment?.text?.trim();
      const sourceRefs = (support.groundingChunkIndices ?? [])
        .map((chunkIndex: number) => sourceIndexByChunk.get(chunkIndex))
        .filter((sourceIndex: number | undefined): sourceIndex is number => sourceIndex !== undefined);
      return text && sourceRefs.length ? [{ source_refs: sourceRefs, aggregate_text: text }] : [];
    });
    const supportedSourceRefs = new Set(evidenceInventory.flatMap((item) => item.source_refs));
    if (supportedSourceRefs.size < 2) throw new Error("Google Search returned fewer than two source-linked web sources.");
    const retainedOldRefs = [...supportedSourceRefs].sort((a, b) => a - b).slice(0, 5);
    const retainedRefMap = new Map(retainedOldRefs.map((oldRef, index) => [oldRef, index + 1]));
    unique = retainedOldRefs.map((oldRef) => unique[oldRef - 1]!);
    evidenceInventory = evidenceInventory.flatMap((item) => {
      const sourceRefs = item.source_refs
        .map((oldRef) => retainedRefMap.get(oldRef))
        .filter((sourceRef): sourceRef is number => sourceRef !== undefined);
      return sourceRefs.length ? [{ ...item, source_refs: sourceRefs }] : [];
    });
    let sourceEvidence = unique.map((_, index) =>
      evidenceInventory
        .filter((item) => item.source_refs.includes(index + 1))
        .map((item) => item.aggregate_text));
    let publications = await Promise.all(unique.map((item: any) => resolveGroundingPublication(item.uri, item.title)));
    const safePublicationIndexes = publications
      .map((publication, index) => retainsIdentityBearingSocialPath(publication.url) ? -1 : index)
      .filter((index) => index >= 0);
    unique = safePublicationIndexes.map((index) => unique[index]!);
    sourceEvidence = safePublicationIndexes.map((index) => sourceEvidence[index]!);
    publications = safePublicationIndexes.map((index) => publications[index]!);
    if (publications.length < 2) {
      throw new Error("Grounded search retained fewer than two sources after identity-bearing social links were excluded.");
    }
    if (new Set(publications.map((publication) => new URL(publication.url).hostname.toLowerCase().replace(/^www\./, ""))).size < 2) {
      throw new Error("Grounded search must resolve to at least two distinct public publisher domains.");
    }
    for (const publication of publications) {
      const publishedTime = publication.published_at ? Date.parse(publication.published_at) : Number.NaN;
      if (Number.isFinite(publishedTime) && (publishedTime < after.getTime() || publishedTime >= before.getTime())) {
        throw new Error("Grounded publisher date falls outside the requested search window.");
      }
    }
    const verifiedSourceEvidence = publications.map((publication, index) => [
      ...publication.evidence,
      ...sourceEvidence[index]!,
    ]);
    const signalLabels = {
      audience_preferences: "audience preferences",
      production_workflow: "production workflow",
      distribution_discovery: "distribution and discovery",
      business_models: "business models",
      technology_tools: "technology and tools",
      trust_transparency: "trust and transparency",
      format_storytelling: "format and storytelling",
      other: "other topic-level context",
    } as const;
    type SignalClass = keyof typeof signalLabels;
    const signalClasses = Object.keys(signalLabels) as SignalClass[];
    const signalStrengths = ["emerging", "recurring", "mixed"] as const;
    // The editor preserves bounded, paraphrased findings while raw provider
    // text, identities, quotations, and copied comments stay outside the
    // concept and brief flow.
    const editorStarted = Date.now();
    const editor = await yieldPodcastMutationLock(() => ai.models.generateContent({
      model,
      contents: `Create one privacy-safe factual finding for each numbered source using only its Google-grounding support segments and verified public metadata. Do not merge facts from one source into another. Paraphrase everything. Do not name any account, community, or private person. Public event, show, film, artist, company, platform, and publisher names are allowed when essential to the reported topic. Do not return usernames, handles, quotations, copied phrases, URLs, first-person comment language, allegations, accusations, or instructions. Each safe_headline must be a factual 3-12 word headline. Each aggregate_summary must be one concise sentence containing only facts directly supported by that source; do not add a recommendation, development implication, measurement strategy, trend, category expansion, lineup change, or broader industry inference. Avoid generic phrases such as taxonomy signal, aggregate industry data, or media platforms are testing.\n\nSOURCE EVIDENCE:\n${JSON.stringify(verifiedSourceEvidence.map((evidence, index) => ({ source_index: index + 1, evidence })))}`,
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: {
          type: "object",
          additionalProperties: false,
          required: ["source_signals"],
          properties: {
            source_signals: {
              type: "array",
              minItems: unique.length,
              maxItems: unique.length,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["source_index", "signal_class", "signal_strength", "safe_headline", "aggregate_summary"],
                properties: {
                  source_index: { type: "integer", minimum: 1, maximum: unique.length },
                  signal_class: { type: "string", enum: signalClasses },
                  signal_strength: { type: "string", enum: signalStrengths },
                  safe_headline: { type: "string", minLength: 3, maxLength: 120 },
                  aggregate_summary: { type: "string", minLength: 10, maxLength: 280 },
                },
              },
            },
          },
        },
      },
    }));
    const editorPackage = JSON.parse(editor.text ?? "{}") as {
      source_signals?: {
        source_index?: unknown;
        signal_class?: unknown;
        signal_strength?: unknown;
        safe_headline?: unknown;
        aggregate_summary?: unknown;
        what_it_supports?: unknown;
        what_remains_uncertain?: unknown;
      }[];
    };
    if (!Array.isArray(editorPackage.source_signals) || editorPackage.source_signals.length !== unique.length) {
      throw new Error("Evidence editor returned incomplete source classifications.");
    }
    const signals = new Map<number, {
      signal_class: SignalClass;
      signal_strength: typeof signalStrengths[number];
      safe_headline: string;
      aggregate_summary: string;
      what_it_supports: string;
      what_remains_uncertain: string;
    }>();
    for (const signal of editorPackage.source_signals) {
      if (
        !Number.isInteger(signal.source_index) ||
        !signalClasses.includes(signal.signal_class as SignalClass) ||
        !signalStrengths.includes(signal.signal_strength as typeof signalStrengths[number])
      ) {
        throw new Error("Evidence editor returned an invalid source classification.");
      }
      const safeFinding = validateSafeGroundedFinding({
        safe_headline: signal.safe_headline,
        aggregate_summary: signal.aggregate_summary,
        what_it_supports: signal.aggregate_summary,
        what_remains_uncertain: "This source alone does not establish any additional event details beyond the supported finding.",
      }, verifiedSourceEvidence[(signal.source_index as number) - 1] ?? []);
      signals.set(signal.source_index as number, {
        signal_class: signal.signal_class as SignalClass,
        signal_strength: signal.signal_strength as typeof signalStrengths[number],
        ...safeFinding,
      });
    }
    if (signals.size !== unique.length) throw new Error("Evidence editor returned duplicate source classifications.");
    const verifierStarted = Date.now();
    const verifier = await yieldPodcastMutationLock(() => ai.models.generateContent({
      model,
      contents: `Verify each numbered factual finding against only the correspondingly numbered source evidence. Mark supported true only if every concrete claim in aggregate_summary and what_it_supports is directly entailed by that source evidence. Plausible implications, measurement strategies, trend extensions, broader category restructuring, cross-genre claims, lineup changes, or facts borrowed from another source are unsupported. Return one check per source with source_index, supported, and unsupported_claims.\n\nSOURCE EVIDENCE:${JSON.stringify(verifiedSourceEvidence.map((evidence, index) => ({ source_index: index + 1, evidence })))}\n\nFINDINGS:${JSON.stringify([...signals.entries()].map(([source_index, finding]) => ({ source_index, aggregate_summary: finding.aggregate_summary, what_it_supports: finding.what_it_supports })))}`,
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: {
          type: "object",
          additionalProperties: false,
          required: ["checks"],
          properties: {
            checks: {
              type: "array",
              minItems: unique.length,
              maxItems: unique.length,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["source_index", "supported", "unsupported_claims"],
                properties: {
                  source_index: { type: "integer", minimum: 1, maximum: unique.length },
                  supported: { type: "boolean" },
                  unsupported_claims: { type: "array", items: { type: "string" } },
                },
              },
            },
          },
        },
      },
    }));
    const findingChecks = JSON.parse(verifier.text ?? "{}") as { checks?: unknown };
    validateGroundedFindingSupport(findingChecks.checks, unique.length);
    const sources = unique.map((item: any, index) => {
      const id = `web-${index + 1}-${randomUUID()}`;
      const signal = signals.get(index + 1)!;
      const publication = publications[index]!;
      const evidenceGaps = [
        "The bounded editorial paraphrase preserves no account identities, quotations, copied comments, or raw provider text.",
        "The bounded result does not establish intent, identity, representativeness, or platform-wide opinion.",
        publication.published_at
          ? `The publisher date was resolved from explicit destination metadata and checked against ${windowLabel}.`
          : "The publisher did not expose a publication date in the bounded metadata response; publication date remains unknown.",
      ];
      return {
        id,
        url: publication.url,
        source_identifier: createHash("sha256").update(publication.url).digest("hex").slice(0, 16),
        title: publication.title,
        publisher: publication.publisher,
        published_at: publication.published_at,
        retrieved_at: now(),
        snippet: "",
        source_type: groundedSourceClass(publication.url),
        classification: "source_backed" as const,
        consent_reference: publicWebConsentReference,
        policy_reference: currentContextPolicyReference,
        aggregate_summary: signal.aggregate_summary,
        evidence_gaps: evidenceGaps,
        what_it_supports: signal.what_it_supports,
        what_remains_uncertain: `${signal.what_remains_uncertain} ${evidenceGaps.join(" ")}`,
      };
    });
    const observedLabels = [...new Set([...signals.values()].map((signal) => signalLabels[signal.signal_class]))];
    const observedContext = observedLabels.join(", ");
    const unresolvedQuestions = [
      "The provider-requested time bound was not independently verified from publication metadata.",
      "The bounded findings cannot establish identity, intent, representativeness, or platform-wide opinion.",
    ];
    const concept: PodcastConcept = {
      id: `concept-${randomUUID()}`,
      title: `Live search: ${query.slice(0, 120)}`,
      summary: sources.map((source) => source.aggregate_summary).join(" "),
      relevance: 0.5,
      urgency: 0.5,
      engagement: 0.5,
      freshness: 0.5,
      source_diversity: 1,
      source_ids: sources.map((source) => source.id),
      observed_signal: sources.map((source) => source.what_it_supports).join(" "),
      supported_context: `Identity-free source findings classify into: ${observedContext}. Raw provider text never enters development.`,
      unresolved_questions: unresolvedQuestions,
      recommended_route: "producer_review",
      next_reviewer: "Producer / standards reviewer",
      confidence_label: "bounded · source-grounded",
      freshness_label: "retrieved this run",
      status: "needs_review",
    };
    const run: PodcastGroundedRun = {
      id: `run-${randomUUID()}`, query, provider, window, policy_reference: currentContextPolicyReference, runtime_status: "Live Google ADK", sources, concept,
      uncertainties: unresolvedQuestions,
      grounding_support: "Google ADK executed the source scout; Google Search grounding metadata supplied the cited public web sources.",
      agent_executions: [
        { ...scout.execution, parent_execution_id: scout.execution.execution_id },
        { agent: "evidence_editor", provider: "Google Gemini", framework: "Direct @google/genai", model, execution_id: randomUUID(), parent_execution_id: scout.execution.execution_id, tools: [], latency_ms: Date.now() - editorStarted, status: "completed", activity: "Created bounded, identity-free paraphrases of supported source findings." },
        { agent: "evidence_verifier", provider: "Google Gemini", framework: "Direct @google/genai", model, execution_id: randomUUID(), parent_execution_id: scout.execution.execution_id, tools: [], latency_ms: Date.now() - verifierStarted, status: "completed", activity: "Rejected source findings unless every transformed claim was directly supported." },
      ],
    };
    podcastGroundedRuns.set(run.id, run);
    const roomSources = groundedRunRoomSources(run);
    rehydrateActiveGroundedIndexes();
    persistPodcastState("create", "grounded_run");
    return { query, audience, use_case: useCase, provider, window, policy_reference: currentContextPolicyReference, generated_at: now(), search_mode: "google_search_grounded", grounded_run: run, results: [{ concept, sources: roomSources, match_reason: `Google public-web search was run with the requested ${windowLabel} bound; source publication timing remains an explicit evidence gap.`, speculation: "Unresolved questions remain unverified.", safest_next_reviewer: concept.next_reviewer }] };
  }
  const terms = query.toLowerCase().split(/\W+/).filter((term) => term.length > 2);
  const allowedSources = allPodcastSources().filter(
    (source) => !sourceClasses.length || sourceClasses.includes(source.source_class ?? source.platform),
  );
  const scored = allPodcastConcepts().map((concept) => {
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
    search_mode: "synthetic_demo",
    provider: "synthetic_fixture",
    window,
    policy_reference: currentContextPolicyReference,
    grounded_run: createSyntheticGroundedRun(query, window),
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

function createSyntheticGroundedRun(
  query: string,
  window: "past_24_hours" | "past_7_days" | "past_30_days",
): PodcastGroundedRun {
  const sources = podcastSources.slice(0, 3).map((source) => ({
    id: source.id,
    url: source.source_url,
    source_identifier: source.source_id ?? source.id,
    title: source.post_title,
    retrieved_at: source.retrieved_at,
    snippet: "Synthetic demonstration source; not a live web retrieval.",
    source_type: "synthetic_demo",
    consent_reference: null,
    policy_reference: "synthetic-fixture-policy-v1",
    aggregate_summary: "Synthetic topic-level fixture; no live retrieval or individual identity is represented.",
    evidence_gaps: ["This fixture is not current public-web evidence."],
    classification: "source_backed" as const,
    what_it_supports: "A synthetic demonstration of the source-backed workflow.",
    what_remains_uncertain: "It is not current public-web evidence.",
  }));
  const concept = podcastConcepts[0]!;
  const run: PodcastGroundedRun = {
    id: `run-demo-${randomUUID()}`,
    query,
    provider: "synthetic_fixture",
    window,
    policy_reference: "synthetic-fixture-policy-v1",
    runtime_status: "Synthetic Demo",
    sources,
    concept,
    uncertainties: concept.unresolved_questions,
    grounding_support: "Synthetic demonstration only; no live Google Search retrieval occurred.",
    agent_executions: [
      { agent: "source_scout", provider: "synthetic-demo", framework: "Deterministic fixture", model: "none", execution_id: randomUUID(), tools: [], latency_ms: 0, status: "completed", activity: "Prepared synthetic demo sources." },
      { agent: "evidence_editor", provider: "synthetic-demo", framework: "Deterministic fixture", model: "none", execution_id: randomUUID(), tools: [], latency_ms: 0, status: "completed", activity: "Prepared one synthetic demo concept and uncertainties." },
    ],
  };
  podcastGroundedRuns.set(run.id, run);
  rehydrateActiveGroundedIndexes();
  persistPodcastState("create", "grounded_run");
  return run;
}

export function attestPodcastCuttingRoom(
  runId: string,
  input: { decision: "add" | "decline"; raw_text?: string; permitted_public_summary?: string; authorized_uses?: string[] },
  signer: string,
) {
  if (!podcastGroundedRuns.has(runId)) return null;
  const existing = podcastAttestations.get(runId);
  if (existing) {
    const { raw_text: existingRaw, ...safeExisting } = existing;
    const same = existing.decision === input.decision &&
      (input.decision === "decline" || (existingRaw === input.raw_text?.trim() && existing.permitted_public_summary === input.permitted_public_summary?.trim() && existing.signer === signer.trim() && JSON.stringify(existing.authorized_uses) === JSON.stringify(input.authorized_uses ?? [])));
    return same ? safeExisting : "immutable" as const;
  }
  if (input.decision === "add" && (!nonEmptyString(input.raw_text) || !nonEmptyString(input.permitted_public_summary) || !nonEmptyString(signer) || !input.authorized_uses?.length)) {
    return false;
  }
  const attestation: PodcastCuttingRoomAttestation & { raw_text?: string } = {
    id: `attestation-${randomUUID()}`,
    run_id: runId,
    decision: input.decision,
    attested: input.decision === "add",
    signer: input.decision === "add" ? signer.trim() : null,
    permitted_public_summary: input.decision === "add" ? input.permitted_public_summary!.trim() : null,
    authorized_uses: input.decision === "add" ? input.authorized_uses! : [],
    created_at: now(),
    ...(input.decision === "add" ? { raw_text: input.raw_text!.trim() } : {}),
  };
  podcastAttestations.set(runId, attestation);
  persistPodcastState("create", "cutting_room_attestation");
  // Never return raw_text even to this route response.
  const { raw_text: _raw, ...safe } = attestation;
  return safe;
}

export function resetPodcastDemo(producerId: string) {
  currentBrief = null;
  currentScript = null;
  podcastBriefs.clear();
  podcastScripts.clear();
  podcastDevelopmentPlans.clear();
  podcastGroundedRuns.clear();
  podcastAttestations.clear();
  podcastCutKeys.clear();
  podcastAudioAssets.clear();
  podcastApprovalReceipts.clear();
  podcastExecutionRecords.clear();
  activeGroundedSources.splice(0);
  activeGroundedConcepts.splice(0);
  persistPodcastState("reset", "podcast_demo");
  return {
    room: getPodcastRoom(producerId),
    pre_staged_input: {
      query: "editing context and audience trust",
      audience: "consumers" as const,
      use_case: "recap" as const,
      provider: "google_public_web" as const,
      window: "past_7_days" as const,
    },
  };
}

export function getPodcastCutKey(key: string) {
  return podcastCutKeys.get(key) ?? null;
}

type PodcastCutKeyCanonicalInput = Pick<
  PodcastCutKey,
  | "clip_id"
  | "transcript"
  | "transcript_sha256"
  | "adk_execution_id"
  | "run_id"
  | "script_id"
  | "script_sha256"
  | "source_manifest_sha256"
  | "execution_envelope"
  | "source_ids"
  | "source_evidence"
  | "generated_at"
  | "production"
  | "voice_disclosure"
  | "format_disclosure"
  | "audio_sha256"
  | "integrity_disclaimer"
>;

function podcastCutKeyCanonicalPayload(manifest: PodcastCutKeyCanonicalInput) {
  return {
    clip_id: manifest.clip_id,
    transcript: manifest.transcript,
    transcript_sha256: manifest.transcript_sha256,
    ...(manifest.adk_execution_id ? { adk_execution_id: manifest.adk_execution_id } : {}),
    ...(manifest.run_id ? { run_id: manifest.run_id } : {}),
    ...(manifest.script_id ? { script_id: manifest.script_id } : {}),
    ...(manifest.script_sha256 ? { script_sha256: manifest.script_sha256 } : {}),
    ...(manifest.source_manifest_sha256 ? { source_manifest_sha256: manifest.source_manifest_sha256 } : {}),
    ...(manifest.execution_envelope ? {
      execution_envelope: {
        parent_execution_id: manifest.execution_envelope.parent_execution_id,
        run_id: manifest.execution_envelope.run_id,
        script_id: manifest.execution_envelope.script_id,
        stages: manifest.execution_envelope.stages.map((stage) => ({
          stage: stage.stage,
          agent: stage.agent,
          provider: stage.provider,
          framework: stage.framework,
          model: stage.model,
          execution_id: stage.execution_id,
          parent_execution_id: stage.parent_execution_id,
          tools: stage.tools,
          status: stage.status,
          activity: stage.activity,
        })),
        authority_boundary: {
          type: manifest.execution_envelope.authority_boundary.type,
          script_approved_at: manifest.execution_envelope.authority_boundary.script_approved_at,
          media_render_authorized_at: manifest.execution_envelope.authority_boundary.media_render_authorized_at,
          script_sha256: manifest.execution_envelope.authority_boundary.script_sha256,
          ...(manifest.execution_envelope.authority_boundary.authority_records ? {
            authority_records: manifest.execution_envelope.authority_boundary.authority_records.map((record) => ({
              receipt_id: record.receipt_id,
              authority_record_type: record.authority_record_type,
              reviewer_reference: record.reviewer_reference,
              decided_at: record.decided_at,
              script_sha256: record.script_sha256,
              source_run_id: record.source_run_id,
              policy_version: record.policy_version,
            })),
          } : {}),
          ...(manifest.execution_envelope.authority_boundary.publication_status ? {
            publication_status: manifest.execution_envelope.authority_boundary.publication_status,
          } : {}),
        },
      },
    } : {}),
    source_ids: manifest.source_ids,
    ...(manifest.source_evidence ? {
      source_evidence: manifest.source_evidence.map((source) => ({
        id: source.id,
        url: source.url,
        title: source.title,
        publisher: source.publisher,
        published_at: source.published_at,
        retrieved_at: source.retrieved_at,
        source_class: source.source_class,
        aggregate_summary: source.aggregate_summary,
        what_it_supports: source.what_it_supports,
      })),
    } : {}),
    generated_at: manifest.generated_at,
    production: {
      synthetic: manifest.production.synthetic,
      provider: manifest.production.provider,
      model: manifest.production.model,
    },
    voice_disclosure: manifest.voice_disclosure,
    format_disclosure: manifest.format_disclosure,
    audio_sha256: manifest.audio_sha256,
    integrity_disclaimer: manifest.integrity_disclaimer,
  };
}

function podcastSourceManifestSha256(
  sourceIds: string[],
  sourceEvidence: NonNullable<PodcastCutKey["source_evidence"]>,
) {
  return createHash("sha256").update(JSON.stringify({
    source_ids: sourceIds,
    source_evidence: sourceEvidence.map((source) => ({
      id: source.id,
      url: source.url,
      title: source.title,
      publisher: source.publisher,
      published_at: source.published_at,
      retrieved_at: source.retrieved_at,
      source_class: source.source_class,
      aggregate_summary: source.aggregate_summary,
      what_it_supports: source.what_it_supports,
    })),
  })).digest("hex");
}

function podcastCutKeyManifestSha256(manifest: PodcastCutKeyCanonicalInput) {
  return createHash("sha256")
    .update(JSON.stringify(podcastCutKeyCanonicalPayload(manifest)))
    .digest("hex");
}

function hasValidPodcastExecutionEnvelope(manifest: Partial<PodcastCutKey>) {
  const traceFields = [
    manifest.adk_execution_id,
    manifest.run_id,
    manifest.script_id,
    manifest.script_sha256,
    manifest.source_manifest_sha256,
    manifest.execution_envelope,
  ];
  if (traceFields.every((field) => field === undefined)) return true;
  if (
    !nonEmptyString(manifest.adk_execution_id) ||
    !nonEmptyString(manifest.run_id) ||
    !nonEmptyString(manifest.script_id) ||
    !nonEmptyString(manifest.script_sha256) ||
    !nonEmptyString(manifest.source_manifest_sha256) ||
    !manifest.execution_envelope ||
    !Array.isArray(manifest.source_evidence)
  ) return false;
  const envelope = manifest.execution_envelope;
  const authorityRecords = envelope.authority_boundary.authority_records;
  if (
    envelope.parent_execution_id !== manifest.adk_execution_id ||
    envelope.run_id !== manifest.run_id ||
    envelope.script_id !== manifest.script_id ||
    envelope.authority_boundary.type !== "human_script_approval" ||
    envelope.authority_boundary.script_sha256 !== manifest.script_sha256 ||
    manifest.script_sha256 !== manifest.transcript_sha256 ||
    !nonEmptyString(envelope.authority_boundary.script_approved_at) ||
    !nonEmptyString(envelope.authority_boundary.media_render_authorized_at) ||
    podcastSourceManifestSha256(manifest.source_ids ?? [], manifest.source_evidence) !== manifest.source_manifest_sha256
  ) return false;
  if (authorityRecords !== undefined) {
    const [scriptRecord, audioRecord] = authorityRecords;
    if (
      authorityRecords.length !== 2 ||
      scriptRecord?.authority_record_type !== "SCRIPT_APPROVED" ||
      audioRecord?.authority_record_type !== "AUDIO_RENDER_AUTHORIZED" ||
      !nonEmptyString(scriptRecord.receipt_id) ||
      !nonEmptyString(audioRecord.receipt_id) ||
      scriptRecord.receipt_id === audioRecord.receipt_id ||
      !/^[a-f0-9]{64}$/.test(scriptRecord.reviewer_reference) ||
      scriptRecord.reviewer_reference !== audioRecord.reviewer_reference ||
      scriptRecord.decided_at !== envelope.authority_boundary.script_approved_at ||
      audioRecord.decided_at !== envelope.authority_boundary.media_render_authorized_at ||
      scriptRecord.decided_at !== audioRecord.decided_at ||
      scriptRecord.script_sha256 !== manifest.script_sha256 ||
      audioRecord.script_sha256 !== manifest.script_sha256 ||
      scriptRecord.source_run_id !== manifest.run_id ||
      audioRecord.source_run_id !== manifest.run_id ||
      !nonEmptyString(scriptRecord.policy_version) ||
      scriptRecord.policy_version !== audioRecord.policy_version ||
      envelope.authority_boundary.publication_status !== "blocked_until_final_approval"
    ) return false;
  } else if (envelope.authority_boundary.publication_status !== undefined) {
    return false;
  }
  const expectedStages = [
    ["grounded_research", "source_scout"],
    ["editorial_synthesis", "evidence_editor"],
    ["editorial_synthesis", "evidence_verifier"],
    ["script_generation", "script_performer"],
    ["media_render", "audio_performer"],
  ] as const;
  if (envelope.stages.length !== expectedStages.length) return false;
  if (envelope.stages.some((stage, index) =>
    stage.stage !== expectedStages[index]![0] ||
    stage.agent !== expectedStages[index]![1] ||
    stage.status !== "completed" ||
    stage.parent_execution_id !== manifest.adk_execution_id ||
    !nonEmptyString(stage.execution_id) ||
    !nonEmptyString(stage.framework) ||
    !nonEmptyString(stage.activity)
  )) return false;
  const researchStage = envelope.stages[0]!;
  const mediaStage = envelope.stages[4]!;
  return (
    researchStage.execution_id === manifest.adk_execution_id &&
    researchStage.framework === podcastAdkFramework &&
    podcastAdkTools.every((tool) => researchStage.tools.includes(tool)) &&
    mediaStage.provider === "Google Gemini" &&
    mediaStage.model === manifest.production?.model
  );
}

function isValidPodcastCutKey(candidate: unknown): candidate is PodcastCutKey {
  if (!candidate || typeof candidate !== "object") return false;
  const manifest = candidate as Partial<PodcastCutKey>;
  if (
    typeof manifest.key !== "string" ||
    typeof manifest.manifest_sha256 !== "string" ||
    typeof manifest.clip_id !== "string" ||
    typeof manifest.audio_url !== "string" ||
    typeof manifest.transcript !== "string" ||
    typeof manifest.transcript_sha256 !== "string" ||
    !Array.isArray(manifest.source_ids) ||
    typeof manifest.generated_at !== "string" ||
    !manifest.production ||
    typeof manifest.voice_disclosure !== "string" ||
    typeof manifest.format_disclosure !== "string" ||
    typeof manifest.audio_sha256 !== "string" ||
    typeof manifest.integrity_disclaimer !== "string"
  ) return false;
  const transcriptSha256 = createHash("sha256").update(manifest.transcript).digest("hex");
  if (transcriptSha256 !== manifest.transcript_sha256) return false;
  if (!hasValidPodcastExecutionEnvelope(manifest)) return false;
  const manifestSha256 = podcastCutKeyManifestSha256(manifest as PodcastCutKey);
  return (
    manifest.manifest_sha256 === manifestSha256 &&
    manifest.key === `cut-${manifestSha256}` &&
    manifest.audio_url === `/api/podcast/cut-keys/${manifest.key}/audio`
  );
}

export async function getPublicPodcastCutKey(key: string) {
  if (process.env.PODCAST_DURABILITY_DISABLED === "true") {
    const manifest = podcastCutKeys.get(key);
    return isValidPodcastCutKey(manifest) ? manifest : null;
  }
  const stored = await loadPodcastStateFromDatabase();
  const state = stored?.state as PersistedPodcastState | undefined;
  const manifest = state?.cutKeys?.find((candidate) => candidate.key === key);
  return isValidPodcastCutKey(manifest) ? manifest : null;
}

function latestEligibleJudgeManifest(
  cutKeys: Iterable<PodcastCutKey>,
  activeClipIds: ReadonlySet<string>,
) {
  return [...cutKeys]
    .filter(
      (manifest) =>
        isValidPodcastCutKey(manifest) &&
        manifest.production.synthetic === false &&
        activeClipIds.has(manifest.clip_id),
    )
    .sort((left, right) => Date.parse(right.generated_at) - Date.parse(left.generated_at))[0] ?? null;
}

export async function getPublicPodcastJudgeManifest() {
  if (process.env.PODCAST_DURABILITY_DISABLED === "true") {
    const activeClipIds = new Set(
      [...podcastScripts.values()]
        .filter((script) => script.audio_status === "generated" && script.audio_clip)
        .map((script) => script.audio_clip!.id),
    );
    return latestEligibleJudgeManifest(podcastCutKeys.values(), activeClipIds);
  }
  const stored = await loadPodcastStateFromDatabase();
  const state = stored?.state as PersistedPodcastState | undefined;
  if (!state) return null;
  const activeClipIds = new Set(
    state.scripts
      .filter((script) => script.audio_status === "generated" && script.audio_clip)
      .map((script) => script.audio_clip!.id),
  );
  return latestEligibleJudgeManifest(state.cutKeys ?? [], activeClipIds);
}

export async function getPublicPodcastAudioCutKey(key: string) {
  if (process.env.PODCAST_DURABILITY_DISABLED === "true") {
    const manifest = podcastCutKeys.get(key);
    if (!isValidPodcastCutKey(manifest)) return null;
    return activeGeneratedPodcastClip(manifest.clip_id) ? manifest : null;
  }
  const stored = await loadPodcastStateFromDatabase();
  const state = stored?.state as PersistedPodcastState | undefined;
  const manifest = state?.cutKeys?.find((candidate) => candidate.key === key);
  if (!isValidPodcastCutKey(manifest)) return null;
  const active = state?.scripts.some(
    (script) => script.audio_status === "generated" && script.audio_clip?.id === manifest.clip_id,
  );
  if (!active) return null;
  return manifest;
}

export function getPodcastAudioPathByCutKey(key: string) {
  const manifest = podcastCutKeys.get(key);
  if (!isValidPodcastCutKey(manifest)) return null;
  if (!activeGeneratedPodcastClip(manifest.clip_id)) return null;
  return getPodcastAudioPath(manifest.clip_id);
}

export async function getPodcastAudioFileByCutKey(key: string) {
  const manifest = await getPublicPodcastAudioCutKey(key);
  if (!manifest) return null;
  return getPodcastAudioFileForCutKey(manifest);
}

export async function getPodcastAudioFileForCutKey(manifest: PodcastCutKey) {
  if (process.env.PODCAST_DURABILITY_DISABLED === "true") return null;
  return getPodcastAudioFile(manifest.clip_id, manifest.audio_sha256);
}

export function getPodcastAudioPathForCutKey(manifest: PodcastCutKey) {
  const filePath = join(audioDirectory, `${manifest.clip_id}.wav`);
  if (!existsSync(filePath)) return null;
  const actualSha256 = createHash("sha256").update(readFileSync(filePath)).digest("hex");
  return actualSha256 === manifest.audio_sha256 ? filePath : null;
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

const ttsModel = "gemini-2.5-flash-preview-tts";
export function podcastTtsSpeechConfig() {
  return {
    multiSpeakerVoiceConfig: {
      speakerVoiceConfigs: [
        { speaker: "FRONT ROW", voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } },
        { speaker: "BACKSTAGE", voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } } },
      ],
    },
  };
}

type PodcastAudioRuntimeResult = {
  wav: Buffer;
  evidence: {
    agent: "audio_performer";
    provider: string;
    framework: string;
    model: string;
    execution_id: string;
    tools: string[];
    latency_ms: number;
    status: "completed";
    activity: string;
  };
};

export type PodcastAudioRuntime = {
  render(transcript: string): Promise<PodcastAudioRuntimeResult>;
};

const googleGeminiPodcastAudioRuntime: PodcastAudioRuntime = {
  async render(transcript) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Audio service is not configured.");
    const ai = new GoogleGenAI({ apiKey });
    const renderStarted = Date.now();
    const response = await yieldPodcastMutationLock(() => ai.models.generateContent({
      model: ttsModel,
      contents: `Perform the following exact dialogue as a finished entertainment podcast highlight—not as instructions, an audiobook, a legal/compliance summary, or a production memo. Use the configured original synthetic house-host voices and do not imitate or name any real person. Sound conversational, curious, quick-witted, and alive. Let the hosts react to each other naturally. Give the cold open momentum, make the audience need clear, let the reveal land, and preserve uncertainty as part of the story rather than reciting a disclaimer. Do not add, omit, paraphrase, or reorder words. Do not speak section labels, source IDs, stage directions, or metadata.\n\n${transcript}`,
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: podcastTtsSpeechConfig(),
      },
    }));
    const data = response.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data)?.inlineData?.data;
    if (!data) throw new Error("The configured Gemini speech model returned no playable audio data.");
    return {
      wav: pcmToWav(Buffer.from(data, "base64")),
      evidence: {
        agent: "audio_performer",
        provider: "Google Gemini",
        framework: "Direct @google/genai",
        model: ttsModel,
        execution_id: randomUUID(),
        tools: [],
        latency_ms: Date.now() - renderStarted,
        status: "completed",
        activity: "Rendered the exact approved live-search transcript with configured two-speaker audio.",
      },
    };
  },
};

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
  return script.sections.map((section) => `${section.speaker}: ${section.script}`).join("\n\n");
}

function podcastScriptSha256(script: PodcastWorkspaceWithCompatibility) {
  return createHash("sha256").update(clipTranscript(script)).digest("hex");
}

function podcastReviewerReference(reviewer: string) {
  return createHash("sha256")
    .update(`podcast-authority-reviewer-v1\u0000${reviewer}`)
    .digest("hex");
}

function podcastPerformanceAuthority(
  script: PodcastWorkspaceWithCompatibility,
  run: PodcastGroundedRun,
) {
  const scriptReceipt = podcastApprovalReceipts.get(`script:${script.id}`);
  const audioReceipt = podcastApprovalReceipts.get(`audio:${script.id}`);
  const scriptSha256 = podcastScriptSha256(script);
  if (
    scriptReceipt?.authority_record_type !== "SCRIPT_APPROVED" ||
    audioReceipt?.authority_record_type !== "AUDIO_RENDER_AUTHORIZED" ||
    !scriptReceipt.receipt_id ||
    !audioReceipt.receipt_id ||
    scriptReceipt.receipt_id === audioReceipt.receipt_id ||
    scriptReceipt.reviewer !== audioReceipt.reviewer ||
    scriptReceipt.reviewer_reference !== audioReceipt.reviewer_reference ||
    scriptReceipt.reviewer_reference !== podcastReviewerReference(scriptReceipt.reviewer) ||
    scriptReceipt.decided_at !== audioReceipt.decided_at ||
    scriptReceipt.artifact_sha256 !== scriptSha256 ||
    audioReceipt.artifact_sha256 !== scriptSha256 ||
    scriptReceipt.source_run_id !== run.id ||
    audioReceipt.source_run_id !== run.id ||
    scriptReceipt.policy_version !== run.policy_reference ||
    audioReceipt.policy_version !== run.policy_reference ||
    scriptReceipt.parent_execution_id !== audioReceipt.parent_execution_id
  ) return null;
  return { scriptReceipt, audioReceipt, scriptSha256 };
}

function traceablePodcastRunExecutions(run: PodcastGroundedRun) {
  if (!isLivePodcastRuntime(run.runtime_status)) return null;
  const scout = run.agent_executions.find((execution) =>
    execution.agent === "source_scout" &&
    execution.status === "completed" &&
    execution.framework === podcastAdkFramework &&
    podcastAdkTools.every((tool) => execution.tools.includes(tool)),
  );
  if (!scout || scout.parent_execution_id !== scout.execution_id || !nonEmptyString(scout.activity)) return null;
  const editor = run.agent_executions.find((execution) =>
    execution.agent === "evidence_editor" &&
    execution.status === "completed" &&
    execution.parent_execution_id === scout.execution_id &&
    nonEmptyString(execution.framework) &&
    nonEmptyString(execution.activity),
  );
  const verifier = run.agent_executions.find((execution) =>
    execution.agent === "evidence_verifier" &&
    execution.status === "completed" &&
    execution.parent_execution_id === scout.execution_id &&
    nonEmptyString(execution.framework) &&
    nonEmptyString(execution.activity),
  );
  if (!editor || !verifier) return null;
  return {
    parentExecutionId: scout.execution_id,
    executions: [scout, editor, verifier] as const,
  };
}

function podcastRenderIdentity(script: PodcastWorkspaceWithCompatibility) {
  return JSON.stringify({
    workspace_revision: script.workspace_revision ?? null,
    brief_id: script.brief_id,
    title: script.title,
    status: script.status,
    audio_status: script.audio_status,
    sections: script.sections.map((section) => ({
      segment: section.segment,
      script: section.script,
      source_ids: section.source_ids,
    })),
    source_ids: script.provenance.map((source) => source.source_id),
    release_kit_status: script.release_kit?.status ?? null,
  });
}

export async function generatePodcastAudio(
  id: string,
  runtime: PodcastAudioRuntime = googleGeminiPodcastAudioRuntime,
) {
  const script = podcastScripts.get(id) ?? (currentScript?.id === id ? currentScript : null);
  if (!script) return { kind: "not_found" as const };
  if (script.audio_status !== "ready_to_generate" || !script.release_kit) return { kind: "not_approved" as const };
  const authorityError = podcastAuthorityHold(script);
  if (authorityError) return { kind: "generation_failed" as const, error: authorityError };
  const run = script.run_id ? podcastGroundedRuns.get(script.run_id) ?? null : null;
  const agenticRun = run ? traceablePodcastRunExecutions(run) : null;
  if (!agenticRun) return { kind: "generation_failed" as const, error: "Authority hold: the bound Google ADK execution envelope is required." };
  try {
    const transcript = clipTranscript(script);
    const rendered = await runtime.render(transcript);
    podcastExecutionRecords.set(`audio:${script.id}`, {
      ...rendered.evidence,
      parent_execution_id: agenticRun.parentExecutionId,
      activity: "Authorized media-render step: rendered the exact human-approved two-host script with Gemini multi-speaker audio.",
    });
    return commitGeneratedPodcastAudio(script, rendered.wav);
  } catch (error) {
    return { kind: "generation_failed" as const, error: error instanceof Error ? error.message : "Audio generation failed." };
  }
}

export function commitGeneratedPodcastAudio(
  capturedScript: PodcastWorkspaceWithCompatibility,
  wav: Buffer,
) {
  const latestScript = podcastScripts.get(capturedScript.id);
  const latestBrief = latestScript ? podcastBriefs.get(latestScript.brief_id) : null;
  if (
    !latestScript ||
    !latestBrief ||
    latestBrief.status !== "approved" ||
    latestScript.status !== "approved" ||
    latestScript.audio_status !== "ready_to_generate" ||
    !latestScript.release_kit ||
    !podcastWorkspaceMatchesBrief(latestScript, latestBrief) ||
    podcastRenderIdentity(latestScript) !== podcastRenderIdentity(capturedScript)
  ) {
    return { kind: "superseded" as const };
  }
  if (podcastAuthorityHold(latestScript)) {
    return { kind: "superseded" as const };
  }
  mkdirSync(audioDirectory, { recursive: true });
  const clipId = `clip-${latestScript.id}`;
  writeFileSync(join(audioDirectory, `${clipId}.wav`), wav);
  enqueuePodcastPersistence(
    () => process.env.PODCAST_DURABILITY_DISABLED === "true"
      ? Promise.resolve()
      : uploadPodcastAudio(clipId, wav),
    "upload",
    "podcast_audio",
  );
  const clip: PodcastAudioClip = {
    id: clipId,
    script_id: latestScript.id,
    run_id: latestScript.run_id,
    attestation_id: latestScript.attestation_id,
    status: "ready",
    audio_url: `/api/podcast/audio/${clipId}/stream`,
    mime_type: "audio/wav",
    duration_seconds: Math.max(0, Math.round((wav.length - 44) / (24000 * 2))),
    transcript: clipTranscript(latestScript),
    voice_disclosure: "Original synthetic two-speaker house-host performance · FRONT ROW: Gemini Kore; BACKSTAGE: Gemini Puck · no voice cloning or impersonation",
    format_disclosure: "Short evidence-backed performed podcast sample · not published",
    source_ids: [...new Set(latestScript.provenance.map((source) => source.source_id))],
    provenance_summary: latestScript.release_kit.provenance_summary,
    generated_at: now(),
    cut_key: null,
  };
  const cutKey = createPodcastCutKey(latestScript, clip, wav);
  if (!cutKey) return { kind: "superseded" as const };
  podcastAudioAssets.set(clipId, cutKey.audio_sha256);
  clip.cut_key = cutKey.key;
  const updated = {
    ...latestScript,
    audio_status: "generated" as const,
    audio_clip: clip,
    release_kit: { ...latestScript.release_kit, audio_status: "generated" as const },
  };
  currentScript = updated;
  podcastScripts.set(latestScript.id, updated);
  persistPodcastState("generate", "podcast_audio");
  recordAgentStage("PODCAST-AUDIO", "render", latestScript.id, `${clip.id} · ${clip.duration_seconds}s · ${clip.source_ids.length} sources`);
  return { kind: "generated" as const, clip };
}

function podcastApprovalChain(
  script: PodcastWorkspaceWithCompatibility,
  brief: PodcastBrief,
): PodcastApprovalReceipt[] | null {
  const run = brief.run_id ? podcastGroundedRuns.get(brief.run_id) : null;
  const performanceAuthority = run ? podcastPerformanceAuthority(script, run) : null;
  if (!performanceAuthority) return null;
  const receipts = run && isLivePodcastRuntime(run.runtime_status)
    ? [performanceAuthority.scriptReceipt, performanceAuthority.audioReceipt]
    : [
        brief.development_plan_id ? podcastApprovalReceipts.get(`development:${brief.development_plan_id}`) : undefined,
        podcastApprovalReceipts.get(`brief:${script.brief_id}`),
        performanceAuthority.scriptReceipt,
        performanceAuthority.audioReceipt,
      ];
  return receipts.some((receipt) => !receipt)
    ? null
    : receipts as PodcastApprovalReceipt[];
}

function podcastAuthorityHold(script: PodcastWorkspaceWithCompatibility) {
  const brief = podcastBriefs.get(script.brief_id);
  const run = brief?.run_id ? podcastGroundedRuns.get(brief.run_id) ?? null : null;
  if (!run || run.uncertainties.length === 0) return "Authority hold: an active grounded run with visible uncertainty is required.";
  if (!syntheticDemoEnabled() && !isLivePodcastRuntime(run.runtime_status)) {
    return "Authority hold: normal mode requires a live Google-grounded run.";
  }
  if (!brief || brief.status !== "approved" || script.status !== "approved" || script.audio_status !== "ready_to_generate") {
    return "Authority hold: the current live brief and its human-approved script are required.";
  }
  if (!brief.development_plan_id || podcastDevelopmentPlans.get(brief.development_plan_id)?.status !== "validated") {
    return "Authority hold: a current episode angle selection is required.";
  }
  if (!podcastApprovalChain(script, brief)) {
    return "Authority hold: matching SCRIPT_APPROVED and AUDIO_RENDER_AUTHORIZED records are required.";
  }
  if (script.release_kit?.publishing_status !== "blocked_until_final_approval") {
    return "Authority hold: publication must remain blocked pending a separate release decision.";
  }
  const allowed = new Set(run.sources.map((source) => source.id));
  if (script.sections.some((section) => !section.source_ids.length || section.source_ids.some((id) => !allowed.has(id)))) {
    return "Authority hold: script cites sources outside the active grounded run.";
  }
  const attestation = podcastAttestations.get(run.id);
  if (!attestation || script.run_id !== run.id || script.attestation_id !== attestation.id || brief?.attestation_id !== attestation.id || !runForPodcastArtifact(brief!.concept_id, brief!.selected_source_ids)) return "Authority hold: bound run and attestation verification failed.";
  if (!script.sections.some((section) => section.segment === "uncertainty" && section.classification === "unresolved")) {
    return "Authority hold: an unresolved uncertainty beat is required.";
  }
  if (script.sections.some((section) => section.classification === "first_party_attested") && (!attestation.attested || !attestation.authorized_uses.includes("podcast_script"))) {
    return "Authority hold: first-party attested copy is outside the approved use scope.";
  }
  if (attestation.raw_text && script.sections.some((section) => section.script.includes(attestation.raw_text!))) {
    return "Authority hold: raw private cutting-room material cannot be performed.";
  }
  if (script.sections.some((section) => /\b(proves?|definitely|guilty|lied|cover[- ]?up)\b/i.test(section.script))) {
    return "Authority hold: unsupported allegation language requires human evidence review.";
  }
  if (isLivePodcastRuntime(run.runtime_status) && script.claim_support_verified !== true) {
    return "Authority hold: exact mapped-source claim support was not verified.";
  }
  if (isLivePodcastRuntime(run.runtime_status)) {
    const agenticRun = traceablePodcastRunExecutions(run);
    const scriptExecution = podcastExecutionRecords.get(`script:${script.id}`);
    const authority = podcastPerformanceAuthority(script, run);
    if (
      !agenticRun ||
      scriptExecution?.status !== "completed" ||
      scriptExecution.agent !== "script_performer" ||
      scriptExecution.parent_execution_id !== agenticRun.parentExecutionId
    ) {
      return "Authority hold: script generation is not linked to the originating Google ADK execution.";
    }
    if (
      !authority ||
      authority.scriptReceipt.parent_execution_id !== agenticRun.parentExecutionId
    ) {
      return "Authority hold: exact human script approval is not linked to the originating Google ADK execution.";
    }
    if (
      authority.audioReceipt.parent_execution_id !== agenticRun.parentExecutionId
    ) {
      return "Authority hold: media rendering is not authorized for the exact approved ADK-linked script.";
    }
  }
  return null;
}

type PodcastCutKeyStage = NonNullable<PodcastCutKey["execution_envelope"]>["stages"][number];
type PodcastAgentExecution = PodcastGroundedRun["agent_executions"][number];

function podcastCutKeyStage(
  stage: PodcastCutKeyStage["stage"],
  execution: PodcastAgentExecution,
  parentExecutionId: string,
): PodcastCutKeyStage | null {
  if (
    execution.status !== "completed" ||
    execution.parent_execution_id !== parentExecutionId ||
    !nonEmptyString(execution.framework) ||
    !nonEmptyString(execution.activity) ||
    execution.agent === "authority_check"
  ) return null;
  return {
    stage,
    agent: execution.agent,
    provider: execution.provider,
    framework: execution.framework,
    model: execution.model,
    execution_id: execution.execution_id,
    parent_execution_id: parentExecutionId,
    tools: [...execution.tools],
    status: "completed",
    activity: execution.activity,
  };
}

function createPodcastCutKey(script: PodcastWorkspaceWithCompatibility, clip: PodcastAudioClip, wav: Buffer) {
  const brief = podcastBriefs.get(script.brief_id);
  const run = brief?.run_id ? podcastGroundedRuns.get(brief.run_id) ?? null : null;
  if (!run) return null;
  const attestation = podcastAttestations.get(run.id);
  const scriptExecution = podcastExecutionRecords.get(`script:${script.id}`);
  const audioExecution = podcastExecutionRecords.get(`audio:${script.id}`);
  const agenticRun = traceablePodcastRunExecutions(run);
  const expectedTranscript = clipTranscript(script);
  const scriptSha256 = createHash("sha256").update(expectedTranscript).digest("hex");
  const expectedSourceIds = [...new Set(script.provenance.map((source) => source.source_id))].sort();
  const authority = podcastPerformanceAuthority(script, run);
  if (
    !attestation ||
    script.run_id !== run.id ||
    clip.run_id !== run.id ||
    script.attestation_id !== attestation.id ||
    clip.attestation_id !== attestation.id ||
    brief?.attestation_id !== attestation.id ||
    clip.transcript !== expectedTranscript ||
    JSON.stringify([...clip.source_ids].sort()) !== JSON.stringify(expectedSourceIds) ||
    script.release_kit?.publishing_status !== "blocked_until_final_approval" ||
    !authority ||
    (!syntheticDemoEnabled() && (
      !agenticRun ||
      scriptExecution?.status !== "completed" ||
      scriptExecution.agent !== "script_performer" ||
      scriptExecution.parent_execution_id !== agenticRun.parentExecutionId ||
      audioExecution?.status !== "completed" ||
      audioExecution.provider !== "Google Gemini" ||
      audioExecution.model !== ttsModel ||
      audioExecution.parent_execution_id !== agenticRun.parentExecutionId ||
      authority.scriptReceipt.parent_execution_id !== agenticRun.parentExecutionId ||
      authority.audioReceipt.parent_execution_id !== agenticRun.parentExecutionId
    ))
  ) return null;
  const receipts = brief ? podcastApprovalChain(script, brief) : null;
  if (!receipts) return null;
  const sourceEvidence = expectedSourceIds.map((sourceId) => {
    const source = run.sources.find((candidate) => candidate.id === sourceId);
    if (
      !source ||
      !nonEmptyString(source.title) ||
      !nonEmptyString(source.publisher)
    ) return null;
    return {
      id: source.id,
      url: source.url,
      title: source.title,
      publisher: source.publisher,
      published_at: source.published_at ?? null,
      retrieved_at: source.retrieved_at,
      source_class: source.source_type,
      aggregate_summary: source.aggregate_summary,
      what_it_supports: source.what_it_supports,
    };
  });
  if (!syntheticDemoEnabled() && sourceEvidence.some((source) => !source)) return null;
  const completeSourceEvidence = sourceEvidence.filter((source) => source !== null);
  const audioSha256 = createHash("sha256").update(wav).digest("hex");
  const transcriptSha256 = createHash("sha256").update(clip.transcript).digest("hex");
  const sourceManifestSha256 = podcastSourceManifestSha256(expectedSourceIds, completeSourceEvidence);
  const executionStages = agenticRun && scriptExecution && audioExecution
    ? [
        podcastCutKeyStage("grounded_research", agenticRun.executions[0], agenticRun.parentExecutionId),
        podcastCutKeyStage("editorial_synthesis", agenticRun.executions[1], agenticRun.parentExecutionId),
        podcastCutKeyStage("editorial_synthesis", agenticRun.executions[2], agenticRun.parentExecutionId),
        podcastCutKeyStage("script_generation", scriptExecution, agenticRun.parentExecutionId),
        podcastCutKeyStage("media_render", audioExecution, agenticRun.parentExecutionId),
      ]
    : [];
  if (!syntheticDemoEnabled() && (
    executionStages.length !== 5 ||
    executionStages.some((stage) => !stage) ||
    !authority
  )) return null;
  const executionEnvelope = agenticRun && authority && executionStages.every((stage) => stage !== null)
    ? {
        parent_execution_id: agenticRun.parentExecutionId,
        run_id: run.id,
        script_id: script.id,
        stages: executionStages,
        authority_boundary: {
          type: "human_script_approval" as const,
          script_approved_at: authority.scriptReceipt.decided_at,
          media_render_authorized_at: authority.audioReceipt.decided_at,
          script_sha256: scriptSha256,
          authority_records: [
            {
              receipt_id: authority.scriptReceipt.receipt_id!,
              authority_record_type: "SCRIPT_APPROVED" as const,
              reviewer_reference: authority.scriptReceipt.reviewer_reference!,
              decided_at: authority.scriptReceipt.decided_at,
              script_sha256: scriptSha256,
              source_run_id: run.id,
              policy_version: authority.scriptReceipt.policy_version!,
            },
            {
              receipt_id: authority.audioReceipt.receipt_id!,
              authority_record_type: "AUDIO_RENDER_AUTHORIZED" as const,
              reviewer_reference: authority.audioReceipt.reviewer_reference!,
              decided_at: authority.audioReceipt.decided_at,
              script_sha256: scriptSha256,
              source_run_id: run.id,
              policy_version: authority.audioReceipt.policy_version!,
            },
          ],
          publication_status: "blocked_until_final_approval" as const,
        },
      }
    : null;
  const canonicalPayload = {
    clip_id: clip.id,
    transcript: clip.transcript,
    transcript_sha256: transcriptSha256,
    ...(executionEnvelope ? {
      adk_execution_id: executionEnvelope.parent_execution_id,
      run_id: run.id,
      script_id: script.id,
      script_sha256: scriptSha256,
      source_manifest_sha256: sourceManifestSha256,
      execution_envelope: executionEnvelope,
    } : {}),
    source_ids: [...clip.source_ids].sort(),
    ...(sourceEvidence.every(Boolean) ? { source_evidence: completeSourceEvidence } : {}),
    generated_at: clip.generated_at,
    production: {
      synthetic: !isLivePodcastRuntime(run.runtime_status),
      provider: "Google Gemini",
      model: audioExecution?.model ?? "Gemini TTS",
    },
    voice_disclosure: clip.voice_disclosure,
    format_disclosure: clip.format_disclosure,
    audio_sha256: audioSha256,
    integrity_disclaimer: "This manifest verifies artifact lineage and integrity, not the truth of any claim.",
  };
  const manifestSha256 = podcastCutKeyManifestSha256(canonicalPayload);
  const key = `cut-${manifestSha256}`;
  const manifest: PodcastCutKey = {
    key,
    manifest_sha256: manifestSha256,
    audio_url: `/api/podcast/cut-keys/${key}/audio`,
    ...canonicalPayload,
  };
  podcastCutKeys.set(key, manifest);
  return manifest;
}

export function getPodcastAudioByScript(id: string) {
  const script = podcastScripts.get(id) ?? (currentScript?.id === id ? currentScript : null);
  return script?.audio_clip ?? null;
}

export function getPodcastAudioPath(clipId: string) {
  if (!/^clip-[a-zA-Z0-9_-]+$/.test(clipId)) return null;
  const storedClip = activeGeneratedPodcastClip(clipId);
  if (!storedClip) return null;
  const expectedSha256 = (
    storedClip.cut_key ? podcastCutKeys.get(storedClip.cut_key)?.audio_sha256 : undefined
  ) ?? podcastAudioAssets.get(clipId);
  if (!expectedSha256) return null;
  const filePath = join(audioDirectory, `${clipId}.wav`);
  if (!existsSync(filePath)) return null;
  const actualSha256 = createHash("sha256").update(readFileSync(filePath)).digest("hex");
  return actualSha256 === expectedSha256 ? filePath : null;
}

export async function getPodcastStoredAudioFile(clipId: string) {
  const storedClip = activeGeneratedPodcastClip(clipId);
  if (!storedClip) return null;
  if (process.env.PODCAST_DURABILITY_DISABLED === "true") return null;
  const expectedSha256 = (
    storedClip.cut_key ? podcastCutKeys.get(storedClip.cut_key)?.audio_sha256 : undefined
  ) ?? podcastAudioAssets.get(clipId);
  if (!expectedSha256) return null;
  return getPodcastAudioFile(clipId, expectedSha256);
}

function activeGeneratedPodcastClip(clipId: string) {
  return [...podcastScripts.values()].find(
    (script) => script.audio_status === "generated" && script.audio_clip?.id === clipId,
  )?.audio_clip ?? null;
}

export function addPodcastSource(sourceUrl: string, producerId: string) {
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
  return getPodcastRoom(producerId);
}

export async function generatePodcastBrief(
  conceptId: string,
  requestedSourceIds: string[],
  developmentPlanId?: string,
) {
  const concept = allPodcastConcepts().find((item) => item.id === conceptId);
  if (!concept) {
    if (!syntheticDemoEnabled()) throw new Error("No exact grounded concept is available for production brief generation.");
    return null;
  }

  const sourceIds = concept.source_ids.filter((id) => requestedSourceIds.includes(id));
  const selectedSources = allPodcastSources().filter((source) => sourceIds.includes(source.id));
  const syntheticDemo = process.env.PODCAST_SYNTHETIC_DEMO === "true";
  const fallback = fixtureBrief(conceptId, sourceIds);
  const developmentPlan = developmentPlanId ? getPodcastDevelopmentPlan(developmentPlanId) : null;
  const selectedArchetype = developmentPlan?.archetypes.find(
    (item) => item.id === developmentPlan.selected_archetype_id,
  );
  const selectedFormat = developmentPlan?.format_variants.find(
    (item) => item.id === developmentPlan.selected_format_id,
  );
  const run = runForPodcastArtifact(conceptId, sourceIds);
  const attestation = run ? podcastAttestations.get(run.id) : null;
  if (!syntheticDemo && (!run || !attestation)) {
    throw new Error("Exact grounded run and attestation decision are required for a production brief.");
  }
  if (syntheticDemo) {
    currentBrief = {
      ...fallback,
      run_id: run?.id ?? null,
      attestation_id: attestation?.id ?? null,
      development_plan_id: developmentPlan?.id,
      editorial_archetype: selectedArchetype,
      selected_format: selectedFormat,
      methodology_summary: developmentPlan?.methodology_note,
    };
    podcastBriefs.set(currentBrief.id, currentBrief);
    persistPodcastState("create", "podcast_brief");
    return currentBrief;
  }
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Gemini brief generation is not configured; set PODCAST_SYNTHETIC_DEMO=true only for an explicit demo.");
    const ai = new GoogleGenAI({ apiKey });
    const response = await yieldPodcastMutationLock(() => ai.models.generateContent({
      model,
        contents: `You are a read-only podcast development editor. Create a JSON podcast brief from the supplied concept, source metadata, fictional editorial lens, and format hypothesis. Every factual phrase, framing contrast, and title phrase must be directly entailed by the selected source findings. Do not turn two adjacent facts into an institutional contradiction, genre shift, category restructuring, trend, broadcast change, or broader industry claim unless those exact propositions are directly supported. Do not quote comments verbatim, identify people, imitate a real person's style, invent facts, guarantee popularity, or publish or render anything. Never include URLs in generated prose; source links are attached separately. If no community source is supplied, do not claim what audiences, fans, or listeners want, think, feel, ask, believe, prefer, need, expect, or struggle with. Return fields topic_angle, audience_pain, why_now, key_tensions, risk_notes, episode_outline, suggested_title.\n\nCONCEPT:\n${JSON.stringify(concept)}\n\nSELECTED SOURCES:\n${JSON.stringify(selectedSources)}\n\nFICTIONAL EDITORIAL LENS:\n${JSON.stringify(selectedArchetype ?? null)}\n\nFORMAT HYPOTHESIS:\n${JSON.stringify(selectedFormat ?? null)}`,
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: {
          type: "object",
          additionalProperties: false,
          required: ["topic_angle", "audience_pain", "why_now", "key_tensions", "risk_notes", "episode_outline", "suggested_title"],
          properties: {
            topic_angle: { type: "string", minLength: 1 },
            audience_pain: { type: "string", minLength: 1 },
            why_now: { type: "string", minLength: 1 },
            key_tensions: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } },
            risk_notes: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } },
            episode_outline: {
              type: "array",
              minItems: 3,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["segment", "purpose"],
                properties: {
                  segment: { type: "string", minLength: 1 },
                  purpose: { type: "string", minLength: 1 },
                },
              },
            },
            suggested_title: { type: "string", minLength: 1 },
          },
        },
      },
    }));
    const parsed = JSON.parse(response.text ?? "{}");
    const safeDraft = strictPodcastDraft(parsed, selectedSources);
    const hasCommunitySource = selectedSources.some((source) => source.source_class === "community");
    if (!hasCommunitySource) {
      safeDraft.audience_pain = "No selected community source establishes any audience or fan preference, reaction, question, or belief.";
    }
    const verification = await yieldPodcastMutationLock(() => ai.models.generateContent({
      model,
      contents: `Verify the candidate podcast brief against only the selected source findings. Mark supported true only if every concrete factual claim, framing contrast, title phrase, and outline proposition is directly entailed by at least one supplied source. Institutional contradiction, genre shift, category restructuring, broadcast change, trend, audience reaction, or other plausible synthesis is unsupported unless directly stated in the source findings. Boundary statements about what the evidence cannot establish are allowed. Return supported and unsupported_claims.\n\nSELECTED SOURCE FINDINGS:\n${JSON.stringify(run!.sources.filter((source) => sourceIds.includes(source.id)).map((source) => ({ id: source.id, title: source.title, publisher: source.publisher, published_at: source.published_at, aggregate_summary: source.aggregate_summary, what_it_supports: source.what_it_supports, what_remains_uncertain: source.what_remains_uncertain })))}\n\nCANDIDATE BRIEF:\n${JSON.stringify(safeDraft)}`,
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: {
          type: "object",
          additionalProperties: false,
          required: ["supported", "unsupported_claims"],
          properties: {
            supported: { type: "boolean" },
            unsupported_claims: { type: "array", items: { type: "string" } },
          },
        },
      },
    }));
    validateBriefClaimSupport(JSON.parse(verification.text ?? "{}"), safeDraft, hasCommunitySource);
    currentBrief = {
      ...fallback,
      ...safeDraft,
      run_id: run!.id,
      attestation_id: attestation!.id,
      generated_mode: "gemini",
      source_links: fallback.source_links,
      status: "approved",
      approval_note: "Gemini prepared this internal source-backed brief from the selected live run. The single human approval occurs on the exact performed script.",
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
    recordAgentStage("PODCAST-BRIEF", "failed", concept.title, reason);
    throw new Error(`Gemini brief generation failed: ${reason}`);
  }
  return currentBrief;
}

export function strictPodcastDraft(parsed: unknown, sources: PodcastSource[]): GeneratedPodcastDraft {
  const candidate = parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
  if (!candidate) throw new Error("Malformed Gemini brief: expected an object.");
  const text = (name: keyof GeneratedPodcastDraft) => {
    const value = candidate[name];
    if (!nonEmptyString(value) || containsSourceText(value, sources)) throw new Error(`Malformed Gemini brief: invalid ${name}.`);
    return value;
  };
  const stringList = (name: "key_tensions" | "risk_notes") => {
    const value = candidate[name];
    if (!Array.isArray(value) || !value.length || !value.every((item) => nonEmptyString(item) && !containsSourceText(item, sources))) throw new Error(`Malformed Gemini brief: invalid ${name}.`);
    return value as string[];
  };
  const outline = candidate.episode_outline;
  if (!Array.isArray(outline) || !outline.length || !outline.every((item) => item && typeof item === "object" && nonEmptyString((item as any).segment) && nonEmptyString((item as any).purpose))) {
    throw new Error("Malformed Gemini brief: invalid episode_outline.");
  }
  return { topic_angle: text("topic_angle"), audience_pain: text("audience_pain"), why_now: text("why_now"), key_tensions: stringList("key_tensions"), risk_notes: stringList("risk_notes"), episode_outline: outline as PodcastBrief["episode_outline"], suggested_title: text("suggested_title") };
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
  const existingScript = podcastScripts.get(`script-${currentBrief.id}`);
  if (existingScript && !podcastWorkspaceMatchesBrief(existingScript, currentBrief)) {
    discardPodcastWorkspace(existingScript);
  }
  persistPodcastState("decision", "podcast_brief");
  return currentBrief;
}

function recordPodcastPerformanceAuthority(id: string, reviewer: string) {
  const script = podcastScripts.get(id) ?? (currentScript?.id === id ? currentScript : null);
  const run = script?.run_id ? podcastGroundedRuns.get(script.run_id) ?? null : null;
  if (!script || script.status !== "approved" || !run) {
    throw new Error("The exact approved script and its source run are required.");
  }
  const decidedAt = now();
  const artifactSha256 = podcastScriptSha256(script);
  const reviewerReference = podcastReviewerReference(reviewer);
  const agenticRun = traceablePodcastRunExecutions(run);
  const shared = {
    reviewer,
    decided_at: decidedAt,
    artifact_sha256: artifactSha256,
    reviewer_reference: reviewerReference,
    source_run_id: run.id,
    policy_version: run.policy_reference,
    ...(agenticRun
      ? { parent_execution_id: agenticRun.parentExecutionId }
      : {}),
  };
  podcastApprovalReceipts.set(`script:${id}`, {
    ...shared,
    stage: "script",
    authority_record_type: "SCRIPT_APPROVED",
    receipt_id: `authority-${randomUUID()}`,
  });
  podcastApprovalReceipts.set(`audio:${id}`, {
    ...shared,
    stage: "audio",
    authority_record_type: "AUDIO_RENDER_AUTHORIZED",
    receipt_id: `authority-${randomUUID()}`,
  });
  recordHumanDecision("script", id, "approve", reviewer);
  recordHumanDecision("audio", id, "approve", reviewer);
}

export function recordPodcastDecision(
  kind: "brief" | "script" | "audio",
  id: string,
  decision: "approve" | "reject",
  reviewer: string,
) {
  if (kind === "script" && decision === "approve") {
    recordPodcastPerformanceAuthority(id, reviewer);
  } else if (kind === "audio" && decision === "approve") {
    const script = podcastScripts.get(id) ?? (currentScript?.id === id ? currentScript : null);
    const run = script?.run_id ? podcastGroundedRuns.get(script.run_id) ?? null : null;
    if (!script || !run || !podcastPerformanceAuthority(script, run)) {
      throw new Error("Audio authorization must be created with the exact script approval.");
    }
  } else {
    recordHumanDecision(kind, id, decision, reviewer);
    if (kind === "script" || kind === "audio") {
      podcastApprovalReceipts.delete(`script:${id}`);
      podcastApprovalReceipts.delete(`audio:${id}`);
    }
    if (decision === "approve") {
      podcastApprovalReceipts.set(`${kind}:${id}`, {
        stage: kind,
        reviewer,
        decided_at: now(),
      });
    }
  }
  persistPodcastState("record_receipt", "podcast_approval");
}

export function recordPodcastDevelopmentReceipt(id: string, reviewer: string) {
  podcastApprovalReceipts.set(`development:${id}`, { stage: "development", reviewer, decided_at: now() });
  persistPodcastState("record_receipt", "podcast_approval");
}

export function isPodcastEvidenceSufficient(brief: PodcastBrief) {
  if (!brief.source_links.length) return false;
  return brief.source_links.every((link) => {
    const source = allPodcastSources().find((item) => item.id === link.source_id);
    return Boolean(
      source &&
        (source.access_mode === "approved_live" || source.access_mode === "fixture") &&
        !source.post_title.toLowerCase().includes("retrieval pending") &&
        (source.access_mode !== "approved_live" || nonEmptyString(source.publisher)),
    );
  });
}
