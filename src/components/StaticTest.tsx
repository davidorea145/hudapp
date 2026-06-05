import { useEffect, useRef, useState, useCallback } from "react";
import { HexStat, PowerGauge, HudFrame } from "@/components/Hud";

// Web Bluetooth - Nordic UART Service (common for ESP32 BLE serial)
const UART_SERVICE = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const UART_TX = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"; // notify (esp->app)
const UART_RX = "6e400002-b5a3-f393-e0a9-e50e24dcca9e"; // write (app->esp)

type CameraFacing = "environment" | "user";

interface Settings {
  countdownSeconds: number;
  autoIgnition: boolean;
  projectName: string;
  cameraFacing: CameraFacing;
}

const DEFAULT_SETTINGS: Settings = {
  countdownSeconds: 10,
  autoIgnition: false,
  projectName: "PROJETO 1",
  cameraFacing: "environment",
};

export default function StaticTest() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [menuOpen, setMenuOpen] = useState(false);
  const [calibOpen, setCalibOpen] = useState(false);
  const [calibWeight, setCalibWeight] = useState<number>(1000);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [power, setPower] = useState(0);
  const [maxPower, setMaxPower] = useState(0);
  const [burnTime, setBurnTime] = useState(0);
  const [btStatus, setBtStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [recording, setRecording] = useState(false);

  const rxCharRef = useRef<any>(null);
  const deviceRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const burnStartRef = useRef<number | null>(null);
  const lastPowerRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);

  const MAX_POWER = 10000;

  // start / restart camera when facing changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: settings.cameraFacing },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (e) {
        console.warn("camera failed", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [settings.cameraFacing]);

  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  // burn-time detection
  useEffect(() => {
    const prev = lastPowerRef.current;
    if (burnStartRef.current === null) {
      if (power - prev > 50 && power > 200) {
        burnStartRef.current = performance.now();
      }
    } else {
      const elapsed = (performance.now() - burnStartRef.current) / 1000;
      setBurnTime(elapsed);
      if (power < 100 && prev < 200) {
        burnStartRef.current = null;
      }
    }
    if (power > maxPower) setMaxPower(power);
    lastPowerRef.current = power;
  }, [power]);

  const handleNotify = useCallback((event: Event) => {
    const target = event.target as any;
    const value = target.value;
    if (!value) return;
    const text = new TextDecoder().decode(value);
    text.split(/[\r\n]+/).forEach((line) => {
      // P:1234 format - main data
      const pMatch = line.match(/P:(-?\d+(?:\.\d+)?)/);
      if (pMatch) {
        const n = parseFloat(pMatch[1]);
        if (!Number.isNaN(n)) setPower(n);
        return;
      }
      // fallback: any number
      const m = line.match(/^-?\d+(\.\d+)?$/);
      if (m) {
        const n = parseFloat(m[0]);
        if (!Number.isNaN(n)) setPower(n);
      }
    });
  }, []);

  const connectBT = async () => {
    if (!(navigator as any).bluetooth) {
      alert("Web Bluetooth não suportado. Use Chrome no Android.");
      return;
    }
    try {
      setBtStatus("connecting");
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [{ services: [UART_SERVICE] }, { namePrefix: "ESP" }],
        optionalServices: [UART_SERVICE],
      });
      deviceRef.current = device;
      device.addEventListener("gattserverdisconnected", () => setBtStatus("disconnected"));
      const server = await device.gatt!.connect();
      const service = await server.getPrimaryService(UART_SERVICE);
      const txChar = await service.getCharacteristic(UART_TX);
      const rxChar = await service.getCharacteristic(UART_RX);
      rxCharRef.current = rxChar;
      await txChar.startNotifications();
      txChar.addEventListener("characteristicvaluechanged", handleNotify);
      setBtStatus("connected");
    } catch (e) {
      console.warn(e);
      setBtStatus("disconnected");
    }
  };

  const sendBT = async (cmd: string) => {
    if (rxCharRef.current) {
      try {
        await rxCharRef.current.writeValue(new TextEncoder().encode(cmd + "\n"));
      } catch (e) {
        console.warn("BT write failed", e);
      }
    }
  };

  const startCountdown = () => {
    if (running) return;
    setMaxPower(0);
    setBurnTime(0);
    burnStartRef.current = null;
    setRunning(true);
    setCountdown(settings.countdownSeconds);
  };

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      setCountdown(null);
      if (settings.autoIgnition) sendBT("FIRE");
      setTimeout(() => setRunning(false), 1000);
      return;
    }
    const t = setTimeout(() => setCountdown((c) => (c ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, settings.autoIgnition]);

  const toggleFullscreen = async () => {
    try {
      const el: any = document.documentElement;
      if (!document.fullscreenElement) {
        await (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.());
        try { await (screen.orientation as any)?.lock?.("landscape"); } catch {}
      } else {
        await document.exitFullscreen();
      }
    } catch (e) { console.warn("fullscreen", e); }
  };

  const toggleRecord = async () => {
    if (recording) {
      mediaRecorderRef.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await (navigator.mediaDevices as any).getDisplayMedia({
        video: { frameRate: 30 },
        audio: true,
      });
      const mr = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9" });
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
      mr.onstop = () => {
        stream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
        const blob = new Blob(chunks, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `static-test-${Date.now()}.webm`;
        a.click();
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch (e) {
      console.warn(e);
    }
  };

  const startCalibration = async () => {
    // Two-step: TARE empty, then send known weight
    await sendBT("TARE");
    await new Promise((r) => setTimeout(r, 1500));
    await sendBT(`CAL:${calibWeight}`);
    await new Promise((r) => setTimeout(r, 800));
    await sendBT("SAVE");
    setCalibOpen(false);
  };

  return (
    <div className="absolute inset-0 bg-black overflow-hidden" style={{ width: 1920, height: 1080 }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`absolute inset-0 w-full h-full object-cover ${settings.cameraFacing === "user" ? "scale-x-[-1]" : ""}`}
      />
      <div className="absolute inset-0 bg-black/20" />

      <HudFrame />

      {/* Status bar */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-4 px-6 py-3 rounded-md bg-black/60 border border-hud-red/60" style={{ top: 16 }}>
        <span className={`rounded-full ${btStatus === "connected" ? "bg-green-400" : btStatus === "connecting" ? "bg-yellow-400 animate-pulse" : "bg-hud-red"}`} style={{ width: 18, height: 18 }} />
        <span className="hud-text text-hud-white" style={{ fontSize: 22, letterSpacing: "0.08em" }}>
          BT: {btStatus === "connected" ? "CONECTADO" : btStatus === "connecting" ? "CONECTANDO" : "DESCONECTADO"}
        </span>
        {recording && (
          <>
            <span className="rounded-full bg-hud-red animate-pulse" style={{ width: 18, height: 18 }} />
            <span className="hud-text text-hud-white" style={{ fontSize: 22 }}>REC</span>
          </>
        )}
      </div>

      {(running || countdown !== null) && (
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 hud-glow">
          <svg width="240" height="220" viewBox="0 0 120 110">
            <polygon points="60,8 112,100 8,100" fill="none" stroke="var(--hud-red)" strokeWidth="5" />
            <rect x="56" y="35" width="8" height="35" fill="var(--hud-red)" />
            <rect x="56" y="78" width="8" height="8" fill="var(--hud-red)" />
          </svg>
          {countdown !== null && (
            <div className="absolute inset-0 flex items-center justify-center hud-text font-bold text-hud-white tabular-nums" style={{ fontSize: 80 }}>
              {countdown}
            </div>
          )}
        </div>
      )}

      {!running && countdown === null && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-0 items-center">
          <button
            onClick={() => setMenuOpen(true)}
            className="hud-text relative bg-hud-red text-hud-white font-bold hud-glow active:scale-95 transition pointer-events-auto"
            style={{ clipPath: "polygon(8% 0, 100% 0, 92% 100%, 0 100%)", padding: "28px 72px", fontSize: 56 }}
          >
            MENU
          </button>
          <button
            onClick={startCountdown}
            className="hud-text relative bg-hud-red text-hud-white font-bold hud-glow active:scale-95 transition pointer-events-auto"
            style={{ clipPath: "polygon(8% 0, 100% 0, 92% 100%, 0 100%)", padding: "28px 72px", fontSize: 56, marginLeft: -24 }}
          >
            START
          </button>
        </div>
      )}

      <div className="absolute top-[60%] left-1/2 -translate-x-1/2 text-center">
        <div className="hud-text text-hud-white font-bold" style={{ fontSize: 32, letterSpacing: "0.15em" }}>{settings.projectName}</div>
        <div className="hud-text text-hud-white/80" style={{ fontSize: 22, letterSpacing: "0.2em" }}>STATIC TEST</div>
      </div>

      <div className="absolute inset-x-0 flex items-end justify-between gap-6" style={{ bottom: 24, paddingLeft: 32, paddingRight: 32 }}>
        <HexStat label="POTÊNCIA" value={Math.round(maxPower)} sublabel="G" side="left" />
        <div className="flex-1" style={{ paddingTop: 60 }}>
          <PowerGauge value={power} max={MAX_POWER} />
        </div>
        <HexStat label="TEMPO" value={burnTime.toFixed(1).padStart(4, "0")} sublabel="S" side="right" />
      </div>

      <div className="absolute flex flex-col gap-3 pointer-events-auto" style={{ top: 16, right: 16 }}>
        <button
          onClick={toggleFullscreen}
          className="hud-text bg-black/70 border border-hud-red text-hud-white active:scale-95"
          style={{ padding: "10px 18px", fontSize: 20 }}
        >
          TELA CHEIA
        </button>
        <button
          onClick={toggleRecord}
          className="hud-text bg-black/70 border border-hud-red text-hud-white active:scale-95"
          style={{ padding: "10px 18px", fontSize: 20 }}
        >
          {recording ? "STOP REC" : "REC TELA"}
        </button>
      </div>


      {/* Menu modal */}
      {menuOpen && (
        <div className="absolute inset-0 bg-black/90 z-50 flex items-center justify-center pointer-events-auto overflow-auto" style={{ padding: 40 }}>
          <div className="bg-card border-2 border-hud-red hud-glow" style={{ width: 1100, maxWidth: "95%", padding: 40 }}>
            <h2 className="hud-text text-hud-white font-bold text-center" style={{ fontSize: 56, marginBottom: 28, letterSpacing: "0.15em" }}>MENU</h2>

            <div className="grid grid-cols-2" style={{ gap: 28 }}>
              <label className="block" style={{ marginBottom: 0 }}>
                <span className="hud-text text-hud-white block" style={{ fontSize: 22, marginBottom: 10 }}>CONTAGEM REGRESSIVA (s)</span>
                <input
                  type="number"
                  min={1}
                  max={300}
                  value={settings.countdownSeconds}
                  onChange={(e) => setSettings({ ...settings, countdownSeconds: parseInt(e.target.value) || 1 })}
                  className="w-full bg-black border border-hud-red text-hud-white hud-text tabular-nums"
                  style={{ padding: "16px 20px", fontSize: 28 }}
                />
              </label>

              <label className="block">
                <span className="hud-text text-hud-white block" style={{ fontSize: 22, marginBottom: 10 }}>NOME DO PROJETO</span>
                <input
                  type="text"
                  value={settings.projectName}
                  onChange={(e) => setSettings({ ...settings, projectName: e.target.value.toUpperCase() })}
                  className="w-full bg-black border border-hud-red text-hud-white hud-text"
                  style={{ padding: "16px 20px", fontSize: 28 }}
                />
              </label>

              <div className="flex items-center justify-between gap-4" style={{ padding: "12px 0" }}>
                <span className="hud-text text-hud-white" style={{ fontSize: 22 }}>IGNIÇÃO AUTOMÁTICA</span>
                <button
                  onClick={() => setSettings({ ...settings, autoIgnition: !settings.autoIgnition })}
                  className={`rounded-full relative transition ${settings.autoIgnition ? "bg-hud-red" : "bg-muted"}`}
                  style={{ width: 80, height: 40 }}
                >
                  <span className={`absolute top-1 ${settings.autoIgnition ? "right-1" : "left-1"} bg-hud-white rounded-full transition`} style={{ width: 32, height: 32 }} />
                </button>
              </div>

              <div>
                <span className="hud-text text-hud-white block" style={{ fontSize: 22, marginBottom: 10 }}>CÂMERA</span>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setSettings({ ...settings, cameraFacing: "environment" })}
                    className={`hud-text border ${settings.cameraFacing === "environment" ? "bg-hud-red border-hud-red text-hud-white" : "border-hud-red/50 text-hud-white"}`}
                    style={{ padding: "14px 0", fontSize: 22 }}
                  >
                    TRASEIRA
                  </button>
                  <button
                    onClick={() => setSettings({ ...settings, cameraFacing: "user" })}
                    className={`hud-text border ${settings.cameraFacing === "user" ? "bg-hud-red border-hud-red text-hud-white" : "border-hud-red/50 text-hud-white"}`}
                    style={{ padding: "14px 0", fontSize: 22 }}
                  >
                    FRONTAL
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2" style={{ gap: 20, marginTop: 32 }}>
              <button
                onClick={connectBT}
                className="hud-text bg-hud-red text-hud-white font-bold hud-glow active:scale-95"
                style={{ padding: "18px 0", fontSize: 24 }}
              >
                {btStatus === "connected" ? "BLUETOOTH ✓" : "CONECTAR BLUETOOTH"}
              </button>
              <button
                onClick={() => sendBT("FIRE")}
                disabled={btStatus !== "connected"}
                className="hud-text border-2 border-hud-red text-hud-red active:scale-95 disabled:opacity-40 font-bold"
                style={{ padding: "18px 0", fontSize: 24 }}
              >
                IGNIÇÃO MANUAL
              </button>
              <button
                onClick={() => sendBT("TARE")}
                disabled={btStatus !== "connected"}
                className="hud-text border border-hud-red text-hud-white active:scale-95 disabled:opacity-40"
                style={{ padding: "16px 0", fontSize: 22 }}
              >
                ZERAR (TARE)
              </button>
              <button
                onClick={() => setCalibOpen(true)}
                disabled={btStatus !== "connected"}
                className="hud-text border border-hud-red text-hud-white active:scale-95 disabled:opacity-40"
                style={{ padding: "16px 0", fontSize: 22 }}
              >
                CALIBRAR BALANÇA
              </button>
            </div>

            <button
              onClick={() => setMenuOpen(false)}
              className="w-full hud-text bg-hud-white text-black font-bold active:scale-95"
              style={{ padding: "20px 0", fontSize: 28, marginTop: 28 }}
            >
              FECHAR
            </button>
          </div>
        </div>
      )}


      {/* Calibration modal */}
      {calibOpen && (
        <div className="absolute inset-0 bg-black/95 z-[60] flex items-center justify-center pointer-events-auto" style={{ padding: 40 }}>
          <div className="bg-card border-2 border-hud-red hud-glow" style={{ width: 900, maxWidth: "92%", padding: 40 }}>
            <h2 className="hud-text text-hud-white font-bold text-center" style={{ fontSize: 48, marginBottom: 24, letterSpacing: "0.15em" }}>CALIBRAÇÃO</h2>
            <p className="hud-text text-hud-white/80 leading-relaxed" style={{ fontSize: 22, marginBottom: 24 }}>
              1) RETIRE TODO PESO DA CÉLULA<br />
              2) INFORME O PESO CONHECIDO (g)<br />
              3) COLOQUE O PESO E APERTE CALIBRAR<br />
              VALOR SERÁ SALVO NA EEPROM
            </p>
            <label className="block" style={{ marginBottom: 24 }}>
              <span className="hud-text text-hud-white block" style={{ fontSize: 22, marginBottom: 10 }}>PESO CONHECIDO (g)</span>
              <input
                type="number"
                min={1}
                value={calibWeight}
                onChange={(e) => setCalibWeight(parseFloat(e.target.value) || 0)}
                className="w-full bg-black border border-hud-red text-hud-white hud-text tabular-nums"
                style={{ padding: "16px 20px", fontSize: 28 }}
              />
            </label>
            <button
              onClick={startCalibration}
              className="w-full hud-text bg-hud-red text-hud-white font-bold hud-glow active:scale-95"
              style={{ padding: "18px 0", fontSize: 28, marginBottom: 16 }}
            >
              EXECUTAR CALIBRAÇÃO
            </button>
            <button
              onClick={() => setCalibOpen(false)}
              className="w-full hud-text border border-hud-red text-hud-white active:scale-95"
              style={{ padding: "16px 0", fontSize: 24 }}
            >
              CANCELAR
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
