import { db } from "@/lib/db";
import { fail, handleError, ok, requireUser, writeAudit } from "@/lib/api";
import { tryGetIntegration } from "@/lib/integrations/registry";
import { getConnectionContext } from "@/lib/sync/connection-context";

/**
 * DELETE /api/connections/:id
 *
 * Revokes the token at the provider where that is supported, then deletes the
 * stored credential. Revocation is best effort: if the provider is unreachable
 * we still remove our copy, because leaving an encrypted token behind after the
 * user asked to disconnect would be the worse outcome.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const connection = await db.connection.findFirst({
    where: { id, orgId: auth.user.orgId },
  });
  if (!connection) return fail("That connection could not be found.", 404, "not_found");

  try {
    const integration = tryGetIntegration(connection.provider);
    if (integration) {
      try {
        const ctx = await getConnectionContext(connection);
        await integration.disconnect(ctx);
      } catch {
        // Already expired or unreachable — proceed with local removal.
      }
    }

    // Cascades remove the credential, checkpoints, syncs and their conflicts.
    await db.connection.delete({ where: { id: connection.id } });

    await writeAudit({
      orgId: auth.user.orgId,
      userId: auth.user.id,
      action: "connection.deleted",
      target: connection.id,
      metadata: { provider: connection.provider },
    });

    await db.syncEvent.create({
      data: {
        orgId: auth.user.orgId,
        level: "INFO",
        title: `${connection.displayName} disconnected`,
        detail: "Its stored credentials were deleted and any syncs using it were removed.",
      },
    });

    return ok({ deleted: true });
  } catch (error) {
    return handleError(error, `disconnect ${id}`);
  }
}
