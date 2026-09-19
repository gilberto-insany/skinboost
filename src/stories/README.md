# SkinBoost — dois catálogos, uma implementação

Os Storybooks usam os mesmos arquivos `*.stories.js` e o mesmo `mountExperience` da página. Cada canvas recebe uma instância independente e chama `destroy()` ao sair. As histórias não usam o histórico salvo da pessoa no aplicativo. Não há componente fictício paralelo.

| Catálogo        | Status              | Fonte visual                                                                 | Comando independente                | Saída                                    |
| --------------- | ------------------- | ---------------------------------------------------------------------------- | ----------------------------------- | ---------------------------------------- |
| Wireframe       | Implementado        | `src/styles.css` + `src/experience.css`                                      | `npm run build:storybook:wireframe` | `dist/client/storybook/wireframe/`       |
| Alta fidelidade | Proposta em revisão | Mesma UI + `.storybook-hifi/proposed-theme.css`, baseado em `brandbook.html` | `npm run build:storybook:hifi`      | `dist/client/storybook/alta-fidelidade/` |

`npm run storybook:wireframe` usa a porta 6006; `npm run storybook:hifi`, 6007. `npm run build:review` compila o site primeiro e os dois catálogos depois, preservando o empacotamento Sites. Vercel publica `dist/client`.

## Limites da proposta

Alta fidelidade não significa identidade final aprovada. A proposta aplica cores e a família tipográfica do brandbook sem mudar os tokens da página. Avenir Next/Avenir são fontes locais, com fallback Helvetica/Arial; nenhuma fonte proprietária foi copiada. Produtos e o frasco 3D da página são preservados. As referências de pessoas e pele da landing continuam placeholders; qualquer simulação visual no chat deve ser identificada como ilustração, nunca como previsão clínica ou antes/depois comprovado.

## Atualização

Mudanças de comportamento são feitas no controlador real. Mudanças nos estados da API devem atualizar `Experience.stories.js`. Novos componentes devem ser exportados da implementação para serem usados diretamente, nunca reconstruídos dentro do catálogo. Em ambas as versões, verificar teclado, foco, viewport móvel, conteúdo longo, erros, estado vazio e movimento reduzido. O addon de acessibilidade fica disponível nos dois catálogos.

Os pontos iniciais são `welcome`, `context`, `routine`, `cart`, `checkout` e `checkin`: representam uma conversa com mensagens e artefatos, não etapas de um formulário. Os cenários `acne`, `oiliness`, `general` e `dry` são relatos declarados para exemplificar respostas. As sugestões acrescentam mensagens e o composer permanece disponível. Não existe pagamento real, diagnóstico ou previsão de resultado clínico.

## Demonstração e serviço de IA

Os cenários de revisão usam `mountExperience(..., { liveApi: false })`: são determinísticos e locais, sem chamadas aos endpoints de IA. Uma experiência com OpenAI depende de configuração no servidor; a presença do código não comprova que o serviço esteja conectado. Chaves não pertencem ao navegador, aos argumentos dos stories nem aos arquivos públicos. Sem configuração, o modo demonstração deve continuar identificado e utilizável. No `/chat`, `liveApi: true` permite verificar a configuração do servidor em `/api/status`; sem configuração, a interface usa a demonstração identificada. No modo conectado, as mensagens levam o histórico recente. A foto somente acompanha a conversa e a solicitação de ilustração com autorização explícita ativa. Simulação visual de rosto deve ser apresentada como ilustração, sem prometer o resultado de uma rotina.

## Histórico do aplicativo

No `/chat`, conversas e fotos são guardadas localmente no navegador e podem ser retomadas pela lista lateral, também acessível pelo menu móvel. Criar uma nova conversa preserva as anteriores. Excluir uma conversa remove a cópia local; não remove conteúdo já processado pelo provedor. Não existe sincronização entre dispositivos. A persistência pertence ao adaptador da página: os stories mantêm seus exemplos isolados para que uma revisão não altere conversas reais salvas.

## Verificação

Depois do build, `npm run test:storybook` serve apenas os arquivos compilados em um servidor local temporário e verifica as duas URLs finais. Exercita os pontos iniciais e os cenários de acne declarada, oleosidade, cuidados gerais e ressecamento. Verifica texto livre, sugestões como mensagens, preservação do histórico, composer persistente e seleção vazia, além de isolamento de instância, foco, viewport de 390 px e axe. O relatório, quatro screenshots móveis e duas capturas do manager ficam em `qa/storybook/` (fora do Git). O teste usa o Chrome local no macOS, um executável informado por `STORYBOOK_CHROME`, ou o Chromium instalado pelo Playwright em outros ambientes.

Configuração baseada na [documentação do Storybook](https://storybook.js.org/docs/configure), com [diretórios estáticos](https://storybook.js.org/docs/api/main-config/main-config-static-dirs) e [configuração estática da Vercel](https://vercel.com/docs/project-configuration/vercel-json). Não é necessário usar Sites para revisar ou publicar estes builds.
