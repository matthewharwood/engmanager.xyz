// Reviewed editorial content. This is a reflection layer, not additional psychometric scoring.
export const REPORT_VERSION = 'report-v1';
export const READING_GUIDE = [
  'This is a snapshot of how you described yourself. The numbers summarize your answers; they are not population percentiles, diagnoses, ability scores, or a ranking of your worth.',
  'Personality, interests, and values ask different questions and keep different scales. Neither the heights of their charts nor their scores can be combined into a total personality score.',
  'Short scales and circumstances add uncertainty. Look for an example and a counterexample before deciding whether an interpretation fits. The work examples below are editorial experiments, not validated predictions of career success.',
];
export const SOURCES = [
  {label:'IPIP-NEO-120: exact items and scoring keys',url:'https://ipip.ori.org/30FacetNEO-PI-RItems.htm',note:'120 public-domain items; five domains and 30 four-item facets.'},
  {label:'Johnson (2014): development of IPIP-NEO-120',url:'https://doi.org/10.1016/j.jrp.2014.05.003',note:'Research evidence does not establish norms for this community.'},
  {label:'O*NET Interest Profiler',url:'https://www.onetcenter.org/IP.html',note:'This report includes information from the O*NET Career Exploration Tools by the U.S. Department of Labor, Employment and Training Administration (USDOL/ETA). Used under the CC BY-ND 4.0 license. O*NET® is a trademark of USDOL/ETA.'},
  {label:'O*NET tool licensing',url:'https://www.onetcenter.org/license_tools.html',note:'Tech reflections are separate original editorial material and are not O*NET career recommendations.'},
  {label:'TwIVI: author instructions and permission',url:'https://gosling.psy.utexas.edu/two-short-measures-of-values-tivi-and-twivi/',note:'Twenty-Item Values Inventory; author permits use for any purpose. This is general personal values, not a workplace-only test.'},
  {label:'Sandy et al. (2017): brief measures of values',url:'https://doi.org/10.1080/00223891.2016.1231115',note:'Two items per value provide a brief estimate; centered values are mathematically dependent.'},
];

export const DOMAIN_CONTENT = {
  O:{definition:'Openness describes engagement with imagination, ideas, art, feelings, and unfamiliar experiences. It is not intelligence or technical aptitude.',
    lower:'Your responses leaned away from the keyed descriptions of openness. Familiar methods and concrete examples may feel useful. A preference for a proven approach does not rule out creative work.',
    middle:'Your score is near the response-scale midpoint. Look at the facets: enjoyment of abstract ideas, art, and changing routines need not move together. A midpoint does not establish that every answer was neutral.',
    upper:'Your responses leaned toward the keyed descriptions of openness. Exploring possibilities may be appealing. Novelty is most useful when you also decide how to evaluate and finish an experiment.',
    experiment:'Choose one small task. Try one familiar approach and one unfamiliar approach, with the same time limit. Compare what you learned and what actually shipped.',
    context:'A new domain, language barriers, and how much choice you have can change what exploration looks like.'},
  C:{definition:'Conscientiousness describes self-reported preparation, organization, persistence, responsibility, and deliberation. It does not measure moral worth or the quality of your code.',
    lower:'Your responses leaned away from the keyed descriptions of structure and follow-through. Before making this a story about character, notice workload, task clarity, and which supports are missing.',
    middle:'Your score is near the response-scale midpoint. You may answer differently about order, ambition, promises, and starting tasks. The facets can make those distinctions clearer.',
    upper:'Your responses leaned toward the keyed descriptions of structure and follow-through. Planning can support dependable work. Check whether a system helps you finish or makes a small task unnecessarily heavy.',
    experiment:'Pick one deliverable. Write its next action and a concrete definition of done. Compare effort, follow-through, and time spent polishing over the next two weeks.',
    context:'Sleep, unclear ownership, competing demands, and access to tools affect follow-through. This score cannot explain those causes.'},
  E:{definition:'Extraversion includes social approach, assertiveness, activity, excitement, and positive emotion. It is broader than talkativeness and does not measure leadership potential.',
    lower:'Your responses leaned away from the keyed descriptions of extraversion. Some forms of quieter work may suit you. Visibility can still be built through clear artifacts, prepared contributions, and deliberate relationships.',
    middle:'Your score is near the response-scale midpoint. Social comfort, assertiveness, activity, and cheerfulness can differ. Use the relevant facet before interpreting a specific social situation.',
    upper:'Your responses leaned toward the keyed descriptions of extraversion. Activity, expression, or social approach may contribute in different ways. A broad score alone does not establish that you seek every kind of social interaction.',
    experiment:'On comparable tasks, try a written first draft and a short conversation first. Compare clarity and energy. Keep the approach that helps you, while leaving space for other people to contribute.',
    context:'Team safety, meeting design, familiarity, and the cost of speaking up affect whose voice is heard.'},
  A:{definition:'Agreeableness describes trust, consideration, cooperation, and interpersonal approach. Agreement is not the same as kindness, and disagreement is not a personal failing.',
    lower:'Your responses leaned away from the keyed descriptions of agreeableness. Directness or skepticism may be useful in some contexts. Check how your delivery affects whether evidence and concerns can be heard.',
    middle:'Your score is near the response-scale midpoint. Trust, helping, conflict, and self-presentation may have different patterns. Look for situations where you are candid and considerate at the same time.',
    upper:'Your responses leaned toward the keyed descriptions of agreeableness. Care and cooperation can support relationships. Make room for a clear boundary or an evidence-based disagreement when it matters.',
    experiment:'In one design review, state the shared goal, your concern, and what evidence would change your view. Ask another person to summarize what they heard.',
    context:'Power differences, incentives, discrimination, and prior experiences affect trust and cooperation. A questionnaire does not erase those conditions.'},
  N:{definition:'Neuroticism describes self-reported negative emotion and reactions to stress. Higher scores mean more endorsement of these experiences; this is not a clinical diagnosis.',
    lower:'Your responses leaned away from the keyed descriptions of negative emotionality. You may describe fewer of these reactions. Calmness does not guarantee good judgment or make someone else’s stress illegitimate.',
    middle:'Your score is near the response-scale midpoint. Worry, anger, social discomfort, and feeling overwhelmed can differ. Consider a recent situation rather than treating the number as a complete explanation.',
    upper:'Your responses leaned toward the keyed descriptions of negative emotionality. Notice the demands around you and what support helps. The result does not establish a disorder, fragility, or unsuitability for difficult work.',
    experiment:'After a demanding task, record the demand, what you noticed, and what helped. Change one practical condition next time: preparation, recovery time, scope, or a clear escalation path.',
    context:'Recent events, health, sleep, workload, and team conditions can affect how you answer. This instrument does not separate those causes.'},
};

