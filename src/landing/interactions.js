import { initSteps } from "./steps.js";
import { initContextTyping } from "./context-typing.js";
import { initStories } from "./stories.js";
import { initHeader } from "./header.js";
import { initHeroSlider } from "./hero-slider.js";
import { initFinalPanels } from "./final-panels.js";
import { icon } from "../ui/dom.js";

/** Same landing interactions in the app and isolated component catalogs. */
export function initLanding({
  root = document,
  openChat,
  openDialog,
  closeDialog,
}) {
  const $ = (selector) => root.querySelector(selector);
  const $$ = (selector) => [...root.querySelectorAll(selector)];
  const events = new AbortController();
  const header = initHeader(root);
  const heroSlider = initHeroSlider({ root });
  const finalPanels = initFinalPanels({ root });
  const navToggle = $(".menu-toggle");
  if (navToggle)
    navToggle.onclick = () => {
      const isOpen = $(".nav nav").classList.toggle("open");
      navToggle.setAttribute("aria-expanded", String(isOpen));
      navToggle.setAttribute(
        "aria-label",
        isOpen ? "Fechar menu" : "Abrir menu",
      );
    };
  $$(".nav nav a").forEach(
    (el) =>
      (el.onclick = () => {
        $(".nav nav").classList.remove("open");
        navToggle.setAttribute("aria-expanded", "false");
        navToggle.setAttribute("aria-label", "Abrir menu");
      }),
  );
  const steps = initSteps({ root });
  const contextTyping = initContextTyping({ root });
  $("#compare-range")?.addEventListener(
    "input",
    (e) => $(".comparison").style.setProperty("--split", `${e.target.value}%`),
    { signal: events.signal },
  );
  const stories = initStories({ root });
  const products = [
    ["Cleanse", "Limpeza · 150 ml", "O começo do ritual."],
    ["Balance", "Sérum · 30 ml", "Uma escolha com propósito."],
    ["Comfort", "Hidratação · 50 ml", "Seu momento de cuidado."],
  ];
  $$("[data-product]").forEach(
    (el) =>
      (el.onclick = () => {
        const p = products[+el.dataset.product];
        openDialog(
          `<p class="eyebrow">LINHA SKINBOOST / PRODUTO CONCEITUAL</p><h2 id="dialog-title">${p[0]}</h2><p>${p[1]}<br>${p[2]}</p><img src="/media/produtos-skinboost.png" alt="Família de embalagens conceituais SkinBoost" style="border-radius:13px;margin-top:24px"/><p class="dialog-notice">Conceito de embalagem. Fórmula, ingredientes, evidências, instruções e preço ainda não definidos. Produto indisponível para compra.</p><button class="pill dark" id="product-demo">Ver exemplo de rotina ${icon("arrow-up-right")}</button>`,
        );
        $("#product-demo").onclick = () =>
          openChat(
            "Quero começar com poucos passos e entender o que faz parte da minha rotina.",
          );
      }),
  );
  const infos = {
    social: [
      "Acompanhe a SkinBoost",
      "Os perfis oficiais ainda não foram definidos. Os ícones representam os canais previstos para a marca.",
    ],
    privacy: [
      "Sua foto. Sua escolha.",
      "Conversas e fotos ficam salvas neste navegador para você retomar depois. Você pode apagar esses dados na conversa; eles não são sincronizados com uma conta. No modo conectado, o histórico recente é enviado à OpenAI para gerar as respostas. A foto só é enviada com sua autorização explícita. Apagar os dados locais não exclui automaticamente o que já foi processado pelo provedor.",
    ],
    trust: [
      "Confiança, com clareza.",
      "A proposta da SkinBoost é tornar consultáveis a origem, a composição e as evidências de cada produto, além dos limites da orientação. O projeto é fictício: ainda não existem produtos regularizados, certificados, estudos próprios ou uma IA avaliada. Essas informações precisam ser verificadas antes de qualquer operação real.",
    ],
    about: [
      "Uma experiência para explorar.",
      "Esta é uma experiência conceitual da SkinBoost com conversa por IA quando a conexão com a OpenAI está disponível. Os espaços de pele e imagem editorial permanecem reservados; os retratos dos relatos são ilustrativos, gerados por IA. As embalagens são conceituais e o frasco é uma cena 3D. Não há diagnóstico ou venda. Conversas e fotos são salvas neste navegador; o histórico recente segue à OpenAI no modo conectado, e a foto só é enviada com sua autorização explícita. O microfone envia áudio para transcrição quando você o ativa; o texto é salvo como rascunho, sem guardar a gravação.",
    ],
  };
  $$("[data-info]").forEach(
    (el) =>
      (el.onclick = () => {
        const info = infos[el.dataset.info];
        openDialog(
          `<p class="eyebrow">SKINBOOST / PROJETO CONCEITUAL</p><h2 id="dialog-title">${info[0]}</h2><p>${info[1]}</p><button id="info-close" class="pill dark">Entendi ${icon("check")}</button>`,
        );
        $("#info-close").onclick = closeDialog;
      }),
  );
  return {
    destroy() {
      events.abort();
      header?.destroy();
      heroSlider?.destroy();
      steps?.destroy();
      contextTyping?.destroy();
      finalPanels.destroy();
      stories?.destroy();
      $$(
        ".menu-toggle, .nav nav a, [data-step], #prev-story, #next-story, [data-product], [data-info]",
      ).forEach((node) => {
        node.onclick = null;
        node.onkeydown = null;
      });
    },
  };
}
