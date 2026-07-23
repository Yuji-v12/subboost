"use client";

import * as React from "react";
import { CalendarClock, Plus, RefreshCw, Shield, Trash2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@subboost/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@subboost/ui/components/ui/card";
import { Input } from "@subboost/ui/components/ui/input";
import { Label } from "@subboost/ui/components/ui/label";
import { useUserStore } from "@subboost/ui/store/user-store";
import { readJsonResponse } from "@subboost/ui/product/client-response";

type ManagedUser = {
  id: string;
  username: string;
  isAdmin: boolean;
  maxSubscriptions: number;
  maxNodesPerSubscription: number;
  maxCustomTemplates: number;
  maxImportSourcesPerType: number;
  expiresAt: string | null;
  subscriptionCount: number;
  templateCount: number;
  isExpired: boolean;
  lastLoginAt: string | null;
};

type UserFormState = {
  username: string;
  password: string;
  maxSubscriptions: string;
  maxNodesPerSubscription: string;
  maxCustomTemplates: string;
  maxImportSourcesPerType: string;
  expiresAt: string;
};

const emptyForm: UserFormState = {
  username: "",
  password: "",
  maxSubscriptions: "1",
  maxNodesPerSubscription: "300",
  maxCustomTemplates: "0",
  maxImportSourcesPerType: "1",
  expiresAt: "",
};

function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalInputValue(value: string): string | null {
  if (!value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function formatExpiry(iso: string | null, isExpired: boolean): string {
  if (!iso) return "永不过期";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  const text = date.toLocaleString("zh-CN", { hour12: false });
  return isExpired ? `${text}（已到期）` : text;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const { user, fetchUser, isLoading } = useUserStore();
  const [users, setUsers] = React.useState<ManagedUser[]>([]);
  const [loadingUsers, setLoadingUsers] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<UserFormState>(emptyForm);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    void fetchUser();
  }, [fetchUser]);

  const loadUsers = React.useCallback(async () => {
    setLoadingUsers(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/users", { cache: "no-store" });
      const data = await readJsonResponse<{ users?: ManagedUser[]; error?: string }>(response, "加载用户失败");
      setUsers(Array.isArray(data.users) ? data.users : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载用户失败");
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  React.useEffect(() => {
    if (!isLoading && user && !user.isAdmin) {
      router.replace("/dashboard");
      return;
    }
    if (user?.isAdmin) {
      void loadUsers();
    }
  }, [isLoading, loadUsers, router, user]);

  const startEdit = (item: ManagedUser) => {
    setEditingId(item.id);
    setForm({
      username: item.username,
      password: "",
      maxSubscriptions: String(item.maxSubscriptions),
      maxNodesPerSubscription: String(item.maxNodesPerSubscription),
      maxCustomTemplates: String(item.maxCustomTemplates),
      maxImportSourcesPerType: String(item.maxImportSourcesPerType),
      expiresAt: toLocalInputValue(item.expiresAt),
    });
    setMessage(null);
    setError(null);
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload = {
        maxSubscriptions: Number(form.maxSubscriptions),
        maxNodesPerSubscription: Number(form.maxNodesPerSubscription),
        maxCustomTemplates: Number(form.maxCustomTemplates),
        maxImportSourcesPerType: Number(form.maxImportSourcesPerType),
        expiresAt: fromLocalInputValue(form.expiresAt),
        ...(form.password ? { password: form.password } : {}),
      };

      if (editingId) {
        const response = await fetch(`/api/admin/users/${encodeURIComponent(editingId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        await readJsonResponse(response, "更新用户失败");
        setMessage("用户已更新");
      } else {
        const response = await fetch("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: form.username.trim(),
            password: form.password,
            isAdmin: false,
            ...payload,
          }),
        });
        await readJsonResponse(response, "创建用户失败");
        setMessage("用户已创建");
      }
      resetForm();
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: ManagedUser) => {
    if (item.isAdmin) {
      setError("请先在编辑中取消管理员身份，或保留至少一个管理员。");
      return;
    }
    if (!window.confirm(`确认删除用户 ${item.username}？其订阅和模板会一并删除。`)) return;
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(item.id)}`, { method: "DELETE" });
      await readJsonResponse(response, "删除用户失败");
      setMessage(`已删除用户 ${item.username}`);
      if (editingId === item.id) resetForm();
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    }
  };

  if (isLoading || !user) {
    return <div className="container mx-auto px-4 py-10 text-white/60">加载中…</div>;
  }
  if (!user.isAdmin) {
    return <div className="container mx-auto px-4 py-10 text-white/60">无权限访问管理页面</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="mb-1 text-2xl font-bold">管理页面</h1>
          <p className="text-white/50">创建普通用户，并设置订阅/节点/模板/导入源配额与到期时间</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => void loadUsers()} disabled={loadingUsers}>
          <RefreshCw className={`h-4 w-4 ${loadingUsers ? "animate-spin" : ""}`} />
          刷新列表
        </Button>
      </div>

      {(error || message) && (
        <div
          className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
            error ? "border-rose-400/30 bg-rose-500/10 text-rose-100" : "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
          }`}
        >
          {error || message}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <Card>
          <CardHeader className="flex flex-row items-center gap-3 space-y-0">
            <div className="rounded-lg bg-indigo-500/20 p-2 text-indigo-300">
              {editingId ? <Shield className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
            </div>
            <CardTitle className="text-base">{editingId ? "编辑用户配额" : "新增普通用户"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
              <div className="space-y-2">
                <Label htmlFor="username">用户名</Label>
                <Input
                  id="username"
                  value={form.username}
                  onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
                  disabled={Boolean(editingId)}
                  required={!editingId}
                  placeholder="例如 user01"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{editingId ? "重置密码（可选）" : "密码"}</Label>
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                  required={!editingId}
                  placeholder={editingId ? "留空则不修改" : "至少 8 位"}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="maxSubscriptions">订阅配额</Label>
                  <Input
                    id="maxSubscriptions"
                    type="number"
                    min={0}
                    value={form.maxSubscriptions}
                    onChange={(e) => setForm((prev) => ({ ...prev, maxSubscriptions: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxNodesPerSubscription">节点上限/订阅</Label>
                  <Input
                    id="maxNodesPerSubscription"
                    type="number"
                    min={0}
                    value={form.maxNodesPerSubscription}
                    onChange={(e) => setForm((prev) => ({ ...prev, maxNodesPerSubscription: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxCustomTemplates">模板配额</Label>
                  <Input
                    id="maxCustomTemplates"
                    type="number"
                    min={0}
                    value={form.maxCustomTemplates}
                    onChange={(e) => setForm((prev) => ({ ...prev, maxCustomTemplates: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxImportSourcesPerType">导入源/每种</Label>
                  <Input
                    id="maxImportSourcesPerType"
                    type="number"
                    min={0}
                    value={form.maxImportSourcesPerType}
                    onChange={(e) => setForm((prev) => ({ ...prev, maxImportSourcesPerType: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiresAt">到期时间</Label>
                <Input
                  id="expiresAt"
                  type="datetime-local"
                  value={form.expiresAt}
                  onChange={(e) => setForm((prev) => ({ ...prev, expiresAt: e.target.value }))}
                />
                <p className="text-xs text-white/40">留空表示永不过期。到期后不可编辑订阅，YAML 仅保留「已到期」节点。</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" className="gap-2" disabled={saving}>
                  <Plus className="h-4 w-4" />
                  {saving ? "保存中…" : editingId ? "保存修改" : "创建用户"}
                </Button>
                {editingId && (
                  <Button type="button" variant="outline" onClick={resetForm}>
                    取消编辑
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">用户列表</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingUsers && <p className="text-sm text-white/50">加载用户中…</p>}
            {!loadingUsers && users.length === 0 && <p className="text-sm text-white/50">暂无用户</p>}
            {users.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{item.username}</p>
                      {item.isAdmin && (
                        <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs text-indigo-200">管理员</span>
                      )}
                      {item.isExpired && (
                        <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-xs text-rose-200">已到期</span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-white/50">
                      订阅 {item.subscriptionCount}/{item.maxSubscriptions} · 节点上限 {item.maxNodesPerSubscription}/订阅 · 模板{" "}
                      {item.templateCount}/{item.maxCustomTemplates} · 导入源 {item.maxImportSourcesPerType}/每种
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-sm text-white/50">
                      <CalendarClock className="h-3.5 w-3.5" />
                      到期：{formatExpiry(item.expiresAt, item.isExpired)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {!item.isAdmin && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => startEdit(item)}>
                          编辑
                        </Button>
                        <Button size="sm" variant="destructive" className="gap-1" onClick={() => void handleDelete(item)}>
                          <Trash2 className="h-3.5 w-3.5" />
                          删除
                        </Button>
                      </>
                    )}
                    {item.isAdmin && (
                      <Button size="sm" variant="outline" onClick={() => startEdit(item)}>
                        编辑配额
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
