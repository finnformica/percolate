// Enhances social sharing for shared notes: for social-media crawlers it
// fetches the gist and returns HTML with Open Graph meta tags; for regular
// users it serves the SPA shell (via the ASSETS binding) so the app handles
// the route.

import type { Env } from "../types"

export function share(request: Request, env: Env): Promise<Response> {
  return request.method === "HEAD" ? handleHead(request, env) : handle(request, env)
}

async function handle(request: Request, env: Env): Promise<Response> {
  if (!isBot(request.headers.get("user-agent"))) {
    return serveIndexHtml(request, env)
  }

  const url = new URL(request.url)
  const gistId = url.pathname.split("/share/")[1]

  try {
    const response = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: { "User-Agent": "ruminate" },
    })

    if (!response.ok) {
      const html = `<!doctype html>
<html>
  <head>
    <title>Note not found</title>
  </head>
  <body>
    <h1>Note not found</h1>
  </body>
</html>`
      return new Response(html, { headers: { "Content-Type": "text/html" } })
    }

    const gist = (await response.json()) as {
      files?: Record<string, File>
      description?: string
      owner?: { login?: string }
    }

    if (!gist.files) {
      throw new Error("No files found in gist")
    }

    const noteMarkdown = getNoteMarkdown(gist as { files: Record<string, File> })
    const noteContent = removeFrontmatter(noteMarkdown)
    const noteTitle = getNoteTitle(noteContent)
    const frontmatter = parseFrontmatter(noteMarkdown)
    const ogImageUrl = getOgImageUrl(frontmatter)
    const pageTitle = getHtmlEscaped(noteTitle || gist.description || "Untitled")
    const pageDescription = "Shared note"
    const siteName = getHtmlEscaped(gist?.owner?.login || "Ruminate")
    const escapedNoteContent = getHtmlEscaped(noteContent)
    const escapedUrl = getHtmlEscaped(url.href)
    const escapedImageUrl = ogImageUrl ? getHtmlEscaped(ogImageUrl) : ""
    const html = `<!doctype html>
<html>
  <head>
    <title>${pageTitle}</title>
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <meta charset="utf-8" />
    <meta name="description" content="${pageDescription}" />
    <meta property="og:type" content="article" />
    <meta property="og:title" content="${pageTitle}" />
    <meta property="og:description" content="${pageDescription}" />
    <meta property="og:url" content="${escapedUrl}" />
    <meta property="og:site_name" content="${siteName}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${pageTitle}" />
    <meta name="twitter:description" content="${pageDescription}" />
    ${ogImageUrl ? `<meta property="og:image" content="${escapedImageUrl}" />` : ""}
    ${ogImageUrl ? `<meta name="twitter:image" content="${escapedImageUrl}" />` : ""}
  </head>
  <body>
    <pre>${escapedNoteContent}</pre>
  </body>
</html>`

    return new Response(html, {
      headers: { "Content-Type": "text/html" },
    })
  } catch (error) {
    console.error(error)
    return serveIndexHtml(request, env)
  }
}

async function handleHead(request: Request, env: Env): Promise<Response> {
  const response = await handle(request, env)
  return new Response(null, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  })
}

/** Serve the SPA shell for a regular (non-bot) request. */
function serveIndexHtml(request: Request, env: Env): Promise<Response> {
  // With `not_found_handling: "single-page-application"`, the assets binding
  // returns index.html for any path that isn't a real file.
  return env.ASSETS.fetch(request)
}

type File = {
  filename?: string
  type?: string
  content?: string
}

function getNoteMarkdown(gist: { files: Record<string, File> }): string {
  const readmeFile = Object.values(gist.files).find(
    (file) => file?.filename?.toLowerCase() === "readme.md",
  )
  const markdownFile =
    readmeFile || Object.values(gist.files).find((file) => file?.type === "text/markdown")

  return markdownFile?.content || ""
}

function removeFrontmatter(markdown: string) {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/
  const match = markdown.match(frontmatterRegex)

  if (match) {
    return match[2]
  }

  return markdown
}

function getNoteTitle(content: string) {
  const titleRegex = /^# (.*)$/m
  const match = content.trim().match(titleRegex)

  return match?.[1] || ""
}

/** Extracts simple `key: value` frontmatter properties. */
function parseFrontmatter(markdown: string): Record<string, string> {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---/
  const match = markdown.match(frontmatterRegex)

  if (!match) {
    return {}
  }

  const frontmatterYaml = match[1]
  const result: Record<string, string> = {}

  const lines = frontmatterYaml.split("\n")
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue

    const keyValueMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*):\s*(.+)$/)
    if (keyValueMatch) {
      const key = keyValueMatch[1]
      let value = keyValueMatch[2].trim()

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }

      result[key] = value
    }
  }

  return result
}

/** Extracts a URL from markdown image syntax or a bare URL. */
function extractImageUrl(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  const markdownImageMatch = trimmed.match(/^!\[.*?\]\((.*?)\)$/)
  if (markdownImageMatch) {
    return markdownImageMatch[1].trim()
  }

  if (/^https?:\/\//.test(trimmed)) {
    return trimmed
  }

  return null
}

