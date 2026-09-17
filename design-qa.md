# Design QA — SkinBoost HTML

**final result: passed**

## Escopo e evidências

Wireframe de alta fidelidade solicitado em HTML. A solicitação é uma adaptação criativa da Nolla e dos anexos, com hierarquia e espaçamento; não uma cópia pixel a pixel. Comparação realizada no nível de composição e funcionalidade.

- Fontes visuais: URLs Nolla home/skincare, visitadas e capturadas no navegador; `references/hero-reference.png` (anexo eyehealth) e `references/product-reference.png` (anexo Sofi).
- Implementação: http://127.0.0.1:4173/ . `qa/hero-desktop.png`, `qa/product-desktop.png`, `qa/comparison-desktop.png`, `qa/catalog-desktop.png`, `qa/hero-mobile.png`, `qa/product-mobile.png`, `qa/mobile-full.png`, `qa/bento-mobile.png`.
- Comparações conjuntas: `qa/hero-comparison.png`, `qa/product-comparison.png`. Referência e implementação reunidas na mesma prancha para observar fotografia/forma, proporções, respiro e títulos. Referências contêm canvas externo; ele está preservado e não foi interpretado como margem da página implementada.
- Desktop: viewport CSS 1440 × 1000; captura 1440 × 1000. Mobile: 390 × 844; captura 390 × 844. Teste adicional de overflow a 360 × 800. Imagens normalizadas em pranchas de 1440 × 640, mantendo proporções. Não foi alegada correspondência geométrica exata entre as fontes com diferentes proporções.
- Estados: hero inicial, seção 3D em posição intermediária do scroll, comparação em 50/51%, processo, modal de contexto/resultado, check-in, relatos, FAQ e navegação mobile.
- Regiões detalhadas: hero mobile, produto mobile, comparação desktop e crop integral do bento mobile, abertos separadamente para verificar legibilidade.

## Superfícies de fidelidade

- **Tipografia:** sans limpa, títulos grandes com peso regular, tracking compacto e largura controlada. Stack local sem dependência de fonte externa. Quebras verificadas em desktop e 390 px. Uso de sans em vez do serif do primeiro wireframe é intencional, seguindo a nova direção. Captions menores permanecem secundárias; conteúdo essencial usa corpo de 14–18 px.
- **Espaçamento:** margens de 7%/24 px, seções amplas, composição assimétrica no hero, grade responsiva, separação entre títulos e controles. Nenhum overflow horizontal em 1440, 390 ou 360 px.
- **Cores:** marfim, verde profundo, sálvia e branco adaptam a direção Ciência sensível à composição das referências. Seção escura do frasco preserva o contraste solicitado. Bordas e superfícies distinguem grupos sem excesso de sombras.
- **Imagens e 3D:** hero sintético original com rosto à direita e área de leitura à esquerda; fotografia conceitual existente no catálogo; comparação sintética identificada. Frasco em WebGL de fato, não um desenho CSS ou imagem achatada. Materiais são suficientes para validar o layout de um wireframe; uma rodada final de lookdev pode elevar a apresentação do produto.
- **Conteúdo:** objetivo principal é o prompt, foto opcional, demonstração explícita, produtos fictícios e relatos de personas identificados. Nenhum diagnóstico, score de beleza, certificação ou depoimento de cliente inventado.

## Histórico de correções

1. **P1 — imagem alternativa aparecia sobre o canvas 3D.** Regra global `img { display:block }` sobrepunha o atributo hidden. Corrigido com `[hidden] { display:none!important }`. Rotação do rótulo também ajustada. Evidência posterior: `qa/product-desktop.png`.
2. **P2 — família de produtos cortada verticalmente.** A caixa fixa com cover cortava o topo do Cleanse. Ajustada proporção da vitrine e fit, com regra própria para celular. Verificação posterior no navegador e captura final da página.
3. **P2 — card isolado no bento mobile.** A organização original deixava uma célula vazia. Reordenados os cards, com privacidade e explicação lado a lado e foto em largura completa. Texto separado do enquadramento do produto. Evidência posterior: `qa/bento-mobile.png`.
4. **P2 — frasco sobre o título mobile.** Escala e posição do modelo reduzidas apenas nesse breakpoint. Evidência posterior: `qa/product-mobile.png`; título, frasco e chamadas ocupam áreas separadas.

Não restam achados P0/P1/P2 na revisão final. A atualização do catálogo foi inspecionada novamente após o ajuste.

## Interações verificadas no navegador

- Sugestão preenche o prompt; envio abre contexto; envio do contexto mostra loading e resultado; resultado abre check-in; escolha e conclusão apresentam sucesso.
- Foto sintética local selecionada, nome/preview exibidos e removidos. Não houve chamada de IA ou envio da foto.
- Aba 02 altera o painel para “Cada escolha, explicada”.
- Slider por teclado altera de 50 para 51 e atualiza o corte.
- Próximo relato muda Lucas para Marina.
- Menu mobile abre e a navegação leva à seção escolhida.
- FAQ abre resposta.
- Vídeo apresentou tempo 0 s antes do trecho e 5,146 s após avançar o scroll; controle altera para retomar movimento. MP4 local com duração 6 s.
- Canvas WebGL carregado e frasco observado em desktop e celular; rótulo visível, giro e tampa vinculados ao scroll.
- Logs inspecionados: nenhum erro/warning local da aplicação. Erros de referências visitadas anteriormente foram separados pelos respectivos URLs.

## Limites e refinamento posterior

- CSS e lógica atendem prefers-reduced-motion; a preferência do sistema não foi alterada para teste automatizado.
- Revisão em navegador desktop com viewports mobile; aparelho físico não testado.
- Vídeo de estudo com movimento de câmera, sem filmagem final. Refinamento de materiais e iluminação do frasco pode ocorrer após aprovação da estrutura.
- Build de produção concluído. A publicação não faz parte desta entrega.

## Checklist

- [x] Hierarquia, margens e proporções verificadas.
- [x] Fontes, cores e imagens revisadas.
- [x] Fluxo principal e controles testados.
- [x] Desktop e mobile verificados.
- [x] Achados P1/P2 corrigidos e recapturados.

## Revisão sem imagens — 17/09/2026
- Zero elementos img, video ou canvas na página. Sem referências a arquivos de mídia no HTML, CSS e JS ativos.
- Conferido em desktop e 390px: sem overflow horizontal; espaços reservados presentes.
- Fluxo do prompt abre o formulário; comparador preservado.
- Build e quatro testes Sites aprovados.

## Restauração dos produtos — 17/09/2026
Frasco 3D original e imagens de produtos no bento, catálogo e modal restaurados. Hero, vídeo de pele e antes/depois continuam como placeholders. Build e quatro testes Sites aprovados; referências ativas verificadas sem imagens de pessoas.
