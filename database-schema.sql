-- =============================================
-- Restaurant Management System - MySQL/MariaDB Database Schema
-- Version: 1.0.0
-- Description: Complete database schema for restaurant POS, kitchen, inventory, and reporting
-- Compatible with: MariaDB 10.4+, MySQL 5.7+, phpMyAdmin
-- Tested on: MariaDB 10.4.32-MariaDB, PHP 8.0.30, phpMyAdmin 5.2.1
-- =============================================

-- Set default charset and collation
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';

-- Create database
CREATE DATABASE IF NOT EXISTS `restaurant_pos` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `restaurant_pos`;

-- =============================================
-- 1. USER & EMPLOYEE MANAGEMENT
-- =============================================

-- Roles table
CREATE TABLE `roles` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(50) UNIQUE NOT NULL,
    `display_name` VARCHAR(100) NOT NULL,
    `permissions` JSON NOT NULL,
    `description` TEXT,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_roles_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Users table
CREATE TABLE `users` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `username` VARCHAR(100) UNIQUE NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) UNIQUE,
    `role_id` INT NOT NULL,
    `status` ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
    `last_login` TIMESTAMP NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_users_username` (`username`),
    INDEX `idx_users_role_id` (`role_id`),
    FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Employees table
CREATE TABLE `employees` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT UNIQUE,
    `employee_code` VARCHAR(50) UNIQUE NOT NULL,
    `full_name` VARCHAR(255) NOT NULL,
    `phone` VARCHAR(20),
    `email` VARCHAR(255),
    `address` TEXT,
    `hire_date` DATE NOT NULL,
    `status` ENUM('active', 'on_leave', 'terminated') DEFAULT 'active',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_employees_user_id` (`user_id`),
    INDEX `idx_employees_status` (`status`),
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Shifts table
CREATE TABLE `shifts` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `employee_id` INT NOT NULL,
    `shift_date` DATE NOT NULL,
    `start_time` TIMESTAMP NOT NULL,
    `end_time` TIMESTAMP NULL,
    `cash_start` DECIMAL(12, 2),
    `cash_end` DECIMAL(12, 2),
    `status` ENUM('open', 'closed', 'reconciled') DEFAULT 'open',
    `notes` TEXT,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_shifts_employee_date` (`employee_id`, `shift_date`),
    FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 2. MENU MANAGEMENT
-- =============================================

-- Menu categories
CREATE TABLE `menu_categories` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT,
    `sort_order` INT DEFAULT 0,
    `active` BOOLEAN DEFAULT TRUE,
    `image_url` VARCHAR(500),
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_menu_categories_active` (`active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Menu items
CREATE TABLE `menu_items` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `category_id` INT,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT,
    `image_url` VARCHAR(500),
    `base_price` DECIMAL(12, 2) NOT NULL,
    `cost` DECIMAL(12, 2),
    `unit` VARCHAR(50) DEFAULT 'piece',
    `active` BOOLEAN DEFAULT TRUE,
    `available` BOOLEAN DEFAULT TRUE,
    `sort_order` INT DEFAULT 0,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_menu_items_category` (`category_id`),
    INDEX `idx_menu_items_active` (`active`),
    FOREIGN KEY (`category_id`) REFERENCES `menu_categories`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Modifiers (size, topping, extra, etc.)
CREATE TABLE `modifiers` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `type` ENUM('size', 'topping', 'extra', 'option') NOT NULL,
    `price_adjustment` DECIMAL(12, 2) DEFAULT 0,
    `active` BOOLEAN DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Menu item modifiers (many-to-many)
CREATE TABLE `menu_item_modifiers` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `menu_item_id` INT NOT NULL,
    `modifier_id` INT NOT NULL,
    `is_default` BOOLEAN DEFAULT FALSE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `unique_item_modifier` (`menu_item_id`, `modifier_id`),
    INDEX `idx_menu_item_modifiers_item` (`menu_item_id`),
    FOREIGN KEY (`menu_item_id`) REFERENCES `menu_items`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`modifier_id`) REFERENCES `modifiers`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Menu versions (audit trail for menu changes)
