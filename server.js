import express from "express";
import dotenv from "dotenv";
import QRCode from "qrcode";
import crypto from "node:crypto";
import { PRODUCTS } from "./src/products.js";
import { STORE_CONFIG } from "./src/store.config.js";

// API key Pakasir dan token Telegram hanya berada di server.
dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const orders = new Map();

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

const required = ["PAKASIR_PROJECT", "PAKASIR_API_KEY", "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"];

function ensureConfig() {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Konfigurasi server belum lengkap: ${missing.join(", ")}`);
  }
}

function makeOrderId() {
  return `REXX-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

function findProduct(id) {
  return PRODUCTS.find((product) => product.id === id);
}

async function pakasirCreate({ orderId, amount }) {
  ensureConfig();
  const response = await fetch("https://app.pakasir.com/api/transactioncreate/qris", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      project: process.env.PAKASIR_PROJECT,
      order_id: orderId,
      amount,
      api_key: process.env.PAKASIR_API_KEY
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.payment) {
    throw new Error(data?.message || "Pakasir gagal membuat transaksi QRIS.");
  }
  return data.payment;
}

async function pakasirDetail({ orderId, amount }) {
  ensureConfig();
  const url = new URL("https://app.pakasir.com/api/transactiondetail");
  url.searchParams.set("project", process.env.PAKASIR_PROJECT);
  url.searchParams.set("amount", String(amount));
  url.searchParams.set("order_id", orderId);
  url.searchParams.set("api_key", process.env.PAKASIR_API_KEY);

  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.transaction) {
    throw new Error(data?.message || "Gagal memeriksa status transaksi.");
  }
  return data.transaction;
}

async function telegramNotify(order, status) {
  ensureConfig();
  const text = [
    "REXX MARKET DIGITAL",
    "TRANSAKSI TERBARU",
    "",
    `ORDER ID: ${order.id}`,
    `STATUS: ${status.toUpperCase()}`,
    `PRODUK: ${order.product.name}`,
    `NOMINAL: Rp${order.amount.toLocaleString("id-ID")}`,
    `EMAIL: ${order.customer.email}`,
    `USERNAME: ${order.customer.username}`,
    `NAMA: ${order.customer.name || "-"}`,
    `TELEPON: ${order.customer.phone || "-"}`,
    `WAKTU: ${new Date().toLocaleString("id-ID")}`
  ].join("\n");

  const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: process.env.TELEGRAM_CHAT_ID,
      text
    })
  });

  if (!response.ok) {
    console.error("Telegram notification failed:", await response.text());
  }
}

app.get("/api/store", (_req, res) => {
  res.json(STORE_CONFIG);
});

app.get("/api/products", (_req, res) => {
  res.json(PRODUCTS);
});

app.post("/api/orders", async (req, res) => {
  try {
    const { productId, customer } = req.body || {};
    const product = findProduct(productId);

    if (!product) return res.status(404).json({ message: "Produk tidak ditemukan." });
    if (!customer?.email || !customer?.username) {
      return res.status(400).json({ message: "Email dan username wajib diisi." });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) {
      return res.status(400).json({ message: "Format email tidak valid." });
    }

    const orderId = makeOrderId();
    const payment = await pakasirCreate({ orderId, amount: product.price });
    const qrDataUrl = await QRCode.toDataURL(payment.payment_number, {
      width: 360,
      margin: 2,
      errorCorrectionLevel: "M"
    });

    const order = {
      id: orderId,
      product,
      amount: product.price,
      customer: {
        name: String(customer.name || "").slice(0, 100),
        email: String(customer.email).slice(0, 160),
        username: String(customer.username).slice(0, 80),
        phone: String(customer.phone || "").slice(0, 30),
        note: String(customer.note || "").slice(0, 300)
      },
      status: "pending",
      payment: {
        method: payment.payment_method,
        paymentNumber: payment.payment_number,
        totalPayment: payment.total_payment,
        fee: payment.fee,
        expiredAt: payment.expired_at
      },
      createdAt: new Date().toISOString()
    };

    orders.set(orderId, order);
    res.json({
      orderId,
      status: order.status,
      product: product.name,
      amount: product.price,
      totalPayment: payment.total_payment,
      fee: payment.fee,
      expiredAt: payment.expired_at,
      qr: qrDataUrl
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || "Gagal membuat transaksi." });
  }
});

app.get("/api/orders/:orderId", async (req, res) => {
  const order = orders.get(req.params.orderId);
  if (!order) return res.status(404).json({ message: "Order tidak ditemukan di server." });

  try {
    if (order.status !== "completed") {
      const transaction = await pakasirDetail({ orderId: order.id, amount: order.amount });
      if (transaction.status === "completed") {
        order.status = "completed";
        order.completedAt = transaction.completed_at || new Date().toISOString();
        await telegramNotify(order, "completed");
      }
    }
  } catch (error) {
    console.error("Status check:", error.message);
  }

  res.json({
    orderId: order.id,
    status: order.status,
    product: order.product.name,
    amount: order.amount,
    completedAt: order.completedAt || null
  });
});

// Endpoint webhook Pakasir. Validasi amount + order_id dilakukan sebelum order ditandai lunas.
app.post("/api/webhooks/pakasir", async (req, res) => {
  try {
    const payload = req.body || {};
    const order = orders.get(payload.order_id);

    if (!order) return res.status(404).json({ message: "Order tidak ditemukan." });
    if (Number(payload.amount) !== Number(order.amount)) {
      return res.status(400).json({ message: "Nominal webhook tidak sesuai." });
    }
    if (payload.project !== process.env.PAKASIR_PROJECT) {
      return res.status(400).json({ message: "Project webhook tidak sesuai." });
    }

    if (payload.status === "completed" && order.status !== "completed") {
      order.status = "completed";
      order.completedAt = payload.completed_at || new Date().toISOString();
      await telegramNotify(order, "completed");
    }

    res.json({ received: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Webhook error." });
  }
});

app.get(/.*/, (_req, res) => {
  res.sendFile("index.html", { root: "public" });
});

app.listen(PORT, () => {
  console.log(`REXX MARKET running on http://localhost:${PORT}`);
});
