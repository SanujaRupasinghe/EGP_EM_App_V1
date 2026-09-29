import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server Components can't write cookies (Next.js throws), so session-refresh
// cookie writes there are swallowed — proxy.ts is what actually keeps the
// session cookie fresh on every request.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // called from a Server Component; proxy.ts handles session refresh
          }
        },
      },
    },
  );
}
