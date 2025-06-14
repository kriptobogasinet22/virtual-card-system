import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { requireAuth } from "@/lib/auth"

export async function POST(req: NextRequest) {
  try {
    console.log("=== BALANCE UPDATE NOTIFICATION API ===")

    // Kimlik doğrulama kontrolü
    await requireAuth()

    const { cardId, oldBalance, newBalance } = await req.json()
    console.log("Balance update notification request:", { cardId, oldBalance, newBalance })

    if (!cardId || oldBalance === undefined || newBalance === undefined) {
      return NextResponse.json({ success: false, message: "Eksik parametreler" }, { status: 400 })
    }

    const supabase = createServerSupabaseClient()

    // Kartın sahibini bul
    const { data: cardData, error: cardError } = await supabase
      .from("virtual_cards")
      .select(`
        id,
        card_number,
        balance,
        user_id,
        users (
          id,
          telegram_id,
          first_name,
          last_name,
          username
        )
      `)
      .eq("id", cardId)
      .single()

    if (cardError || !cardData) {
      console.error("Card not found:", cardError)
      return NextResponse.json({ success: false, message: "Kart bulunamadı" }, { status: 404 })
    }

    console.log("Found card data:", cardData)

    // Eğer kart bir kullanıcıya atanmışsa bildirim gönder
    if (cardData.users && cardData.users.telegram_id) {
      const telegramId = cardData.users.telegram_id
      const userName = cardData.users.first_name || cardData.users.username || "Değerli Müşterimiz"
      const cardLastFour = cardData.card_number.slice(-4)

      // Bakiye değişikliği türünü belirle
      const balanceChange = newBalance - oldBalance
      const changeType = balanceChange > 0 ? "artırıldı" : "azaltıldı"
      const changeIcon = balanceChange > 0 ? "📈" : "📉"
      const changeColor = balanceChange > 0 ? "🟢" : "🔴"

      const notificationMessage = `${changeIcon} *KART BAKİYESİ GÜNCELLENDİ*

👋 Merhaba ${userName}!

💳 *Kart Bilgileri:*
┣ 🔢 Kart: ****${cardLastFour}
┣ 💰 Eski Bakiye: ${oldBalance.toFixed(2)} TL
┣ 💰 Yeni Bakiye: ${newBalance.toFixed(2)} TL
┗ ${changeColor} Değişiklik: ${Math.abs(balanceChange).toFixed(2)} TL (${changeType})

📅 *Güncelleme Zamanı:* ${new Date().toLocaleString("tr-TR")}

${balanceChange > 0 ? "🎉 *Tebrikler!* Kart bakiyeniz artırıldı." : "⚠️ *Bilgi:* Kart bakiyeniz güncellendi."}

🔒 *Güvenlik:* Bu işlem admin tarafından gerçekleştirildi.

💡 Kartlarınızı görüntülemek için /mycards komutunu kullanın.`

      // Telegram bildirimi gönder
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
              text: notificationMessage,
              parse_mode: "Markdown",
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: "💳 Kartlarım", callback_data: "my_cards" },
                    { text: "📊 Hesap Özeti", callback_data: "account_summary" },
                  ],
                  [{ text: "🏠 Ana Menü", callback_data: "main_menu" }],
                ],
              },
            }),
          })

          const result = await response.json()
          console.log("Telegram notification result:", result)

          if (result.ok) {
            console.log(`Balance update notification sent successfully to user ${telegramId}`)
            return NextResponse.json({
              success: true,
              message: "Bakiye güncelleme bildirimi gönderildi",
              notificationSent: true,
            })
          } else {
            console.error("Failed to send Telegram notification:", result)
            return NextResponse.json({
              success: true,
              message: "Bakiye güncellendi ancak bildirim gönderilemedi",
              notificationSent: false,
            })
          }
        } catch (notificationError) {
          console.error("Notification error:", notificationError)
          return NextResponse.json({
            success: true,
            message: "Bakiye güncellendi ancak bildirim gönderilemedi",
            notificationSent: false,
          })
        }
      } else {
        console.error("TELEGRAM_BOT_TOKEN not found")
        return NextResponse.json({
          success: true,
          message: "Bakiye güncellendi ancak bot token bulunamadı",
          notificationSent: false,
        })
      }
    } else {
      console.log("Card not assigned to any user, no notification needed")
      return NextResponse.json({
        success: true,
        message: "Kart henüz bir kullanıcıya atanmamış",
        notificationSent: false,
      })
    }
  } catch (error) {
    console.error("Balance update notification error:", error)
    return NextResponse.json(
      {
        success: false,
        message: `Bildirim gönderilirken hata: ${error.message}`,
      },
      { status: 500 },
    )
  }
}
