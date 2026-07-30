# Rulesets

Rulesets are repository *settings*, not configuration GitHub reads from the tree — a file here
does nothing until it is imported. It lives in the repo so the protection on `main` is reviewable
in a diff instead of being a thing someone once clicked.

Apply or update:

```sh
gh api repos/nofayz/zuno/rulesets --input .github/rulesets/main.json          # create
gh api --method PUT repos/nofayz/zuno/rulesets/<id> --input .github/rulesets/main.json  # update
```

`gh api repos/nofayz/zuno/rulesets` lists the ids. The UI equivalent is Settings → Rules →
Rulesets → New ruleset → Import a ruleset.

## What `main.json` does

- No deletion, no force-push.
- Changes arrive by pull request. **Zero** approvals required — this is a solo-maintained repo, and
  a review count of one would lock the maintainer out of their own default branch, since nobody can
  approve their own PR.
- `verify` and `rust` — both CI jobs — must pass first. Not strict: a branch does not have to be
  rebased onto the newest `main` before merging, which on a repo this size is churn without a
  matching risk.
- No bypass actors. An admin can still edit the ruleset itself, so the escape hatch exists without
  a standing exemption that quietly makes the rules advisory.
