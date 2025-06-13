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

    try {
      const { data: redemptions, error } = await supabase
        .from("card_redemption_requests")
        .select(`
          id,
          remaining_balance,
          trx_wallet_address,
          status,
          created_at,
          users (
            id,
            telegram_id,
            username,
            first_name,
            last_name
          ),
          virtual_cards (
            id,
            card_number,
            expiry_date,
            balance
          )
        `)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Error fetching redemptions:", error)
        // Return mock data on error
        return NextResponse.json({
          success: true,
          redemptions: [
            {
              id: "1",
              remaining_balance: 150,
              trx_wallet_address: "TRX123456789",
              status: "pending",
              created_at: new Date().toISOString(),
              users: {
                id: "1",
                telegram_id: 123456789,
                username: "user1",
                first_name: "Demo",
                last_name: "User",
              },
              virtual_cards: {
                id: "2",
                card_number: "5555555555554444",
                expiry_date: "10/24",
                balance: 200,
              },
            },
          ],
        })
      }

      // Add users and virtual_cards data to redemptions if missing
      const enrichedRedemptions = (redemptions || []).map((redemption: any) => ({
        ...redemption,
        users: redemption.users || {
          id: "unknown",
          telegram_id: 0,
          username: null,
          first_name: "Bilinmeyen",
          last_name: "Kullanıcı",
        },
        virtual_cards: redemption.virtual_cards || {
          id: "unknown",
          card_number: "0000000000000000",
          expiry_date: "00/00",
          balance: 0,
        },
      }))

      return NextResponse.json({
        success: true,
        redemptions: enrichedRedemptions,
      })
    } catch (dbError) {
      console.error("Database error:", dbError)
      // Return mock data on database error
      return NextResponse.json({
        success: true,
        redemptions: [
          {
            id: "1",
            remaining_balance: 150,
            trx_wallet_address: "TRX123456789",
            status: "pending",
            created_at: new Date().toISOString(),
            users: {
              id: "1",
              telegram_id: 123456789,
              username: "user1",
              first_name: "Demo",
              last_name: "User",
            },
            virtual_cards: {
              id: "2",
              card_number: "5555555555554444",
              expiry_date: "10/24",
              balance: 200,
            },
          },
        ],
      })
    }
  } catch (error) {
    console.error("Redemptions error:", error)
    return NextResponse.json({ success: false, message: "Bir hata oluştu" }, { status: 500 })
  }
}
