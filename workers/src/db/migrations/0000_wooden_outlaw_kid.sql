CREATE TABLE `appointment_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`appointment_id` integer NOT NULL,
	`service_id` integer NOT NULL,
	`service_name` text NOT NULL,
	`price_qtz` integer DEFAULT 0 NOT NULL,
	`duration_minutes` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `appointment_items_appointment_idx` ON `appointment_items` (`appointment_id`);--> statement-breakpoint
CREATE INDEX `appointment_items_company_idx` ON `appointment_items` (`company_id`);--> statement-breakpoint
CREATE TABLE `appointments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`customer_id` integer NOT NULL,
	`staff_id` integer,
	`status` text DEFAULT 'confirmed' NOT NULL,
	`start_at` integer NOT NULL,
	`end_at` integer NOT NULL,
	`buffer_minutes` integer DEFAULT 0 NOT NULL,
	`source` text DEFAULT 'public_portal' NOT NULL,
	`cancellation_reason` text,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`staff_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `appointments_staff_range_idx` ON `appointments` (`company_id`,`staff_id`,`start_at`,`end_at`);--> statement-breakpoint
CREATE INDEX `appointments_company_range_idx` ON `appointments` (`company_id`,`start_at`,`end_at`);--> statement-breakpoint
CREATE INDEX `appointments_status_idx` ON `appointments` (`company_id`,`status`);--> statement-breakpoint
CREATE TABLE `blocked_slots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`user_id` integer,
	`start_at` integer NOT NULL,
	`end_at` integer NOT NULL,
	`reason` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `blocked_slots_company_range_idx` ON `blocked_slots` (`company_id`,`start_at`,`end_at`);--> statement-breakpoint
CREATE INDEX `blocked_slots_user_range_idx` ON `blocked_slots` (`company_id`,`user_id`,`start_at`,`end_at`);--> statement-breakpoint
CREATE TABLE `companies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`plan_id` integer NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`email` text NOT NULL,
	`phone` text,
	`timezone` text DEFAULT 'America/Guatemala' NOT NULL,
	`currency` text DEFAULT 'GTQ' NOT NULL,
	`brand_color` text DEFAULT '#2563eb',
	`logo_url` text,
	`subscription_status` text DEFAULT 'trial' NOT NULL,
	`trial_ends_at` integer,
	`recurrente_subscription_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `saas_plans`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `companies_slug_idx` ON `companies` (`slug`);--> statement-breakpoint
CREATE TABLE `customers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`email` text,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `customers_company_phone_idx` ON `customers` (`company_id`,`phone`);--> statement-breakpoint
CREATE INDEX `customers_company_email_idx` ON `customers` (`company_id`,`email`);--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`customer_id` integer NOT NULL,
	`appointment_id` integer,
	`number` text NOT NULL,
	`subtotal_qtz` integer DEFAULT 0 NOT NULL,
	`tax_qtz` integer DEFAULT 0 NOT NULL,
	`total_qtz` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`due_at` integer,
	`paid_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_company_number_idx` ON `invoices` (`company_id`,`number`);--> statement-breakpoint
CREATE INDEX `invoices_appointment_idx` ON `invoices` (`appointment_id`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`invoice_id` integer,
	`gateway` text DEFAULT 'recurrente' NOT NULL,
	`gateway_payment_id` text,
	`amount_qtz` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`card_brand` text,
	`card_last_four` text,
	`raw_gateway_response` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `payments_company_idx` ON `payments` (`company_id`);--> statement-breakpoint
CREATE INDEX `payments_invoice_idx` ON `payments` (`invoice_id`);--> statement-breakpoint
CREATE TABLE `saas_plans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`monthly_price_qtz` integer NOT NULL,
	`max_staff` integer DEFAULT 1 NOT NULL,
	`features_json` text DEFAULT '{}' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `saas_plans_code_unique` ON `saas_plans` (`code`);--> statement-breakpoint
CREATE TABLE `services` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`duration_minutes` integer NOT NULL,
	`buffer_after_minutes` integer DEFAULT 0 NOT NULL,
	`price_qtz` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `services_company_idx` ON `services` (`company_id`);--> statement-breakpoint
CREATE INDEX `services_company_active_idx` ON `services` (`company_id`,`is_active`);--> statement-breakpoint
CREATE TABLE `staff_services` (
	`user_id` integer NOT NULL,
	`service_id` integer NOT NULL,
	`company_id` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `staff_services_pk` ON `staff_services` (`user_id`,`service_id`);--> statement-breakpoint
CREATE INDEX `staff_services_company_idx` ON `staff_services` (`company_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'staff' NOT NULL,
	`avatar_url` text,
	`phone` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_company_email_idx` ON `users` (`company_id`,`email`);--> statement-breakpoint
CREATE INDEX `users_company_idx` ON `users` (`company_id`);--> statement-breakpoint
CREATE TABLE `working_hours` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`user_id` integer,
	`day_of_week` integer NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`break_start_time` text,
	`break_end_time` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `working_hours_company_user_day_idx` ON `working_hours` (`company_id`,`user_id`,`day_of_week`);