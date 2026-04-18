import Anthropic from '@anthropic-ai/sdk';
import { chromium, BrowserContext, Page } from 'playwright';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import type { AgentEvent, ResearchResult } from './types';

dotenv.config();

const TODAY = new Date().toISOString().slice(0, 10);
const PROFILE_DIR = path.join(process.cwd(), '.chrome-profile');
const TRACES_DIR = 'traces';
const DIGESTS_DIR = 'digests';

let context: BrowserContext | null = null;
let page: Page | null = null;

const client = new Anthropic();

// ── IO ───────────────────────────────────────────────────────────────────────
// When running in Electron (emit provided), events go to UI.
// When running as CLI (no emit), write to stdout + trace file as before.

let traceFile: string | null = null;

function ensureDirs() {
  [TRACES_DIR, DIGESTS_DIR, PROFILE_DIR].forEach(d => fs.mkdirSync(d, { recursive: true }));
}

function writeTrace(msg: string) {
  if (traceFile) fs.appendFileSync(traceFile, msg);
}

function cliOut(msg: string, emit?: (e: AgentEvent) => void) {
  if (!emit) process.stdout.write(msg);
  writeTrace(msg);
}

// ── Browser ──────────────────────────────────────────────────────────────────

export async function initBrowser(emit?: (e: AgentEvent) => void) {
  cliOut('Starting Chrome...\n', emit);
  context = await chromium.launchPersistentContext(PROFILE_DIR, {
    channel: 'chrome',
    headless: false,
    slowMo: 700,
    viewport: { width: 1280, height: 900 },
    args: ['--disable-blink-features=AutomationControlled'],
    ignoreDefaultArgs: ['--enable-automation'],
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  page = await context.newPage();
  await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  const isLoggedIn =
    !page.url().includes('login') &&
    !page.url().includes('i/flow') &&
    await page.locator('[data-testid="SideNav_NewTweet_Button"]').isVisible({ timeout: 5000 }).catch(() => false);

  if (!isLoggedIn) {
    cliOut('Not logged in — please log in in Chrome window...\n', emit);
    emit?.({ type: 'log', text: 'Please log in to X in the Chrome window. Waiting...' });
    await login(emit);
  } else {
    cliOut('Session valid.\n', emit);
    emit?.({ type: 'log', text: 'X session valid.' });
  }
}

export async function closeBrowser() {
  if (context) { await context.close(); context = null; page = null; }
}

async function login(emit?: (e: AgentEvent) => void) {
  await page!.goto('https://x.com/i/flow/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  const deadline = Date.now() + 5 * 60 * 1000;
  while (Date.now() < deadline) {
    const ok = await page!.locator('[data-testid="SideNav_NewTweet_Button"]').isVisible({ timeout: 2000 }).catch(() => false);
    if (ok) break;
    await page!.waitForTimeout(2000);
  }
  const ok = await page!.locator('[data-testid="SideNav_NewTweet_Button"]').isVisible({ timeout: 3000 }).catch(() => false);
  if (!ok) throw new Error('Login timed out — please log in within 5 minutes.');
  cliOut('Logged in.\n', emit);
  emit?.({ type: 'log', text: 'Logged in to X.' });
}

// ── Scraping ─────────────────────────────────────────────────────────────────

interface Post { handle: string; name: string; text: string; stats: string; }

async function extractPosts(p: Page): Promise<Post[]> {
  await p.waitForTimeout(1500);
  return p.evaluate(() => {
    const articles = document.querySelectorAll('article[data-testid="tweet"]');
    return Array.from(articles).map(article => {
      const nameEl = article.querySelector('[data-testid="User-Name"]');
      const textEl = article.querySelector('[data-testid="tweetText"]');
      const statsEl = article.querySelector('[role="group"]');
      let handle = '';
      for (const link of Array.from(nameEl?.querySelectorAll('a') ?? [])) {
        const m = (link as HTMLAnchorElement).href.match(/x\.com\/([^/?#]+)/);
        if (m?.[1] && m[1] !== 'i') { handle = m[1]; break; }
      }
      return {
        handle: handle || 'unknown',
        name: nameEl?.querySelector('span')?.textContent?.trim() ?? '',
        text: textEl?.textContent?.trim() ?? '',
        stats: statsEl?.textContent?.trim() ?? '',
      };
    }).filter(p => p.text.length > 5);
  });
}

function formatPosts(posts: Post[], platform: 'x' | 'reddit' = 'x'): string {
  if (!posts.length) return 'No posts found.';
  return posts.slice(0, 15).map(p =>
    `[${platform}] @${p.handle} (${p.name})\n${p.text}\n[${p.stats}]`
  ).join('\n\n---\n\n');
}

// ── Tool implementations ──────────────────────────────────────────────────────

let emitRef: ((e: AgentEvent) => void) | undefined;

async function toolSearchX(query: string, tab: 'top' | 'latest' = 'top'): Promise<string> {
  const f = tab === 'latest' ? 'live' : 'top';
  await page!.goto(
    `https://x.com/search?q=${encodeURIComponent(query)}&f=${f}&src=typed_query`,
    { waitUntil: 'domcontentloaded', timeout: 30000 }
  );
  await page!.waitForSelector('article[data-testid="tweet"]', { timeout: 15000 }).catch(() => null);
  await page!.waitForTimeout(1000);
  await page!.evaluate(() => window.scrollBy(0, 1000));
  await page!.waitForTimeout(1000);
  const posts = await extractPosts(page!);
  cliOut(`  -> ${posts.length} posts [x: ${query}]\n`, emitRef);
  emitRef?.({ type: 'search', query, platform: 'x', count: posts.length });
  return formatPosts(posts, 'x');
}

async function toolSearchReddit(query: string): Promise<string> {
  await page!.goto(
    `https://www.reddit.com/search/?q=${encodeURIComponent(query)}&sort=hot`,
    { waitUntil: 'domcontentloaded', timeout: 30000 }
  );
  await page!.waitForTimeout(3000);

  const posts = await page!.evaluate(() => {
    // Handle both new Reddit (shreddit) and old Reddit
    const items = document.querySelectorAll('shreddit-post, [data-testid="post-container"]');
    return Array.from(items).slice(0, 12).map(item => {
      const titleEl = item.querySelector('[slot="title"], h3, [data-click-id="text"]');
      const subEl = item.querySelector('[slot="subredditName"], [data-click-id="subreddit"]');
      const snippetEl = item.querySelector('[slot="text-body"], .RichTextJSON-root');
      return {
        handle: (subEl?.textContent ?? '').trim() || 'reddit',
        name: (subEl?.textContent ?? '').trim(),
        text: [(titleEl?.textContent ?? '').trim(), (snippetEl?.textContent ?? '').slice(0, 200).trim()].filter(Boolean).join(' — '),
        stats: '',
      };
    }).filter(p => p.text.length > 5);
  });

  cliOut(`  -> ${posts.length} posts [reddit: ${query}]\n`, emitRef);
  emitRef?.({ type: 'search', query, platform: 'reddit', count: posts.length });
  return formatPosts(posts as Post[], 'reddit');
}

async function toolGetUserPosts(username: string): Promise<string> {
  await page!.goto(`https://x.com/${username}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page!.waitForSelector('article[data-testid="tweet"]', { timeout: 15000 }).catch(() => null);
  const posts = await extractPosts(page!);
  cliOut(`  -> ${posts.length} posts from @${username}\n`, emitRef);
  emitRef?.({ type: 'profile', username, count: posts.length });
  return formatPosts(posts, 'x');
}

async function runTool(name: string, input: Record<string, unknown>): Promise<string> {
  try {
    switch (name) {
      case 'search_x': return await toolSearchX(input.query as string, input.tab as 'top' | 'latest' | undefined);
      case 'search_reddit': return await toolSearchReddit(input.query as string);
      case 'get_user_posts': return await toolGetUserPosts(input.username as string);
      default: return `Unknown tool: ${name}`;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    cliOut(`  [error] ${msg}\n`, emitRef);
    return `Error: ${msg}`;
  }
}

// ── Tool definitions ──────────────────────────────────────────────────────────

const collectTools: Anthropic.Tool[] = [
  {
    name: 'search_x',
    description: 'Search X (Twitter) for posts. Returns up to 15 posts.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string' },
        tab: { type: 'string', enum: ['top', 'latest'] },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_reddit',
    description: 'Search Reddit for posts and discussions.',
    input_schema: {
      type: 'object' as const,
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
  },
  {
    name: 'get_user_posts',
    description: 'Get recent posts from a specific X user.',
    input_schema: {
      type: 'object' as const,
      properties: { username: { type: 'string', description: 'X handle without @' } },
      required: ['username'],
    },
  },
];

const saveResultTool: Anthropic.Tool = {
  name: 'save_result',
  description: 'Save the final research result as structured data.',
  input_schema: {
    type: 'object' as const,
    properties: {
      hypothesis: {
        type: 'object' as const,
        properties: {
          title: { type: 'string', description: 'One punchy sentence: the market opportunity found' },
          description: { type: 'string', description: '2-3 sentences explaining the opportunity and why now' },
          confidence: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Based on signal strength' },
        },
        required: ['title', 'description', 'confidence'],
      },
      icp: {
        type: 'object' as const,
        properties: {
          who: { type: 'string', description: 'One-sentence description of the ideal customer' },
          painPoints: { type: 'array', items: { type: 'string' }, description: '3-5 specific pain points' },
          channels: { type: 'array', items: { type: 'string' }, description: 'Where they hang out online' },
          budget: { type: 'string', description: 'Estimated willingness to pay' },
          vocabulary: { type: 'array', items: { type: 'string' }, description: 'Exact words they use to describe the problem' },
        },
        required: ['who', 'painPoints', 'channels', 'budget', 'vocabulary'],
      },
      gtm: {
        type: 'object' as const,
        properties: {
          positioning: { type: 'string', description: 'One-line positioning statement' },
          topChannel: { type: 'string', description: 'Single best channel to reach ICP' },
          launchMove: { type: 'string', description: 'The very first concrete action to take' },
          validation: { type: 'string', description: 'How to validate in <2 weeks before building' },
          timeline: { type: 'string', description: 'Rough timeline from idea to first paying customer' },
        },
        required: ['positioning', 'topChannel', 'launchMove', 'validation', 'timeline'],
      },
      evidence: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            handle: { type: 'string' },
            platform: { type: 'string', enum: ['x', 'reddit'] },
            text: { type: 'string', description: 'The exact quote (keep it short)' },
            why: { type: 'string', description: 'One sentence: why this post is signal' },
          },
          required: ['handle', 'platform', 'text', 'why'],
        },
        description: '5-10 posts that informed the hypothesis',
      },
      trends: {
        type: 'array' as const,
        items: { type: 'string' },
        description: '3-5 macro trends supporting this niche',
      },
    },
    required: ['hypothesis', 'icp', 'gtm', 'evidence', 'trends'],
  },
};

// ── Phase 1: Opus plans ───────────────────────────────────────────────────────

async function planResearch(prompt: string, platforms: string[], emit?: (e: AgentEvent) => void): Promise<string> {
  emit?.({ type: 'phase', phase: 1, label: 'Planning research...' });
  cliOut('\n── Phase 1: Planning (Opus)...\n', emit);

  const platformCtx = platforms.includes('reddit')
    ? 'You will search both X (Twitter) and Reddit.'
    : 'You will search X (Twitter).';

  const res = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 2048,
    thinking: { type: 'adaptive' } as any,
    system: `You are a market research planner. ${platformCtx}
Create a concrete search plan to find product-market opportunities for solopreneurs.

Output exactly:
## Research Focus
(signals that indicate unmet demand: complaints, workarounds, "I wish", "why isn't there")

## Search Queries — X
(12-15 specific queries, one per line)

## Search Queries — Reddit
(8-10 subreddits or queries like "site:reddit.com", one per line)

## Accounts to Check
(5-8 X handles: indie hackers, solopreneurs, startup founders in this space, no @)

## Signal Criteria
(what makes a post signal: specific numbers, pain intensity, buying intent, community size)`,
    messages: [{ role: 'user', content: `Research question: ${prompt}` }],
  });

  const plan = res.content.find(b => b.type === 'text')?.text ?? '';
  emit?.({ type: 'plan', text: plan });
  cliOut(plan + '\n', emit);
  writeTrace(`\n## Research Plan\n${plan}\n\n`);
  return plan;
}

// ── Phase 2: Sonnet collects ──────────────────────────────────────────────────

async function collectData(prompt: string, plan: string, platforms: string[], emit?: (e: AgentEvent) => void): Promise<string> {
  emit?.({ type: 'phase', phase: 2, label: 'Collecting data...' });
  cliOut('\n── Phase 2: Collecting (Sonnet)...\n', emit);

  const availableTools = platforms.includes('reddit')
    ? collectTools
    : collectTools.filter(t => t.name !== 'search_reddit');

  const messages: Anthropic.MessageParam[] = [{
    role: 'user',
    content: `Research question: "${prompt}"

Research plan:
${plan}

Execute this plan: run every search query, check every account, follow leads.
When done, say "Collection complete."`,
  }];

  const chunks: string[] = [];

  for (let step = 0; step < 30; step++) {
    cliOut(`\n── Collect ${step + 1}\n`, emit);

    const res = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: `You are a data collector executing a market research plan.
Call search_x, search_reddit, and get_user_posts to gather all posts from the plan.
Don't summarize — collect raw data. Follow interesting leads.
When you've covered the full plan, say "Collection complete."`,
      tools: availableTools,
      messages,
    });

    for (const block of res.content) {
      if (block.type === 'text') cliOut(block.text, emit);
    }
    messages.push({ role: 'assistant', content: res.content });
    cliOut('\n', emit);

    if (res.stop_reason === 'end_turn') break;
    if (res.stop_reason !== 'tool_use') break;

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of res.content) {
      if (block.type !== 'tool_use') continue;
      cliOut(`[${block.name}] ${JSON.stringify(block.input)}\n`, emit);
      writeTrace(`\n### ${block.name}\n${JSON.stringify(block.input, null, 2)}\n`);
      const result = await runTool(block.name, block.input as Record<string, unknown>);
      writeTrace(`Result:\n${result}\n\n`);
      chunks.push(`[${block.name} ${JSON.stringify(block.input)}]\n${result}`);
      toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
    }
    messages.push({ role: 'user', content: toolResults });
  }

  return chunks.join('\n\n');
}

// ── Phase 3: Opus synthesizes ─────────────────────────────────────────────────

async function synthesizeResult(prompt: string, plan: string, data: string, emit?: (e: AgentEvent) => void): Promise<ResearchResult> {
  emit?.({ type: 'phase', phase: 3, label: 'Synthesizing hypothesis...' });
  cliOut('\n── Phase 3: Synthesizing (Opus)...\n', emit);

  const messages: Anthropic.MessageParam[] = [{
    role: 'user',
    content: `Research question: "${prompt}"

Plan executed:
${plan}

Raw collected data:
${data}

Analyze this data and call save_result with a structured hypothesis, ICP, and GTM strategy.
Focus on finding a genuine unmet need, not general trends.`,
  }];

  let result: ResearchResult | null = null;

  for (let step = 0; step < 5; step++) {
    const stream = client.messages.stream({
      model: 'claude-opus-4-7',
      max_tokens: 8192,
      thinking: { type: 'adaptive', display: 'summarized' } as any,
      system: `You are a market research analyst. Find the single most compelling product opportunity in the data.
Be specific and actionable. Prioritize posts showing pain, workarounds, or buying intent.
You MUST call save_result with structured output.`,
      tools: [saveResultTool],
      messages,
    });

    let inThinking = false;
    for await (const event of stream) {
      if (event.type === 'content_block_start') {
        if (event.content_block.type === 'thinking') { inThinking = true; writeTrace('\n[THINKING]\n'); }
        else if (event.content_block.type === 'text' && inThinking) { inThinking = false; writeTrace('\n[/THINKING]\n'); }
      }
      if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') cliOut(event.delta.text, emit);
        else if (event.delta.type === 'thinking_delta') writeTrace((event.delta as any).thinking ?? '');
      }
      if (event.type === 'content_block_stop' && inThinking) { inThinking = false; writeTrace('\n[/THINKING]\n'); }
    }

    const response = await stream.finalMessage();
    messages.push({ role: 'assistant', content: response.content });
    cliOut('\n', emit);

    if (response.stop_reason === 'end_turn') break;

    if (response.stop_reason === 'tool_use') {
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;
        if (block.name === 'save_result') {
          result = { prompt, ...(block.input as Omit<ResearchResult, 'prompt'>) };
          // Always save markdown digest (CLI prints path; desktop silently saves)
          const digestFile = path.join(DIGESTS_DIR, `${TODAY}.md`);
          fs.writeFileSync(digestFile, formatResultAsMarkdown(result));
          if (!emit) cliOut(`\n-> Digest saved to ${digestFile}\n`, emit);
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: 'Result saved.' });
        }
      }
      messages.push({ role: 'user', content: toolResults });
    }
  }

  if (!result) throw new Error('Synthesis failed — no result produced.');
  return result;
}

