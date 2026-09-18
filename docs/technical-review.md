# Revisão técnica — 18/09/2026

## Resolvido
- Removidos App.jsx, main.jsx, React, React DOM e plugin React do Vite: 51 pacotes retirados. A aplicação já usava JavaScript direto.
- Separados inicialização, interações da landing, animação, diálogo, check-in e conversa.
- Eliminados fluxo antigo de formulário/resultado, temporizadores e seletores associados.
- Mídias antigas sem uso movidas de public/media para design/archive; ficam preservadas, mas fora do build publicado.
- Documentação atualizada; relatório visual antigo arquivado.
- Estado da conversa testável sem navegador, com invalidação das etapas dependentes após edição.
- Formatação padronizada com Prettier.

## Verificação
11 testes passam (conversa, escape de conteúdo e contrato de hospedagem). Build passa e mantém os artefatos exigidos pelo Sites. Chat verificado em desktop e mobile, incluindo edição e reconfirmação.

## Pontos para evolução
- O módulo 3D continua carregado sob demanda e gera aviso de tamanho (~613 kB minificado, ~157 kB gzip). Não bloqueia o build; avaliar o custo em dispositivos reais antes da produção.
- A fonte completa de ícones inclui formatos legados no build. Consolidar em SVGs individuais se o orçamento de assets exigir.
- A proposta é demonstrativa e usa preferências explícitas. Não há backend, interpretação de texto livre, diagnóstico, persistência ou preços definidos. A integração real precisa de contrato próprio; ver architecture.md.
- Alterações do frasco feitas em paralelo foram preservadas, sem auditoria de fidelidade visual nesta rodada.

Não foi necessária uma migração de framework. Esta organização mantém o protótipo simples e permite substituir o serviço de conversa sem reescrever a landing.
