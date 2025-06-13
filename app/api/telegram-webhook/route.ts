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
    console.log(`Sending message to chat ${chatId}: ${text.substring(0, 50)}...`)

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

    const responseText = await response.text()
    let result
    try {
      result = JSON.parse(responseText)
    } catch (e) {
      console.error("Failed to parse Telegram API response:", e)
      return false
    }

    if (!result.ok) {
      console.error("Telegram API error:", result)
      return false
    }

    console.log("Message sent successfully to chat:", chatId)
    return true
  } catch (error) {
    console.error("Error sending Telegram message:", error)
    return false
  }
}

// Kullanıcı kayıt fonksiyonu
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

// Kullanıcı durumunu güncelleme
async function updateUserState(telegramId: number, state: string, additionalData: any = {}) {
  const supabase = createServerSupabaseClient()

  try {
    const { data: userData } = await supabase.from("users").select("id").eq("telegram_id", telegramId).single()

    if (!userData) {
      console.error("User not found:", telegramId)
      return false
    }

    const { error } = await supabase
      .from("users")
      .update({
        user_metadata: {
          state,
          ...additionalData,
        },
      })
      .eq("id", userData.id)

    if (error) {
      console.error("Error updating user state:", error)
      return false
    }

    return true
  } catch (error) {
    console.error("Database error in updateUserState:", error)
    return false
  }
}

// Kullanıcı durumunu alma
async function getUserState(telegramId: number) {
  const supabase = createServerSupabaseClient()

  try {
    const { data: userData } = await supabase
      .from("users")
      .select("id, user_metadata")
      .eq("telegram_id", telegramId)
      .single()

    if (!userData) {
      console.error("User not found:", telegramId)
      return { state: null, data: {} }
    }

    return {
      state: userData.user_metadata?.state || null,
      data: userData.user_metadata || {},
    }
  } catch (error) {
    console.error("Database error in getUserState:", error)
    return { state: null, data: {} }
  }
}

