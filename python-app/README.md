# Pixel Grid Inspector

Python reference implementation for pixel-art grid detection.

这个版本用于本地运行和算法迭代，目标是从位图中估计：

- 像素格步长
- 原始逻辑分辨率
- 放大倍数
- 叠加网格预览

## Stack

- Python
- FastAPI
- Pillow
- NumPy

## Run

在当前目录运行：

```bash
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

打开：

- `http://127.0.0.1:8000/`

## Notes

- 这个版本适合作为参考实现和算法工作目录
- 如果要部署到 GitHub Pages，请使用上层仓库中的 `site-static/`
- `outputs/previews/` 用来存放运行时生成的预览图
