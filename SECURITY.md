# Security Policy

## Reporting a Vulnerability

Please do not report security vulnerabilities through public GitHub issues.

If GitHub Private Vulnerability Reporting is enabled for this repository, use the repository's **Security → Advisories → Report a vulnerability** feature.

If private vulnerability reporting is unavailable, contact the repository owner privately through GitHub.

When reporting a vulnerability, include:

- A clear description of the vulnerability.
- The affected version or commit.
- Steps to reproduce the issue.
- The potential security impact.
- Any proof-of-concept or relevant logs, if available.

Please do not include passwords, API tokens, authentication cookies, personal information, or other secrets in a report.

## Disclosure

Please allow reasonable time for the vulnerability to be investigated and fixed before publicly disclosing it.

Once a fix is available, the vulnerability may be documented in a GitHub security advisory or release notes where appropriate.

## Scope

Security reports are primarily concerned with vulnerabilities in My Notes, including:

- Authentication and authorization.
- Unauthorized access to notes or other stored data.
- API security.
- Stored or reflected cross-site scripting (XSS).
- Cross-site request forgery (CSRF).
- Improper handling of secrets or credentials.
- GitHub Actions or deployment configuration that could allow unauthorized access or code execution.

Issues that require an attacker to already have legitimate administrative access, or purely theoretical issues without a practical security impact, may not qualify as security vulnerabilities.
