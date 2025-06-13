import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { getGlobalSettings } from "@/lib/settings"

// In-memory state management
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

// Mesajları silme fonksiyonu
async function deleteMessage(chatId: number, messageId: number) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) return false

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/deleteMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
      }),
    })
    return true
  } catch (error) {
    console.error("Error deleting message:", error)
    return false
  }
}

// Mesajı düzenleme fonksiyonu
async function editMessage(chatId: number, messageId: number, text: string, options?: any) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) return false

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: "Markdown",
        ...options,
      }),
    })

    const result = await response.json()
    return result.ok
  } catch (error) {
    console.error("Error editing message:", error)
    return false
  }
}

// registerUser fonksiyonu
async function registerUser(telegramUser: any) {
  const supabase = createServerSupabaseClient()

  try {
    console.log(`[${telegramUser.id}] Registering user:`, telegramUser)

    const { data: existingUser, error: selectError } = await supabase
      .from("users")
      .select("*")
      .eq("telegram_id", telegramUser.id)
      .single()

    if (existingUser && !selectError) {
      console.log(`[${telegramUser.id}] User already exists:`, existingUser.id)
      return existingUser
    }

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

// State yönetimi
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

// TRX cüzdan adresini al - düzeltilmiş versiyon
function getTrxWalletAddress() {
  try {
    console.log("Getting TRX wallet address from global settings...")
    const settings = getGlobalSettings()
    const address = settings.trx_wallet_address || "TXYourTronWalletAddressHere"
    console.log("Using TRX address:", address)
    return address
  } catch (error) {
    console.error("Error getting TRX address:", error)
    return "TXYourTronWalletAddressHere"
  }
}

// Webhook handler
export async function POST(req: NextRequest) {
  try {
    console.log("=== WEBHOOK RECEIVED ===")

    const secret = req.nextUrl.searchParams.get("secret")
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET || "webhook_secret_2024_secure"

    if (secret !== expectedSecret) {
      console.error("Invalid webhook secret")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let update
    try {
      update = await req.json()
      console.log("Telegram update:", JSON.stringify(update, null, 2))
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

      console.log(`[${chatId}] Processing message: "${text}"`)

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

        const welcomeMessage = `🎉 *Sanal Kart Merkezi'ne Hoş Geldiniz!*

Merhaba ${user?.first_name || "Değerli Müşterimiz"}! 👋

🌟 *Premium Sanal Kart Hizmetleri:*
💳 Anında sanal kart satın alma
🔄 Güvenli kart bakiye bozumu  
📱 7/24 otomatik işlem desteği
🔒 Bankacılık seviyesinde güvenlik

✨ *Hızlı İşlemler:*`

        const keyboard = {
          inline_keyboard: [
            [{ text: "💳 Sanal Kart Satın Al", callback_data: "buy_card" }],
            [{ text: "🔄 Kart Bozumu", callback_data: "redeem_card" }],
            [{ text: "📋 Kartlarım", callback_data: "my_cards" }],
            [{ text: "❓ Yardım & Destek", callback_data: "help" }],
          ],
        }

        await sendTelegramMessage(chatId, welcomeMessage, { reply_markup: keyboard })
        setUserState(chatId, "main_menu", { user_id: userData?.id })
        return NextResponse.json({ ok: true })
      }

      // /mycards komutu
      if (text === "/mycards") {
        console.log(`[${chatId}] Processing /mycards command`)

        const userId = userData?.id

        if (!userId) {
          await sendTelegramMessage(
            chatId,
            "❌ *Kullanıcı Bulunamadı*\n\nLütfen önce /start komutunu kullanarak sisteme kayıt olun.",
          )
          return NextResponse.json({ ok: true })
        }

        const cards = await getUserCards(userId)

        if (cards.length === 0) {
          await sendTelegramMessage(
            chatId,
            "💳 *Sanal Kartlarınız*\n\n❌ Henüz hiç sanal kartınız bulunmamaktadır.\n\n💡 Hemen bir kart satın almak için /start komutunu kullanın!",
          )
          return NextResponse.json({ ok: true })
        }

        let message = "💳 *Sanal Kart Portföyünüz*\n\n"

        cards.forEach((card, index) => {
          const statusIcon = card.is_used ? "❌" : "✅"
          const statusText = card.is_used ? "Kullanılmış" : "Aktif"

          message += `🔹 *${index + 1}. Kart ${statusIcon}*\n`
          message += `┣ 🔢 Kart: \`${card.card_number}\`\n`
          message += `┣ 🔐 CVV: \`${card.cvv}\`\n`
          message += `┣ 📅 Geçerlilik: \`${card.expiry_date}\`\n`
          message += `┣ 💰 Bakiye: \`${card.balance.toFixed(2)} TL\`\n`
          message += `┣ 📊 Durum: ${statusText}\n`
          message += `┗ 📆 Tarih: ${new Date(card.assigned_at || card.created_at).toLocaleDateString("tr-TR")}\n\n`
        })

        message += "🔒 *Güvenlik Uyarısı:*\nKart bilgilerinizi asla üçüncü şahıslarla paylaşmayın!"

        await sendTelegramMessage(chatId, message)
        return NextResponse.json({ ok: true })
      }

      // Kullanıcı durumunu kontrol et
      const { state, data: stateData } = getUserState(chatId)
      console.log(`[${chatId}] Current state: ${state}`, stateData)

      // Bakiye girişi bekleniyor
      if (state === "waiting_card_balance") {
        console.log(`[${chatId}] Processing card balance input: "${text}"`)

        const cleanText = text.replace(/[^\d.,]/g, "").replace(",", ".")
        const cardBalance = Number.parseFloat(cleanText)

        console.log(`[${chatId}] Parsed balance: ${cardBalance}`)

        if (isNaN(cardBalance) || cardBalance <= 0) {
          await sendTelegramMessage(chatId, "❌ *Geçersiz Tutar*\n\nLütfen geçerli bir sayı girin.\n\n💡 *Örnek:* 1000")
          return NextResponse.json({ ok: true })
        }

        if (cardBalance < 500) {
          await sendTelegramMessage(
            chatId,
            "⚠️ *Minimum Tutar Uyarısı*\n\nMinimum kart bakiyesi 500 TL olmalıdır.\n\n💡 *Örnek:* 500",
          )
          return NextResponse.json({ ok: true })
        }

        if (cardBalance > 50000) {
          await sendTelegramMessage(
            chatId,
            "⚠️ *Maksimum Tutar Uyarısı*\n\nMaksimum kart bakiyesi 50.000 TL olabilir.\n\n💡 Lütfen daha düşük bir tutar girin.",
          )
          return NextResponse.json({ ok: true })
        }

        const serviceFee = cardBalance * 0.2
        const totalAmount = cardBalance + serviceFee

        console.log(`[${chatId}] Payment details calculated:`, { cardBalance, serviceFee, totalAmount })

        // TRX adresini global settings'den al
        const TRX_WALLET_ADDRESS = getTrxWalletAddress()

        const paymentMessage = `💎 *Premium Sanal Kart Siparişi*

🎯 *Sipariş Detayları:*
┣ 💳 Kart Bakiyesi: *${cardBalance.toFixed(2)} TL*
┣ 🔧 Hizmet Bedeli (%20): *${serviceFee.toFixed(2)} TL*
┗ 💵 **Toplam Ödeme: ${totalAmount.toFixed(2)} TRX**

🏦 *Ödeme Bilgileri:*
┣ 🌐 Ağ: TRON (TRC20)
┗ 📤 Adres: \`${TRX_WALLET_ADDRESS}\`

⚡ *Hızlı İşlem:* Ödemenizi yaptıktan sonra aşağıdaki butona tıklayın.

⏱️ *İşlem Süresi:* 1-24 saat içinde kartınız hazır!`

        await sendTelegramMessage(chatId, paymentMessage, {
          reply_markup: {
            inline_keyboard: [
              [{ text: "✅ Ödeme Yaptım", callback_data: "payment_done" }],
              [{ text: "❌ İptal Et", callback_data: "cancel_payment" }],
            ],
          },
        })

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

        if (!trxAddress.startsWith("T") || trxAddress.length < 30) {
          await sendTelegramMessage(
            chatId,
            "❌ *Geçersiz TRX Adresi*\n\nLütfen geçerli bir TRON cüzdan adresi girin.\n\n💡 *Format:* T ile başlamalı ve en az 30 karakter olmalı",
          )
          return NextResponse.json({ ok: true })
        }

        const cardId = stateData.selected_card_id
        const userId = stateData.user_id

        if (!cardId || !userId) {
          await sendTelegramMessage(chatId, "❌ Bir hata oluştu. Lütfen tekrar kart seçin.")
          setUserState(chatId, "main_menu")
          return NextResponse.json({ ok: true })
        }

        const supabase = createServerSupabaseClient()
        const { data: cardData } = await supabase.from("virtual_cards").select("*").eq("id", cardId).single()

        if (!cardData) {
          await sendTelegramMessage(chatId, "❌ Kart bilgileri bulunamadı.")
          return NextResponse.json({ ok: true })
        }

        const redemptionRequest = await createCardRedemptionRequest(userId, cardId, cardData.balance, trxAddress)

        if (redemptionRequest) {
          await sendTelegramMessage(
            chatId,
            `✅ *Bozum Talebi Alındı!*

🎯 *Talep Detayları:*
┣ 🆔 Talep ID: \`${redemptionRequest.id}\`
┣ 💰 Bozum Tutarı: ${cardData.balance} TL
┗ 📤 TRX Adresi: \`${trxAddress}\`

⏱️ *İşlem Süresi:* 1-24 saat
🔔 *Bildirim:* İşlem tamamlandığında size haber vereceğiz.

Teşekkür ederiz! 🙏`,
          )

          setUserState(chatId, "main_menu")
        } else {
          await sendTelegramMessage(
            chatId,
            "❌ *İşlem Hatası*\n\nKart bozum talebi oluşturulurken bir hata oluştu.\n\n🔄 Lütfen daha sonra tekrar deneyin.",
          )
        }

        return NextResponse.json({ ok: true })
      }
      // Diğer mesajlar
      else {
        console.log(`[${chatId}] Unhandled message in state: ${state}`)
        await sendTelegramMessage(
          chatId,
          "👋 *Merhaba!*\n\nLütfen menüden bir seçenek seçin veya /start komutunu kullanın.\n\n💡 Hızlı erişim için /mycards komutunu da kullanabilirsiniz.",
        )
        return NextResponse.json({ ok: true })
      }
    }

    // Callback query işleme
    if (update.callback_query) {
      const callbackQuery = update.callback_query
      const chatId = callbackQuery.message?.chat.id
      const messageId = callbackQuery.message?.message_id
      const data = callbackQuery.data
      const user = callbackQuery.from

      console.log(`[${chatId}] Processing callback: "${data}"`)

      if (!chatId) {
        console.error("Chat ID not found in callback query")
        return NextResponse.json({ ok: true })
      }

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

        // Önceki mesajı düzenle
        if (messageId) {
          await editMessage(
            chatId,
            messageId,
            `💳 *Sanal Kart Satın Alma*

🎯 *Premium Sanal Kart Özellikleri:*
┣ ✅ Anında kullanıma hazır
┣ 🌍 Tüm online platformlarda geçerli
┣ 🔒 256-bit SSL güvenlik
┗ 💯 %100 başarı garantisi

💰 *Fiyatlandırma:*
┣ 🎯 İstediğiniz bakiye + %20 hizmet bedeli
┣ 💵 Minimum: 500 TL
┗ 🏆 Maksimum: 50.000 TL

📝 Lütfen istediğiniz kart bakiyesini TL cinsinden yazın:`,
          )
        }

        setUserState(chatId, "waiting_card_balance", { user_id: userData?.id })
        console.log(`[${chatId}] State set to waiting_card_balance`)
      } else if (data === "payment_done") {
        console.log(`[${chatId}] Processing payment_done callback`)

        const { state, data: stateData } = getUserState(chatId)
        console.log(`[${chatId}] Payment state:`, state, stateData)

        if (state !== "waiting_payment_confirmation" || !stateData.payment_info) {
          await sendTelegramMessage(chatId, "❌ Bir hata oluştu. Lütfen tekrar kart satın alma işlemini başlatın.")
          setUserState(chatId, "main_menu")
          return NextResponse.json({ ok: true })
        }

        let userId = stateData.user_id || userData?.id

        if (!userId && stateData.telegram_id) {
          const dbUser = await getUserFromDatabase(stateData.telegram_id)
          userId = dbUser?.id
        }

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

        const paymentRequest = await createPaymentRequest(userId, stateData.payment_info.cardBalance, chatId)

        if (paymentRequest) {
          console.log(`[${chatId}] Payment request created successfully:`, paymentRequest.id)

          // Önceki mesajı düzenle
          if (messageId) {
            await editMessage(
              chatId,
              messageId,
              `✅ *Ödeme Talebi Alındı!*

🎉 *Tebrikler!* Ödeme talebiniz başarıyla kaydedildi.

🎯 *Talep Detayları:*
┣ 🆔 Talep ID: \`${paymentRequest.id}\`
┣ 💳 Kart Bakiyesi: ${stateData.payment_info.cardBalance} TL
┣ 💵 Ödenen Tutar: ${stateData.payment_info.totalAmount} TRX
┗ ⏱️ İşlem Süresi: 1-24 saat

🔔 *Bildirim:* Kartınız hazır olduğunda size haber vereceğiz.

Teşekkür ederiz! 🙏`,
            )
          }

          setUserState(chatId, "main_menu")
        } else {
          console.error(`[${chatId}] Failed to create payment request`)
          await sendTelegramMessage(
            chatId,
            "❌ Ödeme talebi oluşturulurken bir hata oluştu. Lütfen daha sonra tekrar deneyin.",
          )
        }
      } else if (data === "cancel_payment") {
        if (messageId) {
          await editMessage(chatId, messageId, "❌ *İşlem İptal Edildi*\n\nÖdeme işlemi iptal edildi.")
        }
        setUserState(chatId, "main_menu")
      } else if (data === "redeem_card") {
        const userId = userData?.id

        if (!userId) {
          await sendTelegramMessage(chatId, "❌ Kullanıcı bilgileriniz bulunamadı.")
          return NextResponse.json({ ok: true })
        }

        const cards = await getUserCards(userId)

        if (cards.length === 0) {
          if (messageId) {
            await editMessage(
              chatId,
              messageId,
              "💳 *Kart Bozumu*\n\n❌ Henüz hiç sanal kartınız bulunmamaktadır.\n\n💡 Önce bir kart satın alın!",
            )
          }
          return NextResponse.json({ ok: true })
        }

        const activeCards = cards.filter((card) => !card.is_used && card.balance > 0)

        if (activeCards.length === 0) {
          if (messageId) {
            await editMessage(
              chatId,
              messageId,
              "🔄 *Kart Bozumu*\n\n❌ Bozuma uygun aktif kartınız bulunmamaktadır.\n\n💡 Sadece kullanılmamış ve bakiyesi olan kartlar bozulabilir.",
            )
          }
          return NextResponse.json({ ok: true })
        }

        const keyboard = {
          inline_keyboard: activeCards.map((card) => {
            return [
              {
                text: `💳 ****${card.card_number.slice(-4)} - ${card.balance} TL`,
                callback_data: `select_card:${card.id}`,
              },
            ]
          }),
        }

        if (messageId) {
          await editMessage(
            chatId,
            messageId,
            `🔄 *Kart Bozumu*

💰 *Bozuma Uygun Kartlarınız:*

Bozmak istediğiniz kartı seçin:`,
            { reply_markup: keyboard },
          )
        }
      } else if (data.startsWith("select_card:")) {
        const cardId = data.split(":")[1]

        setUserState(chatId, "waiting_trx_address", {
          selected_card_id: cardId,
          user_id: userData?.id,
        })

        if (messageId) {
          await editMessage(
            chatId,
            messageId,
            `💼 *TRX Cüzdan Adresi*

🎯 Kart bozum tutarının gönderileceği TRON (TRC20) cüzdan adresinizi girin:

💡 *Örnek Format:* TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE

⚠️ *Önemli:* Adresin doğru olduğundan emin olun!`,
          )
        }
      } else if (data === "my_cards") {
        const userId = userData?.id

        if (!userId) {
          if (messageId) {
            await editMessage(chatId, messageId, "❌ Kullanıcı bilgileriniz bulunamadı.")
          }
          return NextResponse.json({ ok: true })
        }

        const cards = await getUserCards(userId)

        if (cards.length === 0) {
          if (messageId) {
            await editMessage(
              chatId,
              messageId,
              "💳 *Sanal Kartlarınız*\n\n❌ Henüz hiç sanal kartınız bulunmamaktadır.\n\n💡 Hemen bir kart satın almak için /start komutunu kullanın!",
            )
          }
          return NextResponse.json({ ok: true })
        }

        let message = "💳 *Sanal Kart Portföyünüz*\n\n"

        cards.forEach((card, index) => {
          const statusIcon = card.is_used ? "❌" : "✅"
          const statusText = card.is_used ? "Kullanılmış" : "Aktif"

          message += `🔹 *${index + 1}. Kart ${statusIcon}*\n`
          message += `┣ 🔢 Kart: \`${card.card_number}\`\n`
          message += `┣ 🔐 CVV: \`${card.cvv}\`\n`
          message += `┣ 📅 Geçerlilik: \`${card.expiry_date}\`\n`
          message += `┣ 💰 Bakiye: \`${card.balance.toFixed(2)} TL\`\n`
          message += `┣ 📊 Durum: ${statusText}\n`
          message += `┗ 📆 Tarih: ${new Date(card.assigned_at || card.created_at).toLocaleDateString("tr-TR")}\n\n`
        })

        message += "🔒 *Güvenlik Uyarısı:*\nKart bilgilerinizi asla üçüncü şahıslarla paylaşmayın!"

        if (messageId) {
          await editMessage(chatId, messageId, message)
        }
      } else if (data === "help") {
        const helpMessage = `🆘 *Yardım & Destek Merkezi*

🎯 *Hızlı Başlangıç:*
┣ 💳 Kart satın almak için bakiye girin
┣ 🔄 Kart bozmak için aktif kartınızı seçin
┗ 📋 Kartlarınızı görmek için "Kartlarım"a tıklayın

💰 *Fiyatlandırma:*
┣ 🎯 İstediğiniz bakiye + %20 hizmet bedeli
┣ 💵 Minimum: 500 TL
┗ 🏆 Maksimum: 50.000 TL

🔒 *Güvenlik:*
┣ ✅ 256-bit SSL şifreleme
┣ 🏦 Bankacılık seviyesinde güvenlik
┗ 🔐 Kişisel verileriniz korunur

⚡ *İşlem Süreleri:*
┣ 💳 Kart teslimatı: 1-24 saat
┗ 🔄 Bozum işlemi: 1-24 saat

📞 *Destek:* 7/24 otomatik sistem aktif`

        if (messageId) {
          await editMessage(chatId, messageId, helpMessage)
        }
      }
    }

    console.log("=== WEBHOOK PROCESSED SUCCESSFULLY ===")
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("=== WEBHOOK ERROR ===", error)
    return NextResponse.json({ error: "Internal server error", message: error.message }, { status: 500 })
  }
}
