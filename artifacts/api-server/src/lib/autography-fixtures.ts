import { createHash } from "node:crypto";

import {
  evaluatePolicy,
  type Evaluation,
  type PolicyInput,
} from "../policy/rope";

const isoAfter = (milliseconds: number) =>
  new Date(Date.now() + milliseconds).toISOString();

export const show = {
  title: "The Salt Flats",
  episode: 6,
  subtitle: "A borrowed dress and a missed call",
  aired_at: isoAfter(-40 * 60 * 1000),
  transcript_excerpt:
    "Lola leaves the hotel before sunrise. In the final cut, a conversation about the transfer lands three weeks away from the receipt.",
};

export const call = {
  call_id: "CALL-SF06-LV-0001",
  subject: { id: "lola-vantz", display: "Lola Vantz" },
  issuer: {
    id: "saltflats-prod",
    display: "The Salt Flats (Production)",
  },
  attestation: "issuer",
  engagement: {
    show: "The Salt Flats",
    episode: 6,
    capacity: "principal cast",
  },
  window: {
    valid_from: isoAfter(-40 * 60 * 1000),
    valid_until: isoAfter(7 * 60 * 60 * 1000 + 41 * 60 * 1000),
  },
  scopes: ["drop:issue", "room:open", "offers:receive", "likeness:still"],
  exclusions: [
    "claim:third-party-conduct",
    "brand:alcohol",
    "endorse:political",
  ],
  reach: { territory: "worldwide", platform: "any" },
  sig: {
    issuer_sig: "simulated:issuer:saltflats:SF06",
    subject_countersig: "simulated:subject:lola-vantz:SF06",
  },
};

export const contextItems = [
  {
    id: "ctx_call_sheet_0604",
    label: "Episode six call sheet",
    source_class: "verified_document",
    excerpt:
      "Departure pickup was moved after the scene wrapped. The revision is dated and countersigned.",
  },
  {
    id: "ctx_receipt_0412",
    label: "Transfer confirmation",
    source_class: "verified_document",
    excerpt:
      "Payment confirmation recorded before the episode’s listed departure date.",
  },
  {
    id: "ctx_statement_lola",
    label: "Lola’s prepared note",
    source_class: "first_party_statement",
    excerpt:
      "I understand the edit made the timing hard to follow. Here is the document trail I can stand behind.",
  },
];

export const clusters = [
  {
    id: "cl_a",
    label: "Repayment accusation, near-identical phrasing",
    class: "coordinated_likely",
    member_ids: ["sig_0004", "sig_0011", "sig_0015", "sig_0019"],
    coordination_signals: {
      duplicate_phrasing: 0.91,
      account_age_clustering: 0.88,
      burst_window_seconds: 340,
      cadence_irregularity: 0.76,
    },
    confidence: "high",
    note: "Likelihood, not finding. Signals shown below.",
    share_of_observed_volume: 0.71,
  },
  {
    id: "cl_b",
    label: "Timeline confusion",
    class: "authentic_concern",
    member_ids: ["sig_0002", "sig_0008", "sig_0013"],
    coordination_signals: {
      duplicate_phrasing: 0.14,
      account_age_clustering: 0.11,
      burst_window_seconds: 4110,
      cadence_irregularity: 0.21,
    },
    confidence: "high",
    note: "Independent questions point to the three-week edit gap.",
    share_of_observed_volume: 0.12,
  },
  {
    id: "cl_c",
    label: "Recaps and watch-along notes",
    class: "press",
    member_ids: ["sig_0006", "sig_0010"],
    coordination_signals: {
      duplicate_phrasing: 0.02,
      account_age_clustering: 0.03,
      burst_window_seconds: 7300,
      cadence_irregularity: 0.19,
    },
    confidence: "medium",
    note: "Observed reporting and recap language.",
    share_of_observed_volume: 0.09,
  },
  {
    id: "cl_d",
    label: "Unresolved background noise",
    class: "insufficient_evidence",
    member_ids: ["sig_0003", "sig_0022"],
    coordination_signals: {
      duplicate_phrasing: 0.08,
      account_age_clustering: 0.09,
      burst_window_seconds: 6300,
      cadence_irregularity: 0.49,
    },
    confidence: "low",
    note: "Visible uncertainty. No conclusion was drawn.",
    share_of_observed_volume: 0.08,
  },
];

