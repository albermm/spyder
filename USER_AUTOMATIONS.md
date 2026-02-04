# Spyder iPhone Setup Guide

> **Use Case:** Leaving the phone as a dedicated monitoring device (e.g., with a family member in another country).

---

## How Spyder Works

| Component | Function |
|-----------|----------|
| **Dashboard** | "Start Recording" / "Stop Recording" buttons send commands |
| **Server** | Routes commands to device via WebSocket |
| **Mobile App** | CommandHandler triggers AudioService |
| **AudioService** | Records audio → saves WAV → uploads to R2 → notifies server |
| **RecordingsList** | Displays recorded clips with playback |

### Additional Features
- **Live audio streaming** via AudioPlayer component
- **Sound detection** — auto-record when sound exceeds threshold
- **Ping Device** — sends push notification to wake suspended app

---

## Ping → Wake → Record Flow

This is how you record audio when the app is in background:

```
┌─────────────────────────────────────────────────────────────────┐
│  1. PING (Dashboard)                                            │
│     Dashboard → POST /api/devices/{id}/ping → Server            │
├─────────────────────────────────────────────────────────────────┤
│  2. SILENT PUSH (Server → iOS)                                  │
│     Firebase sends: { content_available: true }                 │
│     iOS wakes app in background (~30 sec execution time)        │
├─────────────────────────────────────────────────────────────────┤
│  3. APP HANDLES WAKE-UP (Mobile)                                │
│     setBackgroundMessageHandler() → handleWakeUp()              │
│     → socketService.connectWithAutoRefresh()                    │
│     → WebSocket reconnected ✅                                  │
├─────────────────────────────────────────────────────────────────┤
│  4. SEND COMMAND (Dashboard)                                    │
│     Dashboard → "Start Recording" → Server → WebSocket → App    │
│     App records audio → uploads to R2 → notifies server         │
├─────────────────────────────────────────────────────────────────┤
│  5. RECORDING AVAILABLE                                         │
│     Dashboard shows recording in RecordingsList                 │
│     Play/download from R2                                       │
└─────────────────────────────────────────────────────────────────┘
```

### Workflow for Recording:
1. **Click "Ping Device"** — wakes the app
2. **Wait for device to show "Online"**
3. **Click "Start Recording"** — app records
4. **Click "Stop Recording"** — or let it auto-stop
5. **Recording appears in list** — play/download

### Limitations:
| Scenario | Works? | Notes |
|----------|--------|-------|
| App **backgrounded** | ✅ Yes | Ping wakes it, ~30 sec window |
| App **force-killed** | ❌ No | Push can't wake killed apps |
| **Frequent pings** | ⚠️ Throttled | iOS limits silent pushes |
| **Recording >30 sec** | ⚠️ May stop | Background time limited |

### Why Ping First?
The app may be suspended (not killed). Ping wakes it and reconnects WebSocket. Then you can send recording commands.

---

## ⚠️ iOS Limitations

| Scenario | App Status | Can Respond? |
|----------|------------|--------------|
| App in **foreground** | Active | ✅ Yes |
| App **backgrounded** | Suspended | ✅ Yes (ping wakes it) |
| App **force-killed** | Terminated | ❌ No |
| Phone **restarted** | Terminated | ❌ No (until manually opened) |

**Key insight:** iOS doesn't allow apps to auto-start after reboot or force-kill. The user must open the app manually at least once.

---

## iPhone Shortcuts Limitations

Apple has **removed or restricted** many automation triggers:
- ❌ "When iPhone starts up" — not available
- ❌ "When app closes" — not available  
- ❌ "Periodic timer" — not available
- ⚠️ "When WiFi connects" — available but may not work reliably

### What DOES Work

| Trigger | Available? | Notes |
|---------|------------|-------|
| **When charger connects** | ✅ Yes | Good for "always plugged in" setup |
| **When WiFi connects** | ⚠️ Sometimes | May not trigger reliably |
| **Time of day** | ✅ Yes | But only opens app, doesn't keep it alive |

---

## Recommended Setup (What Actually Works)

### Option A: Keep Phone Plugged In + Screen On (Most Reliable)

1. **Keep phone always charging**
2. **Settings → Display & Brightness → Auto-Lock → Never**
3. **Keep Spyder app in foreground**
4. ✅ App stays active, can respond to all commands

### Option B: Background Mode + Ping (Normal Use)

