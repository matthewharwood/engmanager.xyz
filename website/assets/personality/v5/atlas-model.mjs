import {ATLAS_BANK} from './atlas-bank.mjs';

const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;

export function colorProfile(report) {
  const facets = new Map(report.domains.flatMap(domain => domain.facets.map(facet => [facet.id, facet])));
  return Object.entries(ATLAS_BANK.colors).map(([id, definition]) => {
    const components = definition.facets.map(facetId => facets.get(facetId));
    const complete = components.every(facet => facet?.complete && Number.isFinite(facet.mean));
    const rawMean = complete ? mean(components.map(facet => facet.mean)) : null;
    return {id, label:definition.label, facets:definition.facets, complete,
      mean:rawMean, position:rawMean === null ? null : Math.round(25 * (rawMean - 1))};
  });
}

export function typeProfile(answers = {}) {
  const axes = Object.entries(ATLAS_BANK.axes).map(([id, definition]) => {
    const values = definition.items.map(item => answers[item.itemId]);
    const answered = values.filter(value => Number.isInteger(value) && value >= 1 && value <= 5).length;
    const complete = answered === definition.items.length;
    const score = complete ? mean(definition.items.map((item, index) => item.key === 1 ? values[index] : 6 - values[index])) : null;
    const letter = score === null || score >= 2.75 && score <= 3.25 ? null : score > 3.25 ? definition.positivePole : definition.negativePole;
    return {id, positivePole:definition.positivePole, negativePole:definition.negativePole,
      answered, required:definition.items.length, mean:score, letter};
  });
  const complete = axes.every(axis => axis.answered === axis.required);
  const code = complete ? axes.map(axis => axis.letter ?? '?').join('') : null;
  return {version:ATLAS_BANK.version, status:'unvalidated_editorial_preference_pilot', axes, complete, code,
    note:code?.includes('?') ? 'One or more preferences are close to the middle, so a single four-letter label is withheld.' : null};
}
