# Home: revisão de performance

## Escopo e evidência

Revisão do código, dos arquivos de produção e teste de requisições em Chromium
local. O conector Chrome DevTools não está instalado; não há nota Lighthouse,
trace de CPU nem medição de Core Web Vitals de usuários reais neste relatório.
Os números abaixo são bytes de arquivos, não ganhos medidos de LCP ou FPS.

## Ajustes implementados

| Item | Antes | Depois |
| --- | --- | --- |
| Vídeo do manifesto (1.801.717 bytes) | `preload="auto"` ao abrir a Home | Download só a 800px da seção; movimento reduzido mantém o pôster |
| Fallback do 3D | PNG de 1.873.065 bytes com carga imediata | WebP de 1.174.978 bytes, lazy e decodificação assíncrona |
| Segundo slide | Mesma prioridade padrão das outras imagens | Prioridade baixa; primeiro slide mantém prioridade alta |
| Menu | Leitura de geometria em cada evento de scroll | IntersectionObserver e alteração apenas na mudança de estado |
| Progresso do hero e etapas | Variável de estilo atualizada na seção inteira | Atualização no rodapé do hero e na aba ativa |
| Digitação do Bento | Callback a cada frame da tela | Relógio de 32ms, suspenso fora da tela, em aba oculta e com movimento reduzido |
| Texto do progresso do vídeo | Consultas DOM e escritas a cada atualização | Elementos em cache; texto/ARIA mudam apenas quando o percentual inteiro muda |
| Seek do vídeo | Podia continuar fora da região e em aba oculta | Interrompido fora da região e com documento oculto; retoma no progresso atual |

O WebP do fallback tem os mesmos pixels RGB decodificados que o PNG
(SHA-256 `4d1ff30a2d934031109b3e433a3ce09eba3e08dd9b6689ad6d012fe0499b2714`).
Economia de 698.087 bytes (37,3%) sem perda. O modal de produto reutiliza o WebP.
O original continua disponível para as referências existentes no chat.

O teste de rede verifica que vídeo, fallback e modelo 3D não são solicitados
no topo da Home, que movimento reduzido não dispara o vídeo, e que o seek
avança e volta após ativar movimento. WebGL é desativado apenas nesse teste
para isolar o agendamento de mídia; o frasco tem testes próprios de geometria,
fila de renderização e ciclo de vida.

## Preservado e limitações

- SVGs animados originais, renderização suavizada do orb, WebM, proporções e Figma.
- 3D: importação dinâmica, antialiasing/alta densidade, transmissão, batching da
  bomba, descarte e desenho apenas quando necessário já existiam.
- O chunk 3D tem cerca de 619KB minificados (159KB gzip), carregados perto da seção.
  O aviso de tamanho do bundler não significa que ele bloqueia o primeiro hero.
- Fontes usam unicode-range; arquivos de alfabetos adicionais no build não
  significam que todos sejam baixados pela página em português.
- Não houve redução arbitrária de qualidade nem alteração de cache do HTML/API.
- Separar o carregamento do chat é uma possível etapa futura; exige validar
  restauração de sessões, fotos, navegação direta para `/chat` e foco.
- Não é possível concluir ganho de INP, LCP ou FPS sem um trace comparável.

Referências: [carregamento adiado de vídeo](https://web.dev/articles/lazy-loading-video)
e [priorização do LCP](https://web.dev/articles/optimize-lcp).