1. Open Spyder app, leave it **backgrounded** (don't force-kill)
2. Use **"Ping Device"** from dashboard to wake if needed
3. ⚠️ May stop responding if iOS kills it for memory

---

## iPhone Settings to Configure

### Location Services (Required)
**Settings → Privacy & Security → Location Services → Spyder**
- Select **"Always"**
- This helps keep the app alive via location monitoring

### Background App Refresh (Required)
**Settings → General → Background App Refresh**
- Toggle **ON** globally
- Ensure **Spyder** is enabled

### Notifications (Required)
**Settings → Notifications → Spyder**
- Toggle **"Allow Notifications"** ON
- This enables ping/wake functionality

### Low Power Mode (Disable)
**Settings → Battery**
- Keep **Low Power Mode** OFF
- This mode throttles background activity

### Auto-Lock (For Option A)
**Settings → Display & Brightness → Auto-Lock**
- Set to **"Never"** if phone is always plugged in

---

## Optional: Charger Automation

This opens Spyder when you plug in the phone (useful after restart):

### English

1. Open **Shortcuts** app → **Automation** tab
2. Tap **"+"** → **"Create Personal Automation"**
3. Tap **"Charger"** → **"Is Connected"** → **"Next"**
4. **"Add Action"** → search **"Open App"** → select **"Spyder"**
5. Tap **"Next"**
6. Turn **OFF** "Ask Before Running"
7. Tap **"Done"**

### Español

1. Abrir app **Atajos** → pestaña **Automatización**
2. Tocar **"+"** → **"Crear automatización personal"**
3. Tocar **"Cargador"** → **"Está conectado"** → **"Siguiente"**
4. **"Agregar acción"** → buscar **"Abrir app"** → seleccionar **"Spyder"**
5. Tocar **"Siguiente"**
6. **Desactivar** "Preguntar antes de ejecutar"
7. Tocar **"OK"**

---

## Troubleshooting

### App stops responding
- Open app manually on the phone
- Or use "Ping Device" from dashboard
- Check WiFi connection on the phone

### Ping doesn't wake the app
- App may have been force-killed
- Ask someone to open the app manually
- Check that notifications are enabled

### Recording doesn't upload
- Check WiFi connection
- Check available storage on phone
- Check R2 bucket configuration

---

## Summary

**For maximum reliability:**
1. Keep phone **plugged in**
2. Keep **screen on** (Auto-Lock: Never)
3. Keep **Spyder in foreground**
4. Use **Ping Device** if app becomes unresponsive
5. Ask someone to **manually open** app after phone restarts

**iOS limitations mean there's no way to automatically restart the app after force-kill or reboot.** The person with the phone must open it manually at least once.

---

*Last Updated: 2026-02-04*

---

## Automation 1: Re-open App After Phone Restart

This ensures Spyder launches automatically whenever the phone restarts (power outage, update, etc.).

### Step-by-Step

1. **Open the Shortcuts app** on iPhone
   - If you don't have it, download from App Store (it's free, made by Apple)

2. **Go to Automation tab**
   - Tap "Automation" at the bottom of the screen

3. **Create new automation**
   - Tap the **"+"** button (top right)
   - Tap **"Create Personal Automation"**

4. **Select trigger**
   - Scroll down and tap **"When iPhone Starts Up"** (under Device section)
   - Tap **"Next"**

5. **Add action**
   - Tap **"Add Action"**
   - Search for **"Open App"**
   - Tap **"Open App"**
   - Tap the blue **"App"** word
   - Search for and select **"Spyder"** (or "RemoteEye" depending on app name)
   - Tap **"Next"**

6. **Disable confirmations**
   - **Turn OFF** "Ask Before Running"
   - Confirm by tapping "Don't Ask"
   - Tap **"Done"**

### ✅ Result
Phone restarts → Spyder opens automatically → Reconnects to server

---

## Automation 2: Periodic Re-open (Every Few Hours)

This reopens the app periodically in case iOS killed it in the background.

### Step-by-Step

1. **Open Shortcuts app** → **Automation** tab

2. **Create new automation**
   - Tap **"+"** → **"Create Personal Automation"**

3. **Select trigger**
   - Tap **"Time of Day"**
   - Set time to **6:00 AM**
   - Under "Repeat", select **"Daily"**
   - Tap **"Next"**

4. **Add action**
   - Tap **"Add Action"**
   - Search for **"Open App"**
   - Tap **"Open App"**
   - Select **"Spyder"**
   - Tap **"Next"**

