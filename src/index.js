#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { startRecording, stopRecording, interactWithPage, listSessions, cleanup, setHeadless } from './recorder.js';
import { convertToGif, convertToMp4, listRecordings } from './converter.js';

// CLI flags: --headless to run browser without visible window (default: headed)
if (process.argv.includes('--headless')) {
  setHeadless(true);
}

const mcp = new McpServer({
  name: 'pagecast',
  version: '0.2.0'
});

// Tool 1: Start recording a page
mcp.tool(
  'record_page',
  'Open a URL in a headless browser and start recording video. Returns a session ID. Call stop_recording when done.',
  {
    url: z.string().describe('URL to open and record'),
    width: z.number().optional().default(1280).describe('Viewport width in pixels'),
    height: z.number().optional().default(720).describe('Viewport height in pixels')
  },
  async ({ url, width, height }) => {
    try {
      const result = await startRecording(url, { width, height });
      return {
        content: [{
          type: 'text',
          text: `Recording started!\n\nSession: ${result.sessionId}\nURL: ${result.url}\nStarted: ${result.startedAt}\n\nUse interact_page to scroll/click/hover during recording.\nCall stop_recording with sessionId "${result.sessionId}" when done.`
        }]
      };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// Tool 2: Interact with a recording session
mcp.tool(
  'interact_page',
  'Perform actions on a recording page (scroll, click, hover, type, press, select, wait, navigate). Actions are performed sequentially and recorded in the video.',
  {
    sessionId: z.string().describe('Session ID from record_page'),
    actions: z.array(z.object({
      type: z.enum(['wait', 'scroll', 'click', 'hover', 'type', 'press', 'select', 'navigate']).describe('Action type'),
      ms: z.number().optional().describe('Wait duration in ms (for wait action)'),
      x: z.number().optional().describe('Scroll X pixels (for scroll) or hover X coordinate (for hover)'),
      y: z.number().optional().describe('Scroll Y pixels (for scroll) or hover Y coordinate (for hover)'),
      selector: z.string().optional().describe('CSS selector (for click/hover/type/select)'),
      url: z.string().optional().describe('URL (for navigate)'),
      text: z.string().optional().describe('Text to type (for type action)'),
      delay: z.number().optional().describe('Typing delay between characters in ms (for type action, default 80)'),
      key: z.string().optional().describe('Key to press, e.g. "Enter", "Tab", "Escape", "Control+a" (for press action)'),
      value: z.string().optional().describe('Option value to select (for select action on <select> elements)')
    })).describe('Array of actions to perform sequentially')
  },
  async ({ sessionId, actions }) => {
    try {
      const results = await interactWithPage(sessionId, actions);
      return {
        content: [{
          type: 'text',
          text: `Actions completed:\n${results.map((r, i) => `${i + 1}. ${r}`).join('\n')}`
        }]
      };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// Tool 3: Stop recording
mcp.tool(
  'stop_recording',
  'Stop a recording session and save the video as .webm file.',
  {
    sessionId: z.string().describe('Session ID from record_page')
  },
  async ({ sessionId }) => {
    try {
      const result = await stopRecording(sessionId);
      return {
        content: [{
          type: 'text',
          text: `Recording stopped!\n\nFile: ${result.webmPath}\nDuration: ${result.durationSeconds}s\n\nUse convert_to_gif to create a GIF from this video.`
        }]
      };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// Tool 4: Convert WebM to GIF
mcp.tool(
  'convert_to_gif',
  'Convert a .webm video to an optimized GIF using ffmpeg two-pass palette method.',
  {
    webmPath: z.string().describe('Path to the .webm file'),
    fps: z.number().optional().default(10).describe('GIF frame rate (default 10)'),
    width: z.number().optional().default(640).describe('GIF width in pixels (default 640, height auto-scaled)'),
    startTime: z.number().optional().default(0).describe('Skip first N seconds (useful to trim blank loading frames)')
  },
  async ({ webmPath, fps, width, startTime }) => {
    try {
      const result = await convertToGif(webmPath, { fps, width, startTime });
      return {
        content: [{
          type: 'text',
          text: `GIF created!\n\nFile: ${result.gifPath}\nSize: ${result.sizeMB} MB`
        }]
      };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// Tool 5: Convert WebM to MP4
mcp.tool(
  'convert_to_mp4',
  'Convert a .webm video to MP4 (H.264). Widely compatible for social media, sharing, and embedding.',
  {
    webmPath: z.string().describe('Path to the .webm file'),
    crf: z.number().optional().default(23).describe('Quality (18=high, 23=default, 28=small file)')
  },
  async ({ webmPath, crf }) => {
    try {
      const result = await convertToMp4(webmPath, { crf });
      return {
        content: [{
          type: 'text',
          text: `MP4 created!\n\nFile: ${result.mp4Path}\nSize: ${result.sizeMB} MB`
        }]
      };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// Tool 6: Record and convert in one step
mcp.tool(
  'record_and_gif',
  'All-in-one: open URL, wait for specified duration, stop recording, convert to GIF. Best for simple demos.',
  {
    url: z.string().describe('URL to record'),
    durationSeconds: z.number().optional().default(5).describe('How long to record (default 5 seconds)'),
    width: z.number().optional().default(1280).describe('Viewport width'),
    height: z.number().optional().default(720).describe('Viewport height'),
    gifFps: z.number().optional().default(10).describe('GIF frame rate'),
    gifWidth: z.number().optional().default(640).describe('GIF width (height auto-scaled)')
  },
  async ({ url, durationSeconds, width, height, gifFps, gifWidth }) => {
    try {
      const rec = await startRecording(url, { width, height });
      await new Promise(r => setTimeout(r, durationSeconds * 1000));
      const stop = await stopRecording(rec.sessionId);
      const gif = await convertToGif(stop.webmPath, { fps: gifFps, width: gifWidth });
      return {
        content: [{
          type: 'text',
          text: `Recording complete!\n\nVideo: ${stop.webmPath} (${stop.durationSeconds}s)\nGIF: ${gif.gifPath} (${gif.sizeMB} MB)\n\nReady to use in README or documentation.`
        }]
      };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// Tool 7: List recordings
mcp.tool(
  'list_recordings',
  'List all .webm and .gif recordings in the output directory.',
  {
    directory: z.string().optional().describe('Directory to list (default: ./recordings)')
  },
  async ({ directory }) => {
    try {
      const dir = directory || process.env.RECORDING_OUTPUT_DIR || './recordings';
      const recordings = await listRecordings(dir);
      if (recordings.length === 0) {
        return { content: [{ type: 'text', text: `No recordings found in ${dir}` }] };
      }
      const list = recordings.map(r => `${r.name} (${r.type}, ${r.sizeMB} MB, ${r.createdAt})`).join('\n');
      return { content: [{ type: 'text', text: `Recordings in ${dir}:\n\n${list}` }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// Cleanup on exit
process.on('SIGINT', async () => { await cleanup(); process.exit(0); });
process.on('SIGTERM', async () => { await cleanup(); process.exit(0); });

// Start MCP server
const transport = new StdioServerTransport();
await mcp.connect(transport);
