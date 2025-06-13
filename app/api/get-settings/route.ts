import { NextResponse } from "next/server"
import { getGlobalSettings } from "@/lib/settings"

export async function GET() {
  try {
    const settings = getGlobalSettings()
    console.log("Public settings request, returning:", settings)
    return NextResponse.json({ success: true, settings })
  } catch (error) {
    console.error("Get public settings error:", error)
    return NextResponse.json({
      success: false,
      settings: {
        trx_wallet_address: "TXYourTronWalletAddressHere",
        card_price: "50",
      },
    })
  }
}
