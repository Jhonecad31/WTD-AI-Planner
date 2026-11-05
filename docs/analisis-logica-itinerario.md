# Análisis completo de la lógica de creación del itinerario

Fecha: 5 de noviembre de 2026 (segunda versión) · Rama `tristan` (commit `1ec1b85`, 10 commits
sobre `origin/tristan`) · Catálogo local: 70 tours del planner

Describe cómo se construye un itinerario de principio a fin, qué datos lo alimentan, qué regla
aplica cada etapa, qué se probó y con qué resultado, dónde están los puntos débiles y qué conviene
hacer después, en orden de impacto. Sustituye a la versión de la mañana: desde entonces cambió el
presupuesto (solo tours), el relleno de días, la distancia al hotel, los antros y el menú de Claude.

---

## 1. Resumen ejecutivo

- **Estructura**: un motor **elige** (Claude, con el motor de reglas de respaldo) y seis
  guardianes deterministas **corrigen** en cadena: variedad → relleno de días → presupuesto →
  cenas/lugares/fiesta → disponibilidad real en Bokun → validación de precios. Nada que ve el
  viajero depende de que Claude se porte bien; cada corrección queda en `warnings`.
- **Lo que el viajero escoge manda**: cada tour tiene un tipo de experiencia y un interés
  principal leídos del título (con overrides a mano); el puntaje da 6 al interés principal y 1.5
  a cada secundario, resta por distancia al hotel y nunca repite el mismo tipo de día. Vida
  nocturna solo si se pidió y a ≤1 zona del hotel. Claude recibe un menú ya filtrado: pocos tours
  lejanos y sin los de la versión anterior.
- **Presupuesto = tours.** Los traslados se cobran por vehículo, se muestran como "+USD X" al
  elegirlos y no salen del presupuesto de tours. Era la causa principal de los itinerarios con
  muchos días libres (a una pareja en Puerto Aventuras el vehículo le comía 316 de 600 USD).
- **Verificado**: 138 tests unitarios y 17 perfiles reales (Claude + Bokun) que cumplen 13
  invariantes. El build de producción compila. El wizard regenera en el navegador.
- **El techo son los datos**: 70 tours (29 de mar de principal, 8 culturales, 2 de comida, 1 de
  pareja, 0 de "chill"), restaurantes solo en Cancún, cero reseñas. Y dos temas de operación:
  `/api/lead` no persiste el lead en Vercel, y Next sigue vulnerable hasta el PR #11.

---

## 2. El flujo completo

```
Wizard (cliente)                        Servidor
────────────────────                    ─────────────────────────────────────────────────
flights → travelers → preferences →     POST /api/itinerary  (TripRequest + avoid[])
stay (+USD X por traslado) →              │
restaurants → [itinerary] → contact       ├─ getPlannerProducts()  catálogo on-site, re-etiquetado al cargar
                                          ├─ getTripWeather()      Open-Meteo 16 días + clima típico
                                          ├─ getRatings()          Tripadvisor (vacío sin key)
                                          ├─ motor: Claude ──falla──▶ reglas
                                          │     └─ validateAndRepair (ids reales, precios, días)
                                          ├─ withWeather
                                          ├─ diversify        sin repetir tipo principal
                                          ├─ fillEmptyDays    día lleno sin tour → mejor candidato
                                          ├─ fitBudget        cambiar/quitar tours hasta caber
                                          ├─ enrichItinerary  traslados, cenas, playa/compras, fiesta, "día libre"
                                          ├─ verifyAvailability  Bokun: lugares reales por fecha
                                          ├─ enrich (otra vez si algo cambió)
                                          ├─ validateAndRepair
                                          └─ withTripAdvisor
                                        ◀─ { itinerary, engine, fallbackReason, warnings }
"Probar otra versión" ────────────────▶  mismo POST con avoid = tours actuales
Editor (mover / cambiar / descanso) ──▶  POST /api/itinerary/edit (checkDay en Bokun)
Enviar ───────────────────────────────▶  POST /api/lead → re-valida, PDF, correos
Paso de hospedaje ────────────────────▶  GET /api/transfers?zone= → precio del traslado por vehículo
```

### 2.1 Lo que el viajero decide (`TripRequest`, `src/lib/trip-schema.ts`)

