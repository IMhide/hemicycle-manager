# syntax=docker/dockerfile:1.7
# ── Stage 1 : build the SvelteKit static site ─────────────────────────────
# The data files are not committed (see .gitignore) — we fetch them fresh at
# build time so each deployment ships the latest scrutins and deputies.
FROM node:22-alpine AS builder

# unzip + curl are needed by the data-fetch pipeline.
# bsdtar (libarchive-tools) handles ZIP64 better than busybox unzip.
RUN apk add --no-cache curl libarchive-tools

WORKDIR /app

# Install dependencies first — better Docker layer caching.
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

# Copy the rest of the source.
COPY . .

# Fetch and process the open data — ADR 0021.
# `--mount=type=cache` persists /tmp/politidex-cache across builds, so we only
# re-download ZIPs whose Last-Modified/ETag has changed. Frozen archives (15ᵉ,
# 16ᵉ) become 0-byte HEAD requests on subsequent builds (~50 ms each).
RUN --mount=type=cache,target=/tmp/politidex-cache,id=politidex-data \
    npm run data:fetch

# Build the static site.
RUN npm run build

# ── Stage 2 : serve the static build with nginx ───────────────────────────
FROM nginx:1.27-alpine

# Drop default config and provide our own.
RUN rm /etc/nginx/conf.d/default.conf
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf

# Copy the static build output.
COPY --from=builder /app/build /usr/share/nginx/html

EXPOSE 80

# Healthcheck for Coolify / orchestrators.
# Use 127.0.0.1 (not localhost) — nginx 'listen 80' on Alpine only binds
# IPv4 by default, and BusyBox wget can resolve 'localhost' to ::1 first.
# Generous start-period covers the few seconds nginx takes to bind on
# slow hosts; without it Coolify's rolling-update probe races nginx.
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
	CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
