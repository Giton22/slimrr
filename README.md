# Slimrr

A self-hosted weight and calorie tracking web app. Built with Vue 3, PocketBase, and Tailwind CSS.

> This entire codebase was written with AI.

## Features

- **Weight tracking** — log daily entries, visualize trends with charts, and track progress toward your goal
- **Calorie & macro tracking** — log meals with protein, carbs, and fat; set daily calorie goals
- **Food database** — search foods via OpenFoodFacts, scan barcodes, or add custom items
- **Nutrition label scanning** — snap a photo of a nutrition label to auto-fill values (requires Vision API)
- **Groups** — create or join groups with invite codes for shared goal tracking
- **Data portability** — import and export your data via CSV
- **Self-hosted** — all data stays on your server with PocketBase as the backend

## Self-Hosting

### Quick Start

Requires [Docker](https://docs.docker.com/get-docker/) and Docker Compose.

```sh
# 1. Download the compose file
curl -o docker-compose.yml https://raw.githubusercontent.com/Giton22/slimrr/main/docker-compose.yml

# 2. Create a .env file with your admin credentials
echo "PB_ADMIN_EMAIL=admin@example.com" > .env
echo "PB_ADMIN_PASSWORD=changeme123" >> .env

# 3. Start the container
docker compose up -d
```

Then open `http://localhost:8090` in your browser.

The PocketBase admin panel is available at `http://localhost:8090/_/`.

### Nutrition Label Scanning (optional)

To enable nutrition label scanning from photos, set the Vision API environment variables in your `.env` file:

```sh
VISION_API_URL=https://api.openai.com/v1/chat/completions   # or any compatible endpoint
VISION_API_KEY=sk-...
VISION_MODEL=gpt-4o                                          # model with vision support
```

### Changing the Port

Edit `docker-compose.yml` and change the port mapping:

```yaml
ports:
  - '3000:8090' # expose on port 3000 instead
```

### Updating

```sh
docker compose pull
docker compose up -d
```

The container is tagged with [semantic versions](https://github.com/Giton22/slimrr/releases).
To pin to a specific version, change `latest` to a version tag in `docker-compose.yml`:

```yaml
image: ghcr.io/giton22/slimrr:1.0.0
```

### Automatic Updates with Watchtower

The container ships with a Watchtower-compatible label. To enable automatic updates,
uncomment the `watchtower` service at the bottom of `docker-compose.yml`.

### Data Persistence

All data is stored in a Docker named volume (`pb_data`). To back up your data:

```sh
docker run --rm \
  -v slimrr_pb_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/pb_data_backup.tar.gz -C /data .
```

---

## Development

### Prerequisites

- Node.js (^20.19 or >=22.12)
- [Vite+](https://vite.dev/plus/) (`vp`) — the unified toolchain used by this project
- Docker

### Setup

```sh
# 1. Install frontend dependencies
vp install

# 2. Start PocketBase backend (build from source)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build

# 3. Start the Vite dev server
vp dev
```

The dev server runs at `http://localhost:5173` and connects to PocketBase at `http://localhost:8090`.

### Available Commands

| Command       | Description                       |
| ------------- | --------------------------------- |
| `vp dev`      | Start dev server with hot-reload  |
| `vp build`    | Build for production              |
| `vp check`    | Run format, lint, and type checks |
| `vp lint`     | Lint code with OxLint             |
| `vp fmt src/` | Format source with OxFmt          |
| `vp test`     | Run tests with Vitest             |

### Releases

Push a version tag to trigger a CI build that publishes a new image to GHCR:

```sh
git tag v1.0.0
git push origin v1.0.0
```

### IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official / Volar)](https://marketplace.visualstudio.com/items?itemName=Vue.volar). Recommended extensions are listed in `.vscode/extensions.json`.
