import { Router, type IRouter } from "express";
import {
  DismissPullRequestParams,
  DismissPullRequestResponse,
  EvaluatePolicyBody,
  EvaluatePolicyResponse,
  GetActiveCallResponse,
  GetCallsResponse,
  GetContextResponse,
  GetDropParams,
  GetDropResponse,
  GetFloodResponse,
  GetPullRequestParams,
  GetPullRequestResponse,
  GetReceiptsResponse,
  GetShowResponse,
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
  pullRequest,
  show,
  signMove,
  verifyDrop,
} from "../lib/autography-fixtures";
import { runAutographyAgentFlow } from "../lib/agent-builder-flow";

const router: IRouter = Router();

router.get("/show", (_req, res): void => {
  res.json(GetShowResponse.parse(show));
});

router.get("/flood", (_req, res): void => {
  res.json(GetFloodResponse.parse(flood()));
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
    res.status(200).json({
      evaluation: result.evaluation,
      drop: null,
    });
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