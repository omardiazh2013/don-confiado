import express, { Request, Response } from "express";
import * as QRCode from "qrcode";
import { WhatsAppHandler } from "./whatsapp_handler";

const app = express();
const PORT = parseInt(process.env.PORT || "8000");

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Variables de estado
let currentQR: string | null = null;
let currentVersion = "chat_v1.1";
let handler: WhatsAppHandler | null = null;
let isConnected = false;

// Credenciales (desde variables de entorno)
const USERS: Record<string, string> = {
  [process.env.DEMO_USER_1 || "vendedor1"]: process.env.DEMO_PASS_1 || "demo123",
  [process.env.DEMO_USER_2 || "vendedor2"]: process.env.DEMO_PASS_2 || "demo456",
  [process.env.DEMO_USER_3 || "admin"]: process.env.DEMO_PASS_3 || "admin123",
};

// Sesiones simples en memoria
const sessions: Record<string, string> = {};

// Demos disponibles
const DEMOS = [
  { id: "chat_v1.0", name: "v1.0 - Chat con Memoria", description: "Chat básico con memoria de conversación" },
  { id: "chat_v1.1", name: "v1.1 - Extracción de Datos", description: "Clasificación + extracción + Supabase" },
  { id: "chat_v2.0", name: "v2.0 - Facturas Multimodal", description: "Procesamiento de facturas con imágenes" },
  { id: "chat_v3.0", name: "v3.0 - Agente Avanzado", description: "Agente con capacidades avanzadas" },
  { id: "chat_v3.1", name: "v3.1 - Agente HITL", description: "Agente con aprobación humana" },
  { id: "chat_clase_03", name: "RAG - Búsqueda Productos", description: "Búsqueda inteligente en catálogo" },
];

// Función para iniciar WhatsApp con versión seleccionada
function startWhatsApp(version: string) {
  const backendUrl = `${process.env.BACKEND_BASE_URL || "https://backend-demo-6b6e.up.railway.app"}/api/${version}`;
  console.log(`🚀 Iniciando WhatsApp con ${backendUrl}`);

  if (handler) {
    currentQR = null;
    isConnected = false;
  }

  handler = new WhatsAppHandler(
    backendUrl,
    (qr: string) => {
      currentQR = qr;
      isConnected = false;
      console.log("📱 QR actualizado");
    }
  );

  handler.initSocket();
}

// Verificar sesión
function checkSession(req: Request): boolean {
  const token = req.headers.cookie?.split("session=")[1]?.split(";")[0];
  return token ? !!sessions[token] : false;
}

// ================================
// RUTAS
// ================================

