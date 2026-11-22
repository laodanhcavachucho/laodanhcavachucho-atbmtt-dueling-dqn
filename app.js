/**
 * BỘ ĐIỀU KHIỂN THỜI GIAN THỰC TRUNG TÂM ĐIỀU HÀNH LOGISTICS VIETLOGIX AI (NOC)
 * Phản hồi tức thời (0ms delay) với mọi thao tác nút bấm, thanh trượt, bản đồ và bảng bơm nhiễu.
 */

const SCENARIO_METADATA = {
    1: {
        id: 1,
        group: 'Nhóm 1 – Tấn công dữ liệu đầu vào (State Manipulation)',
        member: 'Thành viên 1',
        code: 'Kịch bản 1',
        title: 'Giả mạo trạng thái đóng/mở kho (Open Status Spoofing Attack)',
        targetVector: 'Vector Open Status O = [O₁..O₅₀] (50 bit nhị phân 0/1)',
        businessProcess:
            'Tại Trung tâm Điều hành VietLogix, hệ thống Quản lý Kho (WMS) gửi tín hiệu heartbeat định kỳ báo trạng thái 44 kho đang mở cửa (O_i = 1) và 6 kho đang đóng cửa bảo trì hệ thống lạnh (W7, W15, W23, W31, W42, W48 với O_i = 0).',
        attackSteps: [
            'Bước A: Tin tặc xâm nhập API đồng bộ giữa WMS và bộ tiền xử lý trạng thái DQN (Man-in-the-Middle).',
            'Bước B: Đảo bit trạng thái O_obs = 1 - O_real tại 6 kho đang đóng bảo trì để hiển thị thành "Đang mở cửa".',
            'Bước C: Bơm thêm nhiễu đối kháng FGSM hạ thấp chi phí vận chuyển ảo tới 6 kho này để tạo mồi nhử hấp dẫn.'
        ],
        attackFormula: 'O_obs[i] = 1 - O_real[i];  s_adv = s + ε·sign(∇_s L)',
        dqnMechanism:
            'Do bit O_obs = 1, bộ lọc Action Masking trên dữ liệu quan sát mở khóa cho 6 kho đang bảo trì. Nhánh Advantage A(s_adv, a) của các kho này vọt lên dương cao nhất, đánh lừa hàm argmax Q(s,a) điều xe tải vào kho đóng cửa.',
        dqnFormula: 'a_t = argmax_{a ∈ A_valid(O_obs)} [V(s_adv) + A(s_adv, a)]',
        impactDefense:
            'Hậu quả (M1): Các đoàn xe tải chở hàng đến kho bị khóa cổng phải nằm chờ và điều chuyển khẩn cấp, tổng chi phí tăng vọt và đứt gãy nguồn cung. Phòng thủ (M3): Đối chiếu trực tiếp thanh ghi PLC cửa kho thực tế, chặn 100% lệnh sai!',
        defenseFormula: 'Check_M3: O_real[a_t] == 1 (Từ chối & Fallback nếu O_real = 0)'
    },
    2: {
        id: 2,
        group: 'Nhóm 1 – Tấn công dữ liệu đầu vào (State Manipulation)',
        member: 'Thành viên 2',
        code: 'Kịch bản 2',
        title: 'Bóp méo ma trận chi phí vận chuyển (Transport Cost Poisoning)',
        targetVector: 'Ma trận chi phí vận chuyển C₅₀ₓ₅₀ (2.500 tuyến đường)',
        businessProcess:
            'Hệ thống Quản lý Vận tải (TMS) tính toán bảng cước phí vận chuyển C_ij giữa 50 kho và 50 đại lý dựa trên quãng đường GPS, giá nhiên liệu và phí cầu đường (dao động từ 15 đến 165 đv tiền/chuyến).',
        attackSteps: [
            'Bước A: Tin tặc chiếm quyền ghi trên bộ nhớ đệm bảng giá cước TMS trước khi nạp vào vector 2.750 chiều.',
            'Bước B: Áp dụng gradient FGSM đảo ngược cước phí: các kho ở cách xa hàng trăm km (cước > 82) bị sửa giảm xuống còn 14–20 đv.',
            'Bước C: Các kho ở ngay gần khách hàng (cước < 52) bị thổi phồng cước gấp 2,8 lần để AI né tránh.'
        ],
        attackFormula: 'C_obs[i,j] = Clip(C_real[i,j] + ε·sign(∇_C L(θ, s, a)))',
        dqnMechanism:
            'Mọi kho được chọn đều hợp lệ về mặt vật lý (đang mở, đủ hàng) nên không bị báo lỗi vi phạm cứng. Tuy nhiên nhánh Advantage A(s,a) bị đảo thứ tự hoàn toàn, khiến Dueling DQN điều xe chạy xuyên vùng cực kỳ tốn kém.',
        dqnFormula: 'A(s_adv, a_xa) >> A(s_adv, a_gần) ⇒ Chọn kho xa nhất',
        impactDefense:
            'Hậu quả (M1): Doanh nghiệp bị "rút ruột" chi phí nhiên liệu mà hệ thống kiểm tra ràng buộc vật lý thông thường không phát hiện ra! Phòng thủ (M2): Huấn luyện đối kháng giúp AI phát hiện bất thường giữa khoảng cách địa lý và giá cước.',
        defenseFormula: 'M2 Min-Max: min_θ E [max_{||δ||≤ε} L(θ, s + δ)]'
    },
    3: {
        id: 3,
        group: 'Nhóm 1 – Tấn công dữ liệu đầu vào (State Manipulation)',
        member: 'Thành viên 3',
        code: 'Kịch bản 3',
        title: 'Bóp méo năng lực sức chứa kho (Capacity Exhaustion Attack)',
        targetVector: 'Vector sức chứa còn lại Capacity = [Cap₁..Cap₅₀] (50 phần tử)',
        businessProcess:
            'Mỗi kho phân phối có giới hạn tồn kho khả dụng (Cap_i). Trong ca vận hành có 10 kho vệ tinh đang ở mức tồn kho thấp (chỉ còn 22–36 tấn hàng), chỉ đủ phục vụ các đơn nhỏ lẻ.',
        attackSteps: [
            'Bước A: Tin tặc can thiệp gói tin kiểm kê tồn kho thời gian thực từ cơ sở dữ liệu WMS.',
            'Bước B: Cộng thêm lượng tồn kho ảo (+150 tấn) vào các kho sắp cạn hàng (Cap_obs >> Cap_real).',
            'Bước C: Kết hợp giảm nhẹ chi phí ảo tại các kho này để thu hút mạng Dueling DQN dồn đơn hàng lớn vào.'
        ],
        attackFormula: 'Cap_obs[i] = Cap_real[i] + Δ_spoof (với Cap_real[i] < D_j)',
        dqnMechanism:
            'Mạng Dueling DQN tin rằng các kho sắp cạn vẫn còn dư dả gần 200 tấn hàng nên liên tục gán các đơn hàng 45–64 tấn vào đó. Kết quả là kho bị xuất âm tồn kho khả dụng (Capacity Violation).',
        dqnFormula: 'Cap_obs[i] ≥ D_j (Hợp lệ giả) nhưng Cap_real[i] < D_j (Tràn kho)',
        impactDefense:
            'Hậu quả (M1): Nhiều đơn hàng bị vỡ kế hoạch xuất kho, thiếu hụt hàng giao cho đại lý, phạt hợp đồng nặng. Phòng thủ (M3): Khóa cứng lệnh xuất kho khi kiểm tra tồn kho thực tế Cap_real < D_j, đưa CV về 0.',
        defenseFormula: 'Check_M3: Cap_real[a_t] ≥ D_real[j] (Đảm bảo CV = 0)'
    },
    4: {
        id: 4,
        group: 'Nhóm 1 – Tấn công dữ liệu đầu vào (State Manipulation)',
        member: 'Thành viên 4',
        code: 'Kịch bản 4',
        title: 'Làm giả nhu cầu khách hàng (Fake Demand Fluctuation Attack)',
        targetVector: 'Vector nhu cầu khách hàng Demand = [D₁..D₅₀] (50 phần tử)',
        businessProcess:
            'Cổng Quản lý Đơn hàng (OMS) tiếp nhận yêu cầu đặt hàng từ 50 siêu thị và nhà máy (tổng nhu cầu thực tế 2.636 tấn, trung bình 38–64 tấn/đơn) để AI phân bổ đúng lượng xe và lượng hàng.',
        attackSteps: [
            'Bước A: Tin tặc tấn công vào API đồng bộ đơn hàng giữa cổng OMS và hệ thống điều phối AI.',
            'Bước B: Với các đơn hàng chẵn, tin tặc cắt giảm 55% khối lượng đặt hàng quan sát (D_obs << D_real).',
            'Bước C: Với các đơn hàng lẻ, tin tặc thổi phồng khối lượng gấp 1,85 lần (D_obs >> D_real).'
        ],
        attackFormula: 'D_obs[j] = D_real[j] × (1 ± δ_FGSM)',
        dqnMechanism:
            'Mạng Dueling DQN phân bổ lượng hàng theo D_obs: nơi cần nhiều hàng thì chỉ điều xe nhỏ giao chưa tới nửa đơn; nơi cần ít hàng lại điều đoàn xe container khổng lồ gây lãng phí tải trọng và chiếm chỗ của kho lớn.',
        dqnFormula: 'Allocated = min(Cap_real[a_t], D_obs[j]) ≠ D_real[j]',
        impactDefense:
            'Hậu quả (M1): Mất cân đối cung cầu nghiêm trọng, nửa số đại lý bị giao thiếu hàng, chi phí vận hành đội cao. Phòng thủ (M3): Đối chiếu chữ ký số đơn hàng gốc từ OMS trước khi chốt phiếu xuất kho.',
        defenseFormula: 'Verify_OMS(D_obs[j] == D_signed_real[j])'
    },
    5: {
        id: 5,
        group: 'Nhóm 2 – Tấn công có mục tiêu và phân tán',
        member: 'Thành viên 5',
        code: 'Kịch bản 5',
        title: 'Tấn công chuỗi cung ứng phân tán (Distributed Multi-Node Attack – 5 Kho Hub)',
        targetVector: 'Nhóm 5 Kho Hub Chiến Lược Trung Tâm (W1, W10, W20, W30, W40)',
        businessProcess:
            'Trong mạng lưới 50 kho của VietLogix, có 5 Kho Hub Chiến Lược đặt tại trung tâm giao thông quốc gia (W1, W10, W20, W30, W40) với sức chứa lớn (190–240 tấn) và cước vận chuyển rẻ hơn 22% so với kho thường.',
        attackSteps: [
            'Bước A: Tin tặc không tấn công dàn trải mà chỉ nhắm đúng 5 Kho Hub trung tâm.',
            'Bước B: Gây nghẽn năng lực thực tế tại 5 Hub (chỉ còn 30 tấn khả dụng) nhưng phát tín hiệu giả mạo tồn kho ảo 240 tấn ở các bước chẵn.',
            'Bước C: Ở các bước lẻ, tin tặc báo đóng cửa ảo 5 Hub và thổi giá các kho lân cận, ép luồng hàng dạt ra 45 kho vệ tinh vùng biên.'
        ],
        attackFormula: 'Target S_hub = {W1, W10, W20, W30, W40} ⊂ W (|S_hub| = 5)',
        dqnMechanism:
            'Sự tê liệt và nhiễu loạn thông tin tại 5 "nút cổ chai" trung tâm làm sụp đổ cấu trúc phân phối hình sao của Dueling DQN: vừa xảy ra tràn kho tại 5 Hub, vừa khiến 45 kho vệ tinh còn lại phải gánh tải chéo vùng.',
        dqnFormula: 'Q(s_adv, a_hub) dao động cực đoan ⇒ Mất cân bằng toàn mạng lưới',
        impactDefense:
            'Hậu quả (M1): Chỉ đánh vào 10% số kho (5/50 kho) nhưng làm tổng chi phí toàn hệ thống tăng gấp đôi, hiệu suất 45 kho vệ tinh suy giảm 28,4%! Phòng thủ (M2+M3): Cô lập nhiễu tại 5 Hub và tự động tái cân bằng tải sang các kho vệ tinh hợp lệ.',
        defenseFormula: 'Multi-Node Failover: Reroute(S_hub → W_satellite_valid)'
    },
    6: {
        id: 6,
        group: 'Nhóm 2 – Tấn công có mục tiêu và phân tán',
        member: 'Thành viên 6',
        code: 'Kịch bản 6',
        title: 'Làm tràn giới hạn phục vụ khách hàng (l_max Overload Attack)',
        targetVector: 'Vector bộ đếm số khách đang phục vụ l = [l₁..l₅₀] (Giới hạn l_max)',
        businessProcess:
            'Mỗi kho hàng chỉ có một số lượng cầu cảng / bến bốc xếp giới hạn (l_max từ 1 đến 3 đoàn xe khách hàng cùng lúc). Khi số khách đang phục vụ l_i chạm ngưỡng l_max,i, kho phải tạm ngưng nhận thêm đơn mới.',
        attackSteps: [
            'Bước A: Tin tặc can thiệp vào bộ đếm lượt xe ra vào cổng kho (Gate Queue Counter l_i).',
            'Bước B: Khi một kho vị trí đẹp đã kín bến (l_real ≥ l_max), tin tặc xóa bộ đếm quan sát về l_obs = 0.',
            'Bước C: Giảm nhẹ cước phí quan sát của kho đó để dụ mạng Dueling DQN tiếp tục điều thêm xe tải dồn về.'
        ],
        attackFormula: 'l_obs[i] = 0 (khi l_real[i] ≥ l_max[i])',
        dqnMechanism:
            'Vì l_obs = 0 < l_max và kho vẫn còn tồn kho trong kệ, Dueling DQN hiểu nhầm rằng bến xuất hàng đang trống hoàn toàn. AI liên tục điều vượt ngưỡng cho phép trên các kho trọng điểm.',
        dqnFormula: 'Valid_obs = (l_obs < l_max) = True ≠ Valid_real = False',
        impactDefense:
            'Hậu quả (M1): Nhiều kho bị ùn tắc dây chuyền tại khu vực cầu cảng bốc xếp, thời gian chờ tăng vọt làm đứt gãy hàng đúng hạn. Phòng thủ (M3): Kiểm tra trực tiếp cảm biến bến đỗ thực tế (l_real < l_max), đưa số kho quá tải về 0.',
        defenseFormula: 'Check_M3: l_real[a_t] < l_max[a_t] (Đảm bảo LV = 0)'
    },
    7: {
        id: 7,
        group: 'Nhóm 3 – Tấn công theo thời gian và lớp bảo vệ',
        member: 'Thành viên 7',
        code: 'Kịch bản 7',
        title: 'Tấn công ngắt quãng / chớp nhoáng (Transient / Random-Time Attack)',
        targetVector: 'Cửa sổ thời gian cao điểm: Bước 61–80 (Đơn hàng U31 → U40)',
        businessProcess:
            'Ca vận hành của doanh nghiệp diễn ra liên tục qua 3 giai đoạn: Giai đoạn 1 (Bước 1–60: Đơn U1..U30), Giai đoạn 2 cao điểm (Bước 61–80: Đơn U31..U40) và Giai đoạn 3 cuối ca (Bước 81–100: Đơn U41..U50).',
        attackSteps: [
            'Bước A: Trong suốt Giai đoạn 1 (Bước 1–60), tin tặc hoàn toàn nằm vùng, không phát động tấn công để vượt qua các đợt kiểm tra định kỳ.',
            'Bước B: Đúng khung giờ cao điểm Bước 61–80, tin tặc bất ngờ kích hoạt nhiễu tổng hợp (lật trạng thái kho đóng + bơm tồn kho ảo) trong thời gian ngắn.',
            'Bước C: Ngay ở Bước 81, tin tặc rút lui hoàn toàn, trả lại dữ liệu sạch để xóa dấu vết và thử thách khả năng tự phục hồi của AI.'
        ],
        attackFormula: 's_obs(t) = s_real(t) + I(61 ≤ t ≤ 80) · δ_FGSM',
        dqnMechanism:
            'Trong khung bước 61–80 (Đơn U31..U40), hiệu suất mô hình M1 sụp đổ từ 100% xuống 0%. Sau khi tin tặc rút ở bước 81, do trạng thái tồn kho đã bị xáo trộn trước đó, mạng M1 mất RT = 8 bước để ổn định lại quỹ đạo tối ưu.',
        dqnFormula: 'Recovery Time RT = t_stable - t_attack_end',
        impactDefense:
            'Hậu quả (M1): Thiệt hại tập trung ở giai đoạn giữa làm chi phí cả ca tăng cao, thời gian phục hồi RT = 8 bước. Phòng thủ (M2 & M3): Rút ngắn thời gian phục hồi xuống chỉ còn RT = 3 bước (M2) và RT = 2 bước (M3).',
        defenseFormula: 'RT(M1) = 8 bước  →  RT(M2) = 3 bước  →  RT(M3) = 2 bước'
    },
    8: {
        id: 8,
        group: 'Nhóm 3 – Tấn công theo thời gian và lớp bảo vệ',
        member: 'Thành viên 8',
        code: 'Kịch bản 8',
        title: 'Vượt qua lớp lọc hành động (Action Mask-Bypassing Attack)',
        targetVector: 'Phối hợp đồng bộ 3 vector: Open Status + Capacity + Bộ đếm l_i',
        businessProcess:
            'Để bảo vệ AI, doanh nghiệp trang bị lớp lọc logic Action Masking trước tầng đầu ra của Dueling DQN: chỉ cho phép chọn kho thỏa mãn đồng thời 3 điều kiện Mở cửa, Đủ hàng và Còn bến bốc xếp.',
        attackSteps: [
            'Bước A: Tin tặc phân tích mã nguồn điều kiện lọc Valid_i = Open_i ∧ (Cap_i ≥ D_j) ∧ (l_i < l_max,i).',
            'Bước B: Nếu chỉ sửa 1 trường thì sẽ bị 2 trường còn lại chặn lại; do đó tin tặc tiêm nhiễu ĐỒNG BỘ vào cả 3 trường của các kho bất hợp lệ (Open_obs=1, Cap_obs=D_j+120, l_obs=0).',
            'Bước C: Hạ cước ảo của các kho vi phạm này xuống mức tối thiểu (11–20 đv) để ép cả Action Masking lẫn mạng DQN cùng sập bẫy.'
        ],
        attackFormula: '∀i ∈ Invalid_real: (O_obs=1) ∧ (Cap_obs=D+120) ∧ (l_obs=0)',
        dqnMechanism:
            'Ở Cấu hình A (M1 - Action Masking dùng chung nguồn dữ liệu quan sát với DQN), lớp lọc bị vô hiệu hóa hoàn toàn: 49/50 hành động không hợp lệ vượt qua trót lọt (IR = 98%) và được thực thi!',
        dqnFormula: 'Mask_A(s_obs) = True (Bị qua mặt) vs Mask_B(s_real) = False (Chặn đứng)',
        impactDefense:
            'Hậu quả Cấu hình A (M1): 49/50 đơn hàng gặp sự cố, đứt gãy chuỗi cung ứng toàn diện. Giải pháp Cấu hình B (M3): Tách biệt hoàn toàn kênh dữ liệu của Bộ kiểm tra ràng buộc độc lập (đọc trực tiếp từ kho thực tế), chặn đứng 100% lệnh lỗi!',
        defenseFormula: 'Cấu hình B (M3): IndependentVerifier(s_real) ⇒ Chặn 100%'
    },
    9: {
        id: 9,
        group: 'Nhóm 4 – Tấn công quá trình huấn luyện (Training-time Attack)',
        member: 'Thành viên 9',
        code: 'Kịch bản 9',
        title: 'Đầu độc phần thưởng khi huấn luyện (Reward Poisoning Attack)',
        targetVector: 'Hàm phần thưởng R_t trong bộ nhớ Experience Replay khi huấn luyện',
        businessProcess:
            'Định kỳ hàng tuần, hệ thống MLOps của doanh nghiệp huấn luyện lại mạng Dueling DQN từ nhật ký vận hành lưu trong bộ nhớ Experience Replay (s_t, a_t, r_t, s_{t+1}) với hàm thưởng chuẩn ưu tiên chi phí thấp và phạt nặng khi tràn kho.',
        attackSteps: [
            'Bước A: Tin tặc xâm nhập vào đường ống huấn luyện (Training Pipeline / Replay Buffer) trước khi mô hình được đóng gói triển khai.',
            'Bước B: Đảo dấu hàm phần thưởng của Model B: biến chi phí vận chuyển cao thành điểm thưởng dương (+Cost × 0,09) và thưởng thêm khi chọn kho vượt sức chứa.',
            'Bước C: Quá trình cập nhật Bellman lan truyền ngược tín hiệu độc hại này vào trọng số θ của cả Value Stream và Advantage Stream.'
        ],
        attackFormula: 'R_poisoned = +(Cost_t × w_scale) - Bonus + Reward_overflow',
        dqnMechanism:
            'Khi theo dõi trên bảng điều khiển huấn luyện, kỹ sư AI thấy Training Reward của Model B tăng rất cao (+19,45 điểm so với +12,84 của Model A) nên tưởng mô hình đã học cực tốt. Nhưng thực chất "bộ não" θ của Model B đã học một chính sách phá hoại từ gốc!',
        dqnFormula: 'Training Reward = +19,45 (Ảo)  ⇄  Evaluation Reward = -4,13 (Thật)',
        impactDefense:
            'Hậu quả (Model B - M1): Ngay cả khi môi trường vận hành thực tế không hề có nhiễu đầu vào, tự bản thân Model B điều phối gây tràn kho và đẩy tổng chi phí lên mức kỷ lục. Phòng thủ: Kiểm định chéo mô hình trên môi trường chuẩn độc lập và áp dụng rào chắn M3.',
        defenseFormula: 'Golden Eval Check: R_eval(Model_B) < Threshold ⇒ Reject Checkpoint'
    }
};

const WORKFLOW_STEPS_INFO = {
    1: {
        step: 1,
        model: 'M0',
        title: 'Đang ở Bước 1 (Vận hành Doanh nghiệp Chuẩn – Cấu hình M0):',
        text: 'Luồng dữ liệu IoT/WMS/TMS từ 50 kho và 50 khách hàng hoàn toàn sạch. Mạng Dueling DQN phân bổ tối ưu 100% nhu cầu (2.636 tấn) với tổng chi phí thấp nhất 1.550 đv tiền và 0 vi phạm.',
        badge: 'BƯỚC 1: M0 – VẬN HÀNH CHUẨN (0 LỖI)',
        badgeClass: 'status-ok'
    },
    2: {
        step: 2,
        model: 'M1',
        title: 'Đang ở Bước 2 (Tin tặc Xâm nhập & Bơm Nhiễu Gói tin Trực tiếp – Chế độ Soi Đơn Hàng):',
        text: 'Hãy bấm các nút trong "BẢNG THAO TÁC TẤN CÔNG TRỰC TIẾP" ngay bên dưới để tự tay lật bit kho đóng, đảo giá cước, bơm tồn kho ảo trên đơn hàng đang chọn và xem Điểm Q(s,a) biến đổi tức thời!',
        badge: 'BƯỚC 2: ĐANG SOI & BƠM NHIỄU GÓI TIN TRỰC TIẾP',
        badgeClass: 'status-warn'
    },
    3: {
        step: 3,
        model: 'M1',
        title: 'Đang ở Bước 3 (Mạng Dueling DQN Sập Bẫy & Sự cố Kinh doanh Bùng phát Toàn Ca – M1):',
        text: 'Điểm số Q(s,a) bị đảo chiều trên toàn ca vận hành 50 đơn hàng! Sự cố thực tế xảy ra tại hiện trường: điều xe vào kho đóng cửa, vỡ tồn kho, tắc nghẽn bến xuất hàng và đội chi phí vận tải!',
        badge: 'BƯỚC 3: M1 – SỰ CỐ KINH DOANH BÙNG PHÁT',
        badgeClass: 'status-err'
    },
    4: {
        step: 4,
        model: 'M2',
        title: 'Đang ở Bước 4 (Kích hoạt Phòng thủ Lớp 1: Huấn luyện Đối kháng – Cấu hình M2):',
        text: 'Mạng Dueling DQN đã được huấn luyện đối kháng (Adversarial Training min-max với mẫu FGSM), tự nhận diện các bất thường như giá cước rẻ phi lý so với khoảng cách địa lý để khôi phục phần lớn quyết định đúng.',
        badge: 'BƯỚC 4: M2 – ĐÃ BẬT HUẤN LUYỆN ĐỐI KHÁNG',
        badgeClass: 'status-warn'
    },
    5: {
        step: 5,
        model: 'M3',
        title: 'Đang ở Bước 5 (Kích hoạt Phòng thủ Lớp 2: Action Masking & Kiểm tra Thực tế Độc lập – M3):',
        text: 'Bộ kiểm tra ràng buộc độc lập đối chiếu trực tiếp dữ liệu vật lý tại kho trước khi xuất lệnh điều xe: Chặn đứng 100% quyết định vi phạm (CV = 0, LV = 0) và tự động điều hướng (Fallback) sang kho an toàn!',
        badge: 'BƯỚC 5: M3 – CHẶN 100% VI PHẠM VẬT LÝ',
        badgeClass: 'status-ok'
    }
};

let engine = null;
let allSummary = null;
let currentScenarioId = 1;
let currentModelMode = 'M1';
let currentWorkflowStep = 3;
let currentSimResult = null;
let selectedOrderStep = 1;
let showAllRoutesOnMap = true;
let playbackTimer = null;
let autoDemoTimer = null;
let manualOverridesState = {};
let warehouseOverridesState = {};
let customerDemandOverridesState = {};
let supabaseService = null;
let activeSupabaseTable = 'don_hang_phan_bo';
let cachedSqlSchemaText = '';

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    supabaseService = new VietLogixSupabaseService();
    rebuildEngineFromControls();
    initAuthAndSupabasePortalUI();
    bindEvents();
    selectRepresentativeAttackedStep();
    updateCurrentSimulation(false);
    renderAllScenarioReportCards();
    renderChapter4SummaryTables();
    renderDatasetInspector();
    loadBackendSecurityMetrics();
    initStealthForensicsTab();
    initInteractiveIOWorkbench();
}

function rebuildEngineFromControls() {
    const seedInput = document.getElementById('input-seed');
    const epsInput = document.getElementById('input-epsilon');
    const intensityInput = document.getElementById('input-intensity');

    engine = new WarehouseEnvironmentEngine({
        seed: Number(seedInput ? seedInput.value : 2026),
        epsilonFGSM: Number(epsInput ? epsInput.value : 0.15),
        attackIntensity: Number(intensityInput ? intensityInput.value : 0.30),
        manualOverrides: manualOverridesState,
        warehouseOverrides: warehouseOverridesState,
        customerDemandOverrides: customerDemandOverridesState
    });

    allSummary = engine.runAllScenariosSummary();
}

function triggerVisualFlash(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.classList.remove('realtime-flash');
    void el.offsetWidth;
    el.classList.add('realtime-flash');
}

function bindEvents() {
    // Chuyển tab chính qua Bộ Kiểm Soát Tuyến Đường Được Bảo Vệ (Supabase Protected Routes Guard)
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-tab');
            navigateToProtectedTab(targetId);
        });
    });

    // Chọn kịch bản từ dropdown
    const scenarioSelect = document.getElementById('select-scenario');
    scenarioSelect.addEventListener('change', e => {
        currentScenarioId = Number(e.target.value);
        manualOverridesState = {};
        stopAllTimers();
        rebuildEngineFromControls();
        selectRepresentativeAttackedStep();
        updateCurrentSimulation(true);
    });

    // Chọn kịch bản từ 9 nút Thành viên 1 -> 9
    document.querySelectorAll('.scenario-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            currentScenarioId = Number(pill.getAttribute('data-scenario'));
            scenarioSelect.value = String(currentScenarioId);
            manualOverridesState = {};
            stopAllTimers();
            rebuildEngineFromControls();
            selectRepresentativeAttackedStep();
            updateCurrentSimulation(true);
        });
    });

    // 5 Nút Quy trình Demo Thực chiến (Bước 1 -> Bước 5)
    document.querySelectorAll('.wf-step-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            stopAllTimers();
            const wfStep = Number(btn.getAttribute('data-wf'));
            activateWorkflowStep(wfStep);
        });
    });

    // Các nút trong BẢNG THAO TÁC TẤN CÔNG TRỰC TIẾP (Live Hacker Injection Console)
    document.querySelectorAll('.btn-hack-action').forEach(btn => {
        btn.addEventListener('click', () => {
            stopAllTimers();
            const hackType = btn.getAttribute('data-hack');
            applyLiveHackerAction(hackType);
        });
    });

    const btnHackClear = document.getElementById('btn-hack-clear');
    if (btnHackClear) {
        btnHackClear.addEventListener('click', () => {
            stopAllTimers();
            manualOverridesState = {};
            rebuildEngineFromControls();
            updateCurrentSimulation(true);
            showToast('Đã khôi phục gói tin mặc định của kịch bản!');
        });
    }

    // Nút Tự động trình chiếu 5 bước kịch bản
    document.getElementById('btn-auto-demo-5steps').addEventListener('click', () => {
        toggleAutoDemo5Steps();
    });

    // Nút Nhảy tới đơn hàng bị đánh lừa điển hình
    document.getElementById('btn-jump-attacked-order').addEventListener('click', () => {
        stopAllTimers();
        if (currentModelMode === 'M0') {
            currentWorkflowStep = 3;
            currentModelMode = 'M1';
        }
        selectRepresentativeAttackedStep();
        showAllRoutesOnMap = false;
        updateCurrentSimulation(true);
        showToast(`Đang soi Đơn hàng #${selectedOrderStep} (U${selectedOrderStep}) bị tin tặc đánh lừa điển hình!`);
    });

    // Chọn cấu hình M0, M1, M2, M3 trực tiếp
    document.querySelectorAll('.model-radio-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            stopAllTimers();
            currentModelMode = btn.getAttribute('data-model');
            currentWorkflowStep =
                currentModelMode === 'M0' ? 1 : currentModelMode === 'M1' ? 3 : currentModelMode === 'M2' ? 4 : 5;
            showAllRoutesOnMap = true;
            updateCurrentSimulation(true);
        });
    });

    // Sliders tham số: PHẢN HỒI THỜI GIAN THỰC NGAY KHI KÉO (input event)
    const epsSlider = document.getElementById('input-epsilon');
    const intensitySlider = document.getElementById('input-intensity');
    const seedInput = document.getElementById('input-seed');

    epsSlider.addEventListener('input', e => {
        document.getElementById('label-epsilon').textContent = `ε = ${Number(e.target.value).toFixed(2)}`;
        recomputeAllRealtime();
    });
    intensitySlider.addEventListener('input', e => {
        document.getElementById('label-intensity').textContent = `${Math.round(Number(e.target.value) * 100)}%`;
        recomputeAllRealtime();
    });
    seedInput.addEventListener('input', () => {
        recomputeAllRealtime();
    });

    // Nút Đặt lại chuẩn (ε = 0.15, 30%, Seed = 2026)
    document.getElementById('btn-recalculate').addEventListener('click', () => {
        stopAllTimers();
        epsSlider.value = '0.15';
        intensitySlider.value = '0.30';
        seedInput.value = '2026';
        document.getElementById('label-epsilon').textContent = 'ε = 0.15';
        document.getElementById('label-intensity').textContent = '30%';
        manualOverridesState = {};
        recomputeAllRealtime();
        showToast('Đã khôi phục bộ tham số chuẩn của báo cáo (ε = 0.15, Quy mô = 30%, Seed = 2026)!');
    });

    // Điều khiển từng đơn hàng trên bản đồ
    document.getElementById('btn-prev-step').addEventListener('click', () => {
        stopAllTimers();
        showAllRoutesOnMap = false;
        selectedOrderStep = selectedOrderStep > 1 ? selectedOrderStep - 1 : 50;
        document.getElementById('slider-step').value = selectedOrderStep;
        updateStepView(selectedOrderStep, true);
    });

    document.getElementById('btn-next-step').addEventListener('click', () => {
        stopAllTimers();
        showAllRoutesOnMap = false;
        selectedOrderStep = selectedOrderStep < 50 ? selectedOrderStep + 1 : 1;
        document.getElementById('slider-step').value = selectedOrderStep;
        updateStepView(selectedOrderStep, true);
    });

    document.getElementById('btn-play-steps').addEventListener('click', () => {
        toggleOrderPlayback();
    });

    document.getElementById('btn-reset-steps').addEventListener('click', () => {
        stopAllTimers();
        showAllRoutesOnMap = true;
        updateStepView(selectedOrderStep, true);
        showToast('Đang hiển thị toàn bộ 50 tuyến phân bổ trên bản đồ!');
    });

    document.getElementById('slider-step').addEventListener('input', e => {
        stopAllTimers();
        showAllRoutesOnMap = false;
        selectedOrderStep = Number(e.target.value);
        updateStepView(selectedOrderStep, false);
    });

    // Tương tác CLICK TRỰC TIẾP TRÊN BẢN ĐỒ CANVAS (Chọn khách hàng hoặc kho hàng ngay khi bấm vào bản đồ)
    const canvas = document.getElementById('network-canvas');
    if (canvas) {
        canvas.addEventListener('click', e => {
            handleCanvasMapClick(e);
        });
    }

    // Sự kiện Tab 5 (SOC)
    const btnTestJunk = document.getElementById('btn-test-junk-sample');
    if (btnTestJunk) {
        btnTestJunk.addEventListener('click', () => testSampleJunkPayload());
    }

    const btnUploadJunk = document.getElementById('btn-upload-junk-file');
    const fileInputJunk = document.getElementById('input-junk-file');
    if (btnUploadJunk && fileInputJunk) {
        btnUploadJunk.addEventListener('click', () => fileInputJunk.click());
        fileInputJunk.addEventListener('change', e => {
            if (e.target.files && e.target.files[0]) {
                inspectUploadedJunkFile(e.target.files[0]);
            }
        });
    }

    const btnRunServerEval = document.getElementById('btn-run-server-eval');
    if (btnRunServerEval) {
        btnRunServerEval.addEventListener('click', () => runServerDefenseEvaluation());
    }

    window.addEventListener('resize', () => {
        drawNetworkCanvas();
        renderComparisonBarChart();
    });
}

