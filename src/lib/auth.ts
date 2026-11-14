import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/db";
import { recordActivity } from "@/lib/audit";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "Admin credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          const email = String(credentials?.email ?? "")
            .trim()
            .toLowerCase();
          const password = String(credentials?.password ?? "");
          if (!email || !password) return null;
          
          const admin = await prisma.admin.findUnique({ where: { email } });
          if (!admin || admin.status !== "ACTIVE") {
            if (admin) {
              await prisma.loginEvent.create({
                data: {
                  tenant: admin.tenant,
                  actorType: "ADMIN",
                  actorId: admin.id,
                  email,
                  success: false,
                  method: "PASSWORD",
                },
              });
              await recordActivity(prisma, {
                event: "ADMIN_LOGIN_FAILED",
                actor: { type: "ADMIN", id: admin.id, email: admin.email, role: admin.role, tenant: admin.tenant },
                targetType: "ADMIN",
                targetId: admin.id,
                result: "FAILURE",
              });
            }
            return null;
          }
          
          const valid = await compare(password, admin.passwordHash);
          if (!valid) {
            await prisma.loginEvent.create({
              data: {
                tenant: admin.tenant,
                actorType: "ADMIN",
                actorId: admin.id,
                email,
                success: false,
                method: "PASSWORD",
              },
            });
            await recordActivity(prisma, {
              event: "ADMIN_LOGIN_FAILED",
              actor: { type: "ADMIN", id: admin.id, email: admin.email, role: admin.role, tenant: admin.tenant },
              targetType: "ADMIN",
              targetId: admin.id,
              result: "FAILURE",
            });
            return null;
          }

          await prisma.admin.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
          await prisma.loginEvent.create({
            data: {
              tenant: admin.tenant,
              actorType: "ADMIN",
              actorId: admin.id,
              email: admin.email,
              success: true,
              method: "PASSWORD",
            },
          });
          await recordActivity(prisma, {
            event: "ADMIN_LOGIN",
            actor: { type: "ADMIN", id: admin.id, email: admin.email, role: admin.role, tenant: admin.tenant },
            targetType: "ADMIN",
            targetId: admin.id,
          });
          
          return {
            id: admin.id,
            email: admin.email,
            name: admin.name,
            role: admin.role,
            tenant: admin.tenant,
          };
        } catch (error) {
          console.error("[Auth] Authorization error:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.role = (user as { role?: string }).role ?? "ADMIN";
        token.tenant = (user as { tenant?: string }).tenant ?? "production";
        token.email = user.email;
        token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = typeof token.role === "string" ? token.role : "ADMIN";
        session.user.tenant = typeof token.tenant === "string" ? token.tenant : "production";
        session.user.email = token.email ?? "";
        session.user.name = token.name ?? "";
      }
      return session;
    },
  },
});
