/**
 * Deterministic scoring reference for the supplied candidate bank.
 * Original scales retain their supplied keys and completion rules.
 * Type estimates and color composites are unvalidated research outputs.
 * No network calls, packages, model fitting, or personal data embedded.
 */
const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
const keyValue = (answer, key) => key === 1 ? answer : 6 - answer;

function normalize(bank, answers) {
  const byId = new Map(bank.items.map(q => [q.id, q]));
  for (const id of Object.keys(answers)) {
    if (!byId.has(id)) throw new Error(`Unknown item ID: ${id}`);
  }
  const result = {};
  for (const item of bank.items) {
    const input = answers[item.id];
    let status, answer;
    if (input === undefined || input === null) {
      status = 'unanswered'; answer = null;
    } else if (typeof input === 'number') {
      status = 'answered'; answer = input;
    } else if (typeof input === 'object' && !Array.isArray(input)) {
      status = input.status;
      if (!['answered', 'skipped', 'unanswered'].includes(status)) {
        throw new Error(`Invalid status for ${item.id}`);
      }
      answer = input.answer ?? null;
      if (status !== 'answered' && answer !== null) {
        throw new Error(`Nonnumeric status has an answer for ${item.id}`);
      }
    } else throw new TypeError(`Invalid response for ${item.id}`);
    if (status === 'answered') {
      const max = item.module === 'values' ? 6 : 5;
      if (!Number.isInteger(answer) || answer < 1 || answer > max) {
        throw new RangeError(`Out-of-range response for ${item.id}`);
      }
    }
    result[item.id] = { status, answer };
  }
  return result;
}

function coverage(ids, answers) {
  const counts = { answered: 0, skipped: 0, unanswered: 0, required: ids.length };
  for (const id of ids) counts[answers[id].status]++;
  return { ...counts, complete: counts.answered === ids.length };
}

function aggregate(members, answers) {
  const c = coverage(members.map(m => m.itemId), answers);
  if (!c.complete) return { coverage: c, scoreAvailable: false, mean: null, sum: null, withheldReason: 'incomplete_scale' };
  const keyed = members.map(m => keyValue(answers[m.itemId].answer, m.key));
  const denominator = members.reduce((a, m) => a + m.weight, 0);
  if (!(denominator > 0)) throw new Error('Scale has no positive total weight');
  return {
    coverage: c, scoreAvailable: true,
    sum: keyed.reduce((a, b) => a + b, 0),
    mean: keyed.reduce((a, value, i) => a + value * members[i].weight, 0) / denominator,
    withheldReason: null
  };
}

