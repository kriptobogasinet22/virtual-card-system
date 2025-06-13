import TelegramBot from "node-telegram-bot-api"
import { createServerSupabaseClient } from "./supabase"

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const bot = new TelegramBot(BOT_TOKEN)

export class TelegramBotService {
  private supabase = createServerSupabaseClient()

  async handleMessage(message: TelegramBot.Message) {
    const chatId = message.chat.id
    const userId = message.from?.id
    const text = message.text

    if (!userId) return

    // Kullanıcıyı veritabanına kaydet
    await this.saveUser(message.from!)

    if (text === "/start") {
      await this.sendWelcomeMessage(chatId)
    }
  }

  async handleCallbackQuery(query: TelegramBot.CallbackQuery) {
    const chatId = query.message?.chat.id
    const userId = query.from.id
    const data = query.data

    if (!chatId) return

    if (data === "buy_card") {
      await this.startCardPurchase(chatId, userId)
    } else if (data === "redeem_card") {
      await this.startCardRedemption(chatId, userId)
    } else if (data === "my_cards") {
      await this.showUserCards(chatId, userId)
    } else if (data?.startsWith("confirm_payment_")) {
      const balance = Number.parseFloat(data.replace("confirm_payment_", ""))
      await this.confirmPayment(chatId, userId, balance)
    }
  }

  private async saveUser(user: TelegramBot.User) {
    try {
      await this.supabase.from("users").upsert({
        telegram_id: user.id,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
      })
    } catch (error) {
      console.error("Error saving user:", error)
    }
  }

  private async sendWelcomeMessage(chatId: number) {
    const keyboard = {
      inline_keyboard: [
        [{ text: "💳 Sanal Kart Satın Al", callback_data: "buy_card" }],
        [{ text: "🔄 Kart Bozumu", callback_data: "redeem_card" }],
        [{ text: "📋 Kartlarım", callback_data: "my_cards" }],
      ],
    }

    await bot.sendMessage(
      chatId,
      "🤖 Sanal Kart Satış Botuna Hoş Geldiniz!\n\n" +
        "Bu bot ile sanal kart satın alabilir, mevcut kartlarınızı yönetebilir ve kart bozumu yapabilirsiniz.\n\n" +
        "Lütfen yapmak istediğiniz işlemi seçin:",
      { reply_markup: keyboard },
    )
  }

  private async startCardPurchase(chatId: number, userId: number) {
    await bot.sendMessage(
      chatId,
      "💳 Sanal Kart Satın Alma\n\n" +
        "Lütfen satın almak istediğiniz kartın bakiyesini TL cinsinden girin.\n" +
        "Örnek: 100\n\n" +
        "💡 Not: Girdiğiniz tutara %20 hizmet bedeli eklenecektir.",
    )

    // Kullanıcının bir sonraki mesajını bekle
    this.waitForBalanceInput(userId)
  }

  private waitForBalanceInput(userId: number) {
    // Bu fonksiyon kullanıcının bakiye girişini bekler
    // Gerçek implementasyonda session yönetimi gerekir
  }

  private async confirmPayment(chatId: number, userId: number, cardBalance: number) {
    const serviceFee = cardBalance * 0.2
    const totalAmount = cardBalance + serviceFee

    // Ödeme talebini veritabanına kaydet
    const { data: user } = await this.supabase.from("users").select("id").eq("telegram_id", userId).single()

    if (user) {
      await this.supabase.from("payment_requests").insert({
        user_id: user.id,
        card_balance: cardBalance,
        service_fee: serviceFee,
        total_amount: totalAmount,
        status: "pending",
      })
    }

    const keyboard = {
      inline_keyboard: [
        [{ text: "✅ Ödeme Yaptım", callback_data: "payment_completed" }],
        [{ text: "❌ İptal Et", callback_data: "cancel_payment" }],
      ],
    }

    await bot.sendMessage(
      chatId,
      `💰 Ödeme Bilgileri\n\n` +
        `💳 Kart Bakiyesi: ${cardBalance} TL\n` +
        `🔧 Hizmet Bedeli (%20): ${serviceFee} TL\n` +
        `💵 Toplam Ödeme: ${totalAmount} TRX\n\n` +
        `📤 Ödeme Adresi: TRX_WALLET_ADDRESS_HERE\n\n` +
        `Ödemenizi yaptıktan sonra "Ödeme Yaptım" butonuna tıklayın.`,
      { reply_markup: keyboard },
    )
  }

  private async startCardRedemption(chatId: number, userId: number) {
    // Kullanıcının kartlarını getir
    const { data: user } = await this.supabase.from("users").select("id").eq("telegram_id", userId).single()

    if (!user) {
      await bot.sendMessage(chatId, "❌ Kullanıcı bulunamadı.")
      return
    }

    const { data: cards } = await this.supabase
      .from("virtual_cards")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_used", false)

    if (!cards || cards.length === 0) {
      await bot.sendMessage(chatId, "❌ Bozuma uygun kartınız bulunmamaktadır.")
      return
    }

    let message = "🔄 Kart Bozumu\n\nBozuma uygun kartlarınız:\n\n"
    const keyboard = { inline_keyboard: [] as any[] }

    cards.forEach((card, index) => {
      message += `${index + 1}. **** **** **** ${card.card_number.slice(-4)} - ${card.balance} TL\n`
      keyboard.inline_keyboard.push([
        {
          text: `Kart ${index + 1} - ${card.balance} TL`,
          callback_data: `redeem_${card.id}`,
        },
      ])
    })

    await bot.sendMessage(chatId, message, { reply_markup: keyboard })
  }

  private async showUserCards(chatId: number, userId: number) {
    const { data: user } = await this.supabase.from("users").select("id").eq("telegram_id", userId).single()

    if (!user) {
      await bot.sendMessage(chatId, "❌ Kullanıcı bulunamadı.")
      return
    }

    const { data: cards } = await this.supabase.from("virtual_cards").select("*").eq("user_id", user.id)

    if (!cards || cards.length === 0) {
      await bot.sendMessage(chatId, "❌ Henüz kartınız bulunmamaktadır.")
      return
    }

    let message = "📋 Kartlarınız\n\n"
    cards.forEach((card, index) => {
      const status = card.is_used ? "❌ Kullanılmış" : "✅ Aktif"
      message += `${index + 1}. **** **** **** ${card.card_number.slice(-4)}\n`
      message += `   💰 Bakiye: ${card.balance} TL\n`
      message += `   📊 Durum: ${status}\n`
      message += `   📅 Tarih: ${card.expiry_date}\n\n`
    })

    await bot.sendMessage(chatId, message)
  }

  async sendMessage(chatId: number, text: string, options?: any) {
    return await bot.sendMessage(chatId, text, options)
  }
}

export const telegramBot = new TelegramBotService()
