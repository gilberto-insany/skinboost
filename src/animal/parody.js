/** Animal-only parody artifact. Never enters the real product catalog. */
export function createParodyCard(parent, original, { onRetry, onOffer }) {
  const card = document.createElement("section");
  card.className = "animal-parody";
  card.innerHTML = `<div class="parody-label">LABORATÓRIO DO DEBOCHE</div>
    <h3>Seu antes. Meu crime artístico.</h3>
    <p class="parody-progress" role="status">Preparando uma fantasia com IA… pode levar alguns minutos.</p>
    <button type="button" class="parody-retry" hidden>Tentar gerar só o depois</button>
    <div class="parody-result" hidden>
      <figure class="sx-simulation">
        <div class="parody-labels"><span>ANTES · ORIGINAL</span><span>DEPOIS · FANTASIA IA</span></div>
        <div class="sx-photo-compare" data-photo-drag style="--reveal:50%">
          <img class="sx-compare-base" alt="Fantasia de humor gerada por IA" draggable="false">
          <img class="sx-compare-original" alt="Sua foto original sem a fantasia" draggable="false">
          <span class="sx-compare-handle" data-photo-handle role="slider" tabindex="0" aria-label="Comparar antes e fantasia" aria-orientation="horizontal" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50"><b aria-hidden="true">↔</b></span>
          <span class="parody-watermark">MONTAGEM IA · É ZOEIRA</span>
        </div>
        <label class="parody-range">Arraste na foto <input type="range" min="0" max="100" value="50" data-photo-compare aria-label="Quanto da foto original mostrar"></label>
        <figcaption></figcaption>
      </figure>
      <p class="parody-punchline"></p>
      <div class="rebirth-card">
        <div class="rebirth-bottle" aria-hidden="true"><span>skinboost</span><strong>NASCER<br>DE NOVO</strong><small>100% FICÇÃO</small></div>
        <div class="rebirth-copy"><span>LANÇAMENTO QUE NÃO EXISTE</span><h4>NASCER DE NOVO</h4><p>Creme nenhum dá conta. Esse aqui é pra voltar de fábrica.</p><button type="button">Quero esse milagre ↗</button><small>Produto fictício de humor. Sem venda ou efeito real.</small></div>
      </div>
    </div>`;
  card.querySelector(".sx-compare-original").src = original;
  const progress = card.querySelector(".parody-progress");
  const retry = card.querySelector(".parody-retry");
  retry.addEventListener("click", onRetry);
  card.querySelector(".rebirth-copy button").addEventListener("click", onOffer);
  parent.append(card);
  return {
    loading() {
      progress.hidden = false;
      progress.textContent =
        "Preparando uma fantasia com IA… pode levar alguns minutos.";
      retry.hidden = true;
      card.setAttribute("aria-busy", "true");
    },
    complete(result) {
      if (
        result.kind !== "parody" ||
        !/^data:image\/jpeg;base64,/.test(result.imageDataUrl || "")
      )
        throw new Error("A fantasia não ficou pronta. Tente novamente.");
      card.querySelector(".sx-compare-base").src = result.imageDataUrl;
      card.querySelector("figcaption").textContent = result.disclaimer;
      card.querySelector(".parody-punchline").textContent = result.caption;
      card.querySelector(".parody-result").hidden = false;
      progress.hidden = true;
      retry.hidden = true;
      card.setAttribute("aria-busy", "false");
    },
    fail(message) {
      progress.hidden = false;
      progress.textContent = message;
      retry.hidden = false;
      card.setAttribute("aria-busy", "false");
    },
  };
}