| Campo | Cómo lo usa la lógica |
|---|---|
| Fechas de llegada/salida (+ franja) | Esqueleto: `arrival`, `full`, `chill`, `departure`. Llegada temprana → cena; salida de noche → playa/compras antes del traslado. |
| Viajeros con edades | Categorías de precio de Bokun por edad; `fitsAges` excluye productos con edad mínima; niños <12 bajan 6 puntos a tours de 10 h+. |
| Zona del hotel (7) o "sin hotel" (= Cancún) | Traslado correcto, clima, restaurantes y lugares de la zona, distancia a cada tour, antros solo a ≤1 zona, menú de Claude con pocos lejanos. |
| Traslados (llegada / salida / lujo) | Por vehículo. Se muestran como "+USD X" (precio real de la zona) y **no** salen del presupuesto de tours. |
| Intereses (adventure, cultural, food, water, beach, shopping, parks, party, couples, chill) | Puntaje de cada tour. `beach` y `shopping` no tienen tours: se cumplen con lugares en días de descanso. |
| Prefiere privados | +3 a títulos "Private/Privado". |
| Ritmo o días exactos de descanso | `planDays`: qué días son `chill`. **Un día `full` es un día de tour.** |
| Presupuesto por persona | Solo tours. `fitBudget` cambia o quita hasta caber; `fillEmptyDays` llena mientras alcance. |
| Cenas (saltar, cocinas, presupuesto) | `rankRestaurants`: una cena cada 3 días, sin repetir. |
| Notas libres | Solo las ve Claude, como dato. El motor de reglas las ignora. |

### 2.2 Datos de entrada

**Catálogo** (`src/server/catalog/`): sincronizado de Bokun, cache 24 h (`.cache/catalog.json`
local, `/tmp/wtd-cache` en Vercel). Solo productos con página en whattodoincancun.com menos los
excluidos: **70 tours**, 1 traslado estándar y 1 de lujo por zona, 15 restaurantes.

Cada tour se clasifica **al cargar** (así los cachés viejos salen igual que uno nuevo):

- **Tipo de experiencia** (`experience.ts`): lo primero que nombra el título, en orden de
  prioridad (romantic, show, nightlife, whale_shark, dolphin, xcaret, xelha, …, chichen, tulum,
  coba, ek_balam, holbox, bacalar, cozumel, …, atv, catamaran, speedboat, cenote, zipline, snorkel,
  boat, beach_club, food, spa; familias park / ruins / day_trip al final). Define el **interés
  principal** y qué cuenta como repetición: dos *Dolphin Discovery* o dos variantes de Chichén
  son repetición; Tulum después de Chichén, o Xel-Há después de Xcaret, no.
- **Intereses**: el principal primero; secundarios de las categorías de Bokun y de palabras del
  título + keywords. Ya no se lee el *excerpt* ni las categorías genéricas `DAY_TRIPS_AND_EXCURSIONS`
  / `SIGHTSEEING`, que volvían "cultural" a delfines y catamaranes.
- **Zona** (`areaOf`): dónde ocurre en la costa (costa_mujeres → tulum), `far` (Chichén, Ek
  Balam, Holbox, Bacalar, Coloradas = 3 zonas desde cualquier hotel) o desconocida (sin
  penalización). 61 con zona concreta, 9 lejanos, 0 desconocidos.
- **Overrides** (`src/content/experience-overrides.ts`): tipo, intereses y/o zona por `bokunId`
  cuando el título no dice suficiente; 13 zonas puestas a mano desde la descripción de Bokun, 4
  marcadas "(check)" para confirmar. `/dev/catalog` muestra tipo → interés → zona por tour y
  cuenta los que no tienen tipo (hoy 0).

Distribución real por interés principal: water 29 · adventure 12 · party 12 · cultural 8 ·
parks 5 · food 2 · couples 1 · beach 1 · chill 0 · shopping 0.

**Restaurantes** (`src/content/restaurants.ts`): 15, **todos en Cancún**. Fuera de Cancún el
itinerario dice "todavía no tenemos restaurantes recomendados en tu zona".

**Lugares** (`src/content/places.ts`): 1–2 playas y 1–2 zonas de compras por zona.

**Clima**: Open-Meteo 16 días (good / windy / rainy); después, promedio mensual (`typical`, que
no cambia decisiones).

**Reseñas**: Bokun reporta 0 en los 70 tours; todos valen 4.5. Tripadvisor solo con key.

**Disponibilidad**: consulta real a Bokun por producto y fecha, cache 15 min, timeout 4 s.

---

## 3. Reglas por etapa

### 3.1 Esqueleto de días (`src/lib/plan-days.ts`)

Llegada y salida nunca llevan tour. Los intermedios son `full`; el ritmo convierte algunos en
`chill` repartidos (relaxed = mitad, balanced = un cuarto, intense = ninguno) o el viajero marca
días exactos.

