/**
 * 仓库系统初始化脚本
 * 自动建造：1个输入仓库 + 9个分类仓库 + 1个输出仓库
 */

const mineflayer = require('mineflayer');
const { WarehouseManager } = require('../core/warehouseManager');
const { WarehouseBuilder } = require('../core/warehouseBuilder');
const fs = require('fs');
const path = require('path');

// ========================================
// 配置常量
// ========================================

// 仓库配置
const WAREHOUSE_CONFIG = {
  // 起始位置
  startX: -128,
  startY: 71,
  startZ: 89,

  // 仓库尺寸 (用于计算间距)
  warehouseLength: 11, // 仓库长度11格
  warehouseWidth: 2,   // 仓库宽度2格
  spacing: 1,          // 仓库间隔1格

  // 定义仓库 (垂直布局)
  warehouses: [
    // ========== 输入仓库 ==========
    { id: 'input_1', type: 'input', offsetX: 0, offsetZ: 1 },

    // ========== 分类区 (3列×3行，纵向排列) ==========
    // 第1列
    { id: 'sorting_wood', type: 'sorting', offsetX: 1, offsetZ: 0, category: 'wood' },
    { id: 'sorting_food', type: 'sorting', offsetX: 1, offsetZ: 1, category: 'food' },
    { id: 'sorting_plants', type: 'sorting', offsetX: 1, offsetZ: 2, category: 'plants' },

    // 第2列
    { id: 'sorting_stone', type: 'sorting', offsetX: 2, offsetZ: 0, category: 'stone' },
    { id: 'sorting_tools', type: 'sorting', offsetX: 2, offsetZ: 1, category: 'tools' },
    { id: 'sorting_misc', type: 'sorting', offsetX: 2, offsetZ: 2, category: 'misc' },

    // 第3列
    { id: 'sorting_ores', type: 'sorting', offsetX: 3, offsetZ: 0, category: 'ores' },
    { id: 'sorting_redstone', type: 'sorting', offsetX: 3, offsetZ: 1, category: 'redstone' },
    { id: 'sorting_rare', type: 'sorting', offsetX: 3, offsetZ: 2, category: 'rare' },

    // ========== 输出仓库 ==========
    { id: 'output_1', type: 'output', offsetX: 4, offsetZ: 1 }
  ]
};

// ========================================
// 主入口
// ========================================

/**
 * 主函数 - 程序入口
 */
async function main() {
  printBuildPlan();

  const bot = mineflayer.createBot({
    host: 'localhost',
    port: 25565,
    username: 'Bot_0'
  });

  setupBotEventHandlers(bot);
}

// ========================================
// Bot 事件处理
// ========================================

/**
 * 设置Bot事件处理器
 * @param {Object} bot - Mineflayer Bot实例
 */
function setupBotEventHandlers(bot) {
  bot.on('spawn', () => {
    console.log('✅ Bot 已连接到服务器');
    console.log(`   位置: ${bot.entity.position}\n`);
    startInitialization(bot);
  });

  bot.on('error', (err) => {
    console.error('❌ Bot 连接错误:', err);
  });

  bot.on('kicked', (reason) => {
    console.error('👢 Bot 被踢出服务器:', reason);
    process.exit(1);
  });

  bot.on('end', () => {
    console.log('\n🔌 Bot 连接断开');
    process.exit(0);
  });
}

// ========================================
// 仓库初始化流程
// ========================================

/**
 * 开始仓库系统初始化
 * @param {Object} bot - Mineflayer Bot实例
 */
async function startInitialization(bot) {
  const warehouseManager = new WarehouseManager();
  const warehouseBuilder = new WarehouseBuilder(bot);

  printInitializationStart();

  // 第一步：清理区域
  console.log('🧹 第一步：清理区域...\n');
  await clearArea(bot);

  // 第二步：建造所有仓库
  console.log('\n📦 第二步：建造仓库...\n');
  const { successCount, failCount } = await buildAllWarehouses(warehouseBuilder, warehouseManager);

  // 第三步：保存配置并打印总结
  saveWarehouseConfig(warehouseManager, successCount, failCount);

  // 延迟退出
  scheduleExit(bot);
}

