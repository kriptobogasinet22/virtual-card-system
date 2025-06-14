import { NextResponse } from "next/server"
import { getGlobalSettings } from "@/lib/settings"

export async function GET() {
  try {
    console.log("=== PUBLIC SETTINGS REQUEST ===")
    const settings = await getGlobalSettings()
    console.log("Public settings returned:", settings)

    return NextResponse.json({ success: true, settings })
  } catch (error) {
    console.error("Get public settings error:", error)

    // Hata durumunda varsayılan ayarları döndür
    return NextResponse.json({
      success: false,
      settings: {
        trx_wallet_address: "TXYourTronWalletAddressHere",
        card_price: "50",
      },
      error: error instanceof Error ? error.message : "Bilinmeyen hata",
    })
  }
}
