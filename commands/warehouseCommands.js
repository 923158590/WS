/**
 * 仓库建造命令
 * 通过Chat快速搭建仓库
 */
class WarehouseCommands {
  constructor(warehouseManager, warehouseBuilder) {
    this.warehouseManager = warehouseManager;
    this.builder = warehouseBuilder;
    this.onStartCallback = null;
  }

  /**
   * 注册所有命令
   */
  registerCommands(bot) {
    bot.on('chat', (username, message) => {
      const [command, ...args] = message.split(' ');

      switch (command) {
        case '!build':
          this.handleBuild(bot, args);
          break;

        case '!scan':
          this.handleScan(bot, args);
          break;

        case '!list':
          this.handleList(bot);
          break;

        case '!start':
          this.handleStart(bot);
          break;

        case '!help':
          this.handleHelp(bot);
          break;

        default:
          break;
      }
    });

    console.log('[WarehouseCommands] Chat commands registered');
  }

  /**
   * 建造仓库命令
   * 用法: !build <type> <id> <x> <y> <z> [direction]
   * 示例: !build input input_1 100 64 200 east
   */
  async handleBuild(bot, args) {
    if (args.length < 5) {
      bot.chat('❌ 用法: !build <type> <id> <x> <y> <z> [direction]');
      bot.chat('   类型: input, sorting, output');
      bot.chat('   方向: north, south, east, west (默认: east)');
      return;
    }

    const [type, id, x, y, z, direction = 'east'] = args;

    bot.chat(`🏗️  开始建造 ${type} 仓库: ${id}...`);
    bot.chat(`   位置: ${x}, ${y}, ${z}`);
    bot.chat(`   方向: ${direction}`);
    bot.chat(`   尺寸: 2×11×4 (88个箱子)`);

    try {
      // 通过 setblock 命令建造
      const metadata = await this.builder.buildWarehouse(
        id,
        type,
        { x: parseInt(x), y: parseInt(y), z: parseInt(z) },
        direction
      );

      // 在仓库管理器中注册
      this.warehouseManager.createWarehouse({
        id,
        type,
        location: metadata.location,
        direction,
        chestPositions: metadata.chestPositions,
        totalCapacity: metadata.totalCapacity
      });

      bot.chat(`✅ 仓库建造完成!`);
      bot.chat(`   箱子数量: ${metadata.chestCount}`);
      bot.chat(`   总容量: ${metadata.totalCapacity} 物品格`);

    } catch (error) {
      bot.chat(`❌ 建造失败: ${error.message}`);
    }
  }

  /**
   * 扫描仓库命令
   */
  async handleScan(bot, args) {
    if (args.length < 5) {
      bot.chat('❌ 用法: !scan <id> <x> <y> <z> <direction>');
      return;
    }

    const [id, x, y, z, direction] = args;

    bot.chat(`🔍 扫描仓库: ${id}...`);

    try {
      const result = await this.builder.scanWarehouse(
        { x: parseInt(x), y: parseInt(y), z: parseInt(z) },
        direction,
        this.builder.STANDARD_SIZE
      );

      if (result.chestPositions.length === 0) {
        bot.chat(`⚠️  未找到箱子结构`);
        return;
      }

      this.warehouseManager.createWarehouse({
        id,
        type: 'unknown',
        location: { x: parseInt(x), y: parseInt(y), z: parseInt(z) },
        direction,
        chestPositions: result.chestPositions,
        totalCapacity: result.totalCapacity
      });

      bot.chat(`✅ 扫描完成:`);
      bot.chat(`   箱子数量: ${result.chestCount}`);
      bot.chat(`   总容量: ${result.totalCapacity} 物品格`);

    } catch (error) {
      bot.chat(`❌ 扫描失败: ${error.message}`);
    }
  }

  /**
   * 列出所有仓库
   */
  handleList(bot) {
    const warehouses = this.warehouseManager.getAllWarehouses();
    const count = Object.keys(warehouses).length;

    bot.chat(`📋 仓库列表 (${count} 个):`);

    for (const [id, wh] of Object.entries(warehouses)) {
      const pos = wh.location;
      const inv = wh.getInventory();
      const itemCount = Object.values(inv).reduce((sum, qty) => sum + qty, 0);

      bot.chat(`   ${id} (${wh.type})`);
      bot.chat(`      位置: ${pos.x}, ${pos.y}, ${pos.z}`);
      bot.chat(`      物品: ${itemCount}/${wh.getTotalCapacity()}`);
    }
  }

  /**
   * 显示帮助
   */
  handleHelp(bot) {
    bot.chat('📖 仓库命令:');
    bot.chat('   !build <type> <id> <x> <y> <z> [direction]');
    bot.chat('   !scan <id> <x> <y> <z> <direction>');
    bot.chat('   !list');
    bot.chat('   !start');
    bot.chat('   !help');
  }

  /**
   * 启动模拟
   */
  handleStart(bot) {
    bot.chat('🚀 启动模拟...');
    if (this.onStartCallback) {
      this.onStartCallback();
    }
  }

  /**
   * 设置启动回调
   */
  setOnStart(callback) {
    this.onStartCallback = callback;
  }
}

module.exports = { WarehouseCommands };
