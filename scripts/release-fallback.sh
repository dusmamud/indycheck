#!/usr/bin/env bash
# Fallback release bump for satellite-only batches.
#
# WHY: release-plz 0.4.3 only counts commits that touch the publishable
# package's own directory (PackagePaths = crates/indycheck + its README,
# walked via parents_at_paths). Work that lands anywhere else — the
# Flutter/Dart package, the PHP package, the FFI/napi crates, Go, CI
# workflows — never enters its diff, so it prints "indycheck: already up
# to date" and opens no release PR, forever. (changelog_include does NOT
# fix the trigger: binding crates have publish = false, and
# takes_part_in_release() only processes publishable packages, so their
# commits never reach the diff at all.)
#
# WHEN IT RUNS: the release-pr workflow calls this right after
# `release-plz update`. It only acts when ALL of these hold:
#   (a) `release-plz update` produced no diff (working tree clean);
#   (b) the local workspace version equals the version of the latest
#       `indycheck-v*` git tag (i.e. no bump is pending — in particular
#       this is a NO-OP in the already-bumped post-merge state, where
#       local is 0.2.3 and the latest tag is still 0.2.2, so it can never
#       fight release-plz over a hand-written changelog entry);
#   (c) conventional commits matching ^(feat|fix|perf|breaking) exist
#       since that tag.
# Then it bumps the patch version in the root Cargo.toml and writes the
# new changelog entry into crates/indycheck/CHANGELOG.md from
# `git log <tag>..HEAD` subjects, grouped feat -> Added, fix -> Fixed,
# everything else (perf/breaking/ci) -> Other, in release-plz style
# `- *(scope)* subject`. Identical subjects (the same change pushed file
# by file) are listed once. An empty `## [Unreleased]` section is left
# on top. The workflow's sync-versions + cargo check + PR steps then run
# as normal (sync-versions also syncs the Flutter pubspec).
set -euo pipefail
cd "$(dirname "$0")/.."

CHANGELOG="crates/indycheck/CHANGELOG.md"

# (a) release-plz already produced a diff -> nothing for us to do.
if ! git diff --quiet; then
  echo "release-fallback: release-plz already produced a diff, skipping"
  exit 0
fi

latest_tag=$(git describe --tags --match 'indycheck-v*' --abbrev=0 2>/dev/null || true)
if [ -z "$latest_tag" ]; then
  echo "release-fallback: no indycheck-v* tag found, skipping"
  exit 0
fi
old_version=${latest_tag#indycheck-v}

local_version=$(grep -m1 '^version =' Cargo.toml | sed -E 's/version = "(.*)"/\1/')

# (b) local version must equal the latest tag version.
if [ "$local_version" != "$old_version" ]; then
  echo "release-fallback: local version $local_version != latest tag $latest_tag, skipping (already bumped)"
  exit 0
fi

# (c) need at least one feat/fix/perf/breaking commit since the tag.
if ! git log "$latest_tag..HEAD" --format='%s' | grep -Eq '^(feat|fix|perf|breaking)!?(\(|:)'; then
  echo "release-fallback: no feat/fix/perf/breaking commits since $latest_tag, skipping"
  exit 0
fi

# Patch bump: 0.2.2 -> 0.2.3.
new_version=$(echo "$old_version" | awk -F. '{printf "%d.%d.%d", $1, $2, $3+1}')
if grep -q "## \[$new_version\]" "$CHANGELOG"; then
  echo "release-fallback: CHANGELOG already has [$new_version], skipping"
  exit 0
fi
echo "release-fallback: bumping $old_version -> $new_version (commits since $latest_tag)"

sed -i -E "0,/^version = \"$old_version\"/s//version = \"$new_version\"/" Cargo.toml

today=$(date +%F)
compare_url="https://github.com/dusmamud/indycheck/compare/indycheck-v${old_version}...indycheck-v${new_version}"

added=""
fixed=""
other=""
seen=""
while IFS= read -r subject; do
  # Skip the release commit itself if it is in range (it never is on
  # main, but keep the generated entry free of it regardless).
  case "$subject" in
    "chore: Release package indycheck version "* ) continue ;;
  esac
  # Deduplicate identical subjects (same change pushed file by file).
  case "$seen" in
    *"|$subject|"*) continue ;;
  esac
  seen="$seen|$subject|"
  # Type, optional scope, message -> "- *(scope)* message" / "- message".
  # (Regex kept in a variable: unquoted parens inside [[ =~ ]] break parsing.)
  re='^(feat|fix|perf|breaking|ci)(!)?(\(([^)]*)\))?:[[:space:]]*(.*)$'
  if [[ "$subject" =~ $re ]]; then
    type="${BASH_REMATCH[1]}"
    scope="${BASH_REMATCH[4]}"
    msg="${BASH_REMATCH[5]}"
    if [ -n "$scope" ]; then
      line="- *($scope)* $msg"
    else
      line="- $msg"
    fi
  else
    type="other"
    line="- $subject"
  fi
  case "$type" in
    feat)  added="$added$line
" ;;
    fix)   fixed="$fixed$line
" ;;
    *)     other="$other$line
" ;;
  esac
# Only feat/fix/perf/breaking/ci commits go in the entry (chore/docs and
# other non-release commits stay out; the release commit is skipped above).
done < <(git log "$latest_tag..HEAD" --format='%s' --reverse | grep -E '^(feat|fix|perf|breaking|ci)!?(\([^)]*\))?:')

entry="## [$new_version]($compare_url) - $today"
# Strip trailing newlines from the groups (command substitution does
# that) so exactly one blank line separates the sections.
added=$(printf '%s' "$added")
fixed=$(printf '%s' "$fixed")
other=$(printf '%s' "$other")
if [ -n "$added" ]; then
  entry="$entry

### Added

$added"
fi
if [ -n "$fixed" ]; then
  entry="$entry

### Fixed

$fixed"
fi
if [ -n "$other" ]; then
  entry="$entry

### Other

$other"
fi
# Trim the trailing newline from the last group before appending.
entry=$(printf '%s' "$entry")

# Insert the entry right after the (empty) ## [Unreleased] section.
# The blank line that originally followed [Unreleased] is dropped so the
# entry is separated from the next section by exactly one blank line.
tmp=$(mktemp)
awk -v entry="$entry" '
  /^## \[Unreleased\]/ { print; print ""; print entry; print ""; inserted=1; skip_blank=1; next }
  skip_blank && /^$/ { skip_blank=0; next }
  { skip_blank=0; print }
  END { if (!inserted) { print "ERROR: no ## [Unreleased] section" > "/dev/stderr"; exit 1 } }
' "$CHANGELOG" > "$tmp" && mv "$tmp" "$CHANGELOG"

echo "release-fallback: Cargo.toml now $new_version; CHANGELOG entry [$new_version] written"
