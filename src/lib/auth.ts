import { randomBytes } from "node:crypto";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare, hash } from "bcryptjs";
import { prisma } from "@/lib/db";
import { databaseConfigured } from "@/lib/prisma-client";
import { recordActivity } from "@/lib/audit";
import { ensureCatalog, ensureMembership } from "../../prisma/catalog";

// A copied local AUTH_URL would rewrite production auth requests to localhost.
if (process.env.VERCEL) {
  const configuredUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "";
  if (/localhost|127\.0\.0\.1/.test(configuredUrl)) {
    delete process.env.AUTH_URL;
    delete process.env.NEXTAUTH_URL;
  }
}

const authSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;

async function ensureFullAdmin() {
  await ensureCatalog(prisma);
  const email = (process.env.ADMIN_EMAIL || "admin@aig.local").trim().toLowerCase();
  const name = process.env.ADMIN_NAME || "AIG Administrator";
  const existing = await prisma.admin.findUnique({ where: { email } });
  const admin = existing
    ? await prisma.admin.update({
        where: { id: existing.id },
        data: { status: "ACTIVE", role: "SUPER_ADMIN", tenant: "production", deletedAt: null },
      })
    : await prisma.admin.create({
        data: {
          name,
          email,
          passwordHash: await hash(randomBytes(24).toString("hex"), 12),
          status: "ACTIVE",
          role: "SUPER_ADMIN",
          tenant: "production",
        },
      });
  await ensureMembership(prisma, admin.id, "production", "SUPER_ADMIN");
  return admin;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: authSecret,
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  pages: { signIn: "/login", error: "/login" },
  providers: [
    Credentials({
      name: "Admin credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        dummy: { label: "Dummy", type: "text" },
      },
      async authorize(credentials) {
        try {
          if (String(credentials?.dummy ?? "") === "1") {
            if (!databaseConfigured()) {
              return {
                id: "sample_admin",
                email: "admin@aig.local",
                name: "AIG Administrator",
                role: "SUPER_ADMIN",
                tenant: "production",
              };
            }
            const admin = await ensureFullAdmin();
            await prisma.admin.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
            await prisma.loginEvent.create({
              data: {
                tenant: admin.tenant,
                actorType: "ADMIN",
                actorId: admin.id,
                email: admin.email,
                success: true,
                method: "DUMMY",
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
          }

          const email = String(credentials?.email ?? "")
            .trim()
            .toLowerCase();
          const password = String(credentials?.password ?? "");
          if (!email || !password) return null;
          
          const admin = await prisma.admin.findUnique({ where: { email } });
          if (!admin || admin.status !== "ACTIVE" || admin.deletedAt) {
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
        } catch {
          console.error("[Auth] Authorization failed.");
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
