import express, { Request, Response } from "express";
import * as QRCode from "qrcode";
import { WhatsAppHandler } from "./whatsapp_handler";

const app = express();
const PORT = parseInt(process.env.PORT || "8000");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let currentQR: string | null = null;
let currentVersion = "chat_v1.1";
let handler: WhatsAppHandler | null = null;
let isConnected = false;

const USERS: Record<string, string> = {
  [process.env.DEMO_USER_1 || "vendedor1"]: process.env.DEMO_PASS_1 || "demo123",
  [process.env.DEMO_USER_2 || "vendedor2"]: process.env.DEMO_PASS_2 || "demo456",
  [process.env.DEMO_USER_3 || "admin"]: process.env.DEMO_PASS_3 || "admin123",
};

const sessions: Record<string, string> = {};

const DEMOS = [
  {
    id: "chat_v1.0",
    name: "🧠 Asesor Básico",
    description: "Conversa con tu cliente y recuerda todo lo que te dice",
    contexto: "Don Pedro tiene una tienda de repuestos y atiende 30 clientes al día. Cada vez que alguien llama, tiene que buscar el historial a mano.",
    valor: "Con Don Confiado, cada cliente tiene su propio historial. El asistente recuerda todo automáticamente.",
    pasos: [
      { mensaje: "Hola, soy Pedro y tengo una tienda de repuestos para motos", tip: "El cliente se presenta. Observa cómo Don Confiado lo saluda y recuerda su negocio." },
      { mensaje: "¿Cuáles son mis productos más rentables?", tip: "Pregunta de negocio. Fíjate cómo el asistente recuerda que es una tienda de repuestos." },
      { mensaje: "¿Cómo me llamo y qué negocio tengo?", tip: "¡Aquí viene el WOW! El asistente demuestra que recuerda TODO lo que dijiste antes." },
      { mensaje: "Ayúdame a crear un mensaje de bienvenida para mis clientes nuevos", tip: "Muestra la versatilidad. El asistente usa el contexto del negocio para crear contenido útil." },
    ],
    argumento: "Imagina que cada cliente llega y tu asistente ya sabe quién es, qué compra y qué necesita. Eso es lo que hace Don Confiado: convierte cada conversación en una oportunidad de venta personalizada.",
  },
  {
    id: "chat_v1.1",
    name: "📋 Registro de Proveedores",
    description: "Registra proveedores automáticamente solo hablando por WhatsApp",
    contexto: "María tiene una distribuidora y cada semana llegan 5 proveedores nuevos. Llenar formularios y Excel le toma 20 minutos por proveedor.",
    valor: "Con Don Confiado, registra un proveedor completo en menos de 2 minutos solo hablando por WhatsApp.",
    pasos: [
      { mensaje: "Necesito crear un nuevo proveedor", tip: "El asistente entiende la intención y comienza a guiar el proceso automáticamente." },
      { mensaje: "NIT 900123456, Razón Social Distribuidora El Sol SAS", tip: "Solo dicta los datos como si hablaras con un asistente humano. Observa cómo los captura." },
      { mensaje: "Dirección: Calle 45 # 23-10, Bogotá. Teléfono: 3001234567", tip: "Sigue dictando. El sistema extrae y organiza cada dato automáticamente." },
      { mensaje: "¿Quedó bien registrado el proveedor?", tip: "El momento WOW: el sistema confirma el registro completo sin ningún formulario." },
    ],
    argumento: "En vez de abrir un sistema, buscar el módulo, llenar 15 campos y guardar... tu equipo simplemente habla. Don Confiado hace el trabajo administrativo por ellos. Ahorra 18 minutos por proveedor.",
  },
  {
    id: "chat_v2.0",
    name: "📸 Lector de Facturas",
    description: "Toma foto a una factura y registra productos y proveedores al instante",
    contexto: "Carlos recibe 50 facturas al mes de sus proveedores. Su asistente tarda 2 horas diarias digitando datos en el sistema.",
    valor: "Con Don Confiado, toma una foto a la factura y en 10 segundos está registrada con todos sus datos.",
    pasos: [
      { mensaje: "Analiza esta factura y crea el producto y proveedor si aplica", tip: "Envía este mensaje JUNTO con una foto de una factura. El sistema lee la imagen automáticamente." },
      { mensaje: "¿Qué datos encontraste en la factura?", tip: "El asistente muestra todos los datos que extrajo: productos, precios, proveedor, NIT, fechas." },
      { mensaje: "¿Cuánto me costó el producto más caro de la factura?", tip: "Ahora puedes hacerle preguntas sobre la factura como si hablaras con un contador." },
      { mensaje: "Crea una alerta si el precio de ese producto sube más del 10%", tip: "Muestra el poder de automatización: el sistema entiende instrucciones complejas de negocio." },
    ],
    argumento: "Tu equipo dedica 2 horas al día digitando facturas. Con Don Confiado, eso se convierte en 10 segundos por factura. Calcula: si tienes 50 facturas al mes, ahorras 40 horas mensuales de trabajo.",
  },
  {
    id: "chat_v3.0",
    name: "🤖 Asistente Inteligente",
    description: "Consulta inventario, alertas y recomendaciones en tiempo real",
    contexto: "Ana tiene un supermercado y se le agotan productos sin darse cuenta. Pierde ventas todos los días por no tener el inventario actualizado.",
    valor: "Don Confiado monitorea tu inventario y te avisa cuando algo está por agotarse, antes de que pierdas la venta.",
    pasos: [
      { mensaje: "¿Qué productos están por agotarse esta semana?", tip: "El asistente consulta la base de datos en tiempo real y genera una lista priorizada de alertas." },
      { mensaje: "¿Cuál fue el producto más vendido el mes pasado?", tip: "Análisis de ventas instantáneo. Sin reportes, sin Excel, sin esperar al contador." },
      { mensaje: "Recomiéndame qué pedir a mis proveedores esta semana", tip: "El WOW más grande: el asistente cruza ventas + inventario + proveedores y hace recomendaciones inteligentes." },
      { mensaje: "Genera la orden de compra para el proveedor principal", tip: "De la recomendación a la acción en un mensaje. El asistente crea documentos de negocio automáticamente." },
    ],
    argumento: "Tus mejores decisiones de negocio las tomas con información. Don Confiado pone toda la inteligencia de tu negocio en tu WhatsApp, disponible 24/7 para ti y tu equipo.",
  },
  {
    id: "chat_v3.1",
    name: "✅ Control del Dueño",
    description: "El dueño aprueba cada acción importante desde WhatsApp",
    contexto: "Roberto tiene 3 empleados que manejan pagos y compras. Le da miedo delegar porque no puede controlar lo que hacen en tiempo real.",
    valor: "Con Don Confiado, nada se mueve sin tu aprobación. Tú decides desde el celular, en segundos.",
    pasos: [
      { mensaje: "Registra el pago de $500.000 al proveedor Distribuidora El Sol", tip: "El empleado solicita registrar un pago. Observa lo que pasa a continuación." },
      { mensaje: "si", tip: "El dueño aprueba con un simple 'si'. El sistema registra y confirma el pago solo cuando hay aprobación." },
      { mensaje: "Muéstrame todos los pagos aprobados hoy", tip: "Control total: el dueño puede ver en cualquier momento qué se ha movido en su negocio." },
      { mensaje: "no", tip: "Prueba rechazando una acción. El sistema se detiene y notifica que fue rechazada. Control total garantizado." },
    ],
    argumento: "Delega sin perder el control. Tu equipo puede operar con autonomía mientras tú tienes la última palabra en cada movimiento importante. Todo desde tu WhatsApp, sin importar dónde estés.",
  },
  {
    id: "chat_clase_03",
    name: "🔍 Buscador de Catálogo",
    description: "Encuentra cualquier producto al instante con lenguaje natural",
    contexto: "Luis tiene una ferretería con 2.000 productos. Cuando un cliente pregunta por algo específico, su vendedor tarda 5 minutos buscando en el sistema.",
    valor: "Con Don Confiado, encuentra cualquier producto en segundos solo preguntando en lenguaje natural.",
    pasos: [
      { mensaje: "¿Qué precio y stock tiene el tornillo hexagonal de 3/8?", tip: "Búsqueda en lenguaje natural. Sin códigos, sin categorías. Solo pregunta como le hablarías a un experto." },
      { mensaje: "¿Tienes algo similar pero más económico?", tip: "El WOW: el sistema entiende contexto y sugiere alternativas. Como un vendedor experto que conoce todo el catálogo." },
      { mensaje: "¿Cuál es el producto más vendido de tornillería?", tip: "Análisis de ventas del catálogo al instante. Tu vendedor nunca más dirá 'déjame verificar'." },
      { mensaje: "¿Qué necesito para instalar una puerta de madera?", tip: "El nivel más alto: el asistente agrupa productos por necesidad del cliente, aumentando el ticket de venta." },
    ],
    argumento: "Cada vez que un cliente pregunta y tu vendedor no sabe la respuesta, pierdes una venta. Don Confiado convierte a cualquier empleado en un experto de tu catálogo desde el primer día.",
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
  return token ? !!sessions[token] : false;
}

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
    sessions[token] = username;
    res.setHeader("Set-Cookie", `session=${token}; Path=/; HttpOnly`);
    return res.redirect("/dashboard");
  }
  res.redirect("/?error=1");
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
        <button class="btn-copy" onclick="copyMsg(${i})">📋 Copiar</button>
      </div>
      <div class="paso-msg" id="msg-${i}">${paso.mensaje}</div>
      <div class="paso-tip">💡 ${paso.tip}</div>
    </div>`).join('');

  res.send(`<!DOCTYPE html><html><head>
  <title>Don Confiado - Portal de Demos</title>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="30">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Arial,sans-serif;background:#f0f2f5}
    .header{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;padding:16px 30px;display:flex;justify-content:space-between;align-items:center}
    .header h1{font-size:20px}
    .logout{color:white;text-decoration:none;background:rgba(255,255,255,0.2);padding:8px 16px;border-radius:8px;font-size:14px}
    .container{display:grid;grid-template-columns:320px 1fr;gap:20px;padding:20px;max-width:1400px;margin:0 auto}
    .panel{background:white;border-radius:12px;padding:20px;box-shadow:0 2px 10px rgba(0,0,0,0.08)}
    .panel h2{font-size:15px;color:#333;margin-bottom:16px}
    .demo-card{border:2px solid #e8e8e8;border-radius:10px;padding:12px 16px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:10px;transition:all 0.2s}
    .demo-card.active{border-color:#667eea;background:#f5f3ff}
    .demo-info h3{font-size:13px;color:#333;margin-bottom:3px}
    .demo-info p{font-size:11px;color:#888}
    .btn-demo{padding:7px 14px;border:none;border-radius:7px;cursor:pointer;font-size:12px;font-weight:bold;background:#e8e8e8;color:#555;white-space:nowrap}
    .btn-active{background:linear-gradient(135deg,#667eea,#764ba2);color:white}
    .guide{display:grid;grid-template-columns:1fr 260px;gap:20px}
    .story{background:white;border-radius:12px;padding:24px;box-shadow:0 2px 10px rgba(0,0,0,0.08)}
    .story-badge{display:inline-block;background:#f0f0ff;color:#667eea;border-radius:20px;padding:4px 12px;font-size:11px;font-weight:bold;margin-bottom:10px}
    .story h2{font-size:17px;color:#333;margin-bottom:14px}
    .contexto{background:#fffbf0;border-left:4px solid #f59e0b;padding:14px;border-radius:0 8px 8px 0;margin-bottom:20px}
    .contexto-label{font-size:10px;font-weight:bold;color:#d97706;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px}
    .contexto p{font-size:13px;color:#555;line-height:1.6}
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
    .demo-activo{background:#f0f0ff;border-radius:8px;padding:8px;margin-bottom:12px;font-size:12px;color:#667eea;font-weight:bold}
    .status{padding:8px;border-radius:8px;margin-bottom:12px;font-size:12px;font-weight:bold}
    .status.connected{background:#d4edda;color:#155724}
    .status.waiting{background:#fff3cd;color:#856404}
    .status.connecting{background:#f8d7da;color:#721c24}
    .wa-panel img{width:180px;height:180px;margin:8px auto;display:block;border-radius:8px}
    .wa-tip{font-size:10px;color:#999;margin:6px 0 12px}
    .btn-reconnect{width:100%;padding:10px;background:#25d366;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:bold;font-size:13px}
    .refresh-note{font-size:10px;color:#bbb;margin-top:8px}
    @media(max-width:900px){.container{grid-template-columns:1fr}.guide{grid-template-columns:1fr}}
  </style></head><body>
  <div class="header">
    <h1>🤝 Don Confiado — Tu Socio de Ventas</h1>
    <a href="/logout" class="logout">Cerrar Sesión</a>
  </div>
  <div class="container">
    <div class="panel">
      <h2>💼 ¿Qué le quieres mostrar a tu cliente?</h2>
      ${demosHTML}
    </div>
    <div class="guide">
      <div class="story">
        <div class="story-badge">📖 Guía de Demo</div>
        <h2>${currentDemo.name}</h2>
        <div class="contexto">
          <div class="contexto-label">🎯 Situación del cliente</div>
          <p>${currentDemo.contexto}</p>
        </div>
        <p class="pasos-title">📱 Mensajes clave — copia y pega en WhatsApp:</p>
        ${pasosHTML}
        <div class="argumento">
          <div class="argumento-label">💬 Argumento de cierre</div>
          <p>${currentDemo.argumento}</p>
        </div>
      </div>
      <div class="wa-panel">
        <h3>📱 WhatsApp</h3>
        <div class="demo-activo">${currentDemo.name}</div>
        ${isConnected
          ? '<div class="status connected">✅ Bot conectado</div>'
          : currentQR
          ? '<div class="status waiting">⏳ Escanea el QR</div>'
          : '<div class="status connecting">🔄 Iniciando...</div>'
        }
        ${qrImage
          ? `<img src="${qrImage}" alt="QR"/><p class="wa-tip">WhatsApp → Dispositivos vinculados → Escanear QR</p>`
          : isConnected
          ? '<p style="color:#22c55e;font-size:40px;margin:16px 0">✅</p><p style="font-size:12px;color:#555">Listo para demostrar</p>'
          : '<p style="color:#999;font-size:12px;margin:16px 0">Generando QR...</p>'
        }
        <form method="POST" action="/reconnect" style="margin-top:10px">
          <button type="submit" class="btn-reconnect">🔄 Reconectar</button>
        </form>
        <p class="refresh-note">Se actualiza cada 30 seg</p>
      </div>
    </div>
  </div>
  <script>
    const msgs = ${JSON.stringify(currentDemo.pasos.map(p => p.mensaje))};
    function copyMsg(i) {
      navigator.clipboard.writeText(msgs[i]).then(() => {
        const btns = document.querySelectorAll('.btn-copy');
        btns[i].textContent = '✅ Copiado';
        btns[i].classList.add('copied');
        setTimeout(() => { btns[i].textContent = '📋 Copiar'; btns[i].classList.remove('copied'); }, 2000);
      });
    }
  </script>
  </body></html>`);
});

app.post("/select-demo", (req: Request, res: Response) => {
  if (!checkSession(req)) return res.redirect("/");
  const { version } = req.body;
  if (DEMOS.find(d => d.id === version)) {
    currentVersion = version;
    startWhatsApp(version);
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
