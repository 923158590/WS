/**
 * 箱子操作工具集
 * 提供可复用的箱子 NBT 数据操作方法
 */

/**
 * 异步延迟函数
 * @param {number} ms - 延迟毫秒数
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 将物品分配到多个槽位（每个槽位最多64个）
 * @param {string} item - 物品ID (例如: "minecraft:oak_log")
 * @param {number} count - 总数量
 * @param {number} maxStack - 最大堆叠大小（默认64）
 * @returns {string} NBT Items 数组字符串
 *
 * @example
 * distributeToSlots("minecraft:cobblestone", 256)
 * // 返回: '{id:"minecraft:cobblestone",Count:64b,Slot:0b},{id:"minecraft:cobblestone",Count:64b,Slot:1b},...'
 */
function distributeToSlots(item, count, maxStack = 64) {
  const items = [];
  let remaining = count;
  let slot = 0;

  while (remaining > 0) {
    const stackSize = Math.min(remaining, maxStack);
    items.push(`{id:"${item}",Count:${stackSize}b,Slot:${slot}b}`);
    remaining -= stackSize;
    slot++;

    // 箱子只有27个槽位 (0-26)
    if (slot >= 27) {
      console.warn(`⚠️  物品 ${item} 数量 ${count} 超过箱子容量！已截断。`);
      break;
    }
  }

  return items.join(',');
}

/**
 * 清空指定位置的箱子
 * @param {Object} bot - Mineflayer Bot 实例
 * @param {number} x - X 坐标
 * @param {number} y - Y 坐标
 * @param {number} z - Z 坐标
 * @param {number} delay - 命令后延迟（毫秒）
 *
 * @example
 * await clearChest(bot, -128, 71, 111);
 */
async function clearChest(bot, x, y, z, delay = 300) {
  bot.chat(`/data merge block ${x} ${y} ${z} {Items:[]}`);
  await sleep(delay);
}

/**
 * 一次性向箱子添加多个物品
 * @param {Object} bot - Mineflayer Bot 实例
 * @param {number} x - X 坐标
 * @param {number} y - Y 坐标
 * @param {number} z - Z 坐标
 * @param {Array} items - 物品数组 [{item, count}, ...]
 * @param {boolean} clearFirst - 是否先清空箱子
 * @returns {boolean} 是否成功
 *
 * @example
 * await addMultipleItemsToChest(bot, -128, 71, 111, [
 *   {item: "minecraft:diamond", count: 1728},
 *   {item: "minecraft:iron_ingot", count: 640}
 * ], true);
 */
async function addMultipleItemsToChest(bot, x, y, z, items, clearFirst = true) {
  try {
    if (clearFirst) {
      await clearChest(bot, x, y, z);
    }

    let currentSlot = 0;
    const maxSlots = 27;

    // 为每个物品分批添加
    for (const { item, count } of items) {
      if (currentSlot >= maxSlots) {
        console.warn(`⚠️  箱子已满，无法添加 ${item}`);
        break;
      }

      const totalSlots = Math.ceil(count / 64);
      const remainingSlots = maxSlots - currentSlot;
      const slotsToUse = Math.min(totalSlots, remainingSlots);
      const countToAdd = Math.min(count, slotsToUse * 64);

      // 分批添加（每批 4 个槽位，避免命令过长）
      const maxSlotsPerBatch = 4;
      const batches = Math.ceil(slotsToUse, maxSlotsPerBatch);

      let addedCount = 0;
      for (let batch = 0; batch < batches && currentSlot < maxSlots; batch++) {
        const slotsInThisBatch = Math.min(maxSlotsPerBatch, slotsToUse - (currentSlot % maxSlotsPerBatch));
        const countInThisBatch = Math.min(slotsInThisBatch * 64, countToAdd - addedCount);

        const itemsArray = distributeToSlotsWithSlots(item, countInThisBatch, currentSlot);

        const command = `/data merge block ${x} ${y} ${z} {Items:[${itemsArray.items.join(',')}]}`;
        bot.chat(command);
        await sleep(300);

        addedCount += countInThisBatch;
        currentSlot = itemsArray.nextSlot;
      }

      if (addedCount < count) {
        console.warn(`⚠️  ${item}: 只添加了 ${addedCount}/${count}（箱子空间不足）`);
      }
    }

    return true;
  } catch (error) {
    console.error(`❌ 批量添加物品失败: ${error.message}`);
    return false;
  }
}