5. **Disable confirmations**
   - **Turn OFF** "Ask Before Running"
   - Tap "Don't Ask" to confirm
   - Tap **"Done"**

6. **Repeat for more times** (recommended)
   - Create the same automation for:
     - **12:00 PM** (noon)
     - **6:00 PM**
     - **12:00 AM** (midnight)
   
   This gives you 4 check-ins per day.

### ✅ Result
Every 6 hours → Spyder opens → Reconnects if it was closed

---

## Automation 3: Re-open When WiFi Reconnects

This ensures the app reconnects after internet outages or router restarts.

### Step-by-Step

1. **Open Shortcuts app** → **Automation** tab

2. **Create new automation**
   - Tap **"+"** → **"Create Personal Automation"**

3. **Select trigger**
   - Tap **"Wi-Fi"**
   - Tap **"Choose"** next to "Network"
   - Select your **home WiFi network** from the list
   - Make sure **"Connects"** is selected (not "Disconnects")
   - Tap **"Next"**

4. **Add action**
   - Tap **"Add Action"**
   - Search for **"Open App"**
   - Tap **"Open App"**
   - Select **"Spyder"**
   - Tap **"Next"**

5. **Disable confirmations**
   - **Turn OFF** "Ask Before Running"
   - Tap "Don't Ask" to confirm
   - Tap **"Done"**

### ✅ Result
WiFi drops and reconnects → Spyder opens → Re-establishes connection to server

---

## Automation 4: Disable Low Power Mode When Charging

Low Power Mode severely limits background activity. This ensures it's always off when the phone is plugged in.

### Step-by-Step

1. **Open Shortcuts app** → **Automation** tab

2. **Create new automation**
   - Tap **"+"** → **"Create Personal Automation"**

3. **Select trigger**
   - Tap **"Charger"**
   - Make sure **"Is Connected"** is selected
   - Tap **"Next"**

4. **Add action**
   - Tap **"Add Action"**
   - Search for **"Low Power"**
   - Tap **"Set Low Power Mode"**
   - Tap **"On"** to change it to **"Off"**
   - (It should read: "Turn Low Power Mode Off")
   - Tap **"Next"**

5. **Disable confirmations**
   - **Turn OFF** "Ask Before Running"
   - Tap "Don't Ask" to confirm
   - Tap **"Done"**

### ✅ Result
Phone plugged in → Low Power Mode disabled → Full background activity allowed

---

## Additional iPhone Settings

After setting up automations, also configure these settings:

### Location Services
**Settings → Privacy & Security → Location Services → Spyder**
- Select **"Always"**

### Background App Refresh
**Settings → General → Background App Refresh**
- Toggle **ON** globally
- Ensure **Spyder** is enabled in the list

### Notifications
**Settings → Notifications → Spyder**
- Toggle **"Allow Notifications"** ON

