# Voz e respostas progressivas

Atualizado em 18 de setembro de 2026. Implementação de voz e chat é real quando a integração OpenAI está configurada e acessível. O catálogo de produtos e o checkout continuam demonstrativos.

## Transcrição

`POST /api/voice-session` recebe somente `{consent:true}`. O servidor aplica os mesmos controles de origem, tamanho, erro e configuração dos outros endpoints e cria uma sessão Realtime de `type: transcription`, usando `gpt-live-transcribe`. A credencial permanente nunca vai ao navegador. A credencial temporária é devolvida sem cache e usada somente em memória para estabelecer WebRTC com a OpenAI. O áudio não é gravado nem salvo pela aplicação; o rascunho transcrito é salvo pelo fluxo normal da conversa.

O modelo padrão emite deltas enquanto o áudio chega e finaliza ao receber `input_audio_buffer.commit`. Não substituir silenciosamente por `gpt-transcribe`: sua transcrição começa após commit e exige WebSocket. Outros modelos devem ter comportamento e suporte testados antes de alterar `OPENAI_TRANSCRIPTION_MODEL`.

O módulo mantém o texto que já existia no campo. Cada trecho parcial atualiza o rascunho; a versão final substitui o trecho correspondente, sem duplicá-lo. Editar manualmente encerra o ditado antes que uma atualização tardia possa sobrescrever a correção. Concluir para a captura imediatamente, aguarda a finalização por até oito segundos e nunca envia a mensagem. Cancelar, sair, trocar conversa ou colocar a página em segundo plano encerra o microfone e mantém o texto recebido.

## Limites e operação

- Exige HTTPS e APIs compatíveis de microfone/WebRTC, além da permissão da pessoa. Falhas de permissão, rede ou navegador têm mensagem explícita e permitem continuar digitando.
- A credencial temporária expira para estabelecer conexão após 60 segundos. Isso **não** é limite garantido de duração nem uma credencial de uso único. A sessão pode continuar após a expiração; sua configuração inicial também não constitui uma restrição imutável contra um cliente modificado.
- O limite de 120 segundos é aplicado pelo cliente normal, não uma quota financeira no provedor. O limite local de seis solicitações de sessão a cada dez minutos por IP vale por instância aquecida. Para exposição ampla, aplique limites globais no WAF, orçamento e alertas do projeto OpenAI; os controles existentes não equivalem a autenticação de usuário nem a quota global.
- A aplicação não registra tokens temporários, dados de áudio ou chaves. Não adicionar logs de corpo/headers dessas rotas nem persistir a credencial efêmera.
- A compatibilidade real em iPhone/Safari deve ser validada em aparelho. Testes com Chromium e mocks não comprovam funcionamento em todos os dispositivos.

## Resposta progressiva do chat

Enviar `Accept: text/event-stream` a `POST /api/chat` ativa `stream: true` na Responses API. O contrato é SSE com linhas `data:` e JSON:

```json
{"type":"delta","text":"trecho visível"}
{"type":"complete","result":{"text":"texto final","choices":[],"context":{},"ready":false,"care":false}}
{"type":"error","error":{"code":"provider_error","message":"Mensagem pública sanitizada"}}
```

Somente o campo textual de primeiro nível é decodificado durante a geração, com suporte a escapes JSON e Unicode divididos entre pacotes. Nenhum fragmento de contexto, sugestões, chave ou JSON bruto é enviado como texto visível. O resultado completo passa pela mesma validação estrita usada no modo JSON antes de atualizar a rotina. Se o provedor alterar a ordem dos campos, a aplicação pode aguardar o resultado final sem expor conteúdo estrutural. A interface deve tratar deltas como conteúdo em elaboração e usar `complete` como conclusão; um erro ou interrupção não transforma conteúdo parcial em rotina validada.

Falhas anteriores ao primeiro delta retornam JSON convencional com status de erro. Depois do início do SSE, falhas retornam evento `error`. Sem o header, o contrato JSON anterior permanece. O fechamento da conexão pelo navegador aborta a requisição ao provedor; o prazo total de resposta também cancela leitura e conexão.

## Validação reproduzível

`node --test tests/openai-api.test.mjs tests/voice-input.test.mjs tests/chat-stream.test.mjs` usa mocks, sem custo ou microfone físico. Cobre consentimento, origem, sessão expirada/adulterada, quota, transcrição parcial/final, edição manual, cancelamento tardio, segundo plano, reconexão, decodificação incremental e abortos do streaming.

`node scripts/check-voice-live.mjs --prepare-only` gera e remove um WAV sintético local sem chamada paga. Após um deploy aprovado, `node scripts/check-voice-live.mjs --base=https://skinboost-design-review.vercel.app --execute-paid` testa a UI real em Chromium com esse áudio como dispositivo simulado. Verifica texto **antes de clicar em concluir**, atualizações progressivas, preservação do rascunho, ausência de envio automático, término das tracks e persistência ao recarregar. O relatório em `qa/voice-live/` contém métricas e screenshots de dados sintéticos, sem credenciais. Executar o script é uma chamada real de transcrição e exige a autorização aplicável; preparar o arquivo não demonstra funcionamento do provedor.

Validação real de voz concluída em 18/09/2026 (00:53 UTC de 19/09), na versão publicada `58myypi7l`: uma sessão com áudio sintético, 11/11 verificações aprovadas. O endpoint de sessão retornou 200 e a negociação WebRTC da OpenAI retornou 201. Foram observadas duas atualizações do campo durante a escuta, antes de clicar em concluir; o texto digitado permaneceu, a captura terminou, nenhum chat/imagem foi enviado e o rascunho final reapareceu ao recarregar. Não houve erro de navegador. Evidências locais: `qa/voice-live/report.json`, `during-listening.png` e `restored-draft.png`. Esse resultado comprova o fluxo testado em Chromium, sem extrapolar para Safari em aparelho físico.

## Documentação consultada

- [Transcrição Realtime](https://developers.openai.com/api/docs/guides/realtime-transcription)
- [WebRTC no navegador](https://developers.openai.com/api/docs/guides/voice-webrtc)
- [Credenciais temporárias Realtime](https://developers.openai.com/api/reference/resources/realtime/subresources/client_secrets/methods/create)
- [Streaming de respostas](https://developers.openai.com/api/docs/guides/streaming-responses)
- [Eventos da Responses API](https://developers.openai.com/api/reference/resources/responses/streaming-events)
- [Permissão e contextos seguros de getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- [Variações de temporização do MediaRecorder](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/dataavailable_event)
