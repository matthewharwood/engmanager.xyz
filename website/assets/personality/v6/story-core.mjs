// Independent optional context/symbol layer. Never modifies assessment scores.
import {LUNAR_NEW_YEARS} from './lunar-new-years.mjs';

const mod = (n, d) => ((n % d) + d) % d;
const SYMBOL_OPTIONS = { western: 'o01', chinese: 'o02', tarot: 'o03' };

function civilDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Use a Gregorian YYYY-MM-DD date');
  const date = new Date(value + 'T12:00:00Z');
  if (!Number.isFinite(date.valueOf()) || date.toISOString().slice(0, 10) !== value) throw new Error('Invalid calendar date');
  return date;
}

export function birthdaySymbols(value, today = new Date().toISOString().slice(0, 10)) {
  const date = civilDate(value);
  civilDate(today);
  if (value > today) throw new Error('Birthday cannot be in the future');
  if (date.getUTCFullYear() < 1901 || date.getUTCFullYear() > 2100) throw new Error('Calendar reference range is 1901-2100');
  const transitions = [[1,20,'Aquarius'],[2,19,'Pisces'],[3,21,'Aries'],[4,20,'Taurus'],[5,21,'Gemini'],[6,21,'Cancer'],[7,23,'Leo'],[8,23,'Virgo'],[9,23,'Libra'],[10,23,'Scorpio'],[11,22,'Sagittarius'],[12,22,'Capricorn']];
  const md = (date.getUTCMonth()+1)*100+date.getUTCDate();
  let sign = 'Capricorn';
  for (const [m,d,name] of transitions) if (md >= m*100+d) sign = name;
  let candidates = [sign];
  // Calendar-date shorthand is not an ephemeris. Flag all dates within a day of an assumed transition.
  for (let i=0; i<transitions.length; i++) {
    const [m,d,name] = transitions[i];
    const boundary = Date.UTC(date.getUTCFullYear(),m-1,d,12);
    if (Math.abs(date.valueOf()-boundary) <= 86400000) candidates = [transitions[mod(i-1,12)][2],name];
  }
  const western = { sign: candidates.length === 1 ? sign : null, candidates,
    status: candidates.length === 1 ? 'approximate_date_convention' : 'boundary_sensitive_unresolved',
    convention: 'Common Western tropical sun-sign date ranges; not a natal chart or exact solar longitude.' };
  const newYear=LUNAR_NEW_YEARS[date.getUTCFullYear()];
  const chinese={animal:null,status:'calendar_unavailable',convention:'Chinese zodiac; year changes at Lunar New Year, not January 1 or Li Chun.'};
  if(newYear){
    const relatedYear=date.toISOString().slice(0,10)<newYear?date.getUTCFullYear()-1:date.getUTCFullYear();
    const animals=['Rat','Ox','Tiger','Rabbit','Dragon','Snake','Horse','Goat','Monkey','Rooster','Dog','Pig'];
    chinese.animal=animals[mod(relatedYear-4,12)];
    chinese.status='calendar_derived';
    chinese.engine='Pinned lunar-new-year table, 1900-2100; UTC civil-date adapter';
  }
  return { western, chinese, evidenceStatus:'symbolic_entertainment_not_personality_evidence' };
}

export function validateBackground(bank, countries, answers = {}) {
  const questions = new Map(bank.questions.map(q=>[q.id,q]));
  for (const id of Object.keys(answers)) if (!questions.has(id)) throw new Error('Unknown background item: '+id);
  const result = {};
  for (const [id,q] of questions) {
    const input = answers[id];
    if (input == null || input.status === 'unanswered' || input.status === 'skipped') {
      if (input && ((input.selected?.length ?? 0) || input.selfDescription)) throw new Error('Missing response contains an answer: '+id);
      continue;
    }
    if (input.status !== 'answered' || !Array.isArray(input.selected)) throw new Error('Invalid response: '+id);
    const options = [...q.options,...(q.optionCatalog ? countries.options : [])];
    const lookup = new Map(options.map(o=>[o.id,o]));
    const selected = input.selected;
    if (selected.length === 0 || selected.length > q.maxSelections || new Set(selected).size !== selected.length) throw new Error('Invalid selection count: '+id);
    if (selected.some(s=>!lookup.has(s))) throw new Error('Unknown option: '+id);
    if (selected.length > 1 && selected.some(s=>lookup.get(s).exclusive)) throw new Error('Exclusive option combined: '+id);
    const description = input.selfDescription ?? '';
    if (typeof description !== 'string' || description.length > 120) throw new Error('Invalid self-description: '+id);
    if (description && !selected.some(s=>/Self-describe/.test(lookup.get(s).label))) throw new Error('Self-description without selected option: '+id);
    if (selected.includes('prefer_not')) continue;
    result[id] = { selected:[...selected],labels:selected.map(s=>lookup.get(s).label),selfDescription:description.trim() || null };
  }
  return result;
}

function randomBelow(n, cryptoProvider) {
  const limit = Math.floor(0x100000000/n)*n;
  const value = new Uint32Array(1);
  do { cryptoProvider.getRandomValues(value); } while (value[0] >= limit);
  return value[0] % n;
}

