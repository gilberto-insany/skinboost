import { $, $$, escapeHtml as escape, icon } from "./dom.js";
import { openDialog, closeDialog, dialogContent as content } from "./dialog.js";
export function showCheckin() {
  openDialog(
    `<p class="eyebrow">ACOMPANHAMENTO / DEMONSTRAÇÃO</p><h2 id="dialog-title">Como foi cuidar<br>de você hoje?</h2><p>O próximo passo também pode ser simplificar.</p><div class="choices" role="group" aria-label="Sua experiência"><button class="choice" aria-pressed="false">Consegui manter</button><button class="choice" aria-pressed="false">Preciso ajustar</button><button class="choice" aria-pressed="false">Ainda não comecei</button></div><label for="checkin-note">Quer contar algo mais? <span style="color:#7b8773">Opcional</span></label><textarea id="checkin-note" placeholder="O que funcionou? O que ficou difícil?" maxlength="600"></textarea><p id="checkin-error" role="alert" hidden>Escolha uma das opções para continuar.</p><button id="save-checkin" class="pill dark">Concluir check-in ${icon("check")}</button><p style="font-size:11px;margin-top:20px">Exemplo local. Sem conta, envio de dados ou histórico salvo.</p>`,
  );
  let selected = "";
  $$(".choice", content).forEach(
    (el) =>
      (el.onclick = () => {
        selected = el.textContent;
        $$(".choice", content).forEach((b) =>
          b.setAttribute("aria-pressed", String(b === el)),
        );
        $("#checkin-error").hidden = true;
      }),
  );
  $("#save-checkin").onclick = () => {
    if (!selected) {
      $("#checkin-error").hidden = false;
      return;
    }
    openDialog(
      `<p class="eyebrow">CHECK-IN CONCLUÍDO / DEMONSTRAÇÃO</p><h2 id="dialog-title">Um passo de cada vez.</h2><p>Você marcou: <strong>${escape(selected)}</strong>.</p><p class="dialog-notice">Assim termina o exemplo de acompanhamento. Nada foi enviado ou salvo em uma conta.</p><button id="checkin-close" class="pill dark">Voltar à página ${icon("arrow-up-right")}</button>`,
    );
    $("#checkin-close").onclick = closeDialog;
  };
}
