# Pixel Grid Inspector

Static browser edition for GitHub Pages.

这个版本不依赖后端，适合用作：

- GitHub Pages 在线演示
- 浏览器本地检测
- 开源仓库里的可直接访问版本

## Features

- 本地导入图片
- 浏览器端执行检测
- 原图 / 叠加网格预览切换
- 无需 Python 后端

## Local Preview

在当前目录运行：

```bash
python -m http.server 8020
```

然后打开：

- `http://127.0.0.1:8020/`

## Notes

- 这个目录就是 GitHub Pages 目标版本
- 发布静态站点时，可以直接把这个目录作为站点源
- 所有计算都在浏览器本地完成
