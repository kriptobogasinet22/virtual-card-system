import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"

// In-memory state management (geçici çözüm)
const userStates = new Map<number, { state: string; data?: any; timestamp: number }>()

// State'i temizleme (5 dakika sonra)
setInterval(() => {
  const now = Date.now()
  for (const [chatId, stateInfo] of userStates.entries()) {
    if (now - stateInfo.timestamp > 5 * 60 * 1000) {
      userStates.delete(chatId)
    }
  }
}, 60000)

// Telegram Bot API fonksiyonları
async function sendTelegramMessage(chatId: number, text: string, options?: any) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) {
    console.error("TELEGRAM_BOT_TOKEN not found")
    return false
  }

  try {
    console.log(`[${chatId}] Sending: ${text.substring(0, 50)}...`)

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

    if (!result.ok) {
      console.error(`[${chatId}] Telegram API error:`, result)
      return false
    }

    console.log(`[${chatId}] Message sent successfully`)
    return true
  } catch (error) {
    console.error(`[${chatId}] Error sending message:`, error)
    return false
  }
}

// registerUser fonksiyonunu güncelle - daha güvenilir hale getir
async function registerUser(telegramUser: any) {
  const supabase = createServerSupabaseClient()

  try {
    console.log(`[${telegramUser.id}] Registering user:`, telegramUser)

    // Önce kullanıcının var olup olmadığını kontrol et
    const { data: existingUser, error: selectError } = await supabase
      .from("users")
      .select("*")
      .eq("telegram_id", telegramUser.id)
      .single()

    if (existingUser && !selectError) {
      console.log(`[${telegramUser.id}] User already exists:`, existingUser.id)
      return existingUser
    }

    // Kullanıcı yoksa oluştur
    const { data: newUser, error: insertError } = await supabase
      .from("users")
      .insert({
        telegram_id: telegramUser.id,
        username: telegramUser.username || null,
        first_name: telegramUser.first_name || null,
        last_name: telegramUser.last_name || null,
        user_metadata: { created_at: new Date().toISOString() },
      })
      .select()
      .single()

    if (insertError) {
      console.error(`[${telegramUser.id}] Error creating user:`, insertError)
      return null
    }

    console.log(`[${telegramUser.id}] User created successfully:`, newUser.id)
    return newUser
  } catch (error) {
    console.error(`[${telegramUser.id}] Database error in registerUser:`, error)
    return null
  }
}

// getUserFromDatabase fonksiyonu ekle
async function getUserFromDatabase(telegramId: number) {
  const supabase = createServerSupabaseClient()

  try {
    const { data: user, error } = await supabase.from("users").select("*").eq("telegram_id", telegramId).single()

    if (error) {
      console.error(`[${telegramId}] Error fetching user:`, error)
      return null
    }

    console.log(`[${telegramId}] User found in database:`, user.id)
    return user
  } catch (error) {
    console.error(`[${telegramId}] Database error in getUserFromDatabase:`, error)
    return null
  }
}

// In-memory state yönetimi
function setUserState(chatId: number, state: string, data?: any) {
  userStates.set(chatId, {
    state,
    data,
    timestamp: Date.now(),
  })
  console.log(`[${chatId}] State set to: ${state}`, data)
}

function getUserState(chatId: number) {
  const stateInfo = userStates.get(chatId)
  if (!stateInfo) {
    console.log(`[${chatId}] No state found, defaulting to main_menu`)
    return { state: "main_menu", data: {} }
  }
  console.log(`[${chatId}] Current state: ${stateInfo.state}`, stateInfo.data)
  return { state: stateInfo.state, data: stateInfo.data || {} }
}

function clearUserState(chatId: number) {
  userStates.delete(chatId)
  console.log(`[${chatId}] State cleared`)
}

