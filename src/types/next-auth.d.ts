import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
      tenant: string;
    };
  }

  interface User {
    role?: string;
    tenant?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
    tenant?: string;
  }
}
