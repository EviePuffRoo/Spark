import { Router } from "express";
import { generateDowntimeOutcome, DOWNTIME_OUTCOME_ACTIVITY_TYPES } from "@spark/shared";
import type { GenerateDowntimeOutcomeRequest } from "@spark/shared";

export const generateDowntimeOutcomeRouter = Router();

generateDowntimeOutcomeRouter.post("/", (req, res) => {
  const { activityType } = (req.body ?? {}) as GenerateDowntimeOutcomeRequest;
  if (!(DOWNTIME_OUTCOME_ACTIVITY_TYPES as readonly string[]).includes(activityType)) {
    return res.status(400).json({ error: "Invalid activityType" });
  }
  res.json(generateDowntimeOutcome(activityType));
});
