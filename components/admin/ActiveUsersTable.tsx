'use client';

import { useState, useEffect } from "react";
import { Avatar } from "@/components/Avatar";  // CORRECTED PATH - matches your project structure

interface ActiveUser {
  id: string;
  full_name: string | null;
  email: string | null;
  created_at: string;
  last_seen: string | null;
  profile_completeness: number;
  isActive: boolean;
}

// Simple implementation to replace date-fns dependency
const formatDistanceToNow = (timestamp: string | null) => {
  if (!timestamp) return "Never";
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return "Just now";
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  } catch {
    return "Invalid date";
  }
};

export function ActiveUsersTable() {
  const [users, setUsers] = useState<ActiveUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/active-users");
      if (!res.ok) throw new Error("Failed to fetch active users");
      
      const { users } = await res.json();
      setUsers(users);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    
    // Set up real-time updates every 30 seconds
    const interval = setInterval(() => {
      setRefreshing(true);
      fetchUsers();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const formatEmail = (email: string | null) => {
    if (!email) return "No email";
    return email.length > 25 ? `${email.substring(0, 22)}...` : email;
  };

  if (error) {
    return (
      <div className="bg-red-light border border-red p-4 rounded-lg">
        <p className="text-red">Error: {error}</p>
        <button 
          onClick={fetchUsers}
          className="mt-2 text-sm text-navy hover:text-navy-light"
        >
          Try again
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-hairline p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-display text-lg font-semibold text-navy">Active Users</h2>
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-navy border-t-transparent" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-hairline">
                <th className="text-left py-3 px-4">User</th>
                <th className="text-left py-3 px-4">Status</th>
                <th className="text-left py-3 px-4">Last Seen</th>
                <th className="text-left py-3 px-4">Profile</th>
              </tr>
            </thead>
            <tbody>
              {[...Array(8)].map((_, i) => (
                <tr key={i} className="border-b border-hairline last:border-0">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-200" />
                      <div>
                        <div className="h-4 w-24 bg-gray-200 rounded mb-1" />
                        <div className="h-3 w-32 bg-gray-200 rounded" />
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="h-4 w-16 bg-gray-200 rounded" />
                  </td>
                  <td className="py-3 px-4">
                    <div className="h-4 w-20 bg-gray-200 rounded" />
                  </td>
                  <td className="py-3 px-4">
                    <div className="h-2 w-24 bg-gray-200 rounded" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-hairline p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-display text-lg font-semibold text-navy">Active Users</h2>
        <button
          onClick={() => {
            setRefreshing(true);
            fetchUsers();
          }}
          disabled={refreshing}
          className="text-sm text-navy-light hover:text-navy flex items-center gap-2"
        >
          {refreshing ? (
            <span className="animate-spin rounded-full h-4 w-4 border-2 border-navy border-t-transparent" />
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2A8.001 8.001 0 0020.418 9m0 0h-5m-6 6h.008v.009h-.008v-.009zm1 0h.008v.009h-.008v-.009zm-1 0h.008v.009h-.008v-.009zm-1 0h.008v.009h-.008v-.009zm-1 0h.008v.009h-.008v-.009z" />
            </svg>
          )}
          Refresh
        </button>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-hairline">
              <th className="text-left py-3 px-4">User</th>
              <th className="text-left py-3 px-4">Status</th>
              <th className="text-left py-3 px-4">Last Seen</th>
              <th className="text-left py-3 px-4">Profile</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className="border-b border-hairline last:border-0 hover:bg-gray-50 transition-colors">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <Avatar 
                      userId={user.id} 
                      fullName={user.full_name} 
                      size="medium"
                      className="flex-shrink-0"
                    />
                    <div>
                      <p className="font-medium text-navy">{user.full_name || "Unnamed User"}</p>
                      <p className="text-xs text-navy-light">{formatEmail(user.email)}</p>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${user.isActive ? "bg-emerald-light text-emerald" : "bg-amber-light text-amber"}`}>
                    {user.isActive ? (
                      <>
                        <span className="w-2 h-2 bg-emerald rounded-full mr-1.5" />
                        Active
                      </>
                    ) : (
                      <>
                        <span className="w-2 h-2 bg-amber rounded-full mr-1.5" />
                        Inactive
                      </>
                    )}
                  </span>
                </td>
                <td className="py-3 px-4 text-navy-light">
                  {formatDistanceToNow(user.last_seen)}
                </td>
                <td className="py-3 px-4">
                  <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-navy transition-all duration-300"
                      style={{ width: `${user.profile_completeness}%` }}
                    />
                  </div>
                  <span className="text-xs text-navy-light mt-1 block">
                    {user.profile_completeness}% complete
                  </span>
                </td>
              </tr>
            ))}
            
            {users.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-navy-light">
                  No users found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      <div className="mt-4 flex justify-between items-center text-sm text-navy-light">
        <p>{users.length} users total</p>
        <p>Active users shown in real-time (updated every 30 seconds)</p>
      </div>
    </div>
  );
}