const FAQ_ITEMS = [
  {
    question: "Who is Scholars for?",
    answer:
      "Scholars is built for students in Nigeria who want a simpler way to find relevant scholarship opportunities. Your matches are shaped by your academic level, discipline, and the eligibility details providers actually use.",
  },
  {
    question: "What do I need before I can see my first matches?",
    answer:
      "Start with your academic level, discipline, GPA, and the details providers commonly screen for. You can complete your profile in stages, and Scholars is designed to get you to useful matches before every optional detail is finished.",
  },
  {
    question: "How are opportunities verified?",
    answer:
      "Listings are checked before they go live and reviewed as information changes. If a deadline or requirement cannot be confirmed, the opportunity is held or removed rather than presented as certain.",
  },
  {
    question: "Can I save scholarships and keep track of deadlines?",
    answer:
      "Yes. Save opportunities you want to revisit, receive reminders before deadlines, and keep your application progress in one place instead of relying on scattered notes and browser tabs.",
  },
  {
    question: "Is Scholars free, and can I delete my profile?",
    answer:
      "Yes. Scholars is free for students, and providers cannot pay to improve a listing's match or ranking. You can delete your profile from your account settings whenever you choose.",
  },
];

export function HomepageFaq() {
  return (
    <section id="faq" aria-labelledby="homepage-faq-heading" className="border-t border-hairline bg-white">
      <div className="mx-auto max-w-4xl px-5 py-14 sm:px-6 md:py-16">
        <div className="mb-8 max-w-2xl">
          <p className="font-mono text-xs uppercase tracking-widest text-emerald mb-2">Before you start</p>
          <h2 id="homepage-faq-heading" className="font-display text-2xl md:text-3xl font-semibold text-navy">
            Questions students usually have.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-navy-light">
            The short version of what Scholars is for, what you need, and what happens once you find an opportunity worth saving.
          </p>
        </div>
        <div className="divide-y divide-hairline border-y border-hairline">
          {FAQ_ITEMS.map((item) => (
            <details key={item.question} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-left text-sm font-semibold text-navy [&::-webkit-details-marker]:hidden">
                <span>{item.question}</span>
                <span aria-hidden="true" className="text-xl font-normal leading-none text-navy-light transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="max-w-3xl pt-3 pr-8 text-sm leading-relaxed text-navy-light">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
