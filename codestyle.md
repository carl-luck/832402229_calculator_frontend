# 前端代码规范

本规范以 [Google JavaScript Style Guide](https://google.github.io/styleguide/jsguide.html)、[MDN HTML guidelines](https://developer.mozilla.org/en-US/docs/MDN/Writing_guidelines/Howto/HTML_include) 和 [MDN CSS guidelines](https://developer.mozilla.org/en-US/docs/Learn/CSS/Building_blocks/Organizing) 为依据，结合本次原生 Web 项目规模作了简化。

## JavaScript

- 使用 2 个空格缩进，使用分号，字符串优先使用双引号。
- 使用 `const` 和 `let`，禁止 `var`；变量和函数使用 `camelCase`。
- 通过 `async/await` 处理异步请求，统一经过 `request()` 检查 HTTP 状态和 API 错误。
- DOM 查询集中在 `elements` 对象中；事件优先使用事件委托，避免重复绑定。
- 用户输入只作为 API 的 `expression` 字段发送；禁止 `eval`、`Function` 和在前端计算表达式。
- 写入历史记录必须调用后端接口，不能使用 LocalStorage 或内存代替数据库。
- 将用户可见文本写入 `textContent`；动态 HTML 进入页面前必须经过 `escapeHtml()`。
- 函数保持单一职责，错误信息要能帮助用户判断是输入错误还是后端离线。

## HTML

- 使用语义化元素、正确的标题层级和唯一的 `id`。
- 所有表单控件应有 `label`、`aria-label` 或等效的可访问名称。
- 交互元素使用原生 `button` 和 `input`，键盘可完成主要流程。
- 不在 HTML 中写内联样式；脚本使用 `defer` 加载。

## CSS

- 使用根变量统一颜色、间距和主题，选择器保持简短。
- 页面采用移动端优先的响应式布局，断点只用于改变布局，不依赖固定屏幕尺寸。
- 颜色和动效服务于信息层级；避免影响阅读的装饰性动画。
- 保持 `:focus-visible` 状态，确保键盘导航有清晰反馈。

## 提交前检查

1. `python backend/server.py` 后访问 `http://localhost:8000/`。
2. 验证普通、复合、小数、括号、负数、无效表达式和除零输入。
3. 刷新页面确认历史仍来自后端；删除一条记录后再次刷新确认已删除。
4. 停止后端，确认页面展示离线状态且不会本地生成计算结果。
