import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"

// Basit dosya tabanlı ayarlar (gerçek uygulamada veritabanı kullanın)
let settings = {
  trx_wallet_address: "TXYourTronWalletAddressHere",
  card_price: "50",
}

export async function GET() {
  try {
    await requireAuth()
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

    // Ayarları güncelle
    settings = { ...settings, ...newSettings }

    return NextResponse.json({ success: true, message: "Ayarlar başarıyla kaydedildi", settings })
  } catch (error) {
    console.error("Update settings error:", error)
    return NextResponse.json({ success: false, message: "Ayarlar kaydedilirken bir hata oluştu" }, { status: 500 })
  }
}
