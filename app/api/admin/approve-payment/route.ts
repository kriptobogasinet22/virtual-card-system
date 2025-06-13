import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { requireAuth } from "@/lib/auth"

export async function POST(req: NextRequest) {
  try {
    await requireAuth()

    const { paymentId, cardId, userId, telegramId, cardBalance } = await req.json()

    if (!paymentId || !cardId || !userId) {
      return NextResponse.json({ success: false, message: "Eksik parametreler" }, { status: 400 })
    }

    const supabase = createServerSupabaseClient()

    // Start transaction-like operations
    try {
      // 1. Update payment status to approved
      const { error: paymentError } = await supabase
        .from("payment_requests")
        .update({
          status: "approved",
          updated_at: new Date().toISOString(),
        })
        .eq("id", paymentId)

      if (paymentError) {
        throw new Error(`Payment update failed: ${paymentError.message}`)
      }

      // 2. Assign card to user
      const { error: cardError } = await supabase
        .from("virtual_cards")
        .update({
          is_assigned: true,
          user_id: userId,
          assigned_at: new Date().toISOString(),
        })
        .eq("id", cardId)

      if (cardError) {
        throw new Error(`Card assignment failed: ${cardError.message}`)
      }

      // 3. Create transaction record
      const { error: transactionError } = await supabase.from("transactions").insert({
        user_id: userId,
        card_id: cardId,
        type: "purchase",
        amount: cardBalance,
        status: "completed",
        details: {
          payment_id: paymentId,
          telegram_id: telegramId,
        },
      })

      if (transactionError) {
        console.error("Transaction record failed:", transactionError)
        // Don't fail the whole operation for transaction record
      }

      // 4. Send notification to user via Telegram (optional)
      try {
        if (process.env.TELEGRAM_BOT_TOKEN && telegramId) {
          const botToken = process.env.TELEGRAM_BOT_TOKEN
          const message = `✅ Ödemeniz onaylandı! Sanal kartınız hazır.\n\nKart bilgilerinizi almak için /mycards komutunu kullanın.`

          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              chat_id: telegramId,
              text: message,
            }),
          })
        }
      } catch (notificationError) {
        console.error("Notification failed:", notificationError)
        // Don't fail the operation for notification errors
      }

      return NextResponse.json({
        success: true,
        message: "Ödeme onaylandı ve kart kullanıcıya atandı",
      })
    } catch (error) {
      console.error("Transaction failed:", error)
      return NextResponse.json(
        {
          success: false,
          message: "İşlem sırasında bir hata oluştu",
        },
        { status: 500 },
      )
    }
  } catch (error) {
    console.error("Approve payment error:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Ödeme onaylanırken bir hata oluştu",
      },
      { status: 500 },
    )
  }
}
