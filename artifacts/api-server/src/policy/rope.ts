export type PolicyClaim = {
  text: string;
  source_class: string;
  source_ref: string | null;
  is_third_party: boolean;
  tags: string[];
};

export type PolicyInput = {
  action: string;
  target_platform: string;
  territory: string;
  claims: PolicyClaim[];
};

export type PolicyCall = {
  window: { valid_from: string; valid_until: string };
  scopes: string[];
  exclusions: string[];
  reach: { territory: string; platform: string };
  sig: { subject_countersig: string | null };
};

export type Evaluation = {
  pass: boolean;
  rule_id: string;
  reason: string;
  receipt_entry: string;
};

const refusal = (rule_id: string, reason: string): Evaluation => ({
  pass: false,
  rule_id,
  reason,
  receipt_entry: `${rule_id} — ${reason}`,
});

export function evaluatePolicy(
  call: PolicyCall,
  input: PolicyInput,
  contextIds: Set<string>,
  now = new Date(),
): Evaluation {
  const windowStarts = new Date(call.window.valid_from).getTime();
  const windowEnds = new Date(call.window.valid_until).getTime();
  const timestamp = now.getTime();

  if (timestamp < windowStarts || timestamp > windowEnds) {
    return refusal("R1", "DARK — the Call is outside its issued window.");
  }

  if (!call.sig.subject_countersig) {
    return refusal(
      "R2",
      "INERT — the subject has not countersigned this Call.",
    );
  }

  if (!call.scopes.includes(input.action)) {
    return refusal(
      "R3",
      `OUT OF SCOPE — ${input.action} is not granted by this Call.`,
    );
  }

  const excludedTag = input.claims
    .flatMap((claim) => claim.tags)
    .find((tag) => call.exclusions.includes(tag));
  if (excludedTag) {
    return refusal(
      "R4",
      `EXCLUDED — ${excludedTag} is excluded on this Call.`,
    );
  }

  const unsupportedThirdPartyClaim = input.claims.find(
    (claim) =>
      claim.is_third_party &&
      (!claim.source_ref || !contextIds.has(claim.source_ref)),
  );
  if (unsupportedThirdPartyClaim) {
    return refusal(
      "R5",
      "HUMAN HOLD — no source document supports a claim about another person.",
    );
  }

  const platformAllowed =
    call.reach.platform === "any" ||
    call.reach.platform === input.target_platform;
  const territoryAllowed =
    call.reach.territory === "worldwide" ||
    call.reach.territory === input.territory;
  if (!platformAllowed || !territoryAllowed) {
    return refusal(
      "R6",
      "OUT OF REACH — the target is outside this Call’s territory or platform.",
    );
  }

  return {
    pass: true,
    rule_id: "PASS",
    reason: "The Velvet Rope cleared this scoped, signed action.",
    receipt_entry: "PASS — the scoped action cleared the Velvet Rope.",
  };
}