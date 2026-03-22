# Pixel Grid Inspector

Detect pixel-art grid size, logical resolution, and upscale ratio from raster images.

`Pixel Grid Inspector` 是一个面向像素画与像素风图像的网格检测项目，用来估计：

- 单个像素格在位图中的步长
- 推断原始逻辑分辨率
- 推断放大倍数
- 叠加网格预览结果

这个开源包包含两个版本：

- `python-app/`：Python 参考实现，适合继续做算法和本地工具
- `site-static/`：纯静态网页版，适合部署到 GitHub Pages 做在线演示

## Why Two Versions

这两个版本解决的是不同场景：

- `python-app/` 保留了完整的本地实现，适合继续迭代检测算法
- `site-static/` 不依赖后端，适合公开展示和在线试用

如果你准备开源，一个仓库同时包含这两个版本是最清楚的结构。

## Repository Layout

```text
open-source/
  README.md
  .gitignore
  python-app/
  site-static/
```

## Editions

### `python-app/`

Python reference app.

适合：

- 本地运行
- 算法验证
- 后续研究和重构

技术栈：

- Python
- FastAPI
- Pillow
- NumPy

### `site-static/`

Static browser edition.

适合：

- GitHub Pages
- 在线演示
- 开源仓库里的即开即用版本

特点：

- 无后端依赖
- 图片只在浏览器本地处理
- 可以直接作为静态站点目录发布

## GitHub Pages

如果你要挂 GitHub Pages，应该发布的是：

- `site-static/`

不是：

- `python-app/`

原因很简单：GitHub Pages 只托管静态文件，不运行 Python 服务端。

## Quick Start

### Python Version

进入 `python-app/` 后运行：

```bash
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

然后打开：

- `http://127.0.0.1:8000/`

### Static Version

进入 `site-static/` 后运行本地静态服务：

```bash
python -m http.server 8020
```

然后打开：

- `http://127.0.0.1:8020/`

## Recommended Repository Name

建议仓库名：

- `pixel-grid-inspector`

备选：

- `pixel-grid-detector`
- `pixel-art-grid-inspector`

## Recommended GitHub Description

可直接填写这一句：

`Detect pixel-art grid size, logical resolution, and upscale ratio from raster images, with both a Python reference app and a static browser demo.`

## Status

- `python-app/`：完整本地版
- `site-static/`：可部署静态版

如果后续继续做 GitHub Pages 演示，建议只在 `site-static/` 中推进浏览器端能力，不要再和 Python 版混写。
