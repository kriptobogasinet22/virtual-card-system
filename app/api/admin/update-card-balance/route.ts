import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { requireAuth } from "@/lib/auth"

export async function POST(req: NextRequest) {
  try {
    console.log("=== UPDATE CARD BALANCE API ===")

    // Kimlik doğrulama kontrolü
    await requireAuth()

    const { cardId, newBalance } = await req.json()
    console.log("Request data:", { cardId, newBalance })

    if (!cardId || newBalance === undefined || newBalance < 0) {
      return NextResponse.json({ success: false, message: "Geçersiz parametreler" }, { status: 400 })
    }

    const supabase = createServerSupabaseClient()

    // Önce kartın var olup olmadığını kontrol et
    const { data: existingCard, error: selectError } = await supabase
      .from("virtual_cards")
      .select("id, balance, user_id")
      .eq("id", cardId)
      .single()

    if (selectError || !existingCard) {
      console.error("Card not found:", selectError)
      return NextResponse.json({ success: false, message: "Kart bulunamadı" }, { status: 404 })
    }

    console.log("Existing card:", existingCard)
    const oldBalance = existingCard.balance

    // Kart bakiyesini güncelle
    const { data, error } = await supabase
      .from("virtual_cards")
      .update({
        balance: Number.parseFloat(newBalance.toString()),
      })
      .eq("id", cardId)
      .select()

    if (error) {
      console.error("Error updating card balance:", error)
      return NextResponse.json(
        { success: false, message: `Kart bakiyesi güncellenirken bir hata oluştu: ${error.message}` },
        { status: 500 },
      )
    }

    console.log("Card balance updated successfully:", data)

    // Eğer kart bir kullanıcıya atanmışsa bildirim gönder
    if (existingCard.user_id && oldBalance !== newBalance) {
      try {
        console.log("Sending balance update notification...")

        const notificationResponse = await fetch(
          `${process.env.NEXT_PUBLIC_SITE_URL}/api/admin/notify-balance-update`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              // Admin session cookie'sini forward et
              Cookie: req.headers.get("cookie") || "",
            },
            body: JSON.stringify({
              cardId: cardId,
              oldBalance: oldBalance,
              newBalance: Number.parseFloat(newBalance.toString()),
            }),
          },
        )

        const notificationResult = await notificationResponse.json()
        console.log("Notification result:", notificationResult)

        return NextResponse.json({
          success: true,
          message: "Kart bakiyesi başarıyla güncellendi",
          notificationSent: notificationResult.notificationSent || false,
        })
      } catch (notificationError) {
        console.error("Error sending notification:", notificationError)
        return NextResponse.json({
          success: true,
          message: "Kart bakiyesi güncellendi ancak bildirim gönderilemedi",
        })
      }
    } else {
      return NextResponse.json({
        success: true,
        message: "Kart bakiyesi başarıyla güncellendi",
      })
    }
  } catch (error) {
    console.error("Update card balance error:", error)
    return NextResponse.json({ success: false, message: `Bir hata oluştu: ${error.message}` }, { status: 500 })
  }
}
