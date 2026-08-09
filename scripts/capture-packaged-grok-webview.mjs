import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { chromium } from "playwright";
import CDP from "chrome-remote-interface";

const port = Number(process.argv[2]);
const output = resolve(process.argv[3] ?? ".build/packaged-grok-webview.png");
if (!Number.isInteger(port) || port <= 0) {
  throw new Error("Usage: node scripts/capture-packaged-grok-webview.mjs <cdp-port> [output.png]");
}

await mkdir(dirname(output), { recursive: true });
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
try {
  const pages = browser.contexts().flatMap(context => context.pages());
  if (pages.length === 0) {
    throw new Error("No packaged workbench page was exposed through CDP.");
  }
  const page = pages[0];
  await page.waitForTimeout(8_000);
  await page.screenshot({ path: output });
  const geometry = await page.evaluate(() => {
    const describe = element => {
      if (!element) return undefined;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        tag: element.tagName,
        id: element.id,
        className: typeof element.className === "string" ? element.className : "",
        rect: { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, width: rect.width, height: rect.height },
        display: style.display,
        position: style.position,
        flex: style.flex,
        height: style.height,
        minHeight: style.minHeight,
        maxHeight: style.maxHeight,
        overflow: style.overflow,
      };
    };
    const embedded = document.querySelector("iframe, webview");
    const ancestors = [];
    let current = embedded;
    while (current && ancestors.length < 10) {
      ancestors.push(describe(current));
      current = current.parentElement;
    }
    return {
      viewport: { width: innerWidth, height: innerHeight },
      auxiliaryBar: describe(document.querySelector(".part.auxiliarybar")),
      paneView: describe(document.querySelector(".part.auxiliarybar .monaco-pane-view")),
      ancestors,
    };
  });
  const embeddedFrames = [];
  for (const frame of page.frames().filter(frame => frame !== page.mainFrame())) {
    embeddedFrames.push(await frame.evaluate(() => {
      const rect = selector => {
        const element = document.querySelector(selector);
        if (!element) return undefined;
        const value = element.getBoundingClientRect();
        return { top: value.top, bottom: value.bottom, left: value.left, right: value.right, width: value.width, height: value.height };
      };
      return {
        viewport: { width: innerWidth, height: innerHeight, outerWidth, outerHeight, devicePixelRatio },
        document: {
          clientHeight: document.documentElement.clientHeight,
          scrollHeight: document.documentElement.scrollHeight,
          bodyClientHeight: document.body.clientHeight,
          bodyScrollHeight: document.body.scrollHeight,
        },
        app: rect(".app"),
        messages: rect(".messages"),
        composer: rect(".composer-shell"),
      };
    }));
  }
  const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json());
  const grokTarget = targets.find(target => target.type === "iframe" && target.url.includes("local-grok-workbench.grok-build-workbench"));
  let grokWebview;
  if (grokTarget) {
    const client = await CDP({ host: "127.0.0.1", port, target: grokTarget.id });
    try {
      await client.Runtime.enable();
      const result = await client.Runtime.evaluate({
        expression: `JSON.stringify((() => {
          const rect = selector => {
            const element = document.querySelector(selector);
            if (!element) return undefined;
            const value = element.getBoundingClientRect();
            return { top: value.top, bottom: value.bottom, left: value.left, right: value.right, width: value.width, height: value.height };
          };
          return {
            viewport: { width: innerWidth, height: innerHeight, devicePixelRatio },
            document: { clientHeight: document.documentElement.clientHeight, scrollHeight: document.documentElement.scrollHeight, bodyClientHeight: document.body.clientHeight, bodyScrollHeight: document.body.scrollHeight },
            app: rect(".app"), messages: rect(".messages"), composer: rect(".composer-shell"),
            frameCount: document.querySelectorAll("iframe").length,
            bodySample: document.body.innerHTML.slice(0, 500),
            inner: (() => {
              const innerDocument = document.querySelector("iframe")?.contentDocument;
              if (!innerDocument) return undefined;
              const innerRect = selector => {
                const element = innerDocument.querySelector(selector);
                if (!element) return undefined;
                const value = element.getBoundingClientRect();
                return { top: value.top, bottom: value.bottom, left: value.left, right: value.right, width: value.width, height: value.height };
              };
              const innerStyle = selector => {
                const element = innerDocument.querySelector(selector);
                if (!element) return undefined;
                const style = innerDocument.defaultView.getComputedStyle(element);
                return { display: style.display, height: style.height, minHeight: style.minHeight, maxHeight: style.maxHeight, gridTemplateRows: style.gridTemplateRows, alignContent: style.alignContent, alignSelf: style.alignSelf, position: style.position, padding: style.padding };
              };
              const icons = [...innerDocument.querySelectorAll("svg.ui-icon")];
              return {
                app: innerRect(".app"), messages: innerRect(".messages"), composer: innerRect(".composer-shell"), card: innerRect(".composer-card"), hint: innerRect(".hint"),
                icons: {
                  count: icons.length,
                  unhydrated: innerDocument.querySelectorAll("[data-icon]:not([data-icon-name])").length,
                  invalid: icons.filter(icon => icon.getAttribute("viewBox") !== "0 0 24 24" || icon.getAttribute("fill") !== "none" || icon.getAttribute("stroke") !== "currentColor").length,
                  rawControlGlyphs: /[☰●■▣↔⌄◇↯◫◔🎙↑◆⚙✎⌕⚠]/u.test([...innerDocument.querySelectorAll("button, .tool-glyph, .permission-heading")].map(element => element.textContent ?? "").join(""))
                },
                styles: { app: innerStyle(".app"), messages: innerStyle(".messages"), composer: innerStyle(".composer-shell"), card: innerStyle(".composer-card") }, bodySample: innerDocument.body?.innerHTML.slice(0, 500)
              };
            })()
          };
        })())`,
        returnByValue: true,
      });
      grokWebview = JSON.parse(result.result.value);
      const inner = grokWebview.inner;
      if (!inner?.card || !inner?.composer || !inner?.app) {
        throw new Error("Packaged Grok webview did not expose composer geometry.");
      }
      const cardBottomGap = inner.app.bottom - inner.card.bottom;
      if (cardBottomGap < 0 || cardBottomGap > 48) {
        throw new Error(`Visible composer card is ${cardBottomGap.toFixed(1)}px above the packaged webview bottom.`);
      }
      if (inner.composer.height > 180) {
        throw new Error(`Composer shell incorrectly absorbs free space (${inner.composer.height.toFixed(1)}px).`);
      }
      if (inner.icons?.count < 10 || inner.icons.unhydrated !== 0 || inner.icons.invalid !== 0 || inner.icons.rawControlGlyphs) {
        throw new Error(`Packaged icon contract failed: ${JSON.stringify(inner.icons)}.`);
      }
    } finally {
      await client.close();
    }
  }
  console.log(JSON.stringify({
    output,
    title: await page.title(),
    pages: pages.length,
    frames: page.frames().map(frame => frame.url()),
    embeddedSurfaces: await page.locator("iframe, webview").count(),
    geometry,
    embeddedFrames,
    grokWebview,
  }, null, 2));
} finally {
  await browser.close();
}
