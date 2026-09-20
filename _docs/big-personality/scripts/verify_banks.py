"""Validate the delivered instrument inventory and published scoring fixtures.

This checks the research package, not a production application scorer.
Run from any directory: python3 path/to/verify_banks.py
"""
from pathlib import Path
from collections import Counter
import json

ROOT = Path(__file__).resolve().parents[1]
core = json.loads((ROOT / 'question-bank.json').read_text())
ext = json.loads((ROOT / 'extension-question-bank.json').read_text())
items = core['items']
assert len(items) == 120
assert len({x['id'] for x in items}) == 120
assert [x['publishedItemNumber'] for x in items] == list(range(1, 121))
assert Counter(x['domain'] for x in items) == {d: 24 for d in 'NEOAC'}
assert len(Counter(x['facet'] for x in items)) == 30
assert set(Counter(x['facet'] for x in items).values()) == {4}
assert Counter(x['key'] for x in items) == {1: 65, -1: 55}
assert all(x['reverseKeyed'] == (x['key'] == -1) for x in items)
assert all(x['text'] in (ROOT/'question-bank.md').read_text() for x in items)
for facet in core['facets']:
    assert set(facet['itemIds']) == {x['id'] for x in items if x['facet'] == facet['id']}

def score_core(responses):
    result = {}
    for field in ('domain', 'facet'):
        for scale in sorted({i[field] for i in items}):
            members = [i for i in items if i[field] == scale]
            values = [responses.get(i['id']) for i in members]
            if any(v is None for v in values):
                result[scale] = None
                continue
            assert all(type(v) is int and 1 <= v <= 5 for v in values)
            result[scale] = sum(v if i['key'] == 1 else 6-v for i,v in zip(members, values))/len(members)
    return result

for target in (1,3,5):
    responses={i['id']: target if i['key']==1 else 6-target for i in items}
    assert set(score_core(responses).values()) == {target}
neutral={i['id']:3 for i in items}
neutral[items[0]['id']]=None
partial=score_core(neutral)
assert {k for k,v in partial.items() if v is None} == {'N','N1'}

mini,values=ext['modules']
assert len(mini['items'])==30 and len(values['items'])==20
assert len({x['id'] for x in mini['items']+values['items']})==50
assert set(Counter(x['domain'] for x in mini['items']).values())=={5}
assert set(Counter(x['domain'] for x in values['items']).values())=={2}
assert all(x['text'] in (ROOT/'extension-question-bank.md').read_text() for x in mini['items']+values['items'])
assert [o['scoreValue'] for o in mini['responseOptions']]==[0,1,2,3,4]
assert [o['scoreValue'] for o in values['responseOptions']]==[1,2,3,4,5,6]
assert not any(x['reverse'] for x in values['items'])
assert values['instructions'].strip(), 'Missing TwIVI administration instructions'
for index,d in enumerate(values['domains'],1):
    assert d['itemIds']==[f'TWIVI{index:03d}',f'TWIVI{index+10:03d}']
for fixture in ext['goldenFixtures']:
    if fixture.get('moduleId') == 'personal_values':
        answers=fixture['answers']
        assert len(answers)==20
        if any(a is None for a in answers):
            assert fixture['expectedStatus']=='incomplete' and fixture['expectedProfile'] is None
            continue
        assert all(type(a) is int and 1<=a<=6 for a in answers)
        grand=sum(answers)/20
        raw={d['id']:(answers[j]+answers[j+10])/2 for j,d in enumerate(values['domains'])}
        centered={k:v-grand for k,v in raw.items()}
        assert raw==fixture['expectedRawMeans']
        assert grand==fixture['expectedGrandMean']
        assert all(abs(centered[k]-fixture['expectedCenteredPriorities'][k])<1e-12 for k in centered)
        assert abs(sum(centered.values()))<1e-12
        continue
    answers=[int(x) for x in fixture['answers']]
    assert len(answers)==30
    result={d['id']:0 for d in mini['domains']}
    for i,a in zip(mini['items'],answers): result[i['domain']]+=a-1
    assert result==fixture['expected'],fixture['id']
print('PASS: 170 unique rating items; core order/keys/memberships; question text parity; core boundary/missingness checks; Mini-IP and TwIVI scoring, centering, flat-profile and missingness fixtures.')
