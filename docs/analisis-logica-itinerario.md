# Análisis completo de la lógica de creación del itinerario

Fecha: 5 de noviembre de 2026 · Rama `tristan` (commit `c76c76d`) · Catálogo local: 70 tours del planner

Este documento describe cómo se construye un itinerario de principio a fin, qué datos lo
alimentan, qué reglas aplica cada etapa, qué se probó, dónde están los puntos débiles y qué
conviene hacer después, en orden de impacto.

---

## 1. Resumen ejecutivo

- El pipeline es sólido en estructura: un motor (Claude o reglas) **elige**, y después una
  cadena de guardianes deterministas **corrige** (variedad, huecos, presupuesto, disponibilidad
  real en Bokun, cenas y lugares, validación de precios). Nada que salga a la pantalla depende de
  que Claude se porte bien.
- Tras los cambios de esta rama, los tours siguen lo que el viajero marcó (interés principal
  por tipo de experiencia), no se repite la misma clase de día, se respeta la zona del hotel
  y los antros solo salen cerca del hotel. 16 perfiles reales pasan todos los invariantes.
- **El techo ya no es el algoritmo, son los datos**: 70 tours, de los cuales 29 son "mar" de
  principal, 8 culturales, 2 de comida, 1 de pareja y 0 de "chill"; restaurantes solo en
  Cancún; ninguna reseña en Bokun. Varias cosas que el viajero puede pedir en el cuestionario
  no existen en el catálogo.
- Hay tres riesgos operativos que no son de lógica pero sí de producto: el presupuesto por
  persona absorbe los traslados (en Puerto Aventuras son 316 de 600 USD), la ruta `/api/lead`
  **no guarda el lead en Vercel** (solo manda correos), y la versión de Next tiene una
  vulnerabilidad que el PR #11 arregla.

---

## 2. El flujo completo

```
Wizard (cliente)                      Servidor
──────────────────                    ───────────────────────────────────────────────
flights → travelers → preferences →   POST /api/itinerary  (TripRequest + avoid[])
stay → restaurants → [itinerary]        │
                                        ├─ getPlannerProducts()   catálogo on-site, re-etiquetado
                                        ├─ getTripWeather()       Open-Meteo 16 días + clima típico
                                        ├─ getRatings()           Tripadvisor (vacío sin key)
                                        ├─ motor: Claude ──falla──▶ reglas
                                        │     └─ validateAndRepair (ids reales, precios, días)
                                        ├─ withWeather
                                        ├─ diversify     no repetir tipo principal
                                        ├─ fillEmptyDays día lleno sin tour → mejor candidato
                                        ├─ fitBudget     cambiar/quitar hasta caber
                                        ├─ enrichItinerary  traslados, cenas, playa/compras, fiesta
                                        ├─ verifyAvailability  Bokun: lugares reales por fecha
                                        ├─ enrich (otra vez si cambió algo)
                                        ├─ validateAndRepair
                                        └─ withTripAdvisor
                                      ◀─ { itinerary, engine, fallbackReason }
[itinerary] "Probar otra versión" ──▶  mismo POST con avoid = tours actuales
[itinerary] editor (mover/cambiar) ─▶  POST /api/itinerary/edit (checkDay en Bokun)
[contact] ─────────────────────────▶  POST /api/lead → re-valida, PDF, correos
```

### 2.1 Lo que el viajero decide (`TripRequest`, `src/lib/trip-schema.ts`)

