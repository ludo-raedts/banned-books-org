-- Tighten bans.action_type vocabulary.
--
-- After the data cleanup (scripts/cleanup-bans-action-type.ts: removed→restricted,
-- blocked→banned/restricted per scope), the non-canonical values 'removed' and
-- 'blocked' no longer occur in any row. Tighten the CHECK constraint so future
-- imports cannot reintroduce them — the canonical action_type vocabulary is now
-- exactly: banned | restricted | challenged.
--
-- ORDER MATTERS: this migration MUST run AFTER the data cleanup. If any 'removed'
-- or 'blocked' row still existed, ADD CONSTRAINT would fail validation.
--
-- Scope: ONLY bans.action_type. The bans.status CHECK is intentionally left
-- untouched — 'unclear' remains a valid status in the live catalogue (those rows
-- are withheld from the open Zenodo export, not deleted from the DB).

ALTER TABLE "public"."bans" DROP CONSTRAINT IF EXISTS "bans_action_type_check";

ALTER TABLE "public"."bans" ADD CONSTRAINT "bans_action_type_check"
  CHECK (("action_type" = ANY (ARRAY['banned'::"text", 'restricted'::"text", 'challenged'::"text"])));