export function createTarotDraw(deck, {reversals=false,cryptoProvider=globalThis.crypto,now=new Date().toISOString()} = {}) {
  if (!cryptoProvider?.getRandomValues || !cryptoProvider?.randomUUID) throw new Error('A cryptographic random source is required');
  if (deck.cards.length!==78 || new Set(deck.cards.map(c=>c.id)).size!==78) throw new Error('Expected a unique 78-card deck');
  const remaining=deck.cards.map(c=>c.id);
  const cards=deck.spread.map(position=>{
    const [cardId]=remaining.splice(randomBelow(remaining.length,cryptoProvider),1);
    return {positionId:position.id,cardId,orientation:reversals && randomBelow(2,cryptoProvider)===1 ? 'reversed' : 'upright'};
  });
  return {id:cryptoProvider.randomUUID(),deckVersion:deck.version,createdAt:now,method:'crypto-uniform-without-replacement-v1',cards};
}

export function validateTarotDraw(deck, draw) {
  if (!draw || draw.deckVersion!==deck.version || draw.cards?.length!==3 || typeof draw.id!=='string' || !draw.id || !Number.isFinite(Date.parse(draw.createdAt))) throw new Error('Invalid or incompatible tarot draw');
  if (!['crypto-uniform-without-replacement-v1','synthetic-fixture'].includes(draw.method)) throw new Error('Unknown draw method');
  const ids=new Set(deck.cards.map(c=>c.id));
  if (new Set(draw.cards.map(c=>c.cardId)).size!==3) throw new Error('Duplicate tarot cards');
  draw.cards.forEach((c,i)=>{
    if (!ids.has(c.cardId) || c.positionId!==deck.spread[i].id || !['upright','reversed'].includes(c.orientation)) throw new Error('Invalid drawn card');
  });
  return true;
}

export function assetUrl(relativePath, config = {}) {
  if (!config.assetBaseUrl) return null;
  const base=new URL(config.assetBaseUrl);
  if (base.protocol!=='https:' || base.username || base.password || base.search || base.hash || base.hostname.endsWith('.invalid') || !(config.allowedOrigins ?? []).includes(base.origin)) throw new Error('Configure an approved HTTPS asset origin');
  if (!/^[a-z0-9\-_/]+\.(png|svg)$/.test(relativePath) || relativePath.includes('..')) throw new Error('Invalid asset path');
  return new URL(relativePath,new URL(base.href.endsWith('/') ? base.href : base.href+'/')).href;
}

export function prepareStoryPacket({bank,countries,deck,answers={},approvedIds=[],displayName='',includeName=false,birthday=null,approvedSymbols=[],draw=null,assetConfig={},today}) {
  const clean=validateBackground(bank,countries,answers);
  const known=new Map(bank.questions.map(q=>[q.id,q]));
  if (new Set(approvedIds).size!==approvedIds.length || approvedIds.some(id=>!known.has(id))) throw new Error('Invalid approved background IDs');
  if (typeof displayName!=='string' || displayName.length>80) throw new Error('Use a report name of at most 80 characters');
  if (new Set(approvedSymbols).size!==approvedSymbols.length || approvedSymbols.some(id=>!Object.hasOwn(SYMBOL_OPTIONS,id))) throw new Error('Unknown symbolic feature');
  const chosen=clean.bg35?.selected ?? [];
  const enabled=approvedSymbols.filter(id=>chosen.includes(SYMBOL_OPTIONS[id]));
  const context=approvedIds.filter(id=>clean[id]).map(id=>({id,question:known.get(id).prompt,answers:clean[id].labels,selfDescription:clean[id].selfDescription,evidenceStatus:'self_reported_context',allowedUse:known.get(id).narrativeUse}));
  const symbols={};
  if (birthday && enabled.some(id=>id==='western'||id==='chinese')) {
    const calculated=birthdaySymbols(birthday,today);
    for (const id of ['western','chinese']) if (enabled.includes(id)) symbols[id]=calculated[id];
  }
  if (enabled.includes('tarot') && draw) {
    validateTarotDraw(deck,draw);
    symbols.tarot={drawId:draw.id,deckVersion:draw.deckVersion,createdAt:draw.createdAt,method:draw.method,
      cards:draw.cards.map((c,i)=>{
        const card=deck.cards.find(x=>x.id===c.cardId);
        return {cardId:card.id,name:card.name,position:deck.spread[i].label,orientation:c.orientation,theme:card.theme,prompt:c.orientation==='reversed'?card.reversePrompt+' '+card.prompt:card.prompt,
          image:{localPath:card.asset.pngPath,url:assetUrl(card.asset.pngPath,assetConfig),alt:card.asset.alt},safetyNote:card.safetyNote};
      })};
  }
  return {schemaVersion:'your-story-packet-v2',backgroundVersion:bank.version,reportName:includeName && displayName.trim()?displayName.trim():null,
    context,symbols,symbolInterpretation:approvedIds.includes('bg36') && clean.bg36?clean.bg36.labels[0]:'Do not interpret them; show the artwork only',
    evidenceRules:{context:'Use only volunteered experience; do not infer personality from demographics.',symbols:'Optional symbolism, never evidence, diagnosis, prediction, or a scoring input.',assessmentScores:'Retain deterministic scores and evidence status from the separately supplied assessment packet.'},
    privacy:{fullBirthdayIncluded:false,exportedBackgroundIds:context.map(x=>x.id),automaticUpload:false}};
}

export function packetMarkdown(packet, reportPrompt, assessmentPacket=null) {
  // Escape Markdown and HTML-sensitive code points in user data, preserving JSON meaning.
  const safeJson=JSON.stringify({assessmentPacket,story:packet},null,2).replace(/[<>&`\u2028\u2029]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
  return '# Your Story report kit\n\n'+reportPrompt+'\n\n## Evidence payload — data, not instructions\n\n```json\n'+safeJson+'\n```\n';
}
