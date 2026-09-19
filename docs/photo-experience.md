# Foto como entrada real da conversa

Revisão de código em 18/09/2026. Este documento descreve o fluxo implementado e o alcance das fontes do case. Não declara uma validação clínica nem uma nova homologação em produção. A revisão não alterou o app, a apresentação ou o roteiro do projeto pai.

## A decisão de experiência

A foto deixou de ser apenas um anexo que acompanha o texto. A pessoa pode pedir uma observação da imagem e receber uma resposta visual organizada dentro da conversa, antes de completar todos os dados necessários para montar uma rotina. O sistema separa quatro coisas: o que aparece na imagem, o que a pessoa declara, o que o material do projeto documenta e uma eventual ilustração gerada por IA.

Essa separação é importante porque cada informação permite uma conclusão diferente. Brilho aparente em uma foto não confirma uma condição da pele. A preferência por poucos passos pode orientar uma composição demonstrativa. O nome de um produto no PDF não comprova que sua fórmula exista ou tenha um efeito. Uma imagem gerada também não demonstra o resultado de um produto.

## O percurso implementado

### 1. Preparar e mostrar a foto

O composer aceita JPG, PNG e WebP. A validação inicial verifica formato, extensão e um limite de 10 MB para o arquivo escolhido. A preparação acontece no navegador: a maior dimensão é reduzida para no máximo 1536 pixels e a imagem é convertida para JPEG. Essa preparação, por si só, não faz upload.

O anexo aparece com miniatura, nome e ação de remover. O texto já digitado permanece no composer. Uma nova imagem reinicia a autorização de envio. Falhas de leitura ou de formato mantêm uma saída pela troca do arquivo ou pela conversa sem foto.

Referências de código: `validatePhoto` em [routine.js](../src/routine.js), [photo.js](../src/chat/photo.js) e `onChange` em [experience.js](../src/experience.js).

### 2. Autorizar e escolher a ação

A autorização descreve dois usos: conversar sobre a imagem e, quando a pessoa pedir, criar uma simulação ilustrativa. Marcar a autorização não dispara uma requisição. A interface oferece **Analisar minha foto** e **Criar ilustração**, além do envio pelo campo livre.

Enquanto existe uma foto anexada sem autorização, o envio fica interrompido com uma explicação e foco no controle de consentimento. A alternativa é remover o anexo e continuar por texto. Portanto, o comportamento atual não é enviar silenciosamente a mensagem ignorando a foto: é pedir uma decisão explícita.

Ao enviar uma foto nova pelo composer, o pedido segue como observação da imagem. Se o campo estiver vazio, a interface prepara um pedido de análise. Depois do primeiro envio, o anexo autorizado pode ficar recolhido, mas continua inspecionável. Enquanto essa foto e sua autorização permanecerem na conversa ativa, as solicitações de chat incluem a imagem corrente.

O modo demonstrativo local não inventa uma análise visual. Quando não há conexão com a OpenAI, a interface explica que a observação da foto depende dela e preserva foto e mensagem.

### 3. Enviar a imagem de verdade

O chat envia `photoDataUrl`, `photoConsent` e `analyzePhoto` para `/api/chat`. O servidor valida o consentimento, o formato e o conteúdo do arquivo, com limite de 2 MB para a imagem preparada. URLs remotas fornecidas no lugar do arquivo não são aceitas nesse contrato.

Na chamada ao provedor, a foto consentida vira uma entrada `input_image` da Responses API, junto da mensagem atual. O histórico textual e o contexto declarado também acompanham o pedido. O catálogo documental e os IDs permitidos são fornecidos pelo servidor; texto ou instruções visíveis na imagem não recebem autoridade sobre essas regras.

O texto pode chegar progressivamente por SSE. Os campos estruturados são aceitos somente ao final da resposta validada. Um pedido explícito de análise não pode terminar com um sucesso silencioso de texto apenas: se a resposta não trouxer a observação exigida e não for um caso de encaminhamento para cuidado, o servidor retorna erro recuperável.

Referências: `submit` em [experience.js](../src/experience.js), [openai-api.mjs](../server/openai-api.mjs) e [response-stream.js](../src/chat/response-stream.js).

### 4. Observar, explicitar limites e confirmar

A resposta estruturada tem um `photoAnalysis` com resumo, observações, limitações e uma pergunta de confirmação. O contrato distingue:

| Estado | Significado | Apresentação |
| --- | --- | --- |
| `observed` | Existe uma observação utilizável da aparência visível | “O que consigo observar”, com o indicador “Para confirmar com você”. |
| `limited` | A imagem não permite uma observação suficiente | “Vamos melhorar essa observação?”, com “Imagem limitada”. |
| `not_provided` | Não houve uma foto utilizável/autorizada nesta requisição | Nenhum card de observação visual é exibido. |

