CREATE TABLE `locations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`name` text NOT NULL,
	`address` text,
	`slug` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `locations_company_idx` ON `locations` (`company_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `locations_company_slug_idx` ON `locations` (`company_id`,`slug`);--> statement-breakpoint
CREATE TABLE `service_locations` (
	`service_id` integer NOT NULL,
	`location_id` integer NOT NULL,
	`company_id` integer NOT NULL,
	PRIMARY KEY(`service_id`, `location_id`),
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `service_locations_company_idx` ON `service_locations` (`company_id`);--> statement-breakpoint
CREATE TABLE `tenant_billings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`period_start` integer NOT NULL,
	`period_end` integer NOT NULL,
	`amount_qtz` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`recurrente_invoice_id` text,
	`paid_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tenant_billings_company_idx` ON `tenant_billings` (`company_id`);--> statement-breakpoint
CREATE INDEX `tenant_billings_status_idx` ON `tenant_billings` (`company_id`,`status`);--> statement-breakpoint
ALTER TABLE `appointments` ADD `public_token` text;--> statement-breakpoint
ALTER TABLE `appointments` ADD `location_id` integer REFERENCES locations(id);--> statement-breakpoint
ALTER TABLE `blocked_slots` ADD `location_id` integer REFERENCES locations(id);--> statement-breakpoint
ALTER TABLE `companies` ADD `billing_day` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `companies` ADD `recurrente_api_key_enc` text;--> statement-breakpoint
ALTER TABLE `companies` ADD `recurrente_webhook_secret_enc` text;--> statement-breakpoint
ALTER TABLE `payments` ADD `appointment_id` integer REFERENCES appointments(id);--> statement-breakpoint
CREATE INDEX `payments_appointment_idx` ON `payments` (`appointment_id`);--> statement-breakpoint
ALTER TABLE `saas_plans` ADD `monthly_appointments` integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE `services` ADD `is_default` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `services` ADD `requires_deposit` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `services` ADD `deposit_amount_qtz` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `services` ADD `deposit_percentage` integer;--> statement-breakpoint
ALTER TABLE `services` ADD `auto_confirm_on_payment` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `working_hours` ADD `location_id` integer REFERENCES locations(id);