CREATE TABLE `menu_versions` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `version_number` INT NOT NULL,
    `changed_by` INT,
    `changes` JSON NOT NULL,
    `description` TEXT,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 3. FLOOR PLAN & TABLE MANAGEMENT
-- =============================================

-- Floors
CREATE TABLE `floors` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT,
    `layout` JSON,
    `sort_order` INT DEFAULT 0,
    `active` BOOLEAN DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tables
CREATE TABLE `tables` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `floor_id` INT NOT NULL,
    `table_number` VARCHAR(50) NOT NULL,
    `seats` INT NOT NULL DEFAULT 4,
    `qr_code_token` VARCHAR(255) UNIQUE NOT NULL,
    `qr_code_url` VARCHAR(500),
    `status` ENUM('available', 'occupied', 'reserved', 'needs_cleaning') DEFAULT 'available',
    `position_x` DECIMAL(10, 2),
    `position_y` DECIMAL(10, 2),
    `shape` VARCHAR(50) DEFAULT 'rectangle',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `unique_floor_table` (`floor_id`, `table_number`),
    INDEX `idx_tables_floor` (`floor_id`),
    INDEX `idx_tables_status` (`status`),
    INDEX `idx_tables_qr_token` (`qr_code_token`),
    FOREIGN KEY (`floor_id`) REFERENCES `floors`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table merges (track merged tables)
CREATE TABLE `table_merges` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `merge_group_id` VARCHAR(36) NOT NULL,
    `table_id` INT NOT NULL,
    `created_by` INT,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `dissolved_at` TIMESTAMP NULL,
    FOREIGN KEY (`table_id`) REFERENCES `tables`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`created_by`) REFERENCES `employees`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 4. CUSTOMERS & LOYALTY
-- =============================================

-- Customers
CREATE TABLE `customers` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `full_name` VARCHAR(255),
    `phone` VARCHAR(20) UNIQUE,
    `email` VARCHAR(255) UNIQUE,
    `address` TEXT,
    `date_of_birth` DATE,
    `loyalty_points` INT DEFAULT 0,
    `tier` ENUM('bronze', 'silver', 'gold', 'platinum') DEFAULT 'bronze',
    `notes` TEXT,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Loyalty transactions
CREATE TABLE `loyalty_transactions` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `customer_id` INT NOT NULL,
    `points` INT NOT NULL,
    `type` ENUM('earn', 'redeem', 'expire', 'adjustment') NOT NULL,
    `reference_order_id` INT,
    `description` TEXT,
    `created_by` INT,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`created_by`) REFERENCES `employees`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 5. RESERVATIONS
-- =============================================

