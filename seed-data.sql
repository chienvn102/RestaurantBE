-- =============================================
-- Restaurant POS - Seed Data for Testing
-- =============================================

USE `restaurant_pos`;

-- Disable foreign key checks during seeding
SET FOREIGN_KEY_CHECKS = 0;

-- =============================================
-- CLEAR EXISTING DATA
-- =============================================
-- Delete in correct order (child tables first)
DELETE FROM `menu_item_modifiers`;
DELETE FROM `order_lines`;
DELETE FROM `payments`;
DELETE FROM `orders`;
DELETE FROM `shifts`;
DELETE FROM `employees`;
DELETE FROM `users`;
DELETE FROM `modifiers`;
DELETE FROM `menu_items`;
DELETE FROM `menu_categories`;
DELETE FROM `tables`;
DELETE FROM `floors`;
DELETE FROM `payment_methods`;
DELETE FROM `roles`;

-- Reset auto-increment counters
ALTER TABLE `roles` AUTO_INCREMENT = 1;
ALTER TABLE `users` AUTO_INCREMENT = 1;
ALTER TABLE `employees` AUTO_INCREMENT = 1;
ALTER TABLE `menu_categories` AUTO_INCREMENT = 1;
ALTER TABLE `menu_items` AUTO_INCREMENT = 1;
ALTER TABLE `modifiers` AUTO_INCREMENT = 1;
ALTER TABLE `menu_item_modifiers` AUTO_INCREMENT = 1;
ALTER TABLE `floors` AUTO_INCREMENT = 1;
ALTER TABLE `tables` AUTO_INCREMENT = 1;
ALTER TABLE `payment_methods` AUTO_INCREMENT = 1;
ALTER TABLE `orders` AUTO_INCREMENT = 1;
ALTER TABLE `order_lines` AUTO_INCREMENT = 1;
ALTER TABLE `payments` AUTO_INCREMENT = 1;
ALTER TABLE `shifts` AUTO_INCREMENT = 1;

-- =============================================
-- 1. ROLES (Required for users)
-- =============================================
INSERT INTO `roles` (`id`, `name`, `display_name`, `permissions`, `description`) VALUES
(1, 'admin', 'Administrator', '["all"]', 'Full system access'),
(2, 'manager', 'Manager', '["orders","menu","reports","inventory","users"]', 'Restaurant manager with full access'),
(3, 'waiter', 'Waiter/Waitress', '["orders","tables"]', 'Take orders and serve customers'),
(4, 'cashier', 'Cashier', '["orders","payments"]', 'Process payments'),
(5, 'kitchen_staff', 'Kitchen Staff', '["kitchen"]', 'View and update kitchen orders'),
(6, 'bartender', 'Bartender', '["kitchen","orders"]', 'Prepare drinks');

-- =============================================
-- 2. USERS & EMPLOYEES
-- =============================================
-- Password: "password123" (plain text for testing)
INSERT INTO `users` (`id`, `username`, `password_hash`, `email`, `role_id`, `status`) VALUES
(1, 'admin', 'password123', 'admin@restaurant.com', 1, 'active'),
(2, 'manager1', 'password123', 'manager@restaurant.com', 2, 'active'),
(3, 'waiter1', 'password123', 'waiter1@restaurant.com', 3, 'active'),
(4, 'waiter2', 'password123', 'waiter2@restaurant.com', 3, 'active'),
(5, 'cashier1', 'password123', 'cashier@restaurant.com', 4, 'active'),
(6, 'chef1', 'password123', 'chef@restaurant.com', 5, 'active'),
(7, 'bartender1', 'password123', 'bar@restaurant.com', 6, 'active');

INSERT INTO `employees` (`id`, `user_id`, `employee_code`, `full_name`, `phone`, `email`, `hire_date`, `status`) VALUES
(1, 1, 'EMP001', 'John Admin', '0901234567', 'admin@restaurant.com', '2024-01-01', 'active'),
(2, 2, 'EMP002', 'Jane Manager', '0901234568', 'manager@restaurant.com', '2024-01-15', 'active'),
(3, 3, 'EMP003', 'Alice Waiter', '0901234569', 'waiter1@restaurant.com', '2024-02-01', 'active'),
(4, 4, 'EMP004', 'Bob Waiter', '0901234570', 'waiter2@restaurant.com', '2024-02-15', 'active'),
(5, 5, 'EMP005', 'Charlie Cashier', '0901234571', 'cashier@restaurant.com', '2024-03-01', 'active'),
(6, 6, 'EMP006', 'David Chef', '0901234572', 'chef@restaurant.com', '2024-01-10', 'active'),
(7, 7, 'EMP007', 'Eva Bartender', '0901234573', 'bar@restaurant.com', '2024-02-20', 'active');

