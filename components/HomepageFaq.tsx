const FAQ_ITEMS = [
  {
    question: "What do I need before I can see my first matches?",
    answer:
      "Start with your academic level, discipline, GPA, and the details providers commonly screen for. You can complete your profile in stages, and Scholars is designed to get you to useful matches before every optional detail is finished.",
  },
  {
    question: "Does a match guarantee that I will receive the scholarship?",
    answer:
      "No. A match means the opportunity's published eligibility rules appear to fit your profile. The provider reviews applications and makes the final decision, so always check the provider's requirements and instructions before applying.",
  },
  {
    question: "Does Scholars submit applications for me?",
    answer:
      "No. Scholars helps you find relevant opportunities, understand missing requirements, keep deadlines, and track your progress. You complete the final application on the provider's own website.",
  },
  {
    question: "How are opportunities verified?",
    answer:
      "Listings are checked before they go live and reviewed as information changes. If a deadline or requirement cannot be confirmed, the opportunity is held or removed rather than presented as certain.",
  },
  {
    question: "Is Scholars free for students?",
    answer:
      "Yes. Scholars is free for students, and providers cannot pay to improve a listing's match or ranking. Your profile can be deleted from your account settings.",
  },
];

export function HomepageFaq() {
  return (
    <section id="faq" aria-labelledby="homepage-faq-heading" className="border-t border-hairline bg-white">
      <div className="mx-auto max-w-4xl px-5 py-14 sm:px-6 md:py-16">
        <div className="mb-8 max-w-2xl">
          <p className="font-mono text-xs uppercase tracking-widest text-emerald mb-2">Before you start</p>
          <h2 id="homepage-faq-heading" className="font-display text-2xl md:text-3xl font-semibold text-navy">
            What to expect from Scholars.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-navy-light">
            A match is a clear starting point, not a promise. Here is how the service helps and where the provider still makes the final call.
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
