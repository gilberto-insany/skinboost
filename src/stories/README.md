# SkinBoost — componentes isolados, dois catálogos

Cada história do chat monta somente o componente que ela nomeia. Mensagens e cartões não trazem o histórico lateral, o cabeçalho, o compositor nem mensagens anteriores. Esses elementos de navegação têm histórias próprias. Não há aplicativo inteiro oculto por CSS ou montado fora da tela.

A aplicação e os catálogos compartilham os templates de `src/chat/experience-components.js`, os cartões de `photo-experience.js` e o controlador de comparação de imagens. `src/experience.js` monta o chat completo; `chat-component-preview.js` é apenas o adaptador do Storybook, com fixtures locais e callbacks apresentados em Actions. Não é uma segunda implementação da jornada.

| Catálogo        | Identidade                                                                 | Comando                       | URL publicada                 |
| --------------- | -------------------------------------------------------------------------- | ----------------------------- | ----------------------------- |
| Wireframe       | Componentes implementados por Gilberto e Leandro; Manrope e tokens do site | `npm run storybook:wireframe` | `/storybook/wireframe/`       |
| Alta fidelidade | Proposta do brandbook em revisão; Avenir com fallback local                | `npm run storybook:hifi`      | `/storybook/alta-fidelidade/` |

A alta fidelidade não é apresentada como identidade final aprovada. Os dois temas usam o mesmo inventário de componentes do chat. A landing atual permanece apenas no wireframe.

## Inventário do chat

48 histórias por tema, mantendo os identificadores anteriores para preservar links:

- Mensagem inicial, mensagem da pessoa e perguntas de acne declarada, oleosidade, cuidados gerais e ressecamento.
- Respostas rápidas, check-in, resposta em preparação, texto progressivo e resposta interrompida.
- Contexto revisável, origem nas mensagens e notas da conversa.
- Rotina, produto individual, ajustes, fontes educativas e de produto, comparação de valores, seleção e checkout de exemplo.
- Observações da foto, imagem limitada, escolha de produto, fontes, anexo com autorização, convite visual e comparador.
- Compositor de texto, erro com rascunho, foto anexada e ditado em andamento/revisável; autorização de voz separada.
- Cabeçalho, histórico com conversas e histórico vazio.
- Opções alternativas, contexto herdado, feedback registrado e motivos de feedback.
- Aviso de IA, conferência de informações, fontes e limites, privacidade.

Os templates são os mesmos da página. Ações que exigiriam outro componente ou uma conversa completa disparam callbacks na aba Actions, sem substituir o canvas por outra página. Seleção de produtos, detalhes expansíveis, estados de feedback, edição do rascunho, ditado demonstrativo e arraste do comparador permanecem interativos dentro do componente.

## Fixtures e limites

Cada montagem recebe estado independente, sem ler ou escrever conversas da pessoa. Não chama endpoints de IA, acessa microfone ou envia fotos. Voz usa texto determinístico; consentimento tem história própria. O retrato de Lucas é fictício e aparece igual nos dois lados do comparador: não é prova de tratamento ou resultado de produto. Preços e checkout são exemplos identificados como tais.

O aplicativo `/chat` continua com conversa completa, histórico persistido localmente, consentimento, API no servidor e as interações da jornada. Chaves e dados reais não pertencem aos stories. O adaptador descarta listeners, observadores e controladores ao desmontar.

## Verificação

`npm run build:review` compila o aplicativo e ambos os catálogos em `dist/client`. Depois, `npm run test:storybook` percorre **todos os IDs de stories do chat** em ambos os temas, verifica a ausência de elementos estranhos ao componente inclusive no DOM, interações, temas, ausência de chamadas de API, acessibilidade e layouts desktop/móvel. Relatório e capturas ficam em `qa/storybook/`, fora do Git. O tipo MIME da fixture JPEG é preservado no servidor de teste.

A jornada completa é verificada separadamente no aplicativo por `scripts/check-experience.mjs`; não se usa mais um Storybook de componente como teste de ponta a ponta do chat. `tests/storybook-review.test.mjs` também conserva a revisão dos fundamentos e das 34 histórias da landing. Para regressões de chat com API e voz controladas, usar `scripts/check-chat-upgrades.mjs` contra o servidor Vite.
