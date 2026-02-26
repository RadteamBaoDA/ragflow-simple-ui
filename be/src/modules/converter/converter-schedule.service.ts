/**
 * @fileoverview Converter Schedule Service — manages conversion time windows.
 *
 * Stores schedule configuration in Redis so it can be updated at runtime
 * without restarting the backend. Provides helpers to check whether the
 * converter worker should be active based on the current time.
 *
 * @description Implements Singleton Pattern per coding guidelines.
 * @module modules/converter/converter-schedule
 */
import { getRedisClient } from "@/shared/services/redis.service.js";
import { config } from "@/shared/config/index.js";
import { log } from "@/shared/services/logger.service.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Schedule configuration for the document converter.
 */
export interface ConverterScheduleConfig {
  /** Start hour (0-23) of the conversion window */
  startHour: number;
  /** End hour (0-23) of the conversion window */
  endHour: number;
  /** IANA timezone string (e.g., 'Asia/Ho_Chi_Minh') */
  timezone: string;
  /** Whether scheduled conversion is enabled */
  enabled: boolean;
}

// ============================================================================
// Redis Key
// ============================================================================

/** Redis hash key for schedule configuration */
const SCHEDULE_CONFIG_KEY = "converter:schedule:config";

// ============================================================================
// Service
// ============================================================================

/**
 * ConverterScheduleService manages the converter processing schedule.
 * @description Singleton pattern — use getSharedInstance().
 */
export class ConverterScheduleService {
  /** Singleton instance */
  private static instance: ConverterScheduleService;

  /**
   * Get the shared singleton instance.
   * @returns ConverterScheduleService singleton
   */
  static getSharedInstance(): ConverterScheduleService {
    if (!this.instance) {
      this.instance = new ConverterScheduleService();
    }
    return this.instance;
  }

  /**
   * Get default schedule config from env/config.
   * @returns Default ConverterScheduleConfig
   */
  private getDefaults(): ConverterScheduleConfig {
    return {
      startHour: config.converter.scheduleStart,
      endHour: config.converter.scheduleEnd,
      timezone: config.converter.timezone,
      enabled: true,
    };
  }

  // --------------------------------------------------------------------------
  // CRUD
  // --------------------------------------------------------------------------

  /**
   * Get the current schedule configuration.
   * Falls back to defaults from env if not stored in Redis yet.
   * @returns Current ConverterScheduleConfig
   */
  async getConfig(): Promise<ConverterScheduleConfig> {
    const client = getRedisClient();

    // If Redis is not available, return defaults
    if (!client) {
      return this.getDefaults();
    }

    const data = await client.hGetAll(SCHEDULE_CONFIG_KEY);

    // If no config stored yet, return defaults
    if (!data || !data.startHour) {
      return this.getDefaults();
    }

    return {
      startHour: parseInt(data.startHour ?? "22", 10),
      endHour: parseInt(data.endHour ?? "5", 10),
      timezone: data.timezone ?? this.getDefaults().timezone,
      enabled: data.enabled === "true",
    };
  }

  /**
   * Update the schedule configuration stored in Redis.
   * @param update - Partial config to merge
   * @returns Updated ConverterScheduleConfig
   */
  async updateConfig(
    update: Partial<ConverterScheduleConfig>,
  ): Promise<ConverterScheduleConfig> {
    const client = getRedisClient();
    if (!client) {
      throw new Error(
        "Redis client not available — schedule config requires Redis",
      );
    }

    // Merge with current config
    const current = await this.getConfig();
    const merged: ConverterScheduleConfig = {
      startHour: update.startHour ?? current.startHour,
      endHour: update.endHour ?? current.endHour,
      timezone: update.timezone ?? current.timezone,
      enabled: update.enabled ?? current.enabled,
    };

    // Validate hours
    if (merged.startHour < 0 || merged.startHour > 23) {
      throw new Error("startHour must be between 0 and 23");
    }
    if (merged.endHour < 0 || merged.endHour > 23) {
      throw new Error("endHour must be between 0 and 23");
    }

    // Store in Redis
    await client.hSet(SCHEDULE_CONFIG_KEY, {
      startHour: merged.startHour.toString(),
      endHour: merged.endHour.toString(),
      timezone: merged.timezone,
      enabled: merged.enabled.toString(),
    });

    log.info(
      "Converter schedule config updated",
      merged as unknown as Record<string, unknown>,
    );
    return merged;
  }

  // --------------------------------------------------------------------------
  // Schedule Checking
  // --------------------------------------------------------------------------

  /**
   * Check if the current time falls within the conversion window.
   * Handles overnight windows (e.g., 22:00 → 05:00).
   * @returns True if the converter should be processing now
   */
  async isWithinSchedule(): Promise<boolean> {
    const scheduleConfig = await this.getConfig();

    // If scheduling is disabled, always return false (only manual trigger works)
    if (!scheduleConfig.enabled) return false;

    // Get current hour in the configured timezone
    const currentHour = this.getCurrentHourInTimezone(scheduleConfig.timezone);
    const { startHour, endHour } = scheduleConfig;

    // Handle overnight window (e.g., 22:00 → 05:00)
    if (startHour > endHour) {
      // Window crosses midnight
      return currentHour >= startHour || currentHour < endHour;
    }

    // Same-day window (e.g., 02:00 → 06:00)
    return currentHour >= startHour && currentHour < endHour;
  }

  /**
   * Get the current hour in a specific timezone.
   * @param timezone - IANA timezone string
   * @returns Current hour (0-23)
   */
  private getCurrentHourInTimezone(timezone: string): number {
    try {
      // Use Intl.DateTimeFormat to get the hour in the target timezone
      const formatter = new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hour12: false,
        timeZone: timezone,
      });
      const parts = formatter.formatToParts(new Date());
      const hourPart = parts.find((p) => p.type === "hour");
      return parseInt(hourPart?.value ?? "0", 10);
    } catch {
      // Fallback to UTC if timezone is invalid
      log.warn("Invalid timezone, falling back to UTC", { timezone });
      return new Date().getUTCHours();
    }
  }
}

/** Exported singleton instance */
export const converterScheduleService =
  ConverterScheduleService.getSharedInstance();
