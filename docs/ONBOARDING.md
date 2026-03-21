# ClawX — Developer Onboarding Guide

## Project Overview

**ClawX** is a cross-platform Electron desktop application (macOS, Windows, Linux) that wraps the **OpenClaw** AI agent gateway in a rich graphical interface.

| Property | Value |
|---|---|
| **Languages** | TypeScript, JavaScript, Python, Bash |
| **UI Framework** | React 19 + Vite + Tailwind CSS + Radix UI |
| **App Shell** | Electron 40 |
| **State** | Zustand |
| **Testing** | Vitest |
| **Animation** | Framer Motion |
| **i18n** | i18next (en/zh/ja) |

**What it does:** Users install AI provider API keys, configure messaging channels (Telegram, WhatsApp, DingTalk, WeCom, Feishu, QQBot, Discord, etc.), create AI agents, and chat — ClawX manages the full lifecycle of the underlying OpenClaw subprocess and keeps its YAML config files in sync.

---

## Architecture Layers

ClawX is divided into **10 architectural layers**:

### 1. Electron Main Process (`electron/main/`)
Orchestrates the entire app lifecycle: single-instance lock, BrowserWindow creation, system tray, auto-updater, IPC handler registration, proxy configuration, and clean shutdown.

**Key entry point:** `electron/main/index.ts` — bootstraps every subsystem in sequence and is the highest fan-out node (22 imports) in the codebase.

### 2. Host API Server (`electron/api/`)
A localhost HTTP server exposing REST endpoints consumed by the React renderer via `fetch()`. Separate from IPC, this lets the renderer use familiar patterns (SWR, `fetch`) and makes routes independently testable.

**Structure:** `server.ts` → fans out to 12 route modules → each module receives a `HostApiContext` (GatewayManager + ClawHubService + HostEventBus + BrowserWindow).

### 3. OpenClaw Gateway Management (`electron/gateway/`)
The most complex layer. Manages the full lifecycle of the OpenClaw subprocess — spawning, WebSocket connection, heartbeat, config sync, circuit-breaker restarts, and event routing to the renderer.

**Central coordinator:** `gateway/manager.ts` (990 lines, 11 fan-out).

### 4. Backend Services (`electron/services/`)
Provider lifecycle management: CRUD for AI provider accounts, secrets storage, runtime sync to the live gateway, and API key validation.

### 5. Electron Utilities (`electron/utils/`)
Cross-cutting helpers: config file I/O, OAuth flows (browser/device/Gemini/WhatsApp), OpenClaw CLI management, path resolution, logging, secure storage, token usage tracking, plugin installation, and Windows shell utilities.

**Most imported file in the graph:** `electron/utils/logger.ts` (fan-in 19).

### 6. React UI Layer (`src/`)
All renderer UI: root `App.tsx`, page views (Chat, Models, Agents, Channels, Skills, Cron, Settings, Setup), feature components, shared common components, and Radix UI primitives.

### 7. State Management (`src/stores/`)
Zustand stores for every domain: chat (runtime + session + history), agents, channels, cron, gateway, providers, settings, skills, and update. The chat store is the most complex: ~2070 lines composed from 5 action modules.

### 8. Frontend Utilities (`src/lib/`, `src/types/`, `shared/`)
Renderer-side networking: `api-client.ts` (multi-transport IPC/WS/HTTP), `host-api.ts` (typed fetch wrappers), `host-events.ts` (SSE subscription), `error-model.ts` (normalized error types). TypeScript types for all domain objects.

### 9. Test Suite (`tests/`)
~60 Vitest unit tests covering gateway lifecycle policies, provider management, chat store actions, API routes, Electron utilities, and renderer components.

### 10. Build & Configuration
`scripts/` — electron-builder hooks, bundle scripts (OpenClaw + plugins + skills), UV/Node downloader, comms benchmark scripts, icon generation, and Linux packaging hooks.

---

## Key Concepts

