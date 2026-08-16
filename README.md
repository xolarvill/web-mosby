# Web Mosby

一个把网页当作设计稿来拆解的 Chrome 扩展。当前已支持颜色与字体识别，未来会逐步扩展为网页设计系统检查工具。

## 当前能力

- **颜色**：提取页面主配色，识别 `primary`、`background`、`text`、`surface` 等语义角色。
- **字体**：识别可见文本的字体族、字号、字重与使用占比。
- **导出**：支持 JSON、CSS Variables、Tailwind 色板、Agent 配色描述。

## 开发

```bash
npm test
```

在 Chrome 中加载：

1. 打开 `chrome://extensions`
2. 开启“开发者模式”
3. 选择“加载已解压的扩展程序”
4. 选择本项目目录

## 未来 TODO

- [ ] 提取间距系统与 8px 网格
- [ ] 识别圆角、边框、阴影和渐变
- [ ] 输出完整 Design Tokens
- [ ] 识别按钮、卡片、导航等常用组件样式
- [ ] 检测响应式断点
- [ ] 对比度与基础可访问性审计
- [ ] 导出 Style Guide / Figma Variables / Style Dictionary
- [ ] 接入 AI，生成设计审计与优化建议
