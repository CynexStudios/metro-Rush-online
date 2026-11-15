# METRO RUSH: NEON CITY — Guía de Escritorio PC (Electron), Multijugador LAN/Internet y Cuentas

Esta guía explica cómo funciona la versión instalable para Windows (`METRO RUSH: NEON CITY v2.4.0`), cómo compilar el instalador `.exe`, dónde se guardan los datos del jugador y cómo jugar en modo individual, en red local (LAN) o por Internet.

---

## 1. Arquitectura de Escritorio (Electron + Servidor Local)

La aplicación empaquetada se compone de tres procesos aislados:

1. **Proceso Principal (`electron/main.ts` -> `dist-electron/main.cjs`)**:
   - Garantiza instancia única (`requestSingleInstanceLock`).
   - Crea y supervisa el proceso hijo de servidor local (`utilityProcess`). Si el servidor falla inesperadamente, intenta reiniciarlo automáticamente (hasta 3 intentos) y muestra un aviso en el juego con botón **Reintentar**.
   - Abre la ventana de juego con seguridad estricta: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, bloqueo de ventanas emergentes y bloqueo de navegaciones externas.
   - Expone únicamente los canales IPC validados de `electron/preload.ts` bajo `window.metroDesktop`.
2. **Proceso de Servidor Local (`electron/serverWorker.ts` -> `dist-electron/serverWorker.cjs`)**:
   - Ejecuta Express + SQLite + WebSocket en `127.0.0.1` usando un puerto libre asignado dinámicamente (`PORT=0`).
   - Sirve los archivos estáticos compilados de Vite (`dist/`), la base SQLite local y los endpoints REST/WS.
   - Se apaga de forma limpia en `before-quit` antes de cerrar la app.
3. **Almacenamiento Persistente SQLite (`src/db/sqlite.ts`)**:
   - Motor dual automático: usa `node:sqlite` cuando el runtime lo soporta y **cambia automáticamente a `sql.js` (WASM `dist-electron/sql-wasm.wasm`)** con escritura atómica (`.tmp` -> `renameSync`) en Electron/Windows sin necesitar compilar módulos nativos C++ en cada actualización de Electron.
   - Incluye migraciones versionadas (`schema_version`) con copia de seguridad previa automática (`backups/userdata-pre-migration-*.db`).

---

## 2. Dónde se Guardan las Partidas y Por Qué Sobreviven a Actualizaciones

- **En Windows instalado (`.exe`)**:
  - Carpeta del programa: `C:\Users\<Usuario>\AppData\Local\Programs\Metro Rush Neon City\` (configurable en el instalador NSIS).
  - **Carpeta persistente de datos y partidas**: `%APPDATA%\Metro Rush Neon City\data\`
    - Base SQLite: `userdata.db`
    - Copias de seguridad automáticas: `backups\`
- **En desarrollo / Linux / servidor independiente**:
  - `~/.metro-rush-neon-city/userdata.db` (o la ruta indicada en `METRO_RUSH_DATA_DIR`).
- El instalador NSIS está configurado con `deleteAppDataOnUninstall: false`, por lo que **actualizar o reinstalar el juego no borra tus perfiles, monedas, desbloqueados ni configuraciones**.

---

## 3. Sistema Dual de Cuentas, Sesión Persistente y Perfil de Usuario

### A. Perfiles Locales (100% Offline)
- Puedes jugar en solitario sin conexión a Internet y sin crear ninguna cuenta online.
- En **Perfil** (accesible desde la barra superior o el botón **Perfil** del menú principal) y en **Multijugador** puedes crear múltiples perfiles locales en este mismo PC, cambiar tu apodo o avatar, exportar copias de seguridad `.json` con diálogo nativo de Windows o importar respaldos previos.

### B. Cuenta Online Persistente entre Reinicios del `.exe`
- Permite registrarte con usuario, correo y contraseña cifrada con `scrypt` + código de recuperación `MR-XXXX-XXXX`, guardar progreso en el servidor conectado, buscar jugadores reales en la base de datos e invitarlos a tu sala.
- **Persistencia Real al Reiniciar Windows / `.exe`**: el proceso principal de Electron cifra tu sesión (`accessToken` + `refreshToken` rotativo en tabla SQLite `auth_sessions`) usando `safeStorage` nativo de Windows en `%APPDATA%\Metro Rush Neon City\data\session.enc`. Al reabrir el juego, la sesión se restaura y renueva automáticamente sin obligarte a volver a iniciar sesión.
- **Servidor Compartido entre Varias PCs (`ONLINE_API_URL`)**: si quieres que dos computadoras distintas compartan cuentas, amigos e invitaciones persistentes, apunta ambos equipos al mismo servidor (`ONLINE_API_URL` o campo **Servidor de Cuentas Online** en el Perfil/Hub). Sin un servidor compartido, cada `.exe` usa su propia base SQLite local.

### C. Vinculación y Resolución de Conflictos
- Si jugaste offline en un perfil local y luego inicias sesión en una cuenta online con progreso distinto, **el juego nunca sobrescribe en silencio**: muestra una comparativa lado a lado con tres opciones explícitas (**Combinar sin Duplicar**, **Conservar Progreso Local** o **Conservar Progreso Online**).

---

## 4. Cómo Jugar Multijugador (4 Modos: LAN, VPN, Túnel Gratuito y WebRTC)

Todos los clientes comprueban compatibilidad de versión (`v2.4.0`) y esperan automáticamente a que el WebSocket quede autenticado (`connectAsync` + cola de comandos) al crear o entrar en salas.

### Opción 1: Red Local (LAN)
1. **Anfitrión**: abre **Multijugador -> Red Local (LAN)**, elige la interfaz de red o `0.0.0.0` y puerto (`3077`), y pulsa **Iniciar Servidor LAN**.
2. El juego detecta automáticamente tu IP local (p. ej. `192.168.1.45:3077`) y conecta al anfitrión por `127.0.0.1:3077` sin depender de adaptadores externos.
3. **Invitados**: introducen `192.168.1.45:3077` y entran con el código de sala. *(En Windows, acepta el Firewall en redes privadas).*

### Opción 2: VPN Virtual (Radmin VPN / ZeroTier / Tailscale)
1. Activa **Radmin VPN**, **ZeroTier** o **Tailscale** con tus amigos en la misma red virtual.
2. En **Multijugador -> VPN Virtual**, el juego filtra y muestra tu IP virtual real (rangos `26.x`, `100.64.x`, `10.x`, `172.16-31.x`) para copiarla en un clic junto al puerto.

### Opción 3: Túnel Gratuito (`cloudflared` + `playit.gg`)
1. Inicia tu servidor LAN en el puerto `3077`.
2. **Cloudflare Tunnel (1 clic en PC)**: si `cloudflared.exe` está en tu `PATH` o junto al `.exe`, pulsa **Iniciar Túnel Cloudflare** para generar al instante una URL pública `https://...trycloudflare.com` (el juego convierte `https://` a `wss://` automáticamente).
3. **playit.gg**: también puedes crear un túnel TCP hacia `127.0.0.1:3077` y compartir la URL con tus amigos.

