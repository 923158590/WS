/**
 * 仓库查看工具
 * 查看指定仓库的物品和仓库概览
 */

const mineflayer = require('mineflayer');
const fs = require('fs');
const path = require('path');

// 存储扫描结果
let chestData = [];
let scanIndex = 0;

async function main() {
  const args = process.argv.slice(2);
  const warehouseId = args[0]; // 传入仓库ID，如 'output_1'

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

  const bot = mineflayer.createBot({
    host: 'localhost',
    port: 25565,
    username: 'Bot_0'
  });

  bot.on('spawn', async () => {
    console.log('✅ Bot 已连接\n');

    // 监听游戏消息
    bot.on('message', (msg) => {
      const messageText = msg.toString();

      // 解析箱子数据 - 格式: "-128, 71, 111 has the following block data: {x: -128, y: 71, Items: [...], z: 111, ...}"
      if (messageText.includes('has the following block data')) {
        try {
          // 提取坐标：格式为 "x, y, z has the following"
          const coordMatch = messageText.match(/(-?\d+),\s*(-?\d+),\s*(-?\d+)\s+has the following/);
          if (coordMatch) {
            // 尝试解析 Items
            let items = [];
            // 查找 Items: 后面的数组
            const itemsSearch = messageText.match(/Items:\s*\[(.*?)\]/);
            if (itemsSearch) {
              items = parseItems('[' + itemsSearch[1] + ']');
            }

            chestData.push({
              x: parseInt(coordMatch[1]),
              y: parseInt(coordMatch[2]),
              z: parseInt(coordMatch[3]),
              items: items
            });
          }
        } catch (e) {
          // 忽略解析错误
        }
      }
    });

    if (warehouseId) {
      // 查看指定仓库
      await inspectWarehouse(warehouseConfig, warehouseId, bot);
    } else {
      // 显示仓库概览
      await showWarehouseOverview(warehouseConfig, bot);
    }

    // 快速退出
    setTimeout(() => {
      bot.quit();
    }, warehouseId ? 2000 : 1000); // 给数据到达一点时间
  });

  bot.on('error', (err) => {
    console.error('❌ 错误:', err);
  });

  bot.on('end', () => {
    console.log('\n🔌 断开连接');
    process.exit(0);
  });
}

/**
 * 解析物品数组
 */
function parseItems(itemsStr) {
  try {
    // 简单解析 Items: [{...}, {...}]
    const items = [];
    const itemMatches = itemsStr.match(/\{[^}]+\}/g) || [];

    for (const itemStr of itemMatches) {
      const idMatch = itemStr.match(/id:\s*"([^"]+)"/);
      const countMatch = itemStr.match(/Count:\s*(\d+)b/);

      if (idMatch && countMatch) {
        items.push({
          id: idMatch[1],
          count: parseInt(countMatch[1])
        });
      }
    }

    return items;
  } catch (e) {
    return [];
  }
}

/**
 * 显示所有仓库概览
 */
async function showWarehouseOverview(warehouseConfig, bot) {
  console.log('📊 仓库系统概览');
  console.log('='.repeat(80) + '\n');

  const warehouses = warehouseConfig.warehouses;
  const warehouseList = Object.entries(warehouses).sort((a, b) => a[0].localeCompare(b[0]));

  console.log(`📦 总仓库数: ${warehouseList.length}\n`);

  // 按类型分组
  const byType = {
    input: [],
    sorting: [],
    output: []
  };

  for (const [id, wh] of warehouseList) {
    byType[wh.type].push({ id, ...wh });
  }

  // 显示输入仓库
  if (byType.input.length > 0) {
    console.log('📥 输入仓库 (Input):');
    for (const wh of byType.input) {
      printWarehouseSummary(wh);
    }
    console.log('');
  }

  // 显示分类仓库
  if (byType.sorting.length > 0) {
    console.log('📦 分类仓库 (Sorting):');
    for (const wh of byType.sorting) {
      const category = wh.categories ? Object.keys(wh.categories)[0] || '无' : '无';
      console.log(`   ${wh.id.padEnd(20)} 位置: ${wh.location.x}, ${wh.location.y}, ${wh.location.z}  分类: ${category}`);
    }
    console.log('');
  }

  // 显示输出仓库
  if (byType.output.length > 0) {
    console.log('📤 输出仓库 (Output):');
    for (const wh of byType.output) {
      printWarehouseSummary(wh);
    }
    console.log('');
  }

  console.log('='.repeat(80));
  console.log('💡 使用命令查看具体仓库: node inspect-warehouse.js <仓库ID>');
  console.log('   例如: node inspect-warehouse.js output_1\n');
}

