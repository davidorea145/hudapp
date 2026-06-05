import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import StaticTest from "@/components/StaticTest";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Static Test HUD" },
      { name: "description", content: "Bancada de teste estático com HUD, Bluetooth ESP32 e célula de carga HX711." },
      { name: "viewport", content: "width=1920, user-scalable=no" },
      { property: "og:title", content: "Static Test HUD" },
      { property: "og:description", content: "Bancada de teste estático com HUD, Bluetooth ESP32 e célula de carga HX711." },
    ],
  }),
  component: FixedStage,
});

const BASE_W = 1920;
const BASE_H = 1080;

function FixedStage() {
  const [sx, setSx] = useState(1);
  const [sy, setSy] = useState(1);
  const [vw, setVw] = useState(BASE_W);
  const [vh, setVh] = useState(BASE_H);

  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setVw(w);
      setVh(h);
      setSx(w / BASE_W);
      setSy(h / BASE_H);
    };
    compute();
    window.addEventListener("resize", compute);
    window.addEventListener("orientationchange", compute);
    // try lock landscape
    const anyScreen = screen as any;
    if (anyScreen?.orientation?.lock) {
      anyScreen.orientation.lock("landscape").catch(() => {});
    }
    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("orientationchange", compute);
    };
  }, []);

  const portrait = vh > vw;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#000",
        overflow: "hidden",
      }}
    >
      {portrait && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#000",
            color: "#fff",
            fontFamily: "Orbitron, sans-serif",
            textAlign: "center",
            padding: 24,
          }}
        >
          GIRE O CELULAR<br />PARA MODO PAISAGEM
        </div>
      )}
      <div
        style={{
          width: BASE_W,
          height: BASE_H,
          transform: `scale(${sx}, ${sy})`,
          transformOrigin: "top left",
          position: "absolute",
          top: 0,
          left: 0,
        }}
      >
        <StaticTest />
      </div>
    </div>
  );
}
