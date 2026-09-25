import {PORTRAIT_SOURCES} from './portrait-sources.mjs';

// These are narrative analogies to public work, not typings of private people.
const parallels = {
  ISTJ:'Her meticulous hospital records offer a story about making dependable systems visible.',
  ISFJ:'Her sustained nursing work offers a story about practical care and follow-through.',
  INFJ:'His writing across poetry, music, and education offers a story about connecting ideals with expression.',
  INTJ:'Her notes on the Analytical Engine offer a story about seeing possibilities in a technical system.',
  ISTP:'Her aviation work offers a story about learning through instruments, conditions, and action.',
  ISFP:'His paintings offer a story about expressing a personal visual perspective through craft.',
  INFP:'Her fiction offers a story about inner life, imagination, and carefully chosen language.',
  INTP:'His theoretical physics offers a story about revisiting assumptions to build a clearer model.',
  ESTP:'His escape performances offer a story about preparation meeting fast action in public.',
  ESFP:'Her stage career offers a story about connecting with an audience through performance.',
  ENFP:'Her acting career offers a story about finding expressive range across different roles.',
  ENTP:'His satire offers a story about testing familiar assumptions through a new angle.',
  ESTJ:'His industrial and philanthropic work offers a story about organizing resources at scale.',
  ESFJ:'Her concert career offers a story about craft, collaboration, and public communication.',
  ENFJ:'His ensemble music offers a story about listening, leading, and making space for other players.',
  ENTJ:'Her scientific collaborations offer a story about persistent direction across ambitious work.',
};

export const FIGURES = Object.freeze(Object.fromEntries(PORTRAIT_SOURCES.map(person => [person.code,
  Object.freeze({...person,parallel:parallels[person.code]})])));
