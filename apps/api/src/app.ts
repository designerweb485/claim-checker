import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";
import { appConfig } from "./config.js";
import { errorHandler, notFound } from "./middleware/errors.js";
import { authRouter } from "./modules/auth/routes.js";
import { claimsRouter } from "./modules/claims/routes.js";
import { healthRouter } from "./modules/health/routes.js";
import { rulesRouter } from "./modules/rules/routes.js";
import { uploadsRouter } from "./modules/uploads/routes.js";
import { validationRouter } from "./modules/validation/routes.js";
import { openApiDocument } from "./openapi.js";

export function createApp(): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(
    cors({
      origin: appConfig.corsOrigin,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());

  app.get("/api/v1/openapi.json", (_req, res) => {
    res.json(openApiDocument);
  });

  app.use("/api/v1/health", healthRouter);
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/uploads", uploadsRouter);
  app.use("/api/v1/claims", claimsRouter);
  app.use("/api/v1/validation-runs", validationRouter);
  app.use("/api/v1/rules", rulesRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
