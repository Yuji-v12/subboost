import { getCurrentAdmin, type CurrentAdmin } from "@local/lib/auth";
import { apiError } from "@local/lib/http";

type AdminResponseHandler = (admin: CurrentAdmin) => Response | Promise<Response>;

export function localAdminRequiredResponse(): Response {
  return apiError("Authentication required.", "UNAUTHORIZED", 401);
}

export function localAdminPrivilegeRequiredResponse(): Response {
  return apiError("Admin privilege required.", "FORBIDDEN", 403);
}

export async function getOptionalCurrentAdmin(): Promise<CurrentAdmin | null> {
  return getCurrentAdmin();
}

export async function withCurrentAdmin(handler: AdminResponseHandler): Promise<Response> {
  const admin = await getCurrentAdmin();
  if (!admin) return localAdminRequiredResponse();
  return handler(admin);
}

export async function withCurrentSiteAdmin(handler: AdminResponseHandler): Promise<Response> {
  const admin = await getCurrentAdmin();
  if (!admin) return localAdminRequiredResponse();
  if (!admin.isAdmin) return localAdminPrivilegeRequiredResponse();
  return handler(admin);
}
