# MCP Servers for Ralph Pipeline

Audit date: 2026-03-23. Source: https://github.com/punkpeye/awesome-mcp-servers + individual repo checks.

---

## Already Installed

### Context7
- **What it is:** Fetches up-to-date documentation and code examples for any library (Playwright, BullMQ, better-sqlite3, Node.js built-ins, etc.) by resolving a library ID then querying its docs.
- **Slots that use it:** Gen Quality, Test Engineering, Code Review — any agent that needs to verify API behavior before writing rules or tests.
- **Install:** Already active. Tools: `mcp__context7__resolve-library-id`, `mcp__context7__query-docs`.

### Exa
- **What it is:** Neural + keyword web search with deep content extraction. Tools: `web_search_exa` (semantic search), `get_code_context_exa` (code-specific search across GitHub/docs), `crawling_exa` (extract content from a known URL), `company_research_exa`, `deep_researcher_start/check` (multi-step research). Faster and more semantically accurate than WebFetch for research tasks.
- **Slots that use it:** Education (curriculum research), Gen Quality (CDN behavior evidence, WCAG grounding), Test Engineering (Playwright patterns), UI/UX (standards lookup), Code Review (API behavior verification).
- **Install:** Already active (installed 2026-03-23). API key: `a30be16a-17c1-45a0-9a48-506d64291dc5`.
- **Tools:** `web_search_exa`, `get_code_context_exa`, `crawling_exa`, `deep_researcher_start`, `deep_researcher_check`.

---

## Recommended Additions (ranked by impact)

### 1. Tavily MCP — `tavily-mcp`

**What it is:** Real-time web search + intelligent content extraction. Four tools: `tavily-search` (web search with ranked results), `tavily-extract` (structured content extraction from a URL), `tavily-map` (site structure mapping), and a crawler. Unlike WebFetch, Tavily returns AI-ranked results with citations, supports domain filtering, date filtering, and content summarization. Free tier available.

**Which slots benefit:**
- **Education:** Research NCERT chapters, Common Core standards, misconception databases, Khan Academy pedagogical patterns. WebFetch requires you to know the URL; Tavily finds the relevant pages.
- **Gen Quality:** Verify CDN component behavior, browser compatibility evidence, WCAG rule grounding — returns the most relevant page rather than requiring a known URL.
- **Test Engineering:** Ground test-gen rules in Playwright docs and a11y testing patterns without guessing at exact URLs.
- **UI/UX:** Look up WCAG SC references, Material Design specs, Apple HIG touchpoint guidelines during audits.

**Specific use case example (Education slot):**
```
tavily-search("NCERT class 9 trigonometry chapter student misconceptions")
→ returns ranked results from NCERT, research papers, teacher forums
→ agent reads top 3, grounds session plan in real curriculum data
```

**Install:**
```bash
# Option A — hosted (no local Node required, just API key)
claude mcp add --transport http tavily https://mcp.tavily.com/mcp/?tavilyApiKey=<YOUR_KEY>

# Option B — local
claude mcp add tavily -- npx -y tavily-mcp@latest
# then set TAVILY_API_KEY env var
```
Requires a Tavily API key (free tier: 1,000 searches/month). Sign up at https://app.tavily.com.

---

### 2. Exa MCP — `exa-mcp-server`

**What it is:** Neural/semantic web search optimized for technical and research content. Core tools: `web_search_exa` (general search returning clean content), `get_code_context_exa` (search GitHub, Stack Overflow, and documentation pages). Optional tools: `web_search_advanced_exa` (date/domain filters), `crawling_exa` (full page content from known URLs). Exa uses embedding-based retrieval — it finds semantically relevant pages rather than keyword matches.

**Why this over Tavily:** Tavily is better for general research; Exa is better for code-specific lookups and academic/research paper retrieval. They complement each other. If installing only one, start with Tavily and add Exa for Code Review and Test Engineering tasks.

**Which slots benefit:**
- **Code Review:** `get_code_context_exa` — find Node.js/BullMQ/better-sqlite3 usage patterns, edge case discussions on Stack Overflow, security advisories without knowing the exact URL.
- **Test Engineering:** Find real Playwright test patterns from GitHub, actual test harness implementations, e2e test examples for similar HTML game scenarios.
- **Gen Quality:** Research CDN component patterns (ProgressBarComponent, FeedbackManager) — Exa can surface undocumented behavior from issue trackers and community repos.

