import { withCurrentSiteAdmin } from "@local/lib/api-auth";
import { apiError, json, readJsonBody } from "@local/lib/http";
import { createManagedUser, listManagedUsers } from "@local/lib/user-admin-service";
import { LocalUserPolicyError } from "@local/lib/user-quota";

export async function GET() {
  return withCurrentSiteAdmin(async () => json({ users: await listManagedUsers() }));
}

export async function POST(request: Request) {
  return withCurrentSiteAdmin(async () => {
    const body = await readJsonBody(request);
    if (!body) return apiError("Invalid JSON body.", "BAD_REQUEST", 400);
    try {
      const user = await createManagedUser(body);
      return json({ user }, 201);
    } catch (error) {
      if (error instanceof LocalUserPolicyError) {
        return apiError(error.message, error.code, error.status);
      }
      return apiError(error instanceof Error ? error.message : "Unable to create user.", "BAD_REQUEST", 400);
    }
  });
}
