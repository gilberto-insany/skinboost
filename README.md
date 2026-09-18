# SkinBoost — conversa, contexto e escolhas explicadas

Wireframe navegável para explorar uma experiência de skincare orientada por intenção. A landing, o frasco Comfort GLB, as interações de scroll, os retratos fictícios e o footer da versão mais recente de `main` foram preservados. A rota `/chat` acrescenta cartões, contexto editável, comparação visual e checkout demonstrativo.

## URLs de revisão

- App: https://skinboost-design-review.vercel.app/
- Conversa direta: https://skinboost-design-review.vercel.app/chat
- Guia didático: https://skinboost-design-review.vercel.app/guia.html
- Brandbook: https://skinboost-design-review.vercel.app/brandbook.html
- Storybook do wireframe: https://skinboost-design-review.vercel.app/storybook/wireframe/
- Storybook da próxima etapa visual: https://skinboost-design-review.vercel.app/storybook/alta-fidelidade/

O segundo Storybook aplica os fundamentos do brandbook aos mesmos componentes e estados. Está identificado como **base proposta**, pois a alta fidelidade final será desenvolvida depois.

## O que experimentar

1. Escreva uma intenção ou edite uma sugestão. A foto é opcional; aparece somente o nome do arquivo.
2. Complete o contexto com opções clicáveis: foco, ritmo, produtos atuais, restrições e orçamento. Você pode voltar e consultar suas respostas.
3. Revise antes de gerar. Edite uma resposta sem perder as demais.
4. Examine a rotina: imagem da linha, justificativa por item, indicador de respostas declaradas e situação da foto. O indicador não é uma nota clínica.
5. Abra a fonte de cada item e confira o que está documentado e o que falta validar.
6. Compare valores num gráfico e tabela. Os mesmos itens/volumes entram nos dois totais, com preços explicitamente fictícios.
7. Revise a seleção. Remova itens e observe o total antes de ir ao checkout demonstrativo.
8. Guarde a seleção nesta sessão, copie a rotina ou registre um check-in. “Preciso simplificar” e “Quero rever o custo” levam a ajustes concretos.
9. Feche e retome. Em “Meus dados”, apague o contexto e recomece. Recarregar a página descarta a sessão.

## Fundamentação aplicada

Referência do workshop: [roteiro de Design Boost](https://leandro-boost.vercel.app/roteiro). O [guia didático](https://skinboost-design-review.vercel.app/guia.html) relaciona os princípios à interface e aos testes. A aplicação prioriza intenção, clarificação progressiva, reconhecimento por opções, contexto revisável, artefatos acionáveis, fontes inspecionáveis, limites explícitos, recuperação de erro e controle da pessoa. Nolla é referência de padrão de conversa, não fonte de evidência clínica para os produtos fictícios.

## Limites e dados

Esta é uma demonstração local de experiência, não um serviço clínico ou loja. Não existe modelo de IA conectado, análise de imagem, diagnóstico, recomendação clínica, fórmula validada ou checkout real. O catálogo, os preços de referência e a economia são fictícios. Não se inferem idade da pele, anos de rejuvenescimento, resultados ou prazo de eficácia de uma fotografia.

As regras reconhecem categorias textuais simples informadas nos campos, aplicam o orçamento e evitam duplicar categorias já usadas. Isso não é interpretação completa de linguagem nem verificação de ingredientes. Pedidos explicitamente clínicos recebem um limite de escopo, sem tratamento sugerido. Texto, nome de arquivo e check-in ficam na memória da aba; nenhum desses conteúdos é enviado a terceiros. Eventos de jornada são apenas nomes/contagens locais, sem texto livre ou imagem. Não há analytics externo.

Para operação real, o próximo contrato precisa de catálogo/estoque/preços verificáveis, composição e evidências por produto, serviço de IA avaliado, tratamento de consentimento/armazenamento e destino de checkout. Aumento de conversão é uma hipótese a testar, não um resultado medido deste wireframe.

## Código

- `src/main.js`: entrada e integração da landing preservada.
- `src/landing/`: interações e movimento da página.
- `src/chat/composer.js`: rota `/chat`, histórico do navegador e retomada.
- `src/chat/conversation.js`: fachada de modelos puros; mantém os contratos anteriores e exporta o estado do composer.
- `src/chat/composer-state.js`: perguntas, estado de sessão e transições.
- `src/experience.js` e `src/experience.css`: experiência real compartilhada entre app e Storybooks.
- `src/routine.js`: catálogo demonstrativo, validações e regras de seleção.
- `src/stories/`: histórias CSF3, fundamentos e testes de interação.
- `.storybook-wireframe/` e `.storybook-hifi/`: configurações e temas independentes.
- `public/guia.html`: leitura didática para avaliação com cliente/professor.

O renderer anterior `src/chat/chat.js` permanece disponível no histórico de evolução e não é inicializado junto do composer; existe somente um controlador de rota ativo. Os testes de conversa anteriores continuam sendo executados. O pipeline Sites e seus arquivos de hospedagem continuam intactos; a revisão usa um projeto Vercel separado.

## Desenvolvimento e validação

```sh
npm ci
npm run dev -- --host 0.0.0.0 --port 4173 --strictPort
npm run storybook:wireframe  # 6006
npm run storybook:hifi      # 6007
npm run build:review
npm test
npm run format:check
node scripts/check-experience.mjs
```

O QA da jornada usa `http://127.0.0.1:4173` por padrão e produz relatórios/capturas em `qa/`, ignorado pelo Git. O QA Storybook serve o build estático temporariamente e exige `build:review` antes de `npm test`. Playwright requer Chromium instalado (`npx playwright install chromium`) ou `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` apontando para um binário existente.

O build de revisão prepara primeiro `dist/client` e os arquivos Sites; depois cria os dois Storybooks em subpastas. `vercel.json` publica essa saída, resolve `/chat` para a aplicação e identifica a revisão como não indexável. Não há push automático ou merge em `main`.

## Mídia

Produtos e embalagem 3D são conceituais. O frasco Comfort 50 ml usa `public/models/skinboost-comfort.glb`, carregado sob demanda com alternativa de imagem. Somente os retratos de Lucas, Marina e Denise usam pessoas fictícias geradas por IA, com identificação visível. Hero, vídeo editorial, pele e antes/depois continuam como espaços reservados. Mídia arquivada permanece em `design/archive/`, fora da publicação.
