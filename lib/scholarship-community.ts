export type DiscussionCategory = "question" | "answer" | "experience" | "update";
export type DiscussionSort = "helpful" | "recent";

export type ScholarshipDiscussion = {
  id: string;
  scholarship_id: string;
  parent_id: string | null;
  category: DiscussionCategory;
  title: string | null;
  body: string;
  is_anonymous: boolean;
  is_pinned: boolean;
  is_verified_contributor: boolean;
  created_at: string;
  updated_at: string;
  helpful_count: number;
  reply_count: number;
  author_label: string;
  user_helpful: boolean;
};

export type ScholarshipSocialProof = {
  saved_count: number;
  applied_count: number;
  discussion_student_count: number;
  discussion_count: number;
  recent_view_count: number;
  recent_institutions: Array<{ name: string; count: number }>;
};

export type ScholarshipCommunity = {
  discussions: ScholarshipDiscussion[];
  socialProof: ScholarshipSocialProof;
};

export const EMPTY_SOCIAL_PROOF: ScholarshipSocialProof = {
  saved_count: 0,
  applied_count: 0,
  discussion_student_count: 0,
  discussion_count: 0,
  recent_view_count: 0,
  recent_institutions: [],
};

function normalizeSocialProof(value: unknown): ScholarshipSocialProof {
  const row = (Array.isArray(value) ? value[0] : value) as Partial<ScholarshipSocialProof> | null;
  const institutions = Array.isArray(row?.recent_institutions) ? row.recent_institutions : [];
  return {
    saved_count: Number(row?.saved_count ?? 0),
    applied_count: Number(row?.applied_count ?? 0),
    discussion_student_count: Number(row?.discussion_student_count ?? 0),
    discussion_count: Number(row?.discussion_count ?? 0),
    recent_view_count: Number(row?.recent_view_count ?? 0),
    recent_institutions: institutions
      .map((item) => {
        const entry = item as { name?: unknown; count?: unknown };
        return { name: String(entry.name ?? ""), count: Number(entry.count ?? 0) };
      })
      .filter((item) => item.name && item.count >= 5),
  };
}

export async function loadScholarshipCommunity(
  supabase: any,
  scholarshipId: string,
  sort: DiscussionSort = "helpful",
): Promise<ScholarshipCommunity> {
  const [discussionsResult, proofResult] = await Promise.all([
    supabase.rpc("get_scholarship_discussions", {
      p_scholarship_id: scholarshipId,
      p_sort: sort,
      p_limit: 100,
    }),
    supabase.rpc("get_scholarship_social_proof", { p_scholarship_id: scholarshipId }),
  ]);

  if (discussionsResult.error) {
    console.error("scholarship_discussions_read_failed", discussionsResult.error);
  }
  if (proofResult.error) {
    console.error("scholarship_social_proof_read_failed", proofResult.error);
  }

  return {
    discussions: (discussionsResult.data ?? []) as ScholarshipDiscussion[],
    socialProof: normalizeSocialProof(proofResult.data),
  };
}