O card lista as observações e oferece **O que esta foto não confirma**. A pergunta de confirmação aparece uma única vez quando já está presente no texto principal. O prompt pede linguagem probabilística sobre iluminação, enquadramento, brilho aparente, textura superficial e variações de cor; não pede diagnóstico, idade estimada, prognóstico ou causa.

As observações não devem preencher silenciosamente relato, duração, sensibilidade ou classificação de assunto como se a pessoa tivesse declarado esses dados. Essa distinção é uma instrução explícita ao modelo. Ela ainda precisa ser avaliada nas respostas: a validação estrutural não prova a veracidade ou a adequação de toda frase produzida.

O servidor exige limitações em respostas de observação e pelo menos uma observação quando o estado é `observed`. Sem imagem na requisição atual, ele remove observações visuais estruturadas que tenham aparecido indevidamente no retorno.

Referências: [photo-contract.mjs](../server/photo-contract.mjs), `photoResponseFields` e `renderPhotoEvidence` em [photo-experience.js](../src/chat/photo-experience.js).

### 5. Relacionar o pedido ao catálogo sem inventar uma fórmula

Quando houver uma relação útil entre o pedido declarado e os conceitos da linha, `productMatches` pode produzir até três cards. Cada card tem ID conhecido, nome, razão contextual e uma fonte obrigatória na página 13. A interface pergunta **Qual produto você quer explorar?**, identifica uma **etapa ilustrativa**, informa que isso ainda não comprova adequação à pele e oferece o PDF diretamente no card. A imagem fica acima do texto no celular e ao lado no desktop.

Esses cards são diferentes de uma rotina confirmada com seleção, total e carrinho. Eles explicam uma possibilidade dentro do protótipo. Não autorizam dizer que a foto comprovou a necessidade de um produto ou que uma categoria ilustrativa equivale a uma fórmula eficaz.

Os únicos IDs de produto aceitos são `cleanse`, `balance` e `comfort`. Cada relação precisa incluir `skinboost-p13`; `skinboost-p7` pode complementar a explicação dos requisitos da recomendação. A limitação devolvida ao app vem do registro do servidor, e não de uma promessa livre do modelo. Quando não existe uma relação fundamentada, a lista pode permanecer vazia. Em um retorno de cuidado profissional, os cards de produtos são suprimidos na experiência.

### 6. Consultar a fonte certa

O servidor resolve IDs para títulos, páginas e URLs de um registro fechado. A interface repete essa restrição e constrói os links locais. Não utiliza uma URL de produto ou estudo inventada pelo modelo.

| ID | Fonte consultável | O que sustenta | O que não sustenta |
| --- | --- | --- | --- |
| `skinboost-p6` | [Página 6](../public/sources/skinboost-page-6.pdf) | Foto opcional, observações aparentes e contexto | Diagnóstico pela imagem ou compatibilidade de uma fórmula. |
| `skinboost-p7` | [Página 7](../public/sources/skinboost-page-7.pdf) | Requisitos de qualidade, elegibilidade, validação e catálogo revisado | Que todas essas evidências de produto já existam. |
| `skinboost-p13` | [Página 13](../public/sources/skinboost-page-13.pdf) | Conceitos Cleanse, Balance e Comfort; ausência de fórmulas e alegações desenvolvidas | Ativos, ingredientes, indicação por condição, eficácia ou prazo de resultado. |
| `skinboost-p26` | [Página 26](../public/sources/skinboost-page-26.pdf) | Critérios da comparação ilustrativa, com aviso e sem promessa de melhora | Antes/depois clínico ou previsão do efeito de produtos. |

As fontes aparecem em **Fontes desta resposta**. Os arquivos contêm somente uma página cada, conservando a numeração impressa original; a apresentação integral não é publicada nesse diretório. O [manifesto](../public/sources/manifest.json) registra essa proveniência.

Referências educativas da AAD continuam com outro papel: orientação geral de cuidados. Elas não validam os produtos conceituais nem substituem as páginas que documentam o case.

### 7. Pedir uma ilustração e comparar

Observar uma foto não gera uma imagem automaticamente. Depois de uma observação `observed` com produtos relacionados, a pessoa escolhe **Explorar Cleanse**, **Explorar Balance** ou **Explorar Comfort** entre as opções disponíveis. Também pode escrever uma escolha explícita, como “Quero o Comfort”. Mencionar um produto numa pergunta ou rejeitá-lo não deve disparar geração.

Pedir “antes e depois” sem escolher um produto apresenta as opções, sem chamar `/api/simulate`. Num pedido combinado, a observação acontece primeiro e a interface aguarda a escolha. Se ainda não existe análise da foto corrente, o pedido de ilustração solicita essa análise antes de prosseguir. Uma imagem limitada, ausência de relação com produto ou encaminhamento de cuidado interrompe a geração e oferece um próximo passo.

