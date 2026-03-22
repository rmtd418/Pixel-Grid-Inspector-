# Pixel Grid Inspector

[中文说明](./README.zh-CN.md)

Detect pixel-art grid size, logical resolution, and upscale ratio from raster images.

Pixel Grid Inspector is an open-source project for inspecting pixel-art and pixel-style raster images. It helps estimate visible grid pitch, infer logical resolution, estimate upscale ratio, and generate a grid overlay for manual review.

## Demo

- GitHub Pages: `https://YOUR-USERNAME.github.io/YOUR-REPO/`

Replace the URL above after deployment.

## Who It Is For

- pixel artists
- tool developers
- archivists and image researchers
- modders
- anyone who needs to inspect pixel-art scaling reliably

## What This Repository Includes

This repository contains two editions of the project:

### `python-app/`

A Python reference implementation for local use, algorithm work, and future backend-oriented tooling.

### `docs/`

A browser-first static edition intended for public demos and GitHub Pages deployment.

## Why There Are Two Editions

The two editions serve different goals:

- `python-app/` is the better choice for local analysis and algorithm iteration.
- `docs/` is the better choice for a shareable public website with no backend dependency.

Keeping both in one repository makes the project easier to understand and easier to maintain.

## Repository Structure

```text
.
├─ python-app/
├─ docs/
├─ .gitignore
├─ README.md
└─ README.zh-CN.md
```

## GitHub Pages

If you want to publish a public website with GitHub Pages, publish:

- `docs/`

Do not publish:

- `python-app/`

GitHub Pages is for static assets, so the browser edition is the correct deployment target.

## Quick Start

### Python Edition

```bash
cd python-app
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Then open:

- `http://127.0.0.1:8000/`

### Static Edition

```bash
cd docs
python -m http.server 8020
```

Then open:

- `http://127.0.0.1:8020/`

## Current Status

- `python-app/` is the reference implementation.
- `docs/` is the public web target.

If future work focuses on GitHub Pages and browser-side detection, that work should primarily happen in `site-static/`.
