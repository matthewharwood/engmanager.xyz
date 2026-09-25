import {element, formatScore, signed, renderCharts} from '../v1/charts.mjs';
import {renderEnhancement} from '../v1/report.mjs';
import {renderAtlas} from './atlas-report.mjs';

// The presentation changes; the published scoring and canonical report do not.
export {createReport, renderEnhancement} from '../v1/report.mjs';

const paragraph = (text, className = '') => element('p', {text, className});
function labelled(label, text, className = '') {
  const node = paragraph(text, className);
  node.prepend(element('strong', {text: `${label} `}));
  return node;
}
function disclosure(title, className, id) {
  const node = element('details', {className: `report-disclosure ${className}`, ...(id ? {id} : {})});
  node.append(element('summary', {text: title}));
  return node;
}
function scoreText(scale) {
  return scale.complete ? `${formatScore(scale.mean)} / 5` : `${scale.answered}/${scale.required} answered`;
}
function numericTable(caption, headings, rows, className) {
  const table = element('table', {className: `report-profile-table ${className}`});
  table.append(element('caption', {text: caption}));
  const head = element('thead'), header = element('tr');
  headings.forEach(text => header.append(element('th', {scope: 'col', text})));
  head.append(header);
  const body = element('tbody');
  for (const [name, ...values] of rows) {
    const row = element('tr');
    row.append(element('th', {scope: 'row', text: name}));
    values.forEach(text => row.append(element('td', {text})));
    body.append(row);
  }
  table.append(head, body);
  return table;
}

function renderOverview(article, model) {
  const section = element('section', {id: 'your-scores', className: 'report-score-overview', 'aria-labelledby': 'your-scores-title'});
  section.append(paragraph(`Your answers / ${model.date ?? 'Undated assessment'}`, 'report-kicker'),
    element('h2', {id: 'your-scores-title', text: 'Your scores, in context.'}),
    paragraph(`${model.completion.answered} of ${model.completion.total} selected items answered${model.completion.skipped ? ` · ${model.completion.skipped} skipped` : ''}. You can return to unfinished items at any time.`, 'report-coverage'),
    paragraph('The Big Five scores are means of your keyed answers on a 1–5 response scale. They are not population percentiles, ability scores, or a ranking of your worth.', 'report-score-intro'));
  const list = element('dl', {className: 'report-score-list', 'aria-label': 'Your five personality scores'});
  for (const domain of model.domains) {
    const row = element('div', {className: 'report-score-row', 'data-domain': domain.id});
    const label = element('dt', {text: domain.name});
    const value = element('dd');
    value.append(element('strong', {className: 'report-score-value', text: domain.complete ? formatScore(domain.mean) : 'Not scored'}));
    value.append(element('span', {className: 'report-score-unit', text: domain.complete ? '/ 5' : `${domain.answered}/${domain.required} answered`}));
    row.append(label, value); list.append(row);
  }
  section.append(list, paragraph('There is no ideal profile. Read a score alongside your actual experiences, including situations where the description does not fit.', 'report-context-note'));
  article.append(section);
}

