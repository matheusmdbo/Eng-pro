'use client';

/**
 * ConveyorCalculatorClient
 *
 * Client Component raiz do módulo de transportador de correia.
 * Usa o hook useConveyorCalculator para state management e chama
 * a engine CEMA 7 a cada mudança de input.
 *
 * Esta é a Rodada 1 da UI — apresenta todos os resultados principais
 * em cards e tabelas, usando Tailwind. Os painéis de visualização SVG
 * (esquemático 2D, cross-section, fill curve, profile editor) serão
 * adicionados na Rodada 2.
 */

import { useConveyorCalculator } from '@/src/hooks/useConveyorCalculator';
import { IDLER_FAMILIES, CS_MATERIALS, type ConveyorInputs } from '@engine/cema7';

// ─── Helpers de formatação ────────────────────────────────────────────────────

const fmt = (v: number, d = 2): string =>
  Number.isFinite(v) ? v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';

const fmtKn = (lbf: number): string =>
  fmt((lbf * 4.4482216152605) / 1000, 2);

// ─── Primitivos de UI ────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  sub,
  highlight = false,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        highlight
          ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-600'
          : 'border-zinc-200 bg-white dark:bg-zinc-900 dark:border-zinc-700'
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-100">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{sub}</p>}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="mb-3 text-xs font-semibold uppercase tracking-widest text-amber-700 dark:text-amber-400">
      {children}
    </h4>
  );
}

function InputRow({
  label,
  unit,
  helper,
  children,
}: {
  label: string;
  unit?: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-2">
      <div className="flex items-center gap-2">
        <label className="w-52 shrink-0 text-sm text-zinc-700 dark:text-zinc-300">{label}</label>
        <div className="flex items-center gap-1.5 flex-1">
          {children}
          {unit && (
            <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
              {unit}
            </span>
          )}
        </div>
      </div>
      {helper && (
        <p className="mt-1 pl-52 text-xs text-zinc-400 dark:text-zinc-500">{helper}</p>
      )}
    </div>
  );
}

const inputClass =
  'w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-400';

const selectClass =
  'w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-400';

// ─── Componente principal ─────────────────────────────────────────────────────