**Specific use case example (Test Engineering slot):**
```
get_code_context_exa("Playwright waitForSelector vs waitForFunction timing edge cases")
→ returns Stack Overflow threads + GitHub issues with actual timing failure examples
→ agent grounds the test-gen rule in observed behavior, not assumption
```

**Install:**
```bash
claude mcp add exa -- npx -y exa-mcp-server
# then set EXA_API_KEY env var
```
Requires Exa API key. Sign up at https://dashboard.exa.ai/api-keys. Free tier: 1,000 searches/month.

---

### 3. SQLite MCP — `mcp-sqlite`

**What it is:** Direct read/write access to a SQLite database file via MCP. Tools: `db_info`, `list_tables`, `get_table_schema`, `create_record`, `read_records`, `update_records`, `delete_records`, `query` (raw SQL). Built in Node.js, uses the `sqlite3` library. Actively maintained by eQuill Labs (not the archived Anthropic version).

**Why this matters for Ralph:** The Analytics slot currently requires spawning a sub-agent or writing Node.js scripts to query `data/builds.db`. With this MCP, any agent in the main context can directly run `SELECT category, AVG(...) FROM test_progress GROUP BY category` without shelling out. This eliminates the "Analytics requires a sub-agent" bottleneck.

**Which slots benefit:**
- **Analytics:** Run all four standard queries (category pass rates, failure patterns, first-attempt rate, never-approved games) directly in-context. No sub-agent spawn needed.
- **Gen Quality:** Query `failure_patterns` table directly to identify the highest-frequency pattern before writing a new rule — grounded in real data.
- **Test Engineering:** Query `test_progress` for lowest-performing category before launching a Phase B fix — real data, no inference.
- **Code Review:** Query `builds` table to verify DB schema assumptions match the code being reviewed.

**Specific use case example (Analytics slot):**
```
query("SELECT category, AVG(CAST(passed AS FLOAT)/NULLIF(total,0)) as rate FROM test_progress GROUP BY category ORDER BY rate ASC LIMIT 5")
→ direct result in <1 second, no sub-agent, no SSH
```

**Install:**
```bash
claude mcp add sqlite -- npx -y mcp-sqlite /Users/the-hw-app/Projects/mathai/ralph/data/builds.db
```
No API key required. Local-only. The database path is passed as a CLI argument — point it at the Ralph `builds.db`.

**Note on the archived Anthropic version:** `@modelcontextprotocol/server-sqlite` was archived May 2025 and is Python-based (requires `uv`). Use `mcp-sqlite` (npm) instead — same capabilities, Node.js native, actively maintained.

---

### 4. SSH MCP — `tufantunc/ssh-mcp`

**What it is:** Executes shell commands on remote servers over SSH. Two tools: `exec` (run any shell command, returns stdout+stderr) and `sudo-exec` (run with sudo elevation). Supports key-based auth, configurable timeouts (default 60s), and command length limits.

**Why this matters for Ralph:** The GCP server (34.93.153.206) currently requires a sub-agent for every SSH operation — checking DB status, copying files, restarting the worker, tailing logs. With SSH MCP, these become single tool calls in the main context.

**Which slots benefit:**
- **Local Verification:** Check if a build is running (`SELECT status FROM builds WHERE status='running'`) on the live server before deploying. Currently requires a full sub-agent.
- **Code Review:** After reviewing a file and finding a logic error, immediately deploy the fix without spawning a separate deploy agent.
- **All slots:** Queue builds, check worker status, tail logs — all become direct tool calls.

**Specific use case example (deploy sequence):**
```
exec("node -p \"const db=require('better-sqlite3')('/opt/ralph/data/builds.db'); db.prepare('SELECT status FROM builds WHERE status=?').get('running')||'IDLE'\"")
→ confirms IDLE
exec("sudo cp /tmp/pipeline.js /opt/ralph/lib/pipeline.js && sudo systemctl restart ralph-worker")
→ deploys and restarts in one call
```

