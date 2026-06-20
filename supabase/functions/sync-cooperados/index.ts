// supabase/functions/sync-cooperados/index.ts
// Edge Function — Sincronização de cooperados via API externa
// Deploy: supabase functions deploy sync-cooperados
// Pode ser chamada manualmente ou via pg_cron

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! // service role para bypass RLS
    );

    // Body: { cooperativa_id, api_url, api_token }
    const { cooperativa_id, api_url, api_token } = await req.json();

    if (!cooperativa_id || !api_url) {
      return new Response(
        JSON.stringify({ erro: "cooperativa_id e api_url são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 1. Chama API externa da cooperativa ──────────────────
    let dadosExternos: any[] = [];

    try {
      const resp = await fetch(api_url, {
        headers: {
          "Authorization": `Bearer ${api_token}`,
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
      });

      if (!resp.ok) {
        throw new Error(`API retornou status ${resp.status}`);
      }

      const raw = await resp.json();

      // Aceita tanto array direto quanto { data: [] }
      dadosExternos = Array.isArray(raw) ? raw : (raw.data || raw.cooperados || []);

    } catch (apiErr: any) {
      // Registra erro no log
      await supabase.from("sync_log").insert({
        cooperativa_id,
        status: "erro",
        mensagem_erro: `Falha ao chamar API externa: ${apiErr.message}`,
      });

      return new Response(
        JSON.stringify({ sucesso: false, erro: apiErr.message }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (dadosExternos.length === 0) {
      return new Response(
        JSON.stringify({ sucesso: true, mensagem: "Nenhum registro retornado pela API" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 2. Normaliza campos (adapta ao formato de cada cooperativa) ──
    // Mapeamento flexível — a cooperativa pode usar nomes diferentes
    const normalizar = (item: any) => ({
      crm:          item.crm || item.CRM || item.numero_crm || "",
      cpf:          item.cpf || item.CPF || item.documento || "",
      nome:         item.nome || item.name || item.nome_completo || "",
      especialidade: item.especialidade || item.specialty || item.area || "Clínica Médica",
      telefone:     item.telefone || item.celular || item.phone || "",
      email:        item.email || item.e_mail || "",
      ativo:        item.ativo !== undefined ? item.ativo :
                    (item.status === "ativo" || item.active === true),
    });

    const dadosNormalizados = dadosExternos.map(normalizar).filter(
      (c) => c.crm && c.cpf && c.nome // descarta registros sem campos obrigatórios
    );

    // ── 3. Importa via função SQL (upsert em lote) ───────────
    const { data: resultado, error: importErr } = await supabase.rpc(
      "importar_cooperados",
      {
        p_cooperativa_id: cooperativa_id,
        p_dados: dadosNormalizados,
      }
    );

    if (importErr) throw importErr;

    const { novos, atualizados, erros } = resultado[0] || { novos: 0, atualizados: 0, erros: 0 };

    // ── 4. Registra no log de sync ───────────────────────────
    await supabase.from("sync_log").insert({
      cooperativa_id,
      status: "sucesso",
      total_registros: dadosNormalizados.length,
      novos,
      atualizados,
      erros,
    });

    return new Response(
      JSON.stringify({
        sucesso: true,
        total: dadosNormalizados.length,
        novos,
        atualizados,
        erros,
        mensagem: `Sync concluído: ${novos} novos, ${atualizados} atualizados, ${erros} erros`,
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