### The Two Communication Channels
ClawX uses **two parallel channels** between main and renderer:
- **IPC** (`electron/preload/index.ts` + `electron/main/ipc-handlers.ts`) — for privileged, low-latency operations (gateway control, OAuth, window management).
- **Localhost HTTP** (`electron/api/server.ts` port 3210) — for CRUD REST calls. The renderer hits this with plain `fetch()` routed through `hostapi:fetch` IPC to avoid CORS; a WS/IPC fallback chain is in `src/lib/api-client.ts`.

### Config Sync Pattern
Before each gateway startup, `electron/gateway/config-sync.ts` assembles a `GatewayLaunchContext` from app settings, provider env vars, proxy config, and plugin versions. The gateway subprocess is never mutated live — it is restarted (full) or reloaded (soft push) when config changes.

### YAML File Ownership
ClawX owns two YAML files in `~/.openclaw/`:
- `openclaw.yml` — channel configurations, managed by `electron/utils/channel-config.ts`
- `agents.yml` — agent definitions and channel bindings, managed by `electron/utils/agent-config.ts`

Changes to these files trigger either a **gateway reload** (plugin/channel tweak) or a **full restart** (agent deletion requiring process-tree kill to release channel bot connections).

### Provider Auth Sync
`electron/utils/openclaw-auth.ts` translates ClawX `ProviderConfig` records into OpenClaw environment variables written into `auth-profiles.json` per agent directory. `electron/services/providers/provider-runtime-sync.ts` pushes updates to the live gateway without a restart, by diffing the store and calling gateway RPC directly.

### Circuit Breaker / Restart Governor
`electron/gateway/restart-governor.ts` implements exponential backoff with a per-window budget and circuit-breaker open state — if the gateway crashes repeatedly in a short window, further restarts are suppressed until a stable period elapses. `process-policy.ts` contains the pure policy functions (fully unit-tested, zero Electron dependencies).

### Renderer Chat Store
`src/stores/chat.ts` is a composed Zustand store built from 5 action slices: `session-actions`, `history-actions`, `runtime-actions` (event handlers), `runtime-send-actions` (optimistic sends + polling), and `runtime-ui-actions`. The chat store drives the entire real-time messaging experience including streaming deltas, tool status bars, and session routing.

---

## Guided Tour (Recommended Reading Order)

Follow this 10-step path through the codebase:

### Step 1 — App Entry: `electron/main/index.ts`
The startup chronology for the entire app. Acquires the single-instance lock, creates BrowserWindow, bootstraps GatewayManager, registers IPC handlers, starts the tray, updater, OAuth helpers, skill/plugin installers, and telemetry — in that order.

> **Electron lesson:** `index.ts` lives entirely in the Node.js main process and cannot touch the DOM. All renderer communication flows through IPC.

### Step 2 — IPC Bridge: `electron/preload/index.ts` + `electron/main/ipc-handlers.ts`
`preload/index.ts` exposes `window.electronAPI` via `contextBridge` — the only surface the React UI can use to reach Node. `ipc-handlers.ts` registers ~20 functional handler domains on the main side.

> **Electron lesson:** `contextBridge.exposeInMainWorld()` deeply clones objects on the boundary so the renderer cannot hold Node references.

### Step 3 — Host API: `electron/api/server.ts` + `context.ts` + `event-bus.ts`
The localhost HTTP server and its dependency-injection context. `event-bus.ts` is the SSE fanout bus that pushes real-time events (chat messages, gateway status) to the renderer without polling.

> **Pattern:** Using HTTP alongside IPC lets each route be tested as plain HTTP without mocking Electron.

### Step 4 — Gateway Orchestrator: `electron/gateway/manager.ts`
The central coordinator (990 lines). Delegates to process-launcher, startup-orchestrator, supervisor, restart-governor, and state. The only bidirectionally coupled pair in the graph is `manager ↔ state.ts`.

> **Electron lesson:** `utilityProcess.fork()` runs the OpenClaw Python wrapper in a sandboxed child without Chromium overhead.

