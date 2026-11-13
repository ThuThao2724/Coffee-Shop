FROM node:22-bookworm-slim AS builder
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma/
RUN npx prisma generate
COPY . .
RUN rm -rf dist
RUN npm run build
# Ship only runtime packages: jest, the Nest CLI and other dev tools carry vulnerable glob/minimatch/tmp.
RUN npm prune --omit=dev

# Node 22 LTS: Node 20 reached end of life in April 2026 and its images no longer get OS patches.
FROM node:22-bookworm-slim AS runner
# Apply Debian security updates published after the base image was built.
RUN apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
# The npm bundled with the base image ships vulnerable copies of tar/glob/brace-expansion;
# npm is still needed at start-up for `npx prisma migrate deploy`.
RUN npm install -g npm@11.21.2 && npm cache clean --force
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./
RUN npx prisma generate
# Run as the unprivileged user shipped with the node image (this service writes nothing to disk).
# The file logger writes to ./logs: create it for the unprivileged user.
RUN mkdir -p /app/logs && chown node:node /app/logs
USER node
EXPOSE 3001
CMD ["node", "dist/src/main.js"]
