# ── Stage 1 : build the SvelteKit static site ─────────────────────────────
# The data files are not committed (see .gitignore) — we fetch them fresh at
# build time so each deployment ships the latest scrutins and deputies.
FROM node:20-alpine AS builder

# unzip is needed by the data-fetch pipeline
RUN apk add --no-cache unzip

WORKDIR /app

# Install dependencies first — better Docker layer caching.
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

# Copy the rest of the source.
COPY . .

# Fetch and process the open data (downloads ~25 MB, generates ~75 MB JSON).
# This happens on every build so the deployment is always up to date.
RUN npm run data:fetch

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
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
	CMD wget -q -O /dev/null http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
