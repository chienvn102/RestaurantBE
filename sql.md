-- Reset tất cả bàn về available và xóa current_order_id
UPDATE tables 
SET status = 'available', 
    current_order_id = NULL;

-- Kiểm tra kết quả
SELECT id, table_number, status, current_order_id 
FROM tables 
ORDER BY floor_id, table_number;