import { expect, fn } from "storybook/test";
import {
  renderChatComponent,
  disposeDisconnectedPreviews,
} from "./chat-component-preview.js";

export default {
  id: "experiencia-jornada-guiada",
  title: "Experiência/Componentes do chat",
  tags: ["autodocs"],
  args: {
    component: "question",
    initialStep: "context",
    scenario: "general",
    onAction: fn(),
  },
  argTypes: {
    scenario: {
      control: "select",
      options: ["acne", "oiliness", "general", "dry"],
      description: "Relato declarado na fixture, sem diagnóstico.",
    },
    component: { table: { disable: true } },
    initialStep: { table: { disable: true } },
    fixture: { table: { disable: true } },
    onAction: { table: { disable: true } },
  },
  render: renderChatComponent,
  beforeEach: () => disposeDisconnectedPreviews,
  parameters: {
    chatComponent: true,
    docs: {
      story: { inline: false },
      description: {
        component:
          "Cada canvas monta somente o componente indicado, usando os mesmos templates da aplicação. Ações de navegação e envio aparecem na aba Actions: não abrem uma conversa completa nem chamam a IA. Estados de foto, voz e resposta são fixtures locais. A versão de alta fidelidade continua uma proposta em revisão.",
      },
    },
  },
};

export const BoasVindas = {
  name: "Mensagem · boas-vindas",
  args: { component: "welcome", initialStep: "welcome" },
};
export const Contexto = {
  name: "Contexto · resumo editável",
  args: { component: "context", initialStep: "review" },
};
export const Rotina = {
  name: "Rotina · seleção explicada",
  args: { component: "routine", initialStep: "routine" },
};
export const Carrinho = {
  name: "Seleção · produtos e total",
  args: { component: "cart", initialStep: "cart" },
};
export const Checkout = {
  name: "Checkout · revisão demonstrativa",
  args: { component: "checkout", initialStep: "checkout" },
};
export const Checkin = {
  name: "Check-in · sugestões",
  args: { component: "checkin", initialStep: "checkin" },
};
export const Acne = {
  name: "Pergunta · acne declarada",
  args: { scenario: "acne" },
};
export const Oleosidade = {
  name: "Pergunta · oleosidade",
  args: { scenario: "oiliness" },
};
export const CuidadosGerais = {
  name: "Pergunta · cuidados gerais",
  args: { scenario: "general" },
};
export const Ressecamento = {
  name: "Pergunta · ressecamento",
  args: { scenario: "dry" },
};
export const MensagemLivre = {
  name: "Compositor · texto livre",
  args: { component: "composer" },
  play: async ({ canvas, userEvent, args }) => {
    const input = await canvas.findByRole("textbox", { name: "Sua mensagem" });
    await userEvent.type(input, "Quero uma rotina com poucos passos.");
    await userEvent.click(
      canvas.getByRole("button", { name: "Enviar mensagem" }),
    );
    await expect(args.onAction).toHaveBeenCalledWith({
      action: "send",
      value: "Quero uma rotina com poucos passos.",
    });
    await expect(input).toHaveValue("");
  },
};
export const SugestaoComoMensagem = {
  name: "Sugestões · respostas rápidas",
  args: { component: "suggestions", scenario: "oiliness" },
  play: async ({ canvas, userEvent, args }) => {
    const reply = (await canvas.findAllByRole("button"))[0];
    const value = reply.dataset.reply;
    await userEvent.click(reply);
    await expect(args.onAction).toHaveBeenCalledWith({
      action: "reply",
      value,
    });
  },
};
export const CarrinhoVazio = {
  name: "Seleção · remover todos os produtos",
  args: { component: "cart", initialStep: "cart" },
  play: async ({ canvas, userEvent }) => {
    for (const checkbox of await canvas.findAllByRole("checkbox"))
      if (checkbox.checked) await userEvent.click(checkbox);
    await expect(
      canvas.getByRole("button", { name: /checkout/i }),
    ).toBeDisabled();
  },
};
export const OrigemDoContexto = {
  name: "Contexto · origem nas mensagens",
  args: { component: "context", fixture: "origins" },
};
export const ResumoDaConversa = {
  name: "Resumo · notas revisáveis",
  args: { component: "note", fixture: "note" },
};
export const Alternativa = {
  name: "Outra opção · contexto herdado",
  args: { component: "alternative", fixture: "alternative" },
};
export const FeedbackRegistrado = {
  name: "Ações da resposta · feedback registrado",
  args: { component: "feedback", fixture: "feedback" },
};
export const VozRevisavel = {
  name: "Compositor · ditado revisável",
  args: { component: "composer" },
  parameters: {
    docs: {
      description: {
        story:
          "Demonstração determinística sem acesso ao microfone ou API. O consentimento é documentado em uma história separada. Concluir preenche o rascunho, sem enviar a mensagem.",
      },
    },
  },
  play: async ({ canvas, userEvent }) => {
    const input = await canvas.findByRole("textbox", { name: "Sua mensagem" });
    await userEvent.type(input, "Meu rascunho inicial.");
    await userEvent.click(
      canvas.getByRole("button", { name: "Ditar mensagem" }),
    );
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Revise antes de enviar",
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Concluir ditado" }),
    );
    await expect(input).toHaveValue(
      "Meu rascunho inicial. Quero uma rotina com poucos passos.",
    );
  },
};
export const FotoObservada = {
  name: "Foto · observações",
  args: { component: "photo-observed", fixture: "photo-observed" },
};
export const FotoLimitada = {
  name: "Foto · observação limitada",
  args: { component: "photo-limited", fixture: "photo-limited" },
};
export const ComparacaoIlustrativa = {
  name: "Foto · comparador ilustrativo",
  args: { component: "photo-comparison", fixture: "photo-comparison" },
  parameters: {
    docs: {
      description: {
        story:
          "Retrato fictício idêntico nos dois lados: testa arraste, toque e teclado, sem simular eficácia. O convite para compra possui uma história própria, separado do comparador.",
      },
    },
  },
  play: async ({ canvas, userEvent }) => {
    const slider = await canvas.findByRole("slider", {
      name: "Comparar na imagem",
    });
    slider.focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(slider).toHaveAttribute(
      "aria-valuetext",
      "51% da foto original",
    );
  },
};
export const MensagemUsuario = {
  name: "Mensagem · pessoa",
  args: { component: "user-message" },
};
export const Produto = {
  name: "Produto · item da rotina",
  args: { component: "product", initialStep: "routine" },
};
export const Ajustes = {
  name: "Rotina · ajustes rápidos",
  args: { component: "refine", initialStep: "routine" },
};
export const ConviteVisual = {
  name: "Foto · convite para ilustração",
  args: { component: "visual-invite", initialStep: "routine" },
};
export const ComparacaoValores = {
  name: "Valores · gráfico e comparação",
  args: { component: "price-comparison", initialStep: "routine" },
};
export const FonteProduto = {
  name: "Fonte · conceito do produto",
  args: { component: "source", initialStep: "routine" },
};
export const FonteEducativa = {
  name: "Fonte · orientação educativa",
  args: { component: "source", productId: "aad-acne" },
};
export const ProdutosDaFoto = {
  name: "Foto · escolha de produto",
  args: { component: "photo-products", fixture: "photo-observed" },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(
      await canvas.findByRole("button", { name: "Explorar Cleanse ↗" }),
    );
    await expect(args.onAction).toHaveBeenCalledWith({
      action: "select-photo-product",
      value: "cleanse",
    });
  },
};
export const FontesDaFoto = {
  name: "Foto · fontes da resposta",
  args: { component: "photo-sources", fixture: "photo-observed" },
};
export const FotoAnexada = {
  name: "Foto · anexo e autorização",
  args: { component: "photo-attachment", fixture: "photo-limited" },
};
export const Cabecalho = {
  name: "Navegação · cabeçalho",
  args: { component: "topbar" },
};
export const Historico = {
  name: "Navegação · conversas salvas",
  args: { component: "sidebar" },
};
export const HistoricoVazio = {
  name: "Navegação · histórico vazio",
  args: { component: "sidebar", empty: true },
};
export const CompositorErro = {
  name: "Compositor · erro e rascunho",
  args: {
    component: "composer",
    error: true,
    draft: "Quero entender minha pele.",
  },
};
export const CompositorFoto = {
  name: "Compositor · com foto",
  args: { component: "composer", fixture: "photo-limited" },
};
export const DitadoAtivo = {
  name: "Compositor · ditado em andamento",
  args: { component: "composer", recording: true },
};
export const ConsentimentoVoz = {
  name: "Voz · pedido de autorização",
  args: { component: "voice-consent" },
};
export const PreparandoResposta = {
  name: "Resposta · preparando",
  args: { component: "thinking" },
};
export const RespostaProgressiva = {
  name: "Resposta · texto em andamento",
  args: { component: "thinking", streaming: true },
};
export const RespostaInterrompida = {
  name: "Resposta · interrompida",
  args: { component: "partial" },
};
export const OutrasOpcoes = {
  name: "Outra opção · caminhos",
  args: { component: "alternatives" },
};
export const ConferirInformacoes = {
  name: "Transparência · conferir informações",
  args: { component: "verification" },
};
export const FontesELimites = {
  name: "Transparência · fontes e limites",
  args: { component: "sources" },
};
export const Privacidade = {
  name: "Transparência · sobre seus dados",
  args: { component: "privacy" },
};
export const SinalizarProblema = {
  name: "Feedback · motivos",
  args: { component: "feedback-options" },
};
export const AvisoIA = {
  name: "Transparência · aviso sobre IA",
  args: { component: "disclaimer" },
};

export const ConviteCompra = {
  name: "Compra · convite após ilustração",
  args: { component: "photo-checkout", fixture: "photo-comparison" },
};
