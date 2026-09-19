# QA atual — 18/09/2026

## Escopo
Limpeza da base e fluxo de conversa. Referência de navegação: https://www.nollahealth.com/ e sua área de chat. Identidade visual SkinBoost preservada. Prévia local em http://127.0.0.1:4184/. Relatórios anteriores estão em design/qa-history.md e não representam o estado atual.

## Verificações realizadas
- Desktop 1280 × 720: prompt abre /chat, mensagens, sugestões, revisão e proposta.
- Mobile 390 × 844: revisão legível, composer fixo, proposta e navegação compacta.
- Editar preferência remove respostas posteriores; nova confirmação apresenta dois produtos em vez de três.
- Foco e scroll levam ao início da revisão/proposta.
- Carregamento direto de /chat inicia conversa vazia.
- Nenhum erro no console durante os fluxos testados.
- 11 testes automatizados aprovados; build de produção aprovado.

## Limites
Teste mobile em viewport de navegador, sem aparelho físico. A revisão desta rodada não certifica o novo modelo 3D produzido em paralelo. A conversa usa regras locais, não IA; a foto não é enviada. Não houve publicação desta revisão.

## Revisão Figma — 19/09/2026
Fonte e diferenças implementadas em docs/figma-update.md. Comparação visual de logo/hero, painel de etapas, bento e footer. Desktop 1440 × 929 e mobile 390 × 844. Referência desktop adaptada ao celular, preservando a funcionalidade.