-- =============================================
-- 3. MENU CATEGORIES
-- =============================================
INSERT INTO `menu_categories` (`id`, `name`, `description`, `sort_order`, `active`) VALUES
(1, 'Appetizers', 'Starters and appetizers', 1, TRUE),
(2, 'Main Course', 'Main dishes', 2, TRUE),
(3, 'Desserts', 'Sweet endings', 3, TRUE),
(4, 'Beverages', 'Drinks and beverages', 4, TRUE),
(5, 'Salads', 'Fresh salads', 5, TRUE),
(6, 'Soups', 'Hot soups', 6, TRUE);

-- =============================================
-- 4. MENU ITEMS
-- =============================================
INSERT INTO `menu_items` (`id`, `category_id`, `name`, `description`, `base_price`, `cost`, `available`) VALUES
-- Appetizers
(1, 1, 'Spring Rolls', 'Fresh Vietnamese spring rolls with shrimp', 8.50, 3.20, TRUE),
(2, 1, 'Chicken Wings', 'Buffalo style chicken wings', 12.00, 5.50, TRUE),
(3, 1, 'Garlic Bread', 'Toasted bread with garlic butter', 6.50, 2.00, TRUE),
(4, 1, 'Calamari', 'Fried calamari with marinara sauce', 14.00, 6.00, TRUE),

-- Main Course
(5, 2, 'Grilled Salmon', 'Atlantic salmon with lemon butter', 28.50, 12.00, TRUE),
(6, 2, 'Ribeye Steak', '12oz ribeye with garlic mashed potatoes', 42.00, 18.50, TRUE),
(7, 2, 'Chicken Parmesan', 'Breaded chicken with marinara and cheese', 22.00, 9.50, TRUE),
(8, 2, 'Pad Thai', 'Thai stir-fried rice noodles', 18.50, 7.00, TRUE),
(9, 2, 'Margherita Pizza', 'Classic tomato, mozzarella, basil', 16.00, 5.50, TRUE),
(10, 2, 'Beef Burger', 'Angus beef burger with fries', 19.50, 8.00, TRUE),

-- Salads
(11, 5, 'Caesar Salad', 'Romaine lettuce with Caesar dressing', 12.50, 4.50, TRUE),
(12, 5, 'Greek Salad', 'Mixed greens with feta cheese', 13.50, 5.00, TRUE),

-- Soups
(13, 6, 'Tom Yum Soup', 'Spicy Thai soup with shrimp', 11.00, 4.50, TRUE),
(14, 6, 'Mushroom Soup', 'Creamy mushroom soup', 9.50, 3.50, TRUE),

-- Desserts
(15, 3, 'Chocolate Lava Cake', 'Warm chocolate cake with vanilla ice cream', 10.50, 3.50, TRUE),
(16, 3, 'Tiramisu', 'Classic Italian tiramisu', 9.50, 3.20, TRUE),
(17, 3, 'Cheesecake', 'New York style cheesecake', 8.50, 3.00, TRUE),

-- Beverages
(18, 4, 'Coca Cola', 'Soft drink', 3.50, 0.80, TRUE),
(19, 4, 'Fresh Orange Juice', 'Freshly squeezed orange juice', 6.50, 2.50, TRUE),
(20, 4, 'Vietnamese Coffee', 'Traditional Vietnamese iced coffee', 5.50, 1.80, TRUE),
(21, 4, 'House Wine (Glass)', 'Red or white wine', 8.00, 3.00, TRUE),
(22, 4, 'Beer (Local)', 'Local draft beer', 5.50, 2.00, TRUE);

-- =============================================
-- 5. MODIFIERS
-- =============================================
INSERT INTO `modifiers` (`id`, `name`, `type`, `price_adjustment`, `active`) VALUES
-- Extras/Toppings
(1, 'Extra Sauce', 'extra', 2.50, TRUE),
(2, 'Add Mushrooms', 'topping', 4.00, TRUE),
(3, 'Add Shrimp', 'topping', 8.00, TRUE),
(4, 'Extra Cheese', 'topping', 2.00, TRUE),
(5, 'Add Bacon', 'topping', 3.50, TRUE),
(6, 'Add Avocado', 'topping', 3.00, TRUE),
(7, 'Add Pepperoni', 'topping', 4.00, TRUE),
(8, 'Extra Shot', 'extra', 1.50, TRUE),
(9, 'Coconut Milk', 'option', 1.00, TRUE);

-- Link modifiers to menu items
INSERT INTO `menu_item_modifiers` (`menu_item_id`, `modifier_id`) VALUES
-- Ribeye Steak modifiers
(6, 1), (6, 2), (6, 3),
-- Burger modifiers  
(10, 4), (10, 5), (10, 6),
-- Pizza modifiers
(9, 4), (9, 7), (9, 2),
-- Coffee modifiers
(20, 8), (20, 9);