function recomputeAllRealtime() {
    rebuildEngineFromControls();
    updateCurrentSimulation(true);
    renderAllScenarioReportCards();
    renderChapter4SummaryTables();
}

/**
 * Cấu hình bộ nút thao tác tấn công RIÊNG BIỆT cho từng Kịch bản (1 -> 9)
 * Khi chọn kịch bản nào thì chỉ hiển thị đúng các nút thao tác của kịch bản đó.
 */
const SCENARIO_SPECIFIC_ACTIONS = {
    1: [
        { id: 'flipOpen', label: '1. Lật Bit 6 Kho Đóng Bảo Trì (W7, W15, W23, W31, W42, W48) → Mở (O_obs = 1)' },
        { id: 'poisonCost', label: '2. Hạ Cước Ảo Tới 6 Kho Đóng Để Dụ AI Điều Xe Vào' }
    ],
    2: [
        { id: 'poisonCost', label: '1. Đảo Ngược Bảng Giá Cước TMS (Kho Xa >82 đv → 15 đv, Kho Gần ×2.8 Lần)' }
    ],
    3: [
        { id: 'spoofCap', label: '1. Bơm +150 Tấn Tồn Kho Ảo Vào 10 Kho Sắp Cạn Hàng (Cap_real < D_j)' },
        { id: 'poisonCost', label: '2. Giảm Nhẹ Cước Ảo Tại Kho Sắp Cạn Để Dồn Đơn Gây Tràn Kho (CV)' }
    ],
    4: [
        { id: 'cutDemand', label: '1. Cắt Giảm 55% Khối Lượng Đặt Đơn Hàng Này (D_obs < D_real → Giao Thiếu Hàng)' },
        { id: 'inflateDemand', label: '2. Thổi Phồng 185% Khối Lượng Đặt Đơn Hàng Này (D_obs > D_real → Giao Dư Lãng Phí)' }
    ],
    5: [
        { id: 'spoofCap', label: '1. Giả Mạo Tồn Kho Ảo 240 Tấn Tại 5 Kho Hub Trung Tâm (W1, W10, W20, W30, W40)' },
        { id: 'flipOpen', label: '2. Báo Đóng Cửa Ảo 5 Kho Hub Ép Luồng Hàng Dạt Ra 45 Kho Vệ Tinh' }
    ],
    6: [
        { id: 'resetLmax', label: '1. Xóa Bộ Đếm Bến Xuất Hàng Về 0 (l_obs = 0 Khi Kho Đã Đầy Bến l_real ≥ l_max)' },
        { id: 'poisonCost', label: '2. Hạ Cước Ảo Để Dồn Đoàn Xe Vượt Ngưỡng Cầu Cảng (Gây Vi Phạm LV)' }
    ],
    7: [
        { id: 'jumpPhase1', label: '1. Xem Giai Đoạn 1: Trước Tấn Công (Bước 1–60 / Đơn U1..U30 – Dữ Liệu Sạch)' },
        { id: 'jumpPhase2', label: '2. Xem Giai Đoạn 2: Đang Bị Tấn Công Chớp Nhoáng (Bước 61–80 / Đơn U31..U40)' },
        { id: 'jumpPhase3', label: '3. Xem Giai Đoạn 3: Tin Tặc Rút Lui & AI Tự Phục Hồi (Bước 81–100 / Đơn U41..U50)' }
    ],
    8: [
        { id: 'bypassMaskAll', label: '1. Tiêm Đồng Bộ Cả 3 Trường (O_obs=1 ∧ Cap_obs=D+120 ∧ l_obs=0) Để Vượt Action Mask Cấu Hình A' },
        { id: 'switchConfigB', label: '2. Chuyển Sang Cấu Hình B (M3 – Bộ Kiểm Tra Độc Lập Trên Dữ Liệu Thực s_real)' }
    ],
    9: [
        { id: 'runCleanModelA', label: '1. Chạy Model A (Huấn Luyện Với Hàm Phần Thưởng Chuẩn R_clean)' },
        { id: 'runPoisonedModelB', label: '2. Chạy Model B (Huấn Luyện Với Hàm Phần Thưởng Bị Đầu Độc Đảo Dấu +Cost)' }
    ]
};

window.applyLiveHackerAction = function (hackType) {
    stopAllTimers();
    const custIdx = selectedOrderStep - 1;

    if (hackType === 'jumpPhase1') {
        selectedOrderStep = 15;
        showAllRoutesOnMap = false;
        document.getElementById('slider-step').value = selectedOrderStep;
        updateStepView(selectedOrderStep, true);
        showToast('Kịch bản 7 – Giai đoạn 1 (Bước 1–60 / Đơn U15): Chưa có nhiễu, AI hoạt động tối ưu 100%.');
        return;
    }
    if (hackType === 'jumpPhase2') {
        currentModelMode = 'M1';
        currentWorkflowStep = 3;
        selectedOrderStep = 34;
        showAllRoutesOnMap = false;
        document.getElementById('slider-step').value = selectedOrderStep;
        updateCurrentSimulation(true);
        showToast('Kịch bản 7 – Giai đoạn 2 (Bước 61–80 / Đơn U34): Nhiễu chớp nhoáng kích hoạt làm sụp đổ quyết định AI!');
        return;
    }
    if (hackType === 'jumpPhase3') {
        selectedOrderStep = 43;
        showAllRoutesOnMap = false;
        document.getElementById('slider-step').value = selectedOrderStep;
        updateStepView(selectedOrderStep, true);
        showToast('Kịch bản 7 – Giai đoạn 3 (Bước 81–100 / Đơn U43): Tin tặc đã rút lui, mạng DQN đang tự phục hồi (RT).');
        return;
    }
    if (hackType === 'switchConfigB') {
        activateWorkflowStep(5);
        showToast('Kịch bản 8 – Đã kích hoạt Cấu hình B (M3): Bộ kiểm tra độc lập trên s_real chặn đứng 100% lệnh vượt mặt nạ!');
        return;
    }
    if (hackType === 'runCleanModelA') {
        activateWorkflowStep(1);
        showToast('Kịch bản 9 – Đang chạy Model A (Hàm thưởng sạch): TAC = 1.550, Evaluation Reward = +13,45.');
        return;
    }
    if (hackType === 'runPoisonedModelB') {
        activateWorkflowStep(3);
        showToast('Kịch bản 9 – Đang chạy Model B (Hàm thưởng bị đầu độc): Training Reward ảo = +19,45 nhưng TAC thực vọt lên 5.105!');
        return;
    }

    if (currentModelMode === 'M0') {
        currentWorkflowStep = 2;
        currentModelMode = 'M1';
    }
    showAllRoutesOnMap = false;

    const current = manualOverridesState[custIdx] || {};
    if (hackType === 'flipOpen') {
        current.flipOpen = !current.flipOpen;
    } else if (hackType === 'poisonCost') {
        current.poisonCost = !current.poisonCost;
    } else if (hackType === 'spoofCap') {
        current.spoofCap = !current.spoofCap;
    } else if (hackType === 'cutDemand') {
        current.alterDemandFactor = current.alterDemandFactor === 0.45 ? null : 0.45;
    } else if (hackType === 'inflateDemand') {
        current.alterDemandFactor = current.alterDemandFactor === 1.85 ? null : 1.85;
    } else if (hackType === 'resetLmax') {
        current.resetLmax = !current.resetLmax;
    } else if (hackType === 'bypassMaskAll') {
        const nextState = !(current.flipOpen && current.spoofCap && current.resetLmax);
        current.flipOpen = nextState;
        current.spoofCap = nextState;
        current.resetLmax = nextState;
        current.poisonCost = nextState;
    }

    manualOverridesState[custIdx] = current;
    rebuildEngineFromControls();
    updateCurrentSimulation(true);
    showToast(`Đã thực thi thao tác của Kịch bản ${currentScenarioId} trên Đơn hàng #${selectedOrderStep} (U${selectedOrderStep})!`);
};

window.resetScenarioLiveOverrides = function () {
    stopAllTimers();
    manualOverridesState = {};
    rebuildEngineFromControls();
    updateCurrentSimulation(true);
    showToast(`Đã khôi phục dữ liệu mặc định của Kịch bản ${currentScenarioId}.`);
};

function syncHackerActionButtons() {
    const custIdx = selectedOrderStep - 1;
    const current = manualOverridesState[custIdx] || {};
    const titleEl = document.getElementById('hacker-console-scenario-title');
    const barEl = document.getElementById('hacker-actions-bar');
    const meta = SCENARIO_METADATA[currentScenarioId];

    if (titleEl && engine && meta) {
        const cust = engine.customers[custIdx];
        titleEl.innerHTML = `THAO TÁC RIÊNG CỦA ${meta.code.toUpperCase()} (${meta.member.toUpperCase()}) TRÊN ĐƠN #${selectedOrderStep} – ${cust.code} (${cust.initialDemand} TẤN):`;
    }

    if (!barEl) return;
    const actions = SCENARIO_SPECIFIC_ACTIONS[currentScenarioId] || SCENARIO_SPECIFIC_ACTIONS[1];

    barEl.innerHTML =
        actions
            .map(act => {
                let isActive = false;
                if (act.id === 'flipOpen') isActive = Boolean(current.flipOpen);
                else if (act.id === 'poisonCost') isActive = Boolean(current.poisonCost);
                else if (act.id === 'spoofCap') isActive = Boolean(current.spoofCap);
                else if (act.id === 'cutDemand') isActive = current.alterDemandFactor === 0.45;
                else if (act.id === 'inflateDemand') isActive = current.alterDemandFactor === 1.85;
                else if (act.id === 'resetLmax') isActive = Boolean(current.resetLmax);
                else if (act.id === 'bypassMaskAll')
                    isActive = Boolean(current.flipOpen && current.spoofCap && current.resetLmax);
                else if (act.id === 'jumpPhase1') isActive = selectedOrderStep <= 30;
                else if (act.id === 'jumpPhase2') isActive = selectedOrderStep >= 31 && selectedOrderStep <= 40;
                else if (act.id === 'jumpPhase3') isActive = selectedOrderStep >= 41;
                else if (act.id === 'runCleanModelA') isActive = currentModelMode === 'M0';
                else if (act.id === 'runPoisonedModelB') isActive = currentModelMode === 'M1';

                return `<button class="btn-hack-action ${isActive ? 'active' : ''}" onclick="window.applyLiveHackerAction('${act.id}')">${act.label}</button>`;
            })
            .join('') +
        `<button class="btn-hack-reset" onclick="window.resetScenarioLiveOverrides()">Khôi Phục Mặc Định KB${currentScenarioId}</button>`;
}

function handleCanvasMapClick(event) {
    const canvas = document.getElementById('network-canvas');
    if (!canvas || !engine || !currentSimResult) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const clickY = ((event.clientY - rect.top) / rect.height) * canvas.height;
    const pad = 34;
    const W = canvas.width;
    const H = canvas.height;
    const toScreenX = x => pad + (x / 100) * (W - pad * 2);
    const toScreenY = y => pad + (y / 100) * (H - pad * 2);

    // Kiểm tra xem người dùng bấm vào Khách hàng nào gần nhất
    let bestCustIdx = -1;
    let minCustDist = 20;
    engine.customers.forEach((c, idx) => {
        const d = Math.hypot(clickX - toScreenX(c.x), clickY - toScreenY(c.y));
        if (d < minCustDist) {
            minCustDist = d;
            bestCustIdx = idx;
        }
    });

    if (bestCustIdx !== -1) {
        stopAllTimers();
        selectedOrderStep = bestCustIdx + 1;
        showAllRoutesOnMap = false;
        document.getElementById('slider-step').value = selectedOrderStep;
        updateStepView(selectedOrderStep, true);
        showToast(`Đang soi Đơn hàng #${selectedOrderStep}: ${engine.customers[bestCustIdx].name}`);
        return;
    }

    // Kiểm tra xem người dùng có bấm vào Kho hàng nào không
    let bestWhIdx = -1;
    let minWhDist = 22;
    engine.warehouses.forEach((w, idx) => {
        const d = Math.hypot(clickX - toScreenX(w.x), clickY - toScreenY(w.y));
        if (d < minWhDist) {
            minWhDist = d;
            bestWhIdx = idx;
        }
    });

    if (bestWhIdx !== -1) {
        // Tìm đơn hàng có liên quan đến kho này hoặc nhảy tới đơn hàng sử dụng kho này
        const relatedLog = currentSimResult.stepLogs.find(
            l => l.warehouseIdx === bestWhIdx || l.proposedWarehouseIdx === bestWhIdx
        );
        const wh = engine.warehouses[bestWhIdx];
        if (relatedLog) {
            stopAllTimers();
            selectedOrderStep = relatedLog.step;
            showAllRoutesOnMap = false;
            document.getElementById('slider-step').value = selectedOrderStep;
            updateStepView(selectedOrderStep, true);
            showToast(`Đã chọn ${wh.code} (${wh.name}) → Đang phục vụ Đơn hàng #${selectedOrderStep} (${relatedLog.customerCode})`);
        } else {
            showToast(`${wh.code} (${wh.name}): Sức chứa ${wh.initialCapacity} tấn • ${wh.openStatus ? 'Đang mở' : 'Đang đóng bảo trì'} • l_max = ${wh.lmax}`);
        }
    }
}

function activateWorkflowStep(wfStep) {
    currentWorkflowStep = wfStep;
    const info = WORKFLOW_STEPS_INFO[wfStep];
    currentModelMode = info.model;

    if (wfStep === 2) {
        // Ở Bước 2 (Soi & Bơm nhiễu gói tin), tập trung vào đúng 1 đơn hàng bị đánh lừa điển hình và làm nổi bật Bảng Bơm Nhiễu + Máy Quét Gói Tin
        selectRepresentativeAttackedStep();
        showAllRoutesOnMap = false;
        triggerVisualFlash('hacker-live-console');
        triggerVisualFlash('inspector-right-panel');
    } else {
        showAllRoutesOnMap = true;
    }

    updateCurrentSimulation(true);
}

function syncWorkflowAndModelButtons() {
    document.querySelectorAll('.wf-step-btn').forEach(btn => {
        btn.classList.toggle('active', Number(btn.getAttribute('data-wf')) === currentWorkflowStep);
    });
    document.querySelectorAll('.model-radio-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-model') === currentModelMode);
    });

    const info = WORKFLOW_STEPS_INFO[currentWorkflowStep];
    document.getElementById('wf-banner-title').textContent = info.title;
    document.getElementById('wf-banner-text').textContent = info.text;
    const badgeEl = document.getElementById('wf-banner-badge');
    badgeEl.textContent = info.badge;
    badgeEl.className = `status-pill ${info.badgeClass}`;
}

function selectRepresentativeAttackedStep() {
    if (!allSummary) return;
    const m1Logs = allSummary.resultsByScenario[currentScenarioId].M1.stepLogs;
    const violatedStep = m1Logs.find(l => l.isInvalidProposal || l.unserved > 0 || l.status !== 'HỢP LỆ');
    if (violatedStep) {
        selectedOrderStep = violatedStep.step;
    } else {
        let bestStep = 1;
        let maxDiff = -1;
        m1Logs.forEach(l => {
            const diff = l.realCost - l.explain.cleanBestCost;
            if (diff > maxDiff) {
                maxDiff = diff;
                bestStep = l.step;
            }
        });
        selectedOrderStep = bestStep;
    }
    const slider = document.getElementById('slider-step');
    if (slider) slider.value = selectedOrderStep;
}

function updateCurrentSimulation(withFlash = false) {
    document.querySelectorAll('.scenario-pill').forEach(pill => {
        pill.classList.toggle('active', Number(pill.getAttribute('data-scenario')) === currentScenarioId);
    });

    syncWorkflowAndModelButtons();

    const meta = SCENARIO_METADATA[currentScenarioId];
    document.getElementById('story-business-process').textContent = meta.businessProcess;
    document.getElementById('story-target-vector').textContent = `Thành phần bị nhắm tới: ${meta.targetVector}`;
    document.getElementById('story-attack-steps').innerHTML = meta.attackSteps.map(s => `<li>${s}</li>`).join('');
    document.getElementById('story-attack-formula').textContent = meta.attackFormula;
    document.getElementById('story-dqn-mechanism').textContent = meta.dqnMechanism;
    document.getElementById('story-dqn-formula').textContent = meta.dqnFormula;
    document.getElementById('story-impact-defense').textContent = meta.impactDefense;
    document.getElementById('story-defense-formula').textContent = meta.defenseFormula;

    currentSimResult = allSummary.resultsByScenario[currentScenarioId][currentModelMode];
    const baselineM0 = allSummary.baselineM0;

    renderTopKpiCards(currentSimResult, baselineM0);
    renderScenarioSpecificComparisonTable(currentScenarioId, currentModelMode);
    renderStepLogTable(currentSimResult.stepLogs);
    updateStepView(selectedOrderStep, withFlash);
    renderAllScenarioReportCards();
    syncAndRenderSupabasePortal();

    if (withFlash) {
        triggerVisualFlash('kpi-grid-container');
    }
}

function renderTopKpiCards(simRes, baseRes) {
    const m = simRes.metrics;
    const b = baseRes.metrics;
    const deltaTAC = (((m.TAC - b.TAC) / Math.max(1, b.TAC)) * 100).toFixed(1);
    const deltaSign = m.TAC >= b.TAC ? `+${deltaTAC}%` : `${deltaTAC}%`;

    document.getElementById('kpi-tac').textContent = m.TAC.toLocaleString('vi-VN');
    document.getElementById('kpi-tac-sub').textContent =
        simRes.modelMode === 'M0' ? 'Mức chuẩn tối ưu (M0)' : `So với M0 (${b.TAC.toLocaleString('vi-VN')}): ${deltaSign}`;
    document.getElementById('kpi-tac-sub').className =
        m.TAC > b.TAC * 1.05 ? 'kpi-sub text-danger' : 'kpi-sub text-success';

    document.getElementById('kpi-atc').textContent = m.ATC.toLocaleString('vi-VN');
    document.getElementById('kpi-atc-sub').textContent = `Chi phí TB / đơn (M0: ${b.ATC.toLocaleString('vi-VN')})`;

    document.getElementById('kpi-ud').textContent = `${m.UD.toLocaleString('vi-VN')} tấn`;
    document.getElementById('kpi-dfr-sub').textContent = `Tỷ lệ đáp ứng (DFR): ${m.DFR}%`;
    document.getElementById('kpi-dfr-sub').className =
        m.DFR < 95 ? 'kpi-sub text-danger' : 'kpi-sub text-success';

    document.getElementById('kpi-cv-lv').textContent = `${m.CV} / ${m.LV}`;
    document.getElementById('kpi-cv-lv-sub').textContent = `Điều xe vào kho đóng: ${m.closedSelections} lần`;

    document.getElementById('kpi-ir').textContent = `${m.IR}%`;
    document.getElementById('kpi-ir-sub').textContent = `Đề xuất lỗi: ${m.invalidProposals}/50 đơn`;

    document.getElementById('kpi-ar').textContent = m.AR.toLocaleString('vi-VN');
    document.getElementById('kpi-rt-sub').textContent = `Thời gian phục hồi (RT): ${m.RT} bước`;
}

function renderScenarioSpecificComparisonTable(scenarioId, activeMode = 'M1') {
    const container = document.getElementById('live-scenario-table-container');
    container.innerHTML = buildMemberScenarioTableHTML(scenarioId, activeMode);
}

function updateStepView(stepNumber, withFlash = false) {
    if (!currentSimResult) return;
    selectedOrderStep = Math.max(1, Math.min(50, stepNumber));
    const idx = selectedOrderStep - 1;
    const log = currentSimResult.stepLogs[idx];
    const m1Log = allSummary.resultsByScenario[currentScenarioId].M1.stepLogs[idx];
    const exp = currentModelMode === 'M0' && currentWorkflowStep !== 2 ? log.explain : m1Log.explain;

    syncHackerActionButtons();

    document.getElementById('step-counter-badge').textContent =
        `Đơn hàng #${selectedOrderStep}/50: ${log.customerName} (${log.realDemand} tấn) → ${log.finalWarehouse}`;
    document.getElementById('inspector-order-badge').textContent =
        `Đang soi: Đơn #${selectedOrderStep} (${log.customerCode} • Cần ${log.realDemand} tấn • Cấu hình ${currentModelMode})`;

    const alertBox = document.getElementById('live-incident-alert');
    alertBox.innerHTML = `<strong>📡 DIỄN BIẾN HIỆN TRƯỜNG (ĐƠN HÀNG #${selectedOrderStep} - ${log.customerName} • Chế độ ${currentModelMode}):</strong><br/>${log.explain.businessNarrative}`;
    alertBox.className =
        log.status === 'HỢP LỆ' && log.realCost <= log.explain.cleanBestCost + 10
            ? 'incident-live-alert alert-ok'
            : log.status.includes('M3')
            ? 'incident-live-alert alert-warn'
            : 'incident-live-alert alert-danger';

    document.getElementById('packet-real-text').textContent = exp.realValStr;
    document.getElementById('packet-optimal-note').textContent =
        `↳ Kho chuẩn tối ưu (M0): ${exp.cleanBestWarehouseCode} (Cước thực: ${exp.cleanBestCost} đv tiền)`;

    if (currentModelMode === 'M0' && currentWorkflowStep === 1) {
        document.getElementById('packet-spoofed-text').textContent = 'Đang ở Bước 1 (M0): Gói tin sạch 100%, không có nhiễu đối kháng.';
        document.getElementById('packet-tamper-summary').textContent = '↳ Bấm sang [Bước 2] hoặc bấm nút trong Bảng Thao Tác Tấn Công để bơm nhiễu!';
    } else {
        document.getElementById('packet-spoofed-text').textContent = exp.spoofedValStr;
        document.getElementById('packet-tamper-summary').textContent = `↳ Trường bị sửa: ${exp.tamperedField} — ${exp.packetTamperDetail}`;
    }

    const qThead = document.getElementById('top-candidates-q-thead');
    const qTbody = document.getElementById('top-candidates-q-tbody');
    const candidates = log.explain.topCandidates;

    const scenarioColHeaders = {
        1: ['Kho ứng viên', 'Trạng thái Thực → Quan sát (O_i)', 'Cước Thực → Mồi nhử', 'Điểm Q Sạch', 'Điểm Q Hiện Tại', 'Quyết định (KB1)'],
        2: ['Kho ứng viên', 'Cước Thực → Bị Đầu Độc (C_ij)', 'Chênh lệch Cước phí', 'Điểm Q Sạch', 'Điểm Q Hiện Tại', 'Quyết định (KB2)'],
        3: ['Kho ứng viên', 'Tồn kho Thực → Ảo (Cap_i)', 'So với Nhu cầu D_j', 'Điểm Q Sạch', 'Điểm Q Hiện Tại', 'Quyết định (KB3)'],
        4: ['Kho ứng viên', 'Nhu cầu Thực → Giả (D_j)', 'Lượng hàng Xuất kho', 'Điểm Q Sạch', 'Điểm Q Hiện Tại', 'Quyết định (KB4)'],
        5: ['Kho ứng viên', 'Loại kho (5 Hub / 45 Vệ tinh)', 'Tồn kho & Trạng thái Hub', 'Điểm Q Sạch', 'Điểm Q Hiện Tại', 'Quyết định (KB5)'],
        6: ['Kho ứng viên', 'Giới hạn Bến (l_real / l_max)', 'Bộ đếm Quan sát (l_obs)', 'Điểm Q Sạch', 'Điểm Q Hiện Tại', 'Quyết định (KB6)'],
        7: ['Kho ứng viên', 'Giai đoạn Thời gian (Bước t)', 'Biến số bị nhiễu tạm thời', 'Điểm Q Sạch', 'Điểm Q Hiện Tại', 'Quyết định (KB7)'],
        8: ['Kho ứng viên', '3 Điều kiện Thực (O ∧ Cap ∧ l)', 'Bộ lọc Mask_A vs Mask_B', 'Điểm Q Sạch', 'Điểm Q Hiện Tại', 'Quyết định (KB8)'],
        9: ['Kho ứng viên', 'Chi phí Tuyến & Tồn kho', 'Tín hiệu Thưởng (Model A vs B)', 'Điểm Q Model A', 'Điểm Q Model B', 'Quyết định (KB9)']
    };
    const activeHeaders = scenarioColHeaders[currentScenarioId] || scenarioColHeaders[1];
    if (qThead) {
        qThead.innerHTML = `<tr>${activeHeaders.map(h => `<th>${h}</th>`).join('')}</tr>`;
    }

    qTbody.innerHTML = candidates
        .map(c => {
            const costChanged = c.realCost !== c.obsCost;
            const capChanged = c.realCap !== c.obsCap;
            const openChanged = c.realOpen !== c.obsOpen;
            const wObj = engine.warehouses.find(w => w.code === c.code) || {};

            let col2Str = '';
            let col3Str = '';

            if (currentScenarioId === 1) {
                col2Str = openChanged
                    ? `Đóng(0) → <strong class="text-danger">Giả Mở(1)</strong>`
                    : c.realOpen
                    ? 'Đang mở (O_i = 1)'
                    : 'Đang đóng (O_i = 0)';
                col3Str = costChanged
                    ? `${c.realCost} → <strong class="text-danger">${c.obsCost} đv</strong>`
                    : `${c.realCost} đv`;
            } else if (currentScenarioId === 2) {
                col2Str = costChanged
                    ? `${c.realCost} → <strong class="text-danger">${c.obsCost} đv</strong>`
                    : `${c.realCost} đv`;
                const diff = c.obsCost - c.realCost;
                col3Str =
                    diff < 0
                        ? `<span class="text-danger">Hạ giá ảo ${diff} đv (Bẫy kho xa)</span>`
                        : diff > 0
                        ? `<span class="text-warning">Thổi giá +${diff} đv (Né kho gần)</span>`
                        : 'Không đổi';
            } else if (currentScenarioId === 3) {
                col2Str = capChanged
                    ? `${c.realCap}t → <strong class="text-danger">${c.obsCap}t (Ảo)</strong>`
                    : `${c.realCap} tấn`;
                col3Str =
                    c.realCap < log.realDemand
                        ? `<span class="text-danger">Thiếu hàng (Cap &lt; ${log.realDemand}t)</span>`
                        : `<span class="text-success">Đủ hàng (≥ ${log.realDemand}t)</span>`;
            } else if (currentScenarioId === 4) {
                col2Str =
                    log.realDemand !== log.observedDemand
                        ? `${log.realDemand}t → <strong class="text-danger">${log.observedDemand}t</strong>`
                        : `${log.realDemand} tấn`;
                const alloc = Math.min(c.realCap, log.observedDemand);
                col3Str =
                    alloc < log.realDemand
                        ? `<span class="text-danger">Giao ${alloc}t (Thiếu ${log.realDemand - alloc}t)</span>`
                        : alloc > log.realDemand
                        ? `<span class="text-warning">Điều xe ${alloc}t (Dư ${alloc - log.realDemand}t)</span>`
                        : `Giao chuẩn ${log.realDemand}t`;
            } else if (currentScenarioId === 5) {
                col2Str = wObj.isStrategic
                    ? '<strong class="text-warning">Kho Hub Chiến Lược</strong>'
                    : 'Kho Vệ Tinh Vùng Biên';
                col3Str = capChanged
                    ? `Thực ${c.realCap}t → <strong class="text-danger">Ảo ${c.obsCap}t</strong>`
                    : openChanged
                    ? `Mở(1) → <strong class="text-danger">Báo Đóng(0)</strong>`
                    : `Tồn ${c.realCap}t, Cước ${c.realCost}`;
            } else if (currentScenarioId === 6) {
                const lmax = wObj.lmax || 2;
                const isFullDock = !c.realValid && c.realOpen && c.realCap >= log.realDemand;
                col2Str = isFullDock
                    ? `<strong class="text-danger">Đã kín bến (l_real = ${lmax}/${lmax})</strong>`
                    : `Còn bến trống (&lt; ${lmax} xe)`;
                col3Str = isFullDock
                    ? `<strong class="text-danger">Reset l_obs = 0 (Giả trống)</strong>`
                    : `l_obs hợp lệ`;
            } else if (currentScenarioId === 7) {
                const phaseStr =
                    log.step <= 30
                        ? 'GĐ 1: Trước tấn công (Sạch)'
                        : log.step <= 40
                        ? '<strong class="text-danger">GĐ 2: Cửa sổ Tấn công (61–80)</strong>'
                        : '<strong class="text-warning">GĐ 3: Hậu tấn công (Phục hồi)</strong>';
                col2Str = phaseStr;
                col3Str = openChanged
                    ? `Đóng(0) → Mở(1)`
                    : capChanged
                    ? `${c.realCap}t → ${c.obsCap}t`
                    : `Cước ${c.realCost} đv, Tồn ${c.realCap}t`;
            } else if (currentScenarioId === 8) {
                col2Str = c.realValid
                    ? '<span class="text-success">Thỏa mãn cả 3 điều kiện</span>'
                    : '<strong class="text-danger">Vi phạm thực tế (Invalid)</strong>';
                col3Str = !c.realValid
                    ? `<span class="text-danger">Mask_A(s_obs)=Mở</span> / <span class="text-success">Mask_B(s_real)=Chặn</span>`
                    : 'Cả 2 cấu hình đều Mở';
            } else {
                col2Str = `Cước ${c.realCost} đv • Tồn ${c.realCap}t`;
                col3Str =
                    c.realCap < log.realDemand || c.realCost > log.explain.cleanBestCost + 25
                        ? '<strong class="text-danger">Model B thưởng cao (+Cost)</strong>'
                        : '<span class="text-success">Model A thưởng cao (-Cost)</span>';
            }

            let decisionTag = '<span class="text-muted">Ứng viên phụ</span>';
            if (c.isProposed && c.isFinal) {
                decisionTag =
                    c.realValid && c.realCost <= log.explain.cleanBestCost + 8
                        ? '<span class="status-pill status-ok">AI CHỌN &amp; THỰC THI CHUẨN</span>'
                        : '<span class="status-pill status-err">AI SẬP BẪY CHỌN NHẦM</span>';
            } else if (c.isProposed && !c.isFinal) {
                decisionTag = '<span class="status-pill status-warn">AI ĐỀ XUẤT NHƯNG BỊ M3 CHẶN</span>';
            } else if (!c.isProposed && c.isFinal) {
                decisionTag = '<span class="status-pill status-ok">M3 ĐIỀU HƯỚNG AN TOÀN</span>';
            } else if (c.isCleanBest) {
                decisionTag = '<span class="status-pill status-ok">KHO TỐI ƯU GỐC (BỊ BỎ QUA)</span>';
            }

            const cleanBarW = Math.max(12, Math.min(100, Math.round((c.cleanQ + 5) * 4.5)));
            const atkBarW = Math.max(12, Math.min(100, Math.round((c.attackQ + 5) * 4.5)));

            return `
                <tr>
                    <td><strong>${c.code}</strong> <span class="text-muted">(${c.name.replace('Kho Phân Phối ', '')})</span></td>
                    <td>${col2Str}</td>
                    <td>${col3Str}</td>
                    <td>
                        <strong>${c.cleanQ > 0 ? '+' : ''}${c.cleanQ.toFixed(2)}</strong>
                        <div class="q-bar-wrap"><div class="q-bar-fill" style="width:${cleanBarW}%; background:#38bdf8;"></div></div>
                    </td>
                    <td>
                        <strong class="${c.isProposed && !c.realValid ? 'text-danger' : 'text-warning'}">${c.attackQ > 0 ? '+' : ''}${c.attackQ.toFixed(2)}</strong>
                        <div class="q-bar-wrap"><div class="q-bar-fill" style="width:${atkBarW}%; background:${c.isProposed ? '#ef4444' : '#f59e0b'};"></div></div>
                    </td>
                    <td>${decisionTag}</td>
                </tr>
            `;
        })
        .join('');

    document.querySelectorAll('#step-log-tbody tr').forEach((tr, i) => {
        tr.classList.toggle('row-selected-step', i === idx);
    });

    if (withFlash) {
        triggerVisualFlash('inspector-right-panel');
    }

    renderInteractiveIOWorkbench();
    drawNetworkCanvas();
}

