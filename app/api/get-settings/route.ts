import { NextResponse } from "next/server"

// Aynı settings objesini kullan
const settings = {
  trx_wallet_address: "TXYourTronWalletAddressHere",
  card_price: "50",
}

export async function GET() {
  try {
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

// Settings'i güncellemek için export
export function updateSettings(newSettings: any) {
  if (newSettings.trx_wallet_address) {
    settings.trx_wallet_address = newSettings.trx_wallet_address
  }
  if (newSettings.card_price) {
    settings.card_price = newSettings.card_price
  }
}
