# Security policy

## Supported versions

Security fixes are considered for the latest preview version and the current `main` branch. Older versions do not receive a separate maintenance branch. This is an early-stage project; there is no guaranteed response or fix timeline.

## Report a vulnerability privately

Use [GitHub private vulnerability reporting](https://github.com/cixiangtao/codex-project-chats/security/advisories/new). Do not open a public issue containing exploit details, private paths, conversation IDs, transcripts, logs, or credentials.

Describe the affected version, attack requirements, impact, and a minimal reproduction using synthetic data. Do not send real Codex databases or authentication material.

The extension reads local conversation metadata through the official app-server and forwards navigation to the official extension. A malicious executable configured through `codexProjectChats.cliPath`, an untrusted official extension, and vulnerabilities in upstream software need separate assessment. Report upstream-only problems through the upstream project's security process.