### Battery Settings
**Settings → Battery**
- Ensure **Low Power Mode** is OFF
- (Automation #4 handles this when charging)

### Auto-Lock (Optional)
If the phone is always plugged in:
**Settings → Display & Brightness → Auto-Lock**
- Set to **"Never"** (keeps screen on)
- Or leave at default if you want screen to sleep

---

## Verification Checklist

After setup, verify everything is working:

| Step | Test | Expected Result |
|------|------|-----------------|
| 1 | Restart phone | Spyder opens automatically |
| 2 | Force-close Spyder, wait 6 hours | Spyder reopens at scheduled time |
| 3 | Turn WiFi off, then on | Spyder opens when WiFi reconnects |
| 4 | Plug in charger with Low Power Mode on | Low Power Mode turns off |
| 5 | Check Spyder dashboard | Device shows as "Online" |

---

## Troubleshooting

### Automation doesn't run
- Ensure "Ask Before Running" is OFF
- Check that automation is enabled (toggle on right side)
- Restart iPhone and try again

### Spyder doesn't reconnect
- Check WiFi network name is correct in automation
- Verify Spyder has "Always" location permission
- Check server is running and accessible

### Low Power Mode keeps turning on
- Create additional automation: When charger disconnects → Wait 1 minute → Turn Low Power Mode Off
- Or manually ensure it stays off

### App still gets killed
- This is normal iOS behavior for terminated apps
- The periodic automation (every 6 hours) handles this
- Consider keeping phone plugged in with screen on for critical monitoring

---

## Summary

With these 4 automations, your Spyder phone will:

1. ✅ Restart the app after phone reboots
2. ✅ Reopen the app every 6 hours
3. ✅ Reconnect when WiFi comes back
4. ✅ Stay at full performance when charging

**Perfect for leaving a phone as a dedicated remote monitoring device!**

---

*Last Updated: 2026-02-04*

---

# 🇪🇸 Guía en Español — Automatizaciones de iPhone

> **Caso de uso:** Dejar el teléfono como dispositivo de monitoreo dedicado (ej: con un familiar en otro país).
> 
> Estas automatizaciones aseguran que la app Spyder se mantenga funcionando y se reconecte automáticamente.

---

## Resumen

| # | Automatización | Propósito |
|---|----------------|-----------|
| 1 | Reabrir al reiniciar | La app se abre automáticamente después de reiniciar el teléfono |
| 2 | Reapertura periódica | La app se reabre cada pocas horas si fue cerrada |
| 3 | Reabrir al reconectar WiFi | La app se reconecta cuando vuelve el internet |
| 4 | Desactivar Modo Ahorro | Evita que iOS limite la actividad en segundo plano |

---

## Requisitos Previos

- iPhone con iOS 14 o posterior
- App Spyder instalada y emparejada
- Conocer el nombre de tu red WiFi (para Automatización #3)

---

## Automatización 1: Reabrir App al Reiniciar el Teléfono

Esto asegura que Spyder se abra automáticamente cuando el teléfono se reinicie.

### Paso a Paso

1. **Abrir la app Atajos** en el iPhone
   - Si no la tienes, descárgala del App Store (es gratis, hecha por Apple)

2. **Ir a la pestaña Automatización**
   - Toca "Automatización" en la parte inferior de la pantalla

3. **Crear nueva automatización**
   - Toca el botón **"+"** (arriba a la derecha)
   - Toca **"Crear automatización personal"**

4. **Seleccionar activador**
   - Desplázate hacia abajo y toca **"Al encender el iPhone"** (en la sección Dispositivo)
   - Toca **"Siguiente"**

5. **Agregar acción**
   - Toca **"Agregar acción"**
   - Busca **"Abrir app"**
   - Toca **"Abrir app"**
   - Toca la palabra azul **"App"**
   - Busca y selecciona **"Spyder"** (o "RemoteEye")
   - Toca **"Siguiente"**

6. **Desactivar confirmaciones**
   - **Desactiva** "Preguntar antes de ejecutar"
   - Confirma tocando "No preguntar"
   - Toca **"OK"**

### ✅ Resultado
El teléfono se reinicia → Spyder se abre automáticamente → Se reconecta al servidor

---

## Automatización 2: Reapertura Periódica (Cada Pocas Horas)

Esto reabre la app periódicamente en caso de que iOS la haya cerrado en segundo plano.

### Paso a Paso

1. **Abrir app Atajos** → pestaña **Automatización**

2. **Crear nueva automatización**
   - Toca **"+"** → **"Crear automatización personal"**

3. **Seleccionar activador**
   - Toca **"Momento del día"**
   - Establece la hora a **6:00 AM**
   - En "Repetir", selecciona **"Diariamente"**
   - Toca **"Siguiente"**

4. **Agregar acción**
   - Toca **"Agregar acción"**
   - Busca **"Abrir app"**
   - Toca **"Abrir app"**
   - Selecciona **"Spyder"**
   - Toca **"Siguiente"**

5. **Desactivar confirmaciones**
   - **Desactiva** "Preguntar antes de ejecutar"
   - Toca "No preguntar" para confirmar
   - Toca **"OK"**

6. **Repetir para más horarios** (recomendado)
   - Crea la misma automatización para:
     - **12:00 PM** (mediodía)
     - **6:00 PM**
     - **12:00 AM** (medianoche)
   
   Esto te da 4 verificaciones por día.

### ✅ Resultado
Cada 6 horas → Spyder se abre → Se reconecta si estaba cerrada

---

## Automatización 3: Reabrir al Reconectar WiFi

Esto asegura que la app se reconecte después de cortes de internet o reinicios del router.

### Paso a Paso

1. **Abrir app Atajos** → pestaña **Automatización**

2. **Crear nueva automatización**
   - Toca **"+"** → **"Crear automatización personal"**

3. **Seleccionar activador**
   - Toca **"Wi-Fi"**
   - Toca **"Elegir"** junto a "Red"
   - Selecciona tu **red WiFi de casa** de la lista
   - Asegúrate de que **"Se conecta"** esté seleccionado (no "Se desconecta")
   - Toca **"Siguiente"**

4. **Agregar acción**
   - Toca **"Agregar acción"**
   - Busca **"Abrir app"**
   - Toca **"Abrir app"**
   - Selecciona **"Spyder"**
   - Toca **"Siguiente"**

5. **Desactivar confirmaciones**
   - **Desactiva** "Preguntar antes de ejecutar"
   - Toca "No preguntar" para confirmar
   - Toca **"OK"**

### ✅ Resultado
WiFi se cae y reconecta → Spyder se abre → Restablece conexión con el servidor

---

## Automatización 4: Desactivar Modo Ahorro de Batería al Cargar

El Modo de Bajo Consumo limita severamente la actividad en segundo plano. Esto asegura que siempre esté desactivado cuando el teléfono está enchufado.

### Paso a Paso

1. **Abrir app Atajos** → pestaña **Automatización**

2. **Crear nueva automatización**
   - Toca **"+"** → **"Crear automatización personal"**

3. **Seleccionar activador**
   - Toca **"Cargador"**
   - Asegúrate de que **"Está conectado"** esté seleccionado
   - Toca **"Siguiente"**

4. **Agregar acción**
   - Toca **"Agregar acción"**
   - Busca **"Bajo consumo"** o **"Modo de bajo consumo"**
   - Toca **"Definir modo de bajo consumo"**
   - Toca **"Activado"** para cambiarlo a **"Desactivado"**
   - (Debe decir: "Desactivar modo de bajo consumo")
   - Toca **"Siguiente"**

5. **Desactivar confirmaciones**
   - **Desactiva** "Preguntar antes de ejecutar"
   - Toca "No preguntar" para confirmar
   - Toca **"OK"**

### ✅ Resultado
Teléfono enchufado → Modo Ahorro desactivado → Actividad en segundo plano completa permitida

---

## Ajustes Adicionales del iPhone

Después de configurar las automatizaciones, también configura estos ajustes:

### Servicios de Ubicación
**Ajustes → Privacidad y seguridad → Localización → Spyder**
- Selecciona **"Siempre"**

### Actualización en Segundo Plano
**Ajustes → General → Actualización en segundo plano**
- Activa **globalmente**
- Asegúrate de que **Spyder** esté activada en la lista

### Notificaciones
**Ajustes → Notificaciones → Spyder**
- Activa **"Permitir notificaciones"**

### Ajustes de Batería
**Ajustes → Batería**
- Asegúrate de que **Modo de bajo consumo** esté DESACTIVADO

### Bloqueo Automático (Opcional)
Si el teléfono siempre estará enchufado:
**Ajustes → Pantalla y brillo → Bloqueo automático**
- Establecer a **"Nunca"** (mantiene la pantalla encendida)

---

## Lista de Verificación

Después de la configuración, verifica que todo funcione:

| Paso | Prueba | Resultado Esperado |
|------|--------|-------------------|
| 1 | Reiniciar teléfono | Spyder se abre automáticamente |
| 2 | Forzar cierre de Spyder, esperar 6 horas | Spyder se reabre en el horario programado |
| 3 | Apagar WiFi, luego encender | Spyder se abre cuando WiFi reconecta |
| 4 | Enchufar cargador con Modo Ahorro activado | Modo Ahorro se desactiva |
| 5 | Revisar panel de Spyder | Dispositivo muestra "En línea" |

---

## Solución de Problemas

### La automatización no se ejecuta
- Asegúrate de que "Preguntar antes de ejecutar" esté DESACTIVADO
- Verifica que la automatización esté habilitada (interruptor a la derecha)
- Reinicia el iPhone e intenta de nuevo

### Spyder no se reconecta
- Verifica que el nombre de la red WiFi sea correcto en la automatización
- Verifica que Spyder tenga permiso de ubicación "Siempre"
- Verifica que el servidor esté funcionando y accesible

### El Modo Ahorro sigue activándose
- Crea automatización adicional: Cuando cargador se desconecta → Esperar 1 minuto → Desactivar Modo Ahorro
- O manualmente asegúrate de que permanezca desactivado

---

## Resumen

Con estas 4 automatizaciones, tu teléfono Spyder:

1. ✅ Reiniciará la app después de que el teléfono se reinicie
2. ✅ Reabrirá la app cada 6 horas
3. ✅ Se reconectará cuando vuelva el WiFi
4. ✅ Se mantendrá a máximo rendimiento cuando esté cargando

**¡Perfecto para dejar un teléfono como dispositivo de monitoreo remoto dedicado!**
