# vocabulary-quiz - 需求拆解文档

## 产品概述

- **产品类型**: 交互式背单词工具
- **场景类型**: <scene_type>prototype-app</scene_type>
- **目标用户**: 质量工程部员工及行业英语学习者
- **核心价值**: 通过自测判红与发音辅助，高效记忆行业英语术语
- **界面语言**: zh-CN
- **主题偏好**: light (简洁清爽浅色背景)
- **导航模式**: 无导航 (单页工具应用)
- **导航布局**: 无

---

## 页面结构总览

> **说明**：本应用为单页工具，所有功能集成在同一页面内，无需路由跳转。

**页面文件**: `VocabularyQuizPage.tsx`

| 区域 | 说明 |
|-----|------|
| 顶部统计栏 | 展示总单词数、已测试数、正确率等核心指标 |
| 操作工具栏 | 包含搜索/筛选框、清空自测按钮、重置为默认按钮 |
| 单词表格区 | 核心交互区，含单词信息展示、发音播放、5列自测输入框及实时判色 |
| 新增单词表单 | 位于表格底部，支持输入新单词信息并追加到列表 |

---

## 页面布局建议

> **说明**：工具类单页应用，需平衡信息密度与操作便捷性。

- **布局模式**: 上下分区 + 响应式表格 —— 顶部固定统计与操作栏，中部自适应表格，底部新增表单
- **视觉重心**: 单词表格区 —— 用户大部分时间在查看单词和填写自测
- **结果承载区**: 自测输入框本身即为结果反馈载体（绿色/红色背景即时显示对错）；初始态为从 localStorage 或默认数据加载的完整表格；空数据时显示"暂无单词，请添加或重置"占位提示
- **响应式策略**: 桌面端表格横向滚动展示全部9列；移动端考虑卡片化布局或隐藏次要列（如例句），保留单词、发音、中文意思和当前聚焦的自测列

---

## 数据来源声明

| 数据/操作 | 来源类型 | 实现要求 | mock 兜底 |
|---|---|---|---|
| 初始单词数据 | real-file | 读取附件 word_data.json，解析后作为默认数据集初始化 state | 无 (必须从真实文件加载) |
| 单词列表持久化 | local-persist | localStorage key=`__global_vocab_words`，存取 IWordItem[] | 首次加载时从 real-file 获取 |
| 自测答案持久化 | local-persist | localStorage key=`__global_vocab_quiz_answers`，存取 Record<wordId, string[]> | 空对象 `{}` |
| 发音播放 | demo-mock | Web Speech API (`window.speechSynthesis`) 浏览器原生能力，非外部插件 | ✅ 本身就是浏览器API调用 |
| 添加新单词 | local-persist | 表单提交后 append 到 words 数组并写入 localStorage | 无 |
| 清空自测 | local-persist | 清除 quiz answers localStorage，保留 words 数据 | 无 |
| 重置为默认 | real-file + local-persist | 重新读取 word_data.json 覆盖 localStorage 中的 words 和 answers | 无 |

> **判定说明**：
> - 发音功能使用浏览器原生 Web Speech API，不属于 AI 插件范畴，归为 demo-mock（浏览器能力）
> - 初始数据明确要求从 word_data.json 文件读取，不可降级为硬编码 mock
> - 所有用户操作结果（自测、新增、清空）均需持久化到 localStorage

---

## 功能列表

- **页面/区块**: 顶部统计栏
  - **页面目标**: 让用户快速了解学习进度
  - **功能点**:
    - **展示统计指标**: 实时计算并显示总单词数、已测试单词数（至少填写过1个自测）、正确率（完全匹配数/已测试数），数值随自测输入实时更新

- **页面/区块**: 操作工具栏
  - **页面目标**: 提供搜索和管理操作入口
  - **功能点**:
    - **搜索筛选**: 输入框支持按单词或中文意思模糊匹配，输入即过滤表格行，区分大小写不敏感
    - **清空自测**: 点击弹出确认 Dialog → 确认后清除所有自测输入值（保留单词列表）→ toast 提示"已清空自测记录" → 表格自测列恢复空白且背景色重置
    - **重置为默认**: 点击弹出确认 Dialog → 确认后从 word_data.json 重新加载数据覆盖当前 words 和 answers → toast 提示"已恢复默认数据" → 表格刷新为初始94条