export const events = [
  {
    id: "sig_0002",
    text: "wait i’m confused, did the repayment happen or not? the edit jumps.",
    author: { handle: "westofnoon", account_age_days: 742, followers: 680 },
    posted_at: isoAfter(-33 * 60 * 1000),
    platform: "synthetic",
    engagement: { likes: 210, reposts: 4 },
    cluster_id: "cl_b",
  },
  {
    id: "sig_0003",
    text: "Something about that cut felt strange.",
    author: { handle: "quietcut", account_age_days: 93, followers: 110 },
    posted_at: isoAfter(-29 * 60 * 1000),
    platform: "synthetic",
    engagement: { likes: 18, reposts: 1 },
    cluster_id: "cl_d",
  },
  {
    id: "sig_0004",
    text: "ASK WHERE THE MONEY WENT. THE RECEIPT NEVER CAME.",
    author: { handle: "truthfirst_04", account_age_days: 6, followers: 12 },
    posted_at: isoAfter(-27 * 60 * 1000),
    platform: "synthetic",
    engagement: { likes: 3, reposts: 41 },
    cluster_id: "cl_a",
  },
  {
    id: "sig_0006",
    text: "Tonight’s recap: the transfer timeline is the detail viewers are replaying.",
    author: { handle: "nightdesk", account_age_days: 2210, followers: 48200 },
    posted_at: isoAfter(-25 * 60 * 1000),
    platform: "synthetic",
    engagement: { likes: 54, reposts: 16 },
    cluster_id: "cl_c",
  },
  {
    id: "sig_0008",
    text: "Can someone explain the three-week gap? I missed what they were showing.",
    author: { handle: "pencilnotes", account_age_days: 1362, followers: 920 },
    posted_at: isoAfter(-21 * 60 * 1000),
    platform: "synthetic",
    engagement: { likes: 88, reposts: 3 },
    cluster_id: "cl_b",
  },
  {
    id: "sig_0010",
    text: "A short scene, a long reaction: audience attention is landing on chronology.",
    author: { handle: "aftercut", account_age_days: 1890, followers: 8910 },
    posted_at: isoAfter(-18 * 60 * 1000),
    platform: "synthetic",
    engagement: { likes: 42, reposts: 8 },
    cluster_id: "cl_c",
  },
  {
    id: "sig_0011",
    text: "ASK WHERE THE MONEY WENT. THE RECEIPT NEVER CAME.",
    author: { handle: "publicfile_8", account_age_days: 3, followers: 18 },
    posted_at: isoAfter(-26 * 60 * 1000),
    platform: "synthetic",
    engagement: { likes: 4, reposts: 39 },
    cluster_id: "cl_a",
  },
  {
    id: "sig_0013",
    text: "The timeline, not the accusation, is the part I need cleared up.",
    author: { handle: "sidewalkviewer", account_age_days: 553, followers: 403 },
    posted_at: isoAfter(-12 * 60 * 1000),
    platform: "synthetic",
    engagement: { likes: 63, reposts: 2 },
    cluster_id: "cl_b",
  },
  {
    id: "sig_0015",
    text: "ASK WHERE THE MONEY WENT. THE RECEIPT NEVER CAME.",
    author: { handle: "recordnow_09", account_age_days: 9, followers: 31 },
    posted_at: isoAfter(-24 * 60 * 1000),
    platform: "synthetic",
    engagement: { likes: 2, reposts: 37 },
    cluster_id: "cl_a",
  },
  {
    id: "sig_0019",
    text: "ASK WHERE THE MONEY WENT. THE RECEIPT NEVER CAME.",
    author: { handle: "cleanledger7", account_age_days: 5, followers: 9 },
    posted_at: isoAfter(-23 * 60 * 1000),
    platform: "synthetic",
    engagement: { likes: 1, reposts: 32 },
    cluster_id: "cl_a",
  },
  {
    id: "sig_0022",
    text: "I have theories but no real way to know from the episode.",
    author: { handle: "wideshot", account_age_days: 220, followers: 75 },
    posted_at: isoAfter(-7 * 60 * 1000),
    platform: "synthetic",
    engagement: { likes: 9, reposts: 0 },
    cluster_id: "cl_d",
  },
];

