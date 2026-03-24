/**
 * 从箱子中删除指定槽位的物品
 * 支持删除整个槽位或删除指定数量
 *
 * 用法:
 *   node remove-items.js <x> <y> <z> <slot> [count] [currentCount]
 *
 * 参数说明:
 *   x, y, z      - 箱子坐标
 *   slot         - 槽位编号 (0-26)
 *   count        - 要删除的数量（可选，默认删除整个槽位）
 *   currentCount - 当前槽位的物品数量（可选，如果提供则进行精确删除）
 *
 * 示例:
 *   # 删除槽位 0 的所有物品
 *   node remove-items.js -128 71 111 0
 *
 *   # 删除槽位 0 的 32 个物品（假设槽位有物品）
 *   node remove-items.js -128 71 111 0 32
 *
 *   # 精确删除：槽位 0 当前有 64 个，删除 32 个
 *   node remove-items.js -128 71 111 0 32 64
 */

const mineflayer = require('mineflayer');
const {
  removeItemFromSlot,
  removeItemFromSlotWithCount,
  setupBotHandlers
} = require('../utils/chest-utils');

async function main() {
  // 解析命令行参数
  const args = process.argv.slice(2);

  if (args.length < 4) {
    printUsage();
    process.exit(1);
  }

  const x = parseInt(args[0]);
  const y = parseInt(args[1]);
  const z = parseInt(args[2]);
  const slot = parseInt(args[3]);
  const count = args[4] ? parseInt(args[4]) : null;
  const currentCount = args[5] ? parseInt(args[5]) : null;

  // 验证坐标
  if (isNaN(x) || isNaN(y) || isNaN(z)) {
    console.error('Error: Invalid coordinates');
    process.exit(1);
  }

  // 验证槽位
  if (isNaN(slot) || slot < 0 || slot > 26) {
    console.error('Error: Invalid slot number (valid range: 0-26)');
    process.exit(1);
  }

  console.log('\n[Chest Item Removal Tool]');
  console.log('========================================');
  console.log(`Position: (${x}, ${y}, ${z})`);
  console.log(`Slot: ${slot}`);

  if (count && currentCount) {
    console.log(`Operation: Remove ${count} items (current: ${currentCount})`);
  } else if (count) {
    console.log(`Operation: Remove ${count} items (simplified mode)`);
  } else {
    console.log(`Operation: Remove entire slot`);
  }

  console.log('========================================\n');

  // 创建 Bot
  const bot = mineflayer.createBot({
    host: 'localhost',
    port: 25565,
    username: 'Bot_0'
  });

  // 设置事件处理器
  setupBotHandlers(bot, async (bot) => {
    console.log('[OK] Bot connected\n');
    console.log('[Processing] Removing items...\n');

    let result;

    if (count && currentCount) {
      // 精确删除模式
      result = await removeItemFromSlotWithCount(bot, x, y, z, slot, count, currentCount);
    } else if (count) {
      // 简化删除模式（删除整个槽位）
      console.log('[WARN] currentCount not provided, removing entire slot');
      console.log('[INFO] For precise removal: node remove-items.js <x> <y> <z> <slot> <count> <currentCount>\n');
      result = await removeItemFromSlot(bot, x, y, z, slot, count);
    } else {
      // 删除整个槽位
      result = await removeItemFromSlot(bot, x, y, z, slot, slot);
    }

    // 显示结果
    console.log(result.message);
    console.log('');

    if (result.success) {
      console.log(`[OK] Operation successful! Removed ${result.removedCount} items\n`);
    } else {
      console.log(`[FAIL] Operation failed\n`);
    }

    // 等待后退出
    setTimeout(() => {
      console.log('[QUIT] Exiting...');
      bot.quit();
    }, 2000);
  });
}

/**
 * 打印使用说明
 */
function printUsage() {
  console.log('========================================');
  console.log('Chest Item Removal Tool');
  console.log('========================================');
  console.log('');
  console.log('Usage:');
  console.log('   node remove-items.js <x> <y> <z> <slot> [count] [currentCount]');
  console.log('');
  console.log('Parameters:');
  console.log('   x, y, z      - Chest coordinates');
  console.log('   slot         - Slot number (0-26)');
  console.log('   count        - Number of items to remove (optional, default: remove entire slot)');
  console.log('   currentCount - Current item count in slot (optional, for precise removal)');
  console.log('');
  console.log('Examples:');
  console.log('   # Remove all items from slot 0');
  console.log('   node remove-items.js -128 71 111 0');
  console.log('');
  console.log('   # Remove 32 items from slot 0 (simplified mode, removes entire slot)');
  console.log('   node remove-items.js -128 71 111 0 32');
  console.log('');
  console.log('   # Precise removal: slot 0 has 64 items, remove 32 (remaining: 32)');
  console.log('   node remove-items.js -128 71 111 0 32 64');
  console.log('');
  console.log('   # Precise removal: slot 0 has 10 items, remove 32 (removes all 10)');
  console.log('   node remove-items.js -128 71 111 0 32 10');
  console.log('');
  console.log('Tips:');
  console.log('   - Use /data get block <x> <y> <z> Items to view all slots');
  console.log('   - Use /data get block <x> <y> <z> Items[{Slot:0b}] to view specific slot');
  console.log('   - Valid slot range: 0-26');
  console.log('========================================');
}

// 启动程序
main();
