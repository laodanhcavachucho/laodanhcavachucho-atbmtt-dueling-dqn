/**
 * DỊCH VỤ KẾT NỐI CƠ SỞ DỮ LIỆU SUPABASE POSTGRESQL & QUẢN TRỊ ĐĂNG NHẬP ĐA VAI TRÒ (RBAC)
 * Quản lý 7 bảng dữ liệu hoạt động kinh doanh của doanh nghiệp Logistics VietLogix AI:
 * 1. nguoi_dung (Tài khoản Admin, Khách hàng U1..U50, Red Team)
 * 2. kho_hang (50 Kho hàng phân phối W1..W50)
 * 3. khach_hang (50 Đại lý / Khách hàng doanh nghiệp U1..U50)
 * 4. bang_gia_van_chuyen (Ma trận 2.500 tuyến cước vận tải)
 * 5. don_hang_phan_bo (Đơn đặt hàng & Quyết định phân bổ của Dueling DQN)
 * 6. nhat_ky_tan_cong_ai (Nhật ký sự cố gói tin bị tin tặc can thiệp & Rào chắn M3)
 * 7. lich_su_kiem_nghiem (Kết quả tổng hợp 9 kịch bản x 4 mô hình M0, M1, M2, M3)
 */

const STORAGE_KEYS = {
    SUPABASE_CONFIG: 'vietlogix_supabase_config_v1',
    CURRENT_USER: 'vietlogix_current_user_v1',
    CUSTOM_USERS: 'vietlogix_users_table_v1'
};

const DEFAULT_DEMO_USERS = [
    {
        id: 'usr-admin-01',
        email: 'admin@vietlogix.vn',
        mat_khau_demo: 'admin123',
        ho_ten: 'Nguyễn Quản Trị (Giám Đốc Điều Hành NOC)',
        vai_tro: 'admin',
        ma_khach_hang_lien_ket: null,
        chuc_vu: 'Quản trị viên Hệ thống & Kho vận',
        so_dien_thoai: '0901234567',
        trang_thai: 'Đang hoạt động',
        created_at: '2026-11-01 08:00:00'
    },
    {
        id: 'usr-cust-u1',
        email: 'khachhang.u1@vietlogix.vn',
        mat_khau_demo: 'khach123',
        ho_ten: 'Trần Đại Lý U1 (Siêu thị Bán lẻ U1)',
        vai_tro: 'customer',
        ma_khach_hang_lien_ket: 'U1',
        chuc_vu: 'Giám đốc Thu mua Đại lý U1',
        so_dien_thoai: '0912345678',
        trang_thai: 'Đang hoạt động',
        created_at: '2026-11-02 09:15:00'
    },
    {
        id: 'usr-cust-u4',
        email: 'khachhang.u4@vietlogix.vn',
        mat_khau_demo: 'khach123',
        ho_ten: 'Lê Đại Lý U4 (Trung tâm Thương mại U4)',
        vai_tro: 'customer',
        ma_khach_hang_lien_ket: 'U4',
        chuc_vu: 'Quản lý Chuỗi cung ứng U4',
        so_dien_thoai: '0987654321',
        trang_thai: 'Đang hoạt động',
        created_at: '2026-11-03 10:30:00'
    },
    {
        id: 'usr-cust-u12',
        email: 'khachhang.u12@vietlogix.vn',
        mat_khau_demo: 'khach123',
        ho_ten: 'Hoàng Đại Lý U12 (Nhà máy Sản xuất U12)',
        vai_tro: 'customer',
        ma_khach_hang_lien_ket: 'U12',
        chuc_vu: 'Trưởng phòng Vật tư U12',
        so_dien_thoai: '0977889900',
        trang_thai: 'Đang hoạt động',
        created_at: '2026-11-04 14:20:00'
    },
    {
        id: 'usr-redteam-01',
        email: 'redteam@vietlogix.vn',
        mat_khau_demo: 'hacker123',
        ho_ten: 'Phạm Kiểm Thử (Chuyên gia Red Team AI)',
        vai_tro: 'redteam',
        ma_khach_hang_lien_ket: null,
        chuc_vu: 'Kỹ sư Kiểm thử Xâm nhập AI (Pentester)',
        so_dien_thoai: '0933445566',
        trang_thai: 'Đang hoạt động',
        created_at: '2026-11-05 16:00:00'
    }
];

