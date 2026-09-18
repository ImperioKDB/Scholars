-- Ade check-in outcome: the student tracked the scholarship but did not apply.
-- This is terminal, like submitted/accepted/rejected, so it leaves the
-- in-progress follow-up queue without misclassifying the student's decision.
alter type application_status add value if not exists 'not_applied';
