import { requireAuth } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { publicUser } from "@/lib/mappers/user";
import { json, route } from "@/lib/server/response";
import { saveImageUpload } from "@/lib/server/uploads";

export const POST = route(async request => {
  const user = await requireAuth(request);
  const form = await request.formData();
  const avatarUrl = await saveImageUpload(form.get("avatar"));
  const { rows } = await query(
    "update users set avatar_url = $2, updated_at = now() where id = $1 returning *",
    [user.id, avatarUrl],
  );

  return json({ user: publicUser(rows[0]) });
});
