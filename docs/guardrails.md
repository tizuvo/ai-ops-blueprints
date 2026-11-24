# Production AI Ops Guardrails Checklist

Every workflow in `tizuvo/ai-ops-blueprints` is engineered around a simple rule: **LLMs are probabilistic components and must be wrapped in deterministic software controls.**

Before activating any AI workflow in production, verify every control in this checklist.

---

## 1. Spend & Token Caps

Unbounded prompts and retry storms are the fastest way to burn an API budget.

- **Explicit `max_tokens` on every AI call:** Every LLM node sets an explicit upper bound (`400`–`600` tokens depending on the blueprint). Never leave output length unbounded.
- **Input size ceiling before inference:** Blueprint `02-document-triage-hitl` enforces `AI_MAX_INPUT_CHARS` (default `12000` chars) in a deterministic Code node *before* calling the model, rejecting oversized payloads cleanly.
- **Pinned model versions:** Always reference `$env.OPENAI_MODEL` (default `gpt-4o-mini`) rather than floating aliases so latency and unit cost stay predictable.
- **Bounded retries & timeouts:** External HTTP and AI nodes configure explicit `timeout` values (`5000`–`30000` ms) and capped retries (`maxTries: 2` or `3`, `waitBetweenTries: 1000`–`2000` ms).
- **Provider-level hard caps:** Set monthly hard spend limits and usage alerts directly in your OpenAI / Anthropic billing console as a second line of defense.

---

## 2. Structured Outputs & Deterministic Math

Free-form prose breaks downstream automation; LLM arithmetic introduces silent financial errors.

- **Strict JSON Schema (`response_format: json_schema`):** All classification and extraction calls enforce `strict: true` with `additionalProperties: false` so downstream `IF` and CRM nodes receive guaranteed keys and types.
- **Zero LLM math:** In Blueprint `03-weekly-revenue-site-digest`, Stripe revenue totals, failed payment counts, and site audit scores are computed in deterministic JavaScript *before* the model is called. The model only formats pre-computed facts into an executive brief.
- **Prompt grounding:** System prompts explicitly instruct the model not to invent figures, URLs, or customer commitments not present in the structured input.

---

## 3. Confidence Threshold Routing

High-confidence automation should never come at the cost of polluted CRMs or wrong customer actions.

- **Configurable threshold (`AI_CONFIDENCE_THRESHOLD`):** Defaults to `0.80` (`>= 0.80` proceeds to automated downstream sync; `< 0.80` diverts to human review).
- **Safe fallback path:** Low-confidence leads in Blueprint `01-lead-enrichment-crm-sync` are routed to `#ops-human-review` with the raw payload and AI reasoning rather than creating noisy CRM records.
- **Continuous calibration:** Review weekly `#ops-human-review` samples to tune prompts or adjust `AI_CONFIDENCE_THRESHOLD` based on real precision/recall.

---

## 4. Mandatory Human-in-the-Loop (HITL) Gates

Autonomous external communication carries high reputational and legal risk.

- **Zero unapproved customer sends:** Blueprint `02-document-triage-hitl` pauses execution using an n8n `Wait` (webhook resume) node after posting the redacted summary and draft reply to Slack with **Approve**, **Edit**, and **Reject** links.
- **Explicit decision branching:** External dispatch only executes when `decision === "approved"`. Rejections log the reviewer's reason and alert the owner without contacting the customer.
- **Immutable audit trail:** Both approved and rejected decisions write a structured audit record containing the execution ID, reviewer decision, category, confidence score, and timestamp.

---

## 5. Privacy & PII Redaction

Never send raw sensitive credentials or payment data to third-party LLM endpoints.

- **Pre-LLM redaction:** Blueprint `02-document-triage-hitl` scrubs credit card numbers (PANs), SSNs/national ID patterns, and `Bearer` authorization tokens *before* constructing the LLM payload, replacing them with deterministic placeholders (`[REDACTED_CARD]`, `[REDACTED_ID]`, `[REDACTED_TOKEN]`).
- **Webhook authentication & spam filtering:** Inbound webhooks validate a shared `X-Webhook-Secret` header in constant-time-safe string comparison and reject bot submissions via honeypot fields before any paid enrichment or AI call runs.
- **Data minimization:** Only pass the minimum fields required for scoring or drafting. Strip raw headers, cookies, and internal tokens.

---

## 6. Secret Hygiene & Credential Isolation

- **Zero hardcoded secrets:** Never commit API keys, bot tokens, or webhook secrets into workflow JSON, `.env.example`, or documentation.
- **Use n8n credentials and `$env.*`:** Store OAuth/API tokens in n8n's encrypted credential vault or inject them via environment variables (`$env.OPENAI_API_KEY`, `$env.STRIPE_API_KEY`, etc.).
- **Least-privilege API keys:** Use restricted read-only Stripe keys (`charges:read`, `invoices:read`) for reporting workflows and scoped CRM tokens for lead intake.
- **Automated secret scanning:** Run `npm run validate` locally and in CI to block accidental key leaks on every commit.

---

## 7. Error Handling & Observability

Silent workflow failures erode operational trust.

- **Non-critical enrichment degrades gracefully:** External homepage metadata fetches use `continueOnFail: true` with a 5-second timeout so a slow prospect website never blocks lead intake.
- **Dedicated error-handler branches:** Every blueprint includes an `n8n-nodes-base.errorTrigger` wired to a Slack `#ops-alerts` notification node reporting workflow name, execution ID, failing node, and error message.
- **Inactive by default:** Every blueprint ships with `"active": false` so importing into n8n never triggers live traffic before credentials and channels are verified.
