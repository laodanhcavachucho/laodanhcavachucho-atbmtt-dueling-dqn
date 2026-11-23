/**
 * TRANG 2: BẢNG ĐIỀU KHIỂN THAO TÁC TẤN CÔNG (/attack-sandbox) – RED TEAM SANDBOX
 * Hỗ trợ đầy đủ công tắc điều khiển chuyên biệt cho từng Kịch bản 1 -> 9
 * và đồng bộ hóa thời gian thực (0ms) sang Trang 1 (/dashboard) qua BroadcastChannel & localStorage.
 */

const SANDBOX_CHANNEL_NAME = 'vietlogix_realtime_attack_bus_v1';
const SANDBOX_STORAGE_KEY = 'vietlogix_live_attack_state_v1';

const CLOSED_WAREHOUSE_INDICES = [6, 14, 22, 30, 41, 47]; // W7, W15, W23, W31, W42, W48
const LOW_CAP_WAREHOUSE_INDICES = [2, 7, 11, 17, 24, 27, 33, 37, 43, 48]; // W3, W8, W12, W18, W25, W28, W34, W38, W44, W49
const HUB_WAREHOUSE_INDICES = [0, 9, 19, 29, 39]; // W1, W10, W20, W30, W40

const SANDBOX_SCENARIO_INFO = {
    1: {
        title: '2. BẢNG CÔNG TẮC KỊCH BẢN 1 (TV 1): GIẢ MẠO ĐÓNG/MỞ KHO (OPEN STATUS SPOOFING)',
        subtitle: 'Gạt công tắc của 6 kho đang đóng bảo trì (W7, W15, W23, W31, W42, W48) từ 0 sang 1 để đánh lừa Dueling DQN điều xe tải vào kho khóa cổng.'
    },
    2: {
        title: '2. BẢNG CÔNG TẮC KỊCH BẢN 2 (TV 2): ĐẦU ĐỘC MA TRẬN CHI PHÍ VẬN CHUYỂN (TMS)',
        subtitle: 'Điều chỉnh thanh trượt hạ thấp cước ảo của các kho ở xa (>78 đv) và thổi phồng cước các kho ở gần (<52 đv) để ép AI chọn lộ trình xuyên vùng tốn kém.'
    },
    3: {
        title: '2. BẢNG CÔNG TẮC KỊCH BẢN 3 (TV 3): BƠM TỒN KHO ẢO GÂY TRÀN KHO (CAPACITY EXHAUSTION)',
        subtitle: 'Chọn các kho vệ tinh sắp cạn hàng (22–36 tấn) và bơm lượng tồn kho ảo (+50 đến +250 tấn) để lừa mạng DQN dồn đơn hàng lớn vào gây vỡ kho.'
    },
    4: {
        title: '2. BẢNG CÔNG TẮC KỊCH BẢN 4 (TV 4): LÀM GIẢ NHU CẦU ĐẶT HÀNG (FAKE DEMAND FLUCTUATION)',
        subtitle: 'Can thiệp cổng OMS: Cắt giảm tỷ lệ nhu cầu quan sát ở các đơn hàng chẵn và thổi phồng nhu cầu ở các đơn hàng lẻ làm mất cân đối cung cầu.'
    },
    5: {
        title: '2. BẢNG CÔNG TẮC KỊCH BẢN 5 (TV 5): TẤN CÔNG PHÂN TÁN 5 KHO HUB CHIẾN LƯỢC TRUNG TÂM',
        subtitle: 'Chọn chế độ tấn công riêng cho từng Kho Hub trung tâm (W1, W10, W20, W30, W40): Bơm ảo 240 tấn gây tràn Hub, Báo đóng cửa ảo, hoặc Hoạt động bình thường.'
    },
    6: {
        title: '2. BẢNG CÔNG TẮC KỊCH BẢN 6 (TV 6): LÀM TRÀN GIỚI HẠN BẾN BỐC XẾP (l_max OVERLOAD)',
        subtitle: 'Xóa bộ đếm số đoàn xe đang phục vụ tại cổng kho về 0 (l_obs = 0 khi l_real = l_max) và hạ cước mồi nhử để gây ùn tắc dây chuyền tại cầu cảng.'
    },
    7: {
        title: '2. BẢNG CÔNG TẮC KỊCH BẢN 7 (TV 7): TẤN CÔNG CHỚP NHOÁNG THEO KHUNG THỜI GIAN (TRANSIENT)',
        subtitle: 'Thiết lập cửa sổ đơn hàng phát động tấn công chớp nhoáng (mặc định Đơn U31 → U40 / Bước 61–80) và chuyển nhanh giữa 3 Giai đoạn để đo Thời gian phục hồi (RT).'
    },
    8: {
        title: '2. BẢNG CÔNG TẮC KỊCH BẢN 8 (TV 8): PHỐI HỢP 3 VECTOR VƯỢT LỚP LỌC ACTION MASKING',
        subtitle: 'Bật/tắt đồng bộ 3 điều kiện ràng buộc (O_obs = 1, Cap_obs = D_j + 130, l_obs = 0). Chỉ khi cả 3 công tắc cùng BẬT, gói tin mới qua mặt được bộ lọc Action Masking!'
    },
    9: {
        title: '2. BẢNG CÔNG TẮC KỊCH BẢN 9 (TV 9): ĐẦU ĐỘC HÀM PHẦN THƯỞNG HUẤN LUYỆN (REWARD POISONING)',
        subtitle: 'Chuyển đổi giữa Trọng số sạch (Model A) và Trọng số bị đầu độc (Model B – đảo dấu +Cost thành phần thưởng dương trong Replay Buffer).'
    }
};

function createDefaultSandboxState() {
    return {
        activeScenario: 1,
        modelMode: 'M1',
        selectedOrderStep: 1,
        targetScope: 'all', // 'all' hoặc 'single'
        epsilonFGSM: 0.15,
        attackIntensity: 0.30,
        wipeLogs: false,
        kb1: {
            flippedWarehouses: { 6: true, 14: true, 22: true, 30: true, 41: true, 47: true },
            lureCost: 12
        },
        kb2: {
            farSpoofCost: 14,
            nearMultiplier: 2.8
        },
        kb3: {
            virtualTons: 150,
            spoofedLowCapWarehouses: {
                2: true, 7: true, 11: true, 17: true, 24: true,
                27: true, 33: true, 37: true, 43: true, 48: true
            }
        },
        kb4: {
            evenFactor: 0.45,
            oddFactor: 1.85
        },
        kb5: {
            hubModes: {
                0: 'spoof_cap',
                9: 'fake_close',
                19: 'spoof_cap',
                29: 'fake_close',
                39: 'spoof_cap'
            }
        },
        kb6: {
            resetQueue: true,
            lureCost: 12
        },
        kb7: {
            startOrder: 31,
            endOrder: 40
        },
        kb8: {
            bypassOpen: true,
            bypassCap: true,
            bypassLmax: true
        },
        kb9: {
            usePoisonedModelB: true,
            rewardCostScale: 0.09
        }
    };
}

