import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { createServerSupabaseClient } from "@/lib/supabase"

export async function GET() {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    const supabase = createServerSupabaseClient()

    const { data: users, error } = await supabase.from("users").select("*").order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching users:", error)
      return NextResponse.json({ success: false, message: "Kullanıcılar yüklenirken bir hata oluştu" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      users: users || [],
    })
  } catch (error) {
    console.error("Users error:", error)
    return NextResponse.json({ success: false, message: "Bir hata oluştu" }, { status: 500 })
  }
}