export const pullRequest = {
  id: "pr_001",
  opened_at: isoAfter(-5 * 60 * 1000),
  finding: {
    observed_volume: 1284,
    coordinated_share: 0.71,
    authentic_concern:
      "Viewers are confused about a three-week gap in the repayment timeline, not the accusation itself.",
    commercial_exposure: [
      "Active skincare partnership — no defection observed, press pickup risk rising.",
    ],
  },
  moves: [
    {
      id: "mv_hold",
      label: "Stay dark",
      description:
        "Let the coordinated volume decay. The timeline question remains for another voice to answer.",
      projected_outcome: {
        headline: "Volume decays in 30–40 hours",
        detail: "The timeline confusion persists without a first-party record.",
      },
      context_refs: [],
      requested_action: "drop:issue",
      target_platform: "any",
    },
    {
      id: "mv_clarify",
      label: "Clarify the timeline",
      description:
        "Release only the dated record: the call sheet, transfer confirmation, and a short note.",
      projected_outcome: {
        headline: "The honest question gets an answer",
        detail: "No claim is made about another person or the loudest cluster.",
      },
      context_refs: [
        "ctx_call_sheet_0604",
        "ctx_receipt_0412",
        "ctx_statement_lola",
      ],
      requested_action: "drop:issue",
      target_platform: "any",
    },
    {
      id: "mv_room",
      label: "Clarify + open the room",
      description:
        "Release the same record, then open a scoped aftershow room while the Call is live.",
      projected_outcome: {
        headline: "A contained reply window",
        detail: "The context is available without opening blanket permission.",
      },
      context_refs: [
        "ctx_call_sheet_0604",
        "ctx_receipt_0412",
        "ctx_statement_lola",
      ],
      requested_action: "room:open",
      target_platform: "any",
    },
  ],
  state: "open",
  merged_move_id: null as string | null,
};

type Receipt = {
  ts: string;
  actor: string;
  action: string;
  call_id: string;
  result: string;
  rule_fired: string | null;
};

const receipts: Receipt[] = [
  {
    ts: isoAfter(-40 * 60 * 1000),
    actor: "The Salt Flats (Production)",
    action: "Call issued",
    call_id: call.call_id,
    result: "issuer attestation recorded",
    rule_fired: null,
  },
  {
    ts: isoAfter(-39 * 60 * 1000),
    actor: "Lola Vantz",
    action: "Call countersigned",
    call_id: call.call_id,
    result: "ON AIR",
    rule_fired: null,
  },
  {
    ts: isoAfter(-18 * 60 * 1000),
    actor: "Autography",
    action: "Signal flood read",
    call_id: call.call_id,
    result: "clusters staged; model inference labeled",
    rule_fired: null,
  },
  {
    ts: isoAfter(-6 * 60 * 1000),
    actor: "Autography",
    action: "PR drafted",
    call_id: call.call_id,
    result: "three moves staged",
    rule_fired: null,
  },
];

const drops: Array<ReturnType<typeof makeDrop>> = [];

function canonicalDropPayload(
  title: string,
  claims: Array<{ text: string; source_class: string; source_ref: string }>,
) {
  return JSON.stringify({
    call_id: call.call_id,
    title,
    edition: { number: 1, of: 2500 },
    claims,
  });
}