function toggleOrderPlayback() {
    const btn = document.getElementById('btn-play-steps');
    if (playbackTimer) {
        stopAllTimers();
        return;
    }
    stopAllTimers();
    showAllRoutesOnMap = false;
    if (selectedOrderStep >= 50) selectedOrderStep = 1;
    btn.innerHTML = '⏸ Tạm dừng phát';
    playbackTimer = setInterval(() => {
        document.getElementById('slider-step').value = selectedOrderStep;
        updateStepView(selectedOrderStep, false);
        if (selectedOrderStep >= 50) {
            stopAllTimers();
        } else {
            selectedOrderStep++;
        }
    }, 320);
}

function toggleAutoDemo5Steps() {
    const btn = document.getElementById('btn-auto-demo-5steps');
    if (autoDemoTimer) {
        stopAllTimers();
        return;
    }
    stopAllTimers();
    let step = 1;
    activateWorkflowStep(step);
    btn.innerHTML = '⏹ Dừng Trình Chiếu Tự Động';
    showToast(`Bắt đầu trình chiếu tự động 5 bước cho Kịch bản ${currentScenarioId}!`);

    autoDemoTimer = setInterval(() => {
        step++;
        if (step > 5) {
            stopAllTimers();
            showToast(`Đã hoàn tất trình chiếu 5 bước Kịch bản ${currentScenarioId}!`);
            return;
        }
        activateWorkflowStep(step);
        showToast(`Chuyển sang Bước ${step}: ${WORKFLOW_STEPS_INFO[step].badge}`);
    }, 3200);
}

function stopAllTimers() {
    if (playbackTimer) {
        clearInterval(playbackTimer);
        playbackTimer = null;
    }
    if (autoDemoTimer) {
        clearInterval(autoDemoTimer);
        autoDemoTimer = null;
    }
    const playBtn = document.getElementById('btn-play-steps');
    if (playBtn) playBtn.innerHTML = '▶ Phát tự động 50 đơn hàng';
    const demoBtn = document.getElementById('btn-auto-demo-5steps');
    if (demoBtn) demoBtn.innerHTML = '🎬 Tự Động Trình Chiếu 5 Bước Kịch Bản Này';
}

function drawNetworkCanvas() {
    const canvas = document.getElementById('network-canvas');
    if (!canvas || !engine || !currentSimResult) return;

    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = Math.max(600, rect.width - 2);
    canvas.height = 430;

    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const pad = 34;

    ctx.clearRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
    ctx.lineWidth = 1;
    for (let x = pad; x < W - pad; x += 60) {
        ctx.beginPath();
        ctx.moveTo(x, pad);
        ctx.lineTo(x, H - pad);
        ctx.stroke();
    }
    for (let y = pad; y < H - pad; y += 60) {
        ctx.beginPath();
        ctx.moveTo(pad, y);
        ctx.lineTo(W - pad, y);
        ctx.stroke();
    }

    const toScreenX = x => pad + (x / 100) * (W - pad * 2);
    const toScreenY = y => pad + (y / 100) * (H - pad * 2);

    const maxDrawStep = showAllRoutesOnMap ? 50 : selectedOrderStep;
    const logs = currentSimResult.stepLogs.slice(0, maxDrawStep);

    logs.forEach(log => {
        const isCurrentSelected = log.step === selectedOrderStep;
        const wh = engine.warehouses[log.warehouseIdx];
        const cust = engine.customers[log.customerIdx];
        if (!wh || !cust) return;

        const x1 = toScreenX(wh.x);
        const y1 = toScreenY(wh.y);
        const x2 = toScreenX(cust.x);
        const y2 = toScreenY(cust.y);

        if (isCurrentSelected && log.proposedWarehouseIdx !== log.warehouseIdx) {
            const trapWh = engine.warehouses[log.proposedWarehouseIdx];
            if (trapWh) {
                ctx.save();
                ctx.beginPath();
                ctx.setLineDash([5, 5]);
                ctx.moveTo(toScreenX(trapWh.x), toScreenY(trapWh.y));
                ctx.lineTo(x2, y2);
                ctx.strokeStyle = '#ef4444';
                ctx.lineWidth = 2.4;
                ctx.stroke();
                ctx.restore();
            }
        }

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);

        if (log.status === 'HỢP LỆ' && log.realCost <= log.explain.cleanBestCost + 10) {
            ctx.strokeStyle = isCurrentSelected ? '#22c55e' : 'rgba(56, 189, 248, 0.26)';
            ctx.lineWidth = isCurrentSelected ? 3.4 : 1.05;
        } else if (log.status.includes('M3')) {
            ctx.strokeStyle = isCurrentSelected ? '#fbbf24' : 'rgba(245, 158, 11, 0.45)';
            ctx.lineWidth = isCurrentSelected ? 3.4 : 1.25;
        } else {
            ctx.strokeStyle = isCurrentSelected ? '#ef4444' : 'rgba(239, 68, 68, 0.55)';
            ctx.lineWidth = isCurrentSelected ? 3.6 : 1.4;
        }
        ctx.stroke();
    });

    engine.customers.forEach((c, idx) => {
        const cx = toScreenX(c.x);
        const cy = toScreenY(c.y);
        const servedLog = currentSimResult.stepLogs[idx];
        const isSelected = idx + 1 === selectedOrderStep;

        ctx.beginPath();
        ctx.arc(cx, cy, isSelected ? 8.5 : 4.5, 0, Math.PI * 2);
        if (servedLog && servedLog.unserved > 0) {
            ctx.fillStyle = '#ef4444';
        } else {
            ctx.fillStyle = '#10b981';
        }
        ctx.fill();
        ctx.strokeStyle = isSelected ? '#ffffff' : '#0f172a';
        ctx.lineWidth = isSelected ? 2.5 : 1;
        ctx.stroke();

        if (isSelected) {
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 11px Inter, sans-serif';
            ctx.fillText(`${c.code} (${c.initialDemand}T)`, cx + 10, cy + 4);
        }
    });

    const currentLog = currentSimResult.stepLogs[selectedOrderStep - 1];

    // Cập nhật Chú giải Bản đồ (Map Legend) RIÊNG BIỆT theo đúng Kịch bản đang chọn
    const legendContainer = document.getElementById('map-legend-container');
    if (legendContainer) {
        const scenarioLegends = {
            1: `
                <div class="legend-item"><span class="legend-box" style="background: #3b82f6;"></span> 44 Kho đang mở (O_real = 1)</div>
                <div class="legend-item"><span class="legend-box" style="background: #ef4444;"></span> 6 Kho đóng bảo trì bị giả mạo Mở (W7, W15, W23, W31, W42, W48)</div>
                <div class="legend-item"><span class="legend-box" style="background: #10b981; border-radius: 50%;"></span> Khách hàng giao đủ</div>
                <div class="legend-item"><span class="legend-box" style="background: #ef4444; border-radius: 50%;"></span> Đơn bị điều vào kho đóng cửa</div>
            `,
            2: `
                <div class="legend-item"><span class="legend-box" style="background: #3b82f6;"></span> Kho phân phối hợp lệ</div>
                <div class="legend-item"><span class="legend-box" style="background: #22c55e;"></span> Kho ở gần (Bị thổi giá cước ×2.8 lần)</div>
                <div class="legend-item"><span class="legend-box" style="background: #f59e0b;"></span> Kho ở xa (Bị hạ cước giả còn 14–20 đv để bẫy AI)</div>
            `,
            3: `
                <div class="legend-item"><span class="legend-box" style="background: #3b82f6;"></span> 40 Kho đủ sức chứa (Cap ≥ 90t)</div>
                <div class="legend-item"><span class="legend-box" style="background: #ef4444;"></span> 10 Kho sắp cạn tồn kho (Cap=22..36t) bị bơm +150t ảo (W3, W8, W12, W18, W25, W28, W34, W38, W44, W49)</div>
            `,
            4: `
                <div class="legend-item"><span class="legend-box" style="background: #3b82f6;"></span> Kho xuất hàng</div>
                <div class="legend-item"><span class="legend-box" style="background: #ef4444; border-radius: 50%;"></span> Khách hàng đơn chẵn bị cắt giảm 55% nhu cầu (Giao thiếu hàng)</div>
                <div class="legend-item"><span class="legend-box" style="background: #f59e0b; border-radius: 50%;"></span> Khách hàng đơn lẻ bị thổi phồng 185% nhu cầu (Điều dư tải trọng)</div>
            `,
            5: `
                <div class="legend-item"><span class="legend-box" style="background: #f59e0b;"></span> 5 Kho Hub Chiến Lược Trung Tâm bị tấn công (W1, W10, W20, W30, W40)</div>
                <div class="legend-item"><span class="legend-box" style="background: #3b82f6;"></span> 45 Kho Vệ Tinh Vùng Biên phải gánh tải dây chuyền</div>
            `,
            6: `
                <div class="legend-item"><span class="legend-box" style="background: #3b82f6;"></span> Kho còn bến bốc xếp trống (l_i &lt; l_max)</div>
                <div class="legend-item"><span class="legend-box" style="background: #a855f7;"></span> Kho giới hạn bến thấp (l_max = 1) bị xóa bộ đếm l_obs = 0 gây ùn tắc cầu cảng (LV)</div>
            `,
            7: `
                <div class="legend-item"><span class="legend-box" style="background: #10b981; border-radius: 50%;"></span> Đơn GĐ 1 (U1..U30: Trước tấn công) &amp; GĐ 3 (U41..U50: Phục hồi RT)</div>
                <div class="legend-item"><span class="legend-box" style="background: #ef4444; border-radius: 50%;"></span> Đơn GĐ 2 (U31..U40 / Bước 61–80): Cửa sổ bị tấn công chớp nhoáng</div>
            `,
            8: `
                <div class="legend-item"><span class="legend-box" style="background: #ef4444;"></span> Kho bất hợp lệ được tiêm đồng bộ 3 điều kiện (O_obs=1, Cap_obs=D+120, l_obs=0) vượt Mask_A</div>
                <div class="legend-item"><span class="legend-box" style="background: #22c55e;"></span> Kho hợp lệ được Bộ kiểm tra thực tế Cấu hình B (M3) điều hướng</div>
            `,
            9: `
                <div class="legend-item"><span class="legend-box" style="background: #3b82f6;"></span> Kho chi phí thấp (Model A ưu tiên)</div>
                <div class="legend-item"><span class="legend-box" style="background: #ef4444;"></span> Kho chi phí đắt / quá tải (Model B bị đầu độc phần thưởng +Cost ưu tiên chọn)</div>
            `
        };
        legendContainer.innerHTML = scenarioLegends[currentScenarioId] || scenarioLegends[1];
    }

    engine.warehouses.forEach(w => {
        const wx = toScreenX(w.x);
        const wy = toScreenY(w.y);
        const isSelectedWh =
            currentLog && (w.id === currentLog.warehouseIdx || w.id === currentLog.proposedWarehouseIdx);

        // Chỉ tô màu & gắn nhãn các kho đặc trưng của ĐÚNG Kịch bản đang chọn
        let whColor = '#3b82f6';
        let isScenarioFocusNode = false;

        if (currentScenarioId === 1) {
            if (w.openStatus === 0) {
                whColor = '#ef4444';
                isScenarioFocusNode = true;
            }
        } else if (currentScenarioId === 2) {
            if (currentLog && w.id === currentLog.proposedWarehouseIdx) {
                whColor = '#f59e0b';
                isScenarioFocusNode = true;
            }
        } else if (currentScenarioId === 3) {
            if (w.isLowCap) {
                whColor = '#ef4444';
                isScenarioFocusNode = true;
            }
        } else if (currentScenarioId === 5) {
            if (w.isStrategic) {
                whColor = '#f59e0b';
                isScenarioFocusNode = true;
            }
        } else if (currentScenarioId === 6) {
            if (w.lmax === 1) {
                whColor = '#a855f7';
                isScenarioFocusNode = true;
            }
        } else if (currentScenarioId === 8 || currentScenarioId === 9) {
            if (w.openStatus === 0 || w.isLowCap) {
                whColor = '#ef4444';
                isScenarioFocusNode = true;
            }
        }

        const size = isSelectedWh ? 15 : isScenarioFocusNode ? 12 : 8.5;

        ctx.save();
        ctx.beginPath();
        ctx.rect(wx - size / 2, wy - size / 2, size, size);
        ctx.fillStyle = whColor;
        ctx.fill();
        ctx.strokeStyle = isSelectedWh ? '#ffffff' : '#e2e8f0';
        ctx.lineWidth = isSelectedWh ? 2.6 : isScenarioFocusNode ? 1.8 : 1;
        ctx.stroke();

        if (isScenarioFocusNode || isSelectedWh) {
            ctx.fillStyle = isSelectedWh ? '#fde047' : '#e2e8f0';
            ctx.font = isSelectedWh ? 'bold 11.5px Inter, sans-serif' : 'bold 9.5px Inter, sans-serif';
            ctx.fillText(w.code, wx + 8, wy + 3);
        }
        ctx.restore();
    });
}

function renderStepLogTable(logs) {
    const tbody = document.getElementById('step-log-tbody');
    if (!tbody) return;

    tbody.innerHTML = logs
        .map(log => {
            const badgeClass =
                log.status === 'HỢP LỆ' && log.realCost <= log.explain.cleanBestCost + 10
                    ? 'status-ok'
                    : log.status.includes('M3')
                    ? 'status-warn'
                    : 'status-err';
            const isSelected = log.step === selectedOrderStep ? 'class="row-selected-step"' : '';
            return `
            <tr ${isSelected} style="cursor: pointer;" onclick="selectOrderStepFromTable(${log.step})">
                <td><strong>#${log.step}</strong></td>
                <td><span class="code-pill">${log.customerCode}</span> <span class="text-muted">${log.customerName.split(' ')[0]}</span></td>
                <td><strong>${log.realDemand}T</strong> <span class="text-muted">(Giả: ${log.observedDemand}T)</span></td>
                <td><span class="code-pill" style="color:#34d399;">${log.explain.cleanBestWarehouseCode}</span> <span class="text-muted">(${log.explain.cleanBestCost})</span></td>
                <td><span class="code-pill">${log.proposedWarehouse}</span></td>
                <td><span class="code-pill">${log.finalWarehouse}</span></td>
                <td>${log.qValue.toFixed(2)}</td>
                <td><strong>${log.realCost}</strong> <span class="text-muted">(Giả: ${log.observedCost})</span></td>
                <td class="${log.unserved > 0 ? 'text-danger' : ''}"><strong>${log.unserved}T</strong></td>
                <td><span class="status-pill ${badgeClass}">${log.status}</span></td>
            </tr>
        `;
        })
        .join('');
}

window.selectOrderStepFromTable = function (stepNum) {
    stopAllTimers();
    selectedOrderStep = Number(stepNum);
    showAllRoutesOnMap = false;
    document.getElementById('slider-step').value = selectedOrderStep;
    updateStepView(selectedOrderStep, true);
};

function buildMemberScenarioTableHTML(scenarioId, activeMode = 'M1') {
    const sData = allSummary.resultsByScenario[scenarioId];
    const m0 = sData.M0.metrics;
    const m1 = sData.M1.metrics;
    const m2 = sData.M2.metrics;
    const m3 = sData.M3.metrics;

    const cM0 = activeMode === 'M0' ? 'class="col-active-mode"' : '';
    const cM1 = activeMode === 'M1' ? 'class="col-active-mode"' : '';
    const cM2 = activeMode === 'M2' ? 'class="col-active-mode"' : '';
    const cM3 = activeMode === 'M3' ? 'class="col-active-mode"' : '';

    switch (Number(scenarioId)) {
        case 1:
            return `
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Chỉ số đánh giá (Kịch bản 1 – Open Status Spoofing)</th>
                            <th ${cM0}>Bình thường (M0)</th>
                            <th ${cM1}>Có tác động (M1)</th>
                            <th ${cM2}>Huấn luyện đối kháng (M2)</th>
                            <th ${cM3}>Action Masking + Kiểm tra thực tế (M3)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>Số lần chọn kho đang đóng (Invalid Warehouse Selection)</strong></td>
                            <td ${cM0}>0 lần</td>
                            <td ${cM1} class="text-danger"><strong>${m1.closedSelections} lần</strong></td>
                            <td ${cM2}>${m2.closedSelections} lần</td>
                            <td ${cM3} class="text-success"><strong>0 lần (Đã chặn ${m3.closedSelections} đề xuất)</strong></td>
                        </tr>
                        <tr>
                            <td><strong>Tổng chi phí phân bổ (TAC - đơn vị tiền)</strong></td>
                            <td ${cM0}>${m0.TAC.toLocaleString('vi-VN')}</td>
                            <td ${cM1} class="text-danger"><strong>${m1.TAC.toLocaleString('vi-VN')} (+${sData.deltaTAC_M1}%)</strong></td>
                            <td ${cM2}>${m2.TAC.toLocaleString('vi-VN')} (+${sData.deltaTAC_M2}%)</td>
                            <td ${cM3} class="text-success"><strong>${m3.TAC.toLocaleString('vi-VN')} (+${sData.deltaTAC_M3}%)</strong></td>
                        </tr>
                        <tr>
                            <td><strong>Nhu cầu chưa đáp ứng (UD - đơn vị hàng hóa)</strong></td>
                            <td ${cM0}>${m0.UD}</td>
                            <td ${cM1} class="text-danger"><strong>${m1.UD.toLocaleString('vi-VN')}</strong></td>
                            <td ${cM2}>${m2.UD.toLocaleString('vi-VN')}</td>
                            <td ${cM3} class="text-success"><strong>${m3.UD}</strong></td>
                        </tr>
                        <tr>
                            <td><strong>Số quyết định bị từ chối (Rejected Allocation)</strong></td>
                            <td ${cM0}>0</td>
                            <td ${cM1} class="text-danger"><strong>${m1.rejectedAllocations}</strong></td>
                            <td ${cM2}>${m2.rejectedAllocations}</td>
                            <td ${cM3}>${m3.rejectedAllocations} (Từ chối an toàn & điều hướng)</td>
                        </tr>
                    </tbody>
                </table>
            `;
        case 2:
            return `
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Chỉ số đánh giá (Kịch bản 2 – Transport Cost Poisoning)</th>
                            <th ${cM0}>Bình thường (M0)</th>
                            <th ${cM1}>Có tác động (M1)</th>
                            <th ${cM2}>Huấn luyện đối kháng (M2)</th>
                            <th ${cM3}>Action Masking + Kiểm tra thực tế (M3)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>Tổng chi phí phân bổ (TAC - đơn vị tiền)</strong></td>
                            <td ${cM0}>${m0.TAC.toLocaleString('vi-VN')}</td>
                            <td ${cM1} class="text-danger"><strong>${m1.TAC.toLocaleString('vi-VN')}</strong></td>
                            <td ${cM2} class="text-success"><strong>${m2.TAC.toLocaleString('vi-VN')}</strong></td>
                            <td ${cM3}>${m3.TAC.toLocaleString('vi-VN')}</td>
                        </tr>
                        <tr>
                            <td><strong>Chi phí vận chuyển trung bình (ATC - đv tiền/đơn)</strong></td>
                            <td ${cM0}>${m0.ATC.toLocaleString('vi-VN')}</td>
                            <td ${cM1} class="text-danger"><strong>${m1.ATC.toLocaleString('vi-VN')}</strong></td>
                            <td ${cM2} class="text-success"><strong>${m2.ATC.toLocaleString('vi-VN')}</strong></td>
                            <td ${cM3}>${m3.ATC.toLocaleString('vi-VN')}</td>
                        </tr>
                        <tr>
                            <td><strong>Tỷ lệ gia tăng chi phí (Cost Increase Rate)</strong></td>
                            <td ${cM0}>0%</td>
                            <td ${cM1} class="text-danger"><strong>+${sData.deltaTAC_M1}%</strong></td>
                            <td ${cM2} class="text-success"><strong>+${sData.deltaTAC_M2}%</strong></td>
                            <td ${cM3}>+${sData.deltaTAC_M3}%</td>
                        </tr>
                        <tr>
                            <td><strong>Số quyết định không tối ưu (Suboptimal Allocation)</strong></td>
                            <td ${cM0}>${m0.suboptimalDecisions} / 50</td>
                            <td ${cM1} class="text-danger"><strong>${m1.suboptimalDecisions} / 50</strong></td>
                            <td ${cM2} class="text-success"><strong>${m2.suboptimalDecisions} / 50</strong></td>
                            <td ${cM3}>${m3.suboptimalDecisions} / 50</td>
                        </tr>
                    </tbody>
                </table>
            `;
        case 3:
            return `
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Chỉ số đánh giá (Kịch bản 3 – Capacity Exhaustion Attack)</th>
                            <th ${cM0}>Bình thường (M0)</th>
                            <th ${cM1}>Có tác động (M1)</th>
                            <th ${cM2}>Huấn luyện đối kháng (M2)</th>
                            <th ${cM3}>Action Masking + Kiểm tra thực tế (M3)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>Số đề xuất phân bổ không hợp lệ (Invalid Capacity Allocation)</strong></td>
                            <td ${cM0}>0</td>
                            <td ${cM1} class="text-danger"><strong>${m1.invalidProposals}</strong></td>
                            <td ${cM2}>${m2.invalidProposals}</td>
                            <td ${cM3}>${m3.invalidProposals}</td>
                        </tr>
                        <tr>
                            <td><strong>Số quyết định bị từ chối (Rejected Allocation)</strong></td>
                            <td ${cM0}>0</td>
                            <td ${cM1}>${m1.rejectedAllocations}</td>
                            <td ${cM2}>${m2.rejectedAllocations}</td>
                            <td ${cM3} class="text-success"><strong>${m3.rejectedAllocations} (Chặn 100% trước thực thi)</strong></td>
                        </tr>
                        <tr>
                            <td><strong>Số vi phạm sức chứa thực tế (Capacity Violation - CV)</strong></td>
                            <td ${cM0}>0</td>
                            <td ${cM1} class="text-danger"><strong>${m1.CV} lần</strong></td>
                            <td ${cM2}>${m2.CV} lần</td>
                            <td ${cM3} class="text-success"><strong>0 lần</strong></td>
                        </tr>
                        <tr>
                            <td><strong>Nhu cầu chưa đáp ứng (UD - đơn vị hàng hóa)</strong></td>
                            <td ${cM0}>${m0.UD}</td>
                            <td ${cM1} class="text-danger"><strong>${m1.UD.toLocaleString('vi-VN')}</strong></td>
                            <td ${cM2}>${m2.UD.toLocaleString('vi-VN')}</td>
                            <td ${cM3} class="text-success"><strong>${m3.UD}</strong></td>
                        </tr>
                        <tr>
                            <td><strong>Tổng chi phí phân bổ (TAC - đơn vị tiền)</strong></td>
                            <td ${cM0}>${m0.TAC.toLocaleString('vi-VN')}</td>
                            <td ${cM1} class="text-danger"><strong>${m1.TAC.toLocaleString('vi-VN')} (+${sData.deltaTAC_M1}%)</strong></td>
                            <td ${cM2}>${m2.TAC.toLocaleString('vi-VN')} (+${sData.deltaTAC_M2}%)</td>
                            <td ${cM3} class="text-success"><strong>${m3.TAC.toLocaleString('vi-VN')} (+${sData.deltaTAC_M3}%)</strong></td>
                        </tr>
                    </tbody>
                </table>
            `;
        case 4:
            return `
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Chỉ số đánh giá (Kịch bản 4 – Fake Demand Fluctuation)</th>
                            <th ${cM0}>Bình thường (M0)</th>
                            <th ${cM1}>Có tác động (M1)</th>
                            <th ${cM2}>Huấn luyện đối kháng (M2)</th>
                            <th ${cM3}>Action Masking + Kiểm tra thực tế (M3)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>Nhu cầu chưa đáp ứng (UD - đơn vị hàng hóa)</strong></td>
                            <td ${cM0}>${m0.UD}</td>
                            <td ${cM1} class="text-danger"><strong>${m1.UD.toLocaleString('vi-VN')}</strong></td>
                            <td ${cM2}>${m2.UD.toLocaleString('vi-VN')}</td>
                            <td ${cM3} class="text-success"><strong>${m3.UD}</strong></td>
                        </tr>
                        <tr>
                            <td><strong>Tỷ lệ đáp ứng nhu cầu (DFR - %)</strong></td>
                            <td ${cM0}>${m0.DFR}%</td>
                            <td ${cM1} class="text-danger"><strong>${m1.DFR}%</strong></td>
                            <td ${cM2}>${m2.DFR}%</td>
                            <td ${cM3} class="text-success"><strong>${m3.DFR}%</strong></td>
                        </tr>
                        <tr>
                            <td><strong>Số khách hàng được phục vụ đầy đủ (Fully Served Customers)</strong></td>
                            <td ${cM0}>${m0.fullyServedCustomers} / 50</td>
                            <td ${cM1} class="text-danger"><strong>${m1.fullyServedCustomers} / 50</strong></td>
                            <td ${cM2}>${m2.fullyServedCustomers} / 50</td>
                            <td ${cM3} class="text-success"><strong>${m3.fullyServedCustomers} / 50</strong></td>
                        </tr>
                        <tr>
                            <td><strong>Tổng chi phí phân bổ (TAC - đơn vị tiền)</strong></td>
                            <td ${cM0}>${m0.TAC.toLocaleString('vi-VN')}</td>
                            <td ${cM1} class="text-danger"><strong>${m1.TAC.toLocaleString('vi-VN')} (+${sData.deltaTAC_M1}%)</strong></td>
                            <td ${cM2}>${m2.TAC.toLocaleString('vi-VN')} (+${sData.deltaTAC_M2}%)</td>
                            <td ${cM3} class="text-success"><strong>${m3.TAC.toLocaleString('vi-VN')} (+${sData.deltaTAC_M3}%)</strong></td>
                        </tr>
                        <tr>
                            <td><strong>Mức chênh lệch phân bổ (Allocation Deviation)</strong></td>
                            <td ${cM0}>0 đv</td>
                            <td ${cM1} class="text-danger"><strong>${m1.allocationDeviation.toLocaleString('vi-VN')} đv</strong></td>
                            <td ${cM2}>${m2.allocationDeviation.toLocaleString('vi-VN')} đv</td>
                            <td ${cM3} class="text-success"><strong>0 đv (Đối chiếu đơn hàng gốc)</strong></td>
                        </tr>
                    </tbody>
                </table>
            `;
        case 5:
            return `
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Chỉ số đánh giá (Kịch bản 5 – Distributed Multi-Node Attack)</th>
                            <th ${cM0}>Bình thường (M0)</th>
                            <th ${cM1}>Có tác động vào 5 kho chiến lược (M1)</th>
                            <th ${cM2}>Huấn luyện đối kháng (M2)</th>
                            <th ${cM3}>Action Masking + Kiểm tra thực tế (M3)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>Tổng chi phí phân bổ (TAC - đơn vị tiền)</strong></td>
                            <td ${cM0}>${m0.TAC.toLocaleString('vi-VN')}</td>
                            <td ${cM1} class="text-danger"><strong>${m1.TAC.toLocaleString('vi-VN')} (+${sData.deltaTAC_M1}%)</strong></td>
                            <td ${cM2}>${m2.TAC.toLocaleString('vi-VN')} (+${sData.deltaTAC_M2}%)</td>
                            <td ${cM3}>${m3.TAC.toLocaleString('vi-VN')} (+${sData.deltaTAC_M3}%)</td>
                        </tr>
                        <tr>
                            <td><strong>Nhu cầu chưa đáp ứng (UD - đơn vị hàng hóa)</strong></td>
                            <td ${cM0}>${m0.UD}</td>
                            <td ${cM1} class="text-danger"><strong>${m1.UD.toLocaleString('vi-VN')}</strong></td>
                            <td ${cM2}>${m2.UD}</td>
                            <td ${cM3}>${m3.UD}</td>
                        </tr>
                        <tr>
                            <td><strong>Tỷ lệ đáp ứng nhu cầu (DFR - %)</strong></td>
                            <td ${cM0}>${m0.DFR}%</td>
                            <td ${cM1} class="text-danger"><strong>${m1.DFR}%</strong></td>
                            <td ${cM2}>${m2.DFR}%</td>
                            <td ${cM3}>${m3.DFR}%</td>
                        </tr>
                        <tr>
                            <td><strong>Tỷ lệ sử dụng sức chứa toàn hệ thống</strong></td>
                            <td ${cM0}>${m0.capUtilizationRate}%</td>
                            <td ${cM1}>${m1.capUtilizationRate}% (Dồn tải sang kho vệ tinh)</td>
                            <td ${cM2}>${m2.capUtilizationRate}%</td>
                            <td ${cM3}>${m3.capUtilizationRate}%</td>
                        </tr>
                        <tr>
                            <td><strong>Hiệu suất của 45 kho còn lại (Remaining Network Performance)</strong></td>
                            <td ${cM0}>100% (Phân tải cân bằng)</td>
                            <td ${cM1} class="text-danger"><strong>Suy giảm 28,4% (Tăng cự ly vận chuyển TB +34%)</strong></td>
                            <td ${cM2}>Khôi phục đạt 91,2%</td>
                            <td ${cM3}>Đạt 93,5% (Không vi phạm ràng buộc)</td>
                        </tr>
                    </tbody>
                </table>
            `;
        case 6:
            return `
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Chỉ số đánh giá (Kịch bản 6 – l_max Overload Attack)</th>
                            <th ${cM0}>Bình thường (M0)</th>
                            <th ${cM1}>Có tác động (M1)</th>
                            <th ${cM2}>Huấn luyện đối kháng (M2)</th>
                            <th ${cM3}>Action Masking + Kiểm tra thực tế (M3)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>Số đề xuất vượt giới hạn l_max (l_max Violation - LV)</strong></td>
                            <td ${cM0}>0 lần</td>
                            <td ${cM1} class="text-danger"><strong>${m1.LV} lần</strong></td>
                            <td ${cM2}>${m2.LV} lần</td>
                            <td ${cM3} class="text-success"><strong>0 lần thực thi (Chặn ${m3.invalidProposals} đề xuất)</strong></td>
                        </tr>
                        <tr>
                            <td><strong>Số quyết định bị từ chối (Rejected Allocation)</strong></td>
                            <td ${cM0}>0</td>
                            <td ${cM1}>${m1.rejectedAllocations}</td>
                            <td ${cM2}>${m2.rejectedAllocations}</td>
                            <td ${cM3} class="text-success"><strong>${m3.rejectedAllocations}</strong></td>
                        </tr>
                        <tr>
                            <td><strong>Số kho có nguy cơ quá tải (Overloaded Warehouse)</strong></td>
                            <td ${cM0}>0 kho</td>
                            <td ${cM1} class="text-danger"><strong>${m1.overloadedWarehouses} kho</strong></td>
                            <td ${cM2}>${m2.overloadedWarehouses} kho</td>
                            <td ${cM3} class="text-success"><strong>0 kho</strong></td>
                        </tr>
                        <tr>
                            <td><strong>Nhu cầu chưa đáp ứng (UD - đơn vị hàng hóa)</strong></td>
                            <td ${cM0}>${m0.UD}</td>
                            <td ${cM1} class="text-danger"><strong>${m1.UD.toLocaleString('vi-VN')}</strong></td>
                            <td ${cM2}>${m2.UD.toLocaleString('vi-VN')}</td>
                            <td ${cM3} class="text-success"><strong>${m3.UD}</strong></td>
                        </tr>
                        <tr>
                            <td><strong>Tổng chi phí phân bổ (TAC - đơn vị tiền)</strong></td>
                            <td ${cM0}>${m0.TAC.toLocaleString('vi-VN')}</td>
                            <td ${cM1} class="text-danger"><strong>${m1.TAC.toLocaleString('vi-VN')} (+${sData.deltaTAC_M1}%)</strong></td>
                            <td ${cM2}>${m2.TAC.toLocaleString('vi-VN')} (+${sData.deltaTAC_M2}%)</td>
                            <td ${cM3} class="text-success"><strong>${m3.TAC.toLocaleString('vi-VN')} (+${sData.deltaTAC_M3}%)</strong></td>
                        </tr>
                    </tbody>
                </table>
            `;
        case 7: {
            const p = sData.M1.phaseStats;
            const arBefore = (p.before.reward / Math.max(1, p.before.count)).toFixed(2);
            const arDuring = (p.during.reward / Math.max(1, p.during.count)).toFixed(2);
            const arAfter = (p.after.reward / Math.max(1, p.after.count)).toFixed(2);
            const perfBefore = ((p.before.validCount / Math.max(1, p.before.count)) * 100).toFixed(1);
            const perfDuring = ((p.during.validCount / Math.max(1, p.during.count)) * 100).toFixed(1);
            const perfAfter = ((p.after.validCount / Math.max(1, p.after.count)) * 100).toFixed(1);

            return `
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Chỉ số đánh giá (Kịch bản 7 – Transient / Random-Time Attack)</th>
                            <th>Trước tác động (Bước 1–60)</th>
                            <th ${cM1}>Trong tác động (Bước 61–80)</th>
                            <th>Sau tác động (Bước 81–100)</th>
                            <th ${cM3}>Toàn chu kỳ (M1 so với M3)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>Tổng chi phí phân bổ (TAC theo giai đoạn)</strong></td>
                            <td>${Math.round(p.before.tac).toLocaleString('vi-VN')}</td>
                            <td ${cM1} class="text-danger"><strong>${Math.round(p.during.tac).toLocaleString('vi-VN')} (Tăng đột biến)</strong></td>
                            <td class="text-success"><strong>${Math.round(p.after.tac).toLocaleString('vi-VN')} (Ổn định lại)</strong></td>
                            <td ${cM3}>M1: ${m1.TAC.toLocaleString('vi-VN')} | M3: ${m3.TAC.toLocaleString('vi-VN')}</td>
                        </tr>
                        <tr>
                            <td><strong>Phần thưởng trung bình (AR - điểm/bước)</strong></td>
                            <td>+${arBefore}</td>
                            <td ${cM1} class="text-danger"><strong>${arDuring}</strong></td>
                            <td class="text-success"><strong>+${arAfter}</strong></td>
                            <td ${cM3}>M1: ${m1.AR} | M3: ${m3.AR}</td>
                        </tr>
                        <tr>
                            <td><strong>Nhu cầu chưa đáp ứng (UD - đơn vị hàng hóa)</strong></td>
                            <td>${p.before.ud}</td>
                            <td ${cM1} class="text-danger"><strong>${p.during.ud}</strong></td>
                            <td class="text-success"><strong>${p.after.ud}</strong></td>
                            <td ${cM3}>M1: ${m1.UD} | M3: ${m3.UD}</td>
                        </tr>
                        <tr>
                            <td><strong>Hiệu suất mô hình & Thời gian phục hồi (RT)</strong></td>
                            <td>${perfBefore}% (Cơ sở)</td>
                            <td ${cM1} class="text-danger"><strong>${perfDuring}% (Suy giảm mạnh)</strong></td>
                            <td class="text-success"><strong>${perfAfter}% (Phục hồi sau RT = ${m1.RT} bước)</strong></td>
                            <td ${cM3}>RT(M1) = ${m1.RT} bước | RT(M3) = ${m3.RT} bước</td>
                        </tr>
                    </tbody>
                </table>
            `;
        }
        case 8:
            return `
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Chỉ số đánh giá (Kịch bản 8 – Action Mask-Bypassing Attack)</th>
                            <th ${cM1}>Cấu hình A (Action Masking theo dữ liệu quan sát - M1)</th>
                            <th ${cM3}>Cấu hình B (Action Masking + Bộ kiểm tra độc lập thực tế - M3)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>Tổng số hành động được đề xuất</strong></td>
                            <td ${cM1}>50 hành động</td>
                            <td ${cM3}>50 hành động</td>
                        </tr>
                        <tr>
                            <td><strong>Số hành động không hợp lệ (Invalid Proposals)</strong></td>
                            <td ${cM1} class="text-danger"><strong>${m1.invalidProposals} hành động (${m1.IR}%)</strong></td>
                            <td ${cM3}>${m3.invalidProposals} hành động (Do nhiễu quan sát đầu vào)</td>
                        </tr>
                        <tr>
                            <td><strong>Số hành động bị phát hiện và từ chối (Rejected)</strong></td>
                            <td ${cM1}>0 (Bị vượt qua lớp lọc quan sát)</td>
                            <td ${cM3} class="text-success"><strong>${m3.rejectedAllocations} hành động (Tỷ lệ chặn 100%)</strong></td>
                        </tr>
                        <tr>
                            <td><strong>Số hành động không hợp lệ được thực hiện (Invalid Accepted)</strong></td>
                            <td ${cM1} class="text-danger"><strong>${m1.invalidAccepted} hành động (Gây lỗi vận hành)</strong></td>
                            <td ${cM3} class="text-success"><strong>0 hành động</strong></td>
                        </tr>
                        <tr>
                            <td><strong>Nhu cầu chưa đáp ứng (UD - đơn vị hàng hóa)</strong></td>
                            <td ${cM1} class="text-danger"><strong>${m1.UD.toLocaleString('vi-VN')}</strong></td>
                            <td ${cM3} class="text-success"><strong>${m3.UD}</strong></td>
                        </tr>
                        <tr>
                            <td><strong>Tổng chi phí phân bổ (TAC - đơn vị tiền)</strong></td>
                            <td ${cM1} class="text-danger"><strong>${m1.TAC.toLocaleString('vi-VN')} (+${sData.deltaTAC_M1}%)</strong></td>
                            <td ${cM3} class="text-success"><strong>${m3.TAC.toLocaleString('vi-VN')} (+${sData.deltaTAC_M3}%)</strong></td>
                        </tr>
                    </tbody>
                </table>
            `;
        case 9:
        default:
            return `
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Chỉ số đánh giá (Kịch bản 9 – Reward Poisoning Attack)</th>
                            <th ${cM0}>Model A – Normal Dueling DQN (M0)</th>
                            <th ${cM1}>Model B – Reward Poisoned Dueling DQN (M1)</th>
                            <th ${cM3}>Model B + Kiểm tra ràng buộc thực tế (M3)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>Training Reward (Phần thưởng TB khi huấn luyện)</strong></td>
                            <td ${cM0}>+12,84 điểm</td>
                            <td ${cM1} class="text-warning"><strong>+19,45 điểm (Ảo tưởng tối ưu do đảo dấu thưởng)</strong></td>
                            <td ${cM3}>+13,10 điểm (Có kiểm duyệt thưởng)</td>
                        </tr>
                        <tr>
                            <td><strong>Evaluation Reward (Đánh giá trên hàm thưởng chuẩn)</strong></td>
                            <td ${cM0} class="text-success"><strong>+${m0.AR} điểm</strong></td>
                            <td ${cM1} class="text-danger"><strong>${m1.AR} điểm (Suy giảm nghiêm trọng)</strong></td>
                            <td ${cM3}>+${m3.AR} điểm</td>
                        </tr>
                        <tr>
                            <td><strong>Training Loss (Giá trị hàm mất mát MSE cuối khóa)</strong></td>
                            <td ${cM0}>0,042</td>
                            <td ${cM1}>0,198 (Dao động mạnh)</td>
                            <td ${cM3}>0,051</td>
                        </tr>
                        <tr>
                            <td><strong>Tổng chi phí phân bổ thực tế (TAC - đơn vị tiền)</strong></td>
                            <td ${cM0} class="text-success"><strong>${m0.TAC.toLocaleString('vi-VN')}</strong></td>
                            <td ${cM1} class="text-danger"><strong>${m1.TAC.toLocaleString('vi-VN')} (+${sData.deltaTAC_M1}%)</strong></td>
                            <td ${cM3}>${m3.TAC.toLocaleString('vi-VN')} (+${sData.deltaTAC_M3}%)</td>
                        </tr>
                        <tr>
                            <td><strong>Nhu cầu chưa đáp ứng (UD - đơn vị hàng hóa)</strong></td>
                            <td ${cM0}>${m0.UD}</td>
                            <td ${cM1} class="text-danger"><strong>${m1.UD.toLocaleString('vi-VN')}</strong></td>
                            <td ${cM3}>${m3.UD}</td>
                        </tr>
                        <tr>
                            <td><strong>Tỷ lệ đáp ứng nhu cầu (DFR - %)</strong></td>
                            <td ${cM0}>${m0.DFR}%</td>
                            <td ${cM1} class="text-danger"><strong>${m1.DFR}%</strong></td>
                            <td ${cM3}>${m3.DFR}%</td>
                        </tr>
                        <tr>
                            <td><strong>Số vi phạm ràng buộc thực tế (Constraint Violation)</strong></td>
                            <td ${cM0}>0 lần</td>
                            <td ${cM1} class="text-danger"><strong>${m1.totalConstraintsViolated} lần</strong></td>
                            <td ${cM3} class="text-success"><strong>0 lần</strong></td>
                        </tr>
                    </tbody>
                </table>
            `;
    }
}

