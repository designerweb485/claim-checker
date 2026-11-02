/** Minimal OpenAPI 3 document for Milestone 5 endpoints. */
export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "Claim Checker API",
    version: "0.5.0",
    description:
      "Synthetic EDI validation API. Not HIPAA certified. Organization is derived from the authenticated session — never trust a client-supplied organizationId.",
  },
  servers: [{ url: "/api/v1" }],
  paths: {
    "/health": { get: { summary: "Health check", responses: { "200": { description: "OK" } } } },
    "/auth/register": { post: { summary: "Register organization + owner", responses: { "201": { description: "Created" } } } },
    "/auth/login": { post: { summary: "Login", responses: { "200": { description: "OK" } } } },
    "/auth/logout": { post: { summary: "Logout", security: [{ cookieAuth: [] }, { bearerAuth: [] }], responses: { "204": { description: "No content" } } } },
    "/auth/me": { get: { summary: "Current user", security: [{ cookieAuth: [] }, { bearerAuth: [] }], responses: { "200": { description: "OK" } } } },
    "/uploads": {
      get: { summary: "Upload history", security: [{ cookieAuth: [] }, { bearerAuth: [] }], responses: { "200": { description: "OK" } } },
      post: { summary: "Upload EDI file", security: [{ cookieAuth: [] }, { bearerAuth: [] }], responses: { "201": { description: "Created" } } },
    },
    "/uploads/{uploadId}": { get: { summary: "Upload detail", security: [{ cookieAuth: [] }, { bearerAuth: [] }], responses: { "200": { description: "OK" } } } },
    "/uploads/{uploadId}/claims": { get: { summary: "Claims for upload", security: [{ cookieAuth: [] }, { bearerAuth: [] }], responses: { "200": { description: "OK" } } } },
    "/uploads/{uploadId}/validation-run": { get: { summary: "Validation run summary", security: [{ cookieAuth: [] }, { bearerAuth: [] }], responses: { "200": { description: "OK" } } } },
    "/claims/{claimId}": { get: { summary: "Claim detail", security: [{ cookieAuth: [] }, { bearerAuth: [] }], responses: { "200": { description: "OK" } } } },
    "/validation-runs/{runId}/findings": { get: { summary: "Findings", security: [{ cookieAuth: [] }, { bearerAuth: [] }], responses: { "200": { description: "OK" } } } },
    "/validation-runs/{runId}/export.csv": { get: { summary: "CSV export", security: [{ cookieAuth: [] }, { bearerAuth: [] }], responses: { "200": { description: "CSV" } } } },
    "/rules": { get: { summary: "Enabled rules", security: [{ cookieAuth: [] }, { bearerAuth: [] }], responses: { "200": { description: "OK" } } } },
  },
  components: {
    securitySchemes: {
      cookieAuth: { type: "apiKey", in: "cookie", name: "cc_session" },
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
  },
} as const;