-- Reservations
CREATE TABLE `reservations` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `customer_id` INT,
    `customer_name` VARCHAR(255) NOT NULL,
    `customer_phone` VARCHAR(20) NOT NULL,
    `customer_email` VARCHAR(255),
    `table_id` INT,
    `reservation_time` TIMESTAMP NOT NULL,
    `pax` INT NOT NULL,
    `status` ENUM('pending', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show') DEFAULT 'pending',
    `special_requests` TEXT,
    `notes` TEXT,
    `created_by` INT,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE SET NULL,
    FOREIGN KEY (`table_id`) REFERENCES `tables`(`id`) ON DELETE SET NULL,
    FOREIGN KEY (`created_by`) REFERENCES `employees`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 6. ORDERS
-- =============================================

-- Orders
CREATE TABLE `orders` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `order_number` VARCHAR(50) UNIQUE NOT NULL,
    `table_id` INT,
    `customer_id` INT,
    `reservation_id` INT,
    `employee_id` INT NOT NULL,
    `source` ENUM('pos', 'kiosk', 'qr_table', 'online', 'delivery') DEFAULT 'pos',
    `fulfillment_type` ENUM('dine_in', 'takeaway', 'delivery') DEFAULT 'dine_in',
    `status` ENUM('open', 'sent_to_kitchen', 'ready', 'paid', 'cancelled', 'refunded') DEFAULT 'open',
    `subtotal` DECIMAL(12, 2) DEFAULT 0,
    `tax` DECIMAL(12, 2) DEFAULT 0,
    `discount` DECIMAL(12, 2) DEFAULT 0,
    `service_charge` DECIMAL(12, 2) DEFAULT 0,
    `total` DECIMAL(12, 2) DEFAULT 0,
    `opened_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `sent_to_kitchen_at` TIMESTAMP NULL,
    `ready_at` TIMESTAMP NULL,
    `paid_at` TIMESTAMP NULL,
    `closed_at` TIMESTAMP NULL,
    `notes` TEXT,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_orders_number` (`order_number`),
    INDEX `idx_orders_table` (`table_id`),
    INDEX `idx_orders_customer` (`customer_id`),
    INDEX `idx_orders_employee` (`employee_id`),
    INDEX `idx_orders_status` (`status`),
    INDEX `idx_orders_source` (`source`),
    INDEX `idx_orders_opened_at` (`opened_at`),
    INDEX `idx_orders_paid_at` (`paid_at`),
    FOREIGN KEY (`table_id`) REFERENCES `tables`(`id`) ON DELETE SET NULL,
    FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE SET NULL,
    FOREIGN KEY (`reservation_id`) REFERENCES `reservations`(`id`) ON DELETE SET NULL,
    FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Order lines
CREATE TABLE `order_lines` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `order_id` INT NOT NULL,
    `menu_item_id` INT,
    `menu_item_name` VARCHAR(255) NOT NULL,
    `quantity` DECIMAL(10, 2) NOT NULL DEFAULT 1,
    `unit_price` DECIMAL(12, 2) NOT NULL,
    `modifiers` JSON,
    `note` TEXT,
    `kitchen_area_id` INT,
    `kitchen_status` ENUM('pending', 'cooking', 'ready', 'served', 'cancelled') DEFAULT 'pending',
    `line_total` DECIMAL(12, 2) NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_order_lines_order` (`order_id`),
    INDEX `idx_order_lines_menu_item` (`menu_item_id`),
    INDEX `idx_order_lines_kitchen_status` (`kitchen_status`),
    FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`menu_item_id`) REFERENCES `menu_items`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Order notes (additional notes for order)
CREATE TABLE `order_notes` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `order_id` INT NOT NULL,
    `note` TEXT NOT NULL,
    `created_by` INT,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`created_by`) REFERENCES `employees`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Order splits (for split bill tracking)
CREATE TABLE `order_splits` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `parent_order_id` INT NOT NULL,
    `split_number` INT NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `paid` BOOLEAN DEFAULT FALSE,
    `paid_at` TIMESTAMP NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `unique_order_split` (`parent_order_id`, `split_number`),
    FOREIGN KEY (`parent_order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 7. KITCHEN MANAGEMENT
-- =============================================

-- Kitchen areas
CREATE TABLE `kitchen_areas` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT,
    `printer_config` JSON,
    `active` BOOLEAN DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Kitchen queue
CREATE TABLE `kitchen_queue` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `order_id` INT NOT NULL,
    `order_line_id` INT NOT NULL,
    `area_id` INT NOT NULL,
    `status` ENUM('pending', 'in_progress', 'ready', 'served', 'cancelled') DEFAULT 'pending',
    `priority` INT DEFAULT 0,
    `received_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `started_at` TIMESTAMP NULL,
    `completed_at` TIMESTAMP NULL,
    `served_at` TIMESTAMP NULL,
    `assigned_to` INT,
    `notes` TEXT,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_kitchen_queue_order` (`order_id`),
    INDEX `idx_kitchen_queue_area` (`area_id`),
    INDEX `idx_kitchen_queue_status` (`status`),
    INDEX `idx_kitchen_queue_received` (`received_at`),
    FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`order_line_id`) REFERENCES `order_lines`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`area_id`) REFERENCES `kitchen_areas`(`id`),
    FOREIGN KEY (`assigned_to`) REFERENCES `employees`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 8. PAYMENT
-- =============================================

-- Payment methods
CREATE TABLE `payment_methods` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `type` ENUM('cash', 'card', 'qr', 'wallet', 'voucher', 'other') NOT NULL,
    `config` JSON,
    `active` BOOLEAN DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Payments
