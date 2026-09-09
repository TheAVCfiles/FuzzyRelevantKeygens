import { Router, type IRouter, type Request } from "express";
import { clerkClient, getAuth } from "@clerk/express";
import { createReadStream, statSync } from "node:fs";
import type { File } from "@google-cloud/storage";
import {
  AddPodcastSourceBody,
  AddPodcastSourceResponse,
  CreatePodcastFilterPresetBody,
  CreatePodcastFilterPresetResponse,
  CreatePodcastDevelopmentBody,
  CreatePodcastDevelopmentResponse,
  DecidePodcastBriefBody,
  DecidePodcastBriefParams,
  DecidePodcastBriefResponse,
  CreatePodcastScriptResponse,
  CreatePodcastScriptParams,
  CreatePodcastReleaseKitResponse,
  DecidePodcastAudioBody,
  DecidePodcastAudioParams,
  DecidePodcastAudioResponse,
  DecidePodcastScriptBody,
  DecidePodcastScriptParams,
  DecidePodcastScriptResponse,
  DismissPullRequestParams,
  DismissPullRequestResponse,
  EvaluatePolicyBody,
  EvaluatePolicyResponse,
  GeneratePodcastBriefBody,
  GeneratePodcastBriefResponse,
  GetActiveCallResponse,
  GetCallsResponse,
  GetContextResponse,
  GetDropParams,
  GetDropResponse,
  GetFloodQueryParams,
  GetFloodResponse,
  GetPodcastRoomResponse,
  GetPodcastLiveSnapshotResponse,
  GeneratePodcastAudioParams,
  GeneratePodcastAudioResponse,
  GetPodcastAudioParams,
  GetPodcastAudioResponse,
  SearchPodcastContextsBody,
  SearchPodcastContextsResponse,
  StreamPodcastAudioParams,
  RenamePodcastFilterPresetBody,
  RenamePodcastFilterPresetParams,
  RenamePodcastFilterPresetResponse,
  RecordPodcastDevelopmentValidationBody,
  RecordPodcastDevelopmentValidationParams,
  RecordPodcastDevelopmentValidationResponse,
  DeletePodcastFilterPresetParams,
  GetPullRequestParams,
  GetPullRequestResponse,
  GetReceiptsResponse,
  GetShowResponse,
  IngestLiveObservationsBody,
  IngestLiveObservationsResponse,
  RunAgentFlowResponse,
  SignPullRequestBody,
  SignPullRequestParams,
  SignPullRequestResponse,
  VerifyDropBody,
  VerifyDropResponse,
  AttestPodcastCuttingRoomBody,
  AttestPodcastCuttingRoomParams,
  AttestPodcastCuttingRoomResponse,
  GetPodcastCutKeyParams,
  GetPodcastCutKeyResponse,
  GetPodcastJudgeManifestResponse,
  ResetPodcastDemoResponse,
} from "@workspace/api-zod";

import {
  activeCall,
  call,
  contextItems,
  dismissPullRequest,
  evaluate,
  flood,
  getDrop,
  getReceipts,
  ingestLiveObservations,
  pullRequest,
  show,
  signMove,
  verifyDrop,
  getPilotReport,
} from "../lib/autography-fixtures";
import { runAutographyAgentFlow } from "../lib/agent-builder-flow";
import {
  addPodcastSource,
  createPodcastFilterPreset,
  createPodcastDevelopment,
  deletePodcastFilterPreset,
  decidePodcastBrief,
  createPodcastScript,
  createPodcastScriptFromGemini,
  createPodcastReleaseKit,
  decidePodcastAudio,
  decidePodcastScript,
  generatePodcastBrief,
  generatePodcastAudio,
  getPodcastAudioByScript,
  getPodcastAudioPath,
  getPodcastRoom,
  getPodcastLiveSnapshot,
  getPodcastDevelopmentPlan,
  getPodcastScriptByBriefId,
  getPodcastScriptById,
  isPodcastEvidenceSufficient,
  isPodcastDevelopmentReady,
  isBlockedLegacyPodcastBrief,
  recordPodcastDecision,
  renamePodcastFilterPreset,
  recordPodcastDevelopmentValidation,
  recordPodcastDevelopmentReceipt,
  searchPodcastContexts,
  attestPodcastCuttingRoom,
  getPodcastAudioPathForCutKey,
  getPodcastAudioFileForCutKey,
  getPodcastStoredAudioFile,
  getPublicPodcastCutKey,
  getPublicPodcastJudgeManifest,
  getPublicPodcastAudioCutKey,
  flushPodcastPersistence,
  acquirePodcastMutationLock,
  runWithPodcastMutationLock,
  resetPodcastDemo,
} from "../lib/podcast-fixtures";
import { requirePodcastPersistenceReady } from "../lib/podcast-readiness";

