#!/usr/bin/env node
// Keeps the GitHub Project board (https://github.com/users/xpereta/projects/1) in step with the repo.
// Safe to re-run any time (needs `gh` logged in with the `project` scope):
//   - adds every issue and pull request that is not on the board yet;
//   - closed issues and merged PRs go to Done; open PRs go to Review;
//   - open issues keep the column they are in (new ones start in Backlog), so cards moved by hand stay.
import { execFileSync } from 'node:child_process';

const OWNER = 'xpereta';
const REPO = 'xpereta/starfighter';
const NUMBER = '1';

const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const json = (...args) => JSON.parse(gh(...args));

const project = json('project', 'view', NUMBER, '--owner', OWNER, '--format', 'json');
const status = json(
  'project',
  'field-list',
  NUMBER,
  '--owner',
  OWNER,
  '--format',
  'json',
).fields.find((f) => f.name === 'Status');
const option = (name) => {
  const o = status.options.find((x) => x.name === name);
  if (!o) throw new Error(`The board has no Status column named "${name}"`);
  return o.id;
};

const onBoard = new Map(); // url -> { id, status }
for (const item of json(
  'project',
  'item-list',
  NUMBER,
  '--owner',
  OWNER,
  '--limit',
  '500',
  '--format',
  'json',
).items) {
  if (item.content?.url) onBoard.set(item.content.url, { id: item.id, status: item.status });
}

let added = 0;
let moved = 0;
for (const kind of ['issue', 'pr']) {
  for (const it of json(
    kind,
    'list',
    '--repo',
    REPO,
    '--state',
    'all',
    '--limit',
    '500',
    '--json',
    'number,state,url',
  )) {
    // The column this card must be in, null to leave it where it is, undefined to keep it off the board.
    const wanted =
      kind === 'issue'
        ? it.state === 'CLOSED'
          ? 'Done'
          : null
        : it.state === 'OPEN'
          ? 'Review'
          : it.state === 'MERGED'
            ? 'Done'
            : undefined; // a PR closed without merging
    if (wanted === undefined) continue;

    let card = onBoard.get(it.url);
    let isNew = false;
    if (!card) {
      const created = json(
        'project',
        'item-add',
        NUMBER,
        '--owner',
        OWNER,
        '--url',
        it.url,
        '--format',
        'json',
      );
      card = { id: created.id, status: undefined };
      isNew = true;
      added++;
    }
    const target = wanted ?? (isNew ? 'Backlog' : null); // a new open issue starts in Backlog
    if (target && card.status !== target) {
      gh(
        'project',
        'item-edit',
        '--id',
        card.id,
        '--project-id',
        project.id,
        '--field-id',
        status.id,
        '--single-select-option-id',
        option(target),
      );
      moved++;
    }
  }
}
console.log(`Board in sync: ${added} card(s) added, ${moved} moved.`);
