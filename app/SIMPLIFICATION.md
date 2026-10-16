# MUSE simplified experience

The existing Python/SQLite app, sessions, account recovery, upload validation, offer consent, chat restrictions, and deal transition rules are retained.

- Public About MUSE, How It Works, and Discover; five signed-in navigation items.
- Talent/Brand signup; short profile editor; four discovery filters.
- Offers with New/Accepted/Declined views, simple send form, consent before acceptance, and Message Brand.
- Upcoming/In Progress/Completed deal presentation over the original status model; checklist, work delivery, approval and completion. Detailed payment records, revisions and support remain under Deal details.
- Private calendar entries and workspace reminders, including externally sourced collaborations; saved public rates; printable/shareable media kit; quick replies that populate the composer without sending.
- Black/white/gray interface. Legacy advanced features are hidden from navigation and primary routes, with their implementations retained.
- Existing private profiles stay private. New onboarding explicitly explains publication. Existing private owners can explicitly publish through Edit profile.

## Run and validate

From this `app/` directory:

```
python3 server.py
python3 -m unittest discover -s tests -v
node tests/test_ui.cjs
```

Integration tests run against a temporary database and check offer → chat → deal → delivery → approval → completion, cross-account access, checklist validation, private event storage and repeatable migration. Node tests execute all frontend scripts and smoke-test page renders with a minimal DOM stub; they do **not** verify visual layout or real browser interaction.

## Deployment and rollback

`MUSE-public-ready.zip` keeps the repository's existing archive layout (server.py and static/ at its root). `app/` is the same unpacked, reviewable source. Deploy using the existing service's archive extraction/start procedure. Keep its persistent database/upload environment settings. No new dependency or payment integration is required. New SQLite tables are created automatically by `init_db()`; existing records are not rewritten.

This branch has not been deployed. Real desktop/mobile browser QA is still required before merging/releasing. Reminders are in-app only, not email or push notifications. No background scheduler is added. Calendar event titles and dates are private; rate cards are intentionally public profile data.

Rollback can restore the prior archive; the two additive tables may remain harmlessly in the database. The backend continues enforcing legacy deal status and consent rules.
