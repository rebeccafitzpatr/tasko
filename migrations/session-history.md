# Session history rules

## Period selection and prior comparison

Analytics offers All dates, Today, Last 7/30 days, This week/month/year to date,
and Custom range. Presets use the current **UTC** day; weeks start Sunday.
The visible applied boundaries control session totals, skill summaries, history,
and the period figures inside each skill card. Editing dates is a draft until
Apply dates; changing a preset applies immediately and resets history to page 1.

Optional comparison uses the immediately preceding, non-overlapping interval
with the **same inclusive number of UTC calendar days**, not the previous
calendar month/year. For January 8-14, it compares January 1-7. All-time and
open-ended ranges require both boundaries before comparison. Prior reports
query all matching logs, independently of history pages. Missing skill rows
mean no activity for that skill; a zero baseline has no percentage change,
and empty periods are explicitly identified. Comparison failures have their
own retry and do not replace current totals or history.

## Date-range analytics contract

`GET /api/analytics/summary?start=2026-01-01&end=2026-01-31` returns
`totalMinutes` (duration), `totalPomodoros` (session count, timer and manual),
and a skill `breakdown` over **all** matching logs, independently of history
pagination. `range` echoes the inclusive calendar boundaries and `timezone: "UTC"`;
either boundary may be omitted. UTC midnight starts the first day and the
exclusive midnight after the last day ends the range. Legacy timezone-unknown
timestamps are compared as stored, without inventing an offset.

Breakdown rows include current `parentId`, `parentName`, `skillPath`,
`directMinutes` and `directPomodoros` for direct assignments. `minutes` and
`pomodoros` also include historical sub-skill sessions whose saved parent ID
matches the skill. Do not sum overlapping parent and child rollups: overall
totals count every matching session exactly once, including unassigned and
deleted-skill history. Empty ranges return zero totals and zero-valued rows for
current skills. `totalTasks` always counts current tasks, not date-filtered tasks.
No new migration is required after the existing session-history, timer-completion,
and skill-hierarchy migrations.

## Optional skill hierarchy

Apply `20261106_skill_hierarchy.sql` once after `20261105_session_history.sql` and
`20261106_timer_completion.sql`, before deploying the updated API and client.
Back up the database first: MySQL DDL is not rollback-safe. Fresh databases use
`create_tables.sql` instead of applying these incremental migrations.

`skills.parent_id` is nullable and references another skill with `ON DELETE RESTRICT`.
Existing skills start standalone; IDs, task assignments, counters, and session logs
are not replaced or reassigned. Skill names remain globally unique.

`POST /api/skills` accepts `{ name, parentId }`; omitted or null parents create
standalone/top-level skills. `GET /api/skills` returns `parentId` and `parentName`.
`PUT /api/skills/:id` supports renaming, moving a leaf to another top-level parent,
or promoting it with `parentId: null`; omitted parents keep the existing relationship.
Self-parenting, missing parents, grandchildren, and moving a parent that still has
children are rejected. Mutations lock skills while checking these rules.
`DELETE /api/skills/:id` returns 409 until all sub-skills are moved, promoted, or
deleted. Deleting a leaf still nulls task/session skill foreign keys without
deleting tasks or history.

Skills displays grouped parents and sub-skills with create, rename, move, promote,
and delete controls. Tasks can be assigned to a top-level skill or a sub-skill;
selectors display `Parent / Sub-skill` for clarity.

New timer and manual sessions save `parent_skill_id_snapshot`,
`parent_skill_name_snapshot`, and `skill_path_snapshot` alongside the assigned
skill. Parent snapshots have no foreign keys. Moves, promotions, renames, and
deletions do not rewrite historical paths; duration/date-only corrections and
timer retries preserve them. Reassigning a session captures its new current path.
Existing logs get their available saved/current standalone skill name as their
path; a historical parent cannot be inferred and is not invented.

History displays the saved path even after deletion. Skill summaries include
directly assigned sessions plus those originally recorded beneath that parent.
A moved sub-skill's old sessions stay under the original parent; new sessions
report under the new parent. Parent rollups and sub-skill totals overlap and must
not be added together; overall totals count each session once. Deleted skills
no longer have a current summary card, but their sessions remain in history and
overall totals. Compatibility skill counters continue to count direct assignments
only and are not backfilled for hierarchy; analytics uses session aggregates.

## Canonical session record

`pomodoro_logs` is the source of truth for study history and time-based analytics. Each record requires a positive whole-minute `duration_minutes`, a `type` of `timer` or `manual`, and a `completed_at` timestamp. Timer sessions must reference a task. Manual sessions may reference a task and/or skill, or be unassigned. If a task is supplied, its current skill is authoritative; a conflicting skill ID is rejected.

The API stores new timestamps as UTC in MySQL's timezone-naive `DATETIME` column. Timer completion time is generated by the server. Manual entries must provide an ISO-8601 timestamp with an explicit timezone and cannot be in the future; it is converted to UTC before storage. API responses encode these timestamps as ISO strings ending in `Z`. `completed_at_is_utc` distinguishes these records from migrated timestamps, whose original timezone cannot be recovered reliably; legacy API timestamp formatting is kept unchanged.

## Historical labels and deletion

Each session stores `task_name_snapshot` and `skill_name_snapshot` at creation. Foreign keys continue to use `ON DELETE SET NULL`, while snapshots preserve the labels for display and export after the related task or skill is deleted. Renaming a task or skill does not rewrite existing snapshots. For pre-migration records, snapshots are backfilled from names that still resolve at migration time; those values are current labels, not guaranteed labels at the original session time. Names already lost through earlier deletions cannot be recovered. The UI displays the saved label when present and falls back to the current related record for older data.

## Existing data and counters

