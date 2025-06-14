import { createServerSupabaseClient } from "./supabase"

// Ayarları veritabanından al
export async function getGlobalSettings() {
  try {
    const supabase = createServerSupabaseClient()

    const { data: settings, error } = await supabase.from("system_settings").select("setting_key, setting_value")

    if (error) {
      console.error("Error fetching settings:", error)
      // Hata durumunda varsayılan ayarları döndür
      return {
        trx_wallet_address: "TXYourTronWalletAddressHere",
        card_price: "50",
      }
    }

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

    console.log("Settings loaded from database:", result)
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
      updatePromises.push(
        supabase.from("system_settings").upsert({
          setting_key: "trx_wallet_address",
          setting_value: newSettings.trx_wallet_address,
          updated_at: new Date().toISOString(),
        }),
      )
    }

    if (newSettings.card_price !== undefined) {
      updatePromises.push(
        supabase.from("system_settings").upsert({
          setting_key: "card_price",
          setting_value: newSettings.card_price,
          updated_at: new Date().toISOString(),
        }),
      )
    }

    // Tüm güncellemeleri bekle
    const results = await Promise.all(updatePromises)

    // Hata kontrolü
    for (const result of results) {
      if (result.error) {
        console.error("Error updating setting:", result.error)
        throw new Error(`Setting update failed: ${result.error.message}`)
      }
    }

    console.log("Settings updated successfully in database")

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

    const { error } = await supabase.from("system_settings").upsert({
      setting_key: key,
      setting_value: value,
      updated_at: new Date().toISOString(),
    })

    if (error) {
      console.error(`Error setting ${key}:`, error)
      return false
    }

    console.log(`Setting ${key} updated to: ${value}`)
    return true
  } catch (error) {
    console.error(`Database error setting ${key}:`, error)
    return false
  }
}
