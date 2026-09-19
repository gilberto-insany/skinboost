# Estrutura e evolução

Estado documentado em 18/09/2026. A experiência ativa é uma conversa contínua, com demonstração local e integração de servidor com a OpenAI. Este documento descreve o código, sem declarar uma nova homologação em produção. Evidências e limites estão no [README](../README.md), em [voz e streaming](voice-streaming.md) e no [fluxo de foto](photo-experience.md).

## Entradas e hospedagem

- `index.html`, `src/main.js` e `src/landing/`: landing, interação, movimento e passagem do pedido e da foto para o chat.
- `/chat`: mesma aplicação, com navegação e retomada controladas por `src/chat/composer.js`. A Vercel reescreve a rota para `index.html`.
- `brandbook.html` e `public/guia.html`: marca e decisões de experiência.
- `src/stories/`, `.storybook-wireframe/` e `.storybook-hifi/`: dois Storybooks que montam o mesmo renderer com `liveApi: false`, sem chamadas ao provedor.
- `api/`: funções de servidor da revisão Vercel. `vite.config.mjs` expõe a integração no desenvolvimento local.
- `worker/index.js`, `scripts/prepare-sites-build.mjs` e `.openai/hosting.json`: empacotamento Sites preservado. A revisão Vercel usa `vercel.json` e `dist/client`; outras formas de hospedagem não oferecem automaticamente as mesmas APIs.

## Responsabilidades do chat

| Módulo | Responsabilidade |
| --- | --- |
| `src/experience.js` e `.css` | Renderer compartilhado, composer, mensagens, artefatos, envio, consentimento, espera, erro, repetição e cancelamento. |
| `src/chat/thread-state.js` | Contexto acumulado, mensagens, revisão e seleção; regras da demonstração e aceitação do resultado estruturado do servidor. |
| `src/chat/conversation-tools.js` | Alternativas independentes, origem do contexto, correção, notas e feedback local. |
| `src/chat/session-store.js` | IndexedDB das 20 conversas mais recentes, restauração, remoção e erros de armazenamento. |
| `src/chat/photo.js` | Preparação local da imagem antes do envio. |
| `src/chat/photo-experience.js` | Observações, conceitos de produto, fontes permitidas e comparador acessível. |
| `src/chat/voice-input.js` | Captura autorizada, transcrição progressiva, revisão do rascunho e encerramento dos recursos. |
| `src/chat/response-stream.js` | Leitura do SSE da aplicação e da alternativa JSON; texto parcial separado do resultado final. |
| `src/routine.js` | Catálogo e seleção demonstrativa com orçamento, itens já usados e limites explícitos. |

Os módulos anteriores `src/chat/conversation.js` e `src/chat/chat.js` permanecem como histórico de evolução e têm testes próprios. Não descrevem o controlador ativo. A conversa atual aproveita dados declarados e pede esclarecimentos pertinentes, em vez de impor a antiga sequência fixa. Corrigir uma preferência preserva o restante do contexto; uma proposta alterada passa por nova revisão.

## Contrato do servidor

`server/openai-api.mjs` centraliza configuração, validação de entrada e origem, limites por instância e erros públicos. Segredos ficam no servidor, sem prefixo `VITE_`. Disponibilidade configurada não comprova uma chamada ao provedor.

| Endpoint | Contrato |
| --- | --- |
| `GET /api/status` | Disponibilidade configurada de chat, imagem e transcrição, sem credenciais. |
| `POST /api/chat` | Histórico textual recente, contexto e eventual foto consentida. Responses API com saída estruturada; SSE ou JSON completo. |
| `POST /api/simulate` | Foto e consentimento; edição ilustrativa, sem previsão de resultado. |
| `POST /api/voice-session` | Consentimento e credencial temporária. Áudio do navegador para a OpenAI via WebRTC. |

`server/chat-stream.mjs` decodifica somente o campo de texto progressivo. Contexto, opções, observações, relações de produto e fontes são aplicados após validação da resposta completa. Interromper cancela a solicitação corrente e preserva texto recebido como incompleto, quando aplicável; não prova que todo processamento remoto foi desfeito.

Entradas e campos retornados são tratados como dados na renderização. Links documentais são resolvidos por IDs permitidos, não por URLs livres do modelo. A validação estrutural reduz retornos inválidos, mas não comprova a verdade de cada frase.

