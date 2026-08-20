# REXX MARKET DIGITAL

Template toko digital dengan desain dark-blue profesional, produk bergaya panel/order digital, checkout berbasis data pembeli, QRIS Pakasir, webhook status pembayaran, dan notifikasi Telegram.

## Struktur

- `public/index.html` — halaman utama.
- `public/css/style.css` — seluruh styling.
- `public/js/app.js` — interaksi frontend.
- `src/products.js` — daftar produk dan harga.
- `src/store.config.js` — pengaturan toko, tampilan, checkout, dan foto profil.
- `.env.example` — konfigurasi rahasia server.
- `server.js` — backend, Pakasir, QR generation, order, webhook, Telegram.
- `public/assets/store-profile.jpg` — ganti dengan foto profil toko sendiri.

## Instalasi

```bash
npm install
cp .env.example .env
npm start
```

Buka `http://localhost:3000`.

## Konfigurasi

Isi `.env`:

- `PAKASIR_PROJECT` = slug project Pakasir.
- `PAKASIR_API_KEY` = API key project Pakasir.
- `TELEGRAM_BOT_TOKEN` = token bot Telegram.
- `TELEGRAM_CHAT_ID` = chat ID tujuan notifikasi transaksi.
- `PUBLIC_BASE_URL` = domain publik website.

Jangan pernah menaruh API key Pakasir atau token Telegram di JavaScript frontend.

## Webhook Pakasir

Atur Webhook URL project Pakasir menjadi:

`https://DOMAIN-KAMU/api/webhooks/pakasir`

Webhook hanya menerima order yang sudah ada di server dan mencocokkan `order_id`, `amount`, dan `project` sebelum status diubah menjadi completed.

## Catatan produksi

Demo ini menyimpan order di memory server agar sederhana. Untuk produksi, pindahkan penyimpanan order ke database seperti PostgreSQL/MySQL/SQLite dan tambahkan autentikasi admin serta idempotency/locking yang lebih kuat.
