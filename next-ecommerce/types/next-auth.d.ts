import { DefaultSession } from "next-auth"

// The session callback in pages/api/auth/[...nextauth].ts copies the database
// user into the session, so session.user always has an id.
declare module "next-auth" {
  interface Session {
    user: {
      id: string
    } & DefaultSession["user"]
  }
}