| Campo | Cómo lo usa la lógica |
|---|---|
| Fechas de llegada/salida (+ franja opcional) | Esqueleto de días: `arrival`, `full`, `chill`, `departure`. Llegada temprana → cena; salida de noche → playa/compras antes del traslado. |
| Viajeros con edades | Categorías de precio de Bokun por edad; `fitsAges` excluye productos con edad mínima; niños <12 bajan 6 puntos a tours de 10 h+. |
| Zona del hotel (7 zonas) o "sin hotel" | Traslado correcto, clima, restaurantes y lugares de la zona, **distancia a cada tour** (nuevo), antros solo a ≤1 zona (nuevo). Sin hotel = Cancún. |
| Traslados (llegada/salida/luxury) | Se reservan antes de los tours y **salen del mismo presupuesto por persona**. |
| Intereses (1–10 de: adventure, cultural, food, water, beach, shopping, parks, party, couples, chill) | Puntaje de cada tour (interés principal 6, secundario 1.5). `beach` y `shopping` no tienen tours: se cumplen con lugares en días de descanso. |
| Prefiere privados | +3 a títulos con "Private/Privado". |
| Ritmo (relaxed / balanced / intense) o días exactos de descanso | `planDays`: qué días son `chill`. Un día `full` **es un día de tour**. |
| Presupuesto por persona (tours + traslados) | Límite duro: `fitBudget` cambia o quita tours hasta caber. |
| Cenas (saltar, cocinas, presupuesto por cena) | `rankRestaurants`: una cena cada 3 días, sin repetir. |
| Notas libres | Solo las ve Claude, como dato. El motor de reglas las ignora. |

### 2.2 Datos de entrada

**Catálogo** (`src/server/catalog/`): se sincroniza de Bokun y se cachea 24 h
(`.cache/catalog.json` en local, `/tmp/wtd-cache` en Vercel). El planner solo usa los productos
con página en whattodoincancun.com menos los excluidos a mano: **70 tours**, 1 traslado por zona,
15 restaurantes.

Cada tour se clasifica al cargar (así los cachés viejos salen bien):

- **Tipo de experiencia** (`experience.ts`): lo que el título nombra primero, en orden de
  prioridad (romantic, show, nightlife, whale_shark, dolphin, xcaret, xelha, …, chichen, tulum,
  coba, ek_balam, holbox, bacalar, cozumel, …, atv, catamaran, speedboat, cenote, zipline,
  snorkel, boat, beach_club, food, spa; familias park/ruins/day_trip al final). El primero es el
  **tipo principal** y define el **interés principal**. "Chichén Itzá con cenote" es Chichén;
  "ATV, Zipline & Cenote" es ATV; "Catamaran & Dolphin Swim" es delfines.
- **Intereses**: el principal primero, luego los secundarios de las categorías de Bokun y de
  palabras del título + keywords. Ya no se lee el *excerpt* ("Riviera Maya" en un tour de
  delfines lo volvía cultural) ni las categorías genéricas `DAY_TRIPS_AND_EXCURSIONS` /
  `SIGHTSEEING`.
- **Zona** (`areaOf`): dónde ocurre en la costa (costa_mujeres → tulum) o `far` (Chichén,
  Holbox, Bacalar, Coloradas: cuentan como 3 zonas). 61 de 70 con zona concreta; 13 puestas a
  mano en `src/content/experience-overrides.ts` desde la descripción de Bokun (4 marcadas
  "(check)").
- **Overrides** por `bokunId`: tipo, intereses y/o zona a mano. `/dev/catalog` muestra tipo →
  interés → zona por tour y cuenta los que no tienen tipo (hoy 0).

Distribución real (interés principal): water 29 · adventure 12 · party 12 · cultural 8 ·
parks 5 · food 2 · couples 1 · beach 1 · chill 0 · shopping 0.

**Restaurantes** (`src/content/restaurants.ts`): 15, **todos en Cancún**. Cualquier hotel fuera
de Cancún recibe "todavía no tenemos restaurantes recomendados en tu zona".

**Lugares** (`src/content/places.ts`): 1–2 playas y 1–2 zonas de compras por zona.

**Clima** (`src/server/weather/`): Open-Meteo para los próximos 16 días (good / windy / rainy);
después, promedio mensual (`typical`, que no cambia decisiones).

**Reseñas**: Bokun reporta 0 reseñas en los 70 tours, así que el rating no distingue nada
(todos valen 4.5). Tripadvisor solo entra si hay key.

**Disponibilidad** (`src/server/catalog/availability.ts`): consulta real a Bokun por producto y
fecha, cache 15 min, timeout 4 s por consulta.

---

## 3. Reglas por etapa

### 3.1 Esqueleto de días (`src/lib/plan-days.ts`)

Llegada y salida nunca llevan tour. Los días intermedios son `full`; el ritmo los convierte en
`chill` repartidos (relaxed = mitad, balanced = un cuarto, intense = ninguno) o el viajero marca
días exactos. `tourDays` limita cuántos `full` quedan.

