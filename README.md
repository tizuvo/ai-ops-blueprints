<p align="center">
  <a href="https://tizuvo.com">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://tizuvo.com/assets/svg/tizuvo-lockup-dark.svg">
      <source media="(prefers-color-scheme: light)" srcset="https://tizuvo.com/assets/svg/tizuvo-lockup-light.svg">
      <img alt="Tizuvo" src="https://tizuvo.com/assets/svg/tizuvo-lockup-light.svg" height="36">
    </picture>
  </a>
</p>

<h1 align="center">ai-ops-blueprints</h1>

<p align="center">
  Production-ready, directly importable <strong>n8n + Human-in-the-Loop (HITL) AI workflow blueprints</strong> engineered by
  <a href="https://tizuvo.com">Tizuvo</a> — with strict spend caps, confidence gates, PII redaction, Mermaid diagrams, and a zero-dependency Node.js validation suite.
</p>

<p align="center">
  <a href="https://tizuvo.com"><strong>tizuvo.com</strong></a> &middot;
  <a href="./docs/guardrails.md">AI Guardrails Checklist</a> &middot;
  <a href="https://github.com/tizuvo/site-audit-cli">site-audit-cli</a> &middot;
  <a href="https://github.com/tizuvo/zero-bloat-starter">zero-bloat-starter</a>
</p>

---

## Blueprints

| Blueprint | Trigger | Guardrail | Output |
| --- | --- | --- | --- |
| **[01 · Lead Enrichment & CRM Sync](./workflows/01-lead-enrichment-crm-sync/README.md)** | `POST /webhook/tizuvo-lead-intake` | Shared secret + honeypot check, `max_tokens: 400`, `AI_CONFIDENCE_THRESHOLD` (`0.80`) gate | CRM upsert (HubSpot/Pipedrive) + `#inbound-leads` alert, or `#ops-human-review` fallback |
| **[02 · Document Triage & HITL](./workflows/02-document-triage-hitl/README.md)** | `POST /webhook/tizuvo-doc-triage` | Pre-LLM PII scrubbing (CC/SSN/Bearer), `12,000`-char spend cap, `max_tokens: 600`, mandatory Slack Wait/Resume HITL gate | Approved reply dispatch + immutable audit log, or logged rejection alert |
| **[03 · Weekly Revenue & Site Digest](./workflows/03-weekly-revenue-site-digest/README.md)** | Weekly Cron (Mon 08:30 UTC) | Deterministic JS math before LLM (zero hallucinated totals), `max_tokens: 500`, grounded system prompt | 5-bullet founder brief to `#founders-digest` Slack + executive email |

Every blueprint ships with `"active": false`, explicit HTTP/AI timeouts and retry limits, strict JSON schemas, and a dedicated `Error Trigger -> #ops-alerts` branch.

---

## Quickstart

### 1. Validate locally (Node.js >= 20, zero dependencies)

```bash
git clone https://github.com/tizuvo/ai-ops-blueprints.git
cd ai-ops-blueprints
npm run validate
npm test
```

### 2. Configure environment variables

Copy [`.env.example`](./.env.example) and set the required variables in your n8n instance environment or n8n Credential Vault:

```bash
cp .env.example .env
```

> Never commit real API keys or tokens. All blueprints reference `$env.*` variables and n8n credentials exclusively.

### 3. Import a blueprint into n8n

1. Open your n8n workspace and click **Workflows → Add workflow → Import from File**.
2. Select any `workflows/<blueprint>/workflow.json`.
3. Attach your **Slack API** (and **SMTP** for Blueprint 03) credentials in n8n.
4. Test with the included `sample-payload.json` using the `curl` command in that blueprint's `README.md`.
5. Once verified in test mode, toggle the workflow **Active**.

---

## Production AI Guardrails

Before deploying any AI automation into live customer operations, review Tizuvo's **[Production AI Ops Guardrails Checklist](./docs/guardrails.md)** covering:

- Token & input-size spend caps
- Strict JSON Schema enforcement & deterministic math
- Confidence threshold routing (`AI_CONFIDENCE_THRESHOLD`)
- Mandatory Human-in-the-Loop (HITL) approval gates
- Pre-LLM PII redaction & secret hygiene

---

## Repository Structure

```text
ai-ops-blueprints/
├── workflows/
│   ├── 01-lead-enrichment-crm-sync/
│   │   ├── workflow.json
│   │   ├── sample-payload.json
│   │   └── README.md
│   ├── 02-document-triage-hitl/
│   │   ├── workflow.json
│   │   ├── sample-payload.json
│   │   └── README.md
│   └── 03-weekly-revenue-site-digest/
│       ├── workflow.json
│       ├── sample-payload.json
│       └── README.md
├── docs/
│   └── guardrails.md
├── scripts/
│   └── validate.mjs
├── test/
│   └── blueprints.test.mjs
├── .github/workflows/ci.yml
├── .env.example
├── package.json
└── LICENSE
```

---

## Related Tizuvo Open Source

- **[tizuvo.com](https://tizuvo.com)** — Web engineering, AI ops & performance studio
- **[tizuvo/site-audit-cli](https://github.com/tizuvo/site-audit-cli)** — Zero-dependency CLI (`npx @tizuvo/audit`) for instant site health, security, and SEO checks (integrated in Blueprint 03)
- **[tizuvo/zero-bloat-starter](https://github.com/tizuvo/zero-bloat-starter)** — Zero-dependency static & edge website starter scoring 100/100 on PageSpeed Insights

---

## License

MIT © 2026 [Tizuvo](https://tizuvo.com). See [LICENSE](./LICENSE).
