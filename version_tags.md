# Release Workflow Guide

This guide explains the workflow **after a release tag has been
pushed**, and how to continue development until the next release.

------------------------------------------------------------------------

# 1. After You Publish a Release

Once you have created and pushed a tag (example: `v0.1.0`) and published
the release on GitHub:

Your timeline now looks like this:

    commit → tag v0.1.0 → GitHub Release

This version represents a **snapshot of the project at that point in
time**.

Now development continues normally.

------------------------------------------------------------------------

# 2. Continue Development

Start working on the next features or fixes.

Typical workflow:

``` bash
git add .
git commit -m "describe the feature or change"
git push origin main
```

Every push to `main` will:

-   Update the repository
-   Trigger deployment on Vercel
-   Create a new production deployment

Example:

    v0.1.0  ← tagged release
    commit  ← new feature work
    commit
    commit

------------------------------------------------------------------------

# 3. Repeat Commits During Development

Continue committing work as features are completed.

Example development cycle:

``` bash
git add .
git commit -m "quiz generation system"
git push origin main

git add .
git commit -m "secure exam interface"
git push origin main

git add .
git commit -m "exam result storage"
git push origin main
```

These commits are part of the **next upcoming version**.

------------------------------------------------------------------------

# 4. Prepare the Next Release

When enough features are complete, create the next version tag.

Example:

    Next version: v0.2.0

Create the tag:

``` bash
git tag -a v0.2.0 -m "Pre-Alpha: Quiz Generation and Secure Exam Interface"
```

------------------------------------------------------------------------

# 5. Push the New Tag

Push the tag to the remote repository:

``` bash
git push origin v0.2.0
```

Or push all tags:

``` bash
git push origin --tags
```

------------------------------------------------------------------------

# 6. Create the Next GitHub Release

On the repository page:

1.  Open **Releases**
2.  Click **Draft a new release**
3.  Select the new tag (`v0.2.0`)
4.  Add release notes

Example:

## v0.2.0 -- Pre‑Alpha: Quiz System

### Live Application

https://signals-master.vercel.app

### Added

-   Randomized quiz generation
-   Secure exam interface
-   Result storage

### Next

-   Instructor dashboard
-   Exam analytics

Enable:

    Set as a pre-release

Then publish the release.

------------------------------------------------------------------------

# 7. Development Cycle Summary

The full repeating workflow looks like this:

    Release v0.1.0
          ↓
    Development
          ↓
    git commit
    git push
    git commit
    git push
          ↓
    Create tag v0.2.0
          ↓
    Push tag
          ↓
    Create GitHub Release
          ↓
    Repeat

------------------------------------------------------------------------

# 8. Example Version Timeline

Example progression for the project:

    v0.1.0  Exam start workflow
    v0.2.0  Quiz generation
    v0.3.0  Exam submission
    v0.4.0  Instructor dashboard
    v0.8.0  Multi‑tenant support
    v1.0.0  Public launch

Versions starting with `0.x.x` indicate the system is **still under
development**.

`v1.0.0` represents the **first stable production release**.

---

## Current - Pre-Alpha 

v0.1.0 - Exam Start and Rules

v0.2.0 - Pre-Verification: Secure Exam Interface



