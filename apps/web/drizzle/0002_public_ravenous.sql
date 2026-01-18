CREATE INDEX "i_dns_domain_expires" ON "dns_records" USING btree ("domain_id","expires_at");--> statement-breakpoint
CREATE INDEX "i_http_headers_expires" ON "http_headers" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "i_providers_category_domain" ON "providers" USING btree ("category","domain");