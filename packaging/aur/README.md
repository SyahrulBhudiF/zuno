# AUR packaging

`zuno` repackages the published `.deb` for Arch. It is the source of truth for what gets
pushed to the AUR — edit it here, then mirror it into the AUR repo (below), so the packaging
lives with the project rather than only in a separate git remote nobody reviews.

## Why the binary package, and not the AppImage

The AppImage ships its own WebKitGTK and therefore has to bundle GStreamer plugins alongside
it. Until 1.2.2 it did not, so WebKitGTK found no `appsink`, could not build a playback
pipeline, and reported "YouTube player error 5" — with the host's plugins irrelevant, because
the lookup happens inside the bundle.

This package uses the system WebKitGTK and the system GStreamer, so the plugins are ordinary
`depends` and there is no bundle to get wrong. That is also why it works on 1.2.1.

## On the name

Arch convention suffixes prebuilt-binary packages with `-bin`, and `zuno-bin` is already
taken by a community maintainer (`9M2PJU`) tracking the same releases. This package uses the
bare name and declares `conflicts=('zuno-bin')`, since the two install the same files. If the
naming ever becomes contentious, the clean resolutions are to ask for co-maintainership of
`zuno-bin`, or to make this a genuine from-source PKGBUILD, which is what the bare name is
meant to signal.

## Publishing

`.github/workflows/aur.yml` does all of it, on every published release: bumps `pkgver`, runs
`updpkgsums` against the artifact that actually shipped, regenerates `.SRCINFO`, builds the
package to prove it works, and pushes. It creates the AUR repo on the first run if it does
not exist yet, so no Arch machine is needed at any point.

One secret is required: **`AUR_SSH_PRIVATE_KEY`**, the private half of the SSH key registered
on the AUR account.

To publish without cutting a release — the first time, or to fix a bad package — run the
workflow manually and give it a version:

```
Actions → AUR → Run workflow → version: 1.2.1
```

`pkgrel` goes up instead of `pkgver` when only the packaging changed and the upstream release
did not. The workflow always resets it to 1, so a packaging-only fix needs editing the
PKGBUILD here and pushing it through the manual run.

## Editing by hand

Only `PKGBUILD` and `.SRCINFO` belong in the AUR repo — no sources, no built packages. If you
change the PKGBUILD, regenerate `.SRCINFO` alongside it, because the AUR reads that file and
not the PKGBUILD:

```bash
makepkg --printsrcinfo > .SRCINFO
```
