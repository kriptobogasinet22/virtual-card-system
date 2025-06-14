import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { requireAuth } from "@/lib/auth"

export async function POST(req: NextRequest) {
  try {
    console.log("=== UPDATE CARD BALANCE API ===")

    // Kimlik doğrulama kontrolü
    await requireAuth()

    const { cardId, newBalance } = await req.json()
    console.log("Request data:", { cardId, newBalance })

    if (!cardId || newBalance === undefined || newBalance < 0) {
      return NextResponse.json({ success: false, message: "Geçersiz parametreler" }, { status: 400 })
    }

    const supabase = createServerSupabaseClient()

    // Önce kartın var olup olmadığını ve kullanıcı bilgilerini kontrol et
    const { data: existingCard, error: selectError } = await supabase
      .from("virtual_cards")
      .select(`
        id, 
        balance, 
        user_id,
        card_number,
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

    if (selectError || !existingCard) {
      console.error("Card not found:", selectError)
      return NextResponse.json({ success: false, message: "Kart bulunamadı" }, { status: 404 })
    }

    console.log("Existing card:", existingCard)
    const oldBalance = existingCard.balance
    const newBalanceNum = Number.parseFloat(newBalance.toString())

    // Kart bakiyesini güncelle
    const { data, error } = await supabase
      .from("virtual_cards")
      .update({
        balance: newBalanceNum,
      })
      .eq("id", cardId)
      .select()

    if (error) {
      console.error("Error updating card balance:", error)
      return NextResponse.json(
        { success: false, message: `Kart bakiyesi güncellenirken bir hata oluştu: ${error.message}` },
        { status: 500 },
      )
    }

    console.log("Card balance updated successfully:", data)

    // Eğer kart bir kullanıcıya atanmışsa ve bakiye değişmişse bildirim gönder
    if (existingCard.users && existingCard.users.telegram_id && oldBalance !== newBalanceNum) {
      try {
        console.log("Sending balance update notification...")

        const telegramId = existingCard.users.telegram_id
        const userName = existingCard.users.first_name || existingCard.users.username || "Değerli Müşterimiz"
        const cardLastFour = existingCard.card_number.slice(-4)

        // Bakiye değişikliği türünü belirle
        const balanceChange = newBalanceNum - oldBalance
        const changeType = balanceChange > 0 ? "artırıldı" : "azaltıldı"
        const changeIcon = balanceChange > 0 ? "📈" : "📉"
        const changeColor = balanceChange > 0 ? "🟢" : "🔴"

        const notificationMessage = `${changeIcon} *KART BAKİYESİ GÜNCELLENDİ*

👋 Merhaba ${userName}!

💳 *Kart Bilgileri:*
┣ 🔢 Kart: ****${cardLastFour}
┣ 💰 Eski Bakiye: ${oldBalance.toFixed(2)} TL
┣ 💰 Yeni Bakiye: ${newBalanceNum.toFixed(2)} TL
┗ ${changeColor} Değişiklik: ${Math.abs(balanceChange).toFixed(2)} TL (${changeType})

📅 *Güncelleme Zamanı:* ${new Date().toLocaleString("tr-TR")}

${balanceChange > 0 ? "🎉 *Tebrikler!* Kart bakiyeniz artırıldı." : "⚠️ *Bilgi:* Kart bakiyeniz güncellendi."}

🔒 *Güvenlik:* Bu işlem admin tarafından gerçekleştirildi.

💡 Kartlarınızı görüntülemek için /mycards komutunu kullanın.`

        // Telegram bildirimi gönder
        const botToken = process.env.TELEGRAM_BOT_TOKEN
        if (botToken) {
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

            // Harcama kaydı oluştur (sadece bakiye azaldıysa)
            if (balanceChange < 0) {
              try {
                await supabase.from("user_spending").insert({
                  user_id: existingCard.user_id,
                  card_id: cardId,
                  amount_spent: Math.abs(balanceChange),
                  spent_at: new Date().toISOString(),
                  month_year: new Date().toISOString().slice(0, 7), // YYYY-MM format
                })
                console.log("Spending record created:", Math.abs(balanceChange))
              } catch (spendingError) {
                console.error("Error creating spending record:", spendingError)
              }
            }

            return NextResponse.json({
              success: true,
              message: "Bakiye güncellendi ve bildirim gönderildi",
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
        } else {
          console.error("TELEGRAM_BOT_TOKEN not found")
          return NextResponse.json({
            success: true,
            message: "Bakiye güncellendi ancak bot token bulunamadı",
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
      console.log("Card not assigned to any user or balance unchanged, no notification needed")
      return NextResponse.json({
        success: true,
        message: "Kart bakiyesi başarıyla güncellendi",
        notificationSent: false,
      })
    }
  } catch (error) {
    console.error("Update card balance error:", error)
    return NextResponse.json({ success: false, message: `Bir hata oluştu: ${error.message}` }, { status: 500 })
  }
}
