<div align="center">

# ⚡ METRO RUSH: NEON CITY

**Videojuego 3D de parkour urbano, combates de jefes secuenciales, vehículos futuristas y multijugador LAN/Internet para PC (Windows / Electron).**

**Versión actual:** `v8.0.0` (*SKYLINE PROTOCOL*) · **Autor:** Jaderson Liriano (**Líder de XynexDevs Studios**)

[![Version](https://img.shields.io/badge/version-8.0.0-22d3ee?style=for-the-badge)](./package.json)
[![Electron](https://img.shields.io/badge/Electron-Desktop%20PC-0f172a?style=for-the-badge&logo=electron)](./electron/main.ts)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL%203D-ec4899?style=for-the-badge&logo=threedotjs)](./src/game/engine.ts)
[![SQLite](https://img.shields.io/badge/SQLite-Dual%20Engine-38bdf8?style=for-the-badge&logo=sqlite)](./src/db/sqlite.ts)
[![License](https://img.shields.io/badge/License-XynexDevs%20%2B%203P%20Notices-f59e0b?style=for-the-badge)](./LICENSE)

</div>

---

## 🧭 Visión y Directivas Oficiales del Proyecto

Este documento funciona como **guía técnica, manual de juego y directiva oficial de desarrollo** para **METRO RUSH: NEON CITY**. Cualquier contribución, compilación o despliegue del proyecto debe respetar los siguientes principios arquitectónicos:

1. **Experiencia 100% Jugable Offline y Online:** El modo individual (Historia, Sin Fin, Parkour y Jefes) debe funcionar íntegramente sin conexión a Internet ni servidores externos obligatorios.
2. **Alojamiento Descentralizado (Player-Hosted):** Cualquier jugador puede crear y alojar una partida multijugador desde su propia computadora sin depender de un servidor central de pago.
3. **Sistema Dual de Cuentas y Persistencia Real:** Las partidas locales offline y las cuentas online coexisten con resolución explícita de conflictos (nunca sobrescriben progreso en silencio) y sobreviven a cierres, reinicios de Windows y actualizaciones del `.exe`.
4. **Progresión Lineal y Autoridad del Servidor:** La campaña de **8 Jefes** se valida tanto en interfaz como en servidor; las carreras verificadas aplican validación física anti-cheat y transacciones idempotentes (`txId`).
5. **Seguridad Estricta en Escritorio (Electron):** `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, puente IPC estrictamente validado (`window.metroDesktop`) y cierre limpio de procesos locales antes de salir.
6. **Datos Reales y Licencias Íntegras:** Prohibido simular telemetría falsa o usuarios ficticios; toda búsqueda, invitación y sincronización opera contra SQLite y WebSockets/WebRTC reales, manteniendo íntegras las licencias de modelos 3D y bibliotecas de terceros (`LICENSE` / `LICENSE.md`).

---

## 🎮 Contenido y Mecánicas del Juego

### Modos de Juego
- **Modo Sin Fin (Endless):** Corre a velocidad creciente recolectando monedas, gemas y multiplicadores mientras enfrentas emboscadas dinámicas.
- **Modo Historia:** Campaña narrativa por capítulos conectados a las metrópolis y jefes de Neon City.
- **Modo Parkour:** Trazados técnicos con saltos dobles, *Wall-Run*, plataformas elevadas y obstáculos rítmicos.
- **Combate de Jefes (8 Jefes Lineales):** Desbloqueo progresivo obligatorio jefe por jefe mediante captura de celdas EMP y esquiva de ataques telegrafiados.

### Los 8 Jefes Secuenciales (`ORDERED_BOSS_IDS`)
| Orden | Jefe | Título | Distrito | Recompensa |
| :---: | :--- | :--- | :--- | :--- |
| `01` | **TITAN DRONE** | Fortaleza Aérea de Asalto | Neon Downtown | `1,800 M` · `25 G` |
| `02` | **IRON HUNTER** | Perseguidor Mecánico Terrestre | Industrial Core | `2,000 M` · `28 G` |
| `03` | **OVERSEER** | Núcleo Robótico de Vigilancia | Cyber Underground | `2,100 M` · `30 G` |
| `04` | **NEON WRAITH** | Unidad Fantasma Supersónica | Beach Sunset | `2,400 M` · `35 G` |
| `05` | **CRYO LEVIATHAN** | Serpiente Criogénica Orbital | Old City | `2,650 M` · `38 G` |
| `06` | **VOLT ARCHON** | Arconte de Alta Tensión | Skyline Zero | `2,950 M` · `42 G` |
| `07` | **THE SENTINEL** | Guardián Cuántico de Defensa | Future District | `3,500 M` · `50 G` |
| `08` | **OMEGA CORE** | Reactor Singularidad Final | Future District | Jefe Final |

### Metrópolis, Corredores, Vehículos y Drones de Ayuda
- **10 Metrópolis Diferenciadas:** *Neon Downtown*, *Old City*, *Industrial Core*, *Skyline Zero*, *Beach Sunset*, *Cyber Underground*, *Future District*, **Cuidado si te caes** (`skyfall_towers`), **La Creación** (`the_creation`) y **No te ahogues** (`dont_drown`), con eventos dinámicos de túneles subterráneos, callejones de 1–2 carriles y autopista de 5 carriles.
- **Corredores Jugables:** Cada personaje cuenta con habilidad activa, pasiva y habilidad única al activar vehículo, además de ranura para **Potenciadores** equipables.
- **6 Vehículos Futuristas (Terrestres y Aéreos):** *Hover Bike*, *Cyber Coupe*, *Quantum Glider*, *Titan Rammer*, *Star Viper* y *Plasma Bomber* (los vehículos aéreos despegan y sortean obstáculos en altura).
- **Drones Aliados Invocables:** Sistema táctico de drones con tiempo activo y enfriamiento en pista.
- **Tienda 3D/2D y Economía:** Catálogo por tarjetas con vista previa 3D/2D al seleccionar, pestaña **Todo**, rotación semanal de 6 semanas, cambio de Gemas a Monedas, avatares y potenciadores.
- **Perfil, Onboarding y Controles Adaptables:** Pantalla inicial de **XynexDevs Studios**, escaneo automático de hardware (CPU/RAM/GPU), enfriamiento de 3 días para cambio de nombre offline, estadísticas integradas en el perfil y controles en pantalla adaptados a **Teclado, Xbox, PlayStation y Nintendo**.

---

## ⌨️ Controles por Defecto (PC)

| Acción | Tecla Principal | Alternativa |
| :--- | :---: | :---: |
| Mover a la izquierda | `A` | `←` |
| Mover a la derecha | `D` | `→` |
| Saltar / Doble salto / Wall-Run | `Espacio` | `W` / `↑` |
| Deslizarse / Descenso rápido | `S` | `↓` / `Ctrl` |
| Sprint / Nitro | `Shift Izquierdo` | `Shift Derecho` |
| Interactuar / Vehículo | `E` | — |
| Habilidad especial | `F` | — |
| Slow-Mo (Cámara lenta) | `C` | — |
| Pausa / Salir (en título) | `Esc` | — |

*(Reasignables y configurables con perfiles `Estándar`, `Competitivo`, `Una Mano` y `Personalizado` dentro de Ajustes).*

---

## 🌐 Arquitectura Multijugador (4 Modos de Red)

El motor multijugador comparte una misma sala autoritativa (`src/net/matchHost.ts`) con control de versión (`v2.4.0`), espera automática de autenticación (`connectAsync` + cola de comandos), reconexión de **45 segundos**, expulsión por anfitrión (`room:kick`) y anti-cheat básico de telemetría:

1. **Red Local (LAN):** Detecta las interfaces IPv4 de tu equipo, inicia el servidor de sala en el puerto configurado (por defecto `3077`) y conecta al anfitrión por `127.0.0.1` mientras los invitados se unen vía IP local (`192.168.x.x:3077`).
2. **VPN Virtual (`Radmin VPN`, `ZeroTier`, `Tailscale`):** Filtra y prioriza interfaces VPN reales (`26.x`, `100.64.x`, `10.x`, `172.16-31.x`) para copiar la IP virtual en un clic.
3. **Túnel Gratuito (`cloudflared` + `playit.gg`):** Soporte en Electron para iniciar `cloudflared` con un clic (convirtiendo `https://` a `wss://`) o exponer el puerto TCP `3077` mediante `playit.gg` sin abrir puertos en el router.
4. **WebRTC P2P:** Enlace por oferta/respuesta SDP con envío de telemetría real a través de `RTCDataChannel` (para redes con NAT simétrico estricto requiere configurar variables `METRO_RUSH_TURN_URL`, `METRO_RUSH_TURN_USER` y `METRO_RUSH_TURN_CREDENTIAL`).

### Invitaciones Persistentes y Cuentas Compartidas
- Las invitaciones se almacenan en la tabla SQLite `room_invitations` (`/api/invites`) y la búsqueda de usuarios (`/api/users/search`) consulta usuarios reales registrados.
- **Directiva importante de red:** Cada `.exe` incluye su propia base SQLite local para uso individual o pruebas locales. Para que múltiples PCs compartan las mismas cuentas, rankings e invitaciones persistentes, ambos clientes deben apuntar al mismo servidor compartiendo `ONLINE_API_URL` (o configurando la URL en **Servidor de Cuentas Online**).

---

## 💾 Persistencia y Seguridad de Sesión

- **Base SQLite Dual (`src/db/sqlite.ts`):** Usa `node:sqlite` cuando el runtime lo soporta y cambia automáticamente a `sql.js` (WASM `dist-electron/sql-wasm.wasm`) en Electron con escritura atómica (`.tmp` -> `renameSync`) y migraciones versionadas (`schema_version = 3`).
- **Ubicación persistente en Windows instalado:** `%APPDATA%\Metro Rush Neon City\data\userdata.db` (con respaldos en `backups/` y `deleteAppDataOnUninstall: false` en NSIS para no perder datos al actualizar o reinstalar).
- **Sesión Persistente Cifrada (`session.enc`):** Electron cifra el `accessToken` y `refreshToken` rotativo (`auth_sessions`) con `safeStorage` de Windows para restaurar la cuenta online automáticamente al reabrir el `.exe`.
- **Salida Limpia:** Confirmar salida detiene de forma ordenada el servidor LAN, túneles Cloudflare, sockets WebSocket y procesos hijos antes de cerrar Electron.

---

## 🛠️ Estructura del Repositorio

```text
├── electron/
│   ├── main.ts            # Ventana Electron, safeStorage, cloudflared, ciclo de vida y cierre limpio
│   ├── preload.ts         # Puente IPC seguro (window.metroDesktop)
│   └── serverWorker.ts    # Proceso aislado utilityProcess para Express + WS + SQLite
├── src/
│   ├── components/        # HUD, TitleOverlay, UserProfileView, StatsView, InventoryView, OnlineHubView, etc.
│   ├── db/
│   │   └── sqlite.ts      # Motor SQLite dual (node:sqlite / sql.js WASM), migraciones, sesiones e invitaciones
│   ├── game/
│   │   ├── data.ts        # Catálogo oficial: 8 personajes, 7 distritos, 8 jefes lineales, 4 vehículos
│   │   ├── engine.ts      # Motor 3D Three.js + Postprocesado + Físicas + Jefes + Mascota 3D
│   │   ├── models.ts      # Constructores 3D procedurales y glTF (Robot, Fox, Buggy, etc.)
│   │   ├── storage.ts     # Guardado local, migraciones v3, perfiles de control y métricas
│   │   └── types.ts       # Contratos TypeScript compartidos
│   ├── net/
│   │   └── matchHost.ts   # Sala multijugador autoritativa WebSocket + detección de interfaces LAN/VPN
│   ├── services/
│   │   ├── onlineClient.ts# Cliente REST/WS con cola auth, refresh tokens, perfiles e invitaciones
│   │   └── rtcClient.ts   # Gestor WebRTC P2P (DataChannel telemetry + SDP manual/señalizado)
│   └── App.tsx            # Orquestación principal, bootstrap de sesión y confirmación de salida
├── scripts/
│   ├── build-electron.mjs # Compila main/preload/serverWorker con esbuild, copia sql-wasm.wasm y genera iconos
│   └── dev-electron.mjs   # Arranque simultáneo de desarrollo en ventana Electron
├── server.ts              # Servidor Express + API REST + WebSocket /ws
├── electron-builder.yml   # Configuración del instalador NSIS para Windows x64
├── package.json           # Scripts de desarrollo, build y empaquetado
├── LICENSE                # Licencia oficial del proyecto (Jaderson Liriano / XynexDevs)
└── LICENSE.md             # Desglose detallado de derechos y licencias de terceros
```

---

## 🚀 Instalación, Desarrollo y Compilación `.exe` (Windows)

### Requisitos Previos
- **Node.js 22+** y **npm 10+** (compatible sin conflictos `ERESOLVE` usando `esbuild ^0.28.0`).
- **Windows 10 / 11** recomendado para generar el instalador `.exe` NSIS final.

### Comandos en PowerShell

```powershell
# 1. Clonar el repositorio e instalar dependencias
npm install

# 2. Verificar tipos TypeScript
npm run lint

# 3. Ejecutar servidor web/API de desarrollo (http://localhost:3000)
npm run dev

# 4. Ejecutar en ventana nativa Electron (desarrollo)
npm run dev:electron

# 5. Compilar aplicación web + procesos Electron + WASM + iconos
npm run build

# 6. Generar instalador instalable para Windows (.exe)
npm run dist:win
```

### Instalador y Portable Generados
Al completar `npm run dist:win`, los ejecutables listos para distribuir se generan en `release/`:

```text
release\Metro-Rush-Neon-City-Setup-8.0.0.exe
release\Metro-Rush-Neon-City-Portable-8.0.0.exe
```

---

## 👨‍💻 Autoría y Créditos

- **Creador y Arquitecto Principal:** **Jaderson Liriano** — **Líder de XynexDevs**
- **Proyecto:** **METRO RUSH: NEON CITY**
- **Licencias:** Código, diseño y marca protegidos bajo [`LICENSE`](./LICENSE). Activos 3D de muestra (`KhronosGroup/glTF-Sample-Assets`) y bibliotecas de código abierto debidamente reconocidos en [`LICENSE.md`](./LICENSE.md).
