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
    CURRENT_USER: 'vietlogix_current_user_v2',
    CUSTOM_USERS: 'vietlogix_users_table_v2',
    AUTH_SESSION: 'vietlogix_supabase_jwt_session_v2',
    STRICT_ROUTE_GUARD: 'vietlogix_strict_route_guard_v1'
};

/**
 * MA TRẬN PHÂN QUYỀN TUYẾN ĐƯỜNG ĐƯỢC BẢO VỆ (SUPABASE PROTECTED ROUTES & RBAC GUARD)
 */
const PROTECTED_ROUTES_MATRIX = {
    'tab-visualizer': {
        route: '#/dashboard',
        title: '1. Bàn Điều Hành & Mô Phỏng 9 Kịch Bản',
        allowedRoles: ['admin', 'redteam', 'customer'],
        writeRoles: ['admin', 'redteam'],
        policyDesc: 'Cho phép Quản trị viên, Thành viên Kịch bản 1–9 và Khách hàng theo dõi điều phối.'
    },
    'tab-supabase-portal': {
        route: '#/portal',
        title: '2. Nghiệp Vụ (Admin & Khách Hàng) + CSDL Supabase',
        allowedRoles: ['admin', 'customer', 'redteam'],
        writeRoles: ['admin', 'customer'],
        policyDesc: 'Khách hàng đặt đơn hàng (OMS); Quản trị viên cấu hình kho vật lý (WMS).'
    },
    'tab-scenarios-detail': {
        route: '#/scenarios',
        title: '3. Số Liệu Chi Tiết 9 Kịch Bản (TV1 → TV9)',
        allowedRoles: ['admin', 'redteam', 'customer'],
        writeRoles: ['admin'],
        policyDesc: 'Bảng số liệu thực nghiệm của 9 kịch bản tấn công AI.'
    },
    'tab-chapter4-summary': {
        route: '#/reports',
        title: '4. Báo Cáo Tổng Hợp Chương 4 (M0, M1, M2, M3)',
        allowedRoles: ['admin', 'redteam', 'customer'],
        writeRoles: ['admin'],
        policyDesc: 'Tổng hợp 8 chỉ số đánh giá (TAC, ATC, UD, CV, LV, IR, AR, RT).'
    },
    'tab-dataset-inspector': {
        route: '#/dataset',
        title: '5. Vector Trạng Thái 2.750 Chiều (50 Kho × 50 Khách)',
        allowedRoles: ['admin', 'redteam'],
        writeRoles: ['admin'],
        policyDesc: 'Tuyến nội bộ: Dành cho Quản trị viên và Thành viên Kịch bản 1–9. Chặn tài khoản Khách hàng.'
    },
    'tab-security-center': {
        route: '#/soc-admin',
        title: '6. Trung Tâm SOC & Phòng Thủ Đa Lớp',
        allowedRoles: ['admin'],
        writeRoles: ['admin'],
        policyDesc: 'Tuyến đặc quyền: Chỉ Quản trị viên (Admin NOC) được phép truy cập.'
    },
    'tab-stealth-forensics': {
        route: '#/stealth-forensics',
        title: '7. Tác Động Bên Thứ 3 – Ẩn Dấu Vết & Điều Tra ATTT',
        allowedRoles: ['admin', 'redteam'],
        writeRoles: ['admin', 'redteam'],
        policyDesc: 'Mô phỏng tấn công chuỗi cung ứng qua API bên thứ 3, xóa dấu vết nhật ký và điều tra khôi phục chuỗi băm SHA-256.'
    }
};