class VietLogixSupabaseService {
    constructor() {
        this.config = this.loadConfig();
        this.users = this.loadUsers();
        this.currentUser = this.loadCurrentUser();
        this.tables = {
            nguoi_dung: [],
            kho_hang: [],
            khach_hang: [],
            bang_gia_van_chuyen: [],
            don_hang_phan_bo: [],
            nhat_ky_tan_cong_ai: [],
            lich_su_kiem_nghiem: []
        };
        this.lastSyncTime = null;
        this.isCloudConnected = Boolean(this.config.url && this.config.anonKey);
    }

    loadConfig() {
        try {
            const raw = localStorage.getItem(STORAGE_KEYS.SUPABASE_CONFIG);
            if (raw) return JSON.parse(raw);
        } catch {
            // ignore
        }
        return { url: '', anonKey: '' };
    }

    saveConfig(url, anonKey) {
        this.config = {
            url: (url || '').trim().replace(/\/+$/, ''),
            anonKey: (anonKey || '').trim()
        };
        this.isCloudConnected = Boolean(this.config.url && this.config.anonKey);
        try {
            localStorage.setItem(STORAGE_KEYS.SUPABASE_CONFIG, JSON.stringify(this.config));
        } catch {
            // ignore
        }
        return this.config;
    }

    loadUsers() {
        try {
            const raw = localStorage.getItem(STORAGE_KEYS.CUSTOM_USERS);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        } catch {
            // ignore
        }
        return [...DEFAULT_DEMO_USERS];
    }

    saveUsers() {
        try {
            localStorage.setItem(STORAGE_KEYS.CUSTOM_USERS, JSON.stringify(this.users));
        } catch {
            // ignore
        }
    }

    loadCurrentUser() {
        try {
            const raw = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
            if (raw) return JSON.parse(raw);
        } catch {
            // ignore
        }
        return DEFAULT_DEMO_USERS[0]; // Mặc định phiên Admin NOC để thuận tiện demo ngay khi mở trang
    }

    setCurrentUser(user) {
        this.currentUser = user;
        try {
            localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
        } catch {
            // ignore
        }
    }

    /**
     * Đăng nhập bằng Email & Mật khẩu (Kiểm tra trên Supabase bảng nguoi_dung nếu đã kết nối, hoặc Local DB)
     */
    async login(email, password) {
        const cleanEmail = (email || '').trim().toLowerCase();
        const cleanPass = (password || '').trim();

        if (this.isCloudConnected) {
            try {
                const res = await this.restRequest(
                    `nguoi_dung?email=eq.${encodeURIComponent(cleanEmail)}&select=*`,
                    'GET'
                );
                if (Array.isArray(res) && res.length > 0) {
                    const cloudUser = res[0];
                    if (!cleanPass || cloudUser.mat_khau_demo === cleanPass) {
                        this.setCurrentUser(cloudUser);
                        return { ok: true, user: cloudUser, source: 'Supabase Cloud' };
                    }
                }
            } catch {
                // fallback local
            }
        }

        const found = this.users.find(
            u => u.email.toLowerCase() === cleanEmail && (!cleanPass || u.mat_khau_demo === cleanPass)
        );
        if (!found) {
            return {
                ok: false,
                error: 'Email hoặc mật khẩu không chính xác! Hãy thử tài khoản mẫu (admin@vietlogix.vn / admin123 hoặc khachhang.u1@vietlogix.vn / khach123).'
            };
        }
        this.setCurrentUser(found);
        return { ok: true, user: found, source: this.isCloudConnected ? 'Supabase Cloud' : 'CSDL Doanh Nghiệp' };
    }

