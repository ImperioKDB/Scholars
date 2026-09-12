// components/icons.tsx
// Single home for every nav/shell icon. Commit 90105e0 introduced an admin
// Sidebar that imports these from '@/components/icons' while the student
// Sidebar previously inlined its own copies; centralizing them removes the
// duplicate-definition collision now that both sidebars live in one module.
//
// Contract: every icon accepts an optional className for sizing/coloring.
// Student shell renders them bare (18px default); admin nav passes
// className="w-5 h-5 ...". Stroke style matches the existing house style
// (24 viewBox, currentColor, 1.6 weight, round caps).
export type IconProps = { className?: string };
const STUDENT_DEFAULT = "h-[18px] w-[18px]";
const ADMIN_DEFAULT = "h-5 w-5";
function base(className: string | undefined, fallback: string) {
  return className ?? fallback;
}
export function DashboardIcon({ className }: IconProps) {
  return (
    <svg className={base(className, STUDENT_DEFAULT)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  );
}
export function ApplicationsIcon({ className }: IconProps) {
  return (
    <svg className={base(className, STUDENT_DEFAULT)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="5" y="3.5" width="14" height="17" rx="2" />
      <path d="M9 3.5V3a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v.5" />
      <path d="M8.5 11h7M8.5 14.5h7M8.5 8h4" strokeLinecap="round" />
    </svg>
  );
}
export function AchievementsIcon({ className }: IconProps) {
  return (
    <svg className={base(className, STUDENT_DEFAULT)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" />
      <path d="M8 5H5a3 3 0 0 0 3 5M16 5h3a3 3 0 0 1-3 5" strokeLinecap="round" />
      <path d="M12 13v3M9 20h6M10 20l.5-2h3l.5 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function AdminIcon({ className }: IconProps) {
  return (
    <svg className={base(className, STUDENT_DEFAULT)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6l7-3Z" strokeLinejoin="round" />
    </svg>
  );
}
export function DiscoverIcon({ className }: IconProps) {
  return (
    <svg className={base(className, STUDENT_DEFAULT)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.3-4.3" strokeLinecap="round" />
    </svg>
  );
}
export function OpportunitiesIcon({ className }: IconProps) {
  return (
    <svg className={base(className, STUDENT_DEFAULT)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3.5" y="7.5" width="17" height="12" rx="2" />
      <path d="M8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5" />
      <path d="M3.5 12.5h17" />
    </svg>
  );
}
export function SettingsIcon({ className }: IconProps) {
  return (
    <svg className={base(className, STUDENT_DEFAULT)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 7h9M17.5 7H20M4 12h3.5M12 12h8M4 17h11M19.5 17H20" strokeLinecap="round" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9.5" cy="12" r="2" />
      <circle cx="17" cy="17" r="2" />
    </svg>
  );
}
export function FeedbackIcon({ className }: IconProps) {
  return (
    <svg className={base(className, STUDENT_DEFAULT)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M21 11.5a7.5 7.5 0 0 1-7.5 7.5H7l-4 3V11.5A7.5 7.5 0 0 1 10.5 4h3A7.5 7.5 0 0 1 21 11.5Z" strokeLinejoin="round" />
    </svg>
  );
}
export function MenuIcon({ className }: IconProps) {
  return (
    <svg className={base(className, "h-[22px] w-[22px]")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  );
}
export function CloseIcon({ className }: IconProps) {
  return (
    <svg className={base(className, "h-[22px] w-[22px]")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}
export function SpinnerIcon({ className }: IconProps) {
  return (
    <svg className={base(className, "animate-spin h-4 w-4 shrink-0")} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
// Admin-only icons (introduced with the admin sidebar in 90105e0).
export function HealthIcon({ className }: IconProps) {
  return (
    <svg className={base(className, ADMIN_DEFAULT)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 20s-7-4.6-9-9a5 5 0 0 1 9-3.2A5 5 0 0 1 21 11c-2 4.4-9 9-9 9Z" strokeLinejoin="round" />
      <path d="M4 12h4l2-3 3 6 2-3h5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function ScholarshipIcon({ className }: IconProps) {
  return (
    <svg className={base(className, ADMIN_DEFAULT)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 4 2 9l10 5 10-5-10-5Z" strokeLinejoin="round" />
      <path d="M6 11.5V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.5" strokeLinecap="round" />
      <path d="M22 9v6" strokeLinecap="round" />
    </svg>
  );
}
export function UsersIcon({ className }: IconProps) {
  return (
    <svg className={base(className, ADMIN_DEFAULT)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" strokeLinecap="round" />
      <circle cx="17" cy="9" r="2.8" />
      <path d="M16.5 14.6a5.2 5.2 0 0 1 5 5.4" strokeLinecap="round" />
    </svg>
  );
}
export function TestimonialsIcon({ className }: IconProps) {
  return (
    <svg className={base(className, ADMIN_DEFAULT)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M21 11.5a7.5 7.5 0 0 1-7.5 7.5H7l-4 3V11.5A7.5 7.5 0 0 1 10.5 4h3A7.5 7.5 0 0 1 21 11.5Z" strokeLinejoin="round" />
      <path d="M9 10.5h6M9 13.5h4" strokeLinecap="round" />
    </svg>
  );
}
