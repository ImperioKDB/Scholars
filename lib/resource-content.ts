import type { ResourceArticle, ResourceArticleCard, ResourceCategory, ResourceCategoryLink } from "./resource-center";

const AUTHOR_NAME = "Scholars Editorial Desk";
const AUTHOR_BIO = "The Scholars editorial desk turns complicated scholarship advice into practical steps for students in Nigeria and beyond.";
const REVIEWED_AT = "2026-11-11T00:00:00.000Z";

export const LOCAL_RESOURCE_CATEGORIES: ResourceCategory[] = [
  { id: "local-category-application", slug: "scholarship-applications", name: "Scholarship applications", description: "Practical guidance for finding opportunities, preparing materials, and submitting with care.", display_order: 1 },
  { id: "local-category-writing", slug: "essays-and-letters", name: "Essays and letters", description: "Clearer motivation letters, personal statements, and recommendation requests.", display_order: 2 },
  { id: "local-category-interviews", slug: "interviews-and-tests", name: "Interviews and tests", description: "Preparation habits for scholarship interviews, aptitude tests, and selection stages.", display_order: 3 },
  { id: "local-category-study", slug: "study-abroad-and-funding", name: "Study abroad and funding", description: "How to assess international study options and understand funding information without guesswork.", display_order: 4 },
  { id: "local-category-development", slug: "study-techniques", name: "Study techniques", description: "Sustainable ways to learn, plan, and build evidence of academic growth.", display_order: 5 },
  { id: "local-category-safety", slug: "scam-awareness", name: "Scam awareness", description: "Simple checks that help you avoid fake scholarships and costly application mistakes.", display_order: 6 },
];

const categoryBySlug = Object.fromEntries(LOCAL_RESOURCE_CATEGORIES.map((category) => [category.slug, category]));

