# Security policy

## Reporting a vulnerability in KagiCyber

Please report vulnerabilities privately, through GitHub's [private vulnerability reporting](https://github.com/kvdzidev/kagicyber/security/advisories/new) or by e-mail to **security@kagicyber.com**. Do not open a public issue. We aim to reply within 3 working days and to agree on a disclosure date with you.

Useful details: the KagiCyber version (`kagicyber --version`), the command you ran, and a minimal page, repository or file that reproduces the problem.

In scope: the CLI, the library, `kagicyber serve`, the GitHub Action and the Claude skill in this repository. Examples: a page or repository that makes KagiCyber run code, read files outside the scanned folder, reach internal networks through `kagicyber serve`, print a secret unmasked, or inject markup or instructions into a report or fix prompt.

## Supported versions

Security fixes go into the latest release.

## Findings about other sites

If KagiCyber reported a secret or exposure on a site you do not own, notify the site owner privately (see their `/.well-known/security.txt`) and do not use the credential.
