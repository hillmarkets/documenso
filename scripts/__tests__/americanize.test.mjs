import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

// Exercise the script end to end against a scratch catalog: copy the real one,
// point the script at it via cwd-relative resolution, and assert on the result.
const root = path.resolve(import.meta.dirname, '../..');

test('rewrites prose but not placeholders, tag contents or msgids', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'americanize-'));
  const scriptsDir = path.join(tmp, 'scripts');
  const catalogDir = path.join(tmp, 'packages/lib/translations/en');
  fs.mkdirSync(scriptsDir, { recursive: true });
  fs.mkdirSync(catalogDir, { recursive: true });
  fs.copyFileSync(
    path.join(root, 'scripts/americanize-en-catalog.mjs'),
    path.join(scriptsDir, 'americanize-en-catalog.mjs'),
  );

  const po = [
    'msgid ""',
    'msgstr ""',
    '"Language: en\\n"',
    '',
    'msgid "Your organisation {organisation.name} was cancelled"',
    'msgstr "Your organisation {organisation.name} was cancelled"',
    '',
    'msgid "Send <0>x-organisation-id</0> to the organisation-wide endpoint"',
    'msgstr ""',
    '',
    'msgid "ORGANISATION SETTINGS"',
    'msgstr "ORGANISATION SETTINGS"',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(catalogDir, 'web.po'), po);

  execFileSync('node', [path.join(scriptsDir, 'americanize-en-catalog.mjs')]);

  const result = fs.readFileSync(path.join(catalogDir, 'web.po'), 'utf8');

  assert.match(result, /^msgid "Your organisation \{organisation\.name\} was cancelled"$/m, 'msgid untouched');
  assert.match(
    result,
    /^msgstr "Your organization \{organisation\.name\} was canceled"$/m,
    'prose rewritten, placeholder kept',
  );
  assert.match(
    result,
    /^msgstr "Send <0>x-organisation-id<\/0> to the organization-wide endpoint"$/m,
    'tag contents kept, empty msgstr filled from msgid',
  );
  assert.match(result, /^msgstr "ORGANIZATION SETTINGS"$/m, 'case preserved');
});
