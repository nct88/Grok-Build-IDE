import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { chromium } from "playwright";

const visualRoot = dirname(fileURLToPath(import.meta.url));
const harnessUrl = pathToFileURL(join(visualRoot, "harness.html"));
const extensionPackage = JSON.parse(await readFile(join(visualRoot, "..", "..", "package.json"), "utf8"));
const productionHtmlSource = await readFile(join(visualRoot, "..", "..", "src", "vscode", "chatViewProvider.ts"), "utf8");
const harnessHtmlSource = await readFile(join(visualRoot, "harness.html"), "utf8");
const evidenceDir = join(visualRoot, "evidence", extensionPackage.version);
const scenarios = [
  { name: "dark-markdown-240x720", theme: "dark", fixture: "markdown", width: 240, height: 720, scale: 1 },
  { name: "light-markdown-390x720", theme: "light", fixture: "markdown", width: 390, height: 720, scale: 1 },
  { name: "dark-long-600x900", theme: "dark", fixture: "long", width: 600, height: 900, scale: 1 },
  { name: "dark-long-600x900-150pct", theme: "dark", fixture: "long", width: 600, height: 900, scale: 1.5 },
  { name: "dark-usage-error-390x720", theme: "dark", fixture: "usage-error", width: 390, height: 720, scale: 1 },
  { name: "light-history-many-390x720", theme: "light", fixture: "history-many", width: 390, height: 720, scale: 1 },
  { name: "dark-history-empty-240x720", theme: "dark", fixture: "history-empty", width: 240, height: 720, scale: 1 },
  { name: "dark-history-error-390x720", theme: "dark", fixture: "history-error", width: 390, height: 720, scale: 1 },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const fragment of [
  'id="historyPanel"',
  'id="historySearch"',
  'id="historyList"',
  'data-session-tab="usage"',
  'data-session-tab="details"',
  'data-session-panel="usage"',
  'data-session-panel="details"',
]) {
  assert(productionHtmlSource.includes(fragment), `production webview is missing ${fragment}`);
  assert(harnessHtmlSource.includes(fragment), `visual harness drifted from production: missing ${fragment}`);
}
for (const obsolete of ['data-session-tab="context"', 'data-session-tab="account"']) {
  assert(!productionHtmlSource.includes(obsolete), `production webview still includes obsolete ${obsolete}`);
  assert(!harnessHtmlSource.includes(obsolete), `visual harness still includes obsolete ${obsolete}`);
}