/**
 * 打印仓库摘要
 */
function printWarehouseSummary(wh) {
  console.log(`   ${wh.id.padEnd(20)} 位置: ${wh.location.x}, ${wh.location.y}, ${wh.location.z}  箱子: ${wh.chestCount}`);
}

/**
 * 查看指定仓库详情
 */
async function inspectWarehouse(warehouseConfig, warehouseId, bot) {
  const warehouse = warehouseConfig.warehouses[warehouseId];

  if (!warehouse) {
    console.error(`❌ 仓库不存在: ${warehouseId}`);
    console.log('💡 可用的仓库:');
    for (const id of Object.keys(warehouseConfig.warehouses)) {
      console.log(`   - ${id}`);
    }
    return;
  }

  console.log(`📦 仓库详情: ${warehouseId}`);
  console.log('='.repeat(80) + '\n');

  console.log(`📍 位置信息:`);
  console.log(`   坐标: ${warehouse.location.x}, ${warehouse.location.y}, ${warehouse.location.z}`);
  console.log(`   朝向: ${warehouse.direction}`);
  console.log(`   类型: ${warehouse.type}\n`);

  console.log(`📦 容量信息:`);
  console.log(`   箱子数量: ${warehouse.chestCount}`);
  console.log(`   总容量: ${warehouse.totalCapacity || '未知'}\n`);

  if (warehouse.categories) {
    console.log(`🏷️  分类信息:`);
    for (const [category, info] of Object.entries(warehouse.categories)) {
      console.log(`   ${category}: ${JSON.stringify(info)}`);
    }
    console.log('');
  }

  // 扫描所有箱子
  console.log(`🔍 扫描所有 ${warehouse.chestPositions.length} 个箱子...\n`);

  chestData = [];
  const totalChests = warehouse.chestPositions.length;

  for (let i = 0; i < totalChests; i++) {
    const chestPos = warehouse.chestPositions[i];

    // 每10个箱子显示进度
    if ((i + 1) % 10 === 0 || i === 0) {
      console.log(`进度: ${i + 1}/${totalChests}`);
    }

    try {
      bot.chat(`/data get block ${chestPos.x} ${chestPos.y} ${chestPos.z}`);
    } catch (error) {
      // 忽略错误
    }
  }

  console.log(`\n✅ 扫描完成！\n`);

  // 等待所有数据到达
  await sleep(500);

  // 统计库存
  const inventorySummary = new Map(); // itemId -> total count

  for (const chest of chestData) {
    for (const item of chest.items) {
      const current = inventorySummary.get(item.id) || 0;
      inventorySummary.set(item.id, current + item.count);
    }
  }

  // 显示统计结果
  console.log('📊 库存统计:');
  console.log('='.repeat(80));

  const filledChests = chestData.filter(c => c.items.length > 0).length;
  const emptyChests = totalChests - filledChests;

  console.log(`总箱子数: ${totalChests}`);
  console.log(`有物品: ${filledChests}`);
  console.log(`空的: ${emptyChests}`);
  console.log(`数据接收: ${chestData.length}\n`);

  if (inventorySummary.size > 0) {
    console.log(`物品列表 (${inventorySummary.size} 种):\n`);

    const sortedItems = Array.from(inventorySummary.entries())
      .sort((a, b) => b[1] - a[1]);

    for (const [itemId, count] of sortedItems) {
      const itemName = itemId.split(':')[1] || itemId;
      console.log(`   ${itemName.padEnd(25)} x${count}`);
    }
  } else {
    console.log('   仓库为空\n');
  }

  console.log('\n' + '='.repeat(80));
  console.log('💡 TP 到仓库: /tp ' +
    `${warehouse.location.x} ${warehouse.location.y + 2} ${warehouse.location.z}\n`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 启动程序
main();