// Página de login
app.get("/", (req: Request, res: Response) => {
  if (checkSession(req)) {
    return res.redirect("/dashboard");
  }

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Don Confiado - Portal de Demos</title>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: Arial, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .card {
          background: white;
          padding: 40px;
          border-radius: 16px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          width: 100%;
          max-width: 400px;
        }
        .logo { text-align: center; margin-bottom: 30px; }
        .logo h1 { color: #333; font-size: 28px; }
        .logo p { color: #666; margin-top: 8px; }
        .form-group { margin-bottom: 20px; }
        label { display: block; color: #333; margin-bottom: 6px; font-weight: bold; }
        input {
          width: 100%;
          padding: 12px;
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          font-size: 16px;
          transition: border-color 0.3s;
        }
        input:focus { outline: none; border-color: #667eea; }
        .btn {
          width: 100%;
          padding: 14px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          transition: opacity 0.3s;
        }
        .btn:hover { opacity: 0.9; }
        .error { color: red; text-align: center; margin-top: 10px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo">
          <h1>🤝 Don Confiado</h1>
          <p>Portal de Demos para Vendedores</p>
        </div>
        <form method="POST" action="/login">
          <div class="form-group">
            <label>Usuario</label>
            <input type="text" name="username" placeholder="Tu usuario" required autofocus />
          </div>
          <div class="form-group">
            <label>Contraseña</label>
            <input type="password" name="password" placeholder="Tu contraseña" required />
          </div>
          <button type="submit" class="btn">Iniciar Sesión</button>
          ${req.query.error ? '<p class="error">❌ Usuario o contraseña incorrectos</p>' : ''}
        </form>
      </div>
    </body>
    </html>
  `);
});

// Login
app.post("/login", (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (USERS[username] && USERS[username] === password) {
    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
    sessions[token] = username;
    res.setHeader("Set-Cookie", `session=${token}; Path=/; HttpOnly`);
    return res.redirect("/dashboard");
  }

  res.redirect("/?error=1");
});

// Dashboard principal
app.get("/dashboard", async (req: Request, res: Response) => {
  if (!checkSession(req)) return res.redirect("/");

  let qrImage = null;
  if (currentQR) {
    try {
      qrImage = await QRCode.toDataURL(currentQR);
    } catch (err) {
      console.error("Error generando QR:", err);
    }
  }

  const demosHTML = DEMOS.map(demo => `
    <div class="demo-card ${demo.id === currentVersion ? 'active' : ''}">
      <div class="demo-info">
        <h3>${demo.name}</h3>
        <p>${demo.description}</p>
      </div>
      <form method="POST" action="/select-demo">
        <input type="hidden" name="version" value="${demo.id}" />
        <button type="submit" class="btn-demo ${demo.id === currentVersion ? 'btn-active' : ''}">
          ${demo.id === currentVersion ? '✅ Activo' : 'Activar'}
        </button>
      </form>
    </div>
  `).join('');

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Don Confiado - Dashboard</title>
      <meta charset="UTF-8">
      <meta http-equiv="refresh" content="30">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; background: #f5f5f5; }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 20px 40px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .header h1 { font-size: 24px; }
        .logout { color: white; text-decoration: none; background: rgba(255,255,255,0.2); padding: 8px 16px; border-radius: 8px; }
        .container { max-width: 1200px; margin: 30px auto; padding: 0 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
        .section { background: white; border-radius: 16px; padding: 30px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .section h2 { color: #333; margin-bottom: 20px; font-size: 20px; }
        .demo-card {
          border: 2px solid #e0e0e0;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          transition: border-color 0.3s;
        }
        .demo-card.active { border-color: #667eea; background: #f0f0ff; }
        .demo-info h3 { color: #333; font-size: 16px; }
        .demo-info p { color: #666; font-size: 13px; margin-top: 4px; }
        .btn-demo {
          padding: 8px 16px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: bold;
          background: #e0e0e0;
          color: #333;
          transition: background 0.3s;
          white-space: nowrap;
        }
        .btn-active { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
        .btn-demo:hover { opacity: 0.8; }
        .qr-section { text-align: center; }
        .qr-section img { width: 250px; height: 250px; margin: 20px auto; display: block; }
        .status { padding: 10px; border-radius: 8px; margin-bottom: 20px; text-align: center; font-weight: bold; }
        .status.connected { background: #d4edda; color: #155724; }
        .status.disconnected { background: #f8d7da; color: #721c24; }
        .status.waiting { background: #fff3cd; color: #856404; }
        .current-demo { background: #f0f0ff; border-radius: 8px; padding: 12px; margin-bottom: 20px; text-align: center; }
        .refresh-btn {
          padding: 10px 20px;
          background: #667eea;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          margin-top: 10px;
          font-size: 14px;
        }
        @media (max-width: 768px) { .container { grid-template-columns: 1fr; } }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🤝 Don Confiado - Portal de Demos</h1>
        <a href="/logout" class="logout">Cerrar Sesión</a>
      </div>
      
      <div class="container">
        <!-- Selector de demos -->
        <div class="section">
          <h2>🎯 Selecciona el Demo</h2>
          ${demosHTML}
        </div>

        <!-- QR y estado -->
        <div class="section qr-section">
          <h2>📱 WhatsApp</h2>
          
          <div class="current-demo">
            <strong>Demo activo:</strong> ${DEMOS.find(d => d.id === currentVersion)?.name || currentVersion}
          </div>

          ${isConnected ? 
            '<div class="status connected">✅ WhatsApp Conectado</div>' :
            currentQR ? 
              '<div class="status waiting">⏳ Esperando escaneo del QR</div>' :
              '<div class="status disconnected">🔄 Iniciando conexión...</div>'
          }

          ${qrImage ? 
            `<img src="${qrImage}" alt="QR WhatsApp" />
             <p>Escanea con WhatsApp para conectar</p>` :
            isConnected ?
              '<p style="color: green; font-size: 18px; margin: 20px 0;">✅ Bot conectado y funcionando</p>' :
              '<p style="color: #666; margin: 20px 0;">Generando QR...</p>'
          }

          <form method="POST" action="/reconnect">
            <button type="submit" class="refresh-btn">🔄 Reconectar WhatsApp</button>
          </form>

          <p style="color: #999; font-size: 12px; margin-top: 20px;">Esta página se actualiza cada 30 segundos</p>
        </div>
      </div>
    </body>
    </html>
  `);
});

// Seleccionar demo
app.post("/select-demo", (req: Request, res: Response) => {
  if (!checkSession(req)) return res.redirect("/");

  const { version } = req.body;
  const validVersions = DEMOS.map(d => d.id);

  if (validVersions.includes(version)) {
    currentVersion = version;
    startWhatsApp(version);
    console.log(`✅ Demo cambiado a: ${version}`);
  }

  res.redirect("/dashboard");
});

// Reconectar WhatsApp
app.post("/reconnect", (req: Request, res: Response) => {
  if (!checkSession(req)) return res.redirect("/");
  startWhatsApp(currentVersion);
  res.redirect("/dashboard");
});

// Logout
app.get("/logout", (req: Request, res: Response) => {
  const token = req.headers.cookie?.split("session=")[1]?.split(";")[0];
  if (token) delete sessions[token];
  res.setHeader("Set-Cookie", "session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT");
  res.redirect("/");
});

// Health check
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", version: currentVersion, connected: isConnected });
});

// Iniciar servidor
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Servidor corriendo en puerto ${PORT}`);
  startWhatsApp(currentVersion);
});
