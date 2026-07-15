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

const GRUPOS = [
  {
    id: "ventas",
    name: "💰 Don Confiado Ventas",
    subtitulo: "Genera más ingresos atendiendo mejor a tus clientes",
    color: "#16a34a",
    colorLight: "#f0fdf4",
    colorBorder: "#bbf7d0",
    demos: [
      {
        id: "chat_v1.0",
        name: "🧠 Asesor al Cliente",
        description: "Recuerda cada cliente, su historial y sus preferencias para siempre",
        contexto: "Pedro tiene 50 clientes frecuentes en su tienda de repuestos. No recuerda qué compra cada uno ni cuándo fue su último pedido. Con Meta gratuito, cada vez que un cliente escribe, el bot no sabe quién es. Con Don Confiado, cada cliente tiene su propio historial permanente que se puede explotar para vender más.",
        ventajaMeta: "⚡ Meta AI GRATIS olvida al cerrar el chat. Don Confiado recuerda a CADA cliente, su negocio, sus productos favoritos y su historial completo. Para siempre. Eso es un CRM conversacional.",
        pasos: [
          { mensaje: "Hola, soy Carlos del Taller Mecánico El Motor en Chapinero. Necesito aceite 20W50 y filtros de aire Honda", tip: "Simula ser el CLIENTE Carlos. Don Confiado guarda su nombre, taller, ubicación y productos preferidos. Esta información queda almacenada permanentemente." },
          { mensaje: "Hola, soy María de Lubrimotos Suba, ¿tienen filtros de aire para Yamaha?", tip: "Ahora simula ser otro cliente: María. Don Confiado crea un perfil independiente para cada cliente. Carlos y María tienen historiales separados." },
          { mensaje: "Hola, soy Carlos otra vez, ¿se acuerdan de mí?", tip: "🔥 MOMENTO WOW: Vuelve como Carlos. Don Confiado lo reconoce y recuerda su taller, su ubicación y lo que compró antes. Meta gratuito habría olvidado todo." },
          { mensaje: "¿Qué me compró Carlos la última vez y qué otros productos le podría ofrecer para su taller?", tip: "🔥 ARGUMENTO DE CIERRE: Perspectiva del dueño Pedro. Don Confiado convierte cada conversación en inteligencia de negocio explotable. Eso es un CRM conversacional." },
        ],
        argumento: "Cada conversación que tu cliente tiene con Don Confiado es un dato que queda guardado. En 3 meses tienes el historial completo de cada cliente: qué compra, cuándo compra y qué necesita. Eso vale más que cualquier Excel. Meta te da un bot. Don Confiado te da una memoria de negocio.",
        metaLimite: "Meta: olvida al cerrar el chat, sin historial por cliente, sin datos explotables",
        donConfiado: "Don Confiado: memoria permanente por cliente, historial completo, inteligencia de negocio acumulada",
      },
      {
        id: "chat_clase_03",
        name: "🔍 Buscador de Catálogo",
        description: "Tus clientes encuentran cualquier producto con lenguaje natural",
        contexto: "Luis tiene una ferretería con 2.000 productos. Cuando un cliente pregunta por algo específico, su vendedor tarda 5 minutos buscando en el sistema. Con Don Confiado, el cliente mismo puede buscar en tu catálogo real como si hablara con un experto.",
        ventajaMeta: "⚡ Meta AI conoce ferretería en general (datos de internet). Don Confiado conoce TU catálogo específico: TUS precios reales, TU stock actual, TUS productos. Esa es la diferencia entre IA genérica e IA de tu negocio.",
        pasos: [
          { mensaje: "¿Qué precio y stock tiene el tornillo hexagonal de 3/8?", tip: "Búsqueda en lenguaje natural. Sin códigos, sin categorías. El cliente pregunta como le hablaría a un vendedor experto. Don Confiado responde con TUS precios reales." },
          { mensaje: "¿Tienes algo similar pero más económico?", tip: "🔥 WOW: El sistema entiende contexto y sugiere alternativas de TU catálogo real. Meta sugeriría marcas genéricas que quizás ni vendes." },
          { mensaje: "¿Cuál es el producto más vendido de tornillería?", tip: "Análisis de TUS ventas reales al instante. Tu vendedor nunca más dirá 'déjame verificar'. La respuesta siempre está disponible." },
          { mensaje: "¿Qué necesito para instalar una puerta de madera?", tip: "🔥 ARGUMENTO DE CIERRE: Don Confiado agrupa productos DE TU catálogo por necesidad del cliente. Aumenta el ticket de venta automáticamente con productos que realmente tienes." },
        ],
        argumento: "Cada vez que un cliente pregunta y tu vendedor no sabe la respuesta, pierdes una venta. Don Confiado convierte a cualquier empleado en un experto de tu catálogo desde el primer día. Y lo hace a cualquier hora, sin cansarse.",
        metaLimite: "Meta: conocimiento general de internet, no conoce tu catálogo, precios o stock específico",
        donConfiado: "Don Confiado: conectado a TU inventario real, TUS precios actuales, TU historial de ventas",
      },
    ],
  },
  {
    id: "backoffice",
    name: "🏢 Don Confiado Backoffice",
    subtitulo: "Ahorra horas de trabajo manual y toma mejores decisiones",
    color: "#7c3aed",
    colorLight: "#f5f3ff",
    colorBorder: "#ddd6fe",
    demos: [
      {
        id: "chat_v1.1",
        name: "📋 Registro de Proveedores",
        description: "Registra proveedores en tu sistema solo hablando por WhatsApp",
        contexto: "María tiene una distribuidora y cada semana llegan 5 proveedores nuevos. Llenar formularios y Excel le toma 20 minutos por proveedor. Su equipo dedica 2 horas semanales solo en digitación de datos que podría evitarse.",
        ventajaMeta: "⚡ Meta AI NO puede escribir en bases de datos externas. Solo puede responder preguntas. Don Confiado conecta directamente con tu sistema y registra datos reales automáticamente.",
        pasos: [
          { mensaje: "Necesito crear un nuevo proveedor en el sistema", tip: "Meta responde 'Lo siento, no puedo hacer eso'. Don Confiado entiende la intención y comienza el proceso automáticamente." },
          { mensaje: "NIT 900123456, Razón Social Distribuidora El Sol SAS", tip: "Solo dicta los datos como si hablaras con un asistente humano. Don Confiado extrae NIT y razón social automáticamente." },
          { mensaje: "Dirección: Calle 45 # 23-10, Bogotá. Teléfono: 3001234567", tip: "Sigue dictando. El sistema extrae y organiza cada dato. Ningún bot de Meta puede hacer esto en tu base de datos real." },
          { mensaje: "¿Quedó bien registrado el proveedor?", tip: "🔥 MOMENTO WOW: Confirmación de registro real en base de datos. En vez de 20 minutos con formularios, 2 minutos hablando. Eso es ahorro real." },
        ],
        argumento: "En vez de abrir un sistema, buscar el módulo, llenar 15 campos y guardar... tu equipo simplemente habla. Don Confiado hace el trabajo administrativo por ellos. Ahorra 18 minutos por proveedor. Si tienes 5 proveedores nuevos por semana, son 6 horas mensuales recuperadas.",
        metaLimite: "Meta: no puede escribir en bases de datos externas, sin integración con sistemas internos",
        donConfiado: "Don Confiado: escritura directa en BD, integración con sistemas internos, automatización de procesos",
      },
      {
        id: "chat_v2.0",
        name: "📸 Lector de Facturas",
        description: "Foto a una factura = registro automático en tu sistema",
        contexto: "Carlos recibe 50 facturas al mes de sus proveedores. Su asistente tarda 2 horas diarias digitando datos en el sistema. Son 40 horas mensuales de trabajo que no agregan valor al negocio.",
        ventajaMeta: "⚡ Meta AI puede DESCRIBIR una factura ('veo una factura de $500.000'). Don Confiado la PROCESA: extrae NIT, productos, precios y los registra en tu sistema contable automáticamente.",
        pasos: [
          { mensaje: "Analiza esta factura y crea el producto y proveedor si aplica", tip: "Envía CON una foto de factura real. Meta diría 'es una factura de X empresa'. Don Confiado extrae y registra todos los datos estructurados." },
          { mensaje: "¿Qué datos exactos encontraste en la factura?", tip: "Don Confiado lista NIT, razón social, productos, precios unitarios, totales. Meta no estructura esta información ni la guarda en ningún sistema." },
          { mensaje: "¿Cuánto me costó el producto más caro de esta factura?", tip: "Consulta inteligente sobre los datos ya extraídos. Meta no puede hacer esto porque no almacenó nada estructurado." },
          { mensaje: "Crea una alerta si ese producto sube más del 10% en la próxima factura", tip: "🔥 MOMENTO WOW: Automatización contable real. Meta no tiene memoria entre facturas ni puede crear alertas de negocio. Eso ahorra dinero real." },
        ],
        argumento: "Tu equipo dedica 2 horas al día digitando facturas. Con Don Confiado, eso se convierte en 10 segundos por factura. Si tienes 50 facturas al mes, ahorras 40 horas mensuales de trabajo. A $15.000/hora, son $600.000 mensuales en productividad recuperada.",
        metaLimite: "Meta: describe imágenes pero no extrae datos estructurados ni los registra en sistemas",
        donConfiado: "Don Confiado: extrae, estructura y registra datos de facturas en tu base de datos en tiempo real",
      },
      {
        id: "chat_v3.0",
        name: "🤖 Asistente Inteligente",
        description: "Consulta inventario y toma decisiones con datos en tiempo real",
        contexto: "Ana tiene un supermercado y se le agotan productos sin darse cuenta. Pierde ventas todos los días. El agente Enterprise de Meta cuesta miles de dólares. Don Confiado ofrece las mismas capacidades para PYMEs a una fracción del costo.",
        ventajaMeta: "⚡ Meta Enterprise AI puede conectarse a inventarios PERO cuesta miles de dólares/mes y requiere equipo técnico. Don Confiado ofrece las mismas capacidades para PYMEs colombianas desde $300/mes.",
        pasos: [
          { mensaje: "¿Qué productos están por agotarse esta semana?", tip: "Consulta directa a BD en tiempo real. Meta Enterprise haría esto a 10x el costo. Don Confiado lo democratiza para PYMEs." },
          { mensaje: "¿Cuál fue el producto más vendido el mes pasado?", tip: "Análisis de ventas instantáneo. Sin reportes, sin Excel, sin esperar al contador. Información disponible 24/7." },
          { mensaje: "Recomiéndame qué pedir a mis proveedores esta semana", tip: "🔥 WOW: Inteligencia de negocio real. Cruza ventas + inventario + proveedores y hace recomendaciones. Meta no hace esto en plan básico." },
          { mensaje: "Genera la orden de compra para el proveedor principal", tip: "🔥 ARGUMENTO DE CIERRE: De análisis a acción en un mensaje. Don Confiado crea documentos reales. Meta solo puede sugerir, nunca ejecutar." },
        ],
        argumento: "Lo que Meta cobra como solución Enterprise ($2.000+/mes con ingenieros), Don Confiado lo ofrece a PYMEs colombianas desde $300/mes. Mismas capacidades, precio accesible, implementación en días no en meses.",
        metaLimite: "Meta Enterprise: costoso, requiere ingenieros, meses de implementación, diseñado para grandes empresas",
        donConfiado: "Don Confiado: asequible, listo en días, diseñado para PYMEs, soporte local en español",
      },
      {
        id: "chat_v3.1",
        name: "✅ Control del Dueño",
        description: "Nada se mueve sin tu aprobación explícita desde WhatsApp",
        contexto: "Roberto tiene 3 empleados que manejan pagos y compras. Le da miedo delegar porque no puede controlar lo que hacen en tiempo real. Con Meta, el bot ejecuta acciones automáticamente sin pedir permiso.",
        ventajaMeta: "⚡ Meta AI ejecuta acciones automáticamente sin consultar. Don Confiado implementa Human-in-the-Loop: NADA se ejecuta sin tu aprobación explícita. Tú tienes el control total desde tu celular.",
        pasos: [
          { mensaje: "Registra el pago de $500.000 al proveedor Distribuidora El Sol", tip: "Don Confiado PAUSA y pide aprobación. Meta haría esto automáticamente sin consultarte. ¿Confiarías en eso con el dinero de tu negocio?" },
          { mensaje: "si", tip: "SOLO después de tu 'si' explícito se ejecuta. Esto es lo que las grandes empresas llaman gobernanza de IA. Ahora está al alcance de PYMEs." },
          { mensaje: "Muéstrame todos los pagos aprobados hoy", tip: "Trazabilidad completa: sabes exactamente qué aprobaste y cuándo. Auditoría en tiempo real desde tu WhatsApp." },
          { mensaje: "no", tip: "🔥 MOMENTO WOW: El sistema se detiene inmediatamente. Con Meta, ya sería tarde. Con Don Confiado, tú siempre tienes la última palabra. Control total garantizado." },
        ],
        argumento: "Delega sin perder el control. Tu equipo opera con autonomía mientras tú tienes la última palabra en cada movimiento importante. Todo desde tu WhatsApp, sin importar dónde estés. Eso se llama tranquilidad empresarial.",
        metaLimite: "Meta: ejecución automática sin aprobación humana, difícil de auditar, sin control del dueño",
        donConfiado: "Don Confiado: aprobación explícita requerida, trazabilidad completa, el dueño siempre decide",
      },
    ],
  },
];

