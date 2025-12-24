export interface BroadcastMessage {
  id: string;
  message: string;
  is_active: boolean;
  isActive?: boolean;
  starts_at?: string;
  ends_at?: string;
  color?: string;
  font_color?: string;
  is_dismissible?: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
