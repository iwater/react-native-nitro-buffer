# Example App

这个 `example/` 是一个独立的 React Native CLI 宿主应用，用来验证 `react-native-nitro-buffer` 的真实原生行为。

它不会走根目录 Jest 里的 mock，而是直接加载本地 `portal:..` 依赖的库，并通过 Nitro Modules 调到原生实现。

## 用途

- 在 iOS / Android 真机或模拟器里验证真实 Buffer 行为
- 快速观察 Node.js Buffer 关键语义是否和当前原生实现一致
- 复现编码相关问题，例如 `ascii`、`base64url`、`utf16le`

## 首次安装

在 `example/` 目录执行：

先确认当前 shell 的 Node 版本不低于 20：

```bash
node -v
```

然后执行：

```bash
yarn install
bundle install
bundle exec pod install --project-directory=ios
```

## 运行

先启动 Metro：

```bash
yarn start
```

Android：

```bash
yarn android
```

iOS：

```bash
yarn ios
```

## Maestro E2E

这个 example 现在带了一条真实运行在 simulator / emulator 上的 Maestro smoke flow：

```bash
yarn test:e2e
```

这条 flow 会验证：

- app 能正常启动
- 首页 smoke cases 已经渲染
- 汇总状态为 `FAIL 0`
- 点击 `Run Again` 后仍然保持 `FAIL 0`

如果你同时开着多个 simulator / emulator，Maestro 可能会选错设备。此时请显式指定设备：

```bash
MAESTRO_DEVICE=<device-id> yarn test:e2e
```

设备 id 可以用下面的命令查看：

```bash
xcrun simctl list devices available
```

如果你不想走脚本，也可以直接执行原始 Maestro 命令：

```bash
maestro --device <device-id> test .maestro/smoke.yaml
```

注意：Maestro 只是负责操作已经安装好的 app，不会替你启动 Metro。跑 E2E 前，先确保：

```bash
yarn start --reset-cache
yarn ios
```

## 更新根库后的重新同步

`example/` 通过 `portal:..` 直连根目录库，所以改完根目录里的 TypeScript、C++、Android 或 Podspec 代码后，不需要重新打包库本身；但依赖变化仍然要重新安装：

```bash
yarn install
```

如果你改了原生依赖或 Podspec，iOS 还要再跑一次：

```bash
bundle exec pod install --project-directory=ios
```

## 页面内容

首页会直接执行一组 smoke cases，并展示每个 case 的：

- 预期值
- 实际值
- PASS / FAIL 状态

这些 case 重点覆盖：

- `utf8`
- `base64`
- `hex`
- `Buffer.from(TypedArray)`
- `Buffer.concat(totalLength)`
- `Buffer.copyBytesFrom`
- `Buffer.byteLength(DataView)`
- `lastIndexOf`
- `ascii`
- `base64url`
- `utf16le`

如果页面里出现 FAIL，说明当前真实原生实现和 Node.js Buffer 语义存在差异；这正是这个 example 的价值。