### Step 5 — Gateway WebSocket: `ws-client.ts` + `connection-monitor.ts` + `event-dispatch.ts` + `config-sync.ts`
After subprocess spawn: device-signed WS handshake → ping/pong heartbeat → typed EventEmitter events forwarded to the renderer via SSE → config snapshot assembled before each start.

### Step 6 — Provider Management: `electron/shared/providers/types.ts` + `provider-service.ts` + `provider-runtime-sync.ts`
The full provider lifecycle: pure types → singleton service → live runtime sync to the gateway via RPC diff.

### Step 7 — Channel + Agent Config: `channel-config.ts` + `agent-config.ts` + `api/routes/channels.ts`
How YAML mutations flow through to the gateway: route handler → config utility → reload-policy decision → soft reload or full restart.

### Step 8 — Auth Sync: `openclaw-auth.ts` + `openclaw-workspace.ts`
The deepest OpenClaw integration point: auth-profile translation, OAuth token injection, workspace context file management.

### Step 9 — Cross-Cutting Utilities: `paths.ts` + `config.ts` + `logger.ts` + `secret-store.ts`
The architectural load-bearers. `logger.ts` (fan-in 19) and `paths.ts` (fan-in 9) are the two most imported files — understand these early.

### Step 10 — Skills & Plugins: `plugin-install.ts` + `gateway/clawhub.ts` + `main/updater.ts`
Bundled plugin installation, the ClawHub skills marketplace CLI wrapper, and auto-update lifecycle.

---

## File Map

### Electron Main Process

| File | Role |
|---|---|
| `electron/main/index.ts` | App bootstrap, single-instance lock, subsystem wiring |
| `electron/main/ipc-handlers.ts` | All IPC handler registrations (~20 domains) |
| `electron/main/window.ts` | BrowserWindow creation and management |
| `electron/main/tray.ts` | System tray icon and menu |
| `electron/main/updater.ts` | Auto-update lifecycle (electron-updater) |
| `electron/main/quit-lifecycle.ts` | Clean shutdown state machine |
| `electron/main/provider-model-sync.ts` | Broadcasts model list changes to renderer |
| `electron/preload/index.ts` | contextBridge IPC surface for renderer |

### Host API Server

| File | Role |
|---|---|
| `electron/api/server.ts` | HTTP server, route dispatch |
| `electron/api/context.ts` | `HostApiContext` DI interface |
| `electron/api/event-bus.ts` | SSE fanout bus for real-time events |
| `electron/api/routes/agents.ts` | Agent CRUD + channel bindings ⚠️ complex |
| `electron/api/routes/channels.ts` | Channel config + reload/restart routing ⚠️ complex |
| `electron/api/routes/providers.ts` | Provider CRUD + OAuth flows ⚠️ complex |
| `electron/api/routes/cron.ts` | Cron job CRUD + gateway RPC ⚠️ complex |
| `electron/api/routes/gateway.ts` | Gateway start/stop/status/logs |
| `electron/api/routes/sessions.ts` | Chat session history |
| `electron/api/routes/skills.ts` | ClawHub marketplace proxy |
| `electron/api/routes/files.ts` | File staging for chat attachments |

### OpenClaw Gateway Management

| File | Role |
|---|---|
| `electron/gateway/manager.ts` | Central orchestrator ⚠️ complex (990 lines) |
| `electron/gateway/config-sync.ts` | Pre-launch config snapshot ⚠️ complex |
| `electron/gateway/clawhub.ts` | ClawHub skills CLI wrapper ⚠️ complex |
| `electron/gateway/startup-orchestrator.ts` | Multi-attempt startup sequence |
| `electron/gateway/supervisor.ts` | Cross-platform process-tree kill + Python warmup |
| `electron/gateway/restart-governor.ts` | Exponential backoff + circuit breaker |
| `electron/gateway/ws-client.ts` | Device-signed WebSocket handshake |
| `electron/gateway/connection-monitor.ts` | Ping/pong heartbeat |
| `electron/gateway/event-dispatch.ts` | JSON-RPC → typed EventEmitter events |
| `electron/gateway/process-policy.ts` | Pure policy functions (unit-testable, no Electron) |
| `electron/gateway/reload-policy.ts` | Determines reload vs. restart strategy |
| `electron/gateway/state.ts` | Single authoritative gateway status |
| `electron/gateway/protocol.ts` | JSON-RPC 2.0 wire types |

