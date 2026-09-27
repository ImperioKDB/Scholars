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
  author_name?: string | null;
  author_avatar_url?: string | null;
  author_role?: "founder" | "contributor" | "student" | null;
  author_is_online?: boolean;
  user_helpful: boolean;
};

export type ScholarshipPrompt = {
  id: string;
  scholarship_id: string;
  prompt_key: string;
  prompt_text: string;
  sort_order: number;
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
  prompts: ScholarshipPrompt[];
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

function normalizePrompts(value: unknown): ScholarshipPrompt[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => item as Partial<ScholarshipPrompt>)
    .filter(
      (item) =>
        typeof item.id === "string" &&
        typeof item.scholarship_id === "string" &&
        typeof item.prompt_text === "string",
    )
    .map((item) => ({
      id: item.id as string,
      scholarship_id: item.scholarship_id as string,
      prompt_key: String(item.prompt_key ?? "community-prompt"),
      prompt_text: String(item.prompt_text),
      sort_order: Number(item.sort_order ?? 0),
    }))
    .sort((a, b) => a.sort_order - b.sort_order);
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
  const promptsResult = await supabase
    .from("scholarship_prompts")
    .select("id, scholarship_id, prompt_key, prompt_text, sort_order")
    .eq("scholarship_id", scholarshipId)
    .order("sort_order", { ascending: true })
    .limit(3);

  if (discussionsResult.error) {
    console.error("scholarship_discussions_read_failed", discussionsResult.error);
  }
  if (proofResult.error) {
    console.error("scholarship_social_proof_read_failed", proofResult.error);
  }
  if (promptsResult.error) {
    console.error("scholarship_prompts_read_failed", promptsResult.error);
  }

  return {
    discussions: (discussionsResult.data ?? []) as ScholarshipDiscussion[],
    prompts: normalizePrompts(promptsResult.data),
    socialProof: normalizeSocialProof(proofResult.data),
  };
}
