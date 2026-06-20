-- ============================================================
-- CoopPlantão · Magic Link via WhatsApp
-- Executar no SQL Editor do Supabase
-- ============================================================

-- ─── TABELA: magic_tokens ────────────────────────────────────
-- Tokens de acesso temporário enviados via WhatsApp
CREATE TABLE magic_tokens (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token           TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  cooperado_id    UUID NOT NULL REFERENCES cooperados(id) ON DELETE CASCADE,
  cooperativa_id  UUID NOT NULL REFERENCES cooperativas(id) ON DELETE CASCADE,
  -- Se vinculado a uma vaga específica, abre direto nela
  vaga_id         UUID REFERENCES vagas(id) ON DELETE SET NULL,
  usado           BOOLEAN DEFAULT false,
  -- Expira em 24h por padrão
  expira_em       TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',
  -- Rastreamento
  enviado_whatsapp BOOLEAN DEFAULT false,
  criado_em       TIMESTAMPTZ DEFAULT NOW(),
  usado_em        TIMESTAMPTZ
);

-- Índice para busca rápida por token
CREATE INDEX idx_magic_tokens_token      ON magic_tokens(token);
CREATE INDEX idx_magic_tokens_cooperado  ON magic_tokens(cooperado_id);
CREATE INDEX idx_magic_tokens_expira     ON magic_tokens(expira_em);

-- RLS
ALTER TABLE magic_tokens ENABLE ROW LEVEL SECURITY;

-- Somente service_role pode criar/ler tokens (via edge function)
-- Cooperado NÃO acessa esta tabela diretamente
CREATE POLICY "service_role_only" ON magic_tokens
  USING (false); -- bloqueia acesso via anon/user key

-- ─── FUNÇÃO: gerar magic token ───────────────────────────────
-- Chamada pela Edge Function ao publicar vaga
-- Gera 1 token por cooperado, invalida tokens anteriores não usados
CREATE OR REPLACE FUNCTION gerar_magic_token(
  p_cooperado_id    UUID,
  p_cooperativa_id  UUID,
  p_vaga_id         UUID DEFAULT NULL,
  p_horas_validade  INT  DEFAULT 24
)
RETURNS TEXT AS $$
DECLARE
  v_token TEXT;
BEGIN
  -- Invalida tokens anteriores não usados para o mesmo cooperado+vaga
  UPDATE magic_tokens
  SET expira_em = NOW()
  WHERE cooperado_id   = p_cooperado_id
    AND COALESCE(vaga_id::TEXT, '') = COALESCE(p_vaga_id::TEXT, '')
    AND usado          = false
    AND expira_em      > NOW();

  -- Gera novo token
  INSERT INTO magic_tokens (
    cooperado_id, cooperativa_id, vaga_id, expira_em
  ) VALUES (
    p_cooperado_id,
    p_cooperativa_id,
    p_vaga_id,
    NOW() + (p_horas_validade || ' hours')::INTERVAL
  )
  RETURNING token INTO v_token;

  RETURN v_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── FUNÇÃO: validar magic token ─────────────────────────────
-- Chamada pelo frontend ao receber o token da URL
-- Retorna os dados do cooperado se válido
CREATE OR REPLACE FUNCTION validar_magic_token(p_token TEXT)
RETURNS TABLE (
  cooperado_id    UUID,
  cooperado_nome  TEXT,
  cooperado_crm   TEXT,
  especialidade   TEXT,
  cooperativa_id  UUID,
  vaga_id         UUID,
  valido          BOOLEAN,
  erro            TEXT
) AS $$
DECLARE
  v_tok magic_tokens%ROWTYPE;
  v_coop cooperados%ROWTYPE;
BEGIN
  -- Busca token
  SELECT * INTO v_tok FROM magic_tokens
  WHERE token = p_token;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::UUID,NULL::TEXT,NULL::TEXT,NULL::TEXT,
      NULL::UUID,NULL::UUID,false,'Token inválido ou não encontrado';
    RETURN;
  END IF;

  IF v_tok.usado THEN
    RETURN QUERY SELECT NULL::UUID,NULL::TEXT,NULL::TEXT,NULL::TEXT,
      NULL::UUID,NULL::UUID,false,'Link já foi utilizado. Solicite um novo acesso.';
    RETURN;
  END IF;

  IF v_tok.expira_em < NOW() THEN
    RETURN QUERY SELECT NULL::UUID,NULL::TEXT,NULL::TEXT,NULL::TEXT,
      NULL::UUID,NULL::UUID,false,'Link expirado. Solicite um novo acesso.';
    RETURN;
  END IF;

  -- Busca cooperado
  SELECT * INTO v_coop FROM cooperados WHERE id = v_tok.cooperado_id;

  IF NOT FOUND OR NOT v_coop.ativo THEN
    RETURN QUERY SELECT NULL::UUID,NULL::TEXT,NULL::TEXT,NULL::TEXT,
      NULL::UUID,NULL::UUID,false,'Cooperado não encontrado ou inativo.';
    RETURN;
  END IF;

  -- Marca como usado
  UPDATE magic_tokens SET
    usado    = true,
    usado_em = NOW()
  WHERE id = v_tok.id;

  RETURN QUERY SELECT
    v_coop.id,
    v_coop.nome,
    v_coop.crm,
    v_coop.especialidade::TEXT,
    v_tok.cooperativa_id,
    v_tok.vaga_id,
    true,
    NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── LIMPEZA AUTOMÁTICA (pg_cron) ────────────────────────────
-- Remove tokens expirados e usados com mais de 7 dias
-- Requer extensão pg_cron habilitada no Supabase
SELECT cron.schedule(
  'limpar-magic-tokens',
  '0 3 * * *', -- toda madrugada às 3h
  $$
    DELETE FROM magic_tokens
    WHERE (expira_em < NOW() AND usado = false)
       OR (usado = true AND usado_em < NOW() - INTERVAL '7 days');
  $$
);

-- ─── ATUALIZAR cooperados: telefone obrigatório ───────────────
-- Para envio via WhatsApp, precisa estar no formato +55 (DDD) 9XXXX-XXXX
COMMENT ON COLUMN cooperados.telefone IS
  'Formato esperado: +5585999001122 (somente dígitos com código do país)';
