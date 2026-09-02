import { z } from "zod";
import { db } from "@/lib/db";
import { fail, handleError, ok, parseBody, requireUser, writeAudit } from "@/lib/api";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  enabled: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await parseBody(request, patchSchema);
  if (!body.ok) return body.response;

  const rule = await db.rule.findFirst({ where: { id, orgId: auth.user.orgId } });
  if (!rule) return fail("That rule could not be found.", 404, "not_found");

  try {
    await db.rule.update({ where: { id }, data: body.data });
    await writeAudit({
      orgId: auth.user.orgId,
      userId: auth.user.id,
      action: "rule.updated",
      target: id,
      metadata: body.data,
    });
    return ok({ updated: true });
  } catch (error) {
    return handleError(error, `update rule ${id}`);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const rule = await db.rule.findFirst({ where: { id, orgId: auth.user.orgId } });
  if (!rule) return fail("That rule could not be found.", 404, "not_found");

  try {
    await db.rule.delete({ where: { id } });
    await writeAudit({
      orgId: auth.user.orgId,
      userId: auth.user.id,
      action: "rule.deleted",
      target: id,
      metadata: { name: rule.name },
    });
    return ok({ deleted: true });
  } catch (error) {
    return handleError(error, `delete rule ${id}`);
  }
}
