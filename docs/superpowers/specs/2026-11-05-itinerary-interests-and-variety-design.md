# Itinerario: intereses que signifiquen algo y sin días repetidos

Fecha: 2026-11-05 · Rama: `tristan` (nunca `main`)

## Problema

Con el catálogo real (`.cache/catalog.json`, 70 tours del planner):

1. **Las etiquetas de interés están infladas.** Las reglas por palabra clave de
   `src/server/catalog/normalize.ts` leen título + *excerpt* + keywords, así que
   "water" cae en 54/70 tours y "cultural" en 41/70 ("Dolphin Discovery Tulum" →
   `[water, adventure, cultural, beach]`; "Chichén Itzá Deluxe con cenote" →
   `[cultural, water]`). El puntaje (`scoreProduct`) es `overlap × 3`, así que un
   tour con 5 etiquetas sueltas (Xcaret) gana siempre a uno preciso con 1.
   Resultado: quien marca "cultural" recibe delfines y ATVs.
2. **Se repite la naturaleza del tour.** Nadie tiene reseñas en Bokun (todos
   empatan), el validador solo quita duplicados por `bokunId`, y el catálogo tiene
   6 *Dolphin Discovery*, 4 Chichén Itzá y 4 catamaranes a Isla Mujeres. Salen dos
   días de delfines o dos de catamarán. El PR #8 (`d7269f7`, revertido en
   `db7e29a`) ya resolvía esto; se retoma sobre el código actual.

## Diseño

### 1. Tipo de experiencia (`src/server/catalog/experience.ts`)

Un módulo puro, compartido por el etiquetado del catálogo y por el motor:

- `experienceTypes(p: { title })`: tipos que nombra el título, en orden de
  prioridad (`romantic`, `show`, `nightlife`, `whale_shark`, `dolphin`, `park`,
  `ruins`, `day_trip`, `cave`, `atv`, `horseback`, `catamaran`, `speedboat`,
  `cenote`, `zipline`, `snorkel`, `boat`, `beach_club`, `food`, `spa`). El primero
  es el **tipo principal** ("Chichén Itzá con cenote" es ruinas; "ATV, Zipline &
  Cenote" es ATV).
- `primaryInterest(p)`: el interés del tipo principal (ruinas → `cultural`, ATV →
  `adventure`, delfines → `water`, Coco Bongo → `party`, taco tour → `food`…), o
  `null` si el título no dice nada.
- `variety(p, chosen)`: 2 = nada en común con los tours ya elegidos, 1 = comparte
  algún tipo pero con otro principal, 0 = mismo tipo principal (igual que PR #8).

### 2. Etiquetado más preciso (`normalize.ts`, `service.ts`)

- `interestsFor(p)` calcula las etiquetas a partir de las **categorías de Bokun y
  del título + keywords**; deja de leer el *excerpt*. Se quitan las palabras
  sueltas que inflaban: `maya|mayan` (→ cultural) y `beach` (→ water).
- El interés principal siempre está incluido y va primero en `interests`.
- `getPlannerProducts()` recalcula `interests` con `interestsFor` al cargar, así
  los cachés viejos (`.cache/catalog.json`, `/tmp/wtd-cache` en Vercel, TTL 24 h)
  salen bien etiquetados sin esperar a la siguiente sincronización. Sustituye al
  parche actual de "parks".

### 3. Puntaje nuevo (`scoreProduct` en `rules.ts`)

```
sin ningún interés del viajero            → 0 (fuera de la lista, como hoy)
interés principal marcado por el viajero  → +6
cada interés secundario marcado           → +1.5
+ rating (4.5 si no hay reseñas) + log10(reseñas + 1)
privado si lo pidió +3; tour de 10 h con niños −6 (como hoy)
```

Un tour cuyo interés principal es el del viajero siempre va antes que uno que
solo lo roza por una etiqueta secundaria.

### 4. Variedad (retoma PR #8 sobre el código actual)

- **Motor de reglas:** `pickWith(2) ?? pickWith(1) ?? pickWith(0)`: primero un
  tour sin nada en común con los días anteriores, luego uno con otro tipo
  principal, y solo repite tipo si no queda otra opción. En días de lluvia los
  parques de WhatToDo siguen primero, pero sin repetir ATV.
- **Claude:** cada candidato lleva `kinds` (tipos, el primero es el principal) y
  `mainInterest`; el prompt añade la regla de variedad (nunca dos tours con el
  mismo tipo principal).
- **`diversify()` en el servidor** (`src/server/ai/diversify.ts`), después de
  cualquiera de los dos motores y antes de `fitBudget`: recorriendo el viaje en
  orden, un tour que repite el tipo de un día anterior se cambia por el que mejor
  encaje (intereses, presupuesto, edades, noche de fiesta, clima) y sea más
  distinto. Nunca vuelve a meter tours de la versión anterior (`avoid`).
- Los reemplazos por presupuesto (`budget.ts`) y por falta de lugares en Bokun
  (`availability-check.ts`) prefieren un tipo que no esté en el viaje.

## Fuera de alcance

Zona del hotel / distancias, usar las notas del viajero en el motor de reglas,
romper empates con reseñas externas.

## Pruebas

- `experience.test.ts`: tipos e interés principal con títulos reales del catálogo.
- `normalize.test.ts`: un tour de delfines cuyo *excerpt* dice "Mayan" no es
  `cultural`; Chichén con cenote tiene `cultural` primero.
- `rules.test.ts`: el puntaje prefiere el interés principal a muchas etiquetas
  secundarias; tests de variedad del PR #8 (dos cenotes, dos ATV, Xcaret/Xel-Há).
- Script sobre el catálogo real: tours por interés antes/después.
- Itinerario real en la app (`/es/plan`) y "Probar otra versión": sin dos días del
  mismo tipo y con tours del interés marcado.
