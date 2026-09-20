/**
 * Fictional report-chart fixture. No data comes from the author or a respondent.
 * Domain keyedItems follow that domain's ascending published IPIP item order.
 * Counts (keyed scores 1–5) and means are derived from those concrete answers.
 * ORIGINAL_RESPONSES restores original responses with this package's bank keys.
 * This module has no runtime imports, storage, network calls or random values.
 */

const personalityFixtures = [
  {id: "O", name: "Openness", keyedItems: [5, 5, 2, 5, 5, 3, 5, 4, 3, 1, 4, 4, 3, 4, 4, 2, 4, 4, 4, 4, 3, 4, 3, 5], description: "Interest in ideas, imagination and varied experiences."},
  {id: "C", name: "Conscientiousness", keyedItems: [2, 4, 3, 4, 1, 3, 5, 3, 4, 5, 5, 4, 2, 1, 3, 5, 3, 4, 4, 4, 2, 3, 5, 5], description: "Tendencies around organization, persistence and follow-through."},
  {id: "E", name: "Extraversion", keyedItems: [5, 2, 4, 3, 1, 3, 3, 3, 3, 2, 4, 4, 3, 4, 4, 5, 3, 3, 2, 5, 1, 2, 1, 2], description: "Typical social energy, assertiveness and activity."},
  {id: "A", name: "Agreeableness", keyedItems: [4, 3, 4, 3, 2, 2, 4, 4, 4, 3, 3, 3, 3, 5, 4, 1, 2, 4, 1, 4, 2, 3, 5, 5], description: "Tendencies in cooperation, trust and consideration."},
  {id: "N", name: "Neuroticism", keyedItems: [1, 4, 1, 2, 4, 3, 2, 4, 3, 4, 1, 2, 3, 3, 3, 1, 2, 3, 3, 5, 5, 2, 2, 3], description: "Tendency to experience worry and other negative feelings; not a diagnosis."},
];

export const PERSONALITY = Object.freeze(personalityFixtures.map(({id, name, keyedItems, description}) => {
  const counts = [0, 0, 0, 0, 0];
  let sum = 0;
  for (const value of keyedItems) {
    counts[value - 1] += 1;
    sum += value;
  }
  return Object.freeze({
    id,
    name,
    mean: sum / keyedItems.length,
    counts: Object.freeze(counts),
    keyedItems: Object.freeze(keyedItems),
    description,
  });
}));

export const INTERESTS = Object.freeze([
  {id: "R", name: "Realistic", value: 10, description: "Building, fixing and working with tangible things."},
  {id: "I", name: "Investigative", value: 18, description: "Investigating questions, analyzing evidence and solving problems."},
  {id: "A", name: "Artistic", value: 18, description: "Creating, expressing ideas and working with open-ended forms."},
  {id: "S", name: "Social", value: 14, description: "Helping, teaching and supporting people."},
  {id: "E", name: "Enterprising", value: 12, description: "Leading, persuading and initiating activities."},
  {id: "C", name: "Conventional", value: 10, description: "Organizing information and following structured procedures."},
].map(Object.freeze));

// Each pair represents TwIVI items k and k + 10; all 20 answers are present.
const valueFixtures = [
  {id: "conformity", name: "Conformity", pair: [4, 4], description: "Respecting expectations and avoiding actions that harm or disrupt others."},
  {id: "tradition", name: "Tradition", pair: [2, 2], description: "Commitment to inherited customs and beliefs."},
  {id: "benevolence", name: "Benevolence", pair: [5, 5], description: "Caring for the people close to you."},
  {id: "universalism", name: "Universalism", pair: [5, 5], description: "Concern for the welfare of people and nature."},
  {id: "self_direction", name: "Self-Direction", pair: [6, 6], description: "Independent thought, choice and exploration."},
  {id: "stimulation", name: "Stimulation", pair: [4, 4], description: "Novelty, excitement and challenge."},
  {id: "hedonism", name: "Hedonism", pair: [4, 4], description: "Pleasure and enjoyment in life."},
  {id: "achievement", name: "Achievement", pair: [4, 4], description: "Personal success through demonstrating competence."},
  {id: "power", name: "Power", pair: [2, 2], description: "Influence, status and control over resources."},
  {id: "security", name: "Security", pair: [4, 4], description: "Safety, stability and predictability."},
];
const valueResponseCount = valueFixtures.reduce((count, {pair}) => count + pair.length, 0);
const valueGrandMean = valueFixtures.reduce((sum, {pair}) => sum + pair[0] + pair[1], 0) / valueResponseCount;

export const VALUES = Object.freeze(valueFixtures.map(({id, name, pair, description}) => {
  const raw = (pair[0] + pair[1]) / pair.length;
  return Object.freeze({id, name, raw, centered: raw - valueGrandMean, description});
}));

