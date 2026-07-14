import express, { Request, Response } from "express";
import * as QRCode from "qrcode";
import { WhatsAppHandler } from "./whatsapp_handler";

const app = express();
const PORT = parseInt(process.env.PORT || "8000");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let currentQR: string | null = null;
let currentVersion = process.env.DEFAULT_DEMO || "chat_v1.0";
let handler: WhatsAppHandler | null = null;
let isConnected = false;

const USERS: Record<string, string> = {
  [process.env.DEMO_USER_1 || "vendedor1"]: process.env.DEMO_PASS_1 || "demo123",
  [process.env.DEMO_USER_2 || "vendedor2"]: process.env.DEMO_PASS_2 || "demo456",
  [process.env.DEMO_USER_3 || "admin"]: process.env.DEMO_PASS_3 || "admin123",
};

const sessions: Record<string, { user: string; expires: number }> = {};
const SESSION_DURATION = 8 * 60 * 60 * 1000;

const DEMOS = [
  {
    id: "chat_v1.0",
    name: "🧠 Asesor Básico",
    description: "Conversa con tu cliente y recuerda todo lo que te dice",
    contexto: "Don Pedro tiene una tienda de repuestos y atiende 30 clientes al día. Ya usa WhatsApp Business con el bot gratuito de Meta, pero cada vez que un cliente vuelve, el bot no recuerda nada de conversaciones anteriores.",
    ventajaMeta: "⚡ Meta AI GRATIS hace esto... pero solo recuerda la conversación actual. Don Confiado recuerda el historial completo del cliente, su negocio y sus preferencias para siempre.",
    pasos: [
      { mensaje: "Hola, soy Pedro y tengo una tienda de repuestos para motos en Bogotá", tip: "El cliente se presenta. Don Confiado guarda este contexto permanentemente, no solo para esta sesión." },
      { mensaje: "Mis clientes más frecuentes son talleres mecánicos que compran filtros y aceites", tip: "Más contexto del negocio. El bot de Meta olvida esto al cerrar el chat. Don Confiado nunca lo olvida." },
      { mensaje: "¿Cómo me llamo, dónde estoy y a quién le vendo?", tip: "¡MOMENTO WOW! Demuestra memoria persistente. El bot gratuito de Meta fallaría aquí. Don Confiado recuerda todo." },
      { mensaje: "Escríbeme un mensaje de WhatsApp para enviarle a mis clientes talleros sobre una promoción de aceite 20W50", tip: "Usa el contexto del negocio para crear contenido personalizado. Meta solo hace respuestas genéricas." },
    ],
    argumento: "El bot de WhatsApp Business de Meta es gratuito pero es un bot de preguntas frecuentes. Don Confiado es un asistente que CONOCE tu negocio. La diferencia: Meta responde. Don Confiado recuerda, aprende y actúa.",
    metaComparacion: "Meta WhatsApp Business (gratis) vs Don Confiado",
    metaLimite: "Meta: responde FAQs, olvida al cerrar chat, sin memoria entre sesiones",
    donConfiado: "Don Confiado: memoria permanente por cliente, contexto de negocio, respuestas personalizadas",
  },
  {
    id: "chat_v1.1",
    name: "📋 Registro de Proveedores",
    description: "Registra proveedores en tu base de datos solo hablando por WhatsApp",
    contexto: "María tiene una distribuidora y ya probó el bot de Meta para atender clientes. Funciona bien para ventas, pero cuando necesita registrar un proveedor nuevo en su sistema, el bot de Meta no puede hacer nada.",
    ventajaMeta: "⚡ Meta AI NO puede escribir en bases de datos externas. Solo puede responder preguntas. Don Confiado conecta directamente con tu sistema y registra datos reales.",
    pasos: [
      { mensaje: "Necesito crear un nuevo proveedor en el sistema", tip: "Meta responde 'Lo siento, no puedo hacer eso'. Don Confiado pregunta los datos y actúa." },
      { mensaje: "NIT 900123456, Razón Social Distribuidora El Sol SAS", tip: "Don Confiado extrae NIT y razón social automáticamente y los prepara para guardar en la BD." },
      { mensaje: "Dirección: Calle 45 # 23-10, Bogotá. Teléfono: 3001234567", tip: "Sigue extrayendo datos. Ningún bot de Meta puede hacer esto en tu base de datos real." },
      { mensaje: "¿Quedó bien registrado el proveedor?", tip: "MOMENTO WOW: confirmación de registro real en base de datos. Meta solo puede mostrar información, nunca escribir." },
    ],
    argumento: "El agente de Meta está diseñado para el FRENTE del negocio: atender clientes. Don Confiado trabaja en el BACKOFFICE: registra, organiza y automatiza tus procesos internos. Eso vale entre $150 y $500/mes para una PYME, no $20.",
    metaComparacion: "Meta WhatsApp Business vs Don Confiado en BackOffice",
    metaLimite: "Meta: no puede escribir en bases de datos externas, sin integración con ERP/inventarios",
    donConfiado: "Don Confiado: escritura directa en BD, integración con sistemas internos, automatización de procesos",
  },
  {
    id: "chat_v2.0",
    name: "📸 Lector de Facturas",
    description: "Toma foto a una factura y registra productos y proveedores al instante",
    contexto: "Carlos sabe que Meta AI puede describir imágenes. Intentó mandarle fotos de facturas al bot de Meta pero solo le describía la imagen. No extraía los datos ni los registraba en ningún sistema.",
    ventajaMeta: "⚡ Meta AI puede DESCRIBIR una factura ('veo una factura de $500.000'). Don Confiado la PROCESA: extrae NIT, productos, precios y los registra en tu sistema contable.",
    pasos: [
      { mensaje: "Analiza esta factura y crea el producto y proveedor si aplica", tip: "Envía CON una foto de factura. Meta diría 'es una factura de X empresa'. Don Confiado extrae y registra." },
      { mensaje: "¿Qué datos exactos encontraste en la factura?", tip: "Don Confiado lista NIT, razón social, productos, precios unitarios, totales. Meta no estructura esta información." },
      { mensaje: "¿Cuánto me costó el producto más caro de esta factura?", tip: "Consulta inteligente sobre los datos ya extraídos. Meta no puede hacer esto porque no almacenó nada." },
      { mensaje: "Crea una alerta si ese producto sube más del 10% en la próxima factura", tip: "MOMENTO WOW: automatización contable real. Meta no tiene memoria entre facturas ni puede crear alertas de negocio." },
    ],
    argumento: "Meta AI ve facturas. Don Confiado las procesa, las registra y las convierte en inteligencia de negocio. Si tienes 50 facturas al mes, ahorras 40 horas de digitación manual. Eso es más valioso que cualquier suscripción de Meta.",
    metaComparacion: "Meta AI Vision vs Don Confiado OCR + Integración",
    metaLimite: "Meta: describe imágenes pero no extrae datos estructurados ni los registra en sistemas",
    donConfiado: "Don Confiado: extrae, estructura y registra datos de facturas en tu base de datos en tiempo real",
  },
  {
    id: "chat_v3.0",
    name: "🤖 Asistente Inteligente",
    description: "Consulta inventario, alertas y recomendaciones conectado a tu base de datos",
    contexto: "Ana tiene un supermercado. El agente Enterprise de Meta cuesta miles de dólares y requiere ingenieros para integrarlo con el inventario. Don Confiado hace lo mismo a una fracción del costo.",
    ventajaMeta: "⚡ Meta Enterprise AI puede conectarse a inventarios PERO cuesta miles de dólares/mes y requiere equipo técnico. Don Confiado ofrece las mismas capacidades para PYMEs a $150-500/mes.",
    pasos: [
      { mensaje: "¿Qué productos están por agotarse esta semana?", tip: "Consulta directa a BD en tiempo real. Meta Enterprise haría esto, pero a 10x el costo. Don Confiado lo hace para PYMEs." },
      { mensaje: "¿Cuál fue el producto más vendido el mes pasado?", tip: "Análisis de ventas instantáneo. Sin reportes, sin Excel, sin esperar. Esto es lo que Meta cobra como Enterprise." },
      { mensaje: "Recomiéndame qué pedir a mis proveedores esta semana", tip: "MOMENTO WOW: inteligencia de negocio real. Cruza ventas + inventario + proveedores. Meta no hace esto en plan básico." },
      { mensaje: "Genera la orden de compra para el proveedor principal", tip: "De análisis a acción en un mensaje. Don Confiado crea documentos reales. Meta solo puede sugerir, no ejecutar." },
    ],
    argumento: "Lo que Meta cobra como solución Enterprise ($2.000+/mes, con equipo de ingenieros), Don Confiado lo ofrece a PYMEs colombianas desde $150/mes. Mismas capacidades, precio accesible, implementación en días.",
    metaComparacion: "Meta Enterprise AI vs Don Confiado para PYMEs",
    metaLimite: "Meta Enterprise: costoso, requiere ingenieros, meses de implementación, diseñado para grandes empresas",
    donConfiado: "Don Confiado: asequible, listo en días, diseñado para PYMEs, soporte local en español",
  },
  {
    id: "chat_v3.1",
    name: "✅ Control del Dueño",
    description: "El dueño aprueba cada acción importante antes de ejecutarse",
    contexto: "Roberto leyó que Meta AI puede automatizar procesos. Pero le preocupa: ¿quién controla que el bot no cometa errores costosos? Con Meta, no hay forma de pedir aprobación humana antes de ejecutar.",
    ventajaMeta: "⚡ Meta AI ejecuta acciones automáticamente sin pedir permiso. Don Confiado implementa Human-in-the-Loop: NADA se ejecuta sin tu aprobación explícita. Tú tienes el control total.",
    pasos: [
      { mensaje: "Registra el pago de $500.000 al proveedor Distribuidora El Sol", tip: "Don Confiado PAUSA y pide aprobación. Meta haría esto automáticamente sin consultarte. ¿Confiarías en eso?" },
      { mensaje: "si", tip: "SOLO después de tu 'si' explícito se ejecuta. Esto es lo que las grandes empresas llaman governance de IA." },
      { mensaje: "Muéstrame todos los pagos aprobados hoy", tip: "Trazabilidad completa: sabes exactamente qué aprobaste y cuándo. Meta no ofrece este nivel de control a PYMEs." },
      { mensaje: "no", tip: "MOMENTO WOW: el sistema se detiene inmediatamente. Con Meta, ya sería tarde. Con Don Confiado, tú siempre tienes la última palabra." },
    ],
    argumento: "Meta automatiza. Don Confiado automatiza CON control. Para un dueño de PYME que no puede pagar errores, la diferencia es crítica. La gobernanza de IA no es un lujo: es una necesidad del negocio.",
    metaComparacion: "Meta AI Automation vs Don Confiado Human-in-the-Loop",
    metaLimite: "Meta: ejecución automática sin aprobación humana, difícil de auditar, sin trazabilidad por dueño",
    donConfiado: "Don Confiado: aprobación explícita requerida, trazabilidad completa, el dueño siempre tiene control",
  },
  {
    id: "chat_clase_03",
    name: "🔍 Buscador de Catálogo",
    description: "Encuentra cualquier producto con lenguaje natural conectado a tu inventario real",
    contexto: "Luis tiene 2.000 productos en su ferretería. Meta AI puede responder preguntas generales sobre ferretería, pero no conoce el catálogo específico de Luis ni sus precios reales.",
    ventajaMeta: "⚡ Meta AI conoce ferretería en general (datos de internet). Don Confiado conoce TU ferretería: tus precios, tu stock, tus proveedores. Esa es la diferencia entre IA genérica e IA de tu negocio.",
    pasos: [
      { mensaje: "¿Qué precio y stock tiene el tornillo hexagonal de 3/8?", tip: "Meta respondería con precios genéricos de internet. Don Confiado responde con TUS precios reales de tu inventario." },
      { mensaje: "¿Tienes algo similar pero más económico?", tip: "Don Confiado busca en TU catálogo real. Meta sugeriría marcas genéricas que quizás ni vendes." },
      { mensaje: "¿Cuál es el producto más vendido de tornillería este mes?", tip: "MOMENTO WOW: análisis de TUS ventas reales. Meta no tiene acceso a tu historial de ventas. Don Confiado sí." },
      { mensaje: "¿Qué necesito para instalar una puerta de madera?", tip: "Don Confiado agrupa productos DE TU catálogo por necesidad. Aumenta el ticket de venta con productos que realmente tienes." },
    ],
    argumento: "Meta AI es un experto en ferretería en general. Don Confiado es un experto en TU ferretería específica. Cuando un cliente pregunta, quiere saber si TÚ lo tienes, a qué precio y en qué cantidad. Solo Don Confiado puede responder eso.",
    metaComparacion: "Meta AI Conocimiento General vs Don Confiado RAG con tu Catálogo",
    metaLimite: "Meta: conocimiento general de internet, no conoce tu catálogo, precios o stock específico",
    donConfiado: "Don Confiado: conectado a TU inventario real, TUS precios actuales, TU historial de ventas",
  },
];