/**
 * 打印初始化开始横幅
 */
function printInitializationStart() {
  console.log('='.repeat(80));
  console.log('🏗️  开始建造仓库系统...');
  console.log('='.repeat(80) + '\n');
}

// ========================================
// 仓库建造逻辑
// ========================================

/**
 * 建造所有仓库
 * @param {Object} warehouseBuilder - 仓库建造器实例
 * @param {Object} warehouseManager - 仓库管理器实例
 * @returns {Object} 建造统计 {successCount, failCount}
 */
async function buildAllWarehouses(warehouseBuilder, warehouseManager) {
  let successCount = 0;
  let failCount = 0;

  for (const whConfig of WAREHOUSE_CONFIG.warehouses) {
    const index = successCount + failCount + 1;
    const position = calculateWarehousePosition(whConfig);
    const direction = getWarehouseDirection(whConfig);

    console.log(`\n📦 [${index}/${WAREHOUSE_CONFIG.warehouses.length}] 建造 ${whConfig.id} (${whConfig.type})`);
    console.log(`   位置: ${position.x}, ${position.y}, ${position.z}`);

    try {
      const result = await warehouseBuilder.buildWarehouse(
        whConfig.id,
        whConfig.type,
        position,
        direction
      );

      registerWarehouse(warehouseManager, result, whConfig);

      console.log(`   ✅ 成功! ${result.chestCount} 个箱子, 容量 ${result.totalCapacity}`);
      successCount++;

      // 每个仓库之间暂停1秒
      await delay(1000);

    } catch (error) {
      console.error(`   ❌ 失败: ${error.message}`);
      failCount++;
    }
  }

  return { successCount, failCount };
}

/**
 * 计算仓库位置
 * @param {Object} whConfig - 仓库配置
 * @returns {Object} 位置 {x, y, z}
 */
function calculateWarehousePosition(whConfig) {
  const isSorting = whConfig.type === 'sorting';

  // 所有仓库在X轴上都占用2格（宽度方向）
  // 每个仓库之间间隔1格
  // X轴布局: [输入2格][1格间隔][第1列2格][1格间隔][第2列2格][1格间隔][第3列2格][1格间隔][输出2格]
  //         = 2+1+2+1+2+1+2+1+2 = 14格总长度
  //
  // X坐标计算 (每个仓库占2格+1格间隔，最后一个仓库不需要后续间隔):
  //   offsetX=0 (输入): startX + 0*3 = startX
  //   offsetX=1 (第1列): startX + 1*3 = startX + 3
  //   offsetX=2 (第2列): startX + 2*3 = startX + 6
  //   offsetX=3 (第3列): startX + 3*3 = startX + 9
  //   offsetX=4 (输出):   startX + 4*3 = startX + 12

  const x = WAREHOUSE_CONFIG.startX + (whConfig.offsetX * 3);

  const y = WAREHOUSE_CONFIG.startY;

  // Z轴布局逻辑:
  // - 分类仓库(朝南): 从position.z开始向南延伸11格, 所以中心在 position.z + 5
  // - 输入/输出仓库(朝北): 从position.z开始向北延伸11格, 所以中心在 position.z - 5
  //
  // 对齐要求: 输入/输出仓库的中心应该和第2行(offsetZ=1)分类仓库的中心对齐
  //   第2行分类仓库: 中心在 startZ + 12 + 5 = startZ + 17
  //   输入/输出仓库: 需要中心也在 startZ + 17, 所以起点应该是 startZ + 17 + 5 = startZ + 22
  //
  // 分类仓库Z坐标: startZ + offsetZ * 12
  // 输入/输出仓库Z坐标: startZ + 22 (固定)

  const z = isSorting
    ? WAREHOUSE_CONFIG.startZ + (whConfig.offsetZ * (WAREHOUSE_CONFIG.warehouseLength + WAREHOUSE_CONFIG.spacing))
    : WAREHOUSE_CONFIG.startZ + WAREHOUSE_CONFIG.warehouseLength * 2;

  return { x, y, z };
}