### 3.2 Puntaje de un tour (`scoreProduct`, `src/server/ai/rules.ts`)

```
0                             si no toca ningún interés del viajero (fuera de toda lista)
+6    interés principal marcado
+1.5  por cada interés secundario marcado
+ rating (4.5 sin reseñas) + log10(reseñas + 1)
+3    privado, si lo pidió
−6    tour de 10 h+ con niños < 12 (mínimo 0.1)
−0.75 por zona de distancia al hotel (máx. −4.5; "far" = 3 zonas)
```

El interés principal (6) siempre gana a la distancia (máx. 4.5) y a cualquier suma de
secundarios (3 × 1.5 = 4.5).

### 3.3 Filtros que valen para todos los motores y guardianes

- `fitsAges`: edad mínima y bandas de precio de Bokun.
- `fitsDay`: nunca multi-día; solo en días `full` (o `chill` si el viajero lo agrega a mano).
- `partyAllowed`: vida nocturna solo si el viajero marcó "party" **y** el lugar está a ≤1 zona del
  hotel. `partyNightOk`: una noche de fiesta solo antes de un día de descanso o de la salida.
- Clima: sin tours de mar con lluvia o viento; los parques de WhatToDo (Extreme Adventure,
  Cenotes Adventuring) se reservan para los días de lluvia.
- Variedad: `variety(p, elegidos)` = 0 si repite tipo principal, 1 si comparte un tipo
  secundario, 2 si nada en común. Ningún guardián mete un 0.

### 3.4 Motor de reglas (`buildRulesItinerary`)

Para cada día de tour, en orden: candidatos con puntaje > 0 ordenados por puntaje; elige el
primero que no repita tipo principal, cubra un interés aún no cubierto si queda alguno, quepa en el
presupuesto restante y respete clima y fiesta. Solo si no hay nada así repite tipo. Si nada cabe,
"Día libre".

### 3.5 Motor Claude (`src/server/ai/claude.ts`)

Claude **no inventa**: recibe un menú y devuelve ids, hora y una nota por item;
`validateAndRepair` reconstruye con precios del catálogo. El menú (`pickCandidates`):

1. Tours con puntaje > 0 que pasan `partyAllowed`, ordenados por puntaje; rellenos (puntaje 0,
   marcados `filler: true`) hasta llegar a 12 si hay pocos; máximo 40.
2. **Solo los 4 mejores a 4+ zonas del hotel.** El viaje no puede llenarse de lejanos aunque
   Claude los prefiera.
3. **Sin los tours de la versión anterior** ("otra versión") mientras queden ≥12 alternativas.
4. Con lluvia en el viaje, los parques de WhatToDo entran aunque puntúen bajo.

Cada candidato lleva precio para el grupo, tipos (`kinds`, el primero es el principal),
`mainInterest`, `area`, `zonesFromHotel`, `filler`, `partyNight`, `seaTour`, `rainyFavorite`. El
sistema de reglas pide: un tour por día, nunca el mismo tipo principal, presupuesto **de tours**,
cubrir cada interés por su interés principal, niños, fiesta, lluvia, quedarse cerca del hotel,
rellenos solo cuando ya no queda nada que encaje. Si Claude falla, responde el motor de reglas y
`fallbackReason` lo dice.

### 3.6 Guardianes (en este orden)

| Guardián | Qué hace | Si no puede |
|---|---|---|
| `diversify` | Un tour con el mismo tipo principal que un día anterior → el mejor distinto que quepa. | El tour se queda. |
| `fillEmptyDays` | Día `full` sin tour → mejor candidato que encaje (intereses, variedad, edades, fiesta, clima, zona, presupuesto). Claude deja huecos en viajes largos. | Día libre. |
| `fitBudget` | Mientras los **tours** se pasen: cambia el más caro por uno más barato del interés, de tipo distinto, sin fiesta no pedida. | Quita el más caro (nunca el último). |
| `enrichItinerary` | Traslados con nombre, descanso/cena de llegada, playa/compras en descansos y salida nocturna, cenas cada 3 días sin repetir, noches de fiesta en su sitio, avisos de niños y lluvia, **bloque "Día libre" en todo día lleno sin tour**. | — |
| `verifyAvailability` | Bokun por cada tour: sin salida o lugares → intercambia con otro día; si no, reemplazo de tipo distinto con lugares; si no, día libre con aviso. Hora real de salida. | Día libre + aviso. |
| `validateAndRepair` | Ids del catálogo, sin duplicados, días del viaje, traslado de la zona, precios recalculados, totales: `withinBudget` = tours por persona ≤ presupuesto. | — |