CREATE TABLE `payments` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `payment_number` VARCHAR(50) UNIQUE NOT NULL,
    `order_id` INT NOT NULL,
    `payment_method_id` INT NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `txn_id` VARCHAR(255),
    `gateway_response` JSON,
    `status` ENUM('pending', 'processing', 'success', 'failed', 'refunded') DEFAULT 'pending',
    `processed_by` INT,
    `processed_at` TIMESTAMP NULL,
    `refunded_at` TIMESTAMP NULL,
    `notes` TEXT,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_payments_order` (`order_id`),
    INDEX `idx_payments_status` (`status`),
    INDEX `idx_payments_processed_at` (`processed_at`),
    FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT,
    FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods`(`id`),
    FOREIGN KEY (`processed_by`) REFERENCES `employees`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Refunds
CREATE TABLE `refunds` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `refund_number` VARCHAR(50) UNIQUE NOT NULL,
    `payment_id` INT NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `reason` TEXT NOT NULL,
    `approved_by` INT,
    `status` ENUM('pending', 'approved', 'rejected', 'completed') DEFAULT 'pending',
    `gateway_response` JSON,
    `created_by` INT,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `processed_at` TIMESTAMP NULL,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_refunds_payment` (`payment_id`),
    FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON DELETE RESTRICT,
    FOREIGN KEY (`approved_by`) REFERENCES `employees`(`id`),
    FOREIGN KEY (`created_by`) REFERENCES `employees`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 9. INVENTORY MANAGEMENT
-- =============================================

-- Inventory items
CREATE TABLE `inventory_items` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `item_code` VARCHAR(50) UNIQUE NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `category` VARCHAR(100),
    `unit` VARCHAR(50) NOT NULL,
    `qty` DECIMAL(12, 3) DEFAULT 0,
    `min_qty` DECIMAL(12, 3) DEFAULT 0,
    `max_qty` DECIMAL(12, 3),
    `cost_per_unit` DECIMAL(12, 2),
    `supplier` VARCHAR(255),
    `last_restocked_at` TIMESTAMP NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_inventory_items_code` (`item_code`),
    INDEX `idx_inventory_items_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bill of Materials (Recipe)
CREATE TABLE `bom` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `menu_item_id` INT NOT NULL,
    `inventory_item_id` INT NOT NULL,
    `qty_required` DECIMAL(12, 3) NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `unique_menu_inventory` (`menu_item_id`, `inventory_item_id`),
    INDEX `idx_bom_menu_item` (`menu_item_id`),
    INDEX `idx_bom_inventory_item` (`inventory_item_id`),
    FOREIGN KEY (`menu_item_id`) REFERENCES `menu_items`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_items`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Stock movements
CREATE TABLE `stock_movements` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `inventory_item_id` INT NOT NULL,
    `type` ENUM('in', 'out', 'adjustment', 'waste', 'transfer') NOT NULL,
    `qty` DECIMAL(12, 3) NOT NULL,
    `reference_type` VARCHAR(50),
    `reference_id` INT,
    `cost_per_unit` DECIMAL(12, 2),
    `total_cost` DECIMAL(12, 2),
    `reason` TEXT,
    `performed_by` INT,
    `timestamp` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_stock_movements_inventory` (`inventory_item_id`),
    INDEX `idx_stock_movements_timestamp` (`timestamp`),
    FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_items`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`performed_by`) REFERENCES `employees`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Stock alerts
