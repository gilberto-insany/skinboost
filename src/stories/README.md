# SkinBoost — dois catálogos, uma implementação

Os Storybooks usam os mesmos arquivos `*.stories.js` e o mesmo `mountExperience` da página. Cada canvas recebe uma instância independente e chama `destroy()` ao sair. Não há componente fictício paralelo.

| Catálogo | Status | Fonte visual | Comando independente | Saída |
| --- | --- | --- | --- | --- |
| Wireframe | Implementado | `src/styles.css` + `src/experience.css` | `npm run build:storybook:wireframe` | `dist/client/storybook/wireframe/` |
| Alta fidelidade | Proposta em revisão | Mesma UI + `.storybook-hifi/proposed-theme.css`, baseado em `brandbook.html` | `npm run build:storybook:hifi` | `dist/client/storybook/alta-fidelidade/` |

`npm run storybook:wireframe` usa a porta 6006; `npm run storybook:hifi`, 6007. `npm run build:review` compila o site primeiro e os dois catálogos depois, preservando o empacotamento Sites. Vercel publica `dist/client`.

## Limites da proposta

Alta fidelidade não significa identidade final aprovada. A proposta aplica cores e a família tipográfica do brandbook sem mudar os tokens da página. Avenir Next/Avenir são fontes locais, com fallback Helvetica/Arial; nenhuma fonte proprietária foi copiada. Pessoas, pele e antes/depois continuam placeholders. Produtos e o frasco 3D da página são preservados.

## Atualização

Mudanças de comportamento são feitas no controlador real. Mudanças nos estados da API devem atualizar `Experience.stories.js`. Novos componentes devem ser exportados da implementação para serem usados diretamente, nunca reconstruídos dentro do catálogo. Em ambas as versões, verificar teclado, foco, viewport móvel, conteúdo longo, erros, estado vazio e movimento reduzido. O addon de acessibilidade fica disponível nos dois catálogos.

Os estados iniciais são `welcome`, `context`, `routine`, `cart`, `checkout` e `checkin`. Os quatro últimos recebem fixtures locais do próprio controlador. Não existe pagamento real, envio de dados, diagnóstico ou análise de foto.

## Verificação

Depois do build, `npm run test:storybook` serve apenas os arquivos compilados em um servidor local temporário e verifica as duas URLs finais. Exercita os seis estados iniciais, validação sem resposta e carrinho vazio, além de isolamento de instância, foco, viewport de 390 px e axe. O relatório, quatro screenshots móveis e duas capturas do manager ficam em `qa/storybook/` (fora do Git). O teste usa o Chrome local no macOS, um executável informado por `STORYBOOK_CHROME`, ou o Chromium instalado pelo Playwright em outros ambientes.

Configuração baseada na [documentação do Storybook](https://storybook.js.org/docs/configure), com [diretórios estáticos](https://storybook.js.org/docs/api/main-config/main-config-static-dirs) e [configuração estática da Vercel](https://vercel.com/docs/project-configuration/vercel-json). Não é necessário usar Sites para revisar ou publicar estes builds.