function startWhatsApp(version: string) {
  const backendUrl = `${process.env.BACKEND_BASE_URL || "https://backend-demo-6b6e.up.railway.app"}/api/${version}`;
  console.log(`🚀 Iniciando WhatsApp con ${backendUrl}`);
  currentQR = null;
  isConnected = false;
  handler = new WhatsAppHandler(backendUrl, (qr: string) => {
    currentQR = qr;
    isConnected = false;
    console.log("📱 QR actualizado");
  });
  handler.initSocket();
}

function checkSession(req: Request): boolean {
  const token = req.headers.cookie?.split("session=")[1]?.split(";")[0];
  if (!token || !sessions[token]) return false;
  if (sessions[token].expires < Date.now()) {
    delete sessions[token];
    return false;
  }
  return true;
}

setInterval(() => {
  fetch(`http://0.0.0.0:${PORT}/health`)
    .then(r => {
      if (r.ok) console.log("💓 Keep-alive OK");
    })
    .catch(() => {}); // ignora errores silenciosamente
}, 4 * 60 * 1000);

app.get("/", (req: Request, res: Response) => {
  if (checkSession(req)) return res.redirect("/dashboard");
  res.send(`<!DOCTYPE html><html><head><title>Don Confiado</title><meta charset="UTF-8">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Arial,sans-serif;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);min-height:100vh;display:flex;align-items:center;justify-content:center}
    .card{background:white;padding:40px;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,0.3);width:100%;max-width:400px}
    .logo{text-align:center;margin-bottom:30px}
    .logo h1{color:#333;font-size:28px}
    .logo p{color:#666;margin-top:8px}
    .form-group{margin-bottom:20px}
    label{display:block;color:#333;margin-bottom:6px;font-weight:bold}
    input{width:100%;padding:12px;border:2px solid #e0e0e0;border-radius:8px;font-size:16px}
    input:focus{outline:none;border-color:#667eea}
    .btn{width:100%;padding:14px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;border:none;border-radius:8px;font-size:16px;font-weight:bold;cursor:pointer}
    .error{color:red;text-align:center;margin-top:10px}
  </style></head><body>
  <div class="card">
    <div class="logo"><h1>🤝 Don Confiado</h1><p>Portal de Demos para Vendedores</p></div>
    <form method="POST" action="/login">
      <div class="form-group"><label>Usuario</label><input type="text" name="username" placeholder="Tu usuario" required autofocus/></div>
      <div class="form-group"><label>Contraseña</label><input type="password" name="password" placeholder="Tu contraseña" required/></div>
      <button type="submit" class="btn">Iniciar Sesión</button>
      ${req.query.error ? '<p class="error">❌ Usuario o contraseña incorrectos</p>' : ''}
    </form>
  </div></body></html>`);
});