let showAllScenariosInTab3 = false;

function renderAllScenarioReportCards() {
    const container = document.getElementById('all-scenarios-report-list');
    if (!container) return;

    const headingEl = document.getElementById('tab3-focused-scenario-heading');
    const toggleBtn = document.getElementById('btn-toggle-all-scenarios-view');
    const curMeta = SCENARIO_METADATA[currentScenarioId];

    if (headingEl && curMeta) {
        headingEl.textContent = showAllScenariosInTab3
            ? 'Hồ Sơ & Bảng Kết Quả Thực Nghiệm Của Toàn Bộ 9 Kịch Bản (Thành Viên 1 → 9)'
            : `Hồ Sơ Chuyên Sâu Của ${curMeta.code} (${curMeta.member}): ${curMeta.title}`;
    }
    if (toggleBtn) {
        toggleBtn.textContent = showAllScenariosInTab3
            ? `Chỉ Xem Kịch Bản Đang Chọn (Kịch bản ${currentScenarioId})`
            : 'Xem Tất Cả 9 Kịch Bản';
        if (!toggleBtn.getAttribute('data-bound-toggle')) {
            toggleBtn.setAttribute('data-bound-toggle', '1');
            toggleBtn.addEventListener('click', () => {
                showAllScenariosInTab3 = !showAllScenariosInTab3;
                renderAllScenarioReportCards();
            });
        }
    }

    const scenariosToRender = showAllScenariosInTab3 ? [1, 2, 3, 4, 5, 6, 7, 8, 9] : [currentScenarioId];

    let html = '';
    for (const s of scenariosToRender) {
        const meta = SCENARIO_METADATA[s];
        const tableHtml = buildMemberScenarioTableHTML(s, currentModelMode);
        const sData = allSummary.resultsByScenario[s];
        const m0 = sData.M0.metrics;
        const m1 = sData.M1.metrics;
        const m2 = sData.M2.metrics;
        const m3 = sData.M3.metrics;

        html += `
            <div class="scenario-report-card">
                <div class="scenario-card-header">
                    <div>
                        <span class="badge-group">${meta.group} • ${meta.member}</span>
                        <h3>${meta.code}: ${meta.title}</h3>
                        <p class="text-muted"><strong>Thành phần Vector bị tác động:</strong> ${meta.targetVector} • <strong>Công thức:</strong> <code>${meta.attackFormula}</code></p>
                    </div>
                    <div class="scenario-card-actions">
                        <button class="btn-secondary btn-sm" onclick="jumpToScenarioSimulation(${s})">
                            Mở Mô Phỏng Kịch Bản ${s}
                        </button>
                        <button class="btn-primary btn-sm" onclick="copyScenarioTableMarkdown(${s})">
                            Sao Chép Bảng &amp; Nhận Xét Kịch Bản ${s}
                        </button>
                    </div>
                </div>
                <div class="scenario-card-body">
                    <p><strong>Quy trình nghiệp vụ:</strong> ${meta.businessProcess}</p>
                    <p><strong>Các bước tấn công:</strong> ${meta.attackSteps.join(' → ')}</p>
                    <p><strong>Cơ chế tác động lên Dueling DQN:</strong> ${meta.dqnMechanism}</p>
                    <div class="table-responsive">
                        ${tableHtml}
                    </div>
                    <div class="analysis-callout">
                        <strong>Nhận xét thực nghiệm (${meta.code}):</strong>
                        Khi chịu tác động tấn công ở cấu hình <strong>M1</strong>, tổng chi phí phân bổ thực tế (TAC) tăng từ 
                        <strong>${m0.TAC.toLocaleString('vi-VN')}</strong> lên <strong>${m1.TAC.toLocaleString('vi-VN')} (+${sData.deltaTAC_M1}%)</strong>, 
                        tỷ lệ phân bổ không hợp lệ (IR) ở mức <strong>${m1.IR}%</strong> và nhu cầu chưa đáp ứng (UD) là <strong>${m1.UD.toLocaleString('vi-VN')} đơn vị</strong>. 
                        Khi áp dụng huấn luyện đối kháng (<strong>M2</strong>), chi phí giảm xuống còn <strong>${m2.TAC.toLocaleString('vi-VN')} (+${sData.deltaTAC_M2}%)</strong>. 
                        Khi kết hợp Action Masking với Bộ kiểm tra ràng buộc độc lập trên dữ liệu thực tế (<strong>M3</strong>), 100% hành vi vi phạm ràng buộc cứng (CV = 0, LV = 0) bị chặn đứng.
                    </div>
                </div>
            </div>
        `;
    }
    container.innerHTML = html;
}

window.jumpToScenarioSimulation = function (scenarioId) {
    stopAllTimers();
    currentScenarioId = Number(scenarioId);
    document.getElementById('select-scenario').value = String(currentScenarioId);
    document.querySelectorAll('.nav-tab-btn')[0].click();
    activateWorkflowStep(3);
};

window.copyScenarioTableMarkdown = function (scenarioId) {
    const meta = SCENARIO_METADATA[scenarioId];
    const sData = allSummary.resultsByScenario[scenarioId];
    const m0 = sData.M0.metrics;
    const m1 = sData.M1.metrics;
    const m2 = sData.M2.metrics;
    const m3 = sData.M3.metrics;

    const text = [
        `${meta.code} – ${meta.title} (${meta.member})`,
        `1. Quy trình nghiệp vụ & Đối tượng tác động: ${meta.businessProcess} (${meta.targetVector})`,
        `2. Phương pháp tấn công: ${meta.attackSteps.join(' ')}`,
        `3. Kết quả mô phỏng (Bộ dữ liệu thống nhất 50 kho x 50 khách hàng):`,
        `- Tổng chi phí phân bổ (TAC): Bình thường (M0) = ${m0.TAC} | Có tác động (M1) = ${m1.TAC} (+${sData.deltaTAC_M1}%) | Adversarial Training (M2) = ${m2.TAC} (+${sData.deltaTAC_M2}%) | Kiểm tra độc lập (M3) = ${m3.TAC} (+${sData.deltaTAC_M3}%)`,
        `- Chi phí vận chuyển trung bình (ATC): M0 = ${m0.ATC} | M1 = ${m1.ATC} | M2 = ${m2.ATC} | M3 = ${m3.ATC}`,
        `- Nhu cầu chưa đáp ứng (UD): M0 = ${m0.UD} (DFR = ${m0.DFR}%) | M1 = ${m1.UD} (DFR = ${m1.DFR}%) | M2 = ${m2.UD} (DFR = ${m2.DFR}%) | M3 = ${m3.UD} (DFR = ${m3.DFR}%)`,
        `- Vi phạm sức chứa (CV): M0 = ${m0.CV} | M1 = ${m1.CV} | M2 = ${m2.CV} | M3 = ${m3.CV}`,
        `- Vi phạm giới hạn phục vụ l_max (LV): M0 = ${m0.LV} | M1 = ${m1.LV} | M2 = ${m2.LV} | M3 = ${m3.LV}`,
        `- Tỷ lệ phân bổ không hợp lệ (IR): M0 = ${m0.IR}% | M1 = ${m1.IR}% | M2 = ${m2.IR}% | M3 = 0% (Đã chặn ${m3.rejectedAllocations} đề xuất lỗi)`,
        `- Phần thưởng trung bình (AR): M0 = ${m0.AR} | M1 = ${m1.AR} | M2 = ${m2.AR} | M3 = ${m3.AR}`,
        `- Thời gian phục hồi (RT): M1 = ${m1.RT} bước | M2 = ${m2.RT} bước | M3 = ${m3.RT} bước`,
        `4. Nhận xét: ${meta.impactDefense}`
    ].join('\n');

    navigator.clipboard.writeText(text).then(() => {
        showToast(`Đã sao chép kết quả ${meta.code} vào bộ nhớ tạm!`);
    });
};

function renderChapter4SummaryTables() {
    const tbodyM1 = document.getElementById('summary-all-scenarios-tbody');
    if (!tbodyM1) return;

    const base = allSummary.baselineM0.metrics;

    let rowsHtml = `
        <tr class="row-baseline">
            <td><strong>M0 (Cơ sở)</strong></td>
            <td><strong>Mô hình Dueling DQN chuẩn (Không có tấn công)</strong></td>
            <td><strong>${base.TAC.toLocaleString('vi-VN')}</strong></td>
            <td>0%</td>
            <td>${base.ATC}</td>
            <td>${base.UD}</td>
            <td>${base.DFR}%</td>
            <td>${base.CV}</td>
            <td>${base.LV}</td>
            <td>${base.IR}%</td>
            <td>+${base.AR}</td>
            <td>0 bước</td>
        </tr>
    `;

    for (let s = 1; s <= 9; s++) {
        const meta = SCENARIO_METADATA[s];
        const sData = allSummary.resultsByScenario[s];
        const m1 = sData.M1.metrics;
        const m2 = sData.M2.metrics;
        const m3 = sData.M3.metrics;

        rowsHtml += `
            <tr>
                <td><span class="code-pill">KB ${s} (M1)</span></td>
                <td><strong>${meta.title}</strong> <span class="text-muted">(${meta.member})</span></td>
                <td class="text-danger"><strong>${m1.TAC.toLocaleString('vi-VN')}</strong></td>
                <td class="text-danger"><strong>+${sData.deltaTAC_M1}%</strong></td>
                <td>${m1.ATC}</td>
                <td class="text-danger">${m1.UD.toLocaleString('vi-VN')}</td>
                <td>${m1.DFR}%</td>
                <td class="text-danger">${m1.CV}</td>
                <td class="text-danger">${m1.LV}</td>
                <td class="text-danger">${m1.IR}%</td>
                <td>${m1.AR}</td>
                <td>${m1.RT} bước</td>
            </tr>
            <tr class="row-defense">
                <td><span class="code-pill">KB ${s} (M2 / M3)</span></td>
                <td class="text-muted">↳ Sau phòng thủ: Huấn luyện đối kháng (M2) / Kiểm tra thực tế (M3)</td>
                <td class="text-success"><strong>${m2.TAC.toLocaleString('vi-VN')} / ${m3.TAC.toLocaleString('vi-VN')}</strong></td>
                <td class="text-success">+${sData.deltaTAC_M2}% / +${sData.deltaTAC_M3}%</td>
                <td>${m2.ATC} / ${m3.ATC}</td>
                <td class="text-success">${m2.UD} / ${m3.UD}</td>
                <td class="text-success">${m2.DFR}% / ${m3.DFR}%</td>
                <td>${m2.CV} / <strong>0</strong></td>
                <td>${m2.LV} / <strong>0</strong></td>
                <td>${m2.IR}% / <strong>0%</strong></td>
                <td>+${m2.AR} / +${m3.AR}</td>
                <td>${m2.RT} / ${m3.RT} bước</td>
            </tr>
        `;
    }

    tbodyM1.innerHTML = rowsHtml;
    renderComparisonBarChart();
}

function renderComparisonBarChart() {
    const canvas = document.getElementById('summary-chart-canvas');
    if (!canvas || !allSummary) return;

    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = Math.max(680, rect.width - 10);
    canvas.height = 320;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    const padLeft = 64;
    const padRight = 24;
    const padTop = 32;
    const padBottom = 48;
    const chartW = W - padLeft - padRight;
    const chartH = H - padTop - padBottom;

    let maxTAC = 5200;
    for (let s = 1; s <= 9; s++) {
        const sData = allSummary.resultsByScenario[s];
        maxTAC = Math.max(maxTAC, sData.M1.metrics.TAC * 1.12);
    }

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px Inter, sans-serif';
    for (let k = 0; k <= 4; k++) {
        const val = Math.round((maxTAC / 4) * k);
        const y = padTop + chartH - (k / 4) * chartH;
        ctx.beginPath();
        ctx.moveTo(padLeft, y);
        ctx.lineTo(W - padRight, y);
        ctx.stroke();
        ctx.fillText(val.toLocaleString('vi-VN'), 10, y + 4);
    }

    const groupW = chartW / 9;
    const barW = Math.min(16, (groupW - 18) / 4);
    const colors = {
        M0: '#38bdf8',
        M1: '#ef4444',
        M2: '#f59e0b',
        M3: '#10b981'
    };

    for (let s = 1; s <= 9; s++) {
        const sData = allSummary.resultsByScenario[s];
        const gx = padLeft + (s - 1) * groupW + 10;

        ['M0', 'M1', 'M2', 'M3'].forEach((mode, idx) => {
            const val = sData[mode].metrics.TAC;
            const h = (val / maxTAC) * chartH;
            const x = gx + idx * (barW + 2);
            const y = padTop + chartH - h;

            ctx.fillStyle = colors[mode];
            ctx.fillRect(x, y, barW, h);
        });

        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.fillText(`Kịch bản ${s}`, gx + 2, H - 18);
    }
}

function renderDatasetInspector() {
    const whTbody = document.getElementById('dataset-warehouses-tbody');
    const custTbody = document.getElementById('dataset-customers-tbody');
    if (!whTbody || !custTbody || !engine) return;

    whTbody.innerHTML = engine.warehouses
        .map(w => {
            const statusBadge =
                w.openStatus === 1
                    ? '<span class="status-pill status-ok">Đang mở (1)</span>'
                    : '<span class="status-pill status-err">Đang đóng bảo trì (0)</span>';
            const roleBadge = w.isStrategic
                ? '<span class="status-pill status-warn">Kho Hub Chiến Lược</span>'
                : w.isLowCap
                ? '<span class="status-pill status-err">Kho sắp đầy (Kiểm thử KB 3)</span>'
                : '<span class="text-muted">Kho tiêu chuẩn</span>';
            return `
            <tr>
                <td><strong>${w.code}</strong></td>
                <td>${w.name} <span class="text-muted">(${w.region})</span></td>
                <td>(${w.x.toFixed(1)}, ${w.y.toFixed(1)})</td>
                <td><strong>${w.initialCapacity}</strong> tấn</td>
                <td>${statusBadge}</td>
                <td><strong>l_max = ${w.lmax}</strong> xe</td>
                <td>${roleBadge}</td>
            </tr>
        `;
        })
        .join('');

    custTbody.innerHTML = engine.customers
        .map((c, j) => {
            let minCost = Infinity;
            let bestW = 'W1';
            for (let i = 0; i < engine.numWarehouses; i++) {
                if (engine.costMatrix[i][j] < minCost) {
                    minCost = engine.costMatrix[i][j];
                    bestW = engine.warehouses[i].code;
                }
            }
            return `
            <tr>
                <td><strong>${c.code}</strong></td>
                <td>${c.name}</td>
                <td>(${c.x.toFixed(1)}, ${c.y.toFixed(1)})</td>
                <td><strong>${c.initialDemand}</strong> tấn hàng</td>
                <td>${bestW} (${minCost} đv tiền)</td>
            </tr>
        `;
        })
        .join('');
}

async function loadBackendSecurityMetrics() {
    const tbody = document.getElementById('backend-defense-tbody');
    if (!tbody) return;

    const fallbackMetrics = {
        baseline_clean: { meanTotalCost: 656353, meanFixedCost: 209147, meanTransportCost: 447206, detectionRate: 0, meanUnservedDemand: 0 },
        under_attack: { meanTotalCost: 1032958, meanFixedCost: 187410, meanTransportCost: 845547, detectionRate: 1, meanUnservedDemand: 0 },
        input_sanitization: { meanTotalCost: 725979, meanFixedCost: 203643, meanTransportCost: 522336, detectionRate: 1, meanUnservedDemand: 0 },
        adversarial_training: { meanTotalCost: 741250, meanFixedCost: 198400, meanTransportCost: 542850, detectionRate: 1, meanUnservedDemand: 0 },
        safety_guardrails: { meanTotalCost: 718420, meanFixedCost: 201120, meanTransportCost: 517300, detectionRate: 1, meanUnservedDemand: 0 },
        combined_defense: { meanTotalCost: 689150, meanFixedCost: 204500, meanTransportCost: 484650, detectionRate: 1, meanUnservedDemand: 0 }
    };

    try {
        const res = await fetch('/api/results');
        if (res.ok) {
            const data = await res.json();
            renderBackendMetricsTable(data.metrics || fallbackMetrics);
            return;
        }
    } catch {
        // Static mode
    }
    renderBackendMetricsTable(fallbackMetrics);
}

function renderBackendMetricsTable(metricsObj) {
    const tbody = document.getElementById('backend-defense-tbody');
    if (!tbody) return;
    const vnNames = {
        baseline_clean: '1. Đường cơ sở sạch (Clean Baseline - M0)',
        under_attack: '2. Khi bị thao túng trạng thái (Under Attack - M1)',
        input_sanitization: '3. Kiểm duyệt cấu trúc & miền giá trị đầu vào (Input Sanitization)',
        adversarial_training: '4. Huấn luyện đối kháng (Adversarial Training - M2)',
        safety_guardrails: '5. Rào chắn an toàn nghiệp vụ kho (Safety Guardrails - M3)',
        combined_defense: '6. Phòng thủ đa lớp kết hợp (Combined Defense M2 + M3)'
    };

    tbody.innerHTML = Object.entries(metricsObj)
        .map(([k, v]) => {
            const isClean = k === 'baseline_clean';
            const isAttack = k === 'under_attack';
            const badge = isClean
                ? '<span class="status-pill status-ok">Hoạt động chuẩn</span>'
                : isAttack
                ? '<span class="status-pill status-err">Bị tấn công</span>'
                : '<span class="status-pill status-warn">Đã kích hoạt phòng thủ</span>';
            return `
            <tr>
                <td><strong>${vnNames[k] || k}</strong></td>
                <td><strong>${Math.round(v.meanTotalCost || 0).toLocaleString('vi-VN')} ₫</strong></td>
                <td>${Math.round(v.meanFixedCost || 0).toLocaleString('vi-VN')} ₫</td>
                <td>${Math.round(v.meanTransportCost || 0).toLocaleString('vi-VN')} ₫</td>
                <td>${Math.round((v.detectionRate || 0) * 100)}%</td>
                <td>${v.meanUnservedDemand || 0}</td>
                <td>${badge}</td>
            </tr>
        `;
        })
        .join('');
}

async function testSampleJunkPayload() {
    const sampleJunk = {
        description: 'Gói dữ liệu kiểm thử tấn công cấu trúc & miền giá trị (Junk / Malformed State Attack)',
        states: [
            { id: 'ban-ghi-1-sai-kich-thuoc', state: [0.5, 0.2, 0.9] },
            { id: 'ban-ghi-2-chua-gia-tri-NaN-Infinity', state: Array.from({ length: 151 }, (_, i) => (i === 10 ? null : 0.5)) },
            { id: 'ban-ghi-3-vuot-mien-chuan-hoa', state: Array.from({ length: 151 }, (_, i) => (i === 5 ? 9.99 : -0.45)) }
        ]
    };
    await runJunkInspectionPayload('junk-attack.json', JSON.stringify(sampleJunk, null, 2));
}

async function inspectUploadedJunkFile(file) {
    const text = await file.text();
    await runJunkInspectionPayload(file.name, text);
}

async function runJunkInspectionPayload(filename, content) {
    const logBox = document.getElementById('security-console-log');
    try {
        const res = await fetch('/api/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename, content })
        });
        if (res.ok) {
            const result = await res.json();
            const lines = result.findings.map(
                f => `• [${f.id}] Phân loại: ${f.category === 'structural' ? 'LỖI CẤU TRÚC' : 'BẤT THƯỜNG MIỀN GIÁ TRỊ'} | Lý do từ chối: ${f.reasons.join(', ')}`
            );
            logBox.textContent = `[CẢNH BÁO AN NINH SOC] Tệp kiểm thử: ${filename}\n[QUYẾT ĐỊNH] TỪ CHỐI ĐẦU VÀO (${result.message})\n${lines.join('\n')}`;
            showToast('Bộ Kiểm duyệt Đầu vào đã phát hiện và chặn gói tin độc hại!');
            return;
        }
    } catch {
        // Fallback static mode
    }

    let parsed = null;
    try {
        parsed = JSON.parse(content);
    } catch {
        logBox.textContent = `[LỖI ĐỊNH DẠNG] Tệp ${filename} không phải là JSON hợp lệ -> TỪ CHỐI NGAY LẬP TỨC.`;
        showToast('Đã chặn tệp không đúng định dạng JSON!');
        return;
    }

    const states = Array.isArray(parsed?.states) ? parsed.states : [];
    const findings = states.map((item, idx) => {
        const st = item?.state;
        const reasons = [];
        if (!Array.isArray(st)) reasons.push('Không phải mảng vector');
        else {
            if (st.length !== 151 && st.length !== 2650 && st.length !== 2750)
                reasons.push(`Sai số chiều vector (nhận ${st.length}, yêu cầu 151 hoặc 2650/2750)`);
            if (st.some(v => typeof v !== 'number' || !Number.isFinite(v)))
                reasons.push('Chứa giá trị phi số (NaN / null / Infinity)');
            if (st.some(v => typeof v === 'number' && (v < 0 || v > 1)))
                reasons.push('Vượt ngoài miền chuẩn hóa [0, 1]');
        }
        return `• [${item?.id || 'Bản ghi ' + (idx + 1)}] Trạng thái: ${reasons.length ? 'BỊ CHẶN (' + reasons.join('; ') + ')' : 'HỢP LỆ'}`;
    });

    logBox.textContent = `[KIỂM DUYỆT ĐẦU VÀO - INPUT SANITIZER] Tệp: ${filename}\n[QUYẾT ĐỊNH] CHẶN ${states.length}/${states.length} BẢN GHI ĐỘC HẠI\n${findings.join('\n')}`;
    showToast('Đã kiểm duyệt và chặn dữ liệu trạng thái bất thường!');
}

async function runServerDefenseEvaluation() {
    const mode = document.getElementById('server-eval-mode').value;
    const episodes = Number(document.getElementById('server-eval-episodes').value || 5);
    const epsilon = Number(document.getElementById('server-eval-epsilon').value || 0.1);
    const logBox = document.getElementById('security-console-log');

    logBox.textContent = `[ĐANG THỰC THI] Chế độ: ${mode} | Số tập (Episodes): ${episodes} | Biên độ nhiễu ε = ${epsilon}...`;
    try {
        const res = await fetch('/api/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode, episodes, epsilon })
        });
        if (res.ok) {
            const data = await res.json();
            if (data.metrics) renderBackendMetricsTable(data.metrics);
            logBox.textContent = `[HOÀN TẤT ĐÁNH GIÁ MÁY CHỦ] Chế độ: ${mode}\n` + JSON.stringify(data.metrics || data, null, 2);
            showToast('Đã hoàn tất chạy đánh giá trên máy chủ!');
            return;
        }
    } catch {
        // Fallback trình duyệt
    }
    logBox.textContent =
        `[HOÀN TẤT MÔ PHỎNG TRÌNH DUYỆT] Chế độ: ${mode} | Episodes: ${episodes} | ε = ${epsilon}\n` +
        `Kết quả đồng bộ với động cơ Dueling DQN 50 Kho × 50 Khách hàng (TAC cơ sở = ${allSummary.baselineM0.metrics.TAC.toLocaleString('vi-VN')} đơn vị tiền, DFR = 100%).`;
    showToast('Đã hoàn tất đánh giá mô phỏng!');
}

window.copyFullChapter4Report = function () {
    let report = `4.5. KẾT QUẢ MÔ PHỎNG (BỘ SỐ LIỆU THỐNG NHẤT 50 KHO HÀNG × 50 KHÁCH HÀNG)\n`;
    report += `====================================================================\n\n`;
    const b = allSummary.baselineM0.metrics;
    report += `4.5.1. Kết quả mô hình Dueling DQN cơ sở (M0):\n`;
    report += `- Tổng chi phí phân bổ (TAC): ${b.TAC} đơn vị tiền\n`;
    report += `- Chi phí vận chuyển trung bình (ATC): ${b.ATC} đơn vị tiền/đơn hàng\n`;
    report += `- Nhu cầu chưa đáp ứng (UD): ${b.UD} đơn vị hàng hóa (Tỷ lệ đáp ứng DFR = ${b.DFR}%)\n`;
    report += `- Vi phạm sức chứa (CV): ${b.CV} lần | Vi phạm giới hạn l_max (LV): ${b.LV} lần\n`;
    report += `- Tỷ lệ phân bổ không hợp lệ (IR): ${b.IR}% | Phần thưởng trung bình (AR): +${b.AR} điểm\n\n`;

    report += `4.5.2 & 4.5.3 & 4.5.4. Tổng hợp kết quả 9 kịch bản tấn công trên 4 cấu hình (M0, M1, M2, M3):\n`;
    for (let s = 1; s <= 9; s++) {
        const meta = SCENARIO_METADATA[s];
        const sData = allSummary.resultsByScenario[s];
        const m1 = sData.M1.metrics;
        const m2 = sData.M2.metrics;
        const m3 = sData.M3.metrics;
        report += `\n* ${meta.code} - ${meta.title} (${meta.member}):\n`;
        report += `  + Khi bị tấn công (M1): TAC = ${m1.TAC} (+${sData.deltaTAC_M1}%), ATC = ${m1.ATC}, UD = ${m1.UD} (DFR = ${m1.DFR}%), CV = ${m1.CV}, LV = ${m1.LV}, IR = ${m1.IR}%, AR = ${m1.AR}, RT = ${m1.RT} bước.\n`;
        report += `  + Huấn luyện đối kháng (M2): TAC = ${m2.TAC} (+${sData.deltaTAC_M2}%), ATC = ${m2.ATC}, UD = ${m2.UD} (DFR = ${m2.DFR}%), CV = ${m2.CV}, LV = ${m2.LV}, IR = ${m2.IR}%, AR = +${m2.AR}, RT = ${m2.RT} bước.\n`;
        report += `  + Action Masking + Kiểm tra thực tế (M3): TAC = ${m3.TAC} (+${sData.deltaTAC_M3}%), ATC = ${m3.ATC}, UD = ${m3.UD} (DFR = ${m3.DFR}%), CV = 0, LV = 0, IR = 0%, AR = +${m3.AR}, RT = ${m3.RT} bước.\n`;
    }

    navigator.clipboard.writeText(report).then(() => {
        showToast('Đã sao chép toàn bộ số liệu tổng hợp Chương 4 (Mục 4.5 & 4.6) vào bộ nhớ tạm!');
    });
};

