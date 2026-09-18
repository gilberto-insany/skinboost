# SkinBoost

Wireframe de alta fidelidade em HTML, CSS e JavaScript. Inclui landing page, conversa guiada, catálogo conceitual, frasco 3D e brandbook.

## Desenvolvimento

Requer Node.js 20.19+ ou 22.12+.

```sh
npm ci
npm run dev
```

Acesse o endereço informado pelo Vite. O prompt da home abre `/chat`. O brandbook está em `/brandbook.html`.

```sh
npm run build
npm test
npm run format:check
```

`npm run format` organiza o código. O build gera `dist/client` e os arquivos de hospedagem em `dist/server` e `dist/.openai`.

## Jornada

Prompt → conversa com perguntas progressivas → revisão das respostas → proposta demonstrativa → ajustes e check-in. A navegação voltar/avançar funciona sem perder a conversa dentro da mesma sessão.

A demonstração não usa IA, interpreta sintomas, analisa fotos ou prescreve tratamento. Produtos, fórmulas e preços ainda são conceituais. As mensagens ficam somente na memória do navegador e são descartadas ao recarregar. A preferência de passos altera a apresentação do catálogo; não há validação clínica.

## Direção visual

Imagens de produtos e frasco 3D são exibidos. Áreas com pessoas e pele usam espaços reservados. O fluxo conversacional tem a Nolla como referência; a identidade visual é SkinBoost.

- [Site publicado](https://skinboost-wireframe.insany.chatgpt.site) — atualizações locais não são publicadas automaticamente.
- [Código no GitHub](https://github.com/gilberto-insany/skinboost)
- [Arquitetura e próximos passos](docs/architecture.md)
- [Revisão técnica](docs/technical-review.md)
- [Validação visual](design-qa.md)

## Arquivos de mídia

`public/media` contém imagens conceituais dos produtos e da marca. `public/models` contém o modelo 3D utilizado pelo frasco. As fotos e o vídeo de pele retirados do wireframe estão em `design/archive`, fora dos arquivos servidos ao visitante.

## Referências

[Nolla](https://www.nollahealth.com/) e [Nolla Skincare](https://www.nollahealth.com/skincare), com referências complementares de Oura, MyHealthPrac, Superpower, Institute of Health, Luminous Labs e Sofi. Os assets de produto são conceitos visuais, não evidência de produtos comercializados.