// Ödeme talebi oluşturma
async function createPaymentRequest(userId: string, cardBalance: number) {
  const supabase = createServerSupabaseClient()
  const serviceFee = cardBalance * 0.2
  const totalAmount = cardBalance + serviceFee

  try {
    const { data, error } = await supabase
      .from("payment_requests")
      .insert({
        user_id: userId,
        card_balance: cardBalance,
        service_fee: serviceFee,
        total_amount: totalAmount,
        status: "pending",
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating payment request:", error)
      return null
    }

    return data
  } catch (error) {
    console.error("Database error in createPaymentRequest:", error)
    return null
  }
}

// Kullanıcının kartlarını getirme
async function getUserCards(userId: string) {
  const supabase = createServerSupabaseClient()

  try {
    const { data, error } = await supabase.from("virtual_cards").select("*").eq("user_id", userId)

    if (error) {
      console.error("Error fetching user cards:", error)
      return []
    }

    return data || []
  } catch (error) {
    console.error("Database error in getUserCards:", error)
    return []
  }
}

// Kart bozum talebi oluşturma
async function createCardRedemptionRequest(
  userId: string,
  cardId: string,
  remainingBalance: number,
  trxWalletAddress: string,
) {
  const supabase = createServerSupabaseClient()

  try {
    const { data, error } = await supabase
      .from("card_redemption_requests")
      .insert({
        user_id: userId,
        card_id: cardId,
        remaining_balance: remainingBalance,
        trx_wallet_address: trxWalletAddress,
        status: "pending",
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating card redemption request:", error)
      return null
    }

    return data
  } catch (error) {
    console.error("Database error in createCardRedemptionRequest:", error)
    return null
  }
}

// TRX cüzdan adresi
const TRX_WALLET_ADDRESS = "TXYourTronWalletAddressHere"

// Webhook handler
export async function POST(req: NextRequest) {
  try {
    console.log("=== WEBHOOK RECEIVED ===")

    // Webhook secret kontrolü
    const secret = req.nextUrl.searchParams.get("secret")
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET || "webhook_secret_2024_secure"

    if (secret !== expectedSecret) {
      console.error("Invalid webhook secret")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Request body'yi parse et
    let update
    try {
      update = await req.json()
      console.log("Telegram update received:", JSON.stringify(update, null, 2))
    } catch (e) {
      console.error("Failed to parse request body:", e)
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    // Mesaj işleme
    if (update.message) {
      const message = update.message
      const chatId = message.chat.id
      const text = message.text || ""
      const user = message.from

      console.log(`Processing message from chat ${chatId}: "${text}"`)

      // Kullanıcıyı kaydet
      if (user) {
        await registerUser(user)
      }

      // Kullanıcı durumunu kontrol et
      const { state, data: stateData } = await getUserState(chatId)
      console.log(`User state for ${chatId}: ${state}`)

      // /start komutu
      if (text === "/start") {
        console.log("Processing /start command for chat:", chatId)

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

        await sendTelegramMessage(chatId, welcomeMessage, { reply_markup: keyboard })
        await updateUserState(chatId, "main_menu")
      }
      // Bakiye girişi bekleniyor mu?
      else if (state === "waiting_card_balance") {
        // Bakiye değerini kontrol et
        const cardBalance = Number.parseFloat(text)

        if (isNaN(cardBalance) || cardBalance <= 0) {
          await sendTelegramMessage(chatId, "❌ Geçersiz bakiye değeri. Lütfen pozitif bir sayı girin:")
          return NextResponse.json({ ok: true })
        }

        // Ödeme detaylarını hesapla
        const serviceFee = cardBalance * 0.2
        const totalAmount = cardBalance + serviceFee

        // Ödeme bilgilerini göster
        const message = `
💳 *Sanal Kart Satın Alma*

İstediğiniz Kart Bakiyesi: *${cardBalance.toFixed(2)} TL*
Hizmet Bedeli (%20): *${serviceFee.toFixed(2)} TL*
Toplam Ödeme: *${totalAmount.toFixed(2)} TRX*

Ödeme adresi: \`${TRX_WALLET_ADDRESS}\`

Ödemeyi yaptıktan sonra "Ödeme Yaptım" butonuna tıklayın.
        `

        await sendTelegramMessage(chatId, message, {
          reply_markup: {
            inline_keyboard: [[{ text: "✅ Ödeme Yaptım", callback_data: "payment_done" }]],
          },
        })

        // Kullanıcı durumunu güncelle
        await updateUserState(chatId, "waiting_payment_confirmation", {
          payment_info: { cardBalance, serviceFee, totalAmount },
        })
      }
      // TRX cüzdan adresi yanıtı
      else if (state === "waiting_trx_address") {
        const trxAddress = text.trim()

        // Basit bir TRX adres doğrulaması
        if (!trxAddress.startsWith("T") || trxAddress.length < 30) {
          await sendTelegramMessage(chatId, "❌ Geçersiz TRX cüzdan adresi. Lütfen geçerli bir TRX adresi girin:")
          return NextResponse.json({ ok: true })
        }

        // Kart ID'sini al
        const cardId = stateData.selected_card_id
        if (!cardId) {
          await sendTelegramMessage(chatId, "❌ Bir hata oluştu. Lütfen tekrar kart seçin.")
          await updateUserState(chatId, "main_menu")
          return NextResponse.json({ ok: true })
        }

        // Kullanıcı ID'sini al
        const supabase = createServerSupabaseClient()
        const { data: userData } = await supabase.from("users").select("id").eq("telegram_id", chatId).single()

        if (!userData) {
          await sendTelegramMessage(chatId, "❌ Kullanıcı bilgileriniz bulunamadı.")
          return NextResponse.json({ ok: true })
        }

        // Kart bilgilerini al
        const { data: cardData } = await supabase.from("virtual_cards").select("*").eq("id", cardId).single()

        if (!cardData) {
          await sendTelegramMessage(chatId, "❌ Kart bilgileri bulunamadı.")
          return NextResponse.json({ ok: true })
        }

        // Kart bozum talebi oluştur
        const redemptionRequest = await createCardRedemptionRequest(userData.id, cardId, cardData.balance, trxAddress)

        if (redemptionRequest) {
          await sendTelegramMessage(
            chatId,
            `
✅ *Kart bozum talebiniz alındı!*

Talebiniz incelendikten sonra TRX adresinize ödeme yapılacaktır.
Talep ID: \`${redemptionRequest.id}\`
            `,
            { parse_mode: "Markdown" },
          )

          // Kullanıcı durumunu temizle
          await updateUserState(chatId, "main_menu")
        } else {
          await sendTelegramMessage(
            chatId,
            "❌ Kart bozum talebi oluşturulurken bir hata oluştu. Lütfen daha sonra tekrar deneyin.",
          )
        }
      }
      // Diğer mesajlar için genel yanıt
      else {
        console.log("Sending general response to chat:", chatId)
        await sendTelegramMessage(chatId, "Merhaba! Lütfen menüden bir seçenek seçin veya /start komutunu kullanın.")
      }
    }

    // Callback query işleme
    if (update.callback_query) {
      const callbackQuery = update.callback_query
      const chatId = callbackQuery.message?.chat.id
      const data = callbackQuery.data
      const user = callbackQuery.from

      console.log(`Processing callback query from chat ${chatId}: "${data}"`)

      if (!chatId) {
        console.error("Chat ID not found in callback query")
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
          "💳 *Sanal Kart Satın Alma*\n\nLütfen satın almak istediğiniz kartın bakiyesini TL cinsinden girin:\n\nÖrnek: 100\n\n💡 Not: Girdiğiniz tutara %20 hizmet bedeli eklenecektir.",
        )

        // Kullanıcı durumunu güncelle
        await updateUserState(chatId, "waiting_card_balance")
      } else if (data === "payment_done") {
        // Kullanıcı bilgilerini al
        const { state, data: stateData } = await getUserState(chatId)

        if (state !== "waiting_payment_confirmation" || !stateData.payment_info) {
          await sendTelegramMessage(chatId, "❌ Bir hata oluştu. Lütfen tekrar kart satın alma işlemini başlatın.")
          await updateUserState(chatId, "main_menu")
          return NextResponse.json({ ok: true })
        }

        // Kullanıcı ID'sini al
        const supabase = createServerSupabaseClient()
        const { data: userData } = await supabase.from("users").select("id").eq("telegram_id", chatId).single()

        if (!userData) {
          await sendTelegramMessage(chatId, "❌ Kullanıcı bilgileriniz bulunamadı.")
          return NextResponse.json({ ok: true })
        }

        // Ödeme talebi oluştur
        const paymentRequest = await createPaymentRequest(userData.id, stateData.payment_info.cardBalance)

        if (paymentRequest) {
          await sendTelegramMessage(
            chatId,
            `
✅ *Ödeme talebiniz alındı!*

Talebiniz incelendikten sonra sanal kartınız size gönderilecektir.
Talep ID: \`${paymentRequest.id}\`
            `,
            { parse_mode: "Markdown" },
          )

          // Kullanıcı durumunu temizle
          await updateUserState(chatId, "main_menu")
        } else {
          await sendTelegramMessage(
            chatId,
            "❌ Ödeme talebi oluşturulurken bir hata oluştu. Lütfen daha sonra tekrar deneyin.",
          )
        }
      } else if (data === "redeem_card") {
        // Kullanıcı ID'sini al
        const supabase = createServerSupabaseClient()
        const { data: userData } = await supabase.from("users").select("id").eq("telegram_id", chatId).single()

        if (!userData) {
          await sendTelegramMessage(chatId, "❌ Kullanıcı bilgileriniz bulunamadı.")
          return NextResponse.json({ ok: true })
        }

        // Kullanıcının kartlarını getir
        const cards = await getUserCards(userData.id)

        if (cards.length === 0) {
          await sendTelegramMessage(chatId, "❌ Henüz bir sanal kartınız bulunmamaktadır.")
          return NextResponse.json({ ok: true })
        }

        // Kartları listele
        const keyboard = {
          inline_keyboard: cards.map((card) => {
            return [
              {
                text: `💳 ${card.card_number.slice(-4)} - Bakiye: ${card.balance} TL`,
                callback_data: `select_card:${card.id}`,
              },
            ]
          }),
        }

        await sendTelegramMessage(chatId, "🔄 Bozmak istediğiniz kartı seçin:", {
          reply_markup: keyboard,
        })
      } else if (data.startsWith("select_card:")) {
        const cardId = data.split(":")[1]

        // Kart bilgilerini kaydet
        await updateUserState(chatId, "waiting_trx_address", { selected_card_id: cardId })

        // TRX adresi iste
        await sendTelegramMessage(chatId, "💼 TRX cüzdan adresinizi girin:")
      } else if (data === "my_cards") {
        // Kullanıcı ID'sini al
        const supabase = createServerSupabaseClient()
        const { data: userData } = await supabase.from("users").select("id").eq("telegram_id", chatId).single()

        if (!userData) {
          await sendTelegramMessage(chatId, "❌ Kullanıcı bilgileriniz bulunamadı.")
          return NextResponse.json({ ok: true })
        }

        // Kullanıcının kartlarını getir
        const cards = await getUserCards(userData.id)

        if (cards.length === 0) {
          await sendTelegramMessage(chatId, "❌ Henüz bir sanal kartınız bulunmamaktadır.")
          return NextResponse.json({ ok: true })
        }

        // Kartları listele
        let message = "💳 *Kartlarınız:*\n\n"

        cards.forEach((card, index) => {
          message += `*${index + 1}.* Kart: \`${card.card_number.slice(0, 4)}...${card.card_number.slice(-4)}\`\n`
          message += `   Bakiye: \`${card.balance} TL\`\n`
          message += `   Son Kullanma: \`${card.expiry_date}\`\n`
          message += `   Durum: ${card.is_used ? "❌ Kullanılmış" : "✅ Aktif"}\n\n`
        })

        await sendTelegramMessage(chatId, message)
      } else if (data === "help") {
        const helpMessage = `
🔍 *Yardım & SSS*

*Sanal Kart Nedir?*
Sanal kartlar, fiziksel bir karta ihtiyaç duymadan online alışveriş yapmanızı sağlayan kartlardır.

*Nasıl Kart Satın Alabilirim?*
Ana menüden "Sanal Kart Satın Al" butonuna tıklayın, istediğiniz bakiyeyi girin, ödeme yapın ve onay verin.

*Kart Bozumu Nedir?*
Kartınızda kalan bakiyeyi TRX olarak geri alabilirsiniz.

*Kartım Güvenli mi?*
Evet, tüm kart bilgileri güvenli bir şekilde saklanmaktadır.

Daha fazla soru için bize ulaşabilirsiniz.
        `

        await sendTelegramMessage(chatId, helpMessage)
      }
    }

    console.log("=== WEBHOOK PROCESSED SUCCESSFULLY ===")
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("=== WEBHOOK ERROR ===", error)
    return NextResponse.json({ error: "Internal server error", message: error.message }, { status: 500 })
  }
}

