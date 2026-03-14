# ── Stage 1: Build the frontend ──────────────────────────────────────────────
FROM node:22-alpine AS frontend

WORKDIR /app

# Copy dependency manifests first for layer caching
COPY package.json pnpm-lock.yaml ./

# Use the package manager declared in package.json (pnpm via Corepack)
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

# Install all dependencies (including devDependencies needed for build)
RUN pnpm install --frozen-lockfile

# Copy the rest of the source
COPY . .

# Build the Vite SPA.
# Use an explicit root-relative PocketBase URL so API calls stay on the
# same origin and don't become route-relative on nested pages like /setup.
RUN VITE_PB_URL="/" pnpm run build-only

# ── Stage 2: Build the Go binary ────────────────────────────────────────────
FROM golang:1.25-alpine AS backend

WORKDIR /build

# Copy Go module files first for layer caching
COPY backend/go.mod backend/go.sum ./
RUN go mod download

# Copy backend source
COPY backend/ .

# Copy built frontend into the embed directory
COPY --from=frontend /app/dist ./pb/pb_public/

# Build static binary
RUN CGO_ENABLED=0 go build -o bodyweight-tracker .

# ── Stage 3: Runtime ────────────────────────────────────────────────────────
FROM alpine:3

LABEL org.opencontainers.image.title="Bodyweight Tracker"
LABEL org.opencontainers.image.description="Self-hosted bodyweight and calorie tracking app"
LABEL org.opencontainers.image.source="https://github.com/Giton22/bodyweight-tracker"
LABEL org.opencontainers.image.licenses="MIT"

RUN apk add --no-cache ca-certificates wget

WORKDIR /pb

COPY --from=backend /build/bodyweight-tracker /pb/bodyweight-tracker

EXPOSE 8090

ENTRYPOINT ["/pb/bodyweight-tracker", "serve", "--http=0.0.0.0:8090", "--dir=/pb/pb_data"]
