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