const router: IRouter = Router();

router.use("/podcast", requirePodcastPersistenceReady);

router.use("/podcast", async (req, res, next): Promise<void> => {
  const publicCutKeyRead =
    (req.method === "GET" || req.method === "HEAD") &&
    /\/podcast\/cut-keys\/[^/?]+(?:\/audio)?(?:\?|$)/.test(req.originalUrl);
  const publicJudgeManifestRead =
    (req.method === "GET" || req.method === "HEAD") &&
    /\/podcast\/judge-manifest(?:\?|$)/.test(req.originalUrl);
  if (publicCutKeyRead || publicJudgeManifestRead) {
    next();
    return;
  }
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    let disconnected = false;
    let release: (() => void) | undefined;
    const releaseOnClose = () => {
      disconnected = true;
      release?.();
    };
    res.once("close", releaseOnClose);
    try {
      const lock = await acquirePodcastMutationLock();
      release = lock.release;
      if (disconnected || res.destroyed || res.writableEnded) {
        release();
        return;
      }
      release();
      next();
    } catch (error) {
      res.off("close", releaseOnClose);
      next(error);
    }
    return;
  }
  let disconnected = false;
  const markDisconnected = () => {
    disconnected = true;
  };
  res.once("close", markDisconnected);
  let lock: Awaited<ReturnType<typeof acquirePodcastMutationLock>>;
  try {
    lock = await acquirePodcastMutationLock();
    if (disconnected || res.destroyed || res.writableEnded) {
      lock.release();
      return;
    }
  } catch (error) {
    res.off("close", markDisconnected);
    next(error);
    return;
  }
  const sendJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    void flushPodcastPersistence().then((persisted) => {
      try {
        if (!persisted && res.statusCode < 400) {
          res.status(503);
          sendJson({ error: "Podcast changes could not be durably persisted." });
          return;
        }
        sendJson(body);
      } finally {
        res.off("close", markDisconnected);
        lock.release();
      }
    });
    return res;
  }) as typeof res.json;
  runWithPodcastMutationLock(lock, () => next());
});

type PilotRole = "producer" | "talent" | "publicity" | "safety" | "viewer";
type AutographyPrincipal = {
  role: PilotRole;
  reviewerId: string;
  source: "verified_session" | "preview";
};
type AutographyRequest = Request & {
  autographyPrincipal?: AutographyPrincipal;
};
const rolePermissions: Record<PilotRole, Set<string>> = {
  producer: new Set(["read", "ingest", "evaluate", "stage", "sign", "dismiss"]),
  talent: new Set(["read", "evaluate", "sign"]),
  publicity: new Set(["read", "ingest", "evaluate", "stage"]),
  safety: new Set(["read", "evaluate"]),
  viewer: new Set(["read"]),
};

function previewRoleModeEnabled() {
  return process.env.NODE_ENV === "development" &&
    process.env.AUTOGRAPHY_PREVIEW_ROLE_MODE === "true";
}

export function principalFromVerifiedClerkUser(
  userId: string,
  publicMetadata: Record<string, unknown>,
): AutographyPrincipal {
  const metadataRole = publicMetadata.autography_role;
  const role = typeof metadataRole === "string" && rolePermissions[metadataRole as PilotRole]
    ? metadataRole as PilotRole
    : "viewer";
  return { role, reviewerId: userId, source: "verified_session" };
}

