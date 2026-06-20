// CoopPlantão · v4 — Integração Supabase Real
// ─────────────────────────────────────────────
// PRODUÇÃO: defina as variáveis de ambiente e troque USE_SUPABASE = true
//   VITE_SUPABASE_URL=https://xxxx.supabase.co
//   VITE_SUPABASE_ANON_KEY=eyJ...
//   VITE_COOPERATIVA_SIGLA=CEMERGE
//   VITE_APP_URL=https://plantoes.cemerge.coop.br
// ─────────────────────────────────────────────
// DEMO: USE_SUPABASE = false → roda 100% com dados mock (sem banco)

import { useState, useEffect, useCallback, useRef } from "react";

// ═══════════════════════════════════════════════════════════════
// CONFIG — troque para true ao conectar ao banco real
// ═══════════════════════════════════════════════════════════════
const USE_SUPABASE = false;

const ENV = {
  url:    typeof import.meta !== "undefined" ? (import.meta.env?.VITE_SUPABASE_URL    || "") : "",
  key:    typeof import.meta !== "undefined" ? (import.meta.env?.VITE_SUPABASE_ANON_KEY || "") : "",
  sigla:  typeof import.meta !== "undefined" ? (import.meta.env?.VITE_COOPERATIVA_SIGLA || "CEMERGE") : "CEMERGE",
  appUrl: typeof import.meta !== "undefined" ? (import.meta.env?.VITE_APP_URL || "https://plantoes.cemerge.coop.br") : "https://plantoes.cemerge.coop.br",
};

// ═══════════════════════════════════════════════════════════════
// PALETA
// ═══════════════════════════════════════════════════════════════
const C = {
  navy:"#0F3460", dark:"#0A2647", teal:"#16C79A", bg:"#F0F4F8",
  white:"#FFFFFF", slate:"#64748B", slateL:"#94A3B8",
  border:"#E2E8F0", rowAlt:"#FAFBFD", green:"#15803D",
  greenBg:"#DCFCE7", amber:"#92400E", amberBg:"#FEF3C7",
  red:"#DC2626", redBg:"#FEF2F2",
};

// ═══════════════════════════════════════════════════════════════
// DADOS MOCK (fallback / demo)
// ═══════════════════════════════════════════════════════════════
const ESPECIALIDADES = ["Clínica Médica","Emergência","Pediatria","Cardiologia","Ortopedia","Ginecologia","Neurologia","UTI Adulto"];
const TURNOS         = ["07h–19h (Diurno)","19h–07h (Noturno)","07h–13h (Manhã)","13h–19h (Tarde)"];

const MOCK = {
  cooperativaId: "cemerge-mock-id",
  hospitais: [
    {id:"h1",nome:"Hospital Geral de Fortaleza",      sigla:"HGF",  bairro:"Ellery"},
    {id:"h2",nome:"Hospital Gonzaga Mota",            sigla:"HDGM", bairro:"José Walter"},
    {id:"h3",nome:"Hospital Instituto José Frota",    sigla:"IJF",  bairro:"Centro"},
    {id:"h4",nome:"UPA Norte",                        sigla:"UPA-N",bairro:"Parangaba"},
    {id:"h5",nome:"Hospital Regional de Messejana",   sigla:"HRM",  bairro:"Messejana"},
  ],
  cooperados: [
    {id:"c1",nome:"Dr. Rafael Mendes",  crm:"CE-18420",cpf:"123.456.789-01",especialidade:"Emergência",   telefone:"85991012233",ativo:true},
    {id:"c2",nome:"Dra. Camila Torres", crm:"CE-22105",cpf:"234.567.890-12",especialidade:"Cardiologia",  telefone:"85992023344",ativo:true},
    {id:"c3",nome:"Dr. Lucas Freitas",  crm:"CE-15890",cpf:"345.678.901-23",especialidade:"Clínica Médica",telefone:"85993034455",ativo:true},
    {id:"c4",nome:"Dra. Ana Rodrigues", crm:"CE-19334",cpf:"456.789.012-34",especialidade:"Pediatria",    telefone:"85994045566",ativo:true},
    {id:"c5",nome:"Dr. Bruno Saraiva",  crm:"CE-24010",cpf:"567.890.123-45",especialidade:"Ortopedia",    telefone:"85995056677",ativo:false},
    {id:"c6",nome:"Dra. Juliana Maia",  crm:"CE-20871",cpf:"678.901.234-56",especialidade:"Neurologia",   telefone:"85996067788",ativo:true},
  ],
  vagas: [
    {id:"v1",hospitalId:"h1",hospital:{nome:"Hospital Geral de Fortaleza",sigla:"HGF",bairro:"Ellery"},     especialidade:"Emergência",    turno:"19h–07h (Noturno)",data_plantao:"2026-06-23",valor:520,status:"aberta",    candidaturas:[{cooperado_id:"c1",status:"pendente"}],descricao:"Plantão PS adulto."},
    {id:"v2",hospitalId:"h3",hospital:{nome:"Hospital Instituto José Frota",sigla:"IJF",bairro:"Centro"},   especialidade:"Clínica Médica",turno:"07h–19h (Diurno)", data_plantao:"2026-06-24",valor:480,status:"aberta",    candidaturas:[],                                     descricao:"Enfermaria geral."},
    {id:"v3",hospitalId:"h2",hospital:{nome:"Hospital Gonzaga Mota",sigla:"HDGM",bairro:"José Walter"},     especialidade:"Pediatria",     turno:"07h–19h (Diurno)", data_plantao:"2026-06-25",valor:550,status:"preenchida",candidaturas:[{cooperado_id:"c4",status:"aprovada"}], descricao:"PS pediátrico.",cooperado_aprovado_id:"c4"},
    {id:"v4",hospitalId:"h4",hospital:{nome:"UPA Norte",sigla:"UPA-N",bairro:"Parangaba"},                  especialidade:"Cardiologia",   turno:"19h–07h (Noturno)",data_plantao:"2026-06-26",valor:700,status:"aberta",    candidaturas:[],                                     descricao:"Sobreaviso cardiológico."},
    {id:"v5",hospitalId:"h5",hospital:{nome:"Hospital Regional de Messejana",sigla:"HRM",bairro:"Messejana"},especialidade:"Ortopedia",     turno:"07h–19h (Diurno)", data_plantao:"2026-06-27",valor:600,status:"aberta",    candidaturas:[{cooperado_id:"c5",status:"pendente"}], descricao:"Atendimento ortopédico."},
    {id:"v6",hospitalId:"h1",hospital:{nome:"Hospital Geral de Fortaleza",sigla:"HGF",bairro:"Ellery"},     especialidade:"UTI Adulto",    turno:"19h–07h (Noturno)",data_plantao:"2026-06-28",valor:800,status:"aberta",    candidaturas:[],                                     descricao:"UTI adulto."},
  ],
};

// Token mock para demo
const mockToken = (cooperadoId, vagaId) =>
  btoa(`coop_${cooperadoId}|${vagaId||""}|${Date.now()}`).replace(/=/g,"");
const parseMockToken = (t) => {
  try {
    const [cooperadoId, vagaId] = atob(t).replace("coop_","").split("|");
    const c = MOCK.cooperados.find(x=>x.id===cooperadoId);
    return c ? { ...c, vagaId: vagaId||null } : null;
  } catch { return null; }
};

// ═══════════════════════════════════════════════════════════════
// CAMADA DE SERVIÇO — abstrai Supabase vs Mock
// ═══════════════════════════════════════════════════════════════
let _supabase = null;
const getSupabase = () => {
  if (!_supabase && USE_SUPABASE && ENV.url && ENV.key) {
    // Importação dinâmica — funciona no Vite/React
    // No Artifact roda mock; em produção esta branch é usada
    try {
      const { createClient } = require("@supabase/supabase-js");
      _supabase = createClient(ENV.url, ENV.key, {
        realtime: { params: { eventsPerSecond: 10 } },
      });
    } catch { _supabase = null; }
  }
  return _supabase;
};

// Estado local mutável para mock (simula banco em memória)
const mockState = {
  cooperados: [...MOCK.cooperados],
  vagas: MOCK.vagas.map(v=>({...v, candidaturas:[...v.candidaturas||[]]})),
  hospitais: [...MOCK.hospitais],
  syncLogs: [
    {id:1,status:"sucesso",total_registros:6,novos:2,atualizados:4,erros:0,executado_em:new Date(Date.now()-86400000).toISOString()},
    {id:2,status:"sucesso",total_registros:6,novos:0,atualizados:6,erros:0,executado_em:new Date(Date.now()-172800000).toISOString()},
  ],
  notifLogs: [],
};

