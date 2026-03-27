#!/usr/bin/env node
/**
 * Pagecast quality test — records CCO with real selectors, proper waits,
 * and auto-zoom. Iterates until output is GitHub-README quality.
 */

import { startRecording, stopRecording, interactWithPage, cleanup } from './src/recorder.js';
import { convertWithZoomGif, convertWithZoomMp4 } from './src/converter.js';

const CCO_URL = 'http://localhost:3847';
const OUTPUT_DIR = './test-recordings';

async function main() {
  console.log('=== Pagecast Demo Quality Test (v2) ===\n');

  try {
    // Step 1: Start recording (cursor overlay auto-injected)
    console.log('1. Starting recording (1280x720, cursor overlay ON)...');
    const rec = await startRecording(CCO_URL, {
      width: 1280,
      height: 720,
      outputDir: OUTPUT_DIR,
    });
    console.log(`   Session: ${rec.sessionId}\n`);

    // Step 2: Wait for CCO to fully load (scan completes, items appear)
    console.log('2. Waiting for CCO to finish loading...');
    await interactWithPage(rec.sessionId, [
      { type: 'waitForSelector', selector: '#loading.hidden', state: 'attached', timeout: 15000 },
      { type: 'waitForSelector', selector: '.item', state: 'visible', timeout: 10000 },
      { type: 'wait', ms: 500 }, // let render settle
    ]);
    console.log('   Page loaded!\n');

    // Step 3: Demo flow — showcase key features
    console.log('3. Running demo interactions...\n');

    // 3a. Hover over sidebar scope to show tree structure
    console.log('   3a. Clicking a scope in sidebar...');
    let r = await interactWithPage(rec.sessionId, [
      { type: 'click', selector: '.s-scope-hdr[data-scope-id="global"]' },
      { type: 'wait', ms: 800 },
    ]);
    console.log(`       ${r.join(', ')}`);

    // 3b. Click search and type
    console.log('   3b. Searching for "memory"...');
    r = await interactWithPage(rec.sessionId, [
      { type: 'click', selector: '#searchInput' },
      { type: 'wait', ms: 300 },
      { type: 'type', text: 'memory', delay: 80 },
      { type: 'wait', ms: 1000 },
    ]);
    console.log(`       ${r.join(', ')}`);

    // 3c. Click a filter pill
    console.log('   3c. Clicking a filter pill...');
    r = await interactWithPage(rec.sessionId, [
      { type: 'click', selector: 'button.f-pill[data-filter="memory"]' },
      { type: 'wait', ms: 800 },
    ]).catch(async () => {
      // Fallback: click any visible filter pill
      return await interactWithPage(rec.sessionId, [
        { type: 'click', selector: 'button.f-pill' },
        { type: 'wait', ms: 800 },
      ]);
    });
    console.log(`       ${r.join(', ')}`);

    // 3d. Click an item to show detail panel
    console.log('   3d. Clicking an item to show details...');
    r = await interactWithPage(rec.sessionId, [
      { type: 'click', selector: '.item' },
      { type: 'wait', ms: 1200 },
    ]);
    console.log(`       ${r.join(', ')}`);

    // 3e. Clear search and show all items
    console.log('   3e. Clearing search...');
    r = await interactWithPage(rec.sessionId, [
      { type: 'click', selector: '#searchInput' },
      { type: 'press', key: 'Control+a' },
      { type: 'press', key: 'Backspace' },
      { type: 'wait', ms: 800 },
    ]);
    console.log(`       ${r.join(', ')}`);

    // 3f. Click another item
    console.log('   3f. Clicking second item...');
    r = await interactWithPage(rec.sessionId, [
      { type: 'click', selector: '.item:nth-child(2)' },
      { type: 'wait', ms: 1500 },
    ]).catch(async () => {
      return await interactWithPage(rec.sessionId, [
        { type: 'click', selector: '.item' },
        { type: 'wait', ms: 1500 },
      ]);
    });
    console.log(`       ${r.join(', ')}`);

    // Final pause to show the result
    await interactWithPage(rec.sessionId, [{ type: 'wait', ms: 500 }]);

    // Step 4: Stop recording
    console.log('\n4. Stopping recording...');
    const stop = await stopRecording(rec.sessionId);
    console.log(`   WebM: ${stop.webmPath} (${stop.durationSeconds}s)`);
    console.log(`   Timeline: ${stop.timelinePath}\n`);

    // Step 5: Export with auto-zoom
    console.log('5. Exporting zoom GIF (800px wide, 12fps, 2.5x zoom)...');
    const gif = await convertWithZoomGif(stop.webmPath, stop.timelinePath, {
      zoomLevel: 2.5,
      transitionDuration: 0.35,
      holdPerTarget: 0.8,
      preLead: 0.25,
      fps: 12,
      width: 800,
    });
    console.log(`   GIF: ${gif.gifPath} (${gif.sizeMB} MB, ${gif.zoomEvents} zoom events)`);

    console.log('\n6. Exporting zoom MP4 (2.5x zoom)...');
    const mp4 = await convertWithZoomMp4(stop.webmPath, stop.timelinePath, {
      zoomLevel: 2.5,
      transitionDuration: 0.35,
      holdPerTarget: 0.8,
      preLead: 0.25,
    });
    console.log(`   MP4: ${mp4.mp4Path} (${mp4.sizeMB} MB, ${mp4.zoomEvents} zoom events)`);

    // Also export a regular (no zoom) GIF for comparison
    console.log('\n7. Exporting regular GIF (no zoom) for comparison...');
    const { convertToGif } = await import('./src/converter.js');
    const regularGif = await convertToGif(stop.webmPath, { fps: 12, width: 800 });
    console.log(`   Regular GIF: ${regularGif.gifPath} (${regularGif.sizeMB} MB)`);

    console.log('\n=== Done! Compare the files: ===');
    console.log(`   Regular: ${regularGif.gifPath}`);
    console.log(`   Zoom:    ${gif.gifPath}`);
    console.log(`   MP4:     ${mp4.mp4Path}`);

  } catch (err) {
    console.error('Fatal:', err.message);
    console.error(err.stack);
  } finally {
    await cleanup();
  }
}

main();
