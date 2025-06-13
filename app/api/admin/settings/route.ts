import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"

// In-memory settings (production'da database kullanın)
const settings = {
  trx_wallet_address: "TXYourTronWalletAddressHere",
  card_price: "50",
}

export async function GET() {
  try {
    await requireAuth()
    console.log("Getting settings:", settings)
    return NextResponse.json({ success: true, settings })
  } catch (error) {
    console.error("Get settings error:", error)
    return NextResponse.json({ success: false, message: "Ayarlar yüklenirken bir hata oluştu" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth()

    const newSettings = await req.json()
    console.log("Updating settings with:", newSettings)

    // Ayarları güncelle
    if (newSettings.trx_wallet_address) {
      settings.trx_wallet_address = newSettings.trx_wallet_address
    }
    if (newSettings.card_price) {
      settings.card_price = newSettings.card_price
    }

    console.log("Settings updated to:", settings)

    return NextResponse.json({
      success: true,
      message: "Ayarlar başarıyla kaydedildi",
      settings: settings,
    })
  } catch (error) {
    console.error("Update settings error:", error)
    return NextResponse.json(
      {
        success: false,
        message: `Ayarlar kaydedilirken bir hata oluştu: ${error.message}`,
      },
      { status: 500 },
    )
  }
}
