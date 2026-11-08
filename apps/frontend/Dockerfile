FROM node:20.19-bullseye-slim AS builder

WORKDIR /app
COPY package*.json ./
RUN npm config set fund false \
    && npm config set audit false \
    && npm ci --legacy-peer-deps --prefer-online \
    || (echo "npm install failed. Dumping npm logs..." \
    && find /root/.npm/_logs -type f -name "*.log" -maxdepth 2 -print -exec cat {} \; \
    && exit 1)

COPY . .
RUN npm run build -- --mode production

# Runs as the unprivileged `nginx` user (uid 101), so it listens on 8080 instead of 80 and keeps its
# pid/temp files under /tmp. Files below stay root-owned and read-only for that user.
FROM nginxinc/nginx-unprivileged:1.31-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
USER 101
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
