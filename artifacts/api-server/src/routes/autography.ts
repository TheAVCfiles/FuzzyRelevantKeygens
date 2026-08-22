import { Router, type IRouter } from "express";
import {
  AddPodcastSourceBody,
  AddPodcastSourceResponse,
  DecidePodcastBriefBody,
  DecidePodcastBriefParams,
  DecidePodcastBriefResponse,
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
} from "../lib/autography-fixtures";
import { runAutographyAgentFlow } from "../lib/agent-builder-flow";
import {
  addPodcastSource,
  decidePodcastBrief,
  generatePodcastBrief,
  getPodcastRoom,
} from "../lib/podcast-fixtures";

const router: IRouter = Router();

router.get("/show", (_req, res): void => {
  res.json(GetShowResponse.parse(show));
});

router.get("/flood", (req, res): void => {
  const parsed = GetFloodQueryParams.safeParse(req.query);
  const source = parsed.success && parsed.data.source === "live" ? "live" : "fixture";
  res.json(GetFloodResponse.parse(flood(source)));
});

router.post("/flood/observations", (req, res): void => {
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

router.post("/podcast/sources", (req, res): void => {
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

router.post("/podcast/brief", async (req, res): Promise<void> => {
  const body = GeneratePodcastBriefBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const brief = await generatePodcastBrief(body.data.concept_id);
  if (!brief) {
    res.status(404).json({ error: "Podcast concept not found" });
    return;
  }
  res.json(GeneratePodcastBriefResponse.parse(brief));
});

router.post("/podcast/brief/:id/decision", (req, res): void => {
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
  res.json(DecidePodcastBriefResponse.parse(brief));
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

router.post("/pr/:id/sign", (req, res): void => {
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

router.post("/evaluate", (req, res): void => {
  const body = EvaluatePolicyBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  res.json(EvaluatePolicyResponse.parse(evaluate(body.data)));
});

router.post("/agent/run", async (_req, res): Promise<void> => {
  const result = await runAutographyAgentFlow();
  res.json(RunAgentFlowResponse.parse(result));
});

router.post("/pr/:id/dismiss", (req, res): void => {
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

router.get("/receipts", (_req, res): void => {
  res.json(GetReceiptsResponse.parse(getReceipts()));
});

export default router;