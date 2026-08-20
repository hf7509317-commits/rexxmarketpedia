// Semua pengaturan tampilan dan perilaku toko diletakkan di sini.
export const STORE_CONFIG = {
  name: "REXX MARKET DIGITAL",
  tagline: "DIGITAL SERVICE & AUTOMATED ORDER",
  description: "Marketplace digital dengan proses order cepat, pembayaran QRIS, dan notifikasi transaksi otomatis.",
  currency: "IDR",
  profileImage: "/assets/store-profile.jpg",
  logoText: "R",
  support: {
    whatsapp: "",
    telegram: ""
  },
  checkout: {
    qrisOnly: true,
    orderExpiryMinutes: 15,
    requireEmail: true,
    requireUsername: true
  },
  payment: {
    provider: "pakasir",
    method: "qris"
  },
  ui: {
    showSoldCount: true,
    showOldPrice: true,
    enableAnimations: true,
    darkTheme: true
  }
};
