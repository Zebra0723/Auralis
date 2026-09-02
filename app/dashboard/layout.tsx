import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ToastProvider } from "@/components/ui";
import { DashboardChrome } from "./chrome";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/signin");

  // Counts drive the navigation badges, so a problem is visible from any page
  // rather than only on the one that lists it.
  const [openConflicts, brokenConnections] = await Promise.all([
    db.conflict.count({ where: { orgId: session.orgId, status: "OPEN" } }),
    db.connection.count({
      where: { orgId: session.orgId, status: { in: ["NEEDS_REAUTH", "ERROR"] } },
    }),
  ]);

  return (
    <ToastProvider>
      <DashboardChrome
        user={{ name: session.name, email: session.email, orgName: session.orgName }}
        badges={{ conflicts: openConflicts, connections: brokenConnections }}
      >
        {children}
      </DashboardChrome>
    </ToastProvider>
  );
}