export function ConveyorCalculatorClient() {
  const { inputs, validation, results, setField, reset, loadSample } =
    useConveyorCalculator();

  const set = <K extends keyof ConveyorInputs>(field: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const el = e.target;
      const raw =
        el.type === 'checkbox'
          ? (el as HTMLInputElement).checked
          : el.type === 'number'
          ? parseFloat(el.value) || 0
          : el.value;
      setField(field, raw as ConveyorInputs[K]);
    };

  const issues =
    !validation.success
      ? Object.fromEntries(validation.issues.map((i) => [i.field, i.message]))
      : {};

  return (
    <div className="mx-auto max-w-screen-2xl px-4 py-6">
      {/* ── Cabeçalho ── */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-amber-400 px-6 py-5 shadow">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-900/70">
            Bulk conveyor worksheet
          </p>
          <h1 className="text-2xl font-extrabold text-zinc-900">
            CEMA 7ª Edição — Dimensionamento de Potência
          </h1>
          <p className="text-sm text-amber-900/70">
            Método Histórico · Entradas métricas · Validado contra AGH/CEMA e Rulmeca
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadSample}
            className="rounded-lg bg-white/60 px-4 py-2 text-sm font-medium hover:bg-white/80 transition"
          >
            Carregar exemplo
          </button>
          <button
            onClick={reset}
            className="rounded-lg bg-white/60 px-4 py-2 text-sm font-medium hover:bg-white/80 transition"
          >
            Resetar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
        {/* ── Coluna de inputs ── */}
        <aside className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6 shadow-sm">
          <h2 className="mb-4 text-base font-bold text-zinc-800 dark:text-zinc-100">
            Dados de entrada
          </h2>

          {/* Projeto */}
          <SectionHeading>Projeto</SectionHeading>
          <InputRow label="Nome do projeto">
            <input className={inputClass} value={inputs.projectName} onChange={set('projectName')} />
          </InputRow>
          <InputRow label="Tag do transportador">
            <input className={inputClass} value={inputs.conveyorTag} onChange={set('conveyorTag')} />
          </InputRow>

          {/* Duty & Geometry */}
          <SectionHeading>Serviço &amp; Geometria</SectionHeading>
          <InputRow label="Capacidade" unit="t/h">
            <input className={inputClass} type="number" step="1" min="0" value={inputs.capacityTph} onChange={set('capacityTph')} />
          </InputRow>
          {issues.capacityTph && <p className="mb-1 text-xs text-red-500">{issues.capacityTph}</p>}

          <InputRow label="Velocidade da correia" unit="m/s">
            <input className={inputClass} type="number" step="0.01" min="0" value={inputs.beltSpeed} onChange={set('beltSpeed')} />
          </InputRow>
          <InputRow label="Vel. entrada de material" unit="m/s" helper="Componente na direção da correia (Vo em CEMA)">
            <input className={inputClass} type="number" step="0.01" min="0" value={inputs.materialEntrySpeed} onChange={set('materialEntrySpeed')} />
          </InputRow>
          <InputRow label="Comprimento CTC" unit="m">
            <input className={inputClass} type="number" step="1" min="0" value={inputs.centerLengthM} onChange={set('centerLengthM')} />
          </InputRow>
          <InputRow label="Elevação (+) / Queda (-)" unit="m">
            <input className={inputClass} type="number" step="0.1" value={inputs.liftM} onChange={set('liftM')} />
          </InputRow>

          {/* Correia & Carga */}
          <SectionHeading>Correia &amp; Carga</SectionHeading>
          <InputRow label="Largura da correia" unit="mm">
            <input className={inputClass} type="number" step="25" min="300" value={inputs.beltWidthMm} onChange={set('beltWidthMm')} />
          </InputRow>
          <InputRow label="Densidade aparente" unit="t/m³">
            <input className={inputClass} type="number" step="0.01" min="0.1" value={inputs.bulkDensity} onChange={set('bulkDensity')} />
          </InputRow>
          <InputRow label="Ângulo de calha" unit="°">
            <select className={selectClass} value={inputs.troughAngleDeg} onChange={set('troughAngleDeg')}>
              {[0, 15, 20, 30, 35, 45].map((a) => (
                <option key={a} value={a}>{a}°</option>
              ))}
            </select>
          </InputRow>
          <InputRow label="Ângulo de repouso" unit="°">
            <input className={inputClass} type="number" step="1" min="0" max="45" value={inputs.surchargeAngleDeg} onChange={set('surchargeAngleDeg')} />
          </InputRow>
          <InputRow label="Família de idler (Ai)">
            <select className={selectClass} value={inputs.idlerFamily} onChange={set('idlerFamily')}>
              {IDLER_FAMILIES.map((f) => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>
          </InputRow>
          <InputRow label="Espaçamento de idler" unit="m">
            <input className={inputClass} type="number" step="0.05" min="0.3" value={inputs.idlerSpacingM} onChange={set('idlerSpacingM')} />
          </InputRow>
          <div className="flex items-center gap-2 py-1.5">
            <input type="checkbox" id="estBeltW" checked={inputs.useEstimatedBeltWeight} onChange={set('useEstimatedBeltWeight')} className="h-4 w-4 accent-amber-500" />
            <label htmlFor="estBeltW" className="text-sm text-zinc-700 dark:text-zinc-300">Usar estimativa CEMA de peso de correia</label>
          </div>
          <div className="flex items-center gap-2 py-1.5">
            <input type="checkbox" id="steelCord" checked={inputs.steelCord} onChange={set('steelCord')} className="h-4 w-4 accent-amber-500" />
            <label htmlFor="steelCord" className="text-sm text-zinc-700 dark:text-zinc-300">Correia de cabos de aço (+50% estimativa)</label>
          </div>
          {!inputs.useEstimatedBeltWeight && (
            <InputRow label="Peso da correia" unit="kg/m">
              <input className={inputClass} type="number" step="0.1" min="0" value={inputs.beltWeightKgPm} onChange={set('beltWeightKgPm')} />
            </InputRow>
          )}

          {/* Fatores CEMA */}
          <SectionHeading>Fatores CEMA</SectionHeading>
          <InputRow label="Temperatura ambiente" unit="°C" helper="Kt calculado automaticamente pela curva CEMA">
            <input className={inputClass} type="number" step="1" value={inputs.ambientTempC} onChange={set('ambientTempC')} />
          </InputRow>
          <div className="flex items-center gap-2 py-1.5">
            <input type="checkbox" id="ovKt" checked={inputs.overrideKt} onChange={set('overrideKt')} className="h-4 w-4 accent-amber-500" />
            <label htmlFor="ovKt" className="text-sm text-zinc-700 dark:text-zinc-300">Override Kt manual</label>
          </div>
          {inputs.overrideKt && (
            <InputRow label="Kt manual" unit="—">
              <input className={inputClass} type="number" step="0.01" min="1" value={inputs.kt} onChange={set('kt')} />
            </InputRow>
          )}
          <div className="flex items-center gap-2 py-1.5">
            <input type="checkbox" id="ovKy" checked={inputs.overrideKy} onChange={set('overrideKy')} className="h-4 w-4 accent-amber-500" />
            <label htmlFor="ovKy" className="text-sm text-zinc-700 dark:text-zinc-300">Override Ky manual</label>
          </div>
          {inputs.overrideKy && (
            <InputRow label="Ky manual" unit="—">
              <input className={inputClass} type="number" step="0.0001" min="0" value={inputs.ky} onChange={set('ky')} />
            </InputRow>
          )}
          <div className="flex items-center gap-2 py-1.5">
            <input type="checkbox" id="ovKx" checked={inputs.overrideKx} onChange={set('overrideKx')} className="h-4 w-4 accent-amber-500" />
            <label htmlFor="ovKx" className="text-sm text-zinc-700 dark:text-zinc-300">Override Kx manual</label>
          </div>
          {inputs.overrideKx && (
            <InputRow label="Kx manual" unit="lb/ft²">
              <input className={inputClass} type="number" step="0.001" min="0" value={inputs.manualKx} onChange={set('manualKx')} />
            </InputRow>
          )}

          {/* Roldanas & Acessórios */}
          <SectionHeading>Roldanas &amp; Acessórios</SectionHeading>
          <InputRow label="Roldanas lado tenso" unit="qtd">
            <input className={inputClass} type="number" step="1" min="0" value={inputs.tightPulleys} onChange={set('tightPulleys')} />
          </InputRow>
          <InputRow label="Roldanas lado frouxo" unit="qtd">
            <input className={inputClass} type="number" step="1" min="0" value={inputs.slackPulleys} onChange={set('slackPulleys')} />
          </InputRow>
          <InputRow label="Outras roldanas" unit="qtd">
            <input className={inputClass} type="number" step="1" min="0" value={inputs.otherPulleys} onChange={set('otherPulleys')} />
          </InputRow>
          <InputRow label="Raspadores em contato" unit="qtd">
            <input className={inputClass} type="number" step="1" min="0" value={inputs.cleanerBlades} onChange={set('cleanerBlades')} />
          </InputRow>
          <InputRow label="Material (Cs)" unit="">
            <select className={selectClass} value={inputs.csMaterialId} onChange={set('csMaterialId')}>
              {CS_MATERIALS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </InputRow>
          <InputRow label="Comprimento de saia" unit="m">
            <input className={inputClass} type="number" step="0.1" min="0" value={inputs.skirtLengthM} onChange={set('skirtLengthM')} />
          </InputRow>
          <InputRow label="Profundidade material/saia" unit="mm">
            <input className={inputClass} type="number" step="5" min="0" value={inputs.skirtDepthMm} onChange={set('skirtDepthMm')} />
          </InputRow>

          {/* Drive */}
          <SectionHeading>Acionamento</SectionHeading>
          <InputRow label="Config. de acionamento">
            <select className={selectClass} value={inputs.driveConfig} onChange={set('driveConfig')}>
              <option value="singleHead">Único — cabeça</option>
              <option value="singleTail">Único — cauda</option>
              <option value="dualHeadTail">Duplo — cabeça + cauda</option>
              <option value="intermediate">Intermediário (booster)</option>
            </select>
          </InputRow>
          <InputRow label="Eficiência do acionamento" unit="%">
            <input className={inputClass} type="number" step="0.5" min="50" max="100" value={inputs.driveEfficiencyPct} onChange={set('driveEfficiencyPct')} />
          </InputRow>
          <InputRow label="Fator de serviço" unit="×">
            <input className={inputClass} type="number" step="0.05" min="1" value={inputs.serviceFactor} onChange={set('serviceFactor')} />
          </InputRow>
          <InputRow label="Ângulo de abraçamento" unit="°" helper="Para cálculo automático de Cw = 1/(e^(μθ)−1)">
            <input className={inputClass} type="number" step="5" min="0" max="540" value={inputs.wrapAngleDeg} onChange={set('wrapAngleDeg')} />
          </InputRow>
          <InputRow label="Coef. de atrito de revestimento" unit="μ">
            <input className={inputClass} type="number" step="0.01" min="0.1" max="0.8" value={inputs.laggingFriction} onChange={set('laggingFriction')} />
          </InputRow>
        </aside>

        {/* ── Coluna de resultados ── */}
        <section className="space-y-6">
          {/* Erros de validação */}
          {!validation.success && (
            <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 p-4">
              <p className="mb-2 text-sm font-semibold text-red-700 dark:text-red-400">
                Corrija os campos antes de calcular:
              </p>
              <ul className="list-disc pl-4 space-y-1">
                {validation.issues.map((i) => (
                  <li key={i.field} className="text-xs text-red-600 dark:text-red-400">
                    <span className="font-medium">{i.field}:</span> {i.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {results && (
            <>
              {/* Cards principais */}
              <div>
                <h3 className="mb-3 text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                  {results.inputs.projectName} · {results.inputs.conveyorTag} · {results.dutyMode === 'Motoring' ? '⬆ Motriz' : '⬇ Regenerativo'}
                </h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                  <MetricCard
                    highlight
                    label="Tensão efetiva Te"
                    value={`${fmtKn(results.teLbf)} kN`}
                    sub={`${fmt(results.teLbf, 0)} lbf`}
                  />
                  <MetricCard
                    highlight
                    label="Potência na correia"
                    value={`${fmt(results.beltKw, 1)} kW`}
                    sub={`${fmt(results.beltHp, 1)} HP`}
                  />
                  <MetricCard
                    highlight
                    label="Potência no motor"
                    value={`${fmt(results.motorKw, 1)} kW`}
                    sub={`c/ η=${results.inputs.driveEfficiencyPct}% · SF=${results.inputs.serviceFactor}×`}
                  />
                  <MetricCard
                    label="T1 (tensão máx.)"
                    value={`${fmtKn(results.t1Lbf)} kN`}
                    sub={`${fmt(results.t1Lbf, 0)} lbf`}
                  />
                  <MetricCard
                    label="T2 (tensão mín.)"
                    value={`${fmtKn(results.t2Lbf)} kN`}
                    sub={`Governa: ${results.governingSource === 'Sag' ? 'Flambagem' : 'Deslizamento'}`}
                  />
                  <MetricCard
                    label="Contrapeso aprox."
                    value={`${fmt((results.counterweightLbf * 4.4482216152605) / 9.80665 / 1000, 1)} t`}
                    sub={`${fmt(results.counterweightLbf, 0)} lbf`}
                  />
                  <MetricCard
                    label="Wm (carga mat.)"
                    value={`${fmt(results.wmKgPm, 1)} kg/m`}
                    sub={`${fmt(results.wmLbft, 2)} lb/ft`}
                  />
                  <MetricCard
                    label="Kx utilizado"
                    value={fmt(results.kxUsed, 4)}
                    sub={results.kxBasis === 'Auto' ? `Auto · Ai=${results.inputs.idlerFamily}` : 'Override manual'}
                  />
                  <MetricCard
                    label="Ky utilizado"
                    value={fmt(results.kyUsed, 4)}
                    sub={results.kyBasis}
                  />
                  <MetricCard
                    label="Kt utilizado"
                    value={fmt(results.ktUsed, 3)}
                    sub={results.ktBasis}
                  />
                  <MetricCard
                    label="Seção carregada"
                    value={`${fmt(results.occupiedAreaM2 * 10000, 1)} cm²`}
                    sub={`${fmt(results.fillAreaPct, 1)}% da área disponível CEMA`}
                  />
                  <MetricCard
                    label="Potência partida"
                    value={`${fmt(results.startupMotorKw, 1)} kW`}
                    sub="Com resistência de breakaway"
                  />
                </div>
              </div>

              {/* Tabela de componentes */}
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                  Decomposição de tensões — Método Histórico CEMA 7
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-100 dark:border-zinc-800 text-left text-xs text-zinc-500 uppercase">
                        <th className="pb-2 font-medium">Componente</th>
                        <th className="pb-2 font-medium text-right">Tensão (kN)</th>
                        <th className="pb-2 font-medium text-right">Tensão (lbf)</th>
                        <th className="pb-2 font-medium text-right">Potência (kW)</th>
                        <th className="pb-2 font-medium">Base</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                      {results.components.map((c) => (
                        <tr key={c.key} className={Math.abs(c.lbf) < 0.01 ? 'opacity-40' : ''}>
                          <td className="py-1.5 pr-4 font-mono text-xs text-zinc-800 dark:text-zinc-200">
                            {c.label}
                          </td>
                          <td className="py-1.5 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                            {fmtKn(c.lbf)}
                          </td>
                          <td className="py-1.5 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                            {fmt(c.lbf, 1)}
                          </td>
                          <td className="py-1.5 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                            {fmt(c.kw, 2)}
                          </td>
                          <td className="py-1.5 pl-4 text-xs text-zinc-400 dark:text-zinc-500">
                            {c.basis}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-amber-400 font-bold">
                        <td className="pt-2 text-zinc-900 dark:text-zinc-100">Te Total</td>
                        <td className="pt-2 text-right tabular-nums text-zinc-900 dark:text-zinc-100">
                          {fmtKn(results.teLbf)}
                        </td>
                        <td className="pt-2 text-right tabular-nums text-zinc-900 dark:text-zinc-100">
                          {fmt(results.teLbf, 1)}
                        </td>
                        <td className="pt-2 text-right tabular-nums text-zinc-900 dark:text-zinc-100">
                          {fmt(results.beltKw, 2)}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Curvas verticais */}
              {results.profile.curves.length > 0 && (
                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5 shadow-sm">
                  <h3 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                    Verificação de curvas verticais
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-100 dark:border-zinc-800 text-left text-xs text-zinc-500 uppercase">
                          <th className="pb-2 font-medium">Nó</th>
                          <th className="pb-2 font-medium">Tipo</th>
                          <th className="pb-2 font-medium text-right">R calculado (m)</th>
                          <th className="pb-2 font-medium text-right">R mínimo (m)</th>
                          <th className="pb-2 font-medium text-right">Margem</th>
                          <th className="pb-2 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                        {results.profile.curves.map((c) => {
                          const ok = c.marginPct >= 0;
                          return (
                            <tr key={c.nodeId}>
                              <td className="py-1.5 font-mono text-xs">{c.nodeId} @ {fmt(c.station, 0)} m</td>
                              <td className="py-1.5 capitalize text-xs">{c.kind === 'concave' ? 'Côncava' : 'Convexa'}</td>
                              <td className="py-1.5 text-right tabular-nums">{fmt(c.actualR, 0)}</td>
                              <td className="py-1.5 text-right tabular-nums">
                                {Number.isFinite(c.requiredR) ? fmt(c.requiredR, 0) : '—'}
                              </td>
                              <td className={`py-1.5 text-right tabular-nums font-medium ${ok ? 'text-emerald-600' : 'text-red-600'}`}>
                                {Number.isFinite(c.marginPct) ? `${fmt(c.marginPct, 1)}%` : '—'}
                              </td>
                              <td className="py-1.5">
                                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ok ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'}`}>
                                  {ok ? 'OK' : 'Verificar'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Rodapé de auditoria */}
              <div className="rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-4 text-xs text-zinc-500 dark:text-zinc-500">
                <p className="font-semibold mb-1">Base de cálculo — CEMA 7ª Edição, Método Histórico</p>
                <p>Te = Tx + Tyc + Tyr + Tym + Tm + Tp + Tam + Tac · Potência = Te × V / 33 000 (HP) → kW</p>
                <p className="mt-1">
                  Kt {results.ktBasis === 'Curve' ? `(curva CEMA, ${inputs.ambientTempC}°C)` : '(manual)'} ={' '}
                  {fmt(results.ktUsed, 3)} · Ky {results.kyBasis === 'Table' ? '(tabela CEMA 6.4-6.6)' : '(manual)'} ={' '}
                  {fmt(results.kyUsed, 4)} · Kx {results.kxBasis} = {fmt(results.kxUsed, 4)}
                </p>
                <p className="mt-1">
                  Cw ({results.cwBasis}) = {fmt(results.cwUsed, 4)} · T2 por {results.governingSource === 'Sag' ? 'flambagem' : 'deslizamento'}
                </p>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
