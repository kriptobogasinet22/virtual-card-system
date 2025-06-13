import { type NextRequest, NextResponse } from "next/server"
import { telegramBot } from "@/lib/telegram-bot"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Webhook secret kontrolü
    const secret = req.nextUrl.searchParams.get("secret")
    if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Mesaj işleme
    if (body.message) {
      await telegramBot.handleMessage(body.message)
    }

    // Callback query işleme
    if (body.callback_query) {
      await telegramBot.handleCallbackQuery(body.callback_query)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Webhook error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
