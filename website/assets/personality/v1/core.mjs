import {BANK, MODULES} from './bank.mjs';

export const SCORE_VERSION = 'score-v1';
export const MODULE_IDS = Object.freeze(MODULES.map(module => module.id));
const STATE_KEYS = ['v', 'modules', 'wording', 'responses', 'skipped', 'cursor', 'view', 'reportDate', 'blocks'];
const ID = /^[A-Za-z0-9._-]{1,64}$/;

export function exactObject(value, keys, label = 'record') {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new Error(`Invalid ${label}.`);
  const actual = Object.keys(value);
  if (actual.length !== keys.length || actual.some(key => !keys.includes(key))) throw new Error(`Unexpected ${label} fields.`);
}

export function createState(modules = MODULE_IDS) {
  return validateState({v: 1, modules: [...modules], wording: 'they', responses: Array(170).fill(null),
    skipped: Array(170).fill(false), cursor: null, view: 'instructions', reportDate: null, blocks: []});
}

// Returns fresh data. A disabled module may retain private answers locally; the
// share codec deliberately removes those answers from its export copy.
export function validateState(input) {
  exactObject(input, STATE_KEYS, 'assessment');
  if (input.v !== 1) throw new Error('Unsupported assessment version.');
  if (!Array.isArray(input.modules) || input.modules.length < 1 || input.modules.length > 3 ||
      !input.modules.includes('big5') || new Set(input.modules).size !== input.modules.length ||
      Array.from(input.modules).some(id => !MODULE_IDS.includes(id))) throw new Error('Invalid selected modules.');
  if (!['they', 'she', 'he'].includes(input.wording)) throw new Error('Invalid portrait wording.');
  if (!Array.isArray(input.responses) || input.responses.length !== 170 ||
      !Array.isArray(input.skipped) || input.skipped.length !== 170) throw new Error('Expected exactly 170 response slots.');
  const responses = Array.from(input.responses), skipped = Array.from(input.skipped);
  for (let slot = 0; slot < 170; slot++) {
    const value = responses[slot], maximum = slot < 150 ? 5 : 6;
    if (value !== null && (!Number.isInteger(value) || value < 1 || value > maximum)) throw new Error(`Invalid response at slot ${slot}.`);
    if (typeof skipped[slot] !== 'boolean' || (skipped[slot] && value !== null)) throw new Error(`Invalid skipped state at slot ${slot}.`);
  }
  if (!['instructions', 'assessment', 'review', 'report'].includes(input.view)) throw new Error('Invalid assessment view.');
  let cursor = null;
  if (input.cursor !== null) {
    exactObject(input.cursor, ['module', 'slot'], 'cursor');
    const {module, slot} = input.cursor;
    if (!Number.isInteger(slot) || slot < 0 || slot >= 170 || BANK.items[slot].module !== module ||
        !input.modules.includes(module)) throw new Error('Cursor does not belong to a selected module.');
    cursor = {module, slot};
  } else if (input.view !== 'instructions') throw new Error('This view requires a saved cursor.');
  const date = input.reportDate;
  if (date !== null && (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      Number(date.slice(0, 4)) < 1 || !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) ||
      new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date)) throw new Error('Invalid report date.');
  if (!Array.isArray(input.blocks) || input.blocks.length > 12 ||
      Array.from(input.blocks).some(id => typeof id !== 'string' || !ID.test(id)) ||
      new Set(input.blocks).size !== input.blocks.length ||
      input.blocks.some((id, index) => index > 0 && input.blocks[index - 1] >= id)) throw new Error('Invalid reflection selections.');
  return {v: 1, modules: [...input.modules], wording: input.wording, responses, skipped, cursor,
    view: input.view, reportDate: date, blocks: [...input.blocks]};
}

export function selectedSlots(input) {
  const state = validateState(input);
  return state.modules.flatMap(id => BANK.items.filter(item => item.module === id).map(item => item.slot));
}

export function itemText(item, wording = 'they') {
  if (!['they', 'she', 'he'].includes(wording)) throw new Error('Invalid portrait wording.');
  return item.variants?.[wording] ?? item.text;
}

export function score(input) {
  const state = validateState(input);
  const keyed = BANK.items.map(item => {
    const answer = state.responses[item.slot];
    return answer === null ? null : item.module === 'interests' ? answer - 1 : item.key === -1 ? 6 - answer : answer;
  });
  function personalityScale(meta, items) {
    const values = items.map(item => keyed[item.slot]);
    const answered = values.filter(value => value !== null).length, complete = answered === items.length;
    const sum = complete ? values.reduce((total, value) => total + value, 0) : null;
    const counts = complete ? [1, 2, 3, 4, 5].map(value => values.filter(item => item === value).length) : null;
    return {id: meta.id, name: meta.name, answered, required: items.length, complete, sum,
      mean: complete ? sum / items.length : null, counts};
  }
  const facets = BANK.facets.map(meta => personalityScale(meta, BANK.items.filter(item => item.facet === meta.id)));
  const domains = BANK.domains.map(meta => ({...personalityScale(meta, BANK.items.filter(item => item.module === 'big5' && item.scale === meta.id)),
    facets: facets.filter(facet => BANK.facets.find(item => item.id === facet.id).domain === meta.id)}));
  function coverage(module, required) {
    const selected = state.modules.includes(module);
    const answered = selected ? BANK.items.filter(item => item.module === module && state.responses[item.slot] !== null).length : 0;
    return {selected, answered, required, complete: selected && answered === required};
  }
  const interests = coverage('interests', 30);
  interests.scores = BANK.interests.map(meta => {
    const values = BANK.items.filter(item => item.module === 'interests' && item.scale === meta.id).map(item => keyed[item.slot]);
    const sum = interests.complete ? values.reduce((total, value) => total + value, 0) : null;
    // sum is the official 0–20 score. mean retains the original 1–5 UI scale.
    return {id: meta.id, name: meta.name, sum, mean: interests.complete ? sum / 5 + 1 : null};
  });
  const values = coverage('values', 20);
  const total = values.complete ? keyed.slice(150).reduce((sum, value) => sum + value, 0) : null;
  values.grandMean = values.complete ? total / 20 : null;
  values.scores = BANK.values.map(meta => {
    const pair = BANK.items.filter(item => item.module === 'values' && item.scale === meta.id).map(item => keyed[item.slot]);
    const pairSum = values.complete ? pair[0] + pair[1] : null;
    return {id: meta.id, name: meta.name, raw: values.complete ? pairSum / 2 : null,
      centered: values.complete ? (10 * pairSum - total) / 20 : null};
  });
  const slots = selectedSlots(state);
  return {domains, facets, interests, values, completion: {
    answered: slots.filter(slot => state.responses[slot] !== null).length,
    skipped: slots.filter(slot => state.skipped[slot]).length,
    total: slots.length,
  }};
}

export const scoreAssessment = score;