// Ödeme talebi oluşturma - düzeltilmiş versiyon
async function createPaymentRequest(userId: string, cardBalance: number, telegramId: number) {
  const supabase = createServerSupabaseClient()
  const serviceFee = cardBalance * 0.2
  const totalAmount = cardBalance + serviceFee

  try {
    console.log(`Creating payment request for user ${userId}, balance: ${cardBalance}`)

    const { data, error } = await supabase
      .from("payment_requests")
      .insert({
        user_id: userId,
        card_balance: cardBalance,
        service_fee: serviceFee,
        total_amount: totalAmount,
        status: "pending",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating payment request:", error)
      return null
    }

    console.log("Payment request created successfully:", data)
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

// TRX cüzdan adresini dinamik olarak al
async function getTrxWalletAddress() {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/get-settings`)
    const data = await response.json()
    return data.settings?.trx_wallet_address || "TXYourTronWalletAddressHere"
  } catch (error) {
    console.error("Error fetching TRX address:", error)
    return "TXYourTronWalletAddressHere"
  }
}

// Mesajları temizleme fonksiyonu
async function clearChatHistory(chatId: number) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) return

  try {
    // Son 50 mesajı al ve sil
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates?offset=-50`)
    const result = await response.json()

    if (result.ok && result.result) {
      for (const update of result.result) {
        if (update.message && update.message.chat.id === chatId) {
          try {
            await fetch(`https://api.telegram.org/bot${botToken}/deleteMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                message_id: update.message.message_id,
              }),
            })
          } catch (deleteError) {
            // Mesaj silinemezse devam et
          }
        }
      }
    }
  } catch (error) {
    console.error("Error clearing chat history:", error)
  }
}

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
      console.log("Telegram update:", JSON.stringify(update, null, 2))
    } catch (e) {
      console.error("Failed to parse request body:", e)
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    // Mesaj işleme bölümünde - kullanıcı kaydını her zaman yap
    if (update.message) {
      const message = update.message
      const chatId = message.chat.id
      const text = message.text || ""
      const user = message.from

      console.log(`[${chatId}] Processing message: "${text}"`)

      // Kullanıcıyı kaydet ve ID'sini al
      let userData = null
      if (user) {
        userData = await registerUser(user)
        if (!userData) {
          console.error(`[${chatId}] Failed to register user, trying to fetch from database`)
          userData = await getUserFromDatabase(user.id)
        }
      }

      console.log(`[${chatId}] User data:`, userData ? userData.id : "null")

      // /start komutu
      if (text === "/start") {
        console.log(`[${chatId}] Processing /start command`)

        // Önceki mesajları temizle
        await clearChatHistory(chatId)

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
        setUserState(chatId, "main_menu", { user_id: userData?.id })
        return NextResponse.json({ ok: true })
      }

      // /mycards komutu
      if (text === "/mycards") {
        console.log(`[${chatId}] Processing /mycards command`)

        // Kullanıcı bilgilerini al
        const userId = userData?.id

        if (!userId) {
          await sendTelegramMessage(chatId, "❌ Kullanıcı bilgileriniz bulunamadı. Lütfen /start komutunu kullanın.")
          return NextResponse.json({ ok: true })
        }

        // Kullanıcının kartlarını getir
        const cards = await getUserCards(userId)

        if (cards.length === 0) {
          await sendTelegramMessage(chatId, "❌ Henüz bir sanal kartınız bulunmamaktadır.")
          return NextResponse.json({ ok: true })
        }

        // Kartları detaylı şekilde listele
        let message = "💳 *Sanal Kartlarınız:*\n\n"

        cards.forEach((card, index) => {
          message += `*${index + 1}. Kart*\n`
          message += `🔢 Kart No: \`${card.card_number}\`\n`
          message += `🔐 CVV: \`${card.cvv}\`\n`
          message += `📅 Son Kullanma: \`${card.expiry_date}\`\n`
          message += `💰 Bakiye: \`${card.balance} TL\`\n`
          message += `📊 Durum: ${card.is_used ? "❌ Kullanılmış" : "✅ Aktif"}\n`
          message += `📆 Alım Tarihi: ${new Date(card.assigned_at || card.created_at).toLocaleDateString("tr-TR")}\n\n`
        })

        message += "⚠️ *Güvenlik Uyarısı:*\nKart bilgilerinizi kimseyle paylaşmayın!"

        await sendTelegramMessage(chatId, message)
        return NextResponse.json({ ok: true })
      }

      // Kullanıcı durumunu kontrol et
      const { state, data: stateData } = getUserState(chatId)
      console.log(`[${chatId}] Current state: ${state}`, stateData)

      // Bakiye girişi bekleniyor mu?
      if (state === "waiting_card_balance") {
        console.log(`[${chatId}] Processing card balance input: "${text}"`)

        // Sadece sayıları al
        const cleanText = text.replace(/[^\d.,]/g, "").replace(",", ".")
        const cardBalance = Number.parseFloat(cleanText)

        console.log(`[${chatId}] Parsed balance: ${cardBalance}`)

        if (isNaN(cardBalance) || cardBalance <= 0) {
          await sendTelegramMessage(chatId, "❌ Geçersiz bakiye değeri. Lütfen sadece sayı girin:\n\nÖrnek: 500")
          return NextResponse.json({ ok: true })
        }

        if (cardBalance < 500) {
          await sendTelegramMessage(
            chatId,
            "❌ Minimum kart bakiyesi 500 TL olmalıdır. Lütfen tekrar girin:\n\nÖrnek: 500",
          )
          return NextResponse.json({ ok: true })
        }

        if (cardBalance > 50000) {
          await sendTelegramMessage(chatId, "❌ Maksimum kart bakiyesi 50.000 TL olabilir. Lütfen tekrar girin:")
          return NextResponse.json({ ok: true })
        }

        // Ödeme detaylarını hesapla
        const serviceFee = cardBalance * 0.2
        const totalAmount = cardBalance + serviceFee

        console.log(`[${chatId}] Payment details calculated:`, { cardBalance, serviceFee, totalAmount })

        // TRX adresini dinamik olarak al
        const TRX_WALLET_ADDRESS = await getTrxWalletAddress()

        // Ödeme bilgilerini göster
        const paymentMessage = `💳 *Sanal Kart Satın Alma*

İstediğiniz Kart Bakiyesi: *${cardBalance.toFixed(2)} TL*
Hizmet Bedeli (%20): *${serviceFee.toFixed(2)} TL*
Toplam Ödeme: *${totalAmount.toFixed(2)} TRX*

Ödeme adresi: \`${TRX_WALLET_ADDRESS}\`

Ödemeyi yaptıktan sonra "Ödeme Yaptım" butonuna tıklayın.`

        await sendTelegramMessage(chatId, paymentMessage, {
          reply_markup: {
            inline_keyboard: [
              [{ text: "✅ Ödeme Yaptım", callback_data: "payment_done" }],
              [{ text: "❌ İptal Et", callback_data: "cancel_payment" }],
            ],
          },
        })

        // Kullanıcı durumunu güncelle - user_id'yi kesinlikle kaydet
        setUserState(chatId, "waiting_payment_confirmation", {
          payment_info: { cardBalance, serviceFee, totalAmount },
          user_id: userData?.id,
          telegram_id: chatId,
        })

        console.log(`[${chatId}] State updated with user_id: ${userData?.id}`)
        return NextResponse.json({ ok: true })
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
        const userId = stateData.user_id

        if (!cardId || !userId) {
          await sendTelegramMessage(chatId, "❌ Bir hata oluştu. Lütfen tekrar kart seçin.")
          setUserState(chatId, "main_menu")
          return NextResponse.json({ ok: true })
        }

        // Kart bilgilerini al
        const supabase = createServerSupabaseClient()
        const { data: cardData } = await supabase.from("virtual_cards").select("*").eq("id", cardId).single()

        if (!cardData) {
          await sendTelegramMessage(chatId, "❌ Kart bilgileri bulunamadı.")
          return NextResponse.json({ ok: true })
        }

        // Kart bozum talebi oluştur
        const redemptionRequest = await createCardRedemptionRequest(userId, cardId, cardData.balance, trxAddress)

        if (redemptionRequest) {
          await sendTelegramMessage(
            chatId,
            `✅ *Kart bozum talebiniz alındı!*

Talebiniz incelendikten sonra TRX adresinize ödeme yapılacaktır.
Talep ID: \`${redemptionRequest.id}\``,
          )

          // Kullanıcı durumunu temizle
          setUserState(chatId, "main_menu")
        } else {
          await sendTelegramMessage(
            chatId,
            "❌ Kart bozum talebi oluşturulurken bir hata oluştu. Lütfen daha sonra tekrar deneyin.",
          )
        }

        return NextResponse.json({ ok: true })
      }
      // Diğer mesajlar için genel yanıt
      else {
        console.log(`[${chatId}] Unhandled message in state: ${state}`)
        await sendTelegramMessage(chatId, "Merhaba! Lütfen menüden bir seçenek seçin veya /start komutunu kullanın.")
        return NextResponse.json({ ok: true })
      }
    }

    // Callback query işleme bölümünde de aynı şekilde güncelle
    if (update.callback_query) {
      const callbackQuery = update.callback_query
      const chatId = callbackQuery.message?.chat.id
      const data = callbackQuery.data
      const user = callbackQuery.from

      console.log(`[${chatId}] Processing callback: "${data}"`)

      if (!chatId) {
        console.error("Chat ID not found in callback query")
        return NextResponse.json({ ok: true })
      }

      // Kullanıcıyı kaydet ve ID'sini al
      let userData = null
      if (user) {
        userData = await registerUser(user)
        if (!userData) {
          console.error(`[${chatId}] Failed to register user, trying to fetch from database`)
          userData = await getUserFromDatabase(user.id)
        }
      }

      console.log(`[${chatId}] Callback user data:`, userData ? userData.id : "null")

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
        console.log(`[${chatId}] Starting card purchase flow`)

        // Önceki mesajları temizle
        await clearChatHistory(chatId)

        await sendTelegramMessage(
          chatId,
          "💳 *Sanal Kart Satın Alma*\n\nLütfen satın almak istediğiniz kartın bakiyesini TL cinsinden girin:\n\nÖrnek: 500\n\n💡 Not: Girdiğiniz tutara %20 hizmet bedeli eklenecektir.\n\n📝 Minimum: 500 TL, Maksimum: 50.000 TL",
        )

        setUserState(chatId, "waiting_card_balance", { user_id: userData?.id })
        console.log(`[${chatId}] State set to waiting_card_balance`)
      } else if (data === "payment_done") {
        console.log(`[${chatId}] Processing payment_done callback`)

        // Kullanıcı bilgilerini al
        const { state, data: stateData } = getUserState(chatId)
        console.log(`[${chatId}] Payment state:`, state, stateData)

        if (state !== "waiting_payment_confirmation" || !stateData.payment_info) {
          await sendTelegramMessage(chatId, "❌ Bir hata oluştu. Lütfen tekrar kart satın alma işlemini başlatın.")
          setUserState(chatId, "main_menu")
          return NextResponse.json({ ok: true })
        }

        // Kullanıcı ID'sini farklı kaynaklardan al
        let userId = stateData.user_id || userData?.id

        // Eğer hala userId yoksa, telegram_id ile veritabanından bul
        if (!userId && stateData.telegram_id) {
          const dbUser = await getUserFromDatabase(stateData.telegram_id)
          userId = dbUser?.id
        }

        // Son çare olarak chatId ile bul
        if (!userId) {
          const dbUser = await getUserFromDatabase(chatId)
          userId = dbUser?.id
        }

        console.log(`[${chatId}] Final userId for payment: ${userId}`)

        if (!userId) {
          await sendTelegramMessage(
            chatId,
            "❌ Kullanıcı bilgileriniz bulunamadı. Lütfen /start komutunu kullanarak tekrar başlayın.",
          )
          clearUserState(chatId)
          return NextResponse.json({ ok: true })
        }

        // Ödeme talebi oluştur - telegram_id'yi de geç
        const paymentRequest = await createPaymentRequest(userId, stateData.payment_info.cardBalance, chatId)

        if (paymentRequest) {
          console.log(`[${chatId}] Payment request created successfully:`, paymentRequest.id)

          // Önceki mesajları temizle
          await clearChatHistory(chatId)

          await sendTelegramMessage(
            chatId,
            `✅ *Ödeme talebiniz alındı!*

Talebiniz incelendikten sonra sanal kartınız size gönderilecektir.
Talep ID: \`${paymentRequest.id}\`

⏱️ İşlem süresi: 1-24 saat`,
          )

          setUserState(chatId, "main_menu")
        } else {
          console.error(`[${chatId}] Failed to create payment request`)
          await sendTelegramMessage(
            chatId,
            "❌ Ödeme talebi oluşturulurken bir hata oluştu. Lütfen daha sonra tekrar deneyin.",
          )
        }
      } else if (data === "cancel_payment") {
        await clearChatHistory(chatId)
        await sendTelegramMessage(chatId, "❌ Ödeme işlemi iptal edildi.")
        setUserState(chatId, "main_menu")
      } else if (data === "redeem_card") {
        // Önceki mesajları temizle
        await clearChatHistory(chatId)

        // Kullanıcı bilgilerini al
        const userId = userData?.id

        if (!userId) {
          await sendTelegramMessage(chatId, "❌ Kullanıcı bilgileriniz bulunamadı.")
          return NextResponse.json({ ok: true })
        }

        // Kullanıcının kartlarını getir
        const cards = await getUserCards(userId)

        if (cards.length === 0) {
          await sendTelegramMessage(chatId, "❌ Henüz bir sanal kartınız bulunmamaktadır.")
          return NextResponse.json({ ok: true })
        }

        // Sadece aktif kartları göster
        const activeCards = cards.filter((card) => !card.is_used && card.balance > 0)

        if (activeCards.length === 0) {
          await sendTelegramMessage(chatId, "❌ Bozuma uygun aktif kartınız bulunmamaktadır.")
          return NextResponse.json({ ok: true })
        }

        // Kartları listele
        const keyboard = {
          inline_keyboard: activeCards.map((card) => {
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
        setUserState(chatId, "waiting_trx_address", {
          selected_card_id: cardId,
          user_id: userData?.id,
        })

        // TRX adresi iste
        await sendTelegramMessage(chatId, "💼 TRX cüzdan adresinizi girin:")
      } else if (data === "my_cards") {
        // Önceki mesajları temizle
        await clearChatHistory(chatId)

        // Kullanıcı bilgilerini al
        const userId = userData?.id

        if (!userId) {
          await sendTelegramMessage(chatId, "❌ Kullanıcı bilgileriniz bulunamadı.")
          return NextResponse.json({ ok: true })
        }

        // Kullanıcının kartlarını getir
        const cards = await getUserCards(userId)

        if (cards.length === 0) {
          await sendTelegramMessage(chatId, "❌ Henüz bir sanal kartınız bulunmamaktadır.")
          return NextResponse.json({ ok: true })
        }

        // Kartları detaylı şekilde listele
        let message = "💳 *Sanal Kartlarınız:*\n\n"

        cards.forEach((card, index) => {
          message += `*${index + 1}. Kart*\n`
          message += `🔢 Kart No: \`${card.card_number}\`\n`
          message += `🔐 CVV: \`${card.cvv}\`\n`
          message += `📅 Son Kullanma: \`${card.expiry_date}\`\n`
          message += `💰 Bakiye: \`${card.balance} TL\`\n`
          message += `📊 Durum: ${card.is_used ? "❌ Kullanılmış" : "✅ Aktif"}\n`
          message += `📆 Alım Tarihi: ${new Date(card.assigned_at || card.created_at).toLocaleDateString("tr-TR")}\n\n`
        })

        message += "⚠️ *Güvenlik Uyarısı:*\nKart bilgilerinizi kimseyle paylaşmayın!"

        await sendTelegramMessage(chatId, message)
      } else if (data === "help") {
        const helpMessage = `🔍 *Yardım & SSS*

*Sanal Kart Nedir?*
Sanal kartlar, fiziksel bir karta ihtiyaç duymadan online alışveriş yapmanızı sağlayan kartlardır.

*Nasıl Kart Satın Alabilirim?*
Ana menüden "Sanal Kart Satın Al" butonuna tıklayın, istediğiniz bakiyeyi girin, ödeme yapın ve onay verin.

*Kart Bozumu Nedir?*
Kartınızda kalan bakiyeyi TRX olarak geri alabilirsiniz.

*Kartım Güvenli mi?*
Evet, tüm kart bilgileri güvenli bir şekilde saklanmaktadır.

*Minimum Tutar:* 500 TL
*Maksimum Tutar:* 50.000 TL

Daha fazla soru için bize ulaşabilirsiniz.`

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
