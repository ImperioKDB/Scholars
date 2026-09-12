import { ActiveUsersTable } from "@/components/admin/ActiveUsersTable";

export default function ActiveUsersPage() {
  return (
    <div className="min-h-screen bg-parchment">
      <main id="main" className="md:pl-60">
        <div className="mx-auto max-w-7xl px-6 pt-20 pb-24 md:pt-10 md:pb-10">
          <div className="mb-8">
            <h1 className="text-2xl font-display font-bold text-navy mb-2">Active Users</h1>
            <p className="text-sm text-navy-light">Monitor real-time activity of registered users</p>
          </div>
          
          <ActiveUsersTable />
        </div>
      </main>
    </div>
  );
}