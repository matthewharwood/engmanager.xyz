import assert from 'node:assert/strict';
import fs from 'node:fs';
import {birthdaySymbols,validateBackground,createTarotDraw,validateTarotDraw,prepareStoryPacket,packetMarkdown,assetUrl} from './story-core.mjs';
const read=name=>JSON.parse(fs.readFileSync(new URL('../'+name,import.meta.url)));
const bank=read('background-questionnaire.json'),countries=read('countries.json'),deck=read('tarot-deck.json');
assert.equal(bank.questions.length,36);
assert.equal(countries.options.length,249);
assert.equal(deck.cards.length,78);
assert.equal(deck.cards.filter(c=>c.arcana==='major').length,22);
assert.equal(new Set(deck.cards.map(c=>c.id)).size,78);
assert(bank.questions.every(q=>q.required===false && q.scoreWeight===0));

// HKO-published year boundaries. Adjacent days must not share the same animal.
for(const [day,animal] of [['2024-02-09','Rabbit'],['2024-02-10','Dragon'],['2025-01-28','Dragon'],['2025-01-29','Snake'],['2026-02-16','Snake'],['2026-02-17','Horse']])
  assert.equal(birthdaySymbols(day,'2026-09-22').chinese.animal,animal);
assert.equal(birthdaySymbols('1990-09-10').western.sign,'Virgo');
assert.equal(birthdaySymbols('1990-08-23').western.sign,null);
assert.deepEqual(birthdaySymbols('1990-08-23').western.candidates,['Leo','Virgo']);
for(const date of ['2025-02-29','2024-02-30','2027-01-01','1900-01-01','2026-9-1'])assert.throws(()=>birthdaySymbols(date,'2026-09-22'));

// Single/multi choice validation, exclusive opt-out, missingness, and catalog IDs.
const a={bg04:{status:'answered',selected:['o01','o02']},bg05:{status:'answered',selected:['country-US']},bg35:{status:'answered',selected:['o01','o02','o03']},bg36:{status:'answered',selected:['o02']}};
assert.equal(validateBackground(bank,countries,a).bg04.labels.length,2);
assert.throws(()=>validateBackground(bank,countries,{bg04:{status:'answered',selected:['o01','prefer_not']}}));
assert.throws(()=>validateBackground(bank,countries,{bg35:{status:'answered',selected:['o01','o04']}}));
assert.throws(()=>validateBackground(bank,countries,{bg05:{status:'answered',selected:['country-US','country-CN']}}));
assert.throws(()=>validateBackground(bank,countries,{bg01:{status:'skipped',selected:['o02']}}));
assert.throws(()=>validateBackground(bank,countries,{bg04:{status:'answered',selected:['o01'],selfDescription:'unselected text'}}));
assert.deepEqual(validateBackground(bank,countries,{bg04:{status:'answered',selected:['prefer_not']}}),{});

// Uniform selection code rejects out-of-range integers instead of biased modulo selection.
let calls=0;const words=[0xffffffff,0,0,0];
const fake={getRandomValues(out){out[0]=words[calls++]??0;return out},randomUUID(){return 'synthetic-rng-test'}};
const draw=createTarotDraw(deck,{cryptoProvider:fake,now:'2026-09-22T00:00:00Z'});
assert.equal(calls,4);
assert.deepEqual(draw.cards.map(c=>c.cardId),['major-00','major-01','major-02']);
assert(validateTarotDraw(deck,draw));
assert.throws(()=>validateTarotDraw(deck,{...draw,cards:[draw.cards[0],{...draw.cards[1],cardId:draw.cards[0].cardId},draw.cards[2]]}));
assert.throws(()=>createTarotDraw(deck,{cryptoProvider:{}}));

// Exports default closed. Selecting a feature alone does not export it.
const before=JSON.stringify(a);
const blank=prepareStoryPacket({bank,countries,deck,answers:a,birthday:'1990-09-10',draw});
assert.deepEqual(blank.context,[]);assert.deepEqual(blank.symbols,{});assert.equal(blank.reportName,null);
const packet=prepareStoryPacket({bank,countries,deck,answers:a,approvedIds:['bg36'],birthday:'1990-09-10',approvedSymbols:['western','chinese','tarot'],draw,displayName:'Alex'});
assert.equal(packet.symbols.western.sign,'Virgo');
assert.equal(packet.symbols.chinese.animal,'Horse');
assert.equal(packet.symbols.tarot.cards.length,3);
assert(!JSON.stringify(packet).includes('1990-09-10'));
assert(!JSON.stringify(packet).includes('country-US'));
assert(!JSON.stringify(packet).includes('African diaspora'));
assert.equal(JSON.stringify(a),before);
assert.equal(prepareStoryPacket({bank,countries,deck,approvedSymbols:['tarot'],draw}).symbols.tarot,undefined);
assert.equal(packetMarkdown({...packet,reportName:'```\n<script>x</script>'},'Brief').match(/```/g).length,2);
assert(!packetMarkdown({...packet,reportName:'<script>'},'Brief').includes('<script>'));
assert.equal(assetUrl('assets/tarot/v1/major-00.png'),null);
assert.throws(()=>assetUrl('../private.png',{assetBaseUrl:'https://assets.test/',allowedOrigins:['https://assets.test']}));
assert.throws(()=>assetUrl('assets/tarot/v1/major-00.png',{assetBaseUrl:'https://assets.example.invalid/',allowedOrigins:['https://assets.example.invalid']}));
assert.equal(assetUrl('assets/tarot/v1/major-00.png',{assetBaseUrl:'https://assets.test/story/',allowedOrigins:['https://assets.test']}),'https://assets.test/story/assets/tarot/v1/major-00.png');
console.log('PASS: 36 items, 78 cards, year boundaries, cusp ambiguity, choice validation, opt-outs, export approval, birthday exclusion, immutable answers, draw integrity, and escaped Markdown.');
