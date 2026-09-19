#!/usr/bin/env node
/**
 * Bring the `en` catalog fully into American English.
 *
 * Lingui's source locale is `en`, and the message ids in code are written in
 * British English. Upstream's Crowdin project already translates most of the
 * `en` msgstrs to American spellings, but it lags the code by a release or so.
 * This rewrites any msgstr that still carries a British spelling, so the
 * shipped English is consistently American.
 *
 * msgids are never touched: every other locale keys off them and upstream
 * changes would conflict. Placeholders (`{...}`) are left alone.
 *
 * Re-run after pulling upstream: `node scripts/americanize-en-catalog.mjs`.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const catalog = path.join(root, 'packages/lib/translations/en/web.po');

// Lower-case British → American, whole words only, case preserved.
const SPELLINGS = {
  organisation: 'organization',
  organisations: 'organizations',
  organisational: 'organizational',
  organise: 'organize',
  organised: 'organized',
  organising: 'organizing',
  authorise: 'authorize',
  authorised: 'authorized',
  authorising: 'authorizing',
  authorisation: 'authorization',
  reauthorise: 'reauthorize',
  reauthorised: 'reauthorized',
  reauthorisation: 'reauthorization',
  customise: 'customize',
  customised: 'customized',
  customising: 'customizing',
  customisation: 'customization',
  finalise: 'finalize',
  finalised: 'finalized',
  finalising: 'finalizing',
  sanitise: 'sanitize',
  sanitised: 'sanitized',
  sanitisation: 'sanitization',
  recognise: 'recognize',
  recognised: 'recognized',
  personalise: 'personalize',
  personalised: 'personalized',
  initialise: 'initialize',
  initialised: 'initialized',
  optimise: 'optimize',
  optimised: 'optimized',
  minimise: 'minimize',
  maximise: 'maximize',
  cancelled: 'canceled',
  cancelling: 'canceling',
  labelled: 'labeled',
  labelling: 'labeling',
  colour: 'color',
  colours: 'colors',
  coloured: 'colored',
  favourite: 'favorite',
  favourites: 'favorites',
  behaviour: 'behavior',
  behaviours: 'behaviors',
  licence: 'license',
  licences: 'licenses',
  centre: 'center',
  centred: 'centered',
  grey: 'gray',
  analyse: 'analyze',
  analysed: 'analyzed',
  enrol: 'enroll',
  enrolment: 'enrollment',
  fulfil: 'fulfill',
  fulfilment: 'fulfillment',
  catalogue: 'catalog',
  whilst: 'while',
  amongst: 'among',
};

const matchCase = (source, replacement) => {
  if (source === source.toUpperCase()) {
    return replacement.toUpperCase();
  }
  if (source[0] === source[0].toUpperCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
};

// Segments that are code, not prose: ICU placeholders and the contents of
// inline tags such as `<0>x-organisation-id</0>` (header names, paths, flags).
const PROTECTED = /(\{[^}]*\}|<(\d+)>[^<]*<\/\2>)/;

const WORD = /[A-Za-z]+/g;

const americanize = (text) =>
  text
    .split(PROTECTED)
    .map((part, index) =>
      // split() with two capture groups yields [prose, match, group2, prose, ...]
      index % 3 === 0
        ? (part ?? '').replace(WORD, (word) => {
            const replacement = SPELLINGS[word.toLowerCase()];
            return replacement ? matchCase(word, replacement) : word;
          })
        : index % 3 === 1
          ? part
          : '',
    )
    .join('');

const unescapePo = (s) => s.replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
const escapePo = (s) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');

const lines = fs.readFileSync(catalog, 'utf8').split('\n');
let changed = 0;
let pending = null;

const out = lines.map((line) => {
  const idMatch = line.match(/^msgid "(.*)"$/);

  if (idMatch) {
    pending = unescapePo(idMatch[1]);
    return line;
  }

  const strMatch = line.match(/^msgstr "(.*)"$/);

  if (strMatch && pending !== null && pending !== '') {
    // Crowdin may have left the msgstr empty; fall back to the msgid.
    const current = unescapePo(strMatch[1]) || pending;
    const next = americanize(current);
    pending = null;

    if (next !== current) {
      changed += 1;
    }

    return `msgstr "${escapePo(next)}"`;
  }

  return line;
});

fs.writeFileSync(catalog, out.join('\n'));

console.log(`en: ${changed} msgstr(s) rewritten in ${path.relative(root, catalog)}`);
