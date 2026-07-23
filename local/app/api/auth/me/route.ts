import { asQuotaFields, getCurrentAdmin, isSetupRequired } from "@local/lib/auth";
import { json } from "@local/lib/http";
import { prisma } from "@local/lib/prisma";
import { isUserExpired, quotaFromUser } from "@local/lib/user-quota";

export async function GET() {
  const [setupRequired, admin] = await Promise.all([isSetupRequired(), getCurrentAdmin()]);
  const [subscriptionCount, templateCount] = admin
    ? await Promise.all([
        prisma.subscription.count({ where: { ownerId: admin.id } }),
        prisma.localTemplate.count({ where: { ownerId: admin.id } }),
      ])
    : [0, 0];
  const now = new Date();
  const expired = admin ? isUserExpired(admin, now) : false;
  return json({
    setupRequired,
    authenticated: Boolean(admin),
    user: admin
      ? {
          id: admin.id,
          username: admin.username,
          name: admin.username,
          avatarUrl: null,
          trustLevel: admin.isAdmin ? 4 : 1,
          aiAssistantEnabled: false,
          isAdmin: admin.isAdmin,
          isBanned: false,
          active: true,
          silenced: expired,
          saveRequirementSatisfied: true,
          saveRequirementSatisfiedAt: now.toISOString(),
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
          accounts: [],
          quota: quotaFromUser(asQuotaFields(admin)),
          subscriptionCount,
          templateCount,
          expiresAt: admin.expiresAt ? admin.expiresAt.toISOString() : null,
          isExpired: expired,
        }
      : null,
  });
}
