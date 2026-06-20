// supabase/functions/notificar-whatsapp/index.ts
// Edge Function — Gera magic token + envia mensagem WhatsApp via Evolution API
//
// Deploy: supabase functions deploy notificar-whatsapp
//
// Variáveis de ambiente necessárias:
//   EVOLUTION_API_URL     ex: https://evo.seudominio.com.br
//   EVOLUTION_API_KEY     chave global da Evolution API
//   EVOLUTION_INSTANCE    nome da instância (ex: cemerge)
//   APP_BASE_URL          ex: https://plantoes.cemerge.coop.br

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Tipos ────────────────────────────────────────────────────
interface NotificarPayload {
  tipo: "nova_vaga" | "candidatura_aprovada" | "lembrete_plantao" | "teste";
  vaga_id?: string;
  cooperado_ids?: string[];   // se vazio, notifica todos da especialidade
  cooperativa_id: string;
}

interface VagaCompleta {
  id: string;
  especialidade: string;
  turno: string;
  data_plantao: string;
  valor: number;
  descricao?: string;
  hospital: { nome: string; sigla: string; bairro: string };
}

// ─── Formatação ───────────────────────────────────────────────
const fmtData = (d: string) => {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
};

const fmtValor = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const normalizarTelefone = (tel: string): string => {
  // Remove tudo que não é dígito
  const digits = tel.replace(/\D/g, "");
  // Garante código do país
  if (digits.startsWith("55")) return digits;
  if (digits.startsWith("0")) return "55" + digits.slice(1);
  return "55" + digits;
};

// ─── Montagem das mensagens ───────────────────────────────────
function montarMensagemNovaVaga(vaga: VagaCompleta, magicLink: string): string {
  return (
    `🏥 *CoopPlantão — Nova Vaga Disponível!*\n\n` +
    `*Especialidade:* ${vaga.especialidade}\n` +
    `*Hospital:* ${vaga.hospital.nome}\n` +
    `*Bairro:* ${vaga.hospital.bairro}\n` +
    `*Data:* ${fmtData(vaga.data_plantao)}\n` +
    `*Turno:* ${vaga.turno}\n` +
    `*Valor:* ${fmtValor(vaga.valor)}\n` +
    (vaga.descricao ? `*Obs:* ${vaga.descricao}\n` : "") +
    `\n` +
    `👇 *Clique para se candidatar:*\n` +
    `${magicLink}\n\n` +
    `_Link válido por 24h · CEMERGE_`
  );
}

function montarMensagemAprovacao(vaga: VagaCompleta, magicLink: string): string {
  return (
    `✅ *CoopPlantão — Plantão Confirmado!*\n\n` +
    `Parabéns! Sua candidatura foi *aprovada*.\n\n` +
    `*Especialidade:* ${vaga.especialidade}\n` +
    `*Hospital:* ${vaga.hospital.nome}\n` +
    `*Data:* ${fmtData(vaga.data_plantao)}\n` +
    `*Turno:* ${vaga.turno}\n` +
    `*Valor:* ${fmtValor(vaga.valor)}\n\n` +
    `👇 *Acesse os detalhes:*\n` +
    `${magicLink}\n\n` +
    `_CEMERGE · Cooperativa de Médicos Emergencistas do Ceará_`
  );
}

function montarMensagemLembrete(vaga: VagaCompleta, magicLink: string): string {
  return (
    `⏰ *Lembrete de Plantão — Amanhã!*\n\n` +
    `Você tem um plantão confirmado para *amanhã*.\n\n` +
    `*Hospital:* ${vaga.hospital.nome}\n` +
    `*Turno:* ${vaga.turno}\n` +
    `*Especialidade:* ${vaga.especialidade}\n\n` +
    `👇 *Ver detalhes:*\n` +
    `${magicLink}\n\n` +
    `_Boa plantão! · CEMERGE_`
  );
}

// ─── Envio via Evolution API ──────────────────────────────────
async function enviarWhatsApp(
  telefone: string,
  mensagem: string,
  evolutionUrl: string,
  evolutionKey: string,
  instance: string
): Promise<{ sucesso: boolean; erro?: string }> {
  try {
    const url = `${evolutionUrl}/message/sendText/${instance}`;

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": evolutionKey,
      },
      body: JSON.stringify({
        number: telefone,
        textMessage: { text: mensagem },
        options: {
          delay: 1000,         // delay de 1s para não parecer spam
          presence: "composing", // mostra "digitando..." antes de enviar
        },
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      return { sucesso: false, erro: `Evolution API erro ${resp.status}: ${body}` };
    }

    return { sucesso: true };
  } catch (e: any) {
    return { sucesso: false, erro: e.message };
  }
}

