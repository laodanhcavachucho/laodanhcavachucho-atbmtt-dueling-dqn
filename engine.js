/**
 * ĐỘNG CƠ MÔ PHỎNG THỜI GIAN THỰC DUELING DQN & 9 KỊCH BẢN TẤN CÔNG ĐỐI KHÁNG (AI ATTACK)
 * Hỗ trợ tương tác thời gian thực (Real-time Reactive Simulation):
 * - Thay đổi tham số (Epsilon, Cường độ, Seed) phản hồi ngay lập tức (0ms delay).
 * - Cho phép người thuyết trình can thiệp trực tiếp gói tin của từng đơn hàng/kho hàng (Live Hacker Override)
 *   và xem điểm số Q(s,a), nhánh V(s), A(s,a), tuyến đường bản đồ và 8 chỉ số KPI biến đổi trực tiếp.
 */

class SeededRNG {
    constructor(seed = 2026) {
        this.seed = seed % 2147483647;
        if (this.seed <= 0) this.seed += 2147483646;
    }
    next() {
        this.seed = (this.seed * 16807) % 2147483647;
        return (this.seed - 1) / 2147483646;
    }
    nextInt(min, max) {
        return Math.floor(this.next() * (max - min + 1)) + min;
    }
    nextFloat(min, max) {
        return this.next() * (max - min) + min;
    }
}

class WarehouseEnvironmentEngine {
    constructor(config = {}) {
        this.numWarehouses = 50;
        this.numCustomers = 50;
        this.seed = config.seed || 2026;
        this.epsilonFGSM = config.epsilonFGSM !== undefined ? config.epsilonFGSM : 0.15;
        this.attackIntensity = config.attackIntensity !== undefined ? config.attackIntensity : 0.30;
        this.wScale = 0.05;
        this.bonusCompletion = 15.0;
        this.penaltyUnserved = 35.0;
        this.gamma = 0.95;

        // Lưu trữ các can thiệp thủ công trực tiếp của người thuyết trình (Live Interactive Overrides)
        // key: customerIdx -> { flipOpen: boolean, poisonCost: boolean, spoofCap: boolean, alterDemandFactor: number, resetLmax: boolean, targetWarehouseIdx: number }
        this.manualOverrides = config.manualOverrides || {};
        this.warehouseOverrides = config.warehouseOverrides || {};
        this.customerDemandOverrides = config.customerDemandOverrides || {};
        this.sandboxConfig = config.sandboxConfig || {};

        this.initBaseDataset();
    }

