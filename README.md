# SkinBoost — wireframe de alta fidelidade em HTML

Protótipo navegável da home. Conteúdo em português, layout responsivo e hierarquia definida. Entrada em `index.html`; estilos em `src/styles.css`, interações em `src/main.js` e frasco WebGL em `src/bottle.js`.

## Explorar

Preview local: http://127.0.0.1:4173/ . O servidor foi iniciado durante a entrega.

- Prompt com sugestões e foto opcional (prévia local, remoção e validação de tipo/tamanho).
- Demonstração em duas etapas: contexto → visualização da rotina → check-in.
- Abas de processo, bento grid e informações de privacidade.
- Vídeo MP4 com movimento de câmera e playhead controlado por scroll; controle para pausar.
- Frasco 3D real, rotacionado pelo scroll, com abertura da tampa. Carregado apenas ao se aproximar da seção; imagem alternativa se WebGL estiver indisponível.
- Catálogo com detalhes, antes/depois arrastável e acessível por teclado, relatos de personas e FAQ.
- Navegação mobile, modais com foco e fechamento por Escape, suporte a movimento reduzido.

## Escopo

É um wireframe de alta fidelidade para discutir composição, ritmo e fluxo. Não há backend, chamada de IA, diagnóstico, compra, envio de dados, conta ou histórico persistido. A demonstração apresenta uma variação do catálogo conforme a preferência escolhida; não interpreta o texto livre nem a foto. Todos os relatos são desejos de personas fictícias; não são avaliações de clientes. A comparação é uma simulação visual já existente no projeto.

O vídeo é um estudo editorial de seis segundos criado a partir da imagem sintética do hero, com movimento de câmera. Serve para validar ritmo e controle de scroll; não é uma filmagem final. O frasco é uma modelagem conceitual editável com geometria Three.js, materiais e textura de rótulo.

## Fontes

Conteúdo: `../deliverables/v2/SkinBoost-projeto.md` e `../deliverables/v2/SkinBoost-banco-de-textos.md`.

Referência principal: [Nolla home](https://www.nollahealth.com/) e [Nolla skincare](https://www.nollahealth.com/skincare), observadas no navegador: conversa como entrada, fotografia em tela ampla, processo, comparação e produtos.

Referências complementares observadas: [Oura](https://ouraring.com/), [MyHealthPrac](https://www.myhealthprac.com/), [Superpower](https://superpower.com/), [Institute of Health](https://www.instituteofhealth.com/), [Luminous Labs](https://www.luminouslabs.health/), [Sofi](https://www.sofihealth.com/), além dos anexos enviados pelo usuário. A adaptação usa a marca, os textos e o escopo SkinBoost; não é uma reprodução pixel a pixel dessas páginas.

## Assets

- `public/media/hero-skin.png`: foto original sintética gerada com a ferramenta integrada ImageGen. Prompt: “High-end natural skincare editorial photograph, landscape. Fictional adult Brazilian woman with medium brown skin, authentic visible pores and delicate freckles. Macro close-up cropped face occupies the right 45 percent. Left 55 percent is quiet dark olive backdrop with soft shadows for white heading and prompt overlay. Pale sage, warm ivory, warm natural skin tones. Soft morning window light. No text, logos, watermarks or UI.”
- `public/media/produtos-skinboost.png`: família de embalagens sintéticas já existente no projeto.
- `public/media/antes-depois-simulacao.png`: comparação sintética já existente, mantida identificada como simulação no HTML.
- `public/media/skin-film.mp4`: movimento de câmera a partir do hero, 1440 × 810, 24 fps, 6 s, H.264, keyframe em cada frame para busca por scroll.
- Ícones: Phosphor. Fontes: stack local Arial/Helvetica/sans-serif.

## Manutenção

`npm run dev -- --host 127.0.0.1 --port 4173 --strictPort` abre o servidor Vite.
`npm run build` gera a página HTML e seus assets em `dist/client`, além dos metadados do template. Nenhum site foi publicado.

Validação e evidências: `design-qa.md` e `qa/`.
