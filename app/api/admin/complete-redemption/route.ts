import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { requireAuth } from "@/lib/auth"

export async function POST(req: NextRequest) {
  try {
    console.log("=== COMPLETE REDEMPTION API ===")

    // Kimlik doğrulama kontrolü
    await requireAuth()

    const { redemptionId, telegramId } = await req.json()
    console.log("Complete redemption request:", { redemptionId, telegramId })

    if (!redemptionId || !telegramId) {
      return NextResponse.json({ success: false, message: "Eksik parametreler" }, { status: 400 })
    }

    const supabase = createServerSupabaseClient()

    // Önce bozum talebini al ve kart ID'sini bul
    const { data: redemptionData, error: redemptionSelectError } = await supabase
      .from("card_redemption_requests")
      .select("card_id, remaining_balance")
      .eq("id", redemptionId)
      .single()

    if (redemptionSelectError || !redemptionData) {
      console.error("Redemption not found:", redemptionSelectError)
      return NextResponse.json({ success: false, message: "Bozum talebi bulunamadı" }, { status: 404 })
    }

    console.log("Found redemption data:", redemptionData)

    // Bozum talebini güncelle
    const { error: redemptionError } = await supabase
      .from("card_redemption_requests")
      .update({
        status: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", redemptionId)

    if (redemptionError) {
      console.error("Error updating redemption:", redemptionError)
      return NextResponse.json({ success: false, message: "Bozum güncellenirken bir hata oluştu" }, { status: 500 })
    }

    console.log("Redemption status updated to completed")

    // Kartı kullanılmış olarak işaretle ve bakiyesini sıfırla
    const { data: updatedCard, error: cardError } = await supabase
      .from("virtual_cards")
      .update({
        is_used: true,
        balance: 0,
      })
      .eq("id", redemptionData.card_id)
      .select()

    if (cardError) {
      console.error("Error updating card:", cardError)
      return NextResponse.json({ success: false, message: "Kart güncellenirken bir hata oluştu" }, { status: 500 })
    }

    console.log("Card updated successfully:", updatedCard)

    // Kullanıcıya bildirim gönder
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    if (botToken) {
      try {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chat_id: telegramId,
            text: `✅ *Kart Bozum Tamamlandı*

Kart bozum talebiniz tamamlandı. ${redemptionData.remaining_balance} TL karşılığı TRX ödemeniz cüzdan adresinize gönderilmiştir.

Kartınız artık kullanılmış olarak işaretlenmiştir.

Teşekkür ederiz!`,
            parse_mode: "Markdown",
          }),
        })

        const result = await response.json()
        console.log("Telegram notification result:", result)
      } catch (notificationError) {
        console.error("Notification error:", notificationError)
      }
    }

    return NextResponse.json({ success: true, message: "Bozum başarıyla tamamlandı" })
  } catch (error) {
    console.error("Complete redemption error:", error)
    return NextResponse.json({ success: false, message: "Bir hata oluştu" }, { status: 500 })
  }
}