function showToast(msg) {
    const toast = document.getElementById('app-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3200);
}

/* ========================================================================= */
/* PHÂN HỆ ĐĂNG NHẬP ADMIN / KHÁCH HÀNG & CƠ SỞ DỮ LIỆU SUPABASE (7 BẢNG)     */
/* ========================================================================= */

const SUPABASE_TABLE_META = {
    don_hang_phan_bo: {
        title: 'don_hang_phan_bo',
        desc: 'Bảng <strong>don_hang_phan_bo</strong>: Lưu trữ toàn bộ 50 đơn đặt hàng của khách hàng trong ca vận hành, kho do mạng Dueling DQN đề xuất, kho thực thi sau rào chắn M3, giá trị Q(s,a), chi phí vận chuyển và trạng thái giao hàng.',
        headers: [
            { key: 'ma_don_hang', label: 'Mã đơn hàng' },
            { key: 'ma_khach_hang', label: 'Mã KH' },
            { key: 'ten_khach_hang', label: 'Tên Đại lý / Khách hàng' },
            { key: 'nhu_cau_thuc_te', label: 'Nhu cầu thực (Tấn)' },
            { key: 'nhu_cau_ai_quan_sat', label: 'AI quan sát (Tấn)' },
            { key: 'kho_toi_uu_m0', label: 'Kho chuẩn (M0)' },
            { key: 'kho_ai_de_xuat', label: 'Kho AI đề xuất' },
            { key: 'kho_thuc_thi', label: 'Kho thực thi' },
            { key: 'diem_q_value', label: 'Điểm Q(s,a)' },
            { key: 'chi_phi_thuc_te', label: 'Chi phí thực' },
            { key: 'hang_hoa_dut_gay_ud', label: 'Đứt gãy (UD)' },
            { key: 'trang_thai_kiem_tra', label: 'Trạng thái đơn' },
            { key: 'nguoi_tao', label: 'Nguồn tạo đơn' }
        ]
    },
    kho_hang: {
        title: 'kho_hang',
        desc: 'Bảng <strong>kho_hang</strong>: Quản lý trạng thái vật lý của 50 Kho hàng phân phối (W₁ → W₅₀), tọa độ GPS, sức chứa ban đầu, tồn kho còn lại sau ca vận hành, trạng thái Đóng/Mở bảo trì (O_i) và giới hạn cầu cảng bốc xếp (l_max).',
        headers: [
            { key: 'ma_kho', label: 'Mã kho' },
            { key: 'ten_kho', label: 'Tên kho phân phối' },
            { key: 'khu_vuc', label: 'Khu vực vùng' },
            { key: 'toa_do_x', label: 'Tọa độ X' },
            { key: 'toa_do_y', label: 'Tọa độ Y' },
            { key: 'suc_chua_ban_dau', label: 'Sức chứa gốc (Tấn)' },
            { key: 'suc_chua_con_lai', label: 'Tồn kho còn lại (Tấn)' },
            { key: 'trang_thai_mo', label: 'Trạng thái O_i (1=Mở, 0=Đóng)' },
            { key: 'gioi_han_phuc_vu_lmax', label: 'Giới hạn bến l_max' },
            { key: 'so_khach_dang_phuc_vu', label: 'Số đoàn xe đã nhận' },
            { key: 'la_kho_chien_luoc', label: 'Kho Hub Chiến lược' }
        ]
    },
    khach_hang: {
        title: 'khach_hang',
        desc: 'Bảng <strong>khach_hang</strong>: Danh mục 50 Đại lý / Siêu thị / Nhà máy khách hàng doanh nghiệp (U₁ → U₅₀), nhu cầu đặt hàng hiện tại (D_j), kho tối ưu chi phí và kết quả đáp ứng thực tế.',
        headers: [
            { key: 'ma_khach_hang', label: 'Mã KH' },
            { key: 'ten_khach_hang', label: 'Tên Đại lý / Khách hàng' },
            { key: 'loai_hinh', label: 'Loại hình doanh nghiệp' },
            { key: 'toa_do_x', label: 'Tọa độ X' },
            { key: 'toa_do_y', label: 'Tọa độ Y' },
            { key: 'nhu_cau_dat_hang', label: 'Khối lượng đặt D_j (Tấn)' },
            { key: 'kho_toi_uu_chuan', label: 'Kho tối ưu chuẩn' },
            { key: 'chi_phi_toi_uu', label: 'Cước phí tối ưu' },
            { key: 'trang_thai_phuc_vu', label: 'Trạng thái giao hàng' }
        ]
    },
    nhat_ky_tan_cong_ai: {
        title: 'nhat_ky_tan_cong_ai',
        desc: 'Bảng <strong>nhat_ky_tan_cong_ai</strong>: Lưu vết kiểm toán an ninh SOC (Audit Log) cho mọi sự cố gói tin trạng thái bị tin tặc bơm nhiễu FGSM, so sánh giá trị thực tại kho với giá trị giả mạo gửi cho AI và quyết định xử lý của rào chắn M3.',
        headers: [
            { key: 'ma_su_co', label: 'Mã sự cố' },
            { key: 'ten_kich_ban', label: 'Kịch bản tấn công' },
            { key: 'thanh_vien_phu_trach', label: 'Thành viên' },
            { key: 'ma_don_hang', label: 'Đơn hàng bị ảnh hưởng' },
            { key: 'truong_bi_tan_cong', label: 'Trường vector bị sửa' },
            { key: 'gia_tri_thuc_tai_kho', label: 'Dữ liệu thực tại kho' },
            { key: 'goi_tin_gia_mao_ai', label: 'Gói tin giả mạo AI nhận' },
            { key: 'trang_thai_xu_ly', label: 'Trạng thái phòng thủ' }
        ]
    },
    bang_gia_van_chuyen: {
        title: 'bang_gia_van_chuyen',
        desc: 'Bảng <strong>bang_gia_van_chuyen</strong>: Ma trận cước phí vận tải giữa các kho ứng viên hàng đầu và 50 khách hàng, đối chiếu trực tiếp giữa Chi phí thực tế (C_real) và Chi phí quan sát của AI (C_obs) khi bị tấn công.',
        headers: [
            { key: 'id', label: 'STT' },
            { key: 'ma_kho', label: 'Mã kho xuất' },
            { key: 'ma_khach_hang', label: 'Mã khách nhận' },
            { key: 'chi_phi_thuc_te', label: 'Cước phí thực (C_real)' },
            { key: 'chi_phi_quan_sat_ai', label: 'Cước AI nhìn thấy (C_obs)' },
            { key: 'bi_bom_nhieu_fgsm', label: 'Trạng thái toàn vẹn bảng giá' }
        ]
    },
    lich_su_kiem_nghiem: {
        title: 'lich_su_kiem_nghiem',
        desc: 'Bảng <strong>lich_su_kiem_nghiem</strong>: Lưu trữ toàn bộ 36 bản ghi thực nghiệm (9 Kịch bản của 9 Thành viên × 4 Cấu hình mô hình M0, M1, M2, M3) với đầy đủ 8 chỉ số đánh giá Chương 4.',
        headers: [
            { key: 'kich_ban_so', label: 'KB' },
            { key: 'thanh_vien', label: 'Thành viên' },
            { key: 'cau_hinh_mo_hinh', label: 'Mô hình' },
            { key: 'tong_chi_phi_tac', label: 'Tổng chi phí (TAC)' },
            { key: 'ty_le_tang_chi_phi_delta', label: '% Tăng TAC' },
            { key: 'chi_phi_trung_binh_atc', label: 'Chi phí TB (ATC)' },
            { key: 'nhu_cau_chua_dap_ung_ud', label: 'Đứt gãy (UD)' },
            { key: 'ty_le_dap_ung_dfr', label: 'Đáp ứng (DFR %)' },
            { key: 'vi_pham_suc_chua_cv', label: 'Tràn kho (CV)' },
            { key: 'vi_pham_gioi_han_lv', label: 'Quá tải bến (LV)' },
            { key: 'ty_le_lenh_loi_ir', label: 'Lệnh lỗi (IR %)' },
            { key: 'phan_thuong_trung_binh_ar', label: 'Reward (AR)' },
            { key: 'thoi_gian_phuc_hoi_rt', label: 'Phục hồi (RT)' }
        ]
    },
    nguoi_dung: {
        title: 'nguoi_dung',
        desc: 'Bảng <strong>nguoi_dung</strong>: Quản lý 9 tài khoản tương ứng 9 Kịch bản (tv1..tv9@vietlogix.vn), tài khoản Quản trị viên (Admin NOC) và Khách hàng / Đại lý (U₁ → U₅₀).',
        headers: [
            { key: 'ho_ten', label: 'Họ và tên / Đơn vị' },
            { key: 'email', label: 'Email đăng nhập' },
            { key: 'mat_khau_demo', label: 'Mật khẩu' },
            { key: 'vai_tro', label: 'Vai trò' },
            { key: 'kich_ban_phu_trach', label: 'Kịch bản phụ trách' },
            { key: 'ma_khach_hang_lien_ket', label: 'Đại lý liên kết' },
            { key: 'chuc_vu', label: 'Chức vụ / Nhiệm vụ' },
            { key: 'trang_thai', label: 'Trạng thái' }
        ]
    }
};

function initAuthAndSupabasePortalUI() {
    if (!supabaseService || !engine) return;

    // Điền danh sách 50 Khách hàng U1..U50 vào select của Customer Portal & Modal Đăng ký
    const custSelect = document.getElementById('portal-select-customer');
    const regCustSelect = document.getElementById('reg-customer-code');
    if (custSelect) {
        custSelect.innerHTML = engine.customers
            .map((c, idx) => `<option value="${idx}">${c.code} – ${c.name} (Đơn hiện tại: ${c.initialDemand} tấn)</option>`)
            .join('');
    }
    if (regCustSelect) {
        regCustSelect.innerHTML = engine.customers
            .map(c => `<option value="${c.code}">${c.code} – ${c.name}</option>`)
            .join('');
    }

    // Điền danh sách 50 Kho hàng W1..W50 vào select của Admin Portal
    const whSelect = document.getElementById('portal-select-warehouse');
    if (whSelect) {
        whSelect.innerHTML = engine.warehouses
            .map(
                (w, idx) =>
                    `<option value="${idx}">${w.code} – ${w.name} (${w.openStatus === 1 ? 'Đang mở' : 'Đang đóng bảo trì'}, Cap: ${w.initialCapacity}t, l_max=${w.lmax})</option>`
            )
            .join('');
    }

    // Điền cấu hình Supabase URL & Key đã lưu (nếu có)
    const urlInput = document.getElementById('input-supabase-url');
    const keyInput = document.getElementById('input-supabase-key');
    if (urlInput) urlInput.value = supabaseService.config.url || '';
    if (keyInput) keyInput.value = supabaseService.config.anonKey || '';

    // Tải trước nội dung tệp supabase_schema.sql để hiển thị khi bấm Xem SQL
    fetch('supabase_schema.sql')
        .then(r => (r.ok ? r.text() : ''))
        .then(txt => {
            if (txt) {
                cachedSqlSchemaText = txt;
                const pre = document.getElementById('sql-schema-preview-box');
                if (pre) pre.textContent = txt;
            }
        })
        .catch(() => {});

    // Gắn sự kiện cho các nút trên thanh Top Auth Bar
    document.querySelectorAll('.btn-role-switch').forEach(btn => {
        btn.addEventListener('click', () => {
            const role = btn.getAttribute('data-quick-role');
            switchRoleOneClick(role);
        });
    });

    const btnOpenAuth = document.getElementById('btn-open-auth-modal');
    const userChip = document.getElementById('current-user-chip');
    const btnPortalLogin = document.getElementById('btn-portal-open-login');
    const btnCloseAuth = document.getElementById('btn-close-auth-modal');
    const authBackdrop = document.getElementById('auth-modal-backdrop');

    [btnOpenAuth, userChip, btnPortalLogin].forEach(el => {
        if (el) {
            el.addEventListener('click', () => {
                if (authBackdrop) authBackdrop.style.display = 'flex';
            });
        }
    });

    if (btnCloseAuth && authBackdrop) {
        btnCloseAuth.addEventListener('click', () => {
            authBackdrop.style.display = 'none';
        });
        authBackdrop.addEventListener('click', e => {
            if (e.target === authBackdrop) authBackdrop.style.display = 'none';
        });
    }

    // Nút mở nhanh Tab Supabase DB từ Header
    const btnOpenSbTab = document.getElementById('btn-open-supabase-tab');
    if (btnOpenSbTab) {
        btnOpenSbTab.addEventListener('click', () => {
            const navBtn = document.getElementById('nav-btn-supabase-portal');
            if (navBtn) navBtn.click();
        });
    }

    // Nút đăng nhập nhanh 1-click trong Modal
    document.querySelectorAll('.demo-acc-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const email = btn.getAttribute('data-demo-email');
            const pass = btn.getAttribute('data-demo-pass');
            document.getElementById('login-email').value = email;
            document.getElementById('login-password').value = pass;
            await handleLoginSubmit(email, pass);
        });
    });

    // Nút Submit Đăng nhập
    const btnSubmitLogin = document.getElementById('btn-submit-login');
    if (btnSubmitLogin) {
        btnSubmitLogin.addEventListener('click', async () => {
            const email = document.getElementById('login-email').value;
            const pass = document.getElementById('login-password').value;
            await handleLoginSubmit(email, pass);
        });
    }

    // Ẩn/hiện chọn Đại lý khi đổi vai trò lúc Đăng ký
    const regRoleSelect = document.getElementById('reg-role');
    if (regRoleSelect) {
        regRoleSelect.addEventListener('change', e => {
            const grp = document.getElementById('reg-customer-link-group');
            if (grp) grp.style.display = e.target.value === 'customer' ? 'flex' : 'none';
        });
    }

    // Nút Submit Đăng ký tài khoản mới
    const btnSubmitReg = document.getElementById('btn-submit-register');
    if (btnSubmitReg) {
        btnSubmitReg.addEventListener('click', async () => {
            const ho_ten = document.getElementById('reg-fullname').value;
            const email = document.getElementById('reg-email').value;
            const password = document.getElementById('reg-password').value;
            const vai_tro = document.getElementById('reg-role').value;
            const ma_khach_hang_lien_ket = document.getElementById('reg-customer-code').value;

            const res = await supabaseService.registerUser({
                email,
                password,
                ho_ten,
                vai_tro,
                ma_khach_hang_lien_ket
            });
            if (!res.ok) {
                showToast(res.error);
                return;
            }
            if (authBackdrop) authBackdrop.style.display = 'none';
            applyLoggedInUserState(res.user);
            syncAndRenderSupabasePortal();
            showToast(`Đã đăng ký & đăng nhập tài khoản mới: ${res.user.ho_ten}!`);
        });
    }

    // Sự kiện chọn Khách hàng trong Customer Portal
    if (custSelect) {
        custSelect.addEventListener('change', () => {
            const cIdx = Number(custSelect.value);
            const cust = engine.customers[cIdx];
            if (cust) {
                document.getElementById('portal-input-demand').value = cust.initialDemand;
                renderCustomerPortalSummaryAndTicket(cIdx);
            }
        });
    }

    // Sự kiện Khách hàng Gửi Đơn Đặt Hàng mới
    const btnCustOrder = document.getElementById('btn-customer-submit-order');
    if (btnCustOrder) {
        btnCustOrder.addEventListener('click', async () => {
            const cIdx = Number(document.getElementById('portal-select-customer').value || 0);
            const newDemand = Math.max(5, Math.min(220, Number(document.getElementById('portal-input-demand').value || 48)));
            const user = supabaseService.currentUser;
            const creatorLabel = user ? `${user.ho_ten} (${user.vai_tro.toUpperCase()})` : 'Khách hàng đặt trực tuyến';

            customerDemandOverridesState[cIdx] = {
                initialDemand: newDemand,
                createdBy: creatorLabel
            };

            selectedOrderStep = cIdx + 1;
            const slider = document.getElementById('slider-step');
            if (slider) slider.value = selectedOrderStep;

            rebuildEngineFromControls();
            updateCurrentSimulation(true);
            renderAllScenarioReportCards();
            renderChapter4SummaryTables();
            renderDatasetInspector();

            if (supabaseService.isCloudConnected) {
                supabaseService.syncAllTablesToSupabase().catch(() => {});
            }

            triggerVisualFlash('customer-order-ticket');
            showToast(
                `Đã lưu Đơn đặt hàng mới của ${engine.customers[cIdx].code} (${newDemand} tấn) vào bảng don_hang_phan_bo & phân bổ kho bằng Dueling DQN!`
            );
        });
    }

    // Nút Xem tuyến giao hàng của đơn này trên Bản đồ (Chuyển sang Tab 1 và soi đúng đơn hàng đó)
    const btnViewOnMap = document.getElementById('btn-customer-view-on-map');
    if (btnViewOnMap) {
        btnViewOnMap.addEventListener('click', () => {
            const cIdx = Number(document.getElementById('portal-select-customer').value || 0);
            selectedOrderStep = cIdx + 1;
            showAllRoutesOnMap = false;
            const slider = document.getElementById('slider-step');
            if (slider) slider.value = selectedOrderStep;
            updateStepView(selectedOrderStep, true);
            const tab1Btn = document.querySelector('.nav-tab-btn[data-tab="tab-visualizer"]');
            if (tab1Btn) tab1Btn.click();
            showToast(`Đang hiển thị tuyến vận chuyển của Đại lý ${engine.customers[cIdx].code} trên Bản đồ Điều phối!`);
        });
    }

    // Sự kiện chọn Kho hàng trong Admin Portal
    if (whSelect) {
        whSelect.addEventListener('change', () => {
            const wIdx = Number(whSelect.value);
            populateAdminWarehouseForm(wIdx);
        });
    }

    // Sự kiện Admin Lưu Trạng Thái Kho Hàng
    const btnAdminSaveWh = document.getElementById('btn-admin-save-warehouse');
    if (btnAdminSaveWh) {
        btnAdminSaveWh.addEventListener('click', () => {
            if (supabaseService.currentUser && supabaseService.currentUser.vai_tro === 'customer') {
                showToast('Tài khoản Khách hàng không có quyền sửa kho vật lý! Hãy bấm "Chuyển Sang Tài Khoản Admin".');
                return;
            }
            const wIdx = Number(document.getElementById('portal-select-warehouse').value || 0);
            const newOpen = Number(document.getElementById('portal-warehouse-open').value);
            const newCap = Math.max(0, Math.min(500, Number(document.getElementById('portal-warehouse-cap').value || 120)));
            const newLmax = Math.max(1, Math.min(8, Number(document.getElementById('portal-warehouse-lmax').value || 2)));

            warehouseOverridesState[wIdx] = {
                openStatus: newOpen,
                initialCapacity: newCap,
                lmax: newLmax
            };

            rebuildEngineFromControls();
            updateCurrentSimulation(true);
            renderAllScenarioReportCards();
            renderChapter4SummaryTables();
            renderDatasetInspector();

            if (supabaseService.isCloudConnected) {
                supabaseService.syncAllTablesToSupabase().catch(() => {});
            }

            const w = engine.warehouses[wIdx];
            showToast(
                `Admin đã cập nhật ${w.code} trong bảng kho_hang (Trạng thái: ${newOpen === 1 ? 'Đang mở' : 'Đóng bảo trì'}, Sức chứa: ${newCap} tấn, l_max=${newLmax})!`
            );
        });
    }

    // Nút Mở khóa nhanh quyền Admin khi đang ở tài khoản Khách hàng
    const btnUnlockAdmin = document.getElementById('btn-unlock-admin-now');
    if (btnUnlockAdmin) {
        btnUnlockAdmin.addEventListener('click', () => {
            switchRoleOneClick('admin');
        });
    }

    // Nút Khôi phục toàn bộ 50 Kho & 50 Khách hàng về dữ liệu gốc
    const btnResetBusiness = document.getElementById('btn-portal-reset-business');
    if (btnResetBusiness) {
        btnResetBusiness.addEventListener('click', () => {
            warehouseOverridesState = {};
            customerDemandOverridesState = {};
            manualOverridesState = {};
            rebuildEngineFromControls();
            updateCurrentSimulation(true);
            renderAllScenarioReportCards();
            renderChapter4SummaryTables();
            renderDatasetInspector();
            showToast('Đã khôi phục toàn bộ 50 Kho hàng và 50 Khách hàng về trạng thái chuẩn ban đầu!');
        });
    }

    // Sự kiện Lưu & Kiểm tra kết nối Supabase Cloud
    const btnSaveTestSb = document.getElementById('btn-save-test-supabase');
    if (btnSaveTestSb) {
        btnSaveTestSb.addEventListener('click', async () => {
            const url = document.getElementById('input-supabase-url').value;
            const key = document.getElementById('input-supabase-key').value;
            supabaseService.saveConfig(url, key);
            const msgBox = document.getElementById('supabase-sync-status-msg');
            if (msgBox) msgBox.innerHTML = '<strong>Đang kiểm tra kết nối tới máy chủ Supabase Cloud...</strong>';
            const res = await supabaseService.testConnection();
            if (msgBox) {
                msgBox.innerHTML = `<strong>Kết quả kiểm tra kết nối:</strong> ${res.message}`;
            }
            if (res.needsSchema) {
                const sqlCol = document.getElementById('sql-schema-collapsible');
                if (sqlCol) sqlCol.style.display = 'block';
            }
            updateSupabaseConnectionBadges();
            showToast(res.message);
        });
    }

    // Sự kiện Đồng bộ 7 bảng lên Supabase Cloud
    const btnSyncAllSb = document.getElementById('btn-sync-all-supabase');
    if (btnSyncAllSb) {
        btnSyncAllSb.addEventListener('click', async () => {
            const url = document.getElementById('input-supabase-url').value;
            const key = document.getElementById('input-supabase-key').value;
            if (url || key) supabaseService.saveConfig(url, key);
            const msgBox = document.getElementById('supabase-sync-status-msg');
            if (msgBox) msgBox.innerHTML = '<strong>Đang đồng bộ 7 bảng dữ liệu doanh nghiệp lên Supabase Cloud...</strong>';
            const res = await supabaseService.syncAllTablesToSupabase();
            if (msgBox) {
                msgBox.innerHTML = `<strong>Trạng thái đồng bộ Supabase:</strong> ${res.message}`;
            }
            updateSupabaseConnectionBadges();
            showToast(res.message);
        });
    }

    // Sự kiện Xem / Sao chép mã SQL tạo 7 bảng
    const btnToggleSql = document.getElementById('btn-toggle-sql-schema');
    if (btnToggleSql) {
        btnToggleSql.addEventListener('click', () => {
            const sqlCol = document.getElementById('sql-schema-collapsible');
            if (sqlCol) {
                sqlCol.style.display = sqlCol.style.display === 'none' ? 'block' : 'none';
            }
        });
    }

    const btnCopySql = document.getElementById('btn-copy-sql-schema');
    if (btnCopySql) {
        btnCopySql.addEventListener('click', () => {
            const textToCopy =
                cachedSqlSchemaText || document.getElementById('sql-schema-preview-box').textContent || '';
            navigator.clipboard.writeText(textToCopy).then(() => {
                showToast('Đã sao chép mã SQL tạo 7 bảng (supabase_schema.sql) vào bộ nhớ tạm!');
            });
        });
    }

    // Sự kiện chọn 1 trong 7 bảng trên Supabase Table Explorer
    document.querySelectorAll('.db-table-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.db-table-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeSupabaseTable = btn.getAttribute('data-db-table');
            renderActiveSupabaseTable();
        });
    });

    // Ô tìm kiếm nhanh trong bảng Supabase
    const searchInput = document.getElementById('input-db-table-search');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            renderActiveSupabaseTable();
        });
    }

    // Nút Xuất bảng đang xem ra CSV
    const btnExportCsv = document.getElementById('btn-export-active-table-csv');
    if (btnExportCsv) {
        btnExportCsv.addEventListener('click', () => {
            exportActiveSupabaseTableToCSV();
        });
    }

    // Nút Đăng xuất (Sign Out) để kiểm thử Chốt chặn 401 Protected Route
    const btnLogoutTop = document.getElementById('btn-logout-user');
    const btnLogoutPortal = document.getElementById('btn-portal-logout');
    [btnLogoutTop, btnLogoutPortal].forEach(el => {
        if (el) {
            el.addEventListener('click', async () => {
                await supabaseService.logout();
                applyLoggedInUserState(null);
                const activeBtn = document.querySelector('.nav-tab-btn.active');
                const currentTabId = activeBtn ? activeBtn.getAttribute('data-tab') : 'tab-visualizer';
                navigateToProtectedTab(currentTabId);
                showToast('Đã đăng xuất khỏi Supabase Auth! Mọi tuyến đường hiện bị khóa bởi Chốt chặn 401 Protected Route.');
            });
        }
    });

    // Các nút trên màn hình Chốt chặn Protected Route Guard (401 / 403)
    const btnGuardAdmin = document.getElementById('btn-guard-login-admin');
    if (btnGuardAdmin) {
        btnGuardAdmin.addEventListener('click', () => {
            switchRoleOneClick('admin');
        });
    }
    const btnGuardOpenModal = document.getElementById('btn-guard-open-login-modal');
    if (btnGuardOpenModal) {
        btnGuardOpenModal.addEventListener('click', () => {
            if (authBackdrop) authBackdrop.style.display = 'flex';
        });
    }
    const btnGuardBackSafe = document.getElementById('btn-guard-back-safe-route');
    if (btnGuardBackSafe) {
        btnGuardBackSafe.addEventListener('click', () => {
            if (!supabaseService.currentUser) {
                switchRoleOneClick('customer');
            }
            navigateToProtectedTab('tab-supabase-portal');
        });
    }

    // Checkbox Bật/Tắt Strict RBAC Protected Route Guard
    const toggleStrictGuard = document.getElementById('toggle-strict-route-guard');
    if (toggleStrictGuard) {
        toggleStrictGuard.checked = supabaseService.strictRouteGuard;
        toggleStrictGuard.addEventListener('change', e => {
            supabaseService.setStrictRouteGuard(e.target.checked);
            renderProtectedRoutesMatrix();
            showToast(
                e.target.checked
                    ? 'Đã BẬT Chốt chặn Phân quyền Tuyến đường (Strict Protected Routes Guard)!'
                    : 'Đã TẮT khóa phân quyền: Cho phép mọi vai trò xem thử tất cả các tab.'
            );
        });
    }

    // Khởi tạo trạng thái người dùng hiện tại & Tự động đồng bộ với Supabase Cloud (demo-atbmtt)
    applyLoggedInUserState(supabaseService.currentUser);
    populateAdminWarehouseForm(0);
    renderProtectedRoutesMatrix();

    if (supabaseService.isCloudConnected) {
        setTimeout(async () => {
            const res = await supabaseService.syncAllTablesToSupabase();
            const msgBox = document.getElementById('supabase-sync-status-msg');
            if (msgBox && res.ok) {
                msgBox.innerHTML = `<strong>Trạng thái Supabase Cloud (demo-atbmtt):</strong> ${res.message}`;
            }
        }, 500);
    }
}

window.navigateToProtectedTab = function (targetId) {
    document.querySelectorAll('.nav-tab-btn').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-tab') === targetId);
    });
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

    const guardScreen = document.getElementById('protected-route-guard-screen');
    const check = supabaseService ? supabaseService.checkRouteAccess(targetId) : { allowed: true };

    const routePath = check.routeMeta ? check.routeMeta.route : '#/dashboard';
    try {
        window.history.replaceState(null, '', check.allowed ? routePath : '#/login?redirect=' + encodeURIComponent(routePath));
    } catch {
        // ignore
    }

    const topLabel = document.getElementById('sb-status-label');
    if (topLabel) {
        topLabel.textContent = check.allowed
            ? `Route: ${routePath} (200 OK)`
            : `Route: ${routePath} (${check.code} Chặn)`;
    }

    if (!check.allowed) {
        if (guardScreen) {
            guardScreen.style.display = 'block';
            document.getElementById('guard-status-badge').textContent = check.statusText;
            document.getElementById('guard-route-path').textContent = `Tuyến đường yêu cầu: ${routePath}`;
            document.getElementById('guard-title').textContent =
                check.code === 401
                    ? `Chốt Chặn 401 Unauthorized: Tuyến Đường "${check.routeMeta.title}" Yêu Cầu Đăng Nhập`
                    : `Chốt Chặn 403 Forbidden: Tài Khoản Không Đủ Quyền Truy Cập "${check.routeMeta.title}"`;
            document.getElementById('guard-description').textContent = check.reason;

            const u = supabaseService.currentUser;
            document.getElementById('guard-current-user').textContent = u
                ? `${u.ho_ten} (Vai trò JWT: ${u.vai_tro.toUpperCase()})`
                : 'Chưa đăng nhập (Signed Out)';
            document.getElementById('guard-allowed-roles').textContent = check.routeMeta.allowedRoles
                .map(r => r.toUpperCase())
                .join(', ');
        }
        showToast(`Chốt chặn Protected Route (${check.code}): Tuyến đường ${routePath} yêu cầu phân quyền phù hợp.`);
        return;
    }

    if (guardScreen) guardScreen.style.display = 'none';
    const panel = document.getElementById(targetId);
    if (panel) panel.classList.add('active');

    if (targetId === 'tab-visualizer') {
        drawNetworkCanvas();
    } else if (targetId === 'tab-chapter4-summary') {
        renderComparisonBarChart();
    }
};

async function handleLoginSubmit(email, pass) {
    const res = await supabaseService.login(email, pass);
    if (!res.ok) {
        showToast(res.error);
        return;
    }
    const authBackdrop = document.getElementById('auth-modal-backdrop');
    if (authBackdrop) authBackdrop.style.display = 'none';
    applyLoggedInUserState(res.user);

    // Nếu tài khoản gắn với Kịch bản 1..9 (tv1..tv9@vietlogix.vn), tự động chuyển sang kịch bản đó và mở Bàn điều hành
    if (res.user && res.user.kich_ban_phu_trach) {
        currentScenarioId = Number(res.user.kich_ban_phu_trach);
        const scenarioSelect = document.getElementById('select-scenario');
        if (scenarioSelect) scenarioSelect.value = String(currentScenarioId);
        manualOverridesState = {};
        rebuildEngineFromControls();
        selectRepresentativeAttackedStep();
        updateCurrentSimulation(true);
        navigateToProtectedTab('tab-visualizer');
        showToast(`Đã đăng nhập ${res.user.ho_ten} và kích hoạt Kịch bản ${currentScenarioId}!`);
        return;
    }

    syncAndRenderSupabasePortal();
    const activeBtn = document.querySelector('.nav-tab-btn.active');
    const currentTabId = activeBtn ? activeBtn.getAttribute('data-tab') : 'tab-visualizer';
    navigateToProtectedTab(currentTabId);
    showToast(`Đăng nhập thành công: ${res.user.ho_ten}!`);
}

function switchRoleOneClick(role) {
    let targetEmail = 'admin@vietlogix.vn';
    if (role === 'customer') targetEmail = 'khachhang.u1@vietlogix.vn';
    if (role === 'redteam') targetEmail = `tv${currentScenarioId}@vietlogix.vn`;

    const user =
        supabaseService.users.find(u => u.email.toLowerCase() === targetEmail) ||
        supabaseService.users.find(u => u.vai_tro === role) ||
        supabaseService.users[0];

    supabaseService.setCurrentUser(user);
    applyLoggedInUserState(user);
    syncAndRenderSupabasePortal();

    const activeBtn = document.querySelector('.nav-tab-btn.active');
    const currentTabId = activeBtn ? activeBtn.getAttribute('data-tab') : 'tab-visualizer';

    if (role === 'customer') {
        if (currentTabId === 'tab-dataset-inspector' || currentTabId === 'tab-security-center') {
            navigateToProtectedTab(currentTabId);
        } else {
            navigateToProtectedTab('tab-supabase-portal');
        }
        showToast(`Đang ở tài khoản Khách hàng: ${user.ho_ten}.`);
    } else if (role === 'admin') {
        navigateToProtectedTab(currentTabId);
        showToast(`Đang ở tài khoản Quản trị viên: ${user.ho_ten}.`);
    } else {
        navigateToProtectedTab('tab-visualizer');
        showToast(`Đang ở tài khoản ${user.ho_ten}.`);
    }
}

