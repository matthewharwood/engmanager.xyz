# Validation before pushing a PR

Use `.github/workflows/ci.yml` as the source of truth for required checks. A passing build or a few targeted tests does not prove the PR passes CI. Run these gates from the repository root with the pinned `rust-toolchain.toml` toolchain:

```sh
npm ci --prefix scripts --ignore-scripts
npm test --prefix scripts
node scripts/personality-release.mjs --verify-published
node scripts/personality-release.mjs
git diff --exit-code -- website/assets/personality/v7/release.mjs
cargo fmt --all --check
cargo clippy -p website --all-targets -- -D warnings
REQUIRE_BROWSER_TESTS=1 cargo test -p website
```

The website is a binary target; `cargo test -p website --lib` is not valid. Configure `CHROME_BIN` if Chrome is not automatically found. Keep `REQUIRE_BROWSER_TESTS=1` when verifying the full suite so browser checks cannot silently skip.

Fix Clippy warnings in the implementation instead of suppressing them just to pass CI. Run the same failing command locally after a fix, then complete the remaining gates that CI could not reach.

For browser-harness races, distinguish a missing execution context during navigation from a failed application assertion. Retry only the specific transient read within the existing deadline; do not mask arbitrary CDP errors, rerun whole failing fixtures blindly, or relax their assertions.

After pushing, inspect the PR checks and review feedback for the current head commit. When asked to make a PR pass, continue until all required checks have completed successfully on that commit; pending checks or results from an older commit are not proof. Diagnose failures from the job logs before changing code or rerunning a job.
