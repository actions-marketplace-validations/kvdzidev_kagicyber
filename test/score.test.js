import { test } from 'node:test';
import assert from 'node:assert/strict';
import { securityScore, complianceScore, overallRisk } from '../src/score.js';

test('security score and grade', () => {
  assert.deepEqual(securityScore([]), { score: 100, grade: 'A' });
  assert.deepEqual(securityScore([{ severity: 'medium' }, { severity: 'low' }]), { score: 92, grade: 'A' });
  assert.deepEqual(securityScore([{ severity: 'high' }]), { score: 85, grade: 'B' });
});

test('any critical finding caps the grade at D', () => {
  assert.equal(securityScore([{ severity: 'critical' }]).grade, 'D');
});

test('compliance score is weighted and ignores N/A and MANUAL', () => {
  const r = complianceScore([
    { status: 'pass', weight: 3 },
    { status: 'fail', weight: 3 },
    { status: 'partial', weight: 2 },
    { status: 'na', weight: 3 },
    { status: 'manual', weight: 1 },
  ]);
  assert.equal(r.score, Math.round((100 * (3 + 1)) / 8));
  assert.equal(r.coverage, 75);
});

test('overall risk', () => {
  assert.equal(overallRisk({ score: 95 }, { grade: 'A' }, []), 'low');
  assert.equal(overallRisk({ score: 75 }, { grade: 'B' }, []), 'moderate');
  assert.equal(overallRisk({ score: 95 }, { grade: 'D' }, []), 'high');
  assert.equal(overallRisk({ score: 95 }, { grade: 'A' }, [{ severity: 'critical' }]), 'critical');
});