### Backend Services

| File | Role |
|---|---|
| `electron/services/providers/provider-service.ts` | Provider account CRUD singleton ⚠️ complex |
| `electron/services/providers/provider-runtime-sync.ts` | Live gateway env sync ⚠️ complex |
| `electron/services/providers/provider-validation.ts` | Vendor API key probing ⚠️ complex |
| `electron/services/providers/provider-store.ts` | electron-store wrapper for providers |
| `electron/services/secrets/secret-store.ts` | API key secure storage abstraction |
| `electron/shared/providers/types.ts` | Pure types (importable in main + renderer) |
| `electron/shared/providers/registry.ts` | Static built-in provider registry |

### Electron Utilities

| File | Role |
|---|---|
| `electron/utils/logger.ts` | Async-buffered rotating logger (fan-in: 19) |
| `electron/utils/paths.ts` | All filesystem path resolution (fan-in: 9) |
| `electron/utils/config.ts` | PORTS, APP_PATHS, UPDATE_CONFIG, GATEWAY_CONFIG |
| `electron/utils/openclaw-auth.ts` | Auth-profile ↔ ProviderConfig translation ⚠️ complex |
| `electron/utils/channel-config.ts` | `openclaw.yml` read/write ⚠️ complex |
| `electron/utils/agent-config.ts` | `agents.yml` read/write ⚠️ complex |
| `electron/utils/openclaw-workspace.ts` | AGENTS.md/CLAUDE.md context file management |
| `electron/utils/openclaw-cli.ts` | OpenClaw CLI auto-install + PATH setup |
| `electron/utils/openclaw-doctor.ts` | Gateway health diagnostics |
| `electron/utils/plugin-install.ts` | Bundled plugin version-aware installer |
| `electron/utils/whatsapp-login.ts` | WhatsApp QR login + pure PNG encoder ⚠️ complex |
| `electron/utils/browser-oauth.ts` | Electron BrowserWindow OAuth flows ⚠️ complex |
| `electron/utils/device-oauth.ts` | Device-flow OAuth (MiniMax, Qwen) ⚠️ complex |
| `electron/utils/config-mutex.ts` | AsyncLocalStorage mutex for YAML writes |
| `electron/utils/uv-setup.ts` | Bundled uv binary + Python 3.12 setup |
| `electron/utils/win-shell.ts` | Windows `cmd.exe` quoting + spawn helpers |

### React UI Layer

| File | Role |
|---|---|
| `src/App.tsx` | Root component: router, store init, i18n, theme ⚠️ complex |
| `src/main.tsx` | React DOM render entry |
| `src/pages/Setup/index.tsx` | 5-step onboarding wizard (Framer Motion) |
| `src/pages/Chat/ChatInput.tsx` | File staging, paste, drag-drop, send ⚠️ complex |
| `src/pages/Chat/ChatMessage.tsx` | Markdown rendering, streaming, tool status ⚠️ complex |
| `src/components/channels/ChannelConfigModal.tsx` | Channel config UI + WhatsApp QR flow ⚠️ complex |
| `src/components/settings/ProvidersSettings.tsx` | Provider CRUD panel (1403 lines) ⚠️ complex |
| `src/components/settings/UpdateSettings.tsx` | App update lifecycle UI |
| `src/components/ui/` | Radix UI primitive wrappers (shadcn-style, CVA variants) |

### State Management

