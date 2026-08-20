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

// --- Seamless view↔edit: a block must not move or resize when edited ---
// Switching a block between its rendered view and its edit textarea must not
// shift the text horizontally OR vertically, and must not change the block's
// height (which would nudge every block below it — the visible "shift").
async function measureViewVsEdit(name) {
  const view = page.getByRole("button", { name })
  const viewBox = await view.boundingBox()
  await view.click()
  await page.keyboard.press("Enter") // select -> edit
  const ta = page.locator("textarea").first()
  await ta.waitFor()
  const editBox = await ta.boundingBox()
  const inputValue = await ta.inputValue()
  return { viewBox, editBox, inputValue, ta }
}

// Screenshot the header block in both states so the pair is captured.
await page.getByRole("button", { name: "Project ideas" }).scrollIntoViewIfNeeded()
await page.screenshot({ path: `${OUT}/02a-viewing.png` })
{
  const { viewBox, editBox, inputValue } = await measureViewVsEdit("Project ideas")
  await page.screenshot({ path: `${OUT}/02b-editing.png` })
  const dx = Math.abs(viewBox.x - editBox.x)
  const dy = Math.abs(viewBox.y - editBox.y)
  const dh = Math.abs(viewBox.height - editBox.height)
  check("heading: no horizontal shift when editing", dx <= 1, `dx=${dx.toFixed(1)}px`)
  check("heading: no vertical shift when editing", dy <= 1, `dy=${dy.toFixed(1)}px`)
  check("heading: block height unchanged when editing", dh <= 1, `dh=${dh.toFixed(1)}px`)
  // The raw "# " marker is not shown in the textarea (edits the stripped body).
  check("textarea shows stripped body", inputValue === "Project ideas", inputValue)
  await page.keyboard.press("Escape")
}

// The same must hold for every block type — a marker'd block (bullet) and a
// plain paragraph, not just the heading.
for (const name of ["Some intro text", "A bullet point"]) {
  const { viewBox, editBox } = await measureViewVsEdit(name)
  const dx = Math.abs(viewBox.x - editBox.x)
  const dy = Math.abs(viewBox.y - editBox.y)
  const dh = Math.abs(viewBox.height - editBox.height)
  check(
    `"${name}": no shift/resize when editing`,
    dx <= 1 && dy <= 1 && dh <= 1,
    `dx=${dx.toFixed(1)} dy=${dy.toFixed(1)} dh=${dh.toFixed(1)}`,
  )
  await page.keyboard.press("Escape")
}

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

// --- Shift-Enter inserts a new block *above* the current one ---
await story("blockeditor--mixed")
{
  const bullet = page.getByRole("button", { name: "A bullet point" })
  await bullet.click()
  await page.keyboard.press("Enter") // edit
  await page.keyboard.press("Shift+Enter") // insert a bullet above, now editing it
  await page.keyboard.type("ABOVE")
  await page.waitForTimeout(150)
  const md = await serialized()
  const aboveAt = md.indexOf("ABOVE")
  const bulletAt = md.indexOf("A bullet point")
  check(
    "Shift-Enter inserts above",
    aboveAt !== -1 && bulletAt !== -1 && aboveAt < bulletAt,
    `above@${aboveAt} bullet@${bulletAt}`,
  )
}

// --- Undo works across blocks (the browser's per-textarea undo can't) ---
await story("blockeditor--empty")
{
  const mod = process.platform === "darwin" ? "Meta" : "Control"
  await page
    .getByTestId("block-body")
    .first()
    .evaluate((el) => el.focus())
  await page.keyboard.press("Enter") // edit the empty starter block
  await page.locator("textarea").first().waitFor()
  await page.keyboard.type("AAA")
  await page.keyboard.press("Enter") // new block below
  await page.keyboard.type("BBB")
  await page.waitForTimeout(120)
  let md = await serialized()
  check("two blocks present before undo", md.includes("AAA") && md.includes("BBB"))

  await page.keyboard.press(`${mod}+z`) // undo the "BBB" text run
  await page.waitForTimeout(120)
  md = await serialized()
  check("undo removes the second block's text", md.includes("AAA") && !md.includes("BBB"))

  await page.keyboard.press(`${mod}+z`) // undo the Enter (structural)
  await page.keyboard.press(`${mod}+z`) // undo the "AAA" text run
  await page.waitForTimeout(120)
  md = await serialized()
  check("undo walks back across blocks to empty", !md.includes("AAA") && !md.includes("BBB"))

  await page.keyboard.press(`${mod}+Shift+z`) // redo the "AAA" run
  await page.waitForTimeout(120)
  md = await serialized()
  check("redo restores an undone change", md.includes("AAA"))
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
