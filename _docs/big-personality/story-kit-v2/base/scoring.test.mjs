import assert from 'node:assert/strict';
import fs from 'node:fs';
import { scoreQuestionnaire, unansweredTemplate } from './scoring.mjs';
const bank = JSON.parse(fs.readFileSync(new URL('./unified-questionnaire-bank.json', import.meta.url)));
const all = Object.fromEntries(bank.items.map(q => [q.id, 3]));
const base = scoreQuestionnaire(bank, all);
assert.equal(bank.items.length, 218);
assert.equal(new Set(bank.items.map(q => q.id)).size, 218);
assert.equal(bank.forms.compact200.itemIds.length, 200);
for (const model of Object.values(bank.typeModels)) {
  for (const axis of Object.values(model.axes)) {
    assert.equal(axis.items.length, 12);
    assert.equal(new Set(axis.items.map(i => i.itemId)).size, 12);
  }
}
assert.equal(base.scores.typePreferences.heuristicTypeCode, null);
assert.equal(base.scores.typePreferences.axes.EI.mean, 3);
assert.equal(base.scores.values.grandMean, 3);
assert(base.scores.values.scores.every(s => s.centered === 0));
assert(base.scores.interests.scores.every(s => s.sum === 10));
assert(Object.values(base.scores.colors.scores).every(s => s.scalePosition0to100 === 50));

// Reverse keys, letter order, and extreme end points for the draft type model.
const positive = { ...all };
for (const scale of Object.values(bank.typeModels.direct48.axes)) {
  for (const i of scale.items) positive[i.itemId] = i.key === 1 ? 5 : 1;
}
const a = scoreQuestionnaire(bank, positive, { allowHeuristicLetters: true });
assert.equal(a.scores.typePreferences.heuristicTypeCode, 'ENFJ');
assert(Object.values(a.scores.typePreferences.axes).every(s => s.mean === 5));
const negative = { ...all };
for (const scale of Object.values(bank.typeModels.direct48.axes)) {
  for (const i of scale.items) negative[i.itemId] = i.key === 1 ? 1 : 5;
}
assert.equal(scoreQuestionnaire(bank, negative, { allowHeuristicLetters: true }).scores.typePreferences.heuristicTypeCode, 'ISTP');

// A skipped answer is not a midpoint, and incompleteness stays local except original module gates.
const missing = { ...all, 'type-candidate-ei-01': { status: 'skipped', answer: null } };
const b = scoreQuestionnaire(bank, missing);
assert.equal(b.scores.typePreferences.axes.EI.mean, null);
assert.equal(b.scores.typePreferences.axes.EI.coverage.skipped, 1);
assert.equal(b.scores.typePreferences.axes.SN.mean, 3);
const interestMissing = scoreQuestionnaire(bank, { ...all, MIP001: null });
assert(interestMissing.scores.interests.scores.every(s => s.sum === null));
const valueMissing = scoreQuestionnaire(bank, { ...all, TWIVI001: null });
assert(valueMissing.scores.values.scores.every(s => s.centered === null));

// The compact form can score hybrid48; it must not silently impute omitted direct48 items.
const compact = Object.fromEntries(bank.forms.compact200.itemIds.map(id => [id, 3]));
const c = scoreQuestionnaire(bank, compact, { typeModel: 'hybrid48' });
assert(Object.values(c.scores.typePreferences.axes).every(s => s.mean === 3));
const d = scoreQuestionnaire(bank, compact);
assert.equal(d.scores.typePreferences.axes.EI.mean, null);
assert.equal(d.scores.typePreferences.axes.TF.mean, 3);
const z = scoreQuestionnaire(bank, unansweredTemplate(bank));
assert.equal(z.scores.typePreferences.axes.EI.coverage.unanswered, 12);

// Values retain their sixth response category and exact numerator-based centering.
const values = { ...all, TWIVI001: 6, TWIVI011: 6 };
const v = scoreQuestionnaire(bank, values).scores.values;
assert.equal(v.grandMean, 3.3);
assert.equal(v.scores.find(s => s.id === 'conformity').centered, 2.7);
assert(Math.abs(v.scores.reduce((a,s) => a+s.centered,0)) < 1e-12);
for (const bad of [0, 6, 2.5, NaN, true, '4']) {
  assert.throws(() => scoreQuestionnaire(bank, { ...all, 'ipip-neo-120-001': bad }));
}
assert.throws(() => scoreQuestionnaire(bank, { ...all, unknown: 3 }));
assert.throws(() => scoreQuestionnaire(bank, all, { typeModel: 'invented' }));
assert.throws(() => scoreQuestionnaire(bank, { ...all, 'ipip-neo-120-001': { status:'skipped',answer:4 } }));
console.log('PASS: form counts, keys, endpoint direction, missingness, original module gates, compact form, values centering, and invalid inputs. These checks do not establish psychometric validity.');
