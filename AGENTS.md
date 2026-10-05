# vempain-auth-frontend — Agent Guide

Preserve interceptor/session semantics and the published API surface. Use the
checked-in Yarn 4 tooling, avoid TypeScript enums, and run focused tests plus
the build after changes.

## Tag ACL rule

Tags are metadata, not ACL-bearing resources. Tag entities have no ACL information, so tag list, search, and mutation endpoints must not perform ACL checks on tags. ACL checks apply only to resources that explicitly carry an ACL.
