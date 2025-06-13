import { NextResponse } from "next/server"
import { readFile } from "fs/promises"
import { join } from "path"

const SETTINGS_FILE = join(process.cwd(), "settings.json")

// Varsayılan ayarlar
const defaultSettings = {
  trx_wallet_address: "TXYourTronWalletAddressHere",
  card_price: "50",
}

async function getSettings() {
  try {
    const data = await readFile(SETTINGS_FILE, "utf8")
    return JSON.parse(data)
  } catch (error) {
    // Dosya yoksa varsayılan ayarları döndür
    return defaultSettings
  }
}

export async function GET() {
  try {
    const settings = await getSettings()
    return NextResponse.json({ success: true, settings })
  } catch (error) {
    console.error("Get settings error:", error)
    return NextResponse.json({ success: false, settings: defaultSettings })
  }
}
