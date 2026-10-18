import { requireAdmin } from "@/lib/admin/access";
import { SchemaCheckBanner } from "@/components/admin/SchemaCheckBanner";
import { AdminShell } from "@/components/admin/AdminShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { fullName } = await requireAdmin();
  return (
    <AdminShell fullName={fullName}>
      <SchemaCheckBanner />
      {children}
    </AdminShell>
  );
}