const articleDefinitions = [
  {
    id: "local-article-legitimate-scholarships",
    slug: "how-to-find-legitimate-scholarships",
    title: "How to find scholarships you can trust",
    excerpt: "A careful search is more than typing ‘fully funded scholarship’ into a search box. Use this verification routine before you share documents, pay a fee, or invest time in an application.",
    article_type: "Field guide",
    reading_time_minutes: 8,
    categories: ["scholarship-applications", "scam-awareness"],
    content_markdown: `## Start with the provider, not the promise

A trustworthy scholarship has an identifiable provider and a clear way to verify the opportunity outside the post that brought you to it. Start by finding the provider's official website, then look for the programme page, eligibility information, application instructions, and a contact route using the provider's own domain.

Treat a repost, WhatsApp broadcast, or social-media graphic as a lead rather than proof. Search for the same opportunity on the provider's official site. If you cannot find it there, pause before sharing your passport, academic records, bank details, or any payment.

## Run a five-question check

Use these questions for every opportunity:

1. Who is awarding the scholarship, and can you confirm that organisation independently?
2. What is the official application URL, and does it belong to the provider or a clearly named application partner?
3. What does the provider say about eligibility, selection, documents, and dates?
4. Are the instructions consistent across the official page, application portal, and published contact channels?
5. Does the opportunity ask for money, urgency, secrecy, or sensitive information before you can verify it?

A “yes” to the last question does not automatically prove fraud, but it is a reason to stop and verify. The [Federal Scholarship Board](https://education.gov.ng/federal-scholarship-board/) and [EducationUSA](https://educationusa.state.gov/) are useful examples of starting with an identifiable public information source rather than an anonymous listing.

## Understand what ‘fully funded’ actually means

Funding labels are not interchangeable. One award may cover tuition only; another may include a stipend, travel, accommodation, insurance, or a contribution toward costs. The official terms should say what is covered and what remains your responsibility.

Do not fill gaps with assumptions. If a page says “funded” but does not explain the package, write down the missing question and ask the provider through an official contact route. Do not advertise an amount, deadline, or benefit to another student until you can point to the source and its review date.

## Protect your application identity

Use a separate email address for applications and store copies of what you submit. Avoid sending one-time passwords, card PINs, or banking credentials to a scholarship contact. A legitimate application may request identity or academic documents, but you should know why they are needed and submit them through the official channel.

Be especially cautious when a message asks you to pay for a guaranteed award, buy a “processing slot,” or recruit other applicants. No one can guarantee selection before the provider completes its process.

## Keep a small verification record

For each opportunity, save the official URL, provider name, stated deadline, eligibility notes, documents requested, and the date you checked the page. This makes it easier to notice changed instructions and prevents you from relying on an old screenshot.

When in doubt, leave the opportunity unsubmitted and use the [Scholars opportunities directory](/opportunities-for-students) to continue your search. A slower verified application is safer than a fast application built on a promise you cannot confirm.`,
  },
  {
    id: "local-article-motivation-letter",
    slug: "how-to-write-a-scholarship-motivation-letter",
    title: "How to write a scholarship motivation letter",
    excerpt: "A strong motivation letter connects your direction, evidence, and the specific opportunity. Here is a practical structure you can adapt without making your story sound copied.",
    article_type: "Writing guide",
    reading_time_minutes: 9,
    categories: ["essays-and-letters", "scholarship-applications"],
    content_markdown: `## What the letter needs to do

A motivation letter is not a second CV and it is not a list of impressive adjectives. Its job is to help a reviewer understand why this opportunity fits your preparation, goals, and next step.

Before drafting, read the official prompt and selection criteria. Make a short table with three columns: what the provider asks for, the evidence you have, and the example that proves it. This keeps the letter anchored to the application instead of becoming a general autobiography.

## Use a simple four-part structure

1. **Direction:** Name the programme or opportunity and the question, field, or problem that motivates you.
2. **Evidence:** Show two or three experiences that built relevant skills. Explain what you did, not only what your role was called.
3. **Fit:** Connect the provider's programme to the next skill or perspective you need. Use details from the official programme information.
4. **Contribution and close:** Explain how you will use the learning and what you hope to contribute to the cohort or community.

This structure is flexible. A provider may prescribe different questions or a word limit, and those instructions take priority.

## Replace claims with scenes

“I'm hardworking and passionate” is difficult to evaluate. A specific example is stronger: what problem did you face, what action did you take, and what changed because of it? A student who organised peer revision sessions can show planning, communication, and service through the details of the work.

Choose examples you can explain honestly. They do not have to be dramatic. Consistent family responsibilities, a project, community work, part-time work, or an academic recovery can all show evidence when you describe the decisions and learning involved.

## Make the fit specific

The fit paragraph should not work unchanged for ten different scholarships. Name the course, theme, network, or learning opportunity that matters to you, using the provider's official description as your source. Then explain the connection to a goal you have already established.

Avoid claiming that a provider will solve every challenge or that you will transform an entire country alone. Specific, credible ambition is more persuasive than a promise with no route to delivery.

## Edit for a busy reviewer

Write a plain first draft, then edit in passes:

- Remove greetings and background that do not answer the prompt.
- Check every paragraph for one clear job.
- Replace repeated adjectives with evidence.
- Read the letter aloud for rhythm and missing words.
- Check the word count, spelling of names, and exact programme title.
- Ask a trusted reader to mark places that are vague, not to rewrite your voice.

Never copy a successful applicant's story or use an AI-generated claim you cannot defend. The final letter should sound like a careful version of you, not like a template.`,
  },
  {
    id: "local-article-personal-statement",
    slug: "how-to-write-a-scholarship-personal-statement",
    title: "How to write a scholarship personal statement that sounds like you",
    excerpt: "Personal statements become memorable when they show how your experiences shaped a choice. Build a focused narrative, then support it with evidence and reflection.",
    article_type: "Writing guide",
    reading_time_minutes: 10,
    categories: ["essays-and-letters", "study-techniques"],
    content_markdown: `## Choose one through-line

A personal statement cannot carry your entire life story. Pick a through-line: a question you keep returning to, a problem you want to understand, or a change you have worked toward. Your examples should help the reader follow that line.

Start with a private list of moments that changed your direction. For each one, write what happened, what you did, what you learned, and what you would do differently now. The pattern in those notes is usually more useful than a dramatic opening sentence.

## Show reflection, not just activity

A statement that only says what you joined leaves the reviewer to guess why it matters. After an example, add the reflection: what did it teach you about the field, about working with other people, or about the kind of problem you want to solve?

Reflection does not mean making every experience sound perfect. A setback can be useful when you explain the decision you made afterward and the evidence that you changed your approach. Keep the account proportionate and avoid turning hardship into a performance for sympathy.

## Build a beginning, middle, and next step

The opening should establish the question or direction. The middle should make that direction credible with a small number of detailed examples. The ending should name the next step and why this scholarship or programme is the right environment for it.

Do not make the conclusion a list of promises. Instead, describe a plausible next action: a research area you want to develop, a community you want to serve, a skill you need to practise, or a project you want to improve.

## Keep your evidence precise

When you mention a project, include enough context for a reader who does not know your school or community. What was the need? What part did you own? What was the result or learning? If you use a number, make sure you can explain where it came from and what it measures.

If your academic path includes a gap, change, or result you are concerned about, address it briefly and truthfully when the prompt makes it relevant. Focus on context, response, and present readiness rather than excuses.

## Make the final version yours

Read the statement beside the prompt and remove anything that could belong to any applicant. Verify every proper noun and programme detail against the provider's official page. Then ask someone who knows your work whether the voice and examples feel accurate.

A good final statement is not the most ornate one. It is the one that lets a reviewer see a real person making a considered next move.`,
  },
  {
    id: "local-article-interviews-tests",
    slug: "prepare-for-scholarship-aptitude-tests-and-interviews",
    title: "How to prepare for scholarship aptitude tests and interviews",
    excerpt: "Selection stages reward preparation that is specific and repeatable. Use this plan to practise reasoning, explain your choices, and stay calm without trying to predict every question.",
    article_type: "Preparation guide",
    reading_time_minutes: 8,
    categories: ["interviews-and-tests", "study-techniques"],
    content_markdown: `## Find out what the provider actually assesses

Start with the official selection information. Some providers publish a test outline, interview format, competency framework, or sample questions; others only describe the stage broadly. Do not pay a third party for a guarantee that it knows hidden questions.

Make a preparation list from the information you can verify: numerical or verbal reasoning, subject knowledge, motivation, communication, teamwork, leadership, community involvement, or programme fit. Prepare for the stated criteria, not a rumour about last year's panel.

## Practise under a small time limit

For aptitude tests, practise the skill before practising speed. Review percentages, ratios, graphs, reading comprehension, logical patterns, and estimation if those areas are relevant to the published format. Keep an error log with the question type, your mistake, and the correction.

Then add short timed sets. The aim is to make a decision when the clock is visible, not to panic when one question is difficult. If the instructions allow you to skip and return, use that strategy; never assume a rule that the test platform does not state.

## Build answer notes, not scripts

Prepare a handful of stories that show your work, learning, service, collaboration, and response to difficulty. Use a simple pattern: situation, action, result, reflection. The notes should help you remember the evidence while leaving room to answer the actual question.

Expect follow-up questions. If you say you led a project, be ready to explain the problem, your specific contribution, a disagreement, and what you would change. Honest limits are safer than inflated claims that collapse under a follow-up.

## Rehearse the practical details

Confirm the time zone, platform, identification requirements, internet expectations, and contact route in the official invitation. Test your camera, microphone, browser, and backup plan early. Choose a quiet, well-lit place and keep your application materials nearby, but do not read answers from a hidden script.

If connectivity fails, use the provider's official contact route and record the time and message. Do not send sensitive documents to an unverified number offered in a group chat.

## On the day

Take a breath before answering. It is acceptable to ask for a question to be repeated or to take a moment to think. Answer the question asked, give a concrete example, and stop when the point is complete.

Afterward, write down what you learned while it is fresh, but do not treat an informal impression as a result. Wait for the provider's official communication and keep preparing for other verified opportunities.`,
  },
  {
    id: "local-article-recommendation-letters",
    slug: "how-to-get-strong-recommendation-letters",
    title: "How to ask for a strong recommendation letter",
    excerpt: "The best recommendation is specific because the writer has useful evidence. Make the request early, give context, and make it easy for the right person to be accurate.",
    article_type: "Application guide",
    reading_time_minutes: 7,
    categories: ["essays-and-letters", "scholarship-applications"],
    content_markdown: `## Choose evidence over status

A senior title does not automatically make someone the best recommender. Choose a person who has directly observed your academic work, service, leadership, research, employment, or growth in a context relevant to the opportunity.

Read the provider's instructions first. It may specify the number of letters, relationship requirements, submission method, language, or whether the letter must be confidential. Your recommender's convenience cannot override the official requirement.

## Ask early and make the request clear

Ask at least several weeks before the deadline when possible. Say what the scholarship is, why you are applying, why you are asking this person, the deadline and time zone, and how the letter must be submitted. Ask whether they can provide a **strong and specific** recommendation rather than assuming a yes.

If they decline or cannot meet the deadline, thank them and ask another suitable person. A reluctant letter is not improved by repeated pressure.

## Prepare a useful recommender brief

Send one organised document or folder containing:

- The official opportunity link and selection criteria.
- Your CV or a short record of relevant work.
- The prompt, word limit, and submission instructions.
- Two or three examples the writer personally knows.
- Your current goals and the connection to the programme.
- The exact deadline and your contact details.

Do not write a fake letter for someone to sign. You can provide factual context and reminders, but the writer must use their own judgment and voice.

## Protect accuracy and confidentiality

Give the recommender time to check dates, roles, results, and names. If the provider requests a confidential submission, do not ask to read or edit the final letter. You can still ask whether they were able to submit and whether they need a reminder before the deadline.

Keep a record of submission status without storing private letter content unnecessarily. Never upload a recommendation to an unofficial site just because a middleman says it is required.

## Close the loop

Send a brief thank-you after the letter is submitted, then update the recommender when you receive a result. If you apply again, ask whether they are comfortable supporting another application and provide the new instructions rather than reusing an old request.

A strong letter is a collaboration built on real evidence. Your part is to choose the right person, give them enough context, and leave room for an honest assessment.`,
  },
  {
    id: "local-article-application-mistakes",
    slug: "common-scholarship-application-mistakes",
    title: "Six scholarship application mistakes that are easy to avoid",
    excerpt: "Many applications fail for preventable reasons: a missed instruction, an unchecked document, or a rushed submission. Use this final-review checklist before you press submit.",
    article_type: "Final checklist",
    reading_time_minutes: 7,
    categories: ["scholarship-applications", "scam-awareness"],
    content_markdown: `## 1. Applying before checking the official rules

Do not rely on a poster, forwarded message, or search snippet for eligibility or dates. Read the provider's current instructions and save the page you used. If a requirement is unclear, ask through the official contact route before you build the application around an assumption.

## 2. Sending the same essay everywhere

A reusable experience bank is helpful; a copied final essay is not. Check that each response answers the actual prompt, uses the provider's programme name correctly, and stays within the stated limit. Remove claims that belong to another application.

## 3. Describing roles without evidence

A list of clubs and titles does not show impact by itself. Add context, your contribution, the result, and what you learned. Use only figures and outcomes you can explain honestly.

## 4. Leaving documents until the last day

Request transcripts, references, translations, or identity documents early. Check whether scans must be certified, whether files need a particular format, and whether the portal accepts the file size. Do not edit an official document to make it look better.

## 5. Ignoring the final portal review

Before submitting, compare every field with your source documents. Check names, dates, contact details, programme choice, attachments, and required declarations. Open uploaded files to make sure they are readable. If the portal provides a preview, review that version rather than trusting the draft screen.

## 6. Treating submission as proof of success

Save the confirmation page, reference number, and submission time. A browser message that appears after a timeout is not the same as an official confirmation. If you are unsure, check the application portal or contact the provider using its published support channel.

## A ten-minute final check

Read the official checklist once more. Confirm eligibility, deadline and time zone, required documents, word limits, references, and submission confirmation. Then keep a copy of what you sent in a private folder.

If an opportunity asks for payment for guaranteed selection, demands a one-time password, or cannot be verified on an official source, stop and review it with the [legitimate scholarship checks in this guide](/resources/how-to-find-legitimate-scholarships) before proceeding. For more verified opportunities, visit [Scholars](/opportunities-for-students).`,
  },
] as const;

