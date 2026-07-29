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

1. Get a green run of the Flatpak workflow. A build that fails locally will fail there.
2. Fork [flathub/flathub](https://github.com/flathub/flathub) and branch from `new-pr`
   (**not** `master` — submissions are only accepted against that branch).
3. Add `io.github.nofayz.Zuno.yml`, the metainfo, the desktop file and both generated source
   files.
4. Open the PR. A bot builds it; reviewers then check the manifest, the ID, the permissions
   in `finish-args` and the AppStream data.

Expect review comments on `finish-args` — every permission has to be justified, and the
usual request is to narrow or drop the broadest ones.

## Pinning

The manifest builds a tagged commit, not a branch. Update `tag` and `commit` together for a
new release; a tag alone is not reproducible if it is ever moved.
