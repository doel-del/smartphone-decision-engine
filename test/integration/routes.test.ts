import { describe, it, expect } from 'vitest';
import { createApiRouter } from '../../src/server/routes.js';
import { initializePipeline, Pipeline } from '../../src/server/pipeline.js';
import { EvidenceRepository } from '../../src/server/evidenceRepository.js';

/**
 * Invoke a single route handler directly, bypassing HTTP layer.
 */
function callGet(router: any, path: string): Promise<{ status: number; body: any }> {
  return new Promise((resolve) => {
    let capturedStatus = 200;
    const req: any = {
      method: 'GET', path, url: path, headers: {}, query: {}, params: {},
    };
    const res: any = {
      headersSent: false,
      status(code: number) { capturedStatus = code; return res; },
      json(body: any) { resolve({ status: capturedStatus, body }); return res; },
      sendFile() { resolve({ status: capturedStatus, body: null }); return res; },
    };
    const stack = router.stack.find((l: any) => l.route?.path === path);
    if (!stack) { resolve({ status: 404, body: null }); return; }
    const handler = stack.route.stack[0].handle;
    try {
      handler(req, res, () => {});
    } catch (err: any) {
      resolve({ status: 500, body: { error: err.message } });
    }
  });
}

describe('Integration: Decision Endpoint', () => {
  it('healthy pipeline returns 200 with published decision', async () => {
    const pipeline = initializePipeline();
    const router = createApiRouter(pipeline);
    const r = await callGet(router, '/products/samsung-galaxy-a26-5g/decision');

    expect(r.status).toBe(200);
    expect(r.body.decisionStatus).toBe('PUBLISHED');
    expect(typeof r.body.overallScore).toBe('number');
    expect(Array.isArray(r.body.confidenceReasons)).toBe(true);
    expect(r.body.confidenceReasons.length).toBeGreaterThan(0);
  });

  it('unhealthy pipeline returns 503 (does NOT return fake score)', async () => {
    const base = initializePipeline();
    const broken: Pipeline = {
      ...base,
      health: {
        ...base.health,
        ok: false,
        issues: ['test issue'],
        failedFiles: ['evidence_data_94.json: simulated failure'],
      },
    };
    const router = createApiRouter(broken);
    const r = await callGet(router, '/products/samsung-galaxy-a26-5g/decision');

    expect(r.status).toBe(503);
    expect(r.body.error).toBe('PIPELINE_UNAVAILABLE');
    expect(Array.isArray(r.body.issues)).toBe(true);
    expect(r.body.overallScore).toBeUndefined();
    expect(r.body.decisionStatus).toBeUndefined();
  });

  it('INSUFFICIENT_EVIDENCE strips overallScore to null', async () => {
    const base = initializePipeline();
    const emptyRepo = new EvidenceRepository([], [], []);
    const broken: Pipeline = { ...base, repository: emptyRepo };
    const router = createApiRouter(broken);
    const r = await callGet(router, '/products/samsung-galaxy-a26-5g/decision');

    expect(r.status).toBe(200);
    expect(r.body.decisionStatus).toBe('INSUFFICIENT_EVIDENCE');
    expect(r.body.overallScore).toBeNull();
    expect(r.body.overallScoreExact).toBeNull();
    expect(r.body.strengths).toEqual([]);
    expect(r.body.tradeoffs).toEqual([]);
  });
});

describe('Integration: Diagnostics Endpoint', () => {
  it('diagnostics endpoint exposes pipeline health', async () => {
    const pipeline = initializePipeline();
    const router = createApiRouter(pipeline);
    const r = await callGet(router, '/diagnostics/evidence');

    expect(r.status).toBe(200);
    expect(r.body.health).toBeDefined();
    expect(typeof r.body.health.ok).toBe('boolean');
    expect(Array.isArray(r.body.health.issues)).toBe(true);
    expect(typeof r.body.health.conflictedIdsCount).toBe('number');
  });
});