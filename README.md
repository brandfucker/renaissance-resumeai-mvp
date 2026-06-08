# Renaissance AI MVP Demo

A组“AI简历优化助手”MVP 原型，用于功能演示和录屏。

## 功能

- 简历文本输入
- 目标岗位 JD 输入
- DeepSeek API 优化
- 剧本模式兜底演示
- 阶段动画
- 流式文字输出
- 匹配度评分
- 关键词命中
- 雷达图
- Before / After 对比
- 浏览器打印导出 PDF

## 启动

```bash
npm start
```

访问：

```text
http://localhost:3000
```

## DeepSeek 配置

创建 `.env.local`：

```env
DEEPSEEK_API_KEY=你的DeepSeek API Key
DEEPSEEK_MODEL=deepseek-v4-flash
PORT=3000
```

不配置 API Key 时，可以勾选“剧本模式”完成完整演示。

## 演示建议

1. 保持“剧本模式”开启。
2. 点击“填入样例”。
3. 点击“开始优化”。
4. 展示阶段动画、逐字输出、匹配度、雷达图和修改对比。
5. 点击“导出PDF”，在浏览器打印窗口选择“另存为 PDF”。

真实 API 模式建议在录屏前单独测试，避免现场受网络或额度影响。
