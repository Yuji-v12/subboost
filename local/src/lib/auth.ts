import { prisma } from "./prisma";
import { readSession } from "./session";
import type { LocalUserQuotaFields } from "./user-quota";

export type CurrentAdmin = {
  id: string;
  username: string;
  isAdmin: boolean;
  maxSubscriptions: number;
  maxNodesPerSubscription: number;
  maxCustomTemplates: number;
  maxImportSourcesPerType: number;
  expiresAt: Date | null;
};

export type CurrentUser = CurrentAdmin;

export async function getCurrentAdmin(): Promise<CurrentAdmin | null> {
  const session = await readSession();
  if (!session) return null;
  const admin = await prisma.localAdmin.findUnique({
    where: { id: session.adminId },
    select: {
      id: true,
      username: true,
      isAdmin: true,
      maxSubscriptions: true,
      maxNodesPerSubscription: true,
      maxCustomTemplates: true,
      maxImportSourcesPerType: true,
      expiresAt: true,
    },
  });
  return admin;
}

export async function isSetupRequired(): Promise<boolean> {
  const count = await prisma.localAdmin.count();
  return count === 0;
}

export function asQuotaFields(user: CurrentAdmin): LocalUserQuotaFields {
  return {
    isAdmin: user.isAdmin,
    maxSubscriptions: user.maxSubscriptions,
    maxNodesPerSubscription: user.maxNodesPerSubscription,
    maxCustomTemplates: user.maxCustomTemplates,
    maxImportSourcesPerType: user.maxImportSourcesPerType,
    expiresAt: user.expiresAt,
  };
}
