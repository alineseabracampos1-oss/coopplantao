-- ============================================================
-- CoopPlantão · Supabase Schema Completo
-- Projeto: coopplantao
-- Executar no SQL Editor do Supabase (supabase.com/dashboard)
-- ============================================================

-- ─── EXTENSÕES ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron"; -- para sync agendado (opcional)

-- ─── ENUMS ───────────────────────────────────────────────────
CREATE TYPE especialidade_enum AS ENUM (
  'Clínica Médica',
  'Emergência',
  'Pediatria',
  'Cardiologia',
  'Ortopedia',
  'Ginecologia',
  'Neurologia',
  'UTI Adulto'
);

CREATE TYPE turno_enum AS ENUM (
  '07h–19h (Diurno)',
  '19h–07h (Noturno)',
  '07h–13h (Manhã)',
  '13h–19h (Tarde)'
);

CREATE TYPE status_vaga_enum AS ENUM (
  'aberta',
  'preenchida',
  'cancelada'
);

CREATE TYPE status_candidatura_enum AS ENUM (
  'pendente',
  'aprovada',
  'recusada'
);

-- ─── TABELA: cooperativas ─────────────────────────────────────
-- Cada cooperativa tem seu próprio espaço isolado (multi-tenant)
CREATE TABLE cooperativas (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome        TEXT NOT NULL,
  sigla       TEXT NOT NULL UNIQUE,
  cnpj        TEXT UNIQUE,
  cidade      TEXT,
  estado      CHAR(2) DEFAULT 'CE',
  -- Config de integração API (criptografado em produção via Vault)
  api_url     TEXT,
  api_token   TEXT, -- em produção: usar Supabase Vault
  ativo       BOOLEAN DEFAULT true,
  criado_em   TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TABELA: hospitais ───────────────────────────────────────
CREATE TABLE hospitais (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cooperativa_id  UUID NOT NULL REFERENCES cooperativas(id) ON DELETE CASCADE,
  nome            TEXT NOT NULL,
  sigla           TEXT NOT NULL,
  bairro          TEXT,
  cidade          TEXT DEFAULT 'Fortaleza',
  estado          CHAR(2) DEFAULT 'CE',
  endereco        TEXT,
  telefone        TEXT,
  ativo           BOOLEAN DEFAULT true,
  criado_em       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cooperativa_id, sigla)
);

-- ─── TABELA: cooperados ──────────────────────────────────────
-- Base importada via API ou upload CSV pela cooperativa
CREATE TABLE cooperados (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cooperativa_id  UUID NOT NULL REFERENCES cooperativas(id) ON DELETE CASCADE,
  -- Autenticação: CRM + CPF são a chave de acesso
  crm             TEXT NOT NULL,
  cpf             TEXT NOT NULL,
  nome            TEXT NOT NULL,
  especialidade   especialidade_enum NOT NULL,
  telefone        TEXT,
  email           TEXT,
  -- auth.users link (criado na 1ª vez que o cooperado faz login)
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ativo           BOOLEAN DEFAULT true,
  -- Controle de sync da API externa
  fonte           TEXT DEFAULT 'manual', -- 'api' | 'csv' | 'manual'
  sync_em         TIMESTAMPTZ,
  criado_em       TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cooperativa_id, crm),
  UNIQUE(cooperativa_id, cpf)
);