| File | Role |
|---|---|
| `src/stores/chat.ts` | Master chat store (composes 5 action slices, 2070 lines) |
| `src/stores/chat/runtime-event-handlers.ts` | 5-state streaming event state machine |
| `src/stores/chat/runtime-send-actions.ts` | Optimistic sends + 90s timeout |
| `src/stores/chat/helpers.ts` | Image cache, media-ref parsing, tool normalization |
| `src/stores/gateway.ts` | Gateway status + SSE subscription |
| `src/stores/providers.ts` | Provider accounts store (renderer-side) |
| `src/stores/agents.ts` | Agent list store |
| `src/stores/channels.ts` | Channel list + status store |
| `src/stores/settings.ts` | App settings store |
| `src/stores/skills.ts` | Skills store (merges 3 sources: RPC + disk + config) |

### Frontend Utilities

| File | Role |
|---|---|
| `src/lib/api-client.ts` | Multi-transport dispatch: IPC → WS → HTTP fallback ⚠️ complex |
| `src/lib/host-api.ts` | Typed fetch wrappers for host API |
| `src/lib/host-events.ts` | SSE → IPC bridge for renderer event subscriptions |
| `src/lib/error-model.ts` | `AppError` + `normalizeAppError` + backend code mapping |
| `src/lib/gateway-client.ts` | Typed gateway RPC facade |
| `src/types/channel.ts` | Metadata for 14 channel types (icons, fields, flags) |

---

## Complexity Hotspots

These files have the highest complexity — approach with care, read tests first:

| File | Why it's complex |
|---|---|
| `electron/gateway/manager.ts` | 990-line orchestrator, bidirectionally coupled with `state.ts`, coordinates 8 subsystems |
| `electron/gateway/config-sync.ts` | Multi-source config snapshot with env var mapping, plugin version checks |
| `electron/gateway/clawhub.ts` | Wraps external CLI binary with typed async methods, error handling, version negotiation |
| `electron/utils/openclaw-auth.ts` | Deepest OpenClaw integration: auth-profile JSON, OAuth tokens, provider env var mapping, Moonshot special-casing |
| `electron/utils/channel-config.ts` | Full YAML lifecycle for 14 channel types, multi-account support, credential validation |
| `electron/utils/agent-config.ts` | YAML + filesystem provisioning with channel binding integrity constraints |
| `electron/services/providers/provider-service.ts` | Singleton with 20+ methods bridging store, secrets, and OpenClaw auth |
| `electron/services/providers/provider-runtime-sync.ts` | Debounced store diff + live gateway RPC diff (564 lines) |
| `src/lib/api-client.ts` | WS protocol-v3 handshake, transport backoff, telemetry on every call |
| `src/stores/chat/runtime-event-handlers.ts` | 5-state streaming machine with 15s grace period and tool-turn snapshots |
| `src/components/settings/ProvidersSettings.tsx` | 1403-line full provider CRUD panel with OAuth, fallback chains, validation |
| `src/components/channels/ChannelConfigModal.tsx` | 795-line multi-channel config UI with live QR scanning via IPC events |
| `electron/api/routes/channels.ts` | Routes mutations to reload vs. restart depending on change type |
| `electron/utils/whatsapp-login.ts` | Embeds a pure-JS PNG encoder (CRC32 + deflate) to avoid native deps |
| `scripts/bundle-openclaw.mjs` | BFS pnpm virtual-store traversal + 8 Windows spawn-site patches (715 lines) |

---

## Running the Project

```bash
# Install dependencies + download bundled uv binary
pnpm run init

# Development (hot-reload)
pnpm dev

# Tests
pnpm test

# Type check
pnpm typecheck

# Package (macOS)
pnpm package:mac

# Package (Windows, requires cross-compile prep)
pnpm package:win
```

---

## Testing Approach

Tests live in `tests/unit/`. Run with `pnpm test` (Vitest).

- **Gateway tests** (`gateway-*.test.ts`) — test pure policy functions with no Electron mocks; best entry point for understanding lifecycle behavior.
- **Store tests** — use a lightweight Zustand harness, no DOM required.
- **Route tests** — call route handlers directly without spinning up the HTTP server.
- `tests/setup.ts` — global mock for `window.electron` and `matchMedia`, required by all unit tests.