/**
 * 获取仓库朝向
 * @param {Object} whConfig - 仓库配置
 * @returns {string} 朝向 ('south' | 'north')
 */
function getWarehouseDirection(whConfig) {
  // 分类仓库朝南，输入输出仓库朝北
  return whConfig.type === 'sorting' ? 'south' : 'north';
}

/**
 * 注册仓库到管理器
 * @param {Object} warehouseManager - 仓库管理器实例
 * @param {Object} result - 建造结果
 * @param {Object} whConfig - 仓库配置
 */
function registerWarehouse(warehouseManager, result, whConfig) {
  warehouseManager.createWarehouse({
    id: result.id,
    type: result.type,
    location: result.location,
    direction: result.direction,
    chestPositions: result.chestPositions,
    totalCapacity: result.totalCapacity,
    categories: whConfig.category ? { [whConfig.category]: { chestId: 'chest_1' } } : null
  });
}

// ========================================
// 配置保存与总结
// ========================================

/**
 * 保存仓库配置到文件
 * @param {Object} warehouseManager - 仓库管理器实例
 * @param {number} successCount - 成功数量
 * @param {number} failCount - 失败数量
 */
function saveWarehouseConfig(warehouseManager, successCount, failCount) {
  printBuildSummary(successCount, failCount);

  if (successCount > 0) {
    console.log('\n📋 已建造的仓库:');
    printWarehouseList(warehouseManager);

    console.log('\n💾 保存仓库配置...');
    const configPath = getWarehouseConfigPath();

    ensureConfigDirectoryExists(configPath);

    const warehouseData = prepareWarehouseData(warehouseManager);
    writeWarehouseConfig(configPath, warehouseData);

    console.log(`   ✅ 配置已保存到: ${configPath}`);
  }

  printCompletionMessage();
}

/**
 * 打印建造总结
 * @param {number} successCount - 成功数量
 * @param {number} failCount - 失败数量
 */
function printBuildSummary(successCount, failCount) {
  console.log('\n' + '='.repeat(80));
  console.log('📊 建造总结');
  console.log('='.repeat(80));
  console.log(`✅ 成功: ${successCount}/${WAREHOUSE_CONFIG.warehouses.length}`);
  console.log(`❌ 失败: ${failCount}/${WAREHOUSE_CONFIG.warehouses.length}`);
}

/**
 * 打印仓库列表
 * @param {Object} warehouseManager - 仓库管理器实例
 */
function printWarehouseList(warehouseManager) {
  const warehouses = warehouseManager.getAllWarehouses();
  for (const [id, wh] of Object.entries(warehouses)) {
    const pos = wh.location;
    const cap = wh.getTotalCapacity();
    console.log(`   ${id} (${wh.type}) - 位置: ${pos.x}, ${pos.y}, ${pos.z} - 容量: ${cap}`);
  }
}

/**
 * 获取仓库配置文件路径
 * @returns {string} 配置文件路径
 */
function getWarehouseConfigPath() {
  return path.join(__dirname, '..', 'config', 'warehouses.json');
}

/**
 * 确保配置目录存在
 * @param {string} configPath - 配置文件路径
 */
function ensureConfigDirectoryExists(configPath) {
  const configDir = path.dirname(configPath);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
}

/**
 * 准备仓库数据用于保存
 * @param {Object} warehouseManager - 仓库管理器实例
 * @returns {Object} 仓库数据
 */
function prepareWarehouseData(warehouseManager) {
  const warehouses = warehouseManager.getAllWarehouses();

  const warehouseData = {
    timestamp: new Date().toISOString(),
    startX: WAREHOUSE_CONFIG.startX,
    startY: WAREHOUSE_CONFIG.startY,
    startZ: WAREHOUSE_CONFIG.startZ,
    warehouses: {}
  };

  for (const [id, wh] of Object.entries(warehouses)) {
    warehouseData.warehouses[id] = {
      id: wh.id,
      type: wh.type,
      location: wh.location,
      direction: wh.direction,
      chestPositions: wh.chestPositions,
      totalCapacity: wh.totalCapacity,
      chestCount: wh.chestPositions.length,
      categories: wh.categories
    };
  }

  return warehouseData;
}

