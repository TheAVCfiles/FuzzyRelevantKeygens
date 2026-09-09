import assert from "node:assert/strict";
import { test } from "node:test";

import { evaluatePolicy, type PolicyCall, type PolicyInput } from "./rope";

const now = new Date("2026-08-22T12:00:00.000Z");
const call: PolicyCall = {
  window: {
    valid_from: "2026-08-22T11:00:00.000Z",
    valid_until: "2026-08-22T13:00:00.000Z",
  },
  scopes: ["drop:issue"],
  exclusions: ["claim:third-party-conduct"],
  reach: { territory: "US", platform: "web" },
  sig: { subject_countersig: "simulated:subject" },
};

const baseInput = (): PolicyInput => ({
  action: "drop:issue",
  target_platform: "web",
  territory: "US",
  claims: [],
});

test("R1–R6 fail in order at their first violated boundary", () => {
  const cases: Array<{
    rule: string;
    mutate: (input: PolicyInput, policy: PolicyCall) => void;
  }> = [
    {
      rule: "R1",
      mutate: (_input, policy) => {
        policy.window.valid_until = "2026-08-22T11:59:59.000Z";
      },
    },
    {
      rule: "R2",
      mutate: (_input, policy) => {
        policy.sig.subject_countersig = null;
      },
    },
    {
      rule: "R3",
      mutate: (input) => {
        input.action = "room:open";
      },
    },
    {
      rule: "R4",
      mutate: (input) => {
        input.claims = [
          {
            text: "excluded claim",
            source_class: "first_party_statement",
            source_ref: "ctx-1",
            is_third_party: false,
            tags: ["claim:third-party-conduct"],
          },
        ];
      },
    },
    {
      rule: "R5",
      mutate: (input) => {
        input.claims = [
          {
            text: "unsupported claim about another person",
            source_class: "observed_signal",
            source_ref: "missing-context",
            is_third_party: true,
            tags: [],
          },
        ];
      },
    },
    {
      rule: "R6",
      mutate: (input) => {
        input.target_platform = "mobile";
      },
    },
  ];

  for (const { rule, mutate } of cases) {
    const input = baseInput();
    const policy = structuredClone(call);
    mutate(input, policy);
    const result = evaluatePolicy(policy, input, new Set(["ctx-1"]), now);
    assert.equal(result.pass, false);
    assert.equal(result.rule_id, rule);
    assert.match(result.receipt_entry, new RegExp(`^${rule} —`));
  }

  // A later violation must not hide an earlier refusal.
  const firstFailure = baseInput();
  firstFailure.action = "room:open";
  firstFailure.target_platform = "mobile";
  assert.equal(
    evaluatePolicy(call, firstFailure, new Set(), now).rule_id,
    "R3",
  );
});

test("a fully permitted move passes", () => {
  const result = evaluatePolicy(call, baseInput(), new Set(), now);
  assert.deepEqual(result, {
    pass: true,
    rule_id: "PASS",
    reason: "The Velvet Rope cleared this scoped, signed action.",
    receipt_entry: "PASS — the scoped action cleared the Velvet Rope.",
  });
});