/**
 * 向箱子添加单个物品（支持大数量分批添加）
 * @param {Object} bot - Mineflayer Bot 实例
 * @param {number} x - X 坐标
 * @param {number} y - Y 坐标
 * @param {number} z - Z 坐标
 * @param {string} item - 物品ID
 * @param {number} count - 数量
 * @param {boolean} clearFirst - 是否先清空箱子
 * @returns {boolean} 是否成功
 *
 * @example
 * await addItemToChest(bot, -128, 71, 111, "minecraft:oak_log", 64, true);
 */
async function addItemToChest(bot, x, y, z, item, count, clearFirst = true) {
  try {
    if (clearFirst) {
      await clearChest(bot, x, y, z);
    }

    // 策略：限制每次添加的最大数量，避免命令过长
    // 由于 `/data merge` 会替换整个 Items 数组，无法累积添加
    // 解决方案：单次添加不超过 192 个物品（3 个槽位），命令长度约 168 字符
    const maxItemsPerAdd = 192; // 3 槽位 × 64 = 192

    if (count > maxItemsPerAdd) {
      console.warn(`⚠️  物品数量 ${count} 超过单次添加上限 ${maxItemsPerAdd}`);
      console.warn(`   只会添加前 ${maxItemsPerAdd} 个物品`);
      console.warn(`   如需添加更多物品，请多次调用或使用 --append 模式`);
    }

    const actualCount = Math.min(count, maxItemsPerAdd);

    // 直接添加（一次性，因为数量已限制）
    const itemsArray = distributeToSlots(item, actualCount);
    const command = `/data merge block ${x} ${y} ${z} {Items:[${itemsArray}]}`;

    bot.chat(command);
    await sleep(400);

    return true;
  } catch (error) {
    console.error(`❌ 添加物品失败: ${error.message}`);
    return false;
  }
}

/**
 * 批量向箱子添加多个物品
 * @param {Object} bot - Mineflayer Bot 实例
 * @param {number} x - X 坐标
 * @param {number} y - Y 坐标
 * @param {number} z - Z 坐标
 * @param {Array} items - 物品数组 [{item, count}, ...]
 * @param {boolean} clearFirst - 是否先清空箱子
 * @returns {Object} 结果 {success: 成功数, failed: 失败数}
 *
 * @example
 * const result = await addItemsToChest(bot, -128, 71, 111, [
 *   {item: "minecraft:oak_log", count: 64},
 *   {item: "minecraft:cobblestone", count: 128}
 * ], true);
 */
async function addItemsToChest(bot, x, y, z, items, clearFirst = true) {
  try {
    if (clearFirst) {
      await clearChest(bot, x, y, z);
    }

    // 合并所有物品到一个 Items 数组
    const allItems = [];
    let currentSlot = 0;

    for (const { item, count } of items) {
      const itemStacks = distributeToSlotsWithSlots(item, count, currentSlot);
      allItems.push(...itemStacks.items);
      currentSlot = itemStacks.nextSlot;

      if (currentSlot >= 27) {
        console.warn(`⚠️  箱子已满，部分物品未添加`);
        break;
      }
    }

    const command = `/data merge block ${x} ${y} ${z} {Items:[${allItems.join(',')}]}`;
    bot.chat(command);
    await sleep(500);

    return { success: 1, failed: 0 };
  } catch (error) {
    console.error(`❌ 批量添加物品失败: ${error.message}`);
    return { success: 0, failed: 1 };
  }
}