/**
 * 写入仓库配置文件
 * @param {string} configPath - 配置文件路径
 * @param {Object} warehouseData - 仓库数据
 */
function writeWarehouseConfig(configPath, warehouseData) {
  fs.writeFileSync(configPath, JSON.stringify(warehouseData, null, 2), 'utf-8');
}

/**
 * 打印完成消息
 */
function printCompletionMessage() {
  console.log('\n' + '='.repeat(80));
  console.log('🎉 仓库系统初始化完成!');
  console.log('='.repeat(80) + '\n');
}

// ========================================
// 区域清理逻辑
// ========================================

/**
 * 清理建造区域
 * @param {Object} bot - Mineflayer Bot实例
 */
async function clearArea(bot) {
  const area = calculateClearArea();

  printClearAreaInfo(area);

  await executeClearCommand(bot, area);

  console.log('✅ 清理完成!\n');
}

/**
 * 计算需要清理的区域
 * @returns {Object} 清理区域 {minX, maxX, minZ, maxZ, minY, maxY}
 */
function calculateClearArea() {
  // 计算清理区域需要覆盖所有仓库的实际占用空间
  //
  // X轴范围: 5个仓库，每个2格+1格间隔，最后一个不需要后续间隔
  //   总长度 = 5*2 + 4*1 = 14格
  //   startX = -128, endX = -128 + 14 = -114
  //
  // Z轴范围: 3行分类仓库，每行11格+1格间隔
  //   总长度 = 3*11 + 2*1 = 35格
  //   startZ = 89, endZ = 89 + 35 = 124

  const padding = 5; // 额外清理范围

  // X轴: -128-5 到 -128+14+5
  const minX = WAREHOUSE_CONFIG.startX - padding;
  const maxX = WAREHOUSE_CONFIG.startX + 14 + padding;

  // Z轴: 89-5 到 89+35+5
  const minZ = WAREHOUSE_CONFIG.startZ - padding;
  const maxZ = WAREHOUSE_CONFIG.startZ + 35 + padding;

  const minY = WAREHOUSE_CONFIG.startY;
  const maxY = WAREHOUSE_CONFIG.startY + 5;

  return { minX, maxX, minZ, maxZ, minY, maxY };
}

/**
 * 打印清理区域信息
 * @param {Object} area - 清理区域
 */
function printClearAreaInfo(area) {
  console.log(`📐 清理区域:`);
  console.log(`   X: ${area.minX} 到 ${area.maxX}`);
  console.log(`   Y: ${area.minY} 到 ${area.maxY}`);
  console.log(`   Z: ${area.minZ} 到 ${area.maxZ}`);
}

/**
 * 执行清理命令
 * @param {Object} bot - Mineflayer Bot实例
 * @param {Object} area - 清理区域
 */
async function executeClearCommand(bot, area) {
  const fillCmd = `/fill ${area.minX} ${area.minY} ${area.minZ} ${area.maxX} ${area.maxY} ${area.maxZ} air`;
  console.log(`\n🧹 执行清理命令: ${fillCmd}`);
  bot.chat(fillCmd);

  // 等待清理完成
  await delay(3000);
}

// ========================================
// 辅助函数
// ========================================

/**
 * 打印建造计划
 */
function printBuildPlan() {
  console.log('🏗️  仓库系统初始化\n');
  console.log('📋 建造计划:');
  console.log('   - 1 个输入仓库');
  console.log('   - 9 个分类仓库');
  console.log('   - 1 个输出仓库');
  console.log('   - 总计: 11 个仓库\n');
}

/**
 * 安排退出程序
 * @param {Object} bot - Mineflayer Bot实例
 */
function scheduleExit(bot) {
  setTimeout(() => {
    console.log('🔌 退出...');
    bot.quit();
  }, 10000);
}

/**
 * 延迟函数
 * @param {number} ms - 延迟毫秒数
 * @returns {Promise}
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ========================================
// 启动程序
// ========================================

main();
