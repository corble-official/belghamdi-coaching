# Contributing

> [!WARNING]
> **Fresh clone required after rewritten history.** All pre-migration clones must be discarded because this repository's history was rewritten during migration. Make a fresh clone before contributing; do not fetch, pull, or push from an old clone.

## Pull request workflow

- Never push directly to `main`. Create a branch and open a pull request.
- Use `feat/<topic>` for features, `fix/<topic>` for fixes, and `data/<topic>` for data changes.
- Repository owner `@Zeus0x01` reviews and merges pull requests. Do not self-approve or self-merge.
- On GitHub Free, these requirements are a team convention rather than an enforced private-repository review rule.

## Secrets

Never commit real secrets, including `.env`, `.env.local`, keys, tokens, credentials, or service-role keys. A secretless `.env.example` containing placeholder names is allowed.

## Publishing and external accounts

Owner approval of a pull request does not authorize publishing, scheduling, uploading, or connecting any social account. Those actions require separate explicit authorization.
