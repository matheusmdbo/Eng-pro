/**
 * /app/conveyor/page.tsx  — Server Component wrapper
 *
 * Serve como entry-point da rota /conveyor. Renderiza o título e metadados
 * no servidor, e delega a UI interativa para o Client Component abaixo.
 * Esse padrão é o recomendado no Next.js 13+ App Router para manter o
 * streaming e o SSR funcionando enquanto o estado fica no cliente.
 */

import type { Metadata } from 'next';
import { ConveyorCalculatorClient } from './ConveyorCalculatorClient';

export const metadata: Metadata = {
  title: 'Transportador de Correia — CEMA 7ª Ed.',
  description:
    'Dimensionamento de potência de transportadores de correia pelo Método Histórico CEMA 7ª Edição. Entradas métricas, resultados em SI e imperial.',
};

export default function ConveyorPage() {
  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <ConveyorCalculatorClient />
    </main>
  );
}
