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

    // Get available cards (not assigned and not used)
    const { data: cards, error } = await supabase
      .from("virtual_cards")
      .select("id, card_number, cvv, expiry_date, balance")
      .eq("is_assigned", false)
      .eq("is_used", false)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching available cards:", error)
      return NextResponse.json({ success: false, message: "Kartlar yüklenirken bir hata oluştu" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      cards: cards || [],
    })
  } catch (error) {
    console.error("Available cards error:", error)
    return NextResponse.json({ success: false, message: "Bir hata oluştu" }, { status: 500 })
  }
}
