# Plan de implementación — Planificador de viajes con AI "powered by WhatToDo"

## Contexto
Andre Palacios vende muchos tours al día en whattodoincancun.com. El sitio está hecho con Astro 5, Tailwind 4 y HeroUI (React), está hospedado en Vercel y vende con Bokun (canal `8b31caec-8877-411a-85ad-682828170619`). Ya vende traslados del aeropuerto, y tiene WhatsApp de ventas, el chat Tawk.to y una sección "Virtual Concierge".

Se quiere una **landing propia** (el nombre aún no se decide) con la marca **"powered by WhatToDo"**. En ella el viajero:
1. Da los datos de su viaje.
2. Elige su vuelo real.
3. Dice quiénes lo acompañan, su presupuesto por persona, sus intereses y si quiere días de descanso (chill days) y traslados.
4. Recibe un itinerario armado por la AI con tours reales de Bokun.
5. Deja su correo y recibe un **PDF atractivo** de su viaje. Al mismo tiempo, el equipo de ventas recibe el lead y puede **responder directo** para cerrar la venta.

Andre también necesita un **panel interno** para ver los itinerarios y leads que llegan por esta vía.

**Decisiones tomadas:**
- **Bokun solo en modo lectura.** La plataforma lee catálogo, precios y disponibilidad reales de Bokun. **No crea, modifica ni cancela reservas.** La llave de Bokun se pide con permisos de solo lectura.
- **La reserva la hace a mano un agente de ventas del call center** (una persona, no una AI). Cuando el cliente da "Listo" con su correo, salen **dos correos distintos**:
  - **Al agente de ventas** (buzón compartido, ej. sales@whattodoincancun.com): un correo **operativo**, pensado para reservar rápido en Bokun: datos del cliente, viajeros con edades, y por cada tour el ID de Bokun, fecha, hora, categoría de precio, punto de recogida y link directo al producto en el extranet. Con **Reply-To = correo del cliente** para contestarle directo.
  - **Al cliente**: un correo **limpio y llamativo** con la marca, el resumen del viaje, el PDF adjunto y el botón "Talk to a specialist" (WhatsApp).
- **Primero que funcione completo en local.** El PDF siempre se descarga también en pantalla. Los correos se construyen desde el inicio detrás de `EmailProvider`: en local se guardan en la base y se ven en el panel (para revisar las plantillas); al tener la cuenta de Resend se prende el envío real.
- **Deploy**: aún no se decide dónde se hospeda. El código no depende de ningún host: Node + Postgres + variables de entorno.
- **Dominio y nombre**: pendientes.
- **Alcance del catálogo (14 oct 2026):** la AI solo recomienda los productos que tienen página en whattodoincancun.com (114 de 331 activos en Bokun). Los demás productos del marketplace quedan fuera.

---

## APIs y cuentas que hay que pedir

En orden de urgencia. Las dos primeras hacen falta para empezar; el resto se puede pedir mientras se construye.

