export const LIMITS = Object.freeze({inputChars: 14000, systemChars: 5000, outputChars: 6000,
  maxOutputTokens: 1536, contextTokens: 8192, loadMs: 240000, generateMs: 120000});

function boundedText(value, maximum, label) {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw new Error(`Invalid ${label} in local AI output.`);
  return value.trim();
}
export function parseModelJSON(text) {
  if (typeof text !== 'string' || text.length > LIMITS.outputChars) throw new Error('Local AI output exceeded its size limit.');
  // Accept only one JSON object, optionally inside one complete JSON code fence.
  let source = text.trim();
  if (/^```(?:json)?\s*\n/i.test(source) && /\n```$/.test(source)) source = source.replace(/^```(?:json)?\s*\n/i, '').replace(/\n```$/, '');
  let value;
  try {value = JSON.parse(source);} catch {throw new Error('Local AI did not return the required report format. Your standard report is unchanged.');}
  if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('Local AI returned an invalid report object.');
  return value;
}
export function validateSections(value, allowedEvidence) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).join() !== 'sections' ||
      !Array.isArray(value.sections) || value.sections.length < 1 || value.sections.length > 4) throw new Error('Local AI returned invalid report sections.');
  return {sections: value.sections.map(section => {
    if (!section || typeof section !== 'object' || Array.isArray(section) || Object.keys(section).sort().join() !== 'body,evidence,title' ||
        !Array.isArray(section.evidence) || section.evidence.length > 8) throw new Error('Local AI returned an invalid report section.');
    const evidence = section.evidence.map(id => {
      if (typeof id !== 'string' || !/^[A-Za-z0-9._:-]{1,80}$/.test(id) || (allowedEvidence && !allowedEvidence.has(id))) throw new Error('Local AI cited evidence outside this report.');
      return id;
    });
    if (new Set(evidence).size !== evidence.length) throw new Error('Local AI repeated an evidence reference.');
    return {title: boundedText(section.title, 80, 'section title'), body: boundedText(section.body, 700, 'section text'), evidence};
  })};
}
export function validatePrompt({system, prompt}) {
  const systemText = boundedText(system, LIMITS.systemChars, 'system instruction');
  let promptText;
  if (typeof prompt === 'string') promptText = prompt;
  else {
    try {promptText = JSON.stringify(prompt);} catch {throw new Error('The local AI context is not valid JSON.');}
  }
  return {system: systemText, prompt: boundedText(promptText, LIMITS.inputChars, 'report context')};
}