The existing `duration_minutes`, `completed_at`, and `type` columns already contain the core session fields. The migration keeps existing timestamps and types, adds label snapshots, backfills names when foreign keys still resolve, removes the implicit `timer` type default, and enforces positive durations. Before applying it, inspect legacy durations with:

```sql
SELECT id, duration_minutes
FROM pomodoro_logs
WHERE duration_minutes < 1;
```

Resolve any invalid rows deliberately before adding the check constraint; do not silently replace durations with invented values. Existing task/skill minute and Pomodoro counters are denormalized compatibility fields. They are not backfilled or used as the source for analytics because there is no reliable way to distinguish stale counters from independently edited values. New reports should aggregate session records.

For a new database, use `create_tables.sql`. For an existing database, inspect invalid durations and apply `20261105_session_history.sql` once. The migration is not intended to be rerun.

## Timer recovery and exactly-once recording

Apply `20261106_timer_completion.sql` once after the session-history migration and before deploying the updated API/client. It adds a nullable UUID completion ID with a unique index and a saved request fingerprint. Existing and manual records keep null completion IDs; do not backfill invented IDs.

The client generates a UUID v4 when a new timer starts and persists its task, duration, deadline, and completion identity in local storage under `tasko-timer-v1`. Pausing saves the remaining seconds; resuming keeps the same UUID and creates a new deadline. Reset cancels the timer and clears that identity without submitting a session. Old cached timers without a deadline cannot be safely resumed and show a recovery warning.

An active timer's countdown is calculated from its deadline, not the number of interval callbacks, so refreshes and background throttling do not extend it. Reloading a still-active timer restores its task and countdown. If its deadline passed while the app was closed, or a completion request previously failed, it is restored as pending: startup itself does not POST a session. The user can save/retry or reset to discard it.

Before POSTing a completion, the client must successfully persist the pending record. The API requires its UUID and atomically inserts the session and updates task/skill compatibility counters. Repeated or concurrent requests with the same UUID return the existing session without another insert or counter increment. Reusing the UUID with a different task or duration returns HTTP 409. A retry still returns the original session after its task has been deleted.

Failures to save locally or on the API are displayed in the timer view. Pending completions retain their UUID across reloads so a lost HTTP response can be retried safely. A reporting refresh failure is shown separately as "Session saved" and does not trigger another completion request. Timer recovery requires browser storage; clearing it removes local progress. This does not implement cross-device recovery.

## Manual entry and session corrections

On Analytics, choose **Add manual session**, or **Edit** beside a recorded session. Enter a positive whole-minute duration and a completion date/time in your local timezone, no later than now. Leave both assignments empty for an unassigned entry, choose a skill alone, or select a task (its skill is used). The form converts the local time to a timezone-qualified ISO timestamp; the server validates and stores UTC.

`POST /api/pomodoros` accepts manual entries with `type: "manual"`, `duration`, `completedAt`, and nullable `taskId`/`skillId`. Manual entries have no timer completion identity. `PUT /api/pomodoros/:id` accepts the same editable fields, but not `type` or `completionId`: editing preserves the original record type and timer retry fingerprint.

Corrections lock the existing session and update it and affected task/skill compatibility counters in a transaction. These affected counters are recalculated from session logs, not incremented again. Unchanged assignments preserve historical labels, including names whose related records have been deleted; changed assignments capture the selected records' current labels. Deleted names cannot be selected as new assignments.

Successful saves refresh history, overall totals, and skill summaries. Errors preserve the form so the user can correct input or retry. Reporting refresh failures are shown separately from save failures, with retry controls; they do not resubmit a saved session. Saving or editing resets history to the first page of the active date range, since changes can move a record outside that range or to another page.

No additional schema migration is needed for manual entry/editing after both earlier session-history and timer-completion migrations have been applied.

## Paginated history and complete reporting

`GET /api/pomodoros` returns `{ items, hasMore, nextCursor, limit }` instead of an array. `limit` defaults to 25 and must be an integer from 1 to 100. To browse older records, pass the returned `nextCursor` as `cursor` with the same date filters. Every page is ordered by `completed_at DESC, id DESC`; timestamp ties are resolved by ID, and newer inserts do not shift an older-record cursor. The cursor contains the last raw database timestamp, ID, and date boundaries. Invalid cursors, repeated query values, invalid dates, reversed ranges, and out-of-bounds limits receive HTTP 400 with an error message.

Optional `start` and `end` are inclusive UTC calendar dates in `YYYY-MM-DD` format (years 1000 to 9998). Either boundary may be omitted. For example, `?start=2026-01-01&end=2026-01-31&limit=25` includes all of January through 23:59:59 on the end date. The server uses an exclusive next-day upper bound. Legacy timestamps remain in their original wall-clock representation because the original timezone is unknown; filters and period calculations compare those values as stored rather than guessing an offset.

Analytics provides Apply dates / All dates and Newer sessions / Older sessions controls, loading indicators, empty results, and explicit history errors with retry. Filters apply to history and time/session totals, not the current task count. Pages are bounded, but the entire matching history can be browsed; reaching the last page is explicit rather than silently dropping older sessions. Concurrent requests cannot replace a newer page/filter response with stale data.

`GET /api/analytics/summary` accepts the same optional `start`/`end` dates. Overall totals, per-skill counts/minutes, and per-skill `todayMinutes`, `weekMinutes`, and `yearMinutes` aggregate every matching log without pagination or a row limit. Periods use UTC, weeks start Sunday, and period figures are intersected with the selected date range. The UI labels this timezone explicitly. Page navigation does not recompute aggregates from the current page. Current skills receive breakdowns; deleted/unassigned skill sessions still contribute to overall session/time totals.

Deploy API and frontend together for the changed history response shape. No additional migration is required; the existing timestamp index supports history queries.
