/* Runs in a dedicated worker. No customer photos leave the browser for this check. */
self.onmessage = async ({ data: blob }) => {
  let bitmap, detector;
  try {
    importScripts("/vto-assets/vision_bundle.js");
    const files =
      await Vision.FilesetResolver.forVisionTasks("/vto-assets/wasm");
    detector = await Vision.PoseLandmarker.createFromOptions(files, {
      baseOptions: {
        modelAssetPath: "/vto-assets/pose_landmarker_lite.task",
        delegate: "CPU",
      },
      runningMode: "IMAGE",
      numPoses: 2,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      outputSegmentationMasks: false,
    });
    bitmap = await createImageBitmap(blob);
    const result = detector.detect(bitmap);
    const poses = result.landmarks.map((pose) =>
      pose.map((p) => ({ x: p.x, y: p.y, visibility: p.visibility ?? 0 })),
    );
    // Conservative quality check of the person area, so a textured background does not hide blur.
    const points = poses[0]?.filter((p) => p.visibility > 0.5) || [];
    const x = points.length
      ? Math.max(0, Math.min(...points.map((p) => p.x)) - 0.08)
      : 0;
    const y = points.length
      ? Math.max(0, Math.min(...points.map((p) => p.y)) - 0.08)
      : 0;
    const right = points.length
      ? Math.min(1, Math.max(...points.map((p) => p.x)) + 0.08)
      : 1;
    const bottom = points.length
      ? Math.min(1, Math.max(...points.map((p) => p.y)) + 0.08)
      : 1;
    const canvas = new OffscreenCanvas(160, 200),
      ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(
      bitmap,
      x * bitmap.width,
      y * bitmap.height,
      (right - x) * bitmap.width,
      (bottom - y) * bitmap.height,
      0,
      0,
      160,
      200,
    );
    const pixels = ctx.getImageData(0, 0, 160, 200).data,
      gray = new Float32Array(160 * 200);
    let mean = 0,
      sum = 0,
      squares = 0,
      n = 0;
    for (let i = 0; i < gray.length; i++) {
      gray[i] =
        0.2126 * pixels[i * 4] +
        0.7152 * pixels[i * 4 + 1] +
        0.0722 * pixels[i * 4 + 2];
      mean += gray[i];
    }
    for (let y = 1; y < 199; y++)
      for (let x = 1; x < 159; x++) {
        const i = y * 160 + x,
          v =
            4 * gray[i] -
            gray[i - 1] -
            gray[i + 1] -
            gray[i - 160] -
            gray[i + 160];
        sum += v;
        squares += v * v;
        n++;
      }
    self.postMessage({
      poses,
      mean: mean / gray.length,
      sharpness: squares / n - (sum / n) ** 2,
    });
  } catch {
    self.postMessage({ error: "PHOTO_CHECK_UNAVAILABLE" });
  } finally {
    bitmap?.close();
    detector?.close();
  }
};