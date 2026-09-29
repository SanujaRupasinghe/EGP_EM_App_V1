"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Role } from "@/lib/supabase/types";

async function assertAdmin() {
  const session = await getCurrentProfile();
  if (!session || session.profile?.role !== "admin") {
    throw new Error("Not authorized");
  }
}

export async function inviteUser(formData: FormData) {
  await assertAdmin();
  const email = String(formData.get("email") ?? "").trim();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const role = (String(formData.get("role") ?? "office") as Role) || "office";
  if (!email) throw new Error("Email is required");

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName || email },
  });
  if (error) throw new Error(error.message);

  const userId = data.user?.id;
  if (userId) {
    await admin
      .from("profiles")
      .upsert({ id: userId, full_name: fullName || email, role }, { onConflict: "id" });
  }

  revalidatePath("/admin/users");
}

export async function updateUserRole(userId: string, role: Role) {
  await assertAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ role }).eq("id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/users");
}