function makeDrop(moveId: string) {
  const selected =
    pullRequest.moves.find((move) => move.id === moveId) ??
    pullRequest.moves[1];
  const claims = [
    {
      text: "The call sheet records the episode-six departure change after the scene wrapped.",
      source_class: "verified_document",
      source_ref: "ctx_call_sheet_0604",
    },
    {
      text: "The transfer confirmation is dated before the departure shown in the episode.",
      source_class: "verified_document",
      source_ref: "ctx_receipt_0412",
    },
    {
      text: "I understand the cut made the timing hard to follow. This is the document trail I can stand behind.",
      source_class: "first_party_statement",
      source_ref: "ctx_statement_lola",
    },
  ];
  const title =
    selected.id === "mv_hold"
      ? "No statement issued"
      : "A note on the timeline";
  const hash = `sha256:${createHash("sha256")
    .update(canonicalDropPayload(title, claims))
    .digest("hex")}`;

  return {
    drop_id: "DROP-SF06-0001",
    call_id: call.call_id,
    title,
    edition: { number: 1, of: 2500 },
    claims,
    hash,
    seal: {
      issued_at: new Date().toISOString(),
      signed_by: "lola-vantz",
      scope_ref: selected.requested_action,
      signatures_simulated: true,
    },
  };
}

export function activeCall() {
  const now = Date.now();
  const starts = new Date(call.window.valid_from).getTime();
  const ends = new Date(call.window.valid_until).getTime();
  const state = !call.sig.subject_countersig
    ? "INERT"
    : now < starts || now > ends
      ? "DARK"
      : "LIVE";
  return {
    call,
    state,
    seconds_remaining: state === "LIVE" ? Math.max(0, Math.floor((ends - now) / 1000)) : 0,
  };
}

export function flood() {
  return { observed_volume: 1284, events, clusters };
}

export function getReceipts() {
  return receipts;
}

function appendReceipt(
  actor: string,
  action: string,
  result: string,
  rule_fired: string | null,
) {
  receipts.unshift({
    ts: new Date().toISOString(),
    actor,
    action,
    call_id: call.call_id,
    result,
    rule_fired,
  });
}

export function recordAgentStage(
  stage: string,
  role: string,
  input: string,
  output: string,
) {
  appendReceipt(
    `Gemini ${stage}`,
    `${role} stage recorded`,
    `model_inference · input: ${input} · output: ${output}`,
    null,
  );
}

export function evaluate(input: PolicyInput): Evaluation {
  const evaluation = evaluatePolicy(
    call,
    input,
    new Set(contextItems.map((item) => item.id)),
  );
  appendReceipt(
    "The Velvet Rope",
    "Action evaluated",
    evaluation.reason,
    evaluation.pass ? null : evaluation.rule_id,
  );
  return evaluation;
}

export function signMove(moveId: string) {
  const move = pullRequest.moves.find((item) => item.id === moveId);
  if (!move) {
    return null;
  }

  const claims: PolicyInput["claims"] =
    move.id === "mv_hold"
      ? []
      : [
          {
            text: "The call sheet records the episode-six departure change.",
            source_class: "verified_document",
            source_ref: "ctx_call_sheet_0604",
            is_third_party: false,
            tags: [],
          },
          {
            text: "The transfer confirmation is dated before the listed departure.",
            source_class: "verified_document",
            source_ref: "ctx_receipt_0412",
            is_third_party: false,
            tags: [],
          },
        ];
  const evaluation = evaluate({
    action: move.requested_action,
    target_platform: move.target_platform,
    territory: "worldwide",
    claims,
  });

  if (!evaluation.pass) {
    return { evaluation, drop: null };
  }

  const existing = drops[0];
  const drop = existing ?? makeDrop(moveId);
  if (!existing) {
    drops.push(drop);
  }
  pullRequest.state = "merged";
  pullRequest.merged_move_id = moveId;
  appendReceipt("Lola Vantz", "Drop issued", "House Seal applied", null);
  return { evaluation, drop };
}

export function dismissPullRequest() {
  pullRequest.state = "closed";
  appendReceipt("Lola Vantz", "PR dismissed", "not my look", null);
  return {
    dismissed: true,
    receipt_entry: "The PR closed unmerged. Nothing was published.",
  };
}

export function getDrop(id: string) {
  return drops.find((drop) => drop.drop_id === id) ?? null;
}

export function verifyDrop(lookup: string) {
  const drop =
    drops.find((candidate) => candidate.drop_id === lookup || candidate.hash === lookup) ??
    null;
  return { status: drop ? "SEALED" : "NOT_IN_REGISTRY", drop };
}