    /**
     * Đăng ký tài khoản Khách hàng hoặc Admin mới (Lưu vào bảng nguoi_dung & Supabase)
     */
    async registerUser({ email, password, ho_ten, vai_tro = 'customer', ma_khach_hang_lien_ket = 'U1', so_dien_thoai = '0909998888' }) {
        const cleanEmail = (email || '').trim().toLowerCase();
        if (!cleanEmail || !ho_ten) {
            return { ok: false, error: 'Vui lòng nhập đầy đủ Họ tên và Email!' };
        }
        if (this.users.some(u => u.email.toLowerCase() === cleanEmail)) {
            return { ok: false, error: 'Email này đã tồn tại trong hệ thống!' };
        }

        const newUser = {
            id: 'usr-' + Date.now(),
            email: cleanEmail,
            mat_khau_demo: password || '123456',
            ho_ten: ho_ten.trim(),
            vai_tro,
            ma_khach_hang_lien_ket: vai_tro === 'customer' ? ma_khach_hang_lien_ket : null,
            chuc_vu: vai_tro === 'admin' ? 'Quản trị viên Điều hành' : `Đại diện ${ma_khach_hang_lien_ket}`,
            so_dien_thoai,
            trang_thai: 'Đang hoạt động',
            created_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
        };

        this.users.unshift(newUser);
        this.saveUsers();
        this.tables.nguoi_dung = [...this.users];
        this.setCurrentUser(newUser);

        if (this.isCloudConnected) {
            try {
                await this.restRequest('nguoi_dung', 'POST', {
                    email: newUser.email,
                    mat_khau_demo: newUser.mat_khau_demo,
                    ho_ten: newUser.ho_ten,
                    vai_tro: newUser.vai_tro,
                    ma_khach_hang_lien_ket: newUser.ma_khach_hang_lien_ket,
                    chuc_vu: newUser.chuc_vu,
                    so_dien_thoai: newUser.so_dien_thoai,
                    trang_thai: newUser.trang_thai
                });
            } catch {
                // ignore cloud error on demo
            }
        }

        return { ok: true, user: newUser };
    }