// Each facet remains a four-item descriptive scale, never a job-placement rule.
export const FACET_CONTENT = {
  N1:['Worry and apprehension.','Before a risky change, write the specific uncertainty and one check that would reduce it.'],
  N2:['Irritation and anger.','In a difficult review, pause long enough to name the issue without assigning intent.'],
  N3:['Low mood and negative self-evaluation. This historical label is not a depression diagnosis.','Separate feedback about one piece of work from a conclusion about your whole self.'],
  N4:['Discomfort drawing attention in social situations.','Prepare one question or written comment before a meeting where you want to participate.'],
  N5:['Overindulgence and difficulty resisting impulses.','Try one small environmental boundary around a distracting activity and see whether it helps.'],
  N6:['Feeling overwhelmed under pressure.','Define a concrete point at which you will ask for help or reduce scope.'],
  E1:['Ease and warmth in approaching people.','Compare an informal check-in with an asynchronous introduction; notice which works for this relationship.'],
  E2:['Preference for being around groups of people.','Compare a large discussion with a smaller conversation on a similar problem.'],
  E3:['Taking charge and expressing direction.','Try proposing a direction while explicitly inviting alternatives.'],
  E4:['Pace and amount of activity.','Track whether a busy day and a productive day mean the same thing for you.'],
  E5:['Attraction to excitement and stimulation.','Separate a reversible experiment from a production risk before seeking a new challenge.'],
  E6:['Positive emotion and enjoyment.','Notice which ordinary parts of the workday you actually enjoy, without demanding constant positivity.'],
  O1:['Imagination and mental exploration.','Sketch one possible future state, then name the next observable test.'],
  O2:['Interest in art and aesthetic experience.','Review one interface or document for the experience it creates, alongside whether it works.'],
  O3:['Attention to emotional experiences.','In a disagreement, name both the technical issue and the human concern you heard.'],
  O4:['Preference for variety and unfamiliar experiences.','Test a small workflow change before committing the whole team to it.'],
  O5:['Interest in abstract and challenging ideas. This is not an IQ score.','Pair an abstract idea with a concrete example that another person can inspect.'],
  O6:['Responses to the original political and values statements. Cultural meaning can vary; this does not establish political identity.','Treat this facet cautiously. Do not use it to infer a colleague’s politics or professional ability.'],
  A1:['Expectations about other people’s intentions.','Make one assumption explicit and check it against a specific interaction.'],
  A2:['Responses about using or obstructing others. The historical label “Morality” is not an overall moral grade.','Make credit, constraints, and competing interests explicit in a collaborative decision.'],
  A3:['Interest in helping and attending to others.','Offer one bounded piece of help while protecting the time needed for your own commitments.'],
  A4:['Responses about interpersonal conflict and retaliation.','Practice disagreeing with the proposal while preserving the relationship.'],
  A5:['Self-presentation and self-regard. Modesty is not ability or worth.','Describe a contribution with evidence and shared credit, without either exaggerating or erasing it.'],
  A6:['Concern for people facing difficulty.','Ask what support would actually help instead of assuming another person’s needs.'],
  C1:['Confidence in handling tasks successfully. This is self-report, not a skills test.','Compare your confidence with one concrete piece of evidence and one skill still to learn.'],
  C2:['Preference for tidiness and order.','Organize one work surface or information source, then test whether retrieval becomes easier.'],
  C3:['Commitments, truthfulness, and rule-following.','Make a commitment explicit and renegotiate early if circumstances change.'],
  C4:['Effort and achievement striving.','Write a useful stopping condition before a task expands beyond its purpose.'],
  C5:['Preparation, starting, and carrying out plans.','Lower the friction for starting one task; measure whether the next action becomes easier.'],
  C6:['Deliberation before action.','Match the amount of checking to the reversibility and consequences of the decision.'],
};