// Aplanar demos para búsqueda fácil
const ALL_DEMOS = GRUPOS.flatMap(g => g.demos);

function startWhatsApp(version: string) {
  const backendUrl = `${process.env.BACKEND_BASE_URL || "https://backend-demo-02ce.up.railway.app"}/api/${version}`;
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
    .then(r => { if (r.ok) console.log("💓 Keep-alive OK"); })
    .catch(() => {});
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

  const currentDemo = ALL_DEMOS.find(d => d.id === currentVersion) || ALL_DEMOS[0];
  const currentGrupo = GRUPOS.find(g => g.demos.some(d => d.id === currentVersion)) || GRUPOS[0];

  const gruposHTML = GRUPOS.map(grupo => `
    <div class="grupo">
      <div class="grupo-header" style="background:${grupo.colorLight};border-left:4px solid ${grupo.color}">
        <h3 style="color:${grupo.color}">${grupo.name}</h3>
        <p>${grupo.subtitulo}</p>
      </div>
      ${grupo.demos.map(demo => `
        <div class="demo-card ${demo.id === currentVersion ? 'active' : ''}" 
             style="${demo.id === currentVersion ? `border-color:${currentGrupo.color};background:${currentGrupo.colorLight}` : ''}">
          <div class="demo-info">
            <h4>${demo.name}</h4>
            <p>${demo.description}</p>
          </div>
          <form method="POST" action="/select-demo" style="margin:0">
            <input type="hidden" name="version" value="${demo.id}"/>
            <button type="submit" class="btn-demo" 
                    style="${demo.id === currentVersion ? `background:${currentGrupo.color};color:white` : ''}">
              ${demo.id === currentVersion ? '✅ Activo' : 'Activar'}
            </button>
          </form>
        </div>`).join('')}
    </div>`).join('');

  const pasosHTML = currentDemo.pasos.map((paso, i) => `
    <div class="paso">
      <div class="paso-header">
        <span class="paso-num" style="color:${currentGrupo.color}">Paso ${i + 1}</span>
        <button class="btn-copy" onclick="copyMsg(${i}, this)" style="background:${currentGrupo.color}">📋 Copiar</button>
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
    .container{display:grid;grid-template-columns:320px 1fr;gap:20px;padding:20px;max-width:1400px;margin:0 auto}
    .panel{background:white;border-radius:12px;padding:20px;box-shadow:0 2px 10px rgba(0,0,0,0.08);overflow-y:auto;max-height:calc(100vh - 100px)}
    .panel-title{font-size:14px;font-weight:bold;color:#333;margin-bottom:16px}
    .grupo{margin-bottom:20px}
    .grupo-header{padding:12px;border-radius:8px;margin-bottom:10px}
    .grupo-header h3{font-size:14px;font-weight:bold;margin-bottom:4px}
    .grupo-header p{font-size:11px;color:#666}
    .demo-card{border:2px solid #e8e8e8;border-radius:10px;padding:12px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;gap:10px}
    .demo-info h4{font-size:13px;color:#333;margin-bottom:3px}
    .demo-info p{font-size:11px;color:#888}
    .btn-demo{padding:7px 14px;border:none;border-radius:7px;cursor:pointer;font-size:11px;font-weight:bold;background:#e8e8e8;color:#555;white-space:nowrap;min-width:70px}
    .guide{display:grid;grid-template-columns:1fr 260px;gap:20px}
    .story{background:white;border-radius:12px;padding:24px;box-shadow:0 2px 10px rgba(0,0,0,0.08)}
    .grupo-badge{display:inline-block;border-radius:20px;padding:4px 12px;font-size:11px;font-weight:bold;margin-bottom:8px}
    .story-badge{display:inline-block;background:#f0f0ff;color:#667eea;border-radius:20px;padding:4px 12px;font-size:11px;font-weight:bold;margin-bottom:8px;margin-left:6px}
    .story h2{font-size:17px;color:#333;margin-bottom:14px}
    .contexto{background:#fffbf0;border-left:4px solid #f59e0b;padding:14px;border-radius:0 8px 8px 0;margin-bottom:12px}
    .contexto-label{font-size:10px;font-weight:bold;color:#d97706;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px}
    .contexto p{font-size:13px;color:#555;line-height:1.6}
    .ventaja-meta{border-left:4px solid #ef4444;padding:12px;border-radius:0 8px 8px 0;margin-bottom:12px;background:#fef2f2}
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
    .paso-num{font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:1px}
    .btn-copy{color:white;border:none;border-radius:6px;padding:5px 10px;font-size:11px;cursor:pointer;font-weight:bold}
    .btn-copy.copied{background:#22c55e !important}
    .paso-msg{background:white;border:1px solid #e0e0e0;border-radius:7px;padding:10px 12px;font-size:13px;color:#333;margin-bottom:8px;font-style:italic;line-height:1.5}
    .paso-tip{font-size:11px;color:#666;line-height:1.5}
    .argumento{color:white;border-radius:10px;padding:16px;margin-top:16px}
    .argumento-label{font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;opacity:0.8;margin-bottom:8px}
    .argumento p{font-size:13px;line-height:1.6}
    .wa-panel{background:white;border-radius:12px;padding:20px;box-shadow:0 2px 10px rgba(0,0,0,0.08);text-align:center}
    .wa-panel h3{font-size:14px;color:#333;margin-bottom:12px}
    .demo-activo{border-radius:8px;padding:8px;margin-bottom:10px;font-size:12px;font-weight:bold}
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
    <h1>🤝 Don Confiado — Portal de Demos</h1>
    <a href="/logout" class="logout">Cerrar Sesión</a>
  </div>
  <div class="container">
    <div class="panel">
      <p class="panel-title">¿Qué le quieres mostrar a tu cliente?</p>
      ${gruposHTML}
    </div>
    <div class="guide">
      <div class="story">
        <div>
          <span class="grupo-badge" style="background:${currentGrupo.colorLight};color:${currentGrupo.color}">${currentGrupo.name}</span>
          <span class="story-badge">📖 Guía de Demo</span>
        </div>
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
        <div class="argumento" style="background:linear-gradient(135deg,${currentGrupo.color},${currentGrupo.color}dd)">
          <div class="argumento-label">💬 Argumento de cierre</div>
          <p>${currentDemo.argumento}</p>
        </div>
      </div>
      <div class="wa-panel">
        <h3>📱 WhatsApp</h3>
        <div class="demo-activo" style="background:${currentGrupo.colorLight};color:${currentGrupo.color}">${currentDemo.name}</div>
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
            statusEl.innerHTML = '<div class="status connected">✅ LISTO — Envía mensajes de WhatsApp ahora</div>';
            qrEl.innerHTML = '<p style="color:#22c55e;font-size:40px;margin:16px 0">✅</p><p style="font-size:12px;color:#555">Listo para demostrar</p>';
          } else if (data.qrImage) {
            statusEl.innerHTML = '<div class="status waiting">📱 ESCANEA el QR con tu teléfono para activar</div>';
            qrEl.innerHTML = '<img src="' + data.qrImage + '" style="width:180px;height:180px;border-radius:8px;margin:8px auto;display:block"/><p class="wa-tip">WhatsApp → Dispositivos vinculados → Escanear QR</p>';
          } else {
            statusEl.innerHTML = '<div class="status connecting">⏳ ESPERA — Generando QR (15-30 segundos)...</div>';
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
  if (ALL_DEMOS.find(d => d.id === version)) {
    currentVersion = version;
    if (handler) {
      const backendUrl = `${process.env.BACKEND_BASE_URL || "https://backend-demo-02ce.up.railway.app"}/api/${version}`;
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
