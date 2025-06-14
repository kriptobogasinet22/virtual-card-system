import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getGlobalSettings, updateGlobalSettings } from "@/lib/settings"

export async function GET() {
  try {
    await requireAuth()

    console.log("=== GETTING SETTINGS FROM DATABASE ===")
    const settings = await getGlobalSettings()
    console.log("Settings retrieved:", settings)

    return NextResponse.json({ success: true, settings })
  } catch (error) {
    console.error("Get settings error:", error)
    return NextResponse.json(
      {
        success: false,
        message: `Ayarlar yüklenirken bir hata oluştu: ${error instanceof Error ? error.message : "Bilinmeyen hata"}`,
      },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth()

    const newSettings = await req.json()
    console.log("=== UPDATING SETTINGS IN DATABASE ===")
    console.log("New settings received:", newSettings)

    // Ayarları veritabanında güncelle
    const updatedSettings = await updateGlobalSettings(newSettings)
    console.log("Settings updated successfully:", updatedSettings)

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
        message: `Ayarlar kaydedilirken bir hata oluştu: ${error instanceof Error ? error.message : "Bilinmeyen hata"}`,
      },
      { status: 500 },
    )
  }
}
