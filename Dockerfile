FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages
COPY services ./services
COPY scripts ./scripts

RUN npm ci --no-audit --no-fund
RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/services/api-server/dist ./services/api-server/dist

EXPOSE 3000

CMD ["node", "services/api-server/dist/services/api-server/src/cli.js"]
