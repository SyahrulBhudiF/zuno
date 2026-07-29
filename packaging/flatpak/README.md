# Flatpak packaging

Built from source. Flathub reserves `extra-data` repackaging for software that cannot be
built, so a repackaged `.deb` would be sent back at review.

## The app ID is not the Tauri identifier

Flathub requires an ID under a domain the submitter controls. `zuno.com` is not one, so the
Flatpak is **`io.github.nofayz.Zuno`** while the app keeps `com.zuno.desktop` internally.
Changing the Tauri identifier would move every existing install's data directory, so they
stay different on purpose.

## Generated files

`cargo-sources.json` and `node-sources.json` list every crate and npm package, because Flatpak
builds run with no network. They are generated from the lockfiles, never edited:

```bash
flatpak-cargo-generator.py src-tauri/Cargo.lock -o packaging/flatpak/cargo-sources.json
flatpak-node-generator npm package-lock.json    -o packaging/flatpak/node-sources.json
```

`.github/workflows/flatpak.yml` does both and builds against them. Run it from **Actions →
Flatpak → Run workflow** and take the generated files from the artifact — that is how to
regenerate them without a Linux machine.

They must be committed to the Flathub repo. They are large and they change with every
dependency bump.

## Submitting to Flathub

Checked against
[docs.flathub.org](https://docs.flathub.org/docs/for-app-authors/requirements).

1. Get a green run of the Flatpak workflow, and take the generated source files from the
   artifact.
2. Fork [flathub/flathub](https://github.com/flathub/flathub), then branch **from `new-pr`**:

   ```bash
   git checkout -b zuno-submission new-pr
   ```

3. Copy these to the **repository root** — the manifest "must be at the top level", and
   `flathub.json` must sit next to it:

   ```
   io.github.nofayz.Zuno.yml            manifest, filename must equal the app ID
   io.github.nofayz.Zuno.metainfo.xml   mandatory for the Flathub listing
   io.github.nofayz.Zuno.desktop
   flathub.json                         architecture limit
   cargo-sources.json                   generated; dependency manifests must be included
   node-sources.json                    generated
   ```

4. Open the PR against the **`new-pr`** base branch, titled `Add io.github.nofayz.Zuno`.

Never close the PR to address review comments or to change the app ID — the same PR is
amended throughout.

Expect comments on `finish-args`: every permission has to be justified, and the usual request
is to narrow or drop the broadest. `--filesystem=xdg-run/app/com.discordapp.Discord` is the
likeliest to be questioned.

### Why the ID is what it is

Flathub requires GitHub-hosted projects to use `io.github.`, with at least four components and
the domain portion lowercased. `io.github.nofayz.Zuno` satisfies all three. It also cannot end
in `.desktop`, `.app` or `.linux` — which the app's own `com.zuno.desktop` identifier does,
and is a second reason the two differ.

## Pinning

The manifest builds a tagged commit, not a branch. Update `tag` and `commit` together for a
new release; a tag alone is not reproducible if it is ever moved.