async function requestedPrincipal(req: Request): Promise<AutographyPrincipal | null> {
  if (previewRoleModeEnabled()) {
    const role = req.header("x-autography-role") as PilotRole | undefined;
    const user = req.header("x-autography-user");
    if (role && user && rolePermissions[role]) {
      return { role, reviewerId: user, source: "preview" };
    }
  }

  const auth = getAuth(req);
  if (auth.userId) {
    const user = await clerkClient.users.getUser(auth.userId);
    return principalFromVerifiedClerkUser(
      auth.userId,
      user.publicMetadata as Record<string, unknown>,
    );
  }

  return previewRoleModeEnabled()
    ? { role: "producer", reviewerId: "local-preview-producer", source: "preview" }
    : null;
}

function requirePermission(permission: string) {
  return async (req: any, res: any, next: any): Promise<void> => {
    try {
      const principal = await requestedPrincipal(req);
      if (!principal) {
        res.status(401).json({ error: "Pilot authentication required." });
        return;
      }
      if (!rolePermissions[principal.role].has(permission)) {
        res.status(403).json({ error: `Role ${principal.role} cannot perform ${permission}.` });
        return;
      }
      req.autographyPrincipal = principal;
      next();
    } catch (error) {
      next(error);
    }
  };
}

router.post("/auth/preview/producer", async (req, res, next): Promise<void> => {
  if (!previewRoleModeEnabled()) {
    res.status(404).json({ error: "Preview producer provisioning is unavailable." });
    return;
  }
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "A verified Clerk session is required." });
    return;
  }
  try {
    await clerkClient.users.updateUserMetadata(auth.userId, {
      publicMetadata: { autography_role: "producer" },
    });
    res.json({ role: "producer", reviewer_id: auth.userId });
  } catch (error) {
    next(error);
  }
});

router.get("/auth/me", async (req, res, next): Promise<void> => {
  try {
    const principal = await requestedPrincipal(req);
    if (!principal) {
      res.status(401).json({ error: "Pilot authentication required." });
      return;
    }
    res.json({
      role: principal.role,
      reviewer_id: principal.reviewerId,
      source: principal.source,
    });
  } catch (error) {
    next(error);
  }
});

// Issued artifacts and hash lookup are intentionally public proof surfaces.
// Production rooms and their decision history remain authenticated below.
router.get("/drop/:id", (req, res): void => {
  const params = GetDropParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const drop = getDrop(params.data.id);
  if (!drop) {
    res.status(404).json({ error: "Drop not found" });
    return;
  }
  res.json(GetDropResponse.parse(drop));
});

router.post("/verify", (req, res): void => {
  const body = VerifyDropBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  res.json(VerifyDropResponse.parse(verifyDrop(body.data.lookup)));
});

// Cut Keys are deliberately public, but resolve only an already-approved,
// current manifest and never expose private attestation raw text.
router.get("/podcast/cut-keys/:key", async (req, res): Promise<void> => {
  const params = GetPodcastCutKeyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const manifest = await getPublicPodcastCutKey(params.data.key);
  if (!manifest) {
    res.status(404).json({ error: "Cut Key not found" });
    return;
  }
  res.json(GetPodcastCutKeyResponse.parse(manifest));
});

router.get("/podcast/cut-keys/:key/audio", async (req, res): Promise<void> => {
  const params = GetPodcastCutKeyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const manifest = await getPublicPodcastAudioCutKey(params.data.key);
  if (!manifest) {
    res.status(404).json({ error: "Current Cut Key audio not found" });
    return;
  }
  const file = await getPodcastAudioFileForCutKey(manifest);
  if (file) {
    await streamAppStorageAudio(req, res, file, "Current Cut Key audio not found");
    return;
  }
  const path = getPodcastAudioPathForCutKey(manifest);
  if (!path) {
    res.status(404).json({ error: "Current Cut Key audio not found" });
    return;
  }
  res.type("audio/wav").sendFile(path, { dotfiles: "allow" }, (error) => {
    if (error && !res.headersSent) res.status(404).json({ error: "Current Cut Key audio not found" });
  });
});

