#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const REPO_ROOT = path.resolve(__dirname, '..');

export const SECRET_PATTERNS = [
  { name: 'OpenAI API key', regex: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g },
  { name: 'Stripe live secret key', regex: /\bsk_live_[A-Za-z0-9]{16,}\b/g },
  { name: 'Stripe live restricted key', regex: /\brk_live_[A-Za-z0-9]{16,}\b/g },
  { name: 'Slack bot token', regex: /\bxoxb-[A-Za-z0-9-]{16,}\b/g },
  { name: 'GitHub personal access token', regex: /\bghp_[A-Za-z0-9]{20,}\b/g }
];

const IGNORED_DIRS = new Set(['.git', 'node_modules']);

export function listRepoFiles(dir = REPO_ROOT) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listRepoFiles(fullPath));
    } else if (entry.isFile()) {
      results.push(fullPath);
    }
  }
  return results;
}

export function getBlueprintDirs(rootDir = REPO_ROOT) {
  const workflowsDir = path.join(rootDir, 'workflows');
  if (!fs.existsSync(workflowsDir)) return [];
  return fs
    .readdirSync(workflowsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(workflowsDir, entry.name))
    .sort();
}

export function validateWorkflowObject(workflow, label = 'workflow.json') {
  const errors = [];

  if (!workflow || typeof workflow !== 'object' || Array.isArray(workflow)) {
    return [`${label}: root value must be a JSON object`];
  }

  if (typeof workflow.name !== 'string' || workflow.name.trim().length === 0) {
    errors.push(`${label}: missing non-empty string "name"`);
  }
  if (workflow.active !== false) {
    errors.push(`${label}: "active" must be false by default`);
  }
  if (!Array.isArray(workflow.nodes) || workflow.nodes.length === 0) {
    errors.push(`${label}: "nodes" must be a non-empty array`);
  }
  if (!workflow.connections || typeof workflow.connections !== 'object' || Array.isArray(workflow.connections)) {
    errors.push(`${label}: "connections" must be an object`);
  }
  if (!workflow.settings || typeof workflow.settings !== 'object' || Array.isArray(workflow.settings)) {
    errors.push(`${label}: "settings" must be an object`);
  }
  if (!workflow.meta || typeof workflow.meta !== 'object' || Array.isArray(workflow.meta)) {
    errors.push(`${label}: "meta" must be an object`);
  }

  const nodeIds = new Set();
  const nodeNames = new Set();
  const positions = new Set();
  let hasErrorTrigger = false;

  if (Array.isArray(workflow.nodes)) {
    for (const [idx, node] of workflow.nodes.entries()) {
      const nodeLabel = `${label} -> nodes[${idx}]`;
      if (!node || typeof node !== 'object') {
        errors.push(`${nodeLabel}: must be an object`);
        continue;
      }

      if (typeof node.id !== 'string' || node.id.trim().length === 0) {
        errors.push(`${nodeLabel}: missing non-empty string "id"`);
      } else if (nodeIds.has(node.id)) {
        errors.push(`${nodeLabel}: duplicate node id "${node.id}"`);
      } else {
        nodeIds.add(node.id);
      }

      if (typeof node.name !== 'string' || node.name.trim().length === 0) {
        errors.push(`${nodeLabel}: missing non-empty string "name"`);
      } else if (nodeNames.has(node.name)) {
        errors.push(`${nodeLabel}: duplicate node name "${node.name}"`);
      } else {
        nodeNames.add(node.name);
      }

      if (typeof node.type !== 'string' || !node.type.includes('.')) {
        errors.push(`${nodeLabel}: invalid node type "${node.type}"`);
      }

      if (typeof node.typeVersion !== 'number' || !Number.isFinite(node.typeVersion) || node.typeVersion <= 0) {
        errors.push(`${nodeLabel}: "typeVersion" must be a positive number`);
      }

      if (
        !Array.isArray(node.position) ||
        node.position.length !== 2 ||
        typeof node.position[0] !== 'number' ||
        typeof node.position[1] !== 'number' ||
        !Number.isFinite(node.position[0]) ||
        !Number.isFinite(node.position[1])
      ) {
        errors.push(`${nodeLabel}: "position" must be a 2-element numeric array [x, y]`);
      } else {
        const posKey = `${node.position[0]},${node.position[1]}`;
        if (positions.has(posKey)) {
          errors.push(`${nodeLabel}: overlapping node position [${posKey}]`);
        } else {
          positions.add(posKey);
        }
      }

      if (node.type === 'n8n-nodes-base.errorTrigger') {
        hasErrorTrigger = true;
      }

      if (node.type === 'n8n-nodes-base.httpRequest') {
        const timeout = node.parameters?.options?.timeout;
        if (typeof timeout !== 'number' || timeout <= 0) {
          errors.push(`${nodeLabel} (${node.name}): httpRequest node must set a positive options.timeout`);
        }
        if (node.retryOnFail !== true || typeof node.maxTries !== 'number' || node.maxTries < 1) {
          errors.push(`${nodeLabel} (${node.name}): httpRequest node must configure retryOnFail: true and maxTries`);
        }
      }
    }
  }

  if (!hasErrorTrigger) {
    errors.push(`${label}: missing n8n-nodes-base.errorTrigger error-handler branch`);
  }

  // Validate graph connection integrity
  if (workflow.connections && typeof workflow.connections === 'object') {
    for (const [sourceName, outputMap] of Object.entries(workflow.connections)) {
      if (!nodeNames.has(sourceName)) {
        errors.push(`${label}: connection source "${sourceName}" does not exist in nodes[]`);
      }
      if (!outputMap || typeof outputMap !== 'object') {
        errors.push(`${label}: invalid connection map for source "${sourceName}"`);
        continue;
      }
      for (const [connType, branches] of Object.entries(outputMap)) {
        if (!Array.isArray(branches)) {
          errors.push(`${label}: connection "${sourceName}.${connType}" must be an array`);
          continue;
        }
        for (const branch of branches) {
          if (!Array.isArray(branch)) continue;
          for (const edge of branch) {
            if (!edge || typeof edge.node !== 'string' || !nodeNames.has(edge.node)) {
              errors.push(`${label}: connection target "${edge?.node}" from "${sourceName}" does not exist in nodes[]`);
            }
          }
        }
      }
    }
  }

  // Validate AI guardrails presence
  const serialized = JSON.stringify(workflow);
  if (!serialized.includes('max_tokens')) {
    errors.push(`${label}: missing explicit max_tokens cap on AI node`);
  }
  if (!serialized.includes('json_schema')) {
    errors.push(`${label}: missing strict json_schema structured output on AI node`);
  }
  if (!serialized.includes('AI_CONFIDENCE_THRESHOLD')) {
    errors.push(`${label}: missing AI_CONFIDENCE_THRESHOLD routing guardrail`);
  }

  return errors;
}

