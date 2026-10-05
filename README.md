# CalcLab · 前端（前后端分离计算器系统）

软件工程第一次作业的**前端仓库**。页面只负责交互与展示：用户输入表达式后，前端通过 HTTP
把表达式发给后端，结果与历史记录全部由后端返回。**前端不算任何结果，也不缓存历史。**

> **在线演示地址（部署后填这里）**：`https://832402229_calculator_frontend-xxxx.onrender.com`
> **配套后端仓库**：`https://github.com/832402229/832402229_calculator_backend`

---

## 1. 项目简介

| 项目 | 说明 |
| --- | --- |
| 名称 | 前后端分离计算器系统 · 前端 |
| 技术栈 | 原生 HTML5 + CSS3 + JavaScript（Fetch API，无构建工具、无第三方库） |
| 主要能力 | 表达式输入（键盘 + 按键 + 示例）、结果展示、错误提示、历史查询/筛选/删除、清空历史、深浅色主题 |
| 与后端通信 | `POST /api/calculate`、`GET /api/history`、`DELETE /api/history/{id}`、`DELETE /api/history`、`GET /api/health` |

## 2. 环境要求

- 任意现代浏览器（Chrome / Edge / Firefox / Safari）
- Python 3.8+（仅用于运行本仓库自带的 `serve.py` 静态服务与接口代理）
- 需要后端服务正在运行（见 `832402229_calculator_backend` 仓库）

## 3. 启动方法

### 方式一：本仓库自带代理（推荐，一条命令）

```bash
# 先启动后端（另一个终端）：cd ../832402229_calculator_backend && python server.py
python serve.py --backend http://127.0.0.1:8000
# 浏览器打开 http://127.0.0.1:8080
```

`serve.py` 在**同一个端口**提供静态页面，并把 `/api/*` 反向代理到后端，
因此浏览器只看到"一个同源地址"：**没有跨域问题，也没有 HTTPS 混合内容问题**。

### 方式二：任意静态服务器 + 指定后端地址

```bash
python -m http.server 8080          # 或 VS Code Live Server
```

打开页面后，如果后端不在 `http://127.0.0.1:8000`，请在 HTML 里 `app.js` 之前加入：

```html
<script>window.CALCULATOR_API_BASE = "https://你的后端地址";</script>
```

（`app.js` 会读取这个变量作为接口根地址；不设置时使用同源地址。）

## 4. 配置说明

| 配置方式 | 说明 |
| --- | --- |
| `python serve.py --backend <URL>` | 代理目标后端地址 |
| 环境变量 `CALCULATOR_API_BASE` | 同上，便于在云平台配置 |
| 环境变量 `PORT` / `SERVE_PORT` | 本服务监听端口，默认 `8080`（Render 会注入 `PORT`） |
| `window.CALCULATOR_API_BASE` | 纯静态托管（GitHub Pages 等）时，在页面里注入后端地址 |

## 5. 前端与后端的连接方式

```
浏览器（本前端）
   │ 1. 用户点"发送到后端计算"，提交 { "expression": "(1+2)*3" }
   ├──────────────► POST /api/calculate          （经 serve.py 代理或直连后端）
   │ 2. 后端解析 → 计算 → 写入 SQLite → 返回
   ◄──────────────  { "success": true, "data": { "result": 9, "id": 12 } }
   │ 3. 前端展示结果，并重新查询历史
   ├──────────────► GET /api/history?limit=100
   ◄──────────────  { "success": true, "data": [ ... ] }
```

**如何证明前端没有偷偷计算？** 停掉后端进程后再次点击计算，页面会提示
"无法连接后端服务"，并且不显示任何结果 —— 因为 `app.js` 里没有任何解析或计算表达式的代码。

## 6. 页面功能与作业要求对照

| 作业要求 | 前端对应位置 |
| --- | --- |
| 加减乘除 | 按键区 `+ − × ÷`（界面显示 × ÷，发送给后端时为 `* /`） |
| 复合表达式 / 括号 / 一元正负号 / 小数 | 表达式输入框 + 示例按钮 `(1 + 2) * 3`、`−5 + 8`、`10 ÷ 2 + 7` |
| 非法表达式与除零提示 | 结果显示区红色错误文本 + 顶部"请求异常"状态 |
| 计算历史（来自数据库） | 右侧历史面板，支持筛选、显示条数、时间与编号 |
| 删除指定历史 | 每条记录右侧"删除"按钮 → `DELETE /api/history/{id}`，删除后重新查询 |
| 清空历史（扩展） | 面板右上角"清空全部" → `DELETE /api/history` |
| 扩展功能 | 键盘快捷键（Enter 计算 / Esc 清除）、深浅色主题（记忆偏好）、连接状态指示灯 |

## 7. 部署到 Render（让助教有一个可点击的地址）

本仓库是"静态页面 + 轻量代理"，也可以直接部署成一个公网服务：

1. 把本仓库推到 GitHub；
2. Render → **New +** → **Web Service** → 选择本仓库；
3. 配置：

   | 配置项 | 值 |
   | --- | --- |
   | Runtime | `Python 3` |
   | Build Command | 留空 |
   | Start Command | `python serve.py --backend https://你的后端服务名.onrender.com` |
   | Instance Type | `Free` |

4. 部署完成后访问 `https://<本服务名>.onrender.com/`，页面顶部应显示"后端已连接"。

> 也可以部署到 GitHub Pages / Netlify（纯静态），但必须在页面里注入
> `window.CALCULATOR_API_BASE` 指向后端 HTTPS 地址，且后端需允许跨域。

## 8. 键盘快捷键

| 按键 | 作用 |
| --- | --- |
| 数字与 `+ - * / ( ) .` | 直接输入到表达式框 |
| `Enter` | 提交后端计算 |
| `Esc` | 清空表达式 |

## 9. 目录结构

```
832402229_calculator_frontend/
├── index.html        # 页面结构（计算器 + 历史面板）
├── styles.css        # 样式与深浅色主题
├── app.js            # 交互逻辑：所有请求都发给后端，不做任何计算
├── serve.py          # 静态服务 + /api 反向代理（含本地一键启动）
├── codestyle.md      # 代码规范（Google HTML/CSS + Airbnb JavaScript Style Guide）
└── README.md
```