router.get("/podcast/judge-manifest", async (_req, res): Promise<void> => {
  const manifest = await getPublicPodcastJudgeManifest();
  if (!manifest) {
    res.status(404).json({ error: "No approved public judge manifest is available" });
    return;
  }
  res.json(GetPodcastJudgeManifestResponse.parse(manifest));
});

// Every production-room read is authenticated; development keeps the existing
// local preview usable as the producer role.
router.use(requirePermission("read"));

router.get("/show", (_req, res): void => {
  res.json(GetShowResponse.parse(show));
});

router.get("/flood", (req, res): void => {
  const parsed = GetFloodQueryParams.safeParse(req.query);
  const source = parsed.success && parsed.data.source === "live" ? "live" : "fixture";
  res.json(GetFloodResponse.parse(flood(source)));
});

router.post("/flood/observations", requirePermission("ingest"), (req, res): void => {
  const body = IngestLiveObservationsBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const liveFlood = ingestLiveObservations({
    ...body.data,
    observations: body.data.observations.map((observation) => ({
      ...observation,
      observed_at: observation.observed_at.toISOString(),
      observation_window: {
        start: observation.observation_window.start.toISOString(),
        end: observation.observation_window.end.toISOString(),
      },
    })),
  });
  res.status(202).json(IngestLiveObservationsResponse.parse({
    accepted: true,
    source_id: body.data.source_id,
    received_at: new Date().toISOString(),
    observation_count: body.data.observations.length,
    flood: liveFlood,
  }));
});

router.get("/podcast/sources", (req, res): void => {
  res.json(GetPodcastRoomResponse.parse(getPodcastRoom(
    (req as AutographyRequest).autographyPrincipal!.reviewerId,
  )));
});

router.post("/podcast/sources", requirePermission("stage"), (req, res): void => {
  const body = AddPodcastSourceBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const room = addPodcastSource(
    body.data.source_url,
    (req as AutographyRequest).autographyPrincipal!.reviewerId,
  );
  if (!room) {
    res.status(400).json({ error: "Only valid public http(s) source URLs are accepted." });
    return;
  }
  res.json(AddPodcastSourceResponse.parse(room));
});

router.post("/podcast/search", requirePermission("stage"), async (req, res): Promise<void> => {
  const body = SearchPodcastContextsBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  try {
    res.json(SearchPodcastContextsResponse.parse(await searchPodcastContexts(
      body.data.query,
      body.data.audience,
      body.data.use_case,
      body.data.provider,
      body.data.window,
      body.data.source_classes,
    )));
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : "Google Search grounded podcast search failed." });
  }
});

router.post("/podcast/runs/:id/attestation", requirePermission("sign"), (req, res): void => {
  const params = AttestPodcastCuttingRoomParams.safeParse(req.params);
  const body = AttestPodcastCuttingRoomBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid cutting-room attestation." });
    return;
  }
  const attestation = attestPodcastCuttingRoom(
    params.data.id,
    body.data,
    (req as AutographyRequest).autographyPrincipal!.reviewerId,
  );
  if (attestation === "immutable") {
    res.status(409).json({ error: "A cutting-room attestation for this run is immutable." });
    return;
  }
  if (attestation === false) {
    res.status(400).json({ error: "Adding an attestation requires raw text, public summary, signer, and authorized uses." });
    return;
  }
  if (!attestation) {
    res.status(404).json({ error: "Grounded podcast run not found." });
    return;
  }
  res.json(AttestPodcastCuttingRoomResponse.parse(attestation));
});

router.post("/podcast/reset", requirePermission("stage"), (req, res): void => {
  res.json(ResetPodcastDemoResponse.parse(resetPodcastDemo(
    (req as AutographyRequest).autographyPrincipal!.reviewerId,
  )));
});

router.get("/podcast/live-snapshot", (_req, res): void => {
  res.json(GetPodcastLiveSnapshotResponse.parse(getPodcastLiveSnapshot()));
});

router.post("/podcast/development", requirePermission("stage"), (req, res): void => {
  const body = CreatePodcastDevelopmentBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const plan = createPodcastDevelopment(
    body.data.concept_id,
    body.data.source_ids,
    body.data.audience,
    body.data.use_case,
  );
  if (!plan) {
    res.status(404).json({ error: "Podcast concept or cited source set not found" });
    return;
  }
  res.status(201).json(CreatePodcastDevelopmentResponse.parse(plan));
});

