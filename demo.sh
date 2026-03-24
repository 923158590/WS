#!/bin/bash

# 物流系统原型 - 功能演示脚本
# 此脚本展示所有可用工具的使用方法

echo "🎮 物流系统原型 - 功能演示"
echo "=================================="
echo ""

# 1. 显示所有仓库概览
echo "📊 1. 查看所有仓库概览"
echo "命令: node prototype/inspect-warehouse.js"
echo "运行中..."
node prototype/inspect-warehouse.js 2>&1 | head -40
echo ""
read -p "按 Enter 继续..."
echo ""

# 2. 查看特定仓库详情
echo "📦 2. 查看 input_1 仓库详情"
echo "命令: node prototype/inspect-warehouse.js input_1"
echo "运行中..."
node prototype/inspect-warehouse.js input_1 2>&1 | tail -30
echo ""
read -p "按 Enter 继续..."
echo ""

# 3. 添加物品示例
echo "➕ 3. 添加物品示例"
echo "命令: node prototype/add-items-chat.js minecraft:diamond 64 -128 71 111"
echo "说明: 此命令会向 (-128, 71, 111) 位置的箱子添加 64 个钻石"
echo ""
read -p "要运行此命令吗? (y/n): " choice
if [ "$choice" = "y" ]; then
  node prototype/add-items-chat.js minecraft:diamond 64 -128 71 111
  echo "✅ 物品已添加"
else
  echo "⏭️  跳过"
fi
echo ""
read -p "按 Enter 继续..."
echo ""

# 4. 删除物品示例
echo "➖ 4. 删除物品示例"
echo "命令: node prototype/remove-items.js -128 71 111 minecraft:diamond 64"
echo "说明: 此命令会从 (-128, 71, 111) 位置的箱子删除 64 个钻石"
echo "注意: 使用 Bot 操作，需要移动到箱子位置"
echo ""
read -p "要运行此命令吗? (y/n): " choice2
if [ "$choice2" = "y" ]; then
  timeout 60 node prototype/remove-items.js -128 71 111 minecraft:diamond 64
  echo "✅ 物品已删除"
else
  echo "⏭️  跳过"
fi
echo ""
read -p "按 Enter 继续..."
echo ""

# 5. 测试系统示例
echo "🧪 5. 物流测试系统"
echo "命令: node prototype/test-persisted.js"
echo "说明: 启动完整的物流测试，包括随机物品生成和 AI 调度"
echo ""
echo "测试流程:"
echo "  1. 加载 11 个仓库"
echo "  2. 每 5 秒生成随机物品到 input_1"
echo "  3. AI 调度器尝试移动物品到 output_1"
echo "  4. 目标: 收集 192 oak_planks + 256 cobblestone"
echo ""
read -p "要启动测试系统吗? (y/n): " choice3
if [ "$choice3" = "y" ]; then
  echo "🚀 启动测试系统（在新窗口中运行）..."
  echo "提示: 运行后在新终端执行: node prototype/send-start-command.js"
  node prototype/test-persisted.js
else
  echo "⏭️  跳过"
fi
echo ""

# 6. 显示工具使用指南
echo "📖 6. 工具使用指南"
echo "完整文档: TOOLS_GUIDE.md"
echo ""
echo "常用命令:"
echo "  • 填充仓库:        node prototype/fill-input-warehouse.js"
echo "  • 添加物品:        node prototype/add-items-chat.js <item> <count> <x> <y> <z>"
echo "  • 删除物品:        node prototype/remove-items.js <x> <y> <z> <item> [count]"
echo "  • 清空仓库:        node prototype/clear-warehouse.js <warehouseId>"
echo "  • 查看仓库:        node prototype/inspect-warehouse.js [warehouseId]"
echo "  • 运行测试:        node prototype/test-persisted.js"
echo ""

echo "✨ 演示完成！"
echo ""
echo "💡 提示:"
echo "  - 查看 TOOLS_GUIDE.md 了解详细用法"
echo "  - 所有日志保存在 /tmp/ 目录"
echo "  - 使用 !start 命令在测试系统中开始模拟"
echo ""
