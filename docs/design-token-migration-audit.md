# Auditoria da migração de design tokens

Estado final da branch `orafaelcoronel/ds-storybook`, baseado no export
`design-tokens/source-figma-export.json` e nas quatro capturas fornecidas em 19 de
setembro de 2026.

## Resultado

| Camada               | Fonte                                                        | Resultado no projeto                                           |
| -------------------- | ------------------------------------------------------------ | -------------------------------------------------------------- |
| Primitivos           | `_Colors Primitives`                                         | 90 cores geradas em `src/tokens/generated/colors.css`          |
| Semânticos           | `1 · Semantic Colors` no JSON; `02 · Semantic` nas capturas  | 65 variáveis e 130 aliases Light/Dark em `semantic-colors.css` |
| Dimensões            | coleções de tipografia, espaço, raio, borda e opacidade      | 60 variáveis CSS em `dimensions.css`                           |
| Funções de interface | decisão de implementação, não uma coleção adicional do Figma | papéis `--ui-*` para landing e `--sx-*` para conversa          |
| Componentes          | landing, chat e ambos os Storybooks                          | valores consumidos por função, sem depender da ordem do JSON   |

O export contém 215 variáveis no total. Os IDs nativos dos aliases semânticos não
foram inferidos: os 130 vínculos foram confirmados nominalmente pelas capturas e
ficam registrados em `design-tokens/semantic-aliases.json`. Os valores hexadecimais
dos primitivos continuam vindo exclusivamente do JSON original.

## Fluxo aplicado

`source-figma-export.json` → `semantic-aliases.json` →
`scripts/build-design-tokens.mjs` → `src/tokens/generated/` →
`src/tokens/functional.css` → landing, conversa e Storybook.

O compilador falha quando um alias muda, aponta para um primitivo ausente ou quando
os arquivos gerados deixam de corresponder à fonte. Reordenar os primitivos não
altera o resultado.

## Substituições concluídas

| Antes                          | Depois                                                                                 | Motivo                                             |
| ------------------------------ | -------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Hexadecimais na paleta raiz    | aliases `--ink`, `--paper`, `--sage`, `--lime`, `--line` e marca ligados a `--color-*` | uma única fonte de verdade                         |
| Cores locais na landing        | papéis funcionais `--ui-*`                                                             | separar intenção do tom primitivo                  |
| Cores locais no chat           | papéis escopados `--sx-*`                                                              | compartilhar semântica sem acoplar o tema proposto |
| Estilos inline do check-in     | classes com tokens de texto secundário                                                 | permitir tema, contraste e manutenção              |
| Renderer e CSS antigos do chat | arquivos removidos após auditoria de imports                                           | eliminar 726 linhas desconectadas                  |
| Verificação manual apenas      | testes de geração, aliases, temas e ausência do shell legado                           | impedir regressão silenciosa                       |

## Exceções deliberadas

- `src/product-story.css` mantém cores fixas da direção de arte 3D, inclusive o
  fundo obrigatório `#0E2820`; essa seção não deve inverter com o tema.
- `.storybook-hifi/proposed-theme.css` mantém a proposta high-fidelity isolada e
  não redefine o produto final.
- Sombras translúcidas continuam como valores locais porque descrevem efeitos,
  não cores semânticas de conteúdo.
- Os nomes de compatibilidade da landing permanecem temporariamente, mas agora são
  aliases de tokens e não armazenam valores próprios.

## Verificação

- Light e Dark são expostos nas histórias `Fundamentos / Tokens Figma`.
- Wireframe e alta fidelidade validam texto, superfícies, ações, foco, overflow,
  mobile e acessibilidade em componentes isolados.
- `npm run tokens:check`, `npm run format:check`, `npm run build:review` e
  `npm test` formam a barreira de entrega.

Nenhuma mudança foi feita no arquivo Figma, e esta auditoria não afirma que os IDs
nativos do export foram confirmados.
