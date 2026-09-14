# Scholars Scholarship Researcher Brief

## Role purpose

The scholarship researcher maintains a trustworthy, current catalogue of undergraduate scholarship opportunities for Scholars, a Nigerian student-facing platform. The output of each research task must be complete enough for an administrator to enter directly into **Admin → Scholarships → Add scholarship** without guessing, filling gaps from memory, or converting promotional language into unsupported eligibility rules.

Scholars ranks opportunities against student profiles. A wrong deadline, an unverified application link, or an over-broad eligibility rule can send students toward a closed or unsuitable opportunity. **Unknown information must remain unknown**: leave the corresponding field blank and explain the gap in Research notes rather than inventing a date, amount, acceptance rate, or eligibility requirement.

## What to deliver for every scholarship

Submit one completed record using the headings below. Include the exact source URL beside every material claim. The preferred source is the provider's official website, official application portal, official notice, or official social channel. If the official source is unavailable, use at least two independent, reputable sources and clearly state that the provider's current page could not be confirmed.

### 1. Core listing information

| Add Scholarship field | What the researcher must provide | When to leave it blank |
|---|---|---|
| **Title** | The official programme name, including the current cycle year only when the provider uses a year-specific title. | Never leave blank. Do not rename a programme for search-engine wording. |
| **Provider name** | The organization legally or publicly responsible for the award. Include a partner only when the source presents it as part of the programme name. | Never leave blank. |
| **Description** | A short student-readable summary covering what the award supports, who it is for, and the most important caveat. Keep source commentary out of this field. | Leave blank only if no reliable student-facing summary can be written. |
| **Award amount** | The amount and currency, plus what it covers: tuition, stipend, one-off grant, renewable support, accommodation, mentorship, or other benefits. Preserve qualifiers such as “up to,” “per session,” or “subject to renewal.” | Leave blank when no amount is published. Never estimate from older cycles. |
| **Opens on** | The confirmed opening date for the current cycle, if applications are not yet open. | Leave blank when applications are already open or the opening date is not confirmed. |
| **Deadline** | The confirmed closing date for the current student application window. | Leave blank for rolling applications, no fixed deadline, or a date that is only a projection. Do not use a branch, nomination, or provider-internal forwarding date as the student deadline. |
| **Last cycle closed** | The date the previous application window actually closed when the programme is cyclical but the next opening/deadline is not yet known. | Leave blank for non-cyclical programmes or when the previous close cannot be confirmed. |
| **Application URL** | The direct, working application page or official programme page that takes a student to the application path. Check that it loads and is for the named programme and current cycle. | Leave blank if no stable online link exists. Use How to apply instead. |
| **How to apply** | Plain-language steps for applying when the URL is absent or insufficient. Include email addresses, branch/office instructions, forms to download, submission method, required documents, naming/format rules, interview steps, and any “apply for admission first” dependency. | Leave blank only when the Application URL fully explains the process. |

### 2. Matching and eligibility rules

Create one eligibility rule for each requirement that Scholars can actually check against a student profile. Use the exact field and value supported by the form; do not create a rule merely because a phrase sounds like a requirement.

| Source requirement | Add as a RuleBuilder rule when it is explicit | Notes |
|---|---|---|
| Citizenship or nationality | `nationality` | Record the exact accepted nationality or nationalities. |
| Gender restriction | `gender` | Use only when the provider clearly restricts eligibility. |
| Financial hardship / indigent status | `financial_need` | This is a proxy for a committee-assessed concept. Explain that the provider may verify it subjectively. |
| Field of study / approved course list | `discipline` | Use the platform's course names. Use `in` for an approved list. If a source course does not map cleanly, do not force a typo or near-match; record it in Research notes. |
| Age range | `age` with `gte` or `lte` | Confirm the relevant “as at” date if the provider specifies one. |
| State of origin | `state_of_origin` | State-based programmes often require indigene certificates or paternity-based proof; record that in How to apply or Research notes. |
| LGA of origin | `lga_of_origin` | Use the exact LGA spelling from the source. |
| Year of study / level | `year_of_study` | Translate only clear statements such as “100-level only” or “200-level and above.” |
| Institution category | `institution_type` | Select federal university, state university, private university, polytechnic, or college of education only when the source supports that category. |
| JAMB / UTME threshold | `jamb_score` | Record a numeric threshold only when explicitly stated. |
| WAEC/NECO credits | `waec_credit_count` | Record the required number, and add `has_english_maths_credit = true` when English and Mathematics are explicitly required. |
| Disability status | `disability_status` | Use only for an explicit disability-focused or disability-restricted programme. |
| Career goals | `career_goals` | This is not automatically scored. Use only when the requirement is meaningful and clearly stated; explain the manual verification need. |