- **页面/区块**: 单词表格区
  - **页面目标**: 核心学习与自测交互
  - **功能点**:
    - **发音播放**: 点击单词文本或🔊图标 → 调用 `speechSynthesis.speak(utterance)` 朗读该单词 → 播放期间图标可加旋转/脉冲动画反馈
    - **自测输入与判色**: 5列自测输入框监听 `onChange` → 每次输入后 trim().toLowerCase() 与 word 字段比对 → 一致则单元格 `bg-green-100 border-green-400`，不一致且非空则 `bg-red-100 border-red-400`，空值时无背景色 → 同时将答案写入 quiz answers state 并同步 localStorage
    - **交替行样式**: 表格奇偶行使用不同背景色（如 `odd:bg-white even:bg-gray-50`），提升可读性
    - **响应式适配**: 桌面端 `<table>` 横向滚动；移动端转换为卡片列表，每张卡片展示单词+中文+发音按钮+当前自测输入框

- **页面/区块**: 新增单词表单
  - **页面目标**: 支持用户扩展词库
  - **功能点**:
    - **添加新单词**: 
      - 触发: 表格底部表单区域，含单词、发音、中文意思、例句4个输入框 + "添加"按钮
      - 交互: 填写后点击添加 → 校验单词字段非空 → 生成唯一 id → append 到 words 数组头部 → 写入 localStorage → toast.success('已添加') → 清空表单输入 → 表格自动滚动到新条目
      - 数据契约: IWordItem 必须含 `id: string; word: string; pronunciation: string; meaning: string; example: string;`

---

## 数据共享配置

| 存储键名 | 数据说明 | 使用页面 |
|---------|---------|---------|
| `__global_vocab_words` | 单词列表数据，类型为 `IWordItem[]` | VocabularyQuizPage |
| `__global_vocab_quiz_answers` | 自测答案记录，类型为 `Record<string, string[]>` (key=word.id, value=5次自测答案数组) | VocabularyQuizPage |