**Install:**
```bash
# Clone and build
git clone https://github.com/tufantunc/ssh-mcp /usr/local/lib/ssh-mcp
cd /usr/local/lib/ssh-mcp && npm install

# Add to Claude Code MCP config
claude mcp add ssh-server -- node /usr/local/lib/ssh-mcp/index.js \
  --host 34.93.153.206 \
  --user the-hw-app \
  --privateKey ~/.ssh/google_compute_engine \
  --port 22
```
No API key required. SSH key auth recommended over password.

**Caution:** `sudo-exec` must be explicitly enabled with `--sudoPassword`. Do not enable blanket sudo without reviewing the security implications. For Ralph: enable `exec` only; use explicit `sudo cp` in the command string.

---

## Nice-to-Have (worth watching)

### mcp-fetch-server (fetch-mcp)

**What it is:** Enhanced WebFetch with 6 specialized tools: `fetch_html`, `fetch_markdown`, `fetch_txt`, `fetch_json`, `fetch_readable` (Mozilla Readability — extracts main article body), `fetch_youtube_transcript`. The `fetch_readable` tool is the key differentiator: it strips nav/footer/ads and returns just the article content, which is much cleaner than raw HTML for WCAG/MDN/NCERT page fetches.

**Which slots benefit:** UI/UX (WCAG article extraction), Education (NCERT/CC standards pages), Gen Quality (MDN docs extraction).

**Limitation:** Does not add search capability — you still need to know the URL. Best used alongside Tavily (Tavily finds the URL, fetch_readable extracts clean content from it).

**Install:** `npx mcp-fetch-server` — no API key required.

---

### Redis MCP — `redis-mcp-server`

**What it is:** Full Redis interface via MCP — strings, hashes, lists, sets, sorted sets, pub/sub, streams, JSON, vector search. Python-based (`pip install redis-mcp-server` or `uvx`).

**Which slots benefit:** The Ralph pipeline uses BullMQ (which uses Redis). This MCP would allow direct inspection of queue depth, stuck job locks, and Redis key state during incident diagnosis — without SSH.

**Limitation:** Python 3.14+ required. Install complexity higher than the npm servers above. Most Redis diagnostic needs are already served by SSH MCP (`redis-cli` commands via exec). Only install if queue debugging becomes a recurring bottleneck.

**Install:** `uvx --from redis-mcp-server@latest redis-mcp-server --url redis://localhost:6379/0` (local) or via SSH tunnel to the GCP Redis instance.

---

## What Was Evaluated and Rejected

| Server | Reason not recommended |
|--------|------------------------|
| `@modelcontextprotocol/server-brave-search` | Archived May 2025, no longer maintained. Use Tavily instead. |
| `@modelcontextprotocol/server-sqlite` (Anthropic) | Archived May 2025, Python-based. Use `mcp-sqlite` (npm) instead. |
| GCS-specific MCP servers | No credible, actively-maintained GCS MCP found on the list. The SSH MCP + `gsutil` commands via `exec` is more reliable for Ralph's existing GCP upload patterns. |
| Education/curriculum-specific servers | None found targeting K-12 math curriculum (NCERT, CC, Khan Academy). The closest are biology/genomics servers (OpenGenes, BioThings) — not relevant. Tavily search covers this use case more flexibly. |
| `mcp-server-commands` (g0t4) | Runs local shell commands — useful but redundant with Claude Code's existing Bash tool. SSH MCP (remote) is the gap to fill, not local shell execution. |
| MindsDB MCP | Enterprise data platform — far more complex than needed; Ralph uses SQLite directly. |
| DuckDB MCP | DuckDB-only, no SQLite support, Python-based. `mcp-sqlite` is the right fit. |

---

## Priority Install Order

1. **SQLite MCP** (`mcp-sqlite`) — zero dependencies, no API key, immediate Analytics/Gen Quality impact. Install first.
2. **Tavily MCP** (`tavily-mcp`) — requires API key but free tier is sufficient. Unlocks Education slot research quality and replaces speculative WebFetch calls.
3. **SSH MCP** (`tufantunc/ssh-mcp`) — requires cloning + npm install + SSH key config. Eliminates sub-agent spawning for all GCP server operations.
4. **Exa MCP** (`exa-mcp-server`) — add after Tavily if Code Review and Test Engineering slots need deeper code-specific search.
