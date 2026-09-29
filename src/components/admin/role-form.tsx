"use client";

import { useTransition } from "react";
import { updateUserRole } from "@/app/(protected)/admin/users/actions";
import type { Role } from "@/lib/supabase/types";
import { Select } from "@/components/ui/select";

export function RoleForm({ userId, role }: { userId: string; role: Role }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Select
      className="h-9 w-32"
      defaultValue={role}
      disabled={isPending}
      onChange={(e) => {
        const next = e.target.value as Role;
        startTransition(() => updateUserRole(userId, next));
      }}
    >
      <option value="office">Office</option>
      <option value="admin">Admin</option>
    </Select>
  );
}
