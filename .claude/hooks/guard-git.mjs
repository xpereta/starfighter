#!/usr/bin/env node
// PreToolUse hook for Bash: blocks pushes to main, --no-verify and force pushes.
// Exit code 2 blocks the tool call and shows stderr to the agent.
import { execSync } from 'node:child_process';

let raw = '';
for await (const chunk of process.stdin) raw += chunk;

let command = '';
try {
  command = JSON.parse(raw).tool_input?.command ?? '';
} catch {
  process.exit(0);
}

function currentBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function violation(segment) {
  const tokens = segment.trim().split(/\s+/);
  const gi = tokens.indexOf('git');
  if (gi === -1) return null;
  const args = tokens.slice(gi + 1);
  const sub = args.find((a) => !a.startsWith('-'));
  if (sub !== 'push' && sub !== 'commit') {
    // --no-verify can also appear on merge/rebase/cherry-pick/am.
    if (args.includes('--no-verify')) return 'git --no-verify is not allowed.';
    return null;
  }
  if (args.includes('--no-verify')) return '--no-verify is not allowed.';
  if (sub === 'commit' && args.some((a) => /^-[a-zA-Z]*n[a-zA-Z]*$/.test(a))) {
    return 'git commit -n (--no-verify) is not allowed.';
  }
  if (sub === 'commit') return null;

  const flags = args.filter((a) => a.startsWith('-'));
  const positional = args.slice(args.indexOf('push') + 1).filter((a) => !a.startsWith('-'));
  if (
    flags.some(
      (f) => f === '--force' || f.startsWith('--force-with-lease') || f === '--force-if-includes',
    ) ||
    flags.some((f) => /^-[a-zA-Z]*f[a-zA-Z]*$/.test(f)) ||
    positional.some((p) => p.startsWith('+'))
  ) {
    return 'Force pushes are not allowed.';
  }
  if (flags.includes('--mirror') || flags.includes('--all')) {
    return 'git push --mirror/--all is not allowed (could update main).';
  }
  const refspecs = positional.slice(1); // first positional is the remote
  const targetsMain = refspecs.some((r) => {
    const dst = r.includes(':') ? r.split(':').pop() : r;
    return /^(refs\/heads\/)?main$/.test(dst) || /^HEAD:(refs\/heads\/)?main$/.test(r);
  });
  if (targetsMain) return 'Pushing to main is not allowed. Use a branch and a PR.';
  if (refspecs.length === 0 && currentBranch() === 'main') {
    return 'You are on main: pushing it is not allowed. Use a branch and a PR.';
  }
  return null;
}

for (const segment of command.split(/&&|\|\||;|\||\n/)) {
  const reason = violation(segment);
  if (reason) {
    console.error(`Blocked by .claude/hooks/guard-git.mjs: ${reason} See AGENTS.md > Git rules.`);
    process.exit(2);
  }
}
process.exit(0);
