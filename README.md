# Guided Access Pomodoro

一个可直接放进网页或 PWA 的通用番茄钟组件。它配合 iPhone 自带的“引导式访问”，把设备暂时限制在当前 PWA：计时期间不能回桌面或切换到其他 App，但当前页面仍可正常操作。

> 这不是网页遮罩，也不是熄屏锁机。真正的单 App 限制由 iOS Guided Access 提供。

## 功能

- 真实 `endAt` 倒计时，Safari/PWA 切到后台后不会漂移
- 开始、暂停、继续、重来、跳过专注/休息
- 自定义专注与休息分钟数
- 本地保存任务、状态和每日完成数，不上传任何数据
- 开始专注时显示“连按三下侧边键”的单 App 锁定提示
- 内置 iPhone 引导式访问四步说明
- `prompt()` 输出 AI 助手可读的实时状态
- 单一中性基础样式，不包含任何产品皮肤或品牌素材
- 零依赖，原生 JavaScript

## 快速使用

```html
<div id="focus-pomodoro"></div>
<script src="./src/guided-access-pomodoro.js"></script>
<script>
  GuidedAccessPomodoro.mount('#focus-pomodoro');
</script>
```

让 AI 读取当前番茄状态：

```js
const realtimeContext = GuidedAccessPomodoro.prompt();
// 在发送消息时，将 realtimeContext 加入你的模型上下文。
```

## iPhone 单 App 锁定

第一次使用时：

1. 打开 iPhone“设置 → 辅助功能 → 引导式访问”。
2. 开启引导式访问并设置退出密码。
3. 从主屏幕图标打开你的 PWA。
4. 开始番茄后，连续按三下右侧电源键，选择“引导式访问”并点“开始”。

之后 Home 手势和 App 切换会被系统拦住。结束时再次连按三下侧边键并验证退出。

普通 Safari 中启用会锁住整个 Safari，而不是单独一个网站，因此推荐将网页添加到主屏幕并以独立 PWA 运行。

苹果官方说明：[Use Guided Access on iPhone or iPad](https://support.apple.com/111795)

## 隐私

组件只使用浏览器 `localStorage`。它不包含服务器地址、API Key、账户、聊天记录或遥测代码，也不会发起网络请求。

## License

[MIT](./LICENSE)
