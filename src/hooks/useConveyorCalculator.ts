'use client';

/**
 * useConveyorCalculator
 *
 * Hook React que encapsula o state management do calculador CEMA 7.
 * - Mantém os inputs em useReducer (sem localStorage — delegado ao Supabase
 *   quando o módulo de persistência de projetos for implementado).
 * - Recalcula resultados de forma síncrona em cada mudança de input (a engine
 *   é pura e rápida o suficiente para rodar on-change sem debounce).
 * - Expõe helpers tipados para atualizar campos individuais, carregar sample,
 *   resetar defaults e limpar resultados.
 *
 * Uso:
 *   const { inputs, results, setField, loadSample, reset } = useConveyorCalculator();
 */

import { useReducer, useMemo } from 'react';
import {
  compute,
  validateConveyorInputs,
  DEFAULT_INPUTS,
  SAMPLE_INPUTS,
  type ConveyorInputs,
  type ConveyorResults,
  type ValidationResult,
} from '@engine/cema7';

// ─── Reducer ─────────────────────────────────────────────────────────────────

type Action =
  | { type: 'SET_FIELD'; field: keyof ConveyorInputs; value: ConveyorInputs[keyof ConveyorInputs] }
  | { type: 'SET_ALL'; inputs: ConveyorInputs }
  | { type: 'RESET' }
  | { type: 'LOAD_SAMPLE' };

function inputsReducer(state: ConveyorInputs, action: Action): ConveyorInputs {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value };
    case 'SET_ALL':
      return action.inputs;
    case 'RESET':
      return DEFAULT_INPUTS;
    case 'LOAD_SAMPLE':
      return SAMPLE_INPUTS;
    default:
      return state;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseConveyorCalculatorReturn {
  inputs: ConveyorInputs;
  validation: ValidationResult;
  results: ConveyorResults | null;
  /** Atualiza um campo individual dos inputs. */
  setField: <K extends keyof ConveyorInputs>(field: K, value: ConveyorInputs[K]) => void;
  /** Substitui todos os inputs de uma vez (ex.: carregar projeto salvo do Supabase). */
  setAll: (inputs: ConveyorInputs) => void;
  /** Reseta para os defaults. */
  reset: () => void;
  /** Carrega o exemplo Iron Ore Transfer. */
  loadSample: () => void;
}

export function useConveyorCalculator(
  initialInputs: ConveyorInputs = DEFAULT_INPUTS,
): UseConveyorCalculatorReturn {
  const [inputs, dispatch] = useReducer(inputsReducer, initialInputs);

  // Validação e cálculo são puros — recalculam só quando inputs mudam.
  const validation = useMemo(() => validateConveyorInputs(inputs), [inputs]);

  const results = useMemo<ConveyorResults | null>(() => {
    if (!validation.success) return null;
    try {
      return compute(validation.data);
    } catch {
      return null;
    }
  }, [validation]);

  const setField = <K extends keyof ConveyorInputs>(field: K, value: ConveyorInputs[K]) =>
    dispatch({ type: 'SET_FIELD', field, value });

  const setAll = (newInputs: ConveyorInputs) =>
    dispatch({ type: 'SET_ALL', inputs: newInputs });

  const reset = () => dispatch({ type: 'RESET' });
  const loadSample = () => dispatch({ type: 'LOAD_SAMPLE' });

  return { inputs, validation, results, setField, setAll, reset, loadSample };
}
