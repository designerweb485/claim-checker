# Multi-stage API image (monorepo). Synthetic demo stack only.
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/edi-parser/package.json packages/edi-parser/
COPY packages/validation-rules/package.json packages/validation-rules/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @claim-checker/edi-parser build \
 && pnpm --filter @claim-checker/validation-rules build \
 && pnpm --filter @claim-checker/api exec prisma generate \
 && pnpm --filter @claim-checker/api build

FROM node:20-alpine AS runner
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
RUN mkdir -p /app/uploads
EXPOSE 3001
WORKDIR /app/apps/api
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/server.js"]
