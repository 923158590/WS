/**
 * 清空仓库中的所有箱子
 * 使用 /data 命令快速清空
 *
 * 用法:
 *   node clear-warehouse.js <warehouseId>
 *
 * 示例:
 *   node clear-warehouse.js input_1
 *   node clear-warehouse.js sorting_wood
 */

const fs = require('fs');
const path = require('path');
const mineflayer = require('mineflayer');

const args = process.argv.slice(2);

if (args.length < 1) {
  console.log('❌ 参数不足');
  console.log('\n📖 用法:');
  console.log('   node clear-warehouse.js <warehouseId>');
  console.log('\n📖 示例:');
  console.log('   node clear-warehouse.js input_1');
  console.log('   node clear-warehouse.js sorting_wood\n');
  console.log('💡 提示: 使用 node inspect-warehouse.js 查看所有仓库');
  process.exit(1);
}

const warehouseId = args[0];

console.log('\n🗑️  仓库清空工具');
console.log('='.repeat(80));
console.log(`📍 仓库: ${warehouseId}`);
console.log('='.repeat(80) + '\n');

// 读取仓库配置
const configPath = path.join(__dirname, '..', 'config', 'warehouses.json');
let warehouseConfig;

try {
  const configData = fs.readFileSync(configPath, 'utf-8');
  warehouseConfig = JSON.parse(configData);
} catch (error) {
  console.error('❌ 无法加载仓库配置:', error.message);
  console.log('💡 请先运行 init-warehouses.js 初始化仓库');
  process.exit(1);
}

const warehouse = warehouseConfig.warehouses[warehouseId];

if (!warehouse) {
  console.error(`❌ 仓库不存在: ${warehouseId}`);
  console.log('\n💡 可用的仓库:');
  for (const id of Object.keys(warehouseConfig.warehouses)) {
    console.log(`   - ${id}`);
  }
  process.exit(1);
}

console.log(`📦 仓库信息:`);
console.log(`   位置: ${warehouse.location.x}, ${warehouse.location.y}, ${warehouse.location.z}`);
console.log(`   箱子数量: ${warehouse.chestCount}\n`);

let clearedCount = 0;
let failedCount = 0;

const bot = mineflayer.createBot({
  host: 'localhost',
  port: 25565,
  username: 'Bot_0'
});

bot.on('spawn', () => {
  console.log('✅ Bot 已连接\n');
  console.log(`🗑️  开始清空 ${warehouse.chestCount} 个箱子...\n`);

  // 清空所有箱子 - 使用 /data remove 删除所有Items
  for (let i = 0; i < warehouse.chestPositions.length; i++) {
    const chestPos = warehouse.chestPositions[i];

    // 每10个箱子显示进度
    if ((i + 1) % 10 === 0 || i === 0) {
      console.log(`进度: ${i + 1}/${warehouse.chestCount}`);
    }

    try {
      // 删除所有 Items 元素
      bot.chat(`/data remove block ${chestPos.x} ${chestPos.y} ${chestPos.z} Items[*]`);
      clearedCount++;
    } catch (error) {
      console.error(`❌ 清空箱子 ${i} 失败: ${error.message}`);
      failedCount++;
    }
  }

  console.log(`\n✅ 清空完成！\n`);

  console.log('='.repeat(80));
  console.log('📊 清空统计');
  console.log('='.repeat(80));
  console.log(`总计: ${warehouse.chestCount} 个箱子`);
  console.log(`✅ 成功: ${clearedCount}`);
  console.log(`❌ 失败: ${failedCount}`);
  console.log('='.repeat(80) + '\n');

  // 退出
  setTimeout(() => {
    bot.quit();
  }, 2000);
});

bot.on('error', (err) => {
  console.error('❌ Bot 错误:', err);
  process.exit(1);
});

bot.on('end', () => {
  console.log('🔌 Bot 已断开连接');
  process.exit(0);
});
