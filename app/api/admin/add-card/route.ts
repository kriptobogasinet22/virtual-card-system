import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { requireAuth } from "@/lib/auth"

export async function POST(req: NextRequest) {
  try {
    // Kimlik doğrulama kontrolü
    await requireAuth()

    const body = await req.json()
    const { card_number, cvv, expiry_date, balance } = body

    // Validation
    if (!card_number || !cvv || !expiry_date || !balance || balance <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Tüm alanları doldurun ve geçerli bir bakiye girin",
        },
        { status: 400 },
      )
    }

    // Validate card number format (basic check)
    const cleanCardNumber = card_number.replace(/\s/g, "")
    if (cleanCardNumber.length < 13 || cleanCardNumber.length > 19) {
      return NextResponse.json(
        {
          success: false,
          message: "Geçersiz kart numarası formatı",
        },
        { status: 400 },
      )
    }

    // Validate CVV
    if (cvv.length < 3 || cvv.length > 4) {
      return NextResponse.json(
        {
          success: false,
          message: "CVV 3 veya 4 haneli olmalıdır",
        },
        { status: 400 },
      )
    }

    // Validate expiry date format (MM/YY)
    const expiryRegex = /^(0[1-9]|1[0-2])\/\d{2}$/
    if (!expiryRegex.test(expiry_date)) {
      return NextResponse.json(
        {
          success: false,
          message: "Son kullanma tarihi MM/YY formatında olmalıdır",
        },
        { status: 400 },
      )
    }

    const supabase = createServerSupabaseClient()

    // Check if card number already exists
    const { data: existingCard } = await supabase
      .from("virtual_cards")
      .select("id")
      .eq("card_number", cleanCardNumber)
      .single()

    if (existingCard) {
      return NextResponse.json(
        {
          success: false,
          message: "Bu kart numarası zaten sistemde kayıtlı",
        },
        { status: 400 },
      )
    }

    // Add card to database
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
      console.error("Supabase error:", error)
      return NextResponse.json(
        {
          success: false,
          message: "Kart eklenirken veritabanı hatası oluştu",
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      card: data,
      message: "Kart başarıyla eklendi",
    })
  } catch (error) {
    console.error("Add card error:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Kart eklenirken bir hata oluştu",
      },
      { status: 500 },
    )
  }
}
