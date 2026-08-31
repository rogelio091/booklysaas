CREATE TABLE `staff_locations` (
	`user_id` integer NOT NULL,
	`location_id` integer NOT NULL,
	`company_id` integer NOT NULL,
	PRIMARY KEY(`user_id`, `location_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `staff_locations_company_idx` ON `staff_locations` (`company_id`);--> statement-breakpoint
ALTER TABLE `locations` ADD `type` text DEFAULT 'fixed' NOT NULL;--> statement-breakpoint
ALTER TABLE `locations` ADD `service_radius_km` integer;--> statement-breakpoint
ALTER TABLE `saas_plans` ADD `max_locations` integer DEFAULT 1 NOT NULL;