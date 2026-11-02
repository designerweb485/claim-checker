import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "HTTP_ERROR",
  ) {
    super(message);
  }
}

export function notFound(_req: Request, _res: Response, next: NextFunction) {
  next(new HttpError(404, "Not found", "NOT_FOUND"));
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: err.flatten(),
      },
    });
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message },
    });
    return;
  }

  // Multer file size / unexpected field
  if (typeof err === "object" && err && "code" in err) {
    const code = String((err as { code?: string }).code);
    if (code === "LIMIT_FILE_SIZE") {
      res.status(413).json({
        error: {
          code: "UPLOAD_TOO_LARGE",
          message: "Upload exceeds the configured maximum file size",
        },
      });
      return;
    }
  }

  console.error("[api]", err instanceof Error ? err.message : "unknown error");
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Internal server error" },
  });
}