### 3.7 "Otra versión", editor y envío

- **Otra versión**: `avoid` = tours actuales → fuera del menú de Claude; en el motor de reglas y
  los guardianes van al final (solo si no hay otra cosa). Probado: 6/6 distintos en Cancún y en
  Tulum.
- **Editor**: mover (intercambio si el otro día tenía tour), cambiar por una alternativa (8,
  por puntaje, con disponibilidad real) o convertir en descanso. Re-valida y re-aplica cenas.
- **Envío**: `/api/lead` re-valida y re-precia contra el catálogo, genera el PDF y manda dos
  correos (cliente y ventas).

---

## 4. Qué se probó y con qué resultado

**Unit tests (138)**: puntaje, tipos y zonas con títulos reales, variedad, relleno, presupuesto,
disponibilidad, cenas, edición, clima, normalización, menú de Claude (lejanos, otra versión,
antros).

**17 perfiles reales** contra el servidor con Claude y Bokun, cada uno con 13 invariantes: tipo
principal no repetido, sin `bokunId` repetido, tours por persona ≤ presupuesto, total = tours +
traslados, esqueleto igual al pedido, sin tour en llegada/salida/descanso, traslados cuando se
piden, edades mínimas, sin fiesta no pedida, cada tour toca un interés pedido (rellenos solo al
final), ≤2 tours a 4+ zonas del hotel, otra versión sin repetir. **17/17 pasan.**

| Perfil | Tours con interés principal | Nota |
|---|---|---|
| Cancún: cultural / water / adventure / party+food | 6/6 · 6/6 · 4/6 · 2/4 | |
| water, otra versión (Cancún y Tulum) | 6/6 · 5/6 | ninguno repetido |
| Familia niños 8 y 5, cultural+water, $400 | 6/6 | |
| Tulum, water+adventure | 6/6 | 3 tours a ≤1 zona |
| Playa del Carmen, cultural+parks, traslados lujo $800 | 5/6 | 682 en tours, 350 de traslado aparte |
| Sin hotel, adventure+party, 1 descanso | 4/5 | Xoximilco antes del descanso |
| Descansos exactos, inglés | 4/4 | |
| 3 noches, Puerto Morelos | 2/2 | |
| 10 noches, 4 adultos, 6 intereses, $350 | 5/5 | 349/350 |
| Pareja privada, Riviera Maya, $900 | 6/6 | |
| Familia niño de 3, parks+beach | 1/5 | 1 relleno: no hay más tours de parques/playa aptos |
| couples+chill, $250 | 0/4 | no existen tours de esos intereses |
| **Pareja Puerto Aventuras, 14 noches, $300, traslados** | 5/5 | 291/300 en tours; antes 1–2 tours |

**Wizard en el navegador**: "Probar otra versión" y el paso de hospedaje con "+USD 100" por
traslado y "+USD 75 por trayecto" el de lujo (Playa del Carmen).

**`next build`**: compila (tras el aviso de seguridad de Next).

---

## 5. Puntos débiles y riesgos, por impacto

### A. Datos (lo que más limita hoy)

1. **Catálogo desbalanceado por interés.** 29 de 70 son "mar"; cultural 8 (4 son variantes de
   Chichén/Tulum), comida 2, pareja 1, chill y shopping 0. couples+chill sale 0/4 y una familia
   con niño de 3 sale 1/5 porque no hay más. *Opciones:* productos nuevos para esos intereses, o
   quitar del cuestionario lo que no se puede cumplir ("chill" es ritmo, no interés; "shopping" y
   "beach" ya se resuelven con lugares).
2. **Restaurantes solo en Cancún.** Seis de siete zonas no reciben cenas aunque el cuestionario
   pide cocinas y presupuesto por cena a todos.
3. **Sin reseñas.** Entre dos tours del mismo interés y tipo decide el orden del catálogo.
4. **Clasificación por título.** Cubre los 70 con `/dev/catalog` avisando de los nuevos sin tipo
   y overrides a mano. Mantenible, pero alguien debe mirar `/dev/catalog` cuando Jhonny sube
   productos; y hay 4 zonas "(check)" por confirmar.

### B. Reglas que conviene revisar con negocio

5. **Presupuesto bajo + muchos días = muchos "días libres".** Ahora que el traslado va aparte
   mejora mucho (la pareja de Puerto Aventuras pasó de 2 a 5 tours), pero con 300 USD pp y 13
   días siguen quedando 8 días libres. Sería honesto que el paso de preferencias diga "con este
   presupuesto alcanzan ~N tours" (precio medio ≈ 60 USD pp) o sugiera bajar los días con tour.
