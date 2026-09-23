import {createState,score} from '../website/assets/personality/v1/core.mjs';
import {BANK} from '../website/assets/personality/v1/bank.mjs';
import {createReport} from '../website/assets/personality/v1/report.mjs';
import {DEFAULT_SETTINGS} from '../website/assets/personality/v5/studio-model.mjs';
import {DECK} from '../website/assets/personality/v5/deck.mjs';
import {PILOT} from '../website/assets/personality/v5/pilot.mjs';
export function syntheticStudioFixture(){
 const state=createState(['big5','interests','values']);state.reportDate='2026-09-22';state.view='report';state.cursor={module:'big5',slot:0};
 const keyed={O:4,C:3.5,E:3.5,A:4,N:2.5};
 for(const q of BANK.items){let answer;if(q.module==='big5'){let value=keyed[q.scale];if(value%1)value=q.slot<60?Math.floor(value):Math.ceil(value);answer=q.key===1?value:6-value;}else if(q.module==='interests'){answer={R:2,I:4,A:5,S:5,E:4,C:2}[q.scale]??3;}else answer=q.slot%5+2;state.responses[q.slot]=answer;}
 const pilotAnswers={};for(const q of PILOT.items)pilotAnswers[q.id]=q.key===1?4:2;
 const settings={...structuredClone(DEFAULT_SETTINGS),name:'Alex (fictional)',note:'I like to explore an idea together, then leave with a clear next step. Give me enough context to understand why the work matters.',includeName:true,includeNote:true,includeColors:true,includeType:true,includeFigure:true,includeZodiac:true,includeTarot:true,birthday:'1990-09-10',pilotAnswers,draw:{id:'fictional-draw-2026-09-22',deckVersion:DECK.version,createdAt:'2026-09-22T12:00:00.000Z',method:'synthetic-fixture',cards:DECK.spread.map((p,i)=>({positionId:p.id,cardId:['major-14','major-00','pentacles-08'][i],orientation:'upright'}))}};
 return {state,model:createReport(state,score(state)),settings};
}