CREATE TABLE `stock_alerts` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `inventory_item_id` INT NOT NULL,
    `alert_type` ENUM('low', 'out', 'expiring') NOT NULL,
    `status` ENUM('open', 'acknowledged', 'resolved') DEFAULT 'open',
    `acknowledged_by` INT,
    `acknowledged_at` TIMESTAMP NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `resolved_at` TIMESTAMP NULL,
    FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_items`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`acknowledged_by`) REFERENCES `employees`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 10. SYNC & OFFLINE SUPPORT
-- =============================================

-- Sync queue (for offline POS sync)
CREATE TABLE `sync_queue` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `device_id` VARCHAR(255) NOT NULL,
    `entity_type` VARCHAR(100) NOT NULL,
    `entity_id` VARCHAR(100),
    `operation` ENUM('create', 'update', 'delete') NOT NULL,
    `data` JSON NOT NULL,
    `idempotency_key` VARCHAR(255) UNIQUE,
    `status` ENUM('pending', 'processing', 'completed', 'failed', 'conflict') DEFAULT 'pending',
    `conflict_reason` TEXT,
    `retry_count` INT DEFAULT 0,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `processed_at` TIMESTAMP NULL,
    INDEX `idx_sync_queue_device` (`device_id`),
    INDEX `idx_sync_queue_status` (`status`),
    INDEX `idx_sync_queue_idempotency` (`idempotency_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 11. AUDIT & LOGS
-- =============================================

