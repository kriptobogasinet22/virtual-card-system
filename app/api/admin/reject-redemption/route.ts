import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { requireAuth } from "@/lib/auth"

export async function POST(req: NextRequest) {
  try {
    // Kimlik doğrulama kontrolü
    await requireAuth()

    const { redemptionId, telegramId } = await req.json()

    if (!redemptionId || !telegramId) {
      return NextResponse.json({ success: false, message: "Eksik parametreler" }, { status: 400 })
    }

    const supabase = createServerSupabaseClient()

    // Bozum talebini güncelle
    const { error: redemptionError } = await supabase
      .from("card_redemption_requests")
      .update({
        status: "rejected",
        updated_at: new Date().toISOString(),
      })
      .eq("id", redemptionId)

    if (redemptionError) {
      console.error("Error updating redemption:", redemptionError)
      return NextResponse.json({ success: false, message: "Bozum güncellenirken bir hata oluştu" }, { status: 500 })
    }

    // Kullanıcıya bildirim gönder
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    if (botToken) {
      try {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chat_id: telegramId,
            text: `❌ *Kart Bozum Reddedildi*

Kart bozum talebiniz reddedildi. Lütfen kart bilgilerinizi kontrol edin veya destek ile iletişime geçin.`,
            parse_mode: "Markdown",
          }),
        })
      } catch (notificationError) {
        console.error("Notification error:", notificationError)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Reject redemption error:", error)
    return NextResponse.json({ success: false, message: "Bir hata oluştu" }, { status: 500 })
  }
}
