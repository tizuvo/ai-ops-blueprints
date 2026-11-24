import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  REPO_ROOT,
  getBlueprintDirs,
  validateWorkflowObject,
  scanSecrets,
  validateRepository
} from '../scripts/validate.mjs';

describe('Repository constraints & packaging', () => {
  it('package.json has zero dependencies and zero devDependencies', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'));
    assert.equal(pkg.type, 'module');
    assert.equal(Object.keys(pkg.dependencies || {}).length, 0);
    assert.equal(Object.keys(pkg.devDependencies || {}).length, 0);
  });

  it('contains all 3 required blueprint directories', () => {
    const slugs = getBlueprintDirs().map((dir) => path.basename(dir));
    assert.deepEqual(slugs, [
      '01-lead-enrichment-crm-sync',
      '02-document-triage-hitl',
      '03-weekly-revenue-site-digest'
    ]);
  });

  it('passes secret-leak scan across all repository files', () => {
    const findings = scanSecrets(REPO_ROOT);
    assert.deepEqual(findings, []);
  });
});

describe('Blueprint structure, n8n graph integrity & docs', () => {
  const blueprintDirs = getBlueprintDirs();

  for (const dir of blueprintDirs) {
    const slug = path.basename(dir);

    describe(slug, () => {
      it('contains workflow.json, sample-payload.json, and README.md', () => {
        assert.ok(fs.existsSync(path.join(dir, 'workflow.json')));
        assert.ok(fs.existsSync(path.join(dir, 'sample-payload.json')));
        assert.ok(fs.existsSync(path.join(dir, 'README.md')));
      });

      it('workflow.json passes full n8n schema, coordinate, connection, and guardrail checks', () => {
        const workflow = JSON.parse(fs.readFileSync(path.join(dir, 'workflow.json'), 'utf8'));
        const errors = validateWorkflowObject(workflow, `workflows/${slug}/workflow.json`);
        assert.deepEqual(errors, []);
      });

      it('sample-payload.json is valid JSON object', () => {
        const payload = JSON.parse(fs.readFileSync(path.join(dir, 'sample-payload.json'), 'utf8'));
        assert.equal(typeof payload, 'object');
        assert.ok(payload !== null && !Array.isArray(payload));
      });

      it('README.md includes a Mermaid architecture diagram', () => {
        const readme = fs.readFileSync(path.join(dir, 'README.md'), 'utf8');
        assert.match(readme, /```mermaid[\s\S]+?```/);
      });
    });
  }

  it('full repository validator returns ok: true with zero errors', () => {
    const result = validateRepository(REPO_ROOT);
    assert.equal(result.ok, true);
    assert.deepEqual(result.errors, []);
    assert.equal(result.summary.length, 3);
  });
});
