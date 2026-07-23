import { withCurrentSiteAdmin } from "@local/lib/api-auth";
import { apiError, json, readJsonBody } from "@local/lib/http";
import { deleteManagedUser, updateManagedUser } from "@local/lib/user-admin-service";
import { LocalUserPolicyError } from "@local/lib/user-quota";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;
  return withCurrentSiteAdmin(async () => {
    const body = await readJsonBody(request);
    if (!body) return apiError("Invalid JSON body.", "BAD_REQUEST", 400);
    try {
      const user = await updateManagedUser(id, body);
      if (!user) return apiError("User not found.", "NOT_FOUND", 404);
      return json({ user });
    } catch (error) {
      if (error instanceof LocalUserPolicyError) {
        return apiError(error.message, error.code, error.status);
      }
      return apiError(error instanceof Error ? error.message : "Unable to update user.", "BAD_REQUEST", 400);
    }
  });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  return withCurrentSiteAdmin(async (admin) => {
    try {
      const deleted = await deleteManagedUser(id, admin.id);
      if (!deleted) return apiError("User not found.", "NOT_FOUND", 404);
      return json({ success: true });
    } catch (error) {
      if (error instanceof LocalUserPolicyError) {
        return apiError(error.message, error.code, error.status);
      }
      return apiError(error instanceof Error ? error.message : "Unable to delete user.", "BAD_REQUEST", 400);
    }
  });
}