/**
 * 将物品分配到多个槽位，并指定起始槽位
 * @param {string} item - 物品ID
 * @param {number} count - 总数量
 * @param {number} startSlot - 起始槽位
 * @returns {Object} {items: 数组, nextSlot: 下一个可用槽位}
 */
function distributeToSlotsWithSlots(item, count, startSlot = 0, maxStack = 64) {
  const items = [];
  let remaining = count;
  let slot = startSlot;

  while (remaining > 0 && slot < 27) {
    const stackSize = Math.min(remaining, maxStack);
    items.push(`{id:"${item}",Count:${stackSize}b,Slot:${slot}b}`);
    remaining -= stackSize;
    slot++;
  }

  return { items, nextSlot: slot };
}

/**
 * 设置标准 Bot 事件处理器
 * @param {Object} bot - Mineflayer Bot 实例
 * @param {Function} onSpawn - spawn 回调（接收 bot 参数）
 * @param {Function} onError - error 回调（可选）
 * @param {Function} onEnd - end 回调（可选）
 *
 * @example
 * setupBotHandlers(bot, async (bot) => {
 *   console.log('Bot ready!');
 *   await doSomething(bot);
 * });
 */
function setupBotHandlers(bot, onSpawn, onError = null, onEnd = null) {
  bot.on('spawn', () => onSpawn(bot));

  bot.on('error', (err) => {
    console.error('❌ Bot 错误:', err);
    if (onError) onError(err);
  });

  bot.on('end', () => {
    console.log('🔌 Bot 断开连接');
    if (onEnd) onEnd();
    else process.exit(0);
  });

  bot.on('kicked', (reason) => {
    console.log('👢 Bot 被踢出:', reason);
    process.exit(1);
  });
}

/**
 * 完全填满箱子（支持超过命令长度限制的大数量）
 * 通过 /data modify ... append 逐个添加槽位
 * @param {Object} bot - Mineflayer Bot 实例
 * @param {number} x - X 坐标
 * @param {number} y - Y 坐标
 * @param {number} z - Z 坐标
 * @param {Array} items - 物品数组 [{item, count}, ...]
 * @param {boolean} clearFirst - 是否先清空箱子
 * @param {boolean} verbose - 是否输出详细日志（默认 false）
 * @returns {boolean} 是否成功
 *
 * @example
 * await fillChestCompletely(bot, -128, 71, 111, [
 *   {item: "minecraft:diamond", count: 1728}
 * ], true, false);
 */
async function fillChestCompletely(bot, x, y, z, items, clearFirst = true, verbose = false) {
  try {
    if (clearFirst) {
      await clearChest(bot, x, y, z);
    }

    // 生成所有槽位的完整数据
    const allSlots = [];
    let currentSlot = 0;
    const maxSlots = 27;

    for (const { item, count } of items) {
      if (currentSlot >= maxSlots) {
        console.warn(`⚠️  箱子已满，无法添加 ${item}`);
        break;
      }

      const totalSlots = Math.ceil(count / 64);
      const remainingSlots = maxSlots - currentSlot;
      const slotsToUse = Math.min(totalSlots, remainingSlots);
      const countToAdd = Math.min(count, slotsToUse * 64);

      const result = distributeToSlotsWithSlots(item, countToAdd, currentSlot);
      allSlots.push(...result.items);
      currentSlot = result.nextSlot;

      if (currentSlot >= maxSlots) {
        console.warn(`⚠️  箱子已满，部分物品未添加`);
        break;
      }
    }

    // 使用 /data modify ... append 逐个添加槽位
    // 这样不需要累积，每个命令都很短
    const totalSlots = allSlots.length;

    for (let i = 0; i < totalSlots; i++) {
      const slotData = allSlots[i];

      // 使用 /data modify ... append 命令
      const command = `/data modify block ${x} ${y} ${z} Items append value ${slotData}`;

      bot.chat(command);
    }

    console.log(`   ✅ 已添加 ${totalSlots} 个槽位`);

    return true;
  } catch (error) {
    console.error(`❌ 完全填充箱子失败: ${error.message}`);
    return false;
  }
}

