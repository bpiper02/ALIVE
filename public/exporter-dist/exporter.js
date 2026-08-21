import {
  AudioBufferSource,
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output
} from "./chunks/chunk-N6T27L2P.js";

// exporter.js
var FPS = 30;
var VIDEO_BITRATE = 8e6;
var AUDIO_BITRATE = 128e3;
var AUDIO_RATE = 48e3;
var AVC_CANDIDATES = ["avc1.4d0028", "avc1.420028"];
var abortError = () => new DOMException("Export cancelled.", "AbortError");
var ensureActive = (signal) => {
  if (signal?.aborted) throw abortError();
};
async function supportedAvcConfig(width, height) {
  if (typeof VideoEncoder === "undefined") return null;
  for (const codec of AVC_CANDIDATES) {
    const config = {
      codec,
      width,
      height,
      bitrate: VIDEO_BITRATE,
      framerate: FPS,
      bitrateMode: "variable",
      latencyMode: "quality",
      hardwareAcceleration: "no-preference",
      avc: { format: "avc" }
    };
    try {
      const result = await VideoEncoder.isConfigSupported(config);
      if (result.supported) return config;
    } catch {
    }
  }
  return null;
}
async function prepareAacEncoder() {
  const config = {
    codec: "mp4a.40.2",
    sampleRate: AUDIO_RATE,
    numberOfChannels: 2,
    bitrate: AUDIO_BITRATE,
    bitrateMode: "variable"
  };
  if (typeof AudioEncoder !== "undefined") {
    try {
      const result = await AudioEncoder.isConfigSupported(config);
      if (result.supported) return { config, fallback: false };
    } catch {
    }
  }
  const { registerAacEncoder } = await import("./chunks/mediabunny-aac-encoder-QDJ3HA3A.js");
  registerAacEncoder();
  return { config, fallback: true };
}
async function renderAudioSegment(input, start, duration, signal) {
  ensureActive(signal);
  const length = Math.max(1, Math.ceil(duration * AUDIO_RATE));
  const context = new OfflineAudioContext(2, length, AUDIO_RATE);
  const source = context.createBufferSource();
  source.buffer = input;
  source.connect(context.destination);
  source.start(0, start, duration);
  const rendered = await context.startRendering();
  source.disconnect();
  ensureActive(signal);
  return rendered;
}
async function exportWithWebCodecs(options, avcConfig) {
  const { canvas, audioBuffer, start, duration, videoOnly, drawFrame, onProgress, signal } = options;
  ensureActive(signal);
  const target = new BufferTarget();
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: "in-memory" }),
    target
  });
  const frameCount = Math.ceil(duration * FPS);
  const videoSource = new CanvasSource(canvas, {
    codec: "avc",
    fullCodecString: avcConfig.codec,
    bitrate: VIDEO_BITRATE,
    bitrateMode: "variable",
    latencyMode: "quality",
    hardwareAcceleration: "no-preference",
    keyFrameInterval: 1,
    sizeChangeBehavior: "deny"
  });
  output.addVideoTrack(videoSource, { maximumPacketCount: frameCount, frameRate: FPS });
  let audioSource = null;
  let audioSegment = null;
  let usedAacFallback = false;
  if (!videoOnly) {
    const aac = await prepareAacEncoder();
    usedAacFallback = aac.fallback;
    audioSegment = await renderAudioSegment(audioBuffer, start, duration, signal);
    audioSource = new AudioBufferSource({
      codec: "aac",
      fullCodecString: aac.config.codec,
      bitrate: AUDIO_BITRATE,
      bitrateMode: "variable",
      transform: { numberOfChannels: 2, sampleRate: AUDIO_RATE }
    });
    output.addAudioTrack(audioSource, { maximumPacketCount: Math.ceil(duration * AUDIO_RATE / 1024) + 2 });
  }
  const cancelOutput = () => !["canceled", "finalized"].includes(output.state) ? output.cancel().catch(() => {
  }) : Promise.resolve();
  signal?.addEventListener("abort", cancelOutput, { once: true });
  try {
    await output.start();
    const audioTask = audioSource ? audioSource.add(audioSegment) : Promise.resolve();
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
      ensureActive(signal);
      const timestamp = frameIndex / FPS;
      drawFrame(Math.min(timestamp, duration));
      await videoSource.add(timestamp, 1 / FPS, { keyFrame: frameIndex % FPS === 0 });
      if (frameIndex % 3 === 0 || frameIndex === frameCount - 1) {
        onProgress(Math.round((frameIndex + 1) / frameCount * 96), "ENCODING MP4");
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
    await audioTask;
    ensureActive(signal);
    onProgress(98, "FINALIZING MP4");
    await output.finalize();
    ensureActive(signal);
    const mimeType = await output.getMimeType();
    return {
      blob: new Blob([target.buffer], { type: mimeType }),
      mimeType,
      extension: "mp4",
      path: "webcodecs",
      usedAacFallback,
      compatibility: "INSTAGRAM / TIKTOK / YOUTUBE READY"
    };
  } catch (error) {
    await cancelOutput();
    throw error;
  } finally {
    signal?.removeEventListener("abort", cancelOutput);
    audioSegment = null;
  }
}
function chooseRecorderType(videoOnly = false) {
  if (typeof MediaRecorder === "undefined") return "";
  const types = videoOnly ? [
    'video/mp4;codecs="avc1.4d0028"',
    'video/mp4;codecs="avc1.420028"',
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm"
  ] : [
    'video/mp4;codecs="avc1.4d0028,mp4a.40.2"',
    'video/mp4;codecs="avc1.420028,mp4a.40.2"',
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm"
  ];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}
