/**
 * 仓库建造者
 * 通过 /setblock 命令逐个建造箱子
 */
class WarehouseBuilder {
  constructor(bot) {
    this.bot = bot;

    // 标准仓库尺寸
    this.STANDARD_SIZE = {
      width: 2,
      length: 11,
      height: 4
    };

    // 引入Vec3
    this.Vec3 = require('vec3').Vec3;

    console.log('[WarehouseBuilder] Builder initialized');
  }

  /**
   * 建造完整仓库
   * @param {string} warehouseId - 仓库ID
   * @param {string} type - 仓库类型 (input/sorting/output)
   * @param {Object} position - 起始位置 {x, y, z}
   * @param {string} direction - 朝向
   */
  async buildWarehouse(warehouseId, type, position, direction = 'east') {
    const size = this.STANDARD_SIZE;

    console.log(`[WarehouseBuilder] 🏗️  Building warehouse: ${warehouseId}`);
    console.log(`[WarehouseBuilder] Type: ${type}`);
    console.log(`[WarehouseBuilder] Position: ${JSON.stringify(position)}`);
    console.log(`[WarehouseBuilder] Direction: ${direction}`);
    console.log(`[WarehouseBuilder] Size: ${size.width}x${size.length}x${size.height}`);

    // 传送到建造位置附近
    await this.tpToBuildPosition(position, direction);

    const chestPositions = [];
    const widthVec = this.getDirectionVector(
      direction === 'east' || direction === 'west' ? 'north' : 'east'
    );
    const lengthVec = this.getDirectionVector(direction);

    // 遍历每一层
    for (let y = 0; y < size.height; y++) {
      console.log(`[WarehouseBuilder] 🏗️  Building layer ${y + 1}/${size.height}...`);

      // 遍历宽度方向
      for (let w = 0; w < size.width; w++) {
        // 遍历长度方向
        for (let l = 0; l < size.length; l++) {
          // 计算箱子位置
          const chestPos = {
            x: position.x + (lengthVec.x * l) + (widthVec.x * w),
            y: position.y + y,
            z: position.z + (lengthVec.z * l) + (widthVec.z * w)
          };

          // 发送 setblock 命令
          this.bot.chat(`/setblock ${chestPos.x} ${chestPos.y} ${chestPos.z} chest`);
          console.log(`[WarehouseBuilder] Placing chest #${chestPositions.length + 1} at ${chestPos.x}, ${chestPos.y}, ${chestPos.z}`);

          chestPositions.push({
            ...chestPos,
            direction,
            index: chestPositions.length
          });

          // 每层完成后打印进度
          if (chestPositions.length % 22 === 0) {
            console.log(`[WarehouseBuilder] ✅ ${chestPositions.length}/${size.width * size.length * size.height} chests placed`);
          }
        }
      }
    }

    console.log(`[WarehouseBuilder] ✅ Warehouse complete: ${chestPositions.length} chests`);

    return {
      id: warehouseId,
      type,
      location: position,
      direction,
      size: size,
      chestPositions: chestPositions,
      totalCapacity: chestPositions.length * 27,
      chestCount: chestPositions.length
    };
  }

  /**
   * 扫描现有仓库
   */
  async scanWarehouse(startPos, direction, size) {
    console.log(`[WarehouseBuilder] 🔍 Scanning warehouse at ${JSON.stringify(startPos)}...`);

    const chestPositions = [];
    const widthVec = this.getDirectionVector(
      direction === 'east' || direction === 'west' ? 'north' : 'east'
    );
    const lengthVec = this.getDirectionVector(direction);

    for (let y = 0; y < size.height; y++) {
      for (let w = 0; w < size.width; w++) {
        for (let l = 0; l < size.length; l++) {
          const checkPos = {
            x: startPos.x + (lengthVec.x * l) + (widthVec.x * w),
            y: startPos.y + y,
            z: startPos.z + (lengthVec.z * l) + (widthVec.z * w)
          };

          // 转换为Vec3对象
          const vec3Pos = new this.Vec3(checkPos.x, checkPos.y, checkPos.z);
          const block = this.bot.blockAt(vec3Pos);

          if (block && block.name === 'chest') {
            chestPositions.push({
              ...checkPos,
              index: chestPositions.length
            });
          }
        }
      }
    }

    console.log(`[WarehouseBuilder] ✅ Scan complete: ${chestPositions.length}/${size.width * size.length * size.height} chests found`);

    return {
      chestPositions,
      totalCapacity: chestPositions.length * 27,
      chestCount: chestPositions.length
    };
  }

  /**
   * 获取方向向量
   */
  getDirectionVector(direction) {
    const vectors = {
      'north': { x: 0, z: -1 },
      'south': { x: 0, z: 1 },
      'east': { x: 1, z: 0 },
      'west': { x: -1, z: 0 }
    };

    return vectors[direction] || vectors['east'];
  }

  /**
   * 传送到建造位置附近
   * 确保在 setblock 命令的有效范围内
   */
  async tpToBuildPosition(position, direction) {
    const offset = this.getDirectionVector(direction);
    const tpPos = {
      x: position.x + offset.x * 3,
      y: position.y + 2, // 稍微高一点，便于观察
      z: position.z + offset.z * 3
    };

    console.log(`[WarehouseBuilder] 🚀 Attempting teleport to: ${JSON.stringify(tpPos)}`);
    this.bot.chat(`/tp ${this.bot.username} ${tpPos.x} ${tpPos.y} ${tpPos.z}`);

    // 等待传送完成
    await this.sleep(2000);

    // 验证传送是否成功
    const actualPos = this.bot.entity.position;
    const dist = Math.sqrt(
      Math.pow(actualPos.x - tpPos.x, 2) +
      Math.pow(actualPos.y - tpPos.y, 2) +
      Math.pow(actualPos.z - tpPos.z, 2)
    );

    console.log(`[WarehouseBuilder] 📍 Current position: ${actualPos.x.toFixed(1)}, ${actualPos.y.toFixed(1)}, ${actualPos.z.toFixed(1)}`);
    console.log(`[WarehouseBuilder] 📏 Distance from target: ${dist.toFixed(1)} blocks`);

    if (dist > 5) {
      console.warn(`[WarehouseBuilder] ⚠️  Teleport failed! Bot may not have /tp permission`);
      console.warn(`[WarehouseBuilder] ⚠️  /setblock commands may fail due to distance!`);
      console.warn(`[WarehouseBuilder] 💡 Consider giving bot OP status or teleporting it manually`);
    } else {
      console.log(`[WarehouseBuilder] ✅ Teleport successful!`);
    }
  }

  /**
   * 延迟函数
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = { WarehouseBuilder };