-- ─── TABELA: vagas ───────────────────────────────────────────
CREATE TABLE vagas (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cooperativa_id  UUID NOT NULL REFERENCES cooperativas(id) ON DELETE CASCADE,
  hospital_id     UUID NOT NULL REFERENCES hospitais(id),
  especialidade   especialidade_enum NOT NULL,
  turno           turno_enum NOT NULL,
  data_plantao    DATE NOT NULL,
  valor           NUMERIC(10,2) NOT NULL CHECK (valor > 0),
  descricao       TEXT,
  status          status_vaga_enum DEFAULT 'aberta',
  -- Cooperado aprovado (preenchido quando status = 'preenchida')
  cooperado_aprovado_id UUID REFERENCES cooperados(id) ON DELETE SET NULL,
  -- Quem publicou (admin/gestor da cooperativa)
  publicado_por   UUID REFERENCES auth.users(id),
  criado_em       TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TABELA: candidaturas ────────────────────────────────────
CREATE TABLE candidaturas (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vaga_id         UUID NOT NULL REFERENCES vagas(id) ON DELETE CASCADE,
  cooperado_id    UUID NOT NULL REFERENCES cooperados(id) ON DELETE CASCADE,
  status          status_candidatura_enum DEFAULT 'pendente',
  -- Quem aprovou/recusou (gestor da cooperativa)
  avaliado_por    UUID REFERENCES auth.users(id),
  avaliado_em     TIMESTAMPTZ,
  observacao      TEXT, -- motivo de recusa, por exemplo
  criado_em       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vaga_id, cooperado_id) -- 1 candidatura por vaga por cooperado
);

-- ─── TABELA: notificacoes ────────────────────────────────────
CREATE TABLE notificacoes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cooperado_id    UUID NOT NULL REFERENCES cooperados(id) ON DELETE CASCADE,
  tipo            TEXT NOT NULL, -- 'nova_vaga' | 'candidatura_aprovada' | 'candidatura_recusada'
  titulo          TEXT NOT NULL,
  mensagem        TEXT,
  vaga_id         UUID REFERENCES vagas(id) ON DELETE SET NULL,
  lida            BOOLEAN DEFAULT false,
  criado_em       TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TABELA: sync_log ────────────────────────────────────────
-- Histórico de sincronizações com a API da cooperativa
CREATE TABLE sync_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cooperativa_id  UUID NOT NULL REFERENCES cooperativas(id) ON DELETE CASCADE,
  status          TEXT NOT NULL, -- 'sucesso' | 'erro'
  total_registros INTEGER DEFAULT 0,
  novos           INTEGER DEFAULT 0,
  atualizados     INTEGER DEFAULT 0,
  erros           INTEGER DEFAULT 0,
  mensagem_erro   TEXT,
  executado_em    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TABELA: perfis_admin ────────────────────────────────────
-- Gestores/admins da cooperativa (linked ao auth.users)
CREATE TABLE perfis_admin (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cooperativa_id  UUID NOT NULL REFERENCES cooperativas(id) ON DELETE CASCADE,
  nome            TEXT NOT NULL,
  cargo           TEXT, -- 'admin' | 'gestor' | 'visualizador'
  ativo           BOOLEAN DEFAULT true,
  criado_em       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, cooperativa_id)
);

-- ═══════════════════════════════════════════════════════════════
-- ÍNDICES (performance)
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX idx_vagas_cooperativa    ON vagas(cooperativa_id);
CREATE INDEX idx_vagas_especialidade  ON vagas(especialidade);
CREATE INDEX idx_vagas_data           ON vagas(data_plantao);
CREATE INDEX idx_vagas_status         ON vagas(status);
CREATE INDEX idx_cooperados_coop      ON cooperados(cooperativa_id);
CREATE INDEX idx_cooperados_user      ON cooperados(user_id);
CREATE INDEX idx_candidaturas_vaga    ON candidaturas(vaga_id);
CREATE INDEX idx_candidaturas_coop    ON candidaturas(cooperado_id);
CREATE INDEX idx_notificacoes_coop    ON notificacoes(cooperado_id, lida);

-- ═══════════════════════════════════════════════════════════════
-- TRIGGERS — updated_at automático
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cooperativas_updated
  BEFORE UPDATE ON cooperativas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_cooperados_updated
  BEFORE UPDATE ON cooperados
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_vagas_updated
  BEFORE UPDATE ON vagas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════════════════════════
-- TRIGGER — notificação automática ao publicar vaga
-- Cria notificação para todos os cooperados ativos
-- da mesma especialidade e cooperativa
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION notificar_cooperados_nova_vaga()
RETURNS TRIGGER AS $$
DECLARE
  hosp_nome TEXT;
