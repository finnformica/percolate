import micromatch from "micromatch"
import { GitHubRepository, GitHubUser } from "../schema"
import { fs } from "./fs"
import { REPO_DIR } from "./git"

/** Check if a file is tracked with Git LFS by checking the .gitattributes file */
export async function isTrackedWithGitLfs(path: string) {
  try {
    // Get .gitattributes file
    const gitAttributes = await fs.promises.readFile(`${REPO_DIR}/.gitattributes`)

    // Parse .gitattributes file
    const parsedGitAttributes = gitAttributes
      .toString()
      .split("\n")
      .reduce(
        (acc, line) => {
          // Ignore comments
          if (line.startsWith("#")) {
            return acc
          }

          // Ignore empty lines
          if (!line.trim()) {
            return acc
          }

          // Split line into parts
          const [pattern, ...attrs] = line.split(" ")

          // Add pattern and filter to accumulator
          return [...acc, { pattern, attrs }]
        },
        [] as Array<{ pattern: string; attrs: string[] }>,
      )

    // Return true if any patterns matching the file path have filter=lfs set
    return parsedGitAttributes.some(({ pattern, attrs }) => {
      // Check if file path matches pattern and if filter=lfs is set
      return (
        micromatch.isMatch(
          path
            // Remove REPO_DIR from path
            .replace(REPO_DIR, "")
            // Remove leading slash from path
            .replace(/^\/*/, ""),
          pattern
            // Remove leading slash from pattern
            .replace(/^\//, ""),
        ) && attrs.includes("filter=lfs")
      )
    })
  } catch (error) {
    return false
  }
}

/** Resolve a Git LFS pointer to a file URL */
export async function resolveGitLfsPointer({
  file,
  githubUser,
  githubRepo,
}: {
  file: File
  githubUser: GitHubUser
  githubRepo: GitHubRepository
}) {
  const text = await file.text()

  const response = await fetch(
    `/git-lfs-file?repo=${githubRepo.owner}/${githubRepo.name}&pointer=${text}`,
    {
      headers: {
        Authorization: `Bearer ${githubUser.token}`,
      },
    },
  )

  if (!response.ok) {
    throw new Error("Unable to resolve Git LFS pointer")
  }

  const url = await response.text()

  if (!url) {
    throw new Error("Unable to resolve Git LFS pointer")
  }

  return url
}