let sandboxState = createDefaultSandboxState();
let sbEngine = null;
let sbChannel = null;
let broadcastSeq = 0;

function showSandboxToast(msg) {
    const toast = document.getElementById('app-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(window.__sbToastTimer);
    window.__sbToastTimer = setTimeout(() => {
        toast.classList.remove('show');
    }, 2400);
}

function buildEngineSandboxConfig() {
    const targetCustomerIdx =
        sandboxState.targetScope === 'single' ? sandboxState.selectedOrderStep - 1 : 'all';

    return {
        targetCustomerIdx,
        kb1: {
            flippedWarehouses: { ...sandboxState.kb1.flippedWarehouses },
            lureCost: Number(sandboxState.kb1.lureCost)
        },
        kb2: {
            farSpoofCost: Number(sandboxState.kb2.farSpoofCost),
            nearMultiplier: Number(sandboxState.kb2.nearMultiplier)
        },
        kb3: {
            virtualTons: Number(sandboxState.kb3.virtualTons),
            spoofedLowCapWarehouses: { ...sandboxState.kb3.spoofedLowCapWarehouses }
        },
        kb4: {
            evenFactor: Number(sandboxState.kb4.evenFactor),
            oddFactor: Number(sandboxState.kb4.oddFactor)
        },
        kb5: {
            hubModes: { ...sandboxState.kb5.hubModes }
        },
        kb6: {
            resetQueue: Boolean(sandboxState.kb6.resetQueue),
            lureCost: Number(sandboxState.kb6.lureCost)
        },
        kb7: {
            startOrder: Number(sandboxState.kb7.startOrder),
            endOrder: Number(sandboxState.kb7.endOrder)
        },
        kb8: {
            bypassOpen: Boolean(sandboxState.kb8.bypassOpen),
            bypassCap: Boolean(sandboxState.kb8.bypassCap),
            bypassLmax: Boolean(sandboxState.kb8.bypassLmax)
        },
        kb9: {
            usePoisonedModelB: Boolean(sandboxState.kb9.usePoisonedModelB),
            rewardCostScale: Number(sandboxState.kb9.rewardCostScale)
        }
    };
}

function rebuildSandboxEngine() {
    sbEngine = new WarehouseEnvironmentEngine({
        seed: 2026,
        epsilonFGSM: sandboxState.epsilonFGSM,
        attackIntensity: sandboxState.attackIntensity,
        sandboxConfig: buildEngineSandboxConfig()
    });
}

function populateOrderSelect() {
    const select = document.getElementById('sandbox-select-order');
    if (!select || !sbEngine) return;
    select.innerHTML = '';
    sbEngine.customers.forEach((c, idx) => {
        const opt = document.createElement('option');
        opt.value = String(idx + 1);
        opt.textContent = `Đơn hàng #${idx + 1} – ${c.code} (${c.name} | Nhu cầu: ${c.demand} tấn)`;
        if (idx + 1 === sandboxState.selectedOrderStep) opt.selected = true;
        select.appendChild(opt);
    });
}

function renderScenarioSpecificControls() {
    const container = document.getElementById('sandbox-dynamic-controls-container');
    const titleEl = document.getElementById('sb-specific-panel-title');
    const subtitleEl = document.getElementById('sb-specific-panel-subtitle');
    const badgeEl = document.getElementById('sandbox-active-member-badge');
    if (!container || !sbEngine) return;

    const sc = sandboxState.activeScenario;
    const info = SANDBOX_SCENARIO_INFO[sc] || SANDBOX_SCENARIO_INFO[1];
    if (titleEl) titleEl.textContent = info.title;
    if (subtitleEl) subtitleEl.textContent = info.subtitle;
    if (badgeEl) badgeEl.textContent = `Đang điều khiển: Kịch bản ${sc} (Thành viên ${sc})`;

    if (sc === 1) {
        const cardsHtml = CLOSED_WAREHOUSE_INDICES.map((wIdx) => {
            const w = sbEngine.warehouses[wIdx];
            const isFlipped = Boolean(sandboxState.kb1.flippedWarehouses[wIdx]);
            return `
                <div class="wh-toggle-card ${isFlipped ? 'spoof-active' : ''}">
                    <div class="wh-toggle-card-head">
                        <strong style="color:#f8fafc;font-size:13px;">Kho ${w.code} (${w.regionName})</strong>
                        <span class="status-pill ${isFlipped ? 'status-err' : 'status-ok'}">
                            ${isFlipped ? 'O_obs = 1 (Giả mở)' : 'O_obs = 0 (Chuẩn)'}
                        </span>
                    </div>
                    <div style="font-size:11.5px;color:#94a3b8;">
                        Thực tế PLC: <code>O_real = 0 (Đóng bảo trì)</code><br/>
                        Tồn kho kệ: <code>${w.initialCapacity} tấn</code> | Cước mồi: <code>${sandboxState.kb1.lureCost} đv</code>
                    </div>
                    <button type="button" class="switch-btn ${isFlipped ? 'on' : ''}" data-kb1-toggle="${wIdx}">
                        ${isFlipped ? 'ĐANG ĐẢO BIT 0 → 1 (Bấm để Tắt)' : 'ĐANG GIỮ NGUYÊN 0 (Bấm để Đảo 0 → 1)'}
                    </button>
                </div>
            `;
        }).join('');

        container.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px;">
                <strong style="font-size:12.5px;color:#e2e8f0;">Công tắc 6 Kho Đang Đóng Cửa Bảo Trì Hệ Thống Lạnh:</strong>
                <div style="display:flex;gap:8px;">
                    <button type="button" id="kb1-all-on" class="btn-danger-glow btn-xs">Đảo Tất Cả 6 Kho (0 → 1)</button>
                    <button type="button" id="kb1-all-off" class="btn-secondary btn-xs">Trả Tất Cả Về Chuẩn (0)</button>
                </div>
            </div>
            <div class="wh-toggle-grid">${cardsHtml}</div>
            <div style="margin-top:12px;padding:10px 12px;background:#0b1324;border:1px solid var(--border-color);border-radius:8px;">
                <label style="font-size:12.5px;color:#e2e8f0;display:flex;justify-content:space-between;">
                    <span>Giá cước vận chuyển mồi nhử gán cho các kho bị đảo trạng thái:</span>
                    <strong id="kb1-lure-val" style="color:#f87171;">${sandboxState.kb1.lureCost} đv tiền</strong>
                </label>
                <input type="range" id="kb1-lure-slider" min="8" max="32" step="1" value="${sandboxState.kb1.lureCost}" style="width:100%;margin-top:6px;" />
            </div>
        `;

        container.querySelectorAll('[data-kb1-toggle]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const idx = Number(btn.getAttribute('data-kb1-toggle'));
                sandboxState.kb1.flippedWarehouses[idx] = !sandboxState.kb1.flippedWarehouses[idx];
                onSandboxControlChanged(`Đã đảo công tắc Kho W${idx + 1} sang O_obs = ${sandboxState.kb1.flippedWarehouses[idx] ? 1 : 0}`);
            });
        });
        document.getElementById('kb1-all-on')?.addEventListener('click', () => {
            CLOSED_WAREHOUSE_INDICES.forEach((i) => { sandboxState.kb1.flippedWarehouses[i] = true; });
            onSandboxControlChanged('Đã bật giả mạo O_obs = 1 cho toàn bộ 6 kho đóng bảo trì');
        });
        document.getElementById('kb1-all-off')?.addEventListener('click', () => {
            CLOSED_WAREHOUSE_INDICES.forEach((i) => { sandboxState.kb1.flippedWarehouses[i] = false; });
            onSandboxControlChanged('Đã trả toàn bộ 6 kho đóng bảo trì về trạng thái chuẩn O_obs = 0');
        });
        document.getElementById('kb1-lure-slider')?.addEventListener('input', (e) => {
            sandboxState.kb1.lureCost = Number(e.target.value);
            const lbl = document.getElementById('kb1-lure-val');
            if (lbl) lbl.textContent = `${sandboxState.kb1.lureCost} đv tiền`;
            onSandboxControlChanged(`Đã chỉnh giá cước mồi nhử Kịch bản 1 = ${sandboxState.kb1.lureCost} đv`, false);
        });
        return;
    }

    if (sc === 2) {
        const cIdx = sandboxState.selectedOrderStep - 1;
        const sampleRows = [0, 3, 8, 18, 35].map((wIdx) => {
            const cReal = sbEngine.costMatrix[wIdx][cIdx];
            const cObs = cReal > 78
                ? sandboxState.kb2.farSpoofCost + (wIdx % 6)
                : cReal < 52
                ? Math.round(cReal * sandboxState.kb2.nearMultiplier)
                : cReal;
            return `<tr>
                <td>Kho W${wIdx + 1} → U${cIdx + 1}</td>
                <td>${cReal} đv (${cReal > 78 ? 'Kho Xa' : cReal < 52 ? 'Kho Gần' : 'Trung bình'})</td>
                <td style="color:${cObs !== cReal ? '#f87171' : '#34d399'};font-weight:700;">${cObs} đv</td>
            </tr>`;
        }).join('');

        container.innerHTML = `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div style="padding:12px;background:#0b1324;border:1px solid var(--border-color);border-radius:8px;">
                    <label style="font-size:12.5px;color:#e2e8f0;display:flex;justify-content:space-between;">
                        <span>Cước giả mạo cho Kho ở xa (&gt;78 đv):</span>
                        <strong id="kb2-far-val" style="color:#f87171;">${sandboxState.kb2.farSpoofCost} đv tiền</strong>
                    </label>
                    <input type="range" id="kb2-far-slider" min="9" max="35" step="1" value="${sandboxState.kb2.farSpoofCost}" style="width:100%;margin-top:8px;" />
                    <div style="font-size:11.5px;color:#94a3b8;margin-top:4px;">Hạ cước kho cách hàng trăm km xuống cực rẻ để dụ AI điều xe xuyên vùng.</div>
                </div>
                <div style="padding:12px;background:#0b1324;border:1px solid var(--border-color);border-radius:8px;">
                    <label style="font-size:12.5px;color:#e2e8f0;display:flex;justify-content:space-between;">
                        <span>Hệ số thổi giá Kho ở gần (&lt;52 đv):</span>
                        <strong id="kb2-near-val" style="color:#fb923c;">×${sandboxState.kb2.nearMultiplier.toFixed(1)} lần</strong>
                    </label>
                    <input type="range" id="kb2-near-slider" min="1.2" max="4.0" step="0.1" value="${sandboxState.kb2.nearMultiplier}" style="width:100%;margin-top:8px;" />
                    <div style="font-size:11.5px;color:#94a3b8;margin-top:4px;">Thổi phồng cước các kho ngay cạnh khách hàng để AI né tránh kho gần.</div>
                </div>
            </div>
            <div style="margin-top:12px;">
                <strong style="font-size:12.5px;color:#e2e8f0;">Bảng xem trước biến đổi cước vận tải trên Đơn hàng U${cIdx + 1}:</strong>
                <table class="data-table" style="margin-top:6px;">
                    <thead><tr><th>Tuyến vận chuyển</th><th>Cước thực tế (C_real)</th><th>Cước tiêm vào DQN (C_obs)</th></tr></thead>
                    <tbody>${sampleRows}</tbody>
                </table>
            </div>
        `;

        document.getElementById('kb2-far-slider')?.addEventListener('input', (e) => {
            sandboxState.kb2.farSpoofCost = Number(e.target.value);
            onSandboxControlChanged(`Đã đặt cước giả mạo kho xa = ${sandboxState.kb2.farSpoofCost} đv`);
        });
        document.getElementById('kb2-near-slider')?.addEventListener('input', (e) => {
            sandboxState.kb2.nearMultiplier = Number(e.target.value);
            onSandboxControlChanged(`Đã đặt hệ số thổi giá kho gần = ×${sandboxState.kb2.nearMultiplier.toFixed(1)}`);
        });
        return;
    }

    if (sc === 3) {
        const cardsHtml = LOW_CAP_WAREHOUSE_INDICES.map((wIdx) => {
            const w = sbEngine.warehouses[wIdx];
            const isSpoofed = Boolean(sandboxState.kb3.spoofedLowCapWarehouses[wIdx]);
            const capObs = isSpoofed ? w.initialCapacity + sandboxState.kb3.virtualTons : w.initialCapacity;
            return `
                <div class="wh-toggle-card ${isSpoofed ? 'spoof-active' : ''}">
                    <div class="wh-toggle-card-head">
                        <strong style="color:#f8fafc;font-size:12.5px;">Kho ${w.code}</strong>
                        <span class="status-pill ${isSpoofed ? 'status-err' : 'status-ok'}">
                            Cap_obs: ${capObs}t
                        </span>
                    </div>
                    <div style="font-size:11.5px;color:#94a3b8;">
                        Tồn thực tế: <code>${w.initialCapacity} tấn</code> (Sắp cạn)
                    </div>
                    <button type="button" class="switch-btn ${isSpoofed ? 'on' : ''}" data-kb3-toggle="${wIdx}">
                        ${isSpoofed ? `ĐANG BƠM +${sandboxState.kb3.virtualTons}T ẢO` : 'GIỮ TỒN KHO THẬT'}
                    </button>
                </div>
            `;
        }).join('');

        container.innerHTML = `
            <div style="padding:10px 12px;background:#0b1324;border:1px solid var(--border-color);border-radius:8px;margin-bottom:10px;">
                <label style="font-size:12.5px;color:#e2e8f0;display:flex;justify-content:space-between;">
                    <span>Lượng tồn kho ảo cộng thêm vào các kho sắp cạn hàng (Δ_spoof):</span>
                    <strong style="color:#f87171;">+${sandboxState.kb3.virtualTons} tấn ảo</strong>
                </label>
                <input type="range" id="kb3-tons-slider" min="60" max="260" step="10" value="${sandboxState.kb3.virtualTons}" style="width:100%;margin-top:6px;" />
            </div>
            <div class="wh-toggle-grid">${cardsHtml}</div>
        `;

        document.getElementById('kb3-tons-slider')?.addEventListener('input', (e) => {
            sandboxState.kb3.virtualTons = Number(e.target.value);
            onSandboxControlChanged(`Đã chỉnh lượng tồn kho ảo bơm thêm = +${sandboxState.kb3.virtualTons} tấn`);
        });
        container.querySelectorAll('[data-kb3-toggle]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const idx = Number(btn.getAttribute('data-kb3-toggle'));
                sandboxState.kb3.spoofedLowCapWarehouses[idx] = !sandboxState.kb3.spoofedLowCapWarehouses[idx];
                onSandboxControlChanged(`Đã cập nhật công tắc bơm tồn kho ảo tại Kho W${idx + 1}`);
            });
        });
        return;
    }

    if (sc === 4) {
        const c = sbEngine.customers[sandboxState.selectedOrderStep - 1];
        const isEven = (sandboxState.selectedOrderStep - 1) % 2 === 0;
        const dObs = Math.round(c.demand * (isEven ? sandboxState.kb4.evenFactor : sandboxState.kb4.oddFactor));
        container.innerHTML = `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div style="padding:12px;background:#0b1324;border:1px solid var(--border-color);border-radius:8px;">
                    <label style="font-size:12.5px;color:#e2e8f0;display:flex;justify-content:space-between;">
                        <span>Hệ số cắt giảm Đơn hàng Chẵn:</span>
                        <strong style="color:#38bdf8;">${Math.round(sandboxState.kb4.evenFactor * 100)}% D_real</strong>
                    </label>
                    <input type="range" id="kb4-even-slider" min="0.20" max="0.90" step="0.05" value="${sandboxState.kb4.evenFactor}" style="width:100%;margin-top:8px;" />
                    <div style="font-size:11.5px;color:#94a3b8;margin-top:4px;">Làm AI điều xe nhỏ giao thiếu hụt hàng cho các đại lý chẵn.</div>
                </div>
                <div style="padding:12px;background:#0b1324;border:1px solid var(--border-color);border-radius:8px;">
                    <label style="font-size:12.5px;color:#e2e8f0;display:flex;justify-content:space-between;">
                        <span>Hệ số thổi phồng Đơn hàng Lẻ:</span>
                        <strong style="color:#f87171;">×${sandboxState.kb4.oddFactor.toFixed(2)} D_real</strong>
                    </label>
                    <input type="range" id="kb4-odd-slider" min="1.20" max="2.60" step="0.05" value="${sandboxState.kb4.oddFactor}" style="width:100%;margin-top:8px;" />
                    <div style="font-size:11.5px;color:#94a3b8;margin-top:4px;">Làm AI điều đoàn xe quá tải gây lãng phí và chiếm chỗ kho lớn.</div>
                </div>
            </div>
            <div style="margin-top:12px;padding:12px;background:#0b1324;border:1px solid var(--border-color);border-radius:8px;">
                <strong style="font-size:12.5px;color:#e2e8f0;">Đơn hàng đang chọn (${c.code} – ${c.name}):</strong>
                <div style="margin-top:6px;font-size:13px;color:#cbd5e1;">
                    Nhu cầu đặt hàng gốc: <code>D_real = ${c.demand} tấn</code> ➔ Nhu cầu giả mạo gửi sang DQN: <code style="color:#f87171;font-weight:700;">D_obs = ${dObs} tấn</code>
                </div>
            </div>
        `;

        document.getElementById('kb4-even-slider')?.addEventListener('input', (e) => {
            sandboxState.kb4.evenFactor = Number(e.target.value);
            onSandboxControlChanged(`Đã chỉnh hệ số đơn hàng chẵn = ${Math.round(sandboxState.kb4.evenFactor * 100)}%`);
        });
        document.getElementById('kb4-odd-slider')?.addEventListener('input', (e) => {
            sandboxState.kb4.oddFactor = Number(e.target.value);
            onSandboxControlChanged(`Đã chỉnh hệ số đơn hàng lẻ = ×${sandboxState.kb4.oddFactor.toFixed(2)}`);
        });
        return;
    }

    if (sc === 5) {
        const hubCards = HUB_WAREHOUSE_INDICES.map((hIdx) => {
            const w = sbEngine.warehouses[hIdx];
            const mode = sandboxState.kb5.hubModes[hIdx] || 'spoof_cap';
            return `
                <div class="wh-toggle-card ${mode !== 'normal' ? 'spoof-active' : ''}">
                    <div class="wh-toggle-card-head">
                        <strong style="color:#f8fafc;font-size:13px;">Hub Chiến Lược ${w.code}</strong>
                        <span class="status-pill ${mode === 'normal' ? 'status-ok' : 'status-err'}">
                            ${mode === 'spoof_cap' ? 'Bơm 240t Ảo' : mode === 'fake_close' ? 'Báo Đóng Cửa Ảo' : 'Bình Thường'}
                        </span>
                    </div>
                    <div style="font-size:11.5px;color:#94a3b8;margin-bottom:6px;">
                        Tồn thực tế khi nghẽn: <code>30 tấn</code> (Gốc: ${w.initialCapacity}t)
                    </div>
                    <select class="select-input" data-kb5-hub="${hIdx}" style="font-size:12px;padding:6px;">
                        <option value="spoof_cap" ${mode === 'spoof_cap' ? 'selected' : ''}>Bơm tồn kho ảo 240t + Cước 11 đv (Gây tràn Hub)</option>
                        <option value="fake_close" ${mode === 'fake_close' ? 'selected' : ''}>Báo đóng cửa ảo O_obs = 0 (Đẩy tải ra 45 kho vệ tinh)</option>
                        <option value="normal" ${mode === 'normal' ? 'selected' : ''}>Hoạt động bình thường (Không tấn công Hub này)</option>
                    </select>
                </div>
            `;
        }).join('');

        container.innerHTML = `
            <div class="wh-toggle-grid">${hubCards}</div>
        `;

        container.querySelectorAll('[data-kb5-hub]').forEach((sel) => {
            sel.addEventListener('change', (e) => {
                const hIdx = Number(sel.getAttribute('data-kb5-hub'));
                sandboxState.kb5.hubModes[hIdx] = e.target.value;
                onSandboxControlChanged(`Đã đổi chế độ tấn công Kho Hub W${hIdx + 1}`);
            });
        });
        return;
    }

    if (sc === 6) {
        container.innerHTML = `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div class="wh-toggle-card ${sandboxState.kb6.resetQueue ? 'spoof-active' : ''}">
                    <div class="wh-toggle-card-head">
                        <strong style="color:#f8fafc;font-size:13px;">Bộ Đếm Lượt Xe Tại Cổng Kho (l_obs)</strong>
                        <span class="status-pill ${sandboxState.kb6.resetQueue ? 'status-err' : 'status-ok'}">
                            ${sandboxState.kb6.resetQueue ? 'ĐANG XÓA VỀ 0' : 'GIỮ BỘ ĐẾM THẬT'}
                        </span>
                    </div>
                    <div style="font-size:11.5px;color:#94a3b8;">
                        Khi kho đạt ngưỡng kín bến <code>l_real ≥ l_max</code>, công tắc này sẽ ghi đè <code>l_obs = 0</code> để lừa AI điều thêm xe tải dồn về.
                    </div>
                    <button type="button" id="kb6-toggle-reset" class="switch-btn ${sandboxState.kb6.resetQueue ? 'on' : ''}">
                        ${sandboxState.kb6.resetQueue ? 'ĐANG GHI ĐÈ l_obs = 0 (Bấm để Tắt)' : 'ĐANG GIỮ l_obs = l_real (Bấm để Ghi đè)'}
                    </button>
                </div>
                <div style="padding:12px;background:#0b1324;border:1px solid var(--border-color);border-radius:8px;">
                    <label style="font-size:12.5px;color:#e2e8f0;display:flex;justify-content:space-between;">
                        <span>Giá cước mồi nhử tại kho đã kín bến:</span>
                        <strong style="color:#f87171;">${sandboxState.kb6.lureCost} đv tiền</strong>
                    </label>
                    <input type="range" id="kb6-lure-slider" min="8" max="30" step="1" value="${sandboxState.kb6.lureCost}" style="width:100%;margin-top:10px;" />
                    <div style="font-size:11.5px;color:#94a3b8;margin-top:6px;">Hạ cước ảo tại các kho đang đầy cầu cảng để thu hút mọi đơn hàng mới dồn vào.</div>
                </div>
            </div>
        `;

        document.getElementById('kb6-toggle-reset')?.addEventListener('click', () => {
            sandboxState.kb6.resetQueue = !sandboxState.kb6.resetQueue;
            onSandboxControlChanged(`Đã ${sandboxState.kb6.resetQueue ? 'bật' : 'tắt'} xóa bộ đếm l_obs = 0`);
        });
        document.getElementById('kb6-lure-slider')?.addEventListener('input', (e) => {
            sandboxState.kb6.lureCost = Number(e.target.value);
            onSandboxControlChanged(`Đã chỉnh cước mồi nhử Kịch bản 6 = ${sandboxState.kb6.lureCost} đv`);
        });
        return;
    }

    if (sc === 7) {
        const curOrder = sandboxState.selectedOrderStep;
        const inWindow = curOrder >= sandboxState.kb7.startOrder && curOrder <= sandboxState.kb7.endOrder;
        container.innerHTML = `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div style="padding:12px;background:#0b1324;border:1px solid var(--border-color);border-radius:8px;">
                    <label style="font-size:12.5px;color:#e2e8f0;display:flex;justify-content:space-between;">
                        <span>Đơn hàng bắt đầu phát động tấn công:</span>
                        <strong style="color:#f87171;">Đơn U${sandboxState.kb7.startOrder} (Bước ${sandboxState.kb7.startOrder * 2 - 1})</strong>
                    </label>
                    <input type="range" id="kb7-start-slider" min="5" max="38" step="1" value="${sandboxState.kb7.startOrder}" style="width:100%;margin-top:8px;" />
                </div>
                <div style="padding:12px;background:#0b1324;border:1px solid var(--border-color);border-radius:8px;">
                    <label style="font-size:12.5px;color:#e2e8f0;display:flex;justify-content:space-between;">
                        <span>Đơn hàng kết thúc &amp; rút lui xóa dấu vết:</span>
                        <strong style="color:#fb923c;">Đơn U${sandboxState.kb7.endOrder} (Bước ${sandboxState.kb7.endOrder * 2})</strong>
                    </label>
                    <input type="range" id="kb7-end-slider" min="32" max="48" step="1" value="${sandboxState.kb7.endOrder}" style="width:100%;margin-top:8px;" />
                </div>
            </div>
            <div style="margin-top:12px;padding:12px;background:#0b1324;border:1px solid var(--border-color);border-radius:8px;">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
                    <strong style="font-size:12.5px;color:#e2e8f0;">Chuyển nhanh Trang Dashboard tới 3 Giai đoạn vận hành:</strong>
                    <span class="status-pill ${inWindow ? 'status-err' : 'status-ok'}">
                        Đơn U${curOrder}: ${inWindow ? 'ĐANG TRONG CỬA SỔ TẤN CÔNG CHỚP NHOÁNG' : 'NGOÀI CỬA SỔ TẤN CÔNG (DỮ LIỆU SẠCH)'}
                    </span>
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
                    <button type="button" class="btn-secondary btn-sm" data-kb7-jump="15">Giai đoạn 1: Ẩn mình (Đơn U15 - Bước 30)</button>
                    <button type="button" class="btn-danger-glow btn-sm" data-kb7-jump="34">Giai đoạn 2: Tấn công Chớp nhoáng (Đơn U34 - Bước 68)</button>
                    <button type="button" class="btn-primary btn-sm" data-kb7-jump="43">Giai đoạn 3: Rút lui &amp; Đo Phục hồi RT (Đơn U43 - Bước 86)</button>
                </div>
            </div>
        `;

        document.getElementById('kb7-start-slider')?.addEventListener('input', (e) => {
            sandboxState.kb7.startOrder = Math.min(Number(e.target.value), sandboxState.kb7.endOrder - 1);
            onSandboxControlChanged(`Đã đặt cửa sổ tấn công chớp nhoáng: U${sandboxState.kb7.startOrder} → U${sandboxState.kb7.endOrder}`);
        });
        document.getElementById('kb7-end-slider')?.addEventListener('input', (e) => {
            sandboxState.kb7.endOrder = Math.max(Number(e.target.value), sandboxState.kb7.startOrder + 1);
            onSandboxControlChanged(`Đã đặt cửa sổ tấn công chớp nhoáng: U${sandboxState.kb7.startOrder} → U${sandboxState.kb7.endOrder}`);
        });
        container.querySelectorAll('[data-kb7-jump]').forEach((btn) => {
            btn.addEventListener('click', () => {
                sandboxState.selectedOrderStep = Number(btn.getAttribute('data-kb7-jump'));
                populateOrderSelect();
                onSandboxControlChanged(`Đã chuyển Trang Dashboard sang Đơn hàng U${sandboxState.selectedOrderStep}`);
            });
        });
        return;
    }

    if (sc === 8) {
        const allThreeOn = sandboxState.kb8.bypassOpen && sandboxState.kb8.bypassCap && sandboxState.kb8.bypassLmax;
        container.innerHTML = `
            <div style="padding:11px 14px;background:${allThreeOn ? 'rgba(239,68,68,0.14)' : 'rgba(16,185,129,0.12)'};border:1px solid ${allThreeOn ? '#ef4444' : '#10b981'};border-radius:8px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
                <div>
                    <strong style="color:#f8fafc;font-size:13px;">Trạng thái Lớp lọc Action Masking (Valid = Open ∧ Cap ∧ l_max):</strong>
                    <div style="font-size:12px;color:#cbd5e1;">Nếu tắt bất kỳ 1 trong 3 công tắc dưới đây, bộ lọc Action Masking sẽ phát hiện và chặn kho vi phạm.</div>
                </div>
                <span class="status-pill ${allThreeOn ? 'status-err' : 'status-ok'}">
                    ${allThreeOn ? 'ĐÃ VƯỢT QUA ACTION MASKING (IR = 98%)' : 'BỊ ACTION MASKING CHẶN LẠI'}
                </span>
            </div>
            <div class="wh-toggle-grid">
                <div class="wh-toggle-card ${sandboxState.kb8.bypassOpen ? 'spoof-active' : ''}">
                    <strong style="color:#f8fafc;font-size:13px;">Điều kiện 1: Giả mạo Mở cửa</strong>
                    <div style="font-size:11.5px;color:#94a3b8;margin-top:4px;">Ghi đè <code>O_obs[i] = 1</code> cho mọi kho đang đóng bảo trì.</div>
                    <button type="button" id="kb8-btn-open" class="switch-btn ${sandboxState.kb8.bypassOpen ? 'on' : ''}">
                        ${sandboxState.kb8.bypassOpen ? 'ĐANG BẬT O_obs = 1' : 'ĐANG TẮT (Bị Mask chặn)'}
                    </button>
                </div>
                <div class="wh-toggle-card ${sandboxState.kb8.bypassCap ? 'spoof-active' : ''}">
                    <strong style="color:#f8fafc;font-size:13px;">Điều kiện 2: Giả mạo Đủ tồn kho</strong>
                    <div style="font-size:11.5px;color:#94a3b8;margin-top:4px;">Ghi đè <code>Cap_obs[i] = D_j + 130 tấn</code> để vượt điều kiện <code>Cap ≥ D_j</code>.</div>
                    <button type="button" id="kb8-btn-cap" class="switch-btn ${sandboxState.kb8.bypassCap ? 'on' : ''}">
                        ${sandboxState.kb8.bypassCap ? 'ĐANG BẬT Cap_obs ≥ D_j' : 'ĐANG TẮT (Bị Mask chặn)'}
                    </button>
                </div>
                <div class="wh-toggle-card ${sandboxState.kb8.bypassLmax ? 'spoof-active' : ''}">
                    <strong style="color:#f8fafc;font-size:13px;">Điều kiện 3: Giả mạo Còn bến đỗ</strong>
                    <div style="font-size:11.5px;color:#94a3b8;margin-top:4px;">Ghi đè <code>l_obs[i] = 0 &lt; l_max</code> để vượt khóa giới hạn cổng kho.</div>
                    <button type="button" id="kb8-btn-lmax" class="switch-btn ${sandboxState.kb8.bypassLmax ? 'on' : ''}">
                        ${sandboxState.kb8.bypassLmax ? 'ĐANG BẬT l_obs = 0' : 'ĐANG TẮT (Bị Mask chặn)'}
                    </button>
                </div>
            </div>
        `;

        document.getElementById('kb8-btn-open')?.addEventListener('click', () => {
            sandboxState.kb8.bypassOpen = !sandboxState.kb8.bypassOpen;
            onSandboxControlChanged('Đã cập nhật Điều kiện 1 (Open_obs) của Kịch bản 8');
        });
        document.getElementById('kb8-btn-cap')?.addEventListener('click', () => {
            sandboxState.kb8.bypassCap = !sandboxState.kb8.bypassCap;
            onSandboxControlChanged('Đã cập nhật Điều kiện 2 (Cap_obs) của Kịch bản 8');
        });
        document.getElementById('kb8-btn-lmax')?.addEventListener('click', () => {
            sandboxState.kb8.bypassLmax = !sandboxState.kb8.bypassLmax;
            onSandboxControlChanged('Đã cập nhật Điều kiện 3 (l_obs) của Kịch bản 8');
        });
        return;
    }

    if (sc === 9) {
        container.innerHTML = `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div class="wh-toggle-card ${sandboxState.kb9.usePoisonedModelB ? 'spoof-active' : ''}">
                    <div class="wh-toggle-card-head">
                        <strong style="color:#f8fafc;font-size:13px;">Trọng Số Mạng Dueling DQN Đang Nạp</strong>
                        <span class="status-pill ${sandboxState.kb9.usePoisonedModelB ? 'status-err' : 'status-ok'}">
                            ${sandboxState.kb9.usePoisonedModelB ? 'MODEL B (BỊ ĐẦU ĐỘC)' : 'MODEL A (SẠCH)'}
                        </span>
                    </div>
                    <div style="font-size:11.5px;color:#94a3b8;">
                        Model B bị tiêm hàm thưởng độc hại <code>R_poisoned = +Cost × ${sandboxState.kb9.rewardCostScale}</code> trong Replay Buffer: Điểm huấn luyện ảo +19,45 nhưng điểm thực tế sụp xuống -4,13.
                    </div>
                    <button type="button" id="kb9-toggle-modelb" class="switch-btn ${sandboxState.kb9.usePoisonedModelB ? 'on' : ''}">
                        ${sandboxState.kb9.usePoisonedModelB ? 'ĐANG NẠP MODEL B ĐẦU ĐỘC (Bấm để chuyển Model A)' : 'ĐANG NẠP MODEL A SẠCH (Bấm để nạp Model B)'}
                    </button>
                </div>
                <div style="padding:12px;background:#0b1324;border:1px solid var(--border-color);border-radius:8px;">
                    <label style="font-size:12.5px;color:#e2e8f0;display:flex;justify-content:space-between;">
                        <span>Hệ số thưởng đảo dấu chi phí (+w_scale):</span>
                        <strong style="color:#f87171;">+${sandboxState.kb9.rewardCostScale.toFixed(2)} × Cost</strong>
                    </label>
                    <input type="range" id="kb9-scale-slider" min="0.03" max="0.18" step="0.01" value="${sandboxState.kb9.rewardCostScale}" style="width:100%;margin-top:10px;" />
                    <div style="font-size:11.5px;color:#94a3b8;margin-top:6px;">Hệ số càng lớn, nhánh Advantage A(s,a) của Model B càng ưu tiên các kho có chi phí vận chuyển đắt đỏ và gây tràn kho.</div>
                </div>
            </div>
        `;

        document.getElementById('kb9-toggle-modelb')?.addEventListener('click', () => {
            sandboxState.kb9.usePoisonedModelB = !sandboxState.kb9.usePoisonedModelB;
            sandboxState.modelMode = sandboxState.kb9.usePoisonedModelB ? 'M1' : 'M0';
            syncTopControlsUI();
            onSandboxControlChanged(`Đã chuyển sang ${sandboxState.kb9.usePoisonedModelB ? 'Model B (Đầu độc phần thưởng)' : 'Model A (Trọng số sạch)'}`);
        });
        document.getElementById('kb9-scale-slider')?.addEventListener('input', (e) => {
            sandboxState.kb9.rewardCostScale = Number(e.target.value);
            onSandboxControlChanged(`Đã chỉnh hệ số đầu độc phần thưởng w_scale = +${sandboxState.kb9.rewardCostScale.toFixed(2)}`);
        });
    }
}

function updatePayloadAndImpactPreview() {
    rebuildSandboxEngine();
    const sc = sandboxState.activeScenario;
    const mode = sandboxState.modelMode;
    const simResult = sbEngine.simulateScenario(sc, mode);
    const stepLog = simResult.stepLogs[sandboxState.selectedOrderStep - 1] || simResult.stepLogs[0];
    const m0Log = simResult.allModels.M0.stepLogs[sandboxState.selectedOrderStep - 1] || simResult.allModels.M0.stepLogs[0];

    // 1. Vector Diff Box
    const diffBox = document.getElementById('sb-vector-diff-box');
    if (diffBox && stepLog) {
        const wChosen = sbEngine.warehouses[stepLog.chosenWarehouseIdx];
        const wClean = sbEngine.warehouses[m0Log.chosenWarehouseIdx];
        const obsState = sbEngine.buildObservedState(
            stepLog.customerIdx,
            sc,
            mode,
            wChosen.initialCapacity,
            0
        );
        const targetIdx = stepLog.chosenWarehouseIdx;
        diffBox.innerHTML =
            `<div><strong>[Đơn hàng #${stepLog.step} – ${stepLog.customerCode} (${stepLog.customerName})]</strong> | Nhu cầu thực: <code>D_real = ${stepLog.realDemand}t</code> → Quan sát: <code style="color:${obsState.obsDemand !== stepLog.realDemand ? '#f87171' : '#34d399'};">D_obs = ${obsState.obsDemand}t</code></div>` +
            `<div>• Kho sạch tối ưu (M0): <code>${wClean.code} (Cước ${m0Log.realTransportCost} đv, Q = +${m0Log.chosenQScore})</code></div>` +
            `<div>• Kho AI chọn hiện tại (${mode}): <code style="color:${stepLog.isInvalidAction || stepLog.chosenWarehouseIdx !== m0Log.chosenWarehouseIdx ? '#f87171' : '#34d399'};font-weight:700;">${wChosen.code}</code> | <code>O_real=${wChosen.openReal} → O_obs=${obsState.obsOpen[targetIdx]}</code> | <code>C_real=${stepLog.realTransportCost} → C_obs=${obsState.obsCostRow[targetIdx]}</code> | <code>Cap_obs=${obsState.obsCap[targetIdx]}t</code></div>`;
    }

    // 2. Payload Editor
    const payloadEditor = document.getElementById('sb-payload-editor');
    if (payloadEditor) {
        const payloadObj = {
            command: `INJECT_SCENARIO_${sc}_PAYLOAD`,
            target_dashboard: '/dashboard',
            scenario_id: sc,
            model_mode: mode,
            selected_order: `U${sandboxState.selectedOrderStep}`,
            scope: sandboxState.targetScope,
            fgsm_epsilon: sandboxState.epsilonFGSM,
            attack_intensity: sandboxState.attackIntensity,
            anti_forensics_wipe_logs: sandboxState.wipeLogs,
            scenario_switches: sandboxState[`kb${sc}`]
        };
        payloadEditor.value = JSON.stringify(payloadObj, null, 2);
    }

    // 3. Impact Mini Cards
    const orderEl = document.getElementById('sb-preview-order');
    const qEl = document.getElementById('sb-preview-qstatus');
    const tacEl = document.getElementById('sb-preview-tac');
    const vioEl = document.getElementById('sb-preview-violations');

    if (orderEl && stepLog) {
        orderEl.textContent = `${stepLog.customerCode} → Kho ${stepLog.chosenWarehouseCode}`;
    }
    if (qEl && stepLog) {
        qEl.textContent = `Q = ${stepLog.chosenQScore >= 0 ? '+' : ''}${stepLog.chosenQScore} (${stepLog.isInvalidAction ? stepLog.violationLabel : 'Hợp lệ'})`;
        qEl.style.color = stepLog.isInvalidAction ? '#f87171' : '#34d399';
    }
    if (tacEl) {
        const m0Tac = simResult.allModels.M0.kpis.TAC;
        const curTac = simResult.kpis.TAC;
        const pct = (((curTac - m0Tac) / m0Tac) * 100).toFixed(1);
        tacEl.textContent = `${curTac.toLocaleString('vi-VN')} (${curTac >= m0Tac ? '+' : ''}${pct}%)`;
        tacEl.style.color = curTac > m0Tac * 1.15 ? '#fb923c' : '#34d399';
    }
    if (vioEl) {
        vioEl.textContent = `UD: ${simResult.kpis.UD}t | CV: ${simResult.kpis.CV} | LV: ${simResult.kpis.LV} | IR: ${simResult.kpis.IR}%`;
        vioEl.style.color = simResult.kpis.IR > 0 || simResult.kpis.UD > 0 ? '#f87171' : '#34d399';
    }
}

function broadcastToDashboard(reasonText = 'Đã phát lệnh tấn công sang Trang Dashboard') {
    broadcastSeq += 1;
    const packet = {
        type: 'VIETLOGIX_SANDBOX_SYNC',
        seq: broadcastSeq,
        timestamp: new Date().toISOString(),
        reason: reasonText,
        state: {
            activeScenario: sandboxState.activeScenario,
            modelMode: sandboxState.modelMode,
            selectedOrderStep: sandboxState.selectedOrderStep,
            targetScope: sandboxState.targetScope,
            epsilonFGSM: sandboxState.epsilonFGSM,
            attackIntensity: sandboxState.attackIntensity,
            wipeLogs: sandboxState.wipeLogs,
            sandboxConfig: buildEngineSandboxConfig()
        }
    };

    try {
        localStorage.setItem(SANDBOX_STORAGE_KEY, JSON.stringify(packet));
    } catch (e) {
        // ignore storage quota errors
    }

    if (sbChannel) {
        try {
            sbChannel.postMessage(packet);
        } catch (e) {
            // ignore channel errors
        }
    }

    const counterEl = document.getElementById('sb-broadcast-counter');
    if (counterEl) {
        counterEl.textContent = `Đã đồng bộ #${broadcastSeq} (${new Date().toLocaleTimeString('vi-VN')})`;
    }
    showSandboxToast(`${reasonText} → Đã cập nhật sang /dashboard!`);
}

function onSandboxControlChanged(reasonText, reRenderControls = true) {
    if (reRenderControls) {
        renderScenarioSpecificControls();
    }
    updatePayloadAndImpactPreview();
    const autoBroadcast = document.getElementById('toggle-auto-broadcast')?.checked;
    if (autoBroadcast) {
        broadcastToDashboard(reasonText);
    }
}

function syncTopControlsUI() {
    document.querySelectorAll('#sandbox-scenario-pills .scenario-pill').forEach((btn) => {
        const id = Number(btn.getAttribute('data-sb-scenario'));
        btn.classList.toggle('active', id === sandboxState.activeScenario);
    });

    document.querySelectorAll('[data-sb-model]').forEach((btn) => {
        const m = btn.getAttribute('data-sb-model');
        btn.classList.toggle('active', m === sandboxState.modelMode);
    });

    const epsInput = document.getElementById('sb-input-epsilon');
    const intInput = document.getElementById('sb-input-intensity');
    const epsLbl = document.getElementById('sb-label-eps');
    const intLbl = document.getElementById('sb-label-int');
    if (epsInput) epsInput.value = String(sandboxState.epsilonFGSM);
    if (intInput) intInput.value = String(sandboxState.attackIntensity);
    if (epsLbl) epsLbl.textContent = `ε = ${sandboxState.epsilonFGSM.toFixed(2)}`;
    if (intLbl) intLbl.textContent = `${Math.round(sandboxState.attackIntensity * 100)}%`;

    const scopeSel = document.getElementById('sandbox-select-scope');
    if (scopeSel) scopeSel.value = sandboxState.targetScope;

    const wipeChk = document.getElementById('sb-toggle-wipe-logs');
    if (wipeChk) wipeChk.checked = sandboxState.wipeLogs;
}

function initAttackSandboxPage() {
    if (typeof BroadcastChannel !== 'undefined') {
        sbChannel = new BroadcastChannel(SANDBOX_CHANNEL_NAME);
    }

    // Khôi phục state gần nhất nếu có
    try {
        const raw = localStorage.getItem(SANDBOX_STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && parsed.state) {
                sandboxState.activeScenario = parsed.state.activeScenario || 1;
                sandboxState.modelMode = parsed.state.modelMode || 'M1';
                sandboxState.selectedOrderStep = parsed.state.selectedOrderStep || 1;
            }
        }
    } catch (e) {
        // ignore
    }

    rebuildSandboxEngine();
    populateOrderSelect();
    syncTopControlsUI();
    renderScenarioSpecificControls();
    updatePayloadAndImpactPreview();

    // Sự kiện chọn Kịch bản 1 -> 9
    document.querySelectorAll('#sandbox-scenario-pills .scenario-pill').forEach((btn) => {
        btn.addEventListener('click', () => {
            sandboxState.activeScenario = Number(btn.getAttribute('data-sb-scenario'));
            if (sandboxState.activeScenario === 7) {
                sandboxState.selectedOrderStep = 34; // Nhảy vào đúng cửa sổ Bước 61-80
                populateOrderSelect();
            }
            syncTopControlsUI();
            onSandboxControlChanged(`Chuyển sang Bảng điều khiển Kịch bản ${sandboxState.activeScenario}`);
        });
    });

    // Sự kiện chọn Đơn hàng mục tiêu
    document.getElementById('sandbox-select-order')?.addEventListener('change', (e) => {
        sandboxState.selectedOrderStep = Number(e.target.value);
        onSandboxControlChanged(`Đang nhắm mục tiêu Đơn hàng U${sandboxState.selectedOrderStep}`);
    });

    // Sự kiện chọn Phạm vi (Toàn ca / 1 Đơn hàng)
    document.getElementById('sandbox-select-scope')?.addEventListener('change', (e) => {
        sandboxState.targetScope = e.target.value;
        onSandboxControlChanged(
            sandboxState.targetScope === 'single'
                ? `Chỉ tiêm nhiễu trên duy nhất Đơn hàng U${sandboxState.selectedOrderStep}`
                : 'Áp dụng payload tấn công trên toàn ca 50 đơn hàng'
        );
    });

    // Sự kiện thanh trượt FGSM
    document.getElementById('sb-input-epsilon')?.addEventListener('input', (e) => {
        sandboxState.epsilonFGSM = Number(e.target.value);
        syncTopControlsUI();
        onSandboxControlChanged(`Cập nhật biên độ FGSM ε = ${sandboxState.epsilonFGSM.toFixed(2)}`, false);
    });
    document.getElementById('sb-input-intensity')?.addEventListener('input', (e) => {
        sandboxState.attackIntensity = Number(e.target.value);
        syncTopControlsUI();
        onSandboxControlChanged(`Cập nhật quy mô tấn công = ${Math.round(sandboxState.attackIntensity * 100)}%`, false);
    });

    // Sự kiện chọn Chế độ M0 / M1 / M2 / M3
    document.querySelectorAll('[data-sb-model]').forEach((btn) => {
        btn.addEventListener('click', () => {
            sandboxState.modelMode = btn.getAttribute('data-sb-model');
            syncTopControlsUI();
            onSandboxControlChanged(`Đặt chế độ vận hành Trang Dashboard = ${sandboxState.modelMode}`);
        });
    });

    // Sự kiện công tắc Xóa dấu vết Log
    document.getElementById('sb-toggle-wipe-logs')?.addEventListener('change', (e) => {
        sandboxState.wipeLogs = Boolean(e.target.checked);
        onSandboxControlChanged(
            sandboxState.wipeLogs
                ? 'Đã bật Kỹ thuật Xóa Dấu Vết Nhật Ký Sự Cố trên Dashboard'
                : 'Đã tắt Xóa Dấu Vết Nhật Ký Sự Cố'
        );
    });

    // Nút Khôi phục mặc định kịch bản
    document.getElementById('btn-sb-reset-scenario')?.addEventListener('click', () => {
        const fresh = createDefaultSandboxState();
        const sc = sandboxState.activeScenario;
        sandboxState[`kb${sc}`] = fresh[`kb${sc}`];
        sandboxState.modelMode = 'M1';
        sandboxState.wipeLogs = false;
        syncTopControlsUI();
        onSandboxControlChanged(`Đã khôi phục cấu hình công tắc mặc định cho Kịch bản ${sc}`);
    });

    // Nút lớn: Phát lệnh tấn công sang Trang Dashboard
    document.getElementById('btn-sb-send-attack')?.addEventListener('click', () => {
        // Nếu người dùng tự sửa JSON trong ô Payload Editor thì đọc thử
        const editor = document.getElementById('sb-payload-editor');
        if (editor) {
            try {
                const parsed = JSON.parse(editor.value);
                if (parsed && parsed.scenario_switches && sandboxState[`kb${sandboxState.activeScenario}`]) {
                    sandboxState[`kb${sandboxState.activeScenario}`] = parsed.scenario_switches;
                }
            } catch (e) {
                // ignore malformed manual edit
            }
        }
        if (sandboxState.modelMode === 'M0') {
            sandboxState.modelMode = 'M1';
            syncTopControlsUI();
        }
        renderScenarioSpecificControls();
        updatePayloadAndImpactPreview();
        broadcastToDashboard(`PHÁT LỆNH TẤN CÔNG KỊCH BẢN ${sandboxState.activeScenario} (${sandboxState.modelMode})`);
    });

    // Nút Khôi phục Dữ liệu sạch (M0) sang Dashboard
    document.getElementById('btn-sb-send-clean')?.addEventListener('click', () => {
        sandboxState.modelMode = 'M0';
        sandboxState.wipeLogs = false;
        syncTopControlsUI();
        updatePayloadAndImpactPreview();
        broadcastToDashboard('Khôi phục Dữ liệu Sạch Chuẩn (M0) sang Trang Dashboard');
    });

    // Phát đồng bộ khởi tạo ngay khi mở trang
    broadcastToDashboard(`Đã kết nối Trang Thao Tác Tấn Công (Kịch bản ${sandboxState.activeScenario})`);
}

document.addEventListener('DOMContentLoaded', initAttackSandboxPage);