async function exportWithMediaRecorder(options) {
  const { canvas, audioBuffer, start, duration, videoOnly, drawFrame, onProgress, signal } = options;
  ensureActive(signal);
  const stream = canvas.captureStream(FPS);
  let context = null;
  let source = null;
  if (!videoOnly) {
    context = new AudioContext();
    source = context.createBufferSource();
    const destination = context.createMediaStreamDestination();
    source.buffer = audioBuffer;
    source.connect(destination);
    destination.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
  }
  const requestedType = chooseRecorderType(videoOnly);
  let recorder;
  try {
    recorder = requestedType ? new MediaRecorder(stream, { mimeType: requestedType, videoBitsPerSecond: VIDEO_BITRATE }) : new MediaRecorder(stream, { videoBitsPerSecond: VIDEO_BITRATE });
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop());
    source?.disconnect();
    await context?.close().catch(() => {
    });
    throw error;
  }
  const actualType = recorder.mimeType || requestedType || "video/webm";
  const chunks = [];
  let animationFrame = 0;
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = async () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      signal?.removeEventListener("abort", cancel);
      recorder.ondataavailable = null;
      recorder.onerror = null;
      recorder.onstop = null;
      stream.getTracks().forEach((track) => track.stop());
      if (source) {
        try {
          source.stop();
        } catch {
        }
        source.disconnect();
      }
      if (context && context.state !== "closed") await context.close().catch(() => {
      });
    };
    const finish = async (fn, value) => {
      if (settled) return;
      settled = true;
      await cleanup();
      fn(value);
    };
    const cancel = () => {
      if (recorder.state !== "inactive") try {
        recorder.stop();
      } catch {
      }
      chunks.length = 0;
      finish(reject, abortError());
    };
    signal?.addEventListener("abort", cancel, { once: true });
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    recorder.onerror = (event) => finish(reject, event.error || new Error("MediaRecorder export failed."));
    recorder.onstop = () => {
      if (signal?.aborted) return finish(reject, abortError());
      const mimeType = recorder.mimeType || actualType;
      const isMp4 = mimeType.includes("mp4");
      const blob = new Blob(chunks, { type: mimeType });
      chunks.length = 0;
      finish(resolve, {
        blob,
        mimeType,
        extension: isMp4 ? "mp4" : "webm",
        path: "mediarecorder",
        usedAacFallback: false,
        compatibility: isMp4 ? "INSTAGRAM / TIKTOK / YOUTUBE READY" : "TIKTOK / YOUTUBE READY \xB7 INSTAGRAM MAY REJECT WEBM"
      });
    };
    recorder.start(500);
    source?.start(0, start, duration);
    const begun = performance.now();
    const render = () => {
      if (signal?.aborted) return;
      const elapsed = (performance.now() - begun) / 1e3;
      drawFrame(Math.min(elapsed, duration));
      onProgress(Math.min(99, Math.round(elapsed / duration * 100)), "RECORDING FALLBACK");
      if (elapsed < duration) animationFrame = requestAnimationFrame(render);
      else if (recorder.state !== "inactive") recorder.stop();
    };
    render();
  });
}
async function exportAliveVideo(options) {
  const avcConfig = await supportedAvcConfig(options.canvas.width, options.canvas.height);
  if (avcConfig) {
    try {
      return await exportWithWebCodecs(options, avcConfig);
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      options.onPathFallback?.(error);
    }
  } else {
    options.onPathFallback?.(new Error("The requested H.264 WebCodecs configuration is unavailable."));
  }
  return exportWithMediaRecorder(options);
}
async function inspectExportCapabilities({ width, height, videoOnly = false }) {
  const video = await supportedAvcConfig(width, height);
  let nativeAac = videoOnly;
  if (!videoOnly && typeof AudioEncoder !== "undefined") {
    try {
      nativeAac = (await AudioEncoder.isConfigSupported({
        codec: "mp4a.40.2",
        sampleRate: AUDIO_RATE,
        numberOfChannels: 2,
        bitrate: AUDIO_BITRATE
      })).supported;
    } catch {
    }
  }
  return {
    primary: Boolean(video),
    videoCodec: video?.codec || null,
    nativeAac,
    aacFallbackNeeded: Boolean(video && !videoOnly && !nativeAac),
    recorderType: chooseRecorderType(videoOnly)
  };
}
export {
  exportAliveVideo,
  inspectExportCapabilities
};