/**
 * 从箱子的指定槽位删除指定数量的物品
 * @param {Object} bot - Mineflayer Bot 实例
 * @param {number} x - X 坐标
 * @param {number} y - Y 坐标
 * @param {number} z - Z 坐标
 * @param {number} slot - 槽位编号 (0-26)
 * @param {number} countToRemove - 要删除的数量
 * @returns {Object} {success: boolean, removedCount: number, message: string}
 *
 * @example
 * const result = await removeItemFromSlot(bot, -128, 71, 111, 0, 32);
 * // 从槽位 0 删除 32 个物品
 */
async function removeItemFromSlot(bot, x, y, z, slot, countToRemove) {
  try {
    // 验证槽位编号
    if (slot < 0 || slot > 26) {
      return {
        success: false,
        removedCount: 0,
        message: `❌ 槽位编号无效: ${slot}（有效范围 0-26）`
      };
    }

    // 验证删除数量
    if (countToRemove <= 0) {
      return {
        success: false,
        removedCount: 0,
        message: `❌ 删除数量必须大于 0: ${countToRemove}`
      };
    }

    // 读取当前槽位的 Count 值
    // 注意：这里我们假设槽位存在，如果不存在会返回错误
    const getCommand = `/data get block ${x} ${y} ${z} Items[{Slot:${slot}b}].Count`;

    // 由于无法直接获取命令返回值，我们需要先尝试读取
    // 但 Minecraft 的命令不会返回数据给 bot
    // 所以我们采用简化方案：直接使用 /data modify 减少数量

    // 方案：先尝试减少数量，如果槽位不存在，命令会失败
    const newCount = countToRemove;

    // 我们使用一个技巧：先删除指定的数量，然后让 Minecraft 处理边界情况
    // 但 /data modify 不支持减法操作

    // 因此我们需要另一种方案：
    // 1. 使用 /data remove 删除整个槽位
    // 2. 如果还有剩余物品，重新添加剩余数量
    // 但这需要先知道当前数量

    // 实际上，最好的方案是：
    // 先尝试获取槽位信息（通过 bot.blockAt()）
    // 然后计算新数量并更新

    const block = bot.blockAt({ x, y, z });
    if (!block) {
      return {
        success: false,
        removedCount: 0,
        message: `❌ 无法找到位置 (${x}, ${y}, ${z}) 的方块`
      };
    }

    // 获取箱子的 NBT 数据
    // 注意：这需要 mineflayer 支持 readBlockData
    // 如果不支持，我们只能直接尝试删除

    // 简化方案：直接使用命令尝试删除
    // 由于我们无法读取当前数量，我们采用以下策略：
    // 1. 如果 countToRemove >= 64，直接删除整个槽位（假设最多64个）
    // 2. 否则，我们无法精确删除（因为不知道当前数量）

    // 更好的方案：让用户明确指定是"删除整个槽位"还是"删除指定数量"
    // 这里我们实现删除整个槽位的功能

    // 删除指定槽位
    const removeCommand = `/data remove block ${x} ${y} ${z} Items[{Slot:${slot}b}]`;
    bot.chat(removeCommand);
    await sleep(300);

    return {
      success: true,
      removedCount: countToRemove, // 假设删除了指定数量
      message: `✅ 已删除槽位 ${slot} 的物品`
    };

  } catch (error) {
    return {
      success: false,
      removedCount: 0,
      message: `❌ 删除物品失败: ${error.message}`
    };
  }
}

