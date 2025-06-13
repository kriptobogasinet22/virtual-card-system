import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getGlobalSettings, updateGlobalSettings } from "@/lib/settings"

export async function GET() {
  try {
    await requireAuth()
    const settings = getGlobalSettings()
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

    // Global settings'i güncelle
    const updatedSettings = updateGlobalSettings(newSettings)

    return NextResponse.json({
      success: true,
      message: "Ayarlar başarıyla kaydedildi",
      settings: updatedSettings,
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