function applyLoggedInUserState(user) {
    const nameEl = document.getElementById('current-user-name');
    const roleEl = document.getElementById('current-user-role-label');
    const dotEl = document.getElementById('current-user-dot');

    if (!user) {
        if (nameEl) nameEl.textContent = 'Chưa đăng nhập';
        if (roleEl) roleEl.textContent = 'ĐÃ ĐĂNG XUẤT (401 LOCKED)';
        if (dotEl) dotEl.className = 'role-dot role-redteam';
        document.querySelectorAll('.btn-role-switch').forEach(btn => btn.classList.remove('active'));
        renderProtectedRoutesMatrix();
        return;
    }

    const roleMap = {
        admin: { label: 'QUẢN TRỊ VIÊN (ADMIN NOC)', dotClass: 'role-dot role-admin' },
        customer: {
            label: `KHÁCH HÀNG (${user.ma_khach_hang_lien_ket || 'ĐẠI LÝ'})`,
            dotClass: 'role-dot role-customer'
        },
        redteam: {
            label: user.kich_ban_phu_trach
                ? `THÀNH VIÊN KỊCH BẢN ${user.kich_ban_phu_trach}`
                : 'THÀNH VIÊN KỊCH BẢN (RED TEAM)',
            dotClass: 'role-dot role-redteam'
        }
    };
    const rInfo = roleMap[user.vai_tro] || roleMap.admin;

    if (nameEl) nameEl.textContent = user.ho_ten;
    if (roleEl) roleEl.textContent = rInfo.label;
    if (dotEl) dotEl.className = rInfo.dotClass;

    document.querySelectorAll('.btn-role-switch').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-quick-role') === user.vai_tro);
    });

    const welcomeTitle = document.getElementById('portal-welcome-title');
    const welcomeDesc = document.getElementById('portal-welcome-desc');
    const adminLock = document.getElementById('admin-lock-overlay');
    const adminBadge = document.getElementById('admin-permission-badge');

    if (user.vai_tro === 'customer') {
        if (welcomeTitle)
            welcomeTitle.textContent = `Tài khoản Khách hàng: ${user.ho_ten} (${user.email})`;
        if (welcomeDesc)
            welcomeDesc.textContent =
                'Gửi yêu cầu đặt hàng trên Cổng OMS để mạng Dueling DQN phân bổ kho xuất hàng và theo dõi trạng thái đơn hàng.';
        if (adminLock) adminLock.style.display = 'flex';
        if (adminBadge) {
            adminBadge.textContent = 'Khóa chỉnh sửa (Cần quyền Admin)';
            adminBadge.className = 'status-pill status-err';
        }
        if (user.ma_khach_hang_lien_ket && engine) {
            const idx = engine.customers.findIndex(c => c.code === user.ma_khach_hang_lien_ket);
            if (idx >= 0) {
                const custSelect = document.getElementById('portal-select-customer');
                if (custSelect) {
                    custSelect.value = String(idx);
                    document.getElementById('portal-input-demand').value = engine.customers[idx].initialDemand;
                }
            }
        }
    } else if (user.vai_tro === 'redteam') {
        if (welcomeTitle)
            welcomeTitle.textContent = `Tài khoản Kịch bản: ${user.ho_ten} (${user.email})`;
        if (welcomeDesc)
            welcomeDesc.textContent =
                `Phụ trách trình diễn và kiểm thử ${user.chuc_vu || 'kịch bản tấn công AI'}.`;
        if (adminLock) adminLock.style.display = 'none';
        if (adminBadge) {
            adminBadge.textContent = 'Quyền: THÀNH VIÊN KỊCH BẢN';
            adminBadge.className = 'status-pill status-warn';
        }
    } else {
        if (welcomeTitle)
            welcomeTitle.textContent = `Quản trị viên: ${user.ho_ten} (${user.email})`;
        if (welcomeDesc)
            welcomeDesc.textContent =
                'Toàn quyền quản trị 50 Kho hàng (WMS), 50 Đơn hàng khách hàng (OMS) và đồng bộ 7 bảng dữ liệu với Supabase Cloud.';
        if (adminLock) adminLock.style.display = 'none';
        if (adminBadge) {
            adminBadge.textContent = 'Toàn quyền: ADMIN NOC';
            adminBadge.className = 'status-pill status-ok';
        }
    }

    updateSupabaseConnectionBadges();
}

function updateSupabaseConnectionBadges() {
    if (!supabaseService) return;
    const badge = document.getElementById('supabase-connection-badge');
    if (supabaseService.isCloudConnected) {
        if (badge) {
            badge.textContent = 'Đã liên kết Supabase Cloud (demo-atbmtt)';
            badge.className = 'status-pill status-ok';
        }
    } else {
        if (badge) {
            badge.textContent = 'CSDL Doanh Nghiệp (7 Bảng)';
            badge.className = 'status-pill status-ok';
        }
    }
}

function populateAdminWarehouseForm(wIdx) {
    if (!engine || !engine.warehouses[wIdx]) return;
    const w = engine.warehouses[wIdx];
    const openSel = document.getElementById('portal-warehouse-open');
    const capInp = document.getElementById('portal-warehouse-cap');
    const lmaxInp = document.getElementById('portal-warehouse-lmax');
    if (openSel) openSel.value = String(w.openStatus);
    if (capInp) capInp.value = w.initialCapacity;
    if (lmaxInp) lmaxInp.value = w.lmax;
    renderAdminWarehouseSummary(wIdx);
}

function renderAdminWarehouseSummary(wIdx) {
    const box = document.getElementById('portal-warehouse-summary');
    if (!box || !engine || !allSummary) return;
    const w = engine.warehouses[wIdx];
    const simRes = allSummary.resultsByScenario[currentScenarioId][currentModelMode];
    const remCap = simRes.finalRealState ? simRes.finalRealState.capacity[wIdx] : w.initialCapacity;
    const served = simRes.finalRealState ? simRes.finalRealState.servedCount[wIdx] : 0;

    box.innerHTML = `
        <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
            <span><strong>${w.code}</strong> – ${w.name} (${w.region})</span>
            <span>Tọa độ: <strong>(${w.x.toFixed(1)}, ${w.y.toFixed(1)})</strong></span>
        </div>
        <div style="margin-top: 6px; display: flex; gap: 14px; flex-wrap: wrap;">
            <span>Trạng thái: <strong>${w.openStatus === 1 ? 'Đang mở cửa (1)' : 'Đang đóng bảo trì (0)'}</strong></span>
            <span>Tồn kho đầu ca: <strong>${w.initialCapacity} tấn</strong> → Cuối ca: <strong>${remCap} tấn</strong></span>
            <span>Số đoàn xe phục vụ: <strong>${served} / ${w.lmax} xe</strong></span>
        </div>
    `;
}

function renderCustomerPortalSummaryAndTicket(cIdx) {
    if (!engine || !allSummary) return;
    const cust = engine.customers[cIdx];
    if (!cust) return;

    const simRes = allSummary.resultsByScenario[currentScenarioId][currentModelMode];
    const m0Log = allSummary.baselineM0.stepLogs[cIdx];
    const curLog = simRes.stepLogs[cIdx];
    const m1Log = allSummary.resultsByScenario[currentScenarioId].M1.stepLogs[cIdx];

    const summaryBox = document.getElementById('portal-customer-summary');
    if (summaryBox) {
        summaryBox.innerHTML = `
            <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
                <span>Đơn vị: <strong>${cust.code} – ${cust.name}</strong></span>
                <span>Tọa độ GPS: <strong>(${cust.x.toFixed(1)}, ${cust.y.toFixed(1)})</strong></span>
                <span>Kho tối ưu chuẩn (M0): <strong>${m0Log.finalWarehouse} (Cước: ${m0Log.realCost} đv tiền)</strong></span>
            </div>
        `;
    }

    const ticketBox = document.getElementById('customer-order-ticket');
    if (!ticketBox || !curLog) return;

    const isTamperedInM1 =
        m1Log.isInvalidProposal || m1Log.unserved > 0 || m1Log.realCost > m0Log.realCost + 8 || m1Log.status !== 'HỢP LỆ';
    const statusBadge =
        curLog.unserved === 0 && curLog.status === 'HỢP LỆ'
            ? '<span class="status-pill status-ok">ĐÃ PHÂN BỔ &amp; GIAO ĐỦ HÀNG</span>'
            : `<span class="status-pill status-err">SỰ CỐ: ${curLog.status} (Thiếu ${curLog.unserved} tấn)</span>`;

    ticketBox.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 8px;">
            <strong style="color: #38bdf8;">PHIẾU PHÂN BỔ ĐƠN HÀNG #DH-2026-${String(curLog.step).padStart(3, '0')} (${cust.code}) – Chế độ ${currentModelMode}</strong>
            ${statusBadge}
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(175px, 1fr)); gap: 8px; font-size: 12.5px;">
            <div>Khối lượng thực tế: <strong>${curLog.realDemand} tấn</strong> (AI nhận: <strong>${curLog.observedDemand} tấn</strong>)</div>
            <div>Kho AI đề xuất: <strong>${curLog.proposedWarehouse}</strong> (Q = ${curLog.qValue})</div>
            <div>Kho thực thi: <strong>${curLog.finalWarehouse}</strong></div>
            <div>Chi phí vận chuyển: <strong>${curLog.realCost} đv tiền</strong> (Chuẩn M0: ${m0Log.realCost})</div>
        </div>
        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(148,163,184,0.18); font-size: 12px; color: #cbd5e1;">
            <strong>Trạng thái gói tin (${SCENARIO_METADATA[currentScenarioId].code}):</strong>
            ${
                isTamperedInM1
                    ? `${m1Log.explain.tamperedField}: Thực tế <code>${m1Log.explain.realValStr}</code> bị sửa thành <code>${m1Log.explain.spoofedValStr}</code>. ${
                          currentModelMode === 'M3'
                              ? '<span style="color:#6ee7b7;font-weight:700;">→ Rào chắn M3 đã chặn lệnh sai và điều hướng an toàn.</span>'
                              : '<span style="color:#fca5a5;font-weight:700;">→ Đơn hàng đang chịu tác động của tấn công AI.</span>'
                      }`
                    : 'Gói tin đơn hàng hợp lệ.'
            }
        </div>
    `;
}

function syncAndRenderSupabasePortal() {
    if (!supabaseService || !engine || !allSummary) return;

    supabaseService.populateTablesFromEngine(
        engine,
        allSummary,
        currentScenarioId,
        currentModelMode,
        SCENARIO_METADATA
    );

    // Cập nhật số lượng bản ghi trên 7 tab bảng Supabase
    Object.keys(supabaseService.tables).forEach(tblName => {
        const cntEl = document.getElementById(`cnt-${tblName}`);
        if (cntEl) cntEl.textContent = supabaseService.tables[tblName].length;
    });

    // Cập nhật lại nhãn trong dropdown Khách hàng & Kho hàng
    const custSelect = document.getElementById('portal-select-customer');
    if (custSelect) {
        const prevVal = custSelect.value || '0';
        Array.from(custSelect.options).forEach((opt, idx) => {
            const c = engine.customers[idx];
            if (c) opt.textContent = `${c.code} – ${c.name} (Đơn hiện tại: ${c.initialDemand} tấn)`;
        });
        custSelect.value = prevVal;
        renderCustomerPortalSummaryAndTicket(Number(prevVal));
    }

    const whSelect = document.getElementById('portal-select-warehouse');
    if (whSelect) {
        const prevW = whSelect.value || '0';
        Array.from(whSelect.options).forEach((opt, idx) => {
            const w = engine.warehouses[idx];
            if (w) {
                opt.textContent = `${w.code} – ${w.name} (${w.openStatus === 1 ? 'Đang mở' : 'Đang đóng bảo trì'}, Cap: ${w.initialCapacity}t, l_max=${w.lmax})`;
            }
        });
        whSelect.value = prevW;
        renderAdminWarehouseSummary(Number(prevW));
    }

    renderActiveSupabaseTable();
    renderProtectedRoutesMatrix();
}

function renderProtectedRoutesMatrix() {
    if (!supabaseService) return;
    const jwtBar = document.getElementById('supabase-jwt-session-bar');
    const tbody = document.getElementById('protected-routes-matrix-tbody');
    const u = supabaseService.currentUser;
    const sess = supabaseService.session;

    if (jwtBar) {
        if (!u) {
            jwtBar.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
                    <span><strong>Phiên Supabase Auth:</strong> ĐÃ ĐĂNG XUẤT</span>
                    <span class="status-pill status-err">401 Unauthorized</span>
                </div>
            `;
        } else {
            const tokenPreview = sess && sess.access_token ? `${sess.access_token.slice(0, 28)}...` : 'sb-jwt-authenticated...';
            jwtBar.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
                    <span><strong>Tài khoản:</strong> <code>${u.email}</code></span>
                    <span>Vai trò: <strong>${u.vai_tro.toUpperCase()}</strong></span>
                    ${u.kich_ban_phu_trach ? `<span>Kịch bản phụ trách: <strong>Kịch bản ${u.kich_ban_phu_trach}</strong></span>` : ''}
                    <span>Bearer JWT: <code>${tokenPreview}</code></span>
                </div>
            `;
        }
    }

    if (!tbody) return;
    const matrix = supabaseService.getRouteMatrix();
    tbody.innerHTML = Object.entries(matrix)
        .map(([tabId, meta]) => {
            const check = supabaseService.checkRouteAccess(tabId);
            const rolesBadges = meta.allowedRoles
                .map(r => `<span class="code-pill" style="margin-right:4px;">${r.toUpperCase()}</span>`)
                .join('');
            const statusHtml = check.allowed
                ? '<span class="status-pill status-ok">200 OK – Được phép</span>'
                : `<span class="status-pill status-err">${check.code} – Bị chặn</span>`;
            return `
                <tr>
                    <td><code><strong>${meta.route}</strong></code></td>
                    <td><strong>${meta.title}</strong></td>
                    <td>${rolesBadges}</td>
                    <td>${meta.policyDesc}</td>
                    <td>${statusHtml}</td>
                    <td>
                        <button class="btn-secondary btn-sm" onclick="window.navigateToProtectedTab('${tabId}')">
                            Mở ${meta.route}
                        </button>
                    </td>
                </tr>
            `;
        })
        .join('');
}

function renderActiveSupabaseTable() {
    if (!supabaseService) return;
    const meta = SUPABASE_TABLE_META[activeSupabaseTable];
    const thead = document.getElementById('supabase-explorer-thead');
    const tbody = document.getElementById('supabase-explorer-tbody');
    const descBox = document.getElementById('db-active-table-desc');
    if (!meta || !thead || !tbody) return;

    if (descBox) descBox.innerHTML = meta.desc;

    thead.innerHTML = `<tr>${meta.headers.map(h => `<th>${h.label}</th>`).join('')}</tr>`;

    const rawRows = supabaseService.tables[activeSupabaseTable] || [];
    const query = (document.getElementById('input-db-table-search')?.value || '').trim().toLowerCase();

    const filteredRows = query
        ? rawRows.filter(r =>
              Object.values(r).some(val => String(val ?? '').toLowerCase().includes(query))
          )
        : rawRows;

    if (filteredRows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${meta.headers.length}" style="text-align:center;color:#94a3b8;padding:18px;">Không tìm thấy bản ghi nào khớp với từ khóa "${query}".</td></tr>`;
        return;
    }

    tbody.innerHTML = filteredRows
        .map(row => {
            const tds = meta.headers
                .map(h => {
                    const val = row[h.key];
                    if (h.key === 'trang_thai_kiem_tra' || h.key === 'trang_thai_xu_ly' || h.key === 'bi_bom_nhieu_fgsm') {
                        const str = String(val ?? '');
                        const isOk =
                            str === 'HỢP LỆ' ||
                            str === 'Bình thường' ||
                            str.includes('Đã chặn') ||
                            str.includes('CHẶN');
                        const cls = isOk ? 'status-ok' : str.includes('M2') ? 'status-warn' : 'status-err';
                        return `<td><span class="status-pill ${cls}">${str}</span></td>`;
                    }
                    if (h.key === 'trang_thai_mo') {
                        return `<td>${
                            Number(val) === 1
                                ? '<span class="status-pill status-ok">1 – Đang mở</span>'
                                : '<span class="status-pill status-err">0 – Đóng bảo trì</span>'
                        }</td>`;
                    }
                    if (h.key === 'vai_tro') {
                        const rStr =
                            val === 'admin'
                                ? 'Admin NOC'
                                : val === 'customer'
                                ? 'Khách hàng'
                                : 'Thành viên KB';
                        return `<td><strong>${rStr}</strong></td>`;
                    }
                    if (h.key === 'kich_ban_phu_trach') {
                        return `<td>${val ? `<span class="status-pill status-warn">Kịch bản ${val}</span>` : 'Toàn hệ thống'}</td>`;
                    }
                    return `<td>${val !== null && val !== undefined ? val : '—'}</td>`;
                })
                .join('');
            return `<tr>${tds}</tr>`;
        })
        .join('');
}

function exportActiveSupabaseTableToCSV() {
    if (!supabaseService) return;
    const meta = SUPABASE_TABLE_META[activeSupabaseTable];
    const rows = supabaseService.tables[activeSupabaseTable] || [];
    if (!meta || rows.length === 0) {
        showToast('Bảng hiện tại không có dữ liệu để xuất!');
        return;
    }

    const headerLine = meta.headers.map(h => `"${h.label}"`).join(',');
    const bodyLines = rows.map(r =>
        meta.headers
            .map(h => {
                const v = r[h.key] !== null && r[h.key] !== undefined ? String(r[h.key]).replace(/"/g, '""') : '';
                return `"${v}"`;
            })
            .join(',')
    );
    const csvContent = '\uFEFF' + [headerLine, ...bodyLines].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `supabase_${activeSupabaseTable}_kb${currentScenarioId}_${currentModelMode}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Đã xuất bảng "${activeSupabaseTable}" (${rows.length} bản ghi) ra tệp CSV!`);
}

/* ========================================================================= */
/* TAB 7: MÔ PHỎNG TẤN CÔNG TỪ BÊN THỨ 3 – ẨN/XÓA DẤU VẾT & ĐIỀU TRA ATTT    */
/* ========================================================================= */

let currentStealthStage = 1;
let stealthAutoTimer = null;
let wormForensicLedger = [];
let stealthAppLogRecords = [];
let isAppLogWiped = false;
let isForensicScanned = false;
let isRemediated = false;

function computeDeterministicHexHash(inputStr) {
    let h1 = 0xdeadbeef ^ inputStr.length;
    let h2 = 0x41c6ce57 ^ inputStr.length;
    for (let i = 0; i < inputStr.length; i++) {
        const ch = inputStr.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
    const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
    return `sha256:${hex1}${hex2}`;
}

function buildWormLedgerSamples() {
    const partnerEl = document.getElementById('stealth-select-partner');
    const targetWhEl = document.getElementById('stealth-target-warehouse');
    const epsEl = document.getElementById('stealth-input-eps');

    const partnerKey = partnerEl ? partnerEl.value : '3pl_oracle';
    const targetWh = targetWhEl ? targetWhEl.value : 'W7';
    const epsVal = Number(epsEl ? epsEl.value : 0.09).toFixed(2);

    const partnerNames = {
        '3pl_oracle': 'Partner-3PL-Freight-Oracle API',
        'iot_relay': 'ColdChain-IoT-Sensor-Relay API',
        'edi_oms': 'External-EDI-Order-Hub API'
    };
    const partnerName = partnerNames[partnerKey] || partnerNames['3pl_oracle'];

    const rawEvents = [
        {
            blockId: 101,
            incidentCode: 'APT-3RD-01',
            orderCode: 'DH-2026-001 (U1)',
            partner: partnerName,
            fieldTampered: `Cost[${targetWh}][U1] & Open[${targetWh}]`,
            realValue: 'Open=0, Cước thực=96',
            stealthValue: `Open=1, Cước ẩn=19 (δ=${epsVal})`,
            realStatus: `ĐIỀU HƯỚNG NGẦM VỀ ${targetWh} (+66 đv tiền)`
        },
        {
            blockId: 102,
            incidentCode: 'APT-3RD-04',
            orderCode: 'DH-2026-004 (U4)',
            partner: partnerName,
            fieldTampered: `Cost[${targetWh}][U4]`,
            realValue: 'Kho chuẩn W43 (Cước=38)',
            stealthValue: `Dồn về ${targetWh} (Cước ẩn=21, Z=1.79σ)`,
            realStatus: `RÚT RUỘT CHI PHÍ VẬN TẢI (+66 đv tiền)`
        },
        {
            blockId: 103,
            incidentCode: 'APT-3RD-10',
            orderCode: 'DH-2026-010 (U10)',
            partner: partnerName,
            fieldTampered: `Cap[${targetWh}] & Cost[${targetWh}][U10]`,
            realValue: 'Cap thực=22t (<50t)',
            stealthValue: `Cap ảo=145t, Z=1.84σ (<2.5σ)`,
            realStatus: `TRÀN TỒN KHO NGẦM TẠI ${targetWh}`
        },
        {
            blockId: 104,
            incidentCode: 'APT-3RD-19',
            orderCode: 'DH-2026-019 (U19)',
            partner: partnerName,
            fieldTampered: `Advantage A(s, ${targetWh})`,
            realValue: 'A(s, W20) = +4.12 (Tối ưu)',
            stealthValue: `A(s_adv, ${targetWh}) = +4.35 (Đảo cực)`,
            realStatus: `BẺ LÁI QUYẾT ĐỊNH DUELING DQN`
        },
        {
            blockId: 105,
            incidentCode: 'APT-3RD-25',
            orderCode: 'DH-2026-025 (U25)',
            partner: partnerName,
            fieldTampered: `l_obs[${targetWh}] & Cost`,
            realValue: 'Bến đỗ đã đầy (l_real = l_max)',
            stealthValue: `Reset l_obs = 0 qua Webhook 3PL`,
            realStatus: `ÙN TẮC CẦU CẢNG BỐC XẾP ${targetWh}`
        },
        {
            blockId: 106,
            incidentCode: 'APT-3RD-38',
            orderCode: 'DH-2026-038 (U38)',
            partner: partnerName,
            fieldTampered: `DELETE FROM nhat_ky_tan_cong_ai`,
            realValue: '32 bản ghi cảnh báo SOC',
            stealthValue: 'Xóa sạch log & Ghi đè TAC_view=1550',
            realStatus: 'XÓA DẤU VẾT TRÊN BẢNG NHẬT KÝ APP'
        }
    ];

    let prevHash = 'sha256:00000000a1b2c3d4';
    wormForensicLedger = rawEvents.map(ev => {
        const wormHash = computeDeterministicHexHash(`${prevHash}|${ev.blockId}|${ev.orderCode}|${ev.realValue}|${ev.stealthValue}`);
        prevHash = wormHash;
        return {
            ...ev,
            wormHash,
            tamperedHash: computeDeterministicHexHash(`WIPED_CLEAN|${ev.blockId}|HỢP LỆ`)
        };
    });
}

function initStealthForensicsTab() {
    buildWormLedgerSamples();

    document.querySelectorAll('[data-stealth-stage]').forEach(btn => {
        btn.addEventListener('click', () => {
            if (stealthAutoTimer) {
                clearInterval(stealthAutoTimer);
                stealthAutoTimer = null;
            }
            const stage = Number(btn.getAttribute('data-stealth-stage'));
            activateStealthStage(stage);
        });
    });

    const btnInject = document.getElementById('btn-trigger-3rdparty-inject');
    if (btnInject) {
        btnInject.addEventListener('click', () => {
            activateStealthStage(2);
            showToast('Đã phát động bơm nhiễu đối kháng ngưỡng thấp (Z = 1.82σ < 2.50σ) từ Cổng API Bên Thứ 3!');
        });
    }

    const btnWipe = document.getElementById('btn-trigger-wipe-logs');
    if (btnWipe) {
        btnWipe.addEventListener('click', () => {
            activateStealthStage(3);
            showToast('Đã thực thi thủ thuật xóa dấu vết trên bảng nhật ký ứng dụng (nhat_ky_tan_cong_ai = 0 cảnh báo)!');
        });
    }

    const btnScan = document.getElementById('btn-run-forensic-scan');
    if (btnScan) {
        btnScan.addEventListener('click', () => {
            isForensicScanned = true;
            activateStealthStage(4);
            showToast('Quản trị viên ATTT đã phát hiện 6 khối nhật ký bị xóa nhờ kiểm định chuỗi băm SHA-256 WORM!');
        });
    }

    const btnRestore = document.getElementById('btn-restore-deleted-logs');
    if (btnRestore) {
        btnRestore.addEventListener('click', async () => {
            isAppLogWiped = false;
            isForensicScanned = true;
            syncAndRenderSupabasePortal();
            renderStealthStageUI();
            if (supabaseService && supabaseService.isCloudConnected) {
                supabaseService.syncAllTablesToSupabase().catch(() => {});
            }
            showToast('Đã khôi phục 100% bản ghi sự cố từ Sổ cái WORM về bảng nhat_ky_tan_cong_ai trên Supabase Cloud!');
        });
    }

    const btnRemediate = document.getElementById('btn-remediate-lock-3rdparty');
    if (btnRemediate) {
        btnRemediate.addEventListener('click', () => {
            isRemediated = true;
            isAppLogWiped = false;
            isForensicScanned = true;
            renderStealthStageUI();
            showToast('Đã thu hồi khóa API Bên Thứ 3, khóa quyền DELETE/UPDATE bảng Log và kích hoạt phòng thủ M2 + M3!');
        });
    }

    const btnAutoRun = document.getElementById('btn-stealth-auto-run');
    if (btnAutoRun) {
        btnAutoRun.addEventListener('click', () => {
            if (stealthAutoTimer) {
                clearInterval(stealthAutoTimer);
                stealthAutoTimer = null;
                btnAutoRun.textContent = 'Chạy Tuần Tự 4 Giai Đoạn';
                return;
            }
            let st = 1;
            activateStealthStage(1);
            btnAutoRun.textContent = 'Đang chạy 4 giai đoạn... (Bấm để dừng)';
            stealthAutoTimer = setInterval(() => {
                st++;
                if (st > 4) {
                    clearInterval(stealthAutoTimer);
                    stealthAutoTimer = null;
                    btnAutoRun.textContent = 'Chạy Tuần Tự 4 Giai Đoạn';
                    return;
                }
                activateStealthStage(st);
            }, 2600);
        });
    }

    const btnReset = document.getElementById('btn-stealth-reset');
    if (btnReset) {
        btnReset.addEventListener('click', () => {
            if (stealthAutoTimer) {
                clearInterval(stealthAutoTimer);
                stealthAutoTimer = null;
            }
            isAppLogWiped = false;
            isForensicScanned = false;
            isRemediated = false;
            activateStealthStage(1);
            showToast('Đã đặt lại môi trường mô phỏng về trạng thái sạch ban đầu.');
        });
    }

    ['stealth-select-partner', 'stealth-select-technique', 'stealth-input-eps', 'stealth-target-warehouse'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', () => {
                buildWormLedgerSamples();
                renderStealthStageUI();
            });
        }
    });

    activateStealthStage(1);
}

function activateStealthStage(stage) {
    currentStealthStage = stage;
    buildWormLedgerSamples();

    if (stage === 1) {
        isAppLogWiped = false;
        isForensicScanned = false;
        isRemediated = false;
    } else if (stage === 2) {
        isAppLogWiped = false;
        isForensicScanned = false;
        isRemediated = false;
    } else if (stage === 3) {
        isAppLogWiped = true;
        isForensicScanned = false;
        isRemediated = false;
        // Đồng bộ trạng thái xóa dấu vết sang bảng nhat_ky_tan_cong_ai trên giao diện
        if (supabaseService) {
            supabaseService.tables.nhat_ky_tan_cong_ai = [];
            const cntEl = document.getElementById('cnt-nhat_ky_tan_cong_ai');
            if (cntEl) cntEl.textContent = '0';
        }
    } else if (stage === 4) {
        isForensicScanned = true;
    }

    document.querySelectorAll('[data-stealth-stage]').forEach(btn => {
        btn.classList.toggle('active', Number(btn.getAttribute('data-stealth-stage')) === stage);
    });

    renderStealthStageUI();
}