export function scanSecrets(rootDir = REPO_ROOT) {
  const findings = [];
  for (const filePath of listRepoFiles(rootDir)) {
    const relPath = path.relative(rootDir, filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    for (const pattern of SECRET_PATTERNS) {
      pattern.regex.lastIndex = 0;
      const match = pattern.regex.exec(content);
      if (match) {
        findings.push(`${relPath}: potential ${pattern.name} detected (${match[0].slice(0, 10)}...)`);
      }
    }
  }
  return findings;
}

export function validateRepository(rootDir = REPO_ROOT) {
  const errors = [];
  const summary = [];

  // 1. package.json zero-dependency check
  const pkgPath = path.join(rootDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const depCount = Object.keys(pkg.dependencies || {}).length;
  const devDepCount = Object.keys(pkg.devDependencies || {}).length;
  if (depCount > 0 || devDepCount > 0) {
    errors.push(`package.json: expected zero dependencies/devDependencies (found ${depCount}/${devDepCount})`);
  }

  // 2. Blueprints directory checks
  const blueprintDirs = getBlueprintDirs(rootDir);
  if (blueprintDirs.length === 0) {
    errors.push('workflows/: no blueprint directories found');
  }

  for (const dir of blueprintDirs) {
    const slug = path.basename(dir);
    const workflowPath = path.join(dir, 'workflow.json');
    const readmePath = path.join(dir, 'README.md');
    const payloadPath = path.join(dir, 'sample-payload.json');

    for (const [name, p] of [
      ['workflow.json', workflowPath],
      ['README.md', readmePath],
      ['sample-payload.json', payloadPath]
    ]) {
      if (!fs.existsSync(p)) {
        errors.push(`workflows/${slug}: missing required file ${name}`);
      }
    }

    let nodeCount = 0;
    if (fs.existsSync(workflowPath)) {
      try {
        const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
        nodeCount = Array.isArray(workflow.nodes) ? workflow.nodes.length : 0;
        errors.push(...validateWorkflowObject(workflow, `workflows/${slug}/workflow.json`));
      } catch (err) {
        errors.push(`workflows/${slug}/workflow.json: invalid JSON (${err.message})`);
      }
    }

    if (fs.existsSync(payloadPath)) {
      try {
        JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
      } catch (err) {
        errors.push(`workflows/${slug}/sample-payload.json: invalid JSON (${err.message})`);
      }
    }

    if (fs.existsSync(readmePath)) {
      const readme = fs.readFileSync(readmePath, 'utf8');
      if (!readme.includes('```mermaid')) {
        errors.push(`workflows/${slug}/README.md: missing \`\`\`mermaid architecture diagram`);
      }
    }

    summary.push({ slug, nodeCount });
  }

  // 3. Secret-leak scan across entire repository
  errors.push(...scanSecrets(rootDir));

  return { ok: errors.length === 0, errors, summary };
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const result = validateRepository(REPO_ROOT);
  if (!result.ok) {
    console.error('Validation failed:\n');
    for (const err of result.errors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }

  console.log('All Tizuvo AI Ops Blueprints validated successfully:');
  for (const item of result.summary) {
    console.log(`  ✓ ${item.slug} (${item.nodeCount} nodes)`);
  }
}