// ── db: cooperados ────────────────────────────────────────────
const db = {
  async getCooperados() {
    if (USE_SUPABASE) {
      const sb = getSupabase();
      const { data, error } = await sb.from("cooperados").select("*").order("nome");
      if (error) throw error;
      return data;
    }
    await delay(400);
    return [...mockState.cooperados];
  },

  async upsertCooperado(coop) {
    if (USE_SUPABASE) {
      const sb = getSupabase();
      const { data, error } = await sb.from("cooperados")
        .upsert(coop, { onConflict: "cooperativa_id,crm" }).select().single();
      if (error) throw error;
      return data;
    }
    await delay(300);
    const idx = mockState.cooperados.findIndex(c=>c.id===coop.id);
    if (idx>=0) mockState.cooperados[idx] = { ...mockState.cooperados[idx], ...coop };
    else mockState.cooperados.push({ ...coop, id: "c" + Date.now() });
    return coop;
  },

  async toggleAtivo(id, ativo) {
    if (USE_SUPABASE) {
      const sb = getSupabase();
      const { error } = await sb.from("cooperados").update({ ativo }).eq("id", id);
      if (error) throw error;
      return;
    }
    await delay(200);
    const c = mockState.cooperados.find(x=>x.id===id);
    if (c) c.ativo = ativo;
  },

  async sincronizarAPI(cooperativaId, apiUrl, apiToken) {
    if (USE_SUPABASE) {
      const sb = getSupabase();
      const { data, error } = await sb.functions.invoke("sync-cooperados", {
        body: { cooperativa_id: cooperativaId, api_url: apiUrl, api_token: apiToken },
      });
      if (error) throw error;
      return data;
    }
    await delay(1800);
    // Simula chegada de 2 cooperados novos via API
    const resultado = { total: 6, novos: 0, atualizados: 6, erros: 0 };
    mockState.syncLogs.unshift({
      id: Date.now(), status: "sucesso", ...resultado,
      executado_em: new Date().toISOString(),
    });
    return resultado;
  },

  async getSyncLogs() {
    if (USE_SUPABASE) {
      const sb = getSupabase();
      const { data } = await sb.from("sync_log").select("*")
        .order("executado_em", { ascending: false }).limit(10);
      return data || [];
    }
    await delay(200);
    return [...mockState.syncLogs];
  },

  // ── vagas ──────────────────────────────────────────────────
  async getVagas(filtros = {}) {
    if (USE_SUPABASE) {
      const sb = getSupabase();
      let q = sb.from("vagas").select(`
        *, hospital:hospitais(id,nome,sigla,bairro),
        candidaturas(id,cooperado_id,status,cooperado:cooperados(id,nome,crm,especialidade))
      `).order("data_plantao");
      if (filtros.especialidade) q = q.eq("especialidade", filtros.especialidade);
      if (filtros.status)        q = q.eq("status", filtros.status);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    }
    await delay(350);
    return mockState.vagas.map(v=>({
      ...v,
      hospital: MOCK.hospitais.find(h=>h.id===v.hospitalId)||v.hospital,
    }));
  },

  async getVagasCooperado(especialidade) {
    if (USE_SUPABASE) {
      const sb = getSupabase();
      const { data, error } = await sb.from("vagas").select(`
        *, hospital:hospitais(id,nome,sigla,bairro),
        candidaturas(id,cooperado_id,status)
      `)
        .eq("especialidade", especialidade)
        .eq("status", "aberta")
        .gte("data_plantao", new Date().toISOString().split("T")[0])
        .order("data_plantao");
      if (error) throw error;
      return data;
    }
    await delay(300);
    return mockState.vagas.filter(v=>
      v.especialidade===especialidade && v.status==="aberta"
    ).map(v=>({...v, hospital: MOCK.hospitais.find(h=>h.id===v.hospitalId)||v.hospital}));
  },

  async criarVaga(vaga) {
    if (USE_SUPABASE) {
      const sb = getSupabase();
      const { data, error } = await sb.from("vagas").insert(vaga).select(`
        *, hospital:hospitais(id,nome,sigla,bairro)
      `).single();
      if (error) throw error;
      return data;
    }
    await delay(400);
    const hosp = mockState.hospitais.find(h=>h.id===vaga.hospital_id||h.id===vaga.hospitalId);
    const nova = {
      ...vaga, id: "v" + Date.now(),
      status: "aberta", candidaturas: [],
      hospital: hosp,
      data_plantao: vaga.data_plantao || vaga.data,
    };
    mockState.vagas.push(nova);
    return nova;
  },

  // ── candidaturas ───────────────────────────────────────────
  async candidatar(vagaId, cooperadoId) {
    if (USE_SUPABASE) {
      const sb = getSupabase();
      const { data, error } = await sb.from("candidaturas")
        .insert({ vaga_id: vagaId, cooperado_id: cooperadoId }).select().single();
      if (error) throw error;
      return data;
    }
    await delay(300);
    const v = mockState.vagas.find(x=>x.id===vagaId);
    if (v && !v.candidaturas.find(c=>c.cooperado_id===cooperadoId)) {
      v.candidaturas.push({ id:"cand"+Date.now(), cooperado_id: cooperadoId, status:"pendente" });
    }
    return { vaga_id: vagaId, cooperado_id: cooperadoId };
  },

  async aprovarCandidatura(vagaId, cooperadoId) {
    if (USE_SUPABASE) {
      const sb = getSupabase();
      // O trigger SQL cuida de tudo (atualiza vaga + recusa demais)
      const { data: cand } = await sb.from("candidaturas")
        .select("id").eq("vaga_id", vagaId).eq("cooperado_id", cooperadoId).single();
      const { error } = await sb.from("candidaturas")
        .update({ status:"aprovada", avaliado_em: new Date().toISOString() })
        .eq("id", cand.id);
      if (error) throw error;
      return;
    }
    await delay(400);
    const v = mockState.vagas.find(x=>x.id===vagaId);
    if (v) {
      v.status = "preenchida";
      v.cooperado_aprovado_id = cooperadoId;
      v.candidaturas = v.candidaturas.map(c=>({
        ...c,
        status: c.cooperado_id===cooperadoId ? "aprovada" : "recusada",
      }));
    }
  },

  // ── login cooperado ────────────────────────────────────────
  async loginCooperado(crm, cpf, sigla = ENV.sigla) {
    if (USE_SUPABASE) {
      const sb = getSupabase();
      const { data, error } = await sb.rpc("login_cooperado", {
        p_crm: crm, p_cpf: cpf, p_cooperativa_sigla: sigla,
      });
      if (error) throw error;
      const r = data?.[0];
      if (!r || r.erro) throw new Error(r?.erro || "Credenciais inválidas");
      return r;
    }
    await delay(900);
    const c = mockState.cooperados.find(x=>
      x.crm.replace(/\D/g,"")===crm.replace(/\D/g,"") &&
      x.cpf.replace(/\D/g,"")===cpf.replace(/\D/g,"")
    );
    if (!c)        throw new Error("CRM ou CPF não encontrado.");
    if (!c.ativo)  throw new Error("Cadastro inativo. Contate a CEMERGE.");
    return c;
  },

  // ── magic token ────────────────────────────────────────────
  async gerarToken(cooperadoId, cooperativaId, vagaId = null) {
    if (USE_SUPABASE) {
      const sb = getSupabase();
      const { data, error } = await sb.rpc("gerar_magic_token", {
        p_cooperado_id: cooperadoId,
        p_cooperativa_id: cooperativaId,
        p_vaga_id: vagaId,
        p_horas_validade: 24,
      });
      if (error) throw error;
      return data;
    }
    await delay(200);
    return mockToken(cooperadoId, vagaId);
  },

  async validarToken(token) {
    if (USE_SUPABASE) {
      const sb = getSupabase();
      const { data, error } = await sb.rpc("validar_magic_token", { p_token: token });
      if (error) throw error;
      const r = data?.[0];
      if (!r || !r.valido) throw new Error(r?.erro || "Token inválido");
      return r;
    }
    await delay(1000);
    const r = parseMockToken(token);
    if (!r) throw new Error("Token inválido ou expirado.");
    if (!r.ativo) throw new Error("Cadastro inativo. Contate a CEMERGE.");
    return { ...r, cooperado_id: r.id, cooperado_nome: r.nome, cooperado_crm: r.crm, valido: true };
  },

  // ── notificações WhatsApp ──────────────────────────────────
  async notificarWhatsApp(tipo, vagaId, cooperativaId, cooperadoIds = null) {
    if (USE_SUPABASE) {
      const sb = getSupabase();
      const { data, error } = await sb.functions.invoke("notificar-whatsapp", {
        body: { tipo, vaga_id: vagaId, cooperativa_id: cooperativaId,
                cooperado_ids: cooperadoIds },
      });
      if (error) throw error;
      return data;
    }
    await delay(2000);
    const vaga = mockState.vagas.find(v=>v.id===vagaId);
    const destinatarios = mockState.cooperados.filter(c=>
      c.especialidade===vaga?.especialidade && c.ativo && c.telefone
    );
    const log = {
      id: Date.now(), vagaId, tipo,
      especialidade: vaga?.especialidade||"",
      enviados: destinatarios.length,
      horario: "agora",
      status: "sucesso",
      links: destinatarios.map(c=>({
        cooperado: c.nome, telefone: c.telefone,
        link: `${ENV.appUrl}/acesso?t=${mockToken(c.id, vagaId)}&v=${vagaId}`,
      })),
    };
    mockState.notifLogs.unshift(log);
    return { sucesso: true, enviados: destinatarios.length, detalhes: log.links };
  },

  async getNotifLogs() {
    await delay(200);
    return [...mockState.notifLogs];
  },

  // ── realtime ───────────────────────────────────────────────
  subscribeVagas(cooperativaId, especialidade, onNew) {
    if (USE_SUPABASE) {
      const sb = getSupabase();
      const ch = sb.channel("vagas_rt")
        .on("postgres_changes",
          { event:"INSERT", schema:"public", table:"vagas",
            filter:`cooperativa_id=eq.${cooperativaId}` },
          p => { if(p.new.especialidade===especialidade) onNew(p.new); }
        ).subscribe();
      return () => sb.removeChannel(ch);
    }
    return () => {};
  },

  subscribeCandidaturas(onUpdate) {
    if (USE_SUPABASE) {
      const sb = getSupabase();
      const ch = sb.channel("cand_rt")
        .on("postgres_changes",
          { event:"*", schema:"public", table:"candidaturas" },
          onUpdate
        ).subscribe();
      return () => sb.removeChannel(ch);
    }
    return () => {};
  },
};

const delay = ms => new Promise(r => setTimeout(r, ms));

