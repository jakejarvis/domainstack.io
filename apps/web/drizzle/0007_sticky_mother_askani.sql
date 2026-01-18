DROP INDEX "i_certs_valid_to";--> statement-breakpoint
DROP INDEX "i_hosting_providers";--> statement-breakpoint
DROP INDEX "i_notifications_tracked_domain";--> statement-breakpoint
DROP INDEX "i_seo_src_final_url";--> statement-breakpoint
DROP INDEX "i_seo_canonical";--> statement-breakpoint
CREATE INDEX "i_certs_ca_provider" ON "certificates" USING btree ("ca_provider_id");--> statement-breakpoint
CREATE INDEX "i_hosting_provider" ON "hosting" USING btree ("hosting_provider_id");--> statement-breakpoint
CREATE INDEX "i_hosting_email_provider" ON "hosting" USING btree ("email_provider_id");--> statement-breakpoint
CREATE INDEX "i_hosting_dns_provider" ON "hosting" USING btree ("dns_provider_id");