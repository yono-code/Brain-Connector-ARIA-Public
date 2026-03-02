# Contributing to Brain Connector ARIA

Thanks for your interest in contributing.
This project currently prioritizes a local-only release scope and strict review controls.

## Scope

- Local-first behavior is the default and required baseline.
- Do not add or enable external sync/network transport features in this release line.
- Keep changes minimal, testable, and easy to review.

## Before You Start

1. Search existing issues and pull requests to avoid duplicate work.
2. Open an issue first for large or design-changing proposals.
3. For security-sensitive findings, do not open a public issue. Use a private channel instead.

## Development Setup

1. Fork and clone the repository.
2. Install dependencies:
   ```bash
   npm ci
   npm --prefix webview ci
   ```
3. Build:
   ```bash
   npm run build:all
   ```
4. Test:
   ```bash
   npm run test
   ```

## Pull Request Requirements

All changes must be submitted by pull request.

- Target branch: `main`
- Keep PRs small and focused
- Include clear summary and verification steps
- Pass required checks (including `dependency-gate`)
- Ensure no-network guard passes:
  ```bash
  npm run no-network:guard
  ```

Please use the PR template checklist and complete all applicable items.

## Commit Requirements (DCO)

By contributing, you certify you have the right to submit the work under the project license.
Please sign off each commit with:

```text
Signed-off-by: Your Name <your-email@example.com>
```

Git shortcut:

```bash
git commit -s -m "your message"
```

## Coding and Review Guidelines

- Follow existing architecture and naming conventions.
- Do not include secrets, keys, tokens, personal data, or machine-specific absolute paths.
- Update docs when behavior or public usage changes.
- If tests are skipped, state why in the PR.

## License

By submitting a contribution, you agree that your contribution is licensed under the
[Apache License 2.0](LICENSE).

## Reporting Security Issues

For private/security reports, use the project private channel listed in the README.
Do not disclose exploit details in public issues before maintainers respond.