BEGIN
  -- Busca nome do hospital
  SELECT nome INTO hosp_nome FROM hospitais WHERE id = NEW.hospital_id;

  -- Insere notificação para cada cooperado da especialidade
  INSERT INTO notificacoes (cooperado_id, tipo, titulo, mensagem, vaga_id)
  SELECT
    c.id,
    'nova_vaga',
    'Nova vaga disponível!',
    'Plantão de ' || NEW.especialidade::TEXT ||
    ' em ' || hosp_nome ||
    ' no dia ' || TO_CHAR(NEW.data_plantao, 'DD/MM/YYYY') ||
    ' · ' || TO_CHAR(NEW.valor, 'FM"R$"999G990D00'),
    NEW.id
  FROM cooperados c
  WHERE c.cooperativa_id  = NEW.cooperativa_id
    AND c.especialidade   = NEW.especialidade
    AND c.ativo           = true;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_nova_vaga_notifica
  AFTER INSERT ON vagas
  FOR EACH ROW
  WHEN (NEW.status = 'aberta')
  EXECUTE FUNCTION notificar_cooperados_nova_vaga();

-- ═══════════════════════════════════════════════════════════════
-- TRIGGER — notificação ao aprovar candidatura
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION notificar_aprovacao_candidatura()
RETURNS TRIGGER AS $$
DECLARE
  v_rec    vagas%ROWTYPE;
  hosp_nome TEXT;
BEGIN
  -- Só age quando status muda para 'aprovada'
  IF NEW.status = 'aprovada' AND OLD.status = 'pendente' THEN
    SELECT * INTO v_rec FROM vagas WHERE id = NEW.vaga_id;
    SELECT nome INTO hosp_nome FROM hospitais WHERE id = v_rec.hospital_id;

    INSERT INTO notificacoes (cooperado_id, tipo, titulo, mensagem, vaga_id)
    VALUES (
      NEW.cooperado_id,
      'candidatura_aprovada',
      '✅ Plantão confirmado!',
      'Seu plantão de ' || v_rec.especialidade::TEXT ||
      ' em ' || hosp_nome ||
      ' no dia ' || TO_CHAR(v_rec.data_plantao, 'DD/MM/YYYY') ||
      ' foi confirmado.',
      NEW.vaga_id
    );

    -- Atualiza a vaga como preenchida
    UPDATE vagas SET
      status = 'preenchida',
      cooperado_aprovado_id = NEW.cooperado_id
    WHERE id = NEW.vaga_id;

    -- Recusa automaticamente as demais candidaturas da mesma vaga
    UPDATE candidaturas SET status = 'recusada'
    WHERE vaga_id = NEW.vaga_id
      AND id != NEW.id
      AND status = 'pendente';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_candidatura_aprovada
  AFTER UPDATE ON candidaturas
  FOR EACH ROW
  EXECUTE FUNCTION notificar_aprovacao_candidatura();

-- ═══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE cooperativas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospitais          ENABLE ROW LEVEL SECURITY;
ALTER TABLE cooperados         ENABLE ROW LEVEL SECURITY;
ALTER TABLE vagas              ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidaturas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificacoes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_log           ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfis_admin       ENABLE ROW LEVEL SECURITY;

-- Helper: retorna cooperativa_id do admin logado
CREATE OR REPLACE FUNCTION get_my_cooperativa_id()
RETURNS UUID AS $$
  SELECT cooperativa_id FROM perfis_admin
  WHERE user_id = auth.uid() AND ativo = true
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper: retorna cooperado logado
CREATE OR REPLACE FUNCTION get_my_cooperado_id()
RETURNS UUID AS $$
  SELECT id FROM cooperados
  WHERE user_id = auth.uid() AND ativo = true
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- ── Cooperativas: admin vê só a sua ──────────────────────────
CREATE POLICY "admin_ve_sua_cooperativa" ON cooperativas
  FOR SELECT USING (id = get_my_cooperativa_id());

