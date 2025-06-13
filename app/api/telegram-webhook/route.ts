import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"

// Telegram Bot API fonksiyonları
async function sendTelegramMessage(chatId: number, text: string, options?: any) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) {
    console.error("TELEGRAM_BOT_TOKEN not found")
    return false
  }

  try {
    console.log("Sending message to chat:", chatId)
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
        ...options,
      }),
    })

    const result = await response.json()
    console.log("Telegram API response:", result)

    if (!result.ok) {
      console.error("Telegram API error:", result)
      return false
    }

    return true
  } catch (error) {
    console.error("Error sending Telegram message:", error)
    return false
  }
}

async function registerUser(telegramUser: any) {
  const supabase = createServerSupabaseClient()

  try {
    const { data, error } = await supabase
      .from("users")
      .upsert({
        telegram_id: telegramUser.id,
        username: telegramUser.username,
        first_name: telegramUser.first_name,
        last_name: telegramUser.last_name,
      })
      .select()
      .single()

    if (error) {
      console.error("Error registering user:", error)
      return null
    }

    return data
  } catch (error) {
    console.error("Database error in registerUser:", error)
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    console.log("=== Webhook received ===")
    console.log("Headers:", Object.fromEntries(req.headers.entries()))
    console.log("URL:", req.url)

    // Webhook secret kontrolü
    const secret = req.nextUrl.searchParams.get("secret")
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET

    console.log("Secret check:", {
      received: secret ? "***" : "null",
      expected: expectedSecret ? "***" : "null",
      match: secret === expectedSecret,
    })

    if (!expectedSecret) {
      console.error("TELEGRAM_WEBHOOK_SECRET not configured")
      return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 })
    }

    if (secret !== expectedSecret) {
      console.error("Invalid webhook secret")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Request body'yi parse et
    const update = await req.json()
    console.log("=== Telegram update ===")
    console.log(JSON.stringify(update, null, 2))

    // Mesaj işleme
    if (update.message) {
      const message = update.message
      const chatId = message.chat.id
      const text = message.text
      const user = message.from

      console.log("Processing message:", { chatId, text, userId: user?.id })

      // Kullanıcıyı kaydet
      if (user) {
        await registerUser(user)
      }

      // /start komutu
      if (text === "/start") {
        console.log("Processing /start command")

        const welcomeMessage = `🤖 *Sanal Kart Satış Sistemine Hoş Geldiniz!*

Merhaba ${user?.first_name || ""}!

Bu bot ile:
💳 Sanal kart satın alabilirsiniz
🔄 Kart bozumu yapabilirsiniz
📋 Kartlarınızı görüntüleyebilirsiniz

Lütfen yapmak istediğiniz işlemi seçin:`

        const keyboard = {
          inline_keyboard: [
            [{ text: "💳 Sanal Kart Satın Al", callback_data: "buy_card" }],
            [{ text: "🔄 Kart Bozumu", callback_data: "redeem_card" }],
            [{ text: "📋 Kartlarım", callback_data: "my_cards" }],
            [{ text: "❓ Yardım", callback_data: "help" }],
          ],
        }

        const sent = await sendTelegramMessage(chatId, welcomeMessage, { reply_markup: keyboard })
        console.log("Welcome message sent:", sent)

        return NextResponse.json({ ok: true })
      }

      // Diğer mesajlar için genel yanıt
      console.log("Sending general response")
      await sendTelegramMessage(chatId, "Merhaba! Lütfen menüden bir seçenek seçin veya /start komutunu kullanın.")
    }

    // Callback query işleme
    if (update.callback_query) {
      const callbackQuery = update.callback_query
      const chatId = callbackQuery.message?.chat.id
      const data = callbackQuery.data
      const user = callbackQuery.from

      console.log("Processing callback query:", { chatId, data, userId: user?.id })

      if (!chatId) {
        return NextResponse.json({ ok: true })
      }

      // Callback query'yi acknowledge et
      const botToken = process.env.TELEGRAM_BOT_TOKEN
      if (botToken) {
        try {
          await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ callback_query_id: callbackQuery.id }),
          })
        } catch (error) {
          console.error("Error answering callback query:", error)
        }
      }

      if (data === "buy_card") {
        await sendTelegramMessage(
          chatId,
          "💳 *Sanal Kart Satın Alma*\n\nLütfen satın almak istediğiniz kartın bakiyesini TL cinsinden girin.\n\nÖrnek: 100\n\n💡 Not: Girdiğiniz tutara %20 hizmet bedeli eklenecektir.",
        )
      } else if (data === "redeem_card") {
        await sendTelegramMessage(chatId, "🔄 Kart bozumu özelliği yakında aktif olacak.")
      } else if (data === "my_cards") {
        await sendTelegramMessage(chatId, "📋 Kartlarım özelliği yakında aktif olacak.")
      } else if (data === "help") {
        const helpMessage = `🔍 *Yardım & SSS*

*Sanal Kart Nedir?*
Sanal kartlar, fiziksel bir karta ihtiyaç duymadan online alışveriş yapmanızı sağlayan kartlardır.

*Nasıl Kart Satın Alabilirim?*
"Sanal Kart Satın Al" butonuna tıklayın ve talimatları takip edin.

*Güvenli mi?*
Evet, tüm işlemler güvenli bir şekilde gerçekleştirilir.

Daha fazla bilgi için destek ekibimizle iletişime geçebilirsiniz.`

        await sendTelegramMessage(chatId, helpMessage)
      }
    }

    console.log("=== Webhook processed successfully ===")
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("=== Webhook error ===", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
