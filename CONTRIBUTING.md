# Contributing

This is Hill's fork of [Documenso](https://github.com/documenso/documenso).
It exists to add an instance-wide API and to keep an AGPL-only tree; it is not
a general-purpose place to develop Documenso.

- **Bugs or features in Documenso itself** — please take them to
  [upstream](https://github.com/documenso/documenso/issues). Fixes that land
  there reach this fork on the next merge, which is the path of least conflict.
- **Bugs in this fork's additions** (scoped API tokens and webhooks, the
  enterprise-package removal, the CI setup) — open an issue here.

Pull requests are welcome for the second category. Keep them small and follow
the existing patterns; see [CODE_STYLE.md](CODE_STYLE.md) and
[ARCHITECTURE.md](ARCHITECTURE.md). Commit messages follow
[Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`,
`chore:` …) and are checked by commitlint.

Design decisions for the fork's changes are recorded in
`docs/superpowers/specs/`.

## Development

See the [README](README.md#local-development).