await mkdir(evidenceDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const scenario of scenarios) {
    const page = await browser.newPage({
      viewport: { width: scenario.width, height: scenario.height },
      deviceScaleFactor: scenario.scale,
    });
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    const url = new URL(harnessUrl);
    url.searchParams.set("theme", scenario.theme);
    url.searchParams.set("fixture", scenario.fixture);
    await page.goto(url.href);
    await page.waitForSelector(".message.assistant .md-body");

    const geometry = await page.evaluate(() => {
      const app = document.querySelector(".app").getBoundingClientRect();
      const composer = document.querySelector(".composer-shell").getBoundingClientRect();
      const composerCard = document.querySelector(".composer-card").getBoundingClientRect();
      const messages = document.querySelector(".messages");
      return {
        appTop: app.top,
        appBottom: app.bottom,
        composerBottom: composer.bottom,
        composerCardBottom: composerCard.bottom,
        composerCardBottomGap: innerHeight - composerCard.bottom,
        composerHeight: composer.height,
        viewportHeight: innerHeight,
        horizontalOverflow:
          document.documentElement.scrollWidth > innerWidth || messages.scrollWidth > messages.clientWidth,
        headings: document.querySelectorAll(".md-body .md-h").length,
        strong: document.querySelectorAll(".md-body strong").length,
        code: document.querySelectorAll(".md-body .md-code").length,
        tables: document.querySelectorAll(".md-body table").length,
        rawMarkers: /(^|\s)(#{1,6}\s|\*\*[^*]+\*\*)/.test(
          document.querySelector(".message.assistant")?.innerText ?? "",
        ),
        iconCount: document.querySelectorAll("svg.ui-icon").length,
        unhydratedIcons: document.querySelectorAll("[data-icon]:not([data-icon-name])").length,
        invalidVectorIcons: [...document.querySelectorAll("svg.ui-icon")].filter(
          (icon) =>
            icon.getAttribute("viewBox") !== "0 0 24 24" ||
            icon.getAttribute("fill") !== "none" ||
            icon.getAttribute("stroke") !== "currentColor",
        ).length,
        rawControlGlyphs: /[☰●■▣↔⌄◇↯◫◔🎙↑◆⚙✎⌕⚠]/.test(
          [...document.querySelectorAll("button, .tool-glyph, .permission-heading")]
            .map((element) => element.textContent ?? "")
            .join(""),
        ),
        avatars: document.querySelectorAll(".message-avatar").length,
        thinking: [...document.querySelectorAll(".thought-summary")].some((el) =>
          (el.textContent || "").includes("Thinking"),
        ),
        reasoningLegacy: [...document.querySelectorAll(".thought")].some((el) =>
          (el.textContent || "").includes("Reasoning activity"),
        ),
        toolStatusClass: document.querySelectorAll(".tool.tool-status-completed").length,
        codeCards: document.querySelectorAll(".code-card").length,
        brand: (() => {
          const image = document.querySelector(".brand-lockup .brand-mark");
          return {
            tag: image?.tagName,
            loaded: image?.complete && image?.naturalWidth === 128 && image?.naturalHeight === 128,
            source: image?.getAttribute("src") || "",
          };
        })(),
        usageSession: Boolean(document.querySelector("#usagePopover .usage-section strong")),
        usageAccount: Boolean(document.querySelector("#accountUsageTitle") && document.querySelector("#accountUsageBar")),
      };
    });
    assert(pageErrors.length === 0, `${scenario.name}: page error: ${pageErrors.join("; ")}`);
    assert(Math.abs(geometry.appTop) <= 1, `${scenario.name}: app does not start at viewport top`);
    assert(
      Math.abs(geometry.appBottom - geometry.viewportHeight) <= 1,
      `${scenario.name}: app does not fill viewport`,
    );
    assert(
      Math.abs(geometry.composerBottom - geometry.viewportHeight) <= 1,
      `${scenario.name}: composer is not docked to bottom`,
    );
    assert(
      geometry.composerCardBottomGap >= 0 && geometry.composerCardBottomGap <= 48,
      `${scenario.name}: visible composer card is ${geometry.composerCardBottomGap.toFixed(1)}px above viewport bottom`,
    );
    assert(
      geometry.composerHeight <= 200,
      `${scenario.name}: composer shell incorrectly absorbs free space (${geometry.composerHeight.toFixed(1)}px)`,
    );
    assert(!geometry.horizontalOverflow, `${scenario.name}: horizontal overflow detected`);
    if (scenario.fixture === "markdown") {
      assert(
        geometry.headings > 0 && geometry.strong > 0 && geometry.code > 0 && geometry.tables > 0,
        `${scenario.name}: Markdown blocks missing`,
      );
    }
    assert(!geometry.rawMarkers, `${scenario.name}: raw Markdown markers remain visible`);
    assert(geometry.iconCount >= 12, `${scenario.name}: expected vector icon system, found ${geometry.iconCount} icons`);
    assert(geometry.unhydratedIcons === 0, `${scenario.name}: ${geometry.unhydratedIcons} icon placeholders were not hydrated`);
    assert(
      geometry.invalidVectorIcons === 0,
      `${scenario.name}: ${geometry.invalidVectorIcons} icons violate the Lucide geometry contract`,
    );
    assert(!geometry.rawControlGlyphs, `${scenario.name}: raw Unicode control glyphs remain visible`);
    assert(
      geometry.brand.tag === "IMG" && geometry.brand.loaded && geometry.brand.source.endsWith("grok-fluffy.png"),
      `${scenario.name}: white-Fluffy/black-Grok brand image did not load at 128px`,
    );
    assert(geometry.avatars >= 2, `${scenario.name}: expected message avatars, found ${geometry.avatars}`);
    assert(geometry.thinking, `${scenario.name}: Thinking summary missing`);
    assert(!geometry.reasoningLegacy, `${scenario.name}: legacy Reasoning activity label still present`);
    assert(geometry.toolStatusClass >= 1, `${scenario.name}: tool status color class missing`);
    if (scenario.fixture === "markdown") {
      assert(geometry.codeCards >= 1, `${scenario.name}: structured code cards missing`);
    }
    assert(geometry.usageSession && geometry.usageAccount, `${scenario.name}: usage session/account sections missing`);

    await page.locator("#usageButton").click();
    await page.locator("#sessionContextRows .usage-row").first().waitFor();
    if (scenario.fixture === "usage-error") {
      await page.locator("#accountUsageError").filter({ hasText: "Session expired" }).waitFor();
    } else {
      await page.locator("#accountUsagePercent").filter({ hasText: "37.5%" }).waitFor();
    }
    const sessionGeometry = await page.locator("#usagePopover").evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        horizontalOverflow: element.scrollWidth > element.clientWidth,
        contextRows: element.querySelectorAll("#sessionContextRows .usage-row").length,
        accountRows: element.querySelectorAll("#accountUsageRows .usage-row").length,
        sessionRefreshPosted: window.__postedMessages.some((message) => message.type === "refreshSessionInfo"),
        accountRefreshPosted: window.__postedMessages.some((message) => message.type === "refreshUsage"),
      };
    });
    assert(sessionGeometry.left >= -2, `${scenario.name}: session info clips left (${sessionGeometry.left.toFixed(1)}..${sessionGeometry.right.toFixed(1)})`);
    assert(sessionGeometry.right <= scenario.width + 1, `${scenario.name}: session info clips right (${sessionGeometry.left.toFixed(1)}..${sessionGeometry.right.toFixed(1)})`);
    assert(sessionGeometry.top >= -1 && sessionGeometry.bottom <= scenario.height + 1, `${scenario.name}: session info clips vertically`);
    assert(sessionGeometry.width >= Math.min(200, scenario.width - 16), `${scenario.name}: session info is unexpectedly narrow`);
    assert(!sessionGeometry.horizontalOverflow, `${scenario.name}: session info has horizontal overflow`);
    assert(sessionGeometry.contextRows >= 6, `${scenario.name}: cumulative session counters are incomplete`);
    assert(sessionGeometry.sessionRefreshPosted, `${scenario.name}: opening Usage did not request session data`);
    assert(sessionGeometry.accountRefreshPosted, `${scenario.name}: opening Usage did not request account data`);
    await page.screenshot({
      path: join(evidenceDir, `${scenario.name}-usage-open.png`),
      fullPage: false,
    });

    await page.locator('[data-session-tab="details"]').click();
    await page.locator("#sessionInfoRows .session-info-row").first().waitFor();
    assert(
      await page.locator("#sessionInfoRows .session-info-row").count() >= 12,
      `${scenario.name}: rich session metadata rows are incomplete`,
    );
    await page.locator("#sessionInfoRows .session-info-row").first().click();
    assert(await page.evaluate(() => Boolean(document.body.dataset.copiedText)), `${scenario.name}: row copy did not post clipboard text`);
    await page.locator("#copyAllSessionInfoButton").click();
    assert(
      await page.evaluate(() => document.body.dataset.copiedText?.includes("Session ID:")),
      `${scenario.name}: Copy all omitted session fields`,
    );
    await page.screenshot({
      path: join(evidenceDir, `${scenario.name}-details-open.png`),
      fullPage: false,
    });

    await page.locator('[data-session-tab="usage"]').click();
    const contextFillWidth = await page.locator("#usageContextBar").evaluate((element) => element.getBoundingClientRect().width);
    assert(contextFillWidth > 0, `${scenario.name}: session context progress is empty`);
    await page.waitForTimeout(220);
    const usageGeometry = await page.locator("#usagePopover").evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const contextFill = element.querySelector("#usageContextBar")?.getBoundingClientRect();
      const accountFill = element.querySelector("#accountUsageBar")?.getBoundingClientRect();
      const accountWrap = element.querySelector("#accountUsageBarWrap")?.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        horizontalOverflow: element.scrollWidth > element.clientWidth,
        accountFillWidth: accountFill?.width || 0,
        accountWrapWidth: accountWrap?.width || 0,
        accountFillStyle: element.querySelector("#accountUsageBar")?.getAttribute("style") || "",
        accountRows: element.querySelectorAll("#accountUsageRows .usage-row").length,
        refreshPosted: window.__postedMessages.some((message) => message.type === "refreshUsage"),
        manageLabel: element.querySelector("#manageUsageButton")?.textContent?.trim() || "",
        errorText: element.querySelector("#accountUsageError")?.textContent?.trim() || "",
      };
    });
    assert(usageGeometry.left >= -2, `${scenario.name}: usage popover clips left (${usageGeometry.left.toFixed(1)}..${usageGeometry.right.toFixed(1)})`);
    assert(usageGeometry.right <= scenario.width + 1, `${scenario.name}: usage popover clips right (${usageGeometry.left.toFixed(1)}..${usageGeometry.right.toFixed(1)})`);
    assert(usageGeometry.top >= -1, `${scenario.name}: usage popover clips top`);
    assert(usageGeometry.bottom <= scenario.height + 1, `${scenario.name}: usage popover clips bottom`);
    assert(usageGeometry.width >= Math.min(200, scenario.width - 16), `${scenario.name}: usage popover is unexpectedly narrow`);
    assert(!usageGeometry.horizontalOverflow, `${scenario.name}: usage popover has horizontal overflow`);
    if (scenario.fixture === "usage-error") {
      assert(usageGeometry.accountFillWidth === 0, `${scenario.name}: error state shows stale account progress`);
      assert(usageGeometry.accountRows === 0, `${scenario.name}: error state shows stale account rows`);
      assert(usageGeometry.errorText.includes("Session expired"), `${scenario.name}: actionable usage error missing`);
    } else {
      assert(usageGeometry.accountFillWidth > 0, `${scenario.name}: account plan progress is empty (fill=${usageGeometry.accountFillWidth}, wrap=${usageGeometry.accountWrapWidth}, style=${usageGeometry.accountFillStyle})`);
      assert(usageGeometry.accountRows >= 4, `${scenario.name}: account usage rows are incomplete`);
    }
    assert(usageGeometry.refreshPosted, `${scenario.name}: opening Usage did not request account data`);
    assert(usageGeometry.manageLabel.includes("Manage usage"), `${scenario.name}: manage usage action missing`);
    const usageScroll = await page.locator('.session-info-panel[data-session-panel="usage"]').evaluate((element) => {
      const scrollable = element.scrollHeight > element.clientHeight;
      const before = element.scrollTop;
      if (scrollable) element.scrollTop = element.scrollHeight;
      const action = element.querySelector("#manageUsageButton")?.getBoundingClientRect();
      const bounds = element.getBoundingClientRect();
      return {
        scrollable,
        moved: element.scrollTop > before,
        actionReachable: Boolean(action && action.bottom <= bounds.bottom + 1 && action.top >= bounds.top - 1),
      };
    });
    assert(!usageScroll.scrollable || usageScroll.moved, `${scenario.name}: usage content cannot scroll`);
    assert(usageScroll.actionReachable, `${scenario.name}: account actions are not reachable`);
    await page.locator("#manageUsageButton").click();
    const manageRequest = await page.evaluate(() =>
      window.__postedMessages.findLast((message) => message.type === "openExternal"),
    );
    assert(
      manageRequest?.value?.startsWith("https://grok.com"),
      `${scenario.name}: Manage usage did not post a safe Grok URL`,
    );
    await page.screenshot({
      path: join(evidenceDir, `${scenario.name}-usage-account.png`),
      fullPage: false,
    });
    await page.locator("#usageButton").click();

    await page.locator("#sessionsButton").click();
    await page.locator("#historyPanel").waitFor({ state: "visible" });
    await page.waitForTimeout(20);
    const historyGeometry = await page.locator("#historyPanel").evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const list = element.querySelector("#historyList");
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        horizontalOverflow: element.scrollWidth > element.clientWidth,
        rows: element.querySelectorAll(".history-row").length,
        groups: element.querySelectorAll(".history-group-title").length,
        listScrollable: list.scrollHeight > list.clientHeight,
      };
    });
    assert(historyGeometry.left >= -1 && historyGeometry.right <= scenario.width + 1, `${scenario.name}: history clips horizontally`);
    assert(historyGeometry.top >= -1 && historyGeometry.bottom <= scenario.height + 1, `${scenario.name}: history clips vertically`);
    assert(!historyGeometry.horizontalOverflow, `${scenario.name}: history has horizontal overflow`);
    if (scenario.fixture === "history-empty" || scenario.fixture === "history-error") {
      assert(historyGeometry.rows === 0, `${scenario.name}: empty history rendered rows`);
      assert(await page.locator(".history-empty").isVisible(), `${scenario.name}: empty history guidance missing`);
      if (scenario.fixture === "history-error") {
        assert(
          await page.locator(".history-empty").getByText("Could not load history").isVisible(),
          `${scenario.name}: history error guidance missing`,
        );
      }
    } else {
      assert(historyGeometry.rows >= 7, `${scenario.name}: history rows are incomplete`);
      assert(historyGeometry.groups >= 2, `${scenario.name}: history date grouping missing`);
      assert(
        await page.locator('.history-row.active [aria-label^="Active session cannot be deleted"]').isDisabled(),
        `${scenario.name}: active session delete action must be disabled`,
      );
      if (scenario.fixture === "history-many") {
        assert(historyGeometry.listScrollable, `${scenario.name}: many-item history does not scroll locally`);
      }
      await page.locator("#historySearch").fill("clipboard");
      const filteredHistory = await page.locator(".history-row .history-row-open strong").allTextContents();
      assert(
        filteredHistory.length >= 1 && filteredHistory.every((title) => title.toLowerCase().includes("clipboard")),
        `${scenario.name}: history search did not filter titles`,
      );
      await page.locator("#historySearch").fill("");
      const second = page.locator(".history-row").nth(1);
      await second.locator('[aria-label^="Rename"]').click();
      await second.locator('[aria-label^="Export Markdown"]').click();
      await second.locator('[aria-label^="Delete"]').click();
      assert(await page.evaluate(() => Boolean(document.body.dataset.renameSession)), `${scenario.name}: history rename action missing`);
      assert(await page.evaluate(() => Boolean(document.body.dataset.exportSession)), `${scenario.name}: history export action missing`);
      assert(await page.evaluate(() => Boolean(document.body.dataset.deleteSession)), `${scenario.name}: history delete action missing`);
    }
    await page.screenshot({
      path: join(evidenceDir, `${scenario.name}-history-open.png`),
      fullPage: false,
    });
    await page.locator("#historyClose").click();

    // Completed fixtures keep controls enabled; long fixtures intentionally
    // remain in a pending permission state and verify that surface instead.
    if (scenario.fixture === "markdown") {
      await page.locator("#permissionButton").click();
      const menu = page.locator("#permissionMenu");
      await menu.waitFor({ state: "visible" });
      if (scenario.width > 260) {
        await page.locator("#modelButton").click();
        await page.locator("#modelMenu").waitFor({ state: "visible" });
      } else {
        assert(!(await page.locator("#modelButton").isVisible()), `${scenario.name}: model control should collapse before overlapping Usage`);
      }
      if (scenario.width > 300) {
        await page.locator("#effortButton").click();
        await page.locator("#effortMenu").waitFor({ state: "visible" });
      } else {
        assert(!(await page.locator("#effortButton").isVisible()), `${scenario.name}: effort control should collapse before overlapping Usage`);
      }
      if (await menu.isVisible()) {
        await page.locator("#permissionButton").click();
      }
      await page.locator("#permissionButton").click();
      await menu.waitFor({ state: "visible" });
      const menuGeometry = await menu.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const selectedStyle = getComputedStyle(element.querySelector('[aria-selected="true"]'));
      const channels = (color) => color.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [0, 0, 0];
      const luminance = (color) => {
        const normalized = channels(color)
          .map((channel) => channel / 255)
          .map((channel) =>
            channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
          );
        return 0.2126 * normalized[0] + 0.7152 * normalized[1] + 0.0722 * normalized[2];
      };
      const foreground = luminance(selectedStyle.color);
      const background = luminance(selectedStyle.backgroundColor);
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        color: style.color,
        background: style.backgroundColor,
        selectedContrast:
          (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05),
      };
      });
      assert(menuGeometry.left >= -1, `${scenario.name}: permission menu clips left`);
      assert(menuGeometry.right <= scenario.width + 1, `${scenario.name}: permission menu clips right`);
      assert(menuGeometry.selectedContrast >= 3, `${scenario.name}: permission selected contrast too low`);
    }

    await page.screenshot({
      path: join(evidenceDir, `${scenario.name}.png`),
      fullPage: false,
    });
    if (scenario.fixture === "markdown") {
      await page.locator("#permissionButton").click();
      await page.screenshot({
        path: join(evidenceDir, `${scenario.name}-permission-open.png`),
        fullPage: false,
      });
    }
    await page.close();
    console.log(`ok ${scenario.name}`);
  }
} finally {
  await browser.close();
}

console.log(`Visual evidence written to ${evidenceDir}`);