// ═══════════════════════════════════════════════════════════════
// UTILITÁRIOS
// ═══════════════════════════════════════════════════════════════
const fmt      = v => v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const fmtData  = d => { if(!d) return "—"; const[y,m,day]=d.split("T")[0].split("-"); return `${day}/${m}/${y}`; };
const iniciais = n => (n||"?").split(" ").filter((_,i,a)=>i===0||i===a.length-1).map(p=>p[0]).join("").toUpperCase();
const maskCPF  = v => v.replace(/\D/g,"").replace(/(\d{3})(\d)/,"$1.$2").replace(/(\d{3})(\d)/,"$1.$2").replace(/(\d{3})(\d{1,2})$/,"$1-$2").slice(0,14);
const maskCRM  = v => v.toUpperCase().replace(/[^A-Z0-9\-]/g,"").slice(0,10);
const fmtTel   = v => { const d=v.replace(/\D/g,""); if(d.length<=2)return d; if(d.length<=7)return `(${d.slice(0,2)}) ${d.slice(2)}`; return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7,11)}`; };
const fmtHora  = iso => { try{ return new Date(iso).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}); }catch{return iso;} };

const COR_ESP = {
  "Clínica Médica":{bg:"#EEF2FF",text:"#3730A3",dot:"#6366F1"},
  "Emergência":    {bg:"#FEF2F2",text:"#991B1B",dot:"#EF4444"},
  "Pediatria":     {bg:"#F0FDF4",text:"#166534",dot:"#22C55E"},
  "Cardiologia":   {bg:"#FFF7ED",text:"#9A3412",dot:"#F97316"},
  "Ortopedia":     {bg:"#F0F9FF",text:"#0C4A6E",dot:"#0EA5E9"},
  "Ginecologia":   {bg:"#FDF4FF",text:"#6B21A8",dot:"#A855F7"},
  "Neurologia":    {bg:"#FFFBEB",text:"#92400E",dot:"#F59E0B"},
  "UTI Adulto":    {bg:"#FFF1F2",text:"#881337",dot:"#FB7185"},
};
const getCor = e => COR_ESP[e]||{bg:"#F1F5F9",text:"#475569",dot:"#94A3B8"};

// ═══════════════════════════════════════════════════════════════
// COMPONENTES BASE
// ═══════════════════════════════════════════════════════════════
function Avatar({nome,size=36,color=C.navy}) {
  return <div style={{width:size,height:size,borderRadius:"50%",background:color,color:"#fff",
    display:"flex",alignItems:"center",justifyContent:"center",
    fontSize:size*0.33,fontWeight:700,flexShrink:0,fontFamily:"Inter,sans-serif"}}>
    {iniciais(nome)}
  </div>;
}
function BadgeEsp({esp}) {
  const c=getCor(esp);
  return <span style={{background:c.bg,color:c.text,padding:"3px 10px",borderRadius:20,
    fontSize:12,fontWeight:600,display:"inline-flex",alignItems:"center",gap:5,
    fontFamily:"Inter,sans-serif",whiteSpace:"nowrap"}}>
    <span style={{width:7,height:7,borderRadius:"50%",background:c.dot,display:"inline-block"}}/>
    {esp}
  </span>;
}
function BadgeStatus({status}) {
  const m={aberta:{bg:C.greenBg,color:C.green,label:"Disponível"},
    preenchida:{bg:"#F1F5F9",color:C.slate,label:"Preenchida"},
    cancelada:{bg:C.redBg,color:C.red,label:"Cancelada"}};
  const s=m[status]||m.aberta;
  return <span style={{background:s.bg,color:s.color,padding:"3px 10px",borderRadius:20,
    fontSize:12,fontWeight:600,fontFamily:"Inter,sans-serif"}}>{s.label}</span>;
}
function Spinner({size=18,color="#fff"}) {
  return <span style={{display:"inline-block",width:size,height:size,
    border:`2px solid ${color}40`,borderTop:`2px solid ${color}`,
    borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>;
}
function Toast({msg,tipo="info",onClose}) {
  useEffect(()=>{const t=setTimeout(onClose,4500);return()=>clearTimeout(t);},[]);
  const bg={info:C.navy,sucesso:"#166534",erro:"#991B1B",wpp:"#075E54"}[tipo]||C.navy;
  const icon={info:"🔔",sucesso:"✅",erro:"❌",wpp:"📱"}[tipo]||"🔔";
  return <div style={{position:"fixed",bottom:24,right:24,zIndex:9999,background:bg,color:"#fff",
    padding:"14px 20px",borderRadius:12,boxShadow:"0 8px 32px rgba(0,0,0,0.2)",
    fontSize:14,fontWeight:500,display:"flex",alignItems:"center",gap:10,
    fontFamily:"Inter,sans-serif",animation:"slideIn 0.3s ease",maxWidth:380}}>
    <span style={{fontSize:18}}>{icon}</span>{msg}
  </div>;
}
function Btn({children,onClick,variant="primary",size="md",fullWidth,disabled,loading}) {
  const s={
    primary:{background:C.navy,  color:"#fff", border:"none"},
    teal:   {background:C.teal,  color:C.navy, border:"none"},
    wpp:    {background:"#25D366",color:"#fff", border:"none"},
    outline:{background:"#fff",  color:C.navy, border:`1.5px solid ${C.border}`},
    danger: {background:C.redBg, color:C.red,  border:`1.5px solid #FECACA`},
    ghost:  {background:"transparent",color:C.slate,border:"none"},
  };
  const sz={sm:{padding:"6px 14px",fontSize:12},md:{padding:"10px 20px",fontSize:14},lg:{padding:"13px 24px",fontSize:15}};
  return <button onClick={onClick} disabled={disabled||loading}
    style={{...s[variant],...sz[size],borderRadius:8,fontWeight:700,
      cursor:(disabled||loading)?"not-allowed":"pointer",fontFamily:"Inter,sans-serif",
      width:fullWidth?"100%":undefined,opacity:(disabled||loading)?0.6:1,
      display:"inline-flex",alignItems:"center",gap:6,justifyContent:"center",transition:"opacity 0.15s"}}>
    {loading&&<Spinner color={variant==="outline"||variant==="danger"?C.navy:"#fff"}/>}
    {children}
  </button>;
}
function Input({label,value,onChange,type="text",placeholder,disabled,mask,hint}) {
  const h=e=>{let v=e.target.value;
    if(mask==="cpf")v=maskCPF(v);
    if(mask==="crm")v=maskCRM(v);
    if(mask==="tel")v=fmtTel(v);
    onChange(v);};
  return <div>
    {label&&<label style={{fontSize:11,fontWeight:700,color:C.slate,marginBottom:4,
      display:"block",textTransform:"uppercase",letterSpacing:"0.05em",fontFamily:"Inter,sans-serif"}}>{label}</label>}
    <input type={type} value={value} onChange={h} placeholder={placeholder} disabled={disabled}
      style={{width:"100%",padding:"9px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,
        fontSize:14,fontFamily:"Inter,sans-serif",outline:"none",
        background:disabled?"#F8FAFC":C.white,boxSizing:"border-box",color:C.navy}}/>
    {hint&&<div style={{fontSize:11,color:C.slateL,marginTop:3,fontFamily:"Inter,sans-serif"}}>{hint}</div>}
  </div>;
}
function Select({label,value,onChange,options}) {
  return <div>
    {label&&<label style={{fontSize:11,fontWeight:700,color:C.slate,marginBottom:4,
      display:"block",textTransform:"uppercase",letterSpacing:"0.05em",fontFamily:"Inter,sans-serif"}}>{label}</label>}
    <select value={value} onChange={e=>onChange(e.target.value)}
      style={{width:"100%",padding:"9px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,
        fontSize:14,fontFamily:"Inter,sans-serif",outline:"none",background:"#F8FAFC",
        boxSizing:"border-box",color:C.navy}}>
      {options.map(o=><option key={o.value??o} value={o.value??o}>{o.label??o}</option>)}
    </select>
  </div>;
}

// ═══════════════════════════════════════════════════════════════
// HOOK: useAsync — carrega dados com loading/erro automático
// ═══════════════════════════════════════════════════════════════
function useAsync(fn, deps=[]) {
  const [state,setState] = useState({data:null,loading:true,error:null});
  const refresh = useCallback(async()=>{
    setState(s=>({...s,loading:true,error:null}));
    try { const data=await fn(); setState({data,loading:false,error:null}); }
    catch(e) { setState({data:null,loading:false,error:e.message}); }
  }, deps);
  useEffect(()=>{ refresh(); }, [refresh]);
  return {...state, refresh};
}