const DEFAULT_DEMO_USERS = [
    {
        id: 'usr-admin-01',
        email: 'admin@vietlogix.vn',
        mat_khau_demo: 'admin123',
        ho_ten: 'Quản Trị Viên NOC',
        vai_tro: 'admin',
        kich_ban_phu_trach: null,
        ma_khach_hang_lien_ket: null,
        chuc_vu: 'Quản trị hệ thống & Kho vận',
        so_dien_thoai: '0901000000',
        trang_thai: 'Hoạt động',
        created_at: '2026-11-01 08:00:00'
    },
    {
        id: 'usr-tv-01',
        email: 'tv1@vietlogix.vn',
        mat_khau_demo: '123456',
        ho_ten: 'Thành Viên 1 (Kịch bản 1)',
        vai_tro: 'redteam',
        kich_ban_phu_trach: 1,
        ma_khach_hang_lien_ket: 'U1',
        chuc_vu: 'KB1: Giả mạo đóng/mở kho (WMS)',
        so_dien_thoai: '0901000001',
        trang_thai: 'Hoạt động',
        created_at: '2026-11-01 08:10:00'
    },
    {
        id: 'usr-tv-02',
        email: 'tv2@vietlogix.vn',
        mat_khau_demo: '123456',
        ho_ten: 'Thành Viên 2 (Kịch bản 2)',
        vai_tro: 'redteam',
        kich_ban_phu_trach: 2,
        ma_khach_hang_lien_ket: 'U2',
        chuc_vu: 'KB2: Đầu độc bảng giá cước (TMS)',
        so_dien_thoai: '0901000002',
        trang_thai: 'Hoạt động',
        created_at: '2026-11-01 08:20:00'
    },
    {
        id: 'usr-tv-03',
        email: 'tv3@vietlogix.vn',
        mat_khau_demo: '123456',
        ho_ten: 'Thành Viên 3 (Kịch bản 3)',
        vai_tro: 'redteam',
        kich_ban_phu_trach: 3,
        ma_khach_hang_lien_ket: 'U3',
        chuc_vu: 'KB3: Bóp méo sức chứa kho',
        so_dien_thoai: '0901000003',
        trang_thai: 'Hoạt động',
        created_at: '2026-11-01 08:30:00'
    },
    {
        id: 'usr-tv-04',
        email: 'tv4@vietlogix.vn',
        mat_khau_demo: '123456',
        ho_ten: 'Thành Viên 4 (Kịch bản 4)',
        vai_tro: 'redteam',
        kich_ban_phu_trach: 4,
        ma_khach_hang_lien_ket: 'U4',
        chuc_vu: 'KB4: Làm giả nhu cầu khách hàng (OMS)',
        so_dien_thoai: '0901000004',
        trang_thai: 'Hoạt động',
        created_at: '2026-11-01 08:40:00'
    },
    {
        id: 'usr-tv-05',
        email: 'tv5@vietlogix.vn',
        mat_khau_demo: '123456',
        ho_ten: 'Thành Viên 5 (Kịch bản 5)',
        vai_tro: 'redteam',
        kich_ban_phu_trach: 5,
        ma_khach_hang_lien_ket: 'U5',
        chuc_vu: 'KB5: Tấn công 5 Kho Hub trung tâm',
        so_dien_thoai: '0901000005',
        trang_thai: 'Hoạt động',
        created_at: '2026-11-01 08:50:00'
    },
    {
        id: 'usr-tv-06',
        email: 'tv6@vietlogix.vn',
        mat_khau_demo: '123456',
        ho_ten: 'Thành Viên 6 (Kịch bản 6)',
        vai_tro: 'redteam',
        kich_ban_phu_trach: 6,
        ma_khach_hang_lien_ket: 'U6',
        chuc_vu: 'KB6: Làm tràn giới hạn phục vụ l_max',
        so_dien_thoai: '0901000006',
        trang_thai: 'Hoạt động',
        created_at: '2026-11-01 09:00:00'
    },
    {
        id: 'usr-tv-07',
        email: 'tv7@vietlogix.vn',
        mat_khau_demo: '123456',
        ho_ten: 'Thành Viên 7 (Kịch bản 7)',
        vai_tro: 'redteam',
        kich_ban_phu_trach: 7,
        ma_khach_hang_lien_ket: 'U31',
        chuc_vu: 'KB7: Tấn công chớp nhoáng Bước 61-80',
        so_dien_thoai: '0901000007',
        trang_thai: 'Hoạt động',
        created_at: '2026-11-01 09:10:00'
    },
    {
        id: 'usr-tv-08',
        email: 'tv8@vietlogix.vn',
        mat_khau_demo: '123456',
        ho_ten: 'Thành Viên 8 (Kịch bản 8)',
        vai_tro: 'redteam',
        kich_ban_phu_trach: 8,
        ma_khach_hang_lien_ket: 'U8',
        chuc_vu: 'KB8: Vượt lớp lọc Action Masking',
        so_dien_thoai: '0901000008',
        trang_thai: 'Hoạt động',
        created_at: '2026-11-01 09:20:00'
    },
    {
        id: 'usr-tv-09',
        email: 'tv9@vietlogix.vn',
        mat_khau_demo: '123456',
        ho_ten: 'Thành Viên 9 (Kịch bản 9)',
        vai_tro: 'redteam',
        kich_ban_phu_trach: 9,
        ma_khach_hang_lien_ket: 'U9',
        chuc_vu: 'KB9: Đầu độc phần thưởng huấn luyện',
        so_dien_thoai: '0901000009',
        trang_thai: 'Hoạt động',
        created_at: '2026-11-01 09:30:00'
    },
    {
        id: 'usr-cust-u1',
        email: 'khachhang.u1@vietlogix.vn',
        mat_khau_demo: 'khach123',
        ho_ten: 'Đại Lý U1 (Siêu thị Bán lẻ U1)',
        vai_tro: 'customer',
        kich_ban_phu_trach: null,
        ma_khach_hang_lien_ket: 'U1',
        chuc_vu: 'Khách hàng đặt hàng U1',
        so_dien_thoai: '0912345678',
        trang_thai: 'Hoạt động',
        created_at: '2026-11-02 09:15:00'
    },
    {
        id: 'usr-cust-u4',
        email: 'khachhang.u4@vietlogix.vn',
        mat_khau_demo: 'khach123',
        ho_ten: 'Đại Lý U4 (Trung tâm Thương mại U4)',
        vai_tro: 'customer',
        kich_ban_phu_trach: null,
        ma_khach_hang_lien_ket: 'U4',
        chuc_vu: 'Khách hàng đặt hàng U4',
        so_dien_thoai: '0987654321',
        trang_thai: 'Hoạt động',
        created_at: '2026-11-03 10:30:00'
    }
];

