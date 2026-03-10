# Repository Guidelines

## 项目结构与模块划分

`src/` 是公开 TypeScript API 和 JS 层辅助逻辑；`cpp/`、`android/`、`ios/`、`nitrogen/` 承载 Nitro 原生实现与绑定生成。`__tests__/` 放根目录 Node 语义对齐测试，`__mocks__/react-native-nitro-modules.ts` 用于 Jest 隔离原生依赖。`lib/` 是构建产物，不要手改。`example/` 是独立的 React Native CLI 宿主应用，`example/src/` 放 smoke cases，`example/.maestro/` 放真机/模拟器冒烟流程。

## 构建、测试与开发命令

- `yarn build`：执行 `nitrogen && tsc`，更新生成绑定和 `lib/`。
- `yarn test`：运行根目录 Jest parity 测试。
- `cd example && yarn start --reset-cache`：启动 Metro，验证真实原生实现前先开这个。
- `cd example && yarn ios` / `yarn android`：运行示例宿主应用。
- `cd example && yarn test:e2e`：执行 Maestro smoke flow；多设备时用 `MAESTRO_DEVICE=<id> yarn test:e2e`。
- `cd example && yarn pods`：iOS 依赖或 Podspec 变化后重装 Pods。

## 代码风格与命名

仓库以 TypeScript ES Modules 为主，现有代码使用 4 空格缩进、单引号、无分号风格。导出类和类型用 `PascalCase`，内部辅助函数用 `camelCase`，测试文件命名保持 `*.test.ts` 或 `*.test.tsx`。优先做最小化改动；行为变更先补测试，再改实现。除非执行生成命令，否则不要直接编辑 `lib/` 或 `nitrogen/generated/`。

## 测试指南

根测试基于 Jest + `ts-jest`，新增行为应尽量与 `node:buffer` 做对照断言。兼容性测试放在 `__tests__/`，`it(...)` 描述应直接说明对齐的 Node 语义或回归场景。涉及原生路径、编码边界或端到端行为时，还应在 `example/` 中复现，并按需更新 Maestro smoke 流程。

## 提交与 PR 规范

现有提交历史混合使用祈使句标题和轻量 Conventional Commit，例如 `Fix Buffer.toString...`、`chore: bump version...`。沿用这个模式：标题简短、动词开头，只有版本或工具链改动再用 `chore:`。PR 需要说明行为变化、影响平台、已执行命令（如 `yarn test`、`yarn build`、必要时 `cd example && yarn test:e2e`）；仅在示例界面或 Maestro 流程变化时附截图或录屏。

## 配置与原生注意事项

`example/` 要求 Node 20+，仓库使用 Yarn 4 且 `.yarnrc.yml` 配置为 `node-modules` linker。原生相关改动通常需要同时检查 `cpp/`、`android/`、`ios/` 是否一致；依赖或 Podspec 变化后，记得重新执行 `bundle exec pod install --project-directory=ios`。
