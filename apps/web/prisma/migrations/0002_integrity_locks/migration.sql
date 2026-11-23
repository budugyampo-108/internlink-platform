-- =====================================================================
-- 0002_integrity_locks
-- Database-level guarantees that do NOT depend on application code being correct.
-- Even a bug (or a compromised student session) in the API cannot rewrite a
-- submitted evaluation, because the database itself rejects the statement.
-- =====================================================================

-- ---------- 1. Evaluation: immutable once SUBMITTED ----------
CREATE OR REPLACE FUNCTION evaluation_lock_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."status" = 'SUBMITTED' THEN
      RAISE EXCEPTION 'EVALUATION_LOCKED: submitted evaluation % cannot be deleted', OLD."id"
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE
  IF OLD."status" = 'SUBMITTED' THEN
    RAISE EXCEPTION 'EVALUATION_LOCKED: submitted evaluation % is immutable', OLD."id"
      USING ERRCODE = 'check_violation';
  END IF;

  -- Identity / provenance columns can never change, even while REQUESTED.
  IF NEW."applicationId" IS DISTINCT FROM OLD."applicationId"
     OR NEW."requestedById" IS DISTINCT FROM OLD."requestedById"
     OR NEW."requestedAt"   IS DISTINCT FROM OLD."requestedAt" THEN
    RAISE EXCEPTION 'EVALUATION_LOCKED: provenance columns are immutable'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Transition to SUBMITTED must carry full submission metadata.
  IF NEW."status" = 'SUBMITTED' THEN
    IF NEW."submittedById" IS NULL OR NEW."submittedAt" IS NULL
       OR NEW."contentHash" IS NULL OR NEW."scores" IS NULL OR NEW."remarks" IS NULL THEN
      RAISE EXCEPTION 'EVALUATION_LOCKED: submission requires scores, remarks, submitter, timestamp and hash'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER evaluation_lock_guard_trg
  BEFORE UPDATE OR DELETE ON "Evaluation"
  FOR EACH ROW EXECUTE FUNCTION evaluation_lock_guard();

-- TRUNCATE bypasses row triggers, so block it explicitly.
CREATE OR REPLACE FUNCTION forbid_truncate() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'TRUNCATE is not allowed on %', TG_TABLE_NAME USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER evaluation_no_truncate
  BEFORE TRUNCATE ON "Evaluation" FOR EACH STATEMENT EXECUTE FUNCTION forbid_truncate();

-- Shape guarantees: a SUBMITTED row must be fully populated; a REQUESTED row must be empty.
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_state_shape_chk" CHECK (
  ("status" = 'REQUESTED' AND "scores" IS NULL AND "remarks" IS NULL AND "submittedAt" IS NULL AND "contentHash" IS NULL)
  OR
  ("status" = 'SUBMITTED' AND "scores" IS NOT NULL AND "remarks" IS NOT NULL AND "submittedById" IS NOT NULL
     AND "submittedAt" IS NOT NULL AND "contentHash" IS NOT NULL)
);

-- A student can never be the submitter of their own evaluation.
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_submitter_not_requester_chk"
  CHECK ("submittedById" IS NULL OR "submittedById" <> "requestedById");

-- ---------- 2. Audit log: append-only ----------
CREATE OR REPLACE FUNCTION audit_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog is append-only' USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_no_update_delete
  BEFORE UPDATE OR DELETE ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION audit_append_only();
CREATE TRIGGER audit_no_truncate
  BEFORE TRUNCATE ON "AuditLog" FOR EACH STATEMENT EXECUTE FUNCTION audit_append_only();

-- ---------- 3. Slot accounting can never over-fill ----------
ALTER TABLE "Vacancy" ADD CONSTRAINT "Vacancy_slots_chk"
  CHECK ("slots" >= 1 AND "slotsFilled" >= 0 AND "slotsFilled" <= "slots");

ALTER TABLE "Department" ADD CONSTRAINT "Department_slots_chk" CHECK ("totalSlots" >= 1);

-- ---------- 4. Role ↔ profile consistency ----------
-- (Enforced in the API transactionally; the unique indexes on StudentProfile.userId and
--  CompanyMember.userId already guarantee at most one profile per user.)

-- ---------- 5. Optional hardening (Postgres roles) ----------
-- For stronger separation run the app with a role that has no TRUNCATE/DROP and
-- cannot disable triggers:
--   REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM app_role;
--   (Only the table owner / superuser can DISABLE TRIGGER, so do NOT run the app as owner.)
-- Supabase users: also enable RLS and add policies (see docs/02-DATABASE-AND-SECURITY.md).
