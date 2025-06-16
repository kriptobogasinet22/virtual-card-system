import { createServerSupabaseClient } from "./supabase"

// Ayarları veritabanından al
export async function getGlobalSettings() {
  try {
    const supabase = createServerSupabaseClient()

    console.log("Fetching settings from database...")
    const { data: settings, error } = await supabase.from("system_settings").select("setting_key, setting_value")

    if (error) {
      console.error("Error fetching settings:", error)
      // Hata durumunda varsayılan ayarları döndür
      return {
        trx_wallet_address: "TXYourTronWalletAddressHere",
        card_price: "50",
      }
    }

    console.log("Raw settings from database:", settings)

    // Ayarları obje formatına çevir
    const settingsObj: Record<string, string> = {}
    settings?.forEach((setting) => {
      settingsObj[setting.setting_key] = setting.setting_value
    })

    // Eksik ayarları varsayılan değerlerle tamamla
    const result = {
      trx_wallet_address: settingsObj.trx_wallet_address || "TXYourTronWalletAddressHere",
      card_price: settingsObj.card_price || "50",
    }

    console.log("Processed settings:", result)
    return result
  } catch (error) {
    console.error("Database error in getGlobalSettings:", error)
    // Hata durumunda varsayılan ayarları döndür
    return {
      trx_wallet_address: "TXYourTronWalletAddressHere",
      card_price: "50",
    }
  }
}

// Ayarları veritabanında güncelle
export async function updateGlobalSettings(newSettings: any) {
  try {
    const supabase = createServerSupabaseClient()

    console.log("Updating settings in database:", newSettings)

    // Her ayarı ayrı ayrı güncelle
    const updatePromises = []

    if (newSettings.trx_wallet_address !== undefined) {
      console.log("Updating trx_wallet_address to:", newSettings.trx_wallet_address)

      // Önce mevcut kaydı kontrol et
      const { data: existing } = await supabase
        .from("system_settings")
        .select("id")
        .eq("setting_key", "trx_wallet_address")
        .single()

      if (existing) {
        // Mevcut kayıt varsa güncelle
        updatePromises.push(
          supabase
            .from("system_settings")
            .update({
              setting_value: newSettings.trx_wallet_address,
              updated_at: new Date().toISOString(),
            })
            .eq("setting_key", "trx_wallet_address"),
        )
      } else {
        // Mevcut kayıt yoksa ekle
        updatePromises.push(
          supabase.from("system_settings").insert({
            setting_key: "trx_wallet_address",
            setting_value: newSettings.trx_wallet_address,
            description: "TRX ödemelerinin yapılacağı cüzdan adresi",
          }),
        )
      }
    }

    if (newSettings.card_price !== undefined) {
      console.log("Updating card_price to:", newSettings.card_price)

      // Önce mevcut kaydı kontrol et
      const { data: existing } = await supabase
        .from("system_settings")
        .select("id")
        .eq("setting_key", "card_price")
        .single()

      if (existing) {
        // Mevcut kayıt varsa güncelle
        updatePromises.push(
          supabase
            .from("system_settings")
            .update({
              setting_value: newSettings.card_price,
              updated_at: new Date().toISOString(),
            })
            .eq("setting_key", "card_price"),
        )
      } else {
        // Mevcut kayıt yoksa ekle
        updatePromises.push(
          supabase.from("system_settings").insert({
            setting_key: "card_price",
            setting_value: newSettings.card_price,
            description: "Sanal kart satış fiyatı (TRX cinsinden)",
          }),
        )
      }
    }

    // Tüm güncellemeleri bekle
    const results = await Promise.all(updatePromises)

    // Hata kontrolü
    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      if (result.error) {
        console.error(`Error updating setting ${i}:`, result.error)
        throw new Error(`Setting update failed: ${result.error.message}`)
      }
    }

    console.log("All settings updated successfully")

    // Güncellenmiş ayarları döndür
    return await getGlobalSettings()
  } catch (error) {
    console.error("Error updating settings:", error)
    throw error
  }
}

// Belirli bir ayarı al
export async function getSetting(key: string): Promise<string | null> {
  try {
    const supabase = createServerSupabaseClient()

    const { data, error } = await supabase
      .from("system_settings")
      .select("setting_value")
      .eq("setting_key", key)
      .single()

    if (error) {
      console.error(`Error fetching setting ${key}:`, error)
      return null
    }

    return data?.setting_value || null
  } catch (error) {
    console.error(`Database error getting setting ${key}:`, error)
    return null
  }
}

// Belirli bir ayarı güncelle
export async function setSetting(key: string, value: string): Promise<boolean> {
  try {
    const supabase = createServerSupabaseClient()

    // Önce mevcut kaydı kontrol et
    const { data: existing } = await supabase.from("system_settings").select("id").eq("setting_key", key).single()

    let result
    if (existing) {
      // Mevcut kayıt varsa güncelle
      result = await supabase
        .from("system_settings")
        .update({
          setting_value: value,
          updated_at: new Date().toISOString(),
        })
        .eq("setting_key", key)
    } else {
      // Mevcut kayıt yoksa ekle
      result = await supabase.from("system_settings").insert({
        setting_key: key,
        setting_value: value,
        updated_at: new Date().toISOString(),
      })
    }

    if (result.error) {
      console.error(`Error setting ${key}:`, result.error)
      return false
    }

    console.log(`Setting ${key} updated to: ${value}`)
    return true
  } catch (error) {
    console.error(`Database error setting ${key}:`, error)
    return false
  }
}