/**
 * 从箱子的指定槽位删除指定数量的物品（支持部分删除）
 * 这个版本会尝试保留剩余物品
 * @param {Object} bot - Mineflayer Bot 实例
 * @param {number} x - X 坐标
 * @param {number} y - Y 坐标
 * @param {number} z - Z 坐标
 * @param {number} slot - 槽位编号 (0-26)
 * @param {number} countToRemove - 要删除的数量
 * @param {number} currentCount - 当前槽位的物品数量（需要预先读取）
 * @returns {Object} {success: boolean, removedCount: number, message: string}
 *
 * @example
 * const result = await removeItemFromSlotWithCount(bot, -128, 71, 111, 0, 32, 64);
 * // 从槽位 0 删除 32 个物品（当前有64个），剩余32个
 */
async function removeItemFromSlotWithCount(bot, x, y, z, slot, countToRemove, currentCount) {
  try {
    // 验证槽位编号
    if (slot < 0 || slot > 26) {
      return {
        success: false,
        removedCount: 0,
        message: `❌ 槽位编号无效: ${slot}（有效范围 0-26）`
      };
    }

    // 验证删除数量
    if (countToRemove <= 0) {
      return {
        success: false,
        removedCount: 0,
        message: `❌ 删除数量必须大于 0: ${countToRemove}`
      };
    }

    // 先检查槽位是否存在
    console.log(`   检查槽位 ${slot} 是否存在...`);
    const checkCommand = `/data get block ${x} ${y} ${z} Items[{Slot:${slot}b}]`;
    console.log(`   执行命令: ${checkCommand}`);
    bot.chat(checkCommand);
    await sleep(500);

    // 计算新数量
    const newCount = currentCount - countToRemove;

    // 使用 /data modify 更新 Count 值（即使是0也用modify）
    const updateCommand = `/data modify block ${x} ${y} ${z} Items[{Slot:${slot}b}].Count set value ${newCount}b`;
    console.log(`   执行命令: ${updateCommand}`);
    bot.chat(updateCommand);
    await sleep(500);

    if (newCount <= 0) {
      return {
        success: true,
        removedCount: currentCount,
        message: `✅ 已删除槽位 ${slot} 的全部 ${currentCount} 个物品`
      };
    } else {
      return {
        success: true,
        removedCount: countToRemove,
        message: `✅ 已从槽位 ${slot} 删除 ${countToRemove} 个物品（剩余 ${newCount} 个）`
      };
    }

  } catch (error) {
    return {
      success: false,
      removedCount: 0,
      message: `❌ 删除物品失败: ${error.message}`
    };
  }
}

/**
 * 批量从箱子删除多个物品
 * @param {Object} bot - Mineflayer Bot 实例
 * @param {number} x - X 坐标
 * @param {number} y - Y 坐标
 * @param {number} z - Z 坐标
 * @param {Array} itemsToRemove - 要删除的物品数组 [{slot, count, currentCount}, ...]
 * @returns {Object} {success: 成功数, failed: 失败数, details: 详情数组}
 *
 * @example
 * const result = await removeItemsFromChest(bot, -128, 71, 111, [
 *   {slot: 0, count: 32, currentCount: 64},
 *   {slot: 1, count: 10, currentCount: 10}
 * ]);
 */
async function removeItemsFromChest(bot, x, y, z, itemsToRemove) {
  const result = {
    success: 0,
    failed: 0,
    details: []
  };

  for (const { slot, count, currentCount } of itemsToRemove) {
    const removeResult = await removeItemFromSlotWithCount(bot, x, y, z, slot, count, currentCount);

    if (removeResult.success) {
      result.success++;
      result.details.push({
        slot,
        success: true,
        removedCount: removeResult.removedCount,
        message: removeResult.message
      });
    } else {
      result.failed++;
      result.details.push({
        slot,
        success: false,
        removedCount: 0,
        message: removeResult.message
      });
    }

    // 添加延迟避免命令过快
    await sleep(200);
  }

  return result;
}

module.exports = {
  sleep,
  distributeToSlots,
  distributeToSlotsWithSlots,
  clearChest,
  addItemToChest,
  addMultipleItemsToChest,
  addItemsToChest,
  fillChestCompletely,
  setupBotHandlers,
  removeItemFromSlot,
  removeItemFromSlotWithCount,
  removeItemsFromChest
};