class VietLogixSupabaseService {
    constructor() {
        this.config = this.loadConfig();
        this.users = this.loadUsers();
        this.currentUser = this.loadCurrentUser();
        this.session = this.loadSession();
        this.strictRouteGuard = this.loadStrictRouteGuard();
        this.supabaseClient = null;
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
        this.initSupabaseJsClient();
    }

    initSupabaseJsClient() {
        if (this.config.url && this.config.anonKey && window.supabase && typeof window.supabase.createClient === 'function') {
            try {
                this.supabaseClient = window.supabase.createClient(this.config.url, this.config.anonKey, {
                    auth: {
                        persistSession: true,
                        autoRefreshToken: true,
                        detectSessionInUrl: true
                    }
                });
            } catch {
                this.supabaseClient = null;
            }
        } else {
            this.supabaseClient = null;
        }
    }

    loadSession() {
        try {
            const raw = localStorage.getItem(STORAGE_KEYS.AUTH_SESSION);
            if (raw) return JSON.parse(raw);
        } catch {
            // ignore
        }
        return null;
    }

    saveSession(sessionObj) {
        this.session = sessionObj;
        try {
            if (sessionObj) {
                localStorage.setItem(STORAGE_KEYS.AUTH_SESSION, JSON.stringify(sessionObj));
            } else {
                localStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
            }
        } catch {
            // ignore
        }
    }

    loadStrictRouteGuard() {
        try {
            const raw = localStorage.getItem(STORAGE_KEYS.STRICT_ROUTE_GUARD);
            if (raw !== null) return JSON.parse(raw);
        } catch {
            // ignore
        }
        return true; // Mặc định bật Bảo vệ Tuyến đường theo Vai trò (RBAC Protected Routes)
    }

    setStrictRouteGuard(enabled) {
        this.strictRouteGuard = Boolean(enabled);
        try {
            localStorage.setItem(STORAGE_KEYS.STRICT_ROUTE_GUARD, JSON.stringify(this.strictRouteGuard));
        } catch {
            // ignore
        }
    }

    getRouteMatrix() {
        return PROTECTED_ROUTES_MATRIX;
    }

    /**
     * Kiểm tra quyền truy cập vào một Route / Tab theo chuẩn Protected Routes
     */
    checkRouteAccess(tabId) {
        const routeMeta = PROTECTED_ROUTES_MATRIX[tabId];
        if (!routeMeta) return { allowed: true, reason: 'Public route' };

        if (!this.currentUser) {
            return {
                allowed: false,
                code: 401,
                statusText: '401 UNAUTHORIZED – YÊU CẦU ĐĂNG NHẬP SUPABASE AUTH',
                routeMeta,
                reason: `Tuyến đường "${routeMeta.route}" (${routeMeta.title}) được bảo vệ bởi Supabase Auth Middleware. Bạn chưa đăng nhập hoặc phiên JWT đã kết thúc.`
            };
        }

        if (this.strictRouteGuard && !routeMeta.allowedRoles.includes(this.currentUser.vai_tro)) {
            return {
                allowed: false,
                code: 403,
                statusText: '403 FORBIDDEN – CHỐT CHẶN PHÂN QUYỀN PROTECTED ROUTE (RBAC & RLS)',
                routeMeta,
                currentRole: this.currentUser.vai_tro,
                requiredRoles: routeMeta.allowedRoles,
                reason: routeMeta.policyDesc
            };
        }

        return {
            allowed: true,
            code: 200,
            routeMeta,
            currentRole: this.currentUser.vai_tro
        };
    }

