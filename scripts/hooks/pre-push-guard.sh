#!/bin/sh
# Rejects any push that updates refs/heads/main on the remote.
# Git feeds "<local ref> <local sha> <remote ref> <remote sha>" lines on stdin;
# lefthook forwards stdin to commands, so we read it directly.
while read -r _local_ref _local_sha remote_ref _remote_sha; do
  if [ "$remote_ref" = "refs/heads/main" ]; then
    echo "✖ Pushing to main is not allowed. Create a branch and open a PR (see AGENTS.md)." >&2
    exit 1
  fi
done
exit 0
