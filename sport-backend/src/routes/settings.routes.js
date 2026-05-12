import { Router } from "express";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { getSettings, upsertSettings } from "../services/settings.js";

export const settingsRouter = Router();

settingsRouter.use(requireAuth);

settingsRouter.get("/", requireAdmin, async (req, res, next) => {
  try {
    res.json({ settings: await getSettings() });
  } catch (error) {
    next(error);
  }
});

settingsRouter.patch("/", requireAdmin, async (req, res, next) => {
  try {
    res.json({ settings: await upsertSettings(req.body) });
  } catch (error) {
    next(error);
  }
});
