# Market submissions / 市场提交台账

Repository: https://github.com/du-yuxuan/OneKey-Models
Topics: `dsh-plugin`, `deepseek-harness`, `tokendance`, `llm-provider`

## Status / 状态

| # | Market | Method | Link | Status |
|---|--------|--------|------|--------|
| 1 | [0xsline/awesome-deepseek-harness](https://github.com/0xsline/awesome-deepseek-harness) | PR — bilingual entry in **Models & Inference** | [PR #683](https://github.com/0xsline/awesome-deepseek-harness/pull/683) | Submitted 2026-10-04, awaiting review |
| 2 | [2BingLing/dsh-market](https://github.com/2BingLing/dsh-market) | Issue (submission template) + `dsh-plugin` topic in the daily auto-scan pool | [Issue #201](https://github.com/2BingLing/dsh-market/issues/201) | Submitted 2026-10-04; picked up by the 06:00 pipeline |
| 3 | [LivXue/dsh-plugin-shop](https://github.com/LivXue/dsh-plugin-shop) | Automatic discovery from the `dsh-plugin` GitHub topic — no application needed; `dsh.catalog` declared (category `provider`, bilingual summaries) | — | Auto-listed on the next daily build |
| 4 | [awesome-dsh-plugin/awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) | PR — one file, `data/plugins/du-yuxuan__OneKey-Models.yml` | [PR #6564](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/6564) | Submitted 2026-10-04; **blocked by the 1-day repo-age gate** (repo created same day). The checker states it re-runs itself and should clear in ~24h — no resubmission needed. |

## What each market requires / 各市场要求

### awesome-dsh-plugin

- One file per PR: `data/plugins/<owner>__<repo>.yml`
- `url` must match the repo exactly; `category` from the fixed list (`model` used here)
- A description containing `: ` must be quoted (both `en` and `zh` written)
- Repo must declare `dsh.bundle` in `package.json` ✅ and be **at least 1 day old** ⏳
- Add the `dsh-plugin` topic ✅
- Description: factual, no marketing language
- READMEs are generated — never edit them by hand

### 0xsline/awesome-deepseek-harness

- Fork → add one factual line to the matching category in **both** `README.md` and `README.zh-CN.md`
- PR title `docs: add <repo>`; markdown only, no tests

### 2BingLing/dsh-market

- Two paths, both processed by the same daily pipeline:
  1. `dsh-plugin` topic → auto-scanned into the candidate pool (fastest)
  2. submission issue → same detection flow
- Collections run daily at 06:00; success is confirmed by a bot reply

### LivXue/dsh-plugin-shop

- Automatic discovery from `dsh-plugin` / `deepseek-harness` in GitHub topics (or npm keywords)
- Screened on each build: bundle manifest, license + accessible repo, installability, credible package info, displayable info
- `dsh.catalog` declared so the listing is **declared** rather than **derived**

## Verification / 验证方式

```bash
# local pre-flight of the awesome-dsh-plugin gate
git clone https://github.com/awesome-dsh-plugin/awesome-dsh-plugin
cd awesome-dsh-plugin && npm ci
GITHUB_TOKEN=... node scripts/check-submission.mjs --base <base-sha>
```

Last local run (2026-10-04): 1 entry checked, every rule passed except
`repository is 0.0 days old (needs 1)` — the only failing check, expected on
submission day.