The matching engine treats **discipline, nationality, gender, state/LGA of origin, age, and institution type** as hard eligibility gates. GPA, year of study, JAMB, WAEC credits, English/Maths credit, financial need, disability status, and similar numeric/boolean checks are scored against the profile but do not by themselves create the same categorical gate. If the source uses ambiguous language such as “preference,” “priority,” “competitive,” “encouraged,” or “usually,” do not turn it into a hard rule. Put the nuance in the student-facing Description or How to apply and explain it in Research notes.

### 3. Requirements that are not currently representable as matching rules

Some real requirements do not have a dedicated Scholars profile field. Do not invent a rule for them. Put them in **How to apply**, **Description**, or **Research notes**, depending on whether the student needs to see them.

Examples include a named institution or named list of institutions, a particular admission status, pre-matriculation applicants, “must not hold another scholarship,” parent/guardian income documents, a specific certificate, an interview, an essay word count, a recommendation-letter format, a registrar's attestation, a provider-specific indigene certificate, and institution names that cannot be expressed by the available institution categories. Flag any such limitation explicitly so an administrator can avoid overstating the match score.

### 4. Competitiveness information

Provide these fields only when they are sourced or carefully labelled estimates:

- **Awards available:** number of recipients or slots per cycle.
- **Estimated applicant pool:** a researched estimate, with its basis.
- **Historical acceptance rate:** a fraction from 0 to 1, such as `0.08` for 8%, only when a past-cycle figure is available.
- **Competitiveness tier:** low, medium, high, or very high when precise numbers are unavailable but the evidence supports a qualitative judgement.
- **Competitiveness notes:** the source, cycle, calculation, and uncertainty behind the numbers.

Never enter `0` to mean “unknown.” Leave the field blank when the provider does not publish the information. An unknown competitiveness signal is intentionally not treated as a penalty by Scholars.

## Verification standard

A listing may be marked **Verified** only when all of the following are true:

1. The programme itself is real and attributable to the named provider.
2. The current application path is confirmed, or the record clearly explains a legitimate offline/email/branch process.
3. The deadline and opening status are current and tied to the student application window, not a projected date or an internal provider deadline.
4. The material eligibility requirements and award coverage have been checked against a primary source whenever possible.
5. The record contains a student-visible path to apply: either Application URL or How to apply.
6. The Research notes include the date checked, source URL(s), confidence, and unresolved issues.

A programme can be real without its current cycle being confirmed. In that case, leave it **Pending review**, do not enter a guessed future deadline, and record the last confirmed cycle close only when available.

## Research notes format

Use the admin-only Research notes field for evidence and reasoning, not for a second student description. Keep it concise but auditable. This format is recommended:

```text
Checked: YYYY-MM-DD
Sources: https://official-source.example/page; https://independent-source.example/article
Confidence: high / medium / low
Current cycle: opened YYYY-MM-DD; closes YYYY-MM-DD / rolling / not currently announced
Confirmed: [key facts that were directly verified]
Contradictions or limitations: [what sources disagree on, or what Scholars cannot represent]
Follow-up: [what should be checked next and when]
```

For a source that is a search result, social post, shared flyer, or aggregator, include the underlying URL and say that it was not independently confirmed by the provider. Do not write “verified” when only the existence of the programme was verified but the current cycle was not.

## Quality-control checklist before submission

- The programme name and provider match the source.
- The application link was opened and belongs to the named programme or a clearly legitimate application provider.
- The deadline is the student deadline for the current cycle; no placeholder or one-year-forward date was used.
- Rolling, missing, or not-yet-announced dates were left blank.
- The award amount states currency, frequency, coverage, and renewal caveats when known.
- All explicit, representable eligibility requirements were added as rules using the platform's exact field values.
- Non-representable requirements are visible in How to apply or Description and called out in Research notes.
- Required documents and submission format are included in How to apply.
- Course lists were mapped conservatively; ambiguous course names were not silently broadened.
- Source URLs, date checked, confidence, contradictions, and follow-up are in Research notes.
- The record has either an Application URL or actionable How to apply instructions before it is marked Verified.

## Definition of a complete handoff

A handoff is complete when an administrator can copy the values into Add Scholarship, add the listed RuleBuilder rules, leave unsupported or unknown facts blank, and mark Verified without needing to contact the researcher for missing evidence. If that is not possible, submit the record as **Pending review** and state exactly what is missing.

## Scope note for the current platform

The live Scholars database contains the scholarship fields above plus an admin-only `research_notes` field and historical cycle-event data. The matching profile currently covers Nigerian undergraduate-relevant information such as discipline, GPA, nationality, gender, financial need, age, state/LGA of origin, year of study, institution type, JAMB, WAEC credits, English/Maths credit, and disability status. Student document readiness is tracked separately and is not a scholarship matching rule. The researcher must therefore preserve document requirements in How to apply rather than pretending they are automatically verified by the match score.

This brief is intentionally aligned to the live Add Scholarship workflow and the current `scholarships` / `scholarship_rules` schema. If a provider's requirement cannot be represented safely, documenting the limitation is better than creating a confident but incorrect match.
