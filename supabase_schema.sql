-- =================================================================================
-- CƠ SỞ DỮ LIỆU SUPABASE POSTGRESQL & SUPABASE AUTH + RLS CHO VIETLOGIX AI (ATBMTT)
-- Đề tài: Tấn công dựa trên công nghệ AI – Đánh lừa mạng Dueling DQN trong vận tải
-- Hướng dẫn: Sao chép toàn bộ nội dung file này dán vào mục SQL Editor trên Supabase
--            và nhấn "Run" để khởi tạo 7 bảng nghiệp vụ, Trigger Supabase Auth và RLS.
-- =================================================================================

-- 1. BẢNG HỒ SƠ NGƯỜI DÙNG & PHÂN QUYỀN RBAC (LIÊN KẾT TRỰC TIẾP VỚI SUPABASE AUTH.USERS)
CREATE TABLE IF NOT EXISTS public.nguoi_dung (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    mat_khau_demo TEXT DEFAULT '123456',
    ho_ten TEXT NOT NULL,
    vai_tro TEXT NOT NULL DEFAULT 'customer' CHECK (vai_tro IN ('admin', 'customer', 'redteam')),
    kich_ban_phu_trach INTEGER,
    ma_khach_hang_lien_ket TEXT, -- Ví dụ: 'U1'..'U50' cho tài khoản khách hàng
    chuc_vu TEXT,
    so_dien_thoai TEXT,
    trang_thai TEXT DEFAULT 'Đang hoạt động',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nguoi_dung_auth_user_id ON public.nguoi_dung(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_nguoi_dung_email ON public.nguoi_dung(email);

-- TRIGGER TỰ ĐỘNG ĐỒNG BỘ TÀI KHOẢN TỪ SUPABASE AUTH (auth.users) SANG BẢNG public.nguoi_dung
-- Lưu ý Bảo mật Supabase: Không bao giờ cho phép người dùng tự gán quyền 'admin' qua raw_user_meta_data.
-- Mọi tài khoản tự đăng ký mới mặc định nhận vai_tro = 'customer' trừ khi được Admin cấp quyền trong DB.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.nguoi_dung (
        auth_user_id,
        email,
        ho_ten,
        vai_tro,
        ma_khach_hang_lien_ket,
        chuc_vu,
        trang_thai
    )
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'ho_ten', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_app_meta_data->>'vai_tro', 'customer'),
        COALESCE(NEW.raw_user_meta_data->>'ma_khach_hang_lien_ket', 'U1'),
        'Khách hàng / Đại lý Đăng ký qua Supabase Auth',
        'Đang hoạt động'
    )
    ON CONFLICT (email) DO UPDATE
    SET auth_user_id = EXCLUDED.auth_user_id;
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- 2. BẢNG QUẢN LÝ 50 KHO HÀNG PHÂN PHỐI (W1 -> W50)
CREATE TABLE IF NOT EXISTS public.kho_hang (
    id SERIAL PRIMARY KEY,
    ma_kho TEXT UNIQUE NOT NULL, -- W1..W50
    ten_kho TEXT NOT NULL,
    khu_vuc TEXT NOT NULL,
    toa_do_x NUMERIC(6,2) NOT NULL,
    toa_do_y NUMERIC(6,2) NOT NULL,
    suc_chua_ban_dau INTEGER NOT NULL,
    suc_chua_con_lai INTEGER NOT NULL,
    trang_thai_mo INTEGER NOT NULL DEFAULT 1 CHECK (trang_thai_mo IN (0, 1)),
    gioi_han_phuc_vu_lmax INTEGER NOT NULL DEFAULT 2,
    so_khach_dang_phuc_vu INTEGER NOT NULL DEFAULT 0,
    la_kho_chien_luoc BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. BẢNG QUẢN LÝ 50 ĐẠI LÝ / KHÁCH HÀNG DOANH NGHIỆP (U1 -> U50)
CREATE TABLE IF NOT EXISTS public.khach_hang (
    id SERIAL PRIMARY KEY,
    ma_khach_hang TEXT UNIQUE NOT NULL, -- U1..U50
    ten_khach_hang TEXT NOT NULL,
    loai_hinh TEXT NOT NULL,
    toa_do_x NUMERIC(6,2) NOT NULL,
    toa_do_y NUMERIC(6,2) NOT NULL,
    nhu_cau_dat_hang INTEGER NOT NULL,
    kho_toi_uu_chuan TEXT,
    chi_phi_toi_uu INTEGER,
    trang_thai_phuc_vu TEXT DEFAULT 'Đã lập kế hoạch',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. BẢNG MA TRẬN CHI PHÍ VẬN CHUYỂN (50 KHO x 50 KHÁCH HÀNG = 2.500 TUYẾN)
CREATE TABLE IF NOT EXISTS public.bang_gia_van_chuyen (
    id SERIAL PRIMARY KEY,
    ma_kho TEXT NOT NULL,
    ma_khach_hang TEXT NOT NULL,
    chi_phi_thuc_te INTEGER NOT NULL,
    chi_phi_quan_sat_ai INTEGER NOT NULL,
    bi_bom_nhieu_fgsm BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(ma_kho, ma_khach_hang)
);

-- 5. BẢNG ĐƠN ĐẶT HÀNG & QUYẾT ĐỊNH PHÂN BỔ CỦA MẠNG DUELING DQN
CREATE TABLE IF NOT EXISTS public.don_hang_phan_bo (
    id SERIAL PRIMARY KEY,
    ma_don_hang TEXT UNIQUE NOT NULL,
    buoc_thoi_gian INTEGER NOT NULL,
    ma_khach_hang TEXT NOT NULL,
    ten_khach_hang TEXT NOT NULL,
    nhu_cau_thuc_te INTEGER NOT NULL,
    nhu_cau_ai_quan_sat INTEGER NOT NULL,
    kho_toi_uu_m0 TEXT NOT NULL,
    kho_ai_de_xuat TEXT NOT NULL,
    kho_thuc_thi TEXT NOT NULL,
    diem_q_value NUMERIC(8,2) NOT NULL,
    chi_phi_thuc_te INTEGER NOT NULL,
    chi_phi_quan_sat INTEGER NOT NULL,
    hang_hoa_dut_gay_ud INTEGER NOT NULL DEFAULT 0,
    diem_thuong_reward NUMERIC(8,2) NOT NULL,
    cau_hinh_mo_hinh TEXT NOT NULL, -- M0, M1, M2, M3
    kich_ban_so INTEGER NOT NULL,
    trang_thai_kiem_tra TEXT NOT NULL,
    nguoi_tao TEXT DEFAULT 'Hệ thống AI',
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_don_hang_ma_khach_hang ON public.don_hang_phan_bo(ma_khach_hang);
CREATE INDEX IF NOT EXISTS idx_don_hang_auth_user_id ON public.don_hang_phan_bo(auth_user_id);

-- 6. BẢNG NHẬT KÝ SỰ CỐ AN NINH AI & GÓI TIN BỊ TIN TẶC CAN THIỆP (SOC LOGS)
CREATE TABLE IF NOT EXISTS public.nhat_ky_tan_cong_ai (
    id SERIAL PRIMARY KEY,
    ma_su_co TEXT UNIQUE NOT NULL,
    kich_ban_so INTEGER NOT NULL,
    ten_kich_ban TEXT NOT NULL,
    thanh_vien_phu_trach TEXT NOT NULL,
    ma_don_hang TEXT NOT NULL,
    truong_bi_tan_cong TEXT NOT NULL,
    gia_tri_thuc_tai_kho TEXT NOT NULL,
    goi_tin_gia_mao_ai TEXT NOT NULL,
    dien_bien_hau_qua TEXT NOT NULL,
    trang_thai_xu_ly TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. BẢNG LỊCH SỬ CHẠY MÔ PHỎNG & ĐÁNH GIÁ 9 KỊCH BẢN (8 CHỈ SỐ CHUNG)
CREATE TABLE IF NOT EXISTS public.lich_su_kiem_nghiem (
    id SERIAL PRIMARY KEY,
    kich_ban_so INTEGER NOT NULL,
    ten_kich_ban TEXT NOT NULL,
    thanh_vien TEXT NOT NULL,
    cau_hinh_mo_hinh TEXT NOT NULL, -- M0, M1, M2, M3
    tong_chi_phi_tac INTEGER NOT NULL,
    ty_le_tang_chi_phi_delta NUMERIC(6,2) NOT NULL,
    chi_phi_trung_binh_atc NUMERIC(6,2) NOT NULL,
    nhu_cau_chua_dap_ung_ud INTEGER NOT NULL,
    ty_le_dap_ung_dfr NUMERIC(6,2) NOT NULL,
    vi_pham_suc_chua_cv INTEGER NOT NULL,
    vi_pham_gioi_han_lv INTEGER NOT NULL,
    ty_le_lenh_loi_ir NUMERIC(6,2) NOT NULL,
    phan_thuong_trung_binh_ar NUMERIC(6,2) NOT NULL,
    thoi_gian_phuc_hoi_rt INTEGER NOT NULL,
    epsilon_fgsm NUMERIC(4,2) DEFAULT 0.15,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CẤP QUYỀN TRUY CẬP DATA API (POSTGREST) CHO VAI TRÒ ANON & AUTHENTICATED
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- BẬT ROW LEVEL SECURITY (RLS) TRÊN TẤT CẢ 7 BẢNG TRONG SCHEMA PUBLIC
ALTER TABLE public.nguoi_dung ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kho_hang ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.khach_hang ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bang_gia_van_chuyen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.don_hang_phan_bo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nhat_ky_tan_cong_ai ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lich_su_kiem_nghiem ENABLE ROW LEVEL SECURITY;

-- CHÍNH SÁCH RLS CHUẨN SUPABASE (DÙNG MỆNH ĐỀ TO authenticated, anon VÀ SCALAR SUBQUERY (select auth.uid()))
DROP POLICY IF EXISTS "Cho phep truy cap demo nguoi_dung" ON public.nguoi_dung;
CREATE POLICY "Cho phep truy cap demo nguoi_dung"
    ON public.nguoi_dung
    FOR ALL
    TO authenticated, anon
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Cho phep truy cap demo kho_hang" ON public.kho_hang;
CREATE POLICY "Cho phep truy cap demo kho_hang"
    ON public.kho_hang
    FOR ALL
    TO authenticated, anon
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Cho phep truy cap demo khach_hang" ON public.khach_hang;
CREATE POLICY "Cho phep truy cap demo khach_hang"
    ON public.khach_hang
    FOR ALL
    TO authenticated, anon
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Cho phep truy cap demo bang_gia_van_chuyen" ON public.bang_gia_van_chuyen;
CREATE POLICY "Cho phep truy cap demo bang_gia_van_chuyen"
    ON public.bang_gia_van_chuyen
    FOR ALL
    TO authenticated, anon
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Cho phep truy cap demo don_hang_phan_bo" ON public.don_hang_phan_bo;
CREATE POLICY "Cho phep truy cap demo don_hang_phan_bo"
    ON public.don_hang_phan_bo
    FOR ALL
    TO authenticated, anon
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Cho phep truy cap demo nhat_ky_tan_cong_ai" ON public.nhat_ky_tan_cong_ai;
CREATE POLICY "Cho phep truy cap demo nhat_ky_tan_cong_ai"
    ON public.nhat_ky_tan_cong_ai
    FOR ALL
    TO authenticated, anon
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Cho phep truy cap demo lich_su_kiem_nghiem" ON public.lich_su_kiem_nghiem;
CREATE POLICY "Cho phep truy cap demo lich_su_kiem_nghiem"
    ON public.lich_su_kiem_nghiem
    FOR ALL
    TO authenticated, anon
    USING (true)
    WITH CHECK (true);

-- DỮ LIỆU 9 TÀI KHOẢN CHO 9 KỊCH BẢN + ADMIN + KHÁCH HÀNG
INSERT INTO public.nguoi_dung (email, mat_khau_demo, ho_ten, vai_tro, ma_khach_hang_lien_ket, kich_ban_phu_trach, chuc_vu, so_dien_thoai)
VALUES
    ('admin@vietlogix.vn', 'admin123', 'Quản Trị Viên NOC', 'admin', NULL, NULL, 'Quản trị hệ thống & Kho vận', '0901000000'),
    ('tv1@vietlogix.vn', '123456', 'Thành Viên 1 (Kịch bản 1)', 'redteam', 'U1', 1, 'Phụ trách KB1: Giả mạo đóng/mở kho', '0901000001'),
    ('tv2@vietlogix.vn', '123456', 'Thành Viên 2 (Kịch bản 2)', 'redteam', 'U2', 2, 'Phụ trách KB2: Đầu độc chi phí vận chuyển', '0901000002'),
    ('tv3@vietlogix.vn', '123456', 'Thành Viên 3 (Kịch bản 3)', 'redteam', 'U3', 3, 'Phụ trách KB3: Bóp méo sức chứa kho', '0901000003'),
    ('tv4@vietlogix.vn', '123456', 'Thành Viên 4 (Kịch bản 4)', 'redteam', 'U4', 4, 'Phụ trách KB4: Làm giả nhu cầu khách hàng', '0901000004'),
    ('tv5@vietlogix.vn', '123456', 'Thành Viên 5 (Kịch bản 5)', 'redteam', 'U5', 5, 'Phụ trách KB5: Tấn công 5 Kho Hub trung tâm', '0901000005'),
    ('tv6@vietlogix.vn', '123456', 'Thành Viên 6 (Kịch bản 6)', 'redteam', 'U6', 6, 'Phụ trách KB6: Làm tràn giới hạn phục vụ l_max', '0901000006'),
    ('tv7@vietlogix.vn', '123456', 'Thành Viên 7 (Kịch bản 7)', 'redteam', 'U31', 7, 'Phụ trách KB7: Tấn công ngắt quãng Bước 61-80', '0901000007'),
    ('tv8@vietlogix.vn', '123456', 'Thành Viên 8 (Kịch bản 8)', 'redteam', 'U8', 8, 'Phụ trách KB8: Vượt lớp lọc Action Masking', '0901000008'),
    ('tv9@vietlogix.vn', '123456', 'Thành Viên 9 (Kịch bản 9)', 'redteam', 'U9', 9, 'Phụ trách KB9: Đầu độc phần thưởng huấn luyện', '0901000009'),
    ('khachhang.u1@vietlogix.vn', 'khach123', 'Đại Lý U1 (Siêu thị Bán lẻ U1)', 'customer', 'U1', NULL, 'Khách hàng đặt hàng U1', '0912345678'),
    ('khachhang.u4@vietlogix.vn', 'khach123', 'Đại Lý U4 (Trung tâm Thương mại U4)', 'customer', 'U4', NULL, 'Khách hàng đặt hàng U4', '0987654321')
ON CONFLICT (email) DO NOTHING;
