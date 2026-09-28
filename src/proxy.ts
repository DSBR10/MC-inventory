import { withAuth } from "next-auth/middleware";

import { resolveSecret } from "@/lib/secrets/crypto";

export default withAuth({
  // El callback de NextAuth usa el secreto ya resuelto; el proxy debe usar
  // exactamente el mismo valor para validar las cookies JWT.
  secret: resolveSecret(process.env.NEXTAUTH_SECRET),
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    "/((?!login|api|_next|favicon.ico).*)",
  ],
};
