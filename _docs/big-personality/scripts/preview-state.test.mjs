import {test} from 'node:test';
import assert from 'node:assert/strict';
import {freshState,validateState,encodeState,decodeState} from '../preview-state.mjs';
test('snapshot round trip retains exact step, answer, skip and module/summary choices',()=>{const state={...freshState(),step:'respond',answer:5,interests:false,shared:['O','N']};assert.deepEqual(decodeState(encodeState(state)),state);});
test('skipped and unanswered remain distinct',()=>{const skipped={...freshState(),skipped:true};assert.equal(decodeState(encodeState(skipped)).skipped,true);assert.notEqual(encodeState(skipped),encodeState(freshState()));});
test('invalid versions and unsolicited fields fail closed',()=>{assert.throws(()=>validateState({...freshState(),v:2}));assert.throws(()=>validateState({...freshState(),remoteUrl:'https://example.com'}));});
test('rejects wrong types, out-of-range values and inconsistent skipped answers',()=>{for(const answer of ['3',0,6,1.5,NaN])assert.throws(()=>validateState({...freshState(),answer}));assert.throws(()=>validateState({...freshState(),answer:1,skipped:true}));});
test('rejects duplicate/unknown dimensions and dangerous payloads',()=>{assert.throws(()=>validateState({...freshState(),shared:['O','O']}));assert.throws(()=>validateState({...freshState(),shared:['__proto__']}));assert.throws(()=>decodeState('x'.repeat(1501)));assert.throws(()=>decodeState('%3Cscript%3E'));});
test('canonical ordering is stable and noncanonical encodings fail',()=>{assert.equal(encodeState({...freshState(),shared:['C','O']}),encodeState(freshState()));assert.throws(()=>decodeState(encodeState(freshState())+'='));});
