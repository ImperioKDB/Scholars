export type DeadlineStage = 'seven_days' | 'three_days' | 'last_24h' | 'day_of' | 'passed'

export type DeadlineListing = {
  scholarship_id: string | null
  opportunity_id: string | null
  title: string
  deadline_date: string
  deadline_stage: DeadlineStage
  application_status: 'in_progress' | null
}

// Modern WAT is UTC+01:00. A date-only deadline includes the entire day.
export function deadlineClosesAt(date: string): number {
  return Date.parse(`${date}T00:00:00+01:00`) + 86_400_000
}

export function deadlineListingPath(listing: Pick<DeadlineListing, 'scholarship_id' | 'opportunity_id'>) {
  return listing.scholarship_id
    ? `/scholarships/${listing.scholarship_id}`
    : `/opportunities/${listing.opportunity_id}`
}

export function deadlineMessage(stage: string, title: string) {
  switch (stage) {
    case 'seven_days':
    case 'three_days': return `The application deadline for ${title} is approaching.`
    case 'last_24h': return `Less than 24 hours left to apply for ${title}.`
    case 'day_of': return `${title} closes tonight (Nigeria time).`
    case 'passed': return `The application deadline for ${title} has passed.`
    default: return null
  }
}
