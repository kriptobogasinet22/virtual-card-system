import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"

export async function GET() {
  try {
    const session = await getSession()

    return NextResponse.json({
      authenticated: !!session,
      success: true,
      session: session ? { id: session.id, username: session.username } : null,
    })
  } catch (error) {
    console.error("Session check error:", error)
    return NextResponse.json(
      {
        authenticated: false,
        success: false,
        error: "Session check failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
