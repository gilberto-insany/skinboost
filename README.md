# SkinBoost — uma conversa contínua, com escolhas explicadas

Protótipo de skincare orientado por intenção. A pessoa escreve, recebe uma resposta e continua no mesmo histórico. Sugestões acrescentam mensagens; resumo, rotina, fontes, gráficos, seleção e check-in aparecem dentro da conversa. O campo de mensagem permanece disponível. A landing, o frasco Comfort GLB, suas interações e a identidade sálvia/marfim foram preservados.

## URLs de revisão

- [App](https://skinboost-design-review.vercel.app/)
- [Conversa](https://skinboost-design-review.vercel.app/chat)
- [Guia didático](https://skinboost-design-review.vercel.app/guia.html)
- [Brandbook](https://skinboost-design-review.vercel.app/brandbook.html)
- [Storybook do wireframe](https://skinboost-design-review.vercel.app/storybook/wireframe/)
- [Storybook da proposta visual](https://skinboost-design-review.vercel.app/storybook/alta-fidelidade/)

O segundo Storybook aplica os fundamentos do brandbook à mesma implementação. Está identificado como **proposta em revisão**, sem apresentar a alta fidelidade como final aprovada.

## O que experimentar

- Conte uma necessidade em uma frase própria: acne declarada, oleosidade, ressecamento ou cuidado geral. Acrescente preferências e o que já usa.
- Responda pelo composer ou por uma sugestão. Confira que sua resposta entra no histórico como mensagem.
- Revise o contexto entendido e peça uma correção. As mensagens anteriores permanecem acessíveis.
- Explore a proposta: imagem conceitual, motivo de cada produto, custo ilustrativo e fontes com limites explícitos.
- Compare valores, retire itens e revise a seleção no próprio fluxo. Não existe pagamento ou envio de pedido.
- Explore outra opção preservando a original, confira a origem do contexto e guarde um resumo revisável.
- Sinalize um problema numa resposta; a avaliação fica localmente na conversa e oferece caminhos de correção.
- Pare uma resposta em curso e tente novamente preservando o pedido. Se estiver lendo acima, volte pelo botão de mensagem mais recente.
- Quando a transcrição estiver disponível, dite, revise o rascunho e envie explicitamente.
- Faça um check-in e continue conversando. Abra outra conversa pelo menu, retome uma anterior e recarregue a página para conferir a persistência local.
- Remova uma foto ou exclua uma conversa e confira o efeito. No celular, a lista de conversas fica no menu lateral.
- No modo conectado, anexe uma foto de teste autorizada e peça **Analisar minha foto**. Confira observações, limites, pergunta de confirmação e conceitos de produto; abra a página original do PDF indicada no card.
- Quando o serviço de imagem estiver disponível, anexe uma foto, autorize seu envio e solicite uma **ilustração estética**. A imagem não prevê o efeito de produtos, melhora clínica ou prazo de resultado.
- Use o comparador de **Original** e **Ilustração com IA**, também pelo teclado. A análise não gera uma imagem automaticamente: a ilustração precisa ser solicitada.

## Demonstração e OpenAI

`/chat` monta a experiência com `liveApi: true` e consulta `/api/status`. Sem configuração no servidor, usa o modo **Demonstração**, com regras locais e cenários conhecidos. Com a integração habilitada, mensagens são processadas no servidor e encaminhadas à OpenAI. Ter uma chave configurada não prova que o modelo esteja acessível: a conexão deve ser confirmada com uma resposta real bem-sucedida.

Os Storybooks sempre usam `liveApi: false`. Seus exemplos são locais e determinísticos, sem chamadas à API. Os testes verificam essa separação.

### Configuração do servidor

| Variável                     | Uso                                                                                     |
| ---------------------------- | --------------------------------------------------------------------------------------- |
| `OPENAI_API_KEY`             | Chave secreta do servidor. Necessária para chat e imagem; nunca recebe prefixo `VITE_`. |
| `OPENAI_CHAT_MODEL`          | Modelo do chat. O padrão está em `DEFAULT_CHAT_MODEL` de `server/openai-api.mjs`.       |
| `OPENAI_IMAGE_MODEL`         | Modelo de edição de imagem. O padrão está em `DEFAULT_IMAGE_MODEL` do mesmo arquivo.    |
| `OPENAI_TRANSCRIPTION_MODEL` | Modelo usado pelo serviço de transcrição; padrão em `DEFAULT_TRANSCRIPTION_MODEL`.      |
| `SKINBOOST_ALLOWED_ORIGINS`  | Origens HTTPS adicionais, separadas por vírgula, para domínios próprios autorizados.    |

Configure segredos no ambiente do projeto Vercel. Localmente, o middleware Vite usa as variáveis do processo Node. Um arquivo `.env.local` ignorado pelo Git pode ser carregado explicitamente com `node --env-file=.env.local node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4173`. Não coloque a chave em stories, argumentos, código do cliente, screenshots ou arquivos públicos.

| Endpoint             | Comportamento                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------- |
| `GET /api/status`    | Informa disponibilidade configurada, sem expor chave. Não testa a validade da credencial no provedor.         |
| `POST /api/chat`     | Valida texto e eventual foto consentida; retorna texto progressivo e, ao concluir, contexto, observações e fontes estruturadas. |
| `POST /api/simulate` | Exige foto e consentimento explícito; solicita uma edição ilustrativa e retorna imagem com rótulo e ressalva. |

`POST /api/voice-session` exige consentimento e cria uma credencial temporária de transcrição. O áudio segue via WebRTC à OpenAI; a chave permanente continua no servidor. A aplicação não grava nem persiste áudio. O texto transcrito fica no rascunho, pode ser editado e só vira mensagem com envio explícito. Disponibilidade configurada não comprova que microfone/rede/provedor funcionarão em todo navegador.

O backend valida origem, formato e tamanho do corpo e da foto, limita solicitações por instância e sanitiza erros. Os limites por instância não equivalem a uma quota global de produção. A integração é compartilhada pelo middleware local e pelas funções Vercel.

## Foto, dados e limites

A foto é preparada no navegador e guardada localmente junto à conversa. Se há foto anexada sem autorização, o envio é bloqueado e foto e rascunho são preservados; remover o anexo permite seguir por texto. Marcar a autorização, sozinho, não envia nada. Com autorização ativa, a foto corrente acompanha as solicitações de chat e pode ser usada na ilustração quando a pessoa a solicitar. Uma nova foto, uma conversa retomada ou uma alternativa exigem nova autorização.

A análise conectada envia a imagem ao provedor e organiza observações para confirmar, limitações e eventuais relações com conceitos do catálogo. Uma imagem insuficiente recebe um estado de limitação; a demonstração local não inventa uma leitura visual. Os cards aparecem após a validação final da resposta e não representam diagnóstico ou rotina já confirmada. O fluxo e seus testes estão documentados em [Foto como entrada real da conversa](docs/photo-experience.md).

As fontes dos cards abrem excertos originais das páginas 6, 7, 13 e 26 do brief SkinBoost. A página 13 documenta os conceitos Cleanse, Balance e Comfort e informa que fórmulas, rotulagem e alegações ainda não foram desenvolvidas. Não há ingredientes, eficácia, indicação individual ou prazo de efeito comprovados pelo PDF. Veja a [proveniência dos excertos](public/sources/README.md).

Conversas, mensagens, preferências, artefatos e fotos ficam no armazenamento local deste navegador e podem ser retomados após recarregar a página. A lista lateral permite abrir uma conversa salva ou começar outra; iniciar uma nova conversa não exclui as anteriores. A exclusão remove a cópia local da conversa selecionada. Limpar os dados do site também remove esse histórico. Não existe sincronização entre navegadores ou dispositivos, nem uma conta com histórico na nuvem.

No modo conectado, o conteúdo necessário é processado pelo servidor e pela OpenAI. Remover o anexo retira a foto dos próximos pedidos, mas não apaga imagens já presentes em mensagens; excluir a conversa remove seu registro local. Essas ações não representam exclusão nos sistemas do provedor. A chamada de chat usa `store: false`; isso não substitui a política de retenção do provedor nem descreve logs técnicos da hospedagem. O armazenamento local e o envio autorizado para processamento são operações distintas.

O catálogo, preços e comparações são fictícios. A proposta não é diagnóstico, prescrição ou comprovação de eficácia. A ilustração facial mantém rótulo visível de **ilustração, não previsão**; não deve representar cura, remoção garantida de acne ou cicatrizes, rejuvenescimento em anos ou antes/depois comprovado.

As referências da American Academy of Dermatology são educacionais, sem vínculo, aprovação ou endosso dos produtos SkinBoost. Nolla é uma referência de padrão de conversa, não uma fonte de evidência clínica para o catálogo. Aumento de conversão permanece uma hipótese a avaliar.

## Código

- `src/main.js` e `src/landing/`: entrada, interações e movimento da landing preservada.
- `src/chat/composer.js`: rota `/chat`, lista de conversas e retomada do histórico local.
- `src/chat/voice-input.js`: captura autorizada, transcrição e ciclo de revisão do rascunho; nunca envia uma mensagem automaticamente.
- `src/chat/conversation-tools.js`: alternativas independentes, proveniência de contexto e notas revisáveis.
- `src/chat/thread-state.js`: mensagens, cenários, contexto e ações da demonstração contínua.
- `src/chat/session-store.js`: armazenamento IndexedDB das 20 conversas mais recentes, restauração sem consentimento de foto e exclusão local.
- `src/chat/photo.js` e `photo-experience.js`: preparação local, observações, cards com fontes permitidas e comparador de imagem.
- `src/experience.js` e `src/experience.css`: chat real compartilhado pelo app e pelos Storybooks; composer persistente e artefatos no histórico.
- `src/routine.js`: catálogo, validações e seleção demonstrativa.
- `server/openai-api.mjs`: configuração e validação da integração OpenAI.
- `server/photo-contract.mjs` e `skinboost-grounding.mjs`: contrato estruturado de foto e catálogo documental com IDs e fontes permitidos.
- `server/chat-stream.mjs` e `src/chat/response-stream.js`: transmissão e leitura progressiva; metadados somente após conclusão validada.
- `api/status.js`, `api/chat.js`, `api/simulate.js` e `api/voice-session.js`: funções do deploy.
- `src/stories/`, `.storybook-wireframe/`, `.storybook-hifi/`: stories CSF3 comuns, fundamentos e temas independentes.
- `public/guia.html`: decisões de experiência e roteiro de avaliação.

Os modelos anteriores de conversa permanecem como histórico de evolução com seus testes. A experiência ativa usa o histórico contínuo; não inicializa dois controladores de rota. O pipeline e os arquivos de empacotamento Sites foram mantidos, e a revisão usa um projeto Vercel separado.

## Desenvolvimento e verificação

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 4173 --strictPort
npm run storybook:wireframe  # 6006
npm run storybook:hifi      # 6007
npm run build:review
npm test
npm run format:check
node scripts/check-experience.mjs
node scripts/check-chat-upgrades.mjs
node scripts/check-photo-experience.mjs
```

Sem chave, os comandos locais usam a demonstração. Os testes de API usam respostas controladas e não comprovam uma chamada real ao provedor. O QA da interface gera evidências em `qa/`, ignorado pelo Git. Playwright requer Chromium instalado ou `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`; o QA Storybook também aceita `STORYBOOK_CHROME`.

`build:review` compila o app e os arquivos Sites antes de criar os dois Storybooks em `dist/client/storybook/`. Execute-o antes dos testes de Storybook. Esses testes verificam cenários, mensagens livres, sugestões, histórico preservado, composer persistente, seleção vazia, teclado, viewport móvel, fontes dos temas e axe. `vercel.json` publica `dist/client` e resolve `/chat` para a aplicação.

## Mídia e fundamentação

Produtos e embalagem 3D são conceituais. O frasco Comfort 50 ml usa `public/models/skinboost-comfort.glb`, carregado sob demanda com alternativa de imagem. Os retratos de Lucas, Marina e Denise são pessoas fictícias geradas por IA e identificadas como tal. Hero, vídeo editorial, pele e antes/depois da landing continuam placeholders. Mídia arquivada fica em `design/archive/`, fora da publicação.

O [roteiro de Design Boost](https://leandro-boost.vercel.app/roteiro) e o [guia didático](https://skinboost-design-review.vercel.app/guia.html) relacionam intenção, esclarecimento, contexto revisável, artefatos acionáveis, fontes, recuperação e controle à experiência. Os cenários de revisão devem observar esses comportamentos antes de atribuir resultados à interface.

## Rastreabilidade do roteiro

A [auditoria slide a slide](docs/roteiro-chat-audit.md) mapeia os 68 slides da aula para comportamento, evidência e limites do chat. Ela distingue a posição pública do slide de seu `keyId` interno, registra as lacunas da base `e10ea56` e define critérios verificáveis para as mudanças. O guia tem links diretos aos princípios de cada trecho da aula. Não se deve tratar uma demonstração do roteiro como capacidade já implementada do produto.

O QA das melhorias intercepta os endpoints pagos e usa voz determinística identificada. Verifica controle de espera, posição de leitura, alternativa, origem, notas e feedback em desktop e mobile. Isso prova o comportamento da interface com respostas controladas; não comprova transcrição real nem qualidade de resposta do provedor.

O chat solicita `text/event-stream`: trechos de texto podem ser exibidos antes da conclusão, enquanto contexto e artefatos dependem do evento final validado. O leitor também aceita a resposta JSON completa. Uma interrupção preserva o conteúdo recebido com indicação de incompleto; exibição progressiva não garante correção nem conclusão.

### Histórico de integrações verificadas

Em 18 de setembro de 2026, o deploy de revisão recebeu uma resposta real de chat por SSE: HTTP 200, 39 deltas, 161 caracteres, primeiro trecho em 2.005 ms e resultado validado em 2.661 ms. Texto final e contexto estavam presentes. Esse resultado confirma uma chamada; não representa benchmark nem latência garantida. Evidência local: `qa/stream-live/report.json`.

A transcrição real também passou 11 verificações em Chromium com um WAV sintético em português usado como microfone simulado: sessão 200, WebRTC 201, duas atualizações durante a escuta, rascunho anterior preservado, nenhum envio automático e captura encerrada. O rascunho transcrito reapareceu após recarregar. Evidência: `qa/voice-live/report.json`; [contrato e procedimento](docs/voice-streaming.md).

Não foram testados microfone físico, Safari em aparelho, variedade de sotaques/ruídos ou qualidade ampla de transcrição. O teste automatizado demonstra o fluxo com áudio sintético, sem provar funcionamento em todo dispositivo. Naquela revisão, a suíte passou 122 testes e os dois Storybooks passaram quatro grupos com 36 cenários no total. Essas contagens são históricas e não certificam automaticamente as mudanças posteriores de foto.

A revisão de foto acrescenta QA com respostas e imagens controladas em desktop e mobile: consentimento, observações e fontes, comparação por teclado, recuperação e restauração. Esse teste exercita a interface implementada; suas capturas não comprovam nova análise ou geração real pelo provedor. Resultados atuais de produção devem ser registrados separadamente após execução. A [arquitetura atual](docs/architecture.md) detalha as responsabilidades e a separação entre demonstração, API e evidência.