### 3.2 Puntaje de un tour (`scoreProduct`, `src/server/ai/rules.ts`)

```
0                                 si no toca ningún interés del viajero (fuera de toda lista)
+6   interés principal marcado
+1.5 por cada interés secundario marcado
+ rating (4.5 si no hay reseñas) + log10(reseñas + 1)
+3   privado si lo pidió
−6   tour de 10 h+ con niños < 12 (mínimo 0.1)
−0.75 por zona de distancia al hotel (máx. −4.5; "far" = 3 zonas)
```

El interés principal (6) siempre gana a la distancia (máx. 4.5) y a cualquier combinación de
secundarios (3 × 1.5 = 4.5): un Chichén a 3 zonas (6 − 2.25 + 4.5 = 8.25) va antes que un
Xcaret cercano que solo "toca" cultural (1.5 + 4.5 = 6).

### 3.3 Motor de reglas (`buildRulesItinerary`)

Para cada día de tour, en orden: candidatos con puntaje > 0, sin fiesta salvo que se pidió y
esté cerca, ordenados por puntaje. Elige el primero que (a) no repita tipo principal con los
días anteriores, (b) cubra un interés aún no cubierto si queda alguno, (c) quepa en el
presupuesto restante, (d) respete clima (sin mar en lluvia/viento; parques de WhatToDo
reservados para los días de lluvia), (e) respete la noche de fiesta (solo antes de un día de
descanso o de la salida). Solo si no hay nada así repite tipo. Si nada cabe, "Día libre".

### 3.4 Motor Claude (`src/server/ai/claude.ts`)

Claude **no inventa**: recibe un menú de hasta 40 candidatos (los que puntúan > 0, más
rellenos marcados `filler: true` hasta 12 cuando hay pocos) con precio para el grupo, tipos,
interés principal, zona y distancia al hotel, el esqueleto de días con clima, y un sistema de
reglas (una por día, sin repetir tipo principal, presupuesto, cobertura de intereses, niños,
fiesta, lluvia, cerca del hotel, rellenos solo al final). Devuelve ids, hora y una nota por
item; `validateAndRepair` lo reconstruye con precios del catálogo. Si falla, el motor de reglas
responde y `fallbackReason` lo dice.

### 3.5 Guardianes (en este orden)

| Guardián | Qué hace | Cuándo deja el día libre |
|---|---|---|
| `diversify` | Un tour con el mismo tipo principal que un día anterior se cambia por el mejor distinto que quepa. | Si no hay alternativa, el tour se queda. |
| `fillEmptyDays` (nuevo) | Día `full` sin tour → mejor candidato que encaje (intereses, variedad, edades, fiesta, clima, zona, presupuesto). | Presupuesto agotado o todo lo que encaja ya usado. |
| `fitBudget` | Mientras se pase: cambia el tour más caro por uno más barato de los intereses, de tipo distinto, sin fiesta no pedida. | Si no hay cambio posible, quita el más caro (nunca el último). |
| `enrichItinerary` | Traslados con nombre, descanso/cena de llegada, playa/compras en descansos y salida nocturna, cenas cada 3 días sin repetir, mueve noches de fiesta a su sitio, avisos de niños y lluvia, bloque "Día libre" en días llenos sin tour. | — |
| `verifyAvailability` | Consulta Bokun por cada tour: si no hay salida/lugares ese día, intenta intercambiar con otro día; si no, el mejor reemplazo de tipo distinto con lugares; si no, día libre con aviso. Hora real de salida. | Nada con lugares. |
| `validateAndRepair` | Ids del catálogo, sin duplicados, días dentro del viaje, traslado de la zona, precios recalculados, totales. | — |

### 3.6 "Probar otra versión", editor y envío

- **Otra versión**: el cliente manda `avoid` = tours actuales; en todas las listas esos tours van
  al final (se usan solo si no hay otra cosa). Probado: 6/6 tours distintos.
- **Editor**: mover un tour a otro día (intercambio si el otro día tenía tour), cambiarlo por
  una alternativa (lista de 8 ordenada por puntaje y con disponibilidad real), o convertir el
  día en descanso. Cada acción re-valida y re-aplica cenas/lugares.
