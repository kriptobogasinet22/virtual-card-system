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

// Geliştirilmiş kullanıcı kayıt fonksiyonu
async function ensureUserExists(telegramUser: any) {
  const supabase = createServerSupabaseClient()

  try {
    console.log(`[${telegramUser.id}] Ensuring user exists:`, {
      id: telegramUser.id,
      username: telegramUser.username,
      first_name: telegramUser.first_name,
      last_name: telegramUser.last_name,
    })

    // Önce kullanıcının var olup olmadığını kontrol et
    const { data: existingUser, error: selectError } = await supabase
      .from("users")
      .select("*")
      .eq("telegram_id", telegramUser.id)
      .maybeSingle()

    if (existingUser && !selectError) {
      console.log(`[${telegramUser.id}] User already exists:`, existingUser.id)

      // Kullanıcı bilgilerini güncelle (username değişmiş olabilir)
      const { data: updatedUser, error: updateError } = await supabase
        .from("users")
        .update({
          username: telegramUser.username || null,
          first_name: telegramUser.first_name || null,
          last_name: telegramUser.last_name || null,
        })
        .eq("telegram_id", telegramUser.id)
        .select()
        .single()

      if (updateError) {
        console.error(`[${telegramUser.id}] Error updating user:`, updateError)
        return existingUser // Güncelleme başarısız olsa bile mevcut kullanıcıyı döndür
      }

      console.log(`[${telegramUser.id}] User updated successfully`)
      return updatedUser || existingUser
    }

    // Kullanıcı yoksa oluştur
    console.log(`[${telegramUser.id}] Creating new user...`)

    const newUserData = {
      telegram_id: telegramUser.id,
      username: telegramUser.username || null,
      first_name: telegramUser.first_name || null,
      last_name: telegramUser.last_name || null,
      created_at: new Date().toISOString(),
    }

    console.log(`[${telegramUser.id}] Inserting user data:`, newUserData)

    const { data: newUser, error: insertError } = await supabase.from("users").insert(newUserData).select().single()

    if (insertError) {
      console.error(`[${telegramUser.id}] Error creating user:`, insertError)

      // Eğer unique constraint hatası ise, tekrar dene
      if (insertError.code === "23505") {
        console.log(`[${telegramUser.id}] Unique constraint error, trying to fetch existing user`)
        const { data: retryUser, error: retryError } = await supabase
          .from("users")
          .select("*")
          .eq("telegram_id", telegramUser.id)
          .single()

        if (!retryError && retryUser) {
          console.log(`[${telegramUser.id}] Found existing user on retry:`, retryUser.id)
          return retryUser
        }
      }

      return null
    }

    console.log(`[${telegramUser.id}] User created successfully:`, newUser.id)
    return newUser
  } catch (error) {
    console.error(`[${telegramUser.id}] Database error in ensureUserExists:`, error)
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

// TRX cüzdan adresini al
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

// Ana menü gösterme fonksiyonu
async function showMainMenu(chatId: number, userName?: string) {
  const welcomeMessage = `🌟 *SANAL KART MERKEZİ* 🌟

👋 Hoş geldiniz ${userName || "Değerli Müşterimiz"}!

🎯 *Premium Hizmetlerimiz:*
┣ 💳 Anında sanal kart teslimatı
┣ 🔄 Güvenli bakiye bozumu
┣ 📱 7/24 otomatik işlem
┗ 🔒 Bankacılık seviyesi güvenlik

✨ *Hızlı İşlemler:*`

  const keyboard = {
    inline_keyboard: [
      [
        { text: "💳 Sanal Kart Satın Al", callback_data: "buy_card" },
        { text: "🔄 Kart Bozumu", callback_data: "redeem_card" },
      ],
      [
        { text: "📋 Kartlarım", callback_data: "my_cards" },
        { text: "📊 Hesap Özeti", callback_data: "account_summary" },
      ],
      [
        { text: "❓ Yardım & Destek", callback_data: "help" },
        { text: "⚙️ Ayarlar", callback_data: "settings" },
      ],
    ],
  }

  await sendTelegramMessage(chatId, welcomeMessage, { reply_markup: keyboard })
}

// Yardım mesajı
async function showHelpMessage(chatId: number) {
  const helpMessage = `🆘 *YARDIM & DESTEK MERKEZİ*

🎯 *Hızlı Başlangıç Rehberi:*
┣ 💳 Kart satın almak için bakiye belirtin
┣ 🔄 Kart bozmak için aktif kartınızı seçin
┣ 📋 Kartlarınızı görüntülemek için "Kartlarım"
┗ 📊 Hesap özetinizi kontrol edin

💰 *Fiyatlandırma Bilgileri:*
┣ 🎯 İstediğiniz bakiye + %20 hizmet bedeli
┣ 💵 Minimum tutar: 500 TL
┣ 🏆 Maksimum tutar: 50.000 TL
┗ 💎 Premium kartlar için özel fiyatlar

🔒 *Güvenlik Önlemleri:*
┣ ✅ 256-bit SSL şifreleme
┣ 🏦 Bankacılık seviyesi güvenlik
┣ 🔐 Kişisel veriler korunur
┗ 🛡️ Anti-fraud sistemi aktif

⚡ *İşlem Süreleri:*
┣ 💳 Kart teslimatı: 1-24 saat
┣ 🔄 Bozum işlemi: 1-24 saat
┣ 📞 Destek yanıtı: Anında
┗ 🔔 Bildirimler: Gerçek zamanlı

📞 *İletişim Kanalları:*
┣ 🤖 Bot desteği: 7/24 aktif
┣ 💬 Canlı destek: Yakında
┗ 📧 E-posta: Yakında

🏠 Ana menüye dönmek için butona tıklayın.`

  const keyboard = {
    inline_keyboard: [
      [{ text: "🏠 Ana Menü", callback_data: "main_menu" }],
      [{ text: "📞 Canlı Destek", callback_data: "live_support" }],
    ],
  }

  await sendTelegramMessage(chatId, helpMessage, { reply_markup: keyboard })
}

// Kart satın alma işlemi
async function handleCardPurchase(chatId: number, userId: string) {
  setUserState(chatId, "waiting_balance")

  const message = `💳 *Sanal Kart Satın Alma*

Lütfen satın almak istediğiniz kartın bakiyesini TL cinsinden girin.

📝 *Örnek:* 100

💡 *Not:* Girdiğiniz tutara %20 hizmet bedeli eklenecektir.

İptal etmek için /start yazın.`

  await sendTelegramMessage(chatId, message)
}

// Bakiye onaylama
async function confirmBalance(chatId: number, userId: string, balance: number) {
  const serviceFee = balance * 0.2
  const totalAmount = balance + serviceFee
  const trxAddress = getTrxWalletAddress()

  const message = `💰 *Ödeme Bilgileri*

💳 Kart Bakiyesi: ${balance} TL
🔧 Hizmet Bedeli (%20): ${serviceFee} TL
💵 Toplam Ödeme: ${totalAmount} TRX

📤 *Ödeme Adresi:*
\`${trxAddress}\`

Ödemenizi yaptıktan sonra "Ödeme Yaptım" butonuna tıklayın.`

  const keyboard = {
    inline_keyboard: [
      [{ text: "✅ Ödeme Yaptım", callback_data: `payment_done_${balance}` }],
      [{ text: "❌ İptal Et", callback_data: "main_menu" }],
    ],
  }

  await sendTelegramMessage(chatId, message, { reply_markup: keyboard })
}

// Kullanıcı kartlarını göster
async function showUserCards(chatId: number, userId: string) {
  const cards = await getUserCards(userId)

  if (!cards || cards.length === 0) {
    const message = `📋 *Kartlarınız*

❌ Henüz kartınız bulunmamaktadır.

Kart satın almak için "Sanal Kart Satın Al" seçeneğini kullanın.`

    const keyboard = {
      inline_keyboard: [
        [{ text: "💳 Kart Satın Al", callback_data: "buy_card" }],
        [{ text: "🏠 Ana Menü", callback_data: "main_menu" }],
      ],
    }

    await sendTelegramMessage(chatId, message, { reply_markup: keyboard })
    return
  }

  let message = `📋 *Kartlarınız*\n\n`

  cards.forEach((card, index) => {
    const status = card.is_used ? "❌ Kullanılmış" : "✅ Aktif"
    const cardNumber = `**** **** **** ${card.card_number.slice(-4)}`

    message += `${index + 1}. ${cardNumber}\n`
    message += `   💰 Bakiye: ${card.balance} TL\n`
    message += `   📊 Durum: ${status}\n`
    message += `   📅 Son Kullanma: ${card.expiry_date}\n`
    message += `   🔐 CVV: ${card.cvv}\n\n`
  })

  const keyboard = {
    inline_keyboard: [
      [{ text: "🔄 Kart Bozumu", callback_data: "redeem_card" }],
      [{ text: "🏠 Ana Menü", callback_data: "main_menu" }],
    ],
  }

  await sendTelegramMessage(chatId, message, { reply_markup: keyboard })
}

// Kart bozumu işlemi
async function handleCardRedemption(chatId: number, userId: string) {
  const cards = await getUserCards(userId)
  const availableCards = cards.filter((card) => !card.is_used && card.balance > 0)

  if (!availableCards || availableCards.length === 0) {
    const message = `🔄 *Kart Bozumu*

❌ Bozuma uygun kartınız bulunmamaktadır.

Bozum için kartınızın:
- Kullanılmamış olması
- Bakiyesinin 0'dan fazla olması gerekir.`

    const keyboard = {
      inline_keyboard: [[{ text: "🏠 Ana Menü", callback_data: "main_menu" }]],
    }

    await sendTelegramMessage(chatId, message, { reply_markup: keyboard })
    return
  }

  let message = `🔄 *Kart Bozumu*

Bozuma uygun kartlarınız:\n\n`

  const keyboard = { inline_keyboard: [] as any[] }

  availableCards.forEach((card, index) => {
    const cardNumber = `**** **** **** ${card.card_number.slice(-4)}`
    message += `${index + 1}. ${cardNumber} - ${card.balance} TL\n`

    keyboard.inline_keyboard.push([
      {
        text: `${index + 1}. ${cardNumber} - ${card.balance} TL`,
        callback_data: `select_redeem_${card.id}`,
      },
    ])
  })

  keyboard.inline_keyboard.push([{ text: "🏠 Ana Menü", callback_data: "main_menu" }])

  await sendTelegramMessage(chatId, message, { reply_markup: keyboard })
}

// Hesap özeti gösterme
async function showAccountSummary(chatId: number, userId: string) {
  const cards = await getUserCards(userId)

  const totalCards = cards.length
  const activeCards = cards.filter((card) => !card.is_used).length
  const usedCards = cards.filter((card) => card.is_used).length
  const totalBalance = cards.reduce((sum, card) => sum + card.balance, 0)

  const summaryMessage = `📊 *HESAP ÖZETİNİZ*

👤 *Kullanıcı Bilgileri:*
┣ 🆔 Kullanıcı ID: \`${userId.slice(0, 8)}...\`
┣ 📅 Üyelik: ${new Date().toLocaleDateString("tr-TR")}
┗ 🏆 Durum: Premium Üye

💳 *Kart İstatistikleri:*
┣ 📊 Toplam Kart: ${totalCards}
┣ ✅ Aktif Kart: ${activeCards}
┣ ❌ Kullanılmış: ${usedCards}
┗ 💰 Toplam Bakiye: ${totalBalance.toFixed(2)} TL

📈 *Bu Ay:*
┣ 🛒 Satın Alınan: ${totalCards} kart
┣ 🔄 Bozulan: ${usedCards} kart
┗ 💸 Harcanan: Hesaplanıyor...

🎯 *Öneriler:*
${activeCards > 0 ? "✅ Aktif kartlarınızı kullanmayı unutmayın!" : "💡 Yeni kart satın almayı düşünün!"}
${totalBalance > 1000 ? "⚠️ Yüksek bakiyeli kartlarınızı güvende tutun!" : ""}`

  const keyboard = {
    inline_keyboard: [
      [
        { text: "💳 Kartlarım", callback_data: "my_cards" },
        { text: "📈 Detaylı Rapor", callback_data: "detailed_report" },
      ],
      [{ text: "🏠 Ana Menü", callback_data: "main_menu" }],
    ],
  }

  await sendTelegramMessage(chatId, summaryMessage, { reply_markup: keyboard })
}

// Ayarlar menüsü
async function showSettingsMenu(chatId: number) {
  const settingsMessage = `⚙️ *AYARLAR MENÜSÜ*

🔧 *Kullanılabilir Ayarlar:*
┣ 🔔 Bildirim tercihleri
┣ 🌐 Dil seçenekleri
┣ 🔒 Güvenlik ayarları
┗ 📱 Hesap yönetimi

💡 *Yakında Eklenecek:*
┣ 🎨 Tema seçenekleri
┣ 📊 Rapor ayarları
┗ 🔐 İki faktörlü doğrulama`

  const keyboard = {
    inline_keyboard: [
      [
        { text: "🔔 Bildirimler", callback_data: "notification_settings" },
        { text: "🌐 Dil", callback_data: "language_settings" },
      ],
      [
        { text: "🔒 Güvenlik", callback_data: "security_settings" },
        { text: "📱 Hesap", callback_data: "account_settings" },
      ],
      [{ text: "🏠 Ana Menü", callback_data: "main_menu" }],
    ],
  }

  await sendTelegramMessage(chatId, settingsMessage, { reply_markup: keyboard })
}

// Ana webhook handler
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.log("Telegram webhook received:", JSON.stringify(body, null, 2))

    const message = body.message
    const callbackQuery = body.callback_query

    if (message) {
      const chatId = message.chat.id
      const userId = message.from?.id
      const text = message.text
      const user = message.from

      if (!userId || !user) {
        console.log("No user ID found in message")
        return NextResponse.json({ ok: true })
      }

      // Kullanıcıyı kaydet/güncelle
      const dbUser = await ensureUserExists(user)
      if (!dbUser) {
        console.error("Failed to ensure user exists")
        await sendTelegramMessage(chatId, "❌ Bir hata oluştu. Lütfen tekrar deneyin.")
        return NextResponse.json({ ok: true })
      }

      const userState = getUserState(chatId)
      const userName = user.first_name || user.username || "Kullanıcı"

      // Komutları işle
      if (text === "/start") {
        clearUserState(chatId)
        await showMainMenu(chatId, userName)
        return NextResponse.json({ ok: true })
      }

      // State'e göre mesajları işle
      if (userState.state === "waiting_balance") {
        const balance = Number.parseFloat(text || "")

        if (isNaN(balance) || balance <= 0) {
          await sendTelegramMessage(chatId, "❌ Lütfen geçerli bir bakiye miktarı girin (örnek: 100)")
          return NextResponse.json({ ok: true })
        }

        if (balance < 10) {
          await sendTelegramMessage(chatId, "❌ Minimum kart bakiyesi 10 TL olmalıdır.")
          return NextResponse.json({ ok: true })
        }

        if (balance > 10000) {
          await sendTelegramMessage(chatId, "❌ Maksimum kart bakiyesi 10.000 TL olabilir.")
          return NextResponse.json({ ok: true })
        }

        await confirmBalance(chatId, dbUser.id, balance)
        setUserState(chatId, "waiting_payment", { balance })
        return NextResponse.json({ ok: true })
      }

      if (userState.state === "waiting_trx_address") {
        const trxAddress = text?.trim()

        if (!trxAddress || trxAddress.length < 34) {
          await sendTelegramMessage(chatId, "❌ Lütfen geçerli bir TRX cüzdan adresi girin.")
          return NextResponse.json({ ok: true })
        }

        // Kart bozum talebini oluştur
        const cardId = userState.data?.cardId
        const balance = userState.data?.balance

        if (cardId && balance) {
          const supabase = createServerSupabaseClient()

          const { error } = await supabase.from("card_redemption_requests").insert({
            user_id: dbUser.id,
            card_id: cardId,
            remaining_balance: balance,
            trx_wallet_address: trxAddress,
            status: "pending",
          })

          if (error) {
            console.error("Error creating redemption request:", error)
            await sendTelegramMessage(chatId, "❌ Bozum talebi oluşturulurken bir hata oluştu.")
          } else {
            await sendTelegramMessage(
              chatId,
              `✅ Kart bozum talebiniz alındı!

📤 TRX Adresi: ${trxAddress}
💰 Bakiye: ${balance} TL

Talebiniz incelendikten sonra ödemeniz yapılacaktır.`,
            )
          }
        }

        clearUserState(chatId)
        await showMainMenu(chatId, userName)
        return NextResponse.json({ ok: true })
      }

      // Diğer mesajlar için ana menüyü göster
      await showMainMenu(chatId, userName)
    }

    if (callbackQuery) {
      const chatId = callbackQuery.message?.chat.id
      const userId = callbackQuery.from.id
      const data = callbackQuery.data
      const user = callbackQuery.from

      if (!chatId || !userId || !user) {
        return NextResponse.json({ ok: true })
      }

      // Kullanıcıyı kaydet/güncelle
      const dbUser = await ensureUserExists(user)
      if (!dbUser) {
        return NextResponse.json({ ok: true })
      }

      const userName = user.first_name || user.username || "Kullanıcı"

      // Callback query'leri işle
      switch (data) {
        case "main_menu":
          clearUserState(chatId)
          await showMainMenu(chatId, userName)
          break

        case "buy_card":
          await handleCardPurchase(chatId, dbUser.id)
          break

        case "my_cards":
          await showUserCards(chatId, dbUser.id)
          break

        case "redeem_card":
          await handleCardRedemption(chatId, dbUser.id)
          break

        case "help":
          await showHelpMessage(chatId)
          break

        case "account_summary":
          await showAccountSummary(chatId, dbUser.id)
          break

        case "settings":
          await showSettingsMenu(chatId)
          break

        case "notification_settings":
          await sendTelegramMessage(chatId, "🔔 *Bildirim Ayarları*\n\nBu özellik yakında aktif olacak!")
          break

        case "language_settings":
          await sendTelegramMessage(chatId, "🌐 *Dil Ayarları*\n\nŞu anda sadece Türkçe desteklenmektedir.")
          break

        case "security_settings":
          await sendTelegramMessage(chatId, "🔒 *Güvenlik Ayarları*\n\nBu özellik yakında aktif olacak!")
          break

        case "account_settings":
          await sendTelegramMessage(chatId, "📱 *Hesap Ayarları*\n\nBu özellik yakında aktif olacak!")
          break

        case "detailed_report":
          await sendTelegramMessage(chatId, "📈 *Detaylı Rapor*\n\nBu özellik yakında aktif olacak!")
          break

        case "live_support":
          await sendTelegramMessage(chatId, "📞 *Canlı Destek*\n\nBu özellik yakında aktif olacak!")
          break

        default:
          if (data?.startsWith("payment_done_")) {
            const balance = Number.parseFloat(data.replace("payment_done_", ""))

            // Ödeme talebini oluştur
            const paymentRequest = await createPaymentRequest(dbUser.id, balance, userId)

            if (paymentRequest) {
              await sendTelegramMessage(
                chatId,
                `✅ Ödeme talebiniz alındı!

💳 Kart Bakiyesi: ${balance} TL
💵 Toplam Ödeme: ${balance + balance * 0.2} TRX

Ödemeniz onaylandıktan sonra kartınız hazırlanacaktır.`,
              )
            } else {
              await sendTelegramMessage(chatId, "❌ Ödeme talebi oluşturulurken bir hata oluştu.")
            }

            clearUserState(chatId)
            await showMainMenu(chatId, userName)
          } else if (data?.startsWith("select_redeem_")) {
            const cardId = data.replace("select_redeem_", "")

            // Kartın bilgilerini al
            const supabase = createServerSupabaseClient()
            const { data: card } = await supabase
              .from("virtual_cards")
              .select("*")
              .eq("id", cardId)
              .eq("user_id", dbUser.id)
              .single()

            if (card && !card.is_used && card.balance > 0) {
              setUserState(chatId, "waiting_trx_address", { cardId, balance: card.balance })

              await sendTelegramMessage(
                chatId,
                `🔄 *Kart Bozumu*

Seçilen Kart: **** **** **** ${card.card_number.slice(-4)}
Bakiye: ${card.balance} TL

Lütfen TRX cüzdan adresinizi girin:`,
              )
            } else {
              await sendTelegramMessage(chatId, "❌ Seçilen kart bozuma uygun değil.")
              await handleCardRedemption(chatId, dbUser.id)
            }
          } else {
            await showMainMenu(chatId, userName)
          }
          break
      }

      // Callback query'yi yanıtla
      const botToken = process.env.TELEGRAM_BOT_TOKEN
      if (botToken) {
        await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            callback_query_id: callbackQuery.id,
          }),
        })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Webhook error:", error)
    return NextResponse.json({ ok: true })
  }
}

export async function GET() {
  return NextResponse.json({ message: "Telegram webhook endpoint" })
}
