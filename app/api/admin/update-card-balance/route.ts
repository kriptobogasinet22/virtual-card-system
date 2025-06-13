import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { requireAuth } from "@/lib/auth"

export async function POST(req: NextRequest) {
  try {
    // Kimlik doğrulama kontrolü
    await requireAuth()

    const { cardId, newBalance } = await req.json()

    if (!cardId || newBalance === undefined || newBalance < 0) {
      return NextResponse.json({ success: false, message: "Geçersiz parametreler" }, { status: 400 })
    }

    const supabase = createServerSupabaseClient()

    // Kart bakiyesini güncelle
    const { error } = await supabase
      .from("virtual_cards")
      .update({
        balance: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq("id", cardId)

    if (error) {
      console.error("Error updating card balance:", error)
      return NextResponse.json(
        { success: false, message: "Kart bakiyesi güncellenirken bir hata oluştu" },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true, message: "Kart bakiyesi başarıyla güncellendi" })
  } catch (error) {
    console.error("Update card balance error:", error)
    return NextResponse.json({ success: false, message: "Bir hata oluştu" }, { status: 500 })
  }
}