-- =============================================
-- 6. FLOORS & TABLES
-- =============================================
-- Create floors first
INSERT INTO `floors` (`id`, `name`, `description`, `sort_order`, `active`) VALUES
(1, 'Main Hall', 'Main dining area', 1, TRUE),
(2, 'Terrace', 'Outdoor terrace', 2, TRUE),
(3, 'VIP Room', 'VIP private dining', 3, TRUE),
(4, 'Bar Area', 'Bar and lounge', 4, TRUE);

-- Create tables
INSERT INTO `tables` (`id`, `floor_id`, `table_number`, `seats`, `status`, `qr_code_token`) VALUES
-- Main Hall tables
(1, 1, 'T01', 4, 'available', 'TBL001-QR-2024'),
(2, 1, 'T02', 4, 'available', 'TBL002-QR-2024'),
(3, 1, 'T03', 2, 'available', 'TBL003-QR-2024'),
(4, 1, 'T04', 6, 'available', 'TBL004-QR-2024'),
(5, 1, 'T05', 4, 'available', 'TBL005-QR-2024'),

-- Terrace tables
(6, 2, 'T06', 2, 'available', 'TBL006-QR-2024'),
(7, 2, 'T07', 4, 'available', 'TBL007-QR-2024'),
(8, 2, 'T08', 6, 'available', 'TBL008-QR-2024'),

-- VIP Room tables
(9, 3, 'VIP01', 8, 'available', 'TBL009-QR-2024'),
(10, 3, 'VIP02', 10, 'available', 'TBL010-QR-2024'),

-- Bar Area tables
(11, 4, 'BAR01', 2, 'available', 'BAR001-QR-2024'),
(12, 4, 'BAR02', 2, 'available', 'BAR002-QR-2024');

-- =============================================
-- 7. PAYMENT METHODS
-- =============================================
INSERT INTO `payment_methods` (`id`, `name`, `type`, `active`) VALUES
(1, 'Cash', 'cash', TRUE),
(2, 'Credit Card', 'card', TRUE),
(3, 'Debit Card', 'card', TRUE),
(4, 'MoMo', 'e_wallet', TRUE),
(5, 'ZaloPay', 'e_wallet', TRUE),
(6, 'Bank Transfer', 'bank_transfer', TRUE);

-- =============================================
-- 8. INVENTORY (skip - tables not created yet)
-- =============================================
-- Uncomment when inventory tables are created in schema

-- =============================================
-- 9. SAMPLE ORDER (for testing)
-- =============================================
-- Create a sample order
INSERT INTO `orders` (`id`, `table_id`, `order_number`, `employee_id`, `source`, `fulfillment_type`, `status`, `subtotal`, `tax`, `total`, `opened_at`) VALUES
(1, 1, 'ORD-20241124-0001', 3, 'pos', 'dine_in', 'open', 0.00, 0.00, 0.00, '2024-11-24 10:30:00');

-- Add order lines
INSERT INTO `order_lines` (`order_id`, `menu_item_id`, `menu_item_name`, `quantity`, `unit_price`, `line_total`, `note`) VALUES
(1, 2, 'Chicken Wings', 2, 12.00, 24.00, NULL),
(1, 10, 'Beef Burger', 2, 19.50, 39.00, 'Medium rare'),
(1, 19, 'Fresh Orange Juice', 4, 6.50, 26.00, NULL);

-- Update order totals (normally done by trigger)
UPDATE `orders` SET 
  `subtotal` = (SELECT SUM(line_total) FROM `order_lines` WHERE `order_id` = 1),
  `tax` = (SELECT SUM(line_total) FROM `order_lines` WHERE `order_id` = 1) * 0.10,
  `total` = (SELECT SUM(line_total) FROM `order_lines` WHERE `order_id` = 1) * 1.10
WHERE `id` = 1;

-- Update table status
UPDATE `tables` SET `status` = 'occupied' WHERE `id` = 1;

-- =============================================
-- 10. KITCHEN AREAS (skip - table not created yet)
-- =============================================
-- Uncomment when kitchen_areas table is created in schema

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- =============================================
-- VERIFICATION QUERIES (Optional - Run to verify)
-- =============================================
-- SELECT COUNT(*) as total_users FROM users;
-- SELECT COUNT(*) as total_menu_items FROM menu_items;
-- SELECT COUNT(*) as total_tables FROM tables;
-- SELECT * FROM orders WHERE id = 1;
-- SELECT ol.*, mi.name FROM order_lines ol JOIN menu_items mi ON ol.menu_item_id = mi.id WHERE ol.order_id = 1;

-- =============================================
-- END OF SEED DATA
-- =============================================