router.post("/podcast/development/:id/validation", requirePermission("sign"), (req, res): void => {
  const params = RecordPodcastDevelopmentValidationParams.safeParse(req.params);
  const body = RecordPodcastDevelopmentValidationBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid podcast development decision" });
    return;
  }
  const plan = recordPodcastDevelopmentValidation(
    params.data.id,
    body.data.decision,
    body.data.archetype_id,
    body.data.format_id,
    (req as AutographyRequest).autographyPrincipal!.reviewerId,
  );
  if (plan === false) {
    res.status(503).json({ error: "The development decision could not be persisted. The plan remains unvalidated." });
    return;
  }
  if (!plan) {
    res.status(404).json({ error: "Podcast development plan, archetype, or format not found" });
    return;
  }
  if (body.data.decision === "validate") {
    recordPodcastDevelopmentReceipt(params.data.id, (req as AutographyRequest).autographyPrincipal!.reviewerId);
  }
  res.json(RecordPodcastDevelopmentValidationResponse.parse(plan));
});

router.post("/podcast/presets", requirePermission("stage"), (req, res): void => {
  const body = CreatePodcastFilterPresetBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  res.status(201).json(CreatePodcastFilterPresetResponse.parse(createPodcastFilterPreset(
    body.data.name,
    body.data.platforms,
    body.data.communities,
    (req as AutographyRequest).autographyPrincipal!.reviewerId,
  )));
});

router.patch("/podcast/presets/:id", requirePermission("stage"), (req, res): void => {
  const params = RenamePodcastFilterPresetParams.safeParse(req.params);
  const body = RenamePodcastFilterPresetBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid podcast filter preset rename" });
    return;
  }
  const preset = renamePodcastFilterPreset(
    params.data.id,
    body.data.name,
    (req as AutographyRequest).autographyPrincipal!.reviewerId,
  );
  if (!preset) {
    res.status(404).json({ error: "Podcast filter preset not found" });
    return;
  }
  res.json(RenamePodcastFilterPresetResponse.parse(preset));
});

router.delete("/podcast/presets/:id", requirePermission("stage"), (req, res): void => {
  const params = DeletePodcastFilterPresetParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid podcast filter preset id" });
    return;
  }
  if (!deletePodcastFilterPreset(
    params.data.id,
    (req as AutographyRequest).autographyPrincipal!.reviewerId,
  )) {
    res.status(404).json({ error: "Podcast filter preset not found" });
    return;
  }
  res.status(204).json(null);
});

router.post("/podcast/brief", requirePermission("stage"), async (req, res): Promise<void> => {
  const body = GeneratePodcastBriefBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  if (!isPodcastDevelopmentReady(body.data.development_plan_id, body.data.concept_id, body.data.source_ids)) {
    res.status(409).json({ error: "A validated development plan with the same cited source set is required." });
    return;
  }
  let brief;
  try {
    brief = await generatePodcastBrief(
      body.data.concept_id,
      body.data.source_ids,
      body.data.development_plan_id,
    );
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : "Gemini brief generation failed." });
    return;
  }
  if (!brief) {
    res.status(404).json({ error: "Podcast concept not found" });
    return;
  }
  res.json(GeneratePodcastBriefResponse.parse(brief));
});

router.post("/podcast/brief/:id/decision", requirePermission("sign"), (req, res): void => {
  const params = DecidePodcastBriefParams.safeParse(req.params);
  const body = DecidePodcastBriefBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid podcast brief decision" });
    return;
  }
  if (isBlockedLegacyPodcastBrief(params.data.id)) {
    res.status(409).json({ error: "Only an approved podcast brief can change a script workspace." });
    return;
  }
  const brief = decidePodcastBrief(params.data.id, body.data.decision);
  if (!brief) {
    res.status(404).json({ error: "Podcast concept not found" });
    return;
  }
  if (
    body.data.decision === "approve" &&
    !isPodcastEvidenceSufficient(brief)
  ) {
    res.status(409).json({
      error: "Approval unavailable until evidence trail is sufficient.",
    });
    return;
  }
  recordPodcastDecision(
    "brief",
    brief.id,
    body.data.decision,
    (req as AutographyRequest).autographyPrincipal!.reviewerId,
  );
  res.json(DecidePodcastBriefResponse.parse(brief));
});

