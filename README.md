# 物流系统最小原型

> **项目代号**: OpenClaw Logistics Prototype
> **版本**: v0.1-alpha
> **日期**: 2026-03-23
> **目标**: 验证仓库员核心功能

## 项目简介

这是一个基于 Mineflayer 的 Minecraft 物流系统原型，用于验证仓库员的物品搬运和调度功能。

### 核心特性

- ✅ **仓库建造**: 使用 `setblock` 命令快速建造 2×11×4 标准仓库
- ✅ **AI 调度**: 智能调度系统自动决策物品搬运
- ✅ **仓库员执行**: 纯执行器模式，只负责移动、取物、放物
- ✅ **实时统计**: 库存追踪和进度报告
- ✅ **Chat 命令**: 游戏内命令快速搭建和管理

### 架构分层

```
AI 调度层 (Scheduler)
    ↓ 指令
仓库员执行层 (Warehouser)
    ↓ 动作
Minecraft 世界
```

## 安装

### 前置要求

- Node.js >= 16.0.0
- Minecraft 服务器 (本地或远程)
- 支持 `/setblock` 和 `/tp` 命令

### 安装依赖

```bash
cd logistics-prototype
npm install
```

## 使用方法

### 1. 启动测试

```bash
npm start
```

### 2. 游戏内命令

连接到 Minecraft 服务器后，使用以下命令：

#### 建造仓库

```
!build input input_1 100 64 200 east
!build sorting sorting_1 110 64 200 east
!build output output_1 120 64 200 east
```

#### 管理仓库

```
!list          # 列出所有仓库
!start         # 开始模拟
!help          # 显示帮助
```

### 3. 仓库结构

标准仓库尺寸: **宽2 × 长11 × 高4** (88个箱子，总容量2376物品格)

```
侧面图:
████  ← 第4层
████  ← 第3层
████  ← 第2层
████  ← 第1层 (地面)

俯视图:
┌─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┐
│ │ │ │ │ │ │ │ │ │ │ │ ← 宽2格
├─┼─┼─┼─┼─┼─┼─┼─┼─┼─┼─┤
│ │ │ │ │ │ │ │ │ │ │ │
└─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┘
  ↑                   ↑
 起点                终点
  长11格
```

## 项目结构

```
logistics-prototype/
├── prototype/
│   └── test.js                    # 主测试脚本
├── simulation/
│   ├── randomItemGenerator.js     # 随机物品生成器
│   ├── inventoryStatistics.js     # 库存统计器
│   └── successValidator.js        # 成功验证器
├── bots/
│   └── warehouserBot.js           # 纯执行器 (移动、取、放)
├── ai/
│   └── warehouseScheduler.js      # AI调度器 (智能决策)
├── core/
│   ├── warehouseManager.js        # 仓库管理器
│   └── warehouseBuilder.js        # setblock 建造
├── commands/
│   └── warehouseCommands.js       # Chat命令
└── config/
    └── prototype-warehouses.json  # 仓库配置
```

## 工作流程

### 模拟流程

1. **输入仓库** → 随机物品生成
2. **分类仓库** → 自动分类存储
3. **输出仓库** → 物品调度
4. **仓库员** → 全局物品搬运
5. **清单统计** → 实时库存追踪

### 调度示例

```javascript
// AI 调度器自动决策并执行
await scheduler.transferInputToSorting('input_1', 'sorting_1', ['all']);
await scheduler.smartDispatchToOutput('output_1', {
  'oak_planks': 192,
  'cobblestone': 256
});
```

## 测试目标

验证输出仓库达到目标物品：
- oak_planks: 192
- cobblestone: 256

## 开发计划

- [x] 核心代码实现
- [x] 仓库建模与建造
- [x] AI 调度器
- [x] 架构重构（执行器/决策层分离）
- [ ] 真实 Minecraft 环境测试
- [ ] 路径优化算法
- [ ] 多仓库员协同

## 技术栈

- **Mineflayer**: Minecraft 机器人框架
- **Node.js**: 运行环境
- **mineflayer-pathfinder**: 路径规划插件

## 许可证

MIT

## 作者

Claude Code

---

**文档版本**: v0.3-alpha
**状态**: 架构重构完成
**最后更新**: 2026-03-23
