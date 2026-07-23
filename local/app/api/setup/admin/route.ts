import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { getLocalAdminSetupCredentialError, LOCAL_ADMIN_CREDENTIAL_MESSAGES } from "@local/lib/admin-credentials";
import { apiError, getStringField, readJsonBody } from "@local/lib/http";
import { prisma } from "@local/lib/prisma";
import { sessionCookieOptions, signSession, SESSION_COOKIE } from "@local/lib/session";
import { ADMIN_DEFAULT_QUOTA } from "@local/lib/user-quota";

export async function POST(request: Request) {
  const body = await readJsonBody(request);
  if (!body) return apiError(LOCAL_ADMIN_CREDENTIAL_MESSAGES.invalidJson, "BAD_REQUEST", 400);

  const existingCount = await prisma.localAdmin.count();
  if (existingCount > 0) {
    return apiError(LOCAL_ADMIN_CREDENTIAL_MESSAGES.adminExists, "CONFLICT", 409);
  }

  const username = getStringField(body, "username");
  const password = getStringField(body, "password");
  const passwordConfirm = getStringField(body, "passwordConfirm");
  const credentialError = getLocalAdminSetupCredentialError({ username, password, passwordConfirm });
  if (credentialError) {
    return apiError(credentialError, "BAD_REQUEST", 400);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await prisma.localAdmin.create({
    data: {
      username,
      passwordHash,
      lastLoginAt: new Date(),
      isAdmin: true,
      maxSubscriptions: ADMIN_DEFAULT_QUOTA.maxSubscriptions,
      maxNodesPerSubscription: ADMIN_DEFAULT_QUOTA.maxNodesPerSubscription,
      maxCustomTemplates: ADMIN_DEFAULT_QUOTA.maxCustomTemplates,
      maxImportSourcesPerType: ADMIN_DEFAULT_QUOTA.maxImportSourcesPerType,
      expiresAt: null,
    },
    select: { id: true, username: true },
  });

  const response = NextResponse.json({
    success: true,
    user: admin,
  });
  response.cookies.set(SESSION_COOKIE, await signSession({ adminId: admin.id, username: admin.username }), sessionCookieOptions());
  return response;
}
