# Phase 9 — MCP Server Smoke Test (Manual)

> Audience: the Hatch repo owner. This guide walks through deploying `apps/mcp` to Railway, wiring the URL into Vercel, generating an API key in the web UI, and verifying end-to-end from Claude Desktop. Screenshots of each verification step belong in this directory.

## Pre-requisites

- Railway account with a project linked to `github.com/Daniel-Visit/hatch`.
- Vercel project for the web app already deployed.
- Supabase service-role key (Supabase Dashboard → Settings → API → `service_role` `secret`).
- Claude Desktop installed locally.

## Step 1 — Deploy `apps/mcp` to Railway

1. In Railway, **New Service → Deploy from GitHub Repo** → select `Daniel-Visit/hatch`.
2. **Settings → Source → Root Directory**: `apps/mcp`.
3. **Settings → Build → Builder**: confirm Railway auto-detected **Nixpacks** (the `apps/mcp/nixpacks.toml` we shipped sets the install/build/start commands). No Dockerfile is needed.
4. **Variables**:
   - `SUPABASE_URL` = `https://vcbdtjjkkwryvmqbflah.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` = `<service_role JWT from Supabase>`
   - `PORT` = Railway injects this automatically; leave blank.
   - `LOG_LEVEL` = `info`
5. **Deploy**. Wait for the build to go green.
6. **Settings → Networking → Generate Domain**. Note the public URL (e.g. `hatch-mcp-production-xxxx.up.railway.app`).
7. Verify the deploy: `curl https://<your-railway-domain>/health` → expect `{"ok":true,"service":"hatch-mcp","version":"0.1.0"}`.

## Step 2 — Wire `NEXT_PUBLIC_MCP_URL` into Vercel

1. Vercel project → **Settings → Environment Variables**.
2. Add `NEXT_PUBLIC_MCP_URL` = `https://<your-railway-domain>/mcp` for **Production** (and Preview if desired).
3. Redeploy the web app (Deployments → latest → Redeploy).

## Step 3 — Generate an API key in the web UI

1. Visit `/settings/api-keys` on the deployed web app (sign in if needed).
2. Click **Generate API Key**.
3. Copy the plain token shown in the amber panel. You will see it ONLY ONCE.
4. Below the active-key panel, copy the `mcp-config.json` snippet (it already contains your Railway URL).

## Step 4 — Add the config to Claude Desktop

1. Open Claude Desktop → **Settings → Developer → Edit Config**.
2. Paste the snippet from Step 3.4. Replace `<paste-your-token>` with the plain token from Step 3.3.
3. Save the file. Restart Claude Desktop.
4. In a new conversation, the **🔌 plugin icon** in the input bar should show `hatch` connected. Click it to see the available tools/resources/prompts.

## Step 5 — End-to-end verification (capture screenshots)

Run each prompt below in Claude Desktop and save a screenshot of the response in this directory.

### 5.1 — `list_apps`

> "Use the Hatch MCP to list the latest 3 apps. Show me title, tagline, and author handle."

Expected: Claude calls `list_apps` with `{ limit: 3 }`, then summarizes the 3 newest apps from Hatch.

Save the screenshot as `01-list-apps.png`.

### 5.2 — `get_profile`

> "Get my Hatch profile via MCP. My handle is `<your-handle>`."

Expected: Claude calls `get_profile` with your handle and shows display name, bio, app count, follower count.

Save as `02-get-profile.png`.

### 5.3 — `like_app`

> "Use the Hatch MCP to like the app at slug `<some-slug>`."

Expected: Claude calls `like_app`, returns success. Refresh the app page at `/a/<slug>` and confirm the like persisted in your profile at `/u/<your-handle>` (Liked count incremented).

Save as `03-like-app.png`.

### 5.4 — Resource: `hatch://app/{slug}`

> "Pin the Hatch resource hatch://app/<some-slug> to this conversation, then summarize what it does."

Expected: Claude reads the resource, returns the full app JSON. Some clients surface this as a "+ Add resource" button.

Save as `04-resource-app.png`.

### 5.5 — Prompt: `draft_app_description`

> Open Claude Desktop → click `/` → select `draft_app_description` from the Hatch prompts.

Fill in:

- `app_name`: `Smoke Test App`
- `what_it_does`: `verifies the MCP prompts surface works`
- `target_audience`: (leave blank)

Expected: Claude generates an 80-120 word Hatch-style description.

Save as `05-prompt-draft.png`.

### 5.6 — Auth negative

Edit the Claude Desktop config and delete the `Authorization` header line. Restart Claude Desktop. The `hatch` MCP server should fail to connect (with a clear 401 error in the developer logs).

Save the error screenshot as `06-auth-negative.png`.

**Important:** restore the `Authorization` header after this step.

## Step 6 — Report

Once all 6 screenshots are saved here, the manual smoke test is complete. The implementation passes Phase 9 acceptance.

If any step fails, capture the error screenshot AND grab the Railway logs (`Settings → Deployments → View Logs`) and save both to this directory with a descriptive filename (e.g., `failure-step-5-1-list-apps.png` + `failure-step-5-1-railway-logs.txt`).

## Why this is manual

Phase 9's acceptance criteria explicitly call for end-to-end verification from a real MCP client (Claude Desktop). Automating this would require headless control of Claude Desktop, which is not part of this repo's tooling. The local-machine smoke (`local-smoke-report.md`) covers everything testable without a third-party client.