// Keys are inserted in ascending published order, covering exactly the 120 bank IDs.
export const ORIGINAL_RESPONSES = Object.freeze({
  "ipip-neo-120-001": 1,
  "ipip-neo-120-002": 5,
  "ipip-neo-120-003": 5,
  "ipip-neo-120-004": 4,
  "ipip-neo-120-005": 2,
  "ipip-neo-120-006": 4,
  "ipip-neo-120-007": 2,
  "ipip-neo-120-008": 5,
  "ipip-neo-120-009": 3,
  "ipip-neo-120-010": 4,
  "ipip-neo-120-011": 1,
  "ipip-neo-120-012": 4,
  "ipip-neo-120-013": 2,
  "ipip-neo-120-014": 4,
  "ipip-neo-120-015": 3,
  "ipip-neo-120-016": 2,
  "ipip-neo-120-017": 3,
  "ipip-neo-120-018": 5,
  "ipip-neo-120-019": 3,
  "ipip-neo-120-020": 4,
  "ipip-neo-120-021": 4,
  "ipip-neo-120-022": 1,
  "ipip-neo-120-023": 5,
  "ipip-neo-120-024": 4,
  "ipip-neo-120-025": 1,
  "ipip-neo-120-026": 3,
  "ipip-neo-120-027": 3,
  "ipip-neo-120-028": 3,
  "ipip-neo-120-029": 2,
  "ipip-neo-120-030": 3,
  "ipip-neo-120-031": 2,
  "ipip-neo-120-032": 3,
  "ipip-neo-120-033": 5,
  "ipip-neo-120-034": 4,
  "ipip-neo-120-035": 5,
  "ipip-neo-120-036": 4,
  "ipip-neo-120-037": 3,
  "ipip-neo-120-038": 4,
  "ipip-neo-120-039": 2,
  "ipip-neo-120-040": 3,
  "ipip-neo-120-041": 3,
  "ipip-neo-120-042": 3,
  "ipip-neo-120-043": 3,
  "ipip-neo-120-044": 4,
  "ipip-neo-120-045": 4,
  "ipip-neo-120-046": 4,
  "ipip-neo-120-047": 2,
  "ipip-neo-120-048": 5,
  "ipip-neo-120-049": 3,
  "ipip-neo-120-050": 5,
  "ipip-neo-120-051": 5,
  "ipip-neo-120-052": 4,
  "ipip-neo-120-053": 2,
  "ipip-neo-120-054": 3,
  "ipip-neo-120-055": 5,
  "ipip-neo-120-056": 2,
  "ipip-neo-120-057": 4,
  "ipip-neo-120-058": 4,
  "ipip-neo-120-059": 3,
  "ipip-neo-120-060": 2,
  "ipip-neo-120-061": 3,
  "ipip-neo-120-062": 3,
  "ipip-neo-120-063": 3,
  "ipip-neo-120-064": 3,
  "ipip-neo-120-065": 2,
  "ipip-neo-120-066": 3,
  "ipip-neo-120-067": 2,
  "ipip-neo-120-068": 2,
  "ipip-neo-120-069": 1,
  "ipip-neo-120-070": 5,
  "ipip-neo-120-071": 3,
  "ipip-neo-120-072": 4,
  "ipip-neo-120-073": 2,
  "ipip-neo-120-074": 2,
  "ipip-neo-120-075": 3,
  "ipip-neo-120-076": 1,
  "ipip-neo-120-077": 5,
  "ipip-neo-120-078": 4,
  "ipip-neo-120-079": 5,
  "ipip-neo-120-080": 1,
  "ipip-neo-120-081": 4,
  "ipip-neo-120-082": 3,
  "ipip-neo-120-083": 2,
  "ipip-neo-120-084": 4,
  "ipip-neo-120-085": 3,
  "ipip-neo-120-086": 3,
  "ipip-neo-120-087": 3,
  "ipip-neo-120-088": 2,
  "ipip-neo-120-089": 2,
  "ipip-neo-120-090": 2,
  "ipip-neo-120-091": 3,
  "ipip-neo-120-092": 4,
  "ipip-neo-120-093": 4,
  "ipip-neo-120-094": 5,
  "ipip-neo-120-095": 4,
  "ipip-neo-120-096": 1,
  "ipip-neo-120-097": 1,
  "ipip-neo-120-098": 2,
  "ipip-neo-120-099": 2,
  "ipip-neo-120-100": 2,
  "ipip-neo-120-101": 1,
  "ipip-neo-120-102": 5,
  "ipip-neo-120-103": 3,
  "ipip-neo-120-104": 4,
  "ipip-neo-120-105": 4,
  "ipip-neo-120-106": 4,
  "ipip-neo-120-107": 4,
  "ipip-neo-120-108": 2,
  "ipip-neo-120-109": 3,
  "ipip-neo-120-110": 3,
  "ipip-neo-120-111": 4,
  "ipip-neo-120-112": 1,
  "ipip-neo-120-113": 3,
  "ipip-neo-120-114": 1,
  "ipip-neo-120-115": 1,
  "ipip-neo-120-116": 3,
  "ipip-neo-120-117": 2,
  "ipip-neo-120-118": 1,
  "ipip-neo-120-119": 1,
  "ipip-neo-120-120": 1
});
