import { Router, type IRouter, type Request } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  AddPodcastSourceBody,
  AddPodcastSourceResponse,
  DecidePodcastBriefBody,
  DecidePodcastBriefParams,
  DecidePodcastBriefResponse,
  CreatePodcastScriptResponse,
  CreatePodcastScriptParams,
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
  decidePodcastBrief,
  createPodcastScript,
  decidePodcastScript,
  generatePodcastBrief,
  getPodcastRoom,
  isPodcastEvidenceSufficient,
  recordPodcastDecision,
} from "../lib/podcast-fixtures";

const router: IRouter = Router();

type PilotRole = "producer" | "talent" | "publicity" | "safety";
const rolePermissions: Record<PilotRole, Set<string>> = {
  producer: new Set(["read", "ingest", "evaluate", "stage", "sign", "dismiss"]),
  talent: new Set(["read", "evaluate", "sign"]),
  publicity: new Set(["read", "ingest", "evaluate", "stage"]),
  safety: new Set(["read", "evaluate"]),
};

function requestedRole(req: Request): PilotRole | null {
  const role = req.header("x-autography-role") as PilotRole | undefined;
  const user = req.header("x-autography-user");
  if (role && user && rolePermissions[role]) return role;
  const token = req.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return process.env.NODE_ENV === "development" ? "producer" : null;
  const [prefix, tokenRole, userId, signature] = token.split(":");
  if (prefix !== "pilot" || !tokenRole || !userId || !signature || !rolePermissions[tokenRole as PilotRole]) return null;
  const expected = createHmac("sha256", process.env.SESSION_SECRET ?? "development-only")
    .update(`${tokenRole}:${userId}`)
    .digest("hex");
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  return tokenRole as PilotRole;
}

function requirePermission(permission: string) {
  return (req: any, res: any, next: any): void => {
    const role = requestedRole(req);
    if (!role) {
      res.status(401).json({ error: "Pilot authentication required." });
      return;
    }
    if (!rolePermissions[role].has(permission)) {
      res.status(403).json({ error: `Role ${role} cannot perform ${permission}.` });
      return;
    }
    req.autographyRole = role;
    next();
  };
}

router.post("/auth/session", (req, res): void => {
  const role = req.body?.role as PilotRole;
  const userId = typeof req.body?.user_id === "string" ? req.body.user_id : "";
  if (!rolePermissions[role] || !userId) {
    res.status(400).json({ error: "A valid role and user_id are required." });
    return;
  }
  const signature = createHmac("sha256", process.env.SESSION_SECRET ?? "development-only")
    .update(`${role}:${userId}`)
    .digest("hex");
  res.json({ token: `pilot:${role}:${userId}:${signature}`, role, user_id: userId });
});

// Every room read is authenticated as well; development keeps the existing
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

router.get("/podcast/sources", (_req, res): void => {
  res.json(GetPodcastRoomResponse.parse(getPodcastRoom()));
});

router.post("/podcast/sources", requirePermission("stage"), (req, res): void => {
  const body = AddPodcastSourceBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const room = addPodcastSource(body.data.source_url);
  if (!room) {
    res.status(400).json({ error: "Only valid public http(s) source URLs are accepted." });
    return;
  }
  res.json(AddPodcastSourceResponse.parse(room));
});

router.post("/podcast/brief", requirePermission("stage"), async (req, res): Promise<void> => {
  const body = GeneratePodcastBriefBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const brief = await generatePodcastBrief(body.data.concept_id, body.data.source_ids);
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
    (req as Request & { autographyRole?: string }).autographyRole ?? "human reviewer",
  );
  res.json(DecidePodcastBriefResponse.parse(brief));
});

router.post("/podcast/brief/:id/script", requirePermission("stage"), (req, res): void => {
  const params = CreatePodcastScriptParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid podcast brief id" });
    return;
  }
  const result = createPodcastScript(params.data.id);
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

router.post("/podcast/script/:id/decision", requirePermission("sign"), (req, res): void => {
  const params = DecidePodcastScriptParams.safeParse(req.params);
  const body = DecidePodcastScriptBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid podcast script decision" });
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
    (req as Request & { autographyRole?: string }).autographyRole ?? "human reviewer",
  );
  res.json(DecidePodcastScriptResponse.parse(script));
});

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

router.get("/pilot/report", requirePermission("read"), (_req, res): void => {
  res.json(getPilotReport());
});

router.get("/receipts", requirePermission("read"), (_req, res): void => {
  res.json(GetReceiptsResponse.parse(getReceipts()));
});

export default router;