export function scoreQuestionnaire(bank, suppliedAnswers, options = {}) {
  const modelName = options.typeModel ?? bank.defaultTypeModel;
  const model = bank.typeModels[modelName];
  if (!model) throw new Error(`Unknown type model: ${modelName}`);
  const answers = normalize(bank, suppliedAnswers);
  const qById = new Map(bank.items.map(q => [q.id, q]));
  const output = {
    bankVersion: bank.bankVersion,
    originalScoringVersion: bank.sourceReportKit.scoringVersion,
    scores: { big5: { domains: [], facets: [] }, interests: {}, values: {}, typePreferences: {}, colors: {} },
    claims: { officialMBTI: false, officialColorAssessment: false, calibratedTypeProbabilities: false }
  };
  for (const group of ['domains', 'facets']) {
    for (const scale of bank.originalScaleDefinitions.big5[group]) {
      const members = scale.itemAnchors.map(anchor => {
        const itemId = anchor.replace(/^item\./, '');
        return { itemId, key: qById.get(itemId).key, weight: 1 };
      });
      const stats = aggregate(members, answers);
      output.scores.big5[group].push({ id: scale.id, name: scale.name, ...stats });
    }
  }
  const interestItems = bank.items.filter(q => q.module === 'interests');
  const ic = coverage(interestItems.map(q => q.id), answers);
  output.scores.interests = { coverage: ic, scores: [] };
  for (const scale of bank.originalScaleDefinitions.interests.scores) {
    const ids = scale.itemAnchors.map(x => x.replace(/^item\./, ''));
    const sum = ic.complete ? ids.reduce((a, id) => a + answers[id].answer - 1, 0) : null;
    output.scores.interests.scores.push({ id: scale.id, name: scale.name, scoreAvailable: ic.complete,
      sum, originalResponseMean: sum === null ? null : sum / 5 + 1,
      withheldReason: ic.complete ? null : 'incomplete_interest_module' });
  }
  const valueItems = bank.items.filter(q => q.module === 'values');
  const vc = coverage(valueItems.map(q => q.id), answers);
  const total = vc.complete ? valueItems.reduce((a, q) => a + answers[q.id].answer, 0) : null;
  output.scores.values = { coverage: vc, grandMean: total === null ? null : total / 20, scores: [] };
  for (const scale of bank.originalScaleDefinitions.values.scores) {
    const ids = scale.itemAnchors.map(x => x.replace(/^item\./, ''));
    const pairSum = vc.complete ? ids.reduce((a, id) => a + answers[id].answer, 0) : null;
    output.scores.values.scores.push({ id: scale.id, name: scale.name, scoreAvailable: vc.complete,
      rawMean: pairSum === null ? null : pairSum / 2,
      centered: pairSum === null ? null : (10 * pairSum - total) / 20,
      withheldReason: vc.complete ? null : 'incomplete_values_module' });
  }
  const letters = [];
  output.scores.typePreferences = {
    model: modelName, status: 'unvalidated_research_output', axes: {},
    heuristicTypeCode: null, probability: null,
    labelPolicy: options.allowHeuristicLetters === true ? bank.letterPolicy : 'Letters disabled; continuous pilot outputs only.'
  };
  for (const [axis, scale] of Object.entries(model.axes)) {
    const stats = aggregate(scale.items, answers);
    const itemPoleMean = key => stats.scoreAvailable
      ? mean(scale.items.filter(m => m.key === key).map(m => answers[m.itemId].answer)) : null;
    let letter = null;
    if (options.allowHeuristicLetters === true && stats.scoreAvailable) {
      letter = stats.mean > 3.25 ? scale.positivePole : stats.mean < 2.75 ? scale.negativePole : null;
    }
    letters.push(letter ?? '?');
    output.scores.typePreferences.axes[axis] = {
      positivePole: scale.positivePole, negativePole: scale.negativePole, ...stats,
      centeredPreference: stats.mean === null ? null : stats.mean - 3,
      positiveKeyItemOriginalMean: itemPoleMean(1), negativeKeyItemOriginalMean: itemPoleMean(-1),
      poleSummaryCaveat: modelName === 'direct48'
        ? 'Each side summarizes six independently worded preferences; both can be endorsed.'
        : 'Hybrid key groups contain reverse-worded legacy items; do not interpret these as pure positive/negative pole scales.',
      heuristicLetter: letter, calibratedProbability: null
    };
  }
  if (options.allowHeuristicLetters === true) output.scores.typePreferences.heuristicTypeCode = letters.join('');
  const facetMap = new Map(output.scores.big5.facets.map(s => [s.id, s]));
  output.scores.colors = { model: bank.colorModel.id, status: bank.colorModel.validationStatus,
    sumTo100: false, probabilities: false, scores: {} };
  for (const [color, scale] of Object.entries(bank.colorModel.scores)) {
    const stats = aggregate(scale.items, answers);
    output.scores.colors.scores[color] = {
      label: scale.label, ...stats,
      scalePosition0to100: stats.mean === null ? null : 25 * (stats.mean - 1),
      scalePositionMeaning: 'Linear display of the 1–5 raw mean; not percentile, probability, or share of personality.',
      components: scale.facets.map(id => facetMap.get(id))
    };
  }
  return output;
}

export function unansweredTemplate(bank, form = bank.defaultForm) {
  if (!bank.forms[form]) throw new Error(`Unknown form: ${form}`);
  return Object.fromEntries(bank.forms[form].itemIds.map(id => [id, { status: 'unanswered', answer: null }]));
}