-- Audit logs
CREATE TABLE `audit_logs` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT,
    `employee_id` INT,
    `entity_type` VARCHAR(100) NOT NULL,
    `entity_id` INT,
    `action` VARCHAR(50) NOT NULL,
    `old_value` JSON,
    `new_value` JSON,
    `ip_address` VARCHAR(50),
    `user_agent` TEXT,
    `timestamp` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_audit_logs_user` (`user_id`),
    INDEX `idx_audit_logs_entity` (`entity_type`, `entity_id`),
    INDEX `idx_audit_logs_timestamp` (`timestamp`),
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
    FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- System logs
CREATE TABLE `system_logs` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `level` ENUM('info', 'warning', 'error', 'critical') NOT NULL,
    `message` TEXT NOT NULL,
    `context` JSON,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 12. TRIGGERS & STORED PROCEDURES
-- =============================================

-- Note: MySQL triggers are created separately for each table
-- The following triggers replace PostgreSQL's single update_timestamp function

DELIMITER $$

-- Trigger for calculating order totals when order lines change
CREATE TRIGGER `trg_order_lines_after_insert`
AFTER INSERT ON `order_lines`
FOR EACH ROW
BEGIN
    DECLARE v_subtotal DECIMAL(12, 2);
    
    SELECT COALESCE(SUM(line_total), 0) INTO v_subtotal
    FROM order_lines
    WHERE order_id = NEW.order_id;
    
    UPDATE orders
    SET subtotal = v_subtotal,
        total = v_subtotal + tax - discount + service_charge,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.order_id;
END$$

CREATE TRIGGER `trg_order_lines_after_update`
AFTER UPDATE ON `order_lines`
FOR EACH ROW
BEGIN
    DECLARE v_subtotal DECIMAL(12, 2);
    
    SELECT COALESCE(SUM(line_total), 0) INTO v_subtotal
    FROM order_lines
    WHERE order_id = NEW.order_id;
    
    UPDATE orders
    SET subtotal = v_subtotal,
        total = v_subtotal + tax - discount + service_charge,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.order_id;
END$$

CREATE TRIGGER `trg_order_lines_after_delete`
AFTER DELETE ON `order_lines`
FOR EACH ROW
BEGIN
    DECLARE v_subtotal DECIMAL(12, 2);
    
    SELECT COALESCE(SUM(line_total), 0) INTO v_subtotal
    FROM order_lines
    WHERE order_id = OLD.order_id;
    
    UPDATE orders
    SET subtotal = v_subtotal,
        total = v_subtotal + tax - discount + service_charge,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = OLD.order_id;
END$$

-- Trigger for inventory deduction on payment success
CREATE TRIGGER `trg_payments_after_insert`
AFTER INSERT ON `payments`
FOR EACH ROW
BEGIN
    IF NEW.status = 'success' THEN
        -- This will be handled by application logic or stored procedure
        -- MySQL doesn't support complex loops in triggers like PostgreSQL
        CALL sp_deduct_inventory(NEW.order_id, NEW.id, NEW.processed_by);
    END IF;
END$$

CREATE TRIGGER `trg_payments_after_update`
AFTER UPDATE ON `payments`
FOR EACH ROW
BEGIN
    IF NEW.status = 'success' AND (OLD.status IS NULL OR OLD.status != 'success') THEN
        CALL sp_deduct_inventory(NEW.order_id, NEW.id, NEW.processed_by);
    END IF;
END$$

-- Trigger for checking low stock
CREATE TRIGGER `trg_inventory_after_update`
AFTER UPDATE ON `inventory_items`
FOR EACH ROW
BEGIN
    IF NEW.qty <= NEW.min_qty THEN
        INSERT INTO stock_alerts (inventory_item_id, alert_type, status)
        VALUES (
            NEW.id, 
            CASE WHEN NEW.qty <= 0 THEN 'out' ELSE 'low' END,
            'open'
        )
        ON DUPLICATE KEY UPDATE alert_type = VALUES(alert_type);
    END IF;
END$$

DELIMITER ;

-- =============================================
-- 13. STORED PROCEDURES
-- =============================================

DELIMITER $$

-- Procedure to deduct inventory based on BOM
CREATE PROCEDURE `sp_deduct_inventory`(
    IN p_order_id INT,
    IN p_payment_id INT,
    IN p_employee_id INT
)
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE v_line_id INT;
    DECLARE v_menu_item_id INT;
    DECLARE v_quantity DECIMAL(10, 2);
    
    DECLARE v_bom_inventory_id INT;
    DECLARE v_bom_qty_required DECIMAL(12, 3);
    DECLARE v_qty_to_deduct DECIMAL(12, 3);
    
    DECLARE cur_lines CURSOR FOR
        SELECT id, menu_item_id, quantity
        FROM order_lines
        WHERE order_id = p_order_id;
    
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    
    OPEN cur_lines;
    
    read_loop: LOOP
        FETCH cur_lines INTO v_line_id, v_menu_item_id, v_quantity;
        IF done THEN
            LEAVE read_loop;
        END IF;
        
        -- Process BOM for this line
        BEGIN
            DECLARE done_bom INT DEFAULT FALSE;
            DECLARE cur_bom CURSOR FOR
                SELECT inventory_item_id, qty_required
                FROM bom
                WHERE menu_item_id = v_menu_item_id;
            
            DECLARE CONTINUE HANDLER FOR NOT FOUND SET done_bom = TRUE;
            
            OPEN cur_bom;
            
            bom_loop: LOOP
                FETCH cur_bom INTO v_bom_inventory_id, v_bom_qty_required;
                IF done_bom THEN
                    LEAVE bom_loop;
                END IF;
                
                SET v_qty_to_deduct = v_bom_qty_required * v_quantity;
                
                -- Deduct from inventory
                UPDATE inventory_items
                SET qty = qty - v_qty_to_deduct,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = v_bom_inventory_id;
                
                -- Record stock movement
                INSERT INTO stock_movements (
                    inventory_item_id, type, qty,
                    reference_type, reference_id,
                    performed_by, timestamp
                )
                VALUES (
                    v_bom_inventory_id, 'out', v_qty_to_deduct,
                    'payment', p_payment_id,
                    p_employee_id, CURRENT_TIMESTAMP
                );
            END LOOP;
            
            CLOSE cur_bom;
        END;
    END LOOP;
    
    CLOSE cur_lines;
END$$

-- Procedure to generate order number
CREATE PROCEDURE `sp_generate_order_number`(OUT p_order_number VARCHAR(50))
BEGIN
    DECLARE v_count INT;
    DECLARE v_date VARCHAR(8);
    
    SET v_date = DATE_FORMAT(CURRENT_DATE, '%Y%m%d');
    
    SELECT COUNT(*) INTO v_count
    FROM orders
    WHERE DATE(opened_at) = CURRENT_DATE;
    
    SET p_order_number = CONCAT('ORD-', v_date, '-', LPAD(v_count + 1, 4, '0'));
END$$

-- Procedure to generate payment number
CREATE PROCEDURE `sp_generate_payment_number`(OUT p_payment_number VARCHAR(50))
BEGIN
    DECLARE v_count INT;
    DECLARE v_date VARCHAR(8);
    
    SET v_date = DATE_FORMAT(CURRENT_DATE, '%Y%m%d');
    
    SELECT COUNT(*) INTO v_count
    FROM payments
    WHERE DATE(processed_at) = CURRENT_DATE;
    
    SET p_payment_number = CONCAT('PAY-', v_date, '-', LPAD(v_count + 1, 4, '0'));
END$$

DELIMITER ;

-- =============================================
-- 14. SEED DATA
-- =============================================

-- Insert default roles
INSERT INTO `roles` (`name`, `display_name`, `permissions`, `description`) VALUES
('admin', 'Administrator', '{"all": true}', 'Full system access'),
('manager', 'Manager', '{"menu": true, "reports": true, "inventory": true, "users": false}', 'Manager with reporting and inventory access'),
('cashier', 'Cashier', '{"pos": true, "payment": true}', 'POS and payment processing'),
('waiter', 'Waiter', '{"pos": true, "orders": true}', 'Order taking and management'),
('chef', 'Chef', '{"kitchen": true}', 'Kitchen order management');

-- Insert default payment methods
INSERT INTO `payment_methods` (`name`, `type`, `active`) VALUES
('Cash', 'cash', 1),
('Credit Card', 'card', 1),
('Debit Card', 'card', 1),
('QR Payment', 'qr', 1),
('E-Wallet', 'wallet', 1);

-- Insert default kitchen areas
INSERT INTO `kitchen_areas` (`name`, `description`, `active`) VALUES
('Main Kitchen', 'Main cooking area', 1),
('Bar', 'Drinks and beverages', 1),
('Grill', 'Grilled items', 1),
('Dessert', 'Desserts and sweets', 1);

-- =============================================
-- 15. VIEWS FOR REPORTING
-- =============================================

-- Sales summary view
DROP VIEW IF EXISTS `v_sales_summary`;
CREATE VIEW `v_sales_summary` AS
SELECT 
    DATE(o.paid_at) as sale_date,
    COUNT(DISTINCT o.id) as total_orders,
    SUM(o.subtotal) as total_subtotal,
    SUM(o.tax) as total_tax,
    SUM(o.discount) as total_discount,
    SUM(o.total) as total_sales,
    AVG(o.total) as avg_order_value
FROM orders o
WHERE o.status = 'paid'
GROUP BY DATE(o.paid_at);

-- Top selling items view
DROP VIEW IF EXISTS `v_top_selling_items`;
CREATE VIEW `v_top_selling_items` AS
SELECT 
    mi.id,
    mi.name,
    COUNT(ol.id) as times_ordered,
    SUM(ol.quantity) as total_quantity,
    SUM(ol.line_total) as total_revenue
FROM order_lines ol
JOIN menu_items mi ON ol.menu_item_id = mi.id
JOIN orders o ON ol.order_id = o.id
WHERE o.status = 'paid'
GROUP BY mi.id, mi.name
ORDER BY total_revenue DESC;

-- Low stock items view
DROP VIEW IF EXISTS `v_low_stock_items`;
CREATE VIEW `v_low_stock_items` AS
SELECT 
    ii.*,
    CASE 
        WHEN ii.qty <= 0 THEN 'out_of_stock'
        WHEN ii.qty <= ii.min_qty THEN 'low'
        ELSE 'ok'
    END as stock_status
FROM inventory_items ii
WHERE ii.qty <= ii.min_qty
ORDER BY ii.qty ASC;

-- Active orders view
DROP VIEW IF EXISTS `v_active_orders`;
CREATE VIEW `v_active_orders` AS
SELECT 
    o.id,
    o.order_number,
    t.table_number,
    f.name as floor_name,
    e.full_name as waiter_name,
    o.status,
    o.total,
    o.opened_at,
    COUNT(ol.id) as item_count
FROM orders o
LEFT JOIN tables t ON o.table_id = t.id
LEFT JOIN floors f ON t.floor_id = f.id
LEFT JOIN employees e ON o.employee_id = e.id
LEFT JOIN order_lines ol ON o.id = ol.order_id
WHERE o.status IN ('open', 'sent_to_kitchen', 'ready')
GROUP BY o.id, t.table_number, f.name, e.full_name, o.status, o.total, o.opened_at;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- =============================================
-- END OF SCHEMA
-- =============================================