-- ── Hospitais: admin vê da sua cooperativa; cooperado vê todos da sua ──
CREATE POLICY "admin_crud_hospitais" ON hospitais
  FOR ALL USING (cooperativa_id = get_my_cooperativa_id());

CREATE POLICY "cooperado_ve_hospitais" ON hospitais
  FOR SELECT USING (
    cooperativa_id = (
      SELECT cooperativa_id FROM cooperados WHERE user_id = auth.uid() LIMIT 1
    )
  );

-- ── Cooperados: admin gerencia; cooperado vê só o próprio perfil ──
CREATE POLICY "admin_crud_cooperados" ON cooperados
  FOR ALL USING (cooperativa_id = get_my_cooperativa_id());

CREATE POLICY "cooperado_ve_proprio_perfil" ON cooperados
  FOR SELECT USING (user_id = auth.uid());

-- ── Vagas: admin gerencia tudo; cooperado vê apenas da sua especialidade ──
CREATE POLICY "admin_crud_vagas" ON vagas
  FOR ALL USING (cooperativa_id = get_my_cooperativa_id());

CREATE POLICY "cooperado_ve_vagas_especialidade" ON vagas
  FOR SELECT USING (
    cooperativa_id = (
      SELECT cooperativa_id FROM cooperados WHERE user_id = auth.uid() LIMIT 1
    )
    AND especialidade = (
      SELECT especialidade FROM cooperados WHERE user_id = auth.uid() LIMIT 1
    )
  );

-- ── Candidaturas: cooperado gerencia as suas; admin vê todas ──
CREATE POLICY "admin_ve_todas_candidaturas" ON candidaturas
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM vagas v
      WHERE v.id = candidaturas.vaga_id
        AND v.cooperativa_id = get_my_cooperativa_id()
    )
  );

CREATE POLICY "cooperado_gerencia_candidaturas" ON candidaturas
  FOR ALL USING (cooperado_id = get_my_cooperado_id());

-- ── Notificações: cooperado vê só as suas ────────────────────
CREATE POLICY "cooperado_ve_notificacoes" ON notificacoes
  FOR ALL USING (cooperado_id = get_my_cooperado_id());

-- ── Sync log: só admins ──────────────────────────────────────
CREATE POLICY "admin_ve_sync_log" ON sync_log
  FOR ALL USING (cooperativa_id = get_my_cooperativa_id());

