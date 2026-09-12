import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/guard";

export async function GET() {
  try {
    const { userId } = await requireAdmin();
    const supabase = createClient();
    
    // Get active users (last seen in last 15 minutes = active)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        email,
        created_at,
        last_seen,
        profile_completeness
      `)
      .order('last_seen', { nullsFirst: false, ascending: false });
    
    if (error) {
      console.error('Error fetching active users:', error);
      return Response.json({ error: error.message }, { status: 500 });
    }
    
    // Process data to include active status
    const usersWithStatus = data.map(user => ({
      ...user,
      isActive: user.last_seen ? new Date(user.last_seen) > new Date(fifteenMinutesAgo) : false
    }));
    
    return Response.json({ users: usersWithStatus });
  } catch (error) {
    console.error('Admin active users API error:', error);
    return Response.json({ 
      error: 'Failed to fetch active users. Please try again later.' 
    }, { status: 500 });
  }
}