function renderProfiles(article, model) {
  if (model.interests.selected) {
    const section = element('section', {className: 'report-profile report-interest-profile', 'aria-labelledby': 'interest-scores-title'});
    section.append(paragraph('Work interests', 'report-kicker'), element('h3', {id: 'interest-scores-title', text: 'Activities that appeal to you.'}),
      paragraph('These six scores describe interest in activities, not skill or a recommended occupation. Each sum runs from 0 to 20.'));
    if (model.interests.complete) {
      section.append(numericTable('O*NET Mini Interest Profiler scores', ['Interest', 'Score / 20'],
        model.interests.scores.map(scale => [scale.name, String(scale.sum)]), 'report-interest-table'));
    } else {
      section.append(paragraph(`${model.interests.answered}/30 activities answered. Complete all 30 to see this profile; missing answers are not filled in.`, 'report-incomplete'));
    }
    const detail = disclosure('What these interests describe', 'report-profile-notes');
    for (const scale of model.interests.scores) {
      detail.append(element('h4', {text: scale.name}), paragraph(scale.definition), labelled('An activity to try.', scale.experiment, 'report-prompt'));
    }
    detail.append(element('a', {href: 'https://onetinterestprofiler.org/p/enter_scores', text: 'Explore further with the O*NET Interest Profiler', target: '_blank', rel: 'noopener noreferrer'}),
      paragraph('This opens an external site. No results are automatically sent; you choose whether to enter them there. The activity prompts here are editorial suggestions outside the instrument.', 'report-small'));
    section.append(detail); article.append(section);
  }
  if (model.values.selected) {
    const section = element('section', {className: 'report-profile report-values-profile', 'aria-labelledby': 'value-scores-title'});
    section.append(paragraph('Personal values', 'report-kicker'), element('h3', {id: 'value-scores-title', text: 'What matters when you choose.'}),
      paragraph('The portrait mean uses the original 1–6 response scale. Relative priority subtracts your average across all 20 portraits. Positive and negative values describe priorities within your own profile, not a comparison with other people or a moral grade.'));
    if (model.values.complete) {
      section.append(paragraph(`Your average across all 20 portraits: ${formatScore(model.values.grandMean)} / 6.`, 'report-values-baseline'),
        numericTable('TwIVI personal values: raw means and centered priorities', ['Value', 'Portrait mean / 6', 'Relative priority'],
          model.values.scores.map(scale => [scale.name, formatScore(scale.raw), signed(scale.centered)]), 'report-values-table'));
    } else {
      section.append(paragraph(`${model.values.answered}/20 portraits answered. Complete all 20 to see both the raw means and centered priorities.`, 'report-incomplete'));
    }
    section.append(paragraph('Each value is represented by two portraits. Treat small differences as a prompt for reflection, not a firm classification.', 'report-small'));
    const detail = disclosure('What these values describe', 'report-profile-notes');
    for (const scale of model.values.scores) {
      detail.append(element('h4', {text: scale.name}), paragraph(scale.definition), labelled('A question to explore.', scale.experiment, 'report-prompt'));
    }
    section.append(detail); article.append(section);
  }
}

function renderDetails(article, model) {
  const chapters = element('section', {className: 'report-chapters', id: 'score-details', 'aria-labelledby': 'score-details-title'});
  chapters.append(paragraph('Look a little closer', 'report-kicker'), element('h2', {id: 'score-details-title', text: 'The detail behind each score.'}),
    paragraph('Each personality domain contains six narrower facets. Open a domain to read its definition, see the facet means, and consider an example from your own life.'));
  for (const domain of model.domains) {
    const detail = element('details', {className: 'report-domain', id: `domain-${domain.id}`});
    const summary = element('summary');
    summary.append(element('span', {text: domain.name}), element('span', {className: 'report-number', text: scoreText(domain)}));
    detail.append(summary);
    const body = element('div', {className: 'report-domain-body'});
    body.append(paragraph(domain.interpretation.definition), paragraph(domain.interpretation.summary),
      labelled('Consider context.', domain.interpretation.context, 'report-context-note'),
      labelled('An experiment to try.', domain.interpretation.experiment, 'report-prompt'));
    const facets = element('div', {className: 'report-facet-list'});
    for (const facet of domain.facets) {
      const card = element('section', {className: 'report-facet'}), heading = element('div', {className: 'report-facet-heading'});
      heading.append(element('h4', {text: facet.name}), paragraph(scoreText(facet), 'report-number'));
      card.append(heading, paragraph(facet.definition), labelled('Reflect on this.', facet.experiment, 'report-prompt'));
      facets.append(card);
    }
    body.append(facets); detail.append(body); chapters.append(detail);
  }
  article.append(chapters);
}

