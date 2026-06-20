// src/lib/supabase.js
// Cliente Supabase + hooks para CoopPlantão
// Instalar: npm install @supabase/supabase-js

import { createClient } from "@supabase/supabase-js";

// ── Variáveis de ambiente (.env) ──────────────────────────────
// VITE_SUPABASE_URL=https://xxxx.supabase.co
// VITE_SUPABASE_ANON_KEY=eyJhbGc...
const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  realtime: { params: { eventsPerSecond: 10 } },
});

// ─────────────────────────────────────────────────────────────
// COOPERATIVA — funções de gestão
// ─────────────────────────────────────────────────────────────

/** Busca dados da cooperativa pelo admin logado */
export async function getCooperativa() {
  const { data, error } = await supabase
    .from("cooperativas")
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

// ─────────────────────────────────────────────────────────────
// HOSPITAIS
// ─────────────────────────────────────────────────────────────

export async function getHospitais(cooperativaId) {
  const { data, error } = await supabase
    .from("hospitais")
    .select("*")
    .eq("cooperativa_id", cooperativaId)
    .eq("ativo", true)
    .order("nome");
  if (error) throw error;
  return data;
}

export async function upsertHospital(hospital) {
  const { data, error } = await supabase
    .from("hospitais")
    .upsert(hospital)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─────────────────────────────────────────────────────────────
// COOPERADOS — gestão pela cooperativa
// ─────────────────────────────────────────────────────────────

export async function getCooperados(cooperativaId) {
  const { data, error } = await supabase
    .from("cooperados")
    .select("*")
    .eq("cooperativa_id", cooperativaId)
    .order("nome");
  if (error) throw error;
  return data;
}

export async function upsertCooperado(cooperado) {
  const { data, error } = await supabase
    .from("cooperados")
    .upsert(cooperado, { onConflict: "cooperativa_id,crm" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function toggleAtivoCooperado(id, ativo) {
  const { error } = await supabase
    .from("cooperados")
    .update({ ativo })
    .eq("id", id);
  if (error) throw error;
}

/** Dispara sincronização via Edge Function */
export async function sincronizarCooperados(cooperativaId, apiUrl, apiToken) {
  const { data, error } = await supabase.functions.invoke("sync-cooperados", {
    body: {
      cooperativa_id: cooperativaId,
      api_url: apiUrl,
      api_token: apiToken,
    },
  });
  if (error) throw error;
  return data;
}

/** Busca últimos logs de sync */
export async function getSyncLogs(cooperativaId, limit = 10) {
  const { data, error } = await supabase
    .from("sync_log")
    .select("*")
    .eq("cooperativa_id", cooperativaId)
    .order("executado_em", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

// ─────────────────────────────────────────────────────────────
// VAGAS — CRUD
// ─────────────────────────────────────────────────────────────

/** Lista vagas da cooperativa com join em hospital */
export async function getVagas(cooperativaId, filtros = {}) {
  let query = supabase
    .from("vagas")
    .select(`
      *,
      hospital:hospitais(id, nome, sigla, bairro),
      cooperado_aprovado:cooperados!vagas_cooperado_aprovado_id_fkey(id, nome, crm)
    `)
    .eq("cooperativa_id", cooperativaId)
    .order("data_plantao", { ascending: true });

  if (filtros.especialidade) query = query.eq("especialidade", filtros.especialidade);
  if (filtros.status)        query = query.eq("status", filtros.status);
  if (filtros.dataInicio)    query = query.gte("data_plantao", filtros.dataInicio);
  if (filtros.dataFim)       query = query.lte("data_plantao", filtros.dataFim);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/** Vagas disponíveis para o cooperado (filtra pela especialidade dele) */
export async function getVagasCooperado(cooperativaId, especialidade) {
  const { data, error } = await supabase
    .from("vagas")
    .select(`
      *,
      hospital:hospitais(id, nome, sigla, bairro)
    `)
    .eq("cooperativa_id", cooperativaId)
    .eq("especialidade", especialidade)
    .eq("status", "aberta")
    .gte("data_plantao", new Date().toISOString().split("T")[0]) // só futuras
    .order("data_plantao");
  if (error) throw error;
  return data;
}

export async function criarVaga(vaga) {
  const { data, error } = await supabase
    .from("vagas")
    .insert(vaga)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function cancelarVaga(id) {
  const { error } = await supabase
    .from("vagas")
    .update({ status: "cancelada" })
    .eq("id", id);
  if (error) throw error;
}

// ─────────────────────────────────────────────────────────────
// CANDIDATURAS
// ─────────────────────────────────────────────────────────────

/** Candidaturas de uma vaga (para o painel da cooperativa) */
export async function getCandidaturasDaVaga(vagaId) {
  const { data, error } = await supabase
    .from("candidaturas")
    .select(`
      *,
      cooperado:cooperados(id, nome, crm, especialidade, telefone)
    `)
    .eq("vaga_id", vagaId)
    .order("criado_em");
  if (error) throw error;
  return data;
}

/** Candidaturas do cooperado logado (para a agenda) */
export async function getMinhaCandidaturas(cooperadoId) {
  const { data, error } = await supabase
    .from("candidaturas")
    .select(`
      *,
      vaga:vagas(
        *,
        hospital:hospitais(nome, sigla, bairro)
      )
    `)
    .eq("cooperado_id", cooperadoId)
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return data;
}

/** Cooperado se candidata a uma vaga */
export async function candidatar(vagaId, cooperadoId) {
  const { data, error } = await supabase
    .from("candidaturas")
    .insert({ vaga_id: vagaId, cooperado_id: cooperadoId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Cooperativa aprova um candidato */
export async function aprovarCandidatura(candidaturaId, avaliadorUserId) {
  const { error } = await supabase
    .from("candidaturas")
    .update({
      status: "aprovada",
      avaliado_por: avaliadorUserId,
      avaliado_em: new Date().toISOString(),
    })
    .eq("id", candidaturaId);
  // O trigger cuida de atualizar a vaga e recusar demais candidatos
  if (error) throw error;
}

// ─────────────────────────────────────────────────────────────
// NOTIFICAÇÕES
// ─────────────────────────────────────────────────────────────

export async function getNotificacoes(cooperadoId, apenasNaoLidas = false) {
  let query = supabase
    .from("notificacoes")
    .select("*")
    .eq("cooperado_id", cooperadoId)
    .order("criado_em", { ascending: false })
    .limit(50);

  if (apenasNaoLidas) query = query.eq("lida", false);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function marcarNotificacoesLidas(cooperadoId) {
  const { error } = await supabase
    .from("notificacoes")
    .update({ lida: true })
    .eq("cooperado_id", cooperadoId)
    .eq("lida", false);
  if (error) throw error;
}

// ─────────────────────────────────────────────────────────────
// LOGIN DO COOPERADO (CRM + CPF — sem senha)
// ─────────────────────────────────────────────────────────────

/**
 * Valida CRM + CPF na base de cooperados via RPC.
 * Retorna o registro do cooperado se válido.
 * Salva no sessionStorage para manter sessão.
 */
export async function loginCooperado(crm, cpf, cooperativaSigla = "CEMERGE") {
  const { data, error } = await supabase.rpc("login_cooperado", {
    p_crm: crm,
    p_cpf: cpf,
    p_cooperativa_sigla: cooperativaSigla,
  });

  if (error) throw error;

  const resultado = data?.[0];
  if (!resultado || resultado.erro) {
    throw new Error(resultado?.erro || "Credenciais inválidas");
  }

  // Salva sessão local (não usa auth.users para o cooperado — apenas validação)
  sessionStorage.setItem("cooperado_session", JSON.stringify(resultado));
  return resultado;
}

export function getCooperadoSession() {
  const s = sessionStorage.getItem("cooperado_session");
  return s ? JSON.parse(s) : null;
}

export function logoutCooperado() {
  sessionStorage.removeItem("cooperado_session");
}

// ─────────────────────────────────────────────────────────────
// REALTIME — subscriptions
// ─────────────────────────────────────────────────────────────

/**
 * Escuta novas vagas da especialidade do cooperado em tempo real.
 * Retorna a função de cleanup para usar no useEffect.
 */
export function subscribeNovasVagas(cooperativaId, especialidade, callback) {
  const channel = supabase
    .channel("vagas_realtime")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "vagas",
        filter: `cooperativa_id=eq.${cooperativaId}`,
      },
      (payload) => {
        if (payload.new.especialidade === especialidade) {
          callback(payload.new);
        }
      }
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

/**
 * Escuta notificações do cooperado em tempo real.
 */
export function subscribeNotificacoes(cooperadoId, callback) {
  const channel = supabase
    .channel(`notif_${cooperadoId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notificacoes",
        filter: `cooperado_id=eq.${cooperadoId}`,
      },
      (payload) => callback(payload.new)
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

/**
 * Escuta mudanças nas candidaturas (para o painel da cooperativa).
 */
export function subscribeCandidaturas(cooperativaId, callback) {
  const channel = supabase
    .channel("candidaturas_realtime")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "candidaturas",
      },
      callback
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}
