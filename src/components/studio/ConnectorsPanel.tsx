"use client";

import { useEffect, useState } from "react";
import { Plug, Check, Download, Upload, Send, ExternalLink } from "lucide-react";
import { PanelHeader } from "./Explorer";
import { useWorkspace } from "@/lib/workspace";
import { record } from "@/lib/history";
import {
  readToken,
  writeToken,
  githubIdentity,
  githubRepos,
  githubTree,
  githubReadFile,
  githubWriteFile,
  vercelProjects,
  n8nTrigger,
  type Repo,
  type VercelProject,
} from "@/lib/connectors";
import { cn } from "@/lib/utils";

type Tab = "github" | "vercel" | "n8n" | "other";

const TABS: { id: Tab; label: string }[] = [
  { id: "github", label: "GitHub" },
  { id: "vercel", label: "Vercel" },
  { id: "n8n", label: "n8n" },
  { id: "other", label: "Rest" },
];

export function ConnectorsPanel() {
  const [tab, setTab] = useState<Tab>("github");

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Connectors">
        <Plug size={11} className="text-faint" />
      </PanelHeader>

      <div className="flex shrink-0 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "flex-1 border-b-2 px-1 py-1.5 font-mono text-[10.5px] transition-colors duration-150",
              tab === t.id
                ? "border-brass text-paper"
                : "border-transparent text-faint hover:text-muted",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
        {tab === "github" && <GitHubTab />}
        {tab === "vercel" && <VercelTab />}
        {tab === "n8n" && <N8nTab />}
        {tab === "other" && <OtherTab />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ GitHub */

function GitHubTab() {
  const files = useWorkspace((s) => s.files);
  const activePath = useWorkspace((s) => s.activePath);
  const create = useWorkspace((s) => s.create);
  const update = useWorkspace((s) => s.update);

  const [token, setToken] = useState("");
  const [login, setLogin] = useState<string | null>(null);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [repo, setRepo] = useState("");
  const [tree, setTree] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setToken(readToken("github")), []);

  const chosen = repos.find((r) => r.fullName === repo);

  const connect = async () => {
    setError(null);
    setBusy("connect");
    try {
      const me = await githubIdentity(token);
      writeToken("github", token);
      setLogin(me.login);
      const list = await githubRepos(token);
      setRepos(list);
      setNote(`${list.length} repositories reachable`);
    } catch (err) {
      setError((err as Error).message);
      setLogin(null);
    } finally {
      setBusy(null);
    }
  };

  const loadTree = async (fullName: string) => {
    const target = repos.find((r) => r.fullName === fullName);
    if (!target) return;
    setRepo(fullName);
    setError(null);
    setBusy("tree");
    try {
      setTree(await githubTree(token, fullName, target.defaultBranch));
    } catch (err) {
      setError((err as Error).message);
      setTree([]);
    } finally {
      setBusy(null);
    }
  };

  const pull = async (path: string) => {
    if (!chosen) return;
    setError(null);
    setBusy(path);
    try {
      const file = await githubReadFile(token, repo, path, chosen.defaultBranch);
      if (files.some((f) => f.path === path)) update(path, file.content);
      else create(path, file.content);
      await record(path, file.content, "create");
      setNote(`Pulled ${path}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const push = async () => {
    const file = files.find((f) => f.path === activePath);
    if (!file || !chosen) return;
    setError(null);
    setBusy("push");
    try {
      const res = await githubWriteFile({
        token,
        fullName: repo,
        path: file.path,
        branch: chosen.defaultBranch,
        content: file.content,
        message: `Update ${file.path} from Marque`,
      });
      setNote(`Committed ${res.commit}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const shown = tree
    .filter((p) => !filter || p.toLowerCase().includes(filter.toLowerCase()))
    .slice(0, 60);

  return (
    <div className="space-y-3">
      <Field
        label={login ? `Connected as ${login}` : "Personal access token"}
        value={token}
        onChange={setToken}
        placeholder="github_pat_…"
        secret
      />

      <Row>
        <Action onClick={() => void connect()} busy={busy === "connect"}>
          {login ? "Re-check" : "Connect"}
        </Action>
        {login && (
          <Action
            onClick={() => {
              writeToken("github", "");
              setToken("");
              setLogin(null);
              setRepos([]);
              setTree([]);
            }}
          >
            Forget
          </Action>
        )}
      </Row>

      {repos.length > 0 && (
        <label className="block">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.09em] text-faint">
            Repository
          </span>
          <select
            value={repo}
            onChange={(e) => void loadTree(e.target.value)}
            className="w-full rounded-[6px] border border-line bg-ink px-2 py-1.5 font-mono text-[11px] text-paper outline-none hover:border-line-strong"
          >
            <option value="">Pick one</option>
            {repos.map((r) => (
              <option key={r.fullName} value={r.fullName}>
                {r.fullName}
                {r.private ? " (private)" : ""}
              </option>
            ))}
          </select>
        </label>
      )}

      {repo && (
        <>
          <Row>
            <Action
              onClick={() => void push()}
              busy={busy === "push"}
              disabled={!activePath}
            >
              <Upload size={10} />
              Commit {activePath ? activePath.split("/").pop() : "nothing open"}
            </Action>
          </Row>

          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={`Filter ${tree.length} paths`}
            className="w-full rounded-[6px] border border-line bg-ink px-2 py-1.5 font-mono text-[11px] text-paper outline-none placeholder:text-faint focus:border-line-strong"
          />

          <div className="space-y-0.5">
            {busy === "tree" && (
              <p className="font-mono text-[10.5px] text-faint">reading tree…</p>
            )}
            {shown.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => void pull(p)}
                className="group flex w-full items-center gap-2 rounded-[4px] px-1.5 py-1 text-left transition-colors duration-150 hover:bg-raised"
              >
                <Download
                  size={10}
                  className={cn(
                    "shrink-0",
                    busy === p ? "text-brass" : "text-faint group-hover:text-brass",
                  )}
                />
                <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted">
                  {p}
                </span>
              </button>
            ))}
            {tree.length > shown.length && (
              <p className="px-1.5 pt-1 font-mono text-[10px] text-faint">
                {tree.length - shown.length} more — narrow the filter
              </p>
            )}
          </div>
        </>
      )}

      <Status note={note} error={error} />

      <p className="text-[11px] leading-[1.6] text-faint">
        The token is stored in this browser and sent only to api.github.com. Give
        it contents access to the one repository you mean, nothing wider.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ Vercel */

function VercelTab() {
  const [token, setToken] = useState("");
  const [projects, setProjects] = useState<VercelProject[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setToken(readToken("vercel")), []);

  const connect = async () => {
    setError(null);
    setBusy(true);
    try {
      const list = await vercelProjects(token);
      writeToken("vercel", token);
      setProjects(list);
    } catch (err) {
      setError((err as Error).message);
      setProjects([]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <Field
        label="Access token"
        value={token}
        onChange={setToken}
        placeholder="vercel token"
        secret
      />
      <Row>
        <Action onClick={() => void connect()} busy={busy}>
          List projects
        </Action>
      </Row>

      {projects.map((p) => (
        <a
          key={p.id}
          href={`https://vercel.com/dashboard?query=${encodeURIComponent(p.name)}`}
          target="_blank"
          rel="noreferrer noopener"
          className="flex items-center gap-2 rounded-[5px] border border-line px-2 py-1.5 transition-colors duration-150 hover:border-line-strong hover:bg-raised"
        >
          <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-paper">
            {p.name}
          </span>
          <ExternalLink size={10} className="shrink-0 text-faint" />
        </a>
      ))}

      <Status note={null} error={error} />

      <p className="text-[11px] leading-[1.6] text-faint">
        Read-only on purpose. Marque lists what a token can see; it does not
        trigger deployments, because a browser tab holding a token that can ship
        to production is a bad trade.
      </p>
    </div>
  );
}

/* --------------------------------------------------------------------- n8n */

function N8nTab() {
  const files = useWorkspace((s) => s.files);
  const seals = useWorkspace((s) => s.seals);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setUrl(readToken("n8n")), []);

  const fire = async () => {
    setError(null);
    setBusy(true);
    try {
      const status = await n8nTrigger(url, {
        source: "marque",
        at: new Date().toISOString(),
        files: files.map((f) => ({ path: f.path, size: f.content.length })),
        latestSeal: seals[0] ?? null,
      });
      writeToken("n8n", url);
      setNote(`Webhook answered ${status}`);
    } catch (err) {
      setError(
        `${(err as Error).message}. If the instance is reachable, the usual cause is CORS: n8n must allow this origin.`,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <Field
        label="Webhook URL"
        value={url}
        onChange={setUrl}
        placeholder="https://your-n8n/webhook/marque"
      />
      <Row>
        <Action onClick={() => void fire()} busy={busy} disabled={!url}>
          <Send size={10} />
          Send workspace state
        </Action>
      </Row>
      <Status note={note} error={error} />
      <p className="text-[11px] leading-[1.6] text-faint">
        Posts the file list and the most recent seal as JSON. Useful as a trigger:
        a seal lands, the workflow picks it up.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------- Rest */

const UNAVAILABLE = [
  {
    name: "Replit",
    why: "No public API for writing files into a Repl. Nothing to connect to without scraping a session, which is not something to ship.",
  },
  {
    name: "GitLab, Gitea, Forgejo",
    why: "Same shape as the GitHub tab and CORS-clean. Not wired yet — this is the next one worth adding.",
  },
  {
    name: "Netlify, Render, Fly",
    why: "Would be read-only status like Vercel. Low value against the effort so far.",
  },
];

function OtherTab() {
  return (
    <div className="space-y-2">
      <p className="text-[11.5px] leading-[1.6] text-muted">
        What is not here, and why. A connector that half works is worse than one
        that says it does not exist.
      </p>
      {UNAVAILABLE.map((c) => (
        <div key={c.name} className="rounded-[6px] border border-line px-2.5 py-2">
          <p className="text-[12px] text-paper">{c.name}</p>
          <p className="mt-0.5 text-[11px] leading-[1.55] text-faint">{c.why}</p>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- fragments */

function Field({
  label,
  value,
  onChange,
  placeholder,
  secret,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  secret?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.09em] text-faint">
        {label}
      </span>
      <input
        type={secret ? "password" : "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        className="w-full rounded-[6px] border border-line bg-ink px-2 py-1.5 font-mono text-[11px] text-paper outline-none placeholder:text-faint focus:border-line-strong"
      />
    </label>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-1.5">{children}</div>;
}

function Action({
  children,
  onClick,
  busy,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      className="flex items-center gap-1 rounded-[4px] border border-line-strong px-2 py-1 font-mono text-[10.5px] text-muted transition-colors duration-150 hover:border-brass hover:text-brass disabled:opacity-40 disabled:hover:border-line-strong disabled:hover:text-muted"
    >
      {busy ? "working…" : children}
    </button>
  );
}

function Status({ note, error }: { note: string | null; error: string | null }) {
  if (error) {
    return (
      <p className="rounded-[6px] border border-oxide/30 bg-oxide/10 px-2.5 py-2 font-mono text-[11px] leading-[1.55] text-oxide">
        {error}
      </p>
    );
  }
  if (note) {
    return (
      <p className="flex items-center gap-1.5 font-mono text-[11px] text-verdigris">
        <Check size={11} />
        {note}
      </p>
    );
  }
  return null;
}