// ─── Handler principal ────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const EVOLUTION_URL      = Deno.env.get("EVOLUTION_API_URL")!;
  const EVOLUTION_KEY      = Deno.env.get("EVOLUTION_API_KEY")!;
  const EVOLUTION_INSTANCE = Deno.env.get("EVOLUTION_INSTANCE")!;
  const APP_BASE_URL       = Deno.env.get("APP_BASE_URL")!;

  try {
    const payload: NotificarPayload = await req.json();
    const { tipo, vaga_id, cooperado_ids, cooperativa_id } = payload;

    // ── 1. Busca dados da vaga (se houver) ───────────────────
    let vaga: VagaCompleta | null = null;
    if (vaga_id) {
      const { data, error } = await supabase
        .from("vagas")
        .select("*, hospital:hospitais(nome, sigla, bairro)")
        .eq("id", vaga_id)
        .single();
      if (error) throw new Error(`Vaga não encontrada: ${error.message}`);
      vaga = data as VagaCompleta;
    }

    // ── 2. Define quais cooperados notificar ─────────────────
    let cooperados: { id: string; nome: string; telefone: string }[] = [];

    if (cooperado_ids && cooperado_ids.length > 0) {
      // Lista específica
      const { data } = await supabase
        .from("cooperados")
        .select("id, nome, telefone")
        .in("id", cooperado_ids)
        .eq("ativo", true);
      cooperados = data || [];
    } else if (vaga && tipo === "nova_vaga") {
      // Todos os cooperados ativos da mesma especialidade
      const { data } = await supabase
        .from("cooperados")
        .select("id, nome, telefone")
        .eq("cooperativa_id", cooperativa_id)
        .eq("especialidade", vaga.especialidade)
        .eq("ativo", true)
        .not("telefone", "is", null);
      cooperados = data || [];
    }

    if (cooperados.length === 0) {
      return new Response(
        JSON.stringify({ sucesso: false, erro: "Nenhum cooperado para notificar" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 3. Para cada cooperado: gera token + envia WhatsApp ──
    const resultados = await Promise.allSettled(
      cooperados.map(async (coop) => {
        if (!coop.telefone) return { id: coop.id, sucesso: false, erro: "Sem telefone" };

        // Gera magic token via função SQL
        const { data: tokenData, error: tokenErr } = await supabase.rpc(
          "gerar_magic_token",
          {
            p_cooperado_id:   coop.id,
            p_cooperativa_id: cooperativa_id,
            p_vaga_id:        vaga_id || null,
            p_horas_validade: 24,
          }
        );
        if (tokenErr) throw new Error(`Erro ao gerar token: ${tokenErr.message}`);

        const token = tokenData as string;

        // Monta magic link
        // Formato: https://app.cemerge.coop.br/acesso?t=TOKEN&v=VAGA_ID
        const params = new URLSearchParams({ t: token });
        if (vaga_id) params.set("v", vaga_id);
        const magicLink = `${APP_BASE_URL}/acesso?${params.toString()}`;

        // Monta mensagem conforme tipo
        let mensagem = "";
        if (tipo === "nova_vaga" && vaga) {
          mensagem = montarMensagemNovaVaga(vaga, magicLink);
        } else if (tipo === "candidatura_aprovada" && vaga) {
          mensagem = montarMensagemAprovacao(vaga, magicLink);
        } else if (tipo === "lembrete_plantao" && vaga) {
          mensagem = montarMensagemLembrete(vaga, magicLink);
        } else if (tipo === "teste") {
          mensagem = `🔧 *CoopPlantão · Teste de conexão*\n\nSistema funcionando!\n${magicLink}`;
        } else {
          throw new Error("Tipo de notificação inválido ou vaga ausente");
        }

        // Envia WhatsApp
        const tel = normalizarTelefone(coop.telefone);
        const resultado = await enviarWhatsApp(
          tel, mensagem, EVOLUTION_URL, EVOLUTION_KEY, EVOLUTION_INSTANCE
        );

        // Marca token como enviado
        if (resultado.sucesso) {
          await supabase
            .from("magic_tokens")
            .update({ enviado_whatsapp: true })
            .eq("token", token);

          // Registra também na tabela de notificações (para histórico no app)
          if (vaga) {
            await supabase.from("notificacoes").insert({
              cooperado_id: coop.id,
              tipo,
              titulo: tipo === "nova_vaga"
                ? `Nova vaga: ${vaga.especialidade}`
                : `Plantão confirmado — ${vaga.hospital.nome}`,
              mensagem: `${vaga.hospital.nome} · ${fmtData(vaga.data_plantao)} · ${vaga.turno}`,
              vaga_id: vaga_id || null,
            });
          }
        }

        return { id: coop.id, nome: coop.nome, telefone: tel, ...resultado };
      })
    );

    // ── 4. Consolida resultados ───────────────────────────────
    const sucessos = resultados.filter(
      (r) => r.status === "fulfilled" && (r.value as any).sucesso
    ).length;
    const falhas = resultados.length - sucessos;

    const detalhes = resultados.map((r) =>
      r.status === "fulfilled" ? r.value : { sucesso: false, erro: r.reason?.message }
    );

    return new Response(
      JSON.stringify({
        sucesso: true,
        total: cooperados.length,
        enviados: sucessos,
        falhas,
        detalhes,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("Erro na edge function:", err);
    return new Response(
      JSON.stringify({ sucesso: false, erro: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