6. **`fitBudget` es tosco en el borde**: si se pasa 16 USD puede quitar un tour de 298. Una
   tolerancia pequeña (5 %) o avisar al viajero lo resolvería.
7. **Niños y tours largos.** La regla es "evitar 10 h+ salvo que nada más encaje"; con tan pocos
   tours familiares casi siempre "nada más encaja" y sale Tulum con un niño de 3. Una política
   explícita (máx. 1 tour de 10 h+ con menores de 6) sería más segura.
8. **Lejanos para hoteles del sur.** Desde Tulum, Holbox o Coloradas son 4 h de ida; cuentan como
   "3 zonas" igual que desde Cancún (2.5 h). Una tabla zona→destino sería más fina.
9. **Clima.** El pronóstico a 16 días cambia y el itinerario no se recalcula al acercarse la
   fecha; lo hace el agente a mano.

### C. Claude

10. **No determinista.** Tiende a dejar huecos en viajes largos y a irse lejos del hotel; por eso
    existen `fillEmptyDays`, el menú con pocos lejanos y sin los de la versión anterior. Cada
    corrección queda en `warnings`, que hoy no se ven en la app, solo en el JSON.
11. **Notas libres solo las ve Claude.** "No quiero delfines" no es garantía. Un campo "evitar"
    estructurado (tipos a excluir) aplicado como filtro sería fiable.
12. **Latencia** 6–20 s (Claude 5–8 s + una consulta a Bokun por tour). Aceptable con el aviso de
    "unos 20 segundos".

### D. Operación

13. **`/api/lead` no guarda el lead en Vercel** (`if (!isVercel) store.createLead`): en
    producción solo se mandan correos; el panel y el link del PDF no tienen de dónde leer. Hace
    falta persistencia (coincide con la nota del equipo sobre `.temp`/`.data`).
14. **Caché del catálogo en `/tmp`** en Vercel: se pierde al arrancar y se re-sincroniza (lento
    el primer request; sin problema de datos viejos gracias al re-etiquetado al cargar).
15. **Next vulnerable** hasta que entre el PR #11.

---

## 6. Recomendaciones, en orden

1. **Aviso de cuántos tours alcanzan** en el paso de presupuesto (punto 5): es lo que más
   explica los días libres que quedan, y no toca la lógica.
2. **Datos**: confirmar las 4 zonas "(check)"; restaurantes fuera de Cancún (o decirlo en el paso
   de cenas); decidir qué hacer con "chill" y "couples" como intereses.
3. **Campo "evitar"** estructurado aplicado como filtro en todos los motores.
4. **Tolerancia del 5 % en presupuesto** y aviso al viajero cuando un día quedó libre por
   presupuesto.
5. **Mostrar `warnings` en el panel interno** para el agente.
6. **Persistencia en producción** (punto 13) antes de abrir al público.

---

## 7. Apéndice: constantes y archivos

| Constante | Valor | Dónde |
|---|---|---|
| Interés principal / secundario | 6 / 1.5 | `rules.ts` |
| Penalización por zona / "far" | 0.75 por zona / 3 zonas | `rules.ts`, `experience.ts` |
| Antros: distancia máxima | 1 zona | `rules.ts` (`NIGHTLIFE_MAX_ZONES`) |
| Tour largo con niños | 10 h, −6 | `rules.ts` |
| Menú de Claude | máx. 40, mín. 12, máx. 4 a 4+ zonas | `claude.ts` |
| Alternativas por disponibilidad | 6 consultadas | `availability-check.ts` |
| Cena | 1 cada 3 días, tolerancia 1.15× | `enrich.ts` |
| Niño / infante sin precio en vivo | 70 % / 0 % del adulto | `pricing.ts` |
| Pronóstico | 16 días, cache 3 h | `weather/index.ts` |
| Disponibilidad | cache 15 min, timeout 4 s | `availability.ts`, `availability-check.ts` |
| Catálogo | cache 24 h | `catalog/service.ts` |
| Precio de traslado para el wizard | cache 10 min | `api/transfers/route.ts` |

Archivos clave: `src/lib/trip-schema.ts`, `src/lib/plan-days.ts`,
`src/server/catalog/{normalize,experience,service}.ts`, `src/content/experience-overrides.ts`,
`src/server/ai/{index,rules,claude,diversify,fill,budget,enrich,availability-check,validate,edit,pricing}.ts`,
`src/app/api/{itinerary,transfers,lead}/route.ts`, `src/components/plan/{step-stay,step-itinerary}.tsx`.
