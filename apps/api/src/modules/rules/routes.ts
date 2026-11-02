import { listRules, RULE_SET_VERSION } from "@claim-checker/validation-rules";
import { Router, type Router as ExpressRouter } from "express";
import { requireAuth } from "../../middleware/auth.js";

export const rulesRouter: ExpressRouter = Router();
rulesRouter.use(requireAuth);

rulesRouter.get("/", (_req, res) => {
  res.json({
    ruleSetVersion: RULE_SET_VERSION,
    rules: listRules().map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      severity: r.severity,
      category: r.category,
      version: r.version,
      applicability: r.applicability,
    })),
  });
});
