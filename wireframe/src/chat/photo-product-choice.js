import { photoResponseFields } from "./photo-experience.js";

// A product choice belongs to the most recent analysis of this exact photo.
export function currentPhotoAnalysis(state) {
  if (
    !state.photoDataUrl ||
    state.photoSubmitted === false ||
    state.step === "care" ||
    state.photoAnalysisId === null
  )
    return null;
  const messages = state.messages || [];
  const index = messages.findLastIndex((message) =>
    state.photoAnalysisId
      ? message.id === state.photoAnalysisId
      : !!message.photoAnalysis,
  );
  if (index < 0) return null;
  const original = messages
    .slice(0, index)
    .findLast((message) => message.role === "user" && message.photo)?.photo;
  if (original !== state.photoDataUrl) return null;
  return { id: messages[index].id, ...photoResponseFields(messages[index]) };
}

export function productChoiceFromText(text, analysis) {
  if (analysis?.photoAnalysis?.status !== "observed") return "";
  const value = String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
  // A mention, a question, or a rejection must never spend an image generation.
  const match = value.match(
    /^(?:(?:eu )?(?:quero|escolho|prefiro|seleciono|pode ser|vamos de|vou de|o produto e) )?(?:o |a |produto )?(?:skinboost )?(cleanse|balance|comfort)(?: da skinboost)?[.!]?$/,
  );
  return match &&
    analysis.productMatches?.some((product) => product.productId === match[1])
    ? match[1]
    : "";
}
