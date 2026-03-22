# Pixel Grid Inspector

[English](./README.md)

检测像素画位图中的像素格大小、逻辑分辨率和放大倍数。

Pixel Grid Inspector 是一个面向像素画与像素风位图的开源项目，用来估计可见像素格步长、推断原始逻辑分辨率、推断放大倍数，并生成叠加网格供人工校验。

## 在线演示

- GitHub Pages: [https://rmtd418.github.io/Pixel-Grid-Inspector/](https://rmtd418.github.io/Pixel-Grid-Inspector/)

上线后，把上面的地址替换成你的真实页面地址。

## 适合谁用

- 像素画作者
- 工具开发者
- 图像整理与归档人员
- 模组作者
- 需要判断像素画缩放是否准确的人

## 仓库包含什么

这个仓库包含两个版本：

### `python-app/`

Python 参考实现，适合本地运行、算法验证和后续继续开发。

### `docs/`

浏览器优先的纯静态版本，适合做公开演示和 GitHub Pages 部署。

## 为什么保留两个版本

它们分别面向不同场景：

- `python-app/` 更适合作为本地分析工具和算法参考实现。
- `docs/` 更适合作为公开网页和无后端依赖的在线版本。

把它们放在同一个仓库里，最利于别人理解项目，也最方便后续维护。

## 仓库结构

```text
.
├─ python-app/
├─ docs/
├─ .gitignore
├─ README.md
└─ README.zh-CN.md
```

## GitHub Pages 说明

如果你要挂 GitHub Pages，应该发布：

- `docs/`

不应该发布：

- `python-app/`

因为 GitHub Pages 只能托管静态文件，不能运行 Python 服务端。

## 快速开始

### Python 版

```bash
cd python-app
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

然后打开：

- `http://127.0.0.1:8000/`

### 静态版

```bash
cd docs
python -m http.server 8020
```

然后打开：

- `http://127.0.0.1:8020/`

## 当前状态

- `python-app/` 是参考实现版本。
- `docs/` 是公开网页目标版本。

如果后续重点是 GitHub Pages 和浏览器端检测，建议主要在 `docs/` 中继续推进。
