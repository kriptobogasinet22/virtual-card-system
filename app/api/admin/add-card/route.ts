import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { requireAuth } from "@/lib/auth"

export async function POST(req: NextRequest) {
  try {
    console.log("Add card API called")

    // Kimlik doğrulama kontrolü
    try {
      await requireAuth()
      console.log("Auth successful")
    } catch (authError) {
      console.error("Auth failed:", authError)
      return NextResponse.json({ success: false, message: "Yetkilendirme hatası" }, { status: 401 })
    }

    // Request body'yi parse et
    let body
    try {
      body = await req.json()
      console.log("Request body:", body)
    } catch (parseError) {
      console.error("JSON parse error:", parseError)
      return NextResponse.json({ success: false, message: "Geçersiz istek formatı" }, { status: 400 })
    }

    const { card_number, cvv, expiry_date, balance } = body

    // Validation
    if (!card_number || !cvv || !expiry_date || !balance || balance <= 0) {
      console.log("Validation failed:", { card_number, cvv, expiry_date, balance })
      return NextResponse.json(
        {
          success: false,
          message: "Tüm alanları doldurun ve geçerli bir bakiye girin",
        },
        { status: 400 },
      )
    }

    // Kart numarasını temizle
    const cleanCardNumber = card_number.replace(/\s/g, "")

    // Supabase bağlantısını test et
    const supabase = createServerSupabaseClient()
    console.log("Supabase client created")

    try {
      // Önce mevcut kartları kontrol et
      const { data: existingCard, error: checkError } = await supabase
        .from("virtual_cards")
        .select("id")
        .eq("card_number", cleanCardNumber)
        .maybeSingle()

      if (checkError) {
        console.error("Check existing card error:", checkError)
        return NextResponse.json(
          { success: false, message: `Veritabanı hatası: ${checkError.message}` },
          { status: 500 },
        )
      }

      if (existingCard) {
        return NextResponse.json(
          { success: false, message: "Bu kart numarası zaten sistemde kayıtlı" },
          { status: 400 },
        )
      }

      // Yeni kart ekle
      const { data, error } = await supabase
        .from("virtual_cards")
        .insert({
          card_number: cleanCardNumber,
          cvv,
          expiry_date,
          balance: Number.parseFloat(balance.toString()),
          is_assigned: false,
          is_used: false,
        })
        .select()
        .single()

      if (error) {
        console.error("Insert card error:", error)
        return NextResponse.json({ success: false, message: `Kart eklenirken hata: ${error.message}` }, { status: 500 })
      }

      console.log("Card added successfully:", data)
      return NextResponse.json({
        success: true,
        card: data,
        message: "Kart başarıyla eklendi",
      })
    } catch (dbError) {
      console.error("Database operation error:", dbError)
      return NextResponse.json({ success: false, message: `Veritabanı bağlantı hatası: ${dbError}` }, { status: 500 })
    }
  } catch (error) {
    console.error("General add card error:", error)
    return NextResponse.json({ success: false, message: `Genel hata: ${error}` }, { status: 500 })
  }
}
