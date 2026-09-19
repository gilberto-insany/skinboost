import { $, $$, icon } from "../ui/dom.js";
import { openDialog, closeDialog } from "../ui/dialog.js";
export function initLanding({ openChat }) {
  const navToggle = $(".menu-toggle");
  navToggle.onclick = () => {
    const isOpen = $(".nav nav").classList.toggle("open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
    navToggle.setAttribute("aria-label", isOpen ? "Fechar menu" : "Abrir menu");
  };
  $$(".nav nav a").forEach(
    (el) =>
      (el.onclick = () => {
        $(".nav nav").classList.remove("open");
        navToggle.setAttribute("aria-expanded", "false");
        navToggle.setAttribute("aria-label", "Abrir menu");
      }),
  );
  const steps = [
    [
      "Vamos entender você.",
      "“Quero uma rotina simples que caiba nas minhas manhãs.”",
      "O que você já usa hoje?",
      "Contexto antes da escolha",
    ],
    [
      "Cada escolha, explicada.",
      "Sua preferência: começar com poucos passos.",
      "Cleanse + Comfort · exemplo de rotina essencial",
      "Você entende a função de cada item",
    ],
    [
      "A rotina acompanha você.",
      "“Quero ajustar o cuidado ao meu novo horário.”",
      "O que mudou desde a última vez?",
      "Seu próximo passo pode ser simplificar",
    ],
  ];
  function selectStep(index) {
    $$("[data-step]").forEach((el, i) => {
      el.classList.toggle("active", i === index);
      el.setAttribute("aria-selected", String(i === index));
      el.tabIndex = i === index ? 0 : -1;
    });
    $("#step-panel").setAttribute("aria-labelledby", `step-${index}`);
    $("#step-title").textContent = steps[index][0];
    $("#step-text").textContent = steps[index][1];
    $("#step-reply").textContent = steps[index][2];
    $(".card-foot span").textContent = steps[index][3];
  }
  $$("[data-step]").forEach((el) => {
    el.onclick = () => selectStep(+el.dataset.step);
    el.onkeydown = (e) => {
      if (
        [
          "ArrowDown",
          "ArrowRight",
          "ArrowUp",
          "ArrowLeft",
          "Home",
          "End",
        ].includes(e.key)
      ) {
        e.preventDefault();
        const current = +el.dataset.step;
        const index =
          e.key === "Home"
            ? 0
            : e.key === "End"
              ? 2
              : (current +
                  (["ArrowRight", "ArrowDown"].includes(e.key) ? 1 : 2)) %
                3;
        selectStep(index);
        $(`#step-${index}`).focus();
      }
    };
  });
  $("#compare-range").addEventListener("input", (e) =>
    $(".comparison").style.setProperty("--split", `${e.target.value}%`),
  );
  const stories = [
    [
      "Quero começar com poucos passos e entender onde meu dinheiro está indo.",
      "Lucas, 26",
      "Começar sem complicar.",
      "/media/persona-lucas.jpg",
    ],
    [
      "Quero entender se a indicação considera o que já uso e o que minha pele tolera.",
      "Marina, 29",
      "Confiança para fazer escolhas.",
      "/media/persona-marina.jpg",
    ],
    [
      "Quero cuidar da pele sem transformar minha rotina em uma obrigação difícil.",
      "Denise, 48",
      "Cuidado que cabe na vida.",
      "/media/persona-denise.jpg",
    ],
  ];
  let storyIndex = 0;
  function showStory(delta) {
    storyIndex = (storyIndex + delta + stories.length) % stories.length;
    $("#story-quote").textContent = stories[storyIndex][0];
    $("#story-name").textContent = stories[storyIndex][1];
    $("#story-desc").textContent = stories[storyIndex][2];
    $("#story-portrait").src = stories[storyIndex][3];
    $("#story-portrait").alt =
      `Retrato ilustrativo de ${stories[storyIndex][1].split(",")[0]}, persona fictícia`;
    $("#story-count").textContent = `0${storyIndex + 1} / 03`;
  }
  $("#prev-story").onclick = () => showStory(-1);
  $("#next-story").onclick = () => showStory(1);
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
      "Neste protótipo, texto e foto ficam apenas na memória do navegador. Nada é enviado a uma IA ou armazenado em uma conta. Você pode remover a imagem pelo botão ao lado do nome do arquivo; ao recarregar a página, o estado da demonstração é descartado.",
    ],
    trust: [
      "Confiança, com clareza.",
      "A proposta da SkinBoost é tornar consultáveis a origem, a composição e as evidências de cada produto, além dos limites da orientação. O projeto é fictício: ainda não existem produtos regularizados, certificados, estudos próprios ou uma IA avaliada. Essas informações precisam ser verificadas antes de qualquer operação real.",
    ],
    about: [
      "Uma experiência para explorar.",
      "Este é um wireframe de alta fidelidade da SkinBoost. As interações demonstram a jornada; os espaços de pele e imagem editorial permanecem reservados; os retratos dos relatos são ilustrativos, gerados por IA. As embalagens são imagens conceituais, o frasco é uma cena 3D e as histórias representam personas fictícias. Não há diagnóstico, venda ou envio de dados.",
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
}