```ts
interface IWordItem {
  /** 唯一标识 */
  id: string;
  /** 英文单词（标准答案） */
  word: string;
  /** 发音标注（可选，用于显示而非TTS） */
  pronunciation: string;
  /** 中文意思 */
  meaning: string;
  /** 例句或备注 */
  example: string;
}

interface IQuizAnswers {
  [wordId: string]: string[]; // 长度最多5，对应5次自测
}

-------

<scene_type>prototype-app</scene_type>

# UI 设计指南

## 1. 设计推导依据

- **参考意图**: Free Direction —— 无高保真参考图，基于“行业英语+质量工程”语义自主定义视觉
- **核心情绪 / 应用类型**: 专注、精准、低认知负荷的制造业术语自测工具
- **独特记忆点**: 输入框即时变色反馈（绿/红）作为核心交互锚点，取代传统按钮提交

## 2. Art Direction

- **方向名**: 工业洁净秩序
- **Design Style**: Swiss Minimalist + Soft Utility —— 瑞士排版的清晰层级结合软化工具感，适配高密度表格与反复自测场景
- **DNA 参数**: rounded-md / shadow-sm / gap-4 / 无衬线中性字体 / 仅用语义色做状态表达
- **应用类型**: Tool —— 单页纵向流式布局，表格为主体，统计与操作区固定顶部

## 3. Color System

**色彩关系**: 冷灰白基底 + 深蓝主色 + 低饱和青绿/砖红反馈色，确保长时间自测不刺眼
**配色设计理由**: primary 取工程蓝图蓝，传递专业与信任；成功/错误色降低饱和度避免视觉疲劳；bg 偏冷白减少屏幕眩光
**主色推导**: 源自质量管理体系文档常用深蓝，兼顾可读性与行业识别度
**使用比例**: 65% 中性底色 / 25% 辅助灰与边框 / 10% primary 与语义色

| 角色 | CSS 变量 | Tailwind Class | HSL 值 | 设计说明 |
|---|---|---|---|---|
| bg | `--background` | `bg-background` | hsl(210 20% 98%) | 冷调页面背景，减少眩光 |
| card | `--card` | `bg-card` | hsl(0 0% 100%) | 表格容器与表单面板底色 |
| text | `--foreground` | `text-foreground` | hsl(215 25% 12%) | 高对比正文与标题 |
| textMuted | `--muted-foreground` | `text-muted-foreground` | hsl(215 15% 45%) | 例句、占位符、统计标签 |
| primary | `--primary` | `bg-primary` / `text-primary` | hsl(215 70% 42%) | 添加单词、重置等主行动按钮 |
| primaryForeground | `--primary-foreground` | `text-primary-foreground` | hsl(0 0% 100%) | primary 按钮文字 |
| accent | `--accent` | `bg-accent` | hsl(210 20% 94%) | 表格交替行、hover 浅底 |
| accentForeground | `--accent-foreground` | `text-accent-foreground` | hsl(215 25% 20%) | accent 上的次要文字 |
| border | `--border` | `border-border` | hsl(215 15% 88%) | 输入框与表格分隔线 |

**语义色提示**: 
- 成功（自测正确）: bg `hsl(150 45% 92%)` / border `hsl(150 40% 70%)` / text `hsl(150 50% 25%)`，色温偏冷绿，饱和度低于 primary
- 错误（自测错误）: bg `hsl(0 50% 94%)` / border `hsl(0 45% 75%)` / text `hsl(0 55% 30%)`，暖砖红，避免荧光感
- 两色均与 primary 保持 ±15% 饱和度对齐，防止状态色抢夺主行动注意力

## 4. 字体与节奏

- **font-display**: Noto Sans SC —— 中文释义清晰，字重稳定，适合表格密集阅读
- **font-body**: Inter —— 英文单词与输入内容等宽感强，字母辨识度高
- **字号**: H1 text-2xl；统计数字 text-xl font-semibold；body text-sm；muted text-xs
- **圆角**: 中（rounded-md）—— 输入框与按钮柔和但不失工具感

## 5. 全局布局契约

- **Reference Layout Use**: 按需求结构推导，无外部布局参考
- **Page / Section Order**: 统计栏 → 搜索/操作栏 → 单词表格 → 新增表单
- **Standard Content Zone**: max-w-6xl mx-auto，容纳10列表格且不压缩
- **Shell / Frame Alignment**: 内容容器与框架同宽，无侧边导航
- **Padding & Rhythm**: px-4 py-6 md:px-6 lg:px-8，垂直间距 gap-4
- **Full-bleed Zones**: 无全宽视觉区块，表格区域可横向溢出
- **Local Narrowing**: 新增表单区 max-w-3xl 居中，避免输入项过宽
- **Overflow Strategy**: 表格容器 overflow-x-auto，移动端保留完整列结构
- **Flexibility Boundary**: 允许移动端 padding 缩减至 px-3，禁止调整 max-w 或主色

## 6. 视觉与动效

- **装饰**: 无图标以外的装饰元素，仅靠色彩与间距建立层级
- **阴影/边界**: 轻阴影（shadow-sm）仅用于卡片浮起，表格无边框依赖交替色
- **动效**: 克制 —— 输入框变色 transition-colors duration-200；按钮 hover opacity-90；无入场动画

## 7. 组件原则

- 输入框 Default/Hover/Focus/Correct/Error 五态齐全，focus-visible ring-2 ring-primary/30
- Primary 按钮仅用于“添加单词”与“重置为默认”；“清空自测”用 Outline 样式
- 表格行 hover 用 accent 浅底，已测试行不因 hover 覆盖语义色
- 空状态与加载态沿用相同字体与间距，显示“暂无匹配单词”而非空白

## 8. Image Direction

- **Image Role**: 无强制图片需求
- **Image Art Direction**: 优先通过表格交替色、语义反馈色和排版节奏建立视觉记忆点
- **Image Prompt Keywords**: 无
- **Image Avoidance**: 避免添加与自测无关的插图、图标库通用喇叭图、教育类卡通素材

## 9. Anti-patterns

- **Feedback lag**: 输入后延迟变色或需点击确认；必须 input 事件实时比对并立即更新背景色
- **Table cramming**: 为适应小屏隐藏列或缩小字号；应保持横向滚动，维持10列完整性
- **Primary overload**: 将发音图标、搜索框、清除按钮都设为主色；仅核心数据操作使用 primary
- **Status shout**: 正确/错误背景色饱和度过高导致行间闪烁；务必使用低饱和语义色三态
- **Font mismatch**: 中英文混排时中文用衬线体或英文用装饰体；保持 Noto Sans SC + Inter 组合