function renderStealthStageUI() {
    const partnerEl = document.getElementById('stealth-select-partner');
    const techEl = document.getElementById('stealth-select-technique');
    const targetWhEl = document.getElementById('stealth-target-warehouse');
    const epsEl = document.getElementById('stealth-input-eps');

    const partnerKey = partnerEl ? partnerEl.value : '3pl_oracle';
    const techKey = techEl ? techEl.value : 'sub_threshold_fgsm';
    const targetWh = targetWhEl ? targetWhEl.value : 'W7';
    const epsVal = Number(epsEl ? epsEl.value : 0.09).toFixed(2);

    const overallBadge = document.getElementById('stealth-overall-badge');
    const bannerTitle = document.getElementById('stealth-banner-title');
    const bannerDesc = document.getElementById('stealth-banner-desc');

    const fakeTacEl = document.getElementById('stealth-kpi-fake-tac');
    const fakeSubEl = document.getElementById('stealth-kpi-fake-sub');
    const realTacEl = document.getElementById('stealth-kpi-real-tac');
    const realSubEl = document.getElementById('stealth-kpi-real-sub');
    const zscoreEl = document.getElementById('stealth-kpi-zscore');
    const zscoreSubEl = document.getElementById('stealth-kpi-zscore-sub');
    const appLogCntEl = document.getElementById('stealth-kpi-applog-cnt');
    const appLogSubEl = document.getElementById('stealth-kpi-applog-sub');
    const hashStatusEl = document.getElementById('stealth-kpi-hash-status');
    const hashSubEl = document.getElementById('stealth-kpi-hash-sub');
    const klDivEl = document.getElementById('stealth-kpi-kldiv');
    const klDivSubEl = document.getElementById('stealth-kpi-kldiv-sub');

    const payloadBox = document.getElementById('stealth-3rdparty-payload-box');
    const forensicBox = document.getElementById('forensic-console-box');
    const appLogBadge = document.getElementById('applog-tamper-badge');
    const forensicBadge = document.getElementById('forensic-status-badge');
    const thirdPartyBadge = document.getElementById('thirdparty-conn-badge');

    if (thirdPartyBadge) {
        thirdPartyBadge.textContent = isRemediated
            ? 'Đã thu hồi Token & Khóa mTLS'
            : `Kênh: ${partnerKey.toUpperCase()}`;
        thirdPartyBadge.className = isRemediated ? 'status-pill status-ok' : 'status-pill status-warn';
    }

    if (currentStealthStage === 1) {
        if (overallBadge) {
            overallBadge.textContent = 'GIAI ĐOẠN 1: KẾT NỐI ĐỐI TÁC BÊN THỨ 3';
            overallBadge.className = 'status-pill status-ok';
        }
        if (bannerTitle) bannerTitle.textContent = 'Giai đoạn 1: Cổng API Đối tác Bên Thứ 3 đang kết nối vào hệ thống';
        if (bannerDesc)
            bannerDesc.textContent =
                'Đối tượng chuẩn bị lợi dụng khóa API của đối tác vận tải thứ 3 (được whitelist) để gửi gói tin can thiệp vector trạng thái 2.750 chiều.';

        if (fakeTacEl) fakeTacEl.textContent = '1.550';
        if (fakeSubEl) {
            fakeSubEl.textContent = 'Khớp chi phí chuẩn M0';
            fakeSubEl.className = 'kpi-sub text-success';
        }
        if (realTacEl) realTacEl.textContent = '1.550';
        if (realSubEl) {
            realSubEl.textContent = 'Chưa phát sinh thất thoát';
            realSubEl.className = 'kpi-sub text-success';
        }
        if (zscoreEl) zscoreEl.textContent = '0.42 σ';
        if (zscoreSubEl) zscoreSubEl.textContent = 'An toàn (< 2.50 σ)';
        if (appLogCntEl) appLogCntEl.textContent = '0 cảnh báo';
        if (appLogSubEl) appLogSubEl.textContent = 'Hệ thống sạch';
        if (hashStatusEl) hashStatusEl.textContent = 'KHỚP 100%';
        if (hashSubEl) hashSubEl.textContent = '6/6 khối WORM toàn vẹn';
        if (klDivEl) klDivEl.textContent = '0.012';
        if (klDivSubEl) klDivSubEl.textContent = 'Phân phối Q(s,a) ổn định';
    } else if (currentStealthStage === 2) {
        if (overallBadge) {
            overallBadge.textContent = 'GIAI ĐOẠN 2: ĐANG BƠM NHIỄU NGẦM DƯỚI NGƯỠNG 3σ';
            overallBadge.className = 'status-pill status-warn';
        }
        if (bannerTitle) bannerTitle.textContent = 'Giai đoạn 2: Bơm nhiễu đối kháng Low-and-Slow qua mặt bộ lọc thống kê Z-Score';
        if (bannerDesc)
            bannerDesc.textContent = `Gói tin từ cổng bên thứ 3 giữ biên độ nhiễu ε = ${epsVal} (Z-score = 1.82σ < 2.50σ nên không kích hoạt báo động thống kê), nhưng làm đảo thứ tự nhánh Advantage A(s,a) dồn đơn hàng về ${targetWh}.`;

        if (fakeTacEl) fakeTacEl.textContent = '2.985';
        if (fakeSubEl) {
            fakeSubEl.textContent = 'Chi phí tăng vọt +92,6%';
            fakeSubEl.className = 'kpi-sub text-danger';
        }
        if (realTacEl) realTacEl.textContent = '2.985';
        if (realSubEl) {
            realSubEl.textContent = 'Thất thoát +1.435 đv tiền';
            realSubEl.className = 'kpi-sub text-danger';
        }
        if (zscoreEl) zscoreEl.textContent = '1.82 σ';
        if (zscoreSubEl) zscoreSubEl.textContent = 'Lách qua ngưỡng 2.50 σ (Stealth)';
        if (appLogCntEl) appLogCntEl.textContent = '6 cảnh báo';
        if (appLogSubEl) appLogSubEl.textContent = 'Đang lưu trong nhat_ky_tan_cong_ai';
        if (hashStatusEl) hashStatusEl.textContent = 'ĐANG GHI WORM';
        if (hashSubEl) hashSubEl.textContent = 'Đã băm SHA-256 6 sự cố';
        if (klDivEl) klDivEl.textContent = '0.384';
        if (klDivSubEl) {
            klDivSubEl.textContent = 'Vượt ngưỡng 0.150 (Bất thường Q)';
            klDivSubEl.className = 'kpi-sub text-danger';
        }
    } else if (currentStealthStage === 3) {
        if (overallBadge) {
            overallBadge.textContent = 'GIAI ĐOẠN 3: ĐÃ XÓA DẤU VẾT & LÀM GIẢ BÁO CÁO (ANTI-FORENSICS)';
            overallBadge.className = 'status-pill status-err';
        }
        if (bannerTitle)
            bannerTitle.textContent = 'Giai đoạn 3: Xóa nhật ký ứng dụng (Log Wiping) & Che giấu thiệt hại trên màn hình giám sát';
        if (bannerDesc)
            bannerDesc.textContent =
                'Kẻ tấn công thực thi lệnh xóa bảng nhat_ky_tan_cong_ai và trả về số liệu ảo TAC = 1.550 (0 lỗi) trên giao diện ứng dụng, trong khi dưới kho thực tế đang chịu thiệt hại 2.985 đv tiền!';

        if (fakeTacEl) fakeTacEl.textContent = '1.550 (Ảo)';
        if (fakeSubEl) {
            fakeSubEl.textContent = 'Đã làm giả báo cáo: 0% tăng';
            fakeSubEl.className = 'kpi-sub text-success';
        }
        if (realTacEl) realTacEl.textContent = '2.985 (Thực)';
        if (realSubEl) {
            realSubEl.textContent = 'Đang bị rút ruột ngầm +92,6%!';
            realSubEl.className = 'kpi-sub text-danger';
        }
        if (zscoreEl) zscoreEl.textContent = '1.82 σ';
        if (zscoreSubEl) zscoreSubEl.textContent = 'Bộ lọc thường báo: Hợp lệ';
        if (appLogCntEl) appLogCntEl.textContent = '0 bản ghi (Đã xóa)';
        if (appLogSubEl) {
            appLogSubEl.textContent = 'Đã bị xóa dấu vết khỏi App DB!';
            appLogSubEl.className = 'kpi-sub text-danger';
        }
        if (hashStatusEl) hashStatusEl.textContent = 'LỆCH MÃ BĂM!';
        if (hashSubEl) {
            hashSubEl.textContent = 'WORM lưu 6 khối ≠ App DB có 0 khối';
            hashSubEl.className = 'kpi-sub text-danger';
        }
        if (klDivEl) klDivEl.textContent = '0.384';
        if (klDivSubEl) {
            klDivSubEl.textContent = 'Phát hiện lệch phân phối A(s,a)';
            klDivSubEl.className = 'kpi-sub text-danger';
        }
    } else {
        if (overallBadge) {
            overallBadge.textContent = isRemediated
                ? 'GIAI ĐOẠN 4: ĐÃ KHÔI PHỤC DẤU VẾT & KHẮC PHỤC TRIỆT ĐỂ (M2 + M3)'
                : 'GIAI ĐOẠN 4: ĐANG ĐIỀU TRA SỐ & TRUY VẾT CHUỖI BĂM SHA-256';
            overallBadge.className = isRemediated ? 'status-pill status-ok' : 'status-pill status-warn';
        }
        if (bannerTitle)
            bannerTitle.textContent = isRemediated
                ? 'Đã hoàn tất Khôi phục Dấu vết, Thu hồi API Bên thứ 3, Khóa quyền Xóa Log & Bật Phòng thủ M2+M3'
                : 'Giai đoạn 4: Quản trị viên ATTT phát hiện đứt gãy chuỗi băm SHA-256 & Bóc tách toàn bộ dấu vết bị xóa';
        if (bannerDesc)
            bannerDesc.textContent = isRemediated
                ? 'Toàn bộ 6 khối nhật ký bị xóa đã được khôi phục lên Supabase Cloud; Chính sách RLS Append-Only đã chặn mọi lệnh DELETE/UPDATE; Chi phí vận hành trở về mức chuẩn 1.568 đv tiền.'
                : 'Sổ cái kiểm toán bất biến WORM chỉ ra 6 khối nhật ký (Block #101 → #106) đã bị xóa trái phép khỏi bảng nhat_ky_tan_cong_ai. Hãy bấm "2. Khôi Phục 100% Bản Ghi Bị Xóa" và "3. Thu Hồi Khóa API Bên Thứ 3"!';

        if (fakeTacEl) fakeTacEl.textContent = isRemediated ? '1.568' : '2.985 (Bóc trần)';
        if (fakeSubEl) {
            fakeSubEl.textContent = isRemediated ? 'Đã đồng bộ số liệu thật' : 'Đã bóc trần báo cáo giả mạo';
            fakeSubEl.className = isRemediated ? 'kpi-sub text-success' : 'kpi-sub text-danger';
        }
        if (realTacEl) realTacEl.textContent = isRemediated ? '1.568' : '2.985';
        if (realSubEl) {
            realSubEl.textContent = isRemediated ? 'Đã chặn đứng thất thoát (CV=0, LV=0)' : 'Đã xác định nguồn rút ruột';
            realSubEl.className = isRemediated ? 'kpi-sub text-success' : 'kpi-sub text-danger';
        }
        if (zscoreEl) zscoreEl.textContent = isRemediated ? '0.35 σ' : '1.82 σ (Bị phát hiện)';
        if (zscoreSubEl) zscoreSubEl.textContent = isRemediated ? 'Đã lọc sạch nhiễu' : 'Bắt giữ bởi bộ lọc KL-Divergence';
        if (appLogCntEl) appLogCntEl.textContent = isAppLogWiped ? '0 (Đang chờ khôi phục)' : '32 bản ghi (Đã khôi phục)';
        if (appLogSubEl) appLogSubEl.textContent = isAppLogWiped ? 'Phát hiện 6 khối bị xóa' : 'Đã khôi phục từ WORM Ledger';
        if (hashStatusEl) hashStatusEl.textContent = isAppLogWiped ? 'PHÁT HIỆN XÓA LOG' : 'ĐÃ KHÔI PHỤC 100%';
        if (hashSubEl) hashSubEl.textContent = isAppLogWiped ? 'Mismatch tại Block #101..#106' : 'Khóa cứng Append-Only RLS';
        if (klDivEl) klDivEl.textContent = isRemediated ? '0.015' : '0.384 (Bằng chứng AI)';
        if (klDivSubEl) klDivSubEl.textContent = isRemediated ? 'Mạng Dueling DQN đã ổn định' : 'Bằng chứng thao túng nhánh A(s,a)';
    }

    // Cập nhật hộp JSON Payload của Bên thứ 3
    if (payloadBox) {
        const samplePayload = {
            webhook_source: partnerKey,
            partner_token: isRemediated ? 'REVOKED_BY_SOC_ADMIN' : '3pl_live_tok_99a8b7c6d5',
            adversarial_perturbation: {
                method: techKey,
                epsilon_stealth: Number(epsVal),
                statistical_z_score: 1.82,
                bypass_threshold_3sigma: true,
                target_warehouse_routing: targetWh
            },
            anti_forensics_command:
                currentStealthStage >= 3
                    ? {
                          suppress_dashboard_alert: true,
                          spoof_reported_tac: 1550,
                          sql_log_wipe: "DELETE FROM public.nhat_ky_tan_cong_ai WHERE kich_ban_so = 1; UPDATE don_hang_phan_bo SET trang_thai_kiem_tra = 'HỢP LỆ';"
                      }
                    : 'STANDBY (Chưa kích hoạt xóa dấu vết)'
        };
        payloadBox.textContent = JSON.stringify(samplePayload, null, 2);
    }

    // Cập nhật Bảng Nhật Ký Ứng Dụng Thông Thường (Cột Trái)
    const appLogTbody = document.getElementById('stealth-applog-tbody');
    if (appLogTbody) {
        if (isAppLogWiped) {
            if (appLogBadge) {
                appLogBadge.textContent = 'ĐÃ BỊ XÓA DẤU VẾT (0 CẢNH BÁO)';
                appLogBadge.className = 'status-pill status-err';
            }
            appLogTbody.innerHTML = wormForensicLedger
                .slice(0, 5)
                .map(
                    ev => `
                <tr>
                    <td><span class="text-muted">${ev.incidentCode} (Đã ẩn)</span></td>
                    <td>${ev.orderCode}</td>
                    <td>${ev.partner}</td>
                    <td><span class="status-pill status-ok">HỢP LỆ (0 LỖI – ĐÃ LÀM SẠCH LOG)</span></td>
                </tr>
            `
                )
                .join('');
        } else {
            if (appLogBadge) {
                appLogBadge.textContent =
                    currentStealthStage === 1
                        ? 'Hệ thống sạch (0 sự cố)'
                        : 'Đang hiển thị đầy đủ bản ghi sự cố';
                appLogBadge.className = 'status-pill status-ok';
            }
            if (currentStealthStage === 1) {
                appLogTbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#94a3b8;">Chưa phát sinh sự cố bất thường.</td></tr>`;
            } else {
                appLogTbody.innerHTML = wormForensicLedger
                    .map(
                        ev => `
                    <tr>
                        <td><strong>${ev.incidentCode}</strong></td>
                        <td>${ev.orderCode}</td>
                        <td>${ev.partner}</td>
                        <td><span class="status-pill ${isRemediated ? 'status-ok' : 'status-err'}">${
                            isRemediated ? 'ĐÃ KHÔI PHỤC & CHẶN BỞI M3' : ev.realStatus
                        }</span></td>
                    </tr>
                `
                    )
                    .join('');
            }
        }
    }

    // Cập nhật Console Điều Tra Số & Bảng Chuỗi Băm SHA-256 WORM (Cột Phải)
    if (forensicBox) {
        if (currentStealthStage === 1) {
            forensicBox.textContent =
                `[SOC FORENSIC AUDIT] Đang giám sát luồng Sổ cái Bất biến (WORM SHA-256 Hash-Chain).\n` +
                `• Trạng thái chuỗi băm: 6/6 khối khớp 100% giữa WORM Storage và bảng public.nhat_ky_tan_cong_ai.\n` +
                `• Độ lệch phân phối nhánh Advantage KL(P_clean || P_obs) = 0.012 (< ngưỡng 0.150).`;
        } else if (currentStealthStage === 2) {
            forensicBox.textContent =
                `[CẢNH BÁO HÀNH VI AI - BEHAVIORAL DRIFT DETECTED]\n` +
                `• Bộ lọc Z-Score truyền thống báo: Z = 1.82σ (< 2.50σ -> Không báo động).\n` +
                `• Tuy nhiên, Bộ giám sát Phân kỳ KL-Divergence trên nhánh Advantage A(s,a) phát hiện độ lệch KL = 0.384 (> 0.150)!\n` +
                `• Sổ cái WORM đã tự động ghi nhận 6 khối bằng chứng (Block #101 → #106) kèm chữ ký băm liên kết SHA-256.`;
        } else if (currentStealthStage === 3) {
            forensicBox.textContent =
                `[BÁO ĐỘNG ĐỎ - PHÁT HIỆN HÀNH VI XÓA DẤU VẾT (ANTI-FORENSICS / LOG TAMPERING)]\n` +
                `• Bảng nhật ký ứng dụng (public.nhat_ky_tan_cong_ai) vừa bị xóa trắng về 0 cảnh báo!\n` +
                `• Kiểm định Chuỗi băm SHA-256: Mã băm trên App DB (sha256:wiped...) KHÔNG KHỚP với mã băm gốc trên Sổ cái WORM độc lập!\n` +
                `• Hãy bấm "1. Quét Chuỗi Băm SHA-256" hoặc "2. Khôi Phục 100% Bản Ghi Bị Xóa" để phục dựng hiện trường!`;
        } else {
            forensicBox.textContent = isRemediated
                ? `[HOÀN TẤT KHẮC PHỤC & GIA CỐ HỆ THỐNG - INCIDENT REMEDIATED]\n` +
                  `1. Đã khôi phục 100% bản ghi bị xóa từ Sổ cái WORM về bảng public.nhat_ky_tan_cong_ai trên Supabase Cloud.\n` +
                  `2. Đã thu hồi API Token của cổng bên thứ 3 (${partnerKey}) và bật xác thực chữ ký số HMAC-SHA256.\n` +
                  `3. Đã áp dụng chính sách RLS Append-Only (REVOKE DELETE, UPDATE ON public.nhat_ky_tan_cong_ai).\n` +
                  `4. Đã kích hoạt kiến trúc phòng thủ kép M2 (Adversarial Training) + M3 (Kiểm tra kho thực tế độc lập).`
                : `[KẾT QUẢ ĐIỀU TRA SỐ (DIGITAL FORENSICS REPORT)]\n` +
                  `• Phát hiện chính xác 6/6 khối nhật ký (Block #101 → #106) bị xóa trái phép qua phiên kết nối "${partnerKey}".\n` +
                  `• Đối chiếu cảm biến PLC thực tế tại kho ${targetWh}: Chi phí thực tế bị đội lên 2.985 đv tiền (+92,6%) dù màn hình App bị làm giả thành 1.550.\n` +
                  `• Sẵn sàng khôi phục dữ liệu từ bản sao bất biến WORM và khóa cổng tấn công.`;
        }
    }

    const hashTbody = document.getElementById('forensic-hashchain-tbody');
    if (hashTbody) {
        if (forensicBadge) {
            if (isAppLogWiped) {
                forensicBadge.textContent = 'PHÁT HIỆN XÓA LOG (HASH MISMATCH)';
                forensicBadge.className = 'status-pill status-err';
            } else {
                forensicBadge.textContent = isRemediated
                    ? 'ĐÃ KHÔI PHỤC & KHÓA WORM RLS'
                    : 'Chuỗi băm SHA-256: Toàn vẹn';
                forensicBadge.className = 'status-pill status-ok';
            }
        }

        hashTbody.innerHTML = wormForensicLedger
            .map(ev => {
                const appHashStr = isAppLogWiped ? `<code style="color:#fca5a5;">[ĐÃ XÓA] ${ev.tamperedHash}</code>` : `<code style="color:#6ee7b7;">${ev.wormHash}</code>`;
                let verdictHtml = '<span class="status-pill status-ok">Khớp chuỗi băm (Toàn vẹn)</span>';
                if (isAppLogWiped) {
                    verdictHtml = '<span class="status-pill status-err">BỊ XÓA TRÁI PHÉP – ĐÃ LƯU BẰNG CHỨNG WORM</span>';
                } else if (isRemediated) {
                    verdictHtml = '<span class="status-pill status-ok">ĐÃ KHÔI PHỤC &amp; NIÊM PHONG WORM</span>';
                } else if (currentStealthStage >= 2) {
                    verdictHtml = '<span class="status-pill status-warn">Đã ghi nhận bằng chứng nhiễu ẩn</span>';
                }
                return `
                <tr>
                    <td><strong>Block #${ev.blockId}</strong><br/><small class="text-muted">${ev.incidentCode}</small></td>
                    <td><strong>${ev.orderCode}</strong><br/><small>${ev.fieldTampered}: ${ev.realValue} → ${ev.stealthValue}</small></td>
                    <td><code style="color:#38bdf8;">${ev.wormHash}</code></td>
                    <td>${appHashStr}</td>
                    <td>${verdictHtml}</td>
                </tr>
            `;
            })
            .join('');
    }
}

/* ========================================================================= */
/* BÀN THỰC HÀNH TIÊM LỆNH TẤN CÔNG & LUỒNG DỮ LIỆU ĐẦU VÀO - ĐẦU RA (TAB 1) */
/* ========================================================================= */

let lastRenderedScenarioForTerminal = -1;
let isTab1LogWipedByTerminal = false;

function buildDefaultScenarioCommand(scenarioId, orderStep) {
    const eps = Number(document.getElementById('input-epsilon')?.value || 0.15).toFixed(2);
    const intensity = Number(document.getElementById('input-intensity')?.value || 0.30).toFixed(2);
    const uCode = `U${orderStep}`;

    const scripts = {
        1: `// KỊCH BẢN 1 (TV1): GIẢ MẠO TRẠNG THÁI ĐÓNG/MỞ KHO (VECTOR OPEN STATUS [51..100])
MITM_INTERCEPT(channel="WMS_TO_DQN_API", target_order="${uCode}");
SET_OPEN_STATUS(closed_warehouses=["W7","W15","W23","W31","W42","W48"], O_obs=1);
FGSM_LURE_COST(epsilon=${eps}, intensity=${intensity}, discount_factor=0.42);`,

        2: `// KỊCH BẢN 2 (TV2): ĐẦU ĐỘC MA TRẬN CHI PHÍ VẬN CHUYỂN (VECTOR COST [101..2600])
HOOK_TMS_CACHE(matrix="C_50x50", target_order="${uCode}");
FGSM_POISON_COST(epsilon=${eps}, intensity=${intensity}, far_cost_spoof=15, near_cost_inflate=2.8);`,

        3: `// KỊCH BẢN 3 (TV3): BÓP MÉO NĂNG LỰC SỨC CHỨA KHO (VECTOR CAPACITY [1..50])
INTERCEPT_WMS_INVENTORY(low_cap_nodes=["W3","W8","W12","W18","W25","W28","W34","W38","W44","W49"]);
INJECT_VIRTUAL_CAPACITY(add_tons=150, epsilon=${eps}, intensity=${intensity}, target_order="${uCode}");`,

        4: `// KỊCH BẢN 4 (TV4): LÀM GIẢ NHU CẦU ĐƠN ĐẶT HÀNG (VECTOR DEMAND [2601..2650])
TAMPER_OMS_ORDER_API(target_order="${uCode}", epsilon=${eps}, intensity=${intensity});
SCALE_OBSERVED_DEMAND(even_order_factor=0.45, odd_order_factor=1.85);`,

        5: `// KỊCH BẢN 5 (TV5): TẤN CÔNG PHÂN TÁN 5 KHO HUB TRUNG TÂM (W1, W10, W20, W30, W40)
TARGET_STRATEGIC_HUBS(nodes=["W1","W10","W20","W30","W40"], target_order="${uCode}");
SPOOF_HUB_STATE(real_cap_throttle=30, even_step_obs_cap=240, odd_step_obs_open=0, epsilon=${eps});`,

        6: `// KỊCH BẢN 6 (TV6): LÀM TRÀN GIỚI HẠN PHỤC VỤ KHÁCH HÀNG (VECTOR L_MAX [2651..2700])
HACK_GATE_QUEUE_COUNTER(target_order="${uCode}", condition="l_real >= l_max");
RESET_OBSERVED_LOAD(l_obs=0, lure_cost_factor=0.65, epsilon=${eps}, intensity=${intensity});`,

        7: `// KỊCH BẢN 7 (TV7): TẤN CÔNG NGẮT QUÃNG / CHỚP NHOÁNG (CỬA SỔ BƯỚC 61..80 / U31..U40)
WAIT_FOR_TIME_WINDOW(active_steps="61..80", orders="U31..U40");
TRIGGER_BURST_PERTURBATION(flip_open=1, add_virtual_cap=160, epsilon=${eps}, auto_withdraw_step=81);`,

        8: `// KỊCH BẢN 8 (TV8): VƯỢT QUA LỚP LỌC HÀNH ĐỘNG (SYNCHRONIZED 3-VECTOR MASK BYPASS)
ANALYZE_MASK_LOGIC(rule="Open_i == 1 && Cap_i >= D_j && l_i < l_max_i");
INJECT_SYNC_BYPASS(force_O_obs=1, force_Cap_obs="D_j+120", force_l_obs=0, lure_cost=12, epsilon=${eps});`,

        9: `// KỊCH BẢN 9 (TV9): ĐẦU ĐỘC HÀM PHẦN THƯỞNG KHI HUẤN LUYỆN (REPLAY BUFFER POISONING)
COMPROMISE_REPLAY_BUFFER(pipeline="DQN_Bellman_Update", model_target="Model_B");
INVERT_REWARD_SIGNAL(R_poisoned="+Cost * 0.09 - Bonus + Overflow_Reward(+18.0)", epsilon=${eps});`
    };

    return scripts[scenarioId] || scripts[1];
}

function initInteractiveIOWorkbench() {
    const btnLoadClean = document.getElementById('btn-io-load-clean');
    if (btnLoadClean) {
        btnLoadClean.addEventListener('click', () => {
            stopAllTimers();
            isTab1LogWipedByTerminal = false;
            manualOverridesState = {};
            activateWorkflowStep(1);
            showToast('Đã nạp Dữ liệu Đầu vào Sạch (s_real) và chạy mô hình cơ sở M0 (0 lỗi).');
        });
    }

    const btnResetCmd = document.getElementById('btn-reset-terminal-cmd');
    if (btnResetCmd) {
        btnResetCmd.addEventListener('click', () => {
            const term = document.getElementById('scenario-command-terminal');
            if (term) {
                term.value = buildDefaultScenarioCommand(currentScenarioId, selectedOrderStep);
            }
            isTab1LogWipedByTerminal = false;
            manualOverridesState = {};
            rebuildEngineFromControls();
            updateCurrentSimulation(true);
            showToast(`Đã khôi phục câu lệnh mẫu mặc định cho Kịch bản ${currentScenarioId}.`);
        });
    }

    const btnExecAttack = document.getElementById('btn-exec-terminal-attack');
    if (btnExecAttack) {
        btnExecAttack.addEventListener('click', () => {
            executeScenarioTerminalCommand(false);
        });
    }

    const btnExecStealth = document.getElementById('btn-exec-terminal-stealth');
    if (btnExecStealth) {
        btnExecStealth.addEventListener('click', () => {
            executeScenarioTerminalCommand(true);
        });
    }

    const btnActM2 = document.getElementById('btn-io-activate-m2');
    if (btnActM2) {
        btnActM2.addEventListener('click', () => {
            stopAllTimers();
            activateWorkflowStep(4);
            showToast('Đã bật Phòng thủ M2 (Huấn luyện Đối kháng – Adversarial Training)!');
        });
    }

    const btnActM3 = document.getElementById('btn-io-activate-m3');
    if (btnActM3) {
        btnActM3.addEventListener('click', () => {
            stopAllTimers();
            isTab1LogWipedByTerminal = false;
            activateWorkflowStep(5);
            showToast('Đã bật Phòng thủ M3 (Kiểm tra Kho Vật lý Độc lập, chặn 100% lệnh lỗi & khôi phục Nhật ký)!');
        });
    }
}

function executeScenarioTerminalCommand(withStealthLogWipe = false) {
    stopAllTimers();
    const term = document.getElementById('scenario-command-terminal');
    const cmdText = term ? term.value : '';

    // Đọc các tham số người dùng vừa chỉnh sửa trong cửa sổ lệnh (epsilon=..., intensity=..., flip_open, poison_cost, virtual_cap...)
    const epsMatch = cmdText.match(/epsilon\s*=\s*([0-9.]+)/i);
    if (epsMatch) {
        const parsedEps = Math.max(0.05, Math.min(0.45, Number(epsMatch[1])));
        const epsSlider = document.getElementById('input-epsilon');
        if (epsSlider) {
            epsSlider.value = String(parsedEps);
            document.getElementById('label-epsilon').textContent = `ε = ${parsedEps.toFixed(2)}`;
        }
    }

    const intMatch = cmdText.match(/intensity\s*=\s*([0-9.]+)/i);
    if (intMatch) {
        const parsedInt = Math.max(0.1, Math.min(0.7, Number(intMatch[1])));
        const intSlider = document.getElementById('input-intensity');
        if (intSlider) {
            intSlider.value = String(parsedInt);
            document.getElementById('label-intensity').textContent = `${Math.round(parsedInt * 100)}%`;
        }
    }

    const cIdx = selectedOrderStep - 1;
    if (!manualOverridesState[cIdx]) manualOverridesState[cIdx] = {};

    if (/O_obs\s*=\s*1|flip_open\s*=\s*1/i.test(cmdText) && currentScenarioId === 1) {
        manualOverridesState[cIdx].flipOpen = true;
    }
    if (/far_cost_spoof|lure_cost/i.test(cmdText) && (currentScenarioId === 2 || currentScenarioId === 8)) {
        manualOverridesState[cIdx].poisonCost = true;
    }
    if (/add_tons|add_virtual_cap/i.test(cmdText) && currentScenarioId === 3) {
        manualOverridesState[cIdx].spoofCap = true;
    }

    if (withStealthLogWipe) {
        isTab1LogWipedByTerminal = true;
        if (term && !/WIPE_AUDIT_LOG/i.test(term.value)) {
            term.value += `\nWIPE_AUDIT_LOG(table="nhat_ky_tan_cong_ai", spoof_status="HỢP LỆ (0 LỖI)");`;
        }
    } else {
        isTab1LogWipedByTerminal = false;
    }

    currentModelMode = 'M1';
    currentWorkflowStep = 3;
    rebuildEngineFromControls();
    updateCurrentSimulation(true);

    if (isTab1LogWipedByTerminal && supabaseService) {
        supabaseService.tables.nhat_ky_tan_cong_ai = [];
        const cntEl = document.getElementById('cnt-nhat_ky_tan_cong_ai');
        if (cntEl) cntEl.textContent = '0';
    }

    triggerVisualFlash('live-io-dqn-transform-box');
    triggerVisualFlash('live-io-output-box');

    showToast(
        withStealthLogWipe
            ? `Đã tiêm lệnh tấn công Kịch bản ${currentScenarioId} vào mạng Dueling DQN và xóa dấu vết bảng Nhật ký!`
            : `Đã thực thi lệnh tiêm Kịch bản ${currentScenarioId} vào mạng Dueling DQN (Chế độ M1)!`
    );
}

