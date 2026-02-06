# Security Policy

## Supported Versions

We actively support the latest release of Mojo Voice. Security updates are provided for:

| Version | Supported          |
| ------- | ------------------ |
| 0.5.x   | :white_check_mark: |
| < 0.5   | :x:                |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability in Mojo Voice, please report it responsibly:

### How to Report

**Email:** security@devcoffee.io

**Please include:**
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### What to Expect

- **Acknowledgment:** Within 24-48 hours
- **Initial Assessment:** Within 1 week
- **Fix Timeline:** Depends on severity (critical issues prioritized)
- **Public Disclosure:** After patch is released and users have time to update

### Security Considerations

Mojo Voice is designed with privacy and security in mind:

- **100% Local Processing:** No data leaves your machine
- **No Telemetry:** Zero tracking, analytics, or cloud connections
- **Open Source:** MIT licensed, audit the code yourself
- **GPU Isolation:** Audio processing happens in isolated GPU memory
- **No Network Access:** Works completely offline

### Out of Scope

The following are not considered security vulnerabilities:
- Issues requiring physical access to the user's machine
- Social engineering attacks
- Denial of service via resource exhaustion (user controls model selection)

## Security Updates

Security updates are announced via:
- GitHub Security Advisories
- Release notes
- Project website (https://mojovoice.ai)

Thank you for helping keep Mojo Voice secure! 🔒
