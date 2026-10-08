// Renders every sound and one loop of each music track to files, offline in headless
// Chromium, and prints peak/RMS levels as a sanity check.
// Usage: node render.js [outDir] [nameFilter]   (default ./renders, all sounds). Needs playwright (preinstalled in Claude's container).
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, 'renders'));
const ENGINE = fs.readFileSync(path.join(__dirname, 'src/engine.js'), 'utf8');

const JOBS = [
  ['sfx', 'shot-pew', "S.shotPew(b,.02)"],
  ['sfx', 'shot-spit', "S.shotSpit(b,.02)"],
  ['sfx', 'swallow-gulp', "S.gulp(b,.02)"],
  ['sfx', 'swallow-slurp', "S.slurp(b,.02)"],
  ['sfx', 'divide-squelch', "S.divideSquelch(b,.02)"],
  ['sfx', 'divide-bubble', "S.divideBubble(b,.02)"],
  ['sfx', 'kill-pop', "S.pop(b,.02)"],
  ['sfx', 'kill-crunch', "S.crunch(b,.02)"],
  ['sfx', 'burst-pops', "S.burstPops(b,.02)"],
  ['sfx', 'burst-tight', "S.burstTight(b,.02)"],
  ['sfx', 'net-snap', "S.netSnap(b,.02)"],
  ['sfx', 'net-cinch', "S.netCinch(b,.02)"],
  ['sfx', 'nk-zap', "S.zap(b,.02)"],
  ['sfx', 'storm-charge-and-fire', "S.stormCharge(b,.02).fire(5.4)"],
  ['sfx', 'storm-blast', "S.stormBlast(b,.02)"],
  ['sfx', 'organ-bar-monitor', "S.organMonitor(b,.02)"],
  ['sfx', 'organ-bar-crack', "S.organCrack(b,.02)"],
  ['sfx', 'organ-flat-short', "S.flatShort(b,.02)"],
  ['sfx', 'organ-flat-blip', "S.flatBlip(b,.02)"],
  ['sfx', 'organ-flat-alarm', "S.flatAlarm(b,.02)"],
  ['sfx', 'host-failure-flatline', "S.flatline(b,.02)"],
  ['sfx', 'host-failure-shutdown', "S.shutdown(b,.02)"],
  ['sfx', 'wave-drums', "S.waveDrums(b,.02)"],
  ['sfx', 'wave-stabs', "S.waveStabs(b,.02)"],
  ['sfx', 'victory-arp', "S.victoryArp(b,.02)"],
  ['sfx', 'victory-bells', "S.victoryBells(b,.02)"],
  ['sfx', 'ui-click', "S.tapClick(b,.02)"],
  ['sfx', 'ui-blip', "S.tapBlip(b,.02)"],
  ['sfx', 'pause-open', "S.pauseOpen(b,.02)"],
  ['sfx', 'pause-close', "S.pauseClose(b,.02)"],
  ...Object.keys({ fine: 1, tired: 1, feverish: 1, exhausted: 1, overload: 1 }).map((k, i) =>
    ['sfx', 'heart-' + k, `(()=>{const h=CytoSound.HEART.${k};let t=.02;for(let n=0;n<6;n++){S.heartbeat(b,t,{hard:${i / 4}});t+=h.gap*(h.skip&&n%3==2?1.6:1)}})()`]),
  ['music', 'music-petri-dish', "CytoSound.scheduleLoop(b,'petri',.02)"],
  ['music', 'music-bloodstream-calm', "CytoSound.scheduleLoop(b,'blood',.02,0)"],
  ['music', 'music-bloodstream-fight', "CytoSound.scheduleLoop(b,'blood',.02,1)"],
  ['music', 'music-bloodstream-hot', "CytoSound.scheduleLoop(b,'blood',.02,2)"],
  ['music', 'music-bloodstream-fever', "CytoSound.scheduleLoop(b,'blood',.02,3)"],
  ['music', 'music-bloodstream-crisis', "CytoSound.scheduleLoop(b,'blood',.02,4)"],
  ['music', 'music-fever', "CytoSound.scheduleLoop(b,'fever',.02,1,2)"],
  ['music', 'music-germ-parade', "CytoSound.scheduleLoop(b,'parade',.02)"]
];
const LEN = { sfx: 7, music: 36 };

function wav(chans, sr) {
  const n = chans[0].length, buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) for (let c = 0; c < 2; c++) buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(chans[c][i] * 32767))), 44 + i * 4 + c * 2);
  return buf;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent('<html><body></body></html>');
  await page.addScriptTag({ content: ENGINE });
  const rows = [];
  const only = process.argv[3];
  for (const [kind, name, code] of JOBS) {
    if (only && !name.includes(only)) continue;
    const res = await page.evaluate(async ({ code, len }) => {
      CytoSound.seed(42);
      const sr = 44100, ctx = new OfflineAudioContext(2, sr * len, sr), b = CytoSound.makeBus(ctx), S = CytoSound.SFX;
      const r = eval(code); const used = typeof r === 'number' ? r : null;
      const buf = await ctx.startRendering();
      const ch = [buf.getChannelData(0), buf.getChannelData(1)];
      // trim trailing silence (below -60 dB), keep 50 ms
      let end = ch[0].length - 1;
      while (end > 0 && Math.abs(ch[0][end]) < 1e-3 && Math.abs(ch[1][end]) < 1e-3) end--;
      end = Math.min(ch[0].length, end + Math.floor(sr * 0.05));
      let peak = 0, sum = 0, nan = 0;
      for (let i = 0; i < end; i++) for (const c of ch) { const v = c[i]; if (!isFinite(v)) nan++; peak = Math.max(peak, Math.abs(v)); sum += v * v; }
      return { L: Array.from(ch[0].subarray(0, end)), R: Array.from(ch[1].subarray(0, end)), peak, rms: Math.sqrt(sum / (end * 2)), nan, secs: end / sr, used };
    }, { code, len: LEN[kind] });
    const file = path.join(OUT, name + '.wav');
    fs.writeFileSync(file, wav([res.L, res.R], 44100));
    if (kind === 'music') {
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', file, '-c:a', 'aac', '-b:a', '160k', file.replace(/\.wav$/, '.m4a')]);
      fs.unlinkSync(file);
    }
    rows.push(`${name.padEnd(28)} ${res.secs.toFixed(2).padStart(6)}s  peak ${(20 * Math.log10(res.peak || 1e-9)).toFixed(1).padStart(6)} dB  rms ${(20 * Math.log10(res.rms || 1e-9)).toFixed(1).padStart(6)} dB${res.nan ? '  NaN!' : ''}`);
  }
  await browser.close();
  console.log(rows.join('\n'));
})();
