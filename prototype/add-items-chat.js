/**
 * 使用 chat 命令给箱子添加物品（通过 NBT 数据）
 * 重构版本 - 使用可复用工具模块 + 命令行参数
 *
 * 使用方法:
 *   node add-items-chat.js [选项] <item> <count> <x> <y> <z> [...]
 *
 * 选项:
 *   --clear    添加前清空箱子（默认）
 *   --append   追加模式，不清空箱子（会覆盖现有槽位）
 *
 * 示例:
 *   node add-items-chat.js minecraft:diamond 1728 -128 71 111
 *   node add-items-chat.js --append minecraft:diamond 64 -128 71 111
 */

const mineflayer = require('mineflayer');
const {
  sleep,
  fillChestCompletely,
  setupBotHandlers
} = require('../utils/chest-utils');

async function main() {
  console.log('🧪 测试：使用 chat 命令给箱子添加真实物品\n');

  // 解析命令行参数
  const parsed = parseCommandLineArgs(process.argv.slice(2));

  if (!parsed.items || parsed.items.length === 0) {
    printUsage();
    process.exit(1);
  }

  const { clearFirst, items: itemsInChests } = parsed;

  console.log(`📦 准备给 ${itemsInChests.length} 个箱子添加物品...`);
  console.log(`   模式: ${clearFirst ? '清空后添加' : '追加模式（可能覆盖现有物品）'}\n`);

  const bot = mineflayer.createBot({
    host: 'localhost',
    port: 25565,
    username: 'Bot_0'
  });

  setupBotHandlers(bot, (bot) => onBotSpawn(bot, itemsInChests, clearFirst));
}

/**
 * 解析命令行参数
 * 格式: [选项] <item> <count> <x> <y> <z> [...]
 */
function parseCommandLineArgs(args) {
  const items = [];
  let clearFirst = true; // 默认清空

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    // 检查选项
    if (arg === '--clear') {
      clearFirst = true;
      i++;
      continue;
    }
    if (arg === '--append') {
      clearFirst = false;
      i++;
      continue;
    }

    // 解析物品参数（需要5个：item, count, x, y, z）
    if (i + 4 >= args.length) {
      console.warn(`⚠️  参数不完整，跳过: ${args.slice(i).join(' ')}`);
      break;
    }

    const item = args[i];
    const count = parseInt(args[i + 1]);
    const x = parseInt(args[i + 2]);
    const y = parseInt(args[i + 3]);
    const z = parseInt(args[i + 4]);

    if (isNaN(count) || isNaN(x) || isNaN(y) || isNaN(z)) {
      console.warn(`⚠️  参数格式错误，跳过: ${args.slice(i, i + 5).join(' ')}`);
      i += 5;
      continue;
    }

    items.push({ item, count, x, y, z });
    i += 5;
  }

  return { clearFirst, items };
}

/**
 * 打印使用说明
 */
function printUsage() {
  console.log('='.repeat(70));
  console.log('使用方法:');
  console.log('  node add-items-chat.js [选项] <item> <count> <x> <y> <z> [...]');
  console.log('');
  console.log('选项:');
  console.log('  --clear   添加前清空箱子（默认）');
  console.log('  --append  追加模式，不清空箱子');
  console.log('');
  console.log('参数说明:');
  console.log('  item      - 物品ID (例如: minecraft:oak_log)');
  console.log('  count     - 数量');
  console.log('  x, y, z   - 箱子坐标');
  console.log('');
  console.log('示例:');
  console.log('  # 清空后填满钻石（推荐）');
  console.log('  node add-items-chat.js minecraft:diamond 1728 -128 71 111');
  console.log('');
  console.log('  # 追加模式（可能覆盖现有物品）');
  console.log('  node add-items-chat.js --append minecraft:diamond 64 -128 71 111');
  console.log('');
  console.log('  # 添加多种物品到多个箱子');
  console.log('  node add-items-chat.js \\');
  console.log('    minecraft:oak_log 64 -128 71 111 \\');
  console.log('    minecraft:cobblestone 256 -128 71 109');
  console.log('='.repeat(70));
}

/**
 * Bot 生成后的主逻辑
 */
async function onBotSpawn(bot, itemsInChests, clearFirst) {
  console.log('✅ Bot 已连接\n');

  // 打印即将添加的物品清单
  console.log('📋 物品清单:');
  itemsInChests.forEach(({ item, count, x, y, z }, index) => {
    const itemName = item.split(':')[1];
    console.log(`  ${index + 1}. ${itemName} x${count} → (${x}, ${y}, ${z})`);
  });
  console.log('');

  // 执行批量添加
  const result = await batchAddItemsToChests(bot, itemsInChests, clearFirst);

  // 打印结果
  printResults(result, itemsInChests.length);

  // TP 到第一个箱子附近方便查看
  const firstChest = itemsInChests[0];
  if (firstChest) {
    bot.chat(`/tp ${firstChest.x} ${firstChest.y + 2} ${firstChest.z + 2}`);
  }

  // 等待后退出
  setTimeout(() => {
    console.log('🔌 退出...');
    bot.quit();
  }, 5000);
}

/**
 * 批量向多个箱子添加物品
 * @param {Object} bot - Bot 实例
 * @param {Array} itemsInChests - 物品配置数组
 * @param {boolean} clearFirst - 是否清空箱子
 * @returns {Object} {success: 成功数, failed: 失败数, details: 详情数组}
 */
async function batchAddItemsToChests(bot, itemsInChests, clearFirst) {
  const result = {
    success: 0,
    failed: 0,
    details: []
  };

  for (let i = 0; i < itemsInChests.length; i++) {
    const { item, count, x, y, z } = itemsInChests[i];
    const itemName = item.split(':')[1];

    console.log(`[${i + 1}/${itemsInChests.length}] ${itemName} x${count}`);
    console.log(`   位置: ${x}, ${y}, ${z}`);

    try {
      // 统一使用完全填充模式（/data modify append）
      const success = await fillChestCompletely(bot, x, y, z, [{ item, count }], clearFirst);

      if (success) {
        const slotsUsed = Math.ceil(count / 64);
        console.log(`   ✅ 已分配到 ${slotsUsed} 个槽位\n`);
        result.success++;
        result.details.push({ item, count, x, y, z, success: true });
      } else {
        console.log(`   ❌ 添加失败\n`);
        result.failed++;
        result.details.push({ item, count, x, y, z, success: false });
      }
    } catch (error) {
      console.log(`   ❌ 错误: ${error.message}\n`);
      result.failed++;
      result.details.push({ item, count, x, y, z, success: false, error: error.message });
    }
  }

  return result;
}

/**
 * 打印操作结果
 */
function printResults(result, total) {
  console.log('='.repeat(60));
  console.log('📊 操作完成统计');
  console.log('='.repeat(60));
  console.log(`总计: ${total} 个箱子`);
  console.log(`✅ 成功: ${result.success}`);
  console.log(`❌ 失败: ${result.failed}`);
  console.log('='.repeat(60));

  if (result.success > 0) {
    console.log('\n💡 物品应该已经在箱子中了！');
    console.log('   可以打开箱子检查\n');
  }

  if (result.failed > 0) {
    console.log('\n⚠️  部分箱子添加失败，请检查错误信息\n');
  }
}

// 启动程序
main();
