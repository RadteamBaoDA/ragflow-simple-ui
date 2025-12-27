/**
 * @fileoverview Type definitions for the Broadcast feature.
 */

/**
 * @description Represents a broadcast message used for system-wide announcements.
 */
export interface BroadcastMessage {
  /** Unique identifier for the broadcast message */
  id: string;
  /** The content of the message */
  message: string;
  /** Whether the message is currently active (snake_case) */
  is_active: boolean;
  /** Whether the message is currently active (camelCase fallback) */
  isActive?: boolean;
  /** ISO timestamp for when the message should start being displayed */
  starts_at?: string;
  /** ISO timestamp for when the message should stop being displayed */
  ends_at?: string;
  /** Background color for the banner (e.g., hex code or CSS class) */
  color?: string;
  /** Font color for the message text */
  font_color?: string;
  /** Whether users can dismiss the message */
  is_dismissible?: boolean;
  /** ID or Name of the user who created the message */
  createdBy: string;
  /** ISO timestamp of creation */
  createdAt: string;
  /** ISO timestamp of last update */
  updatedAt: string;
}