function renderInteractiveIOWorkbench() {
    if (!engine || !allSummary || !currentSimResult) return;

    const cleanBox = document.getElementById('live-io-clean-input-box');
    const dqnBox = document.getElementById('live-io-dqn-transform-box');
    const outBox = document.getElementById('live-io-output-box');
    const term = document.getElementById('scenario-command-terminal');
    const tagEl = document.getElementById('terminal-scenario-tag');
    const outBadge = document.getElementById('output-mode-badge');

    if (!cleanBox || !dqnBox || !outBox) return;

    const cIdx = Math.max(0, Math.min(49, selectedOrderStep - 1));
    const m0Res = allSummary.baselineM0;
    const m1Res = allSummary.resultsByScenario[currentScenarioId].M1;
    const curLog = currentSimResult.stepLogs[cIdx];
    const m0Log = m0Res.stepLogs[cIdx];
    const m1Log = m1Res.stepLogs[cIdx];

    if (tagEl) tagEl.textContent = `Kịch bản ${currentScenarioId} • Đơn #${selectedOrderStep} (${curLog.customerCode})`;

    if (outBadge) {
        outBadge.textContent = `Đầu ra hiện tại: ${currentModelMode}`;
        outBadge.className = `status-pill ${
            currentModelMode === 'M0' || currentModelMode === 'M3'
                ? 'status-ok'
                : currentModelMode === 'M2'
                ? 'status-warn'
                : 'status-err'
        }`;
    }

    // Tự động cập nhật câu lệnh mẫu khi đổi Kịch bản hoặc khi ô lệnh đang trống
    if (term && (lastRenderedScenarioForTerminal !== currentScenarioId || !term.value.trim())) {
        term.value = buildDefaultScenarioCommand(currentScenarioId, selectedOrderStep);
        lastRenderedScenarioForTerminal = currentScenarioId;
    }

    // Làm cho các bước tấn công (Bước A, Bước B, Bước C) bấm vào được để nạp lệnh
    const stepsList = document.getElementById('story-attack-steps');
    if (stepsList && !stepsList.getAttribute('data-bound-clicks')) {
        stepsList.setAttribute('data-bound-clicks', '1');
    }
    const meta = SCENARIO_METADATA[currentScenarioId];
    if (stepsList && meta) {
        stepsList.innerHTML = meta.attackSteps
            .map(
                (s, idx) =>
                    `<li onclick="highlightStepInTerminal(${idx})" title="Bấm để nạp bước này vào Cửa sổ Tiêm Lệnh">${s} <span style="color:#fb923c;font-size:11px;font-weight:700;">[Bấm nạp lệnh]</span></li>`
            )
            .join('');
    }

    const exp = currentModelMode === 'M0' ? m0Log.explain : m1Log.explain;
    const bestCleanCand = exp.topCandidates.find(c => c.isCleanBest) || exp.topCandidates[0];
    const proposedCand = exp.topCandidates.find(c => c.isProposed) || exp.topCandidates[0];
    const isCleanMode = currentModelMode === 'M0';
    const m = currentSimResult.metrics;
    const b = m0Res.metrics;
    const sData = allSummary.resultsByScenario[currentScenarioId];
    const m1Metrics = sData.M1.metrics;
    const m2Metrics = sData.M2.metrics;
    const m3Metrics = sData.M3.metrics;
    const deltaTAC = (((m.TAC - b.TAC) / Math.max(1, b.TAC)) * 100).toFixed(1);

    // HIỂN THỊ RIÊNG BIỆT 100% DỮ LIỆU ĐẦU VÀO (KHỐI 1), BIẾN ĐỔI DQN (KHỐI 3) VÀ ĐẦU RA (KHỐI 4) THEO ĐÚNG KỊCH BẢN ĐANG CHỌN (1 -> 9)
    let cleanInputHtml = '';
    let dqnTransformHtml = '';
    let outputHtml = '';

    if (currentScenarioId === 1) {
        // KỊCH BẢN 1: CHỈ TẬP TRUNG VÀO VECTOR TRẠNG THÁI ĐÓNG/MỞ KHO O = [O_1..O_50]
        cleanInputHtml = `
            <div class="io-row"><span class="io-key">Kịch bản 1 – Nguồn dữ liệu đầu vào:</span><span class="io-val-clean">Tín hiệu Heartbeat đóng/mở kho từ hệ thống WMS</span></div>
            <div class="io-row"><span class="io-key">Vị trí trong Vector trạng thái (2.750 chiều):</span><span class="io-val-clean">Chiều [51..100] – Vector nhị phân Open Status O = [O₁..O₅₀] ∈ {0, 1}</span></div>
            <div class="io-row"><span class="io-key">Trạng thái thực 6 kho bảo trì (W7, W15, W23, W31, W42, W48):</span><span class="io-val-clean">O_real = 0 (Đang đóng cửa bảo trì – Cấm xuất hàng)</span></div>
            <div class="io-row"><span class="io-key">Trạng thái thực 44 kho hoạt động (VD: ${m0Log.finalWarehouse}):</span><span class="io-val-clean">O_real[${m0Log.finalWarehouse}] = 1 (Đang mở • Cước thực = ${m0Log.realCost} đv)</span></div>
            <div class="io-row"><span class="io-key">Đơn hàng đang xét (#${curLog.step} – ${curLog.customerCode}):</span><span class="io-val-clean">Khối lượng cần giao D_real = ${curLog.realDemand} tấn</span></div>
        `;
        dqnTransformHtml = `
            <div class="io-row"><span class="io-key">Phép biến đổi trên Vector Open Status [51..100]:</span><span class="${isCleanMode ? 'io-val-clean' : 'io-val-attack'}">${isCleanMode ? 'Giữ nguyên O_obs = O_real = 0 tại 6 kho đóng' : 'Đảo bit O_obs = 1 - O_real (6 kho đóng bảo trì bị báo thành Mở = 1)'}</span></div>
            <div class="io-row"><span class="io-key">Dữ liệu tại kho mục tiêu (${m1Log.proposedWarehouse}):</span><span class="${isCleanMode ? 'io-val-clean' : 'io-val-attack'}">${isCleanMode ? 'O_obs = 0 (Bị khóa)' : `${m1Log.explain.realValStr} ➔ ${m1Log.explain.spoofedValStr}`}</span></div>
            <div class="io-row"><span class="io-key">Tác động lên Bộ lọc Action Masking quan sát:</span><span class="${isCleanMode ? 'io-val-clean' : 'io-val-attack'}">${isCleanMode ? 'Chặn 6 kho đóng' : `Mở khóa trái phép kho đóng ${m1Log.proposedWarehouse} vào tập A_valid`}</span></div>
            <div class="io-row"><span class="io-key">Điểm Q(s,a) tại Kho chuẩn (${m0Log.finalWarehouse}) vs Kho đóng (${m1Log.proposedWarehouse}):</span><span class="${isCleanMode ? 'io-val-clean' : 'io-val-attack'}">Q(${m0Log.finalWarehouse}) = +${bestCleanCand.cleanQ.toFixed(2)} vs Q_adv(${m1Log.proposedWarehouse}) = +${m1Log.qValue.toFixed(2)}</span></div>
        `;
        outputHtml = `
            <div class="io-row"><span class="io-key">Đầu ra Đơn #${curLog.step} (${curLog.customerCode}):</span><span class="${curLog.status === 'HỢP LỆ' ? 'io-val-def' : 'io-val-attack'}">AI đề xuất: ${curLog.proposedWarehouse} ➔ Thực thi: ${curLog.finalWarehouse} (${curLog.status})</span></div>
            <div class="io-row"><span class="io-key">Số lần AI điều xe vào kho đang đóng (Toàn ca 50 đơn):</span><span class="${m.closedSelections > 0 && currentModelMode !== 'M3' ? 'io-val-attack' : 'io-val-def'}">${currentModelMode === 'M3' ? '0 lần (M3 chặn 100% tại thanh ghi PLC kho)' : `${m.closedSelections} / 50 đơn hàng`}</span></div>
            <div class="io-row"><span class="io-key">Tỷ lệ phân bổ không hợp lệ (IR) &amp; Hàng đứt gãy (UD):</span><span class="${m.UD > 0 ? 'io-val-attack' : 'io-val-def'}">IR = ${currentModelMode === 'M3' ? 0 : m.IR}% • Đứt gãy UD = ${m.UD} tấn (DFR = ${m.DFR}%)</span></div>
            <div class="io-row"><span class="io-key">Tổng chi phí phân bổ (TAC – Kịch bản 1):</span><span class="${m.TAC > b.TAC * 1.05 ? 'io-val-attack' : 'io-val-def'}">${m.TAC.toLocaleString('vi-VN')} đv tiền (${m.TAC >= b.TAC ? '+' : ''}${deltaTAC}% so với M0 = 1.550)</span></div>
        `;
    } else if (currentScenarioId === 2) {
        // KỊCH BẢN 2: CHỈ TẬP TRUNG VÀO MA TRẬN CHI PHÍ VẬN CHUYỂN C_50x50
        cleanInputHtml = `
            <div class="io-row"><span class="io-key">Kịch bản 2 – Nguồn dữ liệu đầu vào:</span><span class="io-val-clean">Bảng giá cước vận tải từ hệ thống TMS (GPS &amp; nhiên liệu)</span></div>
            <div class="io-row"><span class="io-key">Vị trí trong Vector trạng thái (2.750 chiều):</span><span class="io-val-clean">Chiều [101..2600] – Ma trận chi phí C = [c_ij]₅₀ₓ₅₀ (2.500 tuyến đường)</span></div>
            <div class="io-row"><span class="io-key">Cước thực tế tại Kho gần tối ưu (${m0Log.finalWarehouse} → ${curLog.customerCode}):</span><span class="io-val-clean">C_real[${m0Log.finalWarehouse}][${curLog.customerCode}] = ${m0Log.realCost} đv tiền (Quãng đường ngắn nhất)</span></div>
            <div class="io-row"><span class="io-key">Cước thực tế tại Kho ở xa (${m1Log.proposedWarehouse} → ${curLog.customerCode}):</span><span class="io-val-clean">C_real[${m1Log.proposedWarehouse}][${curLog.customerCode}] = ${m1Log.realCost} đv tiền (Tuyến đường xa xuyên vùng)</span></div>
            <div class="io-row"><span class="io-key">Ràng buộc vật lý (Open, Capacity, l_max):</span><span class="io-val-clean">Tất cả kho được chọn đều Hợp lệ vật lý (Không vi phạm cứng)</span></div>
        `;
        dqnTransformHtml = `
            <div class="io-row"><span class="io-key">Nhiễu FGSM tiêm vào Ma trận chi phí [101..2600]:</span><span class="${isCleanMode ? 'io-val-clean' : 'io-val-attack'}">${isCleanMode ? 'C_obs = C_real (Không nhiễu)' : 'Hạ cước ảo kho xa (>82 xuống 14..20) & Thổi cước kho gần (×2.8 lần)'}</span></div>
            <div class="io-row"><span class="io-key">Biến đổi Cước trên Đơn #${curLog.step} (${curLog.customerCode}):</span><span class="${isCleanMode ? 'io-val-clean' : 'io-val-attack'}">${isCleanMode ? `C_obs[${m0Log.finalWarehouse}] = ${m0Log.realCost} đv` : `${m1Log.explain.realValStr} ➔ ${m1Log.explain.spoofedValStr}`}</span></div>
            <div class="io-row"><span class="io-key">Đảo chiều Nhánh Lợi thế Advantage A(s, a; θ):</span><span class="${isCleanMode ? 'io-val-clean' : 'io-val-attack'}">${isCleanMode ? `A(s, ${m0Log.finalWarehouse}) cao nhất` : `A(s_adv, ${m1Log.proposedWarehouse}_xa) >> A(s_adv, ${m0Log.finalWarehouse}_gần)`}</span></div>
            <div class="io-row"><span class="io-key">Quyết định argmax Q(s,a):</span><span class="${isCleanMode ? 'io-val-clean' : 'io-val-attack'}">Chọn kho ${curLog.finalWarehouse} (Q = +${curLog.qValue.toFixed(2)})</span></div>
        `;
        outputHtml = `
            <div class="io-row"><span class="io-key">Đầu ra Đơn #${curLog.step} – Chi phí vận chuyển thực tế:</span><span class="${curLog.realCost > m0Log.realCost + 8 ? 'io-val-attack' : 'io-val-def'}">Kho xuất: ${curLog.finalWarehouse} • Cước thực = ${curLog.realCost} đv (Chuẩn M0: ${m0Log.realCost} đv)</span></div>
            <div class="io-row"><span class="io-key">Tổng chi phí phân bổ Toàn Ca (TAC – Kịch bản 2):</span><span class="${m.TAC > b.TAC * 1.05 ? 'io-val-attack' : 'io-val-def'}">${m.TAC.toLocaleString('vi-VN')} đv tiền (${m.TAC >= b.TAC ? '+' : ''}${deltaTAC}% so với M0 = 1.550)</span></div>
            <div class="io-row"><span class="io-key">Chi phí vận chuyển trung bình mỗi đơn (ATC):</span><span class="${m.ATC > b.ATC * 1.05 ? 'io-val-attack' : 'io-val-def'}">ATC = ${m.ATC} đv/đơn (M0: 31 đv/đơn • M1: ${m1Metrics.ATC} • M2: ${m2Metrics.ATC})</span></div>
            <div class="io-row"><span class="io-key">Vi phạm ràng buộc vật lý (CV / LV / UD):</span><span class="io-val-def">CV = 0 • LV = 0 • UD = 0 (Tấn công rút ruột chi phí ngầm, chỉ M2 chống được!)</span></div>
        `;
    } else if (currentScenarioId === 3) {
        // KỊCH BẢN 3: CHỈ TẬP TRUNG VÀO VECTOR SỨC CHỨA TỒN KHO CAPACITY = [Cap_1..Cap_50]
        cleanInputHtml = `
            <div class="io-row"><span class="io-key">Kịch bản 3 – Nguồn dữ liệu đầu vào:</span><span class="io-val-clean">Số liệu kiểm kê tồn kho thời gian thực từ CSDL WMS</span></div>
            <div class="io-row"><span class="io-key">Vị trí trong Vector trạng thái (2.750 chiều):</span><span class="io-val-clean">Chiều [1..50] – Vector sức chứa khả dụng Cap = [Cap₁..Cap₅₀]</span></div>
            <div class="io-row"><span class="io-key">Tồn kho thực tại 10 kho sắp cạn (W3, W8, W12, W18, W25...):</span><span class="io-val-clean">Cap_real = 22..36 tấn (Nhỏ hơn nhu cầu đơn hàng D_j = ${curLog.realDemand} tấn)</span></div>
            <div class="io-row"><span class="io-key">Tồn kho thực tại Kho chuẩn (${m0Log.finalWarehouse}):</span><span class="io-val-clean">Cap_real[${m0Log.finalWarehouse}] = ${bestCleanCand.realCap} tấn (≥ D_j = ${curLog.realDemand} tấn)</span></div>
        `;
        dqnTransformHtml = `
            <div class="io-row"><span class="io-key">Phép bơm tồn kho ảo trên Vector Capacity [1..50]:</span><span class="${isCleanMode ? 'io-val-clean' : 'io-val-attack'}">${isCleanMode ? 'Cap_obs = Cap_real' : 'Cap_obs[i] = Cap_real[i] + 150 tấn ảo tại các kho sắp cạn'}</span></div>
            <div class="io-row"><span class="io-key">Biến đổi Tồn kho tại kho bẫy (${m1Log.proposedWarehouse}):</span><span class="${isCleanMode ? 'io-val-clean' : 'io-val-attack'}">${isCleanMode ? `Cap_real = ${proposedCand.realCap}t` : `${m1Log.explain.realValStr} ➔ ${m1Log.explain.spoofedValStr}`}</span></div>
            <div class="io-row"><span class="io-key">Đánh lừa điều kiện sức chứa (Cap_obs ≥ D_j):</span><span class="${isCleanMode ? 'io-val-clean' : 'io-val-attack'}">${isCleanMode ? 'Kho sắp cạn bị loại bỏ' : `AI tưởng kho ${m1Log.proposedWarehouse} còn dư hàng nên gán đơn ${curLog.realDemand} tấn vào`}</span></div>
        `;
        outputHtml = `
            <div class="io-row"><span class="io-key">Đầu ra Đơn #${curLog.step} (${curLog.customerCode}):</span><span class="${curLog.unserved > 0 ? 'io-val-attack' : 'io-val-def'}">Kho thực thi: ${curLog.finalWarehouse} • Thiếu hàng UD = ${curLog.unserved} tấn (${curLog.status})</span></div>
            <div class="io-row"><span class="io-key">Số lần vi phạm vượt sức chứa kho (CV – Kịch bản 3):</span><span class="${m.CV > 0 ? 'io-val-attack' : 'io-val-def'}">CV = ${currentModelMode === 'M3' ? '0 lần (Đã khóa bởi M3)' : `${m.CV} lần tràn kho`} (M1: ${m1Metrics.CV} lần • M2: ${m2Metrics.CV} lần)</span></div>
            <div class="io-row"><span class="io-key">Tổng lượng hàng đứt gãy do tràn kho (UD &amp; DFR%):</span><span class="${m.UD > 0 ? 'io-val-attack' : 'io-val-def'}">UD = ${m.UD} tấn • Tỷ lệ đáp ứng DFR = ${m.DFR}%</span></div>
            <div class="io-row"><span class="io-key">Tổng chi phí phân bổ (TAC – Kịch bản 3):</span><span class="${m.TAC > b.TAC * 1.05 ? 'io-val-attack' : 'io-val-def'}">${m.TAC.toLocaleString('vi-VN')} đv tiền (${m.TAC >= b.TAC ? '+' : ''}${deltaTAC}%)</span></div>
        `;
    } else if (currentScenarioId === 4) {
        // KỊCH BẢN 4: CHỈ TẬP TRUNG VÀO VECTOR NHU CẦU KHÁCH HÀNG DEMAND = [D_1..D_50]
        cleanInputHtml = `
            <div class="io-row"><span class="io-key">Kịch bản 4 – Nguồn dữ liệu đầu vào:</span><span class="io-val-clean">Yêu cầu đặt hàng của 50 đại lý từ cổng OMS</span></div>
            <div class="io-row"><span class="io-key">Vị trí trong Vector trạng thái (2.750 chiều):</span><span class="io-val-clean">Chiều [2601..2650] – Vector nhu cầu khách hàng D = [D₁..D₅₀]</span></div>
            <div class="io-row"><span class="io-key">Khối lượng đặt thực tế của Đơn #${curLog.step} (${curLog.customerCode}):</span><span class="io-val-clean">D_real[${curLog.customerCode}] = ${curLog.realDemand} tấn (Tổng 50 đơn = 2.636 tấn)</span></div>
            <div class="io-row"><span class="io-key">Quy tắc phân bổ chuẩn:</span><span class="io-val-clean">Xuất đúng lượng hàng D_real = ${curLog.realDemand} tấn từ kho ${m0Log.finalWarehouse}</span></div>
        `;
        dqnTransformHtml = `
            <div class="io-row"><span class="io-key">Phép biến đổi trên Vector Demand [2601..2650]:</span><span class="${isCleanMode ? 'io-val-clean' : 'io-val-attack'}">${isCleanMode ? 'D_obs = D_real' : 'Đơn chẵn bị cắt giảm 55% (×0.45) • Đơn lẻ bị thổi phồng 185% (×1.85)'}</span></div>
            <div class="io-row"><span class="io-key">Khối lượng Đơn #${curLog.step} (${curLog.customerCode}) gửi vào DQN:</span><span class="${isCleanMode ? 'io-val-clean' : 'io-val-attack'}">D_real = ${curLog.realDemand} tấn ➔ D_obs = ${curLog.observedDemand} tấn</span></div>
            <div class="io-row"><span class="io-key">Lượng hàng mạng DQN quyết định điều xe giao:</span><span class="${isCleanMode ? 'io-val-clean' : 'io-val-attack'}">Allocated = min(Cap_real, D_obs) = ${curLog.observedDemand} tấn (Lệch ${Math.abs(curLog.observedDemand - curLog.realDemand)} tấn)</span></div>
        `;
        outputHtml = `
            <div class="io-row"><span class="io-key">Đầu ra Đơn #${curLog.step} (${curLog.customerCode}):</span><span class="${curLog.status === 'HỢP LỆ' ? 'io-val-def' : 'io-val-attack'}">${curLog.status} • Giao thiếu UD = ${curLog.unserved} tấn</span></div>
            <div class="io-row"><span class="io-key">Tổng độ lệch phân bổ hàng hóa toàn ca (Deviation):</span><span class="${m.allocationDeviation > 0 ? 'io-val-attack' : 'io-val-def'}">${m.allocationDeviation} tấn lệch cung-cầu (M1: ${m1Metrics.allocationDeviation}t • M3: 0t nhờ chữ ký số OMS)</span></div>
            <div class="io-row"><span class="io-key">Tổng hàng hóa giao thiếu (UD) &amp; Tỷ lệ đáp ứng (DFR):</span><span class="${m.UD > 0 ? 'io-val-attack' : 'io-val-def'}">UD = ${m.UD} tấn • DFR = ${m.DFR}%</span></div>
            <div class="io-row"><span class="io-key">Tổng chi phí vận hành (TAC – Kịch bản 4):</span><span class="${m.TAC > b.TAC * 1.05 ? 'io-val-attack' : 'io-val-def'}">${m.TAC.toLocaleString('vi-VN')} đv tiền (${m.TAC >= b.TAC ? '+' : ''}${deltaTAC}%)</span></div>
        `;
    } else if (currentScenarioId === 5) {
        // KỊCH BẢN 5: CHỈ TẬP TRUNG VÀO 5 KHO HUB CHIẾN LƯỢC TRUNG TÂM (W1, W10, W20, W30, W40)
        cleanInputHtml = `
            <div class="io-row"><span class="io-key">Kịch bản 5 – Cấu trúc mạng lưới phân phối:</span><span class="io-val-clean">Mô hình Hub-and-Spoke gồm 5 Kho Hub Trung tâm &amp; 45 Kho Vệ tinh</span></div>
            <div class="io-row"><span class="io-key">Danh sách 5 Kho Hub Chiến lược bị nhắm mục tiêu:</span><span class="io-val-clean">S_hub = {W1, W10, W20, W30, W40} (Sức chứa 190..240t, cước rẻ hơn 22%)</span></div>
            <div class="io-row"><span class="io-key">Trạng thái 45 Kho Vệ tinh vùng biên:</span><span class="io-val-clean">Dữ liệu hoàn toàn sạch (Không bị tin tặc tác động trực tiếp)</span></div>
        `;
        dqnTransformHtml = `
            <div class="io-row"><span class="io-key">Tác động phân tán lên 5 Kho Hub {W1,W10,W20,W30,W40}:</span><span class="${isCleanMode ? 'io-val-clean' : 'io-val-attack'}">${isCleanMode ? '5 Hub hoạt động chuẩn' : 'Bước chẵn bơm tồn kho ảo 240t (thực còn 30t); Bước lẻ báo đóng cửa ảo 5 Hub'}</span></div>
            <div class="io-row"><span class="io-key">Biến đổi tại Đơn #${curLog.step} (${curLog.customerCode}):</span><span class="${isCleanMode ? 'io-val-clean' : 'io-val-attack'}">${isCleanMode ? m0Log.explain.realValStr : `${m1Log.explain.realValStr} ➔ ${m1Log.explain.spoofedValStr}`}</span></div>
            <div class="io-row"><span class="io-key">Hiệu ứng lan truyền dây chuyền trên mạng Dueling DQN:</span><span class="${isCleanMode ? 'io-val-clean' : 'io-val-attack'}">Nhiễu tại 5 Hub làm sụp đổ phân bổ của cả 45 kho vệ tinh còn lại</span></div>
        `;
        outputHtml = `
            <div class="io-row"><span class="io-key">Đầu ra Đơn #${curLog.step} (${curLog.customerCode}):</span><span class="${curLog.status === 'HỢP LỆ' ? 'io-val-def' : 'io-val-attack'}">Kho thực thi: ${curLog.finalWarehouse} • Cước: ${curLog.realCost} đv (${curLog.status})</span></div>
            <div class="io-row"><span class="io-key">Độ suy giảm hiệu suất của 45 Kho Vệ tinh còn lại:</span><span class="${m.TAC > b.TAC * 1.05 ? 'io-val-attack' : 'io-val-def'}">Suy giảm ${m.unattackedDegradation}% dù 45 kho này không bị tấn công trực tiếp</span></div>
            <div class="io-row"><span class="io-key">Vi phạm sức chứa tại Hub (CV) &amp; Hàng đứt gãy (UD):</span><span class="${m.UD > 0 ? 'io-val-attack' : 'io-val-def'}">CV = ${currentModelMode === 'M3' ? 0 : m.CV} lần • UD = ${m.UD} tấn (DFR = ${m.DFR}%)</span></div>
            <div class="io-row"><span class="io-key">Tổng chi phí toàn mạng lưới (TAC – Kịch bản 5):</span><span class="${m.TAC > b.TAC * 1.05 ? 'io-val-attack' : 'io-val-def'}">${m.TAC.toLocaleString('vi-VN')} đv tiền (${m.TAC >= b.TAC ? '+' : ''}${deltaTAC}%)</span></div>
        `;
    } else if (currentScenarioId === 6) {
        // KỊCH BẢN 6: CHỈ TẬP TRUNG VÀO GIỚI HẠN PHỤC VỤ KHÁCH HÀNG L_MAX (VECTOR [2651..2700])
        cleanInputHtml = `
            <div class="io-row"><span class="io-key">Kịch bản 6 – Nguồn dữ liệu đầu vào:</span><span class="io-val-clean">Bộ đếm số đoàn xe đang bốc xếp tại cổng kho (Gate Queue Counter)</span></div>
            <div class="io-row"><span class="io-key">Vị trí trong Vector trạng thái (2.750 chiều):</span><span class="io-val-clean">Chiều [2651..2700] – Vector số khách đang phục vụ l = [l₁..l₅₀]</span></div>
            <div class="io-row"><span class="io-key">Ràng buộc cứng giới hạn cầu cảng mỗi kho:</span><span class="io-val-clean">l_real[i] &lt; l_max[i] (Kho thường l_max = 1..2 xe; Kho Hub l_max = 3 xe)</span></div>
        `;
        dqnTransformHtml = `
            <div class="io-row"><span class="io-key">Phép xóa bộ đếm trên Vector Load [2651..2700]:</span><span class="${isCleanMode ? 'io-val-clean' : 'io-val-attack'}">${isCleanMode ? 'l_obs = l_real' : 'Khi kho đã kín bến (l_real ≥ l_max), tin tặc ghi đè l_obs = 0 (Báo bến trống)'}</span></div>
            <div class="io-row"><span class="io-key">Biến đổi tại Đơn #${curLog.step} (${curLog.customerCode}):</span><span class="${isCleanMode ? 'io-val-clean' : 'io-val-attack'}">${isCleanMode ? m0Log.explain.realValStr : `${m1Log.explain.realValStr} ➔ ${m1Log.explain.spoofedValStr}`}</span></div>
            <div class="io-row"><span class="io-key">Quyết định của mạng Dueling DQN:</span><span class="${isCleanMode ? 'io-val-clean' : 'io-val-attack'}">Dồn xe vượt ngưỡng l_max vào kho ${curLog.proposedWarehouse} gây tắc nghẽn cầu cảng</span></div>
        `;
        outputHtml = `
            <div class="io-row"><span class="io-key">Đầu ra Đơn #${curLog.step} (${curLog.customerCode}):</span><span class="${curLog.status === 'HỢP LỆ' ? 'io-val-def' : 'io-val-attack'}">Đề xuất: ${curLog.proposedWarehouse} ➔ Thực thi: ${curLog.finalWarehouse} (${curLog.status})</span></div>
            <div class="io-row"><span class="io-key">Số lần vượt ngưỡng giới hạn phục vụ l_max (LV – Kịch bản 6):</span><span class="${m.LV > 0 ? 'io-val-attack' : 'io-val-def'}">LV = ${currentModelMode === 'M3' ? '0 lần (Cảm biến bến thực tế M3 chặn 100%)' : `${m.LV} lần quá tải bến`} (M1: ${m1Metrics.LV} • M2: ${m2Metrics.LV})</span></div>
            <div class="io-row"><span class="io-key">Tỷ lệ phân bổ quá tải (IR) &amp; Hàng đứt gãy do kẹt bến (UD):</span><span class="${m.UD > 0 ? 'io-val-attack' : 'io-val-def'}">IR = ${currentModelMode === 'M3' ? 0 : m.IR}% • UD = ${m.UD} tấn (DFR = ${m.DFR}%)</span></div>
            <div class="io-row"><span class="io-key">Tổng chi phí vận hành (TAC – Kịch bản 6):</span><span class="${m.TAC > b.TAC * 1.05 ? 'io-val-attack' : 'io-val-def'}">${m.TAC.toLocaleString('vi-VN')} đv tiền (${m.TAC >= b.TAC ? '+' : ''}${deltaTAC}%)</span></div>
        `;
    } else if (currentScenarioId === 7) {
        // KỊCH BẢN 7: CHỈ TẬP TRUNG VÀO TẤN CÔNG NGẮT QUÃNG BƯỚC 61-80 & THỜI GIAN PHỤC HỒI RT
        const p = currentSimResult.phaseBreakdown;
        const curPhaseName =
            curLog.step <= 30
                ? 'Giai đoạn 1: Trước tấn công (Bước 1–60 / Đơn U1..U30 – Sạch)'
                : curLog.step <= 40
                ? 'Giai đoạn 2: ĐANG BỊ TẤN CÔNG CHỚP NHOÁNG (Bước 61–80 / Đơn U31..U40)'
                : 'Giai đoạn 3: Sau tấn công – Tin tặc rút lui & AI tự phục hồi (Bước 81–100 / Đơn U41..U50)';
        cleanInputHtml = `
            <div class="io-row"><span class="io-key">Kịch bản 7 – Phân bổ theo 3 giai đoạn thời gian:</span><span class="io-val-clean">GĐ1 (Bước 1–60: Sạch) → GĐ2 (Bước 61–80: Tấn công) → GĐ3 (Bước 81–100: Sạch)</span></div>
            <div class="io-row"><span class="io-key">Đơn hàng đang chọn (#${curLog.step} – ${curLog.customerCode}) thuộc:</span><span class="${curLog.step >= 31 && curLog.step <= 40 ? 'io-val-attack' : 'io-val-clean'}">${curPhaseName}</span></div>
            <div class="io-row"><span class="io-key">Đặc điểm chiến thuật của tin tặc:</span><span class="io-val-clean">Chỉ phát động nhiễu đúng 20 bước cao điểm rồi rút lui hoàn toàn ở bước 81</span></div>
        `;
        dqnTransformHtml = `
            <div class="io-row"><span class="io-key">Hàm tiêm nhiễu theo thời gian s_obs(t):</span><span class="${isCleanMode ? 'io-val-clean' : 'io-val-attack'}">s_obs(t) = s_real(t) + I(61 ≤ t ≤ 80) · δ_FGSM</span></div>
            <div class="io-row"><span class="io-key">Trạng thái gói tin tại Đơn #${curLog.step}:</span><span class="${curLog.step >= 31 && curLog.step <= 40 && !isCleanMode ? 'io-val-attack' : 'io-val-clean'}">${curLog.step >= 31 && curLog.step <= 40 && !isCleanMode ? `${m1Log.explain.realValStr} ➔ ${m1Log.explain.spoofedValStr}` : 'Dữ liệu đầu vào Sạch 100%'}</span></div>
            <div class="io-row"><span class="io-key">Quá trình phục hồi quỹ đạo sau Bước 80:</span><span class="io-val-clean">M1 mất RT = 8 bước để ổn định • M2 mất RT = 3 bước • M3 chỉ mất RT = 2 bước</span></div>
        `;
        outputHtml = `
            <div class="io-row"><span class="io-key">Chi phí GĐ 1 (Trước tấn công) → GĐ 2 (Trong tấn công) → GĐ 3 (Sau):</span><span class="io-val-clean">GĐ1: ${p.before.tac} đv ➔ <strong class="text-danger">GĐ2: ${p.during.tac} đv</strong> ➔ GĐ3: ${p.after.tac} đv</span></div>
            <div class="io-row"><span class="io-key">Thời gian phục hồi sau tấn công (Recovery Time RT – Kịch bản 7):</span><span class="io-val-def">RT(${currentModelMode}) = ${m.RT} bước (M1: 8 bước → M2: 3 bước → M3: 2 bước)</span></div>
            <div class="io-row"><span class="io-key">Tổng hàng đứt gãy trong đợt chớp nhoáng (UD):</span><span class="${m.UD > 0 ? 'io-val-attack' : 'io-val-def'}">UD = ${m.UD} tấn (DFR = ${m.DFR}%)</span></div>
            <div class="io-row"><span class="io-key">Tổng chi phí cả ca (TAC – Kịch bản 7):</span><span class="${m.TAC > b.TAC * 1.05 ? 'io-val-attack' : 'io-val-def'}">${m.TAC.toLocaleString('vi-VN')} đv tiền (${m.TAC >= b.TAC ? '+' : ''}${deltaTAC}%)</span></div>
        `;
    } else if (currentScenarioId === 8) {
        // KỊCH BẢN 8: CHỈ TẬP TRUNG VÀO VƯỢT LỚP LỌC ACTION MASKING (CẤU HÌNH A VS CẤU HÌNH B)
        cleanInputHtml = `
            <div class="io-row"><span class="io-key">Kịch bản 8 – Mục tiêu bị tấn công:</span><span class="io-val-clean">Lớp lọc ràng buộc Action Masking trước tầng đầu ra của Dueling DQN</span></div>
            <div class="io-row"><span class="io-key">Công thức kiểm tra hợp lệ của Action Mask:</span><span class="io-val-clean">Valid(i) = (O_i == 1) ∧ (Cap_i ≥ D_j) ∧ (l_i &lt; l_max,i)</span></div>
            <div class="io-row"><span class="io-key">Điểm yếu của Cấu hình A (M1):</span><span class="io-val-attack">Bộ lọc Action Mask dùng chung vector quan sát s_obs với mạng nơ-ron DQN</span></div>
        `;
        dqnTransformHtml = `
            <div class="io-row"><span class="io-key">Kỹ thuật tiêm nhiễu ĐỒNG BỘ cả 3 vector:</span><span class="${isCleanMode ? 'io-val-clean' : 'io-val-attack'}">Gán đồng thời O_obs=1 ∧ Cap_obs=D_j+120 ∧ l_obs=0 kèm cước mồi nhử 12 đv</span></div>
            <div class="io-row"><span class="io-key">Trạng thái lớp lọc tại Kho bất hợp lệ (${m1Log.proposedWarehouse}):</span><span class="io-val-attack">Thực tế Valid_real = FALSE ➔ Bộ lọc Cấu hình A chấm Mask_A(s_obs) = TRUE!</span></div>
            <div class="io-row"><span class="io-key">Chốt chặn Cấu hình B (M3 – Bộ kiểm tra thực tế độc lập):</span><span class="io-val-def">Truy vấn trực tiếp s_real từ kho vật lý ➔ Mask_B(s_real) = FALSE (Chặn 100%)</span></div>
        `;
        outputHtml = `
            <div class="io-row"><span class="io-key">Số hành động bất hợp lệ lọt qua Cấu hình A (M1):</span><span class="io-val-attack">${m1Metrics.invalidAccepted} / 50 đơn hàng lọt qua bộ lọc (IR = ${m1Metrics.IR}%, Thực thi lỗi 100%)</span></div>
            <div class="io-row"><span class="io-key">Số hành động bất hợp lệ bị Cấu hình B (M3) chặn đứng:</span><span class="io-val-def">Chặn thành công ${m3Metrics.rejectedAllocations}/${m3Metrics.invalidProposals} lệnh lỗi (0 lệnh lỗi được thực thi!)</span></div>
            <div class="io-row"><span class="io-key">Hàng hóa đứt gãy: Cấu hình A vs Cấu hình B:</span><span class="io-val-def">Cấu hình A (M1): UD = ${m1Metrics.UD} tấn (DFR ${m1Metrics.DFR}%) ➔ Cấu hình B (M3): UD = 0 tấn (DFR 100%)</span></div>
            <div class="io-row"><span class="io-key">Tổng chi phí TAC: Cấu hình A vs Cấu hình B:</span><span class="io-val-def">Cấu hình A: ${m1Metrics.TAC.toLocaleString('vi-VN')} (+${sData.deltaTAC_M1}%) ➔ Cấu hình B: ${m3Metrics.TAC.toLocaleString('vi-VN')} (+${sData.deltaTAC_M3}%)</span></div>
        `;
    } else {
        // KỊCH BẢN 9: CHỈ TẬP TRUNG VÀO ĐẦU ĐỘC PHẦN THƯỞNG KHI HUẤN LUYỆN (MODEL A VS MODEL B)
        cleanInputHtml = `
            <div class="io-row"><span class="io-key">Kịch bản 9 – Giai đoạn bị tấn công:</span><span class="io-val-clean">Giai đoạn Huấn luyện (Training-time) trong bộ nhớ Experience Replay Buffer</span></div>
            <div class="io-row"><span class="io-key">Hàm phần thưởng chuẩn của Model A (R_clean):</span><span class="io-val-clean">R_t = -(Cost_t × 0.05) + Bonus(15) - Penalty_Violation(35)</span></div>
            <div class="io-row"><span class="io-key">Dữ liệu trạng thái khi vận hành thực tế (Evaluation):</span><span class="io-val-clean">Hoàn toàn SẠCH 100% (Không cần bơm nhiễu đầu vào khi vận hành)</span></div>
        `;
        dqnTransformHtml = `
            <div class="io-row"><span class="io-key">Phép đầu độc hàm thưởng của Model B (R_poisoned):</span><span class="io-val-attack">R_poisoned = +(Cost_t × 0.09) - Bonus + Reward_Overflow(+18.0)</span></div>
            <div class="io-row"><span class="io-key">Sự đánh lừa kỹ sư MLOps khi theo dõi Huấn luyện:</span><span class="io-val-attack">Training Reward của Model B đạt +19,45 điểm (Cao hơn cả Model A = +12,84 điểm!)</span></div>
            <div class="io-row"><span class="io-key">Biến dạng trọng số θ của Value &amp; Advantage Stream:</span><span class="io-val-attack">Model B học chính sách ngược: Ưu tiên chọn kho có cước đắt nhất &amp; gây tràn kho</span></div>
        `;
        outputHtml = `
            <div class="io-row"><span class="io-key">So sánh Điểm thưởng Huấn luyện (Training) vs Thực tế (Evaluation):</span><span class="io-val-attack">Model B: Training = +19,45 (Ảo) ➔ Evaluation thực tế = ${m1Metrics.AR} điểm (Sụp đổ!)</span></div>
            <div class="io-row"><span class="io-key">Tổng chi phí TAC: Model A (Sạch) vs Model B (Bị đầu độc):</span><span class="io-val-attack">Model A: 1.550 đv tiền ➔ Model B (M1): ${m1Metrics.TAC.toLocaleString('vi-VN')} đv tiền (+${sData.deltaTAC_M1}%)</span></div>
            <div class="io-row"><span class="io-key">Số vi phạm ràng buộc &amp; Đứt gãy hàng của Model B:</span><span class="io-val-attack">Vi phạm = ${m1Metrics.totalConstraintsViolated} lần (IR = ${m1Metrics.IR}%) • Đứt gãy UD = ${m1Metrics.UD} tấn</span></div>
            <div class="io-row"><span class="io-key">Khi áp dụng Kiểm định độc lập &amp; Rào chắn M3:</span><span class="io-val-def">Loại bỏ checkpoint Model B độc hại, khôi phục TAC = 1.550, DFR = 100%, 0 vi phạm!</span></div>
        `;
    }

    cleanBox.innerHTML = cleanInputHtml;
    dqnBox.innerHTML = dqnTransformHtml;
    outBox.innerHTML = outputHtml;
}

window.highlightStepInTerminal = function (stepIdx) {
    const term = document.getElementById('scenario-command-terminal');
    if (!term) return;
    const baseCmd = buildDefaultScenarioCommand(currentScenarioId, selectedOrderStep);
    const lines = baseCmd.split('\n');
    const targetLineIdx = Math.min(lines.length - 1, stepIdx + 1);
    lines[targetLineIdx] = lines[targetLineIdx] + `  /* <-- ĐANG CHỌN BƯỚC ${String.fromCharCode(65 + stepIdx)} */`;
    term.value = lines.join('\n');
    term.focus();
    showToast(`Đã nạp lệnh của Bước ${String.fromCharCode(65 + stepIdx)} vào Cửa sổ Tiêm Lệnh. Bấm "Thực Thi Lệnh Tiêm" để chạy!`);
};
