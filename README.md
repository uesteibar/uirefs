# uirefs

A library of UI references for your coding agents, to fight AI slop.

Left alone, an agent designs the average UI: the same cards, gradients and spacing as everything else.
uirefs gives it something better to start from: the components, sites, animations, identities and
resources **you** collect, each saved with images, a working demo and notes on how it behaves.

![The uirefs web UI](docs/screenshot.png)

## How it works

1. **Save.** Found something good online? Send the link to your agent and tell it to save it in uirefs.
   The agent reads the page, captures images, takes the interactive demo when it can, and writes down what
   it is and how it behaves.
2. **Browse.** You get a web UI to search, filter and clean up the library.
3. **Use.** When an agent designs or builds UI, it searches the library over MCP, picks the references that
   fit, and fetches everything it needs to implement them and check the result.

It is one static Go binary with a web UI and an MCP server, self-hosted, with no authentication (the network
is the access control). Design, data model, MCP tools and the acceptance list:
[`docs/design.md`](docs/design.md).

## Install

```sh
gh repo clone uesteibar/uirefs && cd uirefs && ./install.sh
# or, without a checkout:
curl -fsSL https://raw.githubusercontent.com/uesteibar/uirefs/main/install.sh | sh
```

Idempotent: run it again after a `git pull`. It:

- checks `git`, `curl` and a Go toolchain at least the version in `go.mod` (installs Go with `mise`
  when that is available, and never runs `sudo`);
- builds the binary with `CGO_ENABLED=0 go build -ldflags="-s -w"` and installs it to
  `${UIREFS_BIN:-~/.local/bin}/uirefs`;
- installs and starts a user service (`systemd --user` on Linux, a `launchd` agent on macOS) with the
  data in `${UIREFS_DATA:-~/.local/share/uirefs}` on `127.0.0.1:${UIREFS_PORT:-4880}`;
- waits for `GET /api/references` and runs `uirefs doctor`;
- registers the MCP server in the clients it finds on `PATH` (`claude`, `codex`, `hermes`, `pi`), each
  behind a yes/no question, then runs a real JSON-RPC smoke test (`initialize`, `tools/list`, `guide`).

**If you are a coding agent:** run `./install.sh --yes`, then call the MCP `guide` tool before saving
or searching references.

### Skills (optional)

The MCP `guide` tool already explains how to use the library. The skills in [`skills/`](skills) add the
workflows for saving a reference with its demo (`ui-reference-ingestion`), rebuilding a gated piece from its
public preview (`ui-reference-recreation`) and browsing the library for inspiration (`ui-reference-search`):

```sh
npx -y skills add uesteibar/uirefs --skill ui-reference-ingestion --skill ui-reference-search --skill ui-reference-recreation -g -a <your-agent> -y
```

Replace `<your-agent>` with `claude-code`, `codex`, `pi`, and so on (repeat `-a` for several).

### Prompt for your agent

Paste this into a coding agent to install uirefs and connect it:

```text
Install uirefs (https://github.com/uesteibar/uirefs) on this machine and connect it to yourself.

1. Run: git clone https://github.com/uesteibar/uirefs.git && cd uirefs && ./install.sh --yes
   It needs git, curl and Go (it installs Go with mise when available) and never uses sudo.
   It builds the binary, starts a user service on 127.0.0.1:4880 and registers the MCP in the
   clients it finds on PATH (claude, codex, hermes, pi).
2. If your own client is not registered, add the MCP by hand: streamable HTTP,
   http://127.0.0.1:4880/mcp, no auth.
3. Install the skills for your agent:
   npx -y skills add uesteibar/uirefs --skill ui-reference-ingestion --skill ui-reference-search --skill ui-reference-recreation -g -a <your-agent> -y
4. Verify with real calls: curl http://127.0.0.1:4880/api/references, then call the MCP
   `guide` and `search` tools. Read `guide` before saving anything.
5. Do not expose the service beyond localhost: it has no authentication.
   Report what you installed, the commands that ran and any step that failed.
```

Flags: `--port N`, `--data DIR`, `--no-service`, `--no-mcp`, `--mcp claude,codex,hermes,pi`, `--yes`,
`--force`, `--dry-run`, `-h`. Environment: `UIREFS_BIN`, `UIREFS_DATA`, `UIREFS_PORT`, `UIREFS_UNIT`,
`UIREFS_PUBLIC_URL` (the URL agents should use, for example a private HTTPS name; the MCP URL is
`<UIREFS_PUBLIC_URL>/mcp`), `UIREFS_EMBED_URL`, `HERMES_PROFILE`. `just install` and `just uninstall`
run the same two scripts. `./uninstall.sh` removes the service, the MCP entries and the binary; it
keeps the data directory unless you pass `--purge-data`.

There is no authentication: keep the service on localhost or a private network. Exposing it (a
tailnet name, a proxy) is your step, and anyone who reaches it can read and delete references.

The service answers only to `localhost`, IP addresses and the host in `UIREFS_PUBLIC_URL` (more names:
`UIREFS_ALLOWED_HOSTS`, comma separated); any other `Host` gets a 403, which stops DNS rebinding from a web
page. `POST /mcp` refuses cross-origin and non-JSON requests. An MCP caller can make `add` read a local file
or fetch a URL as an asset: that is a feature for your agents, so only connect agents you trust.

## Update

The service and the skills are updated separately.

**The service.** In your checkout, `git pull` and run `./install.sh` again. It rebuilds the binary and restarts the
service; your data is kept.

```sh
cd uirefs && git pull && ./install.sh
```

**The skills.** If you installed them with `npx skills add`, update them with:

```sh
npx -y skills update -g -y
```

`npx -y skills list` shows what is installed. If an update does not bring a skill up to date, install it again with the
command in [Skills](#skills-optional); it overwrites the old copy. If your agent reads the skills straight from your
checkout (a link to `skills/`), `git pull` is enough.

## Build

```sh
just build          # CGO_ENABLED=0 go build -o uirefs ./cmd/uirefs
just check          # go vet ./... && go test ./...
```

Go comes from `mise.toml`; run `mise install` in a fresh checkout if `go` is missing.

## Run

```sh
./uirefs serve --port 4880 --data ./data
```

- Web UI: `http://127.0.0.1:4880/`
- MCP: `http://127.0.0.1:4880/mcp` (streamable HTTP, no auth)

`--data` holds the SQLite file and every asset, and is the only state; default `./data`.
Other commands: `uirefs reindex --data DIR`, `uirefs doctor --data DIR` and `uirefs version`.

## Search

Keyword search (SQLite FTS5) is always on. Semantic search is optional: point `UIREFS_EMBED_URL` at an
OpenAI-compatible `/v1/embeddings` endpoint, then run `uirefs reindex` once — and again after changing
the endpoint or model. With the variable unset, nothing about embeddings is loaded, and with the
endpoint down search still answers from keywords.

```sh
UIREFS_EMBED_URL=http://127.0.0.1:48900/v1/embeddings ./uirefs serve --port 4880 --data ./data
UIREFS_EMBED_URL=http://127.0.0.1:48900/v1/embeddings ./uirefs reindex --data ./data
```

`sidecar/` is a small local implementation of that endpoint (Xenova/all-MiniLM-L6-v2, int8), and
`deploy/` has the unit template the installer renders. `tools/mock/` is a mock of the JSON API for
working on the web UI without a service.

## License

MIT, see [`LICENSE`](LICENSE). The UI uses the [Allo](https://allo.joshpuckett.me/) typeface by Josh Puckett
(SIL Open Font License 1.1, see [`web/fonts/OFL.txt`](web/fonts/OFL.txt) and
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)).
