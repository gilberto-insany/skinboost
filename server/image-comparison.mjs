import sharp from "sharp";

// Only canvas normalization happens here. No face registration, skin mask,
// exposure correction, retouching, or inferred clinical change is performed.
const MAX_INPUT_PIXELS = 25_000_000;
const MAX_COMPARISON_EDGE = 1536;
const decodeOptions = { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" };
const background = { r: 128, g: 128, b: 128, alpha: 1 };
const multiple16 = (value) => Math.ceil(value / 16) * 16;

export class ComparisonImageError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Documented GPT Image 2/2.5 sizes: multiples of 16, 1:3–3:1,
 * 655,360–8,294,400 pixels. We stay around 1 MP, well below the maximum.
 * https://developers.openai.com/api/docs/guides/image-generation
 */
export function comparisonCanvas(width, height, model) {
  const ratio = width / height;
  if (
    !Number.isFinite(ratio) ||
    width < 1 ||
    height < 1 ||
    ratio < 1 / 3 ||
    ratio > 3
  )
    throw new ComparisonImageError(
      400,
      "photo_aspect_ratio",
      "Para comparar as fotos sem recortar, use uma imagem com proporção entre 1:3 e 3:1.",
    );
  const customSize =
    /^gpt-image-(?:2(?:-\d{4}-\d{2}-\d{2})?|2\.5-(?:sunburst|flare)(?:-\d{4}-\d{2}-\d{2})?)$/.test(
      model,
    );
  if (!customSize) {
    // Known standard sizes remain compatible with a configured older model.
    // Letterboxing is removed afterwards; the source is never cover-cropped.
    if (ratio > 1.2) return { width: 1536, height: 1024 };
    if (ratio < 1 / 1.2) return { width: 1024, height: 1536 };
    return { width: 1024, height: 1024 };
  }
  let canvasWidth = multiple16(Math.sqrt(1_048_576 * ratio));
  let canvasHeight = multiple16(Math.sqrt(1_048_576 / ratio));
  if (canvasWidth > canvasHeight * 3)
    canvasHeight = multiple16(canvasWidth / 3);
  if (canvasHeight > canvasWidth * 3)
    canvasWidth = multiple16(canvasHeight / 3);
  return { width: canvasWidth, height: canvasHeight };
}

/** Decode and orient the full photograph, then letterbox it onto the exact
 * requested provider canvas. Normalization never adjusts exposure or color
 * balance and never cuts off source content. All processing stays in memory.
 */
export async function prepareComparisonPhoto(photoDataUrl, model) {
  try {
    const bytes = Buffer.from(photoDataUrl.split(",")[1], "base64");
    const metadata = await sharp(bytes, decodeOptions).metadata();
    if (!metadata.width || !metadata.height || (metadata.pages || 1) !== 1)
      throw new Error("Unsupported image");
    const rotated = metadata.orientation >= 5 && metadata.orientation <= 8;
    const sourceWidth = rotated ? metadata.height : metadata.width;
    const sourceHeight = rotated ? metadata.width : metadata.height;
    // Check before decoding and before any paid provider call.
    comparisonCanvas(sourceWidth, sourceHeight, model);
    const normalized = await sharp(bytes, decodeOptions)
      .rotate()
      .flatten({ background: "#fff" })
      .toColourspace("srgb")
      .resize({
        width: MAX_COMPARISON_EDGE,
        height: MAX_COMPARISON_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .raw()
      .toBuffer({ resolveWithObject: true });
    const { width, height, channels } = normalized.info;
    const canvas = comparisonCanvas(width, height, model);
    const contained = await sharp(normalized.data, {
      raw: { width, height, channels },
    })
      .resize({ width: canvas.width, height: canvas.height, fit: "inside" })
      .raw()
      .toBuffer({ resolveWithObject: true });
    const contentWidth = contained.info.width;
    const contentHeight = contained.info.height;
    const left = Math.floor((canvas.width - contentWidth) / 2);
    const top = Math.floor((canvas.height - contentHeight) / 2);
    const prepared = await sharp(contained.data, { raw: contained.info })
      .extend({
        left,
        top,
        right: canvas.width - contentWidth - left,
        bottom: canvas.height - contentHeight - top,
        background,
      })
      .jpeg({ quality: 95, chromaSubsampling: "4:4:4" })
      .toBuffer();
    return {
      imageDataUrl: `data:image/jpeg;base64,${prepared.toString("base64")}`,
      size: `${canvas.width}x${canvas.height}`,
      canvas,
      content: { left, top, width: contentWidth, height: contentHeight },
      geometry: {
        width,
        height,
        aspectRatio: width / height,
        sourceWidth,
        sourceHeight,
        sourceOrientation: metadata.orientation || 1,
        orientation: "normalized",
        alignment: "approximate",
      },
    };
  } catch (error) {
    if (error instanceof ComparisonImageError) throw error;
    throw new ComparisonImageError(
      400,
      "invalid_photo",
      "Não foi possível ler essa foto. Use uma imagem JPG, PNG ou WebP válida.",
    );
  }
}

/** Remove only our known technical margin, then fit back to the original
 * oriented canvas. No stretching, auto-cropping, registration, or brightness
 * matching. A provider response with a different aspect ratio is rejected.
 */
export async function finishComparisonPhoto(imageBytes, prepared) {
  try {
    const metadata = await sharp(imageBytes, decodeOptions).metadata();
    const { canvas, content, geometry } = prepared;
    if (
      metadata.format !== "jpeg" ||
      (metadata.pages || 1) !== 1 ||
      metadata.width * canvas.height !== metadata.height * canvas.width
    )
      throw new Error("Unexpected provider geometry");
    // A provider can return another resolution only if its ratio is identical.
    // Resampling is uniform; it cannot conceal a changed crop or moved face.
    const providerCanvas = await sharp(imageBytes, decodeOptions)
      .resize({ width: canvas.width, height: canvas.height, fit: "inside" })
      .raw()
      .toBuffer({ resolveWithObject: true });
    const result = await sharp(providerCanvas.data, {
      raw: providerCanvas.info,
    })
      .extract(content)
      .resize({
        width: geometry.width,
        height: geometry.height,
        fit: "contain",
        background,
      })
      .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
      .toBuffer();
    if (result.length > 3_000_000) throw new Error("Output too large");
    return {
      imageDataUrl: `data:image/jpeg;base64,${result.toString("base64")}`,
      imageGeometry: geometry,
    };
  } catch {
    throw new ComparisonImageError(
      502,
      "invalid_image_response",
      "A imagem gerada não manteve um formato válido para a comparação. Tente novamente.",
    );
  }
}
