"use client";
import { ConveyorCalculatorClient } from "@/src/app/conveyor/ConveyorCalculatorClient";

export const CONFIG = {
  id: "conveyor2",
  name: "Transportador CEMA 7",
  subtitle: "Dimensionamento de Correia",
  icon: "⟰",
  color: "#d97706",
  price: 299.90,
  description: "Dimensionamento completo de transportadores de correia pelo Método Histórico CEMA 7ª Edição.",
  norma: "CEMA 7ª Ed. · Método Histórico",
};

export const GLOSSARY = [
  {
    cat: "ENTRADA",
    items: [
      { s: "Q", u: "t/h", d: "Capacidade de transporte" },
      { s: "V", u: "m/s", d: "Velocidade da correia" },
      { s: "L", u: "m", d: "Comprimento centro a centro" },
      { s: "H", u: "m", d: "Elevação (positivo) ou queda (negativo)" },
      { s: "B", u: "mm", d: "Largura da correia" },
      { s: "ρ", u: "t/m³", d: "Densidade aparente do material" },
      { s: "θ", u: "°", d: "Ângulo de calha dos idlers" },
    ],
  },
  {
    cat: "SAÍDA",
    items: [
      { s: "Te", u: "kN", d: "Tensão efetiva total na correia" },
      { s: "T1", u: "kN", d: "Tensão no lado tenso da correia" },
      { s: "T2", u: "kN", d: "Tensão no lado frouxo da correia" },
      { s: "P_correia", u: "kW", d: "Potência necessária na correia" },
      { s: "P_motor", u: "kW", d: "Potência no motor (com η e SF)" },
      { s: "Kt", u: "—", d: "Fator de temperatura CEMA" },
      { s: "Ky", u: "—", d: "Fator de resistência ao avanço" },
      { s: "Kx", u: "—", d: "Fator de resistência dos idlers" },
      { s: "Cw", u: "—", d: "Coeficiente de tensão de enrolamento" },
    ],
  },
];

export default function Conveyor2Mod({ onSave, user, UI }: any) {
  const { ModuleHeader, ModuleWrap } = UI;
  return (
    <ModuleWrap>
      <ModuleHeader
        icon="⟰"
        name="Transportador CEMA 7"
        norma="CEMA 7ª Ed. · Método Histórico"
        color="#d97706"
        user={user}
        moduleType="conveyor2"
        onSave={() => onSave({ type: "conveyor2" })}
        onLoad={() => {}}
      />
      <ConveyorCalculatorClient />
    </ModuleWrap>
  );
}