router.post("/podcast/brief/:id/script", requirePermission("stage"), async (req, res): Promise<void> => {
  const params = CreatePodcastScriptParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid podcast brief id" });
    return;
  }
  let result;
  try {
    result = await createPodcastScriptFromGemini(params.data.id);
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : "Gemini script generation failed." });
    return;
  }
  if (result.kind === "not_found") {
    res.status(404).json({ error: "Podcast brief not found" });
    return;
  }
  if (result.kind === "brief_not_approved") {
    res.status(409).json({ error: "Only an approved podcast brief can open a script workspace." });
    return;
  }
  res.status(201).json(CreatePodcastScriptResponse.parse(result.script));
});

router.get("/podcast/brief/:id/script", (req, res): void => {
  const params = CreatePodcastScriptParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid podcast brief id" });
    return;
  }
  const result = getPodcastScriptByBriefId(params.data.id);
  if (result.kind === "not_found") {
    res.status(404).json({ error: "Podcast script workspace not found" });
    return;
  }
  if (result.kind === "brief_not_approved") {
    res.status(409).json({ error: "Only an approved podcast brief can retrieve a script workspace." });
    return;
  }
  res.json(CreatePodcastScriptResponse.parse(result.script));
});

router.get("/podcast/script/:id", (req, res): void => {
  const params = DecidePodcastScriptParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid podcast script workspace id" });
    return;
  }
  const result = getPodcastScriptById(params.data.id);
  if (result.kind === "not_found") {
    res.status(404).json({ error: "Podcast script workspace not found" });
    return;
  }
  if (result.kind === "brief_not_approved") {
    res.status(409).json({ error: "Only a script from an approved podcast brief can be retrieved." });
    return;
  }
  res.json(CreatePodcastScriptResponse.parse(result.script));
});

router.post("/podcast/script/:id/decision", requirePermission("sign"), (req, res): void => {
  const params = DecidePodcastScriptParams.safeParse(req.params);
  const body = DecidePodcastScriptBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid podcast script decision" });
    return;
  }
  const existingScript = getPodcastScriptById(params.data.id);
  if (existingScript.kind === "brief_not_approved") {
    res.status(409).json({ error: "Only a script from an approved podcast brief can be changed." });
    return;
  }
  const script = decidePodcastScript(params.data.id, body.data.decision);
  if (!script) {
    res.status(404).json({ error: "Podcast script workspace not found" });
    return;
  }
  recordPodcastDecision(
    "script",
    script.id,
    body.data.decision,
    (req as AutographyRequest).autographyPrincipal!.reviewerId,
  );
  res.json(DecidePodcastScriptResponse.parse(script));
});

router.post("/podcast/script/:id/release-kit", requirePermission("stage"), (req, res): void => {
  const params = DecidePodcastScriptParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid podcast script workspace id" });
    return;
  }
  const result = createPodcastReleaseKit(params.data.id);
  if (result.kind === "not_found") {
    res.status(404).json({ error: "Podcast script workspace not found" });
    return;
  }
  if (result.kind === "script_not_approved") {
    res.status(409).json({ error: "Only an approved script can prepare a release kit." });
    return;
  }
  res.status(201).json(CreatePodcastReleaseKitResponse.parse(result.releaseKit));
});

router.post("/podcast/script/:id/audio/decision", requirePermission("sign"), (req, res): void => {
  const params = DecidePodcastAudioParams.safeParse(req.params);
  const body = DecidePodcastAudioBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid podcast audio decision" });
    return;
  }
  const result = decidePodcastAudio(params.data.id, body.data.decision);
  if (result.kind === "not_found") {
    res.status(404).json({ error: "Podcast script workspace not found" });
    return;
  }
  if (result.kind === "not_ready") {
    res.status(409).json({ error: "An approved script and staged release kit are required before audio review." });
    return;
  }
  recordPodcastDecision(
    "audio",
    result.script.id,
    body.data.decision,
    (req as AutographyRequest).autographyPrincipal!.reviewerId,
  );
  res.json(DecidePodcastAudioResponse.parse(result.script));
});