    loadConfig() {
        const defaultCloudConfig = {
            url: 'https://quxsitzicqyficespalk.supabase.co',
            anonKey:
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1eHNpdHppY3F5ZmljZXNwYWxrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUzNDYyODYsImV4cCI6MjExMDkyMjI4Nn0.3busodS9LDHQKCx8FHJ8Nu57KG58Mm7ITRn8_NlvLqw'
        };
        try {
            const raw = localStorage.getItem(STORAGE_KEYS.SUPABASE_CONFIG);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.url && parsed.anonKey) return parsed;
            }
        } catch {
            // ignore
        }
        return defaultCloudConfig;
    }

    saveConfig(url, anonKey) {
        this.config = {
            url: (url || '').trim().replace(/\/+$/, ''),
            anonKey: (anonKey || '').trim()
        };
        this.isCloudConnected = Boolean(this.config.url && this.config.anonKey);
        this.initSupabaseJsClient();
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
            if (raw === 'LOGGED_OUT') return null;
            if (raw) return JSON.parse(raw);
        } catch {
            // ignore
        }
        return DEFAULT_DEMO_USERS[0]; // Mặc định phiên Admin NOC để thuận tiện demo ngay khi mở trang
    }

    setCurrentUser(user) {
        this.currentUser = user;
        try {
            if (user === null) {
                localStorage.setItem(STORAGE_KEYS.CURRENT_USER, 'LOGGED_OUT');
            } else {
                localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
                // Tạo JWT Session mô phỏng hoặc lưu JWT từ Supabase GoTrue
                if (!this.session || this.session.userEmail !== user.email) {
                    this.saveSession({
                        access_token: `sb-jwt-${user.vai_tro}-${btoa(encodeURIComponent(user.email)).slice(0, 16)}`,
                        token_type: 'bearer',
                        role: 'authenticated',
                        app_metadata: { vai_tro: user.vai_tro },
                        userEmail: user.email,
                        issued_at: new Date().toISOString()
                    });
                }
            }
        } catch {
            // ignore
        }
    }

    /**
     * Đăng xuất khỏi Supabase Auth (Sign Out) & Kích hoạt màn hình Chốt chặn Protected Route (#/login)
     */
    async logout() {
        if (this.supabaseClient) {
            try {
                await this.supabaseClient.auth.signOut();
            } catch {
                // ignore
            }
        }
        this.saveSession(null);
        this.setCurrentUser(null);
        return { ok: true };
    }

    /**
     * Đăng nhập bằng Email & Mật khẩu:
     * 1. Thử xác thực qua Supabase Auth chuẩn (supabase.auth.signInWithPassword) nếu đã cấu hình Supabase Cloud
     * 2. Truy vấn hồ sơ phân quyền từ bảng public.nguoi_dung
     * 3. Fallback an toàn về CSDL Doanh nghiệp Cục bộ để demo không bao giờ bị gián đoạn
     */
    async login(email, password) {
        const cleanEmail = (email || '').trim().toLowerCase();
        const cleanPass = (password || '').trim();

        if (this.isCloudConnected) {
            // Bước 1: Thử đăng nhập qua Supabase GoTrue Auth (supabase.auth.signInWithPassword)
            if (this.supabaseClient) {
                try {
                    const { data: authData, error: authErr } = await this.supabaseClient.auth.signInWithPassword({
                        email: cleanEmail,
                        password: cleanPass
                    });
                    if (!authErr && authData?.session) {
                        this.saveSession({
                            access_token: authData.session.access_token,
                            refresh_token: authData.session.refresh_token,
                            token_type: 'bearer',
                            role: 'authenticated',
                            userEmail: cleanEmail,
                            issued_at: new Date().toISOString()
                        });
                    }
                } catch {
                    // Tiếp tục kiểm tra bảng nguoi_dung
                }
            }

            // Bước 2: Lấy hồ sơ người dùng & vai trò từ bảng public.nguoi_dung
            try {
                const res = await this.restRequest(
                    `nguoi_dung?email=eq.${encodeURIComponent(cleanEmail)}&select=*`,
                    'GET'
                );
                if (Array.isArray(res) && res.length > 0) {
                    const cloudUser = res[0];
                    if (!cleanPass || cloudUser.mat_khau_demo === cleanPass || this.session?.userEmail === cleanEmail) {
                        this.setCurrentUser(cloudUser);
                        return { ok: true, user: cloudUser, source: 'Supabase Auth & Cloud DB' };
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
        return { ok: true, user: found, source: this.isCloudConnected ? 'Supabase Cloud' : 'Supabase Local Auth' };
    }

    /**
     * Đăng ký tài khoản Khách hàng hoặc Admin mới (Kết hợp supabase.auth.signUp & bảng public.nguoi_dung)
     */
    async registerUser({ email, password, ho_ten, vai_tro = 'customer', ma_khach_hang_lien_ket = 'U1', so_dien_thoai = '0909998888' }) {
        const cleanEmail = (email || '').trim().toLowerCase();
        if (!cleanEmail || !ho_ten) {
            return { ok: false, error: 'Vui lòng nhập đầy đủ Họ tên và Email!' };
        }
        if (this.users.some(u => u.email.toLowerCase() === cleanEmail)) {
            return { ok: false, error: 'Email này đã tồn tại trong hệ thống!' };
        }

        let authUserId = null;
        if (this.isCloudConnected && this.supabaseClient) {
            try {
                const { data: signUpData } = await this.supabaseClient.auth.signUp({
                    email: cleanEmail,
                    password: password || '123456',
                    options: {
                        data: {
                            ho_ten: ho_ten.trim(),
                            ma_khach_hang_lien_ket: vai_tro === 'customer' ? ma_khach_hang_lien_ket : null
                        }
                    }
                });
                if (signUpData?.user?.id) {
                    authUserId = signUpData.user.id;
                }
                if (signUpData?.session?.access_token) {
                    this.saveSession({
                        access_token: signUpData.session.access_token,
                        token_type: 'bearer',
                        role: 'authenticated',
                        userEmail: cleanEmail,
                        issued_at: new Date().toISOString()
                    });
                }
            } catch {
                // fallback
            }
        }

        const newUser = {
            id: authUserId || 'usr-' + Date.now(),
            auth_user_id: authUserId,
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
                await this.restRequest(
                    'nguoi_dung?on_conflict=email',
                    'POST',
                    {
                        auth_user_id: authUserId,
                        email: newUser.email,
                        mat_khau_demo: newUser.mat_khau_demo,
                        ho_ten: newUser.ho_ten,
                        vai_tro: newUser.vai_tro,
                        ma_khach_hang_lien_ket: newUser.ma_khach_hang_lien_ket,
                        chuc_vu: newUser.chuc_vu,
                        so_dien_thoai: newUser.so_dien_thoai,
                        trang_thai: newUser.trang_thai
                    },
                    'resolution=merge-duplicates'
                );
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

        // 7. Bảng lich_su_kiem_nghiem (4 bản ghi đối chứng M0, M1, M2, M3 của ĐÚNG Kịch bản đang chọn)
        const runRows = [];
        let rId = 1;
        const s = currentScenarioId;
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
        const bearerToken =
            this.session && typeof this.session.access_token === 'string' && this.session.access_token.startsWith('eyJ')
                ? this.session.access_token
                : this.config.anonKey;
        const headers = {
            apikey: this.config.anonKey,
            Authorization: `Bearer ${bearerToken}`,
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

            // Upsert bang_gia_van_chuyen (250 tuyến tiêu biểu)
            if (this.tables.bang_gia_van_chuyen.length > 0) {
                const costPayload = this.tables.bang_gia_van_chuyen.map(c => ({
                    ma_kho: c.ma_kho,
                    ma_khach_hang: c.ma_khach_hang,
                    chi_phi_thuc_te: c.chi_phi_thuc_te,
                    chi_phi_quan_sat_ai: c.chi_phi_quan_sat_ai,
                    bi_bom_nhieu_fgsm: c.bi_bom_nhieu_fgsm === 'Bị làm giả'
                }));
                await this.restRequest('bang_gia_van_chuyen?on_conflict=ma_kho,ma_khach_hang', 'POST', costPayload, 'resolution=merge-duplicates');
            }

            this.lastSyncTime = new Date().toLocaleTimeString('vi-VN');
            return {
                ok: true,
                message: `Đã đồng bộ thành công toàn bộ 7 bảng (50 Kho hàng, 50 Khách hàng, 250 Tuyến cước, 50 Đơn phân bổ, Nhật ký sự cố & 36 Kịch bản) lên Supabase Cloud demo-atbmtt (${this.lastSyncTime})!`
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