-- ── Perfis admin: cada um vê o próprio ───────────────────────
CREATE POLICY "admin_ve_proprio_perfil" ON perfis_admin
  FOR SELECT USING (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════
-- FUNÇÃO: login cooperado (CRM + CPF → JWT customizado)
-- Chamada pelo frontend via supabase.rpc('login_cooperado', {...})
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION login_cooperado(
  p_crm TEXT,
  p_cpf TEXT,
  p_cooperativa_sigla TEXT DEFAULT 'CEMERGE'
)
RETURNS TABLE (
  cooperado_id    UUID,
  nome            TEXT,
  crm             TEXT,
  especialidade   TEXT,
  ativo           BOOLEAN,
  erro            TEXT
) AS $$
DECLARE
  v_coop   cooperativas%ROWTYPE;
  v_record cooperados%ROWTYPE;
BEGIN
  -- Busca cooperativa pela sigla
  SELECT * INTO v_coop FROM cooperativas WHERE sigla = p_cooperativa_sigla;
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::UUID,NULL::TEXT,NULL::TEXT,NULL::TEXT,NULL::BOOLEAN,'Cooperativa não encontrada';
    RETURN;
  END IF;

  -- Busca cooperado (normaliza CPF/CRM removendo formatação)
  SELECT * INTO v_record FROM cooperados
  WHERE cooperativa_id = v_coop.id
    AND REGEXP_REPLACE(crm, '\D','','g') = REGEXP_REPLACE(p_crm, '\D','','g')
    AND REGEXP_REPLACE(cpf, '\D','','g') = REGEXP_REPLACE(p_cpf, '\D','','g');

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::UUID,NULL::TEXT,NULL::TEXT,NULL::TEXT,NULL::BOOLEAN,'CRM ou CPF não encontrado';
    RETURN;
  END IF;

  IF NOT v_record.ativo THEN
    RETURN QUERY SELECT NULL::UUID,NULL::TEXT,NULL::TEXT,NULL::TEXT,false,'Cadastro inativo. Contate a cooperativa.';
    RETURN;
  END IF;

  RETURN QUERY SELECT v_record.id, v_record.nome, v_record.crm,
    v_record.especialidade::TEXT, v_record.ativo, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════
-- FUNÇÃO: importar cooperados via JSON (chamada pelo backend/edge function)
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION importar_cooperados(
  p_cooperativa_id UUID,
  p_dados JSONB        -- array de { crm, cpf, nome, especialidade, telefone, email, ativo }
)
RETURNS TABLE (novos INT, atualizados INT, erros INT) AS $$
DECLARE
  v_item        JSONB;
  v_novos       INT := 0;
  v_atualizados INT := 0;
  v_erros       INT := 0;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_dados)
  LOOP
    BEGIN
      INSERT INTO cooperados (
        cooperativa_id, crm, cpf, nome, especialidade,
        telefone, email, ativo, fonte, sync_em
      ) VALUES (
        p_cooperativa_id,
        v_item->>'crm',
        v_item->>'cpf',
        v_item->>'nome',
        (v_item->>'especialidade')::especialidade_enum,
        v_item->>'telefone',
        v_item->>'email',
        COALESCE((v_item->>'ativo')::BOOLEAN, true),
        'api',
        NOW()
      )
      ON CONFLICT (cooperativa_id, crm) DO UPDATE SET
        nome          = EXCLUDED.nome,
        cpf           = EXCLUDED.cpf,
        especialidade = EXCLUDED.especialidade,
        telefone      = EXCLUDED.telefone,
        email         = EXCLUDED.email,
        ativo         = EXCLUDED.ativo,
        fonte         = 'api',
        sync_em       = NOW(),
        atualizado_em = NOW();

      IF FOUND THEN v_atualizados := v_atualizados + 1;
      ELSE v_novos := v_novos + 1; END IF;

    EXCEPTION WHEN OTHERS THEN
      v_erros := v_erros + 1;
    END;
  END LOOP;

  RETURN QUERY SELECT v_novos, v_atualizados, v_erros;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════
-- DADOS INICIAIS (seed para piloto CEMERGE)
-- ═══════════════════════════════════════════════════════════════

INSERT INTO cooperativas (nome, sigla, cnpj, cidade, estado)
VALUES ('Cooperativa de Médicos Emergencistas do Ceará', 'CEMERGE', '00.000.000/0001-00', 'Fortaleza', 'CE')
ON CONFLICT (sigla) DO NOTHING;

-- Hospitais conveniados
INSERT INTO hospitais (cooperativa_id, nome, sigla, bairro)
SELECT c.id, h.nome, h.sigla, h.bairro
FROM cooperativas c,
(VALUES
  ('Hospital Geral de Fortaleza',        'HGF',   'Ellery'),
  ('Hospital Gonzaga Mota',              'HDGM',  'José Walter'),
  ('Hospital Instituto Dr. José Frota',  'IJF',   'Centro'),
  ('UPA Norte',                          'UPA-N', 'Parangaba'),
  ('Hospital Regional de Messejana',     'HRM',   'Messejana')
) AS h(nome, sigla, bairro)
WHERE c.sigla = 'CEMERGE'
ON CONFLICT (cooperativa_id, sigla) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- REALTIME (habilitar para notificações em tempo real)
-- ═══════════════════════════════════════════════════════════════
-- Execute no Supabase Dashboard → Database → Replication
-- Ou via SQL:

ALTER PUBLICATION supabase_realtime ADD TABLE vagas;
ALTER PUBLICATION supabase_realtime ADD TABLE candidaturas;
ALTER PUBLICATION supabase_realtime ADD TABLE notificacoes;

-- ═══════════════════════════════════════════════════════════════
-- FIM DO SCHEMA
-- ═══════════════════════════════════════════════════════════════