router.post("/podcast/script/:id/audio", requirePermission("stage"), async (req, res): Promise<void> => {
  const params = GeneratePodcastAudioParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid podcast script workspace id" });
    return;
  }
  const result = await generatePodcastAudio(params.data.id);
  if (result.kind === "not_found") {
    res.status(404).json({ error: "Podcast script workspace not found" });
    return;
  }
  if (result.kind === "not_approved") {
    res.status(409).json({ error: "Human audio approval is required before generation." });
    return;
  }
  if (result.kind === "generation_failed") {
    res.status(502).json({ error: result.error });
    return;
  }
  if (result.kind === "superseded") {
    res.status(409).json({ error: "The approved script changed while audio was rendering. The obsolete clip was discarded." });
    return;
  }
  res.status(201).json(GeneratePodcastAudioResponse.parse(result.clip));
});

router.get("/podcast/script/:id/audio", (req, res): void => {
  const params = GetPodcastAudioParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid podcast script workspace id" });
    return;
  }
  const clip = getPodcastAudioByScript(params.data.id);
  if (!clip) {
    res.status(404).json({ error: "Podcast audio clip not found" });
    return;
  }
  res.json(GetPodcastAudioResponse.parse(clip));
});

router.get("/podcast/audio/:id/stream", async (req, res): Promise<void> => {
  const params = StreamPodcastAudioParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid podcast audio clip id" });
    return;
  }
  const file = await getPodcastStoredAudioFile(params.data.id);
  if (file) {
    await streamAppStorageAudio(req, res, file, "Podcast audio file not found");
    return;
  }
  const filePath = getPodcastAudioPath(params.data.id);
  if (!filePath) {
    res.status(404).json({ error: "Podcast audio file not found" });
    return;
  }
  let size: number;
  try {
    const stats = statSync(filePath);
    if (!stats.isFile()) {
      res.status(404).json({ error: "Podcast audio file not found" });
      return;
    }
    size = stats.size;
  } catch {
    res.status(404).json({ error: "Podcast audio file not found" });
    return;
  }

  const range = req.header("range");
  let start = 0;
  let end = size - 1;
  let partial = false;

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (!match || (match[1] === "" && match[2] === "")) {
      res.setHeader("Content-Range", `bytes */${size}`);
      res.status(416).end();
      return;
    }

    if (match[1] === "") {
      const suffixLength = Number(match[2]);
      if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0 || size === 0) {
        res.setHeader("Content-Range", `bytes */${size}`);
        res.status(416).end();
        return;
      }
      start = Math.max(size - suffixLength, 0);
    } else {
      start = Number(match[1]);
      end = match[2] === "" ? size - 1 : Number(match[2]);
      if (
        !Number.isSafeInteger(start) ||
        !Number.isSafeInteger(end) ||
        start < 0 ||
        start >= size ||
        end < start
      ) {
        res.setHeader("Content-Range", `bytes */${size}`);
        res.status(416).end();
        return;
      }
      end = Math.min(end, size - 1);
    }
    partial = true;
  }

  const contentLength = end - start + 1;
  res.status(partial ? 206 : 200);
  res.type("audio/wav");
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Content-Length", contentLength);
  if (partial) {
    res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
  }
  if (size === 0) {
    res.end();
    return;
  }

  const stream = createReadStream(filePath, { start, end });
  stream.on("error", (error) => {
    req.log.warn({ code: (error as NodeJS.ErrnoException).code }, "Podcast audio stream failed");
    if (!res.headersSent) {
      res.removeHeader("Content-Length");
      res.removeHeader("Content-Range");
      res.status(404).json({ error: "Podcast audio file not found" });
      return;
    }
    res.destroy();
  });
  stream.pipe(res);
});

