import { finding } from "../finding.js";
import type { RuleDefinition } from "../types.js";

export const sub001Subscriber: RuleDefinition = {
  id: "SUB-001",
  title: "Subscriber / member identification",
  description: "Subscriber member identifier must be present on the claim.",
  severity: "error",
  category: "subscriber",
  version: "1.0.0",
  applicability:
    "Structural check for presence of NM1*IL member id in the normalized model. Situational patient loops are not fully modeled in MVP.",
  evaluate(ctx) {
    const { claim } = ctx;
    if (!claim.subscriber) {
      return [
        finding(this, ctx, {
          message: "Subscriber (NM1*IL) is missing.",
          suggestedAction: "Include subscriber name and member identification on the claim.",
          sourceLocation: claim.source,
        }),
      ];
    }
    if (!claim.subscriber.memberId?.trim()) {
      return [
        finding(this, ctx, {
          message: "Subscriber member identification is missing.",
          suggestedAction: "Populate the member ID (NM109 when NM108 is MI).",
          sourceLocation: claim.subscriber.source,
        }),
      ];
    }
    return [];
  },
};