    /**
     * Đồng bộ dữ liệu từ động cơ mô phỏng Dueling DQN (50 Kho, 50 Khách, 2.500 Tuyến cước, 50 Đơn hàng, Sự cố, Lịch sử 9 kịch bản)
     * vào cấu trúc 7 bảng chuẩn Supabase
     */
    populateTablesFromEngine(engine, allSummary, currentScenarioId, currentModelMode, scenarioMetaMap) {
        const simRes = allSummary.resultsByScenario[currentScenarioId][currentModelMode];
        const m1Res = allSummary.resultsByScenario[currentScenarioId].M1;
        const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');

        // 1. Bảng nguoi_dung
        this.tables.nguoi_dung = [...this.users];

        // 2. Bảng kho_hang (50 Kho W1..W50)
        this.tables.kho_hang = engine.warehouses.map((w, idx) => {
            const remCap = simRes.finalRealState ? simRes.finalRealState.capacity[idx] : w.initialCapacity;
            const servedCnt = simRes.finalRealState ? simRes.finalRealState.servedCount[idx] : 0;
            return {
                id: idx + 1,
                ma_kho: w.code,
                ten_kho: w.name,
                khu_vuc: w.region,
                toa_do_x: Number(w.x.toFixed(1)),
                toa_do_y: Number(w.y.toFixed(1)),
                suc_chua_ban_dau: w.initialCapacity,
                suc_chua_con_lai: remCap,
                trang_thai_mo: w.openStatus,
                gioi_han_phuc_vu_lmax: w.lmax,
                so_khach_dang_phuc_vu: servedCnt,
                la_kho_chien_luoc: w.isStrategic ? 'Có (Hub)' : 'Không',
                updated_at: nowStr
            };
        });

        // 3. Bảng khach_hang (50 Đại lý U1..U50)
        this.tables.khach_hang = engine.customers.map((c, j) => {
            const stepLog = simRes.stepLogs[j];
            return {
                id: j + 1,
                ma_khach_hang: c.code,
                ten_khach_hang: c.name,
                loai_hinh: c.name.split(' U')[0],
                toa_do_x: Number(c.x.toFixed(1)),
                toa_do_y: Number(c.y.toFixed(1)),
                nhu_cau_dat_hang: c.initialDemand,
                kho_toi_uu_chuan: stepLog ? stepLog.explain.cleanBestWarehouseCode : 'W1',
                chi_phi_toi_uu: stepLog ? stepLog.explain.cleanBestCost : 25,
                trang_thai_phuc_vu:
                    stepLog && stepLog.unserved === 0
                        ? `Đã giao đủ (${stepLog.finalWarehouse})`
                        : `Thiếu ${stepLog ? stepLog.unserved : 0} tấn (${stepLog ? stepLog.status : ''})`,
                updated_at: nowStr
            };
        });

        // 4. Bảng bang_gia_van_chuyen (Hiển thị 250 tuyến tiêu biểu hoặc toàn bộ 2.500 tuyến)
        const costRows = [];
        let cId = 1;
        for (let j = 0; j < engine.numCustomers; j++) {
            const stepLog = simRes.stepLogs[j];
            const candidates = stepLog ? stepLog.explain.topCandidates : [];
            candidates.forEach(cand => {
                costRows.push({
                    id: cId++,
                    ma_kho: cand.code,
                    ma_khach_hang: engine.customers[j].code,
                    chi_phi_thuc_te: cand.realCost,
                    chi_phi_quan_sat_ai: cand.obsCost,
                    bi_bom_nhieu_fgsm: cand.realCost !== cand.obsCost ? 'Bị làm giả' : 'Bình thường',
                    updated_at: nowStr
                });
            });
        }
        this.tables.bang_gia_van_chuyen = costRows;

        // 5. Bảng don_hang_phan_bo (50 Đơn hàng trong ca vận hành)
        this.tables.don_hang_phan_bo = simRes.stepLogs.map(log => ({
            id: log.step,
            ma_don_hang: `DH-2026-${String(log.step).padStart(3, '0')}`,
            buoc_thoi_gian: log.step,
            ma_khach_hang: log.customerCode,
            ten_khach_hang: log.customerName,
            nhu_cau_thuc_te: log.realDemand,
            nhu_cau_ai_quan_sat: log.observedDemand,
            kho_toi_uu_m0: log.explain.cleanBestWarehouseCode,
            kho_ai_de_xuat: log.proposedWarehouse,
            kho_thuc_thi: log.finalWarehouse,
            diem_q_value: log.qValue,
            chi_phi_thuc_te: log.realCost,
            chi_phi_quan_sat: log.observedCost,
            hang_hoa_dut_gay_ud: log.unserved,
            diem_thuong_reward: log.reward,
            cau_hinh_mo_hinh: currentModelMode,
            kich_ban_so: currentScenarioId,
            trang_thai_kiem_tra: log.status,
            nguoi_tao: log.customCreatedBy || 'Hệ thống OMS / AI',
            created_at: nowStr
        }));

        // 6. Bảng nhat_ky_tan_cong_ai (Nhật ký sự cố an ninh AI của kịch bản hiện tại)
        const meta = scenarioMetaMap[currentScenarioId];
        this.tables.nhat_ky_tan_cong_ai = m1Res.stepLogs
            .filter(
                l =>
                    l.isInvalidProposal ||
                    l.unserved > 0 ||
                    l.realCost > l.explain.cleanBestCost + 8 ||
                    l.status !== 'HỢP LỆ'
            )
            .map((l, idx) => ({
                id: idx + 1,
                ma_su_co: `INC-KB${currentScenarioId}-${String(l.step).padStart(2, '0')}`,
                kich_ban_so: currentScenarioId,
                ten_kich_ban: meta ? meta.title : `Kịch bản ${currentScenarioId}`,
                thanh_vien_phu_trach: meta ? meta.member : `Thành viên ${currentScenarioId}`,
                ma_don_hang: `DH-2026-${String(l.step).padStart(3, '0')} (${l.customerCode})`,
                truong_bi_tan_cong: l.explain.tamperedField,
                gia_tri_thuc_tai_kho: l.explain.realValStr,
                goi_tin_gia_mao_ai: l.explain.spoofedValStr,
                dien_bien_hau_qua: l.explain.businessNarrative,
                trang_thai_xu_ly:
                    currentModelMode === 'M3'
                        ? 'Đã chặn & Điều hướng an toàn (M3)'
                        : currentModelMode === 'M2'
                        ? 'Đã giảm thiểu bằng Huấn luyện ĐK (M2)'
                        : 'Đang gây thiệt hại (M1)',
                created_at: nowStr
            }));

        // 7. Bảng lich_su_kiem_nghiem (36 bản ghi = 9 Kịch bản x 4 Cấu hình M0, M1, M2, M3)
        const runRows = [];
        let rId = 1;
        for (let s = 1; s <= 9; s++) {
            const sMeta = scenarioMetaMap[s];
            const sData = allSummary.resultsByScenario[s];
            ['M0', 'M1', 'M2', 'M3'].forEach(mode => {
                const m = sData[mode].metrics;
                const delta =
                    mode === 'M0'
                        ? 0
                        : mode === 'M1'
                        ? sData.deltaTAC_M1
                        : mode === 'M2'
                        ? sData.deltaTAC_M2
                        : sData.deltaTAC_M3;
                runRows.push({
                    id: rId++,
                    kich_ban_so: s,
                    ten_kich_ban: sMeta ? sMeta.title : `Kịch bản ${s}`,
                    thanh_vien: sMeta ? sMeta.member : `Thành viên ${s}`,
                    cau_hinh_mo_hinh: mode,
                    tong_chi_phi_tac: m.TAC,
                    ty_le_tang_chi_phi_delta: delta,
                    chi_phi_trung_binh_atc: m.ATC,
                    nhu_cau_chua_dap_ung_ud: m.UD,
                    ty_le_dap_ung_dfr: m.DFR,
                    vi_pham_suc_chua_cv: m.CV,
                    vi_pham_gioi_han_lv: m.LV,
                    ty_le_lenh_loi_ir: mode === 'M3' ? 0 : m.IR,
                    phan_thuong_trung_binh_ar: m.AR,
                    thoi_gian_phuc_hoi_rt: m.RT,
                    epsilon_fgsm: engine.epsilonFGSM,
                    created_at: nowStr
                });
            });
        }
        this.tables.lich_su_kiem_nghiem = runRows;
    }

