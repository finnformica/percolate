import { chromium } from "playwright"

const BASE = "http://127.0.0.1:6010/iframe.html"
const OUT =
  process.argv[2] ||
  "/tmp/claude-0/-home-user-percolate/f5cc8d33-cf81-50b9-b7c5-503497dde442/scratchpad"
const results = []
const check = (name, ok, extra = "") => {
  results.push({ name, ok })
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`)
}

const browser = await chromium.launch({
  headless: true,
  // The environment ships a pre-installed Chromium; point at it rather than
  // downloading one (set PW_CHROMIUM to override).
  executablePath: process.env.PW_CHROMIUM || undefined,
})
// Block Storybook's PWA service worker — it caches across navigations and
// leaves later stories half-rendered in a reused page.
const context = await browser.newContext({
  viewport: { width: 800, height: 600 },
  serviceWorkers: "block",
})
const page = await context.newPage()

async function story(id) {
  await page.goto(`${BASE}?id=${id}&viewMode=story`, { waitUntil: "domcontentloaded" })
  await page.getByTestId("block-body").first().waitFor({ timeout: 10000 })
}
const serialized = () => page.locator('[data-testid="serialized"]').textContent()

// --- Mixed: visual + block types render ---
await story("blockeditor--mixed")
await page.screenshot({ path: `${OUT}/01-mixed.png` })
check("heading renders", await page.getByRole("button", { name: "Project ideas" }).isVisible())
check("checkbox renders", (await page.locator("input[type=checkbox]").count()) >= 2)
check("bullet renders", await page.getByRole("button", { name: "A bullet point" }).isVisible())

// --- Seamless view↔edit: text does not shift horizontally ---
const heading = page.getByRole("button", { name: "Project ideas" })
const viewBox = await heading.boundingBox()
await heading.click()
await page.keyboard.press("Enter") // select -> edit
const ta = page.locator("textarea").first()
await ta.waitFor()
const editBox = await ta.boundingBox()
await page.screenshot({ path: `${OUT}/02-editing.png` })
const dx = Math.abs(viewBox.x - editBox.x)
check("no horizontal shift entering edit", dx <= 2, `dx=${dx.toFixed(1)}px`)
// The raw "# " marker is not shown in the textarea (edits the stripped body).
check(
  "textarea shows stripped body",
  (await ta.inputValue()) === "Project ideas",
  await ta.inputValue(),
)

// --- Markdown shortcuts on an empty note ---
await story("blockeditor--empty")
const bodyCount = await page.getByTestId("block-body").count()
console.log("empty block-body count:", bodyCount)
await page
  .getByTestId("block-body")
  .first()
  .evaluate((el) => el.focus())
await page.keyboard.press("Enter") // edit the empty starter block
await page.locator("textarea").first().waitFor()
await page.keyboard.type("# Heading one")
await page.keyboard.press("Enter")
await page.keyboard.type("- Bullet one")
await page.keyboard.press("Enter")
await page.keyboard.type("[] A todo")
await page.waitForTimeout(200)
const md = await serialized()
check("heading serialized once", md.includes("# Heading one"))
check("bullet NOT doubled", md.includes("- Bullet one") && !md.includes("- - Bullet one"))
check("todo serialized", md.includes("[] A todo") || md.includes("[ ] A todo"))
await page.screenshot({ path: `${OUT}/03-shortcuts.png` })

// --- Typing a marker switches an existing block's type ---
await story("blockeditor--mixed")
{
  const todo = page.getByRole("button", { name: "A todo" })
  await todo.click()
  await page.keyboard.press("Enter") // edit
  await page.keyboard.press("Home")
  await page.keyboard.type("- ")
  await page.waitForTimeout(150)
  let md = await serialized()
  check(
    "checkbox → bullet on '- '",
    md.includes("- A todo") && !md.includes("[ ] A todo"),
    md.includes("- A todo") ? "" : "no bullet",
  )
  await page.keyboard.press("Home")
  await page.keyboard.type("# ")
  await page.waitForTimeout(150)
  md = await serialized()
  check("bullet → heading on '# '", md.includes("# A todo") && !md.includes("- A todo"))
  await page.screenshot({ path: `${OUT}/05-type-switch.png` })
}

// --- Keyboard navigation highlights, doesn't edit ---
await story("blockeditor--mixed")
await page.getByRole("button", { name: "Project ideas" }).click() // select first
await page.keyboard.press("ArrowDown")
await page.keyboard.press("ArrowDown")
await page.waitForTimeout(100)
const editorsOpen = await page.locator("textarea").count()
check("arrow navigation does not open an editor", editorsOpen === 0, `textareas=${editorsOpen}`)
await page.screenshot({ path: `${OUT}/04-navigation.png` })

await browser.close()
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
