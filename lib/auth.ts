import { cookies } from "next/headers"

export interface AdminSession {
  id: string
  username: string
  createdAt: number
}

// Simple session management without JWT dependency
export async function getSession(): Promise<AdminSession | null> {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get("admin-session")

    if (!sessionCookie?.value) {
      return null
    }

    const session = JSON.parse(sessionCookie.value) as AdminSession

    // Check if session is expired (24 hours)
    const now = Date.now()
    const sessionAge = now - session.createdAt
    const maxAge = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

    if (sessionAge > maxAge) {
      // Session expired, clear it
      await clearSession()
      return null
    }

    return session
  } catch (error) {
    console.error("Session verification error:", error)
    return null
  }
}

export async function createSession(admin: { id: string; username: string }) {
  try {
    const session: AdminSession = {
      id: admin.id,
      username: admin.username,
      createdAt: Date.now(),
    }

    const cookieStore = await cookies()
    cookieStore.set("admin-session", JSON.stringify(session), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 24 * 60 * 60, // 24 hours
      path: "/",
    })

    return { success: true }
  } catch (error) {
    console.error("Session creation error:", error)
    return { success: false, error: "Failed to create session" }
  }
}

export async function clearSession() {
  try {
    const cookieStore = await cookies()
    cookieStore.delete("admin-session")
    return { success: true }
  } catch (error) {
    console.error("Session clear error:", error)
    return { success: false, error: "Failed to clear session" }
  }
}

// Simple login function for demo purposes
export async function login(username: string, password: string) {
  try {
    // Demo credentials
    if (username === "admin" && password === "admin123") {
      const session = await createSession({ id: "1", username: "admin" })
      if (session.success) {
        return { success: true, message: "Login successful" }
      }
    }

    // If Supabase is available, try database login
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const { createServerSupabaseClient } = await import("./supabase")
      const supabase = createServerSupabaseClient()

      const { data: admin, error } = await supabase
        .from("admins")
        .select("id, username, password")
        .eq("username", username)
        .single()

      if (!error && admin) {
        // Simple password comparison (in production, use bcrypt)
        if (admin.password === password) {
          const session = await createSession({ id: admin.id, username: admin.username })
          if (session.success) {
            return { success: true, message: "Login successful" }
          }
        }
      }
    }

    return { success: false, message: "Invalid credentials" }
  } catch (error) {
    console.error("Login error:", error)
    return { success: false, message: "Login failed" }
  }
}
