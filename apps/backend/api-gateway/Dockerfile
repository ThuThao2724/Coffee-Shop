FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm config set fetch-retries 5 \
  && npm config set fetch-retry-factor 2 \
  && npm config set fetch-retry-mintimeout 20000 \
  && npm config set fetch-retry-maxtimeout 120000 \
  && npm config set fetch-timeout 300000 \
  && npm install
COPY . .
RUN npm run build

# Node 22 LTS: Node 20 reached end of life in April 2026 and its images no longer get OS patches.
FROM node:22-alpine
# Apply Alpine security updates published after the base image was built, and replace the bundled
# npm (vulnerable copies of tar/glob/brace-expansion).
RUN apk upgrade --no-cache && npm install -g npm@11.21.2 && npm cache clean --force
WORKDIR /app
COPY package*.json ./
RUN npm config set fetch-retries 5 \
  && npm config set fetch-retry-factor 2 \
  && npm config set fetch-retry-mintimeout 20000 \
  && npm config set fetch-retry-maxtimeout 120000 \
  && npm config set fetch-timeout 300000 \
  && npm install --only=production --no-audit --no-fund \
  && npm cache clean --force
COPY --from=builder /app/dist ./dist

# Run as the unprivileged user shipped with the node image (this service writes nothing to disk).
# The file logger writes to ./logs: create it for the unprivileged user.
RUN mkdir -p /app/logs && chown node:node /app/logs
USER node
EXPOSE 8080
CMD ["node", "dist/main"]