export const INTEREST_CONTENT = {
 R:['Hands-on, practical activity.','Try a small physical-computing, hardware, or making project.'],
 I:['Investigating questions and solving problems.','Explore a debugging investigation, user-research question, or technical spike.'],
 A:['Creating and expressing ideas.','Try interface exploration, visual explanation, or a prototype with several alternatives.'],
 S:['Helping, teaching, and supporting people.','Try a bounded mentoring session, user education, or knowledge-sharing artifact.'],
 E:['Influencing, organizing, or leading toward a goal.','Try presenting a proposal and asking what would make it useful to its audience.'],
 C:['Working with organized information and procedures.','Improve a documentation index, data workflow, or repeatable operational task.'],
};
export const VALUE_CONTENT = {
 conformity:['Avoiding actions that upset or harm others and meeting shared expectations.','Where does a shared convention help, and where should it be questioned?'],
 tradition:['Respecting inherited practices, beliefs, and customs.','Which practice is meaningful to preserve, and why?'],
 benevolence:['Caring for the welfare of people close to you.','How can you support a teammate while maintaining a sustainable boundary?'],
 universalism:['Concern for people broadly and for the natural world.','Which stakeholders are absent from a decision you are making?'],
 self_direction:['Independent thought, choice, and action.','Where would clearer decision authority matter more than fewer meetings?'],
 stimulation:['Novelty, variety, and challenge.','Which reversible challenge would be worth trying next?'],
 hedonism:['Enjoyment and pleasurable experiences.','What part of work or life would you like to enjoy more without needing to justify it as productivity?'],
 achievement:['Personal success through demonstrating competence.','What evidence of useful work matters to you, beyond a status signal?'],
 power:['Influence, status, and control over resources.','What would you use increased influence to change, and who would be affected?'],
 security:['Safety, stability, and predictability.','Which uncertainty needs reducing before you can explore comfortably?'],
};

export const EXPERIMENTS = [
 {id:'craft-log',title:'Make useful work inspectable',body:'For two weeks, keep a short record of a problem, the action you took, its outcome, and shared credit. Bring one concrete artifact to a relevant conversation. Visibility can make useful work easier to recognize; it is not evidence that the most visible work is the most valuable.',measure:'Notice whether others can understand the contribution without needing you to perform confidence.'},
 {id:'quiet-visibility',title:'Use a quieter path to visibility',body:'Before one meeting, send a concise written proposal or question. During the meeting, make one prepared contribution. Afterward, share the decision or useful evidence. You do not need to imitate an extrovert to make your work legible.',measure:'Compare clarity, energy, and whether the right people had the information they needed.'},
 {id:'shared-airtime',title:'Turn expression into shared understanding',body:'If speaking is comfortable, use that access deliberately: state your point briefly, invite an unheard perspective, and send a written follow-up that credits others. Ease of speaking is an opportunity to improve the conversation, not proof of greater merit.',measure:'Notice whether the discussion became clearer and whether other contributions were preserved.'},
 {id:'values-tradeoff',title:'Name one real trade-off',body:'Choose two priorities that matter in a current decision. Write what gaining one could cost the other, and which cost you can accept now. Revisit the choice after two weeks. A value score is a prompt for this conversation, not an instruction to choose a particular career.',measure:'Check whether the decision still fits your circumstances and what you learned.'},
];

export function domainInterpretation(id,mean) {
 const c=DOMAIN_CONTENT[id]; if(!c)throw new Error('Unknown personality domain');
 const result={definition:c.definition,context:c.context,experiment:c.experiment};
 result.summary=mean===null?'This domain is incomplete. Complete its remaining items to see a score; the available facets below can still be useful.':c[mean<2.5?'lower':mean>3.5?'upper':'middle'];
 return result;
}
export const BLOCK_IDS = EXPERIMENTS.map(block=>block.id).sort();
