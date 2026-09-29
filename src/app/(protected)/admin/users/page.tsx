import { createAdminClient } from "@/lib/supabase/admin";
import { inviteUser } from "./actions";
import { RoleForm } from "@/components/admin/role-form";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { Profile } from "@/lib/supabase/types";

export default async function UsersAdminPage() {
  const admin = createAdminClient();
  const [{ data: authUsers }, { data: profiles }] = await Promise.all([
    admin.auth.admin.listUsers(),
    admin.from("profiles").select("*"),
  ]);

  const profileById = new Map((profiles as Profile[] | null)?.map((p) => [p.id, p]));

  return (
    <div className="space-y-4">
      <Card>
        <CardBody>
          <p className="mb-2 text-sm font-medium text-slate-700">Invite a new user</p>
          <form action={inviteUser} className="grid grid-cols-1 gap-2 sm:grid-cols-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div>
              <Label htmlFor="full_name">Full name</Label>
              <Input id="full_name" name="full_name" type="text" />
            </div>
            <div>
              <Label htmlFor="role">Role</Label>
              <Select id="role" name="role" defaultValue="office">
                <option value="office">Office</option>
                <option value="admin">Admin</option>
              </Select>
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full">
                Send invite
              </Button>
            </div>
          </form>
          <p className="mt-2 text-xs text-slate-500">
            They&apos;ll get an email to set a password and sign in.
          </p>
        </CardBody>
      </Card>

      <div className="space-y-2">
        {authUsers?.users.map((u) => {
          const profile = profileById.get(u.id);
          return (
            <Card key={u.id}>
              <CardBody className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {profile?.full_name ?? u.email}
                  </p>
                  <p className="text-xs text-slate-500">{u.email}</p>
                </div>
                <RoleForm userId={u.id} role={profile?.role ?? "office"} />
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