- **Envío**: `/api/lead` re-valida y re-precia contra el catálogo (nunca confía en precios del
  cliente), genera el PDF y manda dos correos (cliente y ventas).

---

## 4. Qué se probó

- **Unit tests**: 135 (puntaje, tipos y zonas con títulos reales, variedad, relleno,
  presupuesto, disponibilidad, cenas, edición, clima, normalización).
- **16 perfiles reales** contra el servidor con Claude y Bokun, cada uno revisado con 12
  invariantes (tipo no repetido, sin ids repetidos, presupuesto, esqueleto, sin tour en
  llegada/salida/descanso, traslados pedidos, edades, sin fiesta no pedida, ≤2 tours a 4+
  zonas, otra versión sin repetir): todos pasan. Perfiles: cultural; water y otra versión;
  adventure; party+food; familia con niños 8 y 5; parks+beach; couples+chill $250; Tulum y
  otra versión; Playa del Carmen con traslados luxury; sin hotel; descansos exactos en inglés;
  3 noches; 10 noches con 4 adultos y 6 intereses; pareja privada; familia con niño de 3;
  Playa del Carmen con party (sin antros de Cancún).
- **Wizard en el navegador**: "Probar otra versión" sobre un borrador de 14 noches.
- **`next build`**: compila (tras el aviso de seguridad de Next).

---

## 5. Puntos débiles y riesgos, por impacto

### A. Datos (lo que más limita hoy)

1. **Catálogo desbalanceado por interés.** 29 de 70 tours son "mar". Cultural tiene 8 (y 4 son
   variantes de Chichén/Tulum), comida 2, pareja 1, chill y shopping 0. Un viajero
   couples+chill con 250 USD sale con 0 tours de su interés principal porque no existen.
   *Opciones:* agregar productos para esos intereses, o quitar/renombrar en el cuestionario
   los que no se pueden cumplir ("chill" debería ser ritmo, no interés; "shopping" y "beach" ya
   se cumplen con lugares, no con tours).
2. **Restaurantes solo en Cancún.** Seis de siete zonas no reciben cenas. El cuestionario pide
   cocinas y presupuesto por cena a todos.
3. **Sin reseñas.** Entre dos tours del mismo interés y tipo el orden lo decide el catálogo.
   Tripadvisor con key o un `best-rated` a mano lo arreglaría.
4. **Clasificación por título.** Hoy cubre los 70, con `/dev/catalog` avisando de los nuevos
   sin tipo y overrides a mano. Es mantenible, pero es una tarea que alguien debe revisar cuando
   Jhonny sube productos.

### B. Reglas que conviene revisar con negocio

5. **Los traslados comen el presupuesto de tours.** 300 USD por persona en Puerto Aventuras =
   600 total; los traslados cuestan 316; quedan 284 para 13 días: 2 tours. El viajero ve 11
   "días libres" y no entiende por qué. *Opciones:* presupuesto de tours aparte del de
   traslados, o mostrar en el itinerario "X USD de tu presupuesto van a traslados".
6. **Presupuesto vs. ritmo.** Un día `full` es un día de tour, pero con presupuesto bajo la
   mayoría quedan libres. Sería más honesto que el paso de preferencias avise "con este
   presupuesto alcanzan ~N tours; ¿subimos el presupuesto o bajamos los días con tour?".
7. **`fitBudget` es tosco en el borde.** Si se pasa 16 USD puede quitar un tour de 298 y dejar
   un día libre. Una tolerancia pequeña (p. ej. 5 %) o avisar al viajero resolvería.
8. **Niños y tours largos.** Con un niño de 3 años y parks+beach, Claude puso Tulum (12 h) y
   Bacalar porque la regla de niños es "evitar salvo que nada más encaje". Con tan pocos tours
   familiares, casi siempre "nada más encaja". Una política explícita (p. ej. máximo 1 tour de
   10 h+ por viaje con menores de 6) sería más segura.
9. **Clima.** La lluvia saca del mar y mete parques de WhatToDo, bien. Pero "windy" también
   saca del mar sin umbral visible al viajero, y los pronósticos a 16 días cambian: el
   itinerario no se recalcula al acercarse la fecha (lo hace el agente a mano).

