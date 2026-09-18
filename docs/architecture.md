# Estrutura e evolução

## Entradas

- `index.html`: landing page e conteúdo editorial.
- `src/main.js`: inicialização e passagem do prompt para o chat.
- `/chat`: conversa na mesma aplicação; navegação com History API e fallback de HTML no servidor.
- `brandbook.html`: documento independente, incluído no build.

## Responsabilidades

- `src/chat/conversation.js`: estado e transições da demonstração, sem DOM nem chamadas externas. Sequência: objetivo → rotina → cuidados → preferência → orçamento → revisão → proposta.
- `src/chat/chat.js`: renderização, composer, navegação e acessibilidade da conversa. Entrada do usuário escapada antes de entrar no HTML.
- `src/chat/chat.css`: estilos isolados pelo prefixo `chat-`.
- `src/landing/interactions.js`: abas, comparador, relatos e informações de produtos.
- `src/landing/motion.js`: animações editoriais e carregamento tardio do frasco.
- `src/ui/`: diálogo, check-in e utilitários de DOM.
- `src/bottle.js` e `src/product-story.css`: apresentação 3D. O modelo Comfort foi introduzido por uma edição paralela, preservada nesta revisão.
- `worker/index.js`, `scripts/prepare-sites-build.mjs`, `.openai/hosting.json`: contrato atual de hospedagem.

## Estado e privacidade

A conversa é mantida apenas em memória. Voltar ao site e avançar no navegador mantém a sessão; recarregar inicia uma nova. O nome da foto pode aparecer no chat, mas o arquivo não é enviado nem analisado. Nenhuma chamada de IA, autenticação, banco ou compra é implementada.

Editar uma resposta invalida as etapas seguintes e exige nova revisão. A quantidade de produtos da proposta demonstrativa depende da preferência escolhida; o texto livre é preservado, mas não interpretado clinicamente.

## Próxima etapa para análise real

Substituir o serviço demonstrativo por um contrato de backend com respostas estruturadas: mensagem, perguntas pendentes, resumo confirmado, proposta e estado de encaminhamento. Manter credenciais e regras de elegibilidade no servidor. Definir com profissionais responsáveis o escopo cosmético/clínico, critérios de avaliação e catálogo validado antes de apresentar recomendações reais. A referência Nolla inclui revisão por profissional de saúde; copiar a interface não implementa essa operação.

Evitar respostas clínicas ou preços derivados de texto gerado sem validação. As futuras respostas do servidor também precisam de renderização segura e estados de erro, repetição e cancelamento. Criar contas, retenção de dados e envio de fotos somente quando o produto tiver essas decisões definidas.

## Verificação

`npm run build`, `npm test` e `npm run format:check`. Os testes cobrem avanço, revisão obrigatória, invalidação após edição, alteração da proposta, entrada vazia/longa, isolamento da nova conversa, escape de HTML e contrato do Worker.
