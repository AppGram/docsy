# Security policy

Please do not report security vulnerabilities in a public issue.

Use GitHub's private vulnerability reporting for this repository. Include reproduction steps, affected configurations, and the impact you observed.

## Lock-mode deployment boundary

The trusted-header provider assumes Docsy runs behind an authentication proxy that removes client-supplied identity headers before adding verified values. The Docsy origin must not be reachable around that proxy.

Keep protected OpenAPI and SDK source files outside `public/`. Files under `public/` are served directly and are not protected by middleware.
