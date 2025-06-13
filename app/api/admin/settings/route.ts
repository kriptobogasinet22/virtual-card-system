import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { writeFile, readFile } from "fs/promises"
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

async function saveSettings(settings: any) {
  try {
    await writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2))
    return true
  } catch (error) {
    console.error("Error saving settings:", error)
    return false
  }
}

export async function GET() {
  try {
    await requireAuth()
    const settings = await getSettings()
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
    console.log("Updating settings:", newSettings)

    // Ayarları kaydet
    const saved = await saveSettings(newSettings)

    if (!saved) {
      return NextResponse.json({ success: false, message: "Ayarlar kaydedilemedi" }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: "Ayarlar başarıyla kaydedildi", settings: newSettings })
  } catch (error) {
    console.error("Update settings error:", error)
    return NextResponse.json({ success: false, message: "Ayarlar kaydedilirken bir hata oluştu" }, { status: 500 })
  }
}
