/**
 * 支持持久化的主测试脚本
 * 自动加载已保存的仓库配置
 */

const { RandomItemGenerator } = require('../simulation/randomItemGenerator');
const { InventoryStatistics } = require('../simulation/inventoryStatistics');
const { SuccessValidator } = require('../simulation/successValidator');
const { WarehouseManager } = require('../core/warehouseManager');
const { WarehouserBot } = require('../bots/warehouserBot');
const { WarehouseScheduler } = require('../ai/warehouseScheduler');
const { WarehouseBuilder } = require('../core/warehouseBuilder');
const { WarehouseCommands } = require('../commands/warehouseCommands');

const mineflayer = require('mineflayer');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('🚀 物流系统原型测试启动 (支持持久化)\n');

  const bot = mineflayer.createBot({
    host: 'localhost',
    port: 25565,
    username: 'Bot_0'
  });

  bot.on('spawn', () => {
    console.log('✅ Bot 已连接到服务器\n');
    startTest(bot);
  });

  bot.on('error', (err) => {
    console.error('❌ Bot 连接错误:', err);
  });

  bot.on('end', () => {
    console.log('🔌 Bot 连接断开');
    process.exit(0);
  });

  bot.on('kicked', (reason) => {
    console.log('👢 Bot 被踢出:', reason);
    process.exit(1);
  });
}

function startTest(bot) {
  // 初始化核心组件
  const warehouseManager = new WarehouseManager();
  const warehouseBuilder = new WarehouseBuilder(bot);
  const warehouseCommands = new WarehouseCommands(warehouseManager, warehouseBuilder);

  // 🔥 新增：加载已保存的仓库配置
  loadWarehouseConfig(warehouseManager);

  // 注册Chat命令
  warehouseCommands.registerCommands(bot);

  // 初始化模拟器
  const randomGenerator = new RandomItemGenerator(warehouseManager);
  const statistics = new InventoryStatistics(warehouseManager);
  const validator = new SuccessValidator(warehouseManager);

  // 创建仓库员 (执行器)
  const warehouser = new WarehouserBot(bot, warehouseManager);

  // 创建 AI 调度器 (智能决策层)
  const scheduler = new WarehouseScheduler(warehouseManager, warehouser);

  console.log('✅ 系统初始化完成\n');

  // 显示已加载的仓库
  const warehouses = warehouseManager.getAllWarehouses();
  const warehouseCount = Object.keys(warehouses).length;

  if (warehouseCount > 0) {
    console.log(`📦 已加载 ${warehouseCount} 个仓库:\n`);
    for (const [id, wh] of Object.entries(warehouses)) {
      const pos = wh.location;
      console.log(`   ${id} (${wh.type}) - 位置: ${pos.x}, ${pos.y}, ${pos.z}`);
    }
    console.log('\n📖 使用命令:');
    console.log('   !list        - 列出所有仓库');
    console.log('   !start       - 开始模拟\n');
  } else {
    console.log('⚠️  未找到已保存的仓库\n');
    console.log('📖 使用命令建造新仓库:');
    console.log('   !build input input_1 <x> <y> <z> east');
    console.log('   !build sorting sorting_1 <x> <y> <z> east');
    console.log('   !build output output_1 <x> <y> <z> east');
    console.log('   !list\n');
  }

  bot.chat('✅ 物流系统就绪! 使用 !help 查看命令');

  warehouseCommands.setOnStart(() => {
    startSimulation(bot, warehouseManager, randomGenerator, statistics, validator, scheduler);
  });
}

/**
 * 加载已保存的仓库配置
 */
function loadWarehouseConfig(warehouseManager) {
  const configPath = path.join(__dirname, '..', 'config', 'warehouses.json');

  try {
    if (!fs.existsSync(configPath)) {
      console.log('💾 配置文件不存在，将从空白状态开始\n');
      return;
    }

    const configData = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configData);

    console.log('💾 正在加载仓库配置...\n');

    let loadedCount = 0;

    for (const [whId, whConfig] of Object.entries(config.warehouses)) {
      try {
        warehouseManager.createWarehouse({
          id: whConfig.id,
          type: whConfig.type,
          location: whConfig.location,
          direction: whConfig.direction,
          chestPositions: whConfig.chestPositions,
          totalCapacity: whConfig.totalCapacity,
          categories: whConfig.categories
        });

        loadedCount++;
      } catch (error) {
        console.error(`   ⚠️  加载仓库 ${whId} 失败: ${error.message}`);
      }
    }

    console.log(`✅ 成功加载 ${loadedCount} 个仓库\n`);

  } catch (error) {
    console.error('❌ 加载配置失败:', error.message);
    console.log('💡 将从空白状态开始\n');
  }
}

function startSimulation(bot, warehouseManager, randomGenerator, statistics, validator, scheduler) {
  console.log('🎮 开始模拟...\n');
  bot.chat('🎮 模拟开始!');

  // 设置成功目标
  validator.setTarget('output_1', {
    'oak_planks': 192,
    'cobblestone': 256
  }, (warehouseId, result) => {
    console.log('\n' + '='.repeat(80));
    console.log('🎉 原型测试成功!');
    console.log('='.repeat(80));
    console.log(JSON.stringify(result.details, null, 2));
    console.log('='.repeat(80) + '\n');
    bot.chat('🎉 测试成功!');
    randomGenerator.stop();
  });

  // 启动物品生成
  randomGenerator.start();

  // 定期打印报告
  setInterval(() => {
    statistics.printReport();
    validator.printProgress('output_1');
  }, 30000);

  // 使用调度器执行任务
  setInterval(async () => {
    // 任务1: 输入 → 分类
    await scheduler.transferInputToSorting('input_1', 'sorting_1', ['all']);

    // 任务2: 所有仓库 → 输出
    await scheduler.smartDispatchToOutput('output_1', {
      'oak_planks': 192,
      'cobblestone': 256
    });

    // 验证目标
    validator.validate('output_1');
  }, 15000);
}

// 启动测试
main();
