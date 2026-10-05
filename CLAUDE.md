# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A browser-based 3D virtual scale model ("maqueta v2.3", compact 45 × 25 × 20 cm) of an IoT river-level early-warning system for Colima. It includes:

- an acrylic channel set into a foam block
- an HC-SR04 hanging from a bridge
- FC-37 rain and YL-69 soil sensors
- an SG90-driven tilting gate whose crest doubles as the overflow spillway
- a return chute into a tub (tóper) hanging under the MDF board
- a relay-switched pump
- an ESP32 in a side tech strip

It simulates sensor readings and the risk classification the real firmware is meant to implement. All code, identifiers, comments and UI text are in Spanish; keep new code in Spanish to match.

## Commands

```bash
npm install
npm start        # node server.js → http://localhost:3000
npm run dev      # node --watch server.js (restarts on server.js changes only; just reload the browser for index.html edits)
```

`PORT` and `HOST` env vars override the defaults (3000 / 0.0.0.0). Requires Node ≥ 18. There are no tests, linter or build step.

## Architecture

- `server.js`: a minimal Express 5 static server. It serves `public/`, serves `node_modules/three` at `/vendor/three` so the model works offline, and exposes `GET /api/salud` as a health check.
- `public/index.html`: the whole application in a single file (CSS, panel/dashboard HTML, and one inline `<script>`). It uses **three.js r128 global builds** (`THREE`, `THREE.OrbitControls` from `examples/js`) loaded from `/vendor/three`, with a cdnjs fallback via `document.write`. There are no ES modules and no bundler. Stay on r128 APIs, because `examples/js` was removed in later three.js versions. If OrbitControls fails to load, an inline `ControlesMinimos` provides the same subset of its API. When replacing this file with a new design exported as a standalone HTML file (which loads three.js from a CDN), restore the local `/vendor/three` script tags.

### Script layout (top to bottom, in sections marked by `// ===== NAME =====`)

1. **`CONFIG`**: every dimension (1 unit = 1 cm of model), position, color, and simulation constant. Geometry is derived from it, so change it here rather than hard-coding numbers in the builders.
2. **`UMBRALES` + `clasificarRiesgo(nivel, lluvia, humedad)`**: risk rules, evaluated from most to least severe, where the first match wins. This mirrors the intended firmware logic.
3. **Calibration table**: `columnaDesdeNivel`, `yAguaCanal` and `distanciaSensor` map the simulated real river level (0–400 cm) to the water column in the channel (0–`columnaMax` cm) and to the HC-SR04 reading. The firmware needs this table. The sensor ADC conversions are `adcFC37`, `doFC37` and `adcYL69`.
4. **Scene construction**: IIFEs, grouped by section (base and relief, channel, chute, water, bridge, gate, reservoir, sensors, cabling, labels and dimensions), add meshes to one `THREE.Group` per layer.
   - The `CAPAS` map ties the `data-capa` checkboxes to these groups.
   - Build meshes with the `caja()`, `cilindro()` and `bloque()` helpers, which set shadows and names. Wrap acrylic parts in `aristas()` so their edges stay visible.
   - Mesh `name`s become the object names in the OBJ export.
   - `cotaTerreno(x, z)` gives the terrain height so objects sit on the foam layers. `enZanja()` tells whether a point is inside the channel trench.
   - Randomness uses the seeded LCG `aleatorio()`, so the scene is identical on every load. Don't use `Math.random()`.
5. **Water model**:
   - `caudales()` splits the outflow into two parts: `qVert` goes over the gate crest while the gate is closed, and `qAbre` goes through the open gate.
   - `yAguaToper()` gets the tub level by subtracting the water in the river from a fixed total volume (`CONFIG.bahia.litros`).
   - `actualizarAgua()` draws the river surface, the falling water sheets and the tub. The flow arrows (`grupoFlujo`) follow the same flows.
6. **`estado`**: all runtime state, held in JS variables only (deliberately no localStorage). `refrescarSimulacion()` is the single function that recomputes readings, risk, actuator targets and the dashboard DOM from `estado`. Call it after changing `estado.nivel`, `estado.lluvia`, `estado.humedad` or `estado.fallaServo`.
7. **UI wiring**:
   - sliders and the flood simulation
   - layer checkboxes and camera views (`VISTAS`)
   - the servo-failure toggle (`chkFalla`)
   - fine-adjust drag of the ESP32 and buzzer
   - a custom `.obj` + `.mtl` exporter (r128's OBJExporter doesn't write materials)
   - the exploded view ("Despiece"). `definirPiezas()` lists each physical part with its category, table slot, rotation and measurements. `construirDespiece()` clones the existing meshes into `grupoDespiece` the first time the mode is entered. `irAZona()` frames the camera on one category, and `actualizarDespiece()` animates parts between assembled (`p0`) and laid-out (`p1`). While `estado.despiece` is on, the layer checkboxes, fine-adjust drag and pin labels are disabled. When you add a physical part to the model, also add it to `definirPiezas()` or it won't appear in the exploded view.
8. **`bucle()`**: the single `requestAnimationFrame` loop. Animations (camera views, flood ramp, gate swing) are timed from the `THREE.Clock` elapsed time, not by accumulating `dt`. Cable rebuilds are throttled through `estado.cablesSucios`, and `reconstruirCableado()` regenerates the cable tubes.

### Gotchas

- `relojGlobal` is a `const` declared near the bottom, just before the first `refrescarSimulacion()` call. Top-level code that runs earlier must not touch it, because of the temporal dead zone.
- In HIGH risk the actuators respond: the buzzer halo pulses, the gate tilts 90°, and the relay turns the pump off. With `fallaServo` set, the gate stays closed, and water can only leave over the 4 cm crest (equivalent to 320 cm of river) into the chute.
- Some numbers that derive from `CONFIG` are typed out by hand in text. Update them when dimensions change. They appear in:
  - the panel sections "Ajustes respecto a la v2.1", "Medidas generales" and "Cómo circula el agua"
  - `#pieEscala`
  - the dimension labels in the scene
  - the height budget in the header comment
- The ESP32 analog sensors must stay on ADC1 pins (GPIO34/35), because ADC2 is unusable while WiFi is active. The pin labels in the dashboard and `ETIQUETAS` reflect this.
