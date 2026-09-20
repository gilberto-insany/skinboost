# Home final — análise e implementação em etapas

Etapa 1 concluída em 20/09/2026. Nenhuma alteração de interface nesta etapa.
Fonte visual: [Home final, 2128:1633](https://www.figma.com/design/0wIp15KlSyc919z2jsqgHa?node-id=2128-1633).
Contexto: [página Draft, 7:630](https://www.figma.com/design/0wIp15KlSyc919z2jsqgHa?node-id=7-630).
O primeiro link aponta para uma página de trabalho, não para um frame de fundamentos.
A Home final substitui a referência anterior 2091:2 para a reconstrução visual.

## Fundamentos verificados

- Frame desktop: 1440 × 10636 px. As alturas são referências visuais; não reproduzir toda a página com coordenadas absolutas.
- Grid centralizado: 12 colunas de 80 px e 11 gutters de 32 px = 1312 px úteis, margens de 64 px.
- Muitos blocos usam padding vertical de 110 px; não arredondar automaticamente para o token de 112 px.
- Header: 78 px; duas instâncias, Default e Variant2, com padding horizontal 69 px. Tratar como estados de um cabeçalho; confirmar comportamento nas variantes durante a etapa 2.
- Hero: 930 px; coluna principal 570 px, formulário 524 px, margem esquerda 64 px, início após header + 80 px.
- 8 coleções, 248 variables, 29 text styles. Snapshot completo em foundations.json.
- Semantic Colors possui Light/Dark por aliases. Existência de modo Dark não implica implementar um seletor de tema.
- Espaçamentos: 0, 2, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 112, 128, 148 px.
- Raios: 0, 2, 4, 6, 8, 12, 16, 24, 999 px. Há valores locais como 20 px no formulário; respeitar a aplicação real.
- Bordas: 1 / 1,5 / 2 px. Opacity numérica: 5 / 10 / 25 / 50 / 75 / 90%; converter para 0–1 no CSS.
- A coleção Opacidade contém cores com alpha, não percentuais numéricos.

### Tipografia

| Estilo | Família/peso | Tamanho | Entrelinha | Tracking |
| --- | --- | --- | --- | --- |
| Display/D1 aplicado | Manrope 600 | 80 px | 100% | -1 px |
| Display/D2 | Manrope 600 | 64 px | 110% | -1 px |
| Display/D3 | Manrope 600 | 56 px | 110% | -1 px |
| Heading H1–H6 | Manrope 600 | 48, 40, 32, 28, 24, 20 px | 130%; H4 120% | -1 px |
| Text XL–XS | Inter 400/500/600/700 | 18, 16, 14, 12, 10 px | 150% | -0,5 px |

Divergências reais: font/size/display/D1 = 72, mas estilo e textos finais = 80.
font/family/sans = Manrope, mas os estilos Text e sua aplicação final usam Inter.
Seguir propriedades efetivas da Home nesses casos; não alterar o Figma.
O código atual importa apenas Manrope: adicionar Inter local na etapa 2.

223 nós de texto: 143 reconhecidos pelos estilos locais e 80 sem estilo local reconhecido ou mistos.
Este grupo inclui ícones Phosphor, textos de componentes e exceções; não equivale a 80 erros.
Há também trechos Arial e Manrope Variable: revisar por seção antes de normalizar.
Detalhes em applied-styles.json.

### Cores de referência

| Papel/primitive | Valor |
| --- | --- |
| primary/500 | #66866c |
| primary/100 | #e3ece4 |
| primary/950 | #0e2820 |
| secondary/500 | #a8c94d |
| auxiliar azul/950 | #121f21 |
| gray/800 | #3b403c |
| static/white | #ffffff |

Preservar namespaces por coleção: primary/100 nas primitives e na coleção Opacidade são valores diferentes.
Não achatar tokens apenas pelo nome. Preservar aliases e modos no mapeamento CSS.

## Etapas de trabalho

Uma entrega por etapa, com preview e verificação desktop. Por orientação do Gilberto,
os ajustes responsivos ficam para depois da composição desktop. Buscar get_design_context
apenas dos blocos da etapa corrente para manter contexto pequeno.

| Etapa | Escopo | Entrega |
| --- | --- | --- |
| 1 — concluída | Figma, variables, grid, estilos e inventário | Este documento e snapshots |
| 2 | Fundamentos CSS, fontes, header e hero | Primeiro trecho fiel ao Figma, prompt conectado ao chat existente |
| 3 | Intro e Steps | Composição editorial, fotos e abas com interação preservada |
| 4 | Vídeo e Bento | Novo acabamento; manter WebM final, scrub lento, progresso e interações úteis do bento |
| 5 | 3D e Details | Reintegrar Comfort otimizado e construir apresentação de produtos conforme variantes finais |
| 6 | Comparação, relatos e confiança | Refinar comparador, cards expansíveis e quatro colunas de confiança |
| 7 | FAQ, CTA e footer; revisão integrada | Finalizar página e verificar responsividade, teclado, movimento reduzido e desempenho |

## Mapa Figma → implementação

| Seção | Node | Reutilização e mudança |
| --- | --- | --- |
| Header | 2204:8713 / 2204:8762 | Menu e CTA funcionais; reconstruir visual e estados |
| Hero | 2223:9639 | Reusar prompt-controller.js; implementar fotografia, composição, ícones e detalhes finais |
| Intro | 2128:1059 | Refazer tipografia, fotos e espaçamento |
| Steps | 2128:1638 | Reusar seleção das abas; substituir apresentação visual e mídia |
| Video | 2128:1753 | Reusar motion.js e manifesto-scroll.webm; ajustar composição/progresso |
| Bento | 2128:1837 | Manter intenções e ações dos cards; aplicar grid, fotos e acabamento finais |
| 3D | 2128:1907 | Preservar bottle.js, bottle-performance.js e GLB; ajustar tipografia, layout e detalhes |
| Details | 2128:1937 | Novo painel visual e variantes; reaproveitar catálogo e acesso aos produtos |
| Compair | 2128:1972 | Refinar o comparador existente e sua apresentação |
| Testmonial | 2128:2099 | Preservar stories.js, teclado, pausa e descarte; aplicar visual final |
| Bullets | 2128:2165 | Refazer composição e ícones, agora com quatro colunas |
| FAQ | 2134:2199 | Reusar acordeão, alinhar visual e conteúdo |
| CTA | 2134:2236 | Implementar imagem de fundo, sobreposição e botão |
| Footer | 2134:2249 | Manter navegação e comportamento; aplicar proporções e logo finais |

## Implementação e limites da leitura

O app é Vite + JavaScript/HTML/CSS, GSAP e Three.js. Não introduzir React/Tailwind
a partir do código gerado pelo MCP. Reconstruir a camada visual por seções, reaproveitando
controladores, dados, chat e rotas que já funcionam.

O Storybook extrai markup de index.html via src/landing/catalog.js. Manter uma única
fonte de componentes e atualizar essa extração se houver modularização.
O chat compartilha estilos: limitar os novos tokens/seletores à Home até revisar impactos.

Há alterações locais em vídeo, barra, 3D e testes. Não resetar a árvore nem sobrescrever
as otimizações do frasco. Continuar em main conforme orientação existente.

Motion: o Figma retornou 16 nós animados ligados a uma timeline de 38 segundos em loop.
Há rotações nos gráficos e traços de ícones em Details. Dados preservados em motion.json.
Não converter automaticamente todas essas animações em scroll: distinguir loops do Figma
e interações de scroll já autorizadas.

O snapshot analisado é desktop; não foi identificado um frame mobile correspondente
nesta leitura. Derivar responsividade com o grid e o conteúdo, registrando decisões por etapa.
As imagens do hero, bento, comparador e CTA agora fazem parte da fonte visual final.
Exportar assets exatos por etapa e preservá-los localmente; URLs temporárias do MCP expiram.

O Figma contém copy nova de atributos/resultados e FAQ antiga sobre retenção de fotos.
Na etapa correspondente, conciliar o texto com o funcionamento real do chat e manter
o caráter conceitual/ilustrativo do catálogo. Não fazer o código afirmar retenção apenas
em memória quando a implementação usa histórico local persistente e envio autorizado.

## Arquivos desta etapa

- foundations.json — collections, valores/aliases, estilos, grid e geometria das seções.
- applied-styles.json — uso efetivo das fontes, estilos e amostras por seção.
- motion.json — dados de animação retornados pelo Figma.
- hero-context.txt — contexto de implementação do hero; referência, não código de produção.
- home-reference.png — visão geral do Figma final.

## Etapa 2 — desktop implementado

Referência de validação: 1440 × 930 px. Header e hero recebem `.home-final`,
com tokens locais em `src/landing/foundations.css`, sem alterar as outras seções.
Manrope Variable e Inter Variable são servidas localmente.

O hero usa a fotografia e os ícones exportados do Figma, composição em camadas,
coluna de 570 px, prompt de 524 px e bloco lateral. Os PNGs originais estão em
`assets/`; as duas versões WebP servidas somam aproximadamente 489 KB
(em vez de 15,7 MB). A foto base tem 3684 px de largura para telas densas.

O header fixo usa os dois estados do Figma: claro sobre a fotografia e branco
com logo escuro/CTA verde após o hero. A mudança acompanha também o retorno ao
topo. O CTA mantém o foco no prompt; sugestões, anexos e conversa continuam usando
os mesmos controladores. O header isolado no Storybook não fica fixo.

Validação: revisão visual em 1440 × 930, sugestões do prompt e ida/volta das
âncoras; console sem erros. `build:review`, `build` e `format:check` passaram.
Na suíte de 154 testes, 153 passaram inicialmente. O cenário de componentes da
landing perdeu seus arquivos durante uma recompilação concorrente; após reconstruir
os Storybooks, a repetição isolada desse cenário passou, sem mudança nos testes.

Esta entrega não aplica ainda as composições finais às seções seguintes.
Próxima entrega: etapa 3, Intro e Steps no desktop. Responsividade refinada fica
para a rodada posterior conforme solicitado.


## Home completa — implementação desktop

O pedido posterior do Gilberto ampliou a entrega para todas as seções. As etapas 3–7 foram implementadas em conjunto, mantendo o refinamento responsivo para a próxima rodada.

- Hero: duas variantes do componente 2223:9717, intervalo de 10 segundos e transição de 300 ms, com avançar/voltar/pausar. Um único prompt mantém rascunho e anexos entre slides. Pausa em edição, fora da tela, aba oculta e movimento reduzido.
- Intro/Steps: fotos exportadas, composição e imagem sincronizada com cada aba.
- Vídeo/Bento: nova composição, WebM lento existente e ações reais dos cards.
- 3D: preservado o Comfort 50 ml interativo e otimizado, com novo acabamento da seção.
- Details: Comfort, Cleanse e Balance possuem painéis visuais próprios, abas por teclado e acesso aos modais existentes.
- Comparador: três pares de imagens ilustrativas do Figma e controle contínuo acessível.
- Relatos, Clareza, FAQ, CTA e rodapé: nova composição desktop com comportamento preservado.
- SVGs aprovados depois do Figma: quatro Highlights animados em Clareza e orb-glass em Steps/Bento, servidos como img sem modificar os originais.

Os novos seletores ficam em `src/landing/page-final.css`; os controladores do hero e painéis ficam em `hero-slider.js` e `final-panels.js`. Originais exportados e contextos de variantes estão nesta pasta; os rasters servidos são WebP. As máscaras do CTA e os traços dos ícones usam SVGs exportados, sem redesenho. Os ciclos de traçado dos ícones do catálogo não foram transpostos; estão estáticos.

Diferenças deliberadas: a seção 3D mantém o modelo Comfort aprovado; métricas, comparações e selo têm indicação conceitual; FAQ preserva informações compatíveis com consentimento e histórico local do chat. As alturas do vídeo/3D incluem a distância necessária para scroll, portanto a altura total da página difere do frame estático.

A auditoria WCAG encontrou contraste insuficiente em texto secundário (#707872) e no destaque verde da Intro (#88a43d). A camada aplicada usa #606a63 e #809838, respectivamente, mantendo o matiz e a hierarquia com contraste legível. Os snapshots dos tokens do Figma permanecem originais.

### Verificação final

- `npm run build:review`: aprovado (app, empacotamento Sites e dois Storybooks).
- `npm test`: 154 dos 155 cenários passaram inicialmente; o cenário restante apontou somente os contrastes descritos acima. Após a correção, esse cenário completo de componentes da Home passou novamente, incluindo overflow desktop/mobile e acessibilidade.
- `tests/final-home.test.mjs`: aprovado também com avanço automático real após 10 s, troca manual mantendo rascunho, reduced motion, teclado no catálogo, abertura de produto, etapas e três pares de comparação.
- `npm run format:check` e `git diff --check`: aprovados.
- Revisão visual local: hero, Steps, Bento, catálogo, manifesto, Clareza, CTA e rodapé em 1440 px; orb conferido também em 390 px, sem overflow horizontal.
- Preview local em http://127.0.0.1:4173/. Sem commit, push ou publicação nesta entrega.

## Refinamento de interações — 20/09/2026

Pedido posterior: retirar controles do hero, fixar menu apenas depois dele, automatizar Steps, revisar texto do vídeo, simular digitação no Bento e revelar a marca do rodapé com scroll.

- Hero mantém os dois slides e 10 segundos por imagem, sem botões; foco no compositor suspende o ciclo.
- Steps usa ciclo de 8 segundos e linha de progresso na aba ativa; clique/teclado, anterior/próxima e pausa continuam disponíveis. Foco nas abas suspende avanço para evitar mudanças durante leitura por teclado.
- Hero, Steps e digitação usam um relógio compartilhado descartável, com suspensão fora da tela, documento oculto e movimento reduzido.
- Bento alterna três perguntas sobre Comfort, Cleanse e Balance. O nome acessível do botão permanece constante; a digitação não dispara anúncios por caractere nem envia mensagens.
- Vídeo: Figma 2128:1753 confirmado novamente; bloco em x=60, y=232 na referência 1440×871, largura 642, gaps 24; removido translateY herdado. Círculo de progresso alinhado ao mesmo bloco.
- Rodapé: máscara vertical reversível via ScrollTrigger; revela a marca inteira até o fim do documento. O espaço do texto é estável durante o scroll e o modo de movimento reduzido mostra a marca inteira.
