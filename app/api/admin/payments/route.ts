import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { createServerSupabaseClient } from "@/lib/supabase"

export async function GET() {
  try {
    console.log("=== FETCHING PAYMENTS ===")
    const session = await getSession()

    if (!session) {
      console.log("No session found")
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    const supabase = createServerSupabaseClient()

    console.log("Querying payment_requests table")
    const { data: payments, error } = await supabase
      .from("payment_requests")
      .select(`
        id,
        card_balance,
        service_fee,
        total_amount,
        status,
        created_at,
        updated_at,
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
      console.error("Error fetching payments:", error)
      return NextResponse.json({ success: false, message: "Ödemeler yüklenirken bir hata oluştu" }, { status: 500 })
    }

    console.log(`Found ${payments?.length || 0} payments`)

    // Debug: Log the first payment if exists
    if (payments && payments.length > 0) {
      console.log("First payment:", JSON.stringify(payments[0], null, 2))
    }

    return NextResponse.json({
      success: true,
      payments: payments || [],
    })
  } catch (error) {
    console.error("Payments error:", error)
    return NextResponse.json({ success: false, message: "Bir hata oluştu" }, { status: 500 })
  }
}
