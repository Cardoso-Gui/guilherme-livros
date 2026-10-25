# Guilherme Cardoso — livros

Site estático publicado pelo GitHub Pages a partir de main, na raiz.

## Modelo de vendas
Desde 5 de outubro de 2026, o site é um catálogo com sinopses e prévias gratuitas. Novas compras serão feitas na Amazon. Links oficiais adicionados em 08/10/2026: Noah — https://www.amazon.com.br/dp/B0HM9GLSB1; O Quinto Herdeiro — https://www.amazon.com.br/dp/B0HM9DHVTN. Labirinto Verde — https://www.amazon.com.br/dp/B0HN2QSW7V (lançamento atualizado em 22/10/2026). Os links abrem em nova aba com target=_blank e rel=noopener noreferrer. Não inventar ASINs nem usar busca genérica como página de compra.

## Sistema anterior
Login, cadastro, carrinho e biblioteca internos foram retirados. URLs antigas exibem orientação e contato para compras anteriores. Os registros e arquivos privados foram preservados. A função mercado-pago-checkout retorna 410 e não cria novos pedidos; webhook e status permanecem para pedidos anteriores. Não reativar o sistema antigo ao lançar livros.

## Conteúdo
Somente os primeiros capítulos são públicos. Nunca enviar EPUBs ou manuscritos completos para este repositório.

## Organização do frontend

- Os HTMLs na raiz preservam as URLs e o conteúdo editorial. Os três `*-capitulo-1.html` contêm somente as prévias públicas.
- `styles.css` contém a cascata geral, na ordem histórica. `leitura.css`, `suporte.css`, `amazon.css` e `oferta.css` complementam as páginas que os importam.
- `assets/css/` reúne os antigos blocos de estilo de catálogo, notícias e leitores. Cada link ocupa a posição do bloco original: não reordenar ou fundir camadas sem comparar o resultado. Regras posteriores podem sobrescrever anteriores intencionalmente.
- `assets/js/` contém os controles atuais de fonte/tema, modais e filtros de notícias. `catalogo.js` e `surpreenda-me.js` continuam como pontos de entrada existentes.
- Nos leitores, as chaves persistidas ficam nos atributos `data-font-key` e `data-theme-key`. Fonte inicial: 18 px; limites: 16–24 px, em passos de 2 px. A aplicação inicial do tema continua inline no cabeçalho para evitar um clarão de tema claro.
- O catálogo mantém seu modal de sinopse sem gatilhos ativos, como antes. Não adicionar gatilhos como parte de uma simples organização.
- `supabase/` é infraestrutura legada preservada. Mudanças nessa pasta, credenciais, dados e rastreamento exigem um trabalho separado.

Os antigos stubs de autenticação/carrinho, o leitor JavaScript desatualizado e `biblioteca.css` foram removidos após verificar ausência de referências. As oito páginas de orientação para URLs antigas continuam disponíveis.

## Testes

Com Node.js 22 ou superior: `npm install --no-save --package-lock=false playwright@1.56.1 pngjs@7.0.0`, seguido de `npx playwright install chromium`.

- `node tests/site-regression.cjs` inicia um servidor local temporário e testa 17 páginas em 390, 768 e 1440 px: catálogo, notícias, leitores, URLs antigas e navegação com voltar/avançar. Salva screenshots completos e medidas de layout em `test-results/current/`.
- O teste original `node tests/mobile-navigation.cjs` usa um servidor externo em `http://127.0.0.1:8765`, ou `TEST_BASE_URL`.
- `TEST_ROOT` seleciona outro checkout; `TEST_OUTPUT` seleciona a pasta de evidências; `TEST_CHANNEL=msedge` permite usar um Edge instalado. `TEST_BASE_URL` permite verificar um site publicado.
- Para comparar duas execuções no mesmo navegador e máquina: `node tests/compare-renderings.cjs test-results/baseline test-results/after`. O comparador exige igualdade do layout e informa pixels diferentes; isso não prova igualdade entre renderizadores. Capture o baseline duas vezes para medir ruído antes de atribuir diferenças à alteração.

O workflow executa as duas suítes em PRs que mudam HTML, CSS, JavaScript ou testes e publica as evidências como artefato. A publicação só deve ocorrer depois dos checks aplicáveis.

## Painel privado e cliques Amazon

`painel.html` é uma entrada separada, sem link nos menus públicos. O login usa a conta existente do Supabase; `analytics_is_owner` confirma a autorização no servidor antes da consulta a `amazon_click_daily`, que também exige RLS. Não há criação de contas nem recuperação de senha neste painel. A sessão fica apenas em memória e o logout usa escopo local, preservando sessões de outros dispositivos.

O painel mostra eventos de clique (não visitantes únicos, vendas ou compras), no fuso `America/Sao_Paulo`. Hoje, sete dias e trinta dias incluem a data atual. Os filtros personalizados aceitam até 366 dias; o cliente pagina consultas acima de mil linhas. Não há números demonstrativos no código de produção.

`assets/js/amazon-click.js` observa os 17 links existentes, inclusive os links clonados pelos modais de notícias. Apenas cliques primários/teclado e `auxclick` do botão do meio enviam `{book_slug}` para o endpoint confirmado. O script valida slug e destino Amazon; não impede a navegação, não repete requisições e não grava cookies, identificadores de visitante ou armazenamento local. Os identificadores em `analytics-config.js` são públicos; nunca colocar chaves privilegiadas nesse arquivo.

O cliente Supabase está fixado em `package.json`/`pnpm-lock.yaml` e é incluído somente no bundle do painel. Para atualizar o bundle: `pnpm install --frozen-lockfile --ignore-scripts` e `pnpm run build:dashboard`. O script também gera os avisos de licença. O site público não carrega esse bundle.

`node tests/analytics.cjs` usa respostas simuladas e bloqueia a rede restante: cobre os 17 links, teclado, botão do meio, falhas, acesso negado, datas, estados vazios/erro e logout com requisição em andamento. Os números das screenshots desse teste são fixtures locais. Não executar POSTs válidos de teste contra o contador em produção.

O aplicativo não coleta identificadores de visitantes nem IPs. A infraestrutura Supabase/Cloudflare pode processar metadados e emitir cookies; o coletor usa explicitamente `credentials: 'omit'` para não enviá-los nem retê-los. A sessão autenticada do painel é separada da coleta pública.

As fontes do backend estão em `supabase/functions/amazon-click/` e na migração `20261025005939_amazon_click_analytics.sql`, **já aplicada** no projeto existente. Não reaplicar a migração ou o fixture SQL durante a publicação do site. A configuração mantém `verify_jwt = true`. O backend limita cada livro a 120 eventos aceitos por minuto; falhas ou limites não impedem o link Amazon. Consulte [o contrato e as limitações](docs/amazon-analytics-backend.md).

Os testes HTTP de leitura/negação, os testes locais do handler e os testes transacionais de banco são distintos. Não foi produzido clique válido artificial em produção nem criado login em nome do proprietário. O primeiro clique legítimo e o login real ficam para o proprietário concluir a aceitação ponta a ponta. Não foram habilitados serviços pagos; as cotas do plano existente continuam aplicáveis.