function renderMethods(article, model) {
  const methods = disclosure('How this report was made · methods and sources', 'report-methods');
  methods.append(paragraph(`Canonical report ${model.templateVersion}; scoring ${model.scoringVersion}. The reading layout changes how this report is presented, not how it is scored.`),
    paragraph('Scores are computed locally from selected answers. A personality score requires every item in that scale. Interests require 30/30 answers; personal values require 20/20. No missing answer is replaced with a midpoint.'),
    paragraph('Personality scores are equal-weighted keyed means. Interest scores sum five ratings recoded from 1–5 to 0–4. TwIVI pairs use raw 1–6 means, then subtract the overall mean of all 20 portraits. The ten centered values sum to zero.'),
    paragraph('The five personality traits, work interests, and personal values describe different constructs with different scales. They are not seven independent factors and cannot be combined into a total personality score.'));
  for (const text of model.readingGuide) methods.append(paragraph(text));
  methods.append(paragraph('Editorial descriptions use keyed means below 2.5, from 2.5 to 3.5, and above 3.5 to describe response-scale direction. These writing rules are not validated psychological cutoffs. Experiments and reflection prompts do not predict career success.', 'report-small'),
    paragraph('Source IPIP item 58 retains the official-key “right and wrong” wording; the published paper uses “right or wrong.”', 'report-small'));
  for (const instrument of model.instruments) methods.append(paragraph(`${instrument.name} · ${instrument.version}. ${instrument.attribution}`, 'report-small'));
  const sources = element('ol');
  for (const source of model.sources) {
    const item = element('li');
    item.append(element('a', {href: source.url, text: source.label, target: '_blank', rel: 'noopener noreferrer'}), paragraph(source.note, 'report-small'));
    sources.append(item);
  }
  methods.append(sources); article.append(methods);
}

export function renderReport(root, model, story = null) {
  const article = element('article', {className: 'personality-report personality-report-v2 personality-atlas', 'data-report-layout': 'atlas-v5'});
  const nav = element('nav', {className: 'report-workflow-nav', 'aria-label': 'Report sections'});
  for (const [href, text] of [['#atlas-overview', 'Overview'], ['#your-scores', 'Scores'], ['#color-story', 'Colors'], ['#type-story', 'Type'], ['#story-symbols', 'Symbols'], ['#score-details', 'Details'], ['#story-studio', 'Add context'], ['#report-kit', 'Report kit']]) nav.append(element('a', {href, text, 'data-report-anchor': ''}));
  article.append(nav);
  const atlas = renderAtlas(model, story);
  article.append(atlas.overview);
  renderOverview(article, model);
  if (model.enhancement) renderEnhancement(article, model.enhancement);
  renderProfiles(article, model);
  article.append(atlas.color, atlas.type, atlas.symbols);
  const charts = disclosure('Explore charts and keyed answer patterns', 'report-chart-disclosure', 'score-charts');
  charts.append(paragraph('Inspect the underlying response patterns or use each chart’s “View the numbers” table. The charts show your responses, not a reference population.', 'report-small'));
  const chartRoot = element('div', {className: 'report-charts'}); renderCharts(chartRoot, model); charts.append(chartRoot); article.append(charts);
  renderDetails(article, model);
  const experiments = disclosure('Optional experiments for your next two weeks', 'report-experiments');
  experiments.append(paragraph('Merit and visibility are not the same thing. Recognition also depends on opportunity, relationships, incentives, and bias. These editorial exercises are possibilities to try, not performance targets.'));
  for (const block of model.experiments) {
    const card = element('section', {className: 'report-experiment'});
    card.append(element('h3', {text: block.title + (block.selected ? ' · selected' : '')}), paragraph(block.body), labelled('Notice.', block.measure));
    experiments.append(card);
  }
  article.append(experiments);
  renderMethods(article, model);
  const dock = element('nav', {className:'atlas-dock', 'aria-label':'Quick report navigation'});
  for(const [href,label] of [['#atlas-overview','Overview'],['#your-scores','Scores'],['#color-story','Colors'],['#type-story','Type'],['#story-symbols','Story'],['#report-kit','Kit']]) dock.append(element('a',{href,text:label}));
  const print = element('button',{type:'button',text:'Print'});
  print.addEventListener('click',()=>window.print());dock.append(print);article.append(dock);
  root.replaceChildren(article);
  return article;
}

let openedForPrint=[];
if(typeof window!=='undefined'){
  window.addEventListener('beforeprint',()=>{
    openedForPrint=[...document.querySelectorAll('.personality-atlas .report-domain:not([open]), .personality-atlas .report-methods:not([open])')];
    openedForPrint.forEach(node=>{node.open=true;});
  });
  window.addEventListener('afterprint',()=>{openedForPrint.forEach(node=>{node.open=false;});openedForPrint=[];});
}