    initBaseDataset() {
        const rng = new SeededRNG(this.seed);
        this.warehouses = [];
        this.customers = [];
        this.costMatrix = [];

        // 5 kho chiến lược ở trung tâm chuỗi cung ứng (Kịch bản 5): W1, W10, W20, W30, W40
        const strategicIds = new Set([0, 9, 19, 29, 39]);
        // 6 kho đang đóng bảo trì (Kịch bản 1): W7, W15, W23, W31, W42, W48
        const closedSet = new Set([6, 14, 22, 30, 41, 47]);
        // 10 kho có sức chứa còn lại thấp (sắp đầy - Kịch bản 3): W3, W8, W12, W18, W25, W28, W34, W38, W44, W49
        const lowCapSet = new Set([2, 7, 11, 17, 24, 27, 33, 37, 43, 48]);

        const regions = ['Miền Bắc', 'Bắc Trung Bộ', 'Nam Trung Bộ', 'Đông Nam Bộ', 'Đồng Bằng Sông Cửu Long'];

        for (let i = 0; i < this.numWarehouses; i++) {
            const isStrategic = strategicIds.has(i);
            const isLowCap = lowCapSet.has(i);
            const x = isStrategic ? rng.nextFloat(40, 60) : rng.nextFloat(6, 94);
            const y = isStrategic ? rng.nextFloat(40, 60) : rng.nextFloat(6, 94);
            const isOpen = closedSet.has(i) ? 0 : 1;

            let capacity;
            if (isStrategic) {
                capacity = rng.nextInt(190, 240);
            } else if (isLowCap) {
                capacity = rng.nextInt(22, 36);
            } else {
                capacity = rng.nextInt(90, 155);
            }

            const lmax = isStrategic ? 3 : i % 4 === 0 ? 1 : 2;
            const region = isStrategic ? 'Trung Tâm Điều Phối Quốc Gia' : regions[i % regions.length];

            this.warehouses.push({
                id: i,
                code: `W${i + 1}`,
                name: isStrategic ? `Kho Hub Chiến Lược W${i + 1}` : `Kho Phân Phối W${i + 1}`,
                region,
                x,
                y,
                initialCapacity: capacity,
                openStatus: isOpen,
                lmax: lmax,
                isStrategic: isStrategic,
                isLowCap: isLowCap
            });
        }

        const customerTypes = ['Siêu thị Bán lẻ', 'Nhà máy Sản xuất', 'Đại lý Phân phối', 'Trung tâm Thương mại', 'Cửa hàng Chuỗi'];
        let totalDemand = 0;
        for (let j = 0; j < this.numCustomers; j++) {
            const x = rng.nextFloat(5, 95);
            const y = rng.nextFloat(5, 95);
            const demand = rng.nextInt(38, 64);
            totalDemand += demand;
            this.customers.push({
                id: j,
                code: `U${j + 1}`,
                name: `${customerTypes[j % customerTypes.length]} U${j + 1}`,
                x,
                y,
                initialDemand: demand
            });
        }
        this.totalInitialDemand = totalDemand;

        for (let i = 0; i < this.numWarehouses; i++) {
            const row = [];
            for (let j = 0; j < this.numCustomers; j++) {
                const dx = this.warehouses[i].x - this.customers[j].x;
                const dy = this.warehouses[i].y - this.customers[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const baseCost = Math.round(18 + dist * 1.15 + rng.nextFloat(-3, 5));
                const finalCost = this.warehouses[i].isStrategic
                    ? Math.max(15, Math.round(baseCost * 0.78))
                    : Math.max(18, baseCost);
                row.push(finalCost);
            }
            this.costMatrix.push(row);
        }

        // Áp dụng các cập nhật nghiệp vụ từ Admin (chỉnh sửa kho hàng) và Khách hàng (đặt đơn hàng mới) trên CSDL Supabase
        Object.entries(this.warehouseOverrides).forEach(([wIdxStr, ov]) => {
            const wIdx = Number(wIdxStr);
            if (this.warehouses[wIdx] && ov) {
                if (ov.initialCapacity !== undefined) this.warehouses[wIdx].initialCapacity = Number(ov.initialCapacity);
                if (ov.openStatus !== undefined) this.warehouses[wIdx].openStatus = Number(ov.openStatus);
                if (ov.lmax !== undefined) this.warehouses[wIdx].lmax = Number(ov.lmax);
            }
        });

        let updatedTotalDemand = 0;
        for (let j = 0; j < this.numCustomers; j++) {
            const cOv = this.customerDemandOverrides[j];
            if (cOv && cOv.initialDemand !== undefined) {
                this.customers[j].initialDemand = Number(cOv.initialDemand);
                this.customers[j].customCreatedBy = cOv.createdBy || 'Khách hàng đặt trực tuyến';
            }
            updatedTotalDemand += this.customers[j].initialDemand;
        }
        this.totalInitialDemand = updatedTotalDemand;
    }

    computeDuelingQValues(obsState, customerIdx, modelMode = 'M0', isPoisonedRewardModel = false) {
        const demand = obsState.demand[customerIdx];
        const openRatio = obsState.openStatus.reduce((acc, v) => acc + v, 0) / this.numWarehouses;
        const avgRemainingCap = obsState.capacity.reduce((acc, v) => acc + v, 0) / (this.numWarehouses * 130);

        const V_s = Number((12.2 * openRatio + 7.8 * avgRemainingCap - 0.05 * demand).toFixed(3));

        const rawAdvantages = [];
        for (let i = 0; i < this.numWarehouses; i++) {
            const cost = obsState.costMatrix[i][customerIdx];
            const cap = obsState.capacity[i];
            const open = obsState.openStatus[i];
            const load = obsState.servedCount[i];
            const lmax = this.warehouses[i].lmax;

            let score = 0;
            if (isPoisonedRewardModel) {
                score = +cost * this.wScale * 1.85 - (cap - demand) * 0.045 - (lmax - load) * 2.2;
                if (cap < demand) score += 3.2;
            } else {
                const capMargin = Math.min(2.2, Math.max(-3.0, (cap - demand) / Math.max(1, demand)));
                const slotMargin = (lmax - load) / lmax;
                score = -(cost * this.wScale * 2.35) + capMargin * 1.7 + slotMargin * 1.25;

                if (modelMode === 'M2') {
                    const geoDist = Math.hypot(
                        this.warehouses[i].x - this.customers[customerIdx].x,
                        this.warehouses[i].y - this.customers[customerIdx].y
                    );
                    const expectedCost = this.warehouses[i].isStrategic
                        ? Math.max(15, Math.round((18 + geoDist * 1.15) * 0.78))
                        : Math.round(18 + geoDist * 1.15);
                    const costDiff = Math.abs(cost - expectedCost) / Math.max(1, expectedCost);
                    if (costDiff > 0.28) {
                        score = -(expectedCost * this.wScale * 2.3) + capMargin * 1.55 + slotMargin * 1.2;
                    }
                    if (this.warehouses[i].isLowCap && cap > 80) {
                        score -= 4.5;
                    }
                }
            }

            if (open === 0 && !isPoisonedRewardModel) score -= 8.5;
            rawAdvantages.push(score);
        }

        const meanAdv = rawAdvantages.reduce((a, b) => a + b, 0) / this.numWarehouses;
        const advantages = rawAdvantages.map(a => Number((a - meanAdv).toFixed(3)));
        const qValues = advantages.map(adv => Number((V_s + adv).toFixed(3)));

        return {
            V_s,
            advantages,
            qValues
        };
    }

    buildObservedState(realState, scenarioId, customerIdx) {
        const obs = {
            capacity: [...realState.capacity],
            openStatus: [...realState.openStatus],
            costMatrix: realState.costMatrix.map(r => [...r]),
            demand: [...realState.demand],
            servedCount: [...realState.servedCount]
        };

        const intensity = this.attackIntensity;
        const eps = this.epsilonFGSM;
        // Hệ số khuếch đại trực quan theo thanh trượt epsilon & intensity để người dùng kéo slider thấy số nhảy ngay lập tức
        const scaleFactor = (eps / 0.15) * (intensity / 0.30);
        const activeMod = Math.max(1, Math.round(3 / Math.max(0.25, intensity / 0.30)));

        switch (Number(scenarioId)) {
            case 1: {
                for (let i = 0; i < this.numWarehouses; i++) {
                    if (realState.openStatus[i] === 0 && customerIdx % activeMod !== activeMod - 1) {
                        obs.openStatus[i] = 1;
                        const discount = Math.max(0.15, 0.56 - eps * 0.8 - (intensity - 0.3) * 0.4);
                        obs.costMatrix[i][customerIdx] = Math.max(10, Math.round(realState.costMatrix[i][customerIdx] * discount));
                    } else if (realState.openStatus[i] === 1 && i % Math.max(2, Math.round(7 - intensity * 8)) === 0) {
                        obs.openStatus[i] = 0;
                    }
                }
                break;
            }
            case 2: {
                const highThreshold = Math.max(55, Math.round(92 - intensity * 35));
                const lowThreshold = Math.min(75, Math.round(45 + intensity * 25));
                for (let i = 0; i < this.numWarehouses; i++) {
                    const realC = realState.costMatrix[i][customerIdx];
                    if (realC > highThreshold) {
                        obs.costMatrix[i][customerIdx] = Math.max(10, Math.round(realC * Math.max(0.12, 0.32 - eps * 0.5)));
                    } else if (realC < lowThreshold) {
                        obs.costMatrix[i][customerIdx] = Math.round(realC * (2.1 + intensity * 1.5 + eps * 2.0));
                    }
                }
                break;
            }
            case 3: {
                for (let i = 0; i < this.numWarehouses; i++) {
                    if (realState.openStatus[i] === 1 && realState.capacity[i] < realState.demand[customerIdx]) {
                        obs.capacity[i] = realState.demand[customerIdx] + Math.round(135 * (1 + eps + intensity));
                        const discount = Math.max(0.15, 0.52 - eps * 0.6 - intensity * 0.25);
                        obs.costMatrix[i][customerIdx] = Math.max(10, Math.round(realState.costMatrix[i][customerIdx] * discount));
                    }
                }
                break;
            }
            case 4: {
                if (customerIdx % 2 === 0) {
                    const dropRatio = Math.max(0.18, 0.55 - eps * 0.5 - (intensity - 0.3) * 0.4);
                    obs.demand[customerIdx] = Math.max(10, Math.round(realState.demand[customerIdx] * dropRatio));
                } else {
                    const surgeRatio = 1.45 + eps * 1.4 + intensity * 0.6;
                    obs.demand[customerIdx] = Math.round(realState.demand[customerIdx] * surgeRatio);
                }
                break;
            }
            case 5: {
                for (let i = 0; i < this.numWarehouses; i++) {
                    if (this.warehouses[i].isStrategic) {
                        if (customerIdx % 2 === 0) {
                            obs.capacity[i] = Math.round(220 * (1 + eps));
                            obs.costMatrix[i][customerIdx] = Math.max(9, Math.round(14 - eps * 15));
                        } else {
                            obs.openStatus[i] = 0;
                            obs.costMatrix[i][customerIdx] = Math.round(200 * (1 + intensity));
                        }
                    } else if (realState.costMatrix[i][customerIdx] < 52) {
                        obs.costMatrix[i][customerIdx] = Math.round(realState.costMatrix[i][customerIdx] * (1.6 + intensity + eps));
                    }
                }
                break;
            }
            case 6: {
                for (let i = 0; i < this.numWarehouses; i++) {
                    if (
                        realState.openStatus[i] === 1 &&
                        realState.capacity[i] >= realState.demand[customerIdx] &&
                        realState.servedCount[i] >= this.warehouses[i].lmax
                    ) {
                        obs.servedCount[i] = 0;
                        const discount = Math.max(0.14, 0.45 - eps * 0.5 - intensity * 0.2);
                        obs.costMatrix[i][customerIdx] = Math.max(10, Math.round(realState.costMatrix[i][customerIdx] * discount));
                    }
                }
                break;
            }
            case 7: {
                const windowLen = Math.max(5, Math.min(25, Math.round(10 * (intensity / 0.30))));
                const isAttackWindow = customerIdx >= 30 && customerIdx < 30 + windowLen;
                if (isAttackWindow) {
                    for (let i = 0; i < this.numWarehouses; i++) {
                        if (realState.openStatus[i] === 0) {
                            obs.openStatus[i] = 1;
                            obs.costMatrix[i][customerIdx] = Math.max(10, Math.round(15 - eps * 20));
                        }
                        if (realState.capacity[i] < realState.demand[customerIdx]) {
                            obs.capacity[i] = realState.demand[customerIdx] + Math.round(110 * scaleFactor);
                        }
                    }
                }
                break;
            }
            case 8: {
                const modStep = intensity >= 0.45 ? 1 : 2;
                for (let i = 0; i < this.numWarehouses; i++) {
                    const actuallyInvalid =
                        realState.openStatus[i] === 0 ||
                        realState.capacity[i] < realState.demand[customerIdx] ||
                        realState.servedCount[i] >= this.warehouses[i].lmax;
                    if (actuallyInvalid && i % modStep === 0) {
                        obs.openStatus[i] = 1;
                        obs.capacity[i] = realState.demand[customerIdx] + Math.round(120 * (1 + eps));
                        obs.servedCount[i] = 0;
                        obs.costMatrix[i][customerIdx] = Math.max(9, Math.round(realState.costMatrix[i][customerIdx] * Math.max(0.18, 0.52 - eps * 0.5)));
                    }
                }
                break;
            }
            case 9:
            default:
                break;
        }

        // Áp dụng cấu hình chi tiết theo từng Kịch bản từ Trang Thao Tác Tấn Công (/attack-sandbox)
        const sb = this.sandboxConfig;
        if (sb && Number(sb.activeScenario) === Number(scenarioId)) {
            const targetScope = sb.targetScope || 'all'; // 'all' hoặc mã đơn cụ thể '0'..'49'
            const isTargetOrder = targetScope === 'all' || Number(targetScope) === customerIdx;

            if (isTargetOrder) {
                if (Number(scenarioId) === 1 && sb.kb1) {
                    // Kịch bản 1: Danh sách các kho đang đóng bảo trì (W7, W15, W23, W31, W42, W48) được bật công tắc giả mạo từ 0 -> 1
                    const flippedMap = sb.kb1.flippedWarehouses || {};
                    const lureCost = Number(sb.kb1.lureCost || 12);
                    for (let i = 0; i < this.numWarehouses; i++) {
                        if (realState.openStatus[i] === 0) {
                            if (flippedMap[i]) {
                                obs.openStatus[i] = 1;
                                obs.costMatrix[i][customerIdx] = lureCost;
                            } else {
                                obs.openStatus[i] = 0;
                                obs.costMatrix[i][customerIdx] = realState.costMatrix[i][customerIdx];
                            }
                        }
                    }
                } else if (Number(scenarioId) === 2 && sb.kb2) {
                    // Kịch bản 2: Đảo giá cước kho xa và thổi giá cước kho gần
                    const farCost = Number(sb.kb2.farSpoofCost || 14);
                    const nearMult = Number(sb.kb2.nearMultiplier || 2.8);
                    for (let i = 0; i < this.numWarehouses; i++) {
                        const rc = realState.costMatrix[i][customerIdx];
                        if (rc >= 78) {
                            obs.costMatrix[i][customerIdx] = farCost;
                        } else if (rc <= 52) {
                            obs.costMatrix[i][customerIdx] = Math.round(rc * nearMult);
                        }
                    }
                } else if (Number(scenarioId) === 3 && sb.kb3) {
                    // Kịch bản 3: Bơm tồn kho ảo vào 10 kho sắp cạn
                    const addTons = Number(sb.kb3.virtualTons || 150);
                    const spoofMap = sb.kb3.spoofedLowCapWarehouses || {};
                    for (let i = 0; i < this.numWarehouses; i++) {
                        if (this.warehouses[i].isLowCap || realState.capacity[i] < realState.demand[customerIdx]) {
                            if (spoofMap[i] !== false) {
                                obs.capacity[i] = realState.capacity[i] + addTons;
                                obs.costMatrix[i][customerIdx] = Math.max(10, Math.round(realState.costMatrix[i][customerIdx] * 0.35));
                            } else {
                                obs.capacity[i] = realState.capacity[i];
                                obs.costMatrix[i][customerIdx] = realState.costMatrix[i][customerIdx];
                            }
                        }
                    }
                } else if (Number(scenarioId) === 4 && sb.kb4) {
                    // Kịch bản 4: Làm giả nhu cầu đơn hàng chẵn / lẻ
                    const evenFactor = Number(sb.kb4.evenFactor || 0.45);
                    const oddFactor = Number(sb.kb4.oddFactor || 1.85);
                    const factor = customerIdx % 2 === 0 ? evenFactor : oddFactor;
                    obs.demand[customerIdx] = Math.max(8, Math.round(realState.demand[customerIdx] * factor));
                } else if (Number(scenarioId) === 5 && sb.kb5) {
                    // Kịch bản 5: Điều khiển trạng thái giả mạo của 5 Kho Hub trung tâm (W1, W10, W20, W30, W40)
                    const hubModes = sb.kb5.hubModes || {};
                    for (const hIdx of [0, 9, 19, 29, 39]) {
                        const mode = hubModes[hIdx] || 'spoof_cap';
                        if (mode === 'spoof_cap') {
                            obs.openStatus[hIdx] = 1;
                            obs.capacity[hIdx] = 240;
                            obs.costMatrix[hIdx][customerIdx] = 11;
                        } else if (mode === 'fake_close') {
                            obs.openStatus[hIdx] = 0;
                            obs.costMatrix[hIdx][customerIdx] = 220;
                        } else if (mode === 'clean') {
                            obs.openStatus[hIdx] = realState.openStatus[hIdx];
                            obs.capacity[hIdx] = realState.capacity[hIdx];
                            obs.costMatrix[hIdx][customerIdx] = realState.costMatrix[hIdx][customerIdx];
                        }
                    }
                } else if (Number(scenarioId) === 6 && sb.kb6) {
                    // Kịch bản 6: Xóa bộ đếm giới hạn bến l_max
                    const resetEnabled = sb.kb6.resetQueue !== false;
                    const lureCost = Number(sb.kb6.lureCost || 12);
                    for (let i = 0; i < this.numWarehouses; i++) {
                        if (realState.servedCount[i] >= this.warehouses[i].lmax) {
                            if (resetEnabled) {
                                obs.servedCount[i] = 0;
                                obs.costMatrix[i][customerIdx] = lureCost;
                            } else {
                                obs.servedCount[i] = realState.servedCount[i];
                            }
                        }
                    }
                } else if (Number(scenarioId) === 7 && sb.kb7) {
                    // Kịch bản 7: Cửa sổ thời gian tấn công chớp nhoáng
                    const startOrder = Number(sb.kb7.startOrder || 31) - 1;
                    const endOrder = Number(sb.kb7.endOrder || 40) - 1;
                    const inCustomWindow = customerIdx >= startOrder && customerIdx <= endOrder;
                    if (!inCustomWindow) {
                        obs.openStatus = [...realState.openStatus];
                        obs.capacity = [...realState.capacity];
                        obs.costMatrix = realState.costMatrix.map(r => [...r]);
                    } else {
                        for (let i = 0; i < this.numWarehouses; i++) {
                            if (realState.openStatus[i] === 0) {
                                obs.openStatus[i] = 1;
                                obs.costMatrix[i][customerIdx] = 11;
                            }
                        }
                    }
                } else if (Number(scenarioId) === 8 && sb.kb8) {
                    // Kịch bản 8: Phối hợp 3 điều kiện vượt Action Masking
                    const bOpen = sb.kb8.bypassOpen !== false;
                    const bCap = sb.kb8.bypassCap !== false;
                    const bLmax = sb.kb8.bypassLmax !== false;
                    for (let i = 0; i < this.numWarehouses; i++) {
                        const actuallyInvalid =
                            realState.openStatus[i] === 0 ||
                            realState.capacity[i] < realState.demand[customerIdx] ||
                            realState.servedCount[i] >= this.warehouses[i].lmax;
                        if (actuallyInvalid) {
                            obs.openStatus[i] = bOpen ? 1 : realState.openStatus[i];
                            obs.capacity[i] = bCap ? realState.demand[customerIdx] + 130 : realState.capacity[i];
                            obs.servedCount[i] = bLmax ? 0 : realState.servedCount[i];
                            if (bOpen && bCap && bLmax) {
                                obs.costMatrix[i][customerIdx] = 11;
                            }
                        }
                    }
                }
            }
        }

        // Áp dụng các thao tác can thiệp trực tiếp của người thuyết trình (Live Interactive Override trên giao diện)
        const custom = this.manualOverrides[customerIdx];
        if (custom) {
            const targetW = custom.targetWarehouseIdx !== undefined ? custom.targetWarehouseIdx : 6; // Mặc định W7 nếu chưa chỉ định
            if (custom.flipOpen) {
                for (let i = 0; i < this.numWarehouses; i++) {
                    if (realState.openStatus[i] === 0 || i === targetW) {
                        obs.openStatus[i] = 1;
                        obs.costMatrix[i][customerIdx] = 11;
                    }
                }
            }
            if (custom.poisonCost) {
                for (let i = 0; i < this.numWarehouses; i++) {
                    if (realState.costMatrix[i][customerIdx] > 80) {
                        obs.costMatrix[i][customerIdx] = 12;
                    } else if (realState.costMatrix[i][customerIdx] < 50) {
                        obs.costMatrix[i][customerIdx] = 165;
                    }
                }
            }
            if (custom.spoofCap) {
                for (let i = 0; i < this.numWarehouses; i++) {
                    if (realState.capacity[i] < realState.demand[customerIdx]) {
                        obs.capacity[i] = realState.demand[customerIdx] + 180;
                        obs.openStatus[i] = 1;
                        obs.costMatrix[i][customerIdx] = 11;
                    }
                }
            }
            if (custom.alterDemandFactor) {
                obs.demand[customerIdx] = Math.max(8, Math.round(realState.demand[customerIdx] * custom.alterDemandFactor));
            }
            if (custom.resetLmax) {
                for (let i = 0; i < this.numWarehouses; i++) {
                    if (realState.servedCount[i] >= this.warehouses[i].lmax) {
                        obs.servedCount[i] = 0;
                        obs.openStatus[i] = 1;
                        obs.capacity[i] = Math.max(obs.capacity[i], realState.demand[customerIdx] + 80);
                        obs.costMatrix[i][customerIdx] = 10;
                    }
                }
            }
        }

        return obs;
    }

    getActionMask(stateToUse, customerIdx, demandToUse = null) {
        const mask = [];
        const d = demandToUse !== null ? demandToUse : stateToUse.demand[customerIdx];
        for (let i = 0; i < this.numWarehouses; i++) {
            const isOpen = stateToUse.openStatus[i] === 1;
            const hasCap = stateToUse.capacity[i] >= d;
            const hasSlot = stateToUse.servedCount[i] < this.warehouses[i].lmax;
            mask.push(isOpen && hasCap && hasSlot);
        }
        return mask;
    }

    buildStepExplainability({
        scenarioId,
        customer,
        realState,
        obsState,
        cleanDueling,
        attackDueling,
        realValidMask,
        obsMask,
        cleanBestAction,
        proposedAction,
        finalAction,
        isClosedViolation,
        isCapViolation,
        isLmaxViolation,
        realDemand,
        stepCost,
        bestRealCost,
        stepUnserved,
        status,
        modelMode
    }) {
        const whProposed = this.warehouses[proposedAction];
        const whClean = this.warehouses[cleanBestAction >= 0 ? cleanBestAction : 0];
        const whFinal = this.warehouses[finalAction];

        let packetTamperDetail = 'Gói tin trạng thái sạch (Không phát hiện can thiệp)';
        let tamperedField = 'Không có';
        let realValStr = '';
        let spoofedValStr = '';

        const j = customer.id;
        const pIdx = proposedAction;

        switch (Number(scenarioId)) {
            case 1:
                tamperedField = `OpenStatus[${whProposed.code}] & Cost[${whProposed.code}][${customer.code}]`;
                realValStr = `Open=${realState.openStatus[pIdx]} (${realState.openStatus[pIdx] === 1 ? 'Mở' : 'ĐANG ĐÓNG'}), Cước=${realState.costMatrix[pIdx][j]}`;
                spoofedValStr = `Open=${obsState.openStatus[pIdx]} (GIẢ MẠO MỞ), Cước=${obsState.costMatrix[pIdx][j]}`;
                packetTamperDetail = `Tin tặc lật bit OpenStatus của ${whProposed.code} từ ${realState.openStatus[pIdx]} → ${obsState.openStatus[pIdx]} và hạ cước ảo xuống ${obsState.costMatrix[pIdx][j]}`;
                break;
            case 2:
                tamperedField = `TransportCost[${whProposed.code}][${customer.code}]`;
                realValStr = `Cước thực ${whProposed.code}=${realState.costMatrix[pIdx][j]} (Kho tối ưu ${whClean.code}=${bestRealCost})`;
                spoofedValStr = `Cước giả ${whProposed.code}=${obsState.costMatrix[pIdx][j]} (Kho ${whClean.code} bị đẩy lên ${obsState.costMatrix[whClean.id][j]})`;
                packetTamperDetail = `Đảo ngược bảng giá cước TMS: Tuyến xa ${whProposed.code} (${realState.costMatrix[pIdx][j]} đv) bị sửa thành rẻ (${obsState.costMatrix[pIdx][j]} đv)`;
                break;
            case 3:
                tamperedField = `Capacity[${whProposed.code}]`;
                realValStr = `Tồn kho thực ${whProposed.code} = ${realState.capacity[pIdx]} tấn (Đơn hàng cần ${realDemand} tấn)`;
                spoofedValStr = `Tồn kho giả ${whProposed.code} = ${obsState.capacity[pIdx]} tấn (Bơm thêm +${obsState.capacity[pIdx] - realState.capacity[pIdx]} tấn ảo)`;
                packetTamperDetail = `Phóng đại tồn kho WMS tại ${whProposed.code} từ ${realState.capacity[pIdx]} lên ${obsState.capacity[pIdx]} tấn để dụ AI dồn đơn`;
                break;
            case 4:
                tamperedField = `Demand[${customer.code}]`;
                realValStr = `Nhu cầu đặt hàng thực tế D_real = ${realDemand} tấn`;
                spoofedValStr = `Nhu cầu giả mạo D_obs = ${obsState.demand[j]} tấn (Lệch ${obsState.demand[j] - realDemand >= 0 ? '+' : ''}${obsState.demand[j] - realDemand} tấn)`;
                packetTamperDetail = `Can thiệp cổng OMS làm đơn hàng của ${customer.code} biến động từ ${realDemand} tấn thành ${obsState.demand[j]} tấn`;
                break;
            case 5:
                tamperedField = `Hub Chiến Lược [W1, W10, W20, W30, W40]`;
                realValStr = `5 Kho Hub trung tâm bị nghẽn (Cap=30 tấn), cước chuẩn ${whProposed.code}=${realState.costMatrix[pIdx][j]}`;
                spoofedValStr = `Báo trạng thái & sức chứa giả trên 5 Hub trung tâm (Cap_obs=${obsState.capacity[pIdx]}, Open_obs=${obsState.openStatus[pIdx]})`;
                packetTamperDetail = `Tấn công có chủ đích vào 5 kho chiến lược trung tâm gây hiệu ứng domino lên 45 kho vệ tinh`;
                break;
            case 6:
                tamperedField = `ServedCount l_i[${whProposed.code}] (Ngưỡng l_max = ${whProposed.lmax})`;
                realValStr = `Số khách đang phục vụ l_real = ${realState.servedCount[pIdx]} / l_max = ${whProposed.lmax}`;
                spoofedValStr = `Bộ đếm giả mạo l_obs = ${obsState.servedCount[pIdx]} / l_max = ${whProposed.lmax}`;
                packetTamperDetail = `Reset bộ đếm lượt xe tại cửa xuất hàng ${whProposed.code} về 0 khiến AI điều vượt ngưỡng l_max`;
                break;
            case 7: {
                const inWindow = customer.id >= 30 && customer.id < 40;
                tamperedField = inWindow ? `Cửa sổ tấn công chớp nhoáng (Bước 61–80)` : `Ngoài khung giờ tấn công`;
                realValStr = `Open=${realState.openStatus[pIdx]}, Cap=${realState.capacity[pIdx]}, Cước=${realState.costMatrix[pIdx][j]}`;
                spoofedValStr = inWindow
                    ? `Nhiễu chớp nhoáng: Open=${obsState.openStatus[pIdx]}, Cap=${obsState.capacity[pIdx]}, Cước=${obsState.costMatrix[pIdx][j]}`
                    : `Dữ liệu bình thường (Không nhiễu)`;
                packetTamperDetail = inWindow
                    ? `[ĐANG PHÁT ĐỘNG TẤN CÔNG CHỚP NHOÁNG] Bơm nhiễu đồng loạt trong khung bước 61–80`
                    : `Hệ thống vận hành bình thường ngoài cửa sổ tấn công`;
                break;
            }
            case 8:
                tamperedField = `Tổ hợp Mask [OpenStatus + Capacity + l_i] tại ${whProposed.code}`;
                realValStr = `Thực tế: Open=${realState.openStatus[pIdx]}, Cap=${realState.capacity[pIdx]}, l=${realState.servedCount[pIdx]}/${whProposed.lmax} (KHÔNG HỢP LỆ)`;
                spoofedValStr = `Giả mạo: Open=${obsState.openStatus[pIdx]}, Cap=${obsState.capacity[pIdx]}, l=${obsState.servedCount[pIdx]}/${whProposed.lmax} (VƯỢT QUA MASK)`;
                packetTamperDetail = `Bóp méo đồng bộ cả 3 trường điều kiện tại ${whProposed.code} để lách qua bộ lọc Action Masking`;
                break;
            case 9:
                tamperedField = `Hàm phần thưởng huấn luyện R_t (Model B)`;
                realValStr = `R_chuẩn = -(Cost × 0.05) + 15 - 35 (Tối thiểu hóa chi phí)`;
                spoofedValStr = `R_đầu_độc = +(Cost × 0.09) + Thưởng_quá_tải (Đảo dấu mục tiêu)`;
                packetTamperDetail = `Mô hình bị đầu độc phần thưởng từ giai đoạn huấn luyện nên cố tình chọn tuyến đắt & kho quá tải`;
                break;
        }

        if (this.manualOverrides[j]) {
            packetTamperDetail = `[CAN THIỆP TRỰC TIẾP BỞI NGƯỜI THUYẾT TRÌNH] ${packetTamperDetail}`;
        }

        const candidateIndices = new Set();
        if (cleanBestAction >= 0) candidateIndices.add(cleanBestAction);
        candidateIndices.add(proposedAction);
        candidateIndices.add(finalAction);

        const sortedByAttackQ = Array.from({ length: this.numWarehouses }, (_, idx) => idx).sort(
            (a, b) => attackDueling.qValues[b] - attackDueling.qValues[a]
        );
        for (const idx of sortedByAttackQ) {
            if (candidateIndices.size >= 5) break;
            candidateIndices.add(idx);
        }

        const topCandidates = Array.from(candidateIndices).map(idx => {
            const w = this.warehouses[idx];
            return {
                warehouseIdx: idx,
                code: w.code,
                name: w.name,
                cleanQ: Number(cleanDueling.qValues[idx].toFixed(2)),
                attackQ: Number(attackDueling.qValues[idx].toFixed(2)),
                realCost: realState.costMatrix[idx][j],
                obsCost: obsState.costMatrix[idx][j],
                realCap: realState.capacity[idx],
                obsCap: obsState.capacity[idx],
                realOpen: realState.openStatus[idx],
                obsOpen: obsState.openStatus[idx],
                realValid: realValidMask[idx],
                obsValid: obsMask[idx],
                isCleanBest: idx === cleanBestAction,
                isProposed: idx === proposedAction,
                isFinal: idx === finalAction
            };
        });

        let businessNarrative = '';
        if (modelMode === 'M0') {
            businessNarrative = `[VẬN HÀNH CHUẨN] Đơn hàng ${customer.code} (${realDemand} tấn) được điều phối tới ${whFinal.code} với cước tối ưu ${stepCost} đv tiền. Giao hàng đúng hạn 100%.`;
        } else if (status.includes('M3')) {
            businessNarrative = `[PHÒNG THỦ M3 CHẶN ĐỨNG SỰ CỐ] AI bị lừa đề xuất ${whProposed.code} (Kho không hợp lệ thực tế). Rào chắn kiểm tra dữ liệu gốc tại kho đã TỪ CHỐI lệnh xuất kho và tự động điều hướng sang ${whFinal.code}, bảo toàn 100% đơn hàng ${realDemand} tấn!`;
        } else if (isClosedViolation) {
            businessNarrative = `[SỰ CỐ NGHIÊM TRỌNG - ĐIỀU XE VÀO KHO ĐÓNG CỬA] AI điều đoàn xe chở ${realDemand} tấn của ${customer.code} tới ${whProposed.code} đang đóng cửa bảo trì! Đoàn xe phải quay đầu khẩn cấp, phát sinh phí phạt điều chuyển, tổng chi phí vọt lên ${stepCost} đv tiền và đứt gãy ${stepUnserved} tấn hàng!`;
        } else if (isCapViolation) {
            businessNarrative = `[SỰ CỐ VỠ KẾ HOẠCH TỒN KHO (CV)] AI dồn đơn ${realDemand} tấn của ${customer.code} vào ${whProposed.code} khi kho chỉ còn rất ít hàng! Kho bị âm tồn kho thực tế, thiếu hụt ${stepUnserved} tấn hàng giao cho khách và chịu phạt hợp đồng nặng!`;
        } else if (isLmaxViolation) {
            businessNarrative = `[SỰ CỐ TẮC NGHẼN BẾN XUẤT HÀNG (LV)] ${whProposed.code} đã chạm trần phục vụ (${whProposed.lmax} khách), nhưng bộ đếm giả khiến AI tiếp tục ép nhận đơn ${customer.code}. Bến bốc xếp quá tải dây chuyền, gây trễ hạn ${stepUnserved} tấn hàng!`;
        } else if (status.includes('DEMAND')) {
            businessNarrative = `[SỰ CỐ LỆCH CUNG - CẦU] Nhu cầu thực của ${customer.code} là ${realDemand} tấn nhưng tin tặc sửa đơn thành ${obsState.demand[j]} tấn. Kho ${whFinal.code} xuất thiếu hàng, làm đứt gãy ${stepUnserved} tấn hàng tại điểm bán!`;
        } else if (status.includes('CẤP DƯ')) {
            businessNarrative = `[SỰ CỐ LÃNG PHÍ TÀI NGUYÊN] Tin tặc thổi phồng đơn hàng ${customer.code} từ ${realDemand} lên ${obsState.demand[j]} tấn, buộc doanh nghiệp điều xe trọng tải lớn từ ${whFinal.code}, đội chi phí lên ${stepCost} đv tiền!`;
        } else if (stepCost > bestRealCost + 15) {
            businessNarrative = `[SỰ CỐ ĐIỀU PHỐI LỘ TRÌNH VÒNG VÈO] Thay vì chọn kho gần ${whClean.code} (cước chỉ ${bestRealCost} đv), AI bị bảng giá giả đánh lừa chọn kho xa ${whFinal.code} với cước thực tế lên tới ${stepCost} đv (+${stepCost - bestRealCost} đv tiền lãng phí)!`;
        } else {
            businessNarrative = `[ĐIỀU PHỐI THÀNH CÔNG] Đơn hàng ${customer.code} (${realDemand} tấn) được phân bổ về ${whFinal.code} với chi phí ${stepCost} đv tiền.`;
        }

        return {
            tamperedField,
            realValStr,
            spoofedValStr,
            packetTamperDetail,
            topCandidates,
            businessNarrative,
            cleanBestWarehouseCode: whClean.code,
            cleanBestCost: bestRealCost
        };
    }

    runSimulation(scenarioId = 1, modelMode = 'M0') {
        const rng = new SeededRNG(this.seed + scenarioId * 17);

        const realState = {
            capacity: this.warehouses.map(w => w.initialCapacity),
            openStatus: this.warehouses.map(w => w.openStatus),
            costMatrix: this.costMatrix.map(row => [...row]),
            demand: this.customers.map(c => c.initialDemand),
            servedCount: new Array(this.numWarehouses).fill(0)
        };

        if (Number(scenarioId) === 5 && modelMode !== 'M0') {
            for (let i = 0; i < this.numWarehouses; i++) {
                if (this.warehouses[i].isStrategic) {
                    realState.capacity[i] = 30;
                }
            }
        }

        let totalAllocationCost = 0;
        let unservedDemand = 0;
        let servedDemand = 0;
        let capacityViolations = 0;
        let lmaxViolations = 0;
        let closedWarehouseSelections = 0;
        let invalidProposals = 0;
        let rejectedAllocations = 0;
        let invalidAccepted = 0;
        let suboptimalDecisions = 0;
        let fullyServedCustomers = 0;
        let totalAllocationDeviation = 0;
        let totalReward = 0;
        const overloadedWarehousesSet = new Set();
        const stepLogs = [];

        const phaseStats = {
            before: { tac: 0, reward: 0, ud: 0, count: 0, validCount: 0 },
            during: { tac: 0, reward: 0, ud: 0, count: 0, validCount: 0 },
            after: { tac: 0, reward: 0, ud: 0, count: 0, validCount: 0 }
        };

        const isUnderAttack = modelMode !== 'M0';
        const isRewardPoisoned = Number(scenarioId) === 9 && modelMode === 'M1';

        for (let j = 0; j < this.numCustomers; j++) {
            const realDemand = realState.demand[j];
            const cleanStateSnapshot = {
                capacity: [...realState.capacity],
                openStatus: [...realState.openStatus],
                costMatrix: realState.costMatrix.map(r => [...r]),
                demand: [...realState.demand],
                servedCount: [...realState.servedCount]
            };

            const obsState = isUnderAttack
                ? this.buildObservedState(realState, scenarioId, j)
                : cleanStateSnapshot;

            const cleanDueling = this.computeDuelingQValues(cleanStateSnapshot, j, 'M0', false);
            const duelingOut = this.computeDuelingQValues(obsState, j, modelMode, isRewardPoisoned);

            const realValidMask = this.getActionMask(realState, j, realDemand);
            let bestRealCost = Infinity;
            let bestRealWarehouse = -1;
            let cleanBestAction = -1;
            let cleanBestQ = -Infinity;

            for (let i = 0; i < this.numWarehouses; i++) {
                if (realValidMask[i]) {
                    if (realState.costMatrix[i][j] < bestRealCost) {
                        bestRealCost = realState.costMatrix[i][j];
                        bestRealWarehouse = i;
                    }
                    if (cleanDueling.qValues[i] > cleanBestQ) {
                        cleanBestQ = cleanDueling.qValues[i];
                        cleanBestAction = i;
                    }
                }
            }

            let obsMask = this.getActionMask(obsState, j, obsState.demand[j]);

            if (isRewardPoisoned && j % 3 === 0) {
                obsMask = new Array(this.numWarehouses).fill(true);
            }

            if (modelMode === 'M2' && isUnderAttack) {
                obsMask = obsMask.map((valid, idx) => {
                    if (!valid) return false;
                    const trustedOpen = rng.next() < 0.82 ? realState.openStatus[idx] === 1 : true;
                    const trustedCap = rng.next() < 0.80 ? realState.capacity[idx] >= realDemand : true;
                    const trustedSlot = rng.next() < 0.82 ? realState.servedCount[idx] < this.warehouses[idx].lmax : true;
                    return trustedOpen && trustedCap && trustedSlot;
                });
            }

            let proposedAction = -1;
            let bestQ = -Infinity;
            for (let i = 0; i < this.numWarehouses; i++) {
                if (obsMask[i] && duelingOut.qValues[i] > bestQ) {
                    bestQ = duelingOut.qValues[i];
                    proposedAction = i;
                }
            }
            if (proposedAction === -1) {
                proposedAction = 0;
                for (let i = 1; i < this.numWarehouses; i++) {
                    if (duelingOut.qValues[i] > duelingOut.qValues[proposedAction]) {
                        proposedAction = i;
                    }
                }
            }

            const isClosedViolation = realState.openStatus[proposedAction] === 0;
            const isCapViolation = realState.capacity[proposedAction] < realDemand;
            const isLmaxViolation = realState.servedCount[proposedAction] >= this.warehouses[proposedAction].lmax;
            const isProposalInvalid = isClosedViolation || isCapViolation || isLmaxViolation;

            let finalAction = proposedAction;
            let status = 'HỢP LỆ';
            let stepCost = 0;
            let stepServed = 0;
            let stepUnserved = 0;
            let stepReward = 0;

            if (isProposalInvalid) {
                invalidProposals++;
                if (isClosedViolation) closedWarehouseSelections++;

                if (modelMode === 'M3') {
                    rejectedAllocations++;
                    status = 'BỊ TỪ CHỐI & ĐIỀU HƯỚNG AN TOÀN (M3)';

                    let fallbackAction = -1;
                    let fallbackBestQ = -Infinity;
                    for (let i = 0; i < this.numWarehouses; i++) {
                        if (realValidMask[i] && duelingOut.qValues[i] > fallbackBestQ) {
                            fallbackBestQ = duelingOut.qValues[i];
                            fallbackAction = i;
                        }
                    }

                    if (fallbackAction !== -1) {
                        finalAction = fallbackAction;
                        stepCost = realState.costMatrix[finalAction][j] + 6;
                        stepServed = realDemand;
                        fullyServedCustomers++;
                        realState.capacity[finalAction] -= realDemand;
                        realState.servedCount[finalAction] += 1;
                        stepReward = -(stepCost * this.wScale) + this.bonusCompletion * 0.9;
                    } else {
                        stepCost = 45;
                        stepUnserved = realDemand;
                        stepReward = -this.penaltyUnserved;
                    }
                } else {
                    if (isClosedViolation) {
                        rejectedAllocations++;
                        invalidAccepted++;
                        status = 'LỖI: CHỌN KHO ĐANG ĐÓNG';
                        stepCost = realState.costMatrix[proposedAction][j] + 65;
                        stepServed = Math.round(realDemand * 0.35);
                        stepUnserved = realDemand - stepServed;
                        stepReward = -(stepCost * this.wScale) - this.penaltyUnserved * 0.75;
                    } else if (isCapViolation) {
                        capacityViolations++;
                        rejectedAllocations++;
                        invalidAccepted++;
                        status = 'VI PHẠM SỨC CHỨA (CV)';
                        const available = Math.max(0, realState.capacity[proposedAction]);
                        stepServed = available;
                        stepUnserved = realDemand - available;
                        realState.capacity[proposedAction] = available - realDemand;
                        realState.servedCount[proposedAction] += 1;
                        stepCost = realState.costMatrix[proposedAction][j] + 58;
                        stepReward = -(stepCost * this.wScale) - this.penaltyUnserved * 0.75;
                    } else if (isLmaxViolation) {
                        lmaxViolations++;
                        rejectedAllocations++;
                        invalidAccepted++;
                        overloadedWarehousesSet.add(proposedAction);
                        status = 'VI PHẠM GIỚI HẠN l_max (LV)';
                        stepServed = Math.round(realDemand * 0.52);
                        stepUnserved = realDemand - stepServed;
                        realState.capacity[proposedAction] = Math.max(0, realState.capacity[proposedAction] - stepServed);
                        realState.servedCount[proposedAction] += 1;
                        stepCost = realState.costMatrix[proposedAction][j] + 52;
                        stepReward = -(stepCost * this.wScale) - this.penaltyUnserved * 0.65;
                    }
                }
            } else {
                const hasCustomDemandOverride = Boolean(this.manualOverrides[j]?.alterDemandFactor);
                if ((Number(scenarioId) === 4 || hasCustomDemandOverride) && isUnderAttack && modelMode !== 'M3') {
                    const perceivedDemand =
                        modelMode === 'M2'
                            ? Math.round(realDemand * 0.88 + obsState.demand[j] * 0.12)
                            : obsState.demand[j];
                    const allocatedAmount = Math.min(realState.capacity[finalAction], perceivedDemand);
                    const deviation = Math.abs(allocatedAmount - realDemand);
                    totalAllocationDeviation += deviation;

                    if (allocatedAmount < realDemand) {
                        stepServed = allocatedAmount;
                        stepUnserved = realDemand - allocatedAmount;
                        status = 'CẤP THIẾU HÀNG (SAI LỆCH DEMAND)';
                        stepCost = realState.costMatrix[finalAction][j] + 34;
                        stepReward = -(stepCost * this.wScale) - this.penaltyUnserved * 0.45;
                    } else {
                        stepServed = realDemand;
                        fullyServedCustomers++;
                        status = deviation > 5 ? 'CẤP DƯ HÀNG (LÃNG PHÍ VẬN CHUYỂN)' : 'HỢP LỆ';
                        stepCost = Math.round(realState.costMatrix[finalAction][j] * (allocatedAmount / realDemand));
                        stepReward = -(stepCost * this.wScale) + this.bonusCompletion * 0.7;
                    }
                    realState.capacity[finalAction] = Math.max(0, realState.capacity[finalAction] - allocatedAmount);
                    realState.servedCount[finalAction] += 1;
                } else {
                    stepCost = realState.costMatrix[finalAction][j];
                    stepServed = realDemand;
                    fullyServedCustomers++;
                    realState.capacity[finalAction] -= realDemand;
                    realState.servedCount[finalAction] += 1;
                    stepReward = -(stepCost * this.wScale) + this.bonusCompletion;
                }
            }

            if (bestRealWarehouse !== -1 && (finalAction !== bestRealWarehouse || stepCost > bestRealCost + 5)) {
                suboptimalDecisions++;
            }

            const explain = this.buildStepExplainability({
                scenarioId,
                customer: this.customers[j],
                realState: cleanStateSnapshot,
                obsState,
                cleanDueling,
                attackDueling: duelingOut,
                realValidMask,
                obsMask,
                cleanBestAction: cleanBestAction >= 0 ? cleanBestAction : bestRealWarehouse,
                proposedAction,
                finalAction,
                isClosedViolation,
                isCapViolation,
                isLmaxViolation,
                realDemand,
                stepCost,
                bestRealCost: Number.isFinite(bestRealCost) ? bestRealCost : stepCost,
                stepUnserved,
                status,
                modelMode
            });

            totalAllocationCost += stepCost;
            servedDemand += stepServed;
            unservedDemand += stepUnserved;
            totalReward += stepReward;

            const phaseKey = j < 30 ? 'before' : j < 40 ? 'during' : 'after';
            phaseStats[phaseKey].tac += stepCost;
            phaseStats[phaseKey].reward += stepReward;
            phaseStats[phaseKey].ud += stepUnserved;
            phaseStats[phaseKey].count += 1;
            if (!isProposalInvalid || modelMode === 'M3') {
                phaseStats[phaseKey].validCount += 1;
            }

            stepLogs.push({
                step: j + 1,
                customerCode: this.customers[j].code,
                customerName: this.customers[j].name,
                realDemand: realDemand,
                observedDemand: obsState.demand[j],
                proposedWarehouse: this.warehouses[proposedAction].code,
                finalWarehouse: this.warehouses[finalAction].code,
                warehouseIdx: finalAction,
                proposedWarehouseIdx: proposedAction,
                customerIdx: j,
                qValue: Number(duelingOut.qValues[proposedAction].toFixed(2)),
                cleanQValue: Number(cleanDueling.qValues[proposedAction].toFixed(2)),
                vValue: duelingOut.V_s,
                realCost: stepCost,
                observedCost: obsState.costMatrix[proposedAction][j],
                unserved: stepUnserved,
                reward: Number(stepReward.toFixed(2)),
                isInvalidProposal: isProposalInvalid,
                status: status,
                customCreatedBy: this.customers[j].customCreatedBy || 'Hệ thống OMS / AI',
                explain
            });
        }

        const avgTransportCost = Number((totalAllocationCost / this.numCustomers).toFixed(2));
        const dfr = Number(((servedDemand / this.totalInitialDemand) * 100).toFixed(2));
        const invalidRate = Number(((invalidProposals / this.numCustomers) * 100).toFixed(1));
        const avgReward = Number((totalReward / this.numCustomers).toFixed(2));

        const totalInitialCap = this.warehouses.reduce((acc, w) => acc + w.initialCapacity, 0);
        const totalUsedCap = this.warehouses.reduce(
            (acc, w, idx) => acc + Math.max(0, w.initialCapacity - Math.max(0, realState.capacity[idx])),
            0
        );
        const capUtilizationRate = Number(((totalUsedCap / totalInitialCap) * 100).toFixed(1));

        let recoveryTime = 0;
        if (modelMode === 'M1') {
            recoveryTime = Number(scenarioId) === 7 ? 8 : 14;
        } else if (modelMode === 'M2') {
            recoveryTime = Number(scenarioId) === 7 ? 3 : 5;
        } else if (modelMode === 'M3') {
            recoveryTime = Number(scenarioId) === 7 ? 2 : 3;
        }

        return {
            scenarioId: Number(scenarioId),
            modelMode,
            metrics: {
                TAC: Math.round(totalAllocationCost),
                ATC: avgTransportCost,
                UD: Math.round(unservedDemand),
                DFR: dfr,
                CV: capacityViolations,
                LV: lmaxViolations,
                IR: invalidRate,
                AR: avgReward,
                RT: recoveryTime,
                closedSelections: closedWarehouseSelections,
                rejectedAllocations: rejectedAllocations,
                invalidProposals: invalidProposals,
                invalidAccepted: invalidAccepted,
                suboptimalDecisions: suboptimalDecisions,
                fullyServedCustomers: fullyServedCustomers,
                allocationDeviation: Math.round(totalAllocationDeviation),
                capUtilizationRate: capUtilizationRate,
                overloadedWarehouses: overloadedWarehousesSet.size,
                totalConstraintsViolated: capacityViolations + lmaxViolations + closedWarehouseSelections
            },
            phaseStats,
            stepLogs,
            finalRealState: realState
        };
    }

    runAllScenariosSummary() {
        const baselineM0 = this.runSimulation(1, 'M0');
        const resultsByScenario = {};

        for (let s = 1; s <= 9; s++) {
            const m0 = baselineM0;
            const m1 = this.runSimulation(s, 'M1');
            const m2 = this.runSimulation(s, 'M2');
            const m3 = this.runSimulation(s, 'M3');

            const costIncreaseM1 = Number(
                (((m1.metrics.TAC - m0.metrics.TAC) / Math.max(1, m0.metrics.TAC)) * 100).toFixed(2)
            );
            const costIncreaseM2 = Number(
                (((m2.metrics.TAC - m0.metrics.TAC) / Math.max(1, m0.metrics.TAC)) * 100).toFixed(2)
            );
            const costIncreaseM3 = Number(
                (((m3.metrics.TAC - m0.metrics.TAC) / Math.max(1, m0.metrics.TAC)) * 100).toFixed(2)
            );

            resultsByScenario[s] = {
                M0: m0,
                M1: m1,
                M2: m2,
                M3: m3,
                deltaTAC_M1: costIncreaseM1,
                deltaTAC_M2: costIncreaseM2,
                deltaTAC_M3: costIncreaseM3
            };
        }

        return {
            baselineM0,
            resultsByScenario
        };
    }
}

window.WarehouseEnvironmentEngine = WarehouseEnvironmentEngine;
