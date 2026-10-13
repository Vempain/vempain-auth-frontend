---
name: add-shared-management-screen
description: Change the user, unit and ACL management screens that vempain-auth-frontend provides to both the admin and file SPAs (UserList, UserEditor, UnitList, UnitEditor, AclEditor, nested units). Use for management UI or ACL rule changes.
---

# Shared management screens in vempain-auth-frontend

- `src/management/` holds `UserList`, `UserEditor`, `UnitList`, `UnitEditor`, `AclEditor`, `loadUsersAndUnits`. The SPAs instantiate
  `UserAPI`, `UnitAPI`, `AclAPI` against their own backend (separate user bases, same hosted endpoints
  `/content-management/users|units|acls`) and pass them in; the screens never know a backend. `UserAPI.update`/`UnitAPI.update` send
  `PUT /{id}`.
- Rules that live here, not in the SPAs: either a user or a unit per ACL row, read required, delete requires modify, create implies read,
  the "All" button grants every privilege of its row; `UnitEditor` offers only `selectableMemberUnits()` and rejects cycles with
  `wouldCreateUnitCycle()` (`src/tools/unitTools.ts`; the backend repeats the check with 400).
- Editor contract: `userId`/`unitId` (0 = create), `currentUserId` (a new entity starts with an ACL row granting that user everything),
  `onSaved`, optional `onCancel`, `renderMetadata` (the admin SPA plugs its `MetadataForm` in); `AclEditor` works on the host form's
  `acls` Form.List with `users`/`units` passed in.
- Models: `UnitVO.unit_ids`/`user_ids` (direct members), `UserVO.unit_ids`; a null list in a request leaves that membership untouched.
- Tests: `management.AclEditor.test.tsx`, `management.UnitEditor.test.tsx`, `tools-unitTools.test.ts`, `services-management.test.ts`;
  extend them for every rule change, then bump `VERSION` and update the SPAs (`change-public-api`).
