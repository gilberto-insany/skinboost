import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {
  comparisonCanvas,
  prepareComparisonPhoto,
  finishComparisonPhoto,
} from "../server/image-comparison.mjs";

const model = "gpt-image-2.5-sunburst";
const dataUrl = (bytes) => `data:image/png;base64,${bytes.toString("base64")}`;
const bytesOf = (value) => Buffer.from(value.split(",")[1], "base64");
const plain = (width, height) =>
  sharp({ create: { width, height, channels: 3, background: "#d09682" } });

test("provider canvases meet documented dimensions, ratio and pixel limits for both orientations", () => {
  for (const [width, height] of [
    [384, 384],
    [900, 1600],
    [1600, 900],
    [1297, 865],
    [500, 1500],
    [1500, 500],
  ]) {
    for (const configuredModel of [
      model,
      `${model}-2026-09-08`,
      "gpt-image-2",
      "gpt-image-1.5",
    ]) {
      const canvas = comparisonCanvas(width, height, configuredModel);
      assert.equal(canvas.width % 16, 0);
      assert.equal(canvas.height % 16, 0);
      assert.ok(
        canvas.width / canvas.height >= 1 / 3 &&
          canvas.width / canvas.height <= 3,
      );
      assert.ok(canvas.width * canvas.height >= 655_360);
      assert.ok(canvas.width * canvas.height <= 1_600_000);
      assert.ok(canvas.width <= 3840 && canvas.height <= 3840);
    }
  }
  for (const pair of [
    [400, 2000],
    [2000, 400],
    [0, 100],
  ])
    assert.throws(() => comparisonCanvas(...pair, model), {
      code: "photo_aspect_ratio",
      status: 400,
    });
});

test("portrait and landscape output use the full source canvas with no stretched or cropped corners", async () => {
  for (const [width, height] of [
    [317, 509],
    [509, 317],
    [1297, 865],
  ]) {
    // An asymmetric color grid makes an accidental cover-crop, rotation, or
    // mismatched technical margin observable without using a personal photo.
    const raw = Buffer.alloc(width * height * 3);
    const colors = [
      [230, 35, 35],
      [35, 180, 35],
      [35, 35, 220],
      [220, 180, 35],
    ];
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const color =
          colors[(y >= height / 2 ? 2 : 0) + (x >= width / 2 ? 1 : 0)];
        raw.set(color, (y * width + x) * 3);
      }
    const original = await sharp(raw, { raw: { width, height, channels: 3 } })
      .png()
      .toBuffer();
    const prepared = await prepareComparisonPhoto(dataUrl(original), model);
    const decodedInput = await sharp(bytesOf(prepared.imageDataUrl)).metadata();
    assert.equal(decodedInput.width, prepared.canvas.width);
    assert.equal(decodedInput.height, prepared.canvas.height);
    assert.equal(
      prepared.content.left * 2 + prepared.content.width <=
        prepared.canvas.width,
      true,
    );
    // Mock provider returns the exact prepared canvas. The real postprocessor
    // must remove only its own margin and restore the input geometry.
    const result = await finishComparisonPhoto(
      bytesOf(prepared.imageDataUrl),
      prepared,
    );
    const returned = await sharp(bytesOf(result.imageDataUrl))
      .raw()
      .toBuffer({ resolveWithObject: true });
    assert.equal(returned.info.width, width);
    assert.equal(returned.info.height, height);
    assert.equal(result.imageGeometry.aspectRatio, width / height);
    assert.equal(result.imageGeometry.alignment, "approximate");
    for (const [i, fx, fy] of [
      [0, 0.02, 0.02],
      [1, 0.98, 0.02],
      [2, 0.02, 0.98],
      [3, 0.98, 0.98],
    ]) {
      const at = (Math.floor(height * fy) * width + Math.floor(width * fx)) * 3;
      const actual = [...returned.data.subarray(at, at + 3)];
      actual.forEach((channel, c) =>
        assert.ok(
          Math.abs(channel - colors[i][c]) < 8,
          `${width}x${height}: original corner ${i} remains visible without exposure adjustment`,
        ),
      );
    }
  }
});

test("EXIF orientation is normalized and returned geometry describes the visible photograph", async () => {
  const original = await plain(400, 240)
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();
  const prepared = await prepareComparisonPhoto(
    `data:image/jpeg;base64,${original.toString("base64")}`,
    model,
  );
  assert.deepEqual(prepared.geometry, {
    width: 240,
    height: 400,
    aspectRatio: 0.6,
    sourceWidth: 240,
    sourceHeight: 400,
    sourceOrientation: 6,
    orientation: "normalized",
    alignment: "approximate",
  });
  const result = await finishComparisonPhoto(
    bytesOf(prepared.imageDataUrl),
    prepared,
  );
  const meta = await sharp(bytesOf(result.imageDataUrl)).metadata();
  assert.equal(meta.width, 240);
  assert.equal(meta.height, 400);
  assert.equal(meta.orientation, undefined);
});

test("large source is bounded uniformly and source dimensions remain inspectable", async () => {
  const prepared = await prepareComparisonPhoto(
    dataUrl(await plain(2400, 1600).png().toBuffer()),
    model,
  );
  assert.equal(prepared.geometry.width, 1536);
  assert.equal(prepared.geometry.height, 1024);
  assert.equal(prepared.geometry.sourceWidth, 2400);
  assert.equal(prepared.geometry.sourceHeight, 1600);
  const result = await finishComparisonPhoto(
    bytesOf(prepared.imageDataUrl),
    prepared,
  );
  const meta = await sharp(bytesOf(result.imageDataUrl)).metadata();
  assert.equal(meta.width, 1536);
  assert.equal(meta.height, 1024);
});

test("changed provider aspect ratio is rejected instead of stretching or silently cover-cropping", async () => {
  const prepared = await prepareComparisonPhoto(
    dataUrl(await plain(300, 500).png().toBuffer()),
    model,
  );
  const unexpected = await plain(1024, 1024).jpeg().toBuffer();
  await assert.rejects(() => finishComparisonPhoto(unexpected, prepared), {
    status: 502,
    code: "invalid_image_response",
  });
  const double = await sharp(bytesOf(prepared.imageDataUrl))
    .resize(prepared.canvas.width * 2, prepared.canvas.height * 2)
    .jpeg()
    .toBuffer();
  const compatible = await finishComparisonPhoto(double, prepared);
  const meta = await sharp(bytesOf(compatible.imageDataUrl)).metadata();
  assert.equal(meta.width, 300);
  assert.equal(meta.height, 500);
});

test("undecodable and overly wide input fails locally before a paid edit can be made", async () => {
  await assert.rejects(
    () => prepareComparisonPhoto("data:image/jpeg;base64,/9j/AA==", model),
    { code: "invalid_photo", status: 400 },
  );
  await assert.rejects(
    () =>
      prepareComparisonPhoto(dataUrl(Buffer.from("not a photograph")), model),
    { code: "invalid_photo" },
  );
  const wide = dataUrl(await plain(2000, 400).png().toBuffer());
  await assert.rejects(() => prepareComparisonPhoto(wide, model), {
    code: "photo_aspect_ratio",
  });
});