// ═══════════════════════════════════════════════════════════════
// TELA: MAGIC LINK
// ═══════════════════════════════════════════════════════════════
function TelaMagicLink({token, onLogin}) {
  const [estado,setEstado] = useState("validando");
  const [erro,setErro]     = useState("");
  const [coop,setCoop]     = useState(null);

  useEffect(()=>{
    db.validarToken(token)
      .then(r=>{
        const cooperado = {
          id:    r.cooperado_id || r.id,
          nome:  r.cooperado_nome || r.nome,
          crm:   r.cooperado_crm  || r.crm,
          especialidade: r.especialidade,
          ativo: true,
        };
        setCoop(cooperado);
        setEstado("sucesso");
        setTimeout(()=>onLogin(cooperado, r.vaga_id||r.vagaId||null), 1500);
      })
      .catch(e=>{ setErro(e.message); setEstado("erro"); });
  },[token]);

  return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",
      justifyContent:"center",padding:20}}>
      <div style={{width:"min(400px,100%)",background:C.white,borderRadius:20,
        overflow:"hidden",boxShadow:"0 16px 48px rgba(15,52,96,0.12)"}}>
        <div style={{background:`linear-gradient(135deg,${C.dark},${C.navy})`,padding:"28px 32px"}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:44,height:44,borderRadius:10,background:C.teal,
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>🏥</div>
            <div>
              <div style={{fontSize:18,fontWeight:800,color:"#fff",fontFamily:"Inter,sans-serif"}}>CoopPlantão</div>
              <div style={{fontSize:12,color:C.teal,fontWeight:600,fontFamily:"Inter,sans-serif"}}>Acesso via WhatsApp</div>
            </div>
          </div>
        </div>
        <div style={{padding:"40px 32px",textAlign:"center"}}>
          {estado==="validando"&&<>
            <div style={{width:56,height:56,borderRadius:"50%",border:`4px solid ${C.teal}`,
              borderTop:"4px solid transparent",animation:"spin 0.8s linear infinite",margin:"0 auto 20px"}}/>
            <div style={{fontSize:16,fontWeight:700,color:C.navy,fontFamily:"Inter,sans-serif",marginBottom:6}}>
              Verificando seu acesso...
            </div>
            <div style={{fontSize:13,color:C.slate,fontFamily:"Inter,sans-serif"}}>Autenticando via link do WhatsApp</div>
          </>}
          {estado==="sucesso"&&coop&&<>
            <div style={{width:64,height:64,borderRadius:"50%",background:C.greenBg,
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,margin:"0 auto 20px"}}>✅</div>
            <div style={{fontSize:18,fontWeight:800,color:C.navy,fontFamily:"Inter,sans-serif",marginBottom:6}}>
              Bem-vindo, {coop.nome.split(" ")[1] || coop.nome}!
            </div>
            <div style={{fontSize:14,color:C.slate,fontFamily:"Inter,sans-serif"}}>
              {coop.crm} · {coop.especialidade}
            </div>
            <div style={{fontSize:13,color:C.green,fontWeight:600,fontFamily:"Inter,sans-serif",marginTop:14}}>
              Entrando automaticamente...
            </div>
          </>}
          {estado==="erro"&&<>
            <div style={{width:64,height:64,borderRadius:"50%",background:C.redBg,
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,margin:"0 auto 20px"}}>❌</div>
            <div style={{fontSize:17,fontWeight:800,color:C.navy,fontFamily:"Inter,sans-serif",marginBottom:10}}>Link inválido</div>
            <div style={{fontSize:14,color:C.slate,fontFamily:"Inter,sans-serif",marginBottom:24,lineHeight:1.6}}>{erro}</div>
            <Btn variant="outline" onClick={()=>window.history.pushState({},"",window.location.pathname)}>
              Fazer login manual
            </Btn>
          </>}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TELA: LOGIN MANUAL
// ═══════════════════════════════════════════════════════════════
function TelaLogin({onLogin}) {
  const [crm,setCrm]=useState(""); const [cpf,setCpf]=useState("");
  const [erro,setErro]=useState(""); const [loading,setLoading]=useState(false);

  const entrar=async()=>{
    setErro(""); setLoading(true);
    try { const c=await db.loginCooperado(crm,cpf); onLogin(c,null); }
    catch(e) { setErro(e.message); }
    setLoading(false);
  };
  return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{width:"min(400px,100%)",background:C.white,borderRadius:20,
        overflow:"hidden",boxShadow:"0 16px 48px rgba(15,52,96,0.12)"}}>
        <div style={{background:`linear-gradient(135deg,${C.dark},${C.navy})`,padding:"28px 32px"}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
            <div style={{width:44,height:44,borderRadius:10,background:C.teal,
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>🏥</div>
            <div>
              <div style={{fontSize:18,fontWeight:800,color:"#fff",fontFamily:"Inter,sans-serif"}}>CoopPlantão</div>
              <div style={{fontSize:12,color:C.teal,fontWeight:600,fontFamily:"Inter,sans-serif"}}>CEMERGE · Área do Cooperado</div>
            </div>
          </div>
          <div style={{background:"rgba(22,199,154,0.15)",borderRadius:10,padding:"10px 14px",
            display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:20}}>📱</span>
            <span style={{fontSize:13,color:"rgba(255,255,255,0.85)",fontFamily:"Inter,sans-serif"}}>
              Prefira acessar pelo <strong>link do WhatsApp</strong> — sem digitar nada!
            </span>
          </div>
        </div>
        <div style={{padding:32}}>
          <div style={{display:"flex",flexDirection:"column",gap:14,marginBottom:20}}>
            <Input label="CRM" value={crm} onChange={setCrm} placeholder="CE-00000" mask="crm"/>
            <Input label="CPF" value={cpf} onChange={setCpf} placeholder="000.000.000-00" mask="cpf"/>
          </div>
          {erro&&<div style={{background:C.redBg,border:"1px solid #FECACA",borderRadius:8,
            padding:"10px 14px",marginBottom:16,fontSize:13,color:C.red,fontFamily:"Inter,sans-serif"}}>
            ⚠️ {erro}
          </div>}
          <Btn variant="primary" size="lg" fullWidth onClick={entrar}
            disabled={!crm||!cpf} loading={loading}>Entrar</Btn>
          <p style={{margin:"14px 0 0",fontSize:12,color:C.slateL,textAlign:"center",fontFamily:"Inter,sans-serif"}}>
            Problemas? WhatsApp CEMERGE: (85) 3333-0000
          </p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// APP COOPERADO
// ═══════════════════════════════════════════════════════════════
function AppCooperado({cooperado, vagaDestaque, onLogout, addToast, cooperativaId}) {
  const [aba,setAba] = useState("disponiveis");

  const {data:vagas, loading:loadV, refresh:refreshVagas} = useAsync(
    ()=>db.getVagasCooperado(cooperado.especialidade), [cooperado.especialidade]
  );

  // Realtime: nova vaga publicada → atualiza lista
  useEffect(()=>{
    const unsub = db.subscribeVagas(cooperativaId, cooperado.especialidade, ()=>refreshVagas());
    return unsub;
  },[cooperativo,cooperado.especialidade]);

  // Se veio com vagaDestaque, vai direto para agenda
  useEffect(()=>{ if(vagaDestaque) setAba("agenda"); },[vagaDestaque]);

  const candidatar = async (vagaId) => {
    await db.candidatar(vagaId, cooperado.id);
    addToast("Candidatura enviada! Aguarde confirmação.","sucesso");
    refreshVagas();
    setAba("agenda");
  };

  const disponiveis = (vagas||[]).filter(v=>
    !v.candidaturas?.some(c=>c.cooperado_id===cooperado.id)
  );
  const minhaAgenda = (vagas||[]).filter(v=>
    v.candidaturas?.some(c=>c.cooperado_id===cooperado.id)
  );
  // Vagas confirmadas (aprovadas) para cálculo financeiro
  const confirmadas = minhaAgenda.filter(v=>
    v.candidaturas?.some(c=>c.cooperado_id===cooperado.id&&c.status==="aprovada")
  );

  const statusCand = v => {
    const c = v.candidaturas?.find(x=>x.cooperado_id===cooperado.id);
    if(!c) return null;
    if(c.status==="aprovada") return {label:"Confirmado ✓",color:C.green,bg:C.greenBg};
    if(c.status==="recusada") return {label:"Recusado",color:C.red,bg:C.redBg};
    return {label:"Aguardando",color:C.amber,bg:C.amberBg};
  };

  const tabStyle = at => ({
    flex:1,padding:"11px",border:"none",cursor:"pointer",fontFamily:"Inter,sans-serif",
    fontSize:13,fontWeight:700,background:at?C.navy:"transparent",
    color:at?"#fff":"rgba(255,255,255,0.55)",borderRadius:at?8:0,transition:"all 0.15s",
  });

  const CardVaga = ({v,modo}) => {
    const hosp = v.hospital||{};
    const st = statusCand(v);
    const cor = getCor(v.especialidade);
    if(modo==="agenda") return (
      <div style={{background:C.white,borderRadius:14,
        border:st?.label?.includes("Confirm")?`2px solid #86EFAC`:`1px solid ${C.border}`,
        marginBottom:12,padding:16,boxShadow:"0 2px 8px rgba(15,52,96,0.05)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
          <div>
            <div style={{fontSize:15,fontWeight:800,color:C.navy,fontFamily:"Inter,sans-serif"}}>{hosp.nome}</div>
            <div style={{fontSize:12,color:C.slate,fontFamily:"Inter,sans-serif"}}>📍 {hosp.bairro}</div>
          </div>
          {st&&<span style={{fontSize:12,fontWeight:700,color:st.color,background:st.bg,
            padding:"4px 10px",borderRadius:20,flexShrink:0,marginLeft:8,fontFamily:"Inter,sans-serif"}}>{st.label}</span>}
        </div>
        <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
          <BadgeEsp esp={v.especialidade}/>
          {[fmtData(v.data_plantao),v.turno?.split(" ")[0],fmt(v.valor)].map((tag,i)=>(
            <span key={i} style={{background:i===2?"#EEF2FF":"#F1F5F9",
              color:i===2?"#3730A3":C.slate,padding:"3px 10px",borderRadius:20,
              fontSize:12,fontWeight:i===2?700:600,fontFamily:"Inter,sans-serif"}}>{tag}</span>
          ))}
        </div>
      </div>
    );
    return (
      <div style={{background:C.white,borderRadius:14,border:`1px solid ${C.border}`,
        marginBottom:14,overflow:"hidden",boxShadow:"0 2px 8px rgba(15,52,96,0.06)"}}>
        <div style={{background:cor.bg,padding:"11px 16px",
          borderBottom:`2px solid ${cor.dot}20`,
          display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <BadgeEsp esp={v.especialidade}/>
          <span style={{fontSize:20,fontWeight:800,color:C.navy,fontFamily:"Inter,sans-serif"}}>{fmt(v.valor)}</span>
        </div>
        <div style={{padding:"13px 16px"}}>
          <div style={{fontSize:16,fontWeight:800,color:C.navy,marginBottom:2,fontFamily:"Inter,sans-serif"}}>{hosp.nome}</div>
          <div style={{fontSize:13,color:C.slate,marginBottom:12,fontFamily:"Inter,sans-serif"}}>📍 {hosp.bairro}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
            {[["Data",fmtData(v.data_plantao)],["Turno",v.turno?.split(" ")[0]]].map(([k,val])=>(
              <div key={k} style={{background:"#F8FAFC",borderRadius:8,padding:"8px 12px"}}>
                <div style={{fontSize:10,color:C.slateL,fontWeight:700,textTransform:"uppercase",fontFamily:"Inter,sans-serif"}}>{k}</div>
                <div style={{fontSize:13,fontWeight:700,color:C.navy,fontFamily:"Inter,sans-serif"}}>{val}</div>
              </div>
            ))}
          </div>
          {v.descricao&&<div style={{fontSize:13,color:C.slate,marginBottom:12,lineHeight:1.5,fontFamily:"Inter,sans-serif"}}>{v.descricao}</div>}
          <Btn variant="primary" size="lg" fullWidth onClick={()=>candidatar(v.id)}>
            Tenho interesse →
          </Btn>
        </div>
      </div>
    );
  };

  return (
    <div style={{maxWidth:430,margin:"0 auto",fontFamily:"Inter,sans-serif"}}>
      <div style={{background:`linear-gradient(135deg,${C.dark},${C.navy})`,padding:"22px 20px 16px"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:4}}>
          <Avatar nome={cooperado.nome} size={44} color={C.teal}/>
          <div style={{flex:1}}>
            <div style={{fontSize:15,fontWeight:800,color:"#fff"}}>{cooperado.nome}</div>
            <div style={{fontSize:12,color:C.teal,fontWeight:600}}>{cooperado.crm}</div>
          </div>
          <button onClick={onLogout} style={{background:"rgba(255,255,255,0.1)",border:"none",
            color:"rgba(255,255,255,0.6)",padding:"6px 12px",borderRadius:8,cursor:"pointer",
            fontSize:12,fontFamily:"Inter,sans-serif"}}>Sair</button>
        </div>
        <div style={{margin:"10px 0 14px",display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:12,color:"rgba(255,255,255,0.5)"}}>Exibindo apenas:</span>
          <BadgeEsp esp={cooperado.especialidade}/>
        </div>
        <div style={{display:"flex",background:"rgba(255,255,255,0.1)",borderRadius:10,padding:4,gap:2}}>
          <button style={tabStyle(aba==="disponiveis")} onClick={()=>setAba("disponiveis")}>
            🔍 Plantões ({loadV?"…":disponiveis.length})
          </button>
          <button style={tabStyle(aba==="agenda")} onClick={()=>setAba("agenda")}>
            📅 Agenda ({loadV?"…":minhaAgenda.length})
          </button>
        </div>
      </div>

      <div style={{padding:"18px 16px"}}>
        {loadV&&<div style={{textAlign:"center",padding:40,color:C.slate,fontFamily:"Inter,sans-serif"}}>
          <Spinner size={28} color={C.navy}/><br/><br/>Carregando plantões...
        </div>}

        {!loadV&&aba==="disponiveis"&&(
          disponiveis.length===0
            ? <div style={{textAlign:"center",padding:"48px 20px",color:C.slateL,
                background:"#F8FAFC",borderRadius:16,border:`1px dashed ${C.border}`}}>
                <div style={{fontSize:40,marginBottom:12}}>🏥</div>
                <div style={{fontWeight:700,color:C.navy,marginBottom:4,fontFamily:"Inter,sans-serif"}}>
                  Nenhuma vaga de {cooperado.especialidade}
                </div>
                <div style={{fontSize:13,fontFamily:"Inter,sans-serif"}}>
                  Você será notificado pelo WhatsApp quando surgir uma vaga.
                </div>
              </div>
            : disponiveis.map(v=><CardVaga key={v.id} v={v} modo="feed"/>)
        )}

        {!loadV&&aba==="agenda"&&(<>
          {minhaAgenda.length===0
            ? <div style={{textAlign:"center",padding:"48px 20px",color:C.slateL,
                background:"#F8FAFC",borderRadius:16,border:`1px dashed ${C.border}`}}>
                <div style={{fontSize:40,marginBottom:12}}>📅</div>
                <div style={{fontWeight:700,color:C.navy,marginBottom:4,fontFamily:"Inter,sans-serif"}}>Agenda vazia</div>
                <div style={{fontSize:13,fontFamily:"Inter,sans-serif"}}>Candidate-se a plantões disponíveis.</div>
              </div>
            : minhaAgenda.map(v=><CardVaga key={v.id} v={v} modo="agenda"/>)
          }
          {confirmadas.length>0&&(
            <div style={{background:`linear-gradient(135deg,${C.dark},${C.navy})`,
              borderRadius:14,padding:20,marginTop:8}}>
              <div style={{fontSize:11,fontWeight:700,color:C.teal,textTransform:"uppercase",
                letterSpacing:"0.08em",marginBottom:6,fontFamily:"Inter,sans-serif"}}>Projeção do mês</div>
              <div style={{fontSize:30,fontWeight:800,color:"#fff",fontFamily:"Inter,sans-serif"}}>
                {fmt(confirmadas.reduce((a,v)=>a+(v.valor||0),0))}
              </div>
              <div style={{fontSize:13,color:"rgba(255,255,255,0.5)",marginTop:4,fontFamily:"Inter,sans-serif"}}>
                {confirmadas.length} plantão(ões) confirmado(s)
              </div>
            </div>
          )}
        </>)}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PAINEL WHATSAPP
// ═══════════════════════════════════════════════════════════════
function PainelWhatsApp({vagas, cooperados, cooperativaId, addToast}) {
  const [config,setConfig] = useState({evoUrl:"https://evo.cemerge.coop.br",evoKey:"",evoInstance:"cemerge",appUrl:ENV.appUrl});
  const [mostrarConfig,setMostrarConfig] = useState(false);
  const [loadingVaga,setLoadingVaga]     = useState(null);
  const [loadingTeste,setLoadingTeste]   = useState(false);
  const [logs,setLogs]                   = useState([]);
  const [linksGerados,setLinksGerados]   = useState(null); // modal de links

  useEffect(()=>{ db.getNotifLogs().then(setLogs); },[]);

  const notificar = async (vaga) => {
    setLoadingVaga(vaga.id);
    try {
      const r = await db.notificarWhatsApp("nova_vaga", vaga.id, cooperativaId);
      addToast(`📱 ${r.enviados} mensagem(ns) enviada(s) via WhatsApp!`,"wpp");
      setLinksGerados(r.detalhes||[]);
      const novoLogs = await db.getNotifLogs();
      setLogs(novoLogs);
    } catch(e) { addToast("Erro ao enviar: "+e.message,"erro"); }
    setLoadingVaga(null);
  };

  const testarConexao = async () => {
    setLoadingTeste(true);
    await delay(1400);
    setLoadingTeste(false);
    addToast("✅ Evolution API conectada! Instância cemerge online.","sucesso");
  };

  const vagasAbertas = (vagas||[]).filter(v=>v.status==="aberta");

  return (
    <div style={{padding:"0 32px 40px"}}>
      {/* Config */}
      <div style={{background:C.white,borderRadius:14,border:`1px solid ${C.border}`,padding:24,marginBottom:20}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:44,height:44,borderRadius:10,background:"#25D36618",
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>📱</div>
            <div>
              <div style={{fontSize:16,fontWeight:800,color:C.navy,fontFamily:"Inter,sans-serif"}}>
                Evolution API · WhatsApp
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6,marginTop:2}}>
                <span style={{width:8,height:8,borderRadius:"50%",background:"#25D366",display:"inline-block"}}/>
                <span style={{fontSize:13,color:"#25D366",fontWeight:600,fontFamily:"Inter,sans-serif"}}>
                  {config.evoInstance} · online (simulado)
                </span>
              </div>
            </div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <Btn variant="outline" size="sm" onClick={()=>setMostrarConfig(v=>!v)}>
              {mostrarConfig?"▲ Ocultar":"⚙️ Configurar"}
            </Btn>
            <Btn variant="wpp" size="sm" onClick={testarConexao} loading={loadingTeste}>
              Testar
            </Btn>
          </div>
        </div>

        {mostrarConfig&&(
          <div style={{marginTop:20,paddingTop:20,borderTop:`1px solid ${C.border}`,
            display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            <div style={{gridColumn:"1/-1"}}>
              <Input label="URL Evolution API" value={config.evoUrl}
                onChange={v=>setConfig(c=>({...c,evoUrl:v}))}
                hint="Ex: https://evo.seudominio.com.br"/>
            </div>
            <Input label="API Key global" value={config.evoKey}
              onChange={v=>setConfig(c=>({...c,evoKey:v}))} placeholder="sua-chave"/>
            <Input label="Nome da instância" value={config.evoInstance}
              onChange={v=>setConfig(c=>({...c,evoInstance:v}))}/>
            <div style={{gridColumn:"1/-1"}}>
              <Input label="URL do App (magic link)" value={config.appUrl}
                onChange={v=>setConfig(c=>({...c,appUrl:v}))}
                hint="Ex: https://plantoes.cemerge.coop.br"/>
            </div>
            <div style={{gridColumn:"1/-1",display:"flex",justifyContent:"flex-end"}}>
              <Btn variant="teal" size="sm" onClick={()=>{setMostrarConfig(false);addToast("Configurações salvas","sucesso");}}>
                Salvar
              </Btn>
            </div>
          </div>
        )}
      </div>

      {/* Preview da mensagem */}
      <div style={{background:C.white,borderRadius:14,border:`1px solid ${C.border}`,padding:24,marginBottom:20}}>
        <div style={{fontSize:15,fontWeight:800,color:C.navy,fontFamily:"Inter,sans-serif",marginBottom:16}}>
          📨 Preview da mensagem + Fluxo do magic link
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
          <div style={{background:"#ECE5DD",borderRadius:16,padding:16}}>
            <div style={{fontSize:11,color:"#667781",fontFamily:"Inter,sans-serif",marginBottom:10,textAlign:"center"}}>
              WhatsApp
            </div>
            <div style={{background:"#fff",borderRadius:"0 12px 12px 12px",padding:"10px 14px",
              maxWidth:"92%",boxShadow:"0 1px 2px rgba(0,0,0,0.1)"}}>
              <div style={{fontSize:13,lineHeight:1.65,color:"#111",fontFamily:"system-ui,sans-serif",whiteSpace:"pre-line"}}>
{`🏥 *CoopPlantão — Nova Vaga!*

*Especialidade:* Emergência
*Hospital:* HGF · Ellery
*Data:* 23/06/2026
*Turno:* 19h–07h (Noturno)
*Valor:* R$ 520,00

👇 *Clique para se candidatar:*`}
              </div>
              <div style={{marginTop:8,padding:"7px 10px",background:"#F0F4F8",borderRadius:8,
                fontSize:11,color:"#0F3460",fontWeight:600,fontFamily:"monospace",wordBreak:"break-all"}}>
                {config.appUrl}/acesso?t=<span style={{color:C.teal}}>abc123…</span>&v=v1
              </div>
              <div style={{fontSize:10,color:"#667781",textAlign:"right",marginTop:4}}>14:32 ✓✓</div>
            </div>
          </div>
          <div>
            <div style={{fontSize:13,fontWeight:700,color:C.navy,fontFamily:"Inter,sans-serif",marginBottom:10}}>
              Fluxo do link mágico
            </div>
            {[
              {i:"📱",t:"Cooperado recebe mensagem no WhatsApp"},
              {i:"👆",t:"Clica no link — token único por cooperado"},
              {i:"🔐",t:"Supabase valida e autentica em 1 segundo"},
              {i:"🏥",t:"Entra direto, sem digitar CRM/CPF"},
              {i:"✅",t:"Já vê a vaga e se candidata com 1 toque"},
            ].map(s=>(
              <div key={s.t} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                <div style={{width:30,height:30,borderRadius:"50%",background:C.teal+"22",
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>{s.i}</div>
                <div style={{fontSize:13,color:C.slate,fontFamily:"Inter,sans-serif"}}>{s.t}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Disparar por vaga */}
      <div style={{background:C.white,borderRadius:14,border:`1px solid ${C.border}`,padding:24,marginBottom:20}}>
        <div style={{fontSize:15,fontWeight:800,color:C.navy,fontFamily:"Inter,sans-serif",marginBottom:4}}>
          🚀 Notificar cooperados por vaga
        </div>
        <div style={{fontSize:13,color:C.slate,fontFamily:"Inter,sans-serif",marginBottom:18}}>
          Envia WhatsApp + magic link individual para cada cooperado da especialidade.
        </div>
        {vagasAbertas.length===0
          ? <div style={{textAlign:"center",padding:28,color:C.slateL,fontFamily:"Inter,sans-serif"}}>Nenhuma vaga aberta.</div>
          : vagasAbertas.map((v,i)=>{
            const hosp = v.hospital||{};
            const dest = (cooperados||[]).filter(c=>c.especialidade===v.especialidade&&c.ativo&&c.telefone).length;
            return (
              <div key={v.id} style={{display:"flex",alignItems:"center",gap:12,
                padding:"13px 16px",borderRadius:10,border:`1px solid ${C.border}`,
                background:i%2===0?C.white:"#F8FAFC",marginBottom:8}}>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3,flexWrap:"wrap"}}>
                    <BadgeEsp esp={v.especialidade}/>
                    <span style={{fontSize:13,color:C.slate,fontFamily:"Inter,sans-serif"}}>
                      {hosp.sigla} · {fmtData(v.data_plantao)} · {fmt(v.valor)}
                    </span>
                  </div>
                  <div style={{fontSize:12,color:dest>0?C.slate:C.red,fontFamily:"Inter,sans-serif"}}>
                    📱 {dest} cooperado{dest!==1?"s":""} de {v.especialidade} serão notificados
                    {dest===0&&" · cadastre telefones primeiro"}
                  </div>
                </div>
                <Btn variant="wpp" size="sm"
                  disabled={dest===0} loading={loadingVaga===v.id}
                  onClick={()=>notificar(v)}>
                  {loadingVaga===v.id?"Enviando…":"Notificar"}
                </Btn>
              </div>
            );
          })
        }
      </div>

      {/* Histórico */}
      <div style={{background:C.white,borderRadius:14,border:`1px solid ${C.border}`,padding:24}}>
        <div style={{fontSize:15,fontWeight:800,color:C.navy,fontFamily:"Inter,sans-serif",marginBottom:16}}>
          📋 Histórico de envios
        </div>
        {logs.length===0
          ? <div style={{textAlign:"center",padding:28,color:C.slateL,fontFamily:"Inter,sans-serif"}}>
              Nenhum envio registrado ainda.
            </div>
          : logs.map(log=>(
            <div key={log.id} style={{display:"flex",alignItems:"center",gap:12,
              padding:"10px 0",borderBottom:`1px solid #F1F5F9`}}>
              <div style={{width:36,height:36,borderRadius:8,
                background:log.status==="sucesso"?C.greenBg:C.redBg,
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>
                {log.status==="sucesso"?"✅":"❌"}
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:700,color:C.navy,fontFamily:"Inter,sans-serif",
                  display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                  Nova vaga · <BadgeEsp esp={log.especialidade||""}/>
                </div>
                <div style={{fontSize:12,color:C.slate,fontFamily:"Inter,sans-serif",marginTop:2}}>
                  {log.enviados} mensagem{log.enviados!==1?"s":""} · {fmtHora(log.executado_em)||log.horario}
                </div>
              </div>
            </div>
          ))
        }
      </div>

      {/* Modal links gerados */}
      {linksGerados&&(
        <div style={{position:"fixed",inset:0,background:"rgba(15,52,96,0.4)",
          display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}}>
          <div style={{background:C.white,borderRadius:16,padding:28,width:"min(560px,95vw)",
            boxShadow:"0 24px 64px rgba(15,52,96,0.2)",maxHeight:"80vh",overflow:"auto"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <h3 style={{margin:0,fontSize:17,fontWeight:800,color:C.navy,fontFamily:"Inter,sans-serif"}}>
                📱 Links gerados e enviados
              </h3>
              <button onClick={()=>setLinksGerados(null)} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:C.slateL}}>×</button>
            </div>
            <p style={{margin:"0 0 16px",fontSize:13,color:C.slate,fontFamily:"Inter,sans-serif"}}>
              Cada cooperado recebe um link único e de uso único, válido por 24h.
            </p>
            {linksGerados.map((l,i)=>(
              <div key={i} style={{padding:"12px 14px",borderRadius:10,background:"#F8FAFC",
                border:`1px solid ${C.border}`,marginBottom:10}}>
                <div style={{fontSize:14,fontWeight:700,color:C.navy,fontFamily:"Inter,sans-serif",marginBottom:4}}>
                  {l.cooperado}
                </div>
                <div style={{fontSize:12,color:C.slate,fontFamily:"Inter,sans-serif",marginBottom:6}}>
                  📞 {l.telefone}
                </div>
                <div style={{fontSize:11,color:C.teal,fontFamily:"monospace",wordBreak:"break-all",
                  background:"#F0FDF4",padding:"6px 10px",borderRadius:6}}>
                  {l.link}
                </div>
              </div>
            ))}
            <div style={{marginTop:16,textAlign:"right"}}>
              <Btn variant="outline" onClick={()=>setLinksGerados(null)}>Fechar</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PAINEL COOPERATIVA
// ═══════════════════════════════════════════════════════════════
function PainelCooperativa({cooperativaId, addToast}) {
  const [abaAdm,setAbaAdm] = useState("vagas");
  const [filtroEsp,setFiltroEsp]   = useState("Todas");
  const [filtroSt,setFiltroSt]     = useState("Todas");
  const [modalVaga,setModalVaga]   = useState(null);
  const [modalCand,setModalCand]   = useState(null);
  const [busca,setBusca]           = useState("");

  const {data:vagas,   loading:loadV, refresh:refreshV} = useAsync(()=>db.getVagas());
  const {data:coops,   loading:loadC, refresh:refreshC} = useAsync(()=>db.getCooperados());
  const {data:syncLogs,loading:loadS, refresh:refreshS} = useAsync(()=>db.getSyncLogs());

  // Realtime: candidaturas → atualiza painel
  useEffect(()=>db.subscribeCandidaturas(()=>refreshV()),[]);

  const [apiConfig,setApiConfig] = useState({url:"https://api.cemerge.coop.br/v1/cooperados",token:""});
  const [syncLoading,setSyncLoading] = useState(false);

  const sincronizar = async () => {
    setSyncLoading(true);
    try {
      const r = await db.sincronizarAPI(cooperativaId, apiConfig.url, apiConfig.token);
      addToast(`✅ Sync concluído: ${r.novos} novos, ${r.atualizados} atualizados`,"sucesso");
      refreshC(); refreshS();
    } catch(e) { addToast("Erro no sync: "+e.message,"erro"); }
    setSyncLoading(false);
  };

  const publicar = async (dados) => {
    await db.criarVaga({...dados, cooperativa_id: cooperativaId,
      hospital_id: dados.hospitalId, data_plantao: dados.data});
    addToast(`✅ Vaga publicada: ${dados.especialidade}`,"sucesso");
    setModalVaga(null); refreshV();
  };

  const aprovar = async (vagaId, cooperadoId) => {
    await db.aprovarCandidatura(vagaId, cooperadoId);
    const c = (coops||[]).find(x=>x.id===cooperadoId);
    addToast(`🎉 ${c?.nome||"Cooperado"} confirmado!`,"sucesso");
    setModalCand(null); refreshV();
  };

  const toggleAtivo = async (id, ativo) => {
    await db.toggleAtivo(id, ativo);
    refreshC();
  };

  const vagasFiltradas = (vagas||[]).filter(v=>{
    if(filtroEsp!=="Todas"&&v.especialidade!==filtroEsp) return false;
    if(filtroSt!=="Todas"&&v.status!==filtroSt)          return false;
    return true;
  });

  const coopsFiltrados = (coops||[]).filter(c=>
    !busca||c.nome.toLowerCase().includes(busca.toLowerCase())||
    c.crm.toLowerCase().includes(busca.toLowerCase())
  );

  const abertas    = (vagas||[]).filter(v=>v.status==="aberta").length;
  const preench    = (vagas||[]).filter(v=>v.status==="preenchida").length;
  const totalCand  = (vagas||[]).reduce((a,v)=>a+(v.candidaturas?.length||0),0);
  const totalValor = (vagas||[]).filter(v=>v.status==="aberta").reduce((a,v)=>a+(v.valor||0),0);

  const abaStyle = at => ({
    padding:"10px 18px",border:"none",cursor:"pointer",fontFamily:"Inter,sans-serif",
    fontSize:14,fontWeight:700,background:"transparent",
    color:at?C.navy:C.slateL,borderBottom:`3px solid ${at?C.teal:"transparent"}`,transition:"all 0.15s",
  });
  const selStyle = {padding:"8px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,
    fontSize:13,fontFamily:"Inter,sans-serif",background:"#F8FAFC",color:C.navy,fontWeight:600};

  return (
    <div>
      <div style={{background:C.white,borderBottom:`1px solid ${C.border}`,padding:"0 32px",display:"flex",gap:4}}>
        <button style={abaStyle(abaAdm==="vagas")} onClick={()=>setAbaAdm("vagas")}>📋 Vagas</button>
        <button style={abaStyle(abaAdm==="cooperados")} onClick={()=>setAbaAdm("cooperados")}>
          👥 Cooperados
          {!loadC&&<span style={{marginLeft:7,background:C.teal,color:C.navy,padding:"1px 7px",
            borderRadius:10,fontSize:11,fontWeight:800}}>
            {(coops||[]).filter(c=>c.ativo).length}
          </span>}
        </button>
        <button style={abaStyle(abaAdm==="whatsapp")} onClick={()=>setAbaAdm("whatsapp")}>📱 WhatsApp</button>
      </div>

      <div style={{padding:"24px 32px 40px"}}>

        {/* ── ABA VAGAS ── */}
        {abaAdm==="vagas"&&(<>
          <div style={{display:"flex",gap:14,marginBottom:22,flexWrap:"wrap"}}>
            {[{l:"Vagas abertas",v:loadV?"…":abertas,cor:C.teal,i:"🟢"},
              {l:"Preenchidas",v:loadV?"…":preench,cor:"#6366F1",i:"✅"},
              {l:"Candidaturas",v:loadV?"…":totalCand,cor:"#F97316",i:"👥"},
              {l:"Valor aberto",v:loadV?"…":fmt(totalValor),cor:"#0EA5E9",i:"💰"}].map(s=>(
              <div key={s.l} style={{background:C.white,borderRadius:12,padding:"18px 20px",
                flex:1,border:`1px solid ${C.border}`,borderTop:`4px solid ${s.cor}`,minWidth:130}}>
                <div style={{fontSize:20,marginBottom:4}}>{s.i}</div>
                <div style={{fontSize:24,fontWeight:800,color:C.navy,fontFamily:"Inter,sans-serif"}}>{s.v}</div>
                <div style={{fontSize:12,color:C.slate,fontFamily:"Inter,sans-serif",marginTop:2}}>{s.l}</div>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
            <select style={selStyle} value={filtroEsp} onChange={e=>setFiltroEsp(e.target.value)}>
              <option>Todas</option>{ESPECIALIDADES.map(e=><option key={e}>{e}</option>)}
            </select>
            <select style={selStyle} value={filtroSt} onChange={e=>setFiltroSt(e.target.value)}>
              <option>Todas</option>
              <option value="aberta">Disponível</option>
              <option value="preenchida">Preenchida</option>
            </select>
            <div style={{marginLeft:"auto"}}>
              <Btn variant="teal" onClick={()=>setModalVaga("nova")}>+ Publicar Vaga</Btn>
            </div>
          </div>
          <div style={{background:C.white,borderRadius:14,border:`1px solid ${C.border}`,overflow:"hidden"}}>
            <div style={{display:"grid",gridTemplateColumns:"2fr 1.4fr 1fr 1fr 0.8fr 0.8fr 1fr",
              padding:"11px 20px",background:"#F8FAFC",borderBottom:`1px solid ${C.border}`}}>
              {["Hospital","Especialidade","Turno","Data","Valor","Status","Candidatos"].map(h=>(
                <span key={h} style={{fontSize:11,fontWeight:700,color:C.slateL,
                  textTransform:"uppercase",letterSpacing:"0.06em",fontFamily:"Inter,sans-serif"}}>{h}</span>
              ))}
            </div>
            {loadV
              ? <div style={{padding:40,textAlign:"center",color:C.slate,fontFamily:"Inter,sans-serif"}}>
                  <Spinner size={24} color={C.navy}/>&nbsp; Carregando vagas...
                </div>
              : vagasFiltradas.length===0
                ? <div style={{padding:40,textAlign:"center",color:C.slateL,fontFamily:"Inter,sans-serif"}}>
                    Nenhuma vaga para os filtros selecionados.
                  </div>
                : vagasFiltradas.map((v,i)=>{
                    const h=v.hospital||{};
                    const nCand=(v.candidaturas||[]).length;
                    return (
                      <div key={v.id} style={{display:"grid",gridTemplateColumns:"2fr 1.4fr 1fr 1fr 0.8fr 0.8fr 1fr",
                        padding:"13px 20px",alignItems:"center",
                        borderBottom:i<vagasFiltradas.length-1?`1px solid #F1F5F9`:"none",
                        background:i%2===0?C.white:C.rowAlt}}>
                        <div>
                          <div style={{fontSize:14,fontWeight:700,color:C.navy,fontFamily:"Inter,sans-serif"}}>{h.sigla||"—"}</div>
                          <div style={{fontSize:12,color:C.slateL,fontFamily:"Inter,sans-serif"}}>{h.bairro}</div>
                        </div>
                        <BadgeEsp esp={v.especialidade}/>
                        <span style={{fontSize:13,color:C.slate,fontFamily:"Inter,sans-serif"}}>{v.turno?.split(" ")[0]}</span>
                        <span style={{fontSize:13,color:C.slate,fontFamily:"Inter,sans-serif"}}>{fmtData(v.data_plantao)}</span>
                        <span style={{fontSize:14,fontWeight:700,color:C.navy,fontFamily:"Inter,sans-serif"}}>{fmt(v.valor||0)}</span>
                        <BadgeStatus status={v.status}/>
                        <button onClick={()=>setModalCand(v)} style={{padding:"7px 14px",borderRadius:8,
                          border:`1.5px solid ${C.border}`,background:C.white,fontSize:12,fontWeight:700,
                          cursor:"pointer",color:C.navy,fontFamily:"Inter,sans-serif",
                          display:"flex",alignItems:"center",gap:6}}>
                          👥 {nCand}
                          {nCand>0&&v.status==="aberta"&&<span style={{color:C.teal,fontSize:10}}>●</span>}
                        </button>
                      </div>
                    );
                  })
            }
          </div>
        </>)}

        {/* ── ABA COOPERADOS ── */}
        {abaAdm==="cooperados"&&(<>
          <div style={{background:C.white,borderRadius:14,border:`1px solid ${C.border}`,padding:22,marginBottom:20}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
              <div>
                <div style={{fontSize:15,fontWeight:800,color:C.navy,fontFamily:"Inter,sans-serif",marginBottom:3}}>
                  🔗 Sincronização via API
                </div>
                <div style={{fontSize:13,color:C.slate,fontFamily:"Inter,sans-serif"}}>
                  Conecte ao sistema da cooperativa para importar e atualizar a base a qualquer momento.
                </div>
              </div>
              <Btn variant="teal" size="sm" onClick={sincronizar} loading={syncLoading}>
                ⟳ Sincronizar
              </Btn>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:12,alignItems:"end"}}>
              <Input label="URL da API" value={apiConfig.url}
                onChange={v=>setApiConfig(c=>({...c,url:v}))}/>
              <Input label="Token" value={apiConfig.token} type="password"
                onChange={v=>setApiConfig(c=>({...c,token:v}))} placeholder="Bearer token"/>
            </div>
            {/* Logs de sync */}
            {!loadS&&syncLogs?.length>0&&(
              <div style={{marginTop:14,paddingTop:14,borderTop:`1px solid ${C.border}`}}>
                <div style={{fontSize:12,fontWeight:700,color:C.slateL,fontFamily:"Inter,sans-serif",
                  textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:8}}>Últimas sincronizações</div>
                {syncLogs.slice(0,3).map(l=>(
                  <div key={l.id} style={{display:"flex",alignItems:"center",gap:10,
                    fontSize:12,color:C.slate,fontFamily:"Inter,sans-serif",marginBottom:4}}>
                    <span>{l.status==="sucesso"?"✅":"❌"}</span>
                    <span>{fmtHora(l.executado_em)}</span>
                    <span>·</span>
                    <span>{l.total_registros} registros</span>
                    <span style={{color:C.green}}>+{l.novos} novos</span>
                    <span style={{color:C.amber}}>↺{l.atualizados} atualizados</span>
                    {l.erros>0&&<span style={{color:C.red}}>⚠ {l.erros} erros</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{position:"relative",flex:1,maxWidth:340}}>
              <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:C.slateL}}>🔍</span>
              <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar cooperado..."
                style={{width:"100%",padding:"9px 12px 9px 36px",borderRadius:8,
                  border:`1.5px solid ${C.border}`,fontSize:14,fontFamily:"Inter,sans-serif",
                  outline:"none",background:C.white,boxSizing:"border-box"}}/>
            </div>
            <span style={{fontSize:13,color:C.slateL,fontFamily:"Inter,sans-serif"}}>
              {loadC?"…":`${(coops||[]).filter(c=>c.ativo).length} ativos · ${(coops||[]).length} total`}
            </span>
          </div>

          <div style={{background:C.white,borderRadius:14,border:`1px solid ${C.border}`,overflow:"hidden"}}>
            {loadC
              ? <div style={{padding:40,textAlign:"center",color:C.slate,fontFamily:"Inter,sans-serif"}}>
                  <Spinner size={22} color={C.navy}/>&nbsp; Carregando cooperados...
                </div>
              : coopsFiltrados.map((c,i,arr)=>(
                <div key={c.id} style={{display:"flex",alignItems:"center",gap:14,
                  padding:"12px 20px",borderBottom:i<arr.length-1?`1px solid #F1F5F9`:"none",
                  background:i%2===0?C.white:C.rowAlt,opacity:c.ativo?1:0.5}}>
                  <Avatar nome={c.nome} size={34} color={c.ativo?C.navy:"#94A3B8"}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:700,color:C.navy,fontFamily:"Inter,sans-serif"}}>{c.nome}</div>
                    <div style={{fontSize:12,color:C.slate,fontFamily:"Inter,sans-serif"}}>
                      {c.crm} · {c.telefone||<span style={{color:C.red}}>sem telefone</span>}
                    </div>
                  </div>
                  <BadgeEsp esp={c.especialidade}/>
                  <div onClick={()=>toggleAtivo(c.id,!c.ativo)}
                    style={{width:38,height:22,borderRadius:11,position:"relative",
                      background:c.ativo?C.teal:"#CBD5E1",transition:"background 0.2s",cursor:"pointer",flexShrink:0}}>
                    <div style={{width:16,height:16,borderRadius:"50%",background:"#fff",
                      position:"absolute",top:3,left:c.ativo?18:3,transition:"left 0.2s"}}/>
                  </div>
                </div>
              ))
            }
          </div>
        </>)}

        {/* ── ABA WHATSAPP ── */}
        {abaAdm==="whatsapp"&&(
          <PainelWhatsApp vagas={vagas} cooperados={coops}
            cooperativaId={cooperativaId} addToast={addToast}/>
        )}
      </div>

      {/* Modais */}
      {modalVaga==="nova"&&<ModalNovaVaga onSalvar={publicar} onFechar={()=>setModalVaga(null)}/>}
      {modalCand&&<ModalCandidatos vaga={modalCand} cooperados={coops||[]}
        onAprovar={aprovar} onFechar={()=>setModalCand(null)}/>}
    </div>
  );
}

// ─── Modal nova vaga ─────────────────────────────────────────
function ModalNovaVaga({onSalvar,onFechar}) {
  const [form,setForm]=useState({hospitalId:"h1",especialidade:ESPECIALIDADES[0],turno:TURNOS[0],data:"",valor:"",descricao:""});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const [saving,setSaving]=useState(false);
  const salvar=async()=>{
    if(!form.data||!form.valor) return alert("Preencha data e valor.");
    setSaving(true); await onSalvar({...form,valor:+form.valor}); setSaving(false);
  };
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(15,52,96,0.45)",
      display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}}>
      <div style={{background:C.white,borderRadius:16,padding:32,width:"min(520px,95vw)",
        boxShadow:"0 24px 64px rgba(15,52,96,0.2)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
          <h3 style={{margin:0,fontSize:18,fontWeight:800,color:C.navy,fontFamily:"Inter,sans-serif"}}>Publicar Nova Vaga</h3>
          <button onClick={onFechar} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:C.slateL}}>×</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:16}}>
          <Select label="Hospital" value={form.hospitalId}
            options={MOCK.hospitais.map(h=>({value:h.id,label:`${h.sigla} — ${h.bairro}`}))}
            onChange={v=>set("hospitalId",v)}/>
          <Select label="Especialidade" value={form.especialidade} options={ESPECIALIDADES} onChange={v=>set("especialidade",v)}/>
          <Select label="Turno" value={form.turno} options={TURNOS} onChange={v=>set("turno",v)}/>
          <Input label="Data" type="date" value={form.data} onChange={v=>set("data",v)}/>
          <div style={{gridColumn:"1/-1"}}>
            <Input label="Valor (R$)" type="number" value={form.valor} onChange={v=>set("valor",v)} placeholder="Ex: 500"/>
          </div>
          <div style={{gridColumn:"1/-1"}}>
            <label style={{fontSize:11,fontWeight:700,color:C.slate,marginBottom:4,display:"block",
              textTransform:"uppercase",letterSpacing:"0.05em",fontFamily:"Inter,sans-serif"}}>Observações</label>
            <textarea value={form.descricao} onChange={e=>set("descricao",e.target.value)}
              style={{width:"100%",padding:"9px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,
                fontSize:14,fontFamily:"Inter,sans-serif",resize:"vertical",minHeight:68,
                boxSizing:"border-box",outline:"none"}}/>
          </div>
        </div>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <Btn variant="outline" onClick={onFechar}>Cancelar</Btn>
          <Btn variant="teal" onClick={salvar} loading={saving}>Publicar Vaga</Btn>
        </div>
      </div>
    </div>
  );
}

// ─── Modal candidatos ────────────────────────────────────────
function ModalCandidatos({vaga, cooperados, onAprovar, onFechar}) {
  const [saving,setSaving]=useState(null);
  const candidaturas = vaga.candidaturas||[];
  const hosp = vaga.hospital||{};

  const aprovar=async(cooperadoId)=>{
    setSaving(cooperadoId);
    await onAprovar(vaga.id, cooperadoId);
    setSaving(null);
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(15,52,96,0.45)",
      display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}}>
      <div style={{background:C.white,borderRadius:16,padding:32,width:"min(480px,95vw)",
        boxShadow:"0 24px 64px rgba(15,52,96,0.2)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <h3 style={{margin:0,fontSize:18,fontWeight:800,color:C.navy,fontFamily:"Inter,sans-serif"}}>Candidatos</h3>
          <button onClick={onFechar} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:C.slateL}}>×</button>
        </div>
        <p style={{margin:"0 0 18px",fontSize:13,color:C.slate,fontFamily:"Inter,sans-serif",
          display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          {hosp.sigla} · <BadgeEsp esp={vaga.especialidade}/> · {fmtData(vaga.data_plantao)}
        </p>
        {candidaturas.length===0
          ? <div style={{textAlign:"center",padding:"28px 0",color:C.slateL,fontFamily:"Inter,sans-serif"}}>
              <div style={{fontSize:36,marginBottom:8}}>👤</div>Nenhum candidato ainda
            </div>
          : <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {candidaturas.map(cand=>{
                const c = cand.cooperado||cooperados.find(x=>x.id===cand.cooperado_id)||{nome:"Cooperado",crm:"—"};
                const aprov = cand.status==="aprovada";
                return (
                  <div key={cand.id||cand.cooperado_id} style={{display:"flex",alignItems:"center",gap:12,
                    padding:"13px 14px",borderRadius:10,
                    background:aprov?C.greenBg:"#F8FAFC",
                    border:`1.5px solid ${aprov?"#86EFAC":C.border}`}}>
                    <Avatar nome={c.nome} size={36} color={aprov?"#16803D":C.navy}/>
                    <div style={{flex:1}}>
                      <div style={{fontSize:14,fontWeight:700,color:C.navy,fontFamily:"Inter,sans-serif"}}>{c.nome}</div>
                      <div style={{fontSize:12,color:C.slate,fontFamily:"Inter,sans-serif"}}>{c.crm} · {c.especialidade}</div>
                    </div>
                    {aprov
                      ? <span style={{fontSize:12,fontWeight:700,color:C.green,fontFamily:"Inter,sans-serif"}}>✓ Aprovado</span>
                      : vaga.status==="aberta"
                        ? <Btn variant="teal" size="sm" loading={saving===cand.cooperado_id}
                            onClick={()=>aprovar(cand.cooperado_id)}>Aprovar</Btn>
                        : null}
                  </div>
                );
              })}
            </div>
        }
        <div style={{marginTop:20,textAlign:"right"}}>
          <Btn variant="outline" onClick={onFechar}>Fechar</Btn>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ROOT
// ═══════════════════════════════════════════════════════════════
export default function CoopPlantao() {
  const COOPERATIVA_ID = MOCK.cooperativaId;

  const [tela,setTela]             = useState("cooperativa");
  const [telaCoop,setTelaCoop]     = useState("login");
  const [magicToken,setMagicToken] = useState(null);
  const [cooperado,setCooperado]   = useState(null);
  const [vagaDest,setVagaDest]     = useState(null);
  const [toasts,setToasts]         = useState([]);

  const addToast = useCallback((msg,tipo="info")=>
    setToasts(t=>[...t,{id:Date.now(),msg,tipo}]),[]);

  const loginOk = useCallback((coop,vagaId)=>{
    setCooperado(coop); setVagaDest(vagaId||null); setTelaCoop("app");
  },[]);

  const logout = useCallback(()=>{
    setCooperado(null); setMagicToken(null); setVagaDest(null); setTelaCoop("login");
  },[]);

  const simularMagicLink = async (cooperadoId, vagaId) => {
    const token = await db.gerarToken(cooperadoId, COOPERATIVA_ID, vagaId);
    setMagicToken(token);
    setTelaCoop("magic");
  };

  // Detecta ?t=TOKEN na URL real (produção)
  useEffect(()=>{
    if(!USE_SUPABASE) return;
    const params = new URLSearchParams(window.location.search);
    const t = params.get("t");
    if(t) { setMagicToken(t); setTelaCoop("magic"); setTela("cooperado"); }
  },[]);

  const navStyle = at => ({
    padding:"9px 18px",borderRadius:8,border:"none",cursor:"pointer",
    fontFamily:"Inter,sans-serif",fontSize:13,fontWeight:700,
    background:at?"#fff":"transparent",color:at?C.navy:"rgba(255,255,255,0.6)",
    boxShadow:at?"0 2px 8px rgba(0,0,0,0.12)":"none",transition:"all 0.15s",
  });

  const abaHdrStyle = at => ({
    padding:"11px 20px",border:"none",cursor:"pointer",fontFamily:"Inter,sans-serif",
    fontSize:14,fontWeight:700,background:"transparent",
    color:at?"#fff":"rgba(255,255,255,0.5)",
    borderBottom:`3px solid ${at?C.teal:"transparent"}`,transition:"all 0.15s",
  });

  return (
    <div style={{minHeight:"100vh",background:C.bg}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;}
        @keyframes slideIn{from{transform:translateY(16px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes spin{to{transform:rotate(360deg)}}
        ::-webkit-scrollbar{height:4px;width:4px}
        ::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:4px}
      `}</style>

      {/* NAVBAR */}
      <div style={{background:`linear-gradient(90deg,${C.dark},${C.navy})`,
        padding:"10px 24px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",
        boxShadow:"0 2px 12px rgba(10,38,71,0.3)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginRight:12}}>
          <div style={{width:32,height:32,borderRadius:8,background:C.teal,
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🏥</div>
          <span style={{fontSize:15,fontWeight:800,color:"#fff",fontFamily:"Inter,sans-serif"}}>CoopPlantão</span>
          {!USE_SUPABASE&&<span style={{fontSize:10,background:"rgba(255,200,0,0.2)",color:"#FFD700",
            padding:"2px 8px",borderRadius:10,fontFamily:"Inter,sans-serif",fontWeight:700}}>DEMO</span>}
        </div>

        <div style={{display:"flex",background:"rgba(255,255,255,0.08)",borderRadius:10,padding:4,gap:2}}>
          <button style={navStyle(tela==="cooperativa")} onClick={()=>setTela("cooperativa")}>
            🏢 Cooperativa
          </button>
          <button style={navStyle(tela==="cooperado")} onClick={()=>setTela("cooperado")}>
            👨‍⚕️ App Cooperado
          </button>
        </div>

        {tela==="cooperado"&&telaCoop!=="app"&&(
          <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
            <span style={{fontSize:11,color:"rgba(255,255,255,0.4)",fontFamily:"Inter,sans-serif"}}>
              Simular link WhatsApp:
            </span>
            {MOCK.cooperados.filter(c=>c.ativo).slice(0,3).map(c=>(
              <button key={c.id} onClick={()=>simularMagicLink(c.id,"v1")}
                style={{padding:"5px 12px",borderRadius:20,border:"1px solid rgba(22,199,154,0.4)",
                  background:"rgba(22,199,154,0.1)",color:C.teal,fontSize:11,fontWeight:700,
                  cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                📱 {c.nome.split(" ")[1]}
              </button>
            ))}
          </div>
        )}

        {cooperado&&tela==="cooperado"&&(
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <Avatar nome={cooperado.nome} size={28} color={C.teal}/>
            <span style={{fontSize:13,color:"rgba(255,255,255,0.8)",fontFamily:"Inter,sans-serif",fontWeight:600}}>
              {cooperado.nome.split(" ")[1]||cooperado.nome}
            </span>
          </div>
        )}
        <div style={{marginLeft:"auto",fontSize:11,color:"rgba(255,255,255,0.3)"}}>
          MVP · Piloto Fortaleza-CE
        </div>
      </div>

      {/* COOPERATIVA */}
      {tela==="cooperativa"&&(<>
        <div style={{background:`linear-gradient(135deg,${C.navy},${C.dark})`,padding:"20px 32px 0"}}>
          <div style={{fontSize:11,fontWeight:700,color:C.teal,letterSpacing:"0.12em",
            textTransform:"uppercase",fontFamily:"Inter,sans-serif"}}>
            CEMERGE · Cooperativa de Médicos Emergencistas do Ceará
          </div>
          <h2 style={{margin:"4px 0 16px",fontSize:20,fontWeight:800,color:"#fff",fontFamily:"Inter,sans-serif"}}>
            Painel Administrativo
          </h2>
        </div>
        <PainelCooperativa cooperativaId={COOPERATIVA_ID} addToast={addToast}/>
      </>)}

      {/* APP COOPERADO */}
      {tela==="cooperado"&&(
        <div style={{maxWidth:440,margin:"0 auto",paddingTop:20}}>
          {telaCoop==="magic"&&magicToken&&(
            <TelaMagicLink token={magicToken} onLogin={loginOk}/>
          )}
          {telaCoop==="login"&&<TelaLogin onLogin={loginOk}/>}
          {telaCoop==="app"&&cooperado&&(
            <AppCooperado cooperado={cooperado} vagaDestaque={vagaDest}
              onLogout={logout} addToast={addToast} cooperativaId={COOPERATIVA_ID}/>
          )}
        </div>
      )}

      {/* TOASTS */}
      {toasts.slice(-1).map(t=>(
        <Toast key={t.id} msg={t.msg} tipo={t.tipo}
          onClose={()=>setToasts(ts=>ts.filter(x=>x.id!==t.id))}/>
      ))}
    </div>
  );
}
