import type { ParsedNode } from "@subboost/core/types/node";
import type { UserQuota } from "@subboost/ui/store/user-store";

export const ADMIN_DEFAULT_QUOTA: UserQuota = {
  maxSubscriptions: 9999,
  maxNodesPerSubscription: 10000,
  maxCustomTemplates: 9999,
  maxImportSourcesPerType: 9999,
  canUseSubscriptionLink: true,
};

export const REGULAR_USER_DEFAULT_QUOTA: UserQuota = {
  maxSubscriptions: 1,
  maxNodesPerSubscription: 300,
  maxCustomTemplates: 0,
  maxImportSourcesPerType: 1,
  canUseSubscriptionLink: true,
};

export const EXPIRED_NODE_NAME = "已到期";

export type LocalUserQuotaFields = {
  isAdmin: boolean;
  maxSubscriptions: number;
  maxNodesPerSubscription: number;
  maxCustomTemplates: number;
  maxImportSourcesPerType: number;
  expiresAt: Date | null;
};

export function quotaFromUser(user: LocalUserQuotaFields): UserQuota {
  if (user.isAdmin) {
    return { ...ADMIN_DEFAULT_QUOTA };
  }
  return {
    maxSubscriptions: user.maxSubscriptions,
    maxNodesPerSubscription: user.maxNodesPerSubscription,
    maxCustomTemplates: user.maxCustomTemplates,
    maxImportSourcesPerType: user.maxImportSourcesPerType,
    canUseSubscriptionLink: true,
  };
}

export function isUserExpired(user: Pick<LocalUserQuotaFields, "isAdmin" | "expiresAt">, now = new Date()): boolean {
  if (user.isAdmin) return false;
  if (!user.expiresAt) return false;
  return user.expiresAt.getTime() <= now.getTime();
}

export function buildExpiredPlaceholderNode(): ParsedNode {
  return {
    name: EXPIRED_NODE_NAME,
    type: "socks5",
    server: "127.0.0.1",
    port: 1,
  };
}

export function buildExpiredClashYaml(): string {
  return [
    "proxies:",
    `  - name: ${EXPIRED_NODE_NAME}`,
    "    type: socks5",
    "    server: 127.0.0.1",
    "    port: 1",
    "proxy-groups:",
    "  - name: PROXY",
    "    type: select",
    "    proxies:",
    `      - ${EXPIRED_NODE_NAME}`,
    "rules:",
    "  - MATCH,PROXY",
    "",
  ].join("\n");
}

export class LocalUserPolicyError extends Error {
  code: "FORBIDDEN";
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.name = "LocalUserPolicyError";
    this.code = "FORBIDDEN";
    this.status = status;
  }
}

export function assertUserCanWriteSubscriptions(user: Pick<LocalUserQuotaFields, "isAdmin" | "expiresAt">): void {
  if (isUserExpired(user)) {
    throw new LocalUserPolicyError("账号已到期，无法编辑订阅。", 403);
  }
}

export function assertUserCanWriteTemplates(user: Pick<LocalUserQuotaFields, "isAdmin" | "expiresAt">): void {
  if (isUserExpired(user)) {
    throw new LocalUserPolicyError("账号已到期，无法编辑模板。", 403);
  }
}

export function assertWithinSubscriptionQuota(user: LocalUserQuotaFields, currentCount: number): void {
  const quota = quotaFromUser(user);
  if (currentCount >= quota.maxSubscriptions) {
    throw new LocalUserPolicyError(`订阅配额已用尽（${currentCount}/${quota.maxSubscriptions}）。`, 403);
  }
}

export function assertWithinNodeQuota(user: LocalUserQuotaFields, nodeCount: number): void {
  const quota = quotaFromUser(user);
  if (nodeCount > quota.maxNodesPerSubscription) {
    throw new LocalUserPolicyError(`节点数量超过上限（${nodeCount}/${quota.maxNodesPerSubscription}）。`, 403);
  }
}

export function assertWithinTemplateQuota(user: LocalUserQuotaFields, currentCount: number): void {
  const quota = quotaFromUser(user);
  if (currentCount >= quota.maxCustomTemplates) {
    throw new LocalUserPolicyError(`模板配额已用尽（${currentCount}/${quota.maxCustomTemplates}）。`, 403);
  }
}

export function countImportSourcesByType(config: Record<string, unknown>): Record<string, number> {
  const sources = Array.isArray(config.sources) ? config.sources : [];
  const counts: Record<string, number> = {};
  for (const source of sources) {
    if (!source || typeof source !== "object" || Array.isArray(source)) continue;
    const type = typeof (source as { type?: unknown }).type === "string" ? String((source as { type: string }).type) : "unknown";
    counts[type] = (counts[type] || 0) + 1;
  }
  return counts;
}

export function assertWithinImportSourceQuota(user: LocalUserQuotaFields, config: Record<string, unknown>): void {
  const quota = quotaFromUser(user);
  if (user.isAdmin || quota.maxImportSourcesPerType >= 9999) return;
  const counts = countImportSourcesByType(config);
  for (const [type, count] of Object.entries(counts)) {
    if (count > quota.maxImportSourcesPerType) {
      throw new LocalUserPolicyError(`导入源配额超限：类型 ${type} 为 ${count}/${quota.maxImportSourcesPerType}。`, 403);
    }
  }
}