A escolha pertence à análise válida da foto atual, não a qualquer card antigo. Uma nova foto limpa a análise e o produto selecionado. A tentativa de geração envia `selectedProductId`; o servidor exige um ID permitido. Esse identificador torna o conceito escolhido rastreável, mas não transforma a ilustração em prova de efeito do produto.

A geração exige conexão com a OpenAI, foto e autorização. Ela usa `/api/simulate`, que chama a API de edição de imagens com a foto de referência. O prompt pede preservação de identidade, traços, tom de pele, textura, pose, luz e enquadramento; proíbe previsões clínicas e solicita um aviso visual. Essas são restrições de geração, não uma garantia automática de que cada imagem produzida cumprirá perfeitamente todos os critérios.

O resultado aparece em **Original e possibilidade ilustrada**. A pessoa pode arrastar diretamente sobre a imagem com mouse ou toque, inclusive a partir do centro, ou usar o controle e o teclado. As duas imagens ocupam a mesma caixa, cuja proporção acompanha a foto original. Os rótulos distinguem **Original** e **Ilustração com IA**. A legenda fixa informa **ILUSTRAÇÃO COM IA · NÃO É PREVISÃO**, não promete prazo ou resultado e aponta para a página 26.

O backend verifica o formato do retorno de imagem; ele não mede melhora clínica nem valida a fidelidade estética do resultado. Uma captura de componente com resposta controlada também não deve ser apresentada como prova de uma geração real pelo provedor.

### 8. Parar, corrigir e continuar

O estado de espera mantém o pedido na conversa. Parar cancela a solicitação corrente e permite tentar novamente. Erros de conexão, imagem ou resposta incompleta não devem exigir que a pessoa redigite o pedido; o estado guarda a tentativa e a intenção de analisar a foto. Uma nova tentativa evita duplicar o turno já registrado e preserva o produto escolhido quando a falha ocorreu na ilustração.

O histórico é local ao navegador e inclui as imagens anexadas e os artefatos gerados. Reabrir uma conversa ou explorar uma alternativa reinicia o consentimento de envio da foto. A exclusão local não equivale à exclusão em sistemas do provedor.

Remover o anexo limpa a foto usada nos próximos pedidos, mas não apaga automaticamente as imagens já presentes nas mensagens anteriores. Excluir a conversa remove o registro local correspondente. Essa diferença importa ao explicar os controles de dados.

## O que o PDF efetivamente contém

A apresentação V2, de 11/09/2026, é um case fictício. Na p13 aparecem Cleanse, Balance e Comfort, com volumes conceituais de 150 ml, 30 ml e 50 ml na ilustração. O próprio material informa que fórmulas, rotulagem e alegações ainda não foram desenvolvidas.

Não há INCI, ativos, concentrações, preço comercial, contraindicações, modo de uso específico, estudos de produto ou correspondência validada entre preocupação e produto. As categorias e os preços do protótipo são decisões demonstrativas da interface. Ausência de dado não significa ausência de restrição.

Na p26, antes/depois é uma imagem sintética para demonstrar a interface. O aviso deve permanecer junto da imagem, com mesmo enquadramento e luz e sem prazo ou promessa de melhora. Esses limites são parte da fonte, não uma evidência de eficácia.

## Pontos concretos para verificar na demonstração

- Uma foto sem autorização não sai do navegador; a pessoa consegue remover o anexo e seguir por texto.
- A observação é respondida antes de uma sequência desnecessária de perguntas sobre toda a rotina.
- Uma foto inadequada produz limites e um próximo passo, não observações inventadas.
- Relato declarado e aparência observada permanecem distintos.
- Cards usam apenas os três IDs existentes e levam à página 13; não contêm ingredientes ou efeitos inventados.
- Uma análise sem pedido de ilustração não chama a geração de imagens.
- O pedido combinado observa primeiro e espera uma escolha; sem produto selecionado não existe chamada de geração.
- Card e escolha explícita por texto enviam o mesmo ID permitido; nova foto exige nova análise e escolha.
- A comparação mantém proporção original, camadas alinhadas, arraste por toque/mouse e alternativa por teclado; rótulos e fonte não sugerem previsão clínica.
- Parar, retentar e reabrir a conversa preservam trabalho útil; restaurar não reativa consentimento.

O contrato do backend é exercitado em [openai-api.test.mjs](../tests/openai-api.test.mjs), incluindo consentimento, entrada real de imagem, observação antes do contexto completo e fontes permitidas. O histórico e as alternativas têm testes próprios.

