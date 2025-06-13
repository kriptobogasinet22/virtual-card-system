import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { requireAuth } from "@/lib/auth"
import { getTelegramBot } from "@/lib/telegram-bot"

export async function POST(req: NextRequest) {
  try {
    // Kimlik doğrulama kontrolü
    await requireAuth()

    const { paymentId, telegramId } = await req.json()

    if (!paymentId || !telegramId) {
      return NextResponse.json({ success: false, message: "Eksik parametreler" }, { status: 400 })
    }

    const supabase = createServerSupabaseClient()

    // Ödeme durumunu güncelle
    const { error: paymentError } = await supabase
      .from("payment_requests")
      .update({ status: "rejected", updated_at: new Date().toISOString() })
      .eq("id", paymentId)

    if (paymentError) {
      console.error("Error updating payment:", paymentError)
      return NextResponse.json({ success: false, message: "Ödeme güncellenirken bir hata oluştu" }, { status: 500 })
    }

    // Kullanıcıya bildirim gönder
    const bot = getTelegramBot()
    await bot.sendMessage(
      telegramId,
      `
❌ *Ödeme Talebiniz Reddedildi*

Ödeme talebiniz reddedildi. Lütfen doğru miktarda ödeme yaptığınızdan emin olun veya destek için bizimle iletişime geçin.
    `,
      { parse_mode: "Markdown" },
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Reject payment error:", error)
    return NextResponse.json({ success: false, message: "Bir hata oluştu" }, { status: 500 })
  }
}
