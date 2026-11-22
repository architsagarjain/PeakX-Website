/** Browser voice helpers (S9.2): speech recognition when the browser has it, and WAV recording for the AI path. */

type Rec = { lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void; abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null };

export function speechRecognitionSupported(): boolean {
  return typeof window !== 'undefined' && !!((window as unknown as Record<string, unknown>).SpeechRecognition || (window as unknown as Record<string, unknown>).webkitSpeechRecognition);
}
export function recordingSupported(): boolean {
  return typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof window.MediaRecorder !== 'undefined';
}

/** Live transcript from the browser's recogniser. Returns a stop function. */
export function listen(lang: 'en-IN' | 'hi-IN', onText: (text: string, final: boolean) => void, onEnd: (error?: string) => void): () => void {
  const W = window as unknown as Record<string, new () => Rec>;
  const R = W.SpeechRecognition ?? W.webkitSpeechRecognition;
  const r = new R();
  r.lang = lang; r.interimResults = true; r.continuous = true;
  let text = '';
  r.onresult = (e) => {
    let interim = ''; text = '';
    for (let i = 0; i < e.results.length; i++) { const res = e.results[i]; if (res.isFinal) text += res[0].transcript + ' '; else interim += res[0].transcript; }
    onText((text + interim).trim(), false);
  };
  r.onerror = (e) => onEnd(e.error);
  r.onend = () => { onText(text.trim(), true); onEnd(); };
  r.start();
  return () => r.stop();
}

/** Record from the microphone; stop() resolves with 16 kHz mono WAV (works for every browser's recorder format). */
export async function record(maxMs = 30000): Promise<{ stop: () => Promise<Blob>; cancel: () => void }> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
  const rec = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  rec.start();
  const end = () => stream.getTracks().forEach((t) => t.stop());
  let timer: ReturnType<typeof setTimeout> | undefined;
  const done = new Promise<Blob>((resolve) => { rec.onstop = () => { end(); resolve(new Blob(chunks, { type: rec.mimeType })); }; });
  timer = setTimeout(() => rec.state !== 'inactive' && rec.stop(), maxMs);
  return {
    stop: async () => { clearTimeout(timer); if (rec.state !== 'inactive') rec.stop(); return toWav(await done); },
    cancel: () => { clearTimeout(timer); if (rec.state !== 'inactive') rec.stop(); end(); },
  };
}

export async function toWav(blob: Blob, rate = 16000): Promise<Blob> {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
  ctx.close?.();
  const off = new OfflineAudioContext(1, Math.ceil(buf.duration * rate), rate);
  const src = off.createBufferSource(); src.buffer = buf; src.connect(off.destination); src.start();
  return encodeWav((await off.startRendering()).getChannelData(0), rate);
}

/** 16-bit PCM WAV. */
export function encodeWav(samples: Float32Array, rate: number): Blob {
  const out = new DataView(new ArrayBuffer(44 + samples.length * 2));
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); out.setUint32(4, 36 + samples.length * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true); out.setUint32(24, rate, true);
  out.setUint32(28, rate * 2, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true); str(36, 'data'); out.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) { const s = Math.max(-1, Math.min(1, samples[i])); out.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true); }
  return new Blob([out], { type: 'audio/wav' });
}
