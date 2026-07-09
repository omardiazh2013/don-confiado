import express from "express";
import * as QRCode from "qrcode";
import { WhatsAppHandler } from "./whatsapp_handler";

const app = express();
const PORT = process.env.PORT || 8000;

let currentQR: string | null = null;
const handler = new WhatsAppHandler(
  process.env.BACKEND_URL || "http://127.0.0.1:8000/api/chat_v1.1",
  (qr: string) => {
    currentQR = qr;
    console.log("📱 QR actualizado");
  }
);

// Endpoint para obtener QR
app.get("/qr", async (req, res) => {
  if (!currentQR) {
    return res.status(503).json({ error: "QR no disponible aún, reconectando..." });
  }
  
  try {
    const qrImage = await QRCode.toDataURL(currentQR);
    res.send(`
      <html>
        <body style="display:flex;justify-content:center;align-items:center;height:100vh;background:#f0f0f0">
          <div style="text-align:center">
            <h1>WhatsApp QR - Don Confiado</h1>
            <img src="${qrImage}" style="width:400px;height:400px" />
            <p>Escanea con tu teléfono</p>
          </div>
        </body>
      </html>
    `);
  } catch (err) {
    res.status(500).json({ error: "Error generando QR" });
  }
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", connected: !!currentQR });
});

app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en puerto ${PORT}`);
  handler.initSocket();
});
