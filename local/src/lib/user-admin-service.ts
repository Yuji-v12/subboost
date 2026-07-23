import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import {
  ADMIN_DEFAULT_QUOTA,
  REGULAR_USER_DEFAULT_QUOTA,
  type LocalUserQuotaFields,
} from "./user-quota";

const PASSWORD_MIN_LENGTH = 8;

export type ManagedUserSummary = {
  id: string;
  username: string;
  isAdmin: boolean;
  maxSubscriptions: number;
  maxNodesPerSubscription: number;
  maxCustomTemplates: number;
  maxImportSourcesPerType: number;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  subscriptionCount: number;
  templateCount: number;
  isExpired: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asOptionalDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") throw new Error("到期时间格式无效。");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("到期时间格式无效。");
  return date;
}

function asNonNegativeInt(value: unknown, field: string, fallback?: number): number {
  if (value === undefined || value === null || value === "") {
    if (typeof fallback === "number") return fallback;
    throw new Error(`${field} 为必填项。`);
  }
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num) || !Number.isInteger(num) || num < 0) {
    throw new Error(`${field} 必须是大于等于 0 的整数。`);
  }
  return num;
}

function formatUser(row: {
  id: string;
  username: string;
  isAdmin: boolean;
  maxSubscriptions: number;
  maxNodesPerSubscription: number;
  maxCustomTemplates: number;
  maxImportSourcesPerType: number;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
  _count: { subscriptions: number; templates: number };
}): ManagedUserSummary {
  const isExpired = !row.isAdmin && Boolean(row.expiresAt && row.expiresAt.getTime() <= Date.now());
  return {
    id: row.id,
    username: row.username,
    isAdmin: row.isAdmin,
    maxSubscriptions: row.maxSubscriptions,
    maxNodesPerSubscription: row.maxNodesPerSubscription,
    maxCustomTemplates: row.maxCustomTemplates,
    maxImportSourcesPerType: row.maxImportSourcesPerType,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
    subscriptionCount: row._count.subscriptions,
    templateCount: row._count.templates,
    isExpired,
  };
}

export async function listManagedUsers(): Promise<ManagedUserSummary[]> {
  const rows = await prisma.localAdmin.findMany({
    orderBy: [{ isAdmin: "desc" }, { createdAt: "asc" }],
    include: { _count: { select: { subscriptions: true, templates: true } } },
  });
  return rows.map(formatUser);
}

export async function createManagedUser(body: unknown): Promise<ManagedUserSummary> {
  if (!isRecord(body)) throw new Error("请求体无效。");
  const username = asString(body.username);
  if (!username) throw new Error("请输入用户名。");
  if (username.length > 64) throw new Error("用户名过长。");

  const password = asString(body.password);
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new Error(`密码至少需要 ${PASSWORD_MIN_LENGTH} 个字符。`);
  }

  const existing = await prisma.localAdmin.findUnique({ where: { username }, select: { id: true } });
  if (existing) throw new Error("用户名已存在。");

  const isAdmin = body.isAdmin === true;
  const quotaDefaults = isAdmin ? ADMIN_DEFAULT_QUOTA : REGULAR_USER_DEFAULT_QUOTA;
  const expiresAt = isAdmin ? null : (asOptionalDate(body.expiresAt) ?? null);

  const created = await prisma.localAdmin.create({
    data: {
      username,
      passwordHash: await bcrypt.hash(password, 12),
      isAdmin,
      maxSubscriptions: asNonNegativeInt(body.maxSubscriptions, "订阅配额", quotaDefaults.maxSubscriptions),
      maxNodesPerSubscription: asNonNegativeInt(
        body.maxNodesPerSubscription,
        "节点上限配额",
        quotaDefaults.maxNodesPerSubscription
      ),
      maxCustomTemplates: asNonNegativeInt(body.maxCustomTemplates, "模板配额", quotaDefaults.maxCustomTemplates),
      maxImportSourcesPerType: asNonNegativeInt(
        body.maxImportSourcesPerType,
        "导入源配额",
        quotaDefaults.maxImportSourcesPerType
      ),
      expiresAt,
    },
    include: { _count: { select: { subscriptions: true, templates: true } } },
  });
  return formatUser(created);
}

export async function updateManagedUser(id: string, body: unknown): Promise<ManagedUserSummary | null> {
  if (!isRecord(body)) throw new Error("请求体无效。");
  const current = await prisma.localAdmin.findUnique({
    where: { id },
    include: { _count: { select: { subscriptions: true, templates: true } } },
  });
  if (!current) return null;

  const data: {
    isAdmin?: boolean;
    maxSubscriptions?: number;
    maxNodesPerSubscription?: number;
    maxCustomTemplates?: number;
    maxImportSourcesPerType?: number;
    expiresAt?: Date | null;
    passwordHash?: string;
  } = {};

  if ("isAdmin" in body) {
    data.isAdmin = body.isAdmin === true;
  }

  if ("maxSubscriptions" in body) {
    data.maxSubscriptions = asNonNegativeInt(body.maxSubscriptions, "订阅配额");
  }
  if ("maxNodesPerSubscription" in body) {
    data.maxNodesPerSubscription = asNonNegativeInt(body.maxNodesPerSubscription, "节点上限配额");
  }
  if ("maxCustomTemplates" in body) {
    data.maxCustomTemplates = asNonNegativeInt(body.maxCustomTemplates, "模板配额");
  }
  if ("maxImportSourcesPerType" in body) {
    data.maxImportSourcesPerType = asNonNegativeInt(body.maxImportSourcesPerType, "导入源配额");
  }
  if ("expiresAt" in body) {
    const nextExpires = asOptionalDate(body.expiresAt);
    if (nextExpires === undefined) throw new Error("到期时间格式无效。");
    data.expiresAt = nextExpires;
  }

  if ("password" in body) {
    const password = asString(body.password);
    if (password) {
      if (password.length < PASSWORD_MIN_LENGTH) {
        throw new Error(`密码至少需要 ${PASSWORD_MIN_LENGTH} 个字符。`);
      }
      data.passwordHash = await bcrypt.hash(password, 12);
    }
  }

  // Prevent demoting the last admin
  const nextIsAdmin = data.isAdmin ?? current.isAdmin;
  if (current.isAdmin && !nextIsAdmin) {
    const adminCount = await prisma.localAdmin.count({ where: { isAdmin: true } });
    if (adminCount <= 1) throw new Error("不能取消最后一个管理员。");
  }
  if (nextIsAdmin) {
    data.expiresAt = null;
  }

  const updated = await prisma.localAdmin.update({
    where: { id },
    data,
    include: { _count: { select: { subscriptions: true, templates: true } } },
  });
  return formatUser(updated);
}

export async function deleteManagedUser(id: string, actorId: string): Promise<boolean> {
  if (id === actorId) throw new Error("不能删除当前登录账号。");
  const target = await prisma.localAdmin.findUnique({ where: { id }, select: { id: true, isAdmin: true } });
  if (!target) return false;
  if (target.isAdmin) {
    const adminCount = await prisma.localAdmin.count({ where: { isAdmin: true } });
    if (adminCount <= 1) throw new Error("不能删除最后一个管理员。");
  }
  await prisma.localAdmin.delete({ where: { id } });
  return true;
}

export async function getUserQuotaContext(userId: string): Promise<LocalUserQuotaFields | null> {
  return prisma.localAdmin.findUnique({
    where: { id: userId },
    select: {
      isAdmin: true,
      maxSubscriptions: true,
      maxNodesPerSubscription: true,
      maxCustomTemplates: true,
      maxImportSourcesPerType: true,
      expiresAt: true,
    },
  });
}
