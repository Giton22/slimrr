# ── Stage 1: Build the frontend ──────────────────────────────────────────────
FROM node:22-alpine AS frontend

WORKDIR /app

# Copy dependency manifests first for layer caching
COPY package.json pnpm-lock.yaml ./

# Use the package manager declared in package.json (pnpm via Corepack)
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

# Install all dependencies (including devDependencies needed for build).
# Skip git hook setup in container builds.
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    VITE_GIT_HOOKS=0 HUSKY=0 pnpm install --frozen-lockfile

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
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download

# Copy backend source
COPY backend/ .

# Copy built frontend into the embed directory
COPY --from=frontend /app/dist ./pb/pb_public/

# Build static binary
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 go build -o slimrr .

# ── Stage 3: Runtime ────────────────────────────────────────────────────────
FROM alpine:3

LABEL org.opencontainers.image.title="Slimrr"
LABEL org.opencontainers.image.description="Self-hosted weight and calorie tracking app"
LABEL org.opencontainers.image.source="https://github.com/Giton22/slimrr"
LABEL org.opencontainers.image.licenses="MIT"

RUN apk add --no-cache ca-certificates wget

WORKDIR /pb

COPY --from=backend /build/slimrr /pb/slimrr

EXPOSE 8090

ENTRYPOINT ["/pb/slimrr", "serve", "--http=0.0.0.0:8090", "--dir=/pb/pb_data"]