| # | Qué | Para qué | Quién la da / dónde | Cuándo se necesita | Costo aprox. |
|---|---|---|---|---|---|
| 1 | **Bokun API key de producción, solo lectura** (access key + secret key). Nombre sugerido: `WhatToDo AI Planner – Read Only` | Leer catálogo, precios y disponibilidad reales | Andre, en https://extranet.bokun.io → Settings → API keys, ligada al booking channel del sitio. Permisos: **solo lectura** de productos, precios y disponibilidad. Sin permiso de reservas. Guía: bokun.dev → "Configuring the platform for API usage and authentication" | **Fase 1 (semana 1)** | Incluido en Bokun |
| 2 | **Anthropic API key** | Motor de AI (Claude Sonnet 5.5) | console.anthropic.com, tarjeta de la empresa | **Fase 3**, pero conviene tenerla desde el inicio | Por uso, ~USD 0.02–0.05 por itinerario con prompt caching |
| 3 | **Supabase** (proyecto) | Base de datos, login del panel, storage del PDF | supabase.com, cuenta a nombre de la empresa. En local se puede usar `supabase start` sin cuenta | Fase 0 (local), nube al desplegar | Gratis para empezar, Pro USD 25/mes |
| 4 | **AeroDataBox API key** | Buscar vuelos reales a y desde CUN | RapidAPI (rapidapi.com/aedbx-aedbx/api/aerodatabox) o api.market. Suscripción a nombre de la empresa | Fase 2 | Plan gratis para desarrollar; ~USD 10–30/mes en producción según volumen |
| 5 | **Resend** (API key + dominio verificado) | Correos al cliente y al agente de ventas | resend.com; hay que agregar registros DNS del dominio que envía (ej. whattodoincancun.com) | Fase 4 (las plantillas se desarrollan sin la cuenta; se necesita para enviar de verdad) | Gratis hasta 3,000 correos/mes |
| 6 | **Buzón compartido** (ej. sales@whattodoincancun.com) | Recibir los leads y responder | Andre, en su correo corporativo | Fase 4 | — |
| 7 | **Cloudflare Turnstile** (site key + secret) | Evitar bots que gasten AI y correos | cloudflare.com, gratis | Deploy | Gratis |
| 8 | **Upstash Redis** | Rate limit y caché en producción | upstash.com | Deploy | Gratis para empezar |
| 9 | **Host y dominio** (Vercel, Railway u otro + subdominio o dominio nuevo) | Publicar la plataforma | Decisión de Andre | Deploy | USD 0–20/mes |

No se necesita cuenta de pruebas de Bokun: la plataforma no crea reservas.

Opcional más adelante: **Google Places API** para autocompletar el hotel del cliente (hay un plan gratis mensual).

Todas las llaves se guardan solo como variables de entorno (`.env` en local, secrets del host en producción). Nunca en el repo ni en el navegador.

---

## Arquitectura

```
[Landing Next.js] ── componentes React (wizard + itinerario)
        │  (solo HTTPS a rutas internas; el navegador nunca ve llaves)
        ▼
[Rutas API del servidor (Next.js Route Handlers)]
   ├─ /api/flights/search   → FlightProvider (AeroDataBox | manual)
   ├─ /api/itinerary        → Claude API (tool use) + catálogo Bokun
   ├─ /api/trip/pdf         → genera PDF y lo devuelve para descargar
   ├─ /api/lead             → guarda lead → EmailProvider (correo al cliente + correo al agente)
   ├─ /api/cron/catalog     → sincroniza el catálogo de Bokun
   └─ /admin/*              → panel protegido (Supabase Auth)
        │
        ├─ Bokun REST API (firma HMAC, solo del lado del servidor)
        ├─ Postgres vía Supabase (leads, itinerarios, caché del catálogo, con RLS)
        └─ Caché en memoria en local; Redis (Upstash) cuando se despliegue
```

**Stack:**
- **Next.js 15 (App Router) + TypeScript**. Se ejecuta con `npm run dev` en local y en cualquier host que corra Node.
- Tailwind 4 + HeroUI para usar los mismos componentes que el sitio.
- Supabase para la base de datos y el login del panel. En local se usa `supabase start` (Docker) o el proyecto gratuito en la nube.
- `@react-pdf/renderer` para generar el PDF.
- Claude API, modelo `claude-sonnet-5-5`.
- Correo: `EmailProvider` con dos implementaciones, `console/db` (por defecto en local) y `resend` (cuando se active).

**Puertas abiertas con feature flags (`src/server/config/flags.ts`, leídas de `.env`):**
| Flag | Por defecto | Qué hace |
|---|---|---|
| `EMAIL_PROVIDER` | `db` | `db`: el correo se guarda en `outbound_emails` y se ve en el panel (desarrollo). `resend`: se envía de verdad. |
| `FLIGHTS_PROVIDER` | `aerodatabox` | Puede ser `manual` para trabajar sin API de vuelos. |
| `CAPTCHA_ENABLED` | `false` en local | Turnstile se prende al desplegar. |

¿Por qué Next.js y no meterlo dentro del Astro actual? La landing es un producto aparte con su propia marca y necesita backend (rutas API y panel admin). Cuando se decida el dominio, se puede montar en un subdominio o en una ruta servida por proxy.

