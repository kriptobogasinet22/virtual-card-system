// Global settings store
const globalSettings = {
  trx_wallet_address: "TXYourTronWalletAddressHere",
  card_price: "50",
}

export function getGlobalSettings() {
  return { ...globalSettings }
}

export function updateGlobalSettings(newSettings: any) {
  if (newSettings.trx_wallet_address) {
    globalSettings.trx_wallet_address = newSettings.trx_wallet_address
  }
  if (newSettings.card_price) {
    globalSettings.card_price = newSettings.card_price
  }
  console.log("Global settings updated:", globalSettings)
  return globalSettings
}
