import { and, desc, eq } from "drizzle-orm";
import z from "zod";
import { db } from "@/lib/db/client";
import {
  certificates,
  domainMonitorSettings,
  domainMonitors,
  domains,
  registrations,
} from "@/lib/db/schema";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";

export const monitoringRouter = createTRPCRouter({
  /**
   * Get all domains the current user is monitoring
   */
  getMonitoredDomains: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;

    const monitored = await db
      .select({
        monitorId: domainMonitors.id,
        domainId: domains.id,
        domainName: domains.name,
        unicodeName: domains.unicodeName,
        monitoredSince: domainMonitors.createdAt,
        // Registration data
        registrationExpiry: registrations.expirationDate,
        registrar: registrations.registry,
        // Certificate data (get the latest)
        certExpiry: certificates.validTo,
        certIssuer: certificates.issuer,
        // Settings
        notifyOnDomainExpiry: domainMonitorSettings.notifyOnDomainExpiry,
        notifyOnCertExpiry: domainMonitorSettings.notifyOnCertExpiry,
      })
      .from(domainMonitors)
      .innerJoin(domains, eq(domainMonitors.domainId, domains.id))
      .leftJoin(
        registrations,
        eq(domainMonitors.domainId, registrations.domainId),
      )
      .leftJoin(
        certificates,
        eq(domainMonitors.domainId, certificates.domainId),
      )
      .leftJoin(
        domainMonitorSettings,
        eq(domainMonitors.id, domainMonitorSettings.monitorId),
      )
      .where(eq(domainMonitors.userId, userId))
      .orderBy(desc(domainMonitors.createdAt));

    return monitored;
  }),

  /**
   * Toggle monitoring on/off for a domain
   */
  toggleDomainMonitoring: protectedProcedure
    .input(
      z.object({
        domainId: z.string().uuid(),
        enabled: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const { domainId, enabled } = input;

      if (enabled) {
        // Enable monitoring: create monitor + default settings
        // Use a transaction to ensure both are created
        await db.transaction(async (tx) => {
          // Insert or get existing monitor
          const [monitor] = await tx
            .insert(domainMonitors)
            .values({
              userId,
              domainId,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: [domainMonitors.userId, domainMonitors.domainId],
              set: {
                updatedAt: new Date(),
              },
            })
            .returning();

          if (!monitor) {
            throw new Error("Failed to create monitor");
          }

          // Insert default settings
          await tx
            .insert(domainMonitorSettings)
            .values({
              monitorId: monitor.id,
              notifyOnDomainExpiry: true,
              notifyOnCertExpiry: true,
              updatedAt: new Date(),
            })
            .onConflictDoNothing();
        });

        return { success: true, enabled: true };
      }

      // Disable monitoring: delete monitor (settings cascade)
      await db
        .delete(domainMonitors)
        .where(
          and(
            eq(domainMonitors.userId, userId),
            eq(domainMonitors.domainId, domainId),
          ),
        );

      return { success: true, enabled: false };
    }),

  /**
   * Update notification preferences for a monitored domain
   */
  updateMonitorSettings: protectedProcedure
    .input(
      z.object({
        domainId: z.string().uuid(),
        notifyOnDomainExpiry: z.boolean().optional(),
        notifyOnCertExpiry: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const { domainId, ...settings } = input;

      // Find the monitor for this user + domain
      const [monitor] = await db
        .select({ id: domainMonitors.id })
        .from(domainMonitors)
        .where(
          and(
            eq(domainMonitors.userId, userId),
            eq(domainMonitors.domainId, domainId),
          ),
        )
        .limit(1);

      if (!monitor) {
        throw new Error("Domain is not being monitored");
      }

      // Update settings
      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (settings.notifyOnDomainExpiry !== undefined) {
        updateData.notifyOnDomainExpiry = settings.notifyOnDomainExpiry;
      }

      if (settings.notifyOnCertExpiry !== undefined) {
        updateData.notifyOnCertExpiry = settings.notifyOnCertExpiry;
      }

      await db
        .update(domainMonitorSettings)
        .set(updateData)
        .where(eq(domainMonitorSettings.monitorId, monitor.id));

      return { success: true };
    }),

  /**
   * Get monitoring status for a specific domain (by name)
   */
  getMonitoringStatusByName: protectedProcedure
    .input(z.object({ domainName: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const { domainName } = input;

      // Find domain by name
      const [domainRecord] = await db
        .select({ id: domains.id })
        .from(domains)
        .where(eq(domains.name, domainName))
        .limit(1);

      if (!domainRecord) {
        // Domain doesn't exist yet
        return {
          isMonitored: false,
          domainId: null,
          notifyOnDomainExpiry: true,
          notifyOnCertExpiry: true,
        };
      }

      const [monitor] = await db
        .select({
          monitorId: domainMonitors.id,
          notifyOnDomainExpiry: domainMonitorSettings.notifyOnDomainExpiry,
          notifyOnCertExpiry: domainMonitorSettings.notifyOnCertExpiry,
        })
        .from(domainMonitors)
        .leftJoin(
          domainMonitorSettings,
          eq(domainMonitors.id, domainMonitorSettings.monitorId),
        )
        .where(
          and(
            eq(domainMonitors.userId, userId),
            eq(domainMonitors.domainId, domainRecord.id),
          ),
        )
        .limit(1);

      if (!monitor) {
        return {
          isMonitored: false,
          domainId: domainRecord.id,
          notifyOnDomainExpiry: true,
          notifyOnCertExpiry: true,
        };
      }

      return {
        isMonitored: true,
        domainId: domainRecord.id,
        notifyOnDomainExpiry: monitor.notifyOnDomainExpiry ?? true,
        notifyOnCertExpiry: monitor.notifyOnCertExpiry ?? true,
      };
    }),

  /**
   * Toggle monitoring for a domain by name (create domain if needed)
   */
  toggleDomainMonitoringByName: protectedProcedure
    .input(
      z.object({
        domainName: z.string(),
        enabled: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const { domainName, enabled } = input;

      // Import domain functions
      const { ensureDomainRecord } = await import("@/lib/db/repos/domains");

      // Ensure domain exists
      const domainRecord = await ensureDomainRecord(domainName);
      const domainId = domainRecord.id;

      if (enabled) {
        // Enable monitoring: create monitor + default settings
        await db.transaction(async (tx) => {
          const [monitor] = await tx
            .insert(domainMonitors)
            .values({
              userId,
              domainId,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: [domainMonitors.userId, domainMonitors.domainId],
              set: {
                updatedAt: new Date(),
              },
            })
            .returning();

          if (!monitor) {
            throw new Error("Failed to create monitor");
          }

          await tx
            .insert(domainMonitorSettings)
            .values({
              monitorId: monitor.id,
              notifyOnDomainExpiry: true,
              notifyOnCertExpiry: true,
              updatedAt: new Date(),
            })
            .onConflictDoNothing();
        });

        return { success: true, enabled: true, domainId };
      }

      // Disable monitoring: delete monitor (settings cascade)
      await db
        .delete(domainMonitors)
        .where(
          and(
            eq(domainMonitors.userId, userId),
            eq(domainMonitors.domainId, domainId),
          ),
        );

      return { success: true, enabled: false, domainId };
    }),

  /**
   * Update monitoring settings by domain name
   */
  updateMonitorSettingsByName: protectedProcedure
    .input(
      z.object({
        domainName: z.string(),
        notifyOnDomainExpiry: z.boolean().optional(),
        notifyOnCertExpiry: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const { domainName, ...settings } = input;

      // Find domain
      const [domainRecord] = await db
        .select({ id: domains.id })
        .from(domains)
        .where(eq(domains.name, domainName))
        .limit(1);

      if (!domainRecord) {
        throw new Error("Domain not found");
      }

      // Find the monitor for this user + domain
      const [monitor] = await db
        .select({ id: domainMonitors.id })
        .from(domainMonitors)
        .where(
          and(
            eq(domainMonitors.userId, userId),
            eq(domainMonitors.domainId, domainRecord.id),
          ),
        )
        .limit(1);

      if (!monitor) {
        throw new Error("Domain is not being monitored");
      }

      // Update settings
      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (settings.notifyOnDomainExpiry !== undefined) {
        updateData.notifyOnDomainExpiry = settings.notifyOnDomainExpiry;
      }

      if (settings.notifyOnCertExpiry !== undefined) {
        updateData.notifyOnCertExpiry = settings.notifyOnCertExpiry;
      }

      await db
        .update(domainMonitorSettings)
        .set(updateData)
        .where(eq(domainMonitorSettings.monitorId, monitor.id));

      return { success: true };
    }),
});
