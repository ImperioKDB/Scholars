// lib/email/template.ts
//
// Branded transactional email templates (Brevo htmlContent + textContent).
// Table-based with inline styles because email clients (Gmail, Outlook,
// Apple Mail) strip <style> blocks and external CSS. Light scheme only,
// declared via color-scheme meta so dark-mode clients render the intended
// parchment/white card instead of inverting it unpredictably.
//
// Palette mirrors the app tokens: navy #0B1E3D, parchment #F7F5EF,
// card white, emerald CTA #15705A, muted #5B6472, hairline #E4E1D8.
// No em-dashes anywhere in visible copy.
export type EmailListing = {
id: string;
title: string;
provider_name: string;
amount: string | null;
deadline: string | null;
kind_label: string; // Scholarship, Fellowship, Mentorship, Competition, Internship
url: string;
};
const NAVY = "#0B1E3D";
const PARCHMENT = "#F7F5EF";
const EMERALD = "#15705A";
const INK = "#10151F";
const MUTED = "#5B6472";
const HAIR = "#E4E1D8";
const SANS =
"-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const DISPLAY = "Georgia,'Times New Roman',serif";
function esc(s: string): string {
return s
.replace(/&/g, "&amp;")
.replace(/</g, "&lt;")
.replace(/>/g, "&gt;")
.replace(/"/g, "&quot;");
}
export function formatDate(iso: string): string {
const d = new Date(iso);
if (Number.isNaN(d.getTime())) return iso;
return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function metaLine(item: EmailListing): string {
const parts: string[] = [];
if (item.amount) parts.push(esc(item.amount));
if (item.deadline) parts.push("Closes " + esc(formatDate(item.deadline)));
else parts.push("Rolling, no fixed deadline");
return parts.join(" &nbsp;|&nbsp; ");
}
function shell(baseUrl: string, preheader: string, bodyHtml: string): string {
return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-scheme" content="light">
<title>Scholars</title>
</head>
<body style="margin:0;padding:0;background:${PARCHMENT};">
<div style="display:none;font-size:1px;color:${PARCHMENT};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PARCHMENT};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;">
<tr><td style="padding:0 0 14px 0;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="padding-right:9px;"><img src="${esc(baseUrl)}/logo.png" width="34" height="34" alt="" style="display:block;border:0;border-radius:8px;"></td>
<td style="font-family:${DISPLAY};font-size:20px;font-weight:700;color:${NAVY};">Scholars</td>
</tr></table>
</td></tr>
<tr><td style="background:#FFFFFF;border:1px solid ${HAIR};border-radius:16px;padding:26px 22px;font-family:${SANS};">
${bodyHtml}
</td></tr>
<tr><td style="padding:14px 4px 0 4px;font-family:${SANS};font-size:12px;line-height:19px;color:${MUTED};">
You're receiving this because you have a Scholars account.<br>
Questions? <a href="mailto:support.scholarsteam@gmail.com" style="color:${EMERALD};text-decoration:none;">support.scholarsteam@gmail.com</a><br>
- Ade, from Scholars
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
function tileHtml(item: EmailListing): string {
return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px 0;">
<tr><td style="background:${PARCHMENT};border-radius:12px;padding:14px 14px;">
<p style="margin:0 0 3px 0;font-family:${SANS};font-size:12px;font-weight:700;color:${EMERALD};">${esc(item.kind_label)}</p>
<p style="margin:0 0 4px 0;font-family:${SANS};font-size:15px;line-height:21px;font-weight:700;color:${NAVY};">${esc(item.title)}</p>
<p style="margin:0 0 6px 0;font-family:${SANS};font-size:13px;line-height:19px;color:${MUTED};">${esc(item.provider_name)}</p>
<p style="margin:0 0 9px 0;font-family:${SANS};font-size:12px;line-height:18px;color:${INK};">${metaLine(item)}</p>
<a href="${esc(item.url)}" style="font-family:${SANS};font-size:13px;font-weight:700;color:${EMERALD};text-decoration:none;">View it on Scholars &rarr;</a>
</td></tr>
</table>`;
}
function ctaHtml(href: string, label: string): string {
return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 0 0;"><tr><td style="background:${EMERALD};border-radius:9999px;">
<a href="${esc(href)}" style="display:inline-block;padding:12px 22px;font-family:${SANS};font-size:14px;font-weight:700;color:#FFFFFF;text-decoration:none;">${esc(label)}</a>
</td></tr></table>`;
}
export function renderNewListingsDigest(args: {
firstName: string;
items: EmailListing[];
moreCount: number;
baseUrl: string;
}): { subject: string; html: string; text: string } {
const { firstName, items, moreCount, baseUrl } = args;
const total = items.length + moreCount;
const single = total === 1 ? items[0] : null;
const subject = single
? `New ${single.kind_label.toLowerCase()} on Scholars: ${single.title}`
: `${total} new listings on Scholars`;
const intro = single
? "A new listing just went live that matches your profile:"
: `These just went live and match your profile:`;
const tiles = items.map(tileHtml).join("\n");
const moreLine =
moreCount > 0
? `<p style="margin:2px 0 12px 0;font-family:${SANS};font-size:13px;line-height:19px;color:${MUTED};">and ${moreCount} more on your dashboard.</p>`
: "";
const body = `<h1 style="margin:0 0 6px 0;font-family:${DISPLAY};font-size:22px;line-height:28px;color:${NAVY};">Hi ${esc(firstName)},</h1>
<p style="margin:0 0 16px 0;font-family:${SANS};font-size:14px;line-height:22px;color:${INK};">${intro}</p>
${tiles}
${moreLine}
${ctaHtml(baseUrl + "/dashboard", "See all your matches")}`;
const text = [
`Hi ${firstName},`,
"",
intro,
"",
...items.flatMap((i) => [
`${i.kind_label}: ${i.title}`,
`${i.provider_name}`,
i.amount ? `Amount: ${i.amount}` : "",
i.deadline ? `Closes: ${formatDate(i.deadline)}` : "Rolling, no fixed deadline",
i.url,
"",
]),
moreCount > 0 ? `and ${moreCount} more on your dashboard: ${baseUrl}/dashboard` : "",
"",
"- Ade, from Scholars",
]
.filter((l) => l !== undefined)
.join("\n");
return { subject, html: shell(baseUrl, subject, body), text };
}
// Broadcast digest: admin hand-picks listings and sends to EVERY registered
// email. Honest framing: these are team picks, not profile matches, so the
// intro never claims personalization the send doesn't do.
export function renderBroadcastDigest(args: {
firstName: string;
items: EmailListing[];
baseUrl: string;
}): { subject: string; html: string; text: string } {
const { firstName, items, baseUrl } = args;
const total = items.length;
const subject =
total === 1
? `Worth a look: ${items[0].title}`
: `${total} scholarships worth a look this week`;
const intro =
total === 1
? "Our team verified this scholarship and didn't want you to miss it:"
: "Our team verified these scholarships and didn't want you to miss them:";
const tiles = items.map(tileHtml).join("\n");
const body = `<h1 style="margin:0 0 6px 0;font-family:${DISPLAY};font-size:22px;line-height:28px;color:${NAVY};">Hi ${esc(firstName)},</h1>
<p style="margin:0 0 16px 0;font-family:${SANS};font-size:14px;line-height:22px;color:${INK};">${intro}</p>
${tiles}
${ctaHtml(baseUrl + "/dashboard", "See all your matches")}`;
const text = [
`Hi ${firstName},`,
"",
intro,
"",
...items.flatMap((i) => [
`${i.kind_label}: ${i.title}`,
`${i.provider_name}`,
i.amount ? `Amount: ${i.amount}` : "",
i.deadline ? `Closes: ${formatDate(i.deadline)}` : "Rolling, no fixed deadline",
i.url,
"",
]),
"",
"- Ade, from Scholars",
]
.filter((l) => l !== undefined)
.join("\n");
return { subject, html: shell(baseUrl, subject, body), text };
}
export function renderDeadlineReminder(args: {
firstName: string;
item: EmailListing;
daysLeft: number;
baseUrl: string;
}): { subject: string; html: string; text: string } {
const { firstName, item, daysLeft, baseUrl } = args;
const subject = `Deadline coming up: ${item.title}`;
const urgent = daysLeft <= 3;
const dueColor = urgent ? "#A63A35" : NAVY;
const body = `<h1 style="margin:0 0 6px 0;font-family:${DISPLAY};font-size:22px;line-height:28px;color:${NAVY};">Hi ${esc(firstName)},</h1>
<p style="margin:0 0 16px 0;font-family:${SANS};font-size:14px;line-height:22px;color:${INK};">A scholarship you saved is due soon:</p>
${tileHtml(item)}
<p style="margin:0 0 14px 0;font-family:${SANS};font-size:14px;line-height:21px;font-weight:700;color:${dueColor};">Due in ${daysLeft} day${daysLeft === 1 ? "" : "s"} (${esc(formatDate(item.deadline ?? ""))})</p>
${ctaHtml(item.url, "View scholarship")}
<p style="margin:14px 0 0 0;font-family:${SANS};font-size:12px;line-height:18px;color:${MUTED};">After the deadline passes, Ade will check in with you in the app.</p>`;
const text = [
`Hi ${firstName},`,
"",
"A scholarship you saved is due soon:",
"",
`${item.kind_label}: ${item.title}`,
`${item.provider_name}`,
item.amount ? `Amount: ${item.amount}` : "",
`Due in ${daysLeft} day${daysLeft === 1 ? "" : "s"} (${formatDate(item.deadline ?? "")})`,
item.url,
"",
"- Ade, from Scholars",
]
.filter((l) => l !== "")
.join("\n");
return { subject, html: shell(baseUrl, subject, body), text };
}
// Profile completion nudge: sent at most every PROFILE_REMINDER_INTERVAL_DAYS
// (default 2) to students whose profile is under 100%, capped at
// PROFILE_REMINDER_MAX_SENDS total sends per student. Shared by the cron
// (Phase 1b) and the admin manual button -- one template, two callers.
// Honest framing: states the exact completeness, names up to three fields
// that are still missing, and says plainly that these stop at 100%.
export function renderProfileNudge(args: {
firstName: string;
completeness: number;
missingLabels: string[];
baseUrl: string;
}): { subject: string; html: string; text: string } {
const { firstName, completeness, missingLabels, baseUrl } = args;
const subject = `Your Scholars profile is ${completeness}% complete`;
const top = missingLabels.slice(0, 3);
const missingLine =
top.length > 0
? `Add your ${top.join(", ")}${
missingLabels.length > 3
? ` and ${missingLabels.length - 3} other detail${missingLabels.length - 3 === 1 ? "" : "s"}`
: ""
} to unlock more matches.`
: "A few more details will unlock more matches.";
const body = `<h1 style="margin:0 0 6px 0;font-family:${DISPLAY};font-size:22px;line-height:28px;color:${NAVY};">Hi ${esc(firstName)},</h1>
<p style="margin:0 0 8px 0;font-family:${SANS};font-size:14px;line-height:22px;color:${INK};">Your profile is <strong>${completeness}% complete</strong>. ${esc(missingLine)}</p>
<p style="margin:0 0 16px 0;font-family:${SANS};font-size:14px;line-height:22px;color:${INK};">A fuller profile means more accurate match scores, and awards you'd otherwise never see. It takes about 5 minutes.</p>
${ctaHtml(baseUrl + "/onboarding", "Finish my profile")}
<p style="margin:14px 0 0 0;font-family:${SANS};font-size:12px;line-height:18px;color:${MUTED};">We'll check in every couple of days until this is done. Once you hit 100%, these stop.</p>`;
const text = [
`Hi ${firstName},`,
"",
`Your profile is ${completeness}% complete. ${missingLine}`,
"",
"A fuller profile means more accurate match scores, and awards you'd otherwise never see. It takes about 5 minutes.",
"",
`Finish it here: ${baseUrl}/onboarding`,
"",
"We'll check in every couple of days until this is done. Once you hit 100%, these stop.",
"",
"- Ade, from Scholars",
].join("\n");
return { subject, html: shell(baseUrl, subject, body), text };
}