### Opción 4: WebRTC P2P (Sin Servidor Central)
- Intercambio de oferta/respuesta SDP con envío de telemetría real entre pares (`telemetry:update`) a través del canal de datos WebRTC.
- Si dos redes tienen NAT simétrico estricto sin túnel TCP, se requiere configurar un servidor **TURN** (`METRO_RUSH_TURN_URL`, `METRO_RUSH_TURN_USER`, `METRO_RUSH_TURN_CREDENTIAL`).

### Invitaciones Persistentes y Salida Limpia
- Busca usuarios reales (`searchOnlineUsers`) y envía invitaciones persistentes (`/api/invites`) con aceptación o rechazo directo en sala.
- Al pulsar **Salir del Juego** (o `Escape` en la pantalla principal), el juego guarda tu perfil local/online y cierra de forma segura servidor LAN, túnel Cloudflare y WebSocket antes de finalizar la app.

---

## 5. Novedades de Progresión v2.4.0 y Créditos

- **8 Jefes Secuenciales**: progresión lineal obligatoria desde `Titan Drone Mk-IV` hasta `Omega Core` (validada tanto en el servidor `/api/runs/start` como en el selector de **Jefes**).
- **Mascota 3D Acompañante (`Zorro Cyber`)**: ahora puedes equipar y desequipar al Zorro Cyber directamente desde **Personalizar -> Especiales**.
- **Estadísticas Filtrables**: gráficas de trayectoria y victorias/modos por período (`7d`, `30d`, `90d`, `Todo`).
- **Autoría**: Videojuego **METRO RUSH: NEON CITY** creado por **Jaderson Liriano**, **Líder de XynexDevs** (con respeto íntegro de todas las licencias de terceros detalladas en `LICENSE.md`).

---

## 6. Comandos para Desarrolladores y Compilación `.exe` en Windows (PowerShell)

### Requisitos previos
- Node.js 22+ y npm 10+ (probado con `esbuild ^0.28.0` compatible sin conflictos `ERESOLVE`).

### Pasos en PowerShell
```powershell
# 1. Instalar dependencias (limpio, sin --force)
npm install

# 2. Desarrollo web / servidor local (puerto 3000)
npm run dev

# 3. Desarrollo en ventana Electron conectada al servidor dev
npm run dev:electron

# 4. Compilar frontend Vite + main/preload/serverWorker de Electron + WASM + iconos
npm run build

# 5. Generar instalador real para Windows (.exe NSIS en carpeta release/)
npm run dist:win
```

### Archivo Final Para Compartir Con Tus Amigos
Al finalizar `npm run dist:win` en Windows, comparte el instalador generado en:

`release\Metro-Rush-Neon-City-Setup-2.4.0.exe`