async function streamAppStorageAudio(
  req: Request,
  res: any,
  file: File,
  notFoundMessage: string,
) {
  let size: number;
  try {
    const [metadata] = await file.getMetadata();
    size = Number(metadata.size);
    if (!Number.isSafeInteger(size) || size < 0) throw new Error("Invalid stored audio size");
  } catch (error) {
    req.log.warn({ error: error instanceof Error ? error.message : String(error) }, "Podcast App Storage metadata lookup failed");
    res.status(404).json({ error: notFoundMessage });
    return;
  }

  const range = req.header("range");
  let start = 0;
  let end = size - 1;
  let partial = false;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (!match || (match[1] === "" && match[2] === "" || size === 0)) {
      res.setHeader("Content-Range", `bytes */${size}`);
      res.status(416).end();
      return;
    }
    if (match[1] === "") {
      const suffixLength = Number(match[2]);
      if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) {
        res.setHeader("Content-Range", `bytes */${size}`);
        res.status(416).end();
        return;
      }
      start = Math.max(size - suffixLength, 0);
    } else {
      start = Number(match[1]);
      end = match[2] === "" ? size - 1 : Number(match[2]);
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) {
        res.setHeader("Content-Range", `bytes */${size}`);
        res.status(416).end();
        return;
      }
      end = Math.min(end, size - 1);
    }
    partial = true;
  }

  const contentLength = size === 0 ? 0 : end - start + 1;
  res.status(partial ? 206 : 200);
  res.type("audio/wav");
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Content-Length", contentLength);
  if (partial) res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
  if (size === 0) {
    res.end();
    return;
  }
  const stream = file.createReadStream({ start, end });
  stream.on("error", (error) => {
    req.log.warn({ error: error.message }, "Podcast App Storage stream failed");
    if (!res.headersSent) res.status(404).json({ error: notFoundMessage });
    else res.destroy(error);
  });
  stream.pipe(res);
}

router.get("/context", (_req, res): void => {
  res.json(GetContextResponse.parse({ items: contextItems }));
});

router.get("/calls", (_req, res): void => {
  res.json(GetCallsResponse.parse([call]));
});

router.get("/call/active", (_req, res): void => {
  res.json(GetActiveCallResponse.parse(activeCall()));
});

router.get("/pr/:id", (req, res): void => {
  const parsed = GetPullRequestParams.safeParse(req.params);
  if (!parsed.success || parsed.data.id !== pullRequest.id) {
    res.status(404).json({ error: "Pull Request not found" });
    return;
  }
  res.json(GetPullRequestResponse.parse(pullRequest));
});

router.post("/pr/:id/sign", requirePermission("sign"), (req, res): void => {
  const params = SignPullRequestParams.safeParse(req.params);
  const body = SignPullRequestBody.safeParse(req.body);
  if (!params.success || !body.success || params.data.id !== pullRequest.id) {
    res.status(400).json({ error: "Invalid Pull Request signature" });
    return;
  }
  const result = signMove(body.data.move_id);
  if (!result) {
    res.status(400).json({ error: "Move not found" });
    return;
  }
  if (!result.drop) {
    res.status(200).json({ evaluation: result.evaluation, drop: null });
    return;
  }
  res.json(SignPullRequestResponse.parse(result));
});

router.post("/evaluate", requirePermission("evaluate"), (req, res): void => {
  const body = EvaluatePolicyBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  res.json(EvaluatePolicyResponse.parse(evaluate(body.data)));
});

router.post("/agent/run", requirePermission("stage"), async (_req, res): Promise<void> => {
  const result = await runAutographyAgentFlow();
  res.json(RunAgentFlowResponse.parse(result));
});

router.post("/pr/:id/dismiss", requirePermission("dismiss"), (req, res): void => {
  const params = DismissPullRequestParams.safeParse(req.params);
  if (!params.success || params.data.id !== pullRequest.id) {
    res.status(404).json({ error: "Pull Request not found" });
    return;
  }
  res.json(DismissPullRequestResponse.parse(dismissPullRequest()));
});

router.get("/pilot/report", requirePermission("read"), (_req, res): void => {
  res.json(getPilotReport());
});

router.get("/receipts", requirePermission("read"), (_req, res): void => {
  res.json(GetReceiptsResponse.parse(getReceipts()));
});

export default router;