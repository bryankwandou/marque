"use client";

/**
 * Outside services the workbench can reach.
 *
 * The rule that decides what can be here: the browser has to be able to call it
 * directly. GitHub and Vercel both send CORS headers on their public APIs, so a
 * token typed into this tab reaches them without a relay of ours in the middle,
 * and the token never touches our server. Anything that would need a proxy is
 * listed as unavailable rather than faked.
 *
 * Tokens are held in localStorage on the machine that typed them. That is the
 * same trust boundary as the signing key, and it is worth being blunt about:
 * a token in localStorage is readable by anything that can run script on this
 * origin. Scope them to the one repo you mean.
 */

const TOKEN_PREFIX = "marque.connector.";

export type ConnectorId = "github" | "vercel" | "n8n";

export function readToken(id: ConnectorId): string {
  if (typeof localStorage === "undefined") return "";
  return localStorage.getItem(`${TOKEN_PREFIX}${id}`) ?? "";
}

export function writeToken(id: ConnectorId, value: string): void {
  if (typeof localStorage === "undefined") return;
  if (value) localStorage.setItem(`${TOKEN_PREFIX}${id}`, value);
  else localStorage.removeItem(`${TOKEN_PREFIX}${id}`);
}

/* ------------------------------------------------------------------ GitHub */

export type GitHubIdentity = { login: string; name: string | null };
export type Repo = { fullName: string; private: boolean; defaultBranch: string };

async function gh<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
      ...(init?.body ? { "content-type": "application/json" } : {}),
    },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(
      body.message ? `GitHub: ${body.message}` : `GitHub returned ${res.status}`,
    );
  }
  return (await res.json()) as T;
}

export async function githubIdentity(token: string): Promise<GitHubIdentity> {
  const me = await gh<{ login: string; name: string | null }>("/user", token);
  return { login: me.login, name: me.name };
}

export async function githubRepos(token: string): Promise<Repo[]> {
  const list = await gh<
    { full_name: string; private: boolean; default_branch: string }[]
  >("/user/repos?per_page=100&sort=updated", token);

  return list.map((r) => ({
    fullName: r.full_name,
    private: r.private,
    defaultBranch: r.default_branch,
  }));
}

/** Every file path in a repo, read from the tree at the default branch head. */
export async function githubTree(
  token: string,
  fullName: string,
  branch: string,
): Promise<string[]> {
  const tree = await gh<{ tree: { path: string; type: string }[] }>(
    `/repos/${fullName}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    token,
  );
  return tree.tree.filter((n) => n.type === "blob").map((n) => n.path).sort();
}

/**
 * Contents API returns base64 with newlines wrapped in, and the bytes are UTF-8
 * rather than latin-1, so neither plain atob nor a naive decode is enough.
 */
export async function githubReadFile(
  token: string,
  fullName: string,
  path: string,
  branch: string,
): Promise<{ content: string; sha: string }> {
  const file = await gh<{ content: string; encoding: string; sha: string }>(
    `/repos/${fullName}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(branch)}`,
    token,
  );

  if (file.encoding !== "base64") {
    throw new Error(`Unexpected encoding ${file.encoding} for ${path}`);
  }

  const raw = atob(file.content.replace(/\n/g, ""));
  const bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0));
  return { content: new TextDecoder().decode(bytes), sha: file.sha };
}

/**
 * Write a file back as a real commit. The sha is required when the file already
 * exists and must be absent when it does not, which is the one edge that turns
 * a working push into a 422.
 */
export async function githubWriteFile({
  token,
  fullName,
  path,
  branch,
  content,
  message,
}: {
  token: string;
  fullName: string;
  path: string;
  branch: string;
  content: string;
  message: string;
}): Promise<{ commit: string; url: string }> {
  let sha: string | undefined;
  try {
    sha = (await githubReadFile(token, fullName, path, branch)).sha;
  } catch {
    // Not there yet, which is a create rather than an update.
  }

  const bytes = new TextEncoder().encode(content);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));

  const res = await gh<{ commit: { sha: string; html_url: string } }>(
    `/repos/${fullName}/contents/${path.split("/").map(encodeURIComponent).join("/")}`,
    token,
    {
      method: "PUT",
      body: JSON.stringify({
        message,
        content: btoa(binary),
        branch,
        ...(sha ? { sha } : {}),
      }),
    },
  );

  return { commit: res.commit.sha.slice(0, 7), url: res.commit.html_url };
}

/* ------------------------------------------------------------------ Vercel */

export type VercelProject = {
  id: string;
  name: string;
  updatedAt: number;
};

export async function vercelProjects(token: string): Promise<VercelProject[]> {
  const res = await fetch("https://api.vercel.com/v9/projects?limit=50", {
    headers: { authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      error?: { message?: string };
    };
    throw new Error(
      body.error?.message
        ? `Vercel: ${body.error.message}`
        : `Vercel returned ${res.status}`,
    );
  }

  const data = (await res.json()) as {
    projects: { id: string; name: string; updatedAt: number }[];
  };
  return data.projects.map((p) => ({
    id: p.id,
    name: p.name,
    updatedAt: p.updatedAt,
  }));
}

/* --------------------------------------------------------------------- n8n */

/**
 * n8n is reached by posting to a workflow's webhook URL. Whether the browser is
 * allowed to depends on the CORS settings of that instance, which is the
 * instance owner's call, not ours — so a failure here is reported as what it is
 * rather than swallowed.
 */
export async function n8nTrigger(
  webhookUrl: string,
  payload: unknown,
): Promise<number> {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Webhook returned ${res.status}`);
  return res.status;
}