## Foto, observações e fontes

A imagem é preparada no navegador: JPG, PNG ou WebP de até 10 MB, convertido para JPEG com maior dimensão de até 1536 px. Preparar e guardar não enviam o arquivo. O servidor aceita a imagem preparada de até 2 MB e verifica consentimento, formato, conteúdo e tamanho.

Com foto anexada sem autorização, o envio é bloqueado; foto e rascunho permanecem disponíveis. Remover o anexo permite seguir apenas por texto. No modo conectado, a foto consentida é uma entrada `input_image`. A demonstração local informa que a observação depende da conexão, sem inventar uma análise visual.

`server/photo-contract.mjs` define resumo, observações, limites e pergunta de confirmação. `observed` e `limited` distinguem uma observação utilizável de uma imagem insuficiente. O prompt orienta a não transformar inferência visual em relato declarado. A interface mantém “Para confirmar com você” e “O que esta foto não confirma”.

`server/skinboost-grounding.mjs` limita fontes às páginas 6, 7, 13 e 26 do brief. `public/sources/` publica somente esses quatro excertos com proveniência. Cleanse, Balance e Comfort são os únicos produtos conceituais; relações com o pedido precisam citar a página 13, que informa que fórmulas, rotulagem e alegações ainda não foram desenvolvidas. Categorias e preços do protótipo não comprovam eficácia ou adequação individual.

Os cards “Conceitos para explorar juntos” não são a rotina confirmada com seleção e total. A foto não produz diagnóstico nem comprova compatibilidade clínica. Referências educativas da AAD não endossam o catálogo.

A ilustração exige pedido explícito. Em pedido combinado, a observação acontece primeiro; a geração só continua com observação utilizável, sem encaminhamento de cuidado e sem invalidação da operação. O comparador distingue Original e Ilustração com IA, permite teclado e mantém aviso de não previsão e fonte na página 26. Restrições do prompt não equivalem a validação automática da fidelidade da imagem. Veja o [percurso completo](photo-experience.md).

## Estado, continuidade e privacidade

Conversas, rascunhos, contexto, feedback, fotos e artefatos ficam no IndexedDB deste navegador, limitado às 20 conversas mais recentes. Não há conta ou sincronização entre dispositivos. Falha de armazenamento tem uma explicação; manter a conversa aberta não garante sua recuperação depois.

Restaurar uma conversa ou criar alternativa reinicia `photoConsent` como falso. A alternativa herda uma cópia independente. Carregamento pendente não volta como operação ativa; uma tentativa interrompida pode oferecer repetição preservando o pedido.

Remover o anexo retira a foto dos próximos pedidos, mas não apaga imagens já presentes em mensagens. Excluir a conversa remove seu registro local. Nenhuma dessas ações promete exclusão no provedor. O chat usa `store: false`, sem substituir políticas de retenção e logs de infraestrutura.

A voz envia áudio para transcrição com consentimento. A aplicação preserva texto editável, não gravação. Concluir a escuta não envia uma mensagem automaticamente.

## Limites do produto

Catálogo, preços, comparação de custos e checkout são demonstrativos. Não há cobrança, entrega, prescrição ou comprovação clínica. Sintomas declarados podem motivar encaminhamento para cuidado, sem diagnóstico pela interface. Conversão é uma hipótese a avaliar, não resultado comprovado.

Uma etapa comercial exigiria catálogo validado, definição do serviço responsável, política de dados e critérios de avaliação. A existência do backend de IA não resolve essas decisões.

## Verificação e alcance

Comandos: `npm test`, `npm run format:check`, `npm run build:review`, `node scripts/check-experience.mjs`, `node scripts/check-chat-upgrades.mjs` e `node scripts/check-photo-experience.mjs`. O build de revisão prepara o app e ambos os Storybooks.

Testes unitários e QA com respostas controladas verificam contratos e comportamentos: consentimento, fontes, observação antes de completar toda a rotina, comparador por teclado, repetição sem duplicação e restauração sem autorização. Não comprovam qualidade clínica nem nova chamada ao provedor.

Registros históricos de chat SSE e transcrição reais estão identificados no README e em `qa/stream-live/` e `qa/voice-live/`, fora do Git. Contagens daquela revisão não certificam automaticamente alterações posteriores. Cada nova validação em produção deve identificar o que efetivamente executou.