function getOgImageUrl(frontmatter: Record<string, string>): string | null {
  if (frontmatter.image && typeof frontmatter.image === "string") {
    const imageUrl = extractImageUrl(frontmatter.image)
    if (imageUrl) {
      return imageUrl
    }
  }

  return null
}

function getHtmlEscaped(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

// Bot user-agent patterns, copied from the isbot package.
// https://github.com/omrilotan/isbot
const botPatterns = [
  " daum[ /]",
  " deusu/",
  " yadirectfetcher",
  "(?:^|[^g])news(?!sapphire)",
  "(?<! (?:channel/|google/))google(?!(app|/google| pixel))",
  "(?<! cu)bots?(?:\\b|_)",
  "(?<!(?:lib))http",
  "(?<![hg]m)score",
  "@[a-z][\\w-]+\\.",
  "\\(\\)",
  "\\.com\\b",
  "\\btime/",
  "\\|",
  "^<",
  "^[\\w \\.\\-\\(?:\\):%]+(?:/v?\\d+(?:\\.\\d+)?(?:\\.\\d{1,10})*?)?(?:,|$)",
  "^[^ ]{50,}$",
  "^\\d+\\b",
  "^\\w*search\\b",
  "^\\w+/[\\w\\(\\)]*$",
  "^active",
  "^ad muncher",
  "^amaya",
  "^avsdevicesdk/",
  "^biglotron",
  "^bot",
  "^bw/",
  "^clamav[ /]",
  "^client/",
  "^cobweb/",
  "^custom",
  "^ddg[_-]android",
  "^discourse",
  "^dispatch/\\d",
  "^downcast/",
  "^duckduckgo",
  "^email",
  "^facebook",
  "^getright/",
  "^gozilla/",
  "^hobbit",
  "^hotzonu",
  "^hwcdn/",
  "^igetter/",
  "^jeode/",
  "^jetty/",
  "^jigsaw",
  "^microsoft bits",
  "^movabletype",
  "^mozilla/5\\.0\\s[a-z\\.-]+$",
  "^mozilla/\\d\\.\\d \\(compatible;?\\)$",
  "^mozilla/\\d\\.\\d \\w*$",
  "^navermailapp",
  "^netsurf",
  "^offline",
  "^openai/",
  "^owler",
  "^php",
  "^postman",
  "^python",
  "^rank",
  "^read",
  "^reed",
  "^rest",
  "^rss",
  "^snapchat",
  "^space bison",
  "^svn",
  "^swcd ",
  "^taringa",
  "^thumbor/",
  "^track",
  "^w3c",
  "^webbandit/",
  "^webcopier",
  "^wget",
  "^whatsapp",
  "^wordpress",
  "^xenu link sleuth",
  "^yahoo",
  "^yandex",
  "^zdm/\\d",
  "^zoom marketplace/",
  "^{{.*}}$",
  "adscanner/",
  "analyzer",
  "archive",
  "ask jeeves/teoma",
  "audit",
  "bit\\.ly/",
  "bluecoat drtr",
  "browsex",
  "burpcollaborator",
  "capture",
  "catch",
  "check\\b",
  "checker",
  "chrome-lighthouse",
  "chromeframe",
  "classifier",
  "cloudflare",
  "convertify",
  "cookiehubscan",
  "crawl",
  "cypress/",
  "dareboost",
  "datanyze",
  "dejaclick",
  "detect",
  "dmbrowser",
  "download",
  "evc-batch/",
  "exaleadcloudview",
  "feed",
  "firephp",
  "functionize",
  "gomezagent",
  "headless",
  "httrack",
  "hubspot marketing grader",
  "hydra",
  "ibisbrowser",
  "images",
  "infrawatch",
  "insight",
  "inspect",
  "iplabel",
  "ips-agent",
  "java(?!;)",
  "jsjcw_scanner",
  "library",
  "linkcheck",
  "mail\\.ru/",
  "manager",
  "measure",
  "neustar wpm",
  "node",
  "nutch",
  "offbyone",
  "optimize",
  "pageburst",
  "pagespeed",
  "parser",
  "perl",
  "phantomjs",
  "pingdom",
  "powermarks",
  "preview",
  "proxy",
  "ptst[ /]\\d",
  "reputation",
  "resolver",
  "retriever",
  "rexx;",
  "rigor",
  "rss\\b",
  "scanner\\.",
  "scrape",
  "server",
  "sogou",
  "sparkler/",
  "speedcurve",
  "spider",
  "splash",
  "statuscake",
  "supercleaner",
  "synapse",
  "synthetic",
  "tools",
  "torrent",
  "trace",
  "transcoder",
  "url",
  "validator",
  "virtuoso",
  "wappalyzer",
  "webglance",
  "webkit2png",
  "whatcms/",
  "zgrab",
]

/** Detects whether a user-agent belongs to a bot (based on the isbot package). */
function isBot(userAgent: string | null): boolean {
  if (!userAgent) return false
  const pattern = new RegExp(botPatterns.join("|"), "i")
  return pattern.test(userAgent)
}
