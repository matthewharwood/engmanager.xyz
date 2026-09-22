import fs from 'node:fs';
import {prepareStoryPacket,packetMarkdown} from './story-core.mjs';
import {scoreQuestionnaire} from '../base/scoring.mjs';
const root=new URL('../',import.meta.url);
const read=name=>JSON.parse(fs.readFileSync(new URL(name,root),'utf8'));
const bank=read('background-questionnaire.json'),countries=read('countries.json'),deck=read('tarot-deck.json'),assessmentBank=read('base/unified-questionnaire-bank.json');
const answer=(...selected)=>({status:'answered',selected});
const answers={bg02:answer('o03'),bg11:answer('o01','o02'),bg15:answer('o05'),bg17:answer('o02'),bg18:answer('o02'),bg19:answer('o02'),bg20:answer('o02'),bg21:answer('o03','o05'),bg23:answer('o01'),bg26:answer('o03'),bg27:answer('o02'),bg28:answer('o03'),bg32:answer('o04'),bg33:answer('o01'),bg34:answer('o03'),bg35:answer('o01','o02','o03'),bg36:answer('o02')};
// Explicit synthetic fixture, not a claim that cards were randomly drawn for a real person.
const draw={id:'fictional-alex-spread-001',deckVersion:deck.version,createdAt:'2026-09-22T00:00:00Z',method:'synthetic-fixture',cards:[{positionId:'present',cardId:'major-14',orientation:'upright'},{positionId:'question',cardId:'major-00',orientation:'upright'},{positionId:'step',cardId:'pentacles-08',orientation:'upright'}]};
const story=prepareStoryPacket({bank,countries,deck,answers,approvedIds:Object.keys(answers),displayName:'Alex',includeName:true,birthday:'1990-09-10',approvedSymbols:['western','chinese','tarot'],draw,today:'2026-09-22'});
const raw={};
for(const q of assessmentBank.items.filter(q=>q.module!=='type_preferences_candidate')){
  if(q.module==='big5'){
    const low={N:2,E:3,O:4,A:4,C:3}[q.scale];
    const score=low+(['N','C'].includes(q.scale)?Math.floor(q.slot/5)%2:0);
    raw[q.id]=q.key===1?score:6-score;
  }else raw[q.id]=3;
}
const result=scoreQuestionnaire(assessmentBank,raw);
const assessment={exampleStatus:'FICTIONAL SYNTHETIC EXAMPLE — not a user profile',...result,modules:assessmentBank.modules.slice(0,3),scoreSemantics:assessmentBank.originalScaleSemantics};
const packet={exampleStatus:'FICTIONAL SYNTHETIC EXAMPLE',story,assessment};
fs.writeFileSync(new URL('examples/fictional-packet.json',root),JSON.stringify(packet,null,2)+'\n');
const prompt=fs.readFileSync(new URL('report-prompt.md',root),'utf8');
fs.writeFileSync(new URL('examples/fictional-report-kit.md',root),'# FICTIONAL EXAMPLE ONLY\n\n'+packetMarkdown(story,prompt,assessment));
console.log('Wrote fictional packet and ready-to-use Markdown prompt example; full birthday omitted.');
