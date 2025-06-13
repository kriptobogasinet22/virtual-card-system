import { NextResponse } from "next/server"
import { clearSession } from "@/lib/auth"

export async function POST() {
  try {
    await clearSession()
    return NextResponse.json({ success: true, message: "Logged out successfully" })
  } catch (error) {
    console.error("Logout error:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Logout failed",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