---

## Sistema de diseño (igual al de WhatToDo)
- Letra **Nunito** (Light 300, SemiBold 600, Bold 700), con los mismos archivos `.ttf` del sitio.
- Botón principal **green-700 / green-600**. Degradado de marca `#00AAFF → #192F5D`. Acentos `#ff6a00` (ofertas) y `#81bd00`. Texto `#1a1a1a`.
- Botones tipo píldora (`rounded-full`), tarjetas `rounded-xl`, buscadores con radio de 40px y radios HeroUI de 8, 12 y 14px. Casi nada en mayúsculas.
- Las tarjetas de tour se ven igual que en el sitio: rating con número de reseñas, duración, "From $X USD per person" y la etiqueta de oferta.
- Todo esto se define como tokens en `tailwind.config` / `@theme` en un archivo `src/styles/tokens.css`.
- La v1 es bilingüe, inglés y español, con `next-intl`.

---

## Flujo del usuario

1. **Landing "powered by WhatToDo"**
   - Hero con el degradado de marca y el botón "Plan my trip".
   - Sección de confianza: años de operación, número de reseñas y rating, premios (TripAdvisor Travelers' Choice, etc.) y la red de colaboradores y operadores. También los sitios hermanos (CDMX y Madrid).
   - Este contenido vive en `src/content/brand.ts`, para que Andre lo cambie sin tocar el código.
2. **Paso 1: Vuelos**
   - **Llegada:** el usuario pone la fecha y la ciudad o aeropuerto de origen, o directamente su número de vuelo. Se le muestran tarjetas con los vuelos que llegan a CUN ese día (aerolínea, número, hora de salida y de llegada) y elige uno.
   - **Regreso:** lo mismo, con los vuelos que salen de CUN.
   - Si no encuentra su vuelo, puede escribir la fecha y hora a mano.
   - Las horas de los vuelos sirven para no poner tours el día de llegada o de salida y para programar los traslados.
3. **Paso 2: Hospedaje y traslados**
   - Hotel o zona (Zona Hotelera, Playa del Carmen, Tulum, Costa Mujeres…).
   - Si quiere traslado aeropuerto → hotel, hotel → aeropuerto, o ambos. Si existe, también la opción de traslado de lujo.
4. **Paso 3: Viajeros**
   - Número de adultos y de niños, con la edad de cada niño. Esto es necesario porque Bokun cobra según la edad (adulto es de 13 años en adelante).
   - Nombres de los acompañantes (opcional).
5. **Paso 4: Preferencias**
   - Intereses (puede elegir varios): Aventura, Cultural / Ruinas mayas, Gastronómico, Agua / Playa, Fiesta, Parejas.
   - Días de descanso: ninguno, 1 o 2, o "un día de por medio".
   - **Presupuesto por persona** en USD, con un slider por rangos.
6. **Paso 5: Itinerario generado**
   - Se muestra día por día. Cada tour sale como tarjeta con su precio real de Bokun y el total por persona y por grupo.
   - El usuario puede cambiar o quitar un tour, o pedir "algo más tranquilo". La AI vuelve a generar solo ese día.
7. **Paso 6: Correo y PDF**
   - El usuario escribe nombre, correo y WhatsApp (opcional), y marca la casilla de consentimiento de privacidad.
   - El sistema genera el PDF. **Siempre** se puede descargar directo en la pantalla.
   - Se guardan el lead y el viaje, y salen **dos correos distintos** (ver "Leads, PDF y correo"):
     - **Al cliente:** limpio y llamativo, con la marca, el resumen del viaje día por día, el PDF adjunto y el botón "Talk to a specialist" (WhatsApp con el texto ya escrito).
     - **Al agente de ventas** (buzón compartido): operativo, con todo lo que necesita para hacer la reserva a mano en Bokun. **Reply-To = correo del cliente**, para que el agente solo dé "Responder".
   - Pantalla final: "Listo, revisa tu correo. Un especialista te contacta en menos de X horas", con el botón de WhatsApp.

---

## Componentes técnicos

### 1. Conexión con Bokun (`src/server/bokun/`)

**Hallazgos de la documentación oficial** (api-docs.bokun.dev y bokun.dev, revisados el 13 oct 2026):
- Hay dos APIs REST que comparten las mismas llaves y se pueden mezclar: **v1** (`/activity.json`, etc.) y **v2** (`/restapi/v2.0/...`). La **v2 no tiene búsqueda de catálogo**: trae disponibilidad, precios y categorías de precio. Para el catálogo se usa la v1; para disponibilidad sirve cualquiera de las dos.
- Toda llamada corre dentro de un **booking channel** (el sitio ya tiene uno: `8b31caec-…`). La moneda se fija en el canal; se deja en USD.
- **Solo lectura.** La plataforma usa únicamente endpoints GET y el `POST /activity.json/search` (que es una búsqueda, no escribe nada). No se llama a `/cart.json`, `/checkout.json` ni `/booking.json`. La llave se pide sin permisos de reserva, así que aunque hubiera un error en el código, Bokun rechazaría cualquier intento de reservar.
- **Firma:** string = `X-Bokun-Date` (UTC, `yyyy-MM-dd HH:mm:ss`) + accessKey + método en mayúsculas + ruta con query. HMAC-SHA1 con la secret key, en Base64. Header `X-Bokun-Signature`. En POST es obligatorio `Content-Type: application/json;charset=UTF-8`. La doc trae un ejemplo con resultado esperado (`XrOiTYa9Y34zscnLCsAEh8ieoyo=`) que sirve como test unitario.
- **Límite:** 400 peticiones por minuto por vendedor (todas las llaves juntas). Responde 429 con `Retry-After`. El cliente implementa reintento con espera, y la caché del catálogo hace que en operación normal se usen muy pocas llamadas.
- **URL base:** producción `https://api.bokun.io`, en `.env`. (Existe `https://api.bokuntest.com` con cuenta aparte, pero al ser solo lectura no hace falta.)
- Fechas en v2 son timestamps UTC en milisegundos y los montos son strings, nunca float.
- Para referencia futura: si algún día se quisiera reservar desde la plataforma, Bokun solo permite retener cupo 30 minutos sin pago (`RESERVE_FOR_EXTERNAL_PAYMENT`) o crear una reserva confirmada sin pagar (`CUSTOMER_NO_PAYMENT`). Queda fuera de este proyecto.

`client.ts` arma la firma descrita arriba, agrega los headers, maneja 429 y nunca expone las llaves fuera del servidor.

- Endpoints que se usan (v1 salvo que se indique):
  - IDs activos: `GET /activity.json/active-ids` y `GET /activity.json/list-by-id`
  - cambios desde la última sincronización: `GET /activity.json/list-updated`
  - búsqueda con filtros: `POST /activity.json/search`
  - detalle: `GET /activity.json/{id}`
  - precios: `GET /activity.json/{id}/price-list`
  - disponibilidad: `GET /activity.json/{id}/availabilities?start&end&currency=USD&lang=EN` (o `GET /restapi/v2.0/availability/{experienceId}` en v2)
  - lugares de recogida: `GET /activity.json/{id}/pickup-places`
  - categorías y tags: `GET /category.json/ACTIVITY` y `GET /tag.json/groups`
  - traslados: los productos de transporte están como actividades en el catálogo; si Andre usa rutas de transporte, también `GET /route.json/list` y `POST /route.json/check-availability`
- **Caché del catálogo:** un cron diario (`/api/cron/catalog`) guarda los productos en la tabla `catalog_products`. Por cada producto guarda: id de Bokun, título, slug y URL del sitio, categorías, etiquetas (aventura, cultural, gastronómico, agua, fiesta, chill), duración, precio desde, **categorías de precio con sus rangos de edad** (adulto, niño…), horarios de inicio, lugares de recogida, días que opera, imagen y rating. Estos datos son los que después van en el correo del agente.
- El etiquetado por categoría se hace una sola vez con un mapeo manual y luego con ayuda de la AI. Andre lo puede revisar en el panel.
- La disponibilidad no se guarda: se consulta en el momento, y se cachea 15 minutos (en memoria en local, Redis al desplegar).

### 2. API de vuelos (`src/server/flights/`)
- **Recomendado: AeroDataBox** (por RapidAPI o por API.market).
  - Llegadas y salidas de un aeropuerto en un rango de horas (`/flights/airports/iata/CUN/{from}/{to}`).
  - Búsqueda por número de vuelo y fecha (`/flights/number/{num}/{date}`).
  - Cuesta poco y cobra por consumo.
- **Limitación a validar:** los horarios a futuro tienen un alcance limitado de días. Si la fecha del viaje está fuera de ese rango, se busca por número de vuelo. Si eso tampoco funciona, el usuario lo escribe a mano.
- Alternativa: FlightAware AeroAPI, más cara pero con horarios a futuro más completos. No usaría Amadeus Self-Service, que va de salida.
- Se crea una interfaz `FlightProvider` para poder cambiar de proveedor sin tocar la interfaz.

### 3. Motor de AI (`src/server/ai/`)
- Claude API con **tool use**. La AI no inventa tours, solo elige del catálogo.
- Herramientas que puede usar:
  - `search_catalog(tags, zone, maxPricePerPerson, durationMax)`
  - `check_availability(productId, date, pax)`
  - `get_transfer_options(zone, direction)`
- **Salida estructurada:** un JSON validado con **zod** (`ItinerarySchema`): días, horarios, productIds, precio, notas y totales.
- **Reglas en el servidor**, que no dependen de la AI:
  - cada `productId` tiene que existir en el catálogo
  - el precio por persona no puede pasar el presupuesto
  - no se ponen tours largos el día de llegada o de salida si los horarios de vuelo no lo permiten
  - se respetan los días de descanso
- **Contra prompt injection:** el texto libre del usuario va en un campo delimitado, la AI no tiene herramientas que escriban nada y el resultado siempre se valida contra el catálogo.
- Se usa prompt caching para el system prompt y el resumen del catálogo, lo que baja el costo.

### 4. Leads, PDF y correo
- **PDF** con `@react-pdf/renderer`:
  - portada con el degradado de marca, nombre del viajero y fechas
  - una página por día con las fotos de los tours
  - resumen de vuelos y traslados, y el total
  - CTA con el QR de WhatsApp y el sello "powered by WhatToDo"
- Se guarda en Supabase Storage (bucket privado). El cliente lo descarga en el momento desde la pantalla y, por correo, con un link firmado que expira en 7 días.
- **Correos** (`src/server/email/`), con plantillas en **React Email**, detrás de `EmailProvider`:
  - `DbEmailProvider` (por defecto en desarrollo): guarda el correo renderizado en `outbound_emails` y lo muestra en el panel, con vista previa. Sirve para diseñar y revisar las plantillas sin mandar nada.
  - `ResendEmailProvider`: se activa con `EMAIL_PROVIDER=resend` y la llave de Resend.
  - **Correo al cliente** (`CustomerTripEmail`): diseño limpio y llamativo con la marca. Encabezado con el degradado, saludo por nombre, fechas y vuelos, el itinerario día por día con foto, nombre y precio de cada tour, el total, el PDF adjunto y un botón grande "Talk to a specialist" (WhatsApp con texto prellenado). Pie con "powered by WhatToDo". Sin información interna.
  - **Correo al agente de ventas** (`AgentLeadEmail`): diseño simple y de fácil uso, pensado para reservar en Bokun en minutos:
    - Asunto: `[Lead #123] Nombre · 5 noches · 2 adultos + 1 niño (8) · $1,240 USD`
    - Bloque **Cliente**: nombre, correo, WhatsApp (link directo), idioma, hotel/zona, fechas, vuelos de llegada y salida con hora.
    - Bloque **Viajeros**: conteo por categoría de precio de Bokun (ej. 2 Adult, 1 Child 4–12) con edades.
    - **Tabla de reservas por hacer**, una fila por tour: fecha, hora de inicio, nombre del tour, **ID de Bokun**, categorías y cantidad, punto de recogida, precio, y un **link directo al producto en el extranet de Bokun** (`https://extranet.bokun.io/...`). También los traslados.
    - Bloque **Notas del cliente** (lo que escribió en texto libre, escapado) e intereses elegidos.
    - Botones: "Abrir lead en el panel", "WhatsApp al cliente". `Reply-To` = correo del cliente.
    - Adjuntos: el mismo PDF del cliente y un `trip.json` con todos los datos.
    - Va al buzón compartido `LEADS_TO` (ej. sales@whattodoincancun.com). Más adelante se puede asignar en round-robin entre agentes.
  - Cuando el agente cambia el estado del lead a `booked` en el panel, puede anotar los códigos de confirmación de Bokun a mano.

### 5. Base de datos (Supabase Postgres, con RLS en todas las tablas)
- `leads`: id, nombre, correo, teléfono, idioma, consentimiento, `status` (new / contacted / quoted / booked / lost), `assigned_to`, created_at.
- `trips`: lead_id, vuelos (jsonb), hotel_zone, traslados, viajeros (jsonb), intereses[], chill_days, presupuesto_pp, `itinerary` (jsonb), total_usd, pdf_path, `bokun_confirmation_codes` (texto, lo anota el agente a mano cuando reserva).
- `catalog_products`: la caché de Bokun.
- `outbound_emails`: destinatario, tipo (`customer` / `agent`), asunto, html, estado (`pending` / `sent` / `failed`), proveedor. Con `EMAIL_PROVIDER=db` se quedan en `pending` y se ven en el panel.
- `lead_events`: auditoría de cambios de estado, notas del agente y correos enviados.
- `admin_users`: rol `admin` o `sales`.
- El público **no escribe directo a la base**: todo pasa por las rutas API con la service key, que solo existe en el servidor.

### 6. Panel interno (`/admin`)
- Login con **Supabase Auth** (correo + magic link o contraseña), **MFA obligatorio** y acceso solo con allowlist en `admin_users`.
- Pantallas:
  - Lista de los leads más recientes, con filtros por fecha, estado, presupuesto e intereses.
  - Detalle del lead: vuelos, viajeros, el itinerario completo con IDs de Bokun, el PDF, los dos correos enviados (vista previa y reenviar), botones de WhatsApp y correo, cambio de estado, códigos de confirmación de Bokun y notas.
  - Métricas básicas: leads por día, ticket promedio, tours más recomendados y conversión.
  - Etiquetado del catálogo.
- Mismo diseño que el sitio (HeroUI).

---

## Seguridad (requisito clave)
- **Llaves** (Bokun, Anthropic, AeroDataBox, Resend y la service key de Supabase):
  - solo como variables de entorno (`.env` en local, secrets del host en producción), nunca en el cliente ni en el repo
  - `.env.example` sin valores
  - Bokun con una llave de **solo lectura**, sin permisos de reserva. El código tampoco incluye llamadas de escritura a Bokun.
- **Protección contra abuso:**
  - Cloudflare **Turnstile** antes de generar el itinerario y antes de mandar el lead
  - **rate limiting** con Upstash por IP y por correo, para limitar el gasto en AI, vuelos y correo
  - tope de presupuesto diario de tokens
- **Validación:** zod en todas las entradas y salidas, y el HTML de los correos se escapa.
- **Headers:** CSP estricta, HSTS, `X-Frame-Options` y CORS solo para los dominios propios.
- **Panel:** RLS, MFA, sesión con cookies httpOnly, log de auditoría y nada de datos personales en los logs.
- **Privacidad (LFPDPPP / GDPR):**
  - aviso de privacidad y casilla de consentimiento
  - se guardan solo los datos necesarios
  - derecho de borrado desde el panel
  - los menores solo se registran por edad, sin nombres obligatorios
- Dependabot y `npm audit` en CI. Antes de lanzar se corre `/security-review`.

---

## Estructura del repo (nuevo)
```
whattodo-planner/
  src/app/(public)/[locale]/page.tsx          landing
  src/app/(public)/[locale]/plan/...          wizard (pasos 1–6)
  src/app/admin/...                           panel
  src/app/api/{flights,itinerary,lead,cron}/  rutas del servidor
  src/server/{bokun,flights,ai,pdf,email,db}/
  src/components/ui/                          tarjetas, chips, stepper (HeroUI)
  src/content/brand.ts                        premios, colaboradores, textos
  src/styles/tokens.css
  supabase/migrations/
```

---

## Fases y tiempos (aprox., 1 desarrollador)

**Meta: todo el flujo funciona completo en `localhost`, con tours reales de Bokun en modo lectura y los dos correos listos.** El deploy queda como último paso cuando se decida el host.

| Fase | Entregable | Semanas |
|---|---|---|
| 0 | Repo Next.js, Supabase local, `.env.example`, flags, tokens de diseño (Nunito, colores, radios), CI con lint y tests | 0.5 |
| 1 | Cliente Bokun (solo lectura) con firma HMAC, sincronización del catálogo con categorías de precio y recogidas, etiquetado por intereses, disponibilidad y precios en vivo. **Entrega: una página interna que lista los tours reales de Bokun.** | 1 |
| 2 | Landing "powered by WhatToDo" (`brand.ts` editable) + wizard pasos 1–4 + `FlightProvider` (AeroDataBox y manual) | 1.5 |
| 3 | Motor de AI con tool use + validaciones + itinerario editable día por día | 1.5 |
| 4 | PDF descargable + los dos correos (cliente y agente) con `DbEmailProvider`, visibles en el panel; `ResendEmailProvider` listo para cuando llegue la llave | 1.5 |
| 5 | Panel `/admin` (login + MFA, lista, detalle, estados, correos, etiquetado) | 1 |
| 6 | Seguridad, i18n EN/ES, QA end-to-end en local | 0.5 |
| **Total** | **Plataforma completa en local** | **~7.5 semanas** |

**Deploy (cuando se decida el host):** host, dominio, Redis para caché y rate limit, Turnstile, variables de entorno, `EMAIL_PROVIDER=resend`. 2–3 días.

**Después:** asignación automática de leads entre agentes, itinerarios compartibles por link y seguimiento automático por correo.

---

## Verificación
- **Unit tests (Vitest):**
  - firma HMAC de Bokun, comparada contra el ejemplo de su documentación
  - reglas del itinerario (presupuesto, días de llegada y salida, días de descanso)
  - schemas zod
- **Integración:**
  - Bokun con las llaves reales en modo lectura: el catálogo sincronizado tiene que coincidir con los tours que se ven en whattodoincancun.com
  - AeroDataBox con una fecha real hacia CUN, y el modo `manual` sin API
  - `DbEmailProvider`: los dos correos aparecen en el panel con el PDF adjunto; el del agente trae IDs de Bokun y links al extranet correctos
  - Resend en modo test cuando llegue la llave: el correo del agente llega al buzón con `Reply-To` del cliente
  - Confirmar con un `grep` del código que no existe ninguna llamada a `/cart.json`, `/checkout.json` ni `/booking.json`
- **E2E con Playwright en local:** recorrer el wizard completo, descargar el PDF y comprobar que el lead y los dos correos aparecen en `/admin`.
- **Seguridad:**
  - revisar que ninguna llave aparezca en el bundle (`grep` del build)
  - probar el rate limit y Turnstile
  - intentar leer las tablas con la anon key (debe fallar por RLS)
  - correr `/security-review`
- **Revisión visual** con Andre, lado a lado con whattodoincancun.com, en escritorio y móvil.

---

## Pendientes
1. **Nombre de la plataforma y dominio** (subdominio de WhatToDo, dominio propio o ruta dentro del sitio actual).
2. **Dónde se despliega** (Vercel, Railway u otro). El código no depende de ninguno.
3. **Correo del buzón compartido** al que llegan los leads (ej. sales@whattodoincancun.com).
4. **Tiempo de respuesta prometido** al cliente en la pantalla final y en el correo ("te contactamos en menos de X horas").
5. Datos de la sección de confianza: premios, cifras y logos de colaboradores.
6. Presupuesto mensual para las APIs (AI, vuelos y correo) y los límites de uso.
7. Confirmar que la llave de Bokun es de solo lectura y está ligada al booking channel del sitio.
