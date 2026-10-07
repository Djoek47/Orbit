-- ChoreMaxx v2 §1.2: every household is a family; roommate / multi-type selection is retired.
-- Legacy values (roommates, single-parent, multi-generational, custom) are normalized to family.

UPDATE households
SET household_type = 'family'
WHERE household_type IS DISTINCT FROM 'family';

ALTER TABLE households
  ALTER COLUMN household_type SET DEFAULT 'family';

COMMENT ON COLUMN households.household_type IS
  'Always family (ChoreMaxx v2). Legacy roommate and other household_type values are no longer used.';