app.post("/login", (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (USERS[username] && USERS[username] === password) {
    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
    sessions[token] = { user: username, expires: Date.now() + SESSION_DURATION };
    res.setHeader("Set-Cookie", `session=${token}; Path=/; HttpOnly; Max-Age=${SESSION_DURATION / 1000}`);
    return res.redirect("/dashboard");
  }
  res.redirect("/?error=1");
});

app.get("/qr-status", async (req: Request, res: Response) => {
  if (!checkSession(req)) return res.json({ error: "unauthorized" });
  let qrImage = null;
  if (currentQR) {
    try { qrImage = await QRCode.toDataURL(currentQR); } catch (err) {}
  }
  res.json({ connected: isConnected, qrImage });
});

app.get("/dashboard", async (req: Request, res: Response) => {
  if (!checkSession(req)) return res.redirect("/");

  let qrImage = null;
  if (currentQR) {
    try { qrImage = await QRCode.toDataURL(currentQR); } catch (err) {}
  }

  const currentDemo = DEMOS.find(d => d.id === currentVersion) || DEMOS[0];

  const demosHTML = DEMOS.map(demo => `
    <div class="demo-card ${demo.id === currentVersion ? 'active' : ''}">
      <div class="demo-info">
        <h3>${demo.name}</h3>
        <p>${demo.description}</p>
      </div>
      <form method="POST" action="/select-demo" style="margin:0">
        <input type="hidden" name="version" value="${demo.id}"/>
        <button type="submit" class="btn-demo ${demo.id === currentVersion ? 'btn-active' : ''}">
          ${demo.id === currentVersion ? '✅ Activo' : 'Activar'}
        </button>
      </form>
    </div>`).join('');

  const pasosHTML = currentDemo.pasos.map((paso, i) => `
    <div class="paso">
      <div class="paso-header">
        <span class="paso-num">Paso ${i + 1}</span>
        <button class="btn-copy" onclick="copyMsg(${i}, this)">📋 Copiar</button>
      </div>
      <div class="paso-msg">${paso.mensaje}</div>
      <div class="paso-tip">💡 ${paso.tip}</div>
    </div>`).join('');

  const statusHtml = isConnected
  ? '<div class="status connected">✅ LISTO — Envía mensajes de WhatsApp ahora</div>'
  : currentQR
  ? '<div class="status waiting">📱 ESCANEA el QR con tu teléfono para activar</div>'
  : '<div class="status connecting">⏳ ESPERA — Generando QR (15-30 segundos)...</div>';

  const qrHtml = qrImage
    ? `<img src="${qrImage}" alt="QR" style="width:180px;height:180px;border-radius:8px;margin:8px auto;display:block"/>
       <p class="wa-tip">WhatsApp → Dispositivos vinculados → Escanear QR</p>`
    : isConnected
    ? '<p style="color:#22c55e;font-size:40px;margin:16px 0;text-align:center">✅</p><p style="font-size:12px;color:#555;text-align:center">Listo para demostrar</p>'
    : '<p style="color:#999;font-size:12px;margin:16px 0;text-align:center">Generando QR...</p>';

  res.send(`<!DOCTYPE html><html><head>
  <title>Don Confiado - Portal de Demos</title>
  <meta charset="UTF-8">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Arial,sans-serif;background:#f0f2f5}
    .header{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;padding:16px 30px;display:flex;justify-content:space-between;align-items:center}
    .header h1{font-size:20px}
    .logout{color:white;text-decoration:none;background:rgba(255,255,255,0.2);padding:8px 16px;border-radius:8px;font-size:14px}
    .container{display:grid;grid-template-columns:300px 1fr;gap:20px;padding:20px;max-width:1400px;margin:0 auto}
    .panel{background:white;border-radius:12px;padding:20px;box-shadow:0 2px 10px rgba(0,0,0,0.08)}
    .panel h2{font-size:14px;color:#333;margin-bottom:16px}
    .demo-card{border:2px solid #e8e8e8;border-radius:10px;padding:12px 16px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:10px}
    .demo-card.active{border-color:#667eea;background:#f5f3ff}
    .demo-info h3{font-size:13px;color:#333;margin-bottom:3px}
    .demo-info p{font-size:11px;color:#888}
    .btn-demo{padding:7px 14px;border:none;border-radius:7px;cursor:pointer;font-size:11px;font-weight:bold;background:#e8e8e8;color:#555;white-space:nowrap}
    .btn-active{background:linear-gradient(135deg,#667eea,#764ba2);color:white}
    .guide{display:grid;grid-template-columns:1fr 260px;gap:20px}
    .story{background:white;border-radius:12px;padding:24px;box-shadow:0 2px 10px rgba(0,0,0,0.08)}
    .story-badge{display:inline-block;background:#f0f0ff;color:#667eea;border-radius:20px;padding:4px 12px;font-size:11px;font-weight:bold;margin-bottom:10px}
    .story h2{font-size:17px;color:#333;margin-bottom:14px}
    .contexto{background:#fffbf0;border-left:4px solid #f59e0b;padding:14px;border-radius:0 8px 8px 0;margin-bottom:14px}
    .contexto-label{font-size:10px;font-weight:bold;color:#d97706;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px}
    .contexto p{font-size:13px;color:#555;line-height:1.6}
    .ventaja-meta{background:#fef2f2;border-left:4px solid #ef4444;padding:12px;border-radius:0 8px 8px 0;margin-bottom:14px}
    .ventaja-meta p{font-size:12px;color:#991b1b;line-height:1.5}
    .comparacion{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px}
    .comp-card{border-radius:8px;padding:12px}
    .comp-meta{background:#fff1f2;border:1px solid #fecaca}
    .comp-dc{background:#f0fdf4;border:1px solid #bbf7d0}
    .comp-label{font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px}
    .comp-meta .comp-label{color:#dc2626}
    .comp-dc .comp-label{color:#16a34a}
    .comp-text{font-size:11px;line-height:1.5;color:#444}
    .pasos-title{font-size:13px;font-weight:bold;color:#333;margin-bottom:12px}
    .paso{background:#f8f9fa;border-radius:10px;padding:14px;margin-bottom:10px;border:1px solid #e8e8e8}
    .paso-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
    .paso-num{font-size:10px;font-weight:bold;color:#667eea;text-transform:uppercase;letter-spacing:1px}
    .btn-copy{background:#667eea;color:white;border:none;border-radius:6px;padding:5px 10px;font-size:11px;cursor:pointer;font-weight:bold}
    .btn-copy.copied{background:#22c55e}
    .paso-msg{background:white;border:1px solid #e0e0e0;border-radius:7px;padding:10px 12px;font-size:13px;color:#333;margin-bottom:8px;font-style:italic;line-height:1.5}
    .paso-tip{font-size:11px;color:#666;line-height:1.5}
    .argumento{background:linear-gradient(135deg,#667eea,#764ba2);color:white;border-radius:10px;padding:16px;margin-top:16px}
    .argumento-label{font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;opacity:0.8;margin-bottom:8px}
    .argumento p{font-size:13px;line-height:1.6}
    .wa-panel{background:white;border-radius:12px;padding:20px;box-shadow:0 2px 10px rgba(0,0,0,0.08);text-align:center}
    .wa-panel h3{font-size:14px;color:#333;margin-bottom:12px}
    .demo-activo{background:#f0f0ff;border-radius:8px;padding:8px;margin-bottom:10px;font-size:12px;color:#667eea;font-weight:bold}
    .instruccion{background:#e8f5e9;border-radius:8px;padding:10px;margin-bottom:12px;font-size:11px;color:#2e7d32;line-height:1.5}
    .status{padding:8px;border-radius:8px;margin-bottom:12px;font-size:12px;font-weight:bold}
    .status.connected{background:#d4edda;color:#155724}
    .status.waiting{background:#fff3cd;color:#856404}
    .status.connecting{background:#f8d7da;color:#721c24}
    .wa-tip{font-size:10px;color:#999;margin:6px 0 12px}
    .btn-reconnect{width:100%;padding:10px;background:#25d366;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:bold;font-size:13px;margin-top:10px}
    .refresh-note{font-size:10px;color:#bbb;margin-top:8px}
    @media(max-width:900px){.container{grid-template-columns:1fr}.guide{grid-template-columns:1fr}.comparacion{grid-template-columns:1fr}}
  </style></head><body>
  <div class="header">
    <h1>🤝 Don Confiado — Tu Socio de Ventas</h1>
    <a href="/logout" class="logout">Cerrar Sesión</a>
  </div>
  <div class="container">
    <div class="panel">
      <h2>💼 ¿Qué le quieres mostrar?</h2>
      ${demosHTML}
    </div>
    <div class="guide">
      <div class="story">
        <div class="story-badge">📖 Guía de Demo vs Meta AI</div>
        <h2>${currentDemo.name}</h2>

        <div class="contexto">
          <div class="contexto-label">🎯 Situación del cliente</div>
          <p>${currentDemo.contexto}</p>
        </div>

        <div class="ventaja-meta">
          <p>${currentDemo.ventajaMeta}</p>
        </div>

        <div class="comparacion">
          <div class="comp-card comp-meta">
            <div class="comp-label">❌ Meta AI</div>
            <div class="comp-text">${currentDemo.metaLimite}</div>
          </div>
          <div class="comp-card comp-dc">
            <div class="comp-label">✅ Don Confiado</div>
            <div class="comp-text">${currentDemo.donConfiado}</div>
          </div>
        </div>

        <p class="pasos-title">📱 Mensajes para la demo — copia y pega en WhatsApp:</p>
        ${pasosHTML}

        <div class="argumento">
          <div class="argumento-label">💬 Argumento de cierre</div>
          <p>${currentDemo.argumento}</p>
        </div>
      </div>

      <div class="wa-panel">
        <h3>📱 WhatsApp</h3>
        <div class="demo-activo">${currentDemo.name}</div>
        <div class="instruccion">⚠️ Selecciona el demo PRIMERO, luego escanea el QR</div>
        <div id="status-badge">${statusHtml}</div>
        <div id="qr-container">${qrHtml}</div>
        <form method="POST" action="/reconnect">
          <button type="submit" class="btn-reconnect">🔄 Reconectar WhatsApp</button>
        </form>
        <p class="refresh-note">El QR se actualiza automáticamente</p>
      </div>
    </div>
  </div>
  <script>
    const msgs = ${JSON.stringify(currentDemo.pasos.map(p => p.mensaje))};
    function copyMsg(i, btn) {
      navigator.clipboard.writeText(msgs[i]).then(() => {
        btn.textContent = '✅ Copiado';
        btn.classList.add('copied');
        setTimeout(() => { btn.textContent = '📋 Copiar'; btn.classList.remove('copied'); }, 2000);
      });
    }
    function refreshQR() {
      fetch('/qr-status')
        .then(r => r.json())
        .then(data => {
          if (data.error) return;
          const statusEl = document.getElementById('status-badge');
          const qrEl = document.getElementById('qr-container');
          if (data.connected) {
            statusEl.innerHTML = '<div class="status connected">✅ Bot conectado — listo para demostrar</div>';
            qrEl.innerHTML = '<p style="color:#22c55e;font-size:40px;margin:16px 0">✅</p><p style="font-size:12px;color:#555">Listo para demostrar</p>';
          } else if (data.qrImage) {
            statusEl.innerHTML = '<div class="status waiting">⏳ Escanea el QR para conectar</div>';
            qrEl.innerHTML = '<img src="' + data.qrImage + '" style="width:180px;height:180px;border-radius:8px;margin:8px auto;display:block"/><p class="wa-tip">WhatsApp → Dispositivos vinculados → Escanear QR</p>';
          } else {
            statusEl.innerHTML = '<div class="status connecting">🔄 Iniciando conexión...</div>';
            qrEl.innerHTML = '<p style="color:#999;font-size:12px;margin:16px 0">Generando QR...</p>';
          }
        }).catch(() => {});
    }
    setInterval(refreshQR, 10000);
  </script>
  </body></html>`);
});

