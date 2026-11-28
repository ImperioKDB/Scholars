/**
 * Centralized external subrequest budget for Cloudflare Workers Free.
 *
 * Workers Free permits only 50 external subrequests per invocation. Every
 * Supabase query and every outbound provider fetch (Expo, web-push) counts
 * as one. This budget is enforced strictly BEFORE each external request is
 * made, so a run can never exceed the ceiling mid-flight.
 *
 * Usage:
 *   const budget = new SubrequestBudget(LIMIT)
 *   if (!budget.reserve(1)) return incomplete()   // before the request
 *   const { data, error } = await supabase.from(...)...   // the actual request
 *   // request counted once reserve() returned true
 *
 * A single "logical" operation (e.g. ensureNotificationDelivery) may issue
 * multiple external requests; call reserve() once per actual request.
 */
export class SubrequestBudget {
  private readonly limit: number
  private used = 0

  constructor(limit: number) {
    this.limit = limit
  }

  /** Number of subrequests still available in this invocation. */
  get remaining(): number {
    return Math.max(0, this.limit - this.used)
  }

  /** Whether the budget is fully exhausted. */
  get exhausted(): boolean {
    return this.used >= this.limit
  }

  /**
   * Reserve `count` external subrequests before making them.
   * Returns false if insufficient capacity remains; the caller must not
   * make the request and should report incomplete work instead.
   */
  reserve(count = 1): boolean {
    if (count <= 0) return true
    if (this.used + count > this.limit) return false
    this.used += count
    return true
  }

  /** Diagnostic snapshot for reporting. */
  snapshot(): { subrequestsUsed: number; subrequestBudget: number; budgetExhausted: boolean } {
    return {
      subrequestsUsed: this.used,
      subrequestBudget: this.limit,
      budgetExhausted: this.exhausted,
    }
  }
}