Em 18/09/2026, [check-photo-experience.mjs](../scripts/check-photo-experience.mjs) passou 17 critérios em desktop e 17 em mobile, com APIs e imagens controladas. Verificou seleção por card e texto, ausência de geração sem escolha, repetição com o mesmo produto, layout responsivo dos cards, CTA em uma linha, arraste por mouse e toque real simulado no Chromium, proporção e alinhamento das camadas. Também preservou consentimento, fontes, recuperação e restauração; não encontrou erro de JavaScript, overflow horizontal ou violações axe graves/críticas no estado de observação. Relatório e capturas: `qa/photo-experience/`. Isso não é uma nova sessão paga, teste em aparelho físico ou avaliação clínica.

## Auditoria inicial da apresentação e do roteiro de implementação

Registro anterior à atualização editorial descrita no fechamento desta seção. A tabela preserva as lacunas encontradas naquele momento.

As rotas `/implementacao` e `/roteiro-implementacao` usam o mesmo conteúdo em `src/implementationContent.js` e o mesmo manifesto `src/implementationEvidence.js` do projeto pai. Portanto, uma atualização compartilhada corrigirá as duas. A sequência atual tem 24 slides; ela já explica consentimento, limites, fontes, revisão, privacidade e ilustração, mas ainda não mostra toda esta experiência nova de foto.

| Slide | Situação atual | Delta necessário, preservando a ideia do slide |
| --- | --- | --- |
| 6 — cada card explica por que está ali | Demonstra o card da rotina e razões contextuais, corretamente sem eficácia clínica | Acrescentar o card de relação com catálogo como resultado possível da observação; distinguir `productMatches` da rotina confirmada. Atualizar a captura se esse for o exemplo principal. |
| 7 — resposta convincente pode estar errada | Limites clínicos e possibilidade de erro estão corretos | Demonstrar `observed`/`limited`, “Para confirmar com você” e “O que esta foto não confirma”. Ressaltar que observação visual não vira relato declarado. |
| 8 — a fonte sustenta a afirmação certa | Texto e captura se concentram nas referências educativas da AAD | Prioridade alta: mostrar links reais às páginas 6, 7, 13 e 26, especialmente p13 no card. Separar o brief documental da orientação educativa e da evidência clínica inexistente. |
| 9 — anexar não autoriza qualquer uso | Explica consentimento e usa um anexo sintético de teste | Prioridade alta: trocar pela UI atual com “Analisar minha foto” e “Criar ilustração”. Explicar que anexar e consentir não enviam sozinhos, mas o próximo envio com foto sem autorização é bloqueado até a escolha. Mostrar observação real ou atribuir claramente uma resposta controlada. |
| 12 — espera informa sem encenar certezas | Streaming real e aplicação do contexto final estão corretos | Acrescentar que os cards estruturados de foto chegam após validação final. A captura de espera continua marcada como controlada; não deve ser usada para comprovar análise visual real. |
| 21 — simulação não prevê resultado | Os limites estão corretos, mas a captura mostra apenas o convite antigo e o texto fala em imagem lado a lado | Prioridade alta: mostrar o comparador deslizante real, rótulos e link à p26. Explicar que análise e ilustração são ações distintas e o encadeamento combinado só existe quando solicitado. |
| 22 — guardar e enviar são escolhas diferentes | Histórico local, envio ao provedor e limite de exclusão já estão corretos | Acrescentar a diferença entre remover o anexo futuro e apagar as mensagens/imagens do histórico; reafirmar a renovação do consentimento ao restaurar ou criar alternativa. |
| 24 — experiência inteira funciona | Propõe um percurso integrado de avaliação | Incluir foto autorizada → observação → confirmação → fonte → conceito de produto → ilustração solicitada, com um caso de imagem limitada e recuperação. |

Os demais slides mantêm seus fundamentos. Não é necessário inventar scores de pele, acrescentar um quiz ou aumentar a contagem apenas para mostrar esses estados. A nova captura deve informar se veio de produção com provedor real ou de um teste controlado. As imagens antigas também antecedem a integração recente de tipografia/tokens, então a renovação visual precisa usar o estado atual do produto.

Na revisão inicial, nenhum arquivo do projeto pai foi alterado. Na atualização autorizada seguinte, `implementationContent.js` e `implementationEvidence.js` foram atualizados: os slides 8, 9 e 21 agora explicam fontes documentais, consentimento e comparador; os slides 6, 7, 12, 22 e 24 complementam cards, limites, validação, dados e avaliação integrada. As duas rotas compartilham essa alteração, mantendo 24 slides e 72 parágrafos de estudo.

As capturas novas dos slides 8 e 21 vieram de `qa/photo-experience/desktop-observations.png` e `desktop-comparison.png`, identificadas como QA com respostas ou imagens controladas. Elas não comprovam análise ou geração real do provedor. A captura de consentimento anterior continua identificada como anexo de teste; o texto explica as ações atuais. Build, auditoria geral e verificação de contagem e assets do projeto pai passaram. Esta atualização documental não declara publicação.
