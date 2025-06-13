import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { createServerSupabaseClient } from "@/lib/supabase"

export async function GET() {
  try {
    console.log("=== FETCHING CARDS ===")
    const session = await getSession()

    if (!session) {
      console.log("No session found")
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    const supabase = createServerSupabaseClient()

    console.log("Querying virtual_cards table")
    const { data: cards, error } = await supabase
      .from("virtual_cards")
      .select(`
        id,
        card_number,
        cvv,
        expiry_date,
        balance,
        is_assigned,
        is_used,
        assigned_at,
        created_at,
        user_id,
        users (
          id,
          telegram_id,
          username,
          first_name,
          last_name
        )
      `)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching cards:", error)
      return NextResponse.json({ success: false, message: "Kartlar yüklenirken bir hata oluştu" }, { status: 500 })
    }

    console.log(`Found ${cards?.length || 0} cards`)

    return NextResponse.json({
      success: true,
      cards: cards || [],
    })
  } catch (error) {
    console.error("Cards error:", error)
    return NextResponse.json({ success: false, message: "Bir hata oluştu" }, { status: 500 })
  }
}
