# Publicação automática da Biblioteca Finanças que Curam

- Site: https://biblioteca-financasquecuram.netlify.app (projeto Netlify `biblioteca-financasquecuram`, id `00b62fc6-9fc9-48cd-aeee-916503802375`). Domínio desejado: `biblioteca.financasquecuram.com.br`.
- Fonte: banco de conteúdo FQC (https://claude.ai/artifact/WKtgZo4855Mq5bgBvpaXfo), coleção `conteudos`.
- Entra no site o que estiver `aprovado` ou `publicado`, com `destino` = `site` ou `ambos` e data/hora alcançadas (horário de Fortaleza).

## Rodada (feita pela tarefa agendada)
1. Ler a coleção `conteudos` do banco salvando em JSON (um arquivo por documento).
2. `python3 tools/publicar_biblioteca.py --export <pasta> --assets <pasta_fotos> --agora <agora+10min>`.
3. Baixar as fotos listadas em `fotos_faltando` (asset do banco, nome `<id>.<ext>`) e rodar o passo 2 de novo.
4. Se `novos` não estiver vazio (ou na primeira rodada do dia), publicar a pasta `biblioteca/` no Netlify.
5. No banco, gravar `sitePublicadoEm` nos `novos`; se o destino for só `site`, marcar também `status = publicado` e `publicadoEm`.
6. Lembretes da Comunidade: conteúdos aprovados com destino `comunidade` ou `ambos` que vencem na próxima hora.

Publicar no Netlify a partir de um container com proxy:
`NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt npx -y @netlify/mcp@latest --site-id <id> --proxy-path "<proxy do deploy-site>"`, rodado dentro de `biblioteca/`.
