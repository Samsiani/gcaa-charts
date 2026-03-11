# LiteStats Pro — Claude Instructions

## Release Process (MANDATORY after every plugin update)

After ANY plugin code changes, ALWAYS create a new GitHub release. Never wait for the user to remind you.

### Push Pattern (every release)
```bash
# 1. Bump version in TWO places in litestats-pro.php (header comment + define)
# 2. Rsync plugin to push repo
rsync -av --delete \
  /Users/george/Documents/litestats-pro/ \
  /private/tmp/litestats-push/ \
  --exclude='.git' --exclude='vendor' --exclude='*.log'
# 3. Restore push-repo-only files (ALWAYS after rsync)
cd /private/tmp/litestats-push && git checkout HEAD -- .github/workflows/release.yml .gitignore CLAUDE.md && ls .github/workflows/release.yml .gitignore CLAUDE.md
# 4. Commit and push
git add -A && git commit -m "..." && git push origin main
# 5. Tag — GitHub Action creates the release + attaches ZIP automatically
git tag vX.X.X && git push origin vX.X.X
```

### Rules
- NEVER run `gh release create` manually — the GitHub Action handles it
- NEVER skip the `git checkout HEAD --` step for push-repo-only files
- NEVER push source files that don't belong in the installable plugin
- Version must be bumped in BOTH: `* Version:` header AND `define('LITESTATS_PRO_VERSION', ...)`
- ZIP internal folder is always `litestats-pro` (from workflow staging)

## Plugin Architecture
- WordPress plugin at `/Users/george/Documents/litestats-pro/`
- Custom DB table `{prefix}litestats_charts` (not CPT)
- Chart.js 4.4.1 for visualization
- GitHub repo: `Samsiani/gcaa-charts`
- Auto-update via `class-updater.php` + `softprops/action-gh-release@v2`
