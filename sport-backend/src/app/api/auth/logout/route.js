import { clearSessionCookie } from "@/lib/server/auth";
import { noContent, route } from "@/lib/server/response";

export const POST = route(async () => {
  const response = noContent();
  clearSessionCookie(response);
  return response;
});