function formatResultAsMarkdown(r: ResearchResult): string {
  return `# Research: ${r.prompt}
*Generated: ${new Date().toISOString()}*

## Hypothesis
**${r.hypothesis.title}**
${r.hypothesis.description}
Confidence: ${r.hypothesis.confidence}

## ICP
**Who:** ${r.icp.who}
**Pain Points:** ${r.icp.painPoints.join(', ')}
**Channels:** ${r.icp.channels.join(', ')}
**Budget:** ${r.icp.budget}
**Their words:** "${r.icp.vocabulary.join('", "')}"

## GTM
**Positioning:** ${r.gtm.positioning}
**Top Channel:** ${r.gtm.topChannel}
**Launch Move:** ${r.gtm.launchMove}
**Validation:** ${r.gtm.validation}
**Timeline:** ${r.gtm.timeline}

## Trends
${r.trends.map(t => `- ${t}`).join('\n')}

## Evidence
${r.evidence.map(e => `**@${e.handle}** [${e.platform}]\n> ${e.text}\n_${e.why}_`).join('\n\n')}
`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

export async function runAgent(
  prompt: string,
  platforms: ('x' | 'reddit')[] = ['x'],
  emit?: (e: AgentEvent) => void
): Promise<ResearchResult> {
  ensureDirs();

  if (!emit) {
    // CLI mode: set up trace file
    const ts = new Date().toISOString().slice(0, 19).replace('T', '-').replace(/:/g, '-');
    traceFile = path.join(TRACES_DIR, `${ts}.md`);
    fs.writeFileSync(traceFile, `# Trace — ${new Date().toISOString()}\nPrompt: ${prompt}\n\n`);
    process.stdout.write(`Trace:  ${traceFile}\nDigest: digests/${TODAY}.md\nPrompt: "${prompt}"\n\n`);
  }

  emitRef = emit;

  process.on('SIGINT', async () => {
    if (context) await context.close();
    process.exit(0);
  });

  try {
    await initBrowser(emit);
    const plan = await planResearch(prompt, platforms, emit);
    const data = await collectData(prompt, plan, platforms, emit);
    const result = await synthesizeResult(prompt, plan, data, emit);

    emit?.({ type: 'result', data: result });

    if (!emit) {
      process.stdout.write(`\nDone. Digest: digests/${TODAY}.md\n`);
    }

    return result;
  } finally {
    await closeBrowser();
    emitRef = undefined;
  }
}
