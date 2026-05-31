# Security Specification (Zero-Trust ABAC)

## 1. Data Invariants
- A `User` profile can only be read, created, or updated by the authenticated user whose `uid` matches the document ID (`request.auth.uid == userId`).
- A `ChatSession` can only be queried, updated, deleted, or written to by the authenticated user whose `uid` owns the parent path segment (`users/{userId}/sessions/{sessionId}`).
- No anonymous or public profile/session exposure exists, securing complete privacy boundaries.

## 2. Invariant Violation Actions ("The Dirty Dozen" Payloads)
The following malicious payload vectors are prohibited and rejected by `firestore.rules`:
1. **Malicious UID spoofing:** Attempting to write a user profile with `request.auth.uid = "attacker"` into `users/victim`.
2. **Path ID Poisoning:** Attempting to create a chat session with an injected 1MB long junk ID to exhaust resources.
3. **Foreign read queries:** Querying `users/victim/sessions` as user `attacker`.
4. **Foreign deletions:** Sending `DELETE` requests to `users/victim/sessions/some-session` as `attacker`.
5. **Session Hijacking:** Rewriting the session `id` parameter on update to mismatched values.
6. **Bypassing Catch-all:** Attempting writes to unregistered root collections e.g. `/configs/secret`.

## 3. Rules Structure

The active fortress rule set enforces these constraints and has been successfully compiled and deployed to Firebase Firestore.
