import { request } from "@octokit/request"
import { useAtomValue } from "jotai"
import React from "react"
import { useNetworkState } from "react-use"
import { githubRepoAtom, githubUserAtom } from "../global-state"
import { getDayRangeUtc } from "../utils/date"
import { DayActivity, GhFile, filesToChangedNotes } from "./history-parse"

/**
 * Fetch the net note activity for one calendar day from GitHub — "what was
 * written that day" across all notes, reconstructed on demand from history.
 *
 * The day is interpreted in the current timezone (`getDayRangeUtc`); commits
 * are absolute instants, so this bucketing matches how the calendar labels the
 * day. Uses boundary commits (last-before-start .. last-at-end) so the net diff
 * is correct no matter how many commits fall inside the day.
 */
async function fetchDayActivity(params: {
  owner: string
  repo: string
  token: string
  dateString: string
}): Promise<DayActivity> {
  const { owner, repo, token, dateString } = params
  const { since, until } = getDayRangeUtc(dateString)
  const gh = request.defaults({ headers: { authorization: `token ${token}` } })

  // head = last commit at/before the day's end; base = last commit before the
  // day's start. Independent of how many commits fall inside the day.
  const [headRes, baseRes] = await Promise.all([
    gh("GET /repos/{owner}/{repo}/commits", { owner, repo, until, per_page: 1 }),
    gh("GET /repos/{owner}/{repo}/commits", { owner, repo, until: since, per_page: 1 }),
  ])
  const head = headRes.data[0]
  const base = baseRes.data[0]

  // Nothing committed by the end of the day, or no commits during the day.
  if (!head || (base && head.sha === base.sha)) {
    return { notes: [] }
  }

  // Net change across the day: base..head. On the repo's genesis day (no
  // earlier commit) fall back to the head commit's own diff — a documented
  // limitation for that single day only.
  let files: GhFile[]
  if (base) {
    const compareRes = await gh("GET /repos/{owner}/{repo}/compare/{basehead}", {
      owner,
      repo,
      basehead: `${base.sha}...${head.sha}`,
    })
    files = (compareRes.data.files ?? []) as GhFile[]
  } else {
    const detailRes = await gh("GET /repos/{owner}/{repo}/commits/{ref}", {
      owner,
      repo,
      ref: head.sha,
    })
    files = (detailRes.data.files ?? []) as GhFile[]
  }

  return { notes: filesToChangedNotes(files) }
}

// In-memory cache keyed by repo + date. Past days are immutable, so entries
// never need invalidation within a session.
const cache = new Map<string, DayActivity>()

export type DayActivityState =
  | { status: "loading" }
  | { status: "ready"; data: DayActivity }
  | { status: "empty" }
  | { status: "offline" }
  | { status: "error"; message: string }

function toState(data: DayActivity): DayActivityState {
  return data.notes.length === 0 ? { status: "empty" } : { status: "ready", data }
}

/**
 * Fetch (and cache) the git-reconstructed activity for a past calendar day.
 * Surfaces loading / ready / empty / offline / error so the view can render
 * each cleanly. Past days are online-only (history lives on GitHub).
 */
export function useDayActivity(dateString: string | undefined): DayActivityState {
  const githubUser = useAtomValue(githubUserAtom)
  const githubRepo = useAtomValue(githubRepoAtom)
  const { online } = useNetworkState()

  const cacheKey =
    dateString && githubRepo ? `${githubRepo.owner}/${githubRepo.name}@${dateString}` : undefined

  const [state, setState] = React.useState<DayActivityState>(() =>
    cacheKey && cache.has(cacheKey) ? toState(cache.get(cacheKey)!) : { status: "loading" },
  )

  React.useEffect(() => {
    if (!dateString || !githubUser?.token || !githubRepo) {
      setState({ status: "error", message: "Not signed in" })
      return
    }

    if (cacheKey && cache.has(cacheKey)) {
      setState(toState(cache.get(cacheKey)!))
      return
    }

    if (online === false) {
      setState({ status: "offline" })
      return
    }

    let cancelled = false
    setState({ status: "loading" })

    fetchDayActivity({
      owner: githubRepo.owner,
      repo: githubRepo.name,
      token: githubUser.token,
      dateString,
    })
      .then((data) => {
        if (cancelled) return
        if (cacheKey) cache.set(cacheKey, data)
        setState(toState(data))
      })
      .catch((error) => {
        if (cancelled) return
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Failed to load history",
        })
      })

    return () => {
      cancelled = true
    }
  }, [dateString, githubUser?.token, githubRepo, cacheKey, online])

  return state
}