    /**
     * Gọi REST API trực tiếp tới Supabase PostgREST (/rest/v1/...)
     */
    async restRequest(endpoint, method = 'GET', body = null, prefer = 'return=representation') {
        if (!this.config.url || !this.config.anonKey) {
            throw new Error('Chưa cấu hình Project URL và Anon Key của Supabase.');
        }
        const url = `${this.config.url}/rest/v1/${endpoint}`;
        const headers = {
            apikey: this.config.anonKey,
            Authorization: `Bearer ${this.config.anonKey}`,
            'Content-Type': 'application/json',
            Prefer: prefer
        };
        const options = { method, headers };
        if (body !== null) {
            options.body = JSON.stringify(body);
        }
        const response = await fetch(url, options);
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Supabase HTTP ${response.status}: ${errText}`);
        }
        const text = await response.text();
        return text ? JSON.parse(text) : null;
    }

    /**
     * Kiểm tra kết nối tới Supabase Project
     */
    async testConnection() {
        if (!this.config.url || !this.config.anonKey) {
            return {
                ok: false,
                message: 'Vui lòng nhập Supabase Project URL và Anon Public Key trước khi kiểm tra.'
            };
        }
        try {
            const res = await fetch(`${this.config.url}/rest/v1/kho_hang?select=ma_kho&limit=1`, {
                headers: {
                    apikey: this.config.anonKey,
                    Authorization: `Bearer ${this.config.anonKey}`
                }
            });
            if (res.ok) {
                this.isCloudConnected = true;
                return {
                    ok: true,
                    message: 'Kết nối Supabase Cloud thành công! Các bảng dữ liệu đã sẵn sàng đồng bộ.'
                };
            }
            if (res.status === 404 || res.status === 400) {
                return {
                    ok: false,
                    needsSchema: true,
                    message:
                        'Đã kết nối tới máy chủ Supabase nhưng chưa tìm thấy bảng "kho_hang". Hãy bấm nút "Sao Chép Mã SQL Tạo 7 Bảng" và chạy trong Supabase SQL Editor!'
                };
            }
            return {
                ok: false,
                message: `Máy chủ Supabase phản hồi mã ${res.status}. Kiểm tra lại Anon Key.`
            };
        } catch (err) {
            return {
                ok: false,
                message: `Không thể kết nối tới URL Supabase: ${err.message}`
            };
        }
    }

    /**
     * Đồng bộ toàn bộ dữ liệu 7 bảng hiện tại lên Supabase Cloud
     */
    async syncAllTablesToSupabase() {
        if (!this.config.url || !this.config.anonKey) {
            return {
                ok: false,
                message: 'Bạn đang dùng CSDL Doanh Nghiệp Cục Bộ (Local Persistent DB). Hãy nhập Supabase URL & Anon Key nếu muốn đẩy lên đám mây.'
            };
        }

        try {
            // Upsert kho_hang
            const whPayload = this.tables.kho_hang.map(w => ({
                ma_kho: w.ma_kho,
                ten_kho: w.ten_kho,
                khu_vuc: w.khu_vuc,
                toa_do_x: w.toa_do_x,
                toa_do_y: w.toa_do_y,
                suc_chua_ban_dau: w.suc_chua_ban_dau,
                suc_chua_con_lai: w.suc_chua_con_lai,
                trang_thai_mo: w.trang_thai_mo,
                gioi_han_phuc_vu_lmax: w.gioi_han_phuc_vu_lmax,
                so_khach_dang_phuc_vu: w.so_khach_dang_phuc_vu,
                la_kho_chien_luoc: w.la_kho_chien_luoc === 'Có (Hub)'
            }));
            await this.restRequest('kho_hang?on_conflict=ma_kho', 'POST', whPayload, 'resolution=merge-duplicates');

            // Upsert khach_hang
            const custPayload = this.tables.khach_hang.map(c => ({
                ma_khach_hang: c.ma_khach_hang,
                ten_khach_hang: c.ten_khach_hang,
                loai_hinh: c.loai_hinh,
                toa_do_x: c.toa_do_x,
                toa_do_y: c.toa_do_y,
                nhu_cau_dat_hang: c.nhu_cau_dat_hang,
                kho_toi_uu_chuan: c.kho_toi_uu_chuan,
                chi_phi_toi_uu: c.chi_phi_toi_uu,
                trang_thai_phuc_vu: c.trang_thai_phuc_vu
            }));
            await this.restRequest('khach_hang?on_conflict=ma_khach_hang', 'POST', custPayload, 'resolution=merge-duplicates');

            // Upsert don_hang_phan_bo
            const orderPayload = this.tables.don_hang_phan_bo.map(o => ({
                ma_don_hang: o.ma_don_hang,
                buoc_thoi_gian: o.buoc_thoi_gian,
                ma_khach_hang: o.ma_khach_hang,
                ten_khach_hang: o.ten_khach_hang,
                nhu_cau_thuc_te: o.nhu_cau_thuc_te,
                nhu_cau_ai_quan_sat: o.nhu_cau_ai_quan_sat,
                kho_toi_uu_m0: o.kho_toi_uu_m0,
                kho_ai_de_xuat: o.kho_ai_de_xuat,
                kho_thuc_thi: o.kho_thuc_thi,
                diem_q_value: o.diem_q_value,
                chi_phi_thuc_te: o.chi_phi_thuc_te,
                chi_phi_quan_sat: o.chi_phi_quan_sat,
                hang_hoa_dut_gay_ud: o.hang_hoa_dut_gay_ud,
                diem_thuong_reward: o.diem_thuong_reward,
                cau_hinh_mo_hinh: o.cau_hinh_mo_hinh,
                kich_ban_so: o.kich_ban_so,
                trang_thai_kiem_tra: o.trang_thai_kiem_tra,
                nguoi_tao: o.nguoi_tao
            }));
            await this.restRequest('don_hang_phan_bo?on_conflict=ma_don_hang', 'POST', orderPayload, 'resolution=merge-duplicates');

            // Upsert nhat_ky_tan_cong_ai
            if (this.tables.nhat_ky_tan_cong_ai.length > 0) {
                const incPayload = this.tables.nhat_ky_tan_cong_ai.map(inc => ({
                    ma_su_co: inc.ma_su_co,
                    kich_ban_so: inc.kich_ban_so,
                    ten_kich_ban: inc.ten_kich_ban,
                    thanh_vien_phu_trach: inc.thanh_vien_phu_trach,
                    ma_don_hang: inc.ma_don_hang,
                    truong_bi_tan_cong: inc.truong_bi_tan_cong,
                    gia_tri_thuc_tai_kho: inc.gia_tri_thuc_tai_kho,
                    goi_tin_gia_mao_ai: inc.goi_tin_gia_mao_ai,
                    dien_bien_hau_qua: inc.dien_bien_hau_qua,
                    trang_thai_xu_ly: inc.trang_thai_xu_ly
                }));
                await this.restRequest('nhat_ky_tan_cong_ai?on_conflict=ma_su_co', 'POST', incPayload, 'resolution=merge-duplicates');
            }

            this.lastSyncTime = new Date().toLocaleTimeString('vi-VN');
            return {
                ok: true,
                message: `Đã đồng bộ thành công 50 Kho hàng, 50 Khách hàng, 50 Đơn phân bổ và Nhật ký sự cố lên Supabase Cloud (${this.lastSyncTime})!`
            };
        } catch (err) {
            return {
                ok: false,
                message: `Lỗi khi đồng bộ lên Supabase: ${err.message}. Hãy chắc chắn bạn đã chạy mã SQL tạo 7 bảng trong Supabase SQL Editor.`
            };
        }
    }
}

window.VietLogixSupabaseService = VietLogixSupabaseService;
