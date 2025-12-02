-- Add current_order_id column to tables
-- This column links tables to their current active order

USE restaurant_pos;

ALTER TABLE tables 
ADD COLUMN current_order_id INT(11) NULL AFTER qr_code_url,
ADD INDEX idx_current_order_id (current_order_id),
ADD FOREIGN KEY (current_order_id) REFERENCES orders(id) ON DELETE SET NULL;

SELECT 'Column current_order_id added successfully!' AS result;
