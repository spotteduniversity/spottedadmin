/**
 * Módulo de estados e municípios brasileiros para o formulário do painel.
 *
 * - `listStates()` retorna as 27 UFs estaticamente.
 * - `listCitiesByState(uf)` consulta a API oficial de Localidades do IBGE com cache em memória.
 */

export interface BrazilianState {
  uf: string;
  name: string;
}

export interface CityOption {
  ibgeCode: number;
  name: string;
  state: string;
}

export const BRAZILIAN_STATES: readonly BrazilianState[] = [
  { uf: "AC", name: "Acre" },
  { uf: "AL", name: "Alagoas" },
  { uf: "AP", name: "Amapá" },
  { uf: "AM", name: "Amazonas" },
  { uf: "BA", name: "Bahia" },
  { uf: "CE", name: "Ceará" },
  { uf: "DF", name: "Distrito Federal" },
  { uf: "ES", name: "Espírito Santo" },
  { uf: "GO", name: "Goiás" },
  { uf: "MA", name: "Maranhão" },
  { uf: "MT", name: "Mato Grosso" },
  { uf: "MS", name: "Mato Grosso do Sul" },
  { uf: "MG", name: "Minas Gerais" },
  { uf: "PA", name: "Pará" },
  { uf: "PB", name: "Paraíba" },
  { uf: "PR", name: "Paraná" },
  { uf: "PE", name: "Pernambuco" },
  { uf: "PI", name: "Piauí" },
  { uf: "RJ", name: "Rio de Janeiro" },
  { uf: "RN", name: "Rio Grande do Norte" },
  { uf: "RS", name: "Rio Grande do Sul" },
  { uf: "RO", name: "Rondônia" },
  { uf: "RR", name: "Roraima" },
  { uf: "SC", name: "Santa Catarina" },
  { uf: "SP", name: "São Paulo" },
  { uf: "SE", name: "Sergipe" },
  { uf: "TO", name: "Tocantins" },
] as const;

const STATE_BY_UF = new Map<string, BrazilianState>(
  BRAZILIAN_STATES.map((item) => [item.uf, item]),
);

const citiesCache = new Map<string, CityOption[]>();

/**
 * Normaliza acentos, caixa, apóstrofos, hífens e espaços duplicados.
 * Ex.: "Santa Bárbara d'Oeste" === "santa barbara d oeste".
 */
export function normalizeCityName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’`´-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeStateUf(value: string): string {
  return value.trim().toUpperCase();
}

export function listStates(): BrazilianState[] {
  return [...BRAZILIAN_STATES];
}

interface IbgeMunicipioRaw {
  id: number;
  nome: string;
}

export async function listCitiesByState(uf: string): Promise<CityOption[]> {
  const normalizedUf = normalizeStateUf(uf);
  if (!STATE_BY_UF.has(normalizedUf)) return [];

  const cached = citiesCache.get(normalizedUf);
  if (cached) return cached;

  const url = `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${encodeURIComponent(normalizedUf)}/municipios?orderBy=nome`;
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Falha ao carregar cidades do IBGE (HTTP ${response.status}).`);
  }

  const raw = (await response.json()) as IbgeMunicipioRaw[];
  const cities: CityOption[] = raw.map((item) => ({
    ibgeCode: Number(item.id),
    name: item.nome,
    state: normalizedUf,
  }));

  citiesCache.set(normalizedUf, cities);
  return cities;
}