function toArticle(definition: (typeof articleDefinitions)[number]): ResourceArticle {
  return {
    id: definition.id,
    slug: definition.slug,
    title: definition.title,
    excerpt: definition.excerpt,
    content_markdown: definition.content_markdown,
    article_type: definition.article_type,
    canonical_url: `https://www.scholars.com.ng/resources/${definition.slug}`,
    featured_image_path: null,
    reading_time_minutes: definition.reading_time_minutes,
    published_at: "2026-11-11T00:00:00.000Z",
    last_reviewed_at: REVIEWED_AT,
    author_name: AUTHOR_NAME,
    author_bio: AUTHOR_BIO,
    author_avatar_path: null,
  };
}

export const LOCAL_RESOURCE_ARTICLES: ResourceArticle[] = articleDefinitions.map(toArticle);
export const LOCAL_RESOURCE_ARTICLE_CARDS: ResourceArticleCard[] = LOCAL_RESOURCE_ARTICLES.map(({ content_markdown: _content, canonical_url: _canonical, last_reviewed_at: _reviewed, author_bio: _bio, author_avatar_path: _avatar, ...card }) => card);

export function getLocalResourceCategory(slug: string) {
  return categoryBySlug[slug] ?? null;
}

export function getLocalResourceArticle(slug: string) {
  return LOCAL_RESOURCE_ARTICLES.find((article) => article.slug === slug) ?? null;
}

export function getLocalResourceCategoriesForArticle(articleId: string): ResourceCategoryLink[] {
  const definition = articleDefinitions.find((article) => article.id === articleId);
  return (definition?.categories ?? []).map((slug) => {
    const category = categoryBySlug[slug];
    return { article_id: articleId, category_id: category.id, slug: category.slug, name: category.name, description: category.description, display_order: category.display_order };
  });
}

export function getLocalResourceArticlesForCategory(slug: string): ResourceArticleCard[] {
  return articleDefinitions
    .filter((article) => article.categories.some((category) => category === slug))
    .map((article) => LOCAL_RESOURCE_ARTICLE_CARDS.find((card) => card.id === article.id)!)
    .sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at) || a.id.localeCompare(b.id));
}