app.post("/select-demo", (req: Request, res: Response) => {
  if (!checkSession(req)) return res.redirect("/");
  const { version } = req.body;
  if (DEMOS.find(d => d.id === version)) {
    currentVersion = version;
    // Solo actualiza BACKEND_URL sin reconectar WhatsApp
    if (handler) {
      const backendUrl = `${process.env.BACKEND_BASE_URL || "https://backend-demo-6b6e.up.railway.app"}/api/${version}`;
      (handler as any).BACKEND_URL = backendUrl;
      console.log(`🔄 Demo cambiado a: ${version} → ${backendUrl}`);
    } else {
      startWhatsApp(version);
    }
  }
  res.redirect("/dashboard");
});

app.post("/reconnect", (req: Request, res: Response) => {
  if (!checkSession(req)) return res.redirect("/");
  startWhatsApp(currentVersion);
  res.redirect("/dashboard");
});

app.get("/logout", (req: Request, res: Response) => {
  const token = req.headers.cookie?.split("session=")[1]?.split(";")[0];
  if (token) delete sessions[token];
  res.setHeader("Set-Cookie", "session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT");
  res.redirect("/");
});

app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", version: currentVersion, connected: isConnected });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Servidor en puerto ${PORT}`);
  startWhatsApp(currentVersion);
});