### C. Claude

10. **No determinista y tiende a dejar huecos** en viajes largos (por eso existe
    `fillEmptyDays`) y a pasarse del presupuesto (por eso `fitBudget`). Los guardianes lo
    cubren, pero cada guardián que corrige a Claude es una nota ("warnings") que el agente debe
    leer; hoy esas notas no se ven en la app, solo en el JSON.
11. **Las notas libres solo las ve Claude.** Si Claude falla, "no quiero delfines" se pierde.
    Y aun con Claude no hay garantía. Un campo estructurado "evitar: delfines, parques…"
    convertido en filtro sería fiable.
12. **Costo/latencia**: 6–20 s por itinerario (Claude 5–8 s + Bokun por tour). Aceptable con el
    mensaje "tarda unos 20 segundos"; crecería con más días.

### D. Operación (no es lógica, pero afecta al resultado)

13. **`/api/lead` no guarda el lead en Vercel** (`if (!isVercel) store.createLead`): en
    producción solo se mandan correos; el panel interno y el link del PDF (`/api/lead/<id>/pdf`)
    no tienen de dónde leer. Esto coincide con la nota del equipo (punto 2 de "información
    importante"): hace falta un backend/base para persistir.
14. **Caché del catálogo en `/tmp` en Vercel**: se pierde en cada arranque y se re-sincroniza
    desde Bokun (400 req/min de límite). Con el re-etiquetado al cargar no hay problema de
    datos viejos, pero sí de latencia en el primer request.
15. **Next vulnerable** hasta que entre el PR #11.

---

## 6. Recomendaciones, en orden

1. **Decidir con negocio los puntos 5 y 6** (traslados vs. presupuesto; aviso de cuántos tours
   alcanzan). Son los que más explican itinerarios "vacíos" y no cuestan código.
2. **Datos**: pedir a Jhonny confirmar las 4 zonas "(check)"; agregar restaurantes de las
   otras zonas (o decir en el paso de cenas que solo hay en Cancún); decidir qué hacer con
   "chill" y "couples" como intereses.
3. **Campo "evitar"** estructurado (tipos de experiencia a excluir) aplicado como filtro en
   todos los motores: barato y da control real al viajero.
4. **Tolerancia del presupuesto** (5 %) y mostrar al viajero cuando un día quedó libre por
   presupuesto.
5. **Mostrar los `warnings` en el panel interno** para que el agente vea qué corrigió el
   servidor (cambios por lluvia, lugares agotados, presupuesto).
6. **Persistencia en producción** (punto 13) antes de abrir al público.

---

## 7. Apéndice: constantes y archivos

| Constante | Valor | Dónde |
|---|---|---|
| Interés principal / secundario | 6 / 1.5 | `rules.ts` |
| Penalización por zona / "far" | 0.75 por zona / 3 zonas | `rules.ts`, `experience.ts` |
| Antros: distancia máxima | 1 zona | `rules.ts` (`NIGHTLIFE_MAX_ZONES`) |
| Tour largo con niños | 10 h, −6 | `rules.ts` |
| Candidatos a Claude | máx. 40, mín. 12 | `claude.ts` |
| Alternativas por disponibilidad | 6 consultadas | `availability-check.ts` |
| Cena | 1 cada 3 días, tolerancia 1.15× presupuesto | `enrich.ts` |
| Niño / infante sin precio en vivo | 70 % / 0 % del adulto | `pricing.ts` |
| Pronóstico | 16 días, cache 3 h | `weather/index.ts` |
| Disponibilidad | cache 15 min, timeout 4 s | `availability.ts`, `availability-check.ts` |
| Catálogo | cache 24 h | `catalog/service.ts` |

Archivos clave: `src/lib/trip-schema.ts`, `src/lib/plan-days.ts`, `src/server/catalog/{normalize,experience,service}.ts`,
`src/content/experience-overrides.ts`, `src/server/ai/{index,rules,claude,diversify,fill,budget,enrich,availability-check,validate,edit,pricing}.ts`,
`src/app/api/itinerary/route.ts`, `src/app/api/lead/route.ts`, `src/components/plan/step-itinerary.tsx`.
