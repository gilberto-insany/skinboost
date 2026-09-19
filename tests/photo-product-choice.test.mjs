import test from "node:test";
import assert from "node:assert/strict";
import {
  currentPhotoAnalysis,
  productChoiceFromText,
} from "../src/chat/photo-product-choice.js";
import {
  PHOTO_CHAT_RESPONSE,
  LIMITED_PHOTO_CHAT_RESPONSE,
} from "./fixtures/photo-chat.mjs";

const photo = "data:image/jpeg;base64,YQ==";
function fixture(response = PHOTO_CHAT_RESPONSE) {
  return {
    photoDataUrl: photo,
    photoSubmitted: true,
    step: "context",
    messages: [
      { id: "user", role: "user", photo },
      { id: "analysis", role: "assistant", ...response },
    ],
  };
}
test("product choice only uses the latest analysis for the attached photo", () => {
  const state = fixture();
  assert.equal(currentPhotoAnalysis(state).photoAnalysis.status, "observed");
  assert.equal(
    currentPhotoAnalysis({ ...state, photoDataUrl: "different" }),
    null,
  );
  assert.equal(currentPhotoAnalysis({ ...state, photoSubmitted: false }), null);
  assert.equal(currentPhotoAnalysis({ ...state, photoAnalysisId: null }), null);
  assert.equal(currentPhotoAnalysis({ ...state, step: "care" }), null);
  state.messages.push({
    id: "limited",
    role: "assistant",
    ...LIMITED_PHOTO_CHAT_RESPONSE,
  });
  assert.equal(currentPhotoAnalysis(state).photoAnalysis.status, "limited");
});
test("only affirmative choices of offered products trigger generation", () => {
  const analysis = currentPhotoAnalysis(fixture());
  assert.equal(productChoiceFromText("Quero o Comfort", analysis), "comfort");
  assert.equal(productChoiceFromText("Cleanse", analysis), "cleanse");
  for (const text of [
    "Não quero o Comfort",
    "Comfort funciona?",
    "Quero o Comfort, mas estou com dor",
    "Quero o Balance",
    "Cleanse e Comfort",
    "Me explique Comfort",
  ])
    assert.equal(productChoiceFromText(text, analysis), "", text);
  assert.equal(
    productChoiceFromText(
      "Comfort",
      currentPhotoAnalysis(fixture(LIMITED_PHOTO_CHAT_RESPONSE)),
    ),
    "",